// Sample vulnerable JavaScript code for testing Scanax
// This file contains intentional security vulnerabilities for demonstration

const express = require('express');
const mysql = require('mysql');
const app = express();

// VULNERABILITY 1: Hardcoded Database Credentials
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'SuperSecret123!',  // Hardcoded password
    database: 'production_db'
});

// VULNERABILITY 2: Hardcoded API Key
const API_KEY = "sk-1234567890abcdefghijklmnop";
const AWS_SECRET = "aws_secret_access_key_AKIAIOSFODNN7EXAMPLE";

// VULNERABILITY 3: SQL Injection
app.get('/user/:id', (req, res) => {
    const userId = req.params.id;
    const sql = 'SELECT * FROM users WHERE id = ' + userId;  // String concatenation
    db.query(sql, (err, result) => {
        if (err) return res.status(500).send(err);
        res.send(result);
    });
});

// VULNERABILITY 4: SQL Injection with user input
app.get('/search', (req, res) => {
    const username = req.query.name;
    const sql = "SELECT * FROM users WHERE username = '" + username + "'";
    db.query(sql, (err, result) => {
        if (err) return res.status(500).send(err);
        res.send(result);
    });
});

// VULNERABILITY 5: Cross-Site Scripting (XSS)
app.get('/greet', (req, res) => {
    const name = req.query.name;
    res.send('<h1>Hello ' + name + '!</h1>');  // Unescaped user input
});

// VULNERABILITY 6: Command Injection
const { exec } = require('child_process');
app.get('/ping', (req, res) => {
    const host = req.query.host;
    exec('ping ' + host, (error, stdout) => {  // Unsafe command execution
        res.send(stdout);
    });
});

// VULNERABILITY 7: Path Traversal
const fs = require('fs');
app.get('/file', (req, res) => {
    const filename = req.query.name;
    fs.readFile('/uploads/' + filename, (err, data) => {  // No path validation
        if (err) return res.status(404).send('Not found');
        res.send(data);
    });
});

// VULNERABILITY 8: Weak Cryptography
const crypto = require('crypto');
function hashPassword(password) {
    return crypto.createHash('md5').update(password).digest('hex');  // MD5 is weak
}

// VULNERABILITY 9: eval() usage
app.post('/calculate', (req, res) => {
    const expression = req.body.expr;
    const result = eval(expression);  // Dangerous eval()
    res.json({ result });
});

// VULNERABILITY 10: Missing Authentication
app.get('/admin/users', (req, res) => {
    // No authentication check!
    db.query('SELECT * FROM users', (err, users) => {
        res.json(users);
    });
});

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});

/* 
 * Try scanning this file with Scanax!
 * Press Ctrl+Shift+S to scan
 * Hover over red squiggles to see vulnerability details
 * Click "Get Fix Suggestion" to see secure code alternatives
 */
