const pool = require('./backend/config/db');

async function migrate() {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('Adding images column to products table...');
        
        try {
            await connection.execute('ALTER TABLE products ADD COLUMN images JSON;');
            console.log('Column images (JSON) added successfully.');
        } catch (err) {
            if (err.code === 'ER_DUP_COLUMN_NAME') {
                console.log('Column images already exists.');
            } else {
                throw err;
            }
        }
        
        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration error:', err);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

migrate();
