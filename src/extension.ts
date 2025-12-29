import * as vscode from 'vscode';
import * as path from 'path';
import { sendCodeToScanaxBackend, requestFix, scanDependencies, reportFalsePositive, NetworkError, BackendError, ApiKeyError } from './services/apiService';
import { DiagnosticManager } from './scanner/diagnosticManager';
import { ScanaxCodeActionProvider } from './scanner/codeActionProvider';
import { ScanaxHoverProvider } from './scanner/hoverProvider';
import { VulnerabilityPanel } from './webview/panel';
import { WelcomeViewProvider } from './webview/welcomeView';
import { CacheManager } from './scanner/cacheManager';
import { StaticAnalyzer } from './scanner/staticAnalyzer';
import { IgnoreManager } from './scanner/ignoreManager';
import { BackendHealthChecker } from './services/healthChecker';
import { ApiKeyManager } from './services/apiKeyManager';

// Tree item for file vulnerabilities
class VulnerabilityTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly fileUri?: vscode.Uri,
        public readonly line?: number,
        public readonly message?: string,
        public readonly fix?: string
    ) {
        super(label, collapsibleState);
        
        if (fileUri && line && message) {
            this.command = {
                title: "Reveal",
                command: "vscode.open",
                arguments: [fileUri, { selection: new vscode.Range(line - 1, 0, line - 1, 0) }]
            };
            this.contextValue = "vulnerability";
            this.iconPath = new vscode.ThemeIcon("error", new vscode.ThemeColor("errorForeground"));
            this.description = `Line ${line}: ${message}`;
        }
    }
}

class VulnerabilityTreeProvider implements vscode.TreeDataProvider<VulnerabilityTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<VulnerabilityTreeItem | undefined | void> = 
        new vscode.EventEmitter<VulnerabilityTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<VulnerabilityTreeItem | undefined | void> = this._onDidChangeTreeData.event;
    
    private scanResults: Map<string, any[]> = new Map(); 

    setScanResults(results: Map<string, any[]>) {
        this.scanResults = results;
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: VulnerabilityTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: VulnerabilityTreeItem): vscode.ProviderResult<VulnerabilityTreeItem[]> {
        if (!element) {
            if (this.scanResults.size === 0) {
                return [new VulnerabilityTreeItem("No vulnerabilities found", vscode.TreeItemCollapsibleState.None)];
            }
            return Array.from(this.scanResults.entries()).map(([fileUri, vulns]) => {
                const uri = vscode.Uri.parse(fileUri);
                const fileName = uri.fsPath.split(/[\\/]/).pop() || 'Unknown File';
                return new VulnerabilityTreeItem(`${fileName} (${vulns.length})`, vscode.TreeItemCollapsibleState.Expanded, uri);
            });
        } else if (element.fileUri && element.line === undefined) {
            const fileUri = element.fileUri.toString();
            const vulns = this.scanResults.get(fileUri) || [];
            return vulns.map(vuln => new VulnerabilityTreeItem(
                `[${vuln.line}] ${vuln.message}`,
                vscode.TreeItemCollapsibleState.None,
                element.fileUri,
                vuln.line,
                vuln.message,
                vuln.fix
            ));
        }
        return [];
    }

    refresh(): void { this._onDidChangeTreeData.fire(); }
    clear(): void { this.scanResults.clear(); this._onDidChangeTreeData.fire(); }
}

let diagnosticManager: DiagnosticManager;
let vulnerabilityTreeProvider: VulnerabilityTreeProvider;
let cacheManager: CacheManager;
let staticAnalyzer: StaticAnalyzer;
let ignoreManager: IgnoreManager;
let debounceTimer: NodeJS.Timeout | undefined;
let realTimeScanEnabled: boolean = false;
let healthChecker: BackendHealthChecker;

