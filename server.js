const express = require('express');
require('dotenv').config();
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const compression = require('compression');

const { initDatabase, getDb, saveDatabase, forceReseed } = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || '35df4098bc4bbb3949a68036004b7427db12a0b261e3b9b535dde96850397d924ca2b9cdd8200f864a99ddaa6c31d6a8b78805a952a28b6b8fc772515bc80b55';
console.log('JWT_SECRET loaded:', JWT_SECRET.substring(0, 10) + '...');

// Middleware
app.use(compression());
app.use(cors());
app.use(express.json());

// Serve static files from public folder
app.use(express.static(path.join(__dirname, 'public'), { 
  maxAge: '1h',
  etag: true,
  lastModified: true
}));

// Serve index.html from root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve other HTML pages from root
app.get('/cart', (req, res) => res.sendFile(path.join(__dirname, 'cart.html')));
app.get('/orders', (req, res) => res.sendFile(path.join(__dirname, 'orders.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'register.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/owner', (req, res) => res.sendFile(path.join(__dirname, 'owner.html')));
app.get('/product', (req, res) => res.sendFile(path.join(__dirname, 'product.html')));
app.get('/product.html', (req, res) => res.sendFile(path.join(__dirname, 'product.html')));
app.get('/admin-orders', (req, res) => res.sendFile(path.join(__dirname, 'admin-orders.html')));
app.get('/financial-app', (req, res) => res.sendFile(path.join(__dirname, 'financial-app.html')));
app.get('/tiendas', (req, res) => res.sendFile(path.join(__dirname, 'tiendas.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/reclamaciones', (req, res) => res.sendFile(path.join(__dirname, 'reclamaciones.html')));

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  }
});

// Database helper
const db = () => getDb();

// Auth middleware
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Role check middleware
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };
};

// Generate unique codes
const generateUserCode = () => {
  return 'USR-' + uuidv4().substring(0, 8).toUpperCase();
};

const generateOrderCode = () => {
  return 'ORD-' + uuidv4().substring(0, 8).toUpperCase();
};

