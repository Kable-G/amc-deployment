/**
 * AutoMediaCenter Global Shell
 * Uses the exact header and sidebar from radar_history_enterprise.html
 * Complete integration with enterprise sidebar system, avatar modal, cart, notifications
 */

// ---- Configuration ----
const ROLE_COLORS = {
  media_user: '#10B981',     // green
  client_user: '#3B82F6',    // blue  
  client_admin: '#F59E0B',   // orange
  platform_admin: '#DC2626' // red
};

const STORAGE_KEYS = {
  ROLE: 'amc_user_role',
  DARK_MODE: 'amc_dark_mode',
  SIDEBAR_COLLAPSED: 'amc_sidebar_collapsed',
  CART_COUNT: 'amc_cart_count',
  USER_EMAIL: 'amc_user_email'
};

// ---- Utilities ----
const qs = (sel, ctx = document) => ctx.querySelector(sel);
const qsa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

// Enhanced storage helpers with validation
const storage = {
  get: (key, defaultValue = null) => {
    try {
      return localStorage.getItem(key) || defaultValue;
    } catch (e) {
      console.warn(`Storage get failed for key: ${key}`, e);
      return defaultValue;
    }
  },
  
  set: (key, value) => {
    try {
      localStorage.setItem(key, String(value));
      return true;
    } catch (e) {
      console.warn(`Storage set failed for key: ${key}`, e);
      return false;
    }
  },
  
  getBool: (key, defaultValue = false) => {
    return storage.get(key, String(defaultValue)) === 'true';
  }
};

// Role management
const roleManager = {
  get: () => storage.get(STORAGE_KEYS.ROLE, 'media_user'),
  set: (role) => {
    if (ROLE_COLORS[role]) {
      storage.set(STORAGE_KEYS.ROLE, role);
      return true;
    }
    console.warn(`Invalid role: ${role}`);
    return false;
  },
  getLabel: (role) => {
    const roleLabels = {
      media_user: 'Media User',
      client_user: 'Client User', 
      client_admin: 'Client Admin',
      platform_admin: 'Platform Admin'
    };
    return roleLabels[role] || role;
  }
};

// Dark mode management
const darkMode = {
  get: () => storage.getBool(STORAGE_KEYS.DARK_MODE),
  set: (enabled) => {
    storage.set(STORAGE_KEYS.DARK_MODE, enabled);
    document.body.classList.toggle('dark-mode', enabled);
    
    // Dispatch event for other components
    window.dispatchEvent(new CustomEvent('darkModeChange', {
      detail: { enabled }
    }));
  },
  toggle: () => {
    const current = darkMode.get();
    darkMode.set(!current);
    return !current;
  }
};

// ---- Header HTML (exact copy from radar_history_enterprise.html) ----
function headerHTML() {
  return `
    <div class="logo"><h1>AutoMediaCenter</h1></div>
    <div class="user-actions-group">
        <div class="amc-header-right">
            <div class="notification-indicator" id="notification-indicator" title="Notifications">
                <i class="fas fa-bell"></i>
                <span class="notification-badge">0</span>
            </div>
            <div class="cart-indicator" id="cart-indicator" title="View Cart (0 items)">
                <i class="fas fa-shopping-cart"></i>
                <span class="cart-badge">0</span>
            </div>
            <!-- Avatar will be auto-injected by amc-avatar-system.js -->
            <button class="amc-menu-dots" title="More options">
                <i class="fas fa-ellipsis-v"></i>
            </button>
        </div>
    </div>
  `;
}

// ---- Header initialization ----
function initHeader() {
  const mount = qs('#amc-header');
  if (!mount) {
    console.warn('Header mount point #amc-header not found');
    return;
  }
  
  // Add the app-header class to match radar_history_enterprise.html
  mount.className = 'app-header';
  mount.innerHTML = headerHTML();

  // Initialize dark mode
  darkMode.set(darkMode.get());

  // Initialize cart
  initCart();
  
  // Initialize notifications
  initNotifications();
  
  // Initialize header menu
  initHeaderMenu();
}

// ---- Cart functionality (exact copy from radar_history_enterprise.html) ----
function initCart() {
  const cartIndicator = qs('#cart-indicator');
  const cartBadge = cartIndicator?.querySelector('.cart-badge');
  
  function updateCartDisplay(count) {
    const numCount = Number(count) || 0;
    const hasItems = numCount > 0;
    
    if (cartBadge) {
      cartBadge.textContent = String(Math.min(numCount, 99));
    }
    
    if (cartIndicator) {
      cartIndicator.classList.toggle('has-items', hasItems);
      cartIndicator.title = `View Cart (${numCount} item${numCount !== 1 ? 's' : ''})`;
    }
  }

  // Global cart functions
  window.amcSetCartCount = (count) => {
    storage.set(STORAGE_KEYS.CART_COUNT, count);
    updateCartDisplay(count);
    
    // Update localStorage for badge system (radar_history_enterprise.html compatibility)
    localStorage.setItem('amc.cart.count', count);
    
    // Dispatch event
    window.dispatchEvent(new CustomEvent('cartUpdate', {
      detail: { count: Number(count) }
    }));
  };

  window.amcGetCartCount = () => {
    return Number(storage.get(STORAGE_KEYS.CART_COUNT, '0'));
  };

  // Initialize cart display
  updateCartDisplay(storage.get(STORAGE_KEYS.CART_COUNT, '0'));
  
  // Cart click handler
  if (cartIndicator) {
    cartIndicator.addEventListener('click', () => {
      // Dispatch cart click event for external handling
      window.dispatchEvent(new CustomEvent('cartClick'));
    });
  }
}

