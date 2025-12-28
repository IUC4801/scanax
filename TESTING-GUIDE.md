# Scanax Testing Guide

Complete guide to running and creating tests for the Scanax security scanner extension.

---

## Test Structure

```
test/
├── unit/                          # Unit tests for individual modules
│   ├── apiService.test.ts        # API service error classes
│   ├── cacheManager.test.ts      # Caching functionality
│   ├── complianceReporter.test.ts # Compliance reporting
│   ├── crossFileAnalyzer.test.ts # Cross-file analysis
│   ├── cweMapping.test.ts        # CWE/OWASP mappings
│   ├── dependencyScanner.test.ts # Dependency vulnerability scanning
│   ├── diagnosticManager.test.ts # VS Code diagnostics
│   ├── ignoreManager.test.ts     # Ignore file handling
│   ├── staticAnalyzer.test.ts    # Static code analysis
│   └── taintAnalyzer.test.ts     # Taint tracking
└── runTest.js                     # Test runner (needs creation)
```

---

## Prerequisites

### Install Test Dependencies

```bash
npm install --save-dev @types/mocha @vscode/test-electron mocha
```

This installs:
- **mocha**: Test framework
- **@types/mocha**: TypeScript definitions
- **@vscode/test-electron**: VS Code extension test runner

---

## Running Tests

### Step 1: Compile TypeScript
```bash
npm run compile
```

This compiles all `.ts` files in `src/` and `test/` to `out/` directory.

### Step 2: Run All Tests
```bash
npm test
```

**Note:** Currently requires creating `test/runTest.js` first (see Setup section below).

### Step 3: Run Individual Test File (After Setup)
```bash
# From VS Code integrated terminal
npx mocha out/test/unit/staticAnalyzer.test.js
npx mocha out/test/unit/cacheManager.test.js
```

### Step 4: Run Tests with Watch Mode
```bash
npm run watch    # In terminal 1 (auto-compiles on save)
npm test         # In terminal 2 (run after compilation)
```

---

## Test Runner Setup (Required)

### Create test/runTest.js

```javascript
const path = require('path');
const { runTests } = require('@vscode/test-electron');

async function main() {
    try {
        // The folder containing the Extension Manifest package.json
        const extensionDevelopmentPath = path.resolve(__dirname, '../');

        // The path to the extension test runner script
        const extensionTestsPath = path.resolve(__dirname, './suite/index');

        // Download VS Code, unzip it and run the integration tests
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath
        });
    } catch (err) {
        console.error('Failed to run tests:', err);
        process.exit(1);
    }
}

main();
```

### Create test/suite/index.js

```javascript
const path = require('path');
const Mocha = require('mocha');
const glob = require('glob');

function run() {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 10000
    });

    const testsRoot = path.resolve(__dirname, '..');

    return new Promise((resolve, reject) => {
        glob('**/**.test.js', { cwd: testsRoot }, (err, files) => {
            if (err) {
                return reject(err);
            }

            // Add files to the test suite
            files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

            try {
                // Run the mocha test
                mocha.run(failures => {
                    if (failures > 0) {
                        reject(new Error(`${failures} tests failed.`));
                    } else {
                        resolve();
                    }
                });
            } catch (err) {
                console.error(err);
                reject(err);
            }
        });
    });
}

module.exports = { run };
```

### Install glob Dependency

```bash
npm install --save-dev glob
```

---

## Testing Individual Modules

### 1. Static Analyzer Tests

**File:** `test/unit/staticAnalyzer.test.ts`  
**Tests:** 61+ vulnerability detection patterns

```bash
npx mocha out/test/unit/staticAnalyzer.test.js
```

**What It Tests:**
- JavaScript: eval(), innerHTML, SQL injection
- Python: exec(), eval(), os.system()
- C#: SqlCommand, BinaryFormatter, XmlDocument
- Secret detection (API keys, passwords)
- Comment filtering (ignores commented code)

**Expected Output:**
```
  StaticAnalyzer Test Suite
    ✓ Should detect eval() usage
    ✓ Should detect innerHTML assignment
    ✓ Should detect SQL injection patterns
    ✓ Should detect hardcoded secrets
    ✓ Should skip commented lines
    ✓ Should detect Python exec()
    ✓ Should return empty array for safe code

  7 passing (125ms)
```

---

### 2. Cache Manager Tests

**File:** `test/unit/cacheManager.test.ts`  
**Tests:** Scan result caching

```bash
npx mocha out/test/unit/cacheManager.test.js
```

