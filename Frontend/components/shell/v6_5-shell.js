/* Extracted and modularized from automediacenter-mobile-v6.5.html (v6.5 shell source of truth)
   IMPORTANT: IDs/classes intentionally match the v6.5 template. */

// Global state variables
let currentPage = 1;
let cartItems = [];
let currentUser = null;
let currentRole = 'media_user';
let activeOverlay = null;

// Role color mapping
const roleColors = {
    'media_user': '#3B82F6',
    'client_user': '#10B981',
    'client_admin': '#F59E0B',
    'platform_admin': '#EF4444'
};

const roleColorsDark = {
    'media_user': '#60a5fa',
    'client_user': '#34d399',
    'client_admin': '#fbbf24',
    'platform_admin': '#f87171'
};

const roleHierarchy = {
    'media_user': 1,
    'client_user': 2,
    'client_admin': 3,
    'platform_admin': 4
};

function hasRole(userRole, requiredRole) {
    const userLevel = roleHierarchy[userRole] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;
    return userLevel >= requiredLevel;
}

function canAccessItem(userRole, item) {
    return item.roles.includes(userRole);
}

const mobileSidebarConfig = [
    {
        section: "Core",
        required: "media_user",
        items: [
            {
                label: "AutoMediaCenter",
                href: "automediacenter-mobile-v6.5.html",
                icon: "fas fa-newspaper",
                roles: ["media_user", "client_user", "client_admin", "platform_admin"],
                enabled: true
            },
            {
                label: "AutoMediaRadar",
                href: "newradarfe.html",
                icon: "fas fa-satellite-dish",
                roles: ["media_user", "client_user", "client_admin", "platform_admin"],
                enabled: true
            },
            {
                label: "AutoMediaLive",
                href: "automedialive.html",
                icon: "fas fa-video",
                roles: ["media_user", "client_user", "client_admin", "platform_admin"],
                enabled: true
            },
            {
                label: "AutoMediaVault",
                href: "automediavault.html",
                icon: "fas fa-lock",
                roles: ["media_user", "client_user", "client_admin", "platform_admin"],
                enabled: true
            }
        ]
    },
    {
        section: "Management",
        required: "client_user",
        items: [
            {
                label: "Company Dashboard",
                href: "client-admin-dashboard.html",
                icon: "fas fa-building",
                roles: ["client_admin", "platform_admin"],
                enabled: true
            },
            {
                label: "Upload Dashboard",
                href: "AssetDBmenu1.6.html",
                icon: "fas fa-upload",
                roles: ["client_user", "client_admin", "platform_admin"],
                enabled: true
            },
            {
                label: "Manage Releases",
                href: "manage_releases.html",
                icon: "fas fa-folder-open",
                roles: ["client_user", "client_admin", "platform_admin"],
                enabled: true
            },
            {
                label: "Radar History",
                href: "radar_history_clean.html",
                icon: "fas fa-history",
                roles: ["client_user", "client_admin", "platform_admin"],
                enabled: true
            },
            {
                label: "Manage Live Events",
                href: "manage_live.html",
                icon: "fas fa-flag-checkered",
                roles: ["client_admin", "platform_admin"],
                enabled: true
            },
            {
                label: "Manage Vault Assets",
                href: "manage_vault.html",
                icon: "fas fa-lock",
                roles: ["client_admin", "platform_admin"],
                enabled: true
            }
        ]
    },
    {
        section: "Analytics",
        required: "client_admin",
        items: [
            {
                label: "Company Analytics",
                href: "company-analytics-dashboard.html",
                icon: "fas fa-chart-line",
                roles: ["client_admin", "platform_admin"],
                enabled: true
            },
            {
                label: "AMC Analytics",
                href: "amc-analytics.html",
                icon: "fas fa-chart-bar",
                roles: ["client_admin", "platform_admin"],
                enabled: true
            },
            {
                label: "Radar Analytics",
                href: "radar_analytics.html",
                icon: "fas fa-chart-area",
                roles: ["client_admin", "platform_admin"],
                enabled: true
            },
            {
                label: "Live Analytics",
                href: "live_analytics.html",
                icon: "fas fa-chart-pie",
                roles: ["client_admin", "platform_admin"],
                enabled: true
            },
            {
                label: "Vault Analytics",
                href: "vault_analytics.html",
                icon: "fas fa-chart-bar",
                roles: ["platform_admin"],
                enabled: true
            }
        ]
    },
    {
        section: "Admin",
        required: "platform_admin",
        items: [
            {
                label: "Platform Admin",
                href: "platform-admin-dashboard.html",
                icon: "fas fa-tachometer-alt",
                roles: ["platform_admin"],
                enabled: true
            },
            {
                label: "User Management",
                href: "user-management.html",
                icon: "fas fa-users",
                roles: ["platform_admin"],
                enabled: true
            },
            {
                label: "Client Management",
                href: "client_management.html",
                icon: "fas fa-building",
                roles: ["platform_admin"],
                enabled: true
            },
            {
                label: "Access Control",
                href: "access_control.html",
                icon: "fas fa-shield-alt",
                roles: ["platform_admin"],
                enabled: true
            },
            {
                label: "System Settings",
                href: "system_settings.html",
                icon: "fas fa-cogs",
                roles: ["platform_admin"],
                enabled: true
            }
        ]
    }
];

