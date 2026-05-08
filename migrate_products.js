const pool = require('./backend/config/db');

async function migrate() {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('Adding missing columns to products table...');
        
        const columns = [
            'ALTER TABLE products ADD COLUMN size_s VARCHAR(255);',
            'ALTER TABLE products ADD COLUMN size_m VARCHAR(255);',
            'ALTER TABLE products ADD COLUMN size_l VARCHAR(255);',
            'ALTER TABLE products ADD COLUMN size_xl VARCHAR(255);',
            'ALTER TABLE products ADD COLUMN size_xxl VARCHAR(255);',
            'ALTER TABLE products ADD COLUMN description TEXT;'
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
