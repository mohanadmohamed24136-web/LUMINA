const pool = require('./backend/config/db');

async function verifyAndAdmin(email) {
    try {
        await pool.execute('UPDATE users SET isVerified = 1, role = "admin" WHERE email = ?', [email]);
        console.log(`User ${email} is now VERIFIED and ADMIN.`);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

verifyAndAdmin('lumina.future.ai@gmail.com');
