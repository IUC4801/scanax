/**
 * CWE (Common Weakness Enumeration) and CVE mapping for vulnerabilities
 * Maps vulnerability types to industry-standard classifications
 */

export interface VulnerabilityClassification {
    cwe: string;
    cweName: string;
    owaspTop10?: string;
    owaspCategory?: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    description: string;
}

export const CWE_MAPPINGS: Record<string, VulnerabilityClassification> = {
    // Injection Vulnerabilities
    'SQL Injection': {
        cwe: 'CWE-89',
        cweName: 'SQL Injection',
        owaspTop10: 'A03:2021',
        owaspCategory: 'Injection',
        severity: 'CRITICAL',
        description: 'Improper Neutralization of Special Elements used in an SQL Command'
    },
    'Command Injection': {
        cwe: 'CWE-78',
        cweName: 'OS Command Injection',
        owaspTop10: 'A03:2021',
        owaspCategory: 'Injection',
        severity: 'CRITICAL',
        description: 'Improper Neutralization of Special Elements used in an OS Command'
    },
    'Code Injection': {
        cwe: 'CWE-94',
        cweName: 'Code Injection',
        owaspTop10: 'A03:2021',
        owaspCategory: 'Injection',
        severity: 'CRITICAL',
        description: 'Improper Control of Generation of Code (Code Injection)'
    },
    'LDAP Injection': {
        cwe: 'CWE-90',
        cweName: 'LDAP Injection',
        owaspTop10: 'A03:2021',
        owaspCategory: 'Injection',
        severity: 'HIGH',
        description: 'Improper Neutralization of Special Elements used in an LDAP Query'
    },
    'XPath Injection': {
        cwe: 'CWE-643',
        cweName: 'XPath Injection',
        owaspTop10: 'A03:2021',
        owaspCategory: 'Injection',
        severity: 'HIGH',
        description: 'Improper Neutralization of Data within XPath Expressions'
    },

    // Cross-Site Scripting (XSS)
    'Cross-Site Scripting (XSS)': {
        cwe: 'CWE-79',
        cweName: 'Cross-site Scripting',
        owaspTop10: 'A03:2021',
        owaspCategory: 'Injection',
        severity: 'HIGH',
        description: 'Improper Neutralization of Input During Web Page Generation'
    },
    'DOM-based XSS': {
        cwe: 'CWE-79',
        cweName: 'Cross-site Scripting',
        owaspTop10: 'A03:2021',
        owaspCategory: 'Injection',
        severity: 'HIGH',
        description: 'Client-side XSS via DOM manipulation'
    },

    // Authentication & Session Management
    'Hardcoded Credentials': {
        cwe: 'CWE-798',
        cweName: 'Use of Hard-coded Credentials',
        owaspTop10: 'A07:2021',
        owaspCategory: 'Identification and Authentication Failures',
        severity: 'CRITICAL',
        description: 'Authentication credentials embedded in source code'
    },
    'Weak Password Requirements': {
        cwe: 'CWE-521',
        cweName: 'Weak Password Requirements',
        owaspTop10: 'A07:2021',
        owaspCategory: 'Identification and Authentication Failures',
        severity: 'MEDIUM',
        description: 'Insufficient password complexity requirements'
    },
    'Session Fixation': {
        cwe: 'CWE-384',
        cweName: 'Session Fixation',
        owaspTop10: 'A07:2021',
        owaspCategory: 'Identification and Authentication Failures',
        severity: 'HIGH',
        description: 'Session ID not regenerated after authentication'
    },

    // Sensitive Data Exposure
    'Secret Exposure': {
        cwe: 'CWE-798',
        cweName: 'Exposure of Sensitive Information',
        owaspTop10: 'A02:2021',
        owaspCategory: 'Cryptographic Failures',
        severity: 'CRITICAL',
        description: 'API keys, passwords, or secrets exposed in code'
    },
    'Sensitive Data in Logs': {
        cwe: 'CWE-532',
        cweName: 'Insertion of Sensitive Information into Log File',
        owaspTop10: 'A09:2021',
        owaspCategory: 'Security Logging and Monitoring Failures',
        severity: 'MEDIUM',
        description: 'Sensitive data written to application logs'
    },
    'Missing Encryption': {
        cwe: 'CWE-311',
        cweName: 'Missing Encryption of Sensitive Data',
        owaspTop10: 'A02:2021',
        owaspCategory: 'Cryptographic Failures',
        severity: 'HIGH',
        description: 'Sensitive data transmitted or stored without encryption'
    },

    // Access Control
    'Path Traversal': {
        cwe: 'CWE-22',
        cweName: 'Path Traversal',
        owaspTop10: 'A01:2021',
        owaspCategory: 'Broken Access Control',
        severity: 'HIGH',
        description: 'Improper Limitation of a Pathname to a Restricted Directory'
    },
    'Insecure Direct Object Reference': {
        cwe: 'CWE-639',
        cweName: 'Insecure Direct Object References',
        owaspTop10: 'A01:2021',
        owaspCategory: 'Broken Access Control',
        severity: 'HIGH',
        description: 'Authorization bypass through direct object reference'
    },
    'Missing Authorization': {
        cwe: 'CWE-862',
        cweName: 'Missing Authorization',
        owaspTop10: 'A01:2021',
        owaspCategory: 'Broken Access Control',
        severity: 'CRITICAL',
        description: 'No authorization check for sensitive operations'
    },

    // Cryptographic Issues
    'Weak Cryptographic Algorithm': {
        cwe: 'CWE-327',
        cweName: 'Use of a Broken or Risky Cryptographic Algorithm',
        owaspTop10: 'A02:2021',
        owaspCategory: 'Cryptographic Failures',
        severity: 'HIGH',
        description: 'Use of MD5, SHA1, or other weak algorithms'
    },
    'Weak Random Number Generator': {
        cwe: 'CWE-338',
        cweName: 'Use of Cryptographically Weak PRNG',
        owaspTop10: 'A02:2021',
        owaspCategory: 'Cryptographic Failures',
        severity: 'MEDIUM',
        description: 'Use of Math.random() or similar for security purposes'
    },

    // Security Misconfiguration
    'Debug Mode Enabled': {
        cwe: 'CWE-489',
        cweName: 'Active Debug Code',
        owaspTop10: 'A05:2021',
        owaspCategory: 'Security Misconfiguration',
        severity: 'MEDIUM',
        description: 'Debug mode or verbose error messages enabled in production'
    },
    'CORS Misconfiguration': {
        cwe: 'CWE-942',
        cweName: 'Permissive Cross-domain Policy',
        owaspTop10: 'A05:2021',
        owaspCategory: 'Security Misconfiguration',
        severity: 'MEDIUM',
        description: 'Overly permissive CORS policy allowing untrusted origins'
    },
    'Missing Security Headers': {
        cwe: 'CWE-16',
        cweName: 'Configuration',
        owaspTop10: 'A05:2021',
        owaspCategory: 'Security Misconfiguration',
        severity: 'LOW',
        description: 'Missing security headers like CSP, HSTS, X-Frame-Options'
    },

    // XML/XXE
    'XML External Entity (XXE)': {
        cwe: 'CWE-611',
        cweName: 'XML External Entity Reference',
        owaspTop10: 'A05:2021',
        owaspCategory: 'Security Misconfiguration',
        severity: 'HIGH',
        description: 'Improper Restriction of XML External Entity Reference'
    },

    // Deserialization
    'Insecure Deserialization': {
        cwe: 'CWE-502',
        cweName: 'Deserialization of Untrusted Data',
        owaspTop10: 'A08:2021',
        owaspCategory: 'Software and Data Integrity Failures',
        severity: 'CRITICAL',
        description: 'Deserialization of untrusted data without validation'
    },

    // SSRF
    'Server-Side Request Forgery (SSRF)': {
        cwe: 'CWE-918',
        cweName: 'Server-Side Request Forgery',
        owaspTop10: 'A10:2021',
        owaspCategory: 'Server-Side Request Forgery',
        severity: 'HIGH',
        description: 'Application fetches remote resources without validating URL'
    },

    // Resource Management
    'Resource Exhaustion': {
        cwe: 'CWE-400',
        cweName: 'Uncontrolled Resource Consumption',
        owaspTop10: 'A04:2021',
        owaspCategory: 'Insecure Design',
        severity: 'MEDIUM',
        description: 'No limits on resource consumption (DoS)'
    },
    'Memory Leak': {
        cwe: 'CWE-401',
        cweName: 'Memory Leak',
        owaspTop10: 'A04:2021',
        owaspCategory: 'Insecure Design',
        severity: 'MEDIUM',
        description: 'Improper release of memory resources'
    },

    // Regex Issues
    'ReDoS (Regular Expression Denial of Service)': {
        cwe: 'CWE-1333',
        cweName: 'Inefficient Regular Expression Complexity',
        owaspTop10: 'A04:2021',
        owaspCategory: 'Insecure Design',
        severity: 'MEDIUM',
        description: 'Catastrophic backtracking in regular expressions'
    },

    // Open Redirect
    'Open Redirect': {
        cwe: 'CWE-601',
        cweName: 'URL Redirection to Untrusted Site',
        owaspTop10: 'A01:2021',
        owaspCategory: 'Broken Access Control',
        severity: 'MEDIUM',
        description: 'Unvalidated redirects and forwards'
    },

    // Prototype Pollution
    'Prototype Pollution': {
        cwe: 'CWE-1321',
        cweName: 'Improperly Controlled Modification of Object Prototype',
        owaspTop10: 'A08:2021',
        owaspCategory: 'Software and Data Integrity Failures',
        severity: 'HIGH',
        description: 'Modification of Object.prototype via user input'
    },

    // CSRF
    'Cross-Site Request Forgery (CSRF)': {
        cwe: 'CWE-352',
        cweName: 'Cross-Site Request Forgery',
        owaspTop10: 'A01:2021',
        owaspCategory: 'Broken Access Control',
        severity: 'MEDIUM',
        description: 'Missing CSRF tokens on state-changing operations'
    }
};

