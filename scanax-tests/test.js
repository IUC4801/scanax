const express = require('express');
const mysql = require('mysql');
const app = express();

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'test_db'
});

// ==========================================================
// BLOCK 1: URL Parameter Injection
// ==========================================================
app.get('/user/:id', (req, res) => {
    const userId = req.params.id;

    const sql = 'SELECT * FROM users WHERE id = ?';
db.query(sql, [userId], (err, result) => {
        if (err) return res.status(500).send(err);
        res.send(result);
    });
});

// ==========================================================
// BLOCK 2: Query String Injection
// ==========================================================
app.get('/search', (req, res) => {
    const username = req.query.name;

    const sqlQuery = "SELECT * FROM users WHERE username = ?";

    db.query(sqlQuery, [username], (err, result) => {
        if (err) return res.status(500).send(err);
        res.send(result);
    });
});

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});

function escapeId(id) {
    return db.escape(id);
}

// Update BLOCK 1
app.get('/user/:id', (req, res) => {
    const userId = req.params.id;

    const sql = "SELECT * FROM users WHERE id = ?";

    db.query(sql, [escapeId(userId)], (err, result) => {
        if (err) return res.status(500).send(err);
        res.send(result);
    });
});

// Update BLOCK 2
app.get('/search', (req, res) => {
    const username = req.query.name;

    const sqlQuery = "SELECT * FROM users WHERE username = ?";

    db.query(sqlQuery, [escapeId(username)], (err, result) => {
        if (err) return res.status(500).send(err);
        res.send(result);
    });
});


function escapeId(id) {
    return db.escape(id);
}

// Update BLOCK 1
app.get('/user/:id', (req, res) => {
    const userId = req.params.id;

    const sql = "SELECT * FROM users WHERE id = ?";

    db.query(sql, [escapeId(userId)], (err, result) => {
        if (err) return res.status(500).send(err);
        res.send(result);
    });
});

// Update BLOCK 2
app.get('/search', (req, res) => {
    const username = req.query.name;

    const sqlQuery = "SELECT * FROM users WHERE username = ?";

    db.query(sqlQuery, [escapeId(username)], (err, result) => {
        if (err) return res.status(500).send(err);
        res.send(result);
    });
});


function escapeId(id) {
    return db.escape(id);
}

// Update BLOCK 1
app.get('/user/:id', (req, res) => {
    const userId = req.params.id;

    const sql = "SELECT * FROM users WHERE id = ?";

    db.query(sql, [escapeId(userId)], (err, result) => {
        if (err) return res.status(500).send(err);
        res.send(result);
    });
});

// Update BLOCK 2
app.get('/search', (req, res) => {
    const username = req.query.name;

    const sqlQuery = "SELECT * FROM users WHERE username = ?";

    db.query(sqlQuery, [escapeId(username)], (err, result) => {
        if (err) return res.status(500).send(err);
        res.send(result);
    });
});

// Fix: Use prepared statements with mysql
function escapeId(id) {
    return db.escape(id);
}

// Update BLOCK 1
app.get('/user/:id', (req, res) => {
    const userId = req.params.id;

    const sql = "SELECT * FROM users WHERE id = ?";

    db.query(sql, [escapeId(userId)], (err, result) => {
        if (err) return res.status(500).send(err);
        res.send(result);
    });
});

// Update BLOCK 2
app.get('/search', (req, res) => {
    const username = req.query.name;

    const sqlQuery = "SELECT * FROM users WHERE username = ?";

    db.query(sqlQuery, [escapeId(username)], (err, result) => {
        if (err) return res.status(500).send(err);
        res.send(result);
    });
});