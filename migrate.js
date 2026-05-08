const pool = require('./backend/config/db');

async function migrate() {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('Adding isAI column to products table...');
        await connection.execute('ALTER TABLE products ADD COLUMN isAI BOOLEAN DEFAULT FALSE;');
        console.log('Column added successfully.');
    } catch (err) {
        if (err.code === 'ER_DUP_COLUMN_NAME') {
            console.log('Column isAI already exists.');
        } else {
            console.error('Migration error:', err);
        }
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

migrate();
