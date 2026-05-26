
/**
 * AMC Sidebar Component - Complete Enterprise Sidebar System
 * Extracted from sidebar.js with ALL functionality included
 * Modular design - no main content interference
 */

/**
 * Enterprise Sidebar System with Collapsible Sections
 * Features: Role-based rendering, dynamic badges, collapsible sections, tooltips
 */
class AMCSidebar {
    constructor(options = {}) {
        this.container = options.container || '#sidebar';
        this.userRole = options.userRole || this.getUserRoleFromStorage();
        this.currentPage = options.currentPage || this.getCurrentPage();
        this.collapsed = this.getStoredCollapseState();
        
        // Sidebar configuration with enterprise features - EXACT from sidebar.js
        this.sidebarConfig = [
            {
                section: "Core",
                required: "media_user",
                items: [
                    { 
                        label: "AutoMediaCenter", 
                        href: "automediacenter.html", 
                        icon: "fas fa-newspaper",
                        roles: ["media_user", "client_user", "client_admin", "platform_admin"],
                        badge: null
                    },
                    { 
                        label: "AutoMediaRadar", 
                        href: "newradarfe.html", 
                        icon: "fas fa-satellite-dish",
                        roles: ["media_user", "client_user", "client_admin", "platform_admin"],
                        badge: null
                    },
                    { 
                        label: "AutoMediaLive", 
                        href: "automedialive.html", 
                        icon: "fas fa-video",
                        roles: ["media_user", "client_user", "client_admin", "platform_admin"],
                        badge: null
                    },
                    {
                        label: "AutoMediaVault",
                        href: "automediavault.html",
                        icon: "fas fa-lock",
                        roles: ["media_user", "client_user", "client_admin", "platform_admin"],
                        badge: null
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
                        badge: null
                    },
                    {
                        label: "Upload Dashboard",
                        href: "AssetDBmenu1.6.html",
                        icon: "fas fa-upload",
                        roles: ["client_user", "client_admin", "platform_admin"],
                        badge: null
                    },
                    {
                        label: "Manage Releases",
                        href: "manage_releases.html",
                        icon: "fas fa-folder-open",
                        roles: ["client_user", "client_admin", "platform_admin"],
                        badge: null
                    },
                    {
                        label: "Radar History",
                        href: "radar_history_clean.html",
                        icon: "fas fa-history",
                        roles: ["client_user", "client_admin", "platform_admin"],
                        badge: null
                    },
                    {
                        label: "Manage Live Events",
                        href: "manage_streams.html",
                        icon: "fas fa-flag-checkered",
                        roles: ["client_admin", "platform_admin"],
                        badge: null
                    },
                    {
                        label: "Manage Vault Assets",
                        href: "manage_vault.html",
                        icon: "fas fa-lock",
                        roles: ["client_admin", "platform_admin"],
                        badge: null
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
                        badge: null
                    },
                    {
                        label: "AMC Analytics",
                        href: "amc-analytics.html",
                        icon: "fas fa-chart-bar",
                        roles: ["client_admin", "platform_admin"],
                        badge: null
                    },
                    {
                        label: "Radar Analytics",
                        href: "radar_analytics.html",
                        icon: "fas fa-chart-area",
                        roles: ["client_admin", "platform_admin"],
                        badge: null
                    },
                    {
                        label: "Live Analytics",
                        href: "live_analytics.html",
                        icon: "fas fa-chart-pie",
                        roles: ["client_admin", "platform_admin"],
                        badge: null
                    },
                    {
                        label: "Vault Analytics",
                        href: "vault_analytics.html",
                        icon: "fas fa-chart-bar",
                        roles: ["platform_admin"],
                        badge: null
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
                        badge: null
                    },
                    {
                        label: "User Management",
                        href: "user-management.html",
                        icon: "fas fa-users",
                        roles: ["platform_admin"],
                        badge: null
                    },
                    {
                        label: "Client Management",
                        href: "client_management.html",
                        icon: "fas fa-building",
                        roles: ["platform_admin"],
                        badge: null
                    },
                    {
                        label: "Access Control",
                        href: "access_control.html",
                        icon: "fas fa-shield-alt",
                        roles: ["platform_admin"],
                        badge: null
                    },
                    {
                        label: "System Settings",
                        href: "system_settings.html",
                        icon: "fas fa-cogs",
                        roles: ["platform_admin"],
                        badge: null
                    }
                ]
            }
        ];

        this.init();
    }

