import * as vscode from 'vscode';

export class ScanaxHoverProvider implements vscode.HoverProvider {
    constructor(private diagnosticCollection: vscode.DiagnosticCollection) {}

    provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Hover> {
        const diagnostics = this.diagnosticCollection.get(document.uri);
        if (!diagnostics) {
            return null;
        }

        // Find diagnostics at the current position
        const relevantDiagnostics = diagnostics.filter(d => d.range.contains(position));
        if (relevantDiagnostics.length === 0) {
            return null;
        }

        const contents: vscode.MarkdownString[] = [];
        
        for (const diagnostic of relevantDiagnostics) {
            const markdown = new vscode.MarkdownString();
            markdown.isTrusted = true;
            markdown.supportHtml = true;

            // Parse the diagnostic data (stored in relatedInformation)
            const vulnData = this.parseVulnerabilityData(diagnostic);

            // Build rich hover content
            markdown.appendMarkdown(`### ${vulnData.title || 'Security Vulnerability'}\n\n`);
            
            if (vulnData.severity) {
                const severityColor = this.getSeverityColor(vulnData.severity);
                markdown.appendMarkdown(`**Severity:** \`${vulnData.severity.toUpperCase()}\` `);
                if (vulnData.score) {
                    markdown.appendMarkdown(`| **Score:** ${vulnData.score}/10`);
                }
                markdown.appendMarkdown('\n\n');
            }

            markdown.appendMarkdown(`**Issue:** ${diagnostic.message}\n\n`);

            if (vulnData.description) {
                markdown.appendMarkdown(`**Description:**\n${vulnData.description}\n\n`);
            }

            if (vulnData.category) {
                markdown.appendMarkdown(`**Category:** ${vulnData.category}\n\n`);
            }

            if (vulnData.cwe) {
                markdown.appendMarkdown(`**CWE:** [${vulnData.cwe}](https://cwe.mitre.org/data/definitions/${vulnData.cwe.replace('CWE-', '')}.html)\n\n`);
            }

            if (vulnData.recommendation) {
                markdown.appendMarkdown(`**Recommendation:**\n${vulnData.recommendation}\n\n`);
            }

            if (vulnData.fix) {
                markdown.appendMarkdown(`**💡 Suggested Fix:**\n\`\`\`\n${vulnData.fix}\n\`\`\`\n\n`);
                markdown.appendMarkdown(`[Apply Fix](command:scanax.applyFix?${encodeURIComponent(JSON.stringify([document.uri.toString(), diagnostic.range.start.line, vulnData.fix]))})\n\n`);
            }

            markdown.appendMarkdown('---\n');
            markdown.appendMarkdown('*Powered by Scanax AI Security Scanner*');

            contents.push(markdown);
        }

        return new vscode.Hover(contents);
    }

    private parseVulnerabilityData(diagnostic: vscode.Diagnostic): any {
        // Try to extract structured data from diagnostic
        const data: any = {
            title: diagnostic.message,
            severity: 'medium',
            fix: null,
            description: null,
            category: null,
            recommendation: null,
            score: null,
            cwe: null
        };

        // Extract fix from relatedInformation
        if (diagnostic.relatedInformation) {
            for (const info of diagnostic.relatedInformation) {
                if (info.message.startsWith('Suggested fix: ')) {
                    data.fix = info.message.replace('Suggested fix: ', '');
                }
                // Check for other metadata (if we enhance diagnostics later)
                if (info.message.startsWith('Description: ')) {
                    data.description = info.message.replace('Description: ', '');
                }
                if (info.message.startsWith('Category: ')) {
                    data.category = info.message.replace('Category: ', '');
                }
                if (info.message.startsWith('Recommendation: ')) {
                    data.recommendation = info.message.replace('Recommendation: ', '');
                }
                if (info.message.startsWith('CWE: ')) {
                    data.cwe = info.message.replace('CWE: ', '');
                }
                if (info.message.startsWith('Score: ')) {
                    data.score = parseFloat(info.message.replace('Score: ', ''));
                }
                if (info.message.startsWith('Severity: ')) {
                    data.severity = info.message.replace('Severity: ', '').toLowerCase();
                }
            }
        }

        return data;
    }

    private getSeverityColor(severity: string): string {
        switch (severity.toLowerCase()) {
            case 'critical':
                return '#d84242';
            case 'high':
                return '#f2991e';
            case 'medium':
                return '#f5d547';
            case 'low':
                return '#4ec9b0';
            default:
                return '#858585';
        }
    }
}
