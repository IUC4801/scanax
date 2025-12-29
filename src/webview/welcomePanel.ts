import * as vscode from 'vscode';
import fetch from 'node-fetch';

export class WelcomePanel {
    public static currentPanel: WelcomePanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _context: vscode.ExtensionContext;

    public static createOrShow(extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
        if (WelcomePanel.currentPanel) {
            WelcomePanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'scanaxWelcome',
            'Scanax: Welcome',
            vscode.ViewColumn.One,
            { 
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        WelcomePanel.currentPanel = new WelcomePanel(panel, extensionUri, context);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._context = context;

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.onDidReceiveMessage(
            (message) => this._handleMessage(message),
            null,
            this._disposables
        );

        this._update();
    }

    private async _handleMessage(message: any) {
        switch (message.command) {
            case 'useFreeBackend':
                await this._setupFreeBackend();
                break;
            case 'validateApiKey':
                await this._validateApiKey(message.apiKey, message.provider);
                break;
            case 'readDocs':
                vscode.env.openExternal(vscode.Uri.parse('https://github.com/IUC4801/scanax'));
                break;
        }
    }

    private async _setupFreeBackend() {
        const config = vscode.workspace.getConfiguration('scanax');
        await config.update('provider', 'Default (Free)', vscode.ConfigurationTarget.Global);
        await config.update('backendUrl', 'https://scanax-backend.onrender.com', vscode.ConfigurationTarget.Global);
        await this._context.globalState.update('hasSeenSetup', true);
        
        this._showSuccessView();
    }

    private async _validateApiKey(apiKey: string, provider: string) {
        if (!apiKey || apiKey.trim().length === 0) {
            this._showError('Please enter an API key');
            return;
        }

        // Validate format based on provider
        if (provider === 'groq') {
            if (!apiKey.startsWith('gsk_')) {
                this._showError('Invalid Groq API key format. Expected: gsk_...');
                return;
            }
        } else if (provider === 'openai') {
            if (!apiKey.startsWith('sk-')) {
                this._showError('Invalid OpenAI API key format. Expected: sk-...');
                return;
            }
        } else if (provider === 'anthropic') {
            if (!apiKey.startsWith('sk-ant-')) {
                this._showError('Invalid Anthropic API key format. Expected: sk-ant-...');
                return;
            }
        }

        // Show validating state
        this._panel.webview.postMessage({ type: 'validating' });

        // Validate with backend
        try {
            const backendUrl = vscode.workspace.getConfiguration('scanax').get<string>('backendUrl', 'https://scanax-backend.onrender.com');
            const response = await fetch(`${backendUrl}/validate-key`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ api_key: apiKey, provider }),
                timeout: 10000
            } as any);

            if (response.ok) {
                const config = vscode.workspace.getConfiguration('scanax');
                await config.update('provider', `${provider.charAt(0).toUpperCase() + provider.slice(1)} (Custom)`, vscode.ConfigurationTarget.Global);
                await config.update('customApiKey', apiKey, vscode.ConfigurationTarget.Global);
                await this._context.globalState.update('hasSeenSetup', true);
                
                this._showSuccessView();
            } else {
                const data: any = await response.json();
                this._showError(data.error || 'Invalid API key. Please check and try again.');
            }
        } catch (error: any) {
            this._showError('Could not validate API key. Using free backend instead.');
            // Fallback to free backend
            await this._setupFreeBackend();
        }
    }

    private _showError(message: string) {
        this._panel.webview.postMessage({ type: 'error', message });
    }

    private _showSuccessView() {
        this._panel.webview.html = this._getSuccessHtml();
        setTimeout(() => {
            this._panel.dispose();
        }, 3000);
    }

    public dispose() {
        WelcomePanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
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
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
                        background: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                        padding: 30px 40px;
                        line-height: 1.6;
                    }
                    .container {
                        max-width: 650px;
                        margin: 0 auto;
                    }
                    .header {
                        text-align: left;
                        margin-bottom: 30px;
                    }
                    h1 {
                        font-size: 24px;
                        font-weight: 600;
                        margin-bottom: 20px;
                        color: var(--vscode-editor-foreground);
                    }
                    .description {
                        font-size: 14px;
                        color: var(--vscode-descriptionForeground);
                        margin-bottom: 12px;
                        line-height: 1.5;
                    }
                    .section {
                        margin-bottom: 25px;
                    }
                    .btn {
                        width: 100%;
                        padding: 12px 20px;
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        border-radius: 2px;
                        font-size: 13px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: background 0.2s;
                        margin-bottom: 10px;
                    }
                    .btn:hover {
                        background: var(--vscode-button-hoverBackground);
                    }
                    .btn-secondary {
                        background: transparent;
                        color: var(--vscode-button-foreground);
                        border: 1px solid var(--vscode-button-border);
                    }
                    .btn-secondary:hover {
                        background: var(--vscode-button-secondaryHoverBackground);
                    }
                    .api-section {
                        margin-top: 30px;
                        padding-top: 25px;
                        border-top: 1px solid var(--vscode-panel-border);
                    }
                    .api-label {
                        font-size: 13px;
                        font-weight: 500;
                        margin-bottom: 8px;
                        color: var(--vscode-foreground);
                    }
                    .input-group {
                        margin-bottom: 12px;
                    }
                    select, input {
                        width: 100%;
                        padding: 8px 10px;
                        background: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        border: 1px solid var(--vscode-input-border);
                        border-radius: 2px;
                        font-size: 13px;
                        font-family: inherit;
                    }
                    select:focus, input:focus {
                        outline: 1px solid var(--vscode-focusBorder);
                        border-color: var(--vscode-focusBorder);
                    }
                    .error-message {
                        background: var(--vscode-inputValidation-errorBackground);
                        color: var(--vscode-inputValidation-errorForeground);
                        border: 1px solid var(--vscode-inputValidation-errorBorder);
                        padding: 10px;
                        border-radius: 2px;
                        font-size: 12px;
                        margin-top: 10px;
                        display: none;
                    }
                    .loading {
                        opacity: 0.6;
                        pointer-events: none;
                    }
                    .hint {
                        font-size: 11px;
                        color: var(--vscode-descriptionForeground);
                        margin-top: 4px;
                    }
                    .link {
                        color: var(--vscode-textLink-foreground);
                        text-decoration: none;
                    }
                    .link:hover {
                        text-decoration: underline;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Welcome to Scanax!</h1>
                        <p class="description">
                            Configure your API key to connect to Scanax.
                        </p>
                        <p class="description">
                            This enables secure analysis of your code and dependencies.
                        </p>
                    </div>

                    <div class="section">
                        <button class="btn" onclick="useFreeBackend()">🚀 Use Free Backend (Recommended)</button>
                        <p class="hint">Get started instantly with our hosted backend - no configuration needed!</p>
                    </div>

                    <div class="api-section">
                        <div class="api-label">Or provide API key of your favorite LLM provider:</div>
                        
                        <div class="input-group">
                            <select id="provider">
                                <option value="groq">Groq (gsk_...)</option>
                                <option value="openai">OpenAI (sk-...)</option>
                                <option value="anthropic">Anthropic (sk-ant-...)</option>
                            </select>
                        </div>

                        <div class="input-group">
                            <input 
                                type="password" 
                                id="apiKey" 
                                placeholder="Enter your API key..."
                                onkeypress="if(event.key==='Enter') validateKey()"
                            />
                            <p class="hint">Your key is stored securely and never shared.</p>
                        </div>

                        <button class="btn" onclick="validateKey()" id="validateBtn">Validate & Continue</button>
                        
                        <div class="error-message" id="errorMsg"></div>
                    </div>

                    <div class="section" style="margin-top: 20px;">
                        <button class="btn btn-secondary" onclick="readDocs()">📖 Read Documentation</button>
                    </div>
                </div>

                <script>
                    const vscode = acquireVsCodeApi();

                    function useFreeBackend() {
                        vscode.postMessage({ command: 'useFreeBackend' });
                    }

                    function validateKey() {
                        const apiKey = document.getElementById('apiKey').value;
                        const provider = document.getElementById('provider').value;
                        const errorMsg = document.getElementById('errorMsg');
                        const validateBtn = document.getElementById('validateBtn');

                        if (!apiKey.trim()) {
                            errorMsg.textContent = 'Please enter an API key';
                            errorMsg.style.display = 'block';
                            return;
                        }

                        errorMsg.style.display = 'none';
                        validateBtn.textContent = 'Validating...';
                        validateBtn.classList.add('loading');

                        vscode.postMessage({ 
                            command: 'validateApiKey',
                            apiKey: apiKey,
                            provider: provider
                        });
                    }

                    function readDocs() {
                        vscode.postMessage({ command: 'readDocs' });
                    }

                    // Listen for messages from extension
                    window.addEventListener('message', event => {
                        const message = event.data;
                        const errorMsg = document.getElementById('errorMsg');
                        const validateBtn = document.getElementById('validateBtn');

                        if (message.type === 'error') {
                            errorMsg.textContent = message.message;
                            errorMsg.style.display = 'block';
                            validateBtn.textContent = 'Validate & Continue';
                            validateBtn.classList.remove('loading');
                        } else if (message.type === 'validating') {
                            errorMsg.style.display = 'none';
                        }
                    });
                </script>
            </body>
            </html>
        `;
    }

    private _getSuccessHtml(): string {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
                        background: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        margin: 0;
                        text-align: center;
                    }
                    .success {
                        max-width: 500px;
                    }
                    .icon {
                        font-size: 64px;
                        margin-bottom: 20px;
                    }
                    h1 {
                        font-size: 24px;
                        font-weight: 600;
                        margin-bottom: 12px;
                    }
                    p {
                        font-size: 14px;
                        color: var(--vscode-descriptionForeground);
                    }
                </style>
            </head>
            <body>
                <div class="success">
                    <div class="icon">✅</div>
                    <h1>You're all set to use Scanax!</h1>
                    <p>Click the shield icon in the sidebar to start scanning your code.</p>
                </div>
            </body>
            </html>
        `;
    }
}
