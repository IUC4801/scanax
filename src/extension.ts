import * as vscode from 'vscode';
import { sendCodeToScanaxBackend, requestFix } from './services/apiService';
import { DiagnosticManager } from './scanner/diagnosticManager';
import { ScanaxCodeActionProvider } from './scanner/codeActionProvider';
import { VulnerabilityPanel } from './webview/panel';

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

    let allVulnerabilities: any[] = [];

    const applySurgicalFix = async (document: vscode.TextDocument, changes: any[]): Promise<boolean> => {
    const edit = new vscode.WorkspaceEdit();
    const fullCode = document.getText();
    let applied = false;

    for (const change of (changes || [])) {
        // CLEANUP: Trim the AI input to prevent newline mismatches
        const searchStr = change.search.trim();
        const replaceStr = change.replace;

        // Escape regex special characters and allow flexible whitespace matching
        const escapedSearch = searchStr
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') 
            .replace(/\s+/g, '\\s+');

        const regex = new RegExp(escapedSearch, 'g');
        const matches = [...fullCode.matchAll(regex)];

        if (matches.length === 1) {
            const match = matches[0];
            const startPos = document.positionAt(match.index!);
            const endPos = document.positionAt(match.index! + match[0].length);
            
            // Apply the edit
            edit.replace(document.uri, new vscode.Range(startPos, endPos), replaceStr);
            applied = true;
        } else if (matches.length > 1) {
            vscode.window.showErrorMessage("Ambiguous match: Found multiple identical blocks. Please fix manually.");
        } else {
            // DEBUGGING: Very helpful for universal testing
            console.log("Surgical Fix Failed. Looking for:", searchStr);
        }
    }

    if (applied) {
        const success = await vscode.workspace.applyEdit(edit);
        if (success) {
            await document.save();
        }
        return success;
    }
    return false;
};

    const performScan = async (filesToScan: vscode.Uri[]): Promise<Map<string, any[]>> => {
        const config = vscode.workspace.getConfiguration('scanax');
        const userKey = config.get<string>('provider') === 'Groq (Custom)' ? config.get<string>('customApiKey') : null;

        const scanResults = new Map<string, any[]>();
        for (const fileUri of filesToScan) {
            try {
                const document = await vscode.workspace.openTextDocument(fileUri);
                const code = document.getText();
                // Skip empty files or massive files (> 1MB)
                if (code.trim() && code.length < 1000000) {
                    const response = await sendCodeToScanaxBackend(code, userKey);
                    const vulnerabilities = (response && response.errors) ? response.errors : [];
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
        if (!editor) return;

        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "Scanax: Universal Analysis..." }, async () => {
            try {
                const config = vscode.workspace.getConfiguration('scanax');
                const userKey = config.get<string>('provider') === 'Groq (Custom)' ? config.get<string>('customApiKey') : null;
                const response = await sendCodeToScanaxBackend(editor.document.getText(), userKey);
                const vulnerabilities = (response && response.errors) ? response.errors : [];
                diagnosticManager.setDiagnostics(editor.document, vulnerabilities);
                vulnerabilityTreeProvider.refresh();
            } catch (err) { vscode.window.showErrorMessage(`Scanax Error: ${err}`); }
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

    const fixVulnerabilityCommand = vscode.commands.registerCommand('scanax.fixVulnerability', async (vulnData: any) => {
        const fileUri = vulnData.fileUri || vscode.Uri.file(vulnData.file);
        if (!fileUri || !vulnData.line) return;

        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "Scanax: Applying Semantic Fix..." }, async () => {
            try {
                const config = vscode.workspace.getConfiguration('scanax');
                const userKey = config.get<string>('provider') === 'Groq (Custom)' ? config.get<string>('customApiKey') : null;
                const document = await vscode.workspace.openTextDocument(fileUri);
                const response = await requestFix(document.getText(), vulnData.message, userKey, vulnData.line);
                const success = await applySurgicalFix(document, response.changes);

                if (success) {
                    await document.save();
                    if (VulnerabilityPanel.currentPanel) { VulnerabilityPanel.currentPanel.removeVulnerability(vulnData.file, vulnData.line); }
                    allVulnerabilities = allVulnerabilities.filter(v => !(v.file === vulnData.file && v.line === vulnData.line));
                    vscode.window.showInformationMessage('Universal fix applied!');
                } else {
                    vscode.window.showErrorMessage('Surgical fix failed: Pattern match not found.');
                }
            } catch (err) { vscode.window.showErrorMessage(`Fix error: ${err}`); }
        });
    });

    const fixAllVulnerabilitiesCommand = vscode.commands.registerCommand('scanax.fixAllVulnerabilities', async () => {
        if (allVulnerabilities.length === 0) return;
        const confirm = await vscode.window.showWarningMessage(`Apply ${allVulnerabilities.length} universal fixes?`, { modal: true }, 'Confirm');
        if (confirm !== 'Confirm') return;

        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "Scanax: Bulk Fixing..." }, async () => {
            const config = vscode.workspace.getConfiguration('scanax');
            const userKey = config.get<string>('provider') === 'Groq (Custom)' ? config.get<string>('customApiKey') : null;
            const grouped = allVulnerabilities.reduce((acc, v) => { acc[v.file] = acc[v.file] || []; acc[v.file].push(v); return acc; }, {} as any);

            for (const filePath in grouped) {
                const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
                const sortedVulns = grouped[filePath].sort((a: any, b: any) => b.line - a.line);
                for (const vuln of sortedVulns) {
                    try {
                        const res = await requestFix(doc.getText(), vuln.message, userKey, vuln.line);
                        await applySurgicalFix(doc, res.changes);
                    } catch (e) { console.error(`Failed fix at ${filePath}:${vuln.line}`, e); }
                }
                await doc.save();
            }
            vscode.window.showInformationMessage('Bulk fix complete!');
            await vscode.commands.executeCommand('scanax.workspaceScan');
        });
    });

    const scanNowCommand = vscode.commands.registerCommand('scanax.scanNow', () => vscode.commands.executeCommand('scanax.workspaceScan'));
    const openPanelCommand = vscode.commands.registerCommand('scanax.openPanel', () => VulnerabilityPanel.createOrShow(context.extensionUri));
    
    context.subscriptions.push(
        runScanCommand, workspaceScanCommand, scanNowCommand, openPanelCommand,
        fixVulnerabilityCommand, fixAllVulnerabilitiesCommand,
        // FIXED: plural 'registerCodeActionsProvider'
        vscode.languages.registerCodeActionsProvider({ scheme: 'file', language: '*' }, new ScanaxCodeActionProvider(), { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }),
        vscode.workspace.onDidSaveTextDocument(doc => { vscode.commands.executeCommand('scanax.runScan'); }),
        diagnosticManager
    );
}

export function deactivate() { if (diagnosticManager) diagnosticManager.dispose(); }