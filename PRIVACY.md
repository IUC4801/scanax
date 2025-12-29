# Privacy Policy - Scanax Security Scanner

**Last Updated:** December 30, 2025

## Overview

Scanax Security Scanner is a Visual Studio Code extension that performs security analysis on your code. This privacy policy explains how Scanax handles your data.

## Data Collection and Processing

### Code Analysis
- **What:** Your source code is analyzed locally and may be sent to external APIs for AI-powered fix generation
- **When:** Only when you explicitly trigger scans or request AI fixes
- **Where:** Code snippets containing vulnerabilities are sent to Groq AI API (or your configured LLM provider)
- **Purpose:** To generate intelligent security fix suggestions
- **Retention:** Code is not stored by Scanax; third-party API retention policies apply (see below)

### API Keys and Credentials
- **Storage:** API keys are stored in plaintext in VS Code's `settings.json` file on your local machine
- **Location:** Your user settings directory (not synced by default)
- **Access:** Only you and applications with file system access can read these keys
- **Recommendation:** Use read-only or limited-scope API keys when possible

### Diagnostic Data
- **Local Only:** All scan results, vulnerability findings, and cache data are stored locally in VS Code's workspace storage
- **No Telemetry:** Scanax does not collect usage statistics, crash reports, or analytics
- **No Remote Storage:** Vulnerability data never leaves your machine except as described above

## Third-Party Services

### Groq AI API (Default Provider)
- **Purpose:** AI-powered vulnerability fix generation
- **Data Sent:** Code snippets containing detected vulnerabilities (typically 10-50 lines)
- **Privacy Policy:** https://groq.com/privacy-policy/
- **Data Retention:** Per Groq's terms of service
- **Control:** You can disable AI fixes or use your own API key

### OSV Database API
- **Purpose:** Dependency vulnerability scanning (CVE lookup)
- **Data Sent:** Package names and versions from dependency files (`package.json`, `requirements.txt`, etc.)
- **Privacy Policy:** https://osv.dev/
- **Data Retention:** Query logs per Google's standard practices
- **Note:** No source code is sent; only package metadata

### Custom Backend (Optional)
- **Default URL:** `https://scanax-backend.onrender.com`
- **Purpose:** API key validation and health checks
- **Data Sent:** Encrypted API key hash for validation only
- **Self-Hosting:** You can deploy your own backend and configure the URL in settings

## Your Rights

### GDPR (EU Users)
- **Right to Access:** All data is stored locally; you have full access via file system
- **Right to Deletion:** Uninstall the extension and delete VS Code workspace storage
- **Right to Portability:** All data is in standard JSON format
- **No Consent Required:** Extension operates entirely at your command; no automatic data collection

### CCPA (California Users)
- **No Sale of Data:** Scanax does not sell, rent, or share your personal information
- **No Tracking:** No cookies, beacons, or tracking technologies are used
- **Opt-Out:** Disable AI features or use offline mode

## Security Measures

- Local processing prioritized over remote API calls
- API requests use HTTPS encryption
- No persistent storage of code snippets on remote servers (by design)
- API keys stored locally (consider using VS Code's secret storage in future releases)

## Children's Privacy

Scanax does not knowingly collect data from users under 13 years of age. The extension is designed for software developers.

## Changes to This Policy

Material changes will be documented in `CHANGELOG.md` and require extension update acceptance.

## Open Source

Scanax is open source software. You can audit the code at:
- **Repository:** https://github.com/IUC4801/scanax
- **License:** MIT

## Contact

For privacy concerns or questions:
- **GitHub Issues:** https://github.com/IUC4801/scanax/issues
- **Email:** Via GitHub profile

## Compliance Summary

| Requirement | Status |
|-------------|--------|
| GDPR Compliance | ✅ Yes - Local data, user-initiated processing |
| CCPA Compliance | ✅ Yes - No sale, no tracking |
| Data Encryption | ✅ HTTPS for API calls |
| User Control | ✅ Fully configurable, can disable AI features |
| Transparency | ✅ Open source, auditable |

## Disclaimer

When using third-party LLM providers (Groq, OpenAI, etc.), their respective privacy policies and terms of service apply. Scanax cannot control how third-party services handle data. Review their policies before using API keys.
