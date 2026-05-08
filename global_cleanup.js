const pool = require('./backend/config/db');
const fs = require('fs');
const path = require('path');

async function fullCleanup() {
    const admin1 = 'lumina.future.ai@gmail.com';
    const admin2 = 'mohanad.mohamed.24136@gmail.com';
    let connection;

    try {
        connection = await pool.getConnection();
        console.log('--- STARTING GLOBAL CLEANUP PROTOCOL ---');

        // Disable foreign key checks to allow truncation
        await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

        // Clear tables
        console.log('Purging database records...');
        await connection.execute('TRUNCATE TABLE order_items');
        await connection.execute('TRUNCATE TABLE orders');
        await connection.execute('TRUNCATE TABLE feedbacks');
        await connection.execute('TRUNCATE TABLE favorites');
        await connection.execute('TRUNCATE TABLE products');
        await connection.execute('TRUNCATE TABLE transactions'); // Also clear transactions
        
        // Delete all users except admins
        console.log('Cleaning user database...');
        await connection.execute('DELETE FROM users WHERE email NOT IN (?, ?)', [admin1, admin2]);

        // Reset auto-increments
        await connection.execute('ALTER TABLE users AUTO_INCREMENT = 1');
        
        await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
        console.log('Database cleanup completed.');

        // Clear uploads folder
        const uploadsPath = path.join(__dirname, 'backend', 'uploads');
        console.log(`Clearing assets in: ${uploadsPath}`);
        
        if (fs.existsSync(uploadsPath)) {
            const files = fs.readdirSync(uploadsPath);
            for (const file of files) {
                const filePath = path.join(uploadsPath, file);
                if (fs.lstatSync(filePath).isFile()) {
                    fs.unlinkSync(filePath);
                } else if (fs.lstatSync(filePath).isDirectory()) {
                    fs.rmSync(filePath, { recursive: true, force: true });
                }
            }
        }
        console.log('Asset storage cleared.');
        console.log('--- CLEANUP SUCCESSFUL: SYSTEM RESET TO NEURAL ZERO ---');

    } catch (err) {
        console.error('CRITICAL CLEANUP ERROR:', err);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

fullCleanup();
