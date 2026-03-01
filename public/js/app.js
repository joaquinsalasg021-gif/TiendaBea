// TiendaBea - Main JavaScript

const API_URL = '/api';

// ==================== GLOBAL HELPERS ====================

// Toggle navbar mobile menu - available globally
function toggleNavbar() {
  const menu = document.querySelector('.navbar-menu');
  if (menu) {
    menu.classList.toggle('active');
  }
}

// Toggle sidebar categories on mobile - available globally
function toggleSidebar() {
  const categoryList = document.querySelector('.category-list');
  const userSidebar = document.querySelector('.user-sidebar');
  const toggle = document.querySelector('.sidebar-toggle');
  
  if (categoryList) {
    categoryList.classList.toggle('show');
  }
  if (userSidebar) {
    userSidebar.classList.toggle('show');
  }
  if (toggle) {
    toggle.classList.toggle('collapsed');
  }
}

// Global function to open WhatsApp with order info
function openWhatsApp(orderCode, name, lastname, scheduledDate, scheduledTime, phone, dni, shippingAgency, province) {
  const timeStr = scheduledTime ? ` a las ${scheduledTime}` : '';
  const msg = `Hola Bea, soy ${name} ${lastname}. He agendado un pedido con el código ${orderCode} para el ${scheduledDate}${timeStr}. Mi número es ${phone || 'No proporcionado'} y mi DNI es ${dni || 'No proporcionado'}. Mi agencia de envío es ${shippingAgency || 'No proporcionada'} y la provincia de destino es ${province || 'No proporcionada'}.`;
  const url = `https://wa.me/51929007757?text=${encodeURIComponent(msg)}`;
  window.location.href = url;
}

