require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const mysql = require('mysql2/promise');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Function to initialize the database and tables
const initializeDatabase = async () => {
    let connection;
    try {
        console.log('--- Initializing Database ---');
        if (process.env.DB_SKIP_CREATE !== 'true') {
            let bootstrapConnection;
            try {
                bootstrapConnection = await mysql.createConnection({
                    host: process.env.DB_HOST || 'localhost',
                    port: process.env.DB_PORT || 3306,
                    user: process.env.DB_USER || 'root',
                    password: process.env.DB_PASSWORD || '8527410'
                });
                await bootstrapConnection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'lumina_dbb'};`);
                await bootstrapConnection.end();
            } catch (err) {
                console.warn('DB Bootstrap Warn:', err.message);
            }
        }
        connection = await pool.getConnection();
        console.log('Connected to DB pool.');

        // Create tables
        await connection.query('CREATE TABLE IF NOT EXISTS users (id INT PRIMARY KEY AUTO_INCREMENT, username VARCHAR(255), email VARCHAR(255) UNIQUE, password VARCHAR(255), role VARCHAR(50), photo VARCHAR(255), phone VARCHAR(20), address VARCHAR(255), bio TEXT, subscription_tier VARCHAR(50) DEFAULT "free", isVerified TINYINT(1) DEFAULT 0, latitude DOUBLE, longitude DOUBLE);');
        await connection.query('CREATE TABLE IF NOT EXISTS products (id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255), architect VARCHAR(255), price DECIMAL(10, 2), img VARCHAR(255), images JSON, isSold TINYINT(1) DEFAULT 0, status VARCHAR(50) DEFAULT "pending", designerEmail VARCHAR(255), size_s VARCHAR(50), size_m VARCHAR(50), size_l VARCHAR(50), size_xl VARCHAR(50), size_xxl VARCHAR(50), quantity INT, colors VARCHAR(255), description TEXT, isAI TINYINT(1) DEFAULT 0);');
        await connection.query('CREATE TABLE IF NOT EXISTS orders (id INT PRIMARY KEY AUTO_INCREMENT, order_id VARCHAR(20) UNIQUE, user_email VARCHAR(255), total_amount DECIMAL(10, 2), status VARCHAR(50) DEFAULT "processing", shipping_name VARCHAR(255), shipping_phone VARCHAR(20), shipping_address TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);');
        await connection.query('CREATE TABLE IF NOT EXISTS order_items (id INT PRIMARY KEY AUTO_INCREMENT, order_id INT, product_id INT, product_name VARCHAR(255), price DECIMAL(10, 2), quantity INT, architect VARCHAR(255), designerEmail VARCHAR(255), selected_size VARCHAR(50), selected_color VARCHAR(50));');
        await connection.query('CREATE TABLE IF NOT EXISTS cart_items (id INT PRIMARY KEY AUTO_INCREMENT, user_email VARCHAR(255), product_id INT, name VARCHAR(255), price DECIMAL(10, 2), img VARCHAR(255), architect VARCHAR(255), quantity INT DEFAULT 1, selected_size VARCHAR(50), selected_color VARCHAR(50));');
        await connection.query('CREATE TABLE IF NOT EXISTS favorites (id INT PRIMARY KEY AUTO_INCREMENT, user_email VARCHAR(255), product_id INT, UNIQUE KEY user_product (user_email, product_id));');

        console.log('--- DB Init Success ---');
    } catch (err) {
        console.error('--- DB Error ---', err.message);
    } finally {
        if (connection) connection.release();
    }
};

// API Routes
const apiRoutes = require('./api');
app.use('/api', apiRoutes);

// Static files
app.use(express.static(path.join(__dirname, '.')));

// Fallback for SPA
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, 'index.html'));
    } else {
        res.status(404).json({ error: 'Not found' });
    }
});

// Run Init
initializeDatabase().catch(err => console.error(err));

// Listen
if (require.main === module) {
    app.listen(PORT, () => console.log(`Server on ${PORT}`));
}

module.exports = app;
