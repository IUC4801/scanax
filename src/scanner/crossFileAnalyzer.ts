import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface CrossFileVulnerability {
    type: 'exposed-api' | 'insecure-export' | 'missing-validation' | 'circular-dependency';
    sourceFile: string;
    targetFile: string;
    line: number;
    message: string;
    severity: 'high' | 'medium' | 'low';
    suggestion: string;
}

export interface ModuleInfo {
    file: string;
    exports: string[];
    imports: { source: string; items: string[] }[];
    vulnerableExports: string[];
}

/**
 * Analyzes cross-file dependencies and data flow
 * Detects vulnerabilities that span multiple files
 */
export class CrossFileAnalyzer {
    private moduleMap: Map<string, ModuleInfo> = new Map();
    private workspaceRoot: string = '';

    /**
     * Analyze entire workspace for cross-file vulnerabilities
     */
    async analyzeWorkspace(workspaceFolder: vscode.WorkspaceFolder): Promise<CrossFileVulnerability[]> {
        this.workspaceRoot = workspaceFolder.uri.fsPath;
        this.moduleMap.clear();

        // Find all source files
        const files = await vscode.workspace.findFiles(
            new vscode.RelativePattern(workspaceFolder, '**/*.{js,ts,py,jsx,tsx,cs,vb,fs}'),
            '**/node_modules/**'
        );

        // Build module dependency graph
        for (const file of files) {
            await this.analyzeFile(file);
        }

        // Detect cross-file vulnerabilities
        return this.detectVulnerabilities();
    }

    /**
     * Analyze a single file for imports/exports
     */
    private async analyzeFile(fileUri: vscode.Uri): Promise<void> {
        const document = await vscode.workspace.openTextDocument(fileUri);
        const text = document.getText();
        const relativePath = path.relative(this.workspaceRoot, fileUri.fsPath);

        const moduleInfo: ModuleInfo = {
            file: relativePath,
            exports: [],
            imports: [],
            vulnerableExports: []
        };

        // Parse exports
        moduleInfo.exports = this.parseExports(text, document.languageId);
        
        // Parse imports
        moduleInfo.imports = this.parseImports(text, document.languageId);

        // Identify vulnerable exports (functions that handle user input without validation)
        moduleInfo.vulnerableExports = this.identifyVulnerableExports(text, moduleInfo.exports);

        this.moduleMap.set(relativePath, moduleInfo);
    }

    /**
     * Parse export statements from code
     */
    private parseExports(text: string, languageId: string): string[] {
        const exports: string[] = [];

        if (languageId === 'javascript' || languageId === 'typescript') {
            // Named exports: export function foo() {}
            const namedExports = text.matchAll(/export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g);
            for (const match of namedExports) {
                exports.push(match[1]);
            }

            // Export list: export { foo, bar }
            const exportLists = text.matchAll(/export\s+\{\s*([^}]+)\s*\}/g);
            for (const match of exportLists) {
                const items = match[1].split(',').map(item => item.trim().split(/\s+as\s+/)[0]);
                exports.push(...items);
            }

            // Default exports
            if (/export\s+default/g.test(text)) {
                exports.push('default');
            }
        } else if (languageId === 'python') {
            // Python functions/classes (assume all top-level are exportable)
            const pythonDefs = text.matchAll(/^(?:def|class)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm);
            for (const match of pythonDefs) {
                if (!match[1].startsWith('_')) { // Exclude private
                    exports.push(match[1]);
                }
            }
        } else if (languageId === 'csharp' || languageId === 'vb' || languageId === 'fsharp') {
            // C# public methods/classes
            const csharpPublic = text.matchAll(/public\s+(?:static\s+)?(?:async\s+)?(?:void|Task|[A-Z][a-zA-Z0-9<>,\s]*)\s+([A-Z][a-zA-Z0-9_]*)/g);
            for (const match of csharpPublic) {
                exports.push(match[1]);
            }

            // C# public classes
            const csharpClasses = text.matchAll(/public\s+(?:static\s+)?(?:sealed\s+)?(?:abstract\s+)?class\s+([A-Z][a-zA-Z0-9_]*)/g);
            for (const match of csharpClasses) {
                exports.push(match[1]);
            }
        }