// Global function to generate shipping guide/PDF
async function generateGuide(orderId) {
  try {
    UI.showToast('Generando guía...');
    
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/orders/${orderId}/pdf`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Error al generar guía');
    }
    
    const data = await response.json();
    
    if (data.pdf_path) {
      window.open(data.pdf_path, '_blank');
      UI.showToast('Guía generada exitosamente!');
    } else {
      UI.showToast('Error al generar la guía', 'error');
    }
  } catch (e) {
    console.error('Generate guide error:', e);
    UI.showToast('Error al generar la guía: ' + e.message, 'error');
  }
}

// ==================== AUTH ====================

const Auth = {
  getToken: () => localStorage.getItem('token'),
  
  getUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },
  
  setAuth: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  },
  
  clearAuth: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
  
  isLoggedIn: () => !!localStorage.getItem('token'),
  
  isAdmin: () => {
    const user = Auth.getUser();
    return user && (user.role === 'admin' || user.role === 'owner');
  },
  
  isOwner: () => {
    const user = Auth.getUser();
    return user && user.role === 'owner';
  },
  
  logout: () => {
    Auth.clearAuth();
    window.location.href = '/';
  }
};

// ==================== API ====================

const api = {
  async request(endpoint, options = {}) {
    const token = Auth.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Something went wrong');
    }
    
    return data;
  },
  
  get: (endpoint) => api.request(endpoint),
  post: (endpoint, data) => api.request(endpoint, { method: 'POST', body: JSON.stringify(data) }),
  put: (endpoint, data) => api.request(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (endpoint) => api.request(endpoint, { method: 'DELETE' })
};

// ==================== UI HELPERS ====================

const UI = {
  showToast: (message, type = 'success') => {
    const container = document.querySelector('.toast-container') || UI.createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  },
  
  createToastContainer: () => {
    const container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
  },
  
  showLoading: (element) => {
    element.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  },
  
  showError: (message) => {
    return `<div class="alert alert-error">${message}</div>`;
  },
  
  showEmpty: (message = 'No se encontraron elementos') => {
    return `<div class="empty-state"><div class="empty-state-icon">📦</div><p>${message}</p></div>`;
  },
  
  formatPrice: (price) => {
    return `$${parseFloat(price).toFixed(2)}`;
  },
  
  formatDate: (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES');
  },
  
  formatDateTime: (dateStr, timeStr) => {
    const date = new Date(dateStr);
    const dateStr2 = date.toLocaleDateString('es-ES');
    return timeStr ? `${dateStr2} ${timeStr}` : dateStr2;
  }
};

// ==================== NAVBAR ====================

const Navbar = {
  init: () => {
    Navbar.render();
    window.addEventListener('storage', () => Navbar.render());
  },
  
  render: () => {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;
    
    const user = Auth.getUser();
    const isLoggedIn = Auth.isLoggedIn();
    
    let html = `
      <div class="navbar-container">
        <a href="/" class="navbar-brand">🛒️ TiendaBea</a>
        <button class="navbar-toggle" onclick="toggleNavbar()">☰</button>
        <div class="navbar-menu">
          <a href="/">Tienda</a>
    `;
    
    if (isLoggedIn) {
      html += `
        <a href="/cart" class="cart-link">🛒 <span class="cart-badge" id="cart-badge">0</span></a>
        <a href="/orders" class="cart-link">📋 Mis Pedidos</a>
      `;
      
      if (Auth.isAdmin()) {
        html += `<a href="/admin">Admin</a>`;
      }
      
      if (Auth.isOwner()) {
        html += `<a href="/owner">Owner</a>`;
      }
      
      html += `
        <div class="navbar-user">
          <span>${user.name}</span>
          <button class="btn btn-sm btn-outline" onclick="Auth.logout()">Cerrar Sesión</button>
        </div>
      `;
    } else {
      html += `
        <a href="/login">Login</a>
        <a href="/register">Register</a>
      `;
    }
    
    html += `</div></div>`;
    navbar.innerHTML = html;
    
    if (isLoggedIn) {
      Navbar.updateCartBadge();
    }
  },
  
  updateCartBadge: async () => {
    try {
      const { items } = await api.get('/cart');
      const badge = document.getElementById('cart-badge');
      if (badge && items) {
        badge.textContent = items.length;
      }
    } catch (e) {
      console.error('Error updating cart badge:', e);
    }
  }
};

// ==================== HOME PAGE ====================

const HomePage = {
  init: async () => {
    await HomePage.loadCategories();
    await HomePage.loadProducts();
    HomePage.setupFilters();
  },
  
  loadCategories: async () => {
    try {
      const categories = await api.get('/categories');
      const container = document.getElementById('category-list');
      let html = `<li class="category-item active" data-category="">
        <span class="category-icon">📦</span>
        <span class="category-name">Todos los Productos</span>
      </li>`;
      
      const categoryIcons = {
        'Hogar': '🏠',
        'Escuela': '📚',
        'Verano': '☀️',
        'Tecnología': '💻',
        'Accesorios': '🎒',
        'Electrodomésticos': '🔌',
        'Limpieza': '🧹',
        'Ropa': '👕',
        'Juguetes': '🧸',
        'Vajilla': '🍽️'
      };
      
      categories.forEach(cat => {
        const icon = categoryIcons[cat.name] || '📦';
        html += `<li class="category-item" data-category="${cat.id}">
          <span class="category-icon">${icon}</span>
          <span class="category-name">${cat.name}</span>
        </li>`;
      });
      
      container.innerHTML = html;
      
      container.querySelectorAll('.category-item').forEach(btn => {
        btn.addEventListener('click', () => {
          container.querySelectorAll('.category-item').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          HomePage.filterProducts(btn.dataset.category);
        });
      });
    } catch (e) {
      console.error('Error loading categories:', e);
    }
  },
  
  loadProducts: async () => {
    try {
      const products = await api.get('/products');
      HomePage.renderProducts(products);
    } catch (e) {
      console.error('Error loading products:', e);
      document.getElementById('product-grid').innerHTML = UI.showError('Error al cargar productos');
    }
  },
  
  filterProducts: async (categoryId) => {
    try {
      const url = categoryId ? `/products?category=${categoryId}` : '/products';
      const products = await api.get(url);
      HomePage.renderProducts(products);
    } catch (e) {
      console.error('Error filtering products:', e);
    }
  },
  
  setupFilters: () => {
    let searchTimeout;
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(async () => {
        const search = e.target.value;
        const activeCategory = document.querySelector('.category-filter.active');
        const categoryId = activeCategory ? activeCategory.dataset.category : '';
        
        let url = '/products';
        const params = [];
        if (categoryId) params.push(`category=${categoryId}`);
        if (search) params.push(`search=${search}`);
        if (params.length) url += '?' + params.join('&');
        
        const products = await api.get(url);
        HomePage.renderProducts(products);
      }, 300);
    });
  },
  
  renderProducts: (products) => {
    const container = document.getElementById('product-grid');
    
    if (!products.length) {
      container.innerHTML = UI.showEmpty('No hay productos disponibles');
      return;
    }
    
    let html = '';
    products.forEach(product => {
      const imageHtml = product.image_url 
        ? `<img src="${product.image_url}" alt="${product.name}" class="product-image">`
        : `<div class="product-image-placeholder">📦</div>`;
      
      const stockClass = product.stock < 5 ? 'low' : '';
      const disabled = product.stock === 0 ? 'disabled' : '';
      
      html += `
        <div class="product-card">
          <a href="/product?id=${product.id}" class="product-card-link">
            ${imageHtml}
            <div class="product-info">
              <h3 class="product-name">${product.name}</h3>
              <p class="product-description">${product.description || ''}</p>
              <div class="product-price">${UI.formatPrice(product.price)}</div>
              <div class="product-stock ${stockClass}">Stock: ${product.stock}</div>
            </div>
          </a>
          <div class="product-actions">
            <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); HomePage.addToCart(${product.id})" ${disabled}>
              ${product.stock === 0 ? 'Sin Stock' : 'Agregar'}
            </button>
          </div>
        </div>
      `;
    });
    
    container.innerHTML = html;
  },
  
  addToCart: async (productId) => {
    if (!Auth.isLoggedIn()) {
      window.location.href = '/login';
      return;
    }
    
    try {
      await api.post('/cart/add', { product_id: productId, quantity: 1 });
      UI.showToast('Producto agregado al carrito!');
      Navbar.updateCartBadge();
    } catch (e) {
      UI.showToast(e.message, 'error');
    }
  }
};

// ==================== CART PAGE ====================

const CartPage = {
  init: async () => {
    if (!Auth.isLoggedIn()) {
      window.location.href = '/login';
      return;
    }
    
    await CartPage.loadCart();
    CartPage.setupCheckout();
    await CartPage.loadOrders();
  },
  
  loadCart: async () => {
    try {
      const { items, total } = await api.get('/cart');
      CartPage.renderCart(items, total);
    } catch (e) {
      console.error('Error loading cart:', e);
      document.getElementById('cart-items').innerHTML = UI.showError('Error al cargar carrito');
    }
  },
  
  loadOrders: async () => {
    try {
      const orders = await api.get('/orders');
      CartPage.renderOrders(orders);
    } catch (e) {
      console.error('Error loading orders:', e);
      document.getElementById('cart-orders-list').innerHTML = UI.showError('Error al cargar pedidos');
    }
  },

  renderOrders: (orders) => {
    const container = document.getElementById('cart-orders-list');
    
    if (!orders || orders.length === 0) {
      container.innerHTML = '<p class="text-muted">No tienes pedidos aún</p>';
      return;
    }
    
    let html = '<table class="admin-table mt-2"><thead><tr><th>Código</th><th>Fecha</th><th>Total</th><th>Estado</th><th>WhatsApp</th><th>Detalles</th><th>Guía</th></tr></thead><tbody>';
    
    orders.slice(0, 5).forEach(order => {
      const statusLabel = order.status === 'agendado' ? 'Agendado' :
                        order.status === 'en_proceso' ? 'En proceso' : 'Enviado';
      const statusClass = order.status === 'agendado' ? 'status-agendado' :
                        order.status === 'en_proceso' ? 'status-en-proceso' : 'status-enviado';
      const orderName = order.name || '';
      const orderLastname = order.lastname || '';
      const orderPhone = order.phone || '';
      const orderDni = order.dni || '';
      const orderShipping = order.shipping_agency || '';
      const orderProvince = order.province || '';
      const orderDate = order.scheduled_date || '';
      const orderTime = order.scheduled_time || '';
      
      html += `
        <tr>
          <td>${order.order_code}</td>
          <td>${UI.formatDateTime(order.scheduled_date, order.scheduled_time)}</td>
          <td>${UI.formatPrice(order.total_amount)}</td>
          <td><span class="order-status ${statusClass}">${statusLabel}</span></td>
          <td><button onclick="openWhatsApp('${order.order_code}', '${orderName}', '${orderLastname}', '${orderDate}', '${orderTime}', '${orderPhone}', '${orderDni}', '${orderShipping}', '${orderProvince}')" class="btn btn-sm btn-success" title="Enviar por WhatsApp">📲 WhatsApp</button></td>
          <td><a href="/orders.html?id=${order.id}" class="btn btn-sm btn-primary">Ver</a></td>
          <td><button onclick="generateGuide(${order.id})" class="btn btn-sm btn-accent" title="Detalles del Pedido">📄 Guía</button></td>
        </tr>
      `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
  },

  renderCart: (items, total) => {
    const container = document.getElementById('cart-items');
    
    if (!items.length) {
      container.innerHTML = UI.showEmpty('Tu carrito está vacío');
      document.getElementById('cart-summary').classList.add('d-none');
      return;
    }
    
    let html = `
      <table class="cart-table">
        <thead>
          <tr>
            <th>Producto</th>
            <th>Precio</th>
            <th>Cantidad</th>
            <th>Subtotal</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    items.forEach(item => {
      html += `
        <tr>
          <td>${item.name}</td>
          <td>${UI.formatPrice(item.price)}</td>
          <td>
            <div class="quantity-control">
              <button class="quantity-btn" onclick="CartPage.updateQuantity(${item.id}, ${item.quantity - 1})">-</button>
              <input type="number" class="quantity-input" value="${item.quantity}" readonly>
              <button class="quantity-btn" onclick="CartPage.updateQuantity(${item.id}, ${item.quantity + 1})">+</button>
            </div>
          </td>
          <td>${UI.formatPrice(item.price * item.quantity)}</td>
          <td>
            <button class="btn btn-danger btn-sm" onclick="CartPage.removeItem(${item.id})">Eliminar</button>
          </td>
        </tr>
      `;
    });
    
    html += `</tbody></table>`;
    container.innerHTML = html;
    
    document.getElementById('cart-total').textContent = UI.formatPrice(total);
    document.getElementById('cart-summary').classList.remove('d-none');
  },
  
  updateQuantity: async (itemId, quantity) => {
    if (quantity < 1) {
      CartPage.removeItem(itemId);
      return;
    }
    
    try {
      await api.put(`/cart/update/${itemId}`, { quantity });
      CartPage.loadCart();
      Navbar.updateCartBadge();
    } catch (e) {
      UI.showToast(e.message, 'error');
    }
  },
  
  removeItem: async (itemId) => {
    try {
      await api.delete(`/cart/remove/${itemId}`);
      CartPage.loadCart();
      Navbar.updateCartBadge();
    } catch (e) {
      UI.showToast(e.message, 'error');
    }
  },
  
  showWhatsappModal: (orderCode, name, lastname, phone, dni, shippingAgency, province, scheduledDate, scheduledTime) => {
    // Show payment modal with bank details
    CartPage.showPaymentModal(orderCode);
  },
  
  showPaymentModal: (orderCode) => {
    const modal = document.getElementById('payment-modal');
    const codeEl = document.getElementById('payment-order-code');
    const copyBtn = document.getElementById('payment-copy-btn');
    const whatsBtn = document.getElementById('payment-whatsapp-btn');
    const closeBtn = document.getElementById('payment-close');
    
    if (!modal) return;
    
    codeEl.textContent = orderCode;
    
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(orderCode);
        UI.showToast('Código copiado ✅');
      } catch {
        UI.showToast('No se pudo copiar', 'error');
      }
    };
    
    // WhatsApp voucher button
    whatsBtn.onclick = () => {
      const user = Auth.getUser();
      const userName = user?.name || '';
      const userLastname = user?.lastname || '';
      const msg = `Buenas Bea, soy ${userName} ${userLastname}. Agendé el pedido ${orderCode}. Adjuntaré mi voucher.`;
      const url = `https://wa.me/51929007757?text=${encodeURIComponent(msg)}`;
      window.location.href = url;
    };
    
    const close = () => { modal.style.display = 'none'; };
    closeBtn.onclick = close;
    
    // Cerrar si hace click fuera
    modal.onclick = (e) => { if (e.target === modal) close(); };
    
    modal.style.display = 'flex';
  },
  
  showPlinQR: () => {
    const modal = document.getElementById('plin-qr-modal');
    if (modal) {
      modal.style.display = 'flex';
    }
  },
  
  copyToClipboard: async (text, btn) => {
    try {
      await navigator.clipboard.writeText(text);
      const originalText = btn.textContent;
      btn.textContent = 'Copiado! ✅';
      setTimeout(() => { btn.textContent = originalText; }, 2000);
    } catch {
      UI.showToast('No se pudo copiar', 'error');
    }
  },
  
  setupCheckout: () => {
    const form = document.getElementById('checkout-form');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const scheduledDate = document.getElementById('scheduled_date').value;
      const dni = document.getElementById('dni').value;
      let shippingAgency = document.getElementById('shipping_agency').value;
      const province = document.getElementById('province').value;
      const notes = document.getElementById('notes').value;
      
      // Handle "Otros" shipping agency
      if (shippingAgency === 'Otros') {
        const otherAgency = document.getElementById('other_agency').value;
        if (!otherAgency) {
          UI.showToast('Por favor especifique la agencia de envío', 'error');
          return;
        }
        shippingAgency = otherAgency;
      }
      
      // Validate Delivery (solo Lima) - province must be Lima
      if (shippingAgency === 'Delivery (solo Lima)' && province.toLowerCase() !== 'lima') {
        UI.showToast('Para Delivery, la provincia debe ser Lima', 'error');
        return;
      }
      
      try {
        const result = await api.post('/orders', {
          scheduled_date: scheduledDate,
          dni,
          shipping_agency: shippingAgency,
          province,
          notes
        });
        
        // Clear cart UI
        document.getElementById('cart-items').innerHTML = UI.showEmpty('Tu carrito está vacío');
        document.getElementById('cart-summary').classList.add('d-none');
        
        // Get order from response (handle different response structures)
        const order = result?.order ?? result?.data?.order ?? result;
        if (!order || !order.order_code) {
          console.log('Order result:', result);
          UI.showToast('Error: No se pudo obtener la orden', 'error');
          return;
        }
        
        const user = Auth.getUser();
        const userPhone = user.phone || '';
        
        const scheduledTime = order.scheduled_time ?? 'No especificada';
        const message = `Buenas Bea, soy ${order.name} ${order.lastname}.\n` +
          `Agendé un pedido con el código ${order.order_code} para la fecha ${order.scheduled_date} a las ${scheduledTime}.\n` +
          `Mi número es: ${userPhone}\n` +
          `Mi DNI es: ${order.dni}\n` +
          `Agencia de envío: ${order.shipping_agency}\n` +
          `Provincia de destino: ${order.province}`;
        
        const STORE_PHONE = '51929007757';
        const whatsappUrl = `https://wa.me/${STORE_PHONE}?text=${encodeURIComponent(message)}`;
        
        UI.showToast('¡Pedido realizado exitosamente!');
        
        // Show WhatsApp modal with complete order details
        const orderCode = order.order_code || 'Código no disponible';
        const userName = order.name || user.name || '';
        const userLastname = order.lastname || user.lastname || '';
        const orderDni = order.dni || '';
        const orderShipping = order.shipping_agency || '';
        const orderProvince = order.province || '';
        const orderDate = order.scheduled_date || '';
        const orderTime = order.scheduled_time || '';
        CartPage.showWhatsappModal(orderCode, userName, userLastname, userPhone, orderDni, orderShipping, orderProvince, orderDate, orderTime);
      } catch (e) {
        UI.showToast(e.message, 'error');
      }
    });
  }
};

