# Scanax Security Scanner

Advanced static analysis and AI-powered security vulnerability detection for Visual Studio Code. Scanax combines pattern-based static analysis with Llama 3.1 large language model inference to identify security vulnerabilities, code quality issues, and compliance violations across multiple programming languages.

## Overview

Scanax provides comprehensive security scanning capabilities for JavaScript, TypeScript, Python, C#, Java, Go, PHP, Ruby, and C/C++ codebases. The extension performs real-time vulnerability detection as you write code, with support for both single-file analysis and workspace-wide scanning. All vulnerabilities are classified according to industry standards including CWE (Common Weakness Enumeration), CVE (Common Vulnerabilities and Exposures), and OWASP Top 10:2021.

## Technical Capabilities

### Static Analysis Engine
- 36+ pre-defined vulnerability detection patterns using regex-based matching
- Support for SQL injection, cross-site scripting, command injection, insecure deserialization, secrets exposure, path traversal, XML external entities, server-side request forgery, and cryptographic weaknesses
- Language-specific pattern recognition for JavaScript/TypeScript eval usage, Python pickle deserialization, C# BinaryFormatter vulnerabilities, Java ObjectInputStream risks, and PHP superglobal handling
- Comment-aware scanning that excludes false positives from code comments

### AI-Powered Analysis
- Integration with Groq API using Llama 3.1-8b-instant model for contextual vulnerability analysis
- Automated fix generation with explanation of security remediation steps
- Fallback to static analysis when backend connectivity is unavailable
- Configurable retry logic with exponential backoff for API resilience

### Data Flow Analysis
- Taint tracking for user input sources including HTTP request parameters, command-line arguments, environment variables, and file system inputs
- Multi-hop data flow analysis tracking variable assignments, function calls, and string concatenation operations
- Detection of tainted data reaching dangerous sinks such as database queries, system commands, and code evaluation functions
- Interprocedural analysis with support for tracking data flow across function boundaries

### Cross-File Analysis
- Workspace-wide dependency graph construction
- Detection of insecure function exports used in multiple modules
- Identification of circular dependencies and architectural vulnerabilities
- Analysis of data flow between modules with vulnerability propagation tracking

### Dependency Scanning
- Integration with Open Source Vulnerabilities (OSV) database for real-time CVE lookup
- Support for npm packages via package.json and Python packages via requirements.txt
- CVSS score reporting and fixed version recommendations
- Caching layer to minimize redundant API calls with 1-hour TTL

### Compliance Reporting
- OWASP Top 10:2021 categorization with percentage distribution analysis
- CWE coverage reporting with severity classification
- PCI-DSS and SOC 2 compliance recommendations
- HTML report generation with compliance scoring and remediation priorities
- Exportable audit trails for security review processes

### Developer Experience Features
- Real-time scanning with 1-second debounce to minimize performance impact
- Configurable toggle for enabling or disabling live vulnerability detection
- File hash-based caching system providing 99% faster rescans for unchanged files
- Support for .scanaxignore files using glob patterns for false positive suppression
- Inline ignore comments (scanax-ignore, scanax-ignore-next-line)
- False positive reporting mechanism with backend telemetry
- VS Code diagnostic integration with Problems panel display
- Code action provider for quick fix application
- Hover tooltips with detailed vulnerability information including CWE references and remediation guidance

### Backend Architecture
- FastAPI-based REST API with CORS support for remote deployment
- Stateless request handling with no persistent storage requirements
- Health check endpoint for monitoring and uptime verification
- Bring-your-own-key (BYOK) model supporting custom Groq API credentials
- Exponential backoff retry mechanism for transient failures
- Rate limiting awareness with graceful degradation

## Language Support Matrix

| Language | Injection | XSS | Deserialization | Secrets | Crypto | Path Traversal | Command Injection |
|----------|-----------|-----|-----------------|---------|--------|----------------|-------------------|
| JavaScript/TypeScript | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Python | ✓ | - | ✓ | ✓ | ✓ | ✓ | ✓ |
| C# | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Java | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Go | ✓ | - | - | ✓ | ✓ | - | ✓ |
| PHP | ✓ | ✓ | - | ✓ | - | ✓ | ✓ |
| Ruby | ✓ | - | ✓ | ✓ | - | - | ✓ |
| C/C++ | - | - | - | - | - | - | ✓ |

## Features

### Real-Time Security Scanning
- Scans your code as you type or on-demand
- Detects SQL Injection, XSS, Command Injection, and 50+ vulnerability types
- Inline diagnostics with red squiggles
- Workspace-wide security analysis

