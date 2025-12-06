/**
 * AMC MODULAR SIDEBAR COMPONENT
 * Exact match to existing sidebar.js functionality
 * Provides sidebar functionality for #sidebar element
 * NO MAIN CONTENT INTERFERENCE - SIDEBAR ONLY
 */

// Sidebar data structure matching existing pages
const sidebarData = {
    sections: [
        {
            id: 'core',
            title: 'Core',
            items: [
                { id: 'dashboard', icon: 'fas fa-tachometer-alt', label: 'Dashboard', href: 'index.html' },
                { id: 'releases', icon: 'fas fa-list-alt', label: 'Manage Releases', href: 'manage_releases.html' },
                { id: 'radar', icon: 'fas fa-satellite-dish', label: 'Radar Alerts', href: 'radar_history_clean.html' },
                { id: 'upload', icon: 'fas fa-upload', label: 'Upload Content', href: 'AssetDBmenu1.6.html' }
            ]
        },
        {
            id: 'management',
            title: 'Management',
            items: [
                { id: 'analytics', icon: 'fas fa-chart-bar', label: 'Analytics', href: 'amc-analytics.html' },
                { id: 'users', icon: 'fas fa-users', label: 'User Management', href: 'user-management.html' },
                { id: 'companies', icon: 'fas fa-building', label: 'Companies', href: 'company-portal.html' }
            ]
        },
        {
            id: 'analytics',
            title: 'Analytics',
            items: [
                { id: 'reports', icon: 'fas fa-file-alt', label: 'Reports', href: '#' },
                { id: 'insights', icon: 'fas fa-lightbulb', label: 'Insights', href: '#' },
                { id: 'trends', icon: 'fas fa-trending-up', label: 'Trends', href: '#' }
            ]
        },
        {
            id: 'admin',
            title: 'Admin',
            items: [
                { id: 'settings', icon: 'fas fa-cog', label: 'Settings', href: '#' },
                { id: 'system', icon: 'fas fa-server', label: 'System Check', href: 'amc-system-check3.html' },
                { id: 'logs', icon: 'fas fa-file-text', label: 'Logs', href: '#' }
            ]
        }
    ]
};

class AMCSidebar {
    constructor() {
        this.isCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
        this.activeItem = null;
        this.sidebarElement = null;
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        this.sidebarElement = document.getElementById('sidebar');
        if (!this.sidebarElement) {
            console.warn('Sidebar element #sidebar not found');
            return;
        }

        this.render();
        this.setupEventListeners();
        this.updateBodyClass();
        this.setActiveItem();
        
        console.log('AMC Modular Sidebar initialized');
    }

    render() {
        if (!this.sidebarElement) return;

        // Create sidebar structure
        const sidebarHTML = `
            <div class="sidebar-header">
                <button id="sidebarToggle" aria-label="Toggle sidebar">
                    <div class="hamburger"></div>
                </button>
            </div>
            <div class="sidebar-content">
                ${this.renderSections()}
            </div>
        `;

        this.sidebarElement.innerHTML = sidebarHTML;
    }

    renderSections() {
        return sidebarData.sections.map(section => {
            const collapsedBar = `
                <div class="collapsed-section-bar" data-section="${section.id}">
                    <span class="section-indicator"></span>
                </div>
            `;

            const sectionContent = `
                <div class="sidebar-section" data-section="${section.id}">
                    ${collapsedBar}
                    <div class="sidebar-section-header">
                        <span class="section-title">${section.title}</span>
                        <i class="section-toggle fas fa-chevron-down"></i>
                    </div>
                    <ul class="sidebar-list">
                        ${section.items.map(item => this.renderItem(item)).join('')}
                    </ul>
                </div>
            `;

            return sectionContent;
        }).join('');
    }

    renderItem(item) {
        const isActive = this.isItemActive(item);
        const activeClass = isActive ? 'active' : '';

        return `
            <li class="sidebar-item">
                <a href="${item.href}" class="sidebar-link ${activeClass}" data-item="${item.id}">
                    <span class="i"><i class="${item.icon}"></i></span>
                    <span class="t">${item.label}</span>
                </a>
            </li>
        `;
    }

    isItemActive(item) {
        const currentPath = window.location.pathname;
        const currentFile = currentPath.split('/').pop() || 'index.html';
        const itemFile = item.href.split('/').pop();
        
        return currentFile === itemFile || 
               (currentFile === '' && itemFile === 'index.html') ||
               (currentPath.includes(item.id));
    }

    setupEventListeners() {
        // Toggle button
        const toggleButton = this.sidebarElement?.querySelector('#sidebarToggle');
        if (toggleButton) {
            toggleButton.addEventListener('click', () => this.toggle());
        }

        // Section toggles
        const sectionHeaders = this.sidebarElement?.querySelectorAll('.sidebar-section-header');
        sectionHeaders?.forEach(header => {
            header.addEventListener('click', (e) => {
                const section = e.currentTarget.closest('.sidebar-section');
                this.toggleSection(section);
            });
        });

        // Collapsed section bars
        const collapsedBars = this.sidebarElement?.querySelectorAll('.collapsed-section-bar');
        collapsedBars?.forEach(bar => {
            bar.addEventListener('click', (e) => {
                const sectionId = e.currentTarget.dataset.section;
                this.expandSection(sectionId);
            });
        });

        // Sidebar links
        const sidebarLinks = this.sidebarElement?.querySelectorAll('.sidebar-link');
        sidebarLinks?.forEach(link => {
            link.addEventListener('click', (e) => {
                this.setActiveLink(e.currentTarget);
            });
        });

        // Window resize handler
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }

    toggle() {
        this.isCollapsed = !this.isCollapsed;
        localStorage.setItem('sidebar-collapsed', this.isCollapsed.toString());
        this.updateBodyClass();
        
        // Emit custom event
        document.dispatchEvent(new CustomEvent('sidebar-toggled', {
            detail: { collapsed: this.isCollapsed }
        }));
    }

    collapse() {
        if (!this.isCollapsed) {
            this.toggle();
        }
    }

    expand() {
        if (this.isCollapsed) {
            this.toggle();
        }
    }

    updateBodyClass() {
        if (this.isCollapsed) {
            document.body.classList.add('sidebar-collapsed', 'amc-collapsed');
        } else {
            document.body.classList.remove('sidebar-collapsed', 'amc-collapsed');
        }
    }

    toggleSection(sectionElement) {
        if (!sectionElement) return;

        const header = sectionElement.querySelector('.sidebar-section-header');
        const list = sectionElement.querySelector('.sidebar-list');
        const toggle = sectionElement.querySelector('.section-toggle');

        if (header && list && toggle) {
            const isCollapsed = header.classList.contains('collapsed');
            
            if (isCollapsed) {
                header.classList.remove('collapsed');
                list.style.maxHeight = list.scrollHeight + 'px';
                toggle.style.transform = 'rotate(0deg)';
            } else {
                header.classList.add('collapsed');
                list.style.maxHeight = '0';
                toggle.style.transform = 'rotate(-90deg)';
            }
        }
    }

    expandSection(sectionId) {
        const section = this.sidebarElement?.querySelector(`[data-section="${sectionId}"]`);
        if (section) {
            const header = section.querySelector('.sidebar-section-header');
            const list = section.querySelector('.sidebar-list');
            const toggle = section.querySelector('.section-toggle');

            if (header && list && toggle) {
                header.classList.remove('collapsed');
                list.style.maxHeight = list.scrollHeight + 'px';
                toggle.style.transform = 'rotate(0deg)';
            }
        }
    }

    setActiveItem() {
        const currentPath = window.location.pathname;
        const currentFile = currentPath.split('/').pop() || 'index.html';
        
        // Remove all active classes
        const allLinks = this.sidebarElement?.querySelectorAll('.sidebar-link');
        allLinks?.forEach(link => link.classList.remove('active'));

        // Find and set active link
        const activeLink = Array.from(allLinks || []).find(link => {
            const href = link.getAttribute('href');
            const linkFile = href?.split('/').pop();
            return linkFile === currentFile || 
                   (currentFile === '' && linkFile === 'index.html');
        });

        if (activeLink) {
            activeLink.classList.add('active');
            this.activeItem = activeLink.dataset.item;
        }
    }

    setActiveLink(linkElement) {
        // Remove all active classes
        const allLinks = this.sidebarElement?.querySelectorAll('.sidebar-link');
        allLinks?.forEach(link => link.classList.remove('active'));

        // Set active class
        linkElement.classList.add('active');
        this.activeItem = linkElement.dataset.item;
    }

    handleResize() {
        // Auto-collapse on mobile
        if (window.innerWidth < 768 && !this.isCollapsed) {
            this.collapse();
        }
    }

    // Public API methods
    getActiveItem() {
        return this.activeItem;
    }

    isCollapsedState() {
        return this.isCollapsed;
    }

    updateSidebarData(newData) {
        sidebarData.sections = newData.sections;
        this.render();
        this.setupEventListeners();
        this.setActiveItem();
    }

    // Role-based filtering
    filterByRole(role) {
        const rolePermissions = {
            'media_user': ['core'],
            'client_user': ['core', 'management'],
            'client_admin': ['core', 'management', 'analytics'],
            'platform_admin': ['core', 'management', 'analytics', 'admin']
        };

        const allowedSections = rolePermissions[role] || ['core'];
        
        // Filter sections based on role
        const filteredData = {
            sections: sidebarData.sections.filter(section => 
                allowedSections.includes(section.id)
            )
        };

        this.updateSidebarData(filteredData);
    }
}

// Initialize sidebar when DOM is ready
let sidebarInstance = null;

function initSidebar() {
    if (!sidebarInstance) {
        sidebarInstance = new AMCSidebar();
    }
    return sidebarInstance;
}

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSidebar);
} else {
    initSidebar();
}

// Global functions for compatibility
window.buildSidebar = function(element) {
    if (element && element.id === 'sidebar') {
        initSidebar();
    }
};

window.initSidebar = function(element) {
    if (element && element.id === 'sidebar') {
        initSidebar();
    }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AMCSidebar, initSidebar };
}

// Global availability
window.AMCSidebar = AMCSidebar;
window.sidebarInstance = sidebarInstance;

console.log('AMC Modular Sidebar component loaded');