    /**
     * Get user role using the same robust logic as components/amc-role.js
     */
    getUserRoleFromStorage() {
        try {
            // PRIORITY 1: Use AMC.role if available (set by amc-role.js)
            if (window.AMC && window.AMC.role) {
                console.log('🎯 AMC Sidebar: Using AMC.role from amc-role.js:', window.AMC.role);
                return window.AMC.role;
            }

            // PRIORITY 2: Check session override (same as amc-role.js)
            const sessionRole = sessionStorage.getItem("amcRoleOverride");
            if (sessionRole) {
                console.log('🎯 AMC Sidebar: Using session override role:', sessionRole);
                return sessionRole;
            }

            // PRIORITY 3: Use same detection logic as amc-role.js
            const ROLE_KEYS = ["role", "userRole"];
            const USER_KEYS = ["user", "currentUser"];

            for (const key of USER_KEYS) {
                try {
                    const raw = localStorage.getItem(key);
                    if (!raw) continue;
                    const u = JSON.parse(raw);
                    for (const rk of ROLE_KEYS) {
                        if (u && u[rk]) {
                            console.log(`🎯 AMC Sidebar: Found role "${u[rk]}" in localStorage.${key}.${rk}`);
                            return u[rk];
                        }
                    }
                    if (Array.isArray(u?.roles) && u.roles[0]) {
                        console.log(`🎯 AMC Sidebar: Found role "${u.roles[0]}" in localStorage.${key}.roles[0]`);
                        return u.roles[0];
                    }
                } catch (e) {
                    console.warn(`🎯 AMC Sidebar: Error parsing localStorage.${key}:`, e);
                }
            }
            
            // PRIORITY 4: Final fallback (same as amc-role.js)
            console.log('🎯 AMC Sidebar: No role found, using media_user default (same as amc-role.js)');
            return 'media_user';
            
        } catch (e) {
            console.error('[AMCSidebar] Error getting user role:', e);
            return 'media_user'; // Same fallback as amc-role.js
        }
    }

    /**
     * Initialize the sidebar
     */
    init() {
        this.cleanupTooltips();
        this.render();
        this.bindEvents();
        this.applyCollapseState();
        this.highlightActivePage();
        this.bindAnalyticsEvents();
        
        // Initialize collapsible sections after render
        setTimeout(() => {
            this.initCollapsibleSections();
            this.initCollapsedSectionBars();
        }, 100);
        
        // Dispatch ready event
        window.dispatchEvent(new CustomEvent('amcSidebarReady', {
            detail: { instance: this }
        }));
        
        console.log('✅ AMC Sidebar initialized with full functionality');
    }

    /**
     * Clean up any existing tooltip elements
     */
    cleanupTooltips() {
        document.querySelectorAll('.amc-sidebar-tooltip, .sidebar-tooltip').forEach(tooltip => {
            tooltip.remove();
        });
    }

    /**
     * Get current page from URL
     */
    getCurrentPage() {
        const path = window.location.pathname;
        return path.split('/').pop() || 'index.html';
    }

    /**
     * Check if user has required role
     */
    hasRole(requiredRole) {
        const roleHierarchy = {
            'media_user': 1,
            'client_user': 2,
            'client_admin': 3,
            'platform_admin': 4
        };
        
        const userLevel = roleHierarchy[this.userRole] || 0;
        const requiredLevel = roleHierarchy[requiredRole] || 0;
        
        return userLevel >= requiredLevel;
    }

    /**
     * Check if user can access specific item
     */
    canAccessItem(item) {
        return item.roles.includes(this.userRole);
    }

    /**
     * Render the complete sidebar
     */
    render() {
        const container = document.querySelector(this.container);
        if (!container) {
            console.error(`[AMCSidebar] Container ${this.container} not found`);
            return;
        }

        container.innerHTML = this.generateHTML();
    }

