/**
 * AutoMediaCenter Legendary Header Component
 * Web Component with all legendary improvements extracted from test_globalshell.html:
 * - Uniform 40px icons with 4px spacing (ISSUE #1 FIX)
 * - Glass morphism search bar with focus expansion (ISSUE #2 FIX)  
 * - Smart badge animation system with spring physics (ISSUE #3 FIX)
 * - Premium tooltips and color-coded icons
 * - Tools dropdown with converters
 */

class LegendaryHeader extends HTMLElement {
    constructor() {
        super();
        this.cartCount = 0;
        this.notificationCount = 0;
        this.isToolsOpen = false;
    }

    connectedCallback() {
        this.render();
        this.initializeHeader();
        this.setupEventListeners();
        this.restoreState();
        
        // Dispatch ready event
        window.dispatchEvent(new CustomEvent('legendaryHeaderReady'));
        console.log('🚀 Legendary Header Component Loaded');
    }

    render() {
        // Apply the header class directly to the web component
        this.className = 'app-header';
        
        this.innerHTML = `
            <div class="logo">
                <h1>AutoMediaCenter</h1>
            </div>
                
                <!-- LEGENDARY: Glass Morphism Search Bar - ISSUE #2 FIX -->
                <div class="global-search">
                    <div class="search-container">
                        <i class="fas fa-search search-icon"></i>
                        <input type="text" placeholder="Search across all modules..." class="search-input" id="globalSearchInput">
                        <div class="search-scope">
                            <select class="scope-selector" id="searchScope">
                                <option value="all">All</option>
                                <option value="assets">Assets</option>
                                <option value="users">Users</option>
                                <option value="reports">Reports</option>
                                <option value="radar">Radar</option>
                                <option value="vault">Vault</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <div class="user-actions-group">
                    <div class="amc-header-right">
                        <!-- LEGENDARY: Notification Bell with Smart Badge - ISSUE #3 FIX -->
                        <div class="notification-indicator" id="notification-indicator" data-tooltip="Notifications">
                            <i class="fas fa-bell"></i>
                            <span class="notification-badge">0</span>
                        </div>
                        
                        <!-- LEGENDARY: Cart Briefcase with Smart Badge - ISSUE #3 FIX -->
                        <div class="cart-indicator" id="cart-indicator" data-tooltip="View Cart">
                            <i class="fas fa-briefcase"></i>
                            <span class="cart-badge">0</span>
                        </div>
                        
                        <!-- LEGENDARY: Tools Dropdown with Blue Glow - ISSUE #1 FIX -->
                        <div class="tools-dropdown-container">
                            <button class="tools-toggle-btn" id="toolsToggle" data-tooltip="Tools">
                                <i class="fas fa-wrench"></i>
                            </button>
                            
                            <!-- Tools Dropdown Menu -->
                            <div class="tools-dropdown-menu" id="toolsDropdownMenu">
                                <div class="tools-dropdown-header">
                                    <i class="fas fa-tools"></i>
                                    <span>Quick Tools</span>
                                </div>
                                <div class="tools-dropdown-list">
                                    <a href="#" class="tool-item" data-tool="unit-converter">
                                        <i class="fas fa-ruler-combined"></i>
                                        <div class="tool-info">
                                            <span class="tool-name">Unit Converter</span>
                                            <span class="tool-desc">Length, weight, volume</span>
                                        </div>
                                    </a>
                                    <a href="#" class="tool-item" data-tool="currency-converter">
                                        <i class="fas fa-dollar-sign"></i>
                                        <div class="tool-info">
                                            <span class="tool-name">Currency Converter</span>
                                            <span class="tool-desc">Real-time exchange rates</span>
                                        </div>
                                    </a>
                                    <a href="#" class="tool-item" data-tool="timezone-converter">
                                        <i class="fas fa-globe"></i>
                                        <div class="tool-info">
                                            <span class="tool-name">Time Zone Converter</span>
                                            <span class="tool-desc">World clock converter</span>
                                        </div>
                                    </a>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Avatar will be auto-injected by amc-avatar-system.js -->
                    </div>
                    
                    <!-- LEGENDARY: Green Three-dot Menu - ISSUE #1 FIX -->
                    <button class="amc-menu-dots" data-tooltip="More options">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                </div>
        `;
    }

    initializeHeader() {
        // Initialize legendary tooltip system
        this.initTooltipSystem();
        
        // Initialize cart system
        this.initCart();
        
        // Initialize notifications
        this.initNotifications();
        
        // Initialize tools dropdown
        this.initToolsDropdown();
        
        // Initialize global search
        this.initGlobalSearch();
        
        // Force badge states for demo (LEGENDARY FEATURE)
        setTimeout(() => {
            this.setCartCount(1); // Show yellow briefcase with spring animation
            this.setNotificationCount(3); // Show red bell with spring animation
            console.log('✅ LEGENDARY: Badge animations activated');
        }, 500);
    }

