const pool = require('./backend/config/db');

async function verify() {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('--- VERIFYING CLEANUP STATUS ---');

        const [users] = await connection.execute('SELECT username, email, role FROM users');
        console.log('Remaining Users:', users);

        const [products] = await connection.execute('SELECT COUNT(*) as count FROM products');
        console.log('Products Count:', products[0].count);

        const [orders] = await connection.execute('SELECT COUNT(*) as count FROM orders');
        console.log('Orders Count:', orders[0].count);

        const [feedbacks] = await connection.execute('SELECT COUNT(*) as count FROM feedbacks');
        console.log('Feedbacks Count:', feedbacks[0].count);

    } catch (err) {
        console.error(err);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

verify();
