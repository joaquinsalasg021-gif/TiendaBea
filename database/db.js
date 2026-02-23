const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'tiendabea.db');

let db = null;

async function initDatabase() {
  const SQL = await initSqlJs();
  
  // Create database file if it doesn't exist
  if (!fs.existsSync(dbPath)) {
    console.log('Creating new database...');
  }
  
  // Try to load existing database
  let data = null;
  if (fs.existsSync(dbPath)) {
    data = fs.readFileSync(dbPath);
  }
  
  db = new SQL.Database(data);
  
  // Check and migrate orders table if needed
  try {
    const result = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='orders'");
    if (result.length > 0 && result[0].values.length > 0) {
      // Table exists, check for old status values
      const statusCheck = db.exec("SELECT DISTINCT status FROM orders WHERE status IN ('registered', 'confirmed', 'shipped')");
      if (statusCheck.length > 0 && statusCheck[0].values.length > 0) {
        console.log('Migrating existing orders to new status values...');
        db.run("UPDATE orders SET status = 'agendado' WHERE status = 'registered'");
        db.run("UPDATE orders SET status = 'en_proceso' WHERE status = 'confirmed'");
        db.run("UPDATE orders SET status = 'enviado' WHERE status = 'shipped'");
        saveDatabase();
        console.log('Order status migration completed.');
      }
    }
  } catch (e) {
    console.log('Orders migration check:', e.message);
  }
  
  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      lastname TEXT NOT NULL,
      phone TEXT,
      role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin', 'owner')),
      user_code TEXT UNIQUE,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      stock INTEGER DEFAULT 0,
      category_id INTEGER,
      image_url TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      order_code TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'agendado',
      scheduled_date DATE NOT NULL,
      scheduled_time TIME,
      total_amount REAL NOT NULL,
      notes TEXT,
      dni TEXT,
      shipping_agency TEXT,
      province TEXT,
      pdf_path TEXT,
      whatsapp_sent INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Seed default categories
  const categories = [
    'Hogar', 'Escuela', 'Verano', 'Tecnología', 'Accesorios', 
    'Electrodomésticos', 'Limpieza', 'Ropa', 'Juguetes', 'Vajilla'
  ];
  
  categories.forEach(cat => {
    db.run('INSERT OR IGNORE INTO categories (name) VALUES (?)', [cat]);
  });
  
  // Seed default settings
  db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('store_name', 'TiendaBea')");
  db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('store_phone', '')");
  db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('owner_created', 'false')");
  
  // Seed sample products for testing
  const sampleProducts = [
    { name: 'Camisa Manga Larga', description: 'Camisa de manga larga para hombre', price: 49.99, stock: 50, category: 'Ropa' },
    { name: 'Pantalón Jeans', description: 'Pantalón jeans moderno', price: 79.99, stock: 30, category: 'Ropa' },
    { name: 'Zapatillas Deportivas', description: 'Zapatillas cómodas para deporte', price: 89.99, stock: 25, category: 'Ropa' },
    { name: 'Set de Küchen', description: 'Set de Küchen de 10 piezas', price: 129.99, stock: 15, category: 'Hogar' },
    { name: 'Licuadora', description: 'Licuadora potente 500W', price: 69.99, stock: 20, category: 'Electrodomésticos' },
    { name: 'Mochila Escolar', description: 'Mochila resistente para escuela', price: 39.99, stock: 40, category: 'Escuela' },
    { name: 'Crema Solar', description: 'Protector solar SPF 50', price: 24.99, stock: 60, category: 'Verano' },
    { name: 'Gorra', description: 'Gorra para el sol', price: 19.99, stock: 50, category: 'Accesorios' },
    { name: 'Televisor 32"', description: 'Smart TV HD 32 pulgadas', price: 599.99, stock: 10, category: 'Tecnología' },
    { name: 'Juego de Sábanas', description: 'Juego de sábanas de algodon', price: 89.99, stock: 35, category: 'Hogar' }
  ];
  
  // Get category IDs and insert products
  const getDb = () => {
    return { prepare: (sql) => ({
      run: (...params) => { db.run(sql, params); },
      get: (...params) => { 
        const stmt = db.prepare(sql); 
        stmt.bind(params); 
        if (stmt.step()) { const row = stmt.getAsObject(); stmt.free(); return row; }
        stmt.free(); 
        return undefined; 
      }
    }) };
  };
  
  sampleProducts.forEach(prod => {
    const cat = getDb().prepare('SELECT id FROM categories WHERE name = ?').get(prod.category);
    if (cat) {
      getDb().prepare(
        'INSERT INTO products (name, description, price, stock, category_id) VALUES (?, ?, ?, ?, ?)'
      ).run(prod.name, prod.description, prod.price, prod.stock, cat.id);
    }
  });
  
  console.log('Sample products seeded:', sampleProducts.length);
  
  // Create default owner account (only if not exists)
  // NOTE: Default credentials should be changed in production!
  // Default: username: owner, password: CHANGE_THIS_IN_PRODUCTION
  const bcrypt = require('bcryptjs');
  const { v4: uuidv4 } = require('uuid');
  
  try {
    // Check if owner already exists
    const ownerCheck = db.exec("SELECT id FROM users WHERE role = 'owner'");
    if (ownerCheck.length > 0 && ownerCheck[0].values.length > 0) {
      console.log('Owner account already exists, skipping seed.');
      return db;
    }
    
    const hashedPassword = bcrypt.hashSync('CHANGE_THIS_IN_PRODUCTION', 10);
    const userCode = 'USR-' + uuidv4().substring(0, 8).toUpperCase();
    
    db.run(
      'INSERT INTO users (username, email, password, name, lastname, phone, role, user_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['owner', 'owner@tiendabea.com', hashedPassword, 'Admin', 'Owner', '999999999', 'owner', userCode]
    );
    
    db.run("UPDATE settings SET value = 'true' WHERE key = 'owner_created'");
    console.log('Default owner account created: owner / CHANGE_THIS_IN_PRODUCTION');
  } catch (e) {
    console.log('Owner account may already exist:', e.message);
  }
  
  // Migrate orders table - update status values if needed
  try {
    // Update existing orders with old status values to new ones
    db.run("UPDATE orders SET status = 'agendado' WHERE status = 'registered'");
    db.run("UPDATE orders SET status = 'en_proceso' WHERE status = 'confirmed'");
    db.run("UPDATE orders SET status = 'enviado' WHERE status = 'shipped'");
    console.log('Orders status migration completed.');
  } catch (e) {
    console.log('Orders table may not exist yet or migration not needed.');
  }
  
  // Save database
  saveDatabase();
  
  console.log('Database initialized successfully!');
  console.log('Default categories seeded.');
  
  return db;
}

