import os
import json
import logging
import hashlib
import re
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
from dotenv import load_dotenv
from pydantic import BaseModel

# Load variables from .env
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ScanaxGroqOnly")

app = FastAPI(title="Scanax Professional Security (BYOK)")

# CORS configuration for remote deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your extension's origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# Configuration
# ============================================
GLOBAL_GROQ_KEY = os.getenv("GROQ_API_KEY")
if not GLOBAL_GROQ_KEY:
    raise ValueError("GROQ_API_KEY not found in .env file")

# Using Llama 3.1 8B for high-speed and strict instruction following
MODEL_ID = "llama-3.1-8b-instant"

# ============================================
# Data Models
# ============================================
class CodeAnalysisRequest(BaseModel):
    code: str
    user_key: str | None = None

class FixRequest(BaseModel):
    original_code: str
    vulnerability_description: str
    user_key: str | None = None
    vulnerability_line: int | None = None

class FixResponse(BaseModel):
    fixed_code: str
    explanation: str

class DependencyVulnerability(BaseModel):
    package: str
    version: str
    severity: str
    message: str
    cve: str | None = None
    recommendation: str | None = None

class DependencyScanResponse(BaseModel):
    vulnerabilities: list[DependencyVulnerability]
    scanned_files: list[str]

# ============================================
# Professional Prompts
# ============================================

# Note: Added 'json' to satisfy Groq's response_format requirements
SYSTEM_PROMPT_ANALYZE = """
ACT AS A STATIC ANALYSIS ENGINE (CODEQL STYLE).
Identify REAL security vulnerabilities with detailed information. Output the results in valid JSON format only.

IMPORTANT RULES:
1. ONLY report vulnerabilities that ACTUALLY EXIST in the provided code
2. Line numbers MUST correspond to actual lines in the code provided
3. DO NOT invent or hallucinate vulnerabilities
4. Report maximum 10 most critical vulnerabilities per analysis
5. Each vulnerability must be unique (no duplicates)

CRITICAL DETECTION AREAS:
- **Secrets & Credentials**: API keys, tokens, passwords, private keys, AWS credentials
- **PII Exposure**: SSN, credit cards, emails in logs, phone numbers
- **SQL Injection**: Unsanitized user input in SQL queries
- **Command Injection**: shell=True, eval(), exec(), os.system() with user input
- **XSS**: Unescaped user input in HTML/JavaScript
- **Path Traversal**: File operations without path validation
- **Insecure Deserialization**: pickle.loads(), yaml.load() without SafeLoader
- **Language-Specific Issues**:
  * Python: Django DEBUG=True, Flask secret_key exposure, pickle vulnerabilities
  * JavaScript/Node: Prototype pollution, npm package vulnerabilities, eval()
  * Go: Race conditions, unvalidated redirects
  * Java: XXE, LDAP injection, Log4Shell patterns
  * PHP: File inclusion, type juggling

Structure: 
{
  "errors": [
    {
      "line": int,
      "title": "Short, clear vulnerability title (e.g., 'SQL Injection Vulnerability', 'Exposed API Token')",
      "message": "One-line summary of what was detected",
      "description": "Concise explanation of the security issue and its potential impact (2-3 sentences max)",
      "category": "Category (e.g., Secret Exposure, SQL Injection, XSS, Command Injection, etc.)",
      "severity": "critical|high|medium|low",
      "score": float (0.0-10.0, CVSS-style score),
      "cwe": "CWE-XXX (Common Weakness Enumeration ID, e.g., CWE-89 for SQL Injection)",
      "recommendation": "Clear, actionable steps to fix (use numbered list: 1. ... 2. ... 3. ...)"
    }
  ]
}

CWE REFERENCE GUIDE:
- CWE-89: SQL Injection
- CWE-79: Cross-site Scripting (XSS)
- CWE-78: OS Command Injection
- CWE-22: Path Traversal
- CWE-798: Hardcoded Credentials
- CWE-327: Broken Cryptography
- CWE-502: Deserialization
- CWE-611: XXE
- CWE-601: Open Redirect
- CWE-307: Improper Authentication
- CWE-200: Information Exposure
- CWE-352: CSRF

RULES:
1. Keep descriptions concise and professional
2. Score should reflect actual risk (Critical: 9.0-10.0, High: 7.0-8.9, Medium: 4.0-6.9, Low: 0.1-3.9)
3. Recommendations must be specific and actionable
4. Use proper security terminology
5. Verify line numbers are valid before including in response
6. ALWAYS include appropriate CWE reference
7. Flag ANY hardcoded secrets, tokens, or credentials as CRITICAL
"""

