# TiendaBea - Order Scheduling System Specification

## 1. Project Overview

**Project Name:** TiendaBea  
**Project Type:** E-commerce Web Application with Order Scheduling  
**Core Functionality:** A store where customers can browse products by category, add items to cart, schedule orders with unique codes, and receive PDF receipts via WhatsApp. Administrators can manage products and track order statuses.  
**Target Users:** 
- Normal customers (shopping and scheduling orders)
- Administrators (product and order management)
- Owner (full system control)

---

## 2. Technical Stack

- **Backend:** Node.js + Express.js
- **Database:** SQLite with better-sqlite3
- **Authentication:** JWT (JSON Web Tokens)
- **PDF Generation:** PDFKit
- **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
- **File Storage:** Local filesystem (uploads folder)

---

## 3. Database Schema

### Users Table
```sql
CREATE TABLE users (
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
);
```

### Categories Table
```sql
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Products Table
```sql
CREATE TABLE products (
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
);
```

### Orders Table
```sql
CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  order_code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'registered' CHECK(status IN ('registered', 'under_review', 'shipped')),
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  total_amount REAL NOT NULL,
  notes TEXT,
  pdf_path TEXT,
  whatsapp_sent INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Order Items Table
```sql
CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  subtotal REAL NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);
```

---

## 4. Categories

The store will have 10 predefined categories:
1. Home
2. School
3. Summer
4. Technology
5. Accessories
6. Appliances
7. Cleaning
8. Clothing
9. Toys
10. Crockery

---

## 5. User Roles & Permissions

### Normal User (user)
- Register and login
- Browse products by category
- Add products to shopping cart
- Update cart quantities
- Place scheduled orders
- View order history and status
- Receive PDF receipt via WhatsApp

### Administrator (admin)
- All normal user capabilities
- Add/remove products
- Create products with categories, photos, descriptions
- Update product stock
- View all orders
- Update order status (registered → under_review → shipped)
- Cannot create or delete other admins

### Owner (owner)
- Unique user (only one can exist)
- All administrator capabilities
- Create new administrators
- Delete administrators
- Cannot be deleted
- Full system control

---

## 6. Order Status Flow

1. **Registered** - Order is scheduled and created
2. **Under Review** - Admin verifies payment
3. **Shipped** - Order sent by agency

---

## 7. API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Products
- `GET /api/products` - List all products (with filters)
- `GET /api/products/:id` - Get product details
- `POST /api/products` - Create product (admin/owner)
- `PUT /api/products/:id` - Update product (admin/owner)
- `DELETE /api/products/:id` - Delete product (admin/owner)

### Categories
- `GET /api/categories` - List all categories
- `POST /api/categories` - Create category (admin/owner)
- `PUT /api/categories/:id` - Update category (admin/owner)
- `DELETE /api/categories/:id` - Delete category (admin/owner)

### Cart
- `GET /api/cart` - Get user's cart
- `POST /api/cart/add` - Add item to cart
- `PUT /api/cart/update/:id` - Update cart item quantity
- `DELETE /api/cart/remove/:id` - Remove item from cart
- `DELETE /api/cart/clear` - Clear cart

### Orders
- `POST /api/orders` - Place order
- `GET /api/orders` - Get user's orders (or all for admin)
- `GET /api/orders/:id` - Get order details
- `PUT /api/orders/:id/status` - Update order status (admin/owner)
- `GET /api/orders/:id/pdf` - Generate/download PDF

### Admin Management (Owner only)
- `GET /api/admin/users` - List all admins
- `POST /api/admin/create-admin` - Create admin (owner)
- `DELETE /api/admin/:id` - Delete admin (owner)

---

## 8. WhatsApp Integration

The WhatsApp message will include:
- Customer name and lastname
- User code
- Order code
- Order details
- Scheduled date and time

Format: A pre-filled WhatsApp message will be generated with the order information, using the WhatsApp API format: `https://wa.me/{phone}?text={encoded_message}`

**Note:** The store's WhatsApp number will be configurable in the system.

---

## 9. PDF Generation

PDF will include:
- Store header/logo
- Order code
- Customer details (name, lastname, user code)
- Order date and scheduled date/time
- List of items with quantities and prices
- Total amount
- Order status

---

## 10. Frontend Pages

### Public Pages
- `/` - Home/Store page with category navigation
- `/login` - Login page
- `/register` - Registration page

### User Pages
- `/cart` - Shopping cart
- `/orders` - User's order history
- `/orders/:id` - Order details

### Admin Pages
- `/admin/products` - Product management
- `/admin/products/new` - Add new product
- `/admin/products/:id/edit` - Edit product
- `/admin/orders` - All orders management
- `/admin/orders/:id` - Order details with status update

### Owner Pages
- `/owner/admins` - Admin management
- `/owner/admins/new` - Create new admin

---

## 11. UI/UX Design

### Color Palette
- Primary: `#2C3E50` (Dark Blue)
- Secondary: `#E74C3C` (Red)
- Accent: `#3498DB` (Blue)
- Background: `#ECF0F1` (Light Gray)
- Success: `#27AE60` (Green)
- Warning: `#F39C12` (Orange)
- Text: `#2C3E50` (Dark Blue)
- White: `#FFFFFF`

### Typography
- Headings: 'Poppins', sans-serif
- Body: 'Open Sans', sans-serif

### Layout
- Responsive design (mobile, tablet, desktop)
- Navigation bar with user menu
- Product grid with category filters
- Clean card-based design for products
- Order status badges with colors

---

## 12. Security Requirements

- Passwords hashed with bcrypt
- JWT tokens for authentication
- Role-based access control
- Input validation and sanitization
- File upload restrictions (images only)

---

## 13. Acceptance Criteria

1. ✅ Users can register and login
2. ✅ Products display organized by 10 categories
3. ✅ Users can add products to cart
4. ✅ Users can schedule orders with date/time
5. ✅ Unique order code generated for each order
6. ✅ PDF generated with order details
7. ✅ WhatsApp message contains required customer info
8. ✅ Admin can manage products (CRUD)
9. ✅ Admin can update order status
10. ✅ Owner can create/delete administrators
11. ✅ Only one owner can exist
12. ✅ Order status flow works correctly