function renderMobileSidebar() {
    const drawerContent = document.getElementById('drawerContent');
    if (!drawerContent) {
        console.error('❌ Drawer content container not found');
        return;
    }

    const currentPage = getCurrentPage();
    console.log('🔧 Rendering mobile sidebar for role:', currentRole, 'on page:', currentPage);

    // Filter sections based on user role
    const allowedSections = mobileSidebarConfig.filter(section =>
        hasRole(currentRole, section.required)
    );

    if (allowedSections.length === 0) {
        drawerContent.innerHTML = `
            <div class="drawer-header">
                <span class="drawer-title">Navigation</span>
            </div>
            <div class="drawer-section">
                <div class="drawer-section-header">ACCESS RESTRICTED</div>
                <div style="padding: 20px; text-align: center; color: var(--text-secondary);">
                    <i class="fas fa-lock" style="font-size: 24px; margin-bottom: 8px;"></i>
                    <p>No navigation items available for your role.</p>
                </div>
            </div>
        `;
        return;
    }

    // Generate HTML for allowed sections
    const sectionsHTML = allowedSections.map(section => {
        // Filter items based on user role
        const allowedItems = section.items.filter(item =>
            canAccessItem(currentRole, item) && item.enabled
        );

        if (allowedItems.length === 0) {
            return ''; // Skip empty sections
        }

        const itemsHTML = allowedItems.map(item => {
            const isActive = currentPage === item.href ||
                           window.location.pathname.endsWith(item.href);
            const activeClass = isActive ? ' active' : '';
            
            return `
                <a href="${item.href}" class="drawer-nav-item${activeClass}">
                    <i class="${item.icon}"></i> ${item.label}
                </a>
            `;
        }).join('');

        return `
            <div class="drawer-section">
                <div class="drawer-section-header">${section.section.toUpperCase()}</div>
                ${itemsHTML}
            </div>
        `;
    }).join('');

    // ENTERPRISE: Add header with "Navigation" title
    drawerContent.innerHTML = `
        <div class="drawer-header">
            <span class="drawer-title">Navigation</span>
        </div>
        ${sectionsHTML}
    `;

    // Add click handlers for navigation items
    drawerContent.querySelectorAll('.drawer-nav-item').forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            const label = link.textContent.trim();
            
            console.log('🔗 Mobile sidebar navigation:', label, '->', href);
            
            // Track analytics if available
            if (window.amcAnalytics) {
                window.amcAnalytics.log('mobile_sidebar', 'click', label);
            }
            
            // Close drawer after navigation
            closeDrawer();
        });
    });

    console.log('✅ Mobile sidebar rendered with', allowedSections.length, 'sections for role:', currentRole);
}

function initializeMobileSidebar() {
    console.log('🔧 Initializing mobile RBAC sidebar system...');
    
    // Get user role from storage (same logic as desktop)
    try {
        const userString = localStorage.getItem('user') ||
                          localStorage.getItem('currentUser') ||
                          sessionStorage.getItem('user') ||
                          sessionStorage.getItem('currentUser');
        
        if (userString) {
            const user = JSON.parse(userString);
            if (user.role) {
                currentRole = user.role;
                console.log('🔧 Mobile sidebar: Loaded user role from user object:', currentRole);
            }
        } else {
            // Try individual role key
            const roleFromStorage = localStorage.getItem('userRole') ||
                                  sessionStorage.getItem('userRole');
            
            if (roleFromStorage) {
                currentRole = roleFromStorage;
                console.log('🔧 Mobile sidebar: Loaded user role from role key:', currentRole);
            }
        }
    } catch (e) {
        console.error('❌ Error getting user role for mobile sidebar:', e);
        currentRole = 'media_user'; // Safe fallback
    }

    // Render the sidebar
    renderMobileSidebar();
    
    console.log('✅ Mobile RBAC sidebar system initialized for role:', currentRole);
}

