// Product Detail Page - Clean Implementation
(function() {
  'use strict';
  
  // Get product ID from URL
  const productId = new URLSearchParams(window.location.search).get('id');
  
  // DOM Elements
  const loadingEl = document.getElementById('loading');
  const errorEl = document.getElementById('error');
  const productDetailEl = document.getElementById('product-detail');
  
  // Show/hide helpers
  function showLoading() {
    loadingEl.style.display = 'flex';
    errorEl.style.display = 'none';
    productDetailEl.style.display = 'none';
  }
  
  function showError(message) {
    loadingEl.style.display = 'none';
    errorEl.style.display = 'flex';
    errorEl.querySelector('.error').textContent = message;
    productDetailEl.style.display = 'none';
  }
  
  function showProduct() {
    loadingEl.style.display = 'none';
    errorEl.style.display = 'none';
    productDetailEl.style.display = 'block';
  }
  
  // Format price
  function formatPrice(price) {
    return '$' + parseFloat(price).toFixed(2);
  }
  
  // Render product
  function renderProduct(product) {
    const imageUrl = product.image_url || '/uploads/default-product.png';
    const stockAvailable = product.stock > 0;
    
    productDetailEl.innerHTML = `
      <div class="product-detail-grid">
        <div class="product-detail-image">
          <img src="${imageUrl}" alt="${product.name}" loading="lazy" decoding="async" onerror="this.src='/uploads/default-product.png'">
        </div>
        <div class="product-detail-info">
          <span class="product-category">${product.category_name || 'Sin categoría'}</span>
          <h1 class="product-title">${product.name}</h1>
          <p class="product-price">${formatPrice(product.price)}</p>
          
          <div class="product-stock">
            <span class="stock-label">Stock disponible:</span>
            <span class="stock-value ${stockAvailable ? 'in-stock' : 'out-of-stock'}">
              ${product.stock} unidades
            </span>
          </div>
          
          <p class="product-description">${product.description || 'Sin descripción disponible'}</p>
          
          <div class="product-actions">
            <div class="quantity-selector">
              <label for="quantity">Cantidad:</label>
              <input type="number" id="quantity" class="form-input" 
                     value="1" min="1" max="${product.stock}" 
                     ${!stockAvailable ? 'disabled' : ''}>
            </div>
            
            <button id="add-to-cart-btn" class="btn btn-success btn-lg" 
                    ${!stockAvailable ? 'disabled' : ''}>
              ${stockAvailable ? 'Agregar al Carrito' : 'Sin Stock'}
            </button>
          </div>
        </div>
      </div>
    `;
    
    // Add event listener for add to cart button
    const addBtn = document.getElementById('add-to-cart-btn');
    if (addBtn && stockAvailable) {
      addBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        addToCart(product.id);
      });
    }
    
    showProduct();
  }
  
  // Add to cart
  async function addToCart(productId) {
    const token = localStorage.getItem('token');
    
    if (!token) {
      window.location.href = '/login';
      return;
    }
    
    const quantityInput = document.getElementById('quantity');
    const quantity = parseInt(quantityInput.value) || 1;
    
    if (quantity < 1) {
      alert('La cantidad debe ser al menos 1');
      return;
    }
    
    const btn = document.getElementById('add-to-cart-btn');
    btn.disabled = true;
    btn.textContent = 'Agregando...';
    
    try {
      const response = await fetch('/api/cart/add', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ product_id: productId, quantity: quantity })
      });
      
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Error al agregar al carrito' }));
        throw new Error(data.error || 'Error al agregar al carrito');
      }
      
      alert('¡Producto agregado al carrito!');
      
      // Update cart badge
      const cartResponse = await fetch('/api/cart', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (cartResponse.ok) {
        const cartData = await cartResponse.json();
        const badge = document.getElementById('cart-badge');
        if (badge && cartData.items) {
          const totalItems = cartData.items.reduce((sum, item) => sum + item.quantity, 0);
          badge.textContent = totalItems;
          badge.style.display = totalItems > 0 ? 'inline-block' : 'none';
        }
      }
      
      btn.textContent = 'Agregado ✓';
      setTimeout(function() {
        btn.textContent = 'Agregar al Carrito';
        btn.disabled = false;
      }, 2000);
      
    } catch (e) {
      alert(e.message);
      btn.disabled = false;
      btn.textContent = 'Agregar al Carrito';
    }
  }
  
  // Load product from API
  async function loadProduct() {
    // Validate ID
    if (!productId) {
      showError('Producto no encontrado - ID inválido');
      return;
    }
    
    showLoading();
    
    try {
      const response = await fetch('/api/products/' + productId, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          showError('Producto no encontrado');
          return;
        }
        throw new Error('Error del servidor: ' + response.status);
      }
      
      const product = await response.json();
      
      if (!product || !product.id) {
        showError('Producto no encontrado');
        return;
      }
      
      renderProduct(product);
      
    } catch (e) {
      console.error('Error loading product:', e);
      showError('Error al cargar el producto: ' + e.message);
    }
  }
  
  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', function() {
    // Initialize navbar (non-blocking)
    if (typeof Navbar !== 'undefined') {
      Navbar.init().catch(function() {});
    }
    
    // Load product
    loadProduct();
  });
  
})();
