import * as vscode from 'vscode';
import * as path from 'path';

export class VulnerabilityPanel {
    public static currentPanel: VulnerabilityPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _vulnerabilities: any[] = [];
    private _showFixedMessage: boolean = false;
    private _groupBy: 'severity' | 'file' = 'file';
    private _filterSeverity: string[] = ['critical', 'high', 'medium', 'low'];
    private _realTimeScanEnabled: boolean = false;

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

    public updateVulnerabilityWithFix(file: string, line: number, suggestedFix: string, explanation: string) {
        this._vulnerabilities = this._vulnerabilities.map(v => {
            if (v.file === file && v.line === line) {
                return { ...v, suggestedFix, suggestedFixExplanation: explanation };
            }
            return v;
        });
        this._update();
    }

    public updateVulnerabilities(vulnerabilities: any[]) {
        try {
            // Validate and sanitize vulnerabilities data
            this._vulnerabilities = this._sanitizeVulnerabilities(vulnerabilities);
            this._showFixedMessage = false;
            this._update();
        } catch (error) {
            console.error('Error updating vulnerabilities:', error);
            this._showError('Failed to update vulnerabilities. Please try scanning again.');
        }
    }

    /**
     * Sanitize vulnerability data to prevent rendering errors
     */
    private _sanitizeVulnerabilities(vulnerabilities: any[]): any[] {
        if (!Array.isArray(vulnerabilities)) {
            return [];
        }

        return vulnerabilities.map(v => ({
            file: v.file || 'Unknown',
            line: typeof v.line === 'number' ? v.line : 0,
            message: v.message || v.title || 'Security issue detected',
            severity: v.severity || 'medium',
            category: v.category || 'Unknown',
            cwe: v.cwe || '',
            score: v.score || 0,
            description: v.description || '',
            fix: v.fix || '',
            recommendation: v.recommendation || '',
            suggestedFix: v.suggestedFix || '',
            suggestedFixExplanation: v.suggestedFixExplanation || ''
        }));
    }

    /**
     * Show error message in panel
     */
    private _showError(message: string): void {
        this._panel.webview.html = this._getErrorHtml(message);
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
        try {
            switch (message.command) {
                case 'getSuggestedFix':
                    vscode.commands.executeCommand('scanax.getSuggestedFix', message.vulnerability);
                    break;
                case 'fixAll':
                    vscode.commands.executeCommand('scanax.fixAllVulnerabilities');
                    break;
                case 'openFile':
                    const uri = vscode.Uri.file(message.filePath);
                    vscode.window.showTextDocument(uri, { selection: new vscode.Range(message.line - 1, 0, message.line - 1, 0) });
                    break;
                case 'reportFalsePositive':
                    vscode.commands.executeCommand('scanax.reportFalsePositive', message.data);
                    break;
                case 'rescan':
                    vscode.commands.executeCommand('scanax.scanWorkspace');
                    break;
                case 'changeGrouping':
                    this._groupBy = message.value;
                    this._update();
                    break;
                case 'toggleSeverity':
                    const severity = message.severity.toLowerCase();
                    if (this._filterSeverity.includes(severity)) {
                        this._filterSeverity = this._filterSeverity.filter(s => s !== severity);
                    } else {
                        this._filterSeverity.push(severity);
                    }
                    this._update();
                    break;
                case 'toggleRealTimeScan':
                    this._realTimeScanEnabled = message.enabled;
                    vscode.commands.executeCommand('scanax.setRealTimeScan', message.enabled);
                    this._update();
                    break;
            }
        } catch (error) {
            console.error('Error handling message:', error);
            vscode.window.showErrorMessage('Scanax: An error occurred. Please try again.');
        }
    }

    private _update() {
        try {
            this._panel.webview.html = this._getHtmlContent();
        } catch (error) {
            console.error('Error updating panel:', error);
            this._showError('Failed to render panel. Please reload the window.');
        }
    }

