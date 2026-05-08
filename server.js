require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const mysql = require('mysql2/promise');
const pool = require('./config/db'); // Import the MySQL connection pool

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const fs = require('fs');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Request Logger
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    next();
});

// Function to initialize the database and tables
const initializeDatabase = async () => {
    let connection;
    try {
        console.log('--- Initializing Database ---');

        // Skip DB creation if DB_SKIP_CREATE is set (common in managed hosting)
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
                console.log(`Ensured database ${process.env.DB_NAME || 'lumina_dbb'} exists.`);
                await bootstrapConnection.end();
            } catch (err) {
                console.warn('Could not ensure database exists, attempting to connect directly:', err.message);
            }
        }

        connection = await pool.getConnection();
        console.log(`Connected to database ${process.env.DB_NAME || 'lumina_dbb'}.`);

        // Create users table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT PRIMARY KEY AUTO_INCREMENT,
                username VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'user',
                photo VARCHAR(255) NULL,
                phone VARCHAR(20) NULL,
                address VARCHAR(255) NULL,
                bio TEXT NULL,
                subscription_tier VARCHAR(50) DEFAULT 'free',
                productsUploadedToday INT DEFAULT 0,
                lastUploadDate DATETIME,
                isVerified TINYINT(1) DEFAULT 0,
                verificationToken VARCHAR(255) NULL,
                latitude DOUBLE NULL,
                longitude DOUBLE NULL
            );
        `);
        console.log('Ensured users table exists.');

        // Create products table with status
        await connection.query(`
            CREATE TABLE IF NOT EXISTS products (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(255) NOT NULL,
                architect VARCHAR(255) NOT NULL,
                price DECIMAL(10, 2) NOT NULL,
                date VARCHAR(255),
                img VARCHAR(255),
                images JSON,
                isSold TINYINT(1) DEFAULT 0,
                status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
                designerEmail VARCHAR(255) NOT NULL,
                size_s VARCHAR(50) DEFAULT '',
                size_m VARCHAR(50) DEFAULT '',
                size_l VARCHAR(50) DEFAULT '',
                size_xl VARCHAR(50) DEFAULT '',
                size_xxl VARCHAR(50) DEFAULT '',
                quantity INT DEFAULT 1,
                colors VARCHAR(255) DEFAULT '',
                description TEXT,
                isAI TINYINT(1) DEFAULT 0,
                FOREIGN KEY (designerEmail) REFERENCES users(email) ON DELETE CASCADE
            );
        `);
        console.log('Ensured products table exists.');

        // Create orders table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id INT PRIMARY KEY AUTO_INCREMENT,
                order_id VARCHAR(20) UNIQUE NOT NULL,
                user_email VARCHAR(255) NOT NULL,
                total_amount DECIMAL(10, 2) NOT NULL,
                status VARCHAR(50) DEFAULT 'processing',
                shipping_name VARCHAR(255),
                shipping_phone VARCHAR(20),
                shipping_address TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
            );
        `);
        console.log('Ensured orders table exists.');

        // Create order_items table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS order_items (
                id INT PRIMARY KEY AUTO_INCREMENT,
                order_id INT,
                product_id INT,
                product_name VARCHAR(255),
                price DECIMAL(10, 2),
                quantity INT,
                architect VARCHAR(255),
                designerEmail VARCHAR(255),
                selected_size VARCHAR(50),
                selected_color VARCHAR(50) NULL,
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
            );
        `);
        console.log('Ensured order_items table exists.');

        // Create feedbacks table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS feedbacks (
                id INT PRIMARY KEY AUTO_INCREMENT,
                product_id INT NOT NULL,
                user_email VARCHAR(255) NOT NULL,
                user_name VARCHAR(255) NOT NULL,
                rating INT NOT NULL,
                comment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
                FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
            );
        `);
        console.log('Ensured feedbacks table exists.');

        // Create cart_items table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS cart_items (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_email VARCHAR(255) NOT NULL,
                product_id INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                price DECIMAL(10, 2) NOT NULL,
                img VARCHAR(255),
                architect VARCHAR(255),
                quantity INT DEFAULT 1,
                selected_size VARCHAR(50) NULL,
                selected_color VARCHAR(50) NULL,
                FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
            );
        `);
        console.log('Ensured cart_items table exists.');

        // Create favorites table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS favorites (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_email VARCHAR(255) NOT NULL,
                product_id INT NOT NULL,
                UNIQUE KEY user_product (user_email, product_id),
                FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
            );
        `);
        console.log('Ensured favorites table exists.');

        // Create transactions table for real payments
        await connection.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_email VARCHAR(255) NOT NULL,
                amount DECIMAL(10, 2) NOT NULL,
                currency VARCHAR(10) DEFAULT 'USD',
                payment_method VARCHAR(50) DEFAULT 'Credit Card',
                transaction_type VARCHAR(50) DEFAULT 'subscription',
                status VARCHAR(50) DEFAULT 'completed',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Ensured transactions table exists.');

        console.log('--- Database Initialization Complete! ---');
    } catch (err) {
        console.error('--- DATABASE ERROR ---');
        console.error('Problem connecting to MySQL. Please check:');
        console.error('1. Is MySQL Workbench/Server running?');
        console.error('2. Are the credentials in backend/.env correct?');
        console.error('3. Error details:', err.message);
        console.error('-----------------------');
        process.exit(1); // Exit if database initialization fails
    } finally {
        if (bootstrapConnection) {
            try {
                await bootstrapConnection.end();
            } catch {}
        }
        if (connection) connection.release();
    }
};

// Serve the LUMINA static site (the frontend)
app.use(express.static(path.join(__dirname, '..', 'LUMINA')));

// API Routes
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// Fallback to index.html for any SPA routes if needed
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'LUMINA', 'index.html'));
});

// Initialize database (Async, will run in background on Vercel)
initializeDatabase().catch(err => console.error('Initial DB Error:', err));

// Start Server only if not running as a module (for local testing)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`LUMINA Server running on http://localhost:${PORT}`);
        console.log('To view the site, open: http://localhost:3000');
    });
}

module.exports = app; // Export app for Vercel serverless functions