/**
 * Get CWE classification for vulnerability type
 */
export function getCWEMapping(vulnerabilityType: string): VulnerabilityClassification | null {
    return CWE_MAPPINGS[vulnerabilityType] || null;
}

/**
 * Get all OWASP Top 10 categories with their vulnerabilities
 */
export function getOWASPTop10Categories(): Map<string, string[]> {
    const categories = new Map<string, string[]>();
    
    for (const [vulnType, classification] of Object.entries(CWE_MAPPINGS)) {
        if (classification.owaspTop10) {
            const key = `${classification.owaspTop10} - ${classification.owaspCategory}`;
            const existing = categories.get(key) || [];
            existing.push(vulnType);
            categories.set(key, existing);
        }
    }
    
    return categories;
}

/**
 * Generate compliance report
 */
export function generateComplianceReport(vulnerabilities: { type: string }[]): {
    owaspTop10: Map<string, number>;
    cweCoverage: Map<string, number>;
    severityDistribution: Map<string, number>;
} {
    const owaspTop10 = new Map<string, number>();
    const cweCoverage = new Map<string, number>();
    const severityDistribution = new Map<string, number>();

    for (const vuln of vulnerabilities) {
        const classification = getCWEMapping(vuln.type);
        if (classification) {
            // OWASP Top 10
            if (classification.owaspTop10) {
                const count = owaspTop10.get(classification.owaspTop10) || 0;
                owaspTop10.set(classification.owaspTop10, count + 1);
            }
            
            // CWE
            const cweCount = cweCoverage.get(classification.cwe) || 0;
            cweCoverage.set(classification.cwe, cweCount + 1);
            
            // Severity
            const sevCount = severityDistribution.get(classification.severity) || 0;
            severityDistribution.set(classification.severity, sevCount + 1);
        }
    }

    return { owaspTop10, cweCoverage, severityDistribution };
}