        return exports;
    }

    /**
     * Parse import statements from code
     */
    private parseImports(text: string, languageId: string): { source: string; items: string[] }[] {
        const imports: { source: string; items: string[] }[] = [];

        if (languageId === 'javascript' || languageId === 'typescript') {
            // ES6 imports: import { foo } from './module'
            const namedImports = text.matchAll(/import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g);
            for (const match of namedImports) {
                const items = match[1].split(',').map(item => item.trim().split(/\s+as\s+/)[0]);
                imports.push({ source: match[2], items });
            }

            // Default imports: import foo from './module'
            const defaultImports = text.matchAll(/import\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s+from\s+['"]([^'"]+)['"]/g);
            for (const match of defaultImports) {
                imports.push({ source: match[2], items: [match[1]] });
            }

            // Require statements: const foo = require('./module')
            const requires = text.matchAll(/require\s*\(['"]([^'"]+)['"]\)/g);
            for (const match of requires) {
                imports.push({ source: match[1], items: ['*'] });
            }
        } else if (languageId === 'python') {
            // Python imports: from module import foo
            const fromImports = text.matchAll(/from\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s+import\s+(.+)/g);
            for (const match of fromImports) {
                const items = match[2].split(',').map(item => item.trim().split(/\s+as\s+/)[0]);
                imports.push({ source: match[1], items });
            }

            // Simple imports: import module
            const simpleImports = text.matchAll(/^import\s+([a-zA-Z_][a-zA-Z0-9_.]*)/gm);
            for (const match of simpleImports) {
                imports.push({ source: match[1], items: ['*'] });
            }
        } else if (languageId === 'csharp') {
            // C# using statements: using MyNamespace.MyClass;
            const usingImports = text.matchAll(/using\s+([a-zA-Z_][a-zA-Z0-9_.]*);/g);
            for (const match of usingImports) {
                imports.push({ source: match[1], items: ['*'] });
            }
        }

        return imports;
    }

    /**
     * Identify exports that handle user input without validation
     */
    private identifyVulnerableExports(text: string, exports: string[]): string[] {
        const vulnerable: string[] = [];

        for (const exportName of exports) {
            // Find function definition (JS/TS/Python)
            let funcRegex = new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${exportName}\\s*\\([^)]*\\)\\s*\\{[^}]*\\}`, 's');
            let match = text.match(funcRegex);

            // C# method pattern
            if (!match) {
                funcRegex = new RegExp(`public\\s+(?:static\\s+)?(?:async\\s+)?\\w+\\s+${exportName}\\s*\\([^)]*\\)\\s*\\{[^}]*\\}`, 's');
                match = text.match(funcRegex);
            }

            if (match) {
                const funcBody = match[0];
                
                // Check if it uses dangerous operations without validation
                const hasDangerousOps = /(?:execute|query|eval|exec|innerHTML|document\.write|SqlCommand|ExecuteRaw|Process\.Start)/i.test(funcBody);
                const hasValidation = /(?:validate|sanitize|escape|check|verify|isValid|Encode|TryParse)/i.test(funcBody);

                if (hasDangerousOps && !hasValidation) {
                    vulnerable.push(exportName);
                }
            }
        }

        return vulnerable;
    }

    /**
     * Detect cross-file vulnerabilities
     */
    private detectVulnerabilities(): CrossFileVulnerability[] {
        const vulnerabilities: CrossFileVulnerability[] = [];

        // Check each module's imports
        for (const [filePath, moduleInfo] of this.moduleMap.entries()) {
            for (const importInfo of moduleInfo.imports) {
                // Resolve import path
                const resolvedPath = this.resolveImportPath(filePath, importInfo.source);
                const importedModule = this.moduleMap.get(resolvedPath);

                if (importedModule) {
                    // Check if importing vulnerable functions
                    for (const item of importInfo.items) {
                        if (importedModule.vulnerableExports.includes(item)) {
                            vulnerabilities.push({
                                type: 'insecure-export',
                                sourceFile: resolvedPath,
                                targetFile: filePath,
                                line: 1, // Could be improved with line tracking
                                message: `Function '${item}' from ${resolvedPath} performs dangerous operations without input validation`,
                                severity: 'high',
                                suggestion: `Add input validation to '${item}' or validate data before calling it`
                            });
                        }
                    }

                    // Check for exposed APIs without authentication
                    if (this.isApiRoute(filePath) && importedModule.vulnerableExports.length > 0) {
                        vulnerabilities.push({
                            type: 'exposed-api',
                            sourceFile: resolvedPath,
                            targetFile: filePath,
                            line: 1,
                            message: `API route ${filePath} uses unvalidated functions from ${resolvedPath}`,
                            severity: 'high',
                            suggestion: 'Add authentication and input validation middleware'
                        });
                    }
                }
            }

            // Check for circular dependencies
            const circularDeps = this.findCircularDependencies(filePath);
            if (circularDeps.length > 0) {
                vulnerabilities.push({
                    type: 'circular-dependency',
                    sourceFile: filePath,
                    targetFile: circularDeps.join(', '),
                    line: 1,
                    message: `Circular dependency detected: ${filePath} <-> ${circularDeps.join(', ')}`,
                    severity: 'medium',
                    suggestion: 'Refactor to break circular dependencies'
                });
            }
        }

        return vulnerabilities;
    }

    /**
     * Resolve relative import path to absolute
     */
    private resolveImportPath(fromFile: string, importPath: string): string {
        if (importPath.startsWith('.')) {
            const dir = path.dirname(fromFile);
            let resolved = path.normalize(path.join(dir, importPath));
            
            // Try common extensions
            const extensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.cs', '.vb', '.fs'];
            for (const ext of extensions) {
                if (this.moduleMap.has(resolved + ext)) {
                    return resolved + ext;
                }
            }
            
            // Try index files
            for (const ext of extensions) {
                const indexPath = path.join(resolved, 'index' + ext);
                if (this.moduleMap.has(indexPath)) {
                    return indexPath;
                }
            }
            
            return resolved;
        }
        return importPath;
    }

    /**
     * Check if file is an API route
     */
    private isApiRoute(filePath: string): boolean {
        return /(?:api|routes|endpoints|controllers)/i.test(filePath) ||
               /app\.(?:get|post|put|delete|patch)/i.test(filePath);
    }

    /**
     * Find circular dependencies
     */
    private findCircularDependencies(startFile: string, visited: Set<string> = new Set(), path: string[] = []): string[] {
        if (visited.has(startFile)) {
            const cycleStart = path.indexOf(startFile);
            return cycleStart >= 0 ? path.slice(cycleStart) : [];
        }

        visited.add(startFile);
        path.push(startFile);

        const moduleInfo = this.moduleMap.get(startFile);
        if (moduleInfo) {
            for (const importInfo of moduleInfo.imports) {
                const resolvedPath = this.resolveImportPath(startFile, importInfo.source);
                const cycle = this.findCircularDependencies(resolvedPath, new Set(visited), [...path]);
                if (cycle.length > 0) {
                    return cycle;
                }
            }
        }

        return [];
    }

    /**
     * Get dependency graph for visualization
     */
    getDependencyGraph(): Map<string, string[]> {
        const graph = new Map<string, string[]>();
        
        for (const [filePath, moduleInfo] of this.moduleMap.entries()) {
            const dependencies = moduleInfo.imports
                .map(imp => this.resolveImportPath(filePath, imp.source))
                .filter(dep => this.moduleMap.has(dep));
            graph.set(filePath, dependencies);
        }
        
        return graph;
    }
}
