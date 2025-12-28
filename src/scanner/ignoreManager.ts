import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Manages ignored vulnerabilities via inline comments and .scanaxignore file
 */
export class IgnoreManager {
    private ignorePatterns: Set<string> = new Set();
    private workspaceRoot: string | undefined;

    constructor() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            this.workspaceRoot = workspaceFolders[0].uri.fsPath;
            this.loadIgnoreFile();
        }
    }

    /**
     * Load .scanaxignore file if it exists
     */
    private loadIgnoreFile(): void {
        if (!this.workspaceRoot) {return;}

        const ignoreFilePath = path.join(this.workspaceRoot, '.scanaxignore');
        if (fs.existsSync(ignoreFilePath)) {
            try {
                const content = fs.readFileSync(ignoreFilePath, 'utf-8');
                const lines = content.split('\n');
                
                lines.forEach(line => {
                    const trimmed = line.trim();
                    // Skip empty lines and comments
                    if (trimmed && !trimmed.startsWith('#')) {
                        this.ignorePatterns.add(trimmed);
                    }
                });
            } catch (err) {
                console.error('Error loading .scanaxignore:', err);
            }
        }
    }

    /**
     * Check if a line has an inline ignore comment
     */
    isLineIgnored(document: vscode.TextDocument, lineNumber: number): boolean {
        const lineIndex = lineNumber - 1;
        
        if (lineIndex < 0 || lineIndex >= document.lineCount) {
            return false;
        }

        const line = document.lineAt(lineIndex);
        const lineText = line.text;
        
        // Check for inline ignore comments
        const ignorePatterns = [
            /scanax-ignore/i,
            /scanax:ignore/i,
            /noscanax/i
        ];

        for (const pattern of ignorePatterns) {
            if (pattern.test(lineText)) {
                return true;
            }
        }

        // Check previous line for ignore-next-line
        if (lineIndex > 0) {
            const prevLine = document.lineAt(lineIndex - 1).text;
            const ignoreNextPatterns = [
                /scanax-ignore-next-line/i,
                /scanax:ignore-next-line/i
            ];

            for (const pattern of ignoreNextPatterns) {
                if (pattern.test(prevLine)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Check if a file should be ignored based on .scanaxignore patterns
     */
    isFileIgnored(filePath: string): boolean {
        if (!this.workspaceRoot) {return false;}

        const relativePath = path.relative(this.workspaceRoot, filePath);
        
        // Normalize path separators for cross-platform compatibility
        const normalizedPath = relativePath.replace(/\\/g, '/');

        for (const pattern of this.ignorePatterns) {
            // Simple glob matching
            if (this.matchGlob(normalizedPath, pattern)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Simple glob pattern matching
     */
    private matchGlob(path: string, pattern: string): boolean {
        // Convert glob pattern to regex
        const regexPattern = pattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
        
        const regex = new RegExp(`^${regexPattern}$`, 'i');
        return regex.test(path);
    }

    /**
     * Filter vulnerabilities based on ignore rules
     */
    filterIgnored(document: vscode.TextDocument, vulnerabilities: any[]): any[] {
        // Check if entire file is ignored
        if (this.isFileIgnored(document.uri.fsPath)) {
            return [];
        }

        // Filter out individually ignored lines
        return vulnerabilities.filter(vuln => {
            return !this.isLineIgnored(document, vuln.line);
        });
    }

    /**
     * Create a sample .scanaxignore file
     */
    async createSampleIgnoreFile(): Promise<void> {
        if (!this.workspaceRoot) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        const ignoreFilePath = path.join(this.workspaceRoot, '.scanaxignore');
        
        if (fs.existsSync(ignoreFilePath)) {
            vscode.window.showInformationMessage('.scanaxignore already exists');
            return;
        }

        const sampleContent = `# Scanax Ignore File
# Add patterns for files or vulnerabilities to ignore
# Use # for comments

# Ignore test files
**/*.test.js
**/*.spec.ts
**/tests/**

# Ignore build output
**/dist/**
**/build/**
**/out/**

# Ignore third-party
**/node_modules/**
**/vendor/**
`;

        try {
            fs.writeFileSync(ignoreFilePath, sampleContent, 'utf-8');
            const doc = await vscode.workspace.openTextDocument(ignoreFilePath);
            await vscode.window.showTextDocument(doc);
            vscode.window.showInformationMessage('.scanaxignore file created!');
        } catch (err) {
            vscode.window.showErrorMessage(`Failed to create .scanaxignore: ${err}`);
        }
    }

    /**
     * Reload ignore patterns (call when .scanaxignore changes)
     */
    reload(): void {
        this.ignorePatterns.clear();
        this.loadIgnoreFile();
    }
}