### 🤖 **AI-Powered Fix Suggestions**
- Get intelligent code fixes for detected vulnerabilities
- One-click apply with "Get Fix Suggestion" button
- Contextual recommendations with step-by-step guidance

### 🔐 **Secret & PII Detection**
- Automatically detects hardcoded API keys, passwords, and tokens
- Flags AWS credentials, private keys, and database connection strings
- Identifies PII exposure (SSN, credit cards, emails)

### 📦 **Dependency Vulnerability Scanner**
- Scans `package.json`, `requirements.txt`, `go.mod`, and more
- Detects known CVEs in your dependencies
- Provides version upgrade recommendations

### 🏷️ **CWE References & CVSS Scoring**
- Every vulnerability tagged with CWE ID (e.g., CWE-89)
- CVSS-style severity scores (0.0-10.0)
- Clickable links to MITRE CWE documentation

### 💡 **Rich Hover Tooltips**
- Hover over vulnerabilities to see complete details
- View issue, category, CWE, description, and fix—all inline
- No need to switch between panels

### ⌨️ **Keyboard Shortcuts**
- `Ctrl+Shift+S` - Scan current file
- `Ctrl+Shift+W` - Scan entire workspace
- `Ctrl+Shift+V` - Open vulnerability panel

### 🌐 **Multi-Language Support**
- **JavaScript/TypeScript** - Prototype pollution, eval() detection
- **Python** - Django/Flask misconfigurations, pickle vulnerabilities
- **Go** - Race conditions, goroutine leaks
- **Java** - XXE, LDAP injection
- **PHP** - File inclusion, type juggling

---

## 📸 Screenshots

