const express = require('express');
const mysql = require('mysql');
const app = express();

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'test_db'
});

app.get('/user/:id', (req, res) => {
    const userId = req.params.id;
    const sql = 'SELECT * FROM users WHERE id = ' + userId;
    db.query(sql, (err, result) => {
        if (err) return res.status(500).send(err);
        res.send(result);
    });
});

app.get('/search', (req, res) => {
    const username = req.query.name;
    const sql = "SELECT * FROM users WHERE username = '" + username + "'";
    db.query(sql, (err, result) => {
        if (err) return res.status(500).send(err);
        res.send(result);
    });
});

app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
