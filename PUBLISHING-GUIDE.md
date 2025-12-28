# Scanax Extension Publishing Guide

Complete step-by-step guide to publish Scanax to the Visual Studio Code Marketplace.

---

## Prerequisites Checklist

### 1. Backend Deployment (CRITICAL)
- [ ] Backend must be deployed and publicly accessible
- [ ] Recommended: Deploy to Render.com, Railway.app, or Fly.io
- [ ] Verify health endpoint: `curl https://your-backend.onrender.com/` returns `{"status": "online"}`
- [ ] Update default backend URL in package.json configuration if not using localhost

### 2. VS Code Marketplace Account
- [ ] Create Microsoft account if you don't have one
- [ ] Go to https://marketplace.visualstudio.com/manage
- [ ] Click "New Publisher" or use existing publisher ID
- [ ] Note your Publisher ID (lowercase, no spaces, e.g., `ayushichaudhuri`)

### 3. Personal Access Token (PAT)
- [ ] Go to https://dev.azure.com/
- [ ] Click "User Settings" → "Personal access tokens"
- [ ] Click "+ New Token"
- [ ] Name: "Scanax Extension Publishing"
- [ ] Organization: All accessible organizations
- [ ] Expiration: Custom (set to 1 year)
- [ ] Scopes: Select "Marketplace" → "Manage"
- [ ] Click "Create" and **SAVE THE TOKEN IMMEDIATELY** (you cannot view it again)

### 4. Files Review
- [ ] README.md has real screenshots (not placeholders)
- [ ] CHANGELOG.md exists with version 0.0.2 notes
- [ ] icon.png is 128x128 pixels PNG (colored version)
- [ ] LICENSE file exists (MIT license is present)
- [ ] package.json publisher matches your Marketplace publisher ID

---

## Pre-Publishing Steps

### Step 1: Update Publisher ID
Open `package.json` and update the publisher field:

```json
"publisher": "your-actual-publisher-id"
```

**Current value:** `"Ayushi Chaudhuri"` (has spaces - MUST FIX)
**Should be:** `"ayushichaudhuri"` or your registered publisher ID

### Step 2: Update Backend URL
In `package.json`, find the configuration section and update the default backend URL:

```json
"configuration": {
  "properties": {
    "scanax.backendUrl": {
      "type": "string",
      "default": "https://your-actual-backend.onrender.com",
      "description": "Backend API URL for Scanax"
    }
  }
}
```

### Step 3: Add Real Screenshots to README.md
Replace placeholder images with actual screenshots:

1. Take screenshots:
   - Vulnerability panel showing detected issues
   - Inline squiggles in code editor
   - Hover tooltip with CWE information
   - AI-generated fix suggestion

2. Save screenshots to `resources/screenshots/` folder:
   - `dashboard.png`
   - `inline-detection.png`
   - `hover-tooltip.png`
   - `fix-suggestion.png`

3. Update README.md image URLs:
   ```markdown
   ![Scanax Dashboard](resources/screenshots/dashboard.png)
   ![Inline Detection](resources/screenshots/inline-detection.png)
   ```

### Step 4: Update CHANGELOG.md
Create or update `CHANGELOG.md`:

```markdown
# Change Log

## [0.0.2] - 2025-12-28

### Added
- Static analysis engine with 36+ vulnerability detection patterns
- Support for 9 programming languages (JavaScript, TypeScript, Python, C#, Java, Go, PHP, Ruby, C/C++)
- AI-powered fix generation using Llama 3.1
- Real-time scanning with toggle control
- CWE/CVE classification and OWASP Top 10 mapping
- Dependency vulnerability scanning (npm, PyPI)
- Cross-file data flow analysis
- Taint tracking for user input
- Compliance reporting (PCI-DSS, SOC 2)
- Backend health monitoring
- API key management with setup wizard

### Changed
- Improved error handling with exponential backoff
- Enhanced caching system for faster rescans

## [0.0.1] - 2025-12-XX

### Added
- Initial release with basic scanning functionality
```

### Step 5: Create PRIVACY.md (Required)
Create `PRIVACY.md` in the root directory:

```markdown
# Privacy Policy for Scanax Security Scanner

## Data Collection and Usage

### Code Analysis
- Scanax sends your code to a remote backend server for AI-powered vulnerability analysis
- Code is transmitted to Groq API (third-party service) for processing using Llama 3.1 model
- No code is stored on Scanax servers or Groq servers after analysis
- All processing is stateless and ephemeral

### API Keys
- API keys are stored locally in VS Code settings (settings.json)
- Keys are NOT encrypted by default in VS Code settings
- Keys are never transmitted to Scanax servers (only to Groq API)
- Users are responsible for securing their development environment

### Telemetry
- Scanax does NOT collect usage analytics or telemetry data
- No personal information is collected
- No tracking of files, projects, or user behavior

### Backend Server
- Scanax backend is stateless and does not log code submissions
- Backend only processes requests and returns results
- No persistent storage of code or vulnerabilities

### Third-Party Services
- Groq API: Used for AI analysis (see https://groq.com/privacy-policy/)
- OSV Database: Used for dependency vulnerability lookup (see https://osv.dev/)

## Data Security

### In Transit
- All communication uses HTTPS encryption
- Code is transmitted securely to backend and Groq API

### At Rest
- No code is stored at rest on any Scanax infrastructure
- API keys are stored in plaintext in VS Code settings (user's responsibility)

## User Rights

### GDPR Compliance
- No personal data is collected, stored, or processed
- Users can delete API keys from VS Code settings at any time
- No data retention policy (nothing is retained)

### CCPA Compliance
- No personal information is sold or shared with third parties
- Users have full control over their API keys and code

## Changes to Privacy Policy
Last updated: December 28, 2025

Users will be notified of privacy policy changes via extension update notes.

## Contact
For privacy concerns: [Your email or GitHub issues]
```

### Step 6: Verify .vscodeignore
Ensure `.vscodeignore` excludes unnecessary files:

```
.vscode/**
.vscode-test/**
src/**
.gitignore
.yarnrc
vsc-extension-quickstart.md
**/tsconfig.json
**/.eslintrc.json
**/*.map
**/*.ts
backend/**
scanax-tests/**
node_modules/**
.env
*.log
resources/ICON-README.md
resources/*.svg
PUBLISHING-GUIDE.md
```

---

## Publishing Process

### Step 1: Install vsce (VS Code Extension Manager)
```bash
npm install -g @vscode/vsce
```

### Step 2: Login to Publisher Account
```bash
vsce login your-publisher-id
```

Enter your Personal Access Token when prompted.

### Step 3: Test Package Locally
```bash
# Generate .vsix file
vsce package

# This creates scanax-0.0.2.vsix
```

Test the .vsix file:
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Click "..." menu → "Install from VSIX..."
4. Select `scanax-0.0.2.vsix`
5. Test all features thoroughly

### Step 4: Publish to Marketplace
```bash
# Publish with automatic version bump
vsce publish

# Or publish specific version
vsce publish 0.0.2

# Or publish minor/major version
vsce publish minor  # 0.0.2 → 0.1.0
vsce publish major  # 0.0.2 → 1.0.0
```

### Step 5: Verify Publication
1. Wait 5-10 minutes for processing
2. Go to https://marketplace.visualstudio.com/
3. Search for "Scanax"
4. Verify icon, description, screenshots appear correctly
5. Install from marketplace and test

---

## Post-Publishing Checklist

### Immediate Actions
- [ ] Test installation from marketplace on clean VS Code instance
- [ ] Verify backend URL is accessible
- [ ] Check all screenshots render correctly
- [ ] Test first-time user experience (no API key configured)
- [ ] Verify README formatting in marketplace

### Marketing & Promotion
- [ ] Share on Twitter/LinkedIn
- [ ] Post to Reddit (r/vscode, r/programming)
- [ ] Submit to VS Code Extension Roundup
- [ ] Create Product Hunt listing
- [ ] Update GitHub repository with marketplace badge

### Documentation Updates
- [ ] Add installation instructions to README
- [ ] Create video tutorial (optional)
- [ ] Update repository topics/tags for SEO

---

## Common Issues and Solutions

### Issue: "Error: Missing publisher name"
**Solution:** Update `package.json` with correct publisher ID (no spaces)

### Issue: "Error: Icon must be 128x128"
**Solution:** Resize icon.png to exactly 128x128 pixels

### Issue: "Error: README.md has placeholder images"
**Solution:** Replace all `https://via.placeholder.com/` URLs with real images

### Issue: "Extension not appearing in search"
**Solution:** Wait 10-15 minutes after publishing, clear browser cache

### Issue: "Backend not reachable after installation"
**Solution:** Verify backend is deployed and update default URL in package.json

### Issue: "API key errors"
**Solution:** Add setup instructions to README, implement first-run wizard

---

## Version Management

### Semantic Versioning
- **MAJOR** (1.0.0): Breaking changes, incompatible API changes
- **MINOR** (0.1.0): New features, backward compatible
- **PATCH** (0.0.1): Bug fixes, backward compatible