export function activate(context: vscode.ExtensionContext) {    
    // Set context key FIRST before registering views
    const hasSeenSetup = context.globalState.get<boolean>('hasSeenSetup', false);
    console.log('hasSeenSetup:', hasSeenSetup);
    vscode.commands.executeCommand('setContext', 'scanax.setupComplete', hasSeenSetup);

    diagnosticManager = new DiagnosticManager();
    vulnerabilityTreeProvider = new VulnerabilityTreeProvider();
    cacheManager = new CacheManager();
    staticAnalyzer = new StaticAnalyzer();
    ignoreManager = new IgnoreManager();
    healthChecker = new BackendHealthChecker();

    vscode.window.registerTreeDataProvider('scanax.securityDashboard', vulnerabilityTreeProvider);

    // Register welcome view in sidebar
    console.log('========================================');
    console.log('REGISTERING WELCOME VIEW PROVIDER');
    console.log('========================================');
    const welcomeViewProvider = new WelcomeViewProvider(context.extensionUri, context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('scanax.welcomeView', welcomeViewProvider, {
            webviewOptions: { retainContextWhenHidden: true }
        })
    );
    console.log('Welcome view provider registered successfully');

    // Start backend health monitoring
    const config = vscode.workspace.getConfiguration('scanax');
    const backendUrl = config.get<string>('backendUrl', 'https://scanax-backend.onrender.com');
    healthChecker.start(backendUrl);

    // Register hover provider for inline vulnerability preview
    const hoverProvider = new ScanaxHoverProvider(diagnosticManager['diagnosticCollection']);
    context.subscriptions.push(
        vscode.languages.registerHoverProvider({ scheme: 'file' }, hoverProvider)
    );

    // Watch for .scanaxignore changes
    const ignoreFileWatcher = vscode.workspace.createFileSystemWatcher('**/.scanaxignore');
    ignoreFileWatcher.onDidChange(() => ignoreManager.reload());
    ignoreFileWatcher.onDidCreate(() => ignoreManager.reload());
    ignoreFileWatcher.onDidDelete(() => ignoreManager.reload());
    context.subscriptions.push(ignoreFileWatcher);

    let allVulnerabilities: any[] = [];

    // Helper function to filter out false positives
    const filterFalsePositives = (vulnerabilities: any[], filePath: string): any[] => {
        const falsePositives = context.globalState.get<any[]>('falsePositives', []);
        if (falsePositives.length === 0) {
            return vulnerabilities;
        }
        
        return vulnerabilities.filter(vuln => {
            const isFalsePositive = falsePositives.some(fp => 
                fp.file === filePath && 
                fp.line === vuln.line &&
                (fp.type === vuln.type || fp.type === vuln.category)
            );
            return !isFalsePositive;
        });
    };

    const applySurgicalFix = async (document: vscode.TextDocument, fixedCode: string, lineNumber: number): Promise<boolean> => {
        const edit = new vscode.WorkspaceEdit();
        
        try {
            // Get the vulnerable line
            const lineIdx = lineNumber - 1;
            if (lineIdx < 0 || lineIdx >= document.lineCount) {
                vscode.window.showErrorMessage(`Invalid line number: ${lineNumber}`);
                return false;
            }
            
            const line = document.lineAt(lineIdx);
            const lineText = line.text;
            
            // Get the indentation from the original line
            const indentMatch = lineText.match(/^(\s*)/);
            const originalIndent = indentMatch ? indentMatch[1] : '';
            
            // Apply indentation to fixed code if it doesn't have it
            let finalFixedCode = fixedCode;
            if (!fixedCode.startsWith(originalIndent) && fixedCode.trim()) {
                finalFixedCode = originalIndent + fixedCode.trim();
            }
            
            // Replace the line
            edit.replace(document.uri, line.range, finalFixedCode);
            
            const success = await vscode.workspace.applyEdit(edit);
            if (success) {
                await document.save();
            }
            return success;
        } catch (err) {
            console.error('Fix application error:', err);
            return false;
        }
    };

    const performScan = async (filesToScan: vscode.Uri[], progress?: vscode.Progress<{ message?: string; increment?: number }>): Promise<Map<string, any[]>> => {
        const config = vscode.workspace.getConfiguration('scanax');
        const userKey = config.get<string>('customApiKey') || null;

        const scanResults = new Map<string, any[]>();
        const totalFiles = filesToScan.length;
        let scannedFiles = 0;

        // Process files in parallel batches of 5
        const batchSize = 5;
        for (let i = 0; i < filesToScan.length; i += batchSize) {
            const batch = filesToScan.slice(i, Math.min(i + batchSize, filesToScan.length));
            
            await Promise.all(batch.map(async (fileUri) => {
                try {
                    const document = await vscode.workspace.openTextDocument(fileUri);
                    const code = document.getText();
                    const totalLines = document.lineCount;
                    
                    // Skip empty files, massive files (> 1MB), or ignored files
                    if (!code.trim() || code.length >= 1000000 || ignoreManager.isFileIgnored(fileUri.fsPath)) {
                        return;
                    }

                    let vulnerabilities: any[] = [];

                    // Check cache first
                    const cached = cacheManager.getCachedResult(fileUri.toString(), code);
                    if (cached !== null) {
                        vulnerabilities = cached;
                    } else {
                        // Use static analysis first for quick wins
                        if (staticAnalyzer.shouldUseStaticAnalysis(document)) {
                            const staticVulns = staticAnalyzer.scan(document);
                            vulnerabilities.push(...staticVulns);
                        }

                        // Then do LLM scan for deeper analysis
                        try {
                            const response = await sendCodeToScanaxBackend(code, userKey);
                            const llmVulns = (response && response.errors) ? response.errors : [];
                            vulnerabilities.push(...llmVulns);
                        } catch (err) {
                            // If LLM fails, at least we have static analysis results
                            if (err instanceof NetworkError || err instanceof BackendError) {
                                console.log('LLM scan failed, using static analysis only:', err.message);
                            } else {
                                throw err;
                            }
                        }

                        // Validate line numbers against actual file
                        vulnerabilities = vulnerabilities.filter((v: any) => {
                            const line = v.line || 0;
                            return line >= 1 && line <= totalLines;
                        });

                        // Apply ignore rules
                        vulnerabilities = ignoreManager.filterIgnored(document, vulnerabilities);

                        // Cache the results
                        cacheManager.setCachedResult(fileUri.toString(), code, vulnerabilities);
                    }
                    
                    if (vulnerabilities.length > 0) {
                        scanResults.set(fileUri.toString(), vulnerabilities);
                    }
                } catch (err) { 
                    console.error(`Error scanning file ${fileUri.fsPath}:`, err); 
                }
                
                scannedFiles++;
                if (progress) {
                    progress.report({ 
                        message: `Scanning... ${scannedFiles}/${totalFiles} files`,
                        increment: (100 / totalFiles)
                    });
                }
            }));
        }
        
        return scanResults;
    };

    const runScanCommand = vscode.commands.registerCommand('scanax.runScan', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active file to scan');
            return;
        }

        await vscode.window.withProgress({ 
            location: vscode.ProgressLocation.Notification, 
            title: "Scanax: Scanning file..." 
        }, async (progress) => {
            try {
                progress.report({ message: "Analyzing code..." });
                
                const document = editor.document;
                const code = document.getText();
                
                // Check cache first
                let vulnerabilities: any[] = [];
                const cached = cacheManager.getCachedResult(document.uri.toString(), code);
                
                if (cached !== null) {
                    vulnerabilities = cached;
                    progress.report({ message: "Using cached results..." });
                } else {
                    // Static analysis
                    if (staticAnalyzer.shouldUseStaticAnalysis(document)) {
                        progress.report({ message: "Running static analysis..." });
                        const staticVulns = staticAnalyzer.scan(document);
                        vulnerabilities.push(...staticVulns);
                    }

                    // LLM analysis
                    progress.report({ message: "Running AI analysis..." });
                    const config = vscode.workspace.getConfiguration('scanax');
                    const userKey = config.get<string>('customApiKey') || null;
                    
                    try {
                        const response = await sendCodeToScanaxBackend(code, userKey);
                        const llmVulns = (response && response.errors) ? response.errors : [];
                        vulnerabilities.push(...llmVulns);
                    } catch (err) {
                        if (err instanceof ApiKeyError) {
                            vscode.window.showErrorMessage(`API Key Error: ${err.message}`);
                            return;
                        } else if (err instanceof BackendError) {
                            vscode.window.showErrorMessage(`Backend Error: ${err.message}`);
                            return;
                        } else if (err instanceof NetworkError) {
                            vscode.window.showErrorMessage(`Network Error: ${err.message}`);
                            return;
                        }
                        throw err;
                    }

                    // Apply ignore rules
                    vulnerabilities = ignoreManager.filterIgnored(document, vulnerabilities);
                    
                    // Filter out false positives
                    vulnerabilities = filterFalsePositives(vulnerabilities, document.uri.fsPath);
                    
                    // Cache results
                    cacheManager.setCachedResult(document.uri.toString(), code, vulnerabilities);
                }
                
                // Set diagnostics for squiggly lines
                diagnosticManager.setDiagnostics(document, vulnerabilities);
                
                // Update tree view
                const scanResults = new Map<string, any[]>();
                if (vulnerabilities.length > 0) {
                    scanResults.set(document.uri.toString(), vulnerabilities);
                }
                vulnerabilityTreeProvider.setScanResults(scanResults);
                
                // Update panel
                allVulnerabilities = vulnerabilities.map((v: any) => ({ 
                    ...v, 
                    file: document.uri.fsPath, 
                    fileUri: document.uri 
                }));
                
                VulnerabilityPanel.createOrShow(context.extensionUri);
                if (VulnerabilityPanel.currentPanel) {
                    VulnerabilityPanel.currentPanel.updateVulnerabilities(allVulnerabilities);
                }
                
                if (vulnerabilities.length === 0) {
                    vscode.window.showInformationMessage('✅ No vulnerabilities found in this file');
                } else {
                    vscode.window.showInformationMessage(`🛡️ Found ${vulnerabilities.length} potential issue(s)`);
                }
            } catch (err: any) { 
                vscode.window.showErrorMessage(`Scanax Error: ${err?.message || err}`); 
            }
        });
    });

    const workspaceScanCommand = vscode.commands.registerCommand('scanax.workspaceScan', async () => {
        await vscode.window.withProgress({ 
            location: vscode.ProgressLocation.Notification, 
            title: "Scanax: Workspace Scan", 
            cancellable: false 
        }, async (progress) => {
            try {
                progress.report({ message: "Finding files...", increment: 0 });
                const allFiles = await vscode.workspace.findFiles(
                    '**/*.{js,ts,jsx,tsx,py,java,go,php,rb,c,cpp,cs}', 
                    '{**/node_modules/**,**/bin/**,**/obj/**,**/.git/**,**/dist/**,**/build/**,**/out/**,**/vendor/**}'
                );
                
                progress.report({ message: `Scanning ${allFiles.length} files...` });
                const scanResults = await performScan(allFiles, progress);
                
                vulnerabilityTreeProvider.setScanResults(scanResults);
                
                allVulnerabilities = [];
                for (const [fileUri, vulns] of scanResults.entries()) {
                    const uri = vscode.Uri.parse(fileUri);
                    allVulnerabilities.push(...vulns.map((v: any) => ({ ...v, file: uri.fsPath, fileUri: uri })));
                    const doc = await vscode.workspace.openTextDocument(uri);
                    diagnosticManager.setDiagnostics(doc, vulns);
                }
                
                VulnerabilityPanel.createOrShow(context.extensionUri);
                if (VulnerabilityPanel.currentPanel) { 
                    VulnerabilityPanel.currentPanel.updateVulnerabilities(allVulnerabilities); 
                }

                const totalVulns = allVulnerabilities.length;
                if (totalVulns === 0) {
                    vscode.window.showInformationMessage(`✅ Workspace scan complete: No vulnerabilities found!`);
                } else {
                    const critical = allVulnerabilities.filter(v => v.severity === 'critical').length;
                    const high = allVulnerabilities.filter(v => v.severity === 'high').length;
                    vscode.window.showWarningMessage(
                        `Scan complete: ${totalVulns} issues found (${critical} critical, ${high} high)`
                    );
                }
            } catch (err: any) { 
                vscode.window.showErrorMessage(`Scanax Error: ${err?.message || err}`); 
            }
        });
    });

    const getSuggestedFixCommand = vscode.commands.registerCommand('scanax.getSuggestedFix', async (vulnData: any) => {
        try {
            // Find the vulnerability in the allVulnerabilities array
            const vuln = allVulnerabilities.find(v => v.file === vulnData.file && v.line === vulnData.line);
            if (!vuln) {
                vscode.window.showErrorMessage('Vulnerability not found.');
                return;
            }

            // Get the document
            const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(vuln.file));
            const code = doc.getText();

            const config = vscode.workspace.getConfiguration('scanax');
            const userKey = config.get<string>('customApiKey') || null;
            
            const response = await vscode.window.withProgress({ 
                location: vscode.ProgressLocation.Notification, 
                title: "Getting suggestion..." 
            }, async () => {
                return await requestFix(code, vuln.message || vuln.title, userKey, vuln.line);
            });
            
            // Update panel
            if (VulnerabilityPanel.currentPanel) {
                VulnerabilityPanel.currentPanel.updateVulnerabilityWithFix(
                    vuln.file,
                    vuln.line, 
                    response.fixed_code,
                    response.explanation
                );
            }
        } catch (err: any) { 
            vscode.window.showErrorMessage(`Failed: ${err?.message || err}`); 
        }
    });

    const fixAllVulnerabilitiesCommand = vscode.commands.registerCommand('scanax.fixAllVulnerabilities', async () => {
        if (allVulnerabilities.length === 0) {
            vscode.window.showInformationMessage('No vulnerabilities to fix.');
            return;
        }
        
        vscode.window.showWarningMessage('Fix All feature temporarily disabled. Please use individual "Suggest Fix" for each vulnerability.');
        return;
    });

    const scanNowCommand = vscode.commands.registerCommand('scanax.scanNow', () => vscode.commands.executeCommand('scanax.workspaceScan'));
    const openPanelCommand = vscode.commands.registerCommand('scanax.openPanel', () => VulnerabilityPanel.createOrShow(context.extensionUri));
    
    const scanDependenciesCommand = vscode.commands.registerCommand('scanax.scanDependencies', async () => {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Scanax: Scanning Dependencies..."
        }, async () => {
            try {
                const config = vscode.workspace.getConfiguration('scanax');
                const userKey = config.get<string>('customApiKey') || null;
                
                const results = await scanDependencies(userKey);
                
                if (results.vulnerabilities.length === 0) {
                    vscode.window.showInformationMessage('✅ No dependency vulnerabilities found!');
                } else {
                    const total = results.vulnerabilities.length;
                    const critical = results.vulnerabilities.filter((v: any) => v.severity === 'critical').length;
                    const high = results.vulnerabilities.filter((v: any) => v.severity === 'high').length;
                    
                    vscode.window.showWarningMessage(
                        `⚠️ Found ${total} dependency vulnerabilities (${critical} critical, ${high} high)`
                    );
                    
                    // Show results in output channel
                    const outputChannel = vscode.window.createOutputChannel('Scanax Dependencies');
                    outputChannel.clear();
                    outputChannel.appendLine('=== DEPENDENCY SCAN RESULTS ===\n');
                    
                    for (const vuln of results.vulnerabilities) {
                        outputChannel.appendLine(`[${vuln.severity.toUpperCase()}] ${vuln.package}`);
                        outputChannel.appendLine(`  Version: ${vuln.version}`);
                        outputChannel.appendLine(`  Issue: ${vuln.message}`);
                        if (vuln.cve) {
                            outputChannel.appendLine(`  CVE: ${vuln.cve}`);
                        }
                        if (vuln.recommendation) {
                            outputChannel.appendLine(`  Fix: ${vuln.recommendation}`);
                        }
                        outputChannel.appendLine('');
                    }
                    
                    outputChannel.show();
                }
            } catch (err: any) {
                vscode.window.showErrorMessage(`Dependency scan failed: ${err?.message || err}`);
            }
        });
    });
    
    const startTutorialCommand = vscode.commands.registerCommand('scanax.startTutorial', async () => {
        const steps = [
            { message: "Welcome to Scanax! Let's scan your first file.", action: null },
            { message: "First, make sure the backend server is running at localhost:8000", action: null },
            { message: "Now open any code file in your workspace", action: null },
            { message: "Press Ctrl+Shift+S to scan the current file", action: 'scanax.runScan' },
            { message: "Great! Check the Scanax sidebar for detected vulnerabilities", action: null },
            { message: "Hover over any red squiggle to see vulnerability details", action: null },
            { message: "Click 'Get Fix Suggestion' to get AI-powered fixes", action: null },
            { message: "Tutorial complete! Happy secure coding! 🛡️", action: null }
        ];

        for (const step of steps) {
            const choice = await vscode.window.showInformationMessage(
                step.message,
                { modal: false },
                step.action ? 'Continue' : 'Next',
                'Skip Tutorial'
            );

            if (choice === 'Skip Tutorial') {
                break;
            }

            if (choice === 'Continue' && step.action) {
                await vscode.commands.executeCommand(step.action);
            }

            await new Promise(resolve => setTimeout(resolve, 500));
        }
    });

    const openSampleCodeCommand = vscode.commands.registerCommand('scanax.openSampleCode', async () => {
        const choice = await vscode.window.showQuickPick(
            [
                { label: '$(file-code) JavaScript Sample', description: 'vulnerable-sample.js', file: 'vulnerable-sample.js' },
                { label: '$(file-code) Python Sample', description: 'vulnerable-sample.py', file: 'vulnerable-sample.py' }
            ],
            { placeHolder: 'Choose a sample vulnerable file to open' }
        );

        if (choice) {
            const samplePath = path.join(context.extensionPath, 'samples', choice.file);
            try {
                const doc = await vscode.workspace.openTextDocument(samplePath);
                await vscode.window.showTextDocument(doc);
                vscode.window.showInformationMessage(
                    `Opened ${choice.file}. Press Ctrl+Shift+S to scan it!`,
                    'Scan Now'
                ).then(selection => {
                    if (selection === 'Scan Now') {
                        vscode.commands.executeCommand('scanax.runScan');
                    }
                });
            } catch (err) {
                vscode.window.showErrorMessage(`Could not open sample file: ${err}`);
            }
        }
    });
    
    // Debounced real-time scanning on type
    const debouncedScan = async (document: vscode.TextDocument) => {
        // Check if real-time scanning is enabled
        if (!realTimeScanEnabled) {
            return;
        }

        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(async () => {
            try {
                const code = document.getText();
                
                // Quick static analysis only for real-time
                if (staticAnalyzer.shouldUseStaticAnalysis(document)) {
                    let vulnerabilities = staticAnalyzer.scan(document);
                    vulnerabilities = ignoreManager.filterIgnored(document, vulnerabilities);
                    diagnosticManager.setDiagnostics(document, vulnerabilities);
                }
            } catch (err) {
                console.error('Debounced scan error:', err);
            }
        }, 1000); // 1 second debounce
    };

    // Report false positive command
    const reportFalsePositiveCommand = vscode.commands.registerCommand('scanax.reportFalsePositive', async (vulnData: any) => {
        const reason = await vscode.window.showInputBox({
            prompt: 'Why is this a false positive? (optional)',
            placeHolder: 'This is not vulnerable because...'
        });

        if (reason !== undefined) { // User didn't cancel
            try {
                const config = vscode.workspace.getConfiguration('scanax');
                const userKey = config.get<string>('customApiKey') || null;
                
                const vuln = allVulnerabilities.find(v => 
                    v.file === vulnData.file && v.line === vulnData.line
                );

                if (vuln) {
                    // Store false positive locally
                    const falsePositives = context.globalState.get<any[]>('falsePositives', []);
                    const fpEntry = {
                        file: vuln.file,
                        line: vuln.line,
                        type: vuln.type || vuln.category,
                        message: vuln.message || vuln.title,
                        reason: reason || 'No reason provided',
                        timestamp: new Date().toISOString()
                    };
                    falsePositives.push(fpEntry);
                    await context.globalState.update('falsePositives', falsePositives);
                    
                    // Remove from current vulnerabilities list
                    allVulnerabilities = allVulnerabilities.filter(v => 
                        !(v.file === vuln.file && v.line === vuln.line)
                    );
                    
                    // Refresh diagnostics by re-running scan on the file
                    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(vuln.file));
                    const filteredVulns = allVulnerabilities.filter(v => v.file === vuln.file);
                    diagnosticManager.setDiagnostics(doc, filteredVulns);
                    
                    // Update panel
                    if (VulnerabilityPanel.currentPanel) {
                        VulnerabilityPanel.currentPanel.updateVulnerabilities(allVulnerabilities);
                    }
                    
                    // Update tree view
                    const scanResults = new Map<string, any[]>();
                    const fileVulns = allVulnerabilities.filter(v => v.file === vuln.file);
                    if (fileVulns.length > 0) {
                        scanResults.set(vscode.Uri.file(vuln.file).toString(), fileVulns);
                    }
                    vulnerabilityTreeProvider.setScanResults(scanResults);
                    
                    // Send to backend for training (non-blocking)
                    reportFalsePositive(doc.getText(), vuln, reason || 'No reason provided', userKey).catch(err => {
                        console.error('Error sending false positive to backend:', err);
                    });
                    
                    vscode.window.showInformationMessage('✓ Marked as false positive and removed from results');
                }
            } catch (err) {
                console.error('Error reporting false positive:', err);
            }
        }
    });

    // Create .scanaxignore file command
    const createIgnoreFileCommand = vscode.commands.registerCommand('scanax.createIgnoreFile', async () => {
        await ignoreManager.createSampleIgnoreFile();
    });

    // Clear cache command
    const clearCacheCommand = vscode.commands.registerCommand('scanax.clearCache', () => {
        cacheManager.clearAll();
        vscode.window.showInformationMessage('Scanax cache cleared!');
    });

    // Set real-time scan state command
    const setRealTimeScanCommand = vscode.commands.registerCommand('scanax.setRealTimeScan', (enabled: boolean) => {
        realTimeScanEnabled = enabled;
        const status = enabled ? 'enabled' : 'disabled';
        vscode.window.showInformationMessage(`Real-time scanning ${status}`);
    });

    // Backend health check command
    const checkHealthCommand = vscode.commands.registerCommand('scanax.checkBackendHealth', async () => {
        const config = vscode.workspace.getConfiguration('scanax');
        const backendUrl = config.get<string>('backendUrl', 'https://scanax-backend.onrender.com');
        await healthChecker.checkHealth(backendUrl);
    });

    // Listen for text changes (debounced scanning)
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            if (event.document.uri.scheme === 'file') {
                debouncedScan(event.document);
            }
        })
    );
    
    context.subscriptions.push(
        runScanCommand, workspaceScanCommand, scanNowCommand, openPanelCommand,
        getSuggestedFixCommand, fixAllVulnerabilitiesCommand, scanDependenciesCommand,
        startTutorialCommand, openSampleCodeCommand,
        reportFalsePositiveCommand, createIgnoreFileCommand, clearCacheCommand, setRealTimeScanCommand,
        checkHealthCommand,
        // FIXED: plural 'registerCodeActionsProvider'
        vscode.languages.registerCodeActionsProvider({ scheme: 'file', language: '*' }, new ScanaxCodeActionProvider(), { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }),
        vscode.workspace.onDidSaveTextDocument(doc => { vscode.commands.executeCommand('scanax.runScan'); }),
        diagnosticManager
    );
}

export function deactivate() { 
    if (diagnosticManager) {
        diagnosticManager.dispose();
    }
    if (healthChecker) {
        healthChecker.dispose();
    }
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
}