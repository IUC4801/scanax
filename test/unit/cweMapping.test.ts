import * as assert from 'assert';
import { 
    CWE_MAPPINGS, 
    getCWEMapping, 
    getOWASPTop10Categories,
    generateComplianceReport 
} from '../../src/scanner/cweMapping';

suite('CWE Mapping Test Suite', () => {

    test('Should have SQL Injection mapping', () => {
        const mapping = CWE_MAPPINGS['SQL Injection'];
        assert.ok(mapping);
        assert.strictEqual(mapping.cwe, 'CWE-89');
        assert.strictEqual(mapping.severity, 'CRITICAL');
        assert.strictEqual(mapping.owaspTop10, 'A03:2021');
    });

    test('Should have XSS mapping', () => {
        const mapping = CWE_MAPPINGS['Cross-Site Scripting (XSS)'];
        assert.ok(mapping);
        assert.strictEqual(mapping.cwe, 'CWE-79');
        assert.strictEqual(mapping.severity, 'HIGH');
    });

    test('Should have Command Injection mapping', () => {
        const mapping = CWE_MAPPINGS['Command Injection'];
        assert.ok(mapping);
        assert.strictEqual(mapping.cwe, 'CWE-78');
        assert.strictEqual(mapping.severity, 'CRITICAL');
    });

    test('getCWEMapping should return correct mapping', () => {
        const mapping = getCWEMapping('SQL Injection');
        assert.ok(mapping);
        assert.strictEqual(mapping?.cwe, 'CWE-89');
    });

    test('getCWEMapping should return null for unknown type', () => {
        const mapping = getCWEMapping('NonexistentVulnerability');
        assert.strictEqual(mapping, null);
    });

    test('getOWASPTop10Categories should return map', () => {
        const categories = getOWASPTop10Categories();
        assert.ok(categories instanceof Map);
        assert.ok(categories.size > 0);
        
        // Check for known OWASP category
        const injectionVulns = categories.get('A03:2021 - Injection');
        assert.ok(injectionVulns);
        assert.ok(injectionVulns.includes('SQL Injection'));
    });

    test('generateComplianceReport should categorize vulnerabilities', () => {
        const vulnerabilities = [
            { type: 'SQL Injection' },
            { type: 'Cross-Site Scripting (XSS)' },
            { type: 'SQL Injection' }, // Duplicate
            { type: 'Weak Cryptography' }
        ];

        const report = generateComplianceReport(vulnerabilities);
        
        assert.ok(report.owaspTop10);
        assert.ok(report.cweCoverage);
        assert.ok(report.severityDistribution);
        
        // Should have mappings
        assert.ok(report.owaspTop10 instanceof Map);
    });

    test('Should have mappings for common vulnerabilities', () => {
        const commonVulns = [
            'SQL Injection',
            'Cross-Site Scripting (XSS)',
            'Command Injection',
            'Path Traversal',
            'SSRF',
            'XXE',
            'Insecure Deserialization',
            'Weak Cryptography',
            'Secret Exposure'
        ];

        commonVulns.forEach(vuln => {
            const mapping = CWE_MAPPINGS[vuln];
            assert.ok(mapping, `Missing mapping for ${vuln}`);
            assert.ok(mapping.cwe);
            assert.ok(mapping.severity);
        });
    });

    test('All mappings should have required fields', () => {
        Object.entries(CWE_MAPPINGS).forEach(([key, value]) => {
            assert.ok(value.cwe, `${key} missing CWE`);
            assert.ok(value.cweName, `${key} missing CWE name`);
            assert.ok(value.severity, `${key} missing severity`);
            assert.ok(value.description, `${key} missing description`);
        });
    });
});