SYSTEM_PROMPT_FIX = """
ACT AS A CODE SECURITY REMEDIATION ENGINE.
Your task is to fix a security vulnerability at a specific line WITHOUT introducing new vulnerabilities.

Output ONLY valid JSON with this structure:
{
  "fixed_code": "the corrected line(s) of code with proper indentation",
  "explanation": "brief explanation of what was fixed"
}

CRITICAL SECURITY RULES:
1. NEVER introduce new vulnerabilities (SQL injection, XSS, command injection, etc.)
2. Use parameterized queries, prepared statements, or safe APIs
3. Sanitize and validate all user input properly
4. Avoid dangerous functions (eval, exec, shell=True, etc.)
5. Preserve the original indentation exactly
6. Keep the fix minimal and focused - only fix the specific vulnerability
7. If imports are needed (like 'import html' for escaping), include them as comments

EXAMPLES OF SECURE FIXES:
- SQL: Use parameterized queries (cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,)))
- Command Injection: Use subprocess with list args and shell=False, or shlex.quote()
- XSS: Use html.escape() or framework-specific escaping
- Path Traversal: Use os.path.basename() or Path().resolve()
"""

# ============================================
# Endpoints
# ============================================

@app.post("/analyze")
async def analyze_code(request_obj: Request, body: CodeAnalysisRequest):
    if not body.code.strip():
        return {"errors": []}
    
    api_key = body.user_key if body.user_key else GLOBAL_GROQ_KEY
    try:
        # Count actual lines in the code
        code_lines = body.code.split('\n')
        total_lines = len(code_lines)
        
        groq_client = Groq(api_key=api_key)
        completion = groq_client.chat.completions.create(
            model=MODEL_ID,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT_ANALYZE},
                {"role": "user", "content": f"Analyze this code and return json results:\n{body.code}"}
            ],
            response_format={"type": "json_object"},
            temperature=0.0, 
        )
        result = json.loads(completion.choices[0].message.content)
        
        # Validate and filter results
        if "errors" in result:
            validated_errors = []
            seen = set()
            for error in result["errors"]:
                # Validate line number
                line = error.get("line", 0)
                if line < 1 or line > total_lines:
                    continue  # Skip invalid line numbers
                
                # Prevent duplicates (same line + message)
                key = (line, error.get("message", ""))
                if key in seen:
                    continue
                seen.add(key)
                
                validated_errors.append(error)
                
                # Limit to 10 vulnerabilities
                if len(validated_errors) >= 10:
                    break
            
            result["errors"] = validated_errors
        
        return result
    except Exception as e:
        logger.error(f"Analysis Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/fix", response_model=FixResponse)
async def fix_vulnerability(request_obj: Request, body: FixRequest):
    if not body.original_code or not body.original_code.strip():
        logger.error("Fix request failed: No code provided")
        raise HTTPException(status_code=400, detail="No code provided")
    
    if not body.vulnerability_description:
        logger.error("Fix request failed: No vulnerability description provided")
        raise HTTPException(status_code=400, detail="No vulnerability description provided")
    
    api_key = body.user_key if body.user_key else GLOBAL_GROQ_KEY
    groq_client = Groq(api_key=api_key)
    
    try:
        # Get the vulnerable line from the code
        lines = body.original_code.split('\n')
        vuln_line_idx = (body.vulnerability_line or 1) - 1
        
        # Validate line number
        if vuln_line_idx < 0 or vuln_line_idx >= len(lines):
            logger.error(f"Fix request failed: Invalid line number {body.vulnerability_line} (file has {len(lines)} lines)")
            raise HTTPException(status_code=400, detail=f"Invalid line number: {body.vulnerability_line}")
        
        # Get context around the vulnerability (5 lines before and after)
        start_idx = max(0, vuln_line_idx - 5)
        end_idx = min(len(lines), vuln_line_idx + 6)
        context_lines = lines[start_idx:end_idx]
        context = '\n'.join(context_lines)
        
        completion = groq_client.chat.completions.create(
            model=MODEL_ID,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT_FIX},
                {"role": "user", "content": f"Fix this vulnerability: {body.vulnerability_description}\n\nVulnerable line {body.vulnerability_line}:\n{lines[vuln_line_idx] if vuln_line_idx < len(lines) else ''}\n\nContext:\n{context}"}
            ],
            response_format={"type": "json_object"},
            temperature=0.0,
        )

        raw_content = completion.choices[0].message.content
        result = json.loads(raw_content)

        logger.info(f"Generated fix for line {body.vulnerability_line}: {body.vulnerability_description}")
        return FixResponse(
            fixed_code=result.get('fixed_code', ''),
            explanation=result.get('explanation', 'Security fix applied')
        )

    except Exception as e:
        logger.error(f"Autofix Error: {e}")
        raise HTTPException(status_code=500, detail=f"Fix generation failed: {str(e)}")

