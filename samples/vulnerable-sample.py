# Sample vulnerable Python code for testing Scanax

import sqlite3
import os
import pickle
from flask import Flask, request

app = Flask(__name__)

# VULNERABILITY 1: Hardcoded Secret Key
app.secret_key = 'hard-coded-secret-key-12345'

# VULNERABILITY 2: Debug Mode Enabled
app.config['DEBUG'] = True

# VULNERABILITY 3: Hardcoded Database Credentials
DB_USER = 'admin'
DB_PASSWORD = 'SuperSecret123!'
DATABASE_URL = f'postgresql://{DB_USER}:{DB_PASSWORD}@localhost/prod_db'

# VULNERABILITY 4: SQL Injection
@app.route('/user/<user_id>')
def get_user(user_id):
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    query = f"SELECT * FROM users WHERE id = {user_id}"  # String formatting
    cursor.execute(query)
    return str(cursor.fetchall())

# VULNERABILITY 5: SQL Injection with user input
@app.route('/search')
def search():
    name = request.args.get('name')
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    query = f"SELECT * FROM users WHERE name = '{name}'"
    cursor.execute(query)
    return str(cursor.fetchall())

# VULNERABILITY 6: Command Injection
@app.route('/ping')
def ping():
    host = request.args.get('host')
    result = os.system(f'ping {host}')  # Unsafe command execution
    return f'Result: {result}'

# VULNERABILITY 7: Path Traversal
@app.route('/read')
def read_file():
    filename = request.args.get('file')
    with open(f'/uploads/{filename}', 'r') as f:  # No validation
        return f.read()

# VULNERABILITY 8: Insecure Deserialization
@app.route('/load')
def load_data():
    data = request.args.get('data')
    obj = pickle.loads(data.encode())  # Unsafe pickle.loads()
    return str(obj)

# VULNERABILITY 9: eval() usage
@app.route('/calc')
def calculate():
    expr = request.args.get('expr')
    result = eval(expr)  # Dangerous eval()
    return str(result)

# VULNERABILITY 10: Weak Cryptography
import hashlib
def hash_password(password):
    return hashlib.md5(password.encode()).hexdigest()  # MD5 is weak

# VULNERABILITY 11: Hardcoded API Keys
AWS_ACCESS_KEY = 'AKIAIOSFODNN7EXAMPLE'
AWS_SECRET_KEY = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
STRIPE_KEY = 'sk_live_51234567890abcdefghijk'

# VULNERABILITY 12: Missing Authentication
@app.route('/admin/delete/<user_id>')
def delete_user(user_id):
    # No authentication check!
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    cursor.execute(f"DELETE FROM users WHERE id = {user_id}")
    conn.commit()
    return 'User deleted'

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)

"""
Try scanning this file with Scanax!
Press Ctrl+Shift+S to scan
Hover over red squiggles to see vulnerability details
Click "Get Fix Suggestion" to see secure code alternatives
"""
