import fetch from 'node-fetch';
import * as vscode from 'vscode';

/**
 * Get the backend URL from configuration
 */
function getBackendUrl(): string {
    const config = vscode.workspace.getConfiguration('scanax');
    return config.get<string>('backendUrl', 'http://localhost:8000').replace(/\/$/, ''); // Remove trailing slash
}

/**
 * Interface representing the backend response for a fix request.
 */
export interface FixResponse {
    fixed_code: string;
    explanation: string;
}

export async function sendCodeToScanaxBackend(code: string, userKey: string | null = null): Promise<any> {
    try {
        const backendUrl = getBackendUrl();
        const body: any = { code };
        if (userKey) {
            body.user_key = userKey;
        }

        const response = await fetch(`${backendUrl}/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`Backend error: ${response.status}`);
        }

        const result = await response.json();
        return result;
    } catch (error) {
        throw new Error(`Failed to send code to backend: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Requests a surgical fix from the backend.
 * Now returns a FixResponse object containing a list of search/replace pairs.
 */
export async function requestFix(
    code: string, 
    vulnerability: string, 
    userKey: string | null = null, 
    vulnLine: number | null = null
): Promise<FixResponse> {
    try {
        const backendUrl = getBackendUrl();
        const body: any = {
            original_code: code,
            vulnerability_description: vulnerability
        };
        
        if (userKey) {
            body.user_key = userKey;
        }
        if (vulnLine) {
            body.vulnerability_line = vulnLine;
        }

        const response = await fetch(`${backendUrl}/fix`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`Backend error: ${response.status}`);
        }

        // Parse the result as JSON to access the 'changes' array
        const result = await response.json();
        
        // Return the whole object so the extension can access result.changes
        return result as FixResponse;
    } catch (error) {
        throw new Error(`Failed to request fix from backend: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Scan dependencies for security vulnerabilities
 */
export async function scanDependencies(userKey: string | null = null): Promise<any> {
    try {
        const backendUrl = getBackendUrl();
        const workspaceFolders = require('vscode').workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('No workspace folder open');
        }

        const fs = require('fs');
        const path = require('path');
        const vscode = require('vscode');
        
        const rootPath = workspaceFolders[0].uri.fsPath;
        let dependencyContent = '';
        
        // Check for common dependency files
        const depFiles = [
            'package.json',
            'requirements.txt', 
            'go.mod',
            'Gemfile',
            'pom.xml',
            'build.gradle'
        ];
        
        for (const file of depFiles) {
            const filePath = path.join(rootPath, file);
            if (fs.existsSync(filePath)) {
                dependencyContent = fs.readFileSync(filePath, 'utf8');
                break;
            }
        }
        
        if (!dependencyContent) {
            throw new Error('No dependency files found (package.json, requirements.txt, go.mod, etc.)');
        }

        const body: any = { code: dependencyContent };
        if (userKey) {
            body.user_key = userKey;
        }

        const response = await fetch(`${backendUrl}/scan-dependencies`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`Backend error: ${response.status}`);
        }

        const result = await response.json();
        return result;
    } catch (error) {
        throw new Error(`Failed to scan dependencies: ${error instanceof Error ? error.message : String(error)}`);
    }
}