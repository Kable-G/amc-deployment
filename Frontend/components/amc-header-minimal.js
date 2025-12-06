
/**
 * AMC Header Component - Complete Enterprise Header System
 * Extracted from amc-header.js with ALL functionality included
 * Modular design - no main content interference
 */

// EXACT HTML from amc-header.js with complete functionality
const HEADER_HTML = `
    <header class="app-header">
        <div class="logo">
            <h1>AutoMediaCenter</h1>
        </div>
        
        <!-- Global Search Component -->
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
                <div class="notification-indicator" id="notification-indicator" data-tooltip="Notifications">
                    <i class="fas fa-bell"></i>
                    <span class="notification-badge">0</span>
                </div>
                <div class="cart-indicator" id="cart-indicator" data-tooltip="View Cart (0 items)">
                    <i class="fas fa-briefcase"></i>
                    <span class="cart-badge">0</span>
                </div>
                
                <!-- Tools Dropdown -->
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
                <div class="amc-avatar-container" id="avatarContainer" data-tooltip="User Profile">
                    <!-- Avatar system will inject content here -->
                </div>
            </div>
            
            <!-- Three-dot menu positioned after avatar (rightmost) -->
            <button class="amc-menu-dots" data-tooltip="More options">
                <i class="fas fa-ellipsis-v"></i>
            </button>
        </div>
    </header>
`;

/**
 * AMC Header Class - Complete Enterprise Implementation
 */
class AMCHeader {
    constructor(options = {}) {
        this.container = options.container || 'amc-header';
        this.searchEnabled = options.searchEnabled !== false;
        this.toolsEnabled = options.toolsEnabled !== false;
        this.badgesEnabled = options.badgesEnabled !== false;
        
        // State management
        this.converterModal = null;
        this.converterTab = null;
        this.converterModalState = 'closed';
        
        this.init();
    }

    /**
     * Initialize header component
     */
    init() {
        this.render();
        this.initializeTooltipSystem();
        this.initializeToolsDropdown();
        this.initializeGlobalSearch();
        this.initializeBadgeSystem();
        this.bindEvents();
        
        // Dispatch ready event
        window.dispatchEvent(new CustomEvent('amcHeaderReady', {
            detail: { instance: this }
        }));
        
        console.log('✅ AMC Header initialized with full functionality');
    }

    /**
     * Render header HTML
     */
    render() {
        const placeholder = document.querySelector(this.container);
        if (placeholder) {
            placeholder.outerHTML = HEADER_HTML;
            console.log('✅ Header HTML injected');
        } else {
            console.error(`❌ Header container ${this.container} not found`);
        }
    }

    /**
     * Initialize unified tooltip system - EXACT from amc-header.js
     */
    initializeTooltipSystem() {
        console.log('🔧 Initializing unified tooltip system...');
        
        const headerIcons = [
            { selector: '#notification-indicator', varName: '--notif-tooltip-left' },
            { selector: '#cart-indicator', varName: '--cart-tooltip-left' },
            { selector: '#toolsToggle', varName: '--tools-tooltip-left' },
            { selector: '.amc-menu-dots', varName: '--menu-tooltip-left' },
            { selector: '.amc-avatar-container', varName: '--avatar-tooltip-left' }
        ];
        
        let foundElements = 0;
        
        headerIcons.forEach(({ selector, varName }) => {
            const element = document.querySelector(selector);
            if (element) {
                foundElements++;
                
                // Calculate and store tooltip position
                setTimeout(() => {
                    const rect = element.getBoundingClientRect();
                    const centerX = rect.left + (rect.width / 2);
                    document.documentElement.style.setProperty(varName, `${centerX}px`);
                    console.log(`📍 Positioned tooltip for ${selector} at ${centerX}px`);
                }, 100);
            } else {
                console.warn(`⚠️ Element not found: ${selector}`);
            }
        });
        
        // Recalculate on window resize
        window.addEventListener('resize', () => {
            headerIcons.forEach(({ selector, varName }) => {
                const element = document.querySelector(selector);
                if (element) {
                    const rect = element.getBoundingClientRect();
                    const centerX = rect.left + (rect.width / 2);
                    document.documentElement.style.setProperty(varName, `${centerX}px`);
                }
            });
        });
        
        console.log(`✅ UNIFIED TOOLTIP SYSTEM: Processed ${foundElements} header elements`);
        return foundElements > 0;
    }

