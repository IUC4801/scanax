import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { DependencyScanner } from '../../src/scanner/dependencyScanner';

suite('DependencyScanner Test Suite', () => {
    let scanner: DependencyScanner;
    let tempDir: string;

    setup(() => {
        scanner = new DependencyScanner();
        tempDir = path.join(__dirname, 'temp-test');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
    });

    teardown(() => {
        // Clean up temp directory
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    test('Should return empty array when no package.json exists', async () => {
        const vulnerabilities = await scanner.scanNpmDependencies(tempDir);
        assert.strictEqual(vulnerabilities.length, 0);
    });

    test('Should parse package.json with dependencies', async () => {
        const packageJson = {
            name: 'test-package',
            version: '1.0.0',
            dependencies: {
                'express': '^4.17.1',
                'lodash': '^4.17.20'
            },
            devDependencies: {
                'jest': '^27.0.0'
            }
        };

        fs.writeFileSync(
            path.join(tempDir, 'package.json'),
            JSON.stringify(packageJson, null, 2)
        );

        // Note: This will try to hit OSV API unless mocked
        // For real unit tests, you'd want to mock the fetch call
        const vulnerabilities = await scanner.scanNpmDependencies(tempDir);
        
        // Should not throw and return array
        assert.ok(Array.isArray(vulnerabilities));
    });

    test('Should return empty array when no requirements.txt exists', async () => {
        const vulnerabilities = await scanner.scanPipDependencies(tempDir);
        assert.strictEqual(vulnerabilities.length, 0);
    });

    test('Should parse requirements.txt', async () => {
        const requirements = `flask==2.0.0
requests==2.26.0
django==3.2.0
`;
        fs.writeFileSync(
            path.join(tempDir, 'requirements.txt'),
            requirements
        );

        const vulnerabilities = await scanner.scanPipDependencies(tempDir);
        
        // Should not throw and return array
        assert.ok(Array.isArray(vulnerabilities));
    });

    test('Should cache results and use cached data', async () => {
        const packageJson = {
            name: 'test-cache',
            version: '1.0.0',
            dependencies: { 'express': '^4.17.1' }
        };

        fs.writeFileSync(
            path.join(tempDir, 'package.json'),
            JSON.stringify(packageJson, null, 2)
        );

        // First scan
        const firstScan = await scanner.scanNpmDependencies(tempDir);
        
        // Second scan should use cache (faster)
        const startTime = Date.now();
        const secondScan = await scanner.scanNpmDependencies(tempDir);
        const duration = Date.now() - startTime;

        // Cached result should be nearly instant
        assert.ok(duration < 100, 'Cache should return results quickly');
        assert.deepStrictEqual(firstScan, secondScan);
    });
});
