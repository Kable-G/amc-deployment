/**
 * AMC Header Component - EXACT extraction from test_globalshell.html
 * Lines 341-421 from the working file
 */

// EXACT HTML from test_globalshell.html lines 341-421
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
                <div class="notification-indicator" id="notification-indicator" title="Notifications">
                    <i class="fas fa-bell"></i>
                    <div class="notification-badge">0</div>
                </div>
                <div class="cart-indicator" id="cart-indicator" title="View Cart (0 items)">
                    <i class="fas fa-shopping-cart"></i>
                    <div class="cart-badge">0</div>
                </div>
                
                <!-- 🛠️ TOOLS DROPDOWN -->
                <div class="tools-dropdown-container">
                    <button class="tools-toggle-btn" id="toolsToggle" title="Tools">
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
                <div class="amc-avatar-container" id="avatarContainer">
                    <!-- Avatar system will inject content here -->
                </div>
            </div>
            
            <!-- Three-dot menu positioned after avatar (rightmost) -->
            <button class="amc-menu-dots" title="More options">
                <i class="fas fa-ellipsis-v"></i>
            </button>
        </div>
    </header>
`;

// Initialize header component
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 AMC Header Component initializing...');
    
    // Find the amc-header placeholder and replace it
    const headerPlaceholder = document.querySelector('amc-header');
    if (headerPlaceholder) {
        console.log('✅ Found amc-header placeholder, injecting header HTML...');
        headerPlaceholder.outerHTML = HEADER_HTML;
        
        // Initialize header functionality after DOM is updated
        setTimeout(initializeHeaderFunctionality, 100);
    } else {
        console.error('❌ amc-header placeholder not found!');
    }
});

function initializeHeaderFunctionality() {
    console.log('🔧 Initializing header functionality...');
    
    // EXACT JavaScript from test_globalshell.html lines 536-617 (tooltip system)
    const initTooltipSystem = () => {
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
                
                // Convert title to data-tooltip for custom styling
                const title = element.getAttribute('title');
                if (title) {
                    element.setAttribute('data-tooltip', title);
                    element.removeAttribute('title'); // Remove to prevent browser default
                    console.log(`✅ Converted tooltip for ${selector}: "${title}"`);
                } else {
                    // Set default tooltips if none exist
                    const defaultTooltips = {
                        '#notification-indicator': 'Notifications',
                        '#cart-indicator': 'View Cart',
                        '#toolsToggle': 'Tools',
                        '.amc-menu-dots': 'More options',
                        '.amc-avatar-container': 'User Profile'
                    };
                    const defaultTitle = defaultTooltips[selector];
                    if (defaultTitle) {
                        element.setAttribute('data-tooltip', defaultTitle);
                        console.log(`✅ Set default tooltip for ${selector}: "${defaultTitle}"`);
                    }
                }
                
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
    };

    // Initialize tooltip system
    setTimeout(initTooltipSystem, 500);
    setTimeout(initTooltipSystem, 2000);
    setTimeout(initTooltipSystem, 5000);
    
    window.addEventListener('avatarSystemReady', () => {
        setTimeout(initTooltipSystem, 100);
    });

    // EXACT JavaScript from test_globalshell.html lines 659-713 (tools dropdown)
    const toolsToggle = document.getElementById('toolsToggle');
    const toolsDropdownMenu = document.getElementById('toolsDropdownMenu');
    
    if (toolsToggle && toolsDropdownMenu) {
        // Toggle dropdown
        toolsToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = toolsDropdownMenu.classList.contains('show');
            
            if (isOpen) {
                closeToolsDropdown();
            } else {
                openToolsDropdown();
            }
        });
        
        // Open dropdown
        function openToolsDropdown() {
            toolsDropdownMenu.classList.add('show');
            toolsToggle.classList.add('active');
        }
        
        // Close dropdown
        function closeToolsDropdown() {
            toolsDropdownMenu.classList.remove('show');
            toolsToggle.classList.remove('active');
        }
        
        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!toolsToggle.contains(e.target) && !toolsDropdownMenu.contains(e.target)) {
                closeToolsDropdown();
            }
        });
        
        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && toolsDropdownMenu.classList.contains('show')) {
                closeToolsDropdown();
                toolsToggle.focus();
            }
        });
        
        // Handle tool selection
        const toolItems = document.querySelectorAll('.tool-item');
        toolItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const toolType = item.dataset.tool;
                openToolModal(toolType);
                closeToolsDropdown();
            });
        });
    }
    
    // ============================================================
    // UNIT CONVERTER MODAL - COMPLETE UPDATED VERSION
    // ============================================================

    let converterModal = null;
    let converterTab = null;
    let converterModalState = 'closed';

    function openToolModal(toolType) {
        console.log(`🛠️ Opening tool: ${toolType}`);
        
        switch(toolType) {
            case 'unit-converter':
                openUnitConverterModal();
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

    function openUnitConverterModal() {
        if (converterModal && document.body.contains(converterModal)) {
            if (converterModalState === 'minimized') {
                restoreConverterModal();
            }
            return;
        }
        
        if (!document.getElementById('uc-modal-styles')) {
            injectModalStyles();
        }
        
        const savedSize = localStorage.getItem('uc-preferred-size') || 'mid';
        
        const overlay = document.createElement('div');
        overlay.id = 'uc-modal-overlay';
        overlay.className = 'uc-overlay';
        overlay.onclick = minimizeConverterModal;
        
        converterModal = document.createElement('div');
        converterModal.id = 'uc-modal';
        converterModal.className = `uc-modal uc-modal-${savedSize}`;
        
        const header = document.createElement('div');
        header.className = 'uc-modal-header';
        header.innerHTML = `
            <div class="uc-header-left">
                <i class="fas fa-calculator"></i>
                <span class="uc-title">Unit Converter</span>
            </div>
            <div class="uc-header-controls">
                <button class="uc-control-btn" onclick="minimizeConverterModal()" title="Minimize">
                    <i class="fas fa-minus"></i>
                </button>
                <button class="uc-control-btn uc-expand-btn" onclick="toggleExpandConverter()" title="${savedSize === 'expanded' ? 'Restore' : 'Expand'}">
                    <i class="fas fa-${savedSize === 'expanded' ? 'compress' : 'expand'}"></i>
                </button>
                <button class="uc-control-btn uc-close-btn" onclick="closeConverterModal()" title="Close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        const body = document.createElement('div');
        body.className = 'uc-modal-body';
        const iframe = document.createElement('iframe');
        iframe.src = 'unit-converter-content.html';
        iframe.className = 'uc-iframe';
        iframe.style.opacity = '0';  // Hide until styled
        iframe.style.transition = 'opacity 0.2s ease';
        
        // Apply iframe styles on load
        iframe.addEventListener('load', function() {
            applyIframeStyles(iframe);
            // Show iframe after styling
            setTimeout(() => {
                iframe.style.opacity = '1';
            }, 50);
        });
        
        body.appendChild(iframe);
        converterModal.appendChild(header);
        converterModal.appendChild(body);
        
        // Create minimized tab - SIMPLE APPROACH
        converterTab = document.createElement('div');
        converterTab.id = 'uc-tab';
        converterTab.className = 'uc-tab uc-tab-hidden';
        converterTab.innerHTML = `
            <div class="uc-tab-left">
                <i class="fas fa-calculator"></i>
                <span>Unit Converter</span>
            </div>
            <div class="uc-tab-right">
                <button class="uc-tab-btn uc-tab-restore" title="Restore">
                    <i class="fas fa-window-maximize"></i>
                </button>
                <button class="uc-tab-btn uc-tab-close" title="Close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        // Simple onclick - NO addEventListener, NO cloning, NO complexity
        converterTab.onclick = function(e) {
            console.log('🖱️ Tab clicked:', e.target.tagName, e.target.className);
            
            const target = e.target;
            
            // Check if clicking restore button or its icon
            if (target.classList.contains('uc-tab-restore') ||
                target.parentElement.classList.contains('uc-tab-restore') ||
                target.closest('.uc-tab-restore')) {
                console.log('🔵 Restore button clicked');
                restoreConverterModal();
                return;
            }
            
            // Check if clicking close button or its icon
            if (target.classList.contains('uc-tab-close') ||
                target.parentElement.classList.contains('uc-tab-close') ||
                target.closest('.uc-tab-close')) {
                console.log('🔴 Close button clicked');
                closeConverterModal();
                return;
            }
            
            // Check if clicking left area
            if (target.classList.contains('uc-tab-left') ||
                target.closest('.uc-tab-left')) {
                console.log('🔵 Tab title clicked - restoring modal');
                restoreConverterModal();
                return;
            }
        };

        console.log('✅ Tab created with simple onclick handler');
        
        document.body.appendChild(overlay);
        document.body.appendChild(converterModal);
        document.body.appendChild(converterTab);
        
        converterModalState = savedSize;
        setTimeout(() => converterModal.classList.add('uc-modal-show'), 10);
        document.addEventListener('keydown', handleConverterEscape);
    }


    // NEW FUNCTION: Apply iframe styles based on current parent theme
    function applyIframeStyles(iframe) {
        try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            const parentIsDark = document.body.classList.contains('dark-mode');
            
            // Remove old style if exists
            const oldStyle = iframeDoc.getElementById('modal-injected-styles');
            if (oldStyle) oldStyle.remove();
            
            const style = iframeDoc.createElement('style');
            style.id = 'modal-injected-styles';
            style.textContent = `
                /* Hide unwanted elements */
                .app-header, #sidebar, .amc-sidebar, .app-footer {
                    display: none !important;
                }
                
                /* Full-width content */
                .main-content, .amc-content {
                    margin: 0 !important;
                    width: 100% !important;
                    padding: 20px !important;
                    max-width: none !important;
                    min-height: auto !important;
                }
                
                /* Hide titles and dark mode toggle */
                #hub-view .content-header h1,
                #converter-detail-view .content-header h1,
                #dark-mode-toggle,
                .theme-toggle-btn {
                    display: none !important;
                }
                
                /* Compact grid */
                #hub-view .converter-grid {
                    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)) !important;
                    gap: 12px !important;
                }
                
                /* FIX: Remove extra space at bottom */
                body {
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow-y: auto !important;
                    overflow-x: hidden !important;
                }
                
                html {
                    margin: 0 !important;
                    padding: 0 !important;
                }
                
                /* Ensure no extra space after content */
                #hub-view, #converter-detail-view {
                    padding-bottom: 0 !important;
                    margin-bottom: 0 !important;
                }
                
                .converter-grid {
                    margin-bottom: 0 !important;
                    padding-bottom: 0 !important;
                }
                
                ${parentIsDark ? `
                    /* DARK MODE */
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
                    .converter-section, .card, .category-card {
                        background: #1a1c1e !important;
                        color: #e0e0e0 !important;
                        border-color: #3a3a3a !important;
                    }
                    input, select, textarea {
                        background: #2a2d30 !important;
                        color: #e0e0e0 !important;
                        border-color: #444 !important;
                    }
                    .btn {
                        background: #2a2d30 !important;
                        color: #e0e0e0 !important;
                    }
                    .btn-primary {
                        background: #3f91ff !important;
                        color: #ffffff !important;
                    }
                ` : `
                    /* LIGHT MODE */
                    body {
                        background: #f8f9fa !important;
                        color: #212529 !important;
                    }
                    body.dark-mode {
                        --bg-primary: #f8f9fa !important;
                        --bg-secondary: #ffffff !important;
                        --bg-tertiary: #e9ecef !important;
                        --text-primary: #212529 !important;
                        --text-secondary: #6c757d !important;
                        --text-headings: #343a40 !important;
                        --border-primary: #dee2e6 !important;
                    }
                    .converter-section, .card, .category-card {
                        background: #ffffff !important;
                        color: #212529 !important;
                        border-color: #dee2e6 !important;
                    }
                    input, select, textarea {
                        background: #ffffff !important;
                        color: #212529 !important;
                        border-color: #dee2e6 !important;
                    }
                    .btn {
                        background: #ffffff !important;
                        color: #212529 !important;
                    }
                    .btn-primary {
                        background: #0d6efd !important;
                        color: #ffffff !important;
                    }
                `}
            `;
            iframeDoc.head.appendChild(style);
            console.log('✅ Iframe styled:', parentIsDark ? 'dark' : 'light');
        } catch (e) {
            console.warn('⚠️ Could not style iframe:', e);
        }
    }

    function minimizeConverterModal() {
        console.log('🔍🔍🔍 DIAGNOSTIC START 🔍🔍🔍');
        console.log('converterTab exists:', !!converterTab);
        console.log('converterTab in DOM:', converterTab && document.body.contains(converterTab));
        console.log('converterTab id:', converterTab?.id);
        console.log('converterTab onclick:', !!converterTab?.onclick);
        console.log('converterTab onclick type:', typeof converterTab?.onclick);
        console.log('converterTab element:', converterTab);
        
        // Try to find tab by ID
        const tabById = document.getElementById('uc-tab');
        console.log('Tab found by ID:', !!tabById);
        console.log('Tab by ID onclick:', !!tabById?.onclick);
        console.log('Are they the same element:', converterTab === tabById);
        console.log('🔍🔍🔍 DIAGNOSTIC END 🔍🔍🔍');
        
        if (!converterModal) {
            console.warn('⚠️ No modal to minimize');
            return;
        }
        
        console.log('📦 Minimizing modal from state:', converterModalState);
        console.log('🔍 Tab element exists:', !!converterTab);
        console.log('🔍 Tab in DOM:', converterTab && document.body.contains(converterTab));
        
        converterModalState = 'minimized';
        
        // Hide modal and overlay
        converterModal.classList.remove('uc-modal-show');
        const overlay = document.getElementById('uc-modal-overlay');
        if (overlay) {
            overlay.style.display = 'none';
            console.log('✅ Overlay hidden');
        }
        
        // NUCLEAR OPTION: Always remove and recreate tab for reliability
        console.log('🗑️ Removing any existing tab');
        const oldTab = document.getElementById('uc-tab');
        if (oldTab) {
            oldTab.remove();
        }
        
        // Create fresh tab EVERY TIME
        console.log('🆕 Creating fresh tab');
        converterTab = document.createElement('div');
        converterTab.id = 'uc-tab';
        converterTab.className = 'uc-tab';  // Don't hide yet
        converterTab.innerHTML = `
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
        
        // Attach onclick AFTER creating
        converterTab.onclick = function(e) {
            console.log('🖱️ FRESH TAB CLICKED:', e.target.tagName, e.target.className);
            
            if (e.target.closest('.uc-tab-restore')) {
                console.log('🔵 Restore clicked');
                restoreConverterModal();
            } else if (e.target.closest('.uc-tab-close')) {
                console.log('🔴 Close clicked');
                closeConverterModal();
            } else if (e.target.closest('.uc-tab-left')) {
                console.log('🔵 Title clicked');
                restoreConverterModal();
            }
        };
        
        // Add to DOM
        document.body.appendChild(converterTab);
        console.log('✅ Fresh tab added to DOM');
        console.log('✅ Tab onclick exists:', !!converterTab.onclick);
        
        // Show with animation
        setTimeout(() => {
            converterTab.classList.add('uc-tab-show');
            console.log('✅ Tab shown');
        }, 10);
    }

    function restoreConverterModal() {
        if (!converterModal) {
            console.warn('⚠️ No modal to restore');
            return;
        }
        
        console.log('🔄 Restoring modal...');
        
        const lastSize = localStorage.getItem('uc-preferred-size') || 'mid';
        converterModalState = lastSize;
        
        console.log('📐 Restoring to size:', lastSize);
        
        // Hide tab
        if (converterTab) {
            converterTab.classList.remove('uc-tab-show');
            setTimeout(() => {
                converterTab.classList.add('uc-tab-hidden');
                console.log('✅ Tab hidden');
            }, 300);
        }
        
        // Show modal and overlay
        const overlay = document.getElementById('uc-modal-overlay');
        if (overlay) {
            overlay.style.display = 'block';
            console.log('✅ Overlay shown');
        }
        
        // Re-apply iframe styles in case theme changed
        const iframe = converterModal.querySelector('.uc-iframe');
        if (iframe && iframe.contentDocument) {
            applyIframeStyles(iframe);
        }
        
        // Update modal classes
        converterModal.className = `uc-modal uc-modal-${lastSize} uc-modal-show`;
        console.log('✅ Modal restored with class:', converterModal.className);
    }

    function toggleExpandConverter() {
        if (!converterModal) return;
        const btn = converterModal.querySelector('.uc-expand-btn');
        const icon = btn.querySelector('i');
        
        if (converterModalState === 'mid') {
            converterModalState = 'expanded';
            converterModal.classList.remove('uc-modal-mid');
            converterModal.classList.add('uc-modal-expanded');
            icon.className = 'fas fa-compress';
            btn.title = 'Restore';
            localStorage.setItem('uc-preferred-size', 'expanded');
        } else {
            converterModalState = 'mid';
            converterModal.classList.remove('uc-modal-expanded');
            converterModal.classList.add('uc-modal-mid');
            icon.className = 'fas fa-expand';
            btn.title = 'Expand';
            localStorage.setItem('uc-preferred-size', 'mid');
        }
    }

    function closeConverterModal() {
        if (!converterModal) return;
        converterModalState = 'closed';
        document.removeEventListener('keydown', handleConverterEscape);
        converterModal.classList.remove('uc-modal-show');
        converterTab.classList.remove('uc-tab-show');
        setTimeout(() => {
            document.getElementById('uc-modal-overlay')?.remove();
            converterModal?.remove();
            converterTab?.remove();
            converterModal = null;
            converterTab = null;
        }, 300);
    }

    function handleConverterEscape(e) {
        if (e.key === 'Escape' && converterModalState !== 'minimized') {
            minimizeConverterModal();
        }
    }

    window.minimizeConverterModal = minimizeConverterModal;
    window.restoreConverterModal = restoreConverterModal;
    window.toggleExpandConverter = toggleExpandConverter;
    window.closeConverterModal = closeConverterModal;

    function injectModalStyles() {
        const style = document.createElement('style');
        style.id = 'uc-modal-styles';
        style.textContent = `
            /* ============================================
               FIX: INDUSTRY-STANDARD FULL-VIEWPORT OVERLAY
               ============================================ */
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
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                outline: none !important;
            }

            body.dark-mode .uc-overlay {
                background: rgba(0, 0, 0, 0.7) !important;
            }
            
            /* Modal Container */
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
            
            /* Mid Size - Bottom docked */
            .uc-modal-mid {
                bottom: 0;
                right: 20px;
                width: 600px;
                height: 550px;
                max-height: calc(100vh - 100px);
                border-radius: 12px 12px 0 0;
            }
            
            /* Expanded - Floating */
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
            
            body.dark-mode .uc-modal {
                background: var(--bg-secondary, #1f2937);
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
            }
            
            /* Modal Header */
            .uc-modal-header {
                padding: 16px 20px;
                border-bottom: 1px solid var(--border-primary, #dee2e6);
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: linear-gradient(135deg, var(--bg-tertiary, #f3f4f6) 0%, var(--bg-secondary, #ffffff) 100%);
                flex-shrink: 0;
            }
            
            .uc-modal-mid .uc-modal-header {
                border-radius: 12px 12px 0 0;
            }
            
            .uc-modal-expanded .uc-modal-header {
                border-radius: 12px 12px 0 0;
            }
            
            body.dark-mode .uc-modal-header {
                background: linear-gradient(135deg, var(--bg-tertiary, #2a2d30) 0%, var(--bg-secondary, #1f2937) 100%);
                border-bottom-color: var(--border-primary, #374151);
            }
            
            .uc-header-left {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .uc-header-left i {
                color: var(--accent-primary, #0d6efd);
                font-size: 20px;
            }
            
            .uc-title {
                font-size: 1.1rem;
                font-weight: 600;
                color: var(--text-headings, #212529);
            }
            
            body.dark-mode .uc-title {
                color: var(--text-headings, #f8f9fa);
            }
            
            .uc-header-controls {
                display: flex;
                gap: 4px;
            }
            
            .uc-control-btn {
                width: 32px;
                height: 32px;
                border: none;
                background: transparent;
                border-radius: 6px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--text-secondary, #6c757d);
                transition: all 0.2s ease;
            }
            
            .uc-control-btn:hover {
                background: var(--bg-tertiary, #e9ecef);
                color: var(--text-primary, #212529);
            }
            
            body.dark-mode .uc-control-btn:hover {
                background: var(--bg-tertiary, #374151);
                color: var(--text-primary, #f3f4f6);
            }
            
            .uc-close-btn:hover {
                background: #dc3545 !important;
                color: white !important;
            }
            
            /* Modal Body */
            .uc-modal-body {
                flex: 1;
                overflow: hidden;
                position: relative;
                background: transparent;
            }
            
            .uc-modal-mid .uc-modal-body {
                border-radius: 0;
            }
            
            .uc-modal-expanded .uc-modal-body {
                border-radius: 0 0 12px 12px;
            }
            
            .uc-iframe {
                width: 100%;
                height: 100%;
                border: none;
                display: block;
            }
            
            .uc-modal-mid .uc-iframe {
                border-radius: 0;
            }
            
            .uc-modal-expanded .uc-iframe {
                border-radius: 0 0 12px 12px;
            }
            
            /* Minimized Tab */
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
                pointer-events: auto !important;
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
            
            .uc-tab:hover {
                box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.2);
            }
            
            body.dark-mode .uc-tab {
                background: var(--bg-secondary, #1f2937);
                border-color: var(--border-primary, #374151);
                box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.3);
            }
            
            .uc-tab-left {
                display: flex;
                align-items: center;
                gap: 10px;
                flex: 1;
                cursor: pointer;
                padding: 8px 0;
                border-radius: 6px;
                transition: all 0.2s ease;
            }
            
            .uc-tab-left:hover {
                background: var(--bg-tertiary, #f3f4f6);
                padding-left: 8px;
                margin-left: -8px;
            }
            
            body.dark-mode .uc-tab-left:hover {
                background: var(--bg-tertiary, #2a2d30);
            }
            
            .uc-tab-left i {
                color: var(--accent-primary, #0d6efd);
                font-size: 16px;
                flex-shrink: 0;
            }
            
            .uc-tab-left span {
                font-size: 14px;
                font-weight: 600;
                color: var(--text-primary, #212529);
            }
            
            body.dark-mode .uc-tab-left span {
                color: var(--text-primary, #f3f4f6);
            }
            
            .uc-tab-right {
                display: flex;
                gap: 4px;
                align-items: center;
            }
            
            .uc-tab-btn {
                width: 32px;
                height: 32px;
                border: none;
                background: transparent;
                border-radius: 6px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--text-secondary, #6c757d);
                transition: all 0.2s ease;
                font-size: 14px;
            }
            
            .uc-tab-btn:hover {
                background: var(--bg-tertiary, #e9ecef);
                color: var(--text-primary, #212529);
            }
            
            body.dark-mode .uc-tab-btn:hover {
                background: var(--bg-tertiary, #374151);
                color: var(--text-primary, #f3f4f6);
            }
            
            .uc-tab-close:hover {
                background: #dc3545 !important;
                color: white !important;
            }
            
            .uc-tab-restore:hover {
                color: var(--accent-primary, #0d6efd) !important;
            }
            
            body.dark-mode .uc-tab-restore:hover {
                color: var(--accent-primary, #3f91ff) !important;
            }
            
            @media (max-width: 768px) {
                .uc-modal-mid {
                    left: 0;
                    right: 0;
                    width: 100%;
                    height: 70vh;
                    border-radius: 12px 12px 0 0;
                }
                .uc-modal-expanded {
                    top: 60px;
                    left: 0;
                    width: 100%;
                    transform: none !important;
                    height: calc(100vh - 60px);
                    border-radius: 0;
                }
                .uc-tab {
                    width: 100%;
                    right: 0;
                }
            }
            
            /* Enterprise Tooltips for Tab Buttons */
            .uc-tab-btn[data-tooltip] {
                position: relative;
            }

            .uc-tab-btn[data-tooltip]:hover::after {
                content: attr(data-tooltip);
                position: absolute;
                bottom: calc(100% + 8px);
                left: 50%;
                transform: translateX(-50%);
                padding: 6px 10px;
                background: #ffffff;
                color: #1f2937;
                border: 1px solid #e5e7eb;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 500;
                white-space: nowrap;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                z-index: 100000;
                pointer-events: none;
                animation: tooltipFadeIn 0.2s ease;
            }

            .uc-tab-btn[data-tooltip]:hover::before {
                content: '';
                position: absolute;
                bottom: calc(100% + 2px);
                left: 50%;
                transform: translateX(-50%);
                border: 4px solid transparent;
                border-top-color: #ffffff;
                z-index: 100000;
                pointer-events: none;
                animation: tooltipFadeIn 0.2s ease;
            }

            body.dark-mode .uc-tab-btn[data-tooltip]:hover::after {
                background: #374151;
                color: #f9fafb;
                border-color: #4b5563;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
            }

            body.dark-mode .uc-tab-btn[data-tooltip]:hover::before {
                border-top-color: #374151;
            }

            @keyframes tooltipFadeIn {
                from { opacity: 0; transform: translateX(-50%) translateY(4px); }
                to { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }


    // EXACT JavaScript from test_globalshell.html lines 799-841 (global search)
    const searchInput = document.getElementById('globalSearchInput');
    const searchScope = document.getElementById('searchScope');
    
    // Keyboard shortcut (Cmd/Ctrl + K)
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            searchInput?.focus();
            searchInput?.select();
        }
        
        // Escape to clear search
        if (e.key === 'Escape' && document.activeElement === searchInput) {
            searchInput.blur();
            searchInput.value = '';
        }
    });
    
    // Search functionality
    let searchTimeout;
    searchInput?.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const scope = searchScope?.value || 'all';
        
        // Debounce search to avoid excessive calls
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            if (query.length >= 2) {
                performGlobalSearch(query, scope);
            } else if (query.length === 0) {
                clearSearchResults();
            }
        }, 300);
    });
    
    // Scope change handler
    searchScope?.addEventListener('change', (e) => {
        const query = searchInput?.value.toLowerCase().trim();
        if (query && query.length >= 2) {
            performGlobalSearch(query, e.target.value);
        }
    });
    
    // Global search function (placeholder for backend integration)
    function performGlobalSearch(query, scope) {
        console.log(`🔍 Global Search: "${query}" in scope: "${scope}"`);
        
        // For now, show search activity in console
        const searchContainer = document.querySelector('.search-container');
        searchContainer?.classList.add('searching');
        
        // Simulate search delay
        setTimeout(() => {
            searchContainer?.classList.remove('searching');
            // Mock results for demonstration
            displayMockSearchResults(query, scope);
        }, 500);
    }
    
    // Mock search results for demonstration
    function displayMockSearchResults(query, scope) {
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
    
    // Clear search results
    function clearSearchResults() {
        console.log('🧹 Search results cleared');
        // TODO: Hide search results dropdown when implemented
    }

    // EXACT JavaScript from test_globalshell.html lines 3484-3517 (badges)
    const cartEl = document.querySelector('.cart-indicator');
    const cartBadge = cartEl?.querySelector('.cart-badge');
    const notifEl = document.querySelector('.notification-indicator');
    const notifBadge = notifEl?.querySelector('.notification-badge');

    function updateBadges(){
        const cartCount = Number(localStorage.getItem('amc.cart.count') || 0);
        const notifCount = Number(localStorage.getItem('amc.notifications') || 0);

        if (cartEl && cartBadge){
            cartBadge.textContent = Math.min(cartCount, 99);
            cartEl.classList.toggle('has-items', cartCount > 0);
        }
        if (notifEl && notifBadge){
            notifBadge.textContent = Math.min(notifCount, 99);
            notifEl.classList.toggle('has-new', notifCount > 0);
        }
    }
    
    // 🧪 TEST: Set notification count to 3 to show red bell
    localStorage.setItem('amc.notifications', '3');
    updateBadges();
    
    window.addEventListener('storage', e => {
        if (['amc.cart.count','amc.notifications'].includes(e.key)) updateBadges();
    });

    // Expose global functions for testing
    window.amcSetCartCount = (count) => {
        localStorage.setItem('amc.cart.count', count.toString());
        updateBadges();
    };

    window.amcSetNotifCount = (count) => {
        localStorage.setItem('amc.notifications', count.toString());
        updateBadges();
    };
    
    console.log('✅ Header functionality initialized successfully');
}