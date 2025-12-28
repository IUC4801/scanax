import * as assert from 'assert';
import * as vscode from 'vscode';
import { StaticAnalyzer } from '../../src/scanner/staticAnalyzer';

suite('StaticAnalyzer Test Suite', () => {
    let analyzer: StaticAnalyzer;

    setup(() => {
        analyzer = new StaticAnalyzer();
    });

    test('Should detect eval() usage', () => {
        const mockDocument = {
            getText: () => 'const result = eval(userInput);',
            languageId: 'javascript',
            positionAt: (offset: number) => new vscode.Position(0, offset),
            lineCount: 1
        } as any;

        const vulnerabilities = analyzer.scan(mockDocument);
        
        assert.strictEqual(vulnerabilities.length, 1);
        assert.strictEqual(vulnerabilities[0].category, 'Code Injection');
        assert.strictEqual(vulnerabilities[0].severity, 'critical');
    });

    test('Should detect innerHTML assignment', () => {
        const mockDocument = {
            getText: () => 'element.innerHTML = userInput;',
            languageId: 'javascript',
            positionAt: (offset: number) => new vscode.Position(0, offset),
            lineCount: 1
        } as any;

        const vulnerabilities = analyzer.scan(mockDocument);
        
        assert.ok(vulnerabilities.length > 0);
        assert.ok(vulnerabilities.some(v => v.category === 'Cross-Site Scripting (XSS)'));
    });

    test('Should detect SQL injection patterns', () => {
        const mockDocument = {
            getText: () => 'db.query("SELECT * FROM users WHERE id = " + userId);',
            languageId: 'javascript',
            positionAt: (offset: number) => new vscode.Position(0, offset),
            lineCount: 1
        } as any;

        const vulnerabilities = analyzer.scan(mockDocument);
        
        assert.ok(vulnerabilities.length > 0);
        assert.ok(vulnerabilities.some(v => v.category === 'SQL Injection'));
    });

    test('Should detect hardcoded secrets', () => {
        const mockDocument = {
            getText: () => 'const apiKey = "sk-1234567890abcdefghijklmnop";',
            languageId: 'javascript',
            positionAt: (offset: number) => new vscode.Position(0, offset),
            lineCount: 1
        } as any;

        const vulnerabilities = analyzer.scan(mockDocument);
        
        assert.ok(vulnerabilities.length > 0);
        assert.ok(vulnerabilities.some(v => v.category === 'Secret Exposure'));
    });

    test('Should skip commented lines', () => {
        const mockDocument = {
            getText: () => '// eval(userInput);',
            languageId: 'javascript',
            positionAt: (offset: number) => new vscode.Position(0, offset),
            lineCount: 1
        } as any;

        const vulnerabilities = analyzer.scan(mockDocument);
        
        assert.strictEqual(vulnerabilities.length, 0);
    });

    test('Should detect Python exec()', () => {
        const mockDocument = {
            getText: () => 'exec(user_code)',
            languageId: 'python',
            positionAt: (offset: number) => new vscode.Position(0, offset),
            lineCount: 1
        } as any;

        const vulnerabilities = analyzer.scan(mockDocument);
        
        assert.ok(vulnerabilities.length > 0);
        assert.ok(vulnerabilities.some(v => v.category === 'Code Injection'));
    });

    test('Should return empty array for safe code', () => {
        const mockDocument = {
            getText: () => 'const x = 10; console.log(x);',
            languageId: 'javascript',
            positionAt: (offset: number) => new vscode.Position(0, offset),
            lineCount: 1
        } as any;

        const vulnerabilities = analyzer.scan(mockDocument);
        
        assert.strictEqual(vulnerabilities.length, 0);
    });

    test('Should support static analysis for supported languages', () => {
        const jsDoc = { languageId: 'javascript' } as any;
        const pyDoc = { languageId: 'python' } as any;
        const txtDoc = { languageId: 'plaintext' } as any;

        assert.strictEqual(analyzer.shouldUseStaticAnalysis(jsDoc), true);
        assert.strictEqual(analyzer.shouldUseStaticAnalysis(pyDoc), true);
        assert.strictEqual(analyzer.shouldUseStaticAnalysis(txtDoc), false);
    });
});