function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

// Helper functions that match better-sqlite3 API
function prepare(sql) {
  return {
    run: (...params) => {
      db.run(sql, params);
      saveDatabase();
      const result = db.exec("SELECT last_insert_rowid() as id");
      const lastId = result.length > 0 && result[0].values.length > 0 ? result[0].values[0][0] : 0;
      return { lastInsertRowid: lastId };
    },
    get: (...params) => {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return row;
      }
      stmt.free();
      return undefined;
    },
    all: (...params) => {
      const stmt = db.prepare(sql);
      if (params.length > 0) {
        stmt.bind(params);
      }
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    }
  };
}

function getDb() {
  return { prepare };
}

// Force reseed function - call this to reset database
function forceReseed() {
  console.log('Force reseeding database...');
  
  // Clear existing data
  db.run('DELETE FROM order_items');
  db.run('DELETE FROM orders');
  db.run('DELETE FROM cart_items');
  db.run('DELETE FROM products');
  db.run('DELETE FROM categories');
  db.run('DELETE FROM users');
  
  // Reset owner_created setting
  db.run("DELETE FROM settings WHERE key = 'owner_created'");
  db.run("INSERT INTO settings (key, value) VALUES ('owner_created', 'false')");
  
  // Recreate categories
  const categories = [
    'Hogar', 'Escuela', 'Verano', 'Tecnología', 'Accesorios', 
    'Electrodomésticos', 'Limpieza', 'Ropa', 'Juguetes', 'Vajilla'
  ];
  categories.forEach(cat => {
    db.run('INSERT OR IGNORE INTO categories (name) VALUES (?)', [cat]);
  });
  
  console.log('Force reseed complete. Categories recreated. Products NOT seeded (removed all products).');
  saveDatabase();
}

module.exports = { initDatabase, getDb, saveDatabase, forceReseed };
