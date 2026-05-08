const pool = require('./backend/config/db');

async function migrate() {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('Migrating database for feedbacks and order sizes...');
        
        // 1. Create feedbacks table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS feedbacks (
                id INT PRIMARY KEY AUTO_INCREMENT,
                product_id INT NOT NULL,
                user_email VARCHAR(255) NOT NULL,
                user_name VARCHAR(255) NOT NULL,
                rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
                comment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
                FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
            );
        `);
        console.log('Ensured feedbacks table exists.');

        // 2. Add selected_size to order_items
        const [orderItemColumns] = await connection.execute('SHOW COLUMNS FROM order_items');
        if (!orderItemColumns.map(c => c.Field).includes('selected_size')) {
            await connection.execute('ALTER TABLE order_items ADD COLUMN selected_size VARCHAR(50);');
            console.log('Added selected_size column to order_items');
        }

        // 3. Add selected_size to cart_items
        const [cartItemColumns] = await connection.execute('SHOW COLUMNS FROM cart_items');
        if (!cartItemColumns.map(c => c.Field).includes('selected_size')) {
            await connection.execute('ALTER TABLE cart_items ADD COLUMN selected_size VARCHAR(50);');
            console.log('Added selected_size column to cart_items');
        }
        
        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration error:', err);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

migrate();
