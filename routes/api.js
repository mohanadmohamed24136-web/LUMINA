const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db'); // Import the MySQL connection pool
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');

// Setup Nodemailer for Gmail (or any real SMTP)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-app-password'
    }
});

// Setup Multer for uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '..', 'uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Error handling middleware for Multer
const uploadMiddleware = (req, res, next) => {
    // Using .any() to be permissive and debug what fields are being sent
    upload.any()(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            console.error('Multer Error:', err);
            return res.status(400).json({ error: `Upload error: ${err.message}` });
        } else if (err) {
            console.error('Unknown Upload Error:', err);
            return res.status(500).json({ error: 'An unknown error occurred during upload.' });
        }
        next();
    });
};

// --- AUTH ROUTES ---
router.post('/auth/signup', async (req, res) => {
    console.log('--- Signup Attempt ---');
    let connection;
    try {
        const { username, email, password, role, address, latitude, longitude } = req.body;
        console.log(`User: ${username}, Email: ${email}, Role: ${role}`);
        
        connection = await pool.getConnection();
        
        // Check if email already exists
        const [existingUsers] = await connection.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            console.log('Error: Email already exists');
            return res.status(400).json({ error: 'Email already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationToken = uuidv4();

        const newUser = {
            username,
            email,
            password: hashedPassword,
            role: role || 'user',
            photo: null,
            productsUploadedToday: 0,
            lastUploadDate: new Date().toISOString().slice(0, 19).replace('T', ' '),
            address: address || '',
            latitude: latitude || null,
            longitude: longitude || null,
            isVerified: 0,
            verificationToken: verificationToken
        };

        const [result] = await connection.execute(
            'INSERT INTO users (username, email, password, role, photo, productsUploadedToday, lastUploadDate, address, latitude, longitude, isVerified, verificationToken) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [newUser.username, newUser.email, newUser.password, newUser.role, newUser.photo, newUser.productsUploadedToday, newUser.lastUploadDate, newUser.address, newUser.latitude, newUser.longitude, newUser.isVerified, newUser.verificationToken]
        );

        console.log('Signup Successful! Verification email sent.');
        
        const protocol = req.protocol;
        const host = req.get('host');
        const verificationLink = `${protocol}://${host}/api/auth/verify?token=${verificationToken}`;
        
        // Send Real Email
        const mailOptions = {
            from: `"LUMINA Support" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Verify Your LUMINA Account',
            html: `
                <div style="font-family: sans-serif; padding: 40px; background: #050505; color: white; border-radius: 20px;">
                    <h1 style="color: #00F0FF; text-transform: uppercase;">LUMINA</h1>
                    <p style="font-size: 16px;">Welcome to the future of fashion. Please verify your account to start your journey.</p>
                    <a href="${verificationLink}" style="display: inline-block; padding: 15px 30px; background: #00F0FF; color: black; text-decoration: none; font-weight: bold; border-radius: 10px; margin-top: 20px;">Verify Account</a>
                    <p style="margin-top: 30px; color: #666; font-size: 12px;">Need help? Contact our Master Protocol at lumina.future.ai@gmail.com or WhatsApp: +20 104 077 7944</p>
                    <p style="margin-top: 10px; color: #666; font-size: 12px;">If you didn't create an account, please ignore this email.</p>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log('Email sent successfully to:', email);
        } catch (mailErr) {
            console.error('Mail Send Error:', mailErr);
            // Don't fail signup if mail fails in dev, but log it
        }

        console.log(`\n\n=================================================`);
        console.log(`🚀 [DEVELOPMENT] VERIFICATION LINK FOR: ${email}`);
        console.log(`👉 ${verificationLink}`);
        console.log(`=================================================\n\n`);

        res.status(201).json({ 
            message: 'Signup successful.', 
            devLink: verificationLink // Sending link to frontend ONLY in dev mode
        });
    } catch (err) {
        console.error('Signup Error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

router.get('/auth/verify', async (req, res) => {
    const { token } = req.query;
    let connection;
    try {
        connection = await pool.getConnection();
        const [users] = await connection.execute('SELECT id FROM users WHERE verificationToken = ?', [token]);
        
        if (users.length === 0) {
            return res.send('<h1>Invalid Verification Link</h1><p>The link is expired or invalid.</p>');
        }

        await connection.execute('UPDATE users SET isVerified = 1, verificationToken = NULL WHERE verificationToken = ?', [token]);
        
        res.send('<h1>Account Verified!</h1><p>Your LUMINA account has been activated. You can now <a href="/login.html">Log In</a>.</p>');
    } catch (err) {
        console.error('Verification Error:', err);
        res.status(500).send('Internal Server Error');
    } finally {
        if (connection) connection.release();
    }
});

router.post('/auth/login', async (req, res) => {
    console.log('--- Login Attempt ---');
    let connection;
    try {
        const { email, password } = req.body;
        console.log(`Email: ${email}`);
        
        connection = await pool.getConnection();
        const [users] = await connection.execute('SELECT * FROM users WHERE email = ?', [email]);
        
        if (users.length === 0) {
            console.log('Error: Invalid credentials (email not found)');
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users[0];

        if (!user.isVerified) {
            console.log('Error: Account not verified');
            return res.status(403).json({ error: 'Please verify your email before logging in.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            console.log('Error: Invalid credentials (password mismatch)');
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        console.log('Login Successful!');
        delete user.password;
        res.json(user);
    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

// Get Profile API
router.get('/auth/profile', async (req, res) => {
    let connection;
    try {
        const { id } = req.query;
        if (!id) return res.status(400).json({ error: 'User ID is required' });

        connection = await pool.getConnection();
        const [users] = await connection.execute('SELECT * FROM users WHERE id = ?', [id]);
        
        if (users.length === 0) return res.status(404).json({ error: 'User not found' });
        
        const user = users[0];
        delete user.password;
        res.json(user);
    } catch (err) {
        console.error('Get Profile Error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

// Update Profile API
router.patch('/auth/profile', upload.single('photo'), async (req, res) => {
    console.log('--- Profile Update Attempt ---');
    let connection;
    try {
        const { id, username, email, phone, address, bio } = req.body;
        const photo = req.file ? `/uploads/${req.file.filename}` : null;

        connection = await pool.getConnection();

        // Get current user data to check if phone/address are already set
        const [currentUsers] = await connection.execute('SELECT phone, address FROM users WHERE id = ?', [id]);
        if (currentUsers.length === 0) return res.status(404).json({ error: 'User not found' });
        
        const currentUser = currentUsers[0];

        // Construct the update query dynamically
        let updateFields = ['username = ?', 'email = ?', 'bio = ?', 'phone = ?', 'address = ?'];
        let params = [username, email, bio || null, phone || null, address || null];

        if (photo) {
            updateFields.push('photo = ?');
            params.push(photo);
        }

        let query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
        params.push(id);

        console.log('Executing query:', query);
        const [result] = await connection.execute(query, params);

        // Get updated user data
        const [updatedUsers] = await connection.execute('SELECT * FROM users WHERE id = ?', [id]);
        const user = updatedUsers[0];
        delete user.password;

        console.log('Profile Updated Successfully in Database!');
        res.json(user);
    } catch (err) {
        console.error('Profile Update Error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

// --- PRODUCT ROUTES ---
router.get('/products', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [products] = await connection.execute(`
            SELECT p.*, u.phone,
            (SELECT AVG(rating) FROM feedbacks WHERE product_id = p.id) as avg_rating
            FROM products p 
            LEFT JOIN users u ON p.designerEmail = u.email
            WHERE p.status = 'approved'
            ORDER BY p.id DESC
        `);
        res.json(products);
    } catch (err) {
        console.error('Get Products Error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

router.post('/products', uploadMiddleware, async (req, res) => {
    console.log('--- Product Upload Attempt ---');
    console.log('Body:', req.body);
    console.log('Files:', req.files);
    let connection;
    try {
        const { name, architect, price, email, location, size_s, size_m, size_l, size_xl, size_xxl, quantity, colors, description } = req.body;
        
        // Comprehensive Backend Validation
        if (!name || !price || !email || !req.files || req.files.length === 0) {
            console.log('Error: Missing core fields:', { name, price, email, hasFiles: !!req.files });
            return res.status(400).json({ error: 'Product name, price, and at least one image are required.' });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Combined query to get user and lock the row for update if needed
        const [users] = await connection.execute('SELECT * FROM users WHERE email = ? FOR UPDATE', [email]);
        if (users.length === 0) {
            console.log(`Error: User with email ${email} not found`);
            await connection.rollback();
            return res.status(404).json({ error: 'User not found' });
        }

        const user = users[0];
        console.log(`Found user: ${user.username} (ID: ${user.id})`);

        // --- WEEKLY LIMIT LOGIC ---
        const now = new Date();
        const lastReset = new Date(user.lastWeeklyReset || now);
        const diffTime = Math.abs(now - lastReset);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        let weeklyUploadCount = user.weeklyUploadCount || 0;
        let lastWeeklyReset = user.lastWeeklyReset || now.toISOString().slice(0, 19).replace('T', ' ');

        // Reset weekly counter if more than 7 days passed
        if (diffDays > 7) {
            weeklyUploadCount = 0;
            lastWeeklyReset = now.toISOString().slice(0, 19).replace('T', ' ');
        }

        // Check Limit: Free users = 7/week, Premium = Unlimited (or much higher)
        const weeklyLimit = user.subscription_tier === 'premium' ? 1000 : 7;
        
        if (weeklyUploadCount >= weeklyLimit) {
            console.log(`Error: Weekly limit reached for ${user.subscription_tier} user`);
            await connection.rollback();
            return res.status(403).json({ 
                error: `Weekly limit of ${weeklyLimit} uploads reached. Upgrade to Premium for unlimited uploads!` 
            });
        }

        const today = new Date().toISOString().split('T')[0];
        let lastDate = null;
        try {
            if (user.lastUploadDate) {
                lastDate = new Date(user.lastUploadDate).toISOString().split('T')[0];
            }
        } catch (e) {
            console.error('Date parsing error:', e);
        }

        let productsUploadedToday = user.productsUploadedToday || 0;
        let lastUploadDate = user.lastUploadDate || now.toISOString().slice(0, 19).replace('T', ' ');

        if (today !== lastDate) {
            productsUploadedToday = 0;
            lastUploadDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
        }

        if (productsUploadedToday >= 10) {
            console.log('Error: Daily limit reached');
            await connection.rollback();
            return res.status(403).json({ error: 'Daily limit of 10 uploads reached' });
        }

        const finalName = location ? `${name} (${location})` : name;
        
        // Handle multiple images from any field
        if (!req.files || req.files.length === 0) {
            console.log('Error: No files found in req.files');
            await connection.rollback();
            return res.status(400).json({ error: 'At least one image is required.' });
        }

        console.log('Files received:', req.files.map(f => f.fieldname));

        const imageUrls = req.files.map(file => `/uploads/${file.filename}`);
        const primaryImg = imageUrls[0]; // First image is the main one
        const imagesJson = JSON.stringify(imageUrls);

        const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        console.log('Inserting product...');
        const [result] = await connection.execute(
            'INSERT INTO products (name, architect, price, date, img, images, isSold, designerEmail, size_s, size_m, size_l, size_xl, size_xxl, quantity, colors, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [finalName, architect, parseFloat(price), dateStr, primaryImg, imagesJson, 0, email, size_s || '', size_m || '', size_l || '', size_xl || '', size_xxl || '', parseInt(quantity) || 1, colors || '', description || '']
        );
        
        productsUploadedToday += 1;
        weeklyUploadCount += 1;
        
        await connection.execute(
            'UPDATE users SET productsUploadedToday = ?, lastUploadDate = ?, weeklyUploadCount = ?, lastWeeklyReset = ? WHERE id = ?',
            [productsUploadedToday, lastUploadDate, weeklyUploadCount, lastWeeklyReset, user.id]
        );
        
        await connection.commit();
        console.log('Upload Successful! Product ID:', result.insertId);

        // Prepare the updated user object without an extra SELECT
        const updatedUser = { ...user, productsUploadedToday, lastUploadDate, weeklyUploadCount, lastWeeklyReset };
        delete updatedUser.password;
        
        res.status(201).json({ 
            product: { 
                id: result.insertId, 
                name: finalName, 
                architect, 
                price: parseFloat(price), 
                date: dateStr, 
                img: primaryImg, 
                images: imageUrls,
                isSold: 0, 
                designerEmail: email,
                description
            }, 
            user: updatedUser 
        });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error('Product Upload Error Details:', {
            message: err.message,
            stack: err.stack,
            code: err.code
        });
        res.status(500).json({ 
            error: err.message || 'Internal Server Error during upload',
            details: err.code
        });
    } finally {
        if (connection) connection.release();
    }
});

// --- AI PRODUCT ROUTES ---
router.post('/ai/publish', async (req, res) => {
    let connection;
    try {
        const { name, architect, price, email, img, description } = req.body;
        
        connection = await pool.getConnection();

        const newProduct = {
            name: name,
            architect: architect || 'LUMINA AI',
            price: parseFloat(price),
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            img: img,
            isSold: 0,
            status: 'approved',
            designerEmail: email,
            size_s: 'Available',
            size_m: 'Available',
            size_l: 'Available',
            size_xl: 'Available',
            size_xxl: 'Available',
            description: description || '',
            isAI: 1
        };

        const [result] = await connection.execute(
            'INSERT INTO products (name, architect, price, date, img, isSold, status, designerEmail, size_s, size_m, size_l, size_xl, size_xxl, description, isAI) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [newProduct.name, newProduct.architect, newProduct.price, newProduct.date, newProduct.img, newProduct.isSold, newProduct.status, newProduct.designerEmail, newProduct.size_s, newProduct.size_m, newProduct.size_l, newProduct.size_xl, newProduct.size_xxl, newProduct.description, newProduct.isAI]
        );
        
        res.status(201).json({ id: result.insertId, ...newProduct });
    } catch (err) {
        console.error('AI Product Publish Error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

router.get('/ai/products', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [products] = await connection.execute('SELECT * FROM products WHERE isAI = 1');
        res.json(products);
    } catch (err) {
        console.error('Get AI Products Error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

router.patch('/products/:id/sell', async (req, res) => {
    let connection;
    try {
        const { id } = req.params;
        connection = await pool.getConnection();
        await connection.execute('UPDATE products SET isSold = 1 WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Sell Product Error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

// --- ADMIN ROUTES ---
router.get('/admin/stats', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [[{ revenue }]] = await connection.execute('SELECT IFNULL(SUM(total_amount), 0) as revenue FROM orders WHERE status != "cancelled"');
        const [[{ orders }]] = await connection.execute('SELECT COUNT(*) as orders FROM orders');
        const [[{ designers }]] = await connection.execute('SELECT COUNT(*) as designers FROM users WHERE role = "designer"');
        const [[{ pending }]] = await connection.execute('SELECT COUNT(*) as pending FROM products WHERE status = "pending"');
        res.json({ revenue, orders, designers, pending });
    } catch (err) {
        console.error('Admin Stats Error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

router.get('/admin/products', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [products] = await connection.execute('SELECT * FROM products ORDER BY id DESC');
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

router.put('/admin/products/:id/status', async (req, res) => {
    let connection;
    try {
        const { id } = req.params;
        const { status } = req.body;
        connection = await pool.getConnection();
        await connection.execute('UPDATE products SET status = ? WHERE id = ?', [status, id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

router.get('/admin/orders', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [orders] = await connection.execute('SELECT * FROM orders ORDER BY id DESC');
        for (let order of orders) {
            const [items] = await connection.execute('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
            order.items = items;
        }
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

router.put('/admin/orders/:id/status', async (req, res) => {
    let connection;
    try {
        const { id } = req.params;
        const { status } = req.body;
        connection = await pool.getConnection();
        await connection.execute('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

router.get('/admin/designers', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [designers] = await connection.execute('SELECT id, username, email, phone, bio, photo, address, productsUploadedToday, subscription_tier FROM users WHERE role = "designer" ORDER BY id DESC');
        res.json(designers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

router.get('/admin/users', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [users] = await connection.execute('SELECT id, username, email, role, subscription_tier, isVerified, created_at FROM users WHERE role != "admin" ORDER BY id DESC');
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

router.delete('/admin/users/:id', async (req, res) => {
    let connection;
    try {
        const { id } = req.params;
        connection = await pool.getConnection();
        if (id == 1) return res.status(403).json({ error: 'Root administrator cannot be deleted' });
        await connection.execute('DELETE FROM users WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

router.get('/admin/feedbacks', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [feedbacks] = await connection.execute(`
            SELECT f.*, u.username as user_name, p.name as product_name 
            FROM feedbacks f
            LEFT JOIN users u ON f.user_email = u.email
            LEFT JOIN products p ON f.product_id = p.id
            ORDER BY f.id DESC
        `);
        res.json(feedbacks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

router.delete('/admin/feedbacks/:id', async (req, res) => {
    let connection;
    try {
        const { id } = req.params;
        connection = await pool.getConnection();
        await connection.execute('DELETE FROM feedbacks WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

router.get('/admin/finance', async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        const [transactions] = await connection.execute('SELECT * FROM transactions ORDER BY id DESC LIMIT 100');
        const [[stats]] = await connection.execute('SELECT IFNULL(SUM(amount), 0) as total_revenue, COUNT(*) as total_transactions FROM transactions');
        res.json({ transactions, stats });
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

// --- SUBSCRIPTION ROUTES ---
router.post('/auth/upgrade', async (req, res) => {
    let connection;
    try {
        const { email, amount, payment_method } = req.body;
        connection = await pool.getConnection();
        
        // Check if user is a designer
        const [users] = await connection.execute('SELECT role FROM users WHERE email = ?', [email]);
        if (users.length === 0) return res.status(404).json({ error: 'User not found' });
        if (users[0].role !== 'designer') {
            return res.status(403).json({ error: 'Only designers can upgrade to premium.' });
        }

        await connection.beginTransaction();

        // 1. Upgrade User
        await connection.execute("UPDATE users SET subscription_tier = 'premium' WHERE email = ?", [email]);
        
        // 2. Log Transaction
        await connection.execute(
            'INSERT INTO transactions (user_email, amount, payment_method, transaction_type) VALUES (?, ?, ?, ?)',
            [email, amount || 29.00, payment_method || 'Credit Card', 'subscription']
        );

        await connection.commit();

        const [updatedUsers] = await connection.execute('SELECT * FROM users WHERE email = ?', [email]);
        const user = updatedUsers[0];
        delete user.password;
        
        res.json({ success: true, user });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error('Upgrade Error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

router.delete('/products/:id', async (req, res) => {
    let connection;
    try {
        const { id } = req.params;
        connection = await pool.getConnection();
        const [result] = await connection.execute('DELETE FROM products WHERE id = ?', [id]);
        
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Product not found' });
        
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        console.error('Delete Product Error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

// --- ORDER ROUTES ---
router.post('/orders', async (req, res) => {
    let connection;
    try {
        const { order_id, user_email, total_amount, shipping, items, payment_method } = req.body;
        connection = await pool.getConnection();

        // Check if order already exists (Deduplication)
        const [existingOrders] = await connection.execute('SELECT id FROM orders WHERE order_id = ?', [order_id]);
        if (existingOrders.length > 0) {
            console.log(`Duplicate Order ID ignored: ${order_id}`);
            return res.status(200).json({ success: true, message: 'Order already processed', id: existingOrders[0].id });
        }

        await connection.beginTransaction();

        // 1. Insert into orders table
        const [orderResult] = await connection.execute(
            'INSERT INTO orders (order_id, user_email, total_amount, shipping_name, shipping_phone, shipping_address) VALUES (?, ?, ?, ?, ?, ?)',
            [order_id, user_email, total_amount, shipping.name, shipping.phone, shipping.address]
        );

        const internalOrderId = orderResult.insertId;

        // 2. Insert items into order_items table and log for designer notification
        const designerEmails = new Set();
        let itemsHtml = '';

        for (const item of items) {
            const [products] = await connection.execute('SELECT architect, designerEmail FROM products WHERE id = ?', [item.id]);
            const architect = products.length > 0 ? products[0].architect : 'Unknown';
            const designerEmail = products.length > 0 ? products[0].designerEmail : null;
            
            if (designerEmail) designerEmails.add(designerEmail);

            await connection.execute(
                'INSERT INTO order_items (order_id, product_id, product_name, price, quantity, architect, designerEmail, selected_size, selected_color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [internalOrderId, item.id, item.name, item.price, item.quantity, architect, designerEmail, item.selected_size || null, item.selected_color || null]
            );
            
            itemsHtml += `
                <div style="padding: 10px; border-bottom: 1px solid #eee;">
                    <strong>${item.name}</strong><br>
                    <small>Architect: ${architect} | Size: ${item.selected_size || 'N/A'} | Color: ${item.selected_color || 'N/A'}</small><br>
                    <span>$${item.price} x ${item.quantity}</span>
                </div>
            `;

            // Mark product as sold
            await connection.execute('UPDATE products SET isSold = 1 WHERE id = ?', [item.id]);
        }

        // 3. Log Financial Transaction
        await connection.execute(
            'INSERT INTO transactions (user_email, amount, payment_method, transaction_type) VALUES (?, ?, ?, ?)',
            [user_email, total_amount, payment_method || 'Credit Card', 'order']
        );

        await connection.commit();

        // 4. Send Confirmation Email to User
        const userMailOptions = {
            from: `"LUMINA PROTOCOL" <${process.env.EMAIL_USER}>`,
            to: user_email,
            subject: `Neural Manifest: Order #${order_id} Confirmed`,
            html: `
                <div style="background: #000; color: white; padding: 40px; font-family: sans-serif; text-align: center;">
                    <h1 style="color: #00F0FF; font-size: 32px; font-weight: 900; letter-spacing: -1px;">LUMINA</h1>
                    <p style="text-transform: uppercase; letter-spacing: 3px; font-size: 10px; color: #666;">Transaction Manifest</p>
                    <div style="background: #111; border: 1px solid #222; padding: 30px; border-radius: 20px; margin: 30px 0; text-align: left;">
                        <h2 style="margin-top: 0; color: #fff;">Order Confirmed</h2>
                        <p style="color: #888;">We've successfully verified your neural transaction. Your fashion assets are now in logistics protocol.</p>
                        <hr style="border: 0; border-top: 1px solid #222; margin: 20px 0;">
                        ${itemsHtml}
                        <div style="margin-top: 20px; display: flex; justify-content: space-between;">
                            <span style="color: #666;">Total Manifest:</span>
                            <strong style="color: #00F0FF; font-size: 20px;">$${total_amount}</strong>
                        </div>
                    </div>
                    <p style="color: #666; font-size: 11px;">Neural Address: ${shipping.address}</p>
                    <p style="margin-top: 30px; color: #444; font-size: 10px;">© 2026 LUMINA FUTURE OF FASHION ARCHITECTURE</p>
                </div>
            `
        };

        transporter.sendMail(userMailOptions).catch(err => console.error('User Email Failure:', err));

        // 5. Notify Designers (Optional but professional)
        designerEmails.forEach(async (dEmail) => {
            const designerMailOptions = {
                from: `"LUMINA PROTOCOL" <${process.env.EMAIL_USER}>`,
                to: dEmail,
                subject: `Neural Notification: Your Asset has been Acquired`,
                html: `<p>One of your neural assets was sold in order #${order_id}. Check your portal for details.</p>`
            };
            transporter.sendMail(designerMailOptions).catch(err => console.error('Designer Email Failure:', err));
        });

        res.status(201).json({ success: true, message: 'Order placed successfully', id: internalOrderId });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error('Order Error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

router.get('/orders/:email', async (req, res) => {
    let connection;
    try {
        const { email } = req.params;
        connection = await pool.getConnection();

        // Get orders
        const [orders] = await connection.execute('SELECT * FROM orders WHERE user_email = ? ORDER BY created_at DESC', [email]);

        // For each order, get its items
        const fullOrders = [];
        for (const order of orders) {
            const [items] = await connection.execute('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
            fullOrders.push({
                ...order,
                items: items.map(item => ({
                    ...item,
                    selected_size: item.selected_size // Ensure size is included
                })),
                date: order.created_at, // Use created_at as date
                status: order.status, // Ensure status is passed
                totals: { total: parseFloat(order.total_amount) } // Format for frontend
            });
        }

        res.json(fullOrders);
    } catch (err) {
        console.error('Get Orders Error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

// --- CART ROUTES ---
router.get('/cart/:email', async (req, res) => {
    let connection;
    try {
        const { email } = req.params;
        connection = await pool.getConnection();
        const [items] = await connection.execute('SELECT * FROM cart_items WHERE user_email = ?', [email]);
        res.json(items);
    } catch (err) {
        console.error('Get Cart Error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

router.post('/cart', async (req, res) => {
    let connection;
    try {
        const { user_email, product_id, name, price, img, architect, quantity, selected_size, selected_color } = req.body;
        connection = await pool.getConnection();

        // Check if item already in cart with same size and color
        const [existing] = await connection.execute(
            'SELECT id, quantity FROM cart_items WHERE user_email = ? AND product_id = ? AND selected_size = ? AND selected_color = ?',
            [user_email, product_id, selected_size || null, selected_color || null]
        );

        if (existing.length > 0) {
            // Update quantity
            await connection.execute(
                'UPDATE cart_items SET quantity = quantity + ? WHERE id = ?',
                [quantity || 1, existing[0].id]
            );
        } else {
            // Insert new item
            await connection.execute(
                'INSERT INTO cart_items (user_email, product_id, name, price, img, architect, quantity, selected_size, selected_color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [user_email, product_id, name, price, img, architect, quantity || 1, selected_size || null, selected_color || null]
            );
        }

        const [updatedCart] = await connection.execute('SELECT * FROM cart_items WHERE user_email = ?', [user_email]);
        res.json(updatedCart);
    } catch (err) {
        console.error('Add to Cart Error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

router.delete('/cart/:email/:productId', async (req, res) => {
    let connection;
    try {
        const { email, productId } = req.params;
        connection = await pool.getConnection();
        await connection.execute('DELETE FROM cart_items WHERE user_email = ? AND product_id = ?', [email, productId]);
        const [updatedCart] = await connection.execute('SELECT * FROM cart_items WHERE user_email = ?', [email]);
        res.json(updatedCart);
    } catch (err) {
        console.error('Delete Cart Item Error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

router.delete('/cart/:email', async (req, res) => {
    let connection;
    try {
        const { email } = req.params;
        connection = await pool.getConnection();
        await connection.execute('DELETE FROM cart_items WHERE user_email = ?', [email]);
        res.json({ message: 'Cart cleared' });
    } catch (err) {
        console.error('Clear Cart Error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

// --- FAVORITES ROUTES ---
router.get('/favorites/:email', async (req, res) => {
    let connection;
    try {
        const { email } = req.params;
        connection = await pool.getConnection();
        const [favs] = await connection.execute('SELECT product_id FROM favorites WHERE user_email = ?', [email]);
        res.json(favs.map(f => String(f.product_id)));
    } catch (err) {
        console.error('Get Favorites Error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

router.post('/favorites/toggle', async (req, res) => {
    let connection;
    try {
        const { user_email, product_id } = req.body;
        connection = await pool.getConnection();

        const [existing] = await connection.execute(
            'SELECT id FROM favorites WHERE user_email = ? AND product_id = ?',
            [user_email, product_id]
        );

        if (existing.length > 0) {
            await connection.execute('DELETE FROM favorites WHERE id = ?', [existing[0].id]);
        } else {
            await connection.execute('INSERT INTO favorites (user_email, product_id) VALUES (?, ?)', [user_email, product_id]);
        }

        const [updatedFavs] = await connection.execute('SELECT product_id FROM favorites WHERE user_email = ?', [user_email]);
        res.json(updatedFavs.map(f => String(f.product_id)));
    } catch (err) {
        console.error('Toggle Favorite Error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

router.get('/feedbacks/:productId', async (req, res) => {
    let connection;
    try {
        const { productId } = req.params;
        connection = await pool.getConnection();
        const [rows] = await connection.execute(
            'SELECT * FROM feedbacks WHERE product_id = ? ORDER BY created_at DESC',
            [productId]
        );
        res.json(rows);
    } catch (err) {
        console.error('Get Feedbacks Error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;
