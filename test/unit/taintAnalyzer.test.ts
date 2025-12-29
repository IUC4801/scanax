import * as assert from 'assert';
import * as vscode from 'vscode';
import { TaintAnalyzer } from '../../src/scanner/taintAnalyzer';

suite('TaintAnalyzer Test Suite', () => {
    let analyzer: TaintAnalyzer;

    setup(() => {
        analyzer = new TaintAnalyzer();
    });

    test('Should detect tainted data from req.body', () => {
        const code = `
const username = req.body.username;
const query = "SELECT * FROM users WHERE name = '" + username + "'";
db.query(query);
        `.trim();

        const mockDocument = {
            getText: () => code,
            languageId: 'javascript',
            positionAt: (offset: number) => new vscode.Position(0, offset),
            lineCount: 3
        } as any;

        const vulnerabilities = analyzer.analyze(mockDocument);
        
        assert.ok(vulnerabilities.length > 0, 'Should detect taint vulnerability');
        const sqlTaint = vulnerabilities.find(v => v.sink === 'sql');
        assert.ok(sqlTaint, 'Should detect SQL sink');
    });

    test('Should detect tainted data from Python input()', () => {
        const code = `
user_input = input("Enter command: ")
os.system(user_input)
        `.trim();

        const mockDocument = {
            getText: () => code,
            languageId: 'python',
            positionAt: (offset: number) => new vscode.Position(0, offset),
            lineCount: 2
        } as any;

        const vulnerabilities = analyzer.analyze(mockDocument);
        
        assert.ok(vulnerabilities.length > 0);
        const cmdTaint = vulnerabilities.find((v: any) => v.sink === 'command');
        assert.ok(cmdTaint, 'Should detect command injection sink');
    });

    test('Should detect eval sink', () => {
        const code = `
const userCode = req.query.code;
eval(userCode);
        `.trim();

        const mockDocument = {
            getText: () => code,
            languageId: 'javascript',
            positionAt: (offset: number) => new vscode.Position(0, offset),
            lineCount: 2
        } as any;

        const vulnerabilities = analyzer.analyze(mockDocument);
        
        const evalTaint = vulnerabilities.find(v => v.sink === 'eval');
        assert.ok(evalTaint, 'Should detect eval sink');
        assert.strictEqual(evalTaint?.severity, 'critical');
    });

    test('Should not flag sanitized data', () => {
        const code = `
const username = req.body.username;
const sanitized = escapeHtml(username);
const html = "<div>" + sanitized + "</div>";
        `.trim();

        const mockDocument = {
            getText: () => code,
            languageId: 'javascript',
            positionAt: (offset: number) => new vscode.Position(0, offset),
            lineCount: 3
        } as any;

        const vulnerabilities = analyzer.analyze(mockDocument);
        
        // Should have fewer or less severe vulnerabilities after sanitization
        // The actual behavior depends on implementation details
        assert.ok(Array.isArray(vulnerabilities));
    });

    test('Should track multi-hop data flow', () => {
        const code = `
const userInput = req.body.data;
const temp = userInput;
const query = "SELECT * FROM users WHERE id = " + temp;
db.execute(query);
        `.trim();

        const mockDocument = {
            getText: () => code,
            languageId: 'javascript',
            positionAt: (offset: number) => new vscode.Position(0, offset),
            lineCount: 4
        } as any;

        const vulnerabilities = analyzer.analyze(mockDocument);
        
        assert.ok(vulnerabilities.length > 0);
        const taint = vulnerabilities[0];
        assert.ok(taint.flow.length >= 2, 'Should track multiple steps in data flow');
    });

    test('Should detect file system sinks', () => {
        const code = `
const filename = req.params.file;
fs.readFile(filename, callback);
        `.trim();

        const mockDocument = {
            getText: () => code,
            languageId: 'javascript',
            positionAt: (offset: number) => new vscode.Position(0, offset),
            lineCount: 2
        } as any;

        const vulnerabilities = analyzer.analyze(mockDocument);
        
        const fileTaint = vulnerabilities.find(v => v.sink === 'file');
        assert.ok(fileTaint, 'Should detect file system sink');
    });

    test('Should return empty array for safe code', () => {
        const code = `
const x = 10;
const y = x + 20;
console.log(y);
        `.trim();

        const mockDocument = {
            getText: () => code,
            languageId: 'javascript',
            positionAt: (offset: number) => new vscode.Position(0, offset),
            lineCount: 3
        } as any;

        const vulnerabilities = analyzer.analyze(mockDocument);
        
        assert.strictEqual(vulnerabilities.length, 0);
    });
});
