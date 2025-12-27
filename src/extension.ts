import * as vscode from 'vscode';
import * as path from 'path';
import { sendCodeToScanaxBackend, requestFix, scanDependencies } from './services/apiService';
import { DiagnosticManager } from './scanner/diagnosticManager';
import { ScanaxCodeActionProvider } from './scanner/codeActionProvider';
import { ScanaxHoverProvider } from './scanner/hoverProvider';
import { VulnerabilityPanel } from './webview/panel';
import { WelcomePanel } from './webview/welcomePanel';

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

export function activate(context: vscode.ExtensionContext) {
    diagnosticManager = new DiagnosticManager();
    vulnerabilityTreeProvider = new VulnerabilityTreeProvider();

    vscode.window.registerTreeDataProvider('scanax.securityDashboard', vulnerabilityTreeProvider);

    // Register hover provider for inline vulnerability preview
    const hoverProvider = new ScanaxHoverProvider(diagnosticManager['diagnosticCollection']);
    context.subscriptions.push(
        vscode.languages.registerHoverProvider({ scheme: 'file' }, hoverProvider)
    );

    // Show welcome page on first install
    const config = vscode.workspace.getConfiguration('scanax');
    const showWelcome = config.get<boolean>('showWelcome', true);
    if (showWelcome) {
        setTimeout(() => {
            WelcomePanel.createOrShow(context.extensionUri);
        }, 1000);
    }

    let allVulnerabilities: any[] = [];

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

    const performScan = async (filesToScan: vscode.Uri[]): Promise<Map<string, any[]>> => {
        const config = vscode.workspace.getConfiguration('scanax');
        const userKey = config.get<string>('provider') === 'Groq (Custom)' ? config.get<string>('customApiKey') : null;

        const scanResults = new Map<string, any[]>();
        for (const fileUri of filesToScan) {
            try {
                const document = await vscode.workspace.openTextDocument(fileUri);
                const code = document.getText();
                const totalLines = document.lineCount;
                
                // Skip empty files or massive files (> 1MB)
                if (code.trim() && code.length < 1000000) {
                    const response = await sendCodeToScanaxBackend(code, userKey);
                    let vulnerabilities = (response && response.errors) ? response.errors : [];
                    
                    // Validate line numbers against actual file
                    vulnerabilities = vulnerabilities.filter((v: any) => {
                        const line = v.line || 0;
                        return line >= 1 && line <= totalLines;
                    });
                    
                    if (vulnerabilities.length > 0) {
                        scanResults.set(fileUri.toString(), vulnerabilities);
                    }
                }
            } catch (err) { console.error(`Error scanning file ${fileUri.fsPath}:`, err); }
        }
        return scanResults;
    };

    const runScanCommand = vscode.commands.registerCommand('scanax.runScan', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active file to scan');
            return;
        }

        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "Scanax: Scanning file..." }, async () => {
            try {
                const config = vscode.workspace.getConfiguration('scanax');
                const userKey = config.get<string>('provider') === 'Groq (Custom)' ? config.get<string>('customApiKey') : null;
                const response = await sendCodeToScanaxBackend(editor.document.getText(), userKey);
                const vulnerabilities = (response && response.errors) ? response.errors : [];
                
                // Set diagnostics for squiggly lines
                diagnosticManager.setDiagnostics(editor.document, vulnerabilities);
                
                // Update tree view
                const scanResults = new Map<string, any[]>();
                if (vulnerabilities.length > 0) {
                    scanResults.set(editor.document.uri.toString(), vulnerabilities);
                }
                vulnerabilityTreeProvider.setScanResults(scanResults);
                
                // Update panel
                allVulnerabilities = vulnerabilities.map((v: any) => ({ 
                    ...v, 
                    file: editor.document.uri.fsPath, 
                    fileUri: editor.document.uri 
                }));
                
                VulnerabilityPanel.createOrShow(context.extensionUri);
                if (VulnerabilityPanel.currentPanel) {
                    VulnerabilityPanel.currentPanel.updateVulnerabilities(allVulnerabilities);
                }
                
                if (vulnerabilities.length === 0) {
                    vscode.window.showInformationMessage('✅ No vulnerabilities found in this file');
                }
            } catch (err) { 
                vscode.window.showErrorMessage(`Scanax Error: ${err}`); 
            }
        });
    });

    const workspaceScanCommand = vscode.commands.registerCommand('scanax.workspaceScan', async () => {
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "Scanax: Full Universal Workspace Scan..." }, async () => {
            try {
                const allFiles = await vscode.workspace.findFiles('**/*', '{**/node_modules/**,**/bin/**,**/obj/**,**/.git/**,**/dist/**,**/build/**}');
                const scanResults = await performScan(allFiles);
                vulnerabilityTreeProvider.setScanResults(scanResults);
                
                allVulnerabilities = [];
                for (const [fileUri, vulns] of scanResults.entries()) {
                    const uri = vscode.Uri.parse(fileUri);
                    allVulnerabilities.push(...vulns.map((v: any) => ({ ...v, file: uri.fsPath, fileUri: uri })));
                    const doc = await vscode.workspace.openTextDocument(uri);
                    diagnosticManager.setDiagnostics(doc, vulns);
                }
                
                VulnerabilityPanel.createOrShow(context.extensionUri);
                if (VulnerabilityPanel.currentPanel) { VulnerabilityPanel.currentPanel.updateVulnerabilities(allVulnerabilities); }
            } catch (err) { vscode.window.showErrorMessage(`Scanax Error: ${err}`); }
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
            const userKey = config.get<string>('provider') === 'Groq (Custom)' ? config.get<string>('customApiKey') : null;
            
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
                const userKey = config.get<string>('provider') === 'Groq (Custom)' ? config.get<string>('customApiKey') : null;
                
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
    
    const welcomeCommand = vscode.commands.registerCommand('scanax.showWelcome', () => {
        WelcomePanel.createOrShow(context.extensionUri);
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
    
    context.subscriptions.push(
        runScanCommand, workspaceScanCommand, scanNowCommand, openPanelCommand,
        getSuggestedFixCommand, fixAllVulnerabilitiesCommand, scanDependenciesCommand,
        welcomeCommand, startTutorialCommand, openSampleCodeCommand,
        // FIXED: plural 'registerCodeActionsProvider'
        vscode.languages.registerCodeActionsProvider({ scheme: 'file', language: '*' }, new ScanaxCodeActionProvider(), { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }),
        vscode.workspace.onDidSaveTextDocument(doc => { vscode.commands.executeCommand('scanax.runScan'); }),
        diagnosticManager
    );
}

export function deactivate() { if (diagnosticManager) diagnosticManager.dispose(); }