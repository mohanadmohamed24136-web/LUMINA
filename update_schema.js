const pool = require('./backend/config/db');

async function updateSchema() {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('--- UPDATING DATABASE SCHEMA ---');

        // Add subscription_tier column if it doesn't exist
        const [columns] = await connection.execute('SHOW COLUMNS FROM users LIKE "subscription_tier"');
        if (columns.length === 0) {
            await connection.execute('ALTER TABLE users ADD COLUMN subscription_tier VARCHAR(50) DEFAULT "free" AFTER bio');
            console.log('Added subscription_tier column to users table.');
        } else {
            console.log('subscription_tier column already exists.');
        }

        console.log('--- SCHEMA UPDATE SUCCESSFUL ---');
    } catch (err) {
        console.error('SCHEMA UPDATE ERROR:', err);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

updateSchema();