function renderIconRail() {
    const iconRailItems = document.getElementById('iconRailItems');
    if (!iconRailItems) {
        console.warn('⚠️ Icon rail container not found');
        return;
    }

    console.log('🔧 Rendering icon rail for role:', currentRole);

    // Get allowed sections based on user role (same filtering as mobile drawer)
    const allowedSections = mobileSidebarConfig.filter(section =>
        hasRole(currentRole, section.required)
    );

    // Flatten all allowed items from all sections (ignore section headers)
    const allAllowedItems = [];
    allowedSections.forEach(section => {
        const items = section.items.filter(item =>
            canAccessItem(currentRole, item) && item.enabled
        );
        allAllowedItems.push(...items);
    });

    if (allAllowedItems.length === 0) {
        iconRailItems.innerHTML = `
            <div class="amc-rail-item" title="No items available" style="pointer-events: none; opacity: 0.5;">
                <i class="fas fa-lock"></i>
            </div>
        `;
        console.warn('⚠️ No items available for icon rail');
        return;
    }

    // Get current page for active state highlighting
    const currentPage = getCurrentPage();
    
    // Generate icon-only HTML (no text, just icons with tooltips)
    const iconsHTML = allAllowedItems.map(item => {
        const isActive = currentPage === item.href ||
                       window.location.pathname.endsWith(item.href);
        const activeClass = isActive ? ' active' : '';
        
        return `
            <a href="${item.href}" 
               class="amc-rail-item${activeClass}" 
               title="${item.label}"
               aria-label="${item.label}"
               data-page="${item.href}">
                <i class="${item.icon}"></i>
            </a>
        `;
    }).join('');

    iconRailItems.innerHTML = iconsHTML;

    // Add click handlers for navigation and analytics
    iconRailItems.querySelectorAll('.amc-rail-item').forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            const label = link.getAttribute('title');
            
            console.log('🔗 Icon rail navigation:', label, '->', href);
            
            // Track analytics if available
            if (window.amcAnalytics) {
                window.amcAnalytics.log('icon_rail', 'click', label);
            }
        });
    });

    console.log('✅ Icon rail rendered with', allAllowedItems.length, 'items');
}

function initIconRailControls() {
    const iconRailOpen = document.getElementById('iconRailOpen');
    if (iconRailOpen) {
        iconRailOpen.addEventListener('click', () => {
            console.log('📱 Opening drawer from icon rail hamburger');
            openDrawer();
        });
        console.log('✅ Icon rail controls initialized');
    }
}

// ===== AVATAR SYSTEM =====
function initializeAvatar() {
    const userString = localStorage.getItem('user') || localStorage.getItem('currentUser') || localStorage.getItem('amcUser');
    
    if (userString) {
        try {
            currentUser = JSON.parse(userString);
            currentRole = currentUser.role || 'media_user';
        } catch (e) {
            console.error('Error parsing user data:', e);
        }
    }
    
    updateAvatarDisplay();
    
    const modalEmail = document.getElementById('modalEmail');
    const modalRole = document.getElementById('modalRole');
    
    if (currentUser && currentUser.email && modalEmail) {
        modalEmail.textContent = currentUser.email;
    }
    
    if (modalRole) {
        const roleNames = {
            'media_user': 'Media User',
            'client_user': 'Client User',
            'client_admin': 'Client Admin',
            'platform_admin': 'Platform Admin'
        };
        modalRole.textContent = roleNames[currentRole] || 'Media User';
    }
}

function updateAvatarDisplay() {
    const avatarContainer = document.getElementById('avatarContainer');
    const modalAvatarIcon = document.getElementById('modalAvatarIcon');
    
    if (avatarContainer) {
        // Set role class
        avatarContainer.className = `amc-avatar role-${currentRole.replace(/_/g, '-')}`;
    }
    
    // Apply role color to modal avatar too
    const isDark = document.body.classList.contains('dark-mode');
    const color = isDark ? roleColorsDark[currentRole] : roleColors[currentRole];
    if (modalAvatarIcon) {
        modalAvatarIcon.style.color = color;
    }
}

