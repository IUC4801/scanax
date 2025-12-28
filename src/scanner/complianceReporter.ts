import * as vscode from 'vscode';
import { getCWEMapping, generateComplianceReport, VulnerabilityClassification } from './cweMapping';

export interface ComplianceReport {
    summary: {
        totalVulnerabilities: number;
        criticalCount: number;
        highCount: number;
        mediumCount: number;
        lowCount: number;
    };
    owaspTop10: OwaspCategory[];
    cweCoverage: CweCategory[];
    recommendations: string[];
    complianceScore: number;
}

export interface OwaspCategory {
    id: string;
    name: string;
    count: number;
    percentage: number;
    vulnerabilities: string[];
}

export interface CweCategory {
    cwe: string;
    name: string;
    count: number;
    severity: string;
}

/**
 * Generate compliance reports for security standards
 * Maps vulnerabilities to OWASP Top 10, CWE, PCI-DSS, SOC 2
 */
export class ComplianceReporter {
    /**
     * Generate full compliance report
     */
    generateReport(vulnerabilities: any[]): ComplianceReport {
        const summary = this.generateSummary(vulnerabilities);
        const owaspTop10 = this.mapToOwaspTop10(vulnerabilities);
        const cweCoverage = this.mapToCWE(vulnerabilities);
        const recommendations = this.generateRecommendations(vulnerabilities);
        const complianceScore = this.calculateComplianceScore(summary, owaspTop10);

        return {
            summary,
            owaspTop10,
            cweCoverage,
            recommendations,
            complianceScore
        };
    }

    /**
     * Generate vulnerability summary
     */
    private generateSummary(vulnerabilities: any[]): ComplianceReport['summary'] {
        const summary = {
            totalVulnerabilities: vulnerabilities.length,
            criticalCount: 0,
            highCount: 0,
            mediumCount: 0,
            lowCount: 0
        };

        vulnerabilities.forEach(vuln => {
            const classification = getCWEMapping(vuln.category || vuln.type);
            if (classification) {
                switch (classification.severity) {
                    case 'CRITICAL': summary.criticalCount++; break;
                    case 'HIGH': summary.highCount++; break;
                    case 'MEDIUM': summary.mediumCount++; break;
                    case 'LOW': summary.lowCount++; break;
                }
            } else {
                summary.mediumCount++; // Default
            }
        });

        return summary;
    }

    /**
     * Map vulnerabilities to OWASP Top 10 2021
     */
    private mapToOwaspTop10(vulnerabilities: any[]): OwaspCategory[] {
        const owaspMap = new Map<string, { name: string; vulns: string[] }>();
        
        // OWASP Top 10 2021 categories
        const categories = {
            'A01:2021': 'Broken Access Control',
            'A02:2021': 'Cryptographic Failures',
            'A03:2021': 'Injection',
            'A04:2021': 'Insecure Design',
            'A05:2021': 'Security Misconfiguration',
            'A06:2021': 'Vulnerable and Outdated Components',
            'A07:2021': 'Identification and Authentication Failures',
            'A08:2021': 'Software and Data Integrity Failures',
            'A09:2021': 'Security Logging and Monitoring Failures',
            'A10:2021': 'Server-Side Request Forgery'
        };

        // Initialize all categories
        for (const [id, name] of Object.entries(categories)) {
            owaspMap.set(id, { name, vulns: [] });
        }

        // Map vulnerabilities
        vulnerabilities.forEach(vuln => {
            const classification = getCWEMapping(vuln.category || vuln.type);
            if (classification && classification.owaspTop10) {
                const category = owaspMap.get(classification.owaspTop10);
                if (category) {
                    category.vulns.push(vuln.message || vuln.title);
                }
            }
        });

        // Convert to array and calculate percentages
        const total = vulnerabilities.length;
        return Array.from(owaspMap.entries())
            .map(([id, data]) => ({
                id,
                name: data.name,
                count: data.vulns.length,
                percentage: total > 0 ? Math.round((data.vulns.length / total) * 100) : 0,
                vulnerabilities: data.vulns
            }))
            .filter(cat => cat.count > 0)
            .sort((a, b) => b.count - a.count);
    }

    /**
     * Map vulnerabilities to CWE categories
     */
    private mapToCWE(vulnerabilities: any[]): CweCategory[] {
        const cweMap = new Map<string, { name: string; severity: string; count: number }>();

        vulnerabilities.forEach(vuln => {
            const classification = getCWEMapping(vuln.category || vuln.type);
            if (classification) {
                const existing = cweMap.get(classification.cwe);
                if (existing) {
                    existing.count++;
                } else {
                    cweMap.set(classification.cwe, {
                        name: classification.cweName,
                        severity: classification.severity,
                        count: 1
                    });
                }
            }
        });

        return Array.from(cweMap.entries())
            .map(([cwe, data]) => ({
                cwe,
                name: data.name,
                count: data.count,
                severity: data.severity
            }))
            .sort((a, b) => b.count - a.count);
    }

