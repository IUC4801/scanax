import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import fetch from 'node-fetch';

export interface DependencyVulnerability {
    package: string;
    version: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    cve: string;
    description: string;
    fixedVersion?: string;
    cvss?: number;
}

/**
 * Scans project dependencies for known vulnerabilities
 */
export class DependencyScanner {
    private vulnerabilityCache: Map<string, DependencyVulnerability[]> = new Map();
    private readonly CACHE_TTL = 3600000; // 1 hour
    private lastScanTime: Map<string, number> = new Map();

    /**
     * Scan package.json for npm vulnerabilities
     */
    async scanNpmDependencies(workspaceFolder: string): Promise<DependencyVulnerability[]> {
        const packageJsonPath = path.join(workspaceFolder, 'package.json');
        
        if (!fs.existsSync(packageJsonPath)) {
            return [];
        }

        const cacheKey = `npm:${packageJsonPath}`;
        const cached = this.getCachedResult(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const content = fs.readFileSync(packageJsonPath, 'utf8');
            const packageJson = JSON.parse(content);
            const vulnerabilities: DependencyVulnerability[] = [];

            const allDeps = {
                ...packageJson.dependencies || {},
                ...packageJson.devDependencies || {}
            };

            // Check against OSV database (Open Source Vulnerabilities)
            for (const [pkg, version] of Object.entries(allDeps)) {
                const vulns = await this.checkOSVDatabase(pkg, version as string, 'npm');
                vulnerabilities.push(...vulns);
            }

            this.setCachedResult(cacheKey, vulnerabilities);
            return vulnerabilities;
        } catch (error) {
            console.error('Error scanning npm dependencies:', error);
            return [];
        }
    }

    /**
     * Scan requirements.txt for Python vulnerabilities
     */
    async scanPythonDependencies(workspaceFolder: string): Promise<DependencyVulnerability[]> {
        const requirementsPath = path.join(workspaceFolder, 'requirements.txt');
        
        if (!fs.existsSync(requirementsPath)) {
            return [];
        }

        const cacheKey = `pip:${requirementsPath}`;
        const cached = this.getCachedResult(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const content = fs.readFileSync(requirementsPath, 'utf8');
            const vulnerabilities: DependencyVulnerability[] = [];

            // Parse requirements.txt
            const lines = content.split('\n').filter(line => 
                line.trim() && !line.startsWith('#')
            );

            for (const line of lines) {
                const match = line.match(/^([a-zA-Z0-9-_.]+)(?:==|>=|<=|~=|>|<)?(.+)?$/);
                if (match) {
                    const [, pkg, version] = match;
                    const vulns = await this.checkOSVDatabase(pkg, version || '*', 'pypi');
                    vulnerabilities.push(...vulns);
                }
            }

            this.setCachedResult(cacheKey, vulnerabilities);
            return vulnerabilities;
        } catch (error) {
            console.error('Error scanning Python dependencies:', error);
            return [];
        }
    }

    /**
     * Check OSV (Open Source Vulnerabilities) database
     */
    private async checkOSVDatabase(
        packageName: string, 
        version: string, 
        ecosystem: 'npm' | 'pypi'
    ): Promise<DependencyVulnerability[]> {
        try {
            const response = await fetch('https://api.osv.dev/v1/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    package: {
                        name: packageName,
                        ecosystem: ecosystem === 'npm' ? 'npm' : 'PyPI'
                    },
                    version: version.replace(/[^0-9.]/g, '') // Clean version string
                }),
                timeout: 5000
            } as any);

            if (!response.ok) {
                return [];
            }

            const data = await response.json() as any;
            const vulnerabilities: DependencyVulnerability[] = [];

            if (data.vulns && Array.isArray(data.vulns)) {
                for (const vuln of data.vulns) {
                    vulnerabilities.push({
                        package: packageName,
                        version: version,
                        severity: this.mapSeverity(vuln.severity),
                        cve: vuln.id || vuln.aliases?.[0] || 'UNKNOWN',
                        description: vuln.summary || vuln.details || 'Vulnerability detected',
                        fixedVersion: vuln.affected?.[0]?.ranges?.[0]?.events?.find((e: any) => e.fixed)?.fixed,
                        cvss: vuln.severity?.[0]?.score
                    });
                }
            }

            return vulnerabilities;
        } catch (error) {
            // Silently fail for individual package lookups
            return [];
        }
    }

    /**
     * Map OSV severity to standard levels
     */
    private mapSeverity(severity: any): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
        if (!severity || !Array.isArray(severity) || severity.length === 0) {
            return 'MEDIUM';
        }

        const score = severity[0]?.score || 0;
        if (score >= 9.0) return 'CRITICAL';
        if (score >= 7.0) return 'HIGH';
        if (score >= 4.0) return 'MEDIUM';
        return 'LOW';
    }

    /**
     * Scan all dependencies in workspace
     */
    async scanWorkspace(workspaceFolder: string): Promise<DependencyVulnerability[]> {
        const [npmVulns, pyVulns] = await Promise.all([
            this.scanNpmDependencies(workspaceFolder),
            this.scanPythonDependencies(workspaceFolder)
        ]);

        return [...npmVulns, ...pyVulns];
    }

    /**
     * Get cached result if still valid
     */
    private getCachedResult(key: string): DependencyVulnerability[] | null {
        const lastScan = this.lastScanTime.get(key);
        if (lastScan && (Date.now() - lastScan < this.CACHE_TTL)) {
            return this.vulnerabilityCache.get(key) || null;
        }
        return null;
    }

    /**
     * Cache scan result
     */
    private setCachedResult(key: string, vulnerabilities: DependencyVulnerability[]): void {
        this.vulnerabilityCache.set(key, vulnerabilities);
        this.lastScanTime.set(key, Date.now());
    }

    /**
     * Clear cache
     */
    clearCache(): void {
        this.vulnerabilityCache.clear();
        this.lastScanTime.clear();
    }
}
