import * as vscode from 'vscode';

interface StaticRule {
    pattern: RegExp;
    message: string;
    severity: string;
    category: string;
    cwe: string;
    fix: string;
}

/**
 * Fast static analysis using regex patterns for common vulnerabilities
 * Reduces LLM API calls for obvious issues
 */
export class StaticAnalyzer {
    private rules: StaticRule[] = [
        // JavaScript/TypeScript patterns
        {
            pattern: /eval\s*\(/gi,
            message: "Use of eval() is dangerous - enables arbitrary code execution",
            severity: "critical",
            category: "Code Injection",
            cwe: "CWE-95",
            fix: "Use JSON.parse() for JSON strings or other safe alternatives"
        },
        {
            pattern: /innerHTML\s*=\s*[^"'\s]+/gi,
            message: "Direct innerHTML assignment can lead to XSS vulnerabilities",
            severity: "high",
            category: "Cross-Site Scripting (XSS)",
            cwe: "CWE-79",
            fix: "Use textContent or DOMPurify.sanitize() for user input"
        },
        {
            pattern: /document\.write\s*\(/gi,
            message: "document.write() is deprecated and can cause XSS",
            severity: "high",
            category: "Cross-Site Scripting (XSS)",
            cwe: "CWE-79",
            fix: "Use modern DOM manipulation methods like appendChild()"
        },
        {
            pattern: /dangerouslySetInnerHTML/gi,
            message: "dangerouslySetInnerHTML can introduce XSS vulnerabilities",
            severity: "high",
            category: "Cross-Site Scripting (XSS)",
            cwe: "CWE-79",
            fix: "Sanitize content or use safe React rendering methods"
        },
        // Python patterns
        {
            pattern: /exec\s*\(/gi,
            message: "Use of exec() allows arbitrary code execution",
            severity: "critical",
            category: "Code Injection",
            cwe: "CWE-94",
            fix: "Avoid exec(). Use safe alternatives or sandboxed environments"
        },
        {
            pattern: /pickle\.loads?\s*\(/gi,
            message: "Pickle deserialization can execute arbitrary code",
            severity: "critical",
            category: "Insecure Deserialization",
            cwe: "CWE-502",
            fix: "Use JSON or other safe serialization formats"
        },
        {
            pattern: /yaml\.load\s*\(/gi,
            message: "yaml.load() is unsafe - allows arbitrary code execution",
            severity: "critical",
            category: "Insecure Deserialization",
            cwe: "CWE-502",
            fix: "Use yaml.safe_load() instead"
        },
        // SQL Injection patterns
        {
            pattern: /execute\s*\(\s*["'`].*\s*\+\s*/gi,
            message: "SQL query concatenation detected - possible SQL injection",
            severity: "critical",
            category: "SQL Injection",
            cwe: "CWE-89",
            fix: "Use parameterized queries or prepared statements"
        },
        {
            pattern: /query\s*\(\s*["'`].*\s*\+\s*/gi,
            message: "SQL query concatenation detected - possible SQL injection",
            severity: "critical",
            category: "SQL Injection",
            cwe: "CWE-89",
            fix: "Use parameterized queries or ORM methods"
        },
        {
            pattern: /\$\{.*\}.*(?:SELECT|INSERT|UPDATE|DELETE)/gi,
            message: "Template literal in SQL query - possible injection",
            severity: "critical",
            category: "SQL Injection",
            cwe: "CWE-89",
            fix: "Use parameterized queries"
        },
        // Secrets detection
        {
            pattern: /(?:api[_-]?key|apikey|access[_-]?token)\s*[=:]\s*["'][a-zA-Z0-9_\-]{20,}["']/gi,
            message: "Hardcoded API key or access token detected",
            severity: "critical",
            category: "Secret Exposure",
            cwe: "CWE-798",
            fix: "Move secrets to environment variables or secure vault"
        },
        {
            pattern: /(?:password|passwd|pwd)\s*[=:]\s*["'][^"']+["']/gi,
            message: "Hardcoded password detected",
            severity: "critical",
            category: "Secret Exposure",
            cwe: "CWE-798",
            fix: "Use environment variables or secure credential management"
        },
        {
            pattern: /(?:private[_-]?key|secret[_-]?key)\s*[=:]\s*["'][^"']+["']/gi,
            message: "Hardcoded private/secret key detected",
            severity: "critical",
            category: "Secret Exposure",
            cwe: "CWE-798",
            fix: "Use secure key management service"
        },
        // Command Injection
        {
            pattern: /(?:exec|system|spawn|shell)\s*\([^)]*\+/gi,
            message: "Command concatenation detected - possible command injection",
            severity: "critical",
            category: "Command Injection",
            cwe: "CWE-78",
            fix: "Use array arguments instead of string concatenation"
        },
        {
            pattern: /os\.popen\s*\(/gi,
            message: "os.popen() vulnerable to command injection",
            severity: "critical",
            category: "Command Injection",
            cwe: "CWE-78",
            fix: "Use subprocess.run() with shell=False"
        },
        // Weak crypto
        {
            pattern: /md5|sha1(?![-_]?256)/gi,
            message: "Weak cryptographic hash function detected",
            severity: "medium",
            category: "Weak Cryptography",
            cwe: "CWE-327",
            fix: "Use SHA-256 or stronger hashing algorithms"
        },
        {
            pattern: /Math\.random\(\)/gi,
            message: "Math.random() is not cryptographically secure",
            severity: "medium",
            category: "Weak Random",
            cwe: "CWE-338",
            fix: "Use crypto.randomBytes() for security purposes"
        },
        // Path Traversal
        {
            pattern: /(?:open|readFile|readFileSync)\s*\([^)]*\+.*["']\.\.["']/gi,
            message: "Path traversal vulnerability - user input in file path",
            severity: "high",
            category: "Path Traversal",
            cwe: "CWE-22",
            fix: "Validate and sanitize file paths, use path.resolve()"
        },
        // SSRF
        {
            pattern: /(?:fetch|axios|request)\s*\([^)]*\+/gi,
            message: "Potential SSRF - user input in URL",
            severity: "high",
            category: "Server-Side Request Forgery (SSRF)",
            cwe: "CWE-918",
            fix: "Validate URLs against whitelist"
        },
        // XXE
        {
            pattern: /new\s+(?:DOMParser|XMLHttpRequest)\s*\(/gi,
            message: "XML parsing without disabling external entities",
            severity: "high",
            category: "XML External Entity (XXE)",
            cwe: "CWE-611",
            fix: "Disable external entity processing"
        },
        // Regex DoS
        {
            pattern: /new\s+RegExp\s*\([^)]*\+/gi,
            message: "Dynamic regex from user input - ReDoS risk",
            severity: "medium",
            category: "ReDoS (Regular Expression Denial of Service)",
            cwe: "CWE-1333",
            fix: "Avoid user-controlled regex patterns"
        },
        // Prototype Pollution
        {
            pattern: /\[.*\]\s*=\s*.*req\.(?:body|query|params)/gi,
            message: "Prototype pollution risk - unchecked property assignment",
            severity: "high",
            category: "Prototype Pollution",
            cwe: "CWE-1321",
            fix: "Validate object keys, use Map instead of objects"
        },
        // CSRF
        {
            pattern: /app\.(?:post|put|delete|patch)\s*\([^)]*\)\s*(?!.*csrf)/gi,
            message: "State-changing endpoint without CSRF protection",
            severity: "medium",
            category: "Cross-Site Request Forgery (CSRF)",
            cwe: "CWE-352",
            fix: "Add CSRF token validation"
        },
        // Open Redirect
        {
            pattern: /(?:redirect|location\.href)\s*=\s*req\.(?:query|params)/gi,
            message: "Open redirect vulnerability - unvalidated redirect",
            severity: "medium",
            category: "Open Redirect",
            cwe: "CWE-601",
            fix: "Validate redirect URLs against whitelist"
        },
        // Java patterns
        {
            pattern: /Runtime\.getRuntime\(\)\.exec/gi,
            message: "Runtime.exec() vulnerable to command injection",
            severity: "critical",
            category: "Command Injection",
            cwe: "CWE-78",
            fix: "Use ProcessBuilder with proper argument handling"
        },
        {
            pattern: /new\s+ObjectInputStream\s*\(/gi,
            message: "Java deserialization vulnerability",
            severity: "critical",
            category: "Insecure Deserialization",
            cwe: "CWE-502",
            fix: "Validate serialized data or use safe alternatives"
        },
        // Go patterns
        {
            pattern: /exec\.Command\s*\([^)]*\+/gi,
            message: "Go command injection risk",
            severity: "critical",
            category: "Command Injection",
            cwe: "CWE-78",
            fix: "Pass arguments separately, not concatenated"
        },
        // Ruby patterns
        {
            pattern: /system\s*\([^)]*\+/gi,
            message: "Ruby system() call with concatenation - command injection",
            severity: "critical",
            category: "Command Injection",
            cwe: "CWE-78",
            fix: "Use array syntax or Open3.capture3"
        },
        {
            pattern: /Marshal\.load/gi,
            message: "Marshal.load can execute arbitrary code",
            severity: "critical",
            category: "Insecure Deserialization",
            cwe: "CWE-502",
            fix: "Use JSON or other safe serialization"
        },
        // PHP patterns
        {
            pattern: /\$_(GET|POST|REQUEST|COOKIE)\s*\[[^\]]+\]\s*;?\s*$/gm,
            message: "Unvalidated user input - potential injection",
            severity: "high",
            category: "Injection",
            cwe: "CWE-20",
            fix: "Validate and sanitize all user input"
        },
        {
            pattern: /mysql_query\s*\(/gi,
            message: "Deprecated mysql_query() function - SQL injection risk",
            severity: "high",
            category: "SQL Injection",
            cwe: "CWE-89",
            fix: "Use PDO or MySQLi with prepared statements"
        },
        // C/C++ patterns
        {
            pattern: /strcpy\s*\(/gi,
            message: "strcpy() can cause buffer overflow",
            severity: "high",
            category: "Buffer Overflow",
            cwe: "CWE-120",
            fix: "Use strncpy() or safer alternatives"
        },
        {
            pattern: /gets\s*\(/gi,
            message: "gets() is unsafe - buffer overflow risk",
            severity: "critical",
            category: "Buffer Overflow",
            cwe: "CWE-120",
            fix: "Use fgets() instead"
        },
        // C#/.NET patterns
        {
            pattern: /new\s+Process\s*\(\).*\.Start\s*\([^)]*\+/gi,
            message: "Process.Start with string concatenation - command injection risk",
            severity: "critical",
            category: "Command Injection",
            cwe: "CWE-78",
            fix: "Use ProcessStartInfo with Arguments property"
        },
        {
            pattern: /SqlCommand\s*\([^)]*\+/gi,
            message: "SQL command with string concatenation - SQL injection",
            severity: "critical",
            category: "SQL Injection",
            cwe: "CWE-89",
            fix: "Use parameterized queries with SqlParameter"
        },
        {
            pattern: /ExecuteRaw(?:Sql)?\s*\([^)]*\+/gi,
            message: "Raw SQL execution with concatenation - SQL injection",
            severity: "critical",
            category: "SQL Injection",
            cwe: "CWE-89",
            fix: "Use parameterized queries or Entity Framework LINQ"
        },
        {
            pattern: /FromSqlRaw\s*\([^)]*\+/gi,
            message: "FromSqlRaw with concatenation - SQL injection risk",
            severity: "critical",
            category: "SQL Injection",
            cwe: "CWE-89",
            fix: "Use FromSqlRaw with parameters or FromSqlInterpolated"
        },
        {
            pattern: /BinaryFormatter\.Deserialize/gi,
            message: "BinaryFormatter deserialization is unsafe",
            severity: "critical",
            category: "Insecure Deserialization",
            cwe: "CWE-502",
            fix: "Use JSON serialization or DataContractSerializer with known types"
        },
        {
            pattern: /JavaScriptSerializer\.Deserialize/gi,
            message: "JavaScriptSerializer allows type confusion attacks",
            severity: "high",
            category: "Insecure Deserialization",
            cwe: "CWE-502",
            fix: "Use System.Text.Json or JSON.NET with TypeNameHandling.None"
        },
        {
            pattern: /new\s+XmlDocument\s*\(\)(?!.*XmlResolver\s*=\s*null)/gi,
            message: "XmlDocument without disabling XmlResolver - XXE vulnerability",
            severity: "high",
            category: "XML External Entity (XXE)",
            cwe: "CWE-611",
            fix: "Set XmlResolver = null before loading XML"
        },
        {
            pattern: /Request\.QueryString\[[^\]]+\](?!.*Encode|.*Sanitize)/gi,
            message: "Unvalidated QueryString parameter - XSS/injection risk",
            severity: "high",
            category: "Cross-Site Scripting (XSS)",
            cwe: "CWE-79",
            fix: "Use HttpUtility.HtmlEncode() or validate input"
        },
        {
            pattern: /Request\.Form\[[^\]]+\](?!.*Encode|.*Sanitize)/gi,
            message: "Unvalidated Form parameter - XSS/injection risk",
            severity: "high",
            category: "Cross-Site Scripting (XSS)",
            cwe: "CWE-79",
            fix: "Validate and encode all user input"
        },
        {
            pattern: /InnerHtml\s*=/gi,
            message: "InnerHtml assignment can lead to XSS",
            severity: "high",
            category: "Cross-Site Scripting (XSS)",
            cwe: "CWE-79",
            fix: "Use InnerText or HtmlEncode the content"
        },
        {
            pattern: /Response\.Write\s*\([^)]*Request\./gi,
            message: "Response.Write with user input - XSS vulnerability",
            severity: "high",
            category: "Cross-Site Scripting (XSS)",
            cwe: "CWE-79",
            fix: "Use HtmlEncode before writing user input"
        },
        {
            pattern: /ValidateRequest\s*=\s*false/gi,
            message: "Request validation disabled - removes XSS protection",
            severity: "high",
            category: "Security Misconfiguration",
            cwe: "CWE-16",
            fix: "Keep request validation enabled or use AllowHtml attribute selectively"
        },
        {
            pattern: /customErrors\s+mode\s*=\s*"Off"/gi,
            message: "Custom errors disabled - exposes sensitive information",
            severity: "medium",
            category: "Security Misconfiguration",
            cwe: "CWE-209",
            fix: "Set customErrors mode to 'RemoteOnly' or 'On' in production"
        },
        {
            pattern: /FormsAuthentication\.HashPasswordForStoringInConfigFile/gi,
            message: "Deprecated hash function - uses weak MD5/SHA1",
            severity: "high",
            category: "Weak Cryptography",
            cwe: "CWE-327",
            fix: "Use PasswordHasher or PBKDF2"
        },
        {
            pattern: /new\s+MD5CryptoServiceProvider/gi,
            message: "MD5 is cryptographically broken",
            severity: "medium",
            category: "Weak Cryptography",
            cwe: "CWE-327",
            fix: "Use SHA256 or stronger algorithms"
        },
        {
            pattern: /new\s+SHA1CryptoServiceProvider/gi,
            message: "SHA1 is deprecated and weak",
            severity: "medium",
            category: "Weak Cryptography",
            cwe: "CWE-327",
            fix: "Use SHA256 or SHA512"
        },
        {
            pattern: /Random\s*\(\).*\.Next/gi,
            message: "System.Random is not cryptographically secure",
            severity: "medium",
            category: "Weak Random",
            cwe: "CWE-338",
            fix: "Use RNGCryptoServiceProvider or RandomNumberGenerator"
        },
        {
            pattern: /Path\.Combine\s*\([^)]*Request\./gi,
            message: "Path.Combine with user input - path traversal risk",
            severity: "high",
            category: "Path Traversal",
            cwe: "CWE-22",
            fix: "Validate and sanitize file paths, check for '..' sequences"
        },
        {
            pattern: /File\.(?:Open|Read|Write|Delete)\s*\([^)]*Request\./gi,
            message: "File operation with user input - path traversal vulnerability",
            severity: "high",
            category: "Path Traversal",
            cwe: "CWE-22",
            fix: "Validate file paths against whitelist"
        },
        {
            pattern: /WebClient\.Download(?:String|Data|File)\s*\([^)]*Request\./gi,
            message: "WebClient with user-controlled URL - SSRF vulnerability",
            severity: "high",
            category: "Server-Side Request Forgery (SSRF)",
            cwe: "CWE-918",
            fix: "Validate URLs against whitelist of allowed domains"
        },
        {
            pattern: /\.Eval\s*\(/gi,
            message: "Dynamic code evaluation - code injection risk",
            severity: "critical",
            category: "Code Injection",
            cwe: "CWE-94",
            fix: "Avoid Eval(); use strongly-typed alternatives"
        },
        {
            pattern: /CSharpCodeProvider\.CompileAssemblyFromSource/gi,
            message: "Dynamic code compilation from untrusted source",
            severity: "critical",
            category: "Code Injection",
            cwe: "CWE-94",
            fix: "Never compile user-provided code"
        },
        {
            pattern: /RequireHttps\s*=\s*false/gi,
            message: "HTTPS requirement disabled - data transmitted in clear text",
            severity: "medium",
            category: "Missing Encryption",
            cwe: "CWE-311",
            fix: "Enable RequireHttps and use HSTS"
        },
        {
            pattern: /\[AllowAnonymous\]/gi,
            message: "AllowAnonymous attribute - verify authorization is not needed",
            severity: "low",
            category: "Missing Authorization",
            cwe: "CWE-862",
            fix: "Review if anonymous access is intentional"
        }
    ];

    /**
     * Scan code using static pattern matching
     * Returns vulnerabilities found by pattern matching
     */
    scan(document: vscode.TextDocument): any[] {
        const text = document.getText();
        const lines = text.split('\n');
        const vulnerabilities: any[] = [];

        this.rules.forEach(rule => {
            let match;
            rule.pattern.lastIndex = 0; // Reset regex state
            
            while ((match = rule.pattern.exec(text)) !== null) {
                const position = document.positionAt(match.index);
                const lineNumber = position.line + 1;
                const lineText = lines[position.line];

                // Check if line is commented out
                if (this.isCommented(lineText, document.languageId)) {
                    continue;
                }

                vulnerabilities.push({
                    line: lineNumber,
                    message: rule.message,
                    severity: rule.severity,
                    category: rule.category,
                    cwe: rule.cwe,
                    fix: rule.fix,
                    title: rule.message,
                    score: this.severityToScore(rule.severity),
                    snippet: lineText.trim()
                });
            }
        });

        return vulnerabilities;
    }

    /**
     * Check if a line is commented out
     */
    private isCommented(line: string, languageId: string): boolean {
        const trimmed = line.trim();
        
        if (languageId === 'python' || languageId === 'ruby' || languageId === 'perl') {
            return trimmed.startsWith('#');
        } else if (['javascript', 'typescript', 'java', 'go', 'cpp', 'c', 'rust', 'csharp', 'swift', 'kotlin', 'php'].includes(languageId)) {
            return trimmed.startsWith('//') || trimmed.startsWith('/*');
        } else if (languageId === 'html' || languageId === 'xml') {
            return trimmed.startsWith('<!--');
        }
        
        return false;
    }

    /**
     * Convert severity to numeric score
     */
    private severityToScore(severity: string): number {
        const scores: { [key: string]: number } = {
            critical: 9.0,
            high: 7.5,
            medium: 5.0,
            low: 2.5
        };
        return scores[severity] || 5.0;
    }

    /**
     * Check if static analysis should be used based on file type
     */
    shouldUseStaticAnalysis(document: vscode.TextDocument): boolean {
        const supportedLanguages = ['javascript', 'typescript', 'python', 'java', 'go', 'php'];
        return supportedLanguages.includes(document.languageId);
    }
}
