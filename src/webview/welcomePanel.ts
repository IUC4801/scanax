import * as vscode from 'vscode';

export class WelcomePanel {
    public static currentPanel: WelcomePanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        if (WelcomePanel.currentPanel) {
            WelcomePanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'scanaxWelcome',
            'Welcome to Scanax',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        WelcomePanel.currentPanel = new WelcomePanel(panel, extensionUri);
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

    private _handleMessage(message: any) {
        switch (message.command) {
            case 'startTutorial':
                vscode.commands.executeCommand('scanax.startTutorial');
                break;
            case 'openSample':
                vscode.commands.executeCommand('scanax.openSampleCode');
                break;
            case 'scanWorkspace':
                vscode.commands.executeCommand('scanax.workspaceScan');
                break;
            case 'openSettings':
                vscode.commands.executeCommand('workbench.action.openSettings', 'scanax');
                break;
            case 'dontShowAgain':
                vscode.workspace.getConfiguration('scanax').update('showWelcome', false, vscode.ConfigurationTarget.Global);
                this._panel.dispose();
                break;
        }
    }

    private _update() {
        this._panel.webview.html = this._getHtmlContent();
    }

    private _getHtmlContent(): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        background: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                        padding: 40px;
                        line-height: 1.6;
                    }
                    .container {
                        max-width: 900px;
                        margin: 0 auto;
                    }
                    h1 {
                        font-size: 36px;
                        margin-bottom: 10px;
                        display: flex;
                        align-items: center;
                        gap: 12px;
                    }
                    .shield-icon {
                        font-size: 42px;
                    }
                    .subtitle {
                        font-size: 18px;
                        color: var(--vscode-descriptionForeground);
                        margin-bottom: 40px;
                    }
                    .section {
                        margin-bottom: 40px;
                    }
                    h2 {
                        font-size: 24px;
                        margin-bottom: 16px;
                        color: var(--vscode-textLink-foreground);
                    }
                    .features {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                        gap: 20px;
                        margin-bottom: 30px;
                    }
                    .feature-card {
                        background: var(--vscode-editor-inactiveSelectionBackground);
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 8px;
                        padding: 20px;
                    }
                    .feature-icon {
                        font-size: 32px;
                        margin-bottom: 12px;
                    }
                    .feature-title {
                        font-size: 16px;
                        font-weight: 600;
                        margin-bottom: 8px;
                    }
                    .feature-desc {
                        font-size: 14px;
                        color: var(--vscode-descriptionForeground);
                    }
                    .cta-buttons {
                        display: flex;
                        gap: 12px;
                        flex-wrap: wrap;
                        margin-top: 30px;
                    }
                    .btn {
                        padding: 12px 24px;
                        border: none;
                        border-radius: 5px;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s;
                    }
                    .btn-primary {
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                    }
                    .btn-primary:hover {
                        background: var(--vscode-button-hoverBackground);
                    }
                    .btn-secondary {
                        background: var(--vscode-button-secondaryBackground);
                        color: var(--vscode-button-secondaryForeground);
                        border: 1px solid var(--vscode-panel-border);
                    }
                    .btn-secondary:hover {
                        background: var(--vscode-button-secondaryHoverBackground);
                    }
                    .steps {
                        background: var(--vscode-textBlockQuote-background);
                        border-left: 4px solid var(--vscode-textLink-foreground);
                        padding: 20px;
                        border-radius: 4px;
                        margin-top: 20px;
                    }
                    .step {
                        margin-bottom: 16px;
                        display: flex;
                        gap: 12px;
                    }
                    .step-number {
                        background: var(--vscode-textLink-foreground);
                        color: var(--vscode-button-foreground);
                        width: 28px;
                        height: 28px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: 700;
                        flex-shrink: 0;
                    }
                    .step-content {
                        flex: 1;
                    }
                    .step-title {
                        font-weight: 600;
                        margin-bottom: 4px;
                    }
                    .keyboard-shortcut {
                        display: inline-block;
                        background: var(--vscode-keybindingLabel-background);
                        color: var(--vscode-keybindingLabel-foreground);
                        border: 1px solid var(--vscode-keybindingLabel-border);
                        padding: 2px 8px;
                        border-radius: 3px;
                        font-family: monospace;
                        font-size: 12px;
                        margin: 0 2px;
                    }
                    .footer {
                        margin-top: 40px;
                        padding-top: 20px;
                        border-top: 1px solid var(--vscode-panel-border);
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .checkbox-container {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        font-size: 14px;
                    }
                    a {
                        color: var(--vscode-textLink-foreground);
                        text-decoration: none;
                    }
                    a:hover {
                        text-decoration: underline;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>
                        <span class="shield-icon">🛡️</span>
                        Welcome to Scanax!
                    </h1>
                    <p class="subtitle">AI-Powered Security Vulnerability Scanner for VS Code</p>

                    <div class="section">
                        <h2>✨ Key Features</h2>
                        <div class="features">
                            <div class="feature-card">
                                <div class="feature-icon">🔍</div>
                                <div class="feature-title">Real-Time Scanning</div>
                                <div class="feature-desc">Detects vulnerabilities as you code with inline diagnostics</div>
                            </div>
                            <div class="feature-card">
                                <div class="feature-icon">🤖</div>
                                <div class="feature-title">AI Fix Suggestions</div>
                                <div class="feature-desc">Get intelligent code fixes powered by AI</div>
                            </div>
                            <div class="feature-card">
                                <div class="feature-icon">🔐</div>
                                <div class="feature-title">Secret Detection</div>
                                <div class="feature-desc">Finds hardcoded API keys, passwords, and credentials</div>
                            </div>
                            <div class="feature-card">
                                <div class="feature-icon">📦</div>
                                <div class="feature-title">Dependency Scanner</div>
                                <div class="feature-desc">Checks for CVEs in your dependencies</div>
                            </div>
                            <div class="feature-card">
                                <div class="feature-icon">🏷️</div>
                                <div class="feature-title">CWE References</div>
                                <div class="feature-desc">Every vulnerability tagged with CWE ID and CVSS score</div>
                            </div>
                            <div class="feature-card">
                                <div class="feature-icon">💡</div>
                                <div class="feature-title">Rich Tooltips</div>
                                <div class="feature-desc">Hover over vulnerabilities for complete details</div>
                            </div>
                        </div>
                    </div>

                    <div class="section">
                        <h2>🚀 Quick Start Guide</h2>
                        <div class="steps">
                            <div class="step">
                                <div class="step-number">1</div>
                                <div class="step-content">
                                    <div class="step-title">Start the Backend Server</div>
                                    <div>Navigate to <code>backend/</code> folder and run <code>python3.12 main.py</code></div>
                                </div>
                            </div>
                            <div class="step">
                                <div class="step-number">2</div>
                                <div class="step-content">
                                    <div class="step-title">Try the Sample Code</div>
                                    <div>Open a sample vulnerable file to see Scanax in action</div>
                                </div>
                            </div>
                            <div class="step">
                                <div class="step-number">3</div>
                                <div class="step-content">
                                    <div class="step-title">Scan Your Code</div>
                                    <div>Press <span class="keyboard-shortcut">Ctrl+Shift+S</span> to scan current file or <span class="keyboard-shortcut">Ctrl+Shift+W</span> for workspace</div>
                                </div>
                            </div>
                            <div class="step">
                                <div class="step-number">4</div>
                                <div class="step-content">
                                    <div class="step-title">Review & Fix</div>
                                    <div>Check the Scanax panel, hover over issues, and click "Get Fix Suggestion"</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="section">
                        <h2>⌨️ Keyboard Shortcuts</h2>
                        <p>
                            <span class="keyboard-shortcut">Ctrl+Shift+S</span> Scan current file<br>
                            <span class="keyboard-shortcut">Ctrl+Shift+W</span> Scan entire workspace<br>
                            <span class="keyboard-shortcut">Ctrl+Shift+V</span> Open vulnerability panel
                        </p>
                    </div>

                    <div class="cta-buttons">
                        <button class="btn btn-primary" onclick="startTutorial()">🎓 Start Tutorial</button>
                        <button class="btn btn-primary" onclick="openSample()">📝 Open Sample Code</button>
                        <button class="btn btn-secondary" onclick="scanWorkspace()">🔍 Scan Workspace</button>
                        <button class="btn btn-secondary" onclick="openSettings()">⚙️ Settings</button>
                    </div>

                    <div class="footer">
                        <div class="checkbox-container">
                            <button class="btn btn-secondary" onclick="dontShowAgain()" style="padding: 8px 16px;">Don't show again</button>
                        </div>
                        <div>
                            <a href="https://github.com/IUC4801/scanax" target="_blank">Documentation</a> •
                            <a href="https://github.com/IUC4801/scanax/issues" target="_blank">Report Issue</a>
                        </div>
                    </div>
                </div>

                <script>
                    const vscode = acquireVsCodeApi();
                    
                    function startTutorial() {
                        vscode.postMessage({ command: 'startTutorial' });
                    }
                    
                    function openSample() {
                        vscode.postMessage({ command: 'openSample' });
                    }
                    
                    function scanWorkspace() {
                        vscode.postMessage({ command: 'scanWorkspace' });
                    }
                    
                    function openSettings() {
                        vscode.postMessage({ command: 'openSettings' });
                    }
                    
                    function dontShowAgain() {
                        vscode.postMessage({ command: 'dontShowAgain' });
                    }
                </script>
            </body>
            </html>
        `;
    }

    public dispose() {
        WelcomePanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const d = this._disposables.pop();
            if (d) {
                d.dispose();
            }
        }
    }
}
