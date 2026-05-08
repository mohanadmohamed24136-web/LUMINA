const pool = require('./backend/config/db');

async function migrate() {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('Adding status column to products table...');
        
        try {
            await connection.execute("ALTER TABLE products ADD COLUMN status VARCHAR(50) DEFAULT 'pending';");
            console.log('Column status added successfully.');
        } catch (err) {
            if (err.code === 'ER_DUP_COLUMN_NAME') {
                console.log('Column status already exists.');
            } else {
                throw err;
            }
        }
        
        // Ensure admin user exists
        const [admins] = await connection.execute('SELECT * FROM users WHERE role = "admin"');
        if (admins.length === 0) {
            console.log('No admin found. You might want to update a user to admin role.');
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