    /**
     * Generate complete sidebar HTML
     */
    generateHTML() {
        return `
            <div class="sidebar-header">
                <button id="sidebarToggle" aria-label="Collapse sidebar" data-tooltip="Collapse sidebar">
                    <span class="hamburger"></span>
                </button>
            </div>
            <div class="sidebar-content">
                ${this.generateSectionsHTML()}
            </div>
        `;
    }

    /**
     * Generate sections HTML
     */
    generateSectionsHTML() {
        return this.sidebarConfig
            .filter(section => this.hasRole(section.required))
            .map(section => this.generateSectionHTML(section))
            .join('');
    }

    /**
     * Generate individual section HTML
     */
    generateSectionHTML(section) {
        const items = section.items
            .filter(item => this.canAccessItem(item))
            .map(item => this.generateItemHTML(item))
            .join('');

        if (!items) return '';

        // Add section-specific class for colored headers
        const sectionClass = section.section.toLowerCase();

        return `
            <div class="sidebar-section">
                <h4 class="sidebar-section-header ${sectionClass}">${section.section}</h4>
                <ul class="sidebar-list">
                    ${items}
                </ul>
            </div>
        `;
    }

    /**
     * Generate individual item HTML with enhanced tooltips
     */
    generateItemHTML(item) {
        const isActive = this.currentPage === item.href ||
                        window.location.pathname.endsWith(item.href);
        const activeClass = isActive ? ' active' : '';
        const ariaCurrent = isActive ? ' aria-current="page"' : '';
        const badge = item.badge ? this.generateBadgeHTML(item.badge) : '';
        
        return `
            <li class="sidebar-item">
                <a href="${item.href}" class="sidebar-link${activeClass}"${ariaCurrent}>
                    <span class="sidebar-icon">
                        <i class="${item.icon}"></i>
                    </span>
                    <span class="sidebar-text">${item.label}</span>
                    ${badge}
                </a>
            </li>
        `;
    }

    /**
     * Generate badge HTML
     */
    generateBadgeHTML(badge) {
        const badgeClass = `sidebar-badge sidebar-badge-${badge.type}`;
        return `<span class="${badgeClass}">${badge.text}</span>`;
    }

    /**
     * Bind event listeners - EXACT from sidebar.js
     */
    bindEvents() {
        // Toggle button
        const toggleBtn = document.getElementById('sidebarToggle');
        
        if (toggleBtn) {
            this.updateTooltip();
            this.updateLinkTooltips(this.collapsed);

            toggleBtn.addEventListener('click', () => {
                document.body.classList.toggle('sidebar-collapsed');
                document.body.classList.toggle('amc-collapsed'); // legacy support

                const isCollapsed = document.body.classList.contains('sidebar-collapsed');
                localStorage.setItem('amc_sidebar_collapsed', isCollapsed.toString());
                this.collapsed = isCollapsed;

                // DEBUG: Log toggle action
                console.log('🔄 SIDEBAR TOGGLE:', isCollapsed ? 'COLLAPSED' : 'EXPANDED');
                
                // Call global debug function if available
                if (window.debugLayout) {
                    setTimeout(() => window.debugLayout(), 100);
                }

                setTimeout(() => {
                    this.updateTooltip();
                    this.updateLinkTooltips(isCollapsed);
                }, 50);
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'b') {
                e.preventDefault();
                this.toggle();
            }
        });
    }

    /**
     * Apply collapse state to DOM
     */
    applyCollapseState() {
        if (window.innerWidth > 1024) {
            document.body.classList.toggle('sidebar-collapsed', this.collapsed);
            document.body.classList.toggle('amc-collapsed', this.collapsed); // legacy

            setTimeout(() => {
                this.updateTooltip();
                this.updateLinkTooltips(this.collapsed);
            }, 50);
        }
    }

