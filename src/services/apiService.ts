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
 * Custom error types for better error handling
 */
export class NetworkError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'NetworkError';
    }
}

export class BackendError extends Error {
    constructor(message: string, public statusCode?: number) {
        super(message);
        this.name = 'BackendError';
    }
}

export class ApiKeyError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ApiKeyError';
    }
}

/**
 * Retry configuration
 */
const RETRY_CONFIG = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 5000,
    backoffFactor: 2
};

/**
 * Sleep helper for retry logic
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry wrapper with exponential backoff
 */
async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    retries: number = RETRY_CONFIG.maxRetries
): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;
            
            // Don't retry on API key errors or client errors (4xx)
            if (error instanceof ApiKeyError) {
                throw error;
            }
            
            if (error instanceof BackendError && error.statusCode && error.statusCode < 500) {
                throw error;
            }
            
            // If this is the last attempt, throw the error
            if (attempt === retries) {
                throw error;
            }
            
            // Calculate delay with exponential backoff
            const delay = Math.min(
                RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.backoffFactor, attempt),
                RETRY_CONFIG.maxDelay
            );
            
            console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
            await sleep(delay);
        }
    }
    
    throw lastError;
}

/**
 * Interface representing the backend response for a fix request.
 */
export interface FixResponse {
    fixed_code: string;
    explanation: string;
}

/**
 * Report false positive to backend
 */
export async function reportFalsePositive(
    code: string,
    vulnerability: any,
    reason: string,
    userKey: string | null = null
): Promise<void> {
    try {
        const backendUrl = getBackendUrl();
        const body: any = {
            code,
            vulnerability,
            reason,
            timestamp: new Date().toISOString()
        };
        
        if (userKey) {
            body.user_key = userKey;
        }

        const response = await fetch(`${backendUrl}/report-false-positive`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            timeout: 10000
        } as any);

        if (!response.ok) {
            console.error('Failed to report false positive:', response.status);
        }
    } catch (error) {
        // Silent fail - don't interrupt user workflow
        console.error('Error reporting false positive:', error);
    }
}

export async function sendCodeToScanaxBackend(code: string, userKey: string | null = null): Promise<any> {
    return retryWithBackoff(async () => {
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
                timeout: 30000
            } as any);

            if (response.status === 401 || response.status === 403) {
                throw new ApiKeyError('Invalid or missing API key. Please check your Groq API key in settings.');
            }

            if (response.status === 429) {
                throw new BackendError('Rate limit exceeded. Please try again in a moment.', 429);
            }

            if (response.status >= 500) {
                throw new BackendError(`Backend server error (${response.status}). Please try again.`, response.status);
            }

            if (!response.ok) {
                throw new BackendError(`Backend error: ${response.status}`, response.status);
            }

            const result = await response.json();
            return result;
        } catch (error) {
            if (error instanceof ApiKeyError || error instanceof BackendError) {
                throw error;
            }
            
            if ((error as any).code === 'ECONNREFUSED' || (error as any).code === 'ENOTFOUND') {
                throw new NetworkError('Cannot connect to backend server. Please check if the backend is running and the URL is correct in settings.');
            }
            
            if ((error as any).type === 'request-timeout') {
                throw new NetworkError('Request timeout. The backend server is taking too long to respond.');
            }
            
            throw new NetworkError(`Failed to send code to backend: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
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
    return retryWithBackoff(async () => {
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
                timeout: 30000
            } as any);

            if (response.status === 401 || response.status === 403) {
                throw new ApiKeyError('Invalid API key for fix request');
            }

            if (!response.ok) {
                throw new BackendError(`Backend error: ${response.status}`, response.status);
            }

            const result = await response.json();
            return result as FixResponse;
        } catch (error) {
            if (error instanceof ApiKeyError || error instanceof BackendError) {
                throw error;
            }
            throw new NetworkError(`Failed to request fix from backend: ${error instanceof Error ? error.message : String(error)}`);
        }
    });
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