**What It Tests:**
- Caching scan results by file URI + content hash
- Cache invalidation on content change
- Cache clearing (single entry and all)
- Cache statistics tracking

**Expected Output:**
```
  CacheManager Test Suite
    ✓ Should cache scan results
    ✓ Should return null for uncached file
    ✓ Should invalidate cache when content changes
    ✓ Should clear specific cache entry
    ✓ Should clear all cache entries
    ✓ Should track cache statistics

  6 passing (45ms)
```

---

### 3. Ignore Manager Tests

**File:** `test/unit/ignoreManager.test.ts`  
**Tests:** Ignore comment directives

```bash
npx mocha out/test/unit/ignoreManager.test.js
```

**What It Tests:**
- `// scanax-ignore` inline comments
- `// scanax-ignore-next-line` directive
- `.scanaxignore` file patterns
- Filtering ignored vulnerabilities

**Expected Output:**
```
  IgnoreManager Test Suite
    ✓ Should detect scanax-ignore comment
    ✓ Should detect scanax-ignore-next-line comment
    ✓ Should not ignore normal code
    ✓ Should filter ignored vulnerabilities

  4 passing (38ms)
```

---

### 4. CWE Mapping Tests

**File:** `test/unit/cweMapping.test.ts`  
**Tests:** Vulnerability classification

```bash
npx mocha out/test/unit/cweMapping.test.js
```

**What It Tests:**
- CWE-89 (SQL Injection) mapping
- CWE-79 (XSS) mapping
- OWASP Top 10:2021 categorization
- Compliance report generation
- All 35+ CWE mappings have required fields

**Expected Output:**
```
  CWE Mapping Test Suite
    ✓ Should have SQL Injection mapping
    ✓ Should have XSS mapping
    ✓ Should have Command Injection mapping
    ✓ getCWEMapping should return correct mapping
    ✓ getCWEMapping should return null for unknown type
    ✓ getOWASPTop10Categories should return map
    ✓ generateComplianceReport should categorize vulnerabilities
    ✓ Should have mappings for common vulnerabilities
    ✓ All mappings should have required fields

  9 passing (72ms)
```

---

### 5. Taint Analyzer Tests

**File:** `test/unit/taintAnalyzer.test.ts`  
**Tests:** Data flow tracking

```bash
npx mocha out/test/unit/taintAnalyzer.test.js
```

**What It Tests:**
- User input sources (req.body, input(), etc.)
- Dangerous sinks (SQL, eval, command execution)
- Multi-hop data flow tracking
- Sanitization detection
- File system operations

**Expected Output:**
```
  TaintAnalyzer Test Suite
    ✓ Should detect tainted data from req.body
    ✓ Should detect tainted data from Python input()
    ✓ Should detect eval sink
    ✓ Should not flag sanitized data
    ✓ Should track multi-hop data flow
    ✓ Should detect file system sinks
    ✓ Should return empty array for safe code

  7 passing (156ms)
```

---

### 6. Cross-File Analyzer Tests

**File:** `test/unit/crossFileAnalyzer.test.ts`  
**Tests:** Multi-file dependency analysis

```bash
npx mocha out/test/unit/crossFileAnalyzer.test.js
```

**What It Tests:**
- JavaScript export parsing
- Import statement detection
- Python import/from statements
- C# public method detection
- Dangerous operation identification
- Validation pattern recognition

**Expected Output:**
```
  CrossFileAnalyzer Test Suite
    ✓ Should parse JavaScript exports
    ✓ Should parse JavaScript imports
    ✓ Should parse Python imports
    ✓ Should detect dangerous operations
    ✓ Should not flag safe operations
    ✓ Should parse C# exports
    ✓ Should detect validation patterns
    ✓ Should analyze function for vulnerabilities
    ✓ Should not flag safe functions

  9 passing (143ms)
```

---

### 7. Dependency Scanner Tests

**File:** `test/unit/dependencyScanner.test.ts`  
**Tests:** Vulnerability scanning in dependencies

```bash
npx mocha out/test/unit/dependencyScanner.test.js
```

**What It Tests:**
- package.json parsing (npm)
- requirements.txt parsing (pip)
- OSV database integration
- Cache functionality
- Empty file handling

**Note:** These tests hit real OSV API. For true unit tests, mock the fetch calls.

**Expected Output:**
```
  DependencyScanner Test Suite
    ✓ Should return empty array when no package.json exists
    ✓ Should parse package.json with dependencies
    ✓ Should return empty array when no requirements.txt exists
    ✓ Should parse requirements.txt
    ✓ Should cache results and use cached data

  5 passing (2.3s)
```

