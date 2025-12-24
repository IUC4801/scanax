import * as vscode from 'vscode';
import { sendCodeToScanaxBackend } from '../services/apiService';

export class DiagnosticManager {
	private diagnosticCollection: vscode.DiagnosticCollection;

	constructor() {
		this.diagnosticCollection = vscode.languages.createDiagnosticCollection('scanax');
	}

	async updateDiagnostics(document: vscode.TextDocument): Promise<void> {
		try {
			const code = document.getText();
			const response = await sendCodeToScanaxBackend(code);

			const diagnostics: vscode.Diagnostic[] = [];

			// Process the backend response to create diagnostics
			if (response.errors && Array.isArray(response.errors)) {
				for (const error of response.errors) {
					const lineNumber = error.line ? error.line - 1 : 0; // Convert to 0-based index
					const message = error.message || 'Security issue detected';
					const severity = error.severity === 'error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning;

					// Create a range for the diagnostic (highlight the entire line)
					const line = document.lineAt(Math.min(lineNumber, document.lineCount - 1));
					const range = new vscode.Range(line.range.start, line.range.end);

					const diagnostic = new vscode.Diagnostic(range, message, severity);
					diagnostic.source = 'Scanax';
					
					// Attach the fix suggestion as related information
					if (error.fix) {
						diagnostic.relatedInformation = [
							new vscode.DiagnosticRelatedInformation(
								new vscode.Location(document.uri, range.start),
								`Suggested fix: ${error.fix}`
							),
						];
					}
					
					diagnostics.push(diagnostic);
				}
			}

			// Update the diagnostic collection for this document
			this.diagnosticCollection.set(document.uri, diagnostics);
		} catch (error) {
			// Clear diagnostics on error
			this.diagnosticCollection.set(document.uri, []);
			console.error('Diagnostic update error:', error);
		}
	}

	clearDiagnostics(document: vscode.TextDocument): void {
		this.diagnosticCollection.delete(document.uri);
	}

	dispose(): void {
		this.diagnosticCollection.dispose();
	}
}
