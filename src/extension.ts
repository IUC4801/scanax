import * as vscode from 'vscode';
import { sendCodeToScanaxBackend } from './services/apiService';
import { DiagnosticManager } from './scanner/diagnosticManager';
import { ScanaxCodeActionProvider } from './scanner/codeActionProvider';

// Simple Data Provider for the Sidebar
class ScanaxDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | void> = this._onDidChangeTreeData.event;

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem[]> {
        if (!element) {
            return [
                new vscode.TreeItem("Scan your files to see results", vscode.TreeItemCollapsibleState.None)
            ];
        }
        return [];
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }
}

let diagnosticManager: DiagnosticManager;

export function activate(context: vscode.ExtensionContext) {
    console.log('Scanax is now active');

    // 1. Initialize Managers and Providers
    diagnosticManager = new DiagnosticManager();
    const scanaxDataProvider = new ScanaxDataProvider();

    // 2. Register Sidebar View
    vscode.window.registerTreeDataProvider('scanax.securityDashboard', scanaxDataProvider);

    // 3. Register Commands
    const runScanCommand = vscode.commands.registerCommand('scanax.runScan', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor found.');
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Scanax: Analyzing code...",
            cancellable: false
        }, async () => {
            try {
                const code = editor.document.getText();
                const response = await sendCodeToScanaxBackend(code);
                
                // FIXED: Extracts the errors array from the backend response object
                const vulnerabilities = (response && response.errors) ? response.errors : [];
                
                // Update squiggles in the editor using the array
                diagnosticManager.setDiagnostics(editor.document, vulnerabilities);
                scanaxDataProvider.refresh();
                
                vscode.window.showInformationMessage(`Scanax: Found ${vulnerabilities.length} issues.`);
            } catch (err) {
                vscode.window.showErrorMessage(`Scanax Error: ${err}`);
            }
        });
    });

    // This command is triggered by the CodeActionProvider lightbulb
    const applyFixCommand = vscode.commands.registerCommand(
        'scanax.applyFix',
        async (document: vscode.TextDocument, range: vscode.Range, fixText: string) => {
            const edit = new vscode.WorkspaceEdit();
            edit.replace(document.uri, range, fixText);
            await vscode.workspace.applyEdit(edit);
            vscode.window.showInformationMessage('Scanax: Fix applied.');
        }
    );

    // 4. Register Code Actions (Lightbulb)
    const codeActionProvider = vscode.languages.registerCodeActionsProvider(
        { scheme: 'file', language: 'javascript' }, // Specify language to ensure it triggers correctly
        new ScanaxCodeActionProvider(),
        { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }
    );

    // 5. Lifecycle Events
    // Automatically triggers a scan when the user saves a file
    const onSave = vscode.workspace.onDidSaveTextDocument((doc) => {
        if (doc.languageId === 'javascript' || doc.languageId === 'typescript') {
            vscode.commands.executeCommand('scanax.runScan');
        }
    });

    context.subscriptions.push(
        runScanCommand, 
        applyFixCommand, 
        codeActionProvider, 
        onSave,
        diagnosticManager
    );
}

export function deactivate() {
    if (diagnosticManager) {
        diagnosticManager.dispose(); // Cleanup collection to prevent memory leaks
    }
}