    /**
     * Initialize tools dropdown - EXACT from amc-header.js
     */
    initializeToolsDropdown() {
        if (!this.toolsEnabled) return;
        
        const toolsToggle = document.getElementById('toolsToggle');
        const toolsDropdownMenu = document.getElementById('toolsDropdownMenu');
        
        if (!toolsToggle || !toolsDropdownMenu) return;
        
        // Toggle dropdown
        toolsToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = toolsDropdownMenu.classList.contains('show');
            
            if (isOpen) {
                this.closeToolsDropdown();
            } else {
                this.openToolsDropdown();
            }
        });
        
        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!toolsToggle.contains(e.target) && !toolsDropdownMenu.contains(e.target)) {
                this.closeToolsDropdown();
            }
        });
        
        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && toolsDropdownMenu.classList.contains('show')) {
                this.closeToolsDropdown();
                toolsToggle.focus();
            }
        });
        
        // Handle tool selection
        const toolItems = document.querySelectorAll('.tool-item');
        toolItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const toolType = item.dataset.tool;
                this.openToolModal(toolType);
                this.closeToolsDropdown();
            });
        });
        
        console.log('✅ Tools dropdown initialized');
    }

    /**
     * Open tools dropdown
     */
    openToolsDropdown() {
        const toolsDropdownMenu = document.getElementById('toolsDropdownMenu');
        const toolsToggle = document.getElementById('toolsToggle');
        
        if (toolsDropdownMenu && toolsToggle) {
            toolsDropdownMenu.classList.add('show');
            toolsToggle.classList.add('active');
        }
    }

    /**
     * Close tools dropdown
     */
    closeToolsDropdown() {
        const toolsDropdownMenu = document.getElementById('toolsDropdownMenu');
        const toolsToggle = document.getElementById('toolsToggle');
        
        if (toolsDropdownMenu && toolsToggle) {
            toolsDropdownMenu.classList.remove('show');
            toolsToggle.classList.remove('active');
        }
    }

    /**
     * Open tool modal - EXACT from amc-header.js
     */
    openToolModal(toolType) {
        console.log(`🛠️ Opening tool: ${toolType}`);
        
        switch(toolType) {
            case 'unit-converter':
                this.openUnitConverterModal();
                break;
            case 'currency-converter':
                alert('Currency Converter - Coming soon!\n\nThis will show real-time exchange rates and currency conversion.');
                break;
            case 'timezone-converter':
                alert('Time Zone Converter - Coming soon!\n\nThis will display a world clock with time zone conversions.');
                break;
            default:
                console.error('Unknown tool type:', toolType);
        }
    }

    /**
     * Open unit converter modal - EXACT from amc-header.js
     */
    openUnitConverterModal() {
        if (this.converterModal && document.body.contains(this.converterModal)) {
            if (this.converterModalState === 'minimized') {
                this.restoreConverterModal();
            }
            return;
        }
        
        if (!document.getElementById('uc-modal-styles')) {
            this.injectModalStyles();
        }
        
        const savedSize = localStorage.getItem('uc-preferred-size') || 'mid';
        
        const overlay = document.createElement('div');
        overlay.id = 'uc-modal-overlay';
        overlay.className = 'uc-overlay';
        overlay.onclick = () => this.minimizeConverterModal();
        
        this.converterModal = document.createElement('div');
        this.converterModal.id = 'uc-modal';
        this.converterModal.className = `uc-modal uc-modal-${savedSize}`;
        
        const header = document.createElement('div');
        header.className = 'uc-modal-header';
        header.innerHTML = `
            <div class="uc-header-left">
                <i class="fas fa-calculator"></i>
                <span class="uc-title">Unit Converter</span>
            </div>
            <div class="uc-header-controls">
                <button class="uc-control-btn" onclick="window.amcHeader.minimizeConverterModal()" title="Minimize">
                    <i class="fas fa-minus"></i>
                </button>
                <button class="uc-control-btn uc-expand-btn" onclick="window.amcHeader.toggleExpandConverter()" title="${savedSize === 'expanded' ? 'Restore' : 'Expand'}">
                    <i class="fas fa-${savedSize === 'expanded' ? 'compress' : 'expand'}"></i>
                </button>
                <button class="uc-control-btn uc-close-btn" onclick="window.amcHeader.closeConverterModal()" title="Close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        const body = document.createElement('div');
        body.className = 'uc-modal-body';
        const iframe = document.createElement('iframe');
        iframe.src = 'unit-converter-content.html';
        iframe.className = 'uc-iframe';
        iframe.style.opacity = '0';
        iframe.style.transition = 'opacity 0.2s ease';
        
        iframe.addEventListener('load', () => {
            this.applyIframeStyles(iframe);
            setTimeout(() => {
                iframe.style.opacity = '1';
            }, 50);
        });
        
        body.appendChild(iframe);
        this.converterModal.appendChild(header);
        this.converterModal.appendChild(body);
        
        // Create minimized tab
        this.converterTab = document.createElement('div');
        this.converterTab.id = 'uc-tab';
        this.converterTab.className = 'uc-tab uc-tab-hidden';
        this.converterTab.innerHTML = `
            <div class="uc-tab-left">
                <i class="fas fa-calculator"></i>
                <span>Unit Converter</span>
            </div>
            <div class="uc-tab-right">
                <button class="uc-tab-btn uc-tab-restore" data-tooltip="Restore">
                    <i class="fas fa-window-maximize"></i>
                </button>
                <button class="uc-tab-btn uc-tab-close" data-tooltip="Close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        this.converterTab.onclick = (e) => {
            if (e.target.closest('.uc-tab-restore')) {
                this.restoreConverterModal();
            } else if (e.target.closest('.uc-tab-close')) {
                this.closeConverterModal();
            } else if (e.target.closest('.uc-tab-left')) {
                this.restoreConverterModal();
            }
        };
        
        document.body.appendChild(overlay);
        document.body.appendChild(this.converterModal);
        document.body.appendChild(this.converterTab);
        
        this.converterModalState = savedSize;
        setTimeout(() => this.converterModal.classList.add('uc-modal-show'), 10);
        document.addEventListener('keydown', this.handleConverterEscape.bind(this));
    }

    /**
     * Apply iframe styles - EXACT from amc-header.js
     */
    applyIframeStyles(iframe) {
        try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            const parentIsDark = document.body.classList.contains('dark-mode');
            
            const oldStyle = iframeDoc.getElementById('modal-injected-styles');
            if (oldStyle) oldStyle.remove();
            
            const style = iframeDoc.createElement('style');
            style.id = 'modal-injected-styles';
            style.textContent = `
                .app-header, #sidebar, .amc-sidebar, .app-footer {
                    display: none !important;
                }
                
                .main-content, .amc-content {
                    margin: 0 !important;
                    width: 100% !important;
                    padding: 20px !important;
                    max-width: none !important;
                    min-height: auto !important;
                }
                
                #hub-view .content-header h1,
                #converter-detail-view .content-header h1,
                #dark-mode-toggle,
                .theme-toggle-btn {
                    display: none !important;
                }
                
                #hub-view .converter-grid {
                    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)) !important;
                    gap: 12px !important;
                }
                
                body {
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow-y: auto !important;
                    overflow-x: hidden !important;
                }
                
                ${parentIsDark ? `
                    body {
                        background: #121212 !important;
                        color: #e0e0e0 !important;
                    }
                    body:not(.dark-mode) {
                        --bg-primary: #121212 !important;
                        --bg-secondary: #1a1c1e !important;
                        --bg-tertiary: #2a2d30 !important;
                        --text-primary: #e0e0e0 !important;
                        --text-secondary: #adb5bd !important;
                        --text-headings: #f8f9fa !important;
                        --border-primary: #3a3a3a !important;
                        --border-secondary: #444 !important;
                    }
                ` : `
                    body {
                        background: #f8f9fa !important;
                        color: #212529 !important;
                    }
                `}
            `;
            iframeDoc.head.appendChild(style);
            console.log('✅ Iframe styled:', parentIsDark ? 'dark' : 'light');
        } catch (e) {
            console.warn('⚠️ Could not style iframe:', e);
        }
    }

    /**
     * Minimize converter modal
     */
    minimizeConverterModal() {
        if (!this.converterModal) return;
        
        this.converterModalState = 'minimized';
        
        this.converterModal.classList.remove('uc-modal-show');
        const overlay = document.getElementById('uc-modal-overlay');
        if (overlay) overlay.style.display = 'none';
        
        // Recreate tab for reliability
        const oldTab = document.getElementById('uc-tab');
        if (oldTab) oldTab.remove();
        
        this.converterTab = document.createElement('div');
        this.converterTab.id = 'uc-tab';
        this.converterTab.className = 'uc-tab';
        this.converterTab.innerHTML = `
            <div class="uc-tab-left">
                <i class="fas fa-calculator"></i>
                <span>Unit Converter</span>
            </div>
            <div class="uc-tab-right">
                <button class="uc-tab-btn uc-tab-restore" data-tooltip="Restore">
                    <i class="fas fa-window-maximize"></i>
                </button>
                <button class="uc-tab-btn uc-tab-close" data-tooltip="Close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        this.converterTab.onclick = (e) => {
            if (e.target.closest('.uc-tab-restore')) {
                this.restoreConverterModal();
            } else if (e.target.closest('.uc-tab-close')) {
                this.closeConverterModal();
            } else if (e.target.closest('.uc-tab-left')) {
                this.restoreConverterModal();
            }
        };
        
        document.body.appendChild(this.converterTab);
        setTimeout(() => {
            this.converterTab.classList.add('uc-tab-show');
        }, 10);
    }

    /**
     * Restore converter modal
     */
    restoreConverterModal() {
        if (!this.converterModal) return;
        
        const lastSize = localStorage.getItem('uc-preferred-size') || 'mid';
        this.converterModalState = lastSize;
        
        if (this.converterTab) {
            this.converterTab.classList.remove('uc-tab-show');
            setTimeout(() => {
                this.converterTab.classList.add('uc-tab-hidden');
            }, 300);
        }
        
        const overlay = document.getElementById('uc-modal-overlay');
        if (overlay) overlay.style.display = 'block';
        
        const iframe = this.converterModal.querySelector('.uc-iframe');
        if (iframe && iframe.contentDocument) {
            this.applyIframeStyles(iframe);
        }
        
        this.converterModal.className = `uc-modal uc-modal-${lastSize} uc-modal-show`;
    }

    /**
     * Toggle expand converter
     */
    toggleExpandConverter() {
        if (!this.converterModal) return;
        
        const btn = this.converterModal.querySelector('.uc-expand-btn');
        const icon = btn.querySelector('i');
        
        if (this.converterModalState === 'mid') {
            this.converterModalState = 'expanded';
            this.converterModal.classList.remove('uc-modal-mid');
            this.converterModal.classList.add('uc-modal-expanded');
            icon.className = 'fas fa-compress';
            btn.title = 'Restore';
            localStorage.setItem('uc-preferred-size', 'expanded');
        } else {
            this.converterModalState = 'mid';
            this.converterModal.classList.remove('uc-modal-expanded');
            this.converterModal.classList.add('uc-modal-mid');
            icon.className = 'fas fa-expand';
            btn.title = 'Expand';
            localStorage.setItem('uc-preferred-size', 'mid');
        }
    }

    /**
     * Close converter modal
     */
    closeConverterModal() {
        if (!this.converterModal) return;
        
        this.converterModalState = 'closed';
        document.removeEventListener('keydown', this.handleConverterEscape);
        this.converterModal.classList.remove('uc-modal-show');
        if (this.converterTab) this.converterTab.classList.remove('uc-tab-show');
        
        setTimeout(() => {
            document.getElementById('uc-modal-overlay')?.remove();
            this.converterModal?.remove();
            this.converterTab?.remove();
            this.converterModal = null;
            this.converterTab = null;
        }, 300);
    }

    /**
     * Handle escape key for converter
     */
    handleConverterEscape(e) {
        if (e.key === 'Escape' && this.converterModalState !== 'minimized') {
            this.minimizeConverterModal();
        }
    }

    /**
     * Initialize global search - EXACT from amc-header.js
     */
    initializeGlobalSearch() {
        if (!this.searchEnabled) return;
        
        const searchInput = document.getElementById('globalSearchInput');
        const searchScope = document.getElementById('searchScope');
        
        if (!searchInput || !searchScope) return;
        
        // Keyboard shortcut (Cmd/Ctrl + K)
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                searchInput?.focus();
                searchInput?.select();
            }
            
            if (e.key === 'Escape' && document.activeElement === searchInput) {
                searchInput.blur();
                searchInput.value = '';
            }
        });
        
        // Search functionality
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            const scope = searchScope.value || 'all';
            
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                if (query.length >= 2) {
                    this.performGlobalSearch(query, scope);
                } else if (query.length === 0) {
                    this.clearSearchResults();
                }
            }, 300);
        });
        
        searchScope.addEventListener('change', (e) => {
            const query = searchInput.value.toLowerCase().trim();
            if (query && query.length >= 2) {
                this.performGlobalSearch(query, e.target.value);
            }
        });
        
        console.log('✅ Global search initialized');
    }

    /**
     * Perform global search
     */
    performGlobalSearch(query, scope) {
        console.log(`🔍 Global Search: "${query}" in scope: "${scope}"`);
        
        const searchContainer = document.querySelector('.search-container');
        searchContainer?.classList.add('searching');
        
        setTimeout(() => {
            searchContainer?.classList.remove('searching');
            this.displayMockSearchResults(query, scope);
        }, 500);
        
        // Dispatch search event for external handlers
        window.dispatchEvent(new CustomEvent('amcGlobalSearch', {
            detail: { query, scope }
        }));
    }

    /**
     * Display mock search results
     */
    displayMockSearchResults(query, scope) {
        console.log(`📊 Mock Results for "${query}" in ${scope}:`);
        
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

    /**
     * Clear search results
     */
    clearSearchResults() {
        console.log('🧹 Search results cleared');
    }

    /**
     * Initialize badge system - EXACT from amc-header.js
     */
    initializeBadgeSystem() {
        if (!this.badgesEnabled) return;
        
        const cartEl = document.querySelector('.cart-indicator');
        const cartBadge = cartEl?.querySelector('.cart-badge');
        const notifEl = document.querySelector('.notification-indicator');
        const notifBadge = notifEl?.querySelector('.notification-badge');

        const updateBadges = () => {
            const cartCount = Number(localStorage.getItem('amc.cart.count') || 0);
            const notifCount = Number(localStorage.getItem('amc.notifications') || 0);

            if (cartEl && cartBadge) {
                cartBadge.textContent = Math.min(cartCount, 99);
                cartEl.classList.toggle('has-items', cartCount > 0);
                cartEl.setAttribute('data-tooltip', `View Cart (${cartCount} items)`);
            }
            if (notifEl && notifBadge) {
                notifBadge.textContent = Math.min(notifCount, 99);
                notifEl.classList.toggle('has-new', notifCount > 0);
            }
        };
        
        // Initialize notifications test data only
        localStorage.setItem('amc.notifications', '3');
        updateBadges();
        
        window.addEventListener('storage', e => {
            if (['amc.cart.count','amc.notifications'].includes(e.key)) updateBadges();
        });

        // Expose global functions
        window.amcSetCartCount = (count) => {
            localStorage.setItem('amc.cart.count', count.toString());
            updateBadges();
        };

        window.amcSetNotifCount = (count) => {
            localStorage.setItem('amc.notifications', count.toString());
            updateBadges();
        };
        
        console.log('✅ Badge system initialized');
    }

    /**
     * Bind additional events
     */
    bindEvents() {
        // Theme change listener
        window.addEventListener('themeChanged', () => {
            this.initializeTooltipSystem();
        });
        
        // Avatar system ready listener
        window.addEventListener('avatarSystemReady', () => {
            setTimeout(() => this.initializeTooltipSystem(), 100);
        });
    }

    /**
     * Inject modal styles - EXACT from amc-header.js (truncated for brevity)
     */
    injectModalStyles() {
        if (document.getElementById('uc-modal-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'uc-modal-styles';
        style.textContent = `
            .uc-overlay {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                background: rgba(0, 0, 0, 0.5) !important;
                backdrop-filter: blur(3px);
                z-index: 10000 !important;
                transition: opacity 0.3s ease;
            }
            
            .uc-modal {
                position: fixed;
                background: var(--bg-secondary, #ffffff);
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                z-index: 10001;
                display: flex;
                flex-direction: column;
                opacity: 0;
                transform: translateY(30px);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                overflow: hidden;
            }
            
            .uc-modal-mid {
                bottom: 0;
                right: 20px;
                width: 600px;
                height: 550px;
                max-height: calc(100vh - 100px);
                border-radius: 12px 12px 0 0;
            }
            
            .uc-modal-expanded {
                top: 80px;
                left: 50%;
                transform: translateX(-50%) !important;
                width: 95%;
                max-width: 1200px;
                height: calc(100vh - 100px);
                border-radius: 12px;
            }
            
            .uc-modal-show {
                opacity: 1;
                transform: translateY(0);
            }
            
            .uc-tab {
                position: fixed;
                bottom: 0;
                right: 20px;
                width: 280px;
                height: 44px;
                background: var(--bg-secondary, #ffffff);
                border: 1px solid var(--border-primary, #dee2e6);
                border-bottom: none;
                border-radius: 8px 8px 0 0;
                box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.15);
                z-index: 99999 !important;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 12px;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                transform: translateY(100%);
                opacity: 0;
            }
            
            .uc-tab-show {
                transform: translateY(0);
                opacity: 1;
            }
            
            .uc-tab-hidden {
                display: none;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Public API methods
     */
    setCartCount(count) {
        if (window.amcSetCartCount) {
            window.amcSetCartCount(count);
        }
    }

    setNotificationCount(count) {
        if (window.amcSetNotifCount) {
            window.amcSetNotifCount(count);
        }
    }

    toggleTheme() {
        document.body.classList.toggle('dark-mode');
        window.dispatchEvent(new CustomEvent('themeChanged'));
    }
}

// Auto-initialize header if container exists
document.addEventListener('DOMContentLoaded', () => {
    const headerPlaceholder = document.querySelector('amc-header');
    if (headerPlaceholder) {
        window.amcHeader = new AMCHeader();
        
        // Expose global methods
        window.minimizeConverterModal = () => window.amcHeader.minimizeConverterModal();
        window.restoreConverterModal = () => window.amcHeader.restoreConverterModal();
        window.toggleExpandConverter = () => window.amcHeader.toggleExpandConverter();
        window.closeConverterModal = () => window.amcHeader.closeConverterModal();
    }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AMCHeader;
}