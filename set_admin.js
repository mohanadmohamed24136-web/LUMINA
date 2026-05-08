const pool = require('./backend/config/db');

async function setSecondAdmin() {
    const secondAdminEmail = 'mohanad.mohamed.24136@gmail.com';
    let connection;

    try {
        connection = await pool.getConnection();
        console.log('--- EXECUTING ADMIN ELEVATION PROTOCOL ---');

        // Check if user exists
        const [users] = await connection.execute('SELECT id FROM users WHERE email = ?', [secondAdminEmail]);
        
        if (users.length > 0) {
            // Update role to admin
            await connection.execute('UPDATE users SET role = "admin", isVerified = 1 WHERE email = ?', [secondAdminEmail]);
            console.log(`SUCCESS: ${secondAdminEmail} is now a Verified Admin.`);
        } else {
            console.log(`WARNING: ${secondAdminEmail} not found in database. Please register first, then I can make it Admin.`);
        }

    } catch (err) {
        console.error('PROTOCOL ERROR:', err);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

setSecondAdmin();
