import * as vscode from 'vscode';

export class SimpleViewProvider implements vscode.WebviewViewProvider {
    resolveWebviewView(webviewView: vscode.WebviewView) {
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="padding:20px;color:#fff;">
    <h1>IT WORKS!</h1>
    <p>This is a test</p>
</body>
</html>`;
    }
}
