const pool = require('./backend/config/db');

async function check() {
    let connection;
    try {
        connection = await pool.getConnection();
        const [[{userCount}]] = await connection.execute('SELECT COUNT(*) as userCount FROM users');
        const [[{productCount}]] = await connection.execute('SELECT COUNT(*) as productCount FROM products');
        const [admins] = await connection.execute('SELECT email, role FROM users WHERE role = "admin"');
        
        console.log(`Total Users: ${userCount}`);
        console.log(`Total Products: ${productCount}`);
        console.log('Admins:', admins);
    } catch (err) {
        console.error(err);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

check();