function getCurrentPage() {
    return window.location.pathname.split('/').pop() || 'index.html';
}

function openDrawer() {
    const mobileDrawer = document.getElementById('mobileDrawer');
    const drawerBackdrop = document.getElementById('drawerBackdrop');
    if (mobileDrawer && drawerBackdrop) {
        mobileDrawer.classList.add('open');
        drawerBackdrop.classList.add('visible');
    }
}

function closeDrawer() {
    const mobileDrawer = document.getElementById('mobileDrawer');
    const drawerBackdrop = document.getElementById('drawerBackdrop');
    if (mobileDrawer && drawerBackdrop) {
        mobileDrawer.classList.remove('open');
        drawerBackdrop.classList.remove('visible');
    }
}

function updateCartBadge() {
    const quickAccessCartBadge = document.getElementById('quickAccessCartBadge');
    const notificationBadge = document.getElementById('notificationBadge');
    
    if (quickAccessCartBadge) {
        if (cartItems.length > 0) {
            quickAccessCartBadge.textContent = cartItems.length;
            quickAccessCartBadge.classList.remove('hidden');
        } else {
            quickAccessCartBadge.classList.add('hidden');
        }
    }
    
    if (notificationBadge) {
        if (cartItems.length > 0) {
            notificationBadge.textContent = cartItems.length;
            notificationBadge.style.display = 'block';
        } else {
            notificationBadge.style.display = 'none';
        }
    }
}

function updateCartModal() {
    const cartModalContent = document.getElementById('cartModalContent');
    const cartModalFooter = document.getElementById('cartModalFooter');
    const cartItemCount = document.getElementById('cartItemCount');
    
    if (!cartModalContent) return;
    
    if (cartItems.length === 0) {
        cartModalContent.innerHTML = `
            <div class="cart-empty">
                <i class="fas fa-shopping-cart"></i>
                <p>Your cart is empty</p>
            </div>
        `;
        if (cartModalFooter) cartModalFooter.classList.add('hidden');
    } else {
        const cartItemsHTML = cartItems.map(item => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <div class="cart-item-title">${item.title}</div>
                    <div class="cart-item-brand">${item.brand}</div>
                </div>
                <button class="cart-item-remove" onclick="removeFromCart('${item.id}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');
        
        cartModalContent.innerHTML = cartItemsHTML;
        if (cartModalFooter) cartModalFooter.classList.remove('hidden');
        if (cartItemCount) cartItemCount.textContent = cartItems.length;
    }
}

function removeFromCart(itemId) {
    cartItems = cartItems.filter(item => item.id !== itemId);
    updateCartModal();
    updateCartBadge();
}

function checkLoginStatus() {
    let token = localStorage.getItem('token') || localStorage.getItem('authToken');
    if (typeof fetchAndDisplayReleases === 'function') {
        fetchAndDisplayReleases(token, currentPage);
    }
}

/** Close helpers */
function _amcHide(el) { if (el) { el.classList.remove('active','visible','open'); el.classList.add('hidden'); } }
function _amcShowBackdrop(backdrop) { if (backdrop) backdrop.classList.add('visible'); }
function _amcHideBackdrop(backdrop) { if (backdrop) backdrop.classList.remove('visible'); }

function closeAllOverlays() {
  _amcHide(document.getElementById('cartModal'));
  _amcHide(document.getElementById('toolsDropdown'));
  _amcHide(document.getElementById('filterPanel'));
  _amcHide(document.getElementById('avatarModal'));
  const drawer = document.getElementById('mobileDrawer');
  if (drawer) drawer.classList.remove('open');
  _amcHideBackdrop(document.getElementById('drawerBackdrop'));
}

function initThemeToggle() {
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  if (!themeToggleBtn) return;
  const themeToggleText = themeToggleBtn.querySelector('.theme-toggle-text');
  const themeToggleIndicator = themeToggleBtn.querySelector('.theme-toggle-indicator');

  function updateThemeButton() {
    const isDark = document.body.classList.contains('dark-mode');
    if (themeToggleText) themeToggleText.textContent = isDark ? 'Light Mode' : 'Dark Mode';
    if (themeToggleIndicator) themeToggleIndicator.textContent = isDark ? '☀️' : '🌙';
  }

  // Load theme
  const stored = localStorage.getItem('amcTheme');
  if (stored === 'dark') document.body.classList.add('dark-mode');
  if (stored === 'light') document.body.classList.remove('dark-mode');
  updateThemeButton();

  themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('amcTheme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    updateThemeButton();
    // close avatar modal after action (v6.5 UX expectation)
    _amcHide(document.getElementById('avatarModal'));
  });
}

