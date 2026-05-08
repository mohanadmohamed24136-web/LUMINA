const pool = require('./backend/config/db');
const bcrypt = require('bcryptjs');

async function ensureAdmins() {
    let connection;
    try {
        connection = await pool.getConnection();
        const admins = [
            { email: 'lumina.future.ai@gmail.com', name: 'LUMINA Admin' },
            { email: 'mohanad.mohamed.24136@gmail.com', name: 'Mohanad Mohamed Nabil' }
        ];

        // Default password for missing admin (Admin@123456)
        const defaultPassword = await bcrypt.hash('Admin@123456', 10);

        for (const admin of admins) {
            const [existing] = await connection.execute('SELECT id FROM users WHERE email = ?', [admin.email]);
            if (existing.length === 0) {
                console.log(`Creating missing admin: ${admin.email}`);
                await connection.execute(
                    'INSERT INTO users (username, email, password, role, isVerified) VALUES (?, ?, ?, ?, ?)',
                    [admin.name, admin.email, defaultPassword, 'admin', 1]
                );
            } else {
                console.log(`Admin exists, ensuring role: ${admin.email}`);
                await connection.execute('UPDATE users SET role = "admin", isVerified = 1 WHERE email = ?', [admin.email]);
            }
        }
        console.log('--- ADMIN CHECK COMPLETE ---');
    } catch (err) {
        console.error(err);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

ensureAdmins();
