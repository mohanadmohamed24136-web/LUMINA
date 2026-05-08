const pool = require('./backend/config/db');

async function checkAdmins() {
    let connection;
    try {
        connection = await pool.getConnection();
        const [users] = await connection.execute('SELECT username, email, role FROM users WHERE email IN (?, ?)', 
            ['lumina.future.ai@gmail.com', 'mohanad.mohamed.24136@gmail.com']);
        console.log('--- ADMIN ACCOUNTS STATUS ---');
        console.log(users);
    } catch (err) {
        console.error(err);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

checkAdmins();