### Security Dashboard
![Scanax Dashboard](https://via.placeholder.com/800x500?text=Scanax+Dashboard+Screenshot)

*The main vulnerability panel showing detected issues with severity badges, CWE references, and fix suggestions*

### Inline Detection
![Inline Detection](https://via.placeholder.com/800x400?text=Inline+Vulnerability+Detection)

*Red squiggles mark vulnerable code directly in your editor*

### Hover Tooltip
![Hover Tooltip](https://via.placeholder.com/600x400?text=Rich+Hover+Tooltip)

*Hover over vulnerabilities to see complete details without leaving your code*

### AI Fix Suggestions
![Fix Suggestions](https://via.placeholder.com/700x400?text=AI+Fix+Suggestions)

*Get intelligent, context-aware code fixes powered by AI*

---

## 🚀 Getting Started

### Prerequisites
- **VS Code** 1.75.0 or higher
- **Groq API Key** ([Get free key](https://console.groq.com/keys))
- **Backend Server** - Choose one:
  - Option 1: Deploy to free hosting (Render, Railway, Fly.io) - **Recommended**
  - Option 2: Run locally (requires Python 3.12+)

### Installation

1. **Install the Extension**
   - Open VS Code
   - Go to Extensions (`Ctrl+Shift+X`)
   - Search for "Scanax Security Scanner"
   - Click Install

2. **Deploy Backend (Recommended)** 🚀
   
   **Quick Deploy to Render.com (100% FREE):**
   
   ```bash
   # 1. Push backend to GitHub
   cd backend
   git init
   git add .
   git commit -m "Deploy Scanax backend"
   git push
   
   # 2. Go to https://render.com
   # 3. Click "New +" → "Web Service"
   # 4. Connect your repo, set:
   #    - Build: pip install -r requirements.txt
   #    - Start: uvicorn main:app --host 0.0.0.0 --port $PORT
   #    - Add env var: GROQ_API_KEY=your_key
   # 5. Deploy!
   ```
   
   ✅ Your backend will be at: `https://scanax-backend-XXXX.onrender.com`
   
   **Alternative Options:**
   - Railway.app ($5/month free credit)
   - Fly.io (generous free tier)
   - Google Cloud Run (2M requests/month free)
   
   📖 **Full deployment guide:** See `backend/DEPLOYMENT.md`

3. **Configure Extension**
   - Open VS Code Settings (`Ctrl+,`)
   - Search for "Scanax Backend URL"
   - Enter your deployed URL: `https://your-backend-url.onrender.com`
   - Alternatively, search for "Scanax" and set your Groq API key

### Option B: Run Backend Locally

Only if you prefer local development:
   ```bash
   # Clone or navigate to scanax/backend directory
   cd backend
   
   # Install dependencies
   pip install -r requirements.txt
   
   # Create .env file with your API key
   echo "GROQ_API_KEY=your_api_key_here" > .env
   
   # Start the backend server
   python3.12 main.py
   ```

3. **Configure Extension (Optional)**
   - Open VS Code Settings (`Ctrl+,`)
   - Search for "Scanax"
   - Choose your AI provider (Default or Custom Groq)
   - Add your custom API key if needed

### Quick Start

1. **Scan a File**: Press `Ctrl+Shift+S` or run command "Scanax: Run Security Scan"
2. **Scan Workspace**: Press `Ctrl+Shift+W` or run command "Scanax: Workspace-wide Security Scan"
3. **View Results**: Check the Scanax sidebar or Problems panel
4. **Get Fix**: Click "Get Fix Suggestion" button on any vulnerability
5. **Scan Dependencies**: Run command "Scanax: Scan Dependencies for Vulnerabilities"

---

## 🎯 Use Cases

### For Developers
- Catch security issues before code review
- Learn secure coding practices with AI explanations
- Fix vulnerabilities with one-click suggestions

### For Security Teams
- Enforce security standards across projects
- Track vulnerability trends over time
- Export reports for compliance

### For Teams
- Shift-left security into development workflow
- Reduce security debt incrementally
- Educate developers on secure coding

---

## 📋 Detected Vulnerability Types

| Category | Examples |
|----------|----------|
| **Injection** | SQL Injection, Command Injection, LDAP Injection |
| **Cross-Site Scripting** | Reflected XSS, Stored XSS, DOM XSS |
| **Authentication** | Broken Authentication, Session Management |
| **Sensitive Data** | Hardcoded Secrets, API Keys, Passwords |
| **XML Issues** | XXE, XML Injection |
| **Deserialization** | Insecure Pickle, YAML Load |
| **Path Traversal** | Directory Traversal, File Inclusion |
| **Cryptography** | Weak Crypto, Broken Algorithms |
| **Dependencies** | Known CVEs, Outdated Packages |

---

## ⚙️ Extension Settings

This extension contributes the following settings:

* `scanax.provider`: Choose AI provider (Default or Groq Custom)
* `scanax.customApiKey`: Your Groq API key for custom scanning

---

## 🔧 Commands

| Command | Description | Shortcut |
|---------|-------------|----------|
| `Scanax: Run Security Scan` | Scan current file | `Ctrl+Shift+S` |
| `Scanax: Workspace-wide Security Scan` | Scan entire workspace | `Ctrl+Shift+W` |
| `Scanax: Open Vulnerability Panel` | Open vulnerability panel | `Ctrl+Shift+V` |
| `Scanax: Scan Dependencies` | Scan dependency files for CVEs | - |

---

## 📊 Technical Details

### Architecture
- **Frontend**: VS Code Extension (TypeScript)
- **Backend**: FastAPI (Python)
- **AI Model**: Llama 3.1 8B (via Groq)
- **Analysis**: Static code analysis + AI-powered detection

### Backend API
- `POST /analyze` - Analyze code for vulnerabilities
- `POST /fix` - Generate fix suggestions
- `POST /scan-dependencies` - Scan dependencies for CVEs

### Privacy & Security
- Code is sent to Groq API for analysis
- API keys stored securely in VS Code
- No code stored on servers
- All processing is stateless

---

## 🐛 Known Issues

- Backend must be running manually on `localhost:8000`
- Large files (>1MB) are skipped
- Some language-specific checks may have false positives

---

## 🗺️ Roadmap

- [ ] Auto-start backend
- [ ] Export reports (PDF, SARIF)
- [ ] CI/CD integration templates
- [ ] Historical vulnerability tracking
- [ ] Team collaboration features
- [ ] Compliance reporting (OWASP, PCI-DSS)

---

## 📝 Release Notes

### 0.0.1 (Initial Release)

**Features:**
- Real-time security vulnerability scanning
- AI-powered fix suggestions
- Secret and PII detection
- Dependency vulnerability scanning
- CWE references and CVSS scoring
- Rich hover tooltips
- Keyboard shortcuts
- Multi-language support

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Powered by [Groq](https://groq.com/) AI inference
- Built with [FastAPI](https://fastapi.tiangolo.com/)
- Inspired by CodeQL and Semgrep

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/scanax/issues)
- **Documentation**: [Full Docs](https://github.com/yourusername/scanax/wiki)
- **Email**: your.email@example.com

---

**Enjoy safer coding with Scanax! 🛡️**
