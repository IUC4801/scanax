import * as assert from 'assert';
import { ComplianceReporter } from '../../src/scanner/complianceReporter';

suite('ComplianceReporter Test Suite', () => {
    let reporter: ComplianceReporter;

    setup(() => {
        reporter = new ComplianceReporter();
    });

    test('Should generate report for vulnerabilities', () => {
        const vulnerabilities = [
            { type: 'SQL Injection', severity: 'critical' },
            { type: 'Cross-Site Scripting (XSS)', severity: 'high' },
            { type: 'Weak Cryptography', severity: 'medium' }
        ];

        const report = reporter.generateReport(vulnerabilities as any);
        
        assert.ok(report);
        assert.ok(report.summary);
        assert.ok(report.owaspTop10);
        assert.ok(report.cweCoverage);
    });

    test('Should count vulnerabilities by severity', () => {
        const vulnerabilities = [
            { type: 'SQL Injection', severity: 'critical' },
            { type: 'SQL Injection', severity: 'critical' },
            { type: 'Cross-Site Scripting (XSS)', severity: 'high' },
            { type: 'Missing Security Headers', severity: 'low' }
        ];

        const report = reporter.generateReport(vulnerabilities as any);
        
        assert.ok(report.summary.criticalCount >= 2);
        assert.ok(report.summary.highCount >= 1);
        assert.ok(report.summary.lowCount >= 1);
    });

    test('Should map to OWASP Top 10', () => {
        const vulnerabilities = [
            { type: 'SQL Injection', severity: 'critical' }
        ];

        const report = reporter.generateReport(vulnerabilities as any);
        
        assert.ok(report.owaspTop10.length > 0);
        const injectionCategory = report.owaspTop10.find((c: any) => 
            c.name && c.name.includes('Injection')
        );
        assert.ok(injectionCategory);
        assert.ok(injectionCategory.vulnerabilities.length > 0);
    });

    test('Should map to CWE categories', () => {
        const vulnerabilities = [
            { type: 'SQL Injection', severity: 'critical' },
            { type: 'Command Injection', severity: 'critical' }
        ];

        const report = reporter.generateReport(vulnerabilities as any);
        
        assert.ok(report.cweCoverage.length > 0);
        const cwe89 = report.cweCoverage.find((c: any) => c.cwe === 'CWE-89');
        assert.ok(cwe89);
    });

    test('Should count vulnerabilities by severity', () => {
        const vulnerabilities = [
            { type: 'SQL Injection', severity: 'critical' },
            { type: 'Cross-Site Scripting (XSS)', severity: 'high' }
        ];

        const report = reporter.generateReport(vulnerabilities as any);
        
        assert.ok(report.summary.criticalCount >= 1);
        assert.ok(report.summary.highCount >= 1);
    });

    test('Should calculate compliance score', () => {
        const vulnerabilities = [
            { type: 'SQL Injection', severity: 'critical' }
        ];

        const report = reporter.generateReport(vulnerabilities as any);
        
        assert.ok(typeof report.complianceScore === 'number');
        assert.ok(report.complianceScore >= 0 && report.complianceScore <= 100);
    });

    test('Should handle empty vulnerability list', () => {
        const report = reporter.generateReport([]);
        
        assert.ok(report);
        assert.strictEqual(report.summary.totalVulnerabilities, 0);
        assert.strictEqual(report.summary.criticalCount, 0);
    });

    test('Should have recommendations', () => {
        const vulnerabilities = [
            { type: 'SQL Injection', severity: 'critical' },
            { type: 'XSS', severity: 'high' }
        ];

        const report = reporter.generateReport(vulnerabilities as any);
        
        assert.ok(report.recommendations);
        assert.ok(Array.isArray(report.recommendations));
    });

    test('Should export report to JSON', () => {
        const vulnerabilities = [
            { type: 'SQL Injection', severity: 'critical' }
        ];

        const report = reporter.generateReport(vulnerabilities as any);
        const json = JSON.stringify(report);
        
        assert.ok(json);
        const parsed = JSON.parse(json);
        assert.ok(parsed.summary);
    });

    test('Should have lower compliance score with critical vulns', () => {
        const vulnerabilities = [
            { type: 'SQL Injection', severity: 'critical' },
            { type: 'Command Injection', severity: 'critical' }
        ];

        const report = reporter.generateReport(vulnerabilities as any);
        
        assert.ok(report.complianceScore < 100);
        assert.ok(report.summary.criticalCount > 0);
    });
});
