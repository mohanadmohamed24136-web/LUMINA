const pool = require('./backend/config/db');
const fs = require('fs');
const path = require('path');

async function fullCleanup() {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('--- Starting Full System Cleanup ---');

        // 1. Clear Database Tables (Order matters because of Foreign Keys)
        const tables = [
            'feedbacks',
            'order_items',
            'orders',
            'cart_items',
            'favorites',
            'products',
            'users'
        ];

        console.log('Clearing database tables...');
        await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
        for (const table of tables) {
            try {
                await connection.execute(`TRUNCATE TABLE ${table}`);
                console.log(`- Table ${table} cleared.`);
            } catch (e) {
                console.log(`- Note: Table ${table} could not be truncated (maybe doesn't exist yet).`);
            }
        }
        await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

        // 2. Clear Uploads Folder
        const uploadDir = path.join(__dirname, 'backend', 'uploads');
        console.log(`Cleaning uploads directory: ${uploadDir}`);
        
        if (fs.existsSync(uploadDir)) {
            const files = fs.readdirSync(uploadDir);
            for (const file of files) {
                if (file !== '.gitkeep') { // Keep gitkeep if exists
                    fs.unlinkSync(path.join(uploadDir, file));
                    console.log(`- Deleted file: ${file}`);
                }
            }
        }

        console.log('\n--- Cleanup Complete! System is now fresh. ---');
        console.log('IMPORTANT: You need to register again and I will make you Admin immediately.');

    } catch (err) {
        console.error('Cleanup Error:', err);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

fullCleanup();
