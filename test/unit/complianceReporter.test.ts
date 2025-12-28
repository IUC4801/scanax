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
        assert.ok(report.cweCategories);
        assert.ok(report.pcidss);
        assert.ok(report.soc2);
    });

    test('Should count vulnerabilities by severity', () => {
        const vulnerabilities = [
            { type: 'SQL Injection', severity: 'critical' },
            { type: 'SQL Injection', severity: 'critical' },
            { type: 'XSS', severity: 'high' },
            { type: 'Info Leak', severity: 'low' }
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
        const injectionCategory = report.owaspTop10.find(c => 
            c.category.includes('Injection')
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
        
        assert.ok(report.cweCategories.length > 0);
        const cwe89 = report.cweCategories.find(c => c.id === 'CWE-89');
        assert.ok(cwe89);
    });

    test('Should generate PCI-DSS compliance info', () => {
        const vulnerabilities = [
            { type: 'SQL Injection', severity: 'critical' },
            { type: 'Weak Cryptography', severity: 'high' }
        ];

        const report = reporter.generateReport(vulnerabilities as any);
        
        assert.ok(report.pcidss);
        assert.ok(typeof report.pcidss.compliant === 'boolean');
        assert.ok(report.pcidss.requirements);
        assert.ok(report.pcidss.requirements.length > 0);
    });

    test('Should generate SOC 2 compliance info', () => {
        const vulnerabilities = [
            { type: 'SQL Injection', severity: 'critical' }
        ];

        const report = reporter.generateReport(vulnerabilities as any);
        
        assert.ok(report.soc2);
        assert.ok(report.soc2.trustPrinciples);
        assert.ok(report.soc2.trustPrinciples.length > 0);
    });

    test('Should handle empty vulnerability list', () => {
        const report = reporter.generateReport([]);
        
        assert.ok(report);
        assert.strictEqual(report.summary.totalVulnerabilities, 0);
        assert.strictEqual(report.summary.criticalCount, 0);
        assert.ok(report.pcidss.compliant === true);
    });

    test('Should generate formatted report text', () => {
        const vulnerabilities = [
            { type: 'SQL Injection', severity: 'critical' },
            { type: 'XSS', severity: 'high' }
        ];

        const reportText = reporter.generateFormattedReport(vulnerabilities as any);
        
        assert.ok(reportText);
        assert.ok(reportText.includes('Compliance Report'));
        assert.ok(reportText.includes('OWASP'));
        assert.ok(reportText.includes('CWE'));
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

    test('Should mark non-compliant when critical vulns exist', () => {
        const vulnerabilities = [
            { type: 'SQL Injection', severity: 'critical' },
            { type: 'Command Injection', severity: 'critical' }
        ];

        const report = reporter.generateReport(vulnerabilities as any);
        
        assert.strictEqual(report.pcidss.compliant, false);
        assert.ok(report.summary.criticalCount > 0);
    });
});