@app.post("/scan-dependencies", response_model=DependencyScanResponse)
async def scan_dependencies(request_obj: Request, body: CodeAnalysisRequest):
    """
    Scan dependency files (package.json, requirements.txt, go.mod, etc.) for known vulnerabilities.
    """
    api_key = body.user_key if body.user_key else GLOBAL_GROQ_KEY
    groq_client = Groq(api_key=api_key)
    
    try:
        # Parse the code to identify dependency declarations
        vulnerabilities = []
        scanned_files = []
        
        # Detect file type and extract dependencies
        lines = body.code.split('\n')
        file_type = None
        
        # Check for package.json (JavaScript/Node.js)
        if '"dependencies"' in body.code or '"devDependencies"' in body.code:
            file_type = 'package.json'
            scanned_files.append('package.json')
        # Check for requirements.txt (Python)
        elif any(re.match(r'^[a-zA-Z0-9\-_]+[=<>!]', line.strip()) for line in lines[:10]):
            file_type = 'requirements.txt'
            scanned_files.append('requirements.txt')
        # Check for go.mod (Go)
        elif 'module ' in body.code or 'require ' in body.code:
            file_type = 'go.mod'
            scanned_files.append('go.mod')
        # Check for Gemfile (Ruby)
        elif body.code.strip().startswith('source ') or 'gem ' in body.code:
            file_type = 'Gemfile'
            scanned_files.append('Gemfile')
        
        if not file_type:
            return DependencyScanResponse(vulnerabilities=[], scanned_files=[])
        
        # Use AI to analyze dependencies for vulnerabilities
        prompt = f"""Analyze these dependencies for known security vulnerabilities, outdated packages, and security issues.

File type: {file_type}
Content:
{body.code}

Return JSON with this structure:
{{
  "vulnerabilities": [
    {{
      "package": "package-name",
      "version": "version-string",
      "severity": "critical|high|medium|low",
      "message": "Brief description of the vulnerability",
      "cve": "CVE-XXXX-XXXXX or null",
      "recommendation": "Upgrade to version X.X.X or use alternative package"
    }}
  ]
}}

Focus on:
1. Known CVEs and security advisories
2. Deprecated or unmaintained packages
3. Packages with known vulnerabilities
4. Insecure package versions
5. Missing security patches

Only report REAL, verifiable vulnerabilities. Do not speculate."""

        completion = groq_client.chat.completions.create(
            model=MODEL_ID,
            messages=[
                {"role": "system", "content": "You are a security vulnerability scanner for software dependencies. Only report real, documented vulnerabilities."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.0,
        )
        
        result = json.loads(completion.choices[0].message.content)
        
        if "vulnerabilities" in result:
            for vuln in result["vulnerabilities"]:
                vulnerabilities.append(DependencyVulnerability(
                    package=vuln.get("package", "unknown"),
                    version=vuln.get("version", "unknown"),
                    severity=vuln.get("severity", "medium"),
                    message=vuln.get("message", "Vulnerability detected"),
                    cve=vuln.get("cve"),
                    recommendation=vuln.get("recommendation")
                ))
        
        logger.info(f"Dependency scan complete: {len(vulnerabilities)} vulnerabilities found")
        return DependencyScanResponse(vulnerabilities=vulnerabilities, scanned_files=scanned_files)
        
    except Exception as e:
        logger.error(f"Dependency scan error: {e}")
        raise HTTPException(status_code=500, detail=f"Dependency scan failed: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint for deployment platforms"""
    return {"status": "ok", "model": MODEL_ID, "timestamp": datetime.now().isoformat()}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)