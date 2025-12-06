/**
 * AMC MODULAR HEADER COMPONENT
 * Exact match to existing amc-header.js functionality
 * Provides <amc-header></amc-header> custom element
 * NO MAIN CONTENT INTERFERENCE - HEADER ONLY
 */

// Define the AMC Header custom element
class AMCHeader extends HTMLElement {
    constructor() {
        super();
        this.isInitialized = false;
    }

    connectedCallback() {
        if (!this.isInitialized) {
            this.render();
            this.setupEventListeners();
            this.isInitialized = true;
        }
    }

    render() {
        // Get user info from localStorage (matching existing pages)
        let user = null;
        try {
            const userString = localStorage.getItem('user') || localStorage.getItem('currentUser');
            if (userString) {
                user = JSON.parse(userString);
            }
        } catch (e) {
            console.warn('Could not parse user from localStorage:', e);
        }

        // Fallback user for display
        if (!user) {
            user = { email: 'User', role: 'media_user' };
        }

        // Get role from AMC.role or fallback
        const role = (window.AMC && window.AMC.role) || user.role || 'media_user';

        this.innerHTML = `
            <header class="app-header">
                <!-- Logo Section -->
                <div class="logo">
                    <h1>AutoMediaCenter</h1>
                </div>

                <!-- Global Search -->
                <div class="global-search">
                    <div class="search-container">
                        <i class="fas fa-search search-icon"></i>
                        <input type="text" class="search-input" placeholder="Search releases, alerts, companies..." />
                        <div class="search-scope">
                            <select class="scope-selector">
                                <option value="all">All</option>
                                <option value="releases">Releases</option>
                                <option value="alerts">Alerts</option>
                                <option value="companies">Companies</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Header Right Section -->
                <div class="amc-header-right">
                    <!-- Cart Indicator -->
                    <button class="cart-indicator" data-tooltip="Media Cart" aria-label="Media Cart">
                        <i class="fas fa-briefcase"></i>
                        <span class="cart-badge">0</span>
                    </button>

                    <!-- Notification Indicator -->
                    <button class="notification-indicator" data-tooltip="Notifications" aria-label="Notifications">
                        <i class="fas fa-bell"></i>
                        <span class="notification-badge">0</span>
                    </button>

                    <!-- Tools Toggle -->
                    <button class="tools-toggle-btn" data-tooltip="Tools" aria-label="Tools">
                        <i class="fas fa-wrench"></i>
                    </button>

                    <!-- Three-dot Menu -->
                    <button class="amc-menu-dots" aria-label="More options">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>

                    <!-- Avatar Container -->
                    <div class="amc-avatar-container" data-tooltip="${user.email}">
                        <div class="amc-avatar-ring" style="border-color: ${this.getRoleColor(role)};">
                            <i class="fas fa-user" style="color: ${this.getRoleColor(role)};"></i>
                        </div>
                    </div>
                </div>
            </header>
        `;
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = this.querySelector('.search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });

            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.handleSearch(e.target.value);
                }
            });
        }

        // Cart indicator
        const cartIndicator = this.querySelector('.cart-indicator');
        if (cartIndicator) {
            cartIndicator.addEventListener('click', () => {
                this.handleCartClick();
            });
        }

        // Notification indicator
        const notificationIndicator = this.querySelector('.notification-indicator');
        if (notificationIndicator) {
            notificationIndicator.addEventListener('click', () => {
                this.handleNotificationClick();
            });
        }

        // Tools toggle
        const toolsToggle = this.querySelector('.tools-toggle-btn');
        if (toolsToggle) {
            toolsToggle.addEventListener('click', () => {
                this.handleToolsClick();
            });
        }

        // Three-dot menu
        const menuDots = this.querySelector('.amc-menu-dots');
        if (menuDots) {
            menuDots.addEventListener('click', () => {
                this.handleMenuClick();
            });
        }

        // Avatar click
        const avatarContainer = this.querySelector('.amc-avatar-container');
        if (avatarContainer) {
            avatarContainer.addEventListener('click', () => {
                this.handleAvatarClick();
            });
        }

        // Theme detection and updates
        this.updateTheme();
        
        // Listen for theme changes
        const observer = new MutationObserver(() => {
            this.updateTheme();
        });
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    handleSearch(query) {
        console.log('Search query:', query);
        // Emit custom event for search
        this.dispatchEvent(new CustomEvent('amc-search', {
            detail: { query },
            bubbles: true
        }));
    }

    handleCartClick() {
        console.log('Cart clicked');
        // Emit custom event for cart
        this.dispatchEvent(new CustomEvent('amc-cart-click', {
            bubbles: true
        }));
    }

    handleNotificationClick() {
        console.log('Notifications clicked');
        // Emit custom event for notifications
        this.dispatchEvent(new CustomEvent('amc-notifications-click', {
            bubbles: true
        }));
    }

    handleToolsClick() {
        console.log('Tools clicked');
        // Emit custom event for tools
        this.dispatchEvent(new CustomEvent('amc-tools-click', {
            bubbles: true
        }));
    }

    handleMenuClick() {
        console.log('Menu clicked');
        // Emit custom event for menu
        this.dispatchEvent(new CustomEvent('amc-menu-click', {
            bubbles: true
        }));
    }

    handleAvatarClick() {
        console.log('Avatar clicked');
        // Emit custom event for avatar
        this.dispatchEvent(new CustomEvent('amc-avatar-click', {
            bubbles: true
        }));
    }

    getRoleColor(role) {
        const roleColors = {
            'platform_admin': '#dc2626', // Red
            'client_admin': '#2563eb',   // Blue
            'client_user': '#059669',    // Green
            'media_user': '#7c3aed'      // Purple
        };
        return roleColors[role] || '#6b7280'; // Default gray
    }

    updateTheme() {
        // Update theme-specific elements if needed
        const isDarkMode = document.body.classList.contains('dark-mode');
        // Theme updates are handled by CSS, but we can add JS-specific updates here
    }

    // Public methods for external control
    updateCartCount(count) {
        const badge = this.querySelector('.cart-badge');
        const indicator = this.querySelector('.cart-indicator');
        if (badge && indicator) {
            badge.textContent = count;
            if (count > 0) {
                indicator.classList.add('has-items');
            } else {
                indicator.classList.remove('has-items');
            }
        }
    }

    updateNotificationCount(count) {
        const badge = this.querySelector('.notification-badge');
        const indicator = this.querySelector('.notification-indicator');
        if (badge && indicator) {
            badge.textContent = count;
            if (count > 0) {
                indicator.classList.add('has-new');
            } else {
                indicator.classList.remove('has-new');
            }
        }
    }

    updateUser(user) {
        const avatarContainer = this.querySelector('.amc-avatar-container');
        const avatarRing = this.querySelector('.amc-avatar-ring');
        const avatarIcon = avatarRing?.querySelector('i');
        
        if (avatarContainer && avatarRing && avatarIcon) {
            const role = user.role || 'media_user';
            const roleColor = this.getRoleColor(role);
            
            avatarContainer.setAttribute('data-tooltip', user.email || 'User');
            avatarRing.style.borderColor = roleColor;
            avatarIcon.style.color = roleColor;
        }
    }
}

// Register the custom element
if (!customElements.get('amc-header')) {
    customElements.define('amc-header', AMCHeader);
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AMCHeader;
}

// Global availability
window.AMCHeader = AMCHeader;

console.log('AMC Modular Header component loaded');