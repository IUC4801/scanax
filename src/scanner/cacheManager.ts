import * as vscode from 'vscode';
import * as crypto from 'crypto';

interface CachedScanResult {
    hash: string;
    timestamp: number;
    vulnerabilities: any[];
}

/**
 * Manages caching of scan results to avoid redundant API calls
 */
export class CacheManager {
    private cache: Map<string, CachedScanResult> = new Map();
    private readonly CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

    /**
     * Generate hash for file content
     */
    private generateHash(content: string): string {
        return crypto.createHash('sha256').update(content).digest('hex');
    }

    /**
     * Check if cached result is still valid
     */
    private isValidCache(cached: CachedScanResult): boolean {
        return Date.now() - cached.timestamp < this.CACHE_EXPIRY_MS;
    }

    /**
     * Get cached scan result if valid
     */
    getCachedResult(fileUri: string, content: string): any[] | null {
        const hash = this.generateHash(content);
        const cached = this.cache.get(fileUri);

        if (cached && cached.hash === hash && this.isValidCache(cached)) {
            return cached.vulnerabilities;
        }

        return null;
    }

    /**
     * Store scan result in cache
     */
    setCachedResult(fileUri: string, content: string, vulnerabilities: any[]): void {
        const hash = this.generateHash(content);
        this.cache.set(fileUri, {
            hash,
            timestamp: Date.now(),
            vulnerabilities
        });
    }

    /**
     * Invalidate cache for a specific file
     */
    invalidate(fileUri: string): void {
        this.cache.delete(fileUri);
    }

    /**
     * Clear all cached results
     */
    clearAll(): void {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    getStats(): { total: number; valid: number } {
        let valid = 0;
        this.cache.forEach(cached => {
            if (this.isValidCache(cached)) {
                valid++;
            }
        });
        return { total: this.cache.size, valid };
    }
}
