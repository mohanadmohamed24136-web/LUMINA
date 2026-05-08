const mysql = require('mysql2/promise');
require('dotenv').config({path: 'backend/.env'});

(async () => {
    try {
        const pool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });
        const [rows] = await pool.execute('SELECT COUNT(*) as count FROM users WHERE role = "designer"');
        console.log('Designers count:', rows[0].count);
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();
