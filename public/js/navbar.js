// Lightweight Navbar for product detail page
const API_BASE = '/api';

const Navbar = {
  initialized: false,
  
  init: async () => {
    // Prevent double initialization
    if (Navbar.initialized) {
      return;
    }
    Navbar.initialized = true;
    
    Navbar.render();
    Navbar.applyDarkMode();
    await Navbar.updateCartBadge();
  },
  
  applyDarkMode: () => {
    const darkMode = localStorage.getItem('darkMode') === 'true';
    if (darkMode) {
      document.body.classList.add('dark-mode');
    }
  },
  
  toggleDarkMode: () => {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDark);
    // Update button icon
    const btn = document.getElementById('dark-mode-toggle');
    if (btn) {
      btn.innerHTML = isDark ? '☀️' : '🌙';
      btn.title = isDark ? 'Modo claro' : 'Modo oscuro';
    }
  },
  
  render: () => {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;
    
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    
    let navLinks = '';
    let authButtons = '';
    
    if (token) {
      navLinks = `
        <a href="/" class="nav-link">Tienda</a>
        <a href="/tiendas" class="nav-link">Tiendas</a>
        <a href="/cart" class="nav-link">Carrito <span id="cart-badge" style="display:none;">0</span></a>
      `;
      
      if (user.role === 'owner' || user.role === 'admin') {
        navLinks += `<a href="/admin" class="nav-link">Admin</a>`;
      }
      
      authButtons = `
        <span class="nav-user">${user.name || user.username}</span>
        <button onclick="logout()" class="btn btn-sm btn-outline">Cerrar Sesión</button>
      `;
    } else {
      navLinks = `
        <a href="/" class="nav-link">Tienda</a>
        <a href="/tiendas" class="nav-link">Tiendas</a>
        <a href="/reclamaciones" class="nav-link">Reclamaciones</a>
      `;
      authButtons = `
        <a href="/login" class="btn btn-sm btn-outline">Iniciar Sesión</a>
        <a href="/register" class="btn btn-sm btn-primary">Registrarse</a>
      `;
    }
    
    navbar.innerHTML = `
      <div class="navbar-container">
        <a href="/" class="navbar-brand">TiendaBea</a>
        <div class="navbar-menu">
          ${navLinks}
        </div>
        <div class="navbar-social">
          <a href="https://www.tiktok.com/@beamayorista.oficial?_r=1&_t=ZS-94Rj9EvGmkX" target="_blank" title="TikTok" class="social-icon">📱</a>
          <a href="https://www.facebook.com/beamayorista.oficial/?locale=es_LA" target="_blank" title="Facebook" class="social-icon">📘</a>
          <a href="https://www.instagram.com/beamayorista/" target="_blank" title="Instagram" class="social-icon">📷</a>
        </div>
        <div class="navbar-actions">
          <button id="dark-mode-toggle" class="dark-mode-toggle" onclick="Navbar.toggleDarkMode()" title="${isDarkMode ? 'Modo claro' : 'Modo oscuro'}">${isDarkMode ? '☀️' : '🌙'}</button>
        </div>
        <div class="navbar-auth" id="nav-auth">
          ${authButtons}
        </div>
      </div>
    `;
  },
  
  updateCartBadge: async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
      const response = await fetch(`${API_BASE}/cart`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) return;
      
      const data = await response.json();
      const badge = document.getElementById('cart-badge');
      if (badge && data.items) {
        const totalItems = data.items.reduce((sum, item) => sum + item.quantity, 0);
        badge.textContent = totalItems;
        badge.style.display = totalItems > 0 ? 'inline-block' : 'none';
      }
    } catch (e) {
      console.log('Cart badge update skipped');
    }
  }
};

// Logout function
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/';
}
