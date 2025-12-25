import * as vscode from 'vscode';

export class ScanaxCodeActionProvider implements vscode.CodeActionProvider {
	provideCodeActions(
		document: vscode.TextDocument,
		range: vscode.Range,
		context: vscode.CodeActionContext,
		token: vscode.CancellationToken
	): vscode.CodeAction[] | undefined {
		const codeActions: vscode.CodeAction[] = [];

		// Find Scanax diagnostics in the current range
		for (const diagnostic of context.diagnostics) {
			if (diagnostic.source === 'Scanax') {
				const action = this.createFixAction(document, diagnostic);
				if (action) {
					codeActions.push(action);
				}
			}
		}

		return codeActions.length > 0 ? codeActions : undefined;
	}

	private createFixAction(document: vscode.TextDocument, diagnostic: vscode.Diagnostic): vscode.CodeAction | null {
		// Extract the fix from the diagnostic's relatedInformation
		const fixInfo = diagnostic.relatedInformation?.find((info) => info.message.startsWith('Suggested fix:'));
		if (!fixInfo) {
			return null;
		}

		const fix = fixInfo.message.replace('Suggested fix: ', '');
		const action = new vscode.CodeAction(`Fix with Scanax AI: ${diagnostic.message}`, vscode.CodeActionKind.QuickFix);

		action.command = {
			command: 'scanax.applyFix',
			title: 'Apply Scanax Fix',
			arguments: [document, diagnostic.range, fix],
		};

		action.diagnostics = [diagnostic];
		action.isPreferred = true;

		return action;
	}
}