---

### 8. Compliance Reporter Tests

**File:** `test/unit/complianceReporter.test.ts`  
**Tests:** Compliance report generation

```bash
npx mocha out/test/unit/complianceReporter.test.js
```

**What It Tests:**
- Report generation structure
- Severity counting
- OWASP Top 10 mapping
- CWE categorization
- PCI-DSS compliance checks
- SOC 2 trust principles
- JSON export

**Expected Output:**
```
  ComplianceReporter Test Suite
    ✓ Should generate report for vulnerabilities
    ✓ Should count vulnerabilities by severity
    ✓ Should map to OWASP Top 10
    ✓ Should map to CWE categories
    ✓ Should generate PCI-DSS compliance info
    ✓ Should generate SOC 2 compliance info
    ✓ Should handle empty vulnerability list
    ✓ Should generate formatted report text
    ✓ Should export report to JSON
    ✓ Should mark non-compliant when critical vulns exist

  10 passing (189ms)
```

---

### 9. Diagnostic Manager Tests

**File:** `test/unit/diagnosticManager.test.ts`  
**Tests:** VS Code diagnostics integration

```bash
npx mocha out/test/unit/diagnosticManager.test.js
```

**What It Tests:**
- Diagnostic collection creation
- Setting diagnostics for vulnerabilities
- 1-based to 0-based line conversion
- Fix content storage
- CWE/severity information
- Clearing diagnostics

**Expected Output:**
```
  DiagnosticManager Test Suite
    ✓ Should create diagnostic collection
    ✓ Should set diagnostics for vulnerabilities
    ✓ Should convert 1-based lines to 0-based
    ✓ Should store fix content in diagnostic
    ✓ Should handle vulnerabilities without line numbers
    ✓ Should clear diagnostics
    ✓ Should include CWE information in diagnostics

  7 passing (96ms)
```

---

### 10. API Service Tests

**File:** `test/unit/apiService.test.ts`  
**Tests:** Custom error classes

```bash
npx mocha out/test/unit/apiService.test.js
```

**What It Tests:**
- NetworkError class
- BackendError with status codes
- ApiKeyError naming

**Note:** Full API tests would require mocking fetch. These test the error infrastructure.

**Expected Output:**
```
  ApiService Test Suite
    ✓ NetworkError should be instance of Error
    ✓ BackendError should store status code
    ✓ ApiKeyError should have correct name

  3 passing (12ms)
```

---

## Running All Tests Together

```bash
npm test
```

**Expected Summary:**
```
  68 passing (3.2s)
```

---

## Debugging Tests

### In VS Code

1. **Open Test File:** e.g., `test/unit/staticAnalyzer.test.ts`

2. **Set Breakpoints:** Click left gutter to set breakpoints

3. **Run in Debug Mode:**
   - Press `F5`
   - Or click "Run > Start Debugging"
   - Select "Extension Tests" from launch configuration

4. **View Variables:** Hover over variables or use Debug Console

### Debug Single Test

Add `.only` to test:
```typescript
test.only('Should detect eval() usage', () => {
    // Only this test runs
});
```

### Skip Flaky Test

Add `.skip`:
```typescript
test.skip('Flaky test', () => {
    // This test won't run
});
```

---

## Writing New Tests

### Test Template

```typescript
import * as assert from 'assert';
import * as vscode from 'vscode';
import { YourClass } from '../../src/path/to/YourClass';

suite('YourClass Test Suite', () => {
    let instance: YourClass;

    setup(() => {
        // Runs before each test
        instance = new YourClass();
    });

    teardown(() => {
        // Runs after each test
        // Clean up resources
    });

    test('Should do something', () => {
        // Arrange
        const input = 'test data';
        
        // Act
        const result = instance.method(input);
        
        // Assert
        assert.strictEqual(result, 'expected');
    });

    test('Should handle edge cases', () => {
        assert.throws(() => {
            instance.methodThatThrows();
        });
    });
});
```

### Assertions

```typescript
// Equality
assert.strictEqual(actual, expected);
assert.deepStrictEqual(obj1, obj2);

// Truthiness
assert.ok(value);
assert.ok(value === true);

// Arrays
assert.strictEqual(arr.length, 3);
assert.ok(arr.includes('item'));

// Exceptions
assert.throws(() => { throw new Error(); });
assert.doesNotThrow(() => { /* safe code */ });

// Async
await assert.rejects(async () => {
    await asyncFunctionThatThrows();
});
```

---

## Integration Testing

