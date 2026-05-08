const pool = require('./backend/config/db');

async function migrate() {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('Migrating database for subscription and weekly limits...');
        
        // Add subscription_tier, weeklyUploadCount, lastWeeklyReset
        const [columns] = await connection.execute('SHOW COLUMNS FROM users');
        const columnNames = columns.map(c => c.Field);

        if (!columnNames.includes('subscription_tier')) {
            await connection.execute("ALTER TABLE users ADD COLUMN subscription_tier ENUM('free', 'premium') DEFAULT 'free'");
            console.log('Added subscription_tier column');
        }
        if (!columnNames.includes('weeklyUploadCount')) {
            await connection.execute("ALTER TABLE users ADD COLUMN weeklyUploadCount INT DEFAULT 0");
            console.log('Added weeklyUploadCount column');
        }
        if (!columnNames.includes('lastWeeklyReset')) {
            await connection.execute("ALTER TABLE users ADD COLUMN lastWeeklyReset DATETIME DEFAULT CURRENT_TIMESTAMP");
            console.log('Added lastWeeklyReset column');
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
