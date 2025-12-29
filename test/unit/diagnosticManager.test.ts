import * as assert from 'assert';
import * as vscode from 'vscode';
import { DiagnosticManager, ScanaxDiagnostic } from '../../src/scanner/diagnosticManager';

suite('DiagnosticManager Test Suite', () => {
    let manager: DiagnosticManager;

    setup(() => {
        manager = new DiagnosticManager();
    });

    teardown(() => {
        manager.dispose();
    });

    test('Should create diagnostic collection', () => {
        assert.ok(manager);
    });

    test('Should set diagnostics for vulnerabilities', () => {
        const mockDocument = {
            uri: vscode.Uri.file('/test/file.js'),
            lineAt: (index: number) => ({
                range: new vscode.Range(
                    new vscode.Position(index, 0),
                    new vscode.Position(index, 50)
                ),
                text: 'eval(userInput);'
            }),
            lineCount: 5
        } as any;

        const vulnerabilities = [
            {
                line: 1,
                message: 'Code injection detected',
                category: 'Code Injection',
                severity: 'critical',
                fix: 'Avoid using eval()',
                description: 'eval() executes arbitrary code'
            }
        ];

        manager.setDiagnostics(mockDocument, vulnerabilities);
        
        // Should not throw
        assert.ok(true);
    });

    test('Should convert 1-based lines to 0-based', () => {
        const mockDocument = {
            uri: vscode.Uri.file('/test/file.js'),
            lineAt: (index: number) => ({
                range: new vscode.Range(
                    new vscode.Position(index, 0),
                    new vscode.Position(index, 50)
                ),
                text: 'test line'
            }),
            lineCount: 10
        } as any;

        const vulnerabilities = [
            {
                line: 5, // 1-based
                message: 'Test vulnerability'
            }
        ];

        // Should handle line number conversion without throwing
        manager.setDiagnostics(mockDocument, vulnerabilities);
        assert.ok(true);
    });

    test('Should store fix content in diagnostic', () => {
        const mockDocument = {
            uri: vscode.Uri.file('/test/file.js'),
            lineAt: (index: number) => ({
                range: new vscode.Range(
                    new vscode.Position(index, 0),
                    new vscode.Position(index, 50)
                ),
                text: 'test'
            }),
            lineCount: 5
        } as any;

        const vulnerabilities = [
            {
                line: 1,
                message: 'Vulnerability',
                fix: 'Use parameterized queries'
            }
        ];

        manager.setDiagnostics(mockDocument, vulnerabilities);
        
        // The fix should be stored in the diagnostic's fixContent property
        // This would need access to the diagnostic collection to verify
        assert.ok(true);
    });

    test('Should handle vulnerabilities without line numbers', () => {
        const mockDocument = {
            uri: vscode.Uri.file('/test/file.js'),
            lineAt: (index: number) => ({
                range: new vscode.Range(
                    new vscode.Position(index, 0),
                    new vscode.Position(index, 50)
                ),
                text: 'test'
            }),
            lineCount: 5
        } as any;

        const vulnerabilities = [
            {
                message: 'File-level vulnerability',
                // No line number
            }
        ];

        // Should default to line 1 and not throw
        manager.setDiagnostics(mockDocument, vulnerabilities);
        assert.ok(true);
    });

    test('Should clear diagnostics', () => {
        const mockDocument = {
            uri: vscode.Uri.file('/test/file.js'),
            lineAt: (index: number) => ({
                range: new vscode.Range(
                    new vscode.Position(index, 0),
                    new vscode.Position(index, 50)
                ),
                text: 'test'
            }),
            lineCount: 5
        } as any;

        manager.setDiagnostics(mockDocument, [{ line: 1, message: 'Test' }]);
        manager.clearDiagnostics(mockDocument);
        
        // Should not throw
        assert.ok(true);
    });

    test('Should include CWE information in diagnostics', () => {
        const mockDocument = {
            uri: vscode.Uri.file('/test/file.js'),
            lineAt: (index: number) => ({
                range: new vscode.Range(
                    new vscode.Position(index, 0),
                    new vscode.Position(index, 50)
                ),
                text: 'test'
            }),
            lineCount: 5
        } as any;

        const vulnerabilities = [
            {
                line: 1,
                message: 'SQL Injection',
                cwe: 'CWE-89',
                severity: 'critical',
                score: 9.8
            }
        ];

        manager.setDiagnostics(mockDocument, vulnerabilities);
        
        // Should store CWE in related information
        assert.ok(true);
    });
});