// ---- Notifications functionality (exact copy from radar_history_enterprise.html) ----
function initNotifications() {
  const notificationIndicator = qs('#notification-indicator');
  const notificationBadge = notificationIndicator?.querySelector('.notification-badge');
  
  window.amcSetNotifCount = (count) => {
    const numCount = Number(count) || 0;
    const hasNotifications = numCount > 0;
    
    if (notificationBadge) {
      notificationBadge.textContent = String(Math.min(numCount, 99));
    }
    
    if (notificationIndicator) {
      notificationIndicator.classList.toggle('has-new', hasNotifications);
    }
    
    // Update localStorage for badge system (radar_history_enterprise.html compatibility)
    localStorage.setItem('amc.notifications', numCount);
    
    // Dispatch event
    window.dispatchEvent(new CustomEvent('notificationUpdate', {
      detail: { count: numCount }
    }));
  };
  
  // Notification click handler
  if (notificationIndicator) {
    notificationIndicator.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('notificationClick'));
    });
  }
  
  // Initialize
  window.amcSetNotifCount(0);
}

// ---- Header menu functionality ----
function initHeaderMenu() {
  const menuBtn = qs('.amc-menu-dots');
  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      // Dispatch event for external handling
      window.dispatchEvent(new CustomEvent('headerMenuClick'));
    });
  }
}

// ---- Avatar info updates ----
function updateAvatarInfo() {
  const role = roleManager.get();
  const email = storage.get(STORAGE_KEYS.USER_EMAIL, 'user@automediacenter.com');
  const roleLabel = roleManager.getLabel(role);
  
  // Apply role color to avatar rings
  applyRoleColor(role);
  
  // Store user info for avatar system
  localStorage.setItem('user', JSON.stringify({
    email: email,
    role: role
  }));
  
  // Also store in currentUser for compatibility
  localStorage.setItem('currentUser', JSON.stringify({
    email: email,
    role: role
  }));
}

// ---- Role color application ----
function applyRoleColor(role) {
  const color = ROLE_COLORS[role] || ROLE_COLORS.media_user;
  const rings = qsa('.amc-avatar-ring');
  
  rings.forEach(ring => {
    ring.style.setProperty('--avatar-ring', color);
  });
}

// ---- Role selector overlay (for testing) ----
function mountRoleSelector() {
  if (qs('#amcRoleSelector')) return; // Already mounted

  const overlay = document.createElement('div');
  overlay.id = 'amcRoleSelector';
  overlay.style.cssText = `
    position: fixed; top: 12px; right: 200px; z-index: 11000;
    background: rgba(17,24,39,0.9); color: #fff; padding: 8px 12px;
    border-radius: 8px; display: flex; gap: 8px; align-items: center;
    backdrop-filter: blur(8px); font: 600 12px/1.2 Inter, system-ui, sans-serif;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `;
  
  overlay.innerHTML = `
    <span style="opacity: 0.9;">Role:</span>
    <select id="amcRoleSelect" style="
      appearance: none; background: #111827; border: 1px solid #374151;
      color: #e5e7eb; border-radius: 6px; padding: 6px 8px; font-weight: 600;
      cursor: pointer;
    ">
      ${Object.keys(ROLE_COLORS).map(role => 
        `<option value="${role}">${roleManager.getLabel(role)}</option>`
      ).join('')}
    </select>
  `;
  
  document.body.appendChild(overlay);

  const select = qs('#amcRoleSelect');
  if (select) {
    select.value = roleManager.get();
    select.addEventListener('change', () => {
      const newRole = select.value;
      if (roleManager.set(newRole)) {
        updateAvatarInfo();
        // Refresh sidebar with new role
        if (window.amcSidebar) {
          window.amcSidebar.refresh(newRole);
        }
      }
    });
  }
}

// ---- Main initialization ----
function boot() {
  try {
    console.log('🚀 Initializing AutoMediaCenter Global Shell...');
    
    initHeader();
    updateAvatarInfo();
    
    // Mount role selector for test pages
    if (document.body.hasAttribute('data-amc-role-selector') || 
        document.documentElement.hasAttribute('data-amc-role-selector')) {
      mountRoleSelector();
    }
    
    console.log('✅ Global Shell initialized successfully');
    
    // Dispatch ready event
    window.dispatchEvent(new CustomEvent('amcShellReady'));
    
  } catch (error) {
    console.error('❌ Failed to initialize Global Shell:', error);
  }
}

// ---- Public API ----
window.AMCShell = {
  updateRole: (role) => {
    if (roleManager.set(role)) {
      updateAvatarInfo();
      // Refresh sidebar with new role
      if (window.amcSidebar) {
        window.amcSidebar.refresh(role);
      }
      return true;
    }
    return false;
  },
  
  setUserEmail: (email) => {
    storage.set(STORAGE_KEYS.USER_EMAIL, email);
    updateAvatarInfo();
  },
  
  toggleDarkMode: () => darkMode.toggle(),
  
  setCartCount: (count) => window.amcSetCartCount(count),
  
  setNotificationCount: (count) => window.amcSetNotifCount(count)
};

// ---- Auto-boot ----
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}