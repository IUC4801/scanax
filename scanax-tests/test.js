// Scanax Vulnerability Test Suite - JavaScript
// This file contains intentional security vulnerabilities for testing purposes only

const express = require('express');
const app = express();

// ============================================
// VULNERABILITY: SQL Injection
// ============================================
app.get('/user/:id', (req, res) => {
  const userId = req.params.id;
  // Unsanitized user input directly concatenated into SQL query
  const query = "SELECT * FROM users WHERE id = " + userId;
  // In a real app, this could allow attackers to execute arbitrary SQL
  res.send(query);
});
// ============================================
// VULNERABILITY: Hardcoded Secrets
// ============================================
const DATABASE_URL = "postgresql://admin:super_secret_password_123@db.example.com:5432/myapp";
const API_KEY = "sk-1234567890abcdefghijklmnopqrstuv";
const STRIPE_SECRET = "sk_test_FAKE_NOT_REAL_STRIPE_KEY_EXAMPLE";

// ============================================
// VULNERABILITY: Cross-Site Scripting (XSS)
// ============================================
app.get('/search', (req, res) => {
  const searchQuery = req.query.q;
  // User input is directly inserted into HTML without sanitization
  const html = "<h1>Search Results for: " + searchQuery + "</h1>";
  res.send(html);
});

// ============================================
// VULNERABILITY: Command Injection
// ============================================
app.post('/upload', (req, res) => {
  const filename = req.body.filename;
  // User input is directly passed to shell command without sanitization
  const command = `convert ${filename} -resize 100x100 output.jpg`;
  require('child_process').exec(command, (error, stdout, stderr) => {
    if (error) {
      res.status(500).send('Error processing image');
    } else {
      res.send('Image processed successfully');
    }
  });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