// ==================== AUTH ROUTES ====================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, name, lastname, phone } = req.body;
    
    if (!username || !email || !password || !name || !lastname) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user exists
    const existingUser = db().prepare('SELECT id, username, email FROM users WHERE username = ? OR email = ?').get(username, email);
    if (existingUser) {
      console.log('User already exists:', existingUser);
      return res.status(400).json({ error: 'Username or email already exists', details: `${existingUser.username} ya usa ese correo` });
    }

    // Check if owner already exists
    const ownerExists = db().prepare("SELECT id FROM users WHERE role = 'owner'").get();
    const role = ownerExists ? 'user' : 'owner';

    const hashedPassword = await bcrypt.hash(password, 10);
    const userCode = generateUserCode();

    const result = db().prepare(`
      INSERT INTO users (username, email, password, name, lastname, phone, role, user_code)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(username, email, hashedPassword, name, lastname, phone || null, role, userCode);

    // Update owner created flag
    if (role === 'owner') {
      db().prepare("UPDATE settings SET value = 'true' WHERE key = 'owner_created'").run();
    }

    // Get the last inserted user
    const user = db().prepare('SELECT id, username, email, name, lastname, phone, role, user_code FROM users WHERE username = ?').get(username);

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ message: 'Registration successful', user, token });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Allow login by username or email
    const user = db().prepare('SELECT * FROM users WHERE (username = ? OR email = ?) AND is_active = 1').get(username, username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Allow owner and admin to login without email verification
    if (user.role === 'owner' || user.role === 'admin') {
      const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
      const { password: _, ...userData } = user;
      return res.json({ user: userData, token });
    }

    // Check if email is verified for regular users
    if (user.email_verified === 0) {
      return res.status(403).json({ error: 'Confirma tu correo para ingresar', unverified: true });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    const { password: _, ...userData } = user;
    res.json({ user: userData, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user
app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = db().prepare('SELECT id, username, email, name, lastname, phone, role, user_code, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
});

// Email verification endpoint
app.get('/api/auth/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.redirect('/login?verified=0&error=token_missing');
    }
    
    // Hash the token to compare with stored hash
    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    // Find user with valid verification token
    const user = db().prepare(`
      SELECT * FROM users 
      WHERE email_verification_token_hash = ? 
      AND email_verification_expires > datetime('now')
    `).get(tokenHash);
    
    if (!user) {
      return res.redirect('/login?verified=0&error=invalid_token');
    }
    
    // Mark email as verified and clear token
    db().prepare(`
      UPDATE users 
      SET email_verified = 1, 
          email_verification_token_hash = NULL, 
          email_verification_expires = NULL 
      WHERE id = ?
    `).run(user.id);
    
    console.log(`Email verified for user: ${user.email}`);
    
    // Redirect to login with success
    res.redirect('/login?verified=1');
  } catch (error) {
    console.error('Email verification error:', error);
    res.redirect('/login?verified=0&error=server_error');
  }
});

// Resend verification email
app.post('/api/auth/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email es requerido' });
    }
    
    // Find user by email
    const user = db().prepare('SELECT * FROM users WHERE email = ?').get(email);
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // If already verified
    if (user.email_verified === 1) {
      return res.status(400).json({ error: 'El correo ya está verificado' });
    }
    
    // Generate new verification token
    const crypto = require('crypto');
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    // Update token in database
    db().prepare(`
      UPDATE users 
      SET email_verification_token_hash = ?, 
          email_verification_expires = ? 
      WHERE id = ?
    `).run(tokenHash, tokenExpires, user.id);
    
    // Send verification email using Resend
    const { sendVerificationEmail } = require('./utils/email');
    const emailResult = await sendVerificationEmail(email, verificationToken);
    
    if (!emailResult.success) {
      console.error('Failed to send verification email:', emailResult.error);
    }
    
    res.json({ message: 'Correo de verificación enviado' });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Error al enviar correo de verificación' });
  }
});

// ==================== CATEGORIES ROUTES ====================

// Get all categories
app.get('/api/categories', (req, res) => {
  try {
    const categories = db().prepare('SELECT * FROM categories ORDER BY name').all();
    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create category (admin/owner)
app.post('/api/categories', authMiddleware, requireRole('admin', 'owner'), (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const result = db().prepare('INSERT INTO categories (name, description) VALUES (?, ?)').run(name, description || null);
    const category = db().prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(category);
  } catch (error) {
    console.error('Create category error:', error);
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'Category already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Update category (admin/owner)
app.put('/api/categories/:id', authMiddleware, requireRole('admin', 'owner'), (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const category = db().prepare('SELECT * FROM categories WHERE id = ?').get(id);
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    db().prepare('UPDATE categories SET name = ?, description = ? WHERE id = ?').run(name || category.name, description !== undefined ? description : category.description, id);
    res.json(db().prepare('SELECT * FROM categories WHERE id = ?').get(id));
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete category (admin/owner)
app.delete('/api/categories/:id', authMiddleware, requireRole('admin', 'owner'), (req, res) => {
  try {
    const { id } = req.params;

    // Check if category has products
    const productCount = db().prepare('SELECT COUNT(*) as count FROM products WHERE category_id = ?').get(id);
    if (productCount && productCount.count > 0) {
      return res.status(400).json({ error: 'Cannot delete category with products' });
    }

    db().prepare('DELETE FROM categories WHERE id = ?').run(id);
    res.json({ message: 'Category deleted' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== PRODUCTS ROUTES ====================

// Get all products
app.get('/api/products', (req, res) => {
  try {
    const { category, search, active } = req.query;
    
    let query = `
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE 1=1
    `;
    const params = [];

    if (category) {
      query += ' AND p.category_id = ?';
      params.push(category);
    }
    if (search) {
      query += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (active !== undefined) {
      if (active === 'all') {
        // Show all products (no filter)
      } else {
        query += ' AND p.is_active = ?';
        params.push(active === 'true' ? 1 : 0);
      }
    } else {
      query += ' AND p.is_active = 1';
    }

    query += ' ORDER BY p.created_at DESC';

    const products = db().prepare(query).all(...params);
    res.json(products);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single product
app.get('/api/products/:id', (req, res) => {
  try {
    const product = db().prepare(`
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.id = ?
    `).get(req.params.id);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create product (admin/owner)
app.post('/api/products', authMiddleware, requireRole('admin', 'owner'), upload.single('image'), (req, res) => {
  try {
    const { name, description, price, stock, category_id, id } = req.body;

    if (!name || !price) {
      return res.status(400).json({ error: 'Name and price are required' });
    }

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    // If custom ID is provided
    if (id && id.trim()) {
      // Check if ID already exists
      const existing = db().prepare('SELECT id FROM products WHERE id = ?').get(id);
      if (existing) {
        return res.status(400).json({ error: 'Ya existe un producto con ese ID' });
      }
      
      db().prepare(`
        INSERT INTO products (id, name, description, price, stock, category_id, image_url)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, name, description || null, parseFloat(price), parseInt(stock) || 0, category_id || null, imageUrl);

      const product = db().prepare(`
        SELECT p.*, c.name as category_name 
        FROM products p 
        LEFT JOIN categories c ON p.category_id = c.id 
        WHERE p.id = ?
      `).get(id);

      return res.status(201).json(product);
    }

    const result = db().prepare(`
      INSERT INTO products (name, description, price, stock, category_id, image_url)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, description || null, parseFloat(price), parseInt(stock) || 0, category_id || null, imageUrl);

    const product = db().prepare(`
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(product);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update product (admin/owner)
app.put('/api/products/:id', authMiddleware, requireRole('admin', 'owner'), upload.single('image'), (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, stock, category_id, is_active, id: newId } = req.body;

    const product = db().prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check if ID is being changed
    if (newId && newId !== id) {
      // Check if new ID already exists
      const existing = db().prepare('SELECT id FROM products WHERE id = ?').get(newId);
      if (existing) {
        return res.status(400).json({ error: 'Ya existe un producto con ese ID' });
      }
      
      // Delete old and create new
      db().prepare('DELETE FROM products WHERE id = ?').run(id);
      
      const imageUrl = req.file ? `/uploads/${req.file.filename}` : product.image_url;
      
      db().prepare(`
        INSERT INTO products (id, name, description, price, stock, category_id, image_url, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        newId,
        name || product.name,
        description !== undefined ? description : product.description,
        price ? parseFloat(price) : product.price,
        stock !== undefined ? parseInt(stock) : product.stock,
        category_id || product.category_id,
        imageUrl,
        is_active !== undefined ? (is_active ? 1 : 0) : product.is_active
      );
      
      const updatedProduct = db().prepare(`
        SELECT p.*, c.name as category_name 
        FROM products p 
        LEFT JOIN categories c ON p.category_id = c.id 
        WHERE p.id = ?
      `).get(newId);

      return res.json(updatedProduct);
    }

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : product.image_url;

    db().prepare(`
      UPDATE products 
      SET name = ?, description = ?, price = ?, stock = ?, category_id = ?, image_url = ?, is_active = ?
      WHERE id = ?
    `).run(
      name || product.name,
      description !== undefined ? description : product.description,
      price ? parseFloat(price) : product.price,
      stock !== undefined ? parseInt(stock) : product.stock,
      category_id || product.category_id,
      imageUrl,
      is_active !== undefined ? (is_active ? 1 : 0) : product.is_active,
      id
    );

    const updatedProduct = db().prepare(`
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.id = ?
    `).get(id);

    res.json(updatedProduct);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete product (admin/owner)
app.delete('/api/products/:id', authMiddleware, requireRole('admin', 'owner'), (req, res) => {
  try {
    const { id } = req.params;

    const product = db().prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Remove image file if exists
    if (product.image_url) {
      const imagePath = path.join(__dirname, 'public', product.image_url);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    db().prepare('DELETE FROM products WHERE id = ?').run(id);
    res.json({ message: 'Product deleted' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update stock (admin/owner)
app.put('/api/products/:id/stock', authMiddleware, requireRole('admin', 'owner'), (req, res) => {
  try {
    const { id } = req.params;
    const { delta } = req.body;
    
    if (delta === undefined || isNaN(parseInt(delta))) {
      return res.status(400).json({ error: 'Delta is required' });
    }
    
    const product = db().prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const newStock = Math.max(0, product.stock + parseInt(delta));
    
    db().prepare('UPDATE products SET stock = ? WHERE id = ?').run(newStock, id);
    
    const updatedProduct = db().prepare('SELECT * FROM products WHERE id = ?').get(id);
    res.json(updatedProduct);
  } catch (error) {
    console.error('Update stock error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== CART ROUTES ====================

// Get cart
app.get('/api/cart', authMiddleware, (req, res) => {
  try {
    const cartItems = db().prepare(`
      SELECT ci.*, p.name, p.price, p.image_url, p.stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.user_id = ?
    `).all(req.user.id);

    const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    res.json({ items: cartItems, total });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add to cart
app.post('/api/cart/add', authMiddleware, (req, res) => {
  try {
    const { product_id, quantity = 1 } = req.body;

    const product = db().prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(product_id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check existing cart item
    const existingItem = db().prepare('SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?').get(req.user.id, product_id);

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (newQuantity > product.stock) {
        return res.status(400).json({ error: 'Not enough stock' });
      }
      db().prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(newQuantity, existingItem.id);
    } else {
      if (quantity > product.stock) {
        return res.status(400).json({ error: 'Not enough stock' });
      }
      db().prepare('INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)').run(req.user.id, product_id, quantity);
    }

    res.json({ message: 'Added to cart' });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update cart item
app.put('/api/cart/update/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    const cartItem = db().prepare('SELECT * FROM cart_items WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!cartItem) {
      return res.status(404).json({ error: 'Cart item not found' });
    }

    const product = db().prepare('SELECT stock FROM products WHERE id = ?').get(cartItem.product_id);
    if (quantity > product.stock) {
      return res.status(400).json({ error: 'Not enough stock' });
    }

    if (quantity <= 0) {
      db().prepare('DELETE FROM cart_items WHERE id = ?').run(id);
    } else {
      db().prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(quantity, id);
    }

    res.json({ message: 'Cart updated' });
  } catch (error) {
    console.error('Update cart error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove from cart
app.delete('/api/cart/remove/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;

    db().prepare('DELETE FROM cart_items WHERE id = ? AND user_id = ?').run(id, req.user.id);
    res.json({ message: 'Item removed from cart' });
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Clear cart
app.delete('/api/cart/clear', authMiddleware, (req, res) => {
  try {
    db().prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.user.id);
    res.json({ message: 'Cart cleared' });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== ORDERS ROUTES ====================

// Place order
app.post('/api/orders', authMiddleware, async (req, res) => {
  try {
    const { scheduled_date, scheduled_time, notes, packaging, dni, shipping_agency, province } = req.body;

    console.log('Order request received:', { scheduled_date, scheduled_time, notes, packaging, dni, shipping_agency, province });

    if (!scheduled_date) {
      return res.status(400).json({ error: 'La fecha programada es requerida' });
    }

    if (!dni || !shipping_agency || !province) {
      return res.status(400).json({ error: 'DNI, shipping agency, and province are required' });
    }

    // Get cart items
    const cartItems = db().prepare(`
      SELECT ci.*, p.name, p.price, p.stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.user_id = ?
    `).all(req.user.id);

    if (cartItems.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Verify stock and calculate total
    let total = 0;
    for (const item of cartItems) {
      if (item.quantity > item.stock) {
        return res.status(400).json({ error: `Not enough stock for ${item.name}` });
      }
      total += item.price * item.quantity;
    }
    
    // Add packaging price to total
    let packagingPrice = 0;
    if (packaging === 'estandar') {
      packagingPrice = 10;
    } else if (packaging === 'grande') {
      packagingPrice = 15;
    }
    total += packagingPrice;
    
    console.log('Order total with packaging:', { total, packaging, packagingPrice });

    // Create order
    const orderCode = generateOrderCode();
    const user = db().prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    const result = db().prepare(`
      INSERT INTO orders (user_id, order_code, status, scheduled_date, scheduled_time, total_amount, notes, packaging, dni, shipping_agency, province)
      VALUES (?, ?, 'agendado', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, orderCode, scheduled_date, scheduled_time || null, total, notes || null, packaging || null, dni, shipping_agency, province);

    // Get order ID using order code (more reliable than lastInsertRowid)
    const orderData = db().prepare('SELECT id FROM orders WHERE order_code = ?').get(orderCode);
    const orderId = orderData.id;
    console.log('Order ID:', orderId);

    // Create order items and update stock
    console.log('Creating order items for cart items:', cartItems); // Debug log
    const insertOrderItem = db().prepare(`
      INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
      VALUES (?, ?, ?, ?, ?)
    `);

    const updateStock = db().prepare('UPDATE products SET stock = stock - ? WHERE id = ?');

    for (const item of cartItems) {
      const subtotal = item.price * item.quantity;
      insertOrderItem.run(orderId, item.product_id, item.quantity, item.price, subtotal);
      updateStock.run(item.quantity, item.product_id);
    }
    
    // Verify order items were saved
    const savedItems = db().prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
    console.log('Saved order items:', savedItems);

    // Clear cart
    db().prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.user.id);

    // Generate PDF
    const pdfPath = await generateOrderPDF(orderId);

    // Update order with PDF path
    db().prepare('UPDATE orders SET pdf_path = ? WHERE id = ?').run(pdfPath, orderId);

    const order = db().prepare(`
      SELECT o.*, u.name, u.lastname, u.user_code, u.phone
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.id = ?
    `).get(orderId);

    const orderItems = db().prepare(`
      SELECT oi.*, p.name
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).all(orderId);

    res.status(201).json({ 
      message: 'Order placed successfully', 
      order,
      items: orderItems,
      pdfPath
    });
  } catch (error) {
    console.error('Place order error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get orders
app.get('/api/orders', authMiddleware, (req, res) => {
  try {
    let orders;
    
    if (req.user.role === 'user') {
      orders = db().prepare(`
        SELECT o.*, u.name, u.lastname, u.user_code
        FROM orders o
        JOIN users u ON o.user_id = u.id
        WHERE o.user_id = ?
        ORDER BY o.created_at DESC
      `).all(req.user.id);
    } else {
      orders = db().prepare(`
        SELECT o.*, u.name, u.lastname, u.user_code
        FROM orders o
        JOIN users u ON o.user_id = u.id
        ORDER BY o.created_at DESC
      `).all();
    }

    res.json(orders);
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single order
app.get('/api/orders/:id', authMiddleware, (req, res) => {
  try {
    const order = db().prepare(`
      SELECT o.*, u.name, u.lastname, u.user_code, u.phone
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.id = ?
    `).get(req.params.id);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check access
    if (req.user.role === 'user' && order.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const items = db().prepare(`
      SELECT oi.*, p.name
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).all(req.params.id);

    res.json({ ...order, items });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update order status (admin/owner)
app.put('/api/orders/:id/status', authMiddleware, requireRole('admin', 'owner'), (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['agendado', 'en_proceso', 'enviado'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const order = db().prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    db().prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
    res.json({ message: 'Order status updated', status });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Search orders by order code (admin/owner only)
app.get('/api/orders/search/:orderCode', authMiddleware, requireRole('admin', 'owner'), (req, res) => {
  try {
    const { orderCode } = req.params;
    
    const orders = db().prepare(`
      SELECT o.*, u.name, u.lastname, u.user_code, u.phone, u.email
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.order_code LIKE ?
      ORDER BY o.created_at DESC
    `).all(`%${orderCode}%`);

    res.json(orders);
  } catch (error) {
    console.error('Search orders error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== ADMIN MANAGEMENT ROUTES ====================

// Get admins (owner only)
app.get('/api/admin/users', authMiddleware, requireRole('owner'), (req, res) => {
  try {
    const admins = db().prepare(`
      SELECT id, username, email, name, lastname, role, user_code, created_at
      FROM users 
      WHERE role IN ('admin', 'owner')
      ORDER BY created_at
    `).all();
    res.json(admins);
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all regular users (admin/owner)
app.get('/api/admin/all-users', authMiddleware, requireRole('admin', 'owner'), (req, res) => {
  try {
    const users = db().prepare(`
      SELECT u.*, 
        (SELECT COUNT(*) FROM orders WHERE user_id = u.id) as order_count,
        (SELECT SUM(total_amount) FROM orders WHERE user_id = u.id) as total_spent
      FROM users u
      WHERE u.role = 'user'
      ORDER BY u.created_at DESC
    `).all();
    
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get orders for a specific user (admin/owner)
app.get('/api/admin/users/:userId/orders', authMiddleware, requireRole('admin', 'owner'), (req, res) => {
  try {
    const orders = db().prepare(`
      SELECT o.*, u.name, u.lastname, u.user_code, u.phone
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC
    `).all(req.params.userId);
    
    res.json(orders);
  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create admin (owner only)
app.post('/api/admin/create-admin', authMiddleware, requireRole('owner'), async (req, res) => {
  try {
    const { username, email, password, name, lastname, phone } = req.body;

    if (!username || !password || !name || !lastname) {
      return res.status(400).json({ error: 'Username, password, name and lastname are required' });
    }

    // Generate email from username if not provided
    const adminEmail = email || `${username}@tiendabea.local`;

    const existingUser = db().prepare('SELECT id, username, email FROM users WHERE username = ? OR email = ?').get(username, adminEmail);
    if (existingUser) {
      console.log('Admin user already exists:', existingUser);
      return res.status(400).json({ error: 'Username or email already exists', details: `${existingUser.username} ya usa ese correo` });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userCode = generateUserCode();
    
    // Check if email is provided and is not a local placeholder
    const isLocalEmail = adminEmail.endsWith('@tiendabea.local');
    let emailVerified = 1;
    let tokenHash = null;
    let tokenExpires = null;
    
    // Only require verification if a real email is provided
    if (!isLocalEmail && email) {
      const crypto = require('crypto');
      const verificationToken = crypto.randomBytes(32).toString('hex');
      tokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
      tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      emailVerified = 0;
    }

    const result = db().prepare(`
      INSERT INTO users (username, email, password, name, lastname, phone, role, user_code, email_verified, email_verification_token_hash, email_verification_expires)
      VALUES (?, ?, ?, ?, ?, ?, 'admin', ?, ?, ?, ?)
    `).run(username, adminEmail, hashedPassword, name, lastname, phone || null, userCode, emailVerified, tokenHash, tokenExpires);

    // Send notification to owner email about new admin
    const ownerEmail = process.env.OWNER_EMAIL || 'joaquinsalasg021@gmail.com';
    const { sendEmail } = require('./utils/email');
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Nuevo administrador creado</h2>
        <p>Se ha creado un nuevo administrador en TiendaBea:</p>
        <ul>
          <li><strong>Usuario:</strong> ${username}</li>
          <li><strong>Nombre:</strong> ${name} ${lastname}</li>
          <li><strong>Correo:</strong> ${adminEmail}</li>
          <li><strong>Código:</strong> ${userCode}</li>
        </ul>
        ${emailVerified === 0 ? '<p>El administrador deberá verificar su correo para poder iniciar sesión.</p>' : ''}
      </div>
    `;
    
    const emailResult = await sendEmail(ownerEmail, 'Nuevo administrador creado - TiendaBea', html);
    
    if (!emailResult.success) {
      console.error('Failed to send admin creation notification:', emailResult.error);
    }

    const user = db().prepare('SELECT id, username, email, name, lastname, role, user_code, email_verified FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ message: 'Admin created successfully. Se notificó al correo del owner.', user });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete admin (owner only)
app.delete('/api/admin/:id', authMiddleware, requireRole('owner'), (req, res) => {
  try {
    const { id } = req.params;

    const user = db().prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role === 'owner') {
      return res.status(400).json({ error: 'Cannot delete owner' });
    }

    if (user.role !== 'admin') {
      return res.status(400).json({ error: 'Can only delete admins' });
    }

    db().prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ message: 'Admin deleted successfully' });
  } catch (error) {
    console.error('Delete admin error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== SETTINGS ROUTES ====================

// Get settings
app.get('/api/settings', (req, res) => {
  try {
    const settings = db().prepare('SELECT * FROM settings').all();
    const settingsObj = {};
    settings.forEach(s => settingsObj[s.key] = s.value);
    res.json(settingsObj);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update settings (owner only)
app.put('/api/settings', authMiddleware, requireRole('owner'), (req, res) => {
  try {
    const { store_name, store_phone } = req.body;

    if (store_name !== undefined) {
      db().prepare('UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?').run(store_name, 'store_name');
    }
    if (store_phone !== undefined) {
      db().prepare('UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?').run(store_phone, 'store_phone');
    }

    res.json({ message: 'Settings updated' });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== DASHBOARD ROUTES ====================

// Get inventory by location
app.get('/api/dashboard/inventory', authMiddleware, requireRole('admin', 'owner'), (req, res) => {
  try {
    const products = db().prepare(`
      SELECT p.*, c.name as category_name,
        (p.stock_manchay + p.stock_santa_anita + p.stock_almacen) as stock_total
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = 1
      ORDER BY p.name ASC
    `).all();

    // Calculate totals
    const totals = {
      totalStock: 0,
      manchayStock: 0,
      santaAnitaStock: 0,
      almacenStock: 0,
      lowStock: 0,
      outOfStock: 0
    };

    products.forEach(p => {
      const total = p.stock_manchay + p.stock_santa_anita + p.stock_almacen;
      totals.totalStock += total;
      totals.manchayStock += p.stock_manchay;
      totals.santaAnitaStock += p.stock_santa_anita;
      totals.almacenStock += p.stock_almacen;
      if (total > 0 && total <= 10) totals.lowStock++;
      if (total === 0) totals.outOfStock++;
    });

    // Add status to each product
    const productsWithStatus = products.map(p => {
      const total = p.stock_manchay + p.stock_santa_anita + p.stock_almacen;
      let status = 'Normal';
      if (total === 0) status = 'Agotado';
      else if (total <= 10) status = 'Bajo stock';
      return { ...p, stock_total: total, status };
    });

    res.json({ products: productsWithStatus, totals });
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get monthly sales statistics
app.get('/api/dashboard/sales', authMiddleware, requireRole('admin', 'owner'), (req, res) => {
  try {
    const { month, year } = req.query;
    const currentDate = new Date();
    const targetMonth = month || (currentDate.getMonth() + 1);
    const targetYear = year || currentDate.getFullYear();

    // Get start and end dates for the month
    const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
    const endDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-31`;

    // Get orders for the month
    const orders = db().prepare(`
      SELECT * FROM orders 
      WHERE created_at >= ? AND created_at <= ?
      ORDER BY created_at DESC
    `).all(startDate, endDate);

    // Calculate totals
    const totalOrders = orders.length;
    const paidOrders = orders.filter(o => o.status !== 'pendiente' && o.status !== 'cancelado').length;
    const unpaidOrders = totalOrders - paidOrders;
    const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

    // Get products sold
    const orderIds = orders.map(o => o.id);
    let productsSold = 0;
    let productSales = [];

    if (orderIds.length > 0) {
      const placeholders = orderIds.map(() => '?').join(',');
      const orderItems = db().prepare(`
        SELECT product_id, SUM(quantity) as total_qty, SUM(subtotal) as total_subtotal
        FROM order_items 
        WHERE order_id IN (${placeholders})
        GROUP BY product_id
      `).all(...orderIds);

      productsSold = orderItems.reduce((sum, item) => sum + item.total_qty, 0);

      // Get product details
      productSales = orderItems.map(item => {
        const product = db().prepare('SELECT name, category_id FROM products WHERE id = ?').get(item.product_id);
        const category = product ? db().prepare('SELECT name FROM categories WHERE id = ?').get(product.category_id) : null;
        return {
          product_id: item.product_id,
          product_name: product ? product.name : 'Unknown',
          category_name: category ? category.name : 'Sin categoría',
          quantity_sold: item.total_qty,
          revenue: item.total_subtotal
        };
      }).sort((a, b) => b.quantity_sold - a.quantity_sold);
    }

    // Get top and least sold products
    const topProduct = productSales.length > 0 ? productSales[0] : null;
    const leastProduct = productSales.length > 0 ? productSales[productSales.length - 1] : null;

    // Get category sales
    const categorySales = {};
    productSales.forEach(ps => {
      if (!categorySales[ps.category_name]) {
        categorySales[ps.category_name] = { quantity: 0, revenue: 0 };
      }
      categorySales[ps.category_name].quantity += ps.quantity_sold;
      categorySales[ps.category_name].revenue += ps.revenue;
    });

    const topCategory = Object.entries(categorySales).sort((a, b) => b[1].quantity - a[1].quantity)[0];
    const leastCategory = Object.entries(categorySales).sort((a, b) => a[1].quantity - b[1].quantity)[0];

    // Calculate daily average
    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
    const today = currentDate.getMonth() + 1 === parseInt(targetMonth) ? currentDate.getDate() : daysInMonth;
    const dailyAverage = today > 0 ? (totalRevenue / today).toFixed(2) : 0;

    // Get sales by day
    const salesByDay = {};
    orders.forEach(order => {
      const day = new Date(order.created_at).getDate();
      if (!salesByDay[day]) salesByDay[day] = { orders: 0, revenue: 0 };
      salesByDay[day].orders++;
      salesByDay[day].revenue += order.total_amount || 0;
    });

    res.json({
      month: targetMonth,
      year: targetYear,
      totalOrders,
      paidOrders,
      unpaidOrders,
      totalRevenue: totalRevenue.toFixed(2),
      productsSold,
      topProduct,
      leastProduct,
      topCategory: topCategory ? { name: topCategory[0], ...topCategory[1] } : null,
      leastCategory: leastCategory ? { name: leastCategory[0], ...leastCategory[1] } : null,
      dailyAverage,
      salesByDay,
      categorySales,
      productSales: productSales.slice(0, 10),
      leastSoldProducts: productSales.slice(-10).reverse(),
      recentOrders: orders.slice(0, 20)
    });
  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get stock movements
app.get('/api/dashboard/movements', authMiddleware, requireRole('admin', 'owner'), (req, res) => {
  try {
    const { limit } = req.query;
    const limitVal = limit || 50;

    const movements = db().prepare(`
      SELECT sm.*, p.name as product_name, u.name as user_name, u.lastname as user_lastname
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      JOIN users u ON sm.user_id = u.id
      ORDER BY sm.created_at DESC
      LIMIT ?
    `).all(limitVal);

    res.json(movements);
  } catch (error) {
    console.error('Get movements error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Transfer stock between locations
app.post('/api/dashboard/transfer', authMiddleware, requireRole('admin', 'owner'), (req, res) => {
  try {
    const { product_id, quantity, origin, destination, notes } = req.body;

    if (!product_id || !quantity || !origin || !destination) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    if (quantity <= 0) {
      return res.status(400).json({ error: 'La cantidad debe ser mayor a 0' });
    }

    if (origin === destination) {
      return res.status(400).json({ error: 'Origen y destino no pueden ser iguales' });
    }

    // Validate locations
    const validLocations = ['manchay', 'santa_anita', 'almacen'];
    if (!validLocations.includes(origin) || !validLocations.includes(destination)) {
      return res.status(400).json({ error: 'Ubicación inválida' });
    }

    // Get current product stock
    const product = db().prepare('SELECT * FROM products WHERE id = ?').get(product_id);
    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    // Check if origin has enough stock
    const originStock = product[`stock_${origin}`];
    if (originStock < quantity) {
      return res.status(400).json({ error: `Stock insuficiente en origen. Stock actual: ${originStock}` });
    }

    // Update stocks
    const decreaseStock = db().prepare(`UPDATE products SET stock_${origin} = stock_${origin} - ?, stock = stock - ? WHERE id = ?`);
    const increaseStock = db().prepare(`UPDATE products SET stock_${destination} = stock_${destination} + ? WHERE id = ?`);

    decreaseStock.run(quantity, quantity, product_id);
    increaseStock.run(quantity, product_id);

    // Record movement
    const originLabel = origin === 'manchay' ? 'Manchay' : origin === 'santa_anita' ? 'Santa Anita' : 'Almacén';
    const destLabel = destination === 'manchay' ? 'Manchay' : destination === 'santa_anita' ? 'Santa Anita' : 'Almacén';

    db().prepare(`
      INSERT INTO stock_movements (product_id, quantity, origin_location, destination_location, user_id, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(product_id, quantity, originLabel, destLabel, req.user.id, notes || null);

    saveDatabase();

    res.json({ message: 'Transferencia exitosa', success: true });
  } catch (error) {
    console.error('Transfer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all products for dropdown
app.get('/api/dashboard/products', authMiddleware, requireRole('admin', 'owner'), (req, res) => {
  try {
    const products = db().prepare(`
      SELECT p.id, p.name, p.price,
        p.stock_manchay, p.stock_santa_anita, p.stock_almacen,
        (p.stock_manchay + p.stock_santa_anita + p.stock_almacen) as stock_total,
        c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = 1
      ORDER BY p.name ASC
    `).all();

    res.json(products);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update product stock by location
app.put('/api/dashboard/product/:id/stock', authMiddleware, requireRole('admin', 'owner'), (req, res) => {
  try {
    const { id } = req.params;
    const { stock_manchay, stock_santa_anita, stock_almacen } = req.body;

    const product = db().prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const newManchay = stock_manchay !== undefined ? stock_manchay : product.stock_manchay;
    const newSantaAnita = stock_santa_anita !== undefined ? stock_santa_anita : product.stock_santa_anita;
    const newAlmacen = stock_almacen !== undefined ? stock_almacen : product.stock_almacen;
    const newTotal = newManchay + newSantaAnita + newAlmacen;

    db().prepare(`
      UPDATE products 
      SET stock_manchay = ?, stock_santa_anita = ?, stock_almacen = ?, stock = ?
      WHERE id = ?
    `).run(newManchay, newSantaAnita, newAlmacen, newTotal, id);

    saveDatabase();

    res.json({ message: 'Stock actualizado', success: true });
  } catch (error) {
    console.error('Update stock error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== PDF GENERATION ====================

async function generateOrderPDF(orderId) {
  return new Promise((resolve, reject) => {
    try {
      const order = db().prepare(`
        SELECT o.*, u.name, u.lastname, u.user_code, u.phone
        FROM orders o
        JOIN users u ON o.user_id = u.id
        WHERE o.id = ?
      `).get(orderId);
      
      if (!order) {
        return resolve(null);
      }

      const items = db().prepare(`
        SELECT oi.*, p.name
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
      `).all(orderId);

      const settings = db().prepare('SELECT * FROM settings').all();
      const settingsObj = {};
      settings.forEach(s => settingsObj[s.key] = s.value);

      const pdfDir = path.join(__dirname, 'public', 'pdfs');
      if (!fs.existsSync(pdfDir)) {
        fs.mkdirSync(pdfDir, { recursive: true });
      }

      const orderCode = order.order_code || `ORD-${order.id}`;
      const pdfPath = `/pdfs/order_${orderCode}.pdf`;
      const fullPath = path.join(__dirname, 'public', pdfPath);

      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(fullPath);

      doc.pipe(stream);

      // Header
      doc.fontSize(24).text(settingsObj.store_name || 'TiendaBea', { align: 'center' });
      doc.moveDown();
      doc.fontSize(14).text('Order Confirmation', { align: 'center' });
      doc.moveDown(2);

      // Order info
      doc.fontSize(12);
      doc.text(`Order Code: ${orderCode}`);
      doc.text(`User Code: ${order.user_code}`);
      doc.text(`Customer: ${order.name} ${order.lastname}`);
      if (order.phone) doc.text(`Phone: ${order.phone}`);
      if (order.dni) doc.text(`DNI: ${order.dni}`);
      if (order.shipping_agency) doc.text(`Shipping Agency: ${order.shipping_agency}`);
      if (order.province) doc.text(`Province: ${order.province}`);
      if (order.packaging) {
        const packagingLabel = order.packaging === 'estandar' ? 'Estándar (S/10)' : order.packaging === 'grande' ? 'Grande (S/15)' : order.packaging;
        doc.text(`Embalaje: ${packagingLabel}`);
      }
      doc.moveDown();
      doc.text(`Scheduled Date: ${order.scheduled_date}`);
      doc.text(`Scheduled Time: ${order.scheduled_time}`);
      doc.text(`Status: ${order.status.toUpperCase()}`);
      doc.moveDown(2);

      // Items table header
      doc.fontSize(12).text('Order Items:', { underline: true });
      doc.moveDown();

      let y = doc.y;
      doc.text('Product', 50, y);
      doc.text('Qty', 250, y);
      doc.text('Price', 300, y);
      doc.text('Subtotal', 400, y);
      doc.moveDown();
      
      // Items
      console.log('Generating PDF - Order items:', items); // Debug log
      items.forEach(item => {
        y = doc.y;
        doc.text(item.name.substring(0, 30), 50, y);
        doc.text(item.quantity.toString(), 250, y);
        doc.text(`S/${item.unit_price.toFixed(2)}`, 300, y);
        doc.text(`S/${item.subtotal.toFixed(2)}`, 400, y);
        doc.moveDown();
      });

      doc.moveDown();
      doc.fontSize(14).text(`Total: S/${order.total_amount.toFixed(2)}`, { align: 'right' });

      if (order.notes) {
        doc.moveDown(2);
        doc.fontSize(10).text(`Notes: ${order.notes}`);
      }

      doc.moveDown(2);
      doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });

      doc.end();

      stream.on('finish', () => {
        resolve(pdfPath);
      });

      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

// Get PDF
app.get('/api/orders/:id/pdf', authMiddleware, async (req, res) => {
  try {
    const order = db().prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (req.user.role === 'user' && order.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let pdfPath = order.pdf_path;
    
    if (!pdfPath) {
      // Generate PDF if not exists
      pdfPath = await generateOrderPDF(order.id);
      db().prepare('UPDATE orders SET pdf_path = ? WHERE id = ?').run(pdfPath, order.id);
    } else {
      const fullPath = path.join(__dirname, 'public', pdfPath);
      if (!fs.existsSync(fullPath)) {
        // Regenerate if file doesn't exist
        pdfPath = await generateOrderPDF(order.id);
        db().prepare('UPDATE orders SET pdf_path = ? WHERE id = ?').run(pdfPath, order.id);
      }
    }

    res.json({ pdf_path: pdfPath });
  } catch (error) {
    console.error('Get PDF error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== FRONTEND ROUTES ====================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/cart', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cart.html'));
});

app.get('/orders', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'orders.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin/orders', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-orders.html'));
});

app.get('/owner', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'owner.html'));
});

app.get('/product', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'product.html'));
});

app.get('/product.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'product.html'));
});

// Initialize database and start server
async function startServer() {
  try {
    await initDatabase();
    console.log('Database initialized');
    
    // Force reseed to ensure products exist
    forceReseed();
    
    // Auto-delete orders in 'agendado' status for more than 72 hours (3 days)
    setInterval(() => {
      try {
        const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
        
        // Get old orders in 'agendado' status
        const oldOrders = db().prepare(
          "SELECT id FROM orders WHERE status = 'agendado' AND created_at < ?"
        ).all(seventyTwoHoursAgo);
        
        // Delete order items first
        oldOrders.forEach(order => {
          db().prepare('DELETE FROM order_items WHERE order_id = ?').run(order.id);
        });
        
        // Delete orders in 'agendado' status older than 72 hours
        const result = db().prepare(
          "DELETE FROM orders WHERE status = 'agendado' AND created_at < ?"
        ).run(seventyTwoHoursAgo);
        
        if (result.changes > 0) {
          console.log(`Auto-deleted ${result.changes} agendado orders older than 72 hours`);
        }
      } catch (error) {
        console.error('Auto-delete orders error:', error);
      }
    }, 60 * 60 * 1000); // Run every hour
    
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