    initTooltipSystem() {
        const headerIcons = [
            { selector: '#notification-indicator' },
            { selector: '#cart-indicator' },
            { selector: '#toolsToggle' },
            { selector: '.amc-menu-dots' }
        ];
        
        headerIcons.forEach(({ selector }) => {
            const element = this.querySelector(selector);
            if (element) {
                // Convert title to data-tooltip for custom styling
                const title = element.getAttribute('title');
                if (title) {
                    element.setAttribute('data-tooltip', title);
                    element.removeAttribute('title');
                }
            }
        });
        
        console.log('✅ LEGENDARY: Tooltip system initialized');
    }

    initCart() {
        const cartIndicator = this.querySelector('#cart-indicator');
        
        // Global cart functions
        window.amcSetCartCount = (count) => {
            this.setCartCount(count);
        };

        window.amcGetCartCount = () => {
            return this.cartCount;
        };

        // Cart click handler
        if (cartIndicator) {
            cartIndicator.addEventListener('click', () => {
                window.dispatchEvent(new CustomEvent('cartClick'));
                console.log('🛒 Cart clicked');
            });
        }
    }

    initNotifications() {
        const notificationIndicator = this.querySelector('#notification-indicator');
        
        window.amcSetNotifCount = (count) => {
            this.setNotificationCount(count);
        };
        
        // Notification click handler
        if (notificationIndicator) {
            notificationIndicator.addEventListener('click', () => {
                window.dispatchEvent(new CustomEvent('notificationClick'));
                console.log('🔔 Notifications clicked');
            });
        }
    }

    initToolsDropdown() {
        const toolsToggle = this.querySelector('#toolsToggle');
        const toolsDropdownMenu = this.querySelector('#toolsDropdownMenu');
        
        if (toolsToggle && toolsDropdownMenu) {
            // Toggle dropdown
            toolsToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                this.isToolsOpen = !this.isToolsOpen;
                toolsDropdownMenu.classList.toggle('show', this.isToolsOpen);
                toolsToggle.classList.toggle('active', this.isToolsOpen);
                console.log(`🛠️ Tools dropdown ${this.isToolsOpen ? 'opened' : 'closed'}`);
            });
            
            // Close when clicking outside
            document.addEventListener('click', (e) => {
                if (!toolsToggle.contains(e.target) && !toolsDropdownMenu.contains(e.target)) {
                    this.closeToolsDropdown();
                }
            });
            
