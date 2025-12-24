import * as vscode from 'vscode';
import { sendCodeToScanaxBackend } from './services/apiService';
import { DiagnosticManager } from './scanner/diagnosticManager';
import { ScanaxCodeActionProvider } from './scanner/codeActionProvider';

let diagnosticManager: DiagnosticManager;

export function activate(context: vscode.ExtensionContext) {
	// Initialize the diagnostic manager
	diagnosticManager = new DiagnosticManager();

	// Register the scanax.runScan command
	const runScanCommand = vscode.commands.registerCommand('scanax.runScan', async () => {
		const editor = vscode.window.activeTextEditor;

		if (!editor) {
			vscode.window.showWarningMessage('No active editor found. Please open a file to scan.');
			return;
		}

		const code = editor.document.getText();

		// Show progress notification while scanning
		vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: 'Scanax: Analyzing code...',
				cancellable: false,
			},
			async (progress) => {
				try {
					const result = await sendCodeToScanaxBackend(code);
					vscode.window.showInformationMessage('Scanax: Scan completed successfully');
					console.log('Scan result:', result);
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					vscode.window.showErrorMessage(`Scanax: ${errorMessage}`);
				}
			}
		);
	});

	// Register the applyFix command
	const applyFixCommand = vscode.commands.registerCommand(
		'scanax.applyFix',
		async (document: vscode.TextDocument, diagnostic: vscode.Diagnostic, fix: string) => {
			try {
				const edit = new vscode.WorkspaceEdit();
				const lineNumber = diagnostic.range.start.line;
				const line = document.lineAt(lineNumber);

				// Replace the entire line with the fixed version
				edit.replace(document.uri, line.range, fix);
				await vscode.workspace.applyEdit(edit);

				vscode.window.showInformationMessage('Scanax: Fix applied successfully');
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				vscode.window.showErrorMessage(`Scanax: Failed to apply fix - ${errorMessage}`);
			}
		}
	);

	// Register the CodeActionProvider
	const codeActionProvider = new ScanaxCodeActionProvider(diagnosticManager);
	const codeActionProviderDisposable = vscode.languages.registerCodeActionsProvider(
		{ scheme: 'file' },
		codeActionProvider
	);

	// Hook into document open event
	const onOpenDocument = vscode.workspace.onDidOpenTextDocument((document) => {
		diagnosticManager.updateDiagnostics(document);
	});

	// Hook into document save event
	const onSaveDocument = vscode.workspace.onDidSaveTextDocument((document) => {
		diagnosticManager.updateDiagnostics(document);
	});

	context.subscriptions.push(runScanCommand, applyFixCommand, codeActionProviderDisposable, onOpenDocument, onSaveDocument);

	// Scan any already-open documents
	vscode.workspace.textDocuments.forEach((document) => {
		diagnosticManager.updateDiagnostics(document);
	});

	// Activate the Security Dashboard view
	vscode.window.showInformationMessage('Scanax extension activated');
}

export function deactivate() {
	diagnosticManager.dispose();
}