    private _getHtmlContent(): string {
        const vulnerabilities = this._vulnerabilities.filter(v => 
            this._filterSeverity.includes((v.severity || 'medium').toLowerCase())
        );
        const showFixedMessage = this._showFixedMessage;
        
        let groupedData: { [key: string]: any[] } = {};

        if (this._groupBy === 'severity') {
            // Group by severity
            const severityOrder = ['critical', 'high', 'medium', 'low'];
            severityOrder.forEach(severity => {
                const filtered = vulnerabilities.filter(v => (v.severity || 'medium').toLowerCase() === severity);
                if (filtered.length > 0) {
                    groupedData[severity.toUpperCase()] = filtered;
                }
            });
        } else {
            // Group by file
            vulnerabilities.forEach((vuln: any) => {
                const file = vuln.file || 'unknown';
                if (!groupedData[file]) {
                    groupedData[file] = [];
                }
                groupedData[file].push(vuln);
            });
        }

        const renderGroupCards = () => {
            return Object.entries(groupedData)
                .map(([groupName, vulns]) => `
                    <div class="file-card">
                        <div class="file-header" onclick="toggleGroup(this)">
                            <span class="collapse-icon">▼</span>
                            <span class="file-name">${this._groupBy === 'severity' ? '🔒' : '📄'} ${groupName}</span>
                            <span class="vuln-count">${vulns.length} vulnerabilities</span>
                        </div>
                        <div class="vulnerabilities">
                            ${vulns.map((v: any) => `
                                <div class="vulnerability-item" style="border-left: 4px solid ${this._getSeverityColor(v.severity)};">
                                    <div class="vuln-header">
                                        <span class="severity-badge ${(v.severity || 'medium').toLowerCase()}">${v.severity?.toUpperCase() || 'MEDIUM'}</span>
                                        ${v.score ? `<span class="vuln-score">Score: ${v.score}/10</span>` : ''}
                                        <span class="line-number">Line ${v.line}</span>
                                    </div>
                                    ${v.title ? `<div class="vuln-title">${v.title}</div>` : ''}
                                    ${(v.message || v.category || v.cwe || v.description) ? `
                                        <div class="vuln-section">
                                            <div class="vuln-section-title">DESCRIPTION</div>
                                            ${v.message ? `
                                                <div class="vuln-info-row">
                                                    <strong>Issue:</strong> ${v.message}
                                                </div>
                                            ` : ''}
                                            ${v.category ? `
                                                <div class="vuln-info-row">
                                                    <strong>Category:</strong> ${v.category}
                                                </div>
                                            ` : ''}
                                            ${v.cwe ? `
                                                <div class="vuln-info-row">
                                                    <strong>CWE/CVE:</strong> <a href="https://cwe.mitre.org/data/definitions/${v.cwe.replace('CWE-', '')}.html" target="_blank" class="cwe-link">${v.cwe}</a>
                                                </div>
                                            ` : ''}
                                            ${v.description ? `<div class="vuln-description">${v.description}</div>` : ''}
                                        </div>
                                    ` : ''}
                                    ${v.suggestedFix ? `
                                        <div class="vuln-section suggested-fix-section">
                                            <div class="vuln-section-title">💡 AI SUGGESTED FIX</div>
                                            <div class="suggested-fix-explanation">${v.suggestedFixExplanation || 'AI-generated fix suggestion'}</div>
                                            <div class="suggested-fix-code">
                                                <button class="copy-btn" onclick="copyToClipboard('${v.suggestedFix.replace(/'/g, "\\'").replace(/\n/g, '\\n')}')" title="Copy to clipboard">📋 Copy</button>
                                                <pre><code>${v.suggestedFix.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
                                            </div>
                                        </div>
                                    ` : ''}
                                    ${v.category ? `
                                        <div class="vuln-meta">
                                            <span><strong>Status:</strong> New</span>
                                        </div>
                                    ` : ''}
                                    ${v.recommendation ? `
                                        <div class="vuln-section">
                                            <div class="vuln-section-title">RECOMMENDATION</div>
                                            <div class="vuln-recommendation">${String(v.recommendation).replace(/\.,\s*(\d+\.)/g, '.<br>$1').replace(/(\d+\.)/g, '<br>$1').replace(/^<br>/, '')}</div>
                                        </div>
                                    ` : ''}
                                    <div class="vuln-actions">
                                        <button class="fix-btn" onclick="getSuggestedFix(${JSON.stringify(v).replace(/"/g, '&quot;')})" title="Get AI-suggested fix (for reference)">Get Fix Suggestion</button>
                                        <button class="reveal-btn" onclick="revealInEditor(${JSON.stringify({file: v.file, line: v.line}).replace(/"/g, '&quot;')})">Reveal</button>
                                        <!-- TODO: Re-enable in next release when backend training is implemented -->
                                        <!-- <button class="report-fp-btn" onclick="reportFalsePositive(${JSON.stringify({file: v.file, line: v.line}).replace(/"/g, '&quot;')})" title="Report this as a false positive">Report False Positive</button> -->
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `)
                .join('');
        };

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
                    .realtime-toggle {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    .toggle-label {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        cursor: pointer;
                        font-size: 13px;
                        user-select: none;
                        color: var(--vscode-foreground);
                    }
                    .toggle-text {
                        font-weight: 500;
                        color: var(--vscode-foreground);
                    }
                    /* Hide default checkbox */
                    #realtimeToggle {
                        position: absolute;
                        opacity: 0;
                        cursor: pointer;
                        height: 0;
                        width: 0;
                    }
                    /* Custom toggle switch */
                    .toggle-switch {
                        position: relative;
                        display: inline-block;
                        width: 44px;
                        height: 24px;
                        background-color: var(--vscode-input-background);
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 24px;
                        transition: all 0.3s ease;
                        cursor: pointer;
                    }
                    .toggle-switch::before {
                        content: '';
                        position: absolute;
                        width: 18px;
                        height: 18px;
                        left: 2px;
                        top: 2px;
                        background-color: var(--vscode-foreground);
                        border-radius: 50%;
                        transition: all 0.3s ease;
                        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                    }
                    #realtimeToggle:checked + .toggle-switch {
                        background-color: #0e639c;
                        border-color: #0e639c;
                    }
                    #realtimeToggle:checked + .toggle-switch::before {
                        transform: translateX(20px);
                        background-color: #ffffff;
                    }
                    .toggle-switch:hover {
                        opacity: 0.9;
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
                    .severity-badge.low {
                        background: #4ec9b0;
                        color: white;
                    }
                    .vuln-score {
                        padding: 2px 6px;
                        background: var(--vscode-badge-background);
                        color: var(--vscode-badge-foreground);
                        border-radius: 3px;
                        font-size: 10px;
                        font-weight: 700;
                        margin-left: 6px;
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
                    .vuln-title {
                        font-size: 14px;
                        font-weight: 600;
                        margin-bottom: 8px;
                        color: var(--vscode-editor-foreground);
                    }
                    .vuln-info-row {
                        font-size: 12px;
                        margin-bottom: 6px;
                        color: var(--vscode-editor-foreground);
                        line-height: 1.5;
                    }
                    .vuln-info-row strong {
                        color: var(--vscode-descriptionForeground);
                        font-weight: 600;
                        margin-right: 4px;
                    }
                    .cwe-link {
                        color: var(--vscode-textLink-foreground);
                        text-decoration: none;
                        font-weight: 500;
                    }
                    .cwe-link:hover {
                        text-decoration: underline;
                        color: var(--vscode-textLink-activeForeground);
                    }
                    .vuln-subtitle {
                        font-size: 12px;
                        font-weight: 500;
                        margin-bottom: 10px;
                        color: var(--vscode-descriptionForeground);
                    }
                    .vuln-section {
                        margin: 10px 0;
                        padding: 8px;
                        background: var(--vscode-textBlockQuote-background);
                        border-left: 2px solid var(--vscode-textBlockQuote-border);
                        border-radius: 3px;
                    }
                    .vuln-section-title {
                        font-size: 11px;
                        font-weight: 700;
                        text-transform: uppercase;
                        color: var(--vscode-descriptionForeground);
                        margin-bottom: 6px;
                        letter-spacing: 0.5px;
                    }
                    .vuln-description {
                        font-size: 12px;
                        line-height: 1.5;
                        color: var(--vscode-editor-foreground);
                    }
                    .vuln-recommendation {
                        font-size: 12px;
                        line-height: 1.6;
                        color: var(--vscode-editor-foreground);
                        white-space: pre-line;
                    }
                    .vuln-meta {
                        display: flex;
                        gap: 16px;
                        margin: 8px 0;
                        font-size: 11px;
                        color: var(--vscode-descriptionForeground);
                    }
                    .vuln-meta strong {
                        color: var(--vscode-editor-foreground);
                    }
                    .vuln-fix {
                        font-size: 11px;
                        line-height: 1.4;
                        color: var(--vscode-editor-foreground);
                    }
                    .vuln-actions {
                        display: flex;
                        gap: 6px;
                    }
                    .fix-btn, .reveal-btn, .report-fp-btn {
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
                    .report-fp-btn {
                        background: transparent;
                        color: var(--vscode-descriptionForeground);
                        border: 1px solid var(--vscode-panel-border);
                    }
                    .report-fp-btn:hover {
                        background: var(--vscode-list-hoverBackground);
                        color: var(--vscode-editor-foreground);
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
                    .toolbar {
                        display: flex;
                        gap: 8px;
                        align-items: center;
                        margin-bottom: 12px;
                        padding: 8px;
                        background: var(--vscode-editor-inactiveSelectionBackground);
                        border-radius: 4px;
                    }
                    .toolbar-btn {
                        padding: 5px 12px;
                        background: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 3px;
                        font-size: 12px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        gap: 4px;
                    }
                    .toolbar-btn:hover {
                        background: var(--vscode-button-secondaryHoverBackground);
                    }
                    .toolbar-btn.active {
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border-color: var(--vscode-button-background);
                    }
                    .toolbar select {
                        padding: 4px 8px;
                        background: var(--vscode-dropdown-background);
                        color: var(--vscode-dropdown-foreground);
                        border: 1px solid var(--vscode-dropdown-border);
                        border-radius: 3px;
                        font-size: 12px;
                        cursor: pointer;
                    }
                    .collapse-icon {
                        display: inline-block;
                        transition: transform 0.2s;
                        margin-right: 4px;
                        font-size: 10px;
                    }
                    .file-header {
                        cursor: pointer;
                        user-select: none;
                    }
                    .file-header:hover {
                        opacity: 0.8;
                    }
                    .file-card.collapsed .vulnerabilities {
                        display: none;
                    }
                    .file-card.collapsed .collapse-icon {
                        transform: rotate(-90deg);
                    }
                    .filter-group {
                        display: flex;
                        gap: 4px;
                        margin-left: auto;
                    }
                    .filter-chip {
                        padding: 3px 8px;
                        border-radius: 10px;
                        font-size: 10px;
                        font-weight: 600;
                        cursor: pointer;
                        border: 1px solid transparent;
                        opacity: 0.5;
                    }
                    .filter-chip.active {
                        opacity: 1;
                        border: 1px solid currentColor;
                    }
                    .filter-chip.critical { background: #d84242; color: white; }
                    .filter-chip.high { background: #f2991e; color: white; }
                    .filter-chip.medium { background: #f5d547; color: #333; }
                    .filter-chip.low { background: #4ec9b0; color: white; }
                    .suggested-fix-section {
                        background: var(--vscode-editor-background);
                        border: 1px solid var(--vscode-panel-border);
                    }
                    .suggested-fix-explanation {
                        font-size: 12px;
                        color: var(--vscode-descriptionForeground);
                        margin-bottom: 8px;
                        font-style: italic;
                    }
                    .suggested-fix-code {
                        position: relative;
                        background: var(--vscode-textCodeBlock-background);
                        border-radius: 4px;
                        padding: 8px;
                        margin-top: 4px;
                    }
                    .suggested-fix-code pre {
                        margin: 0;
                        padding: 0;
                        font-family: 'Consolas', 'Courier New', monospace;
                        font-size: 12px;
                        line-height: 1.5;
                        white-space: pre-wrap;
                        word-wrap: break-word;
                    }
                    .suggested-fix-code code {
                        color: var(--vscode-editor-foreground);
                    }
                    .copy-btn {
                        position: absolute;
                        top: 4px;
                        right: 4px;
                        padding: 3px 8px;
                        background: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 3px;
                        font-size: 10px;
                        cursor: pointer;
                        z-index: 10;
                    }
                    .copy-btn:hover {
                        background: var(--vscode-button-secondaryHoverBackground);
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <h1>🛡️ Scanax Security Scanner</h1>
                            <div class="realtime-toggle">
                                <label class="toggle-label">
                                    <span class="toggle-text">Real-time Scanning</span>
                                    <input type="checkbox" id="realtimeToggle" ${this._realTimeScanEnabled ? 'checked' : ''} onchange="toggleRealTimeScan(this.checked)">
                                    <span class="toggle-switch"></span>
                                </label>
                            </div>
                        </div>
                        <div class="stats">
                            <div>Total Vulnerabilities: <strong>${vulnerabilities.length}</strong></div>
                            <div>Files Affected: <strong>${Object.keys(groupedData).length}</strong></div>
                        </div>
                    </div>
                    ${vulnerabilities.length > 0 ? `
                        <div class="toolbar">
                            <select onchange="changeGrouping(this.value)">
                                <option value="file" ${this._groupBy === 'file' ? 'selected' : ''}>Group by File</option>
                                <option value="severity" ${this._groupBy === 'severity' ? 'selected' : ''}>Group by Severity</option>
                            </select>
                            <div class="filter-group">
                                <span style="font-size: 11px; margin-right: 4px; color: var(--vscode-descriptionForeground);">Filter:</span>
                                <div class="filter-chip critical ${this._filterSeverity.includes('critical') ? 'active' : ''}" onclick="toggleSeverity('critical')">CRITICAL</div>
                                <div class="filter-chip high ${this._filterSeverity.includes('high') ? 'active' : ''}" onclick="toggleSeverity('high')">HIGH</div>
                                <div class="filter-chip medium ${this._filterSeverity.includes('medium') ? 'active' : ''}" onclick="toggleSeverity('medium')">MEDIUM</div>
                                <div class="filter-chip low ${this._filterSeverity.includes('low') ? 'active' : ''}" onclick="toggleSeverity('low')">LOW</div>
                            </div>
                        </div>
                        <div>${renderGroupCards()}</div>
                    ` : `
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
                    function getSuggestedFix(vuln) {
                        vscode.postMessage({ command: 'getSuggestedFix', vulnerability: vuln });
                    }
                    function fixAll() {
                        vscode.postMessage({ command: 'fixAll' });
                    }
                    function revealInEditor(data) {
                        vscode.postMessage({ command: 'openFile', filePath: data.file, line: data.line });
                    }
                    
                    // TODO: Re-enable in next release when backend training is implemented
                    // function reportFalsePositive(data) {
                    //     vscode.postMessage({ command: 'reportFalsePositive', data: data });
                    // }
                    
                    function rescan() {
                        vscode.postMessage({ command: 'rescan' });
                    }
                    function changeGrouping(value) {
                        vscode.postMessage({ command: 'changeGrouping', value: value });
                    }
                    function toggleSeverity(severity) {
                        vscode.postMessage({ command: 'toggleSeverity', severity: severity });
                    }
                    function toggleGroup(header) {
                        const card = header.parentElement;
                        card.classList.toggle('collapsed');
                    }
                    function copyToClipboard(text) {
                        navigator.clipboard.writeText(text).then(() => {
                            // Visual feedback could be added here
                        });
                    }
                    function toggleRealTimeScan(enabled) {
                        vscode.postMessage({ command: 'toggleRealTimeScan', enabled: enabled });
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

    /**
     * Generate error page HTML
     */
    private _getErrorHtml(message: string): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        background: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        margin: 0;
                        padding: 20px;
                    }
                    .error-container {
                        text-align: center;
                        max-width: 500px;
                    }
                    .error-icon {
                        font-size: 64px;
                        margin-bottom: 20px;
                    }
                    .error-title {
                        font-size: 20px;
                        font-weight: 600;
                        margin-bottom: 12px;
                    }
                    .error-message {
                        font-size: 14px;
                        color: var(--vscode-descriptionForeground);
                        margin-bottom: 24px;
                        line-height: 1.6;
                    }
                    .retry-btn {
                        padding: 10px 20px;
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        border-radius: 4px;
                        font-size: 13px;
                        cursor: pointer;
                        transition: background 0.2s;
                    }
                    .retry-btn:hover {
                        background: var(--vscode-button-hoverBackground);
                    }
                </style>
            </head>
            <body>
                <div class="error-container">
                    <div class="error-icon">⚠️</div>
                    <div class="error-title">Something Went Wrong</div>
                    <div class="error-message">${message}</div>
                    <button class="retry-btn" onclick="retry()">Retry Scan</button>
                </div>
                <script>
                    const vscode = acquireVsCodeApi();
                    function retry() {
                        vscode.postMessage({ command: 'rescan' });
                    }
                </script>
            </body>
            </html>
        `;
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
