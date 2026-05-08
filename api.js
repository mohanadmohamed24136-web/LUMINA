const express = require('express');
const router = express.Router();
const pool = require('./db');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Configure Multer for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, '.'); // Upload to root
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});
const upload = multer({ storage });

// --- AUTH ROUTES ---

// Signup
router.post('/auth/signup', async (req, res) => {
    const { username, email, password, role, address, latitude, longitude } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await pool.query(
            'INSERT INTO users (username, email, password, role, address, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [username, email, hashedPassword, role, address, latitude, longitude]
        );
        res.status(201).json({ message: 'User created successfully', id: result.insertId });
    } catch (err) {
        console.error('Signup Error:', err);
        res.status(500).json({ error: 'Failed to create user. Email might already exist.' });
    }
});

// Login
router.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) return res.status(401).json({ error: 'Invalid email or password' });

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Invalid email or password' });

        res.json({ id: user.id, email: user.email, role: user.role, username: user.username });
    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get Profile
router.get('/auth/profile', async (req, res) => {
    const { id } = req.query;
    try {
        const [users] = await pool.query('SELECT id, username, email, role, photo, phone, address, bio FROM users WHERE id = ?', [id]);
        if (users.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(users[0]);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Update Profile (with photo)
router.patch('/auth/profile', upload.single('photo'), async (req, res) => {
    const { id, username, phone, address, bio } = req.body;
    let photoPath = null;
    if (req.file) photoPath = `/${req.file.filename}`;

    try {
        let query = 'UPDATE users SET username = ?, phone = ?, address = ?, bio = ?';
        let params = [username, phone, address, bio];

        if (photoPath) {
            query += ', photo = ?';
            params.push(photoPath);
        }

        query += ' WHERE id = ?';
        params.push(id);

        await pool.query(query, params);
        const [updated] = await pool.query('SELECT id, username, email, role, photo, phone, address, bio FROM users WHERE id = ?', [id]);
        res.json(updated[0]);
    } catch (err) {
        console.error('Update Profile Error:', err);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// --- PRODUCT ROUTES ---

// Get all products (approved only for general feed)
router.get('/products', async (req, res) => {
    try {
        const [products] = await pool.query(`
            SELECT p.*, u.phone, u.username as designerName 
            FROM products p 
            JOIN users u ON p.designerEmail = u.email 
            WHERE p.status = 'approved' OR p.status IS NULL
            ORDER BY p.id DESC
        `);
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get AI products
router.get('/ai/products', async (req, res) => {
    try {
        const [products] = await pool.query('SELECT * FROM products WHERE isAI = 1 AND status = "approved"');
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get single product
router.get('/products/:id', async (req, res) => {
    try {
        const [products] = await pool.query(`
            SELECT p.*, u.phone, u.address as designerAddress 
            FROM products p 
            JOIN users u ON p.designerEmail = u.email 
            WHERE p.id = ?
        `, [req.params.id]);
        if (products.length === 0) return res.status(404).json({ error: 'Product not found' });
        res.json(products[0]);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Add Product (Designer)
router.post('/products', upload.array('images', 5), async (req, res) => {
    const { name, price, architect, designerEmail, description, size_s, size_m, size_l, size_xl, size_xxl, quantity, colors, isAI } = req.body;
    
    const imagePaths = req.files ? req.files.map(f => `/${f.filename}`) : [];
    const mainImg = imagePaths.length > 0 ? imagePaths[0] : null;

    try {
        const [result] = await pool.query(
            `INSERT INTO products (name, price, architect, designerEmail, description, img, images, size_s, size_m, size_l, size_xl, size_xxl, quantity, colors, isAI, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [name, price, architect, designerEmail, description, mainImg, JSON.stringify(imagePaths), size_s, size_m, size_l, size_xl, size_xxl, quantity, colors, isAI ? 1 : 0]
        );
        res.status(201).json({ id: result.insertId, message: 'Product submitted for approval' });
    } catch (err) {
        console.error('Add Product Error:', err);
        res.status(500).json({ error: 'Failed to add product' });
    }
});

// Delete Product
router.delete('/products/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
        res.json({ message: 'Product deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Mark as Sold
router.patch('/products/:id/sell', async (req, res) => {
    try {
        await pool.query('UPDATE products SET isSold = 1 WHERE id = ?', [req.params.id]);
        res.json({ message: 'Product marked as sold' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// --- FAVORITES ROUTES ---
router.get('/favorites/:email', async (req, res) => {
    try {
        const [favs] = await pool.query('SELECT product_id FROM favorites WHERE user_email = ?', [req.params.email]);
        res.json(favs.map(f => String(f.product_id)));
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/favorites/toggle', async (req, res) => {
    const { user_email, product_id } = req.body;
    try {
        const [existing] = await pool.query('SELECT id FROM favorites WHERE user_email = ? AND product_id = ?', [user_email, product_id]);
        if (existing.length > 0) {
            await pool.query('DELETE FROM favorites WHERE id = ?', [existing[0].id]);
        } else {
            await pool.query('INSERT INTO favorites (user_email, product_id) VALUES (?, ?)', [user_email, product_id]);
        }
        const [favs] = await pool.query('SELECT product_id FROM favorites WHERE user_email = ?', [user_email]);
        res.json(favs.map(f => String(f.product_id)));
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// --- CART ROUTES ---
router.get('/cart/:email', async (req, res) => {
    try {
        const [items] = await pool.query('SELECT * FROM cart_items WHERE user_email = ?', [req.params.email]);
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/cart', async (req, res) => {
    const { user_email, product_id, name, price, img, architect, quantity, selected_size, selected_color } = req.body;
    try {
        await pool.query(
            'INSERT INTO cart_items (user_email, product_id, name, price, img, architect, quantity, selected_size, selected_color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [user_email, product_id, name, price, img, architect, quantity, selected_size, selected_color]
        );
        const [items] = await pool.query('SELECT * FROM cart_items WHERE user_email = ?', [user_email]);
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.delete('/cart/:id', async (req, res) => {
    try {
        const [item] = await pool.query('SELECT user_email FROM cart_items WHERE id = ?', [req.params.id]);
        if (item.length === 0) return res.status(404).json({ error: 'Item not found' });
        
        const email = item[0].user_email;
        await pool.query('DELETE FROM cart_items WHERE id = ?', [req.params.id]);
        
        const [items] = await pool.query('SELECT * FROM cart_items WHERE user_email = ?', [email]);
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// --- ORDER ROUTES ---
router.post('/orders', async (req, res) => {
    const { user_email, total_amount, shipping_name, shipping_phone, shipping_address, items } = req.body;
    const order_id = `LUM-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
    
    try {
        const [result] = await pool.query(
            'INSERT INTO orders (order_id, user_email, total_amount, shipping_name, shipping_phone, shipping_address) VALUES (?, ?, ?, ?, ?, ?)',
            [order_id, user_email, total_amount, shipping_name, shipping_phone, shipping_address]
        );
        const db_order_id = result.insertId;

        for (const item of items) {
            await pool.query(
                'INSERT INTO order_items (order_id, product_id, product_name, price, quantity, architect, designerEmail, selected_size, selected_color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [db_order_id, item.product_id, item.name, item.price, item.quantity, item.architect, item.designerEmail, item.selected_size, item.selected_color]
            );
        }

        // Clear cart
        await pool.query('DELETE FROM cart_items WHERE user_email = ?', [user_email]);
        
        res.status(201).json({ order_id, message: 'Order placed successfully' });
    } catch (err) {
        console.error('Order Error:', err);
        res.status(500).json({ error: 'Failed to place order' });
    }
});

router.get('/orders/:email', async (req, res) => {
    try {
        const [orders] = await pool.query('SELECT * FROM orders WHERE user_email = ? ORDER BY created_at DESC', [req.params.email]);
        for (let order of orders) {
            const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
            order.items = items;
        }
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// --- ADMIN ROUTES ---
router.get('/admin/products', async (req, res) => {
    try {
        const [products] = await pool.query('SELECT * FROM products ORDER BY id DESC');
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.patch('/admin/products/:id/status', async (req, res) => {
    const { status } = req.body;
    try {
        await pool.query('UPDATE products SET status = ? WHERE id = ?', [status, req.params.id]);
        res.json({ message: 'Product status updated' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