    /**
     * Highlight active page
     */
    highlightActivePage() {
        const links = document.querySelectorAll('.sidebar-link');
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (href && (this.currentPage === href || window.location.pathname.endsWith(href))) {
                link.classList.add('active');
            }
        });
    }

    /**
     * Get stored collapse state from localStorage
     */
    getStoredCollapseState() {
        try {
            return localStorage.getItem('amc_sidebar_collapsed') === 'true' ||
                   localStorage.getItem('amcSidebarCollapsed') === 'true';
        } catch (e) {
            return false;
        }
    }

    /**
     * Toggle sidebar collapse state
     */
    toggle() {
        this.collapsed = !this.collapsed;
        this.applyCollapseState();
        localStorage.setItem('amc_sidebar_collapsed', this.collapsed.toString());
    }

    /**
     * Update tooltip text based on sidebar state
     */
    updateTooltip() {
        const isCollapsed = document.body.classList.contains('sidebar-collapsed') ||
                           document.body.classList.contains('amc-collapsed');
        
        // Update all tooltips including hamburger
        this.updateLinkTooltips(isCollapsed);
    }

    /**
     * Update link tooltips based on sidebar state - EXACT from sidebar.js
     */
    updateLinkTooltips(isCollapsed = (
        document.body.classList.contains('sidebar-collapsed') ||
        document.body.classList.contains('amc-collapsed')
    )) {
        const links = document.querySelectorAll('#sidebar .sidebar-link');
        
        // Clean up any existing tooltips
        this.cleanupTooltips();
        
        // ADD HAMBURGER TOOLTIP SUPPORT
        const hamburger = document.getElementById('sidebarToggle');
        if (hamburger) {
            // Remove existing hamburger listeners
            hamburger.removeEventListener('mouseenter', hamburger._tooltipMouseEnter);
            hamburger.removeEventListener('mouseleave', hamburger._tooltipMouseLeave);
            
            // Always show tooltip for hamburger (both expanded and collapsed)
            const hamburgerLabel = isCollapsed ? 'Expand sidebar' : 'Collapse sidebar';
            hamburger._tooltipMouseEnter = this.createTooltipMouseEnter(hamburgerLabel, true); // true = isHamburger
            hamburger._tooltipMouseLeave = this.createTooltipMouseLeave();
            
            hamburger.addEventListener('mouseenter', hamburger._tooltipMouseEnter);
            hamburger.addEventListener('mouseleave', hamburger._tooltipMouseLeave);
        }
        
        // Handle sidebar links (only when collapsed)
        links.forEach((link) => {
            const label = link.querySelector('.sidebar-text')?.textContent?.trim();
            
            // Remove existing event listeners
            link.removeEventListener('mouseenter', link._tooltipMouseEnter);
            link.removeEventListener('mouseleave', link._tooltipMouseLeave);
            
            if (isCollapsed && label) {
                // Create bound event handlers
                link._tooltipMouseEnter = this.createTooltipMouseEnter(label);
                link._tooltipMouseLeave = this.createTooltipMouseLeave();
                
                // Add event listeners
                link.addEventListener('mouseenter', link._tooltipMouseEnter);
                link.addEventListener('mouseleave', link._tooltipMouseLeave);
            }
        });
    }

    /**
     * Create tooltip mouse enter handler - EXACT from sidebar.js
     */
    createTooltipMouseEnter(label, isHamburger = false) {
        return (event) => {
            const element = event.currentTarget;
            const rect = element.getBoundingClientRect();
            
            // Create tooltip element
            const tooltip = document.createElement('div');
            tooltip.className = 'sidebar-tooltip';
            tooltip.textContent = label;
            
            // Calculate position based on element type
            let tooltipLeft, tooltipTop;
            
            if (isHamburger) {
                // Hamburger tooltip positioning
                const isCollapsed = document.body.classList.contains('sidebar-collapsed') ||
                                   document.body.classList.contains('amc-collapsed');
                
                if (isCollapsed) {
                    // Collapsed: Position to the right of hamburger
                    tooltipLeft = '80px';
                    tooltipTop = Math.max(80, rect.top + rect.height / 2 - 20) + 'px';
                } else {
                    // Expanded: Position to the right of hamburger
                    tooltipLeft = (rect.right + 10) + 'px';
                    tooltipTop = Math.max(80, rect.top + rect.height / 2 - 20) + 'px';
                }
            } else {
                // Sidebar link tooltip positioning (existing)
                tooltipLeft = '80px';
                tooltipTop = Math.max(80, rect.top + rect.height / 2 - 20) + 'px';
            }
            
            // Style the tooltip
            Object.assign(tooltip.style, {
                position: 'fixed',
                left: tooltipLeft,
                top: tooltipTop,
                background: document.body.classList.contains('dark-mode') ? '#374151' : '#ffffff',
                color: document.body.classList.contains('dark-mode') ? '#f9fafb' : '#1f2937',
                border: '1px solid ' + (document.body.classList.contains('dark-mode') ? '#4b5563' : '#e5e7eb'),
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '500',
                whiteSpace: 'nowrap',
                zIndex: '10000',
                pointerEvents: 'none',
                boxShadow: document.body.classList.contains('dark-mode')
                    ? '0 4px 12px rgba(0,0,0,0.25)'
                    : '0 4px 12px rgba(0,0,0,0.15)',
                opacity: '1'
            });
            
            // Add to body
            document.body.appendChild(tooltip);
            
            // Store reference on element
            element._currentTooltip = tooltip;
        };
    }

    /**
     * Create tooltip mouse leave handler
     */
    createTooltipMouseLeave() {
        return (event) => {
            const link = event.currentTarget;
            if (link._currentTooltip) {
                const tooltip = link._currentTooltip;
                
                if (tooltip.parentNode) {
                    tooltip.parentNode.removeChild(tooltip);
                }
                
                link._currentTooltip = null;
            }
        };
    }

    /**
     * COLLAPSIBLE SIDEBAR SECTIONS - EXACT FROM sidebar.js
     */
    initCollapsibleSections() {
        const sectionHeaders = document.querySelectorAll('#sidebar .sidebar-section-header');
        
        if (sectionHeaders.length === 0) {
            return false;
        }
        
        sectionHeaders.forEach((header, index) => {
            // Skip if already processed
            if (header.classList.contains('collapsible')) {
                return;
            }
            
            // Make header collapsible
            header.classList.add('collapsible');
            header.style.cursor = 'pointer';
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            
            // Add section identifier
            const sectionNames = ['core', 'management', 'analytics', 'admin'];
            const sectionName = sectionNames[index] || `section-${index}`;
            header.setAttribute('data-section', sectionName);
            
            // Add chevron icon with better visibility
            const chevron = document.createElement('i');
            chevron.className = 'fas fa-chevron-down section-toggle';
            chevron.style.fontSize = '13px';
            chevron.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            chevron.style.marginLeft = 'auto';
            chevron.style.opacity = '0.7';
            header.appendChild(chevron);

            // Chevron hover effect
            chevron.addEventListener('mouseenter', () => {
                chevron.style.opacity = '1';
                chevron.style.transform = header.classList.contains('collapsed')
                    ? 'rotate(-90deg) scale(1.1)'
                    : 'rotate(0deg) scale(1.1)';
            });

            chevron.addEventListener('mouseleave', () => {
                chevron.style.opacity = '0.7';
                chevron.style.transform = header.classList.contains('collapsed')
                    ? 'rotate(-90deg) scale(1)'
                    : 'rotate(0deg) scale(1)';
            });
            
            // Find the corresponding sidebar list
            const nextElement = header.nextElementSibling;
            if (nextElement && nextElement.classList.contains('sidebar-list')) {
                nextElement.setAttribute('data-section-content', sectionName);
                nextElement.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                nextElement.style.overflow = 'hidden';
            }
            
            // Add click handler
            header.addEventListener('click', () => {
                const section = header.dataset.section;
                const content = document.querySelector(`[data-section-content="${section}"]`);
                const chevronIcon = header.querySelector('.section-toggle');
                
                if (content && chevronIcon) {
                    const isCollapsed = header.classList.contains('collapsed');
                    
                    if (isCollapsed) {
                        // Expand
                        header.classList.remove('collapsed');
                        content.classList.remove('collapsed');
                        chevronIcon.style.transform = 'rotate(0deg)';
                        content.style.maxHeight = content.scrollHeight + 'px';
                        content.style.opacity = '1';
                        content.style.marginBottom = '14px';
                        content.style.paddingTop = '4px';
                    } else {
                        // Collapse
                        header.classList.add('collapsed');
                        content.classList.add('collapsed');
                        chevronIcon.style.transform = 'rotate(-90deg)';
                        content.style.maxHeight = '0';
                        content.style.opacity = '0';
                        content.style.marginBottom = '0';
                        content.style.paddingTop = '0';
                    }
                    
                    // Save state to localStorage
                    const collapsedSections = JSON.parse(localStorage.getItem('collapsedSections') || '[]');
                    if (header.classList.contains('collapsed')) {
                        if (!collapsedSections.includes(section)) {
                            collapsedSections.push(section);
                        }
                    } else {
                        const index = collapsedSections.indexOf(section);
                        if (index > -1) {
                            collapsedSections.splice(index, 1);
                        }
                    }
                    localStorage.setItem('collapsedSections', JSON.stringify(collapsedSections));
                    
                    // Dispatch custom event for section box updates
                    document.dispatchEvent(new CustomEvent('sectionToggled', {
                        detail: { section, isCollapsed: !isCollapsed }
                    }));
                }
            });
            
            // Add hover effect with transform lift
            header.addEventListener('mouseenter', () => {
                if (!header.classList.contains('collapsed')) {
                    header.style.background = 'rgba(0,0,0,0.10)';
                    header.style.transform = 'translateX(3px)';
                    header.style.paddingLeft = '13px';
                }
            });
            
            header.addEventListener('mouseleave', () => {
                header.style.background = '';
                header.style.transform = '';
                header.style.paddingLeft = '';
            });

            // Add active press effect
            header.addEventListener('mousedown', () => {
                header.style.transform = 'translateX(2px) scale(0.99)';
            });

            header.addEventListener('mouseup', () => {
                if (header.matches(':hover')) {
                    header.style.transform = 'translateX(3px)';
                } else {
                    header.style.transform = '';
                }
            });
        });
        
        // Restore collapsed state from localStorage
        const collapsedSections = JSON.parse(localStorage.getItem('collapsedSections') || '[]');
        collapsedSections.forEach(section => {
            const header = document.querySelector(`[data-section="${section}"]`);
            const content = document.querySelector(`[data-section-content="${section}"]`);
            const chevronIcon = header?.querySelector('.section-toggle');
            
            if (header && content && chevronIcon) {
                header.classList.add('collapsed');
                content.classList.add('collapsed');
                chevronIcon.style.transform = 'rotate(-90deg)';
                content.style.maxHeight = '0';
                content.style.opacity = '0';
                content.style.marginBottom = '0';
                content.style.paddingTop = '0';
            }
        });
        
        return true;
    }

    /**
     * COLLAPSED SIDEBAR: ELEGANT COLORED SECTION BARS - EXACT FROM sidebar.js
     */
    initCollapsedSectionBars() {
        const sidebar = document.getElementById('sidebar');
        const sections = sidebar?.querySelectorAll('.sidebar-section');
        
        if (!sidebar || !sections || sections.length === 0) {
            return false;
        }
        
        const sectionNames = ['core', 'management', 'analytics', 'admin'];
        const sectionTitles = {
            'core': 'Core',
            'management': 'Management',
            'analytics': 'Analytics',
            'admin': 'Admin'
        };
        
        sections.forEach((section, index) => {
            const sectionName = sectionNames[index] || `section-${index}`;
            
            let collapsedBar = section.querySelector('.collapsed-section-bar');
            if (!collapsedBar) {
                collapsedBar = document.createElement('div');
                collapsedBar.className = 'collapsed-section-bar';
                collapsedBar.setAttribute('data-section', sectionName);
                
                // Store title for tooltip
                collapsedBar.title = sectionTitles[sectionName] || sectionName.charAt(0).toUpperCase() + sectionName.slice(1);
                
                section.insertBefore(collapsedBar, section.firstChild);
                
                // Click handler
                collapsedBar.addEventListener('click', () => {
                    const sectionHeader = section.querySelector('.sidebar-section-header');
                    const sectionList = section.querySelector('.sidebar-list');
                    
                    if (sectionHeader && sectionList) {
                        const isCurrentlyCollapsed = sectionHeader.classList.contains('collapsed');
                        
                        if (isCurrentlyCollapsed) {
                            // Expand
                            sectionHeader.classList.remove('collapsed');
                            sectionList.classList.remove('collapsed');
                            sectionList.style.maxHeight = sectionList.scrollHeight + 'px';
                            sectionList.style.opacity = '1';
                            sectionList.style.marginBottom = '14px';
                            sectionList.style.paddingTop = '4px';
                            collapsedBar.classList.add('expanded');
                            
                            const chevron = sectionHeader.querySelector('.section-toggle');
                            if (chevron) chevron.style.transform = 'rotate(0deg)';
                        } else {
                            // Collapse
                            sectionHeader.classList.add('collapsed');
                            sectionList.classList.add('collapsed');
                            sectionList.style.maxHeight = '0';
                            sectionList.style.opacity = '0';
                            sectionList.style.marginBottom = '0';
                            sectionList.style.paddingTop = '0';
                            collapsedBar.classList.remove('expanded');
                            
                            const chevron = sectionHeader.querySelector('.section-toggle');
                            if (chevron) chevron.style.transform = 'rotate(-90deg)';
                        }
                        
                        // Save state
                        const collapsedSections = JSON.parse(localStorage.getItem('collapsedSections') || '[]');
                        if (sectionHeader.classList.contains('collapsed')) {
                            if (!collapsedSections.includes(sectionName)) {
                                collapsedSections.push(sectionName);
                            }
                        } else {
                            const index = collapsedSections.indexOf(sectionName);
                            if (index > -1) {
                                collapsedSections.splice(index, 1);
                            }
                        }
                        localStorage.setItem('collapsedSections', JSON.stringify(collapsedSections));
                        
                        document.dispatchEvent(new CustomEvent('sectionToggled', {
                            detail: { section: sectionName, isCollapsed: !isCurrentlyCollapsed }
                        }));
                    }
                });
                
                // Add tooltip events
                collapsedBar.addEventListener('mouseenter', (e) => {
                    if (document.body.classList.contains('amc-collapsed') ||
                        document.body.classList.contains('sidebar-collapsed')) {
                        this.showBarTooltip(e.target, collapsedBar.title);
                    }
                });
                
                collapsedBar.addEventListener('mouseleave', () => {
                    this.hideBarTooltips();
                });
            }
        });
        
        // Update bar states based on current section states
        this.updateSectionBarStates();
        
        return true;
    }

    /**
     * Show tooltip for collapsed section bar
     */
    showBarTooltip(element, text) {
        this.hideBarTooltips(); // Remove any existing tooltips
        
        const tooltip = document.createElement('div');
        tooltip.className = 'sidebar-tooltip';
        tooltip.textContent = text;
        document.body.appendChild(tooltip);
        
        const rect = element.getBoundingClientRect();
        
        tooltip.style.position = 'fixed';
        tooltip.style.left = `${rect.right + 10}px`;
        tooltip.style.top = `${rect.top + (rect.height - tooltip.getBoundingClientRect().height) / 2}px`;
        tooltip.style.zIndex = '10000';
    }

    /**
     * Hide all bar tooltips
     */
    hideBarTooltips() {
        document.querySelectorAll('.sidebar-tooltip').forEach(tooltip => {
            tooltip.remove();
        });
    }

    /**
     * Update section bar states based on current collapsed sections
     */
    updateSectionBarStates() {
        const collapsedSections = JSON.parse(localStorage.getItem('collapsedSections') || '[]');
        const sectionNames = ['core', 'management', 'analytics', 'admin'];
        
        sectionNames.forEach(sectionName => {
            const collapsedBar = document.querySelector(`[data-section="${sectionName}"].collapsed-section-bar`);
            if (collapsedBar) {
                const isExpanded = !collapsedSections.includes(sectionName);
                collapsedBar.classList.toggle('expanded', isExpanded);
            }
        });
    }

    /**
     * Bind analytics event listeners
     */
    bindAnalyticsEvents() {
        // Track sidebar link clicks
        document.querySelectorAll('.sidebar-link').forEach(link => {
            link.addEventListener('click', () => {
                const label = link.querySelector('.sidebar-text')?.textContent?.trim() || 'Unknown';
                if (window.amcAnalytics) {
                    window.amcAnalytics.log('sidebar', 'click', label);
                }
            });
        });
    }

    /**
     * Refresh sidebar (useful after role changes)
     */
    refresh(newUserRole = null) {
        if (newUserRole) {
            this.userRole = newUserRole;
        }
        this.cleanupTooltips();
        this.render();
        this.bindEvents();
        this.applyCollapseState();
        this.highlightActivePage();
        this.bindAnalyticsEvents();
        this.updateTooltip();
        
        // Re-initialize collapsible sections
        setTimeout(() => {
            this.initCollapsibleSections();
            this.initCollapsedSectionBars();
        }, 100);
    }

    /**
     * Public API methods
     */
    setUserRole(role) {
        this.userRole = role;
        this.refresh();
    }

    addBadge(itemHref, badgeConfig) {
        // Find item in config and add badge
        this.sidebarConfig.forEach(section => {
            section.items.forEach(item => {
                if (item.href === itemHref) {
                    item.badge = badgeConfig;
                }
            });
        });
        this.refresh();
    }

    removeBadge(itemHref) {
        // Find item in config and remove badge
        this.sidebarConfig.forEach(section => {
            section.items.forEach(item => {
                if (item.href === itemHref) {
                    item.badge = null;
                }
            });
        });
        this.refresh();
    }
}

