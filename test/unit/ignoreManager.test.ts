import * as assert from 'assert';
import { IgnoreManager } from '../../src/scanner/ignoreManager';
import * as vscode from 'vscode';

suite('IgnoreManager Test Suite', () => {
    let ignoreManager: IgnoreManager;

    setup(() => {
        ignoreManager = new IgnoreManager();
    });

    test('Should detect scanax-ignore comment', () => {
        const mockDocument = {
            uri: { fsPath: '/test/file.js' },
            lineCount: 2,
            lineAt: (index: number) => ({
                text: index === 0 ? 'eval(code); // scanax-ignore' : 'other code',
                range: new vscode.Range(index, 0, index, 20)
            })
        } as any;

        const isIgnored = ignoreManager.isLineIgnored(mockDocument, 1);
        assert.strictEqual(isIgnored, true);
    });

    test('Should detect scanax-ignore-next-line comment', () => {
        const mockDocument = {
            uri: { fsPath: '/test/file.js' },
            lineCount: 3,
            lineAt: (index: number) => ({
                text: index === 0 ? '// scanax-ignore-next-line' : 'eval(code)',
                range: new vscode.Range(index, 0, index, 20)
            })
        } as any;

        const isIgnored = ignoreManager.isLineIgnored(mockDocument, 2);
        assert.strictEqual(isIgnored, true);
    });

    test('Should not ignore normal code', () => {
        const mockDocument = {
            uri: { fsPath: '/test/file.js' },
            lineCount: 1,
            lineAt: (index: number) => ({
                text: 'eval(code)',
                range: new vscode.Range(index, 0, index, 10)
            })
        } as any;

        const isIgnored = ignoreManager.isLineIgnored(mockDocument, 1);
        assert.strictEqual(isIgnored, false);
    });

    test('Should filter ignored vulnerabilities', () => {
        const mockDocument = {
            uri: { fsPath: '/test/file.js' },
            lineCount: 3,
            lineAt: (index: number) => ({
                text: index === 0 ? 'eval(code); // scanax-ignore' : 'eval(code2)',
                range: new vscode.Range(index, 0, index, 20)
            })
        } as any;

        const vulnerabilities = [
            { line: 1, message: 'Should be filtered' },
            { line: 2, message: 'Should remain' }
        ];

        const filtered = ignoreManager.filterIgnored(mockDocument, vulnerabilities);

        assert.strictEqual(filtered.length, 1);
        assert.strictEqual(filtered[0].line, 2);
    });
});
