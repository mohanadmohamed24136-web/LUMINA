const pool = require('./backend/config/db');

async function check() {
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.execute('DESCRIBE products');
        console.log(rows.map(r => r.Field));
    } catch (err) {
        console.error(err);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

check();
