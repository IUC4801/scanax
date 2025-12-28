import * as vscode from 'vscode';
import fetch from 'node-fetch';

/**
 * Backend health monitoring and status management
 */
export class BackendHealthChecker {
    private statusBarItem: vscode.StatusBarItem;
    private isHealthy: boolean = false;
    private lastCheckTime: number = 0;
    private readonly CHECK_INTERVAL = 60000; // 1 minute
    private healthCheckTimer?: NodeJS.Timeout;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this.statusBarItem.command = 'scanax.checkBackendHealth';
    }

    /**
     * Start health monitoring
     */
    async start(backendUrl: string): Promise<void> {
        this.statusBarItem.show();
        await this.checkHealth(backendUrl);

        // Periodic health checks
        this.healthCheckTimer = setInterval(async () => {
            await this.checkHealth(backendUrl);
        }, this.CHECK_INTERVAL);
    }

    /**
     * Check backend health
     */
    async checkHealth(backendUrl: string): Promise<boolean> {
        this.lastCheckTime = Date.now();

        try {
            const response = await fetch(`${backendUrl}/`, {
                method: 'GET',
                timeout: 5000
            } as any);

            if (response.ok) {
                this.setHealthy(true);
                return true;
            } else {
                this.setHealthy(false);
                return false;
            }
        } catch (error) {
            this.setHealthy(false);
            return false;
        }
    }

    /**
     * Update health status
     */
    private setHealthy(healthy: boolean): void {
        this.isHealthy = healthy;

        if (healthy) {
            this.statusBarItem.text = '$(pass-filled) Scanax: Online';
            this.statusBarItem.tooltip = 'Backend is healthy. Click to refresh.';
            this.statusBarItem.backgroundColor = undefined;
        } else {
            this.statusBarItem.text = '$(error) Scanax: Offline';
            this.statusBarItem.tooltip = 'Backend is unreachable. Using offline mode (static analysis only). Click to retry.';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        }
    }

    /**
     * Get current health status
     */
    getStatus(): { isHealthy: boolean; lastCheck: number } {
        return {
            isHealthy: this.isHealthy,
            lastCheck: this.lastCheckTime
        };
    }

    /**
     * Show status notification
     */
    showStatus(): void {
        const status = this.isHealthy ? 'Online ✓' : 'Offline ✗';
        const mode = this.isHealthy ? 'Full analysis available' : 'Static analysis only';
        vscode.window.showInformationMessage(`Scanax Backend: ${status} - ${mode}`);
    }

    /**
     * Stop health monitoring
     */
    dispose(): void {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
        }
        this.statusBarItem.dispose();
    }
}