function initDrawerControls() {
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const mobileDrawer = document.getElementById('mobileDrawer');
  const drawerCloseBtn = document.getElementById('drawerCloseBtn');
  const drawerBackdrop = document.getElementById('drawerBackdrop');

  if (hamburgerBtn && mobileDrawer && drawerBackdrop) {
    hamburgerBtn.addEventListener('click', () => {
      // close other overlays
      _amcHide(document.getElementById('avatarModal'));
      _amcHide(document.getElementById('cartModal'));
      _amcHide(document.getElementById('toolsDropdown'));
      _amcHide(document.getElementById('filterPanel'));

      mobileDrawer.classList.add('open');
      drawerBackdrop.classList.add('visible');
    });
  }

  if (drawerCloseBtn && mobileDrawer && drawerBackdrop) {
    drawerCloseBtn.addEventListener('click', () => {
      mobileDrawer.classList.remove('open');
      drawerBackdrop.classList.remove('visible');
    });
  }

  if (drawerBackdrop && mobileDrawer) {
    drawerBackdrop.addEventListener('click', () => {
      closeAllOverlays();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllOverlays();
  });
}

function initCart() {
  const cartBtn = document.getElementById('cartBtn');
  const cartModal = document.getElementById('cartModal');
  const drawerBackdrop = document.getElementById('drawerBackdrop');
  if (!cartBtn || !cartModal || !drawerBackdrop) return;

  cartBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    _amcHide(document.getElementById('avatarModal'));
    _amcHide(document.getElementById('toolsDropdown'));
    _amcHide(document.getElementById('filterPanel'));
    cartModal.classList.add('active');
    drawerBackdrop.classList.add('visible');
  });

  const close = document.getElementById('cartCloseBtn');
  if (close) close.addEventListener('click', () => {
    cartModal.classList.remove('active');
    drawerBackdrop.classList.remove('visible');
  });
}

function initToolsDropdown() {
  const toolsBtn = document.getElementById('toolsBtn');
  const toolsDropdown = document.getElementById('toolsDropdown');
  if (!toolsBtn || !toolsDropdown) return;

  toolsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    _amcHide(document.getElementById('avatarModal'));
    _amcHide(document.getElementById('cartModal'));
    _amcHide(document.getElementById('filterPanel'));
    toolsDropdown.classList.toggle('active');
  });

  const close = document.getElementById('toolsCloseBtn');
  if (close) close.addEventListener('click', () => toolsDropdown.classList.remove('active'));
}

function initFilterPanel() {
  const filterBtn = document.getElementById('filterBtn');
  const filterPanel = document.getElementById('filterPanel');
  const drawerBackdrop = document.getElementById('drawerBackdrop');
  if (!filterBtn || !filterPanel || !drawerBackdrop) return;

  filterBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    _amcHide(document.getElementById('avatarModal'));
    _amcHide(document.getElementById('cartModal'));
    _amcHide(document.getElementById('toolsDropdown'));
    filterPanel.classList.add('active');
    drawerBackdrop.classList.add('visible');
  });

  const close = document.getElementById('filterPanelClose');
  if (close) close.addEventListener('click', () => {
    filterPanel.classList.remove('active');
    drawerBackdrop.classList.remove('visible');
  });
}