            // Close on Escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isToolsOpen) {
                    this.closeToolsDropdown();
                    toolsToggle.focus();
                }
            });
            
            // Handle tool selection
            const toolItems = this.querySelectorAll('.tool-item');
            toolItems.forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    const toolType = item.dataset.tool;
                    this.openToolModal(toolType);
                    this.closeToolsDropdown();
                });
            });
        }
    }

    initGlobalSearch() {
        const searchInput = this.querySelector('#globalSearchInput');
        const searchScope = this.querySelector('#searchScope');
        
        // LEGENDARY: Keyboard shortcut (Cmd/Ctrl + K) - VERCEL STANDARD
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                searchInput?.focus();
                searchInput?.select();
                console.log('🔍 LEGENDARY: Search focused via ⌘K');
            }
            
            // Escape to clear search
            if (e.key === 'Escape' && document.activeElement === searchInput) {
                searchInput.blur();
                searchInput.value = '';
            }
        });
        
        // Search functionality with debouncing
        let searchTimeout;
        searchInput?.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            const scope = searchScope?.value || 'all';
            
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                if (query.length >= 2) {
                    this.performGlobalSearch(query, scope);
                } else if (query.length === 0) {
                    this.clearSearchResults();
                }
            }, 300);
        });
        
        // Scope change handler
        searchScope?.addEventListener('change', (e) => {
            const query = searchInput?.value.toLowerCase().trim();
            if (query && query.length >= 2) {
                this.performGlobalSearch(query, e.target.value);
            }
        });
        
        console.log('✅ LEGENDARY: Global search initialized with ⌘K shortcut');
    }

    setupEventListeners() {
        // Menu dots click handler
        const menuBtn = this.querySelector('.amc-menu-dots');
        if (menuBtn) {
            menuBtn.addEventListener('click', () => {
                window.dispatchEvent(new CustomEvent('headerMenuClick'));
                console.log('⋮ Menu dots clicked');
            });
        }
    }

    restoreState() {
        // Restore cart and notification counts from localStorage
        const savedCartCount = localStorage.getItem('amc.cart.count') || '0';
        const savedNotifCount = localStorage.getItem('amc.notifications') || '0';
        
        this.setCartCount(parseInt(savedCartCount));
        this.setNotificationCount(parseInt(savedNotifCount));
    }

    // LEGENDARY: Public methods with spring physics animations
    setCartCount(count) {
        this.cartCount = Number(count) || 0;
        const cartIndicator = this.querySelector('#cart-indicator');
        const cartBadge = cartIndicator?.querySelector('.cart-badge');
        
        if (cartBadge) {
            cartBadge.textContent = String(Math.min(this.cartCount, 99));
        }
        
        if (cartIndicator) {
            // LEGENDARY: Spring physics animation trigger
            cartIndicator.classList.toggle('has-items', this.cartCount > 0);
            cartIndicator.setAttribute('data-tooltip', `View Cart (${this.cartCount} item${this.cartCount !== 1 ? 's' : ''})`);
        }
        
        // Update localStorage
        localStorage.setItem('amc.cart.count', String(this.cartCount));
        
        // Dispatch event
        window.dispatchEvent(new CustomEvent('cartUpdate', {
            detail: { count: this.cartCount }
        }));
    }

    setNotificationCount(count) {
        this.notificationCount = Number(count) || 0;
        const notificationIndicator = this.querySelector('#notification-indicator');
        const notificationBadge = notificationIndicator?.querySelector('.notification-badge');
        
        if (notificationBadge) {
            notificationBadge.textContent = String(Math.min(this.notificationCount, 99));
        }
        
        if (notificationIndicator) {
            // LEGENDARY: Spring physics animation trigger
            notificationIndicator.classList.toggle('has-new', this.notificationCount > 0);
        }
        
        // Update localStorage
        localStorage.setItem('amc.notifications', String(this.notificationCount));
        
        // Dispatch event
        window.dispatchEvent(new CustomEvent('notificationUpdate', {
            detail: { count: this.notificationCount }
        }));
    }

    closeToolsDropdown() {
        const toolsDropdownMenu = this.querySelector('#toolsDropdownMenu');
        const toolsToggle = this.querySelector('#toolsToggle');
        
        this.isToolsOpen = false;
        toolsDropdownMenu?.classList.remove('show');
        toolsToggle?.classList.remove('active');
    }

    openToolModal(toolType) {
        console.log(`🛠️ Opening tool: ${toolType}`);
        
        // Dispatch event for external handling
        window.dispatchEvent(new CustomEvent('toolOpen', {
            detail: { toolType }
        }));
        
        // TODO: Replace with actual modal/page navigation
        switch(toolType) {
            case 'unit-converter':
                alert('Unit Converter - Coming soon!\\n\\nThis will open a modal with length, weight, volume, temperature, and other unit conversions.');
                break;
            case 'currency-converter':
                alert('Currency Converter - Coming soon!\\n\\nThis will show real-time exchange rates and currency conversion.');
                break;
            case 'timezone-converter':
                alert('Time Zone Converter - Coming soon!\\n\\nThis will display a world clock with time zone conversions.');
                break;
            default:
                console.error('Unknown tool type:', toolType);
        }
    }

    performGlobalSearch(query, scope) {
        console.log(`🔍 LEGENDARY Global Search: "${query}" in scope: "${scope}"`);
        
        // LEGENDARY: Visual feedback with glass morphism
        const searchContainer = this.querySelector('.search-container');
        searchContainer?.classList.add('searching');
        
        // Simulate search delay
        setTimeout(() => {
            searchContainer?.classList.remove('searching');
            this.displayMockSearchResults(query, scope);
        }, 500);
        
        // Dispatch search event
        window.dispatchEvent(new CustomEvent('globalSearch', {
            detail: { query, scope }
        }));
    }

    displayMockSearchResults(query, scope) {
        console.log(`📊 LEGENDARY Mock Results for "${query}" in ${scope}:`);
        
        const mockResults = {
            assets: [`Asset containing "${query}"`, `Media file: ${query}.jpg`],
            users: [`User: ${query}@company.com`, `${query} Smith`],
            reports: [`${query} Analytics Report`, `Monthly ${query} Summary`],
            radar: [`${query} Vehicle Launch`, `${query} Brand Update`],
            vault: [`${query} Press Release`, `${query} Documentation`],
            all: [`Global result for "${query}"`, `Cross-module: ${query}`]
        };
        
        const results = mockResults[scope] || mockResults.all;
        results.forEach((result, index) => {
            console.log(`  ${index + 1}. ${result}`);
        });
    }

    clearSearchResults() {
        console.log('🧹 LEGENDARY: Search results cleared');
        // TODO: Hide search results dropdown when implemented
    }
}

// Register the custom element
customElements.define('legendary-header', LegendaryHeader);

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LegendaryHeader;
}

console.log('🚀 LEGENDARY HEADER COMPONENT: Ready for registration');