const pool = require('./backend/config/db');

async function updateSchema() {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('--- UPDATING DATABASE SCHEMA ---');

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

        console.log('--- SCHEMA UPDATE SUCCESSFUL ---');
    } catch (err) {
        console.error('SCHEMA UPDATE ERROR:', err);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

updateSchema();