// Initialize header event handlers
function initHeaderEventHandlers() {
    // Avatar click handler
    const avatarContainer = document.getElementById('avatarContainer');
    if (avatarContainer) {
        avatarContainer.addEventListener('click', (e) => {
            e.stopPropagation();
            const avatarModal = document.getElementById('avatarModal');
            const toolsDropdown = document.getElementById('toolsDropdown');
            if (avatarModal) avatarModal.classList.toggle('hidden');
            if (toolsDropdown) toolsDropdown.classList.add('hidden');
            updateCartBadge();
        });
    }

    // Global click handler to close modals
    document.addEventListener('click', (e) => {
        const modal = document.getElementById('avatarModal');
        const avatar = document.getElementById('avatarContainer');
        const toolsDropdown = document.getElementById('toolsDropdown');
        
        if (modal && avatar && !modal.contains(e.target) && !avatar.contains(e.target)) {
            modal.classList.add('hidden');
        }
        
        if (toolsDropdown && !toolsDropdown.contains(e.target) && e.target.id !== 'quickAccessTools') {
            toolsDropdown.classList.add('hidden');
        }
    });

    // Quick Access Cart Button
    const quickAccessCart = document.getElementById('quickAccessCart');
    if (quickAccessCart) {
        quickAccessCart.addEventListener('click', () => {
            const avatarModal = document.getElementById('avatarModal');
            const cartModal = document.getElementById('cartModal');
            const drawerBackdrop = document.getElementById('drawerBackdrop');
            
            if (avatarModal) avatarModal.classList.add('hidden');
            if (cartModal) cartModal.classList.add('active');
            if (drawerBackdrop) drawerBackdrop.classList.add('visible');
            updateCartModal();
        });
    }

    // Quick Access Tools Button
    const quickAccessTools = document.getElementById('quickAccessTools');
    if (quickAccessTools) {
        quickAccessTools.addEventListener('click', (e) => {
            e.stopPropagation();
            const avatarModal = document.getElementById('avatarModal');
            const toolsDropdown = document.getElementById('toolsDropdown');
            
            if (avatarModal) avatarModal.classList.add('hidden');
            if (toolsDropdown) toolsDropdown.classList.toggle('hidden');
        });
    }

    // Tools Dropdown Close
    const toolsDropdownClose = document.getElementById('toolsDropdownClose');
    if (toolsDropdownClose) {
        toolsDropdownClose.addEventListener('click', () => {
            const toolsDropdown = document.getElementById('toolsDropdown');
            if (toolsDropdown) toolsDropdown.classList.add('hidden');
        });
    }

    // Tool items
    const toolUnitConverter = document.getElementById('toolUnitConverter');
    if (toolUnitConverter) {
        toolUnitConverter.addEventListener('click', () => {
            alert('Unit Converter coming soon!');
            const toolsDropdown = document.getElementById('toolsDropdown');
            if (toolsDropdown) toolsDropdown.classList.add('hidden');
        });
    }

    const toolCurrencyConverter = document.getElementById('toolCurrencyConverter');
    if (toolCurrencyConverter) {
        toolCurrencyConverter.addEventListener('click', () => {
            alert('Currency Converter coming soon!');
            const toolsDropdown = document.getElementById('toolsDropdown');
            if (toolsDropdown) toolsDropdown.classList.add('hidden');
        });
    }

    const toolTimezoneConverter = document.getElementById('toolTimezoneConverter');
    if (toolTimezoneConverter) {
        toolTimezoneConverter.addEventListener('click', () => {
            alert('Timezone Converter coming soon!');
            const toolsDropdown = document.getElementById('toolsDropdown');
            if (toolsDropdown) toolsDropdown.classList.add('hidden');
        });
    }

    // Cart Modal Close
    const cartModalClose = document.getElementById('cartModalClose');
    if (cartModalClose) {
        cartModalClose.addEventListener('click', () => {
            const cartModal = document.getElementById('cartModal');
            const drawerBackdrop = document.getElementById('drawerBackdrop');
            
            if (cartModal) cartModal.classList.remove('active');
            if (drawerBackdrop) drawerBackdrop.classList.remove('visible');
        });
    }

    // Settings button
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            window.location.href = 'user-settings.html';
        });
    }

    // Content Settings button
    const contentSettingsBtn = document.getElementById('contentSettingsBtn');
    if (contentSettingsBtn) {
        contentSettingsBtn.addEventListener('click', () => {
            window.location.href = 'content-settings.html';
        });
    }

    // Sign out button
    const signOutBtn = document.getElementById('signOutBtn');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            localStorage.removeItem('currentUser');
            localStorage.removeItem('amcUser');
            sessionStorage.clear();
            window.location.href = 'landing-page-twitter-style.html';
        });
    }
}

window.AMCShell = {
  init(options={}) {
    console.log('🚀 Initializing AMC Shell v6.5...');
    
    // Initialize avatar system first
    initializeAvatar();
    
    // Shell init order matters
    checkLoginStatus?.();
    initializeMobileSidebar?.();
    renderIconRail?.();
    initIconRailControls?.();

    initDrawerControls();
    initThemeToggle();
    initCart();
    initToolsDropdown();
    initFilterPanel();
    
    // Initialize event handlers for header icons
    initHeaderEventHandlers();
    
    console.log('✅ AMC Shell v6.5 initialized successfully');
  }
};