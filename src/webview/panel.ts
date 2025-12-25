import * as vscode from 'vscode';
import * as path from 'path';

export class VulnerabilityPanel {
    public static currentPanel: VulnerabilityPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _vulnerabilities: any[] = [];
    private _showFixedMessage: boolean = false;

    public static createOrShow(extensionUri: vscode.Uri) {
        if (VulnerabilityPanel.currentPanel) {
            VulnerabilityPanel.currentPanel._panel.reveal(vscode.ViewColumn.Two);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'scanaxVulnerabilities',
            'Scanax - Vulnerabilities',
            vscode.ViewColumn.Two,
            { enableScripts: true }
        );

        VulnerabilityPanel.currentPanel = new VulnerabilityPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.onDidReceiveMessage(
            (message) => this._handleMessage(message),
            null,
            this._disposables
        );

        this._update();
    }

    public updateVulnerabilities(vulnerabilities: any[]) {
        this._vulnerabilities = vulnerabilities;
        this._showFixedMessage = false; // Reset when new scan results come in
        this._update();
    }

    public removeVulnerability(file: string, line: number) {
        this._vulnerabilities = this._vulnerabilities.filter(v => !(v.file === file && v.line === line));
        this._update();
    }

    public showFixedMessage() {
        this._vulnerabilities = [];
        this._showFixedMessage = true;
        this._update();
    }

    private _handleMessage(message: any) {
        switch (message.command) {
            case 'fixVulnerability':
                // Pass the full vulnerability object to the command
                vscode.commands.executeCommand(
                    'scanax.fixVulnerability',
                    {
                        file: message.vulnerability.file,
                        line: message.vulnerability.line,
                        message: message.vulnerability.message,
                        fix: message.vulnerability.fix
                    }
                );
                break;
            case 'fixAll':
                vscode.commands.executeCommand('scanax.fixAllVulnerabilities');
                break;
            case 'openFile':
                const uri = vscode.Uri.file(message.filePath);
                vscode.window.showTextDocument(uri, { selection: new vscode.Range(message.line - 1, 0, message.line - 1, 0) });
                break;
        }
    }

    private _update() {
        this._panel.webview.html = this._getHtmlContent();
    }

    private _getHtmlContent(): string {
        const vulnerabilities = this._vulnerabilities;
        const showFixedMessage = this._showFixedMessage;
        const groupedByFile: { [key: string]: any[] } = {};

        vulnerabilities.forEach((vuln: any) => {
            const file = vuln.file || 'unknown';
            if (!groupedByFile[file]) {
                groupedByFile[file] = [];
            }
            groupedByFile[file].push(vuln);
        });

        const fileCards = Object.entries(groupedByFile)
            .map(([file, vulns]) => `
                <div class="file-card">
                    <div class="file-header">
                        <span class="file-name">📄 ${file}</span>
                        <span class="vuln-count">${vulns.length} vulnerabilities</span>
                    </div>
                    <div class="vulnerabilities">
                        ${vulns.map((v: any) => `
                            <div class="vulnerability-item" style="border-left: 4px solid ${this._getSeverityColor(v.severity)};">
                                <div class="vuln-header">
                                    <span class="severity-badge ${v.severity}">${v.severity?.toUpperCase() || 'MEDIUM'}</span>
                                    <span class="line-number">Line ${v.line}</span>
                                </div>
                                <div class="vuln-message">${v.message}</div>
                                <div class="vuln-actions">
                                    <button class="fix-btn" onclick="fixVuln(${JSON.stringify(v).replace(/"/g, '&quot;')})">Fix with AI</button>
                                    <button class="reveal-btn" onclick="openFile('${v.file}', ${v.line})">Reveal</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `)
            .join('');

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                        background: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                        padding: 16px;
                    }
                    .container {
                        max-width: 800px;
                    }
                    .header {
                        margin-bottom: 20px;
                        padding-bottom: 16px;
                        border-bottom: 1px solid var(--vscode-panel-border);
                    }
                    .header h1 {
                        font-size: 18px;
                        font-weight: 600;
                        margin-bottom: 8px;
                    }
                    .stats {
                        display: flex;
                        gap: 16px;
                        font-size: 12px;
                        color: var(--vscode-descriptionForeground);
                        margin-bottom: 12px;
                    }
                    .fix-all-btn {
                        padding: 6px 14px;
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        border-radius: 3px;
                        font-size: 12px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .fix-all-btn:hover {
                        background: var(--vscode-button-hoverBackground);
                    }
                    .file-card {
                        background: var(--vscode-editor-inactiveSelectionBackground);
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 6px;
                        margin-bottom: 12px;
                        overflow: hidden;
                    }
                    .file-header {
                        background: var(--vscode-tab-activeBackground);
                        padding: 10px 12px;
                        border-bottom: 1px solid var(--vscode-panel-border);
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        font-weight: 500;
                        font-size: 13px;
                    }
                    .file-name {
                        flex: 1;
                    }
                    .vuln-count {
                        background: var(--vscode-badge-background);
                        color: var(--vscode-badge-foreground);
                        padding: 2px 6px;
                        border-radius: 3px;
                        font-size: 11px;
                        font-weight: 600;
                    }
                    .vulnerabilities {
                        padding: 8px;
                    }
                    .vulnerability-item {
                        background: var(--vscode-editor-background);
                        padding: 10px;
                        margin-bottom: 8px;
                        border-radius: 4px;
                    }
                    .vuln-header {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        margin-bottom: 6px;
                    }
                    .severity-badge {
                        padding: 2px 6px;
                        border-radius: 3px;
                        font-size: 10px;
                        font-weight: 700;
                    }
                    .severity-badge.critical {
                        background: #d84242;
                        color: white;
                    }
                    .severity-badge.high {
                        background: #f2991e;
                        color: white;
                    }
                    .severity-badge.medium {
                        background: #f5d547;
                        color: #333;
                    }
                    .line-number {
                        font-size: 11px;
                        color: var(--vscode-descriptionForeground);
                        margin-left: auto;
                    }
                    .vuln-message {
                        font-size: 12px;
                        line-height: 1.4;
                        margin-bottom: 8px;
                        color: var(--vscode-editor-foreground);
                    }
                    .vuln-actions {
                        display: flex;
                        gap: 6px;
                    }
                    .fix-btn, .reveal-btn {
                        padding: 4px 10px;
                        border: none;
                        border-radius: 3px;
                        font-size: 11px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .fix-btn {
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                    }
                    .fix-btn:hover {
                        background: var(--vscode-button-hoverBackground);
                    }
                    .reveal-btn {
                        background: var(--vscode-editor-inactiveSelectionBackground);
                        color: var(--vscode-editor-foreground);
                        border: 1px solid var(--vscode-panel-border);
                    }
                    .reveal-btn:hover {
                        background: var(--vscode-list-hoverBackground);
                    }
                    .empty-state {
                        text-align: center;
                        padding: 40px 20px;
                        color: var(--vscode-descriptionForeground);
                    }
                    .empty-state-icon {
                        font-size: 48px;
                        margin-bottom: 12px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🛡️ Scanax Security Scanner</h1>
                        <div class="stats">
                            <div>Total Vulnerabilities: <strong>${vulnerabilities.length}</strong></div>
                            <div>Files Affected: <strong>${Object.keys(groupedByFile).length}</strong></div>
                        </div>
                        ${vulnerabilities.length > 0 ? `<button class="fix-all-btn" onclick="fixAll()">🚀 Fix All</button>` : ''}
                    </div>
                    ${vulnerabilities.length > 0 ? `<div>${fileCards}</div>` : `
                        <div class="empty-state">
                            ${showFixedMessage ? `
                                <div class="empty-state-icon">🎉</div>
                                <div style="font-size: 16px; font-weight: 500;">No Vulnerabilities Present to Fix</div>
                                <div style="font-size: 12px; margin-top: 8px; color: var(--vscode-descriptionForeground);">All vulnerabilities have been successfully fixed. Rescanning to verify...</div>
                            ` : `
                                <div class="empty-state-icon">✅</div>
                                <div style="font-size: 16px; font-weight: 500;">Code is Compliant</div>
                                <div style="font-size: 12px; margin-top: 8px; color: var(--vscode-descriptionForeground);">No vulnerabilities detected in your codebase</div>
                            `}
                        </div>
                    `}
                </div>
                <script>
                    const vscode = acquireVsCodeApi();
                    function fixVuln(vuln) {
                        vscode.postMessage({ command: 'fixVulnerability', vulnerability: vuln });
                    }
                    function fixAll() {
                        vscode.postMessage({ command: 'fixAll' });
                    }
                    function openFile(filePath, line) {
                        vscode.postMessage({ command: 'openFile', filePath: filePath, line: line });
                    }
                </script>
            </body>
            </html>
        `;
    }

    private _getSeverityColor(severity: string): string {
        switch (severity?.toLowerCase()) {
            case 'critical':
                return '#d84242';
            case 'high':
                return '#f2991e';
            case 'medium':
                return '#f5d547';
            default:
                return '#4ec9b0';
        }
    }

    public dispose() {
        VulnerabilityPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const d = this._disposables.pop();
            if (d) {
                d.dispose();
            }
        }
    }
}
