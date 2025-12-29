import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';

export class WelcomeViewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private _context: vscode.ExtensionContext;

    constructor(private readonly _extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
        this._context = context;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        console.log('Scanax: resolveWebviewView called');
        
        const hasSeenSetup = this._context.globalState.get<boolean>('hasSeenSetup', false);
        console.log('Scanax: hasSeenSetup =', hasSeenSetup);

        const html = this._getHtmlForWebview(webviewView.webview);
        console.log('Scanax: HTML length =', html.length);
        
        webviewView.webview.html = html;
        console.log('Scanax: HTML set');

        webviewView.webview.onDidReceiveMessage(async (data) => {
            console.log('Scanax: Received message', data);
            switch (data.type) {
                case 'saveApiKey':
                    await this._saveApiKey(data.apiKey, data.provider);
                    break;
                case 'openSettings':
                    vscode.commands.executeCommand('workbench.action.openSettings', 'scanax');
                    break;
            }
        });
    }

    private async _saveApiKey(apiKey: string, provider: string) {
        // Skip validation for free backend
        if (provider === 'Free Backend' || !apiKey || apiKey.trim().length === 0) {
            const config = vscode.workspace.getConfiguration('scanax');
            await config.update('customApiKey', '', vscode.ConfigurationTarget.Global);
            await config.update('provider', 'Free Backend', vscode.ConfigurationTarget.Global);
            await this._context.globalState.update('hasSeenSetup', true);
            await vscode.commands.executeCommand('setContext', 'scanax.setupComplete', true);
            
            this._view?.webview.postMessage({ type: 'success' });
            setTimeout(() => {
                if (this._view) {
                    this._view.webview.html = this._getHtmlForWebview(this._view.webview);
                }
            }, 1000);
            return;
        }

        // Client-side format validation
        const trimmedKey = apiKey.trim();
        let isValidFormat = false;
        
        // Check for known API key formats
        if (trimmedKey.startsWith('gsk_')) {
            isValidFormat = trimmedKey.length > 50; // Groq keys
        } else if (trimmedKey.startsWith('sk-')) {
            isValidFormat = trimmedKey.length > 40; // OpenAI/Anthropic keys
        } else if (trimmedKey.startsWith('sk-ant-')) {
            isValidFormat = trimmedKey.length > 50; // Anthropic keys
        } else {
            // Generic validation - at least 20 characters
            isValidFormat = trimmedKey.length >= 20;
        }
        
        if (!isValidFormat) {
            this._view?.webview.postMessage({ 
                type: 'error', 
                message: 'API key format appears invalid. Please check your key and try again.' 
            });
            return;
        }

        // Show validating message
        this._view?.webview.postMessage({ type: 'validating' });

        // Validate with backend
        try {
            const config = vscode.workspace.getConfiguration('scanax');
            const backendUrl = config.get<string>('backendUrl', 'https://scanax-backend.onrender.com');
            
            const url = new URL('/validate-key', backendUrl);
            const postData = JSON.stringify({ apiKey: trimmedKey, provider });
            
            const options = {
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                },
                timeout: 15000
            };

            const validationResult = await new Promise<{ valid: boolean; error?: string }>((resolve, reject) => {
                const protocol = url.protocol === 'https:' ? https : http;
                const req = protocol.request(options, (res) => {
                    let data = '';
                    res.on('data', (chunk) => data += chunk);
                    res.on('end', () => {
                        try {
                            const result = JSON.parse(data);
                            if (res.statusCode === 200) {
                                resolve(result);
                            } else {
                                reject({ error: result.error || 'Validation failed' });
                            }
                        } catch (e) {
                            reject({ error: 'Invalid server response' });
                        }
                    });
                });
                
                req.on('error', (err) => reject({ error: err.message }));
                req.on('timeout', () => {
                    req.destroy();
                    reject({ error: 'Request timeout' });
                });
                
                req.write(postData);
                req.end();
            });

            if (!validationResult.valid) {
                this._view?.webview.postMessage({ 
                    type: 'error', 
                    message: validationResult.error || 'Invalid API key. Please verify your credentials.' 
                });
                return;
            }

            // API key validated successfully, save it
            await config.update('customApiKey', trimmedKey, vscode.ConfigurationTarget.Global);
            await config.update('provider', provider, vscode.ConfigurationTarget.Global);
            await this._context.globalState.update('hasSeenSetup', true);
            
            // Set context key to hide the view
            await vscode.commands.executeCommand('setContext', 'scanax.setupComplete', true);

            this._view?.webview.postMessage({ type: 'success' });
            
            vscode.window.showInformationMessage(`Scanax: ${provider} API key validated and saved successfully!`);
            
            // Refresh view after short delay
            setTimeout(() => {
                if (this._view) {
                    this._view.webview.html = this._getHtmlForWebview(this._view.webview);
                }
            }, 1000);
        } catch (error: any) {
            console.error('API key validation error:', error);
            this._view?.webview.postMessage({ 
                type: 'error', 
                message: error.error || 'Unable to validate API key. Please check your internet connection and try again.' 
            });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const hasSeenSetup = this._context.globalState.get<boolean>('hasSeenSetup', false);
        const config = vscode.workspace.getConfiguration('scanax');
        const provider = config.get<string>('provider', 'Default (Free)');

        console.log('Scanax: Generating HTML, hasSeenSetup:', hasSeenSetup, 'provider:', provider);

        if (hasSeenSetup) {
            console.log('Scanax: Returning configured HTML');
            return this._getConfiguredHtml();
        }

        console.log('Scanax: Returning setup HTML');

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
            <style>
                body {
                    padding: 15px;
                    color: var(--vscode-foreground);
                    font-family: var(--vscode-font-family);
                    font-size: 13px;
                    line-height: 1.5;
                }
                h2 {
                    font-size: 16px;
                    font-weight: 600;
                    margin: 0 0 12px 0;
                }
                p {
                    margin: 0 0 12px 0;
                    color: var(--vscode-descriptionForeground);
                }
                .input-group {
                    margin-bottom: 10px;
                }
                label {
                    display: block;
                    margin-bottom: 4px;
                    font-size: 12px;
                }
                input, select {
                    width: 100%;
                    padding: 6px;
                    background: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 2px;
                    font-size: 12px;
                }
                button {
                    width: 100%;
                    padding: 8px;
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 2px;
                    cursor: pointer;
                    font-size: 12px;
                    margin-top: 8px;
                }
                button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                .skip-btn {
                    background: transparent;
                    color: var(--vscode-button-secondaryForeground);
                    border: 1px solid var(--vscode-button-border);
                    margin-top: 4px;
                }
                .error {
                    color: var(--vscode-errorForeground);
                    font-size: 11px;
                    margin-top: 4px;
                    display: none;
                }
                .success {
                    color: var(--vscode-testing-iconPassed);
                    font-size: 12px;
                    margin-top: 8px;
                    display: none;
                }
                .hint {
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 2px;
                }
            </style>
        </head>
        <body>
            <h2>Welcome to Scanax!</h2>
            <p>Configure your LLM provider to start scanning.</p>
            
            <div class="input-group">
                <label>Provider Name</label>
                <input type="text" id="provider" placeholder="e.g., OpenAI, Groq, Anthropic" value="Custom LLM">
                <div class="hint">Any LLM provider you use</div>
            </div>

            <div class="input-group">
                <label>API Key</label>
                <input type="password" id="apiKey" placeholder="Enter your API key">
                <div class="hint">Your key is stored securely</div>
            </div>

            <button onclick="saveKey()">Save & Continue</button>
            <button class="skip-btn" onclick="skipSetup()">Use Default Key</button>

            <div class="error" id="error"></div>
            <div class="success" id="success">✓ Saved successfully!</div>

            <script>
                const vscode = acquireVsCodeApi();

                function saveKey() {
                    const apiKey = document.getElementById('apiKey').value;
                    const provider = document.getElementById('provider').value || 'Custom LLM';
                    const error = document.getElementById('error');
                    const success = document.getElementById('success');

                    error.style.display = 'none';
                    success.style.display = 'none';

                    // Skip validation for Free Backend
                    if (provider !== 'Free Backend' && !apiKey.trim()) {
                        error.textContent = 'Please enter an API key';
                        error.style.display = 'block';
                        return;
                    }

                    vscode.postMessage({ type: 'saveApiKey', apiKey, provider });
                }

                function skipSetup() {
                    document.getElementById('apiKey').value = '';
                    document.getElementById('provider').value = 'Free Backend';
                    saveKey();
                }

                window.addEventListener('message', event => {
                    const message = event.data;
                    const error = document.getElementById('error');
                    const success = document.getElementById('success');
                    const saveBtn = document.querySelector('button');

                    if (message.type === 'validating') {
                        error.style.display = 'none';
                        success.textContent = '⏳ Validating API key...';
                        success.style.display = 'block';
                        saveBtn.disabled = true;
                    } else if (message.type === 'error') {
                        error.textContent = message.message;
                        error.style.display = 'block';
                        success.style.display = 'none';
                        saveBtn.disabled = false;
                    } else if (message.type === 'success') {
                        success.style.display = 'block';
                        error.style.display = 'none';
                    }
                });
            </script>
        </body>
        </html>`;
    }

    private _getConfiguredHtml() {
        const config = vscode.workspace.getConfiguration('scanax');
        const provider = config.get<string>('provider', 'Default (Free)');

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
            <style>
                body {
                    padding: 15px;
                    color: var(--vscode-foreground);
                    font-family: var(--vscode-font-family);
                    font-size: 13px;
                }
                .status {
                    background: var(--vscode-textBlockQuote-background);
                    border-left: 3px solid var(--vscode-textLink-foreground);
                    padding: 12px;
                    margin-bottom: 15px;
                }
                .status h3 {
                    margin: 0 0 8px 0;
                    font-size: 14px;
                }
                .provider {
                    color: var(--vscode-descriptionForeground);
                    font-size: 12px;
                }
                button {
                    width: 100%;
                    padding: 8px;
                    background: transparent;
                    color: var(--vscode-button-secondaryForeground);
                    border: 1px solid var(--vscode-button-border);
                    border-radius: 2px;
                    cursor: pointer;
                    font-size: 12px;
                }
                button:hover {
                    background: var(--vscode-button-secondaryHoverBackground);
                }
            </style>
        </head>
        <body>
            <div class="status">
                <h3>✓ All Set!</h3>
                <div class="provider">Provider: ${provider}</div>
            </div>
            <button onclick="openSettings()">Change Settings</button>

            <script>
                const vscode = acquireVsCodeApi();
                function openSettings() {
                    vscode.postMessage({ type: 'openSettings' });
                }
            </script>
        </body>
        </html>`;
    }
}
