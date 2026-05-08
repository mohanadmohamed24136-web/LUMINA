const pool = require('./backend/config/db');

async function migrate() {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('Adding missing columns to order_items table...');
        
        const columns = [
            'ALTER TABLE order_items ADD COLUMN architect VARCHAR(255);',
            'ALTER TABLE order_items ADD COLUMN designerEmail VARCHAR(255);'
        ];

        for (const sql of columns) {
            try {
                await connection.execute(sql);
                console.log(`Executed: ${sql}`);
            } catch (err) {
                if (err.code === 'ER_DUP_COLUMN_NAME') {
                    console.log(`Column already exists: ${sql.split(' ')[5]}`);
                } else {
                    throw err;
                }
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
