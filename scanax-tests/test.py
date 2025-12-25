#!/usr/bin/env python3
# Scanax Vulnerability Test Suite - Python
# This file contains intentional security vulnerabilities for testing purposes only

import sqlite3
import os
import subprocess
import pickle
from flask import Flask, request

app = Flask(__name__)

# ============================================
# VULNERABILITY: Hardcoded Secrets
# ============================================
DATABASE_PASSWORD = "admin_password_2024"
API_SECRET_KEY = "secret_key_abc123xyz789"
AWS_ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE"
AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"

# ============================================
# VULNERABILITY: SQL Injection
# ============================================
@app.route('/search')
def search_users():
    search_term = request.args.get('q', '')
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    # Unsanitized user input directly concatenated into SQL query
    query = f"SELECT * FROM users WHERE name LIKE '%{search_term}%'"
    cursor.execute(query)
    results = cursor.fetchall()
    conn.close()
    return str(results)

# ============================================
# VULNERABILITY: Command Injection
# ============================================
@app.route('/process_file')
def process_file():
    filename = request.args.get('file', '')
    # User input is directly passed to shell command without sanitization
    command = f"ffmpeg -i {filename} -c:v libx264 output.mp4"
    os.system(command)
    return "File processed"

# ============================================
# VULNERABILITY: Unsafe Deserialization
# ============================================
@app.route('/load_object')
def load_object():
    data = request.args.get('obj', '')
    # Unsafe pickle deserialization allows arbitrary code execution
    obj = pickle.loads(data.encode())
    return str(obj)

# ============================================
# VULNERABILITY: Using eval() with user input
# ============================================
@app.route('/calculate')
def calculate():
    expression = request.args.get('expr', '')
    # Using eval() with user input is extremely dangerous
    result = eval(expression)
    return str(result)

if __name__ == '__main__':
    app.run(debug=True)