// ==================== ORDERS PAGE ====================

const OrdersPage = {
  init: async () => {
    if (!Auth.isLoggedIn()) {
      window.location.href = '/login';
      return;
    }
    
    await OrdersPage.loadOrders();
  },
  
  loadOrders: async () => {
    try {
      const orders = await api.get('/orders');
      OrdersPage.renderOrders(orders);
    } catch (e) {
      console.error('Error loading orders:', e);
      document.getElementById('orders-list').innerHTML = UI.showError('Error al cargar pedidos');
    }
  },

  renderOrders: (orders) => {
    const container = document.getElementById('orders-list');
    
    if (!orders.length) {
      container.innerHTML = UI.showEmpty('No hay pedidos aún');
      return;
    }
    
    let html = '<table class="admin-table mt-2"><thead><tr><th>Código</th><th>Fecha</th><th>Total</th><th>Estado</th><th>WhatsApp</th><th>Detalles</th><th>Guía</th></tr></thead><tbody>';
    
    orders.forEach(order => {
      const statusLabel = order.status === 'agendado' ? 'Agendado' :
                        order.status === 'en_proceso' ? 'En proceso' : 'Enviado';
      const statusClass = order.status === 'agendado' ? 'status-agendado' :
                        order.status === 'en_proceso' ? 'status-en-proceso' : 'status-enviado';
      const orderName = order.name || '';
      const orderLastname = order.lastname || '';
      const orderPhone = order.phone || '';
      const orderDni = order.dni || '';
      const orderShipping = order.shipping_agency || '';
      const orderProvince = order.province || '';
      const orderDate = order.scheduled_date || '';
      const orderTime = order.scheduled_time || '';
      
      html += `
        <tr>
          <td>${order.order_code}</td>
          <td>${UI.formatDateTime(order.scheduled_date, order.scheduled_time)}</td>
          <td>${UI.formatPrice(order.total_amount)}</td>
          <td><span class="order-status ${statusClass}">${statusLabel}</span></td>
          <td><button onclick="openWhatsApp('${order.order_code}', '${orderName}', '${orderLastname}', '${orderDate}', '${orderTime}', '${orderPhone}', '${orderDni}', '${orderShipping}', '${orderProvince}')" class="btn btn-sm btn-success" title="Enviar por WhatsApp">📲 WhatsApp</button></td>
          <td><a href="/orders.html?id=${order.id}" class="btn btn-sm btn-primary">Ver</a></td>
          <td><button onclick="generateGuide(${order.id})" class="btn btn-sm btn-accent" title="Generar Guía">📄 Guía</button></td>
        </tr>
      `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
  }
};

// ==================== LOGIN PAGE ====================

const LoginPage = {
  init: () => {
    if (Auth.isLoggedIn()) {
      window.location.href = '/';
      return;
    }
    
    const form = document.getElementById('login-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      
      try {
        const { user, token } = await api.post('/auth/login', { username, password });
        Auth.setAuth(token, user);
        UI.showToast('Login exitoso!');
        
        if (user.role === 'owner') {
          window.location.href = '/owner';
        } else if (user.role === 'admin') {
          window.location.href = '/admin';
        } else {
          window.location.href = '/';
        }
      } catch (e) {
        UI.showToast(e.message, 'error');
      }
    });
  }
};

// ==================== REGISTER PAGE ====================

const RegisterPage = {
  init: () => {
    if (Auth.isLoggedIn()) {
      window.location.href = '/';
      return;
    }
    
    const form = document.getElementById('register-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const data = {
        username: document.getElementById('username').value,
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
        name: document.getElementById('name').value,
        lastname: document.getElementById('lastname').value,
        phone: document.getElementById('phone').value
      };
      
      try {
        const { user, token } = await api.post('/auth/register', data);
        Auth.setAuth(token, user);
        UI.showToast('¡Registro exitoso!');
        window.location.href = '/';
      } catch (e) {
        UI.showToast(e.message, 'error');
      }
    });
  }
};