    /**
     * Generate recommendations based on findings
     */
    private generateRecommendations(vulnerabilities: any[]): string[] {
        const recommendations: string[] = [];
        const categories = new Set(vulnerabilities.map(v => v.category || v.type));

        // Generic recommendations based on what was found
        if (categories.has('SQL Injection')) {
            recommendations.push('⚠️ Implement parameterized queries across all database operations');
        }
        if (categories.has('Cross-Site Scripting (XSS)')) {
            recommendations.push('⚠️ Enable Content Security Policy (CSP) headers');
            recommendations.push('⚠️ Sanitize all user input before rendering');
        }
        if (categories.has('Secret Exposure')) {
            recommendations.push('⚠️ Move all secrets to environment variables or secret management service');
            recommendations.push('⚠️ Scan git history for exposed secrets (use git-secrets or similar)');
        }
        if (categories.has('Command Injection')) {
            recommendations.push('⚠️ Avoid shell execution of user input; use safe alternatives');
        }
        if (categories.has('Weak Cryptography')) {
            recommendations.push('⚠️ Upgrade to SHA-256 or stronger cryptographic algorithms');
        }
        if (categories.has('Path Traversal')) {
            recommendations.push('⚠️ Validate and sanitize all file paths; use path.resolve()');
        }

        // Compliance-specific recommendations
        const summary = this.generateSummary(vulnerabilities);
        if (summary.criticalCount > 0) {
            recommendations.push('🔴 CRITICAL: Address all critical vulnerabilities immediately');
        }
        if (summary.highCount > 5) {
            recommendations.push('🟠 HIGH: Prioritize high-severity vulnerabilities in next sprint');
        }

        // PCI-DSS recommendations
        if (categories.has('Secret Exposure') || categories.has('Weak Cryptography')) {
            recommendations.push('💳 PCI-DSS: Requirement 3 & 4 - Protect cardholder data with strong encryption');
        }

        // SOC 2 recommendations
        if (categories.has('Missing Authorization')) {
            recommendations.push('🔐 SOC 2: CC6.1 - Implement proper access controls and authorization checks');
        }
        if (vulnerabilities.length > 0) {
            recommendations.push('📊 SOC 2: CC7.1 - Document vulnerability management process');
        }

        return recommendations;
    }

    /**
     * Calculate overall compliance score (0-100)
     */
    private calculateComplianceScore(
        summary: ComplianceReport['summary'],
        owaspTop10: OwaspCategory[]
    ): number {
        let score = 100;

        // Deduct points for vulnerabilities
        score -= summary.criticalCount * 15;
        score -= summary.highCount * 8;
        score -= summary.mediumCount * 3;
        score -= summary.lowCount * 1;

        // Bonus for low OWASP coverage (fewer categories affected is better)
        if (owaspTop10.length <= 2) {
            score += 10;
        }

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Generate HTML report
     */
    generateHtmlReport(report: ComplianceReport): string {
        const gradeColor = report.complianceScore >= 80 ? '#4CAF50' : 
                          report.complianceScore >= 60 ? '#FFC107' : '#F44336';
        const grade = report.complianceScore >= 90 ? 'A' :
                     report.complianceScore >= 80 ? 'B' :
                     report.complianceScore >= 70 ? 'C' :
                     report.complianceScore >= 60 ? 'D' : 'F';

        return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #1e1e1e; color: #d4d4d4; }
        .header { text-align: center; margin-bottom: 30px; }
        .score-circle { width: 150px; height: 150px; border-radius: 50%; 
                       background: ${gradeColor}; margin: 0 auto; 
                       display: flex; align-items: center; justify-content: center;
                       font-size: 48px; font-weight: bold; color: white; }
        .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
        .stat { background: #2d2d30; padding: 15px; border-radius: 8px; text-align: center; }
        .stat-value { font-size: 32px; font-weight: bold; }
        .critical { color: #ff6b6b; }
        .high { color: #ff9f43; }
        .medium { color: #ffd93d; }
        .low { color: #6bcf7f; }
        .owasp-list { list-style: none; padding: 0; }
        .owasp-item { background: #2d2d30; padding: 15px; margin: 10px 0; border-radius: 8px; }
        .cwe-badge { display: inline-block; background: #007acc; color: white; 
                     padding: 4px 8px; border-radius: 4px; margin: 2px; }
        .recommendations { background: #2d2d30; padding: 20px; border-radius: 8px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🛡️ Scanax Security Compliance Report</h1>
        <div class="score-circle">${grade}</div>
        <h2>Compliance Score: ${report.complianceScore}/100</h2>
    </div>

    <div class="summary">
        <div class="stat">
            <div class="stat-value">${report.summary.totalVulnerabilities}</div>
            <div>Total Vulnerabilities</div>
        </div>
        <div class="stat">
            <div class="stat-value critical">${report.summary.criticalCount}</div>
            <div>Critical</div>
        </div>
        <div class="stat">
            <div class="stat-value high">${report.summary.highCount}</div>
            <div>High</div>
        </div>
        <div class="stat">
            <div class="stat-value medium">${report.summary.mediumCount}</div>
            <div>Medium</div>
        </div>
    </div>

    <h2>📊 OWASP Top 10:2021 Breakdown</h2>
    <ul class="owasp-list">
        ${report.owaspTop10.map(cat => `
            <li class="owasp-item">
                <strong>${cat.id} - ${cat.name}</strong>
                <div>${cat.count} vulnerabilities (${cat.percentage}%)</div>
            </li>
        `).join('')}
    </ul>

    <h2>🔖 CWE Coverage</h2>
    <div>
        ${report.cweCoverage.map(cwe => `
            <span class="cwe-badge">${cwe.cwe}: ${cwe.name} (${cwe.count})</span>
        `).join('')}
    </div>

    <div class="recommendations">
        <h2>💡 Recommendations</h2>
        ${report.recommendations.map(rec => `<p>${rec}</p>`).join('')}
    </div>

    <footer style="margin-top: 40px; text-align: center; color: #888;">
        <p>Generated by Scanax Security Scanner</p>
        <p>Standards: OWASP Top 10:2021 | CWE | PCI-DSS | SOC 2</p>
    </footer>
</body>
</html>
        `;
    }
}