### Release Process
1. Update version in `package.json`
2. Update `CHANGELOG.md` with changes
3. Commit changes: `git commit -m "Release v0.0.2"`
4. Create git tag: `git tag v0.0.2`
5. Push: `git push && git push --tags`
6. Publish: `vsce publish`

---

## Unpublishing / Updating

### Update Existing Extension
```bash
# Make changes to code
npm run compile

# Update version in package.json
# Update CHANGELOG.md

# Publish update
vsce publish patch  # 0.0.2 → 0.0.3
```

### Unpublish Extension (Irreversible)
```bash
vsce unpublish your-publisher-id.scanax
```

**WARNING:** Unpublishing removes the extension permanently. Consider deprecating instead.

---

## Marketplace Optimization

### SEO Keywords in package.json
Ensure `keywords` array includes relevant terms:
```json
"keywords": [
  "security",
  "vulnerability",
  "scanner",
  "SAST",
  "static analysis",
  "CWE",
  "CVE",
  "OWASP",
  "SQL injection",
  "XSS",
  "dependency scan",
  "code security",
  "AI security"
]
```

### Categories
Choose appropriate categories:
```json
"categories": [
  "Linters",
  "Programming Languages",
  "Testing"
]
```

### Display Name and Description
- **displayName:** Keep concise and memorable
- **description:** Use keywords naturally (max ~200 chars for search preview)

---

## Support and Maintenance

### GitHub Issues
Set up issue templates in `.github/ISSUES/`:
- Bug report template
- Feature request template
- Security vulnerability template

### Update Schedule
- **Patch releases:** Weekly (bug fixes)
- **Minor releases:** Monthly (new features)
- **Major releases:** Quarterly (breaking changes)

### Deprecation Policy
If deprecating features:
1. Announce in CHANGELOG 2 versions ahead
2. Add deprecation warnings in code
3. Provide migration guide
4. Remove in next major version

---

## Legal Compliance

### License Verification
- [ ] Verify MIT license in LICENSE file
- [ ] Ensure all dependencies are compatible licenses
- [ ] Add license headers to source files if required

### Third-Party Attributions
If using third-party code/icons:
- [ ] Add ATTRIBUTIONS.md file
- [ ] Credit original authors
- [ ] Include required notices

### Export Control
For security tools:
- [ ] Verify no export restrictions apply
- [ ] Add disclaimer if scanning for vulnerabilities in controlled industries

---

## Emergency Procedures

### Critical Bug After Publishing
1. Immediately unpublish if it causes data loss
2. Fix bug in local copy
3. Bump patch version
4. Publish hotfix
5. Notify users via GitHub releases

### Security Vulnerability in Extension
1. Create private security advisory on GitHub
2. Patch vulnerability
3. Publish update immediately
4. Disclose responsibly after users update
5. Add to CHANGELOG under "Security" section

---

## Resources

### Official Documentation
- VS Code Publishing Guide: https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- Extension Manifest: https://code.visualstudio.com/api/references/extension-manifest
- Marketplace FAQ: https://code.visualstudio.com/api/working-with-extensions/publishing-extension#common-questions

### Tools
- vsce CLI: https://github.com/microsoft/vscode-vsce
- Azure DevOps (PAT): https://dev.azure.com/
- VS Code Marketplace: https://marketplace.visualstudio.com/manage

### Community
- VS Code Extension Development Discord
- r/vscode subreddit
- Stack Overflow: [visual-studio-code-extension] tag

---

## Final Pre-Publish Checklist

**Documentation:**
- [ ] README.md has real screenshots
- [ ] CHANGELOG.md is up to date
- [ ] PRIVACY.md exists
- [ ] LICENSE file exists

**Configuration:**
- [ ] package.json publisher ID is correct (no spaces)
- [ ] Backend URL is live and accessible
- [ ] Icon is 128x128 PNG
- [ ] Version number is correct
- [ ] Keywords are SEO optimized

**Testing:**
- [ ] Extension compiles without errors (`npm run compile`)
- [ ] All commands work in Extension Development Host
- [ ] Backend integration works
- [ ] API key setup wizard functions
- [ ] Error messages are user-friendly

**Publishing:**
- [ ] VS Code Marketplace account created
- [ ] Personal Access Token generated and saved
- [ ] vsce CLI installed (`npm install -g @vscode/vsce`)
- [ ] Logged in to publisher account (`vsce login`)

**Post-Publishing:**
- [ ] Verified extension appears in marketplace
- [ ] Tested fresh installation
- [ ] Promoted on social media
- [ ] GitHub repository updated with marketplace badge

---

**Last Updated:** December 28, 2025
**Next Review:** Before next major release

---

**READY TO PUBLISH?** Run: `vsce publish`

**QUESTIONS?** Open an issue or contact support.