// ==================== ADMIN PAGE ====================

const AdminPage = {
  init: async () => {
    if (!Auth.isAdmin()) {
      window.location.href = '/';
      return;
    }
    
    AdminPage.setupTabs();
    await AdminPage.loadProducts();
  },
  
  setupTabs: () => {
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const tabId = tab.dataset.tab;
        document.querySelectorAll('.admin-content').forEach(c => c.classList.add('d-none'));
        document.getElementById(`${tabId}-tab`).classList.remove('d-none');
        
        if (tabId === 'products') {
          AdminPage.loadProducts();
        } else if (tabId === 'orders') {
          AdminPage.loadAllOrders();
        } else if (tabId === 'users') {
          AdminPage.loadUsers();
        }
      });
    });
  },
  
  loadProducts: async () => {
    try {
      const products = await api.get('/products?active=all');
      AdminPage.renderProducts(products);
    } catch (e) {
      console.error('Error loading products:', e);
    }
  },
  
  searchProducts: async () => {
    const searchTerm = document.getElementById('product-search').value;
    if (!searchTerm) {
      AdminPage.loadProducts();
      return;
    }
    
    try {
      const products = await api.get(`/products?search=${encodeURIComponent(searchTerm)}`);
      AdminPage.renderProducts(products);
    } catch (e) {
      console.error('Error searching products:', e);
    }
  },
  
  renderProducts: (products) => {
    const container = document.getElementById('products-list');
    
    if (!products.length) {
      container.innerHTML = UI.showEmpty('No hay productos');
      return;
    }
    
    let html = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Nombre</th>
            <th>Precio</th>
            <th>Stock</th>
            <th>Categoría</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    products.forEach(p => {
      html += `
        <tr>
          <td>${p.id}</td>
          <td>${p.name}</td>
          <td>${UI.formatPrice(p.price)}</td>
          <td>${p.stock}</td>
          <td>${p.category_name || 'N/A'}</td>
          <td class="admin-actions">
            <button class="btn btn-sm btn-primary" onclick="AdminPage.editProduct(${p.id})">Editar</button>
            <button class="btn btn-sm btn-danger" onclick="AdminPage.deleteProduct(${p.id})">Eliminar</button>
          </td>
        </tr>
      `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
  },
  
  loadAllOrders: async () => {
    try {
      const orders = await api.get('/orders');
      AdminPage.renderOrders(orders);
    } catch (e) {
      console.error('Error loading orders:', e);
    }
  },
  
  renderOrders: (orders) => {
    const container = document.getElementById('orders-list');
    
    if (!orders.length) {
      container.innerHTML = UI.showEmpty('No hay pedidos');
      return;
    }
    
    let html = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Cliente</th>
            <th>Total</th>
            <th>Fecha</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    orders.forEach(order => {
      let countdownHtml = '-';
      if (order.status === 'agendado') {
        const createdAt = new Date(order.created_at).getTime();
        const expiresAt = createdAt + (48 * 60 * 60 * 1000);
        const now = Date.now();
        const remaining = expiresAt - now;
        
        if (remaining > 0) {
          const hours = Math.floor(remaining / (1000 * 60 * 60));
          const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
          countdownHtml = `<span class="countdown" data-expires="${expiresAt}">${hours}h ${minutes}m</span>`;
        } else {
          countdownHtml = `<span class="countdown expired">Expirado</span>`;
        }
      }
      
      html += `
        <tr>
          <td>${order.order_code}</td>
          <td>${order.name} ${order.lastname}</td>
          <td>${UI.formatPrice(order.total_amount)}</td>
          <td>${UI.formatDateTime(order.scheduled_date, order.scheduled_time)}</td>
          <td>
            <select onchange="AdminPage.updateOrderStatus(${order.id}, this.value)" class="form-select" style="width: auto;">
              <option value="agendado" ${order.status === 'agendado' ? 'selected' : ''}>Agendado</option>
              <option value="en_proceso" ${order.status === 'en_proceso' ? 'selected' : ''}>En proceso</option>
              <option value="enviado" ${order.status === 'enviado' ? 'selected' : ''}>Enviado</option>
            </select>
          </td>
          <td>
            <a href="/orders.html?id=${order.id}" class="btn btn-sm btn-primary">Ver</a>
            <button onclick="AdminPage.generateGuide(${order.id})" class="btn btn-sm btn-primary" title="Detalles del Pedido">📄 Detalles de mi Pedido</button>
          </td>
        </tr>
      `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
  },
  
  updateOrderStatus: async (orderId, status) => {
    try {
      await api.put(`/orders/${orderId}/status`, { status });
      UI.showToast('Estado actualizado!');
    } catch (e) {
      UI.showToast(e.message, 'error');
    }
  },
  
  generateGuide: async (orderId) => {
    try {
      UI.showToast('Generando guía...');
      
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/orders/${orderId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Error al generar guía');
      }
      
      const data = await response.json();
      
      if (data.pdf_path) {
        window.open(data.pdf_path, '_blank');
        UI.showToast('Guía generada exitosamente!');
      } else {
        UI.showToast('Error al generar la guía', 'error');
      }
    } catch (e) {
      console.error('Generate guide error:', e);
      UI.showToast('Error al generar la guía: ' + e.message, 'error');
    }
  },
  
  searchOrders: async () => {
    const searchTerm = document.getElementById('order-search').value.trim();
    const container = document.getElementById('orders-list');
    
    if (!searchTerm) {
      AdminPage.loadAllOrders();
      return;
    }
    
    try {
      const orders = await api.get(`/orders/search/${encodeURIComponent(searchTerm)}`);
      AdminPage.renderOrders(orders);
      if (orders.length === 0) {
        container.innerHTML = UI.showEmpty('No se encontraron pedidos');
      }
    } catch (e) {
      UI.showToast('Error al buscar pedidos', 'error');
    }
  },
  
  editProduct: async (productId) => {
    // Open the admin product modal directly
    if (typeof AdminProductModal !== 'undefined') {
      try {
        const product = await api.get(`/products/${productId}`);
        AdminProductModal.open(product);
      } catch (e) {
        UI.showToast('Error loading product', 'error');
      }
    } else {
      // Fallback to product page
      window.location.href = `/product?id=${productId}&edit=true`;
    }
  },
  
  deleteProduct: async (productId) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este producto?')) return;
    
    try {
      await api.delete(`/products/${productId}`);
      UI.showToast('Producto eliminado');
      AdminPage.loadProducts();
    } catch (e) {
      UI.showToast(e.message, 'error');
    }
  },
  
  loadUsers: async () => {
    try {
      const users = await api.get('/admin/all-users');
      AdminPage.renderUsers(users);
    } catch (e) {
      console.error('Error loading users:', e);
    }
  },
  
  renderUsers: (users) => {
    const container = document.getElementById('users-list');
    
    if (!users.length) {
      container.innerHTML = UI.showEmpty('No hay usuarios registrados');
      return;
    }
    
    let html = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Username</th>
            <th>Nombre</th>
            <th>Email</th>
            <th>Teléfono</th>
            <th>Total Gastado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    users.forEach(user => {
      const totalSpent = user.total_spent ? `$${user.total_spent.toFixed(2)}` : '$0.00';
      html += `
        <tr>
          <td>${user.id}</td>
          <td>${user.username}</td>
          <td>${user.name} ${user.lastname}</td>
          <td>${user.email}</td>
          <td>${user.phone || 'N/A'}</td>
          <td>${totalSpent}</td>
          <td>
            <button onclick="AdminPage.viewUserOrders(${user.id}, '${user.name} ${user.lastname}')" class="btn btn-sm btn-primary">Ver Pedidos</button>
          </td>
        </tr>
      `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
  },
  
  viewUserOrders: async (userId, userName) => {
    try {
      const orders = await api.get(`/admin/users/${userId}/orders`);
      AdminPage.renderUserOrdersModal(userId, userName, orders);
    } catch (e) {
      UI.showToast('Error al cargar pedidos del usuario', 'error');
    }
  },
  
  renderUserOrdersModal: (userId, userName, orders) => {
    let modal = document.getElementById('user-orders-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'user-orders-modal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px;">
          <div class="modal-header">
            <h2 id="user-orders-title">Pedidos</h2>
            <button class="modal-close" onclick="document.getElementById('user-orders-modal').style.display='none'">&times;</button>
          </div>
          <div class="modal-body" id="user-orders-body"></div>
        </div>
      `;
      document.body.appendChild(modal);
    }
    
    const modalTitle = document.getElementById('user-orders-title');
    const modalBody = document.getElementById('user-orders-body');
    
    modalTitle.textContent = `Pedidos de ${userName}`;
    
    if (!orders.length) {
      modalBody.innerHTML = UI.showEmpty('Este usuario no tiene pedidos');
    } else {
      let html = `
        <table class="admin-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
      `;
      
      orders.forEach(order => {
        const statusLabel = order.status === 'agendado' ? 'Agendado' : 
                          order.status === 'en_proceso' ? 'En proceso' : 'Enviado';
        html += `
          <tr>
            <td>${order.order_code}</td>
            <td>${UI.formatDate(order.created_at)}</td>
            <td>${statusLabel}</td>
            <td>$${order.total_amount.toFixed(2)}</td>
          </tr>
        `;
      });
      
      html += '</tbody></table>';
      modalBody.innerHTML = html;
    }
    
    modal.style.display = 'flex';
  }
};

// ==================== OWNER PAGE ====================

const OwnerPage = {
  init: async () => {
    if (!Auth.isOwner()) {
      window.location.href = '/';
      return;
    }
    
    OwnerPage.setupTabs();
    await OwnerPage.loadAdmins();
    OwnerPage.setupCreateAdmin();
    OwnerPage.setupSettings();
    
    // Load products tab by default if clicking from navbar
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('tab') === 'products') {
      OwnerPage.showTab('products');
    }
  },
  
  setupTabs: () => {
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabId = tab.dataset.tab;
        OwnerPage.showTab(tabId);
      });
    });
  },
  
  showTab: (tabId) => {
    // Hide all tabs
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-content').forEach(c => c.classList.add('d-none'));
    
    // Show selected tab
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    const content = document.getElementById(`${tabId}-tab`);
    if (content) {
      content.classList.remove('d-none');
    }
    
    // Load data for the tab
    if (tabId === 'products') {
      OwnerPage.loadProducts();
    } else if (tabId === 'admins') {
      OwnerPage.loadAdmins();
    } else if (tabId === 'orders') {
      OwnerPage.loadOrders();
    }
  },
  
  loadProducts: async () => {
    try {
      const products = await api.get('/products?active=all');
      OwnerPage.renderProducts(products);
    } catch (e) {
      console.error('Error loading products:', e);
      document.getElementById('products-list').innerHTML = UI.showError('Error al cargar productos');
    }
  },
  
  renderProducts: (products) => {
    const container = document.getElementById('products-list');
    
    if (!products.length) {
      container.innerHTML = UI.showEmpty('No hay productos');
      return;
    }
    
    let html = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Nombre</th>
            <th>Precio</th>
            <th>Stock</th>
            <th>Categoría</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    products.forEach(p => {
      html += `
        <tr>
          <td>${p.id}</td>
          <td>${p.name}</td>
          <td>${UI.formatPrice(p.price)}</td>
          <td>${p.stock}</td>
          <td>${p.category_name || 'N/A'}</td>
          <td class="admin-actions">
            <button class="btn btn-sm btn-primary" onclick="AdminPage.editProduct(${p.id})">Editar</button>
            <button class="btn btn-sm btn-danger" onclick="AdminPage.deleteProduct(${p.id})">Eliminar</button>
          </td>
        </tr>
      `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
  },
  
  searchProducts: async () => {
    const searchTerm = document.getElementById('product-search').value;
    if (!searchTerm) {
      OwnerPage.loadProducts();
      return;
    }
    
    try {
      const products = await api.get(`/products?search=${encodeURIComponent(searchTerm)}`);
      OwnerPage.renderProducts(products);
    } catch (e) {
      console.error('Error searching products:', e);
    }
  },
  
  loadAdmins: async () => {
    try {
      const admins = await api.get('/admin/users');
      OwnerPage.renderAdmins(admins);
    } catch (e) {
      console.error('Error loading admins:', e);
    }
  },
  
  renderAdmins: (admins) => {
    const container = document.getElementById('admins-list');
    
    if (!admins.length) {
      container.innerHTML = UI.showEmpty('No hay administradores');
      return;
    }
    
    let html = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Username</th>
            <th>Nombre</th>
            <th>Email</th>
            <th>User Code</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    admins.forEach(admin => {
      const isOwner = admin.role === 'owner';
      html += `
        <tr>
          <td>${admin.id}</td>
          <td>${admin.username}</td>
          <td>${admin.name} ${admin.lastname}</td>
          <td>${admin.email}</td>
          <td>${admin.user_code}</td>
          <td>
            ${isOwner 
              ? '<span class="btn btn-sm btn-warning">Owner</span>' 
              : `<button class="btn btn-sm btn-danger" onclick="OwnerPage.deleteAdmin(${admin.id})">Eliminar</button>`
            }
          </td>
        </tr>
      `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
  },
  
  setupCreateAdmin: () => {
    const form = document.getElementById('create-admin-form');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const emailInput = document.getElementById('admin_email').value;
      const data = {
        username: document.getElementById('admin_username').value,
        email: emailInput || null, // Email es opcional ahora
        password: document.getElementById('admin_password').value,
        name: document.getElementById('admin_name').value,
        lastname: document.getElementById('admin_lastname').value,
        phone: document.getElementById('admin_phone').value
      };
      
      try {
        await api.post('/admin/create-admin', data);
        UI.showToast('¡Administrador creado exitosamente!');
        form.reset();
        OwnerPage.loadAdmins();
      } catch (e) {
        UI.showToast(e.message, 'error');
      }
    });
  },
  
  setupSettings: async () => {
    try {
      const settings = await api.get('/settings');
      document.getElementById('store_name').value = settings.store_name || '';
      document.getElementById('store_phone').value = settings.store_phone || '';
    } catch (e) {
      console.error('Error loading settings:', e);
    }
    
    const form = document.getElementById('settings-form');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const data = {
        store_name: document.getElementById('store_name').value,
        store_phone: document.getElementById('store_phone').value
      };
      
      try {
        await api.put('/settings', data);
        UI.showToast('¡Configuración guardada!');
      } catch (e) {
        UI.showToast(e.message, 'error');
      }
    });
  },
  
  deleteAdmin: async (adminId) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este administrador?')) return;
    
    try {
      await api.delete(`/admin/${adminId}`);
      UI.showToast('Administrador eliminado');
      OwnerPage.loadAdmins();
    } catch (e) {
      UI.showToast(e.message, 'error');
    }
  }
};

// ==================== ORDER DETAIL PAGE ====================

const OrderDetailPage = {
  init: async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('id');
    
    if (!orderId) {
      window.location.href = '/orders';
      return;
    }
    
    await OrderDetailPage.loadOrder(orderId);
  },
  
  loadOrder: async (orderId) => {
    try {
      const order = await api.get(`/orders/${orderId}`);
      OrderDetailPage.renderOrder(order);
    } catch (e) {
      console.error('Error loading order:', e);
      document.getElementById('order-detail').innerHTML = UI.showError('Error al cargar pedido');
    }
  },
  
  renderOrder: (order) => {
    const container = document.getElementById('order-detail');
    
    let itemsHtml = order.items.map(item => `
      <tr>
        <td>${item.name}</td>
        <td>${item.quantity}</td>
        <td>${UI.formatPrice(item.unit_price)}</td>
        <td>${UI.formatPrice(item.subtotal)}</td>
      </tr>
    `).join('');
    
    const user = Auth.getUser();
    const isAdmin = user && (user.role === 'admin' || user.role === 'owner');
    
    let statusSelect = '';
    if (isAdmin) {
      statusSelect = `
        <div class="form-group mt-2">
          <label class="form-label">Actualizar Estado:</label>
          <select id="order-status" class="form-select" style="width: auto;">
            <option value="agendado" ${order.status === 'agendado' ? 'selected' : ''}>Agendado</option>
            <option value="en_proceso" ${order.status === 'en_proceso' ? 'selected' : ''}>En proceso</option>
            <option value="enviado" ${order.status === 'enviado' ? 'selected' : ''}>Enviado</option>
          </select>
          <button class="btn btn-primary mt-1" onclick="OrderDetailPage.updateStatus(${order.id})">Actualizar</button>
        </div>
      `;
    }
    
    const html = `
      <div class="card">
        <div class="card-header">
          <div class="d-flex justify-content-between align-items-center">
            <h2>Pedido: ${order.order_code}</h2>
            <span class="order-status ${order.status}">${order.status === 'agendado' ? 'Agendado' : order.status === 'en_proceso' ? 'En proceso' : 'Enviado'}</span>
          </div>
        </div>
        <div class="card-body">
          <div class="order-details mb-3">
            <div class="order-detail-item">
              <div class="order-detail-label">Cliente</div>
              <div>${order.name} ${order.lastname}</div>
            </div>
            <div class="order-detail-item">
              <div class="order-detail-label">Código de Usuario</div>
              <div>${order.user_code}</div>
            </div>
            <div class="order-detail-item">
              <div class="order-detail-label">Teléfono</div>
              <div>${order.phone || 'N/A'}</div>
            </div>
            <div class="order-detail-item">
              <div class="order-detail-label">Fecha Programada</div>
              <div>${UI.formatDateTime(order.scheduled_date, order.scheduled_time)}</div>
            </div>
            ${order.notes ? `<div class="order-detail-item"><div class="order-detail-label">Notas</div><div>${order.notes}</div></div>` : ''}
          </div>
          
          <h3>Productos</h3>
          <table class="admin-table mt-2">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Precio Unitario</th>
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" class="text-right"><strong>Total:</strong></td>
                <td><strong>${UI.formatPrice(order.total_amount)}</strong></td>
              </tr>
            </tfoot>
          </table>
          
          ${statusSelect}
          
          <div class="mt-3">
            <button onclick="OrderDetailPage.downloadPDF(${order.id})" class="btn btn-primary">
              📄 Descargar PDF
            </button>
          </div>
        </div>
      </div>
    `;
    
    container.innerHTML = html;
  },
  
  downloadPDF: async (orderId) => {
    try {
      UI.showToast('Generando PDF...', 'info');
      const response = await fetch(`/api/orders/${orderId}/pdf`, {
        headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.pdf_path) {
          window.open(data.pdf_path, '_blank');
          UI.showToast('¡PDF descargado exitosamente!');
        }
      } else {
        throw new Error('Failed to generate PDF');
      }
    } catch (e) {
      console.error('PDF download error:', e);
      UI.showToast('Error al generar PDF', 'error');
    }
  },
  
  updateStatus: async (orderId) => {
    const status = document.getElementById('order-status').value;
    
    try {
      await api.put(`/orders/${orderId}/status`, { status });
      UI.showToast('Estado actualizado!');
      OrderDetailPage.loadOrder(orderId);
    } catch (e) {
      UI.showToast(e.message, 'error');
    }
  }
};

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', () => {
  Navbar.init();
  
  const page = document.body.dataset.page;
  
  switch (page) {
    case 'home':
      HomePage.init();
      break;
    case 'cart':
      CartPage.init();
      break;
    case 'orders':
      OrdersPage.init();
      break;
    case 'order-detail':
      OrderDetailPage.init();
      break;
    case 'login':
      LoginPage.init();
      break;
    case 'register':
      RegisterPage.init();
      break;
    case 'admin':
      AdminPage.init();
      break;
    case 'owner':
      OwnerPage.init();
      break;
  }
});
