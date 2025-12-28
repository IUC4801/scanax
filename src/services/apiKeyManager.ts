import * as vscode from 'vscode';

/**
 * API Key management and validation
 */
export class ApiKeyManager {
    private static readonly DEFAULT_BACKEND = 'https://scanax-backend.onrender.com';
    private static readonly GROQ_API_KEY_PATTERN = /^gsk_[a-zA-Z0-9]{48,}$/;

    /**
     * Check if setup is complete
     */
    static isSetupComplete(): boolean {
        const config = vscode.workspace.getConfiguration('scanax');
        const provider = config.get<string>('provider', 'Default (Free)');
        
        if (provider === 'Default (Free)') {
            return true; // Default is always ready
        }

        // Custom provider needs API key
        const apiKey = config.get<string>('customApiKey', '');
        return apiKey.length > 0;
    }

    /**
     * Validate Groq API key format
     */
    static validateGroqApiKey(apiKey: string): { valid: boolean; message?: string } {
        if (!apiKey || apiKey.trim().length === 0) {
            return { valid: false, message: 'API key is required' };
        }

        if (!this.GROQ_API_KEY_PATTERN.test(apiKey)) {
            return { 
                valid: false, 
                message: 'Invalid Groq API key format. Expected: gsk_...' 
            };
        }

        return { valid: true };
    }

    /**
     * Show setup wizard for first-time users
     */
    static async showSetupWizard(): Promise<boolean> {
        const choice = await vscode.window.showInformationMessage(
            '🛡️ Welcome to Scanax! Choose your scanning mode:',
            'Use Free Backend (Recommended)',
            'Use Custom Groq API Key',
            'Skip Setup'
        );

        if (!choice || choice === 'Skip Setup') {
            return false;
        }

        const config = vscode.workspace.getConfiguration('scanax');

        if (choice === 'Use Free Backend (Recommended)') {
            await config.update('provider', 'Default (Free)', vscode.ConfigurationTarget.Global);
            await config.update('backendUrl', this.DEFAULT_BACKEND, vscode.ConfigurationTarget.Global);
            
            vscode.window.showInformationMessage(
                '✅ Scanax configured with free backend. You\'re ready to scan!'
            );
            return true;
        }

        if (choice === 'Use Custom Groq API Key') {
            const apiKey = await vscode.window.showInputBox({
                prompt: 'Enter your Groq API key',
                placeHolder: 'gsk_...',
                password: true,
                validateInput: (value) => {
                    const validation = this.validateGroqApiKey(value);
                    return validation.valid ? null : validation.message;
                }
            });

            if (apiKey) {
                await config.update('provider', 'Groq (Custom)', vscode.ConfigurationTarget.Global);
                await config.update('customApiKey', apiKey, vscode.ConfigurationTarget.Global);
                
                vscode.window.showInformationMessage(
                    '✅ Custom API key configured successfully!'
                );
                return true;
            }
        }

        return false;
    }

    /**
     * Show API key help
     */
    static async showApiKeyHelp(): Promise<void> {
        const choice = await vscode.window.showInformationMessage(
            'Get a free Groq API key to use custom scanning',
            'Get API Key',
            'Use Free Backend Instead'
        );

        if (choice === 'Get API Key') {
            vscode.env.openExternal(vscode.Uri.parse('https://console.groq.com/keys'));
        } else if (choice === 'Use Free Backend Instead') {
            const config = vscode.workspace.getConfiguration('scanax');
            await config.update('provider', 'Default (Free)', vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage('✅ Switched to free backend!');
        }
    }

    /**
     * Check if using default free backend
     */
    static isUsingFreeBackend(): boolean {
        const config = vscode.workspace.getConfiguration('scanax');
        return config.get<string>('provider', 'Default (Free)') === 'Default (Free)';
    }

    /**
     * Get current API key (or null if using default)
     */
    static getCurrentApiKey(): string | null {
        if (this.isUsingFreeBackend()) {
            return null;
        }

        const config = vscode.workspace.getConfiguration('scanax');
        return config.get<string>('customApiKey', '');
    }
}