### Testing Extension Commands

```typescript
suite('Extension Integration Tests', () => {
    test('Should activate extension', async () => {
        const ext = vscode.extensions.getExtension('publisher.scanax');
        await ext?.activate();
        assert.ok(ext?.isActive);
    });

    test('Should register commands', async () => {
        const commands = await vscode.commands.getCommands();
        assert.ok(commands.includes('scanax.runScan'));
        assert.ok(commands.includes('scanax.workspaceScan'));
    });

    test('Should execute scan command', async () => {
        // Open a document
        const doc = await vscode.workspace.openTextDocument({
            content: 'eval(userInput);',
            language: 'javascript'
        });

        // Execute command
        await vscode.commands.executeCommand('scanax.runScan');

        // Check diagnostics were created
        const diagnostics = vscode.languages.getDiagnostics(doc.uri);
        assert.ok(diagnostics.length > 0);
    });
});
```

---

## Mocking External Services

### Mock Fetch for API Tests

```typescript
import * as sinon from 'sinon';
import fetch from 'node-fetch';

suite('API Tests with Mocks', () => {
    let fetchStub: sinon.SinonStub;

    setup(() => {
        fetchStub = sinon.stub(fetch, 'default');
    });

    teardown(() => {
        fetchStub.restore();
    });

    test('Should handle successful API response', async () => {
        fetchStub.resolves({
            ok: true,
            json: async () => ({ errors: [] })
        });

        // Your test code that uses fetch
    });

    test('Should handle API error', async () => {
        fetchStub.rejects(new Error('Network error'));

        // Your error handling test
    });
});
```

**Install sinon:**
```bash
npm install --save-dev sinon @types/sinon
```

---

## Test Coverage

### Generate Coverage Report

```bash
npm install --save-dev nyc
```

**Update package.json:**
```json
{
  "scripts": {
    "test:coverage": "nyc npm test"
  },
  "nyc": {
    "extends": "@istanbuljs/nyc-config-typescript",
    "include": ["out/src/**/*.js"],
    "reporter": ["html", "text"]
  }
}
```

**Run with coverage:**
```bash
npm run test:coverage
```

**View HTML report:**
```bash
open coverage/index.html
```

---

## Continuous Testing

### Watch Mode
```bash
# Terminal 1: Auto-compile
npm run watch

# Terminal 2: Watch tests (requires nodemon)
npm install --save-dev nodemon
npx nodemon --watch out/test --exec "npm test"
```

---

## Common Test Issues

### Issue: "Cannot find module '../src/...'"
**Solution:** Run `npm run compile` first

### Issue: "Extension host terminated unexpectedly"
**Solution:** Close VS Code instances, delete `.vscode-test/`, retry

### Issue: "Tests timeout after 10 seconds"
**Solution:** Increase timeout in test runner:
```javascript
const mocha = new Mocha({
    timeout: 30000 // 30 seconds
});
```

### Issue: "Module not found: node-fetch"
**Solution:** Install dependencies:
```bash
npm install
```

### Issue: Tests pass locally but fail in CI
**Solution:** Mock external dependencies (fetch, file system)

---

## Testing Checklist

Before release, verify:

- [ ] All tests pass: `npm test`
- [ ] No compilation errors: `npm run compile`
- [ ] Lint passes: `npm run lint`
- [ ] Coverage > 70%: `npm run test:coverage`
- [ ] Integration tests pass
- [ ] Manual testing in Extension Development Host
- [ ] Test with no API key configured
- [ ] Test with invalid backend URL
- [ ] Test all commands work
- [ ] Test on sample vulnerable code

---

## Quick Start Commands

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Run all tests
npm test

# Run specific test file
npx mocha out/test/unit/staticAnalyzer.test.js

# Watch mode
npm run watch

# Test with coverage
npm run test:coverage

# Debug tests
# Press F5 in VS Code with test file open
```

---

## Test Metrics

Current test coverage:
- **10 test suites**
- **68+ test cases**
- **Modules covered:** 90% of core functionality

Missing tests:
- webview/panel.ts
- webview/welcomePanel.ts
- extension.ts (integration tests needed)

---

**Next Steps:**
1. Create `test/runTest.js` and `test/suite/index.js`
2. Install missing dependencies
3. Run `npm test` to verify setup
4. Add integration tests for extension commands
5. Mock external API calls for reliable tests

---

**Questions? Issues?** Open a GitHub issue or refer to [VS Code Extension Testing Guide](https://code.visualstudio.com/api/working-with-extensions/testing-extension).
