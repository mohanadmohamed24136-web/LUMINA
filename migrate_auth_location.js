const pool = require('./backend/config/db');

async function migrate() {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('Migrating database for Location and Verification...');
        
        const [columns] = await connection.execute('SHOW COLUMNS FROM users');
        const columnNames = columns.map(c => c.Field);

        if (!columnNames.includes('latitude')) {
            await connection.execute("ALTER TABLE users ADD COLUMN latitude DOUBLE");
            console.log('Added latitude column');
        }
        if (!columnNames.includes('longitude')) {
            await connection.execute("ALTER TABLE users ADD COLUMN longitude DOUBLE");
            console.log('Added longitude column');
        }
        if (!columnNames.includes('isVerified')) {
            await connection.execute("ALTER TABLE users ADD COLUMN isVerified BOOLEAN DEFAULT FALSE");
            console.log('Added isVerified column');
        }
        if (!columnNames.includes('verificationToken')) {
            await connection.execute("ALTER TABLE users ADD COLUMN verificationToken VARCHAR(255)");
            console.log('Added verificationToken column');
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
