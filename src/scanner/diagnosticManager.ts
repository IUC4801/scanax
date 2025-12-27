import * as vscode from 'vscode';
import { sendCodeToScanaxBackend } from '../services/apiService';

/**
 * Custom interface to extend the standard Diagnostic.
 * This lets us carry the 'fix' code from the backend to the Lightbulb menu.
 */
export interface ScanaxDiagnostic extends vscode.Diagnostic {
    fixContent?: string;
}

export class DiagnosticManager {
    private diagnosticCollection: vscode.DiagnosticCollection;

    constructor() {
        // Creates the 'Scanax' category in the Problems tab
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('scanax');
    }

    async updateDiagnostics(document: vscode.TextDocument): Promise<void> {
        try {
            const code = document.getText();
            const response = await sendCodeToScanaxBackend(code);
            
            // Your FastAPI returns { "errors": [...] } from the AnalysisResponse model
            if (response && response.errors) {
                this.setDiagnostics(document, response.errors);
            }
        } catch (error) {
            // Clear diagnostics on error to avoid stale squiggles
            this.diagnosticCollection.set(document.uri, []);
            console.error('Diagnostic update error:', error);
        }
    }

    public setDiagnostics(document: vscode.TextDocument, vulnerabilities: any[]): void {
        const diagnostics: ScanaxDiagnostic[] = [];

        vulnerabilities.forEach(vuln => {
            // Convert 1-based line (Gemini) to 0-based line (VS Code)
            const lineIdx = Math.max(0, (vuln.line || 1) - 1);
            const line = document.lineAt(Math.min(lineIdx, document.lineCount - 1));
            const range = new vscode.Range(line.range.start, line.range.end);

            const diagnostic: ScanaxDiagnostic = new vscode.Diagnostic(
                range,
                vuln.message || vuln.title || "Security issue detected",
                vscode.DiagnosticSeverity.Error
            );

            // This MUST match what your CodeActionProvider filters for
            diagnostic.source = 'Scanax';
            
            // Stash the raw fix content
            diagnostic.fixContent = vuln.fix; 

            // Enhanced: Store all metadata in relatedInformation for hover provider
            const relatedInfo: vscode.DiagnosticRelatedInformation[] = [];
            
            if (vuln.fix) {
                relatedInfo.push(new vscode.DiagnosticRelatedInformation(
                    new vscode.Location(document.uri, range),
                    `Suggested fix: ${vuln.fix}`
                ));
            }
            if (vuln.description) {
                relatedInfo.push(new vscode.DiagnosticRelatedInformation(
                    new vscode.Location(document.uri, range),
                    `Description: ${vuln.description}`
                ));
            }
            if (vuln.category) {
                relatedInfo.push(new vscode.DiagnosticRelatedInformation(
                    new vscode.Location(document.uri, range),
                    `Category: ${vuln.category}`
                ));
            }
            if (vuln.recommendation) {
                relatedInfo.push(new vscode.DiagnosticRelatedInformation(
                    new vscode.Location(document.uri, range),
                    `Recommendation: ${vuln.recommendation}`
                ));
            }
            if (vuln.cwe) {
                relatedInfo.push(new vscode.DiagnosticRelatedInformation(
                    new vscode.Location(document.uri, range),
                    `CWE: ${vuln.cwe}`
                ));
            }
            if (vuln.score) {
                relatedInfo.push(new vscode.DiagnosticRelatedInformation(
                    new vscode.Location(document.uri, range),
                    `Score: ${vuln.score}`
                ));
            }
            if (vuln.severity) {
                relatedInfo.push(new vscode.DiagnosticRelatedInformation(
                    new vscode.Location(document.uri, range),
                    `Severity: ${vuln.severity}`
                ));
            }
            
            if (relatedInfo.length > 0) {
                diagnostic.relatedInformation = relatedInfo;
            }

            diagnostics.push(diagnostic);
        });

        // Update the editor squiggles for this specific document
        this.diagnosticCollection.set(document.uri, diagnostics);
    }

    public clearDiagnostics(document: vscode.TextDocument): void {
        this.diagnosticCollection.delete(document.uri);
    }

    public dispose(): void {
        this.diagnosticCollection.clear();
        this.diagnosticCollection.dispose();
    }
}