/**
 * Auto-initialize sidebar if container exists
 */
document.addEventListener('DOMContentLoaded', () => {
    const sidebarContainer = document.querySelector('#sidebar');
    if (sidebarContainer) {
        // Wait a bit for amc-role.js to initialize if it's loaded
        setTimeout(() => {
            // Get user role using the same robust logic as amc-role.js
            let userRole = 'media_user'; // Same default as amc-role.js
            
            try {
                // PRIORITY 1: Use AMC.role if available (set by amc-role.js)
                if (window.AMC && window.AMC.role) {
                    userRole = window.AMC.role;
                    console.log('🎯 AMC Sidebar Auto-Init: Using AMC.role:', userRole);
                } else {
                    // PRIORITY 2: Use same detection logic as amc-role.js
                    const sessionRole = sessionStorage.getItem("amcRoleOverride");
                    if (sessionRole) {
                        userRole = sessionRole;
                        console.log('🎯 AMC Sidebar Auto-Init: Using session override:', userRole);
                    } else {
                        // Use the same localStorage detection as amc-role.js
                        const ROLE_KEYS = ["role", "userRole"];
                        const USER_KEYS = ["user", "currentUser"];
                        let foundRole = null;

                        for (const key of USER_KEYS) {
                            try {
                                const raw = localStorage.getItem(key);
                                if (!raw) continue;
                                const u = JSON.parse(raw);
                                for (const rk of ROLE_KEYS) {
                                    if (u && u[rk]) {
                                        foundRole = u[rk];
                                        console.log(`🎯 AMC Sidebar Auto-Init: Found role "${foundRole}" in localStorage.${key}.${rk}`);
                                        break;
                                    }
                                }
                                if (foundRole) break;
                                if (Array.isArray(u?.roles) && u.roles[0]) {
                                    foundRole = u.roles[0];
                                    console.log(`🎯 AMC Sidebar Auto-Init: Found role "${foundRole}" in localStorage.${key}.roles[0]`);
                                    break;
                                }
                            } catch (e) {
                                console.warn(`🎯 AMC Sidebar Auto-Init: Error parsing localStorage.${key}:`, e);
                            }
                        }
                        
                        if (foundRole) {
                            userRole = foundRole;
                        } else {
                            console.log('🎯 AMC Sidebar Auto-Init: No role found, using media_user default (same as amc-role.js)');
                        }
                    }
                }
            } catch (e) {
                console.warn('[AMCSidebar] Could not determine user role, using media_user default:', e);
                userRole = 'media_user';
            }

            // Initialize sidebar
            window.amcSidebar = new AMCSidebar({
                container: '#sidebar',
                userRole: userRole
            });
            
            console.log('✅ AMC Sidebar Auto-Init: Initialized with role-based functionality using robust role detection');
        }, 100); // Small delay to allow amc-role.js to initialize
    }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AMCSidebar;
}