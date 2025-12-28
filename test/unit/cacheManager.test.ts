import * as assert from 'assert';
import { CacheManager } from '../../src/scanner/cacheManager';

suite('CacheManager Test Suite', () => {
    let cacheManager: CacheManager;

    setup(() => {
        cacheManager = new CacheManager();
    });

    teardown(() => {
        cacheManager.clearAll();
    });

    test('Should cache scan results', () => {
        const fileUri = 'file:///test.js';
        const content = 'const x = 10;';
        const vulnerabilities = [{ line: 1, message: 'Test vuln' }];

        cacheManager.setCachedResult(fileUri, content, vulnerabilities);
        const cached = cacheManager.getCachedResult(fileUri, content);

        assert.deepStrictEqual(cached, vulnerabilities);
    });

    test('Should return null for uncached file', () => {
        const result = cacheManager.getCachedResult('file:///unknown.js', 'content');
        assert.strictEqual(result, null);
    });

    test('Should invalidate cache when content changes', () => {
        const fileUri = 'file:///test.js';
        const content1 = 'const x = 10;';
        const content2 = 'const x = 20;';
        const vulnerabilities = [{ line: 1, message: 'Test vuln' }];

        cacheManager.setCachedResult(fileUri, content1, vulnerabilities);
        const result = cacheManager.getCachedResult(fileUri, content2);

        assert.strictEqual(result, null);
    });

    test('Should clear specific cache entry', () => {
        const fileUri = 'file:///test.js';
        const content = 'const x = 10;';
        const vulnerabilities = [{ line: 1, message: 'Test vuln' }];

        cacheManager.setCachedResult(fileUri, content, vulnerabilities);
        cacheManager.invalidate(fileUri);
        const result = cacheManager.getCachedResult(fileUri, content);

        assert.strictEqual(result, null);
    });

    test('Should clear all cache entries', () => {
        cacheManager.setCachedResult('file:///test1.js', 'content1', []);
        cacheManager.setCachedResult('file:///test2.js', 'content2', []);

        cacheManager.clearAll();
        const stats = cacheManager.getStats();

        assert.strictEqual(stats.total, 0);
    });

    test('Should track cache statistics', () => {
        cacheManager.setCachedResult('file:///test1.js', 'content1', []);
        cacheManager.setCachedResult('file:///test2.js', 'content2', []);

        const stats = cacheManager.getStats();

        assert.strictEqual(stats.total, 2);
        assert.ok(stats.valid >= 0);
    });
});
