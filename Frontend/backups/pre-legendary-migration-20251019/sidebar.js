/* ============================================================
   AutoMediaCenter - Enterprise Sidebar Component
   Modular JavaScript for dynamic sidebar generation
   ============================================================ */

/**
 * Enterprise Sidebar System
 * Features: Role-based rendering, dynamic badges, search, tooltips
 */
class AMCSidebar {
  constructor(options = {}) {
    this.container = options.container || '#sidebar';
    this.userRole = options.userRole || 'media_user';
    this.currentPage = options.currentPage || this.getCurrentPage();
    this.collapsed = this.getStoredCollapseState();
    
    // Sidebar configuration with enterprise features
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
            badge: { text: "BETA", type: "warning" }
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
            href: "radar_history_enterprise.html",
            icon: "fas fa-history",
            roles: ["client_user", "client_admin", "platform_admin"],
            badge: null
          },
          {
            label: "Manage Live Events",
            href: "manage_live.html",
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
            badge: { text: "NEW", type: "success" }
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
            badge: { text: "3", type: "info" }
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
            label: "Platform Admin Dashboard",
            href: "platform-admin-dashboard.html",
            icon: "fas fa-tachometer-alt",
            roles: ["platform_admin"],
            badge: { text: "NEW", type: "success" }
          },
          {
            label: "User Management",
            href: "user_management.html",
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
   * Track analytics events
   */
  trackEvent(action, label) {
    if (window.amcAnalytics) {
      window.amcAnalytics.log('sidebar', action, label);
    }
    // Fallback console logging for development
    console.log(`[AMCSidebar Analytics] ${action}: ${label}`);
  }

  /**
   * Initialize the sidebar
   */
  init() {
    this.cleanupTooltips(); // Clean up any existing tooltips
    this.render();
    this.bindEvents();
    this.applyCollapseState();
    this.highlightActivePage();
    this.bindAnalyticsEvents();
  }

  /**
   * Clean up any existing tooltip elements
   */
  cleanupTooltips() {
    document.querySelectorAll('.amc-sidebar-tooltip').forEach(tooltip => {
      tooltip.remove();
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
        this.trackEvent('click', label);
      });
    });

    // Track collapse/expand actions
    const toggleBtn = document.getElementById('sidebarToggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this.trackEvent('toggle', this.collapsed ? 'expand' : 'collapse');
      });
    }
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
    const badge = item.badge ? this.generateBadgeHTML(item.badge) : '';
    
    return `
      <li class="sidebar-item">
        <a href="${item.href}" class="sidebar-link${activeClass}">
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
   * Bind event listeners with real-time refresh hooks
   */
  bindEvents() {
    // Toggle button - SINGLE SOURCE OF TRUTH WITH DEBUG
    const toggleBtn = document.getElementById('sidebarToggle');
    console.log('[AMCSidebar] Toggle button found:', !!toggleBtn);
    
    if (toggleBtn) {
      // Ensure starting tooltip matches state
      this.updateTooltip();
      this.updateLinkTooltips(this.collapsed);
      
      console.log('[AMCSidebar] Initial tooltip set:', toggleBtn.getAttribute('data-tooltip'));

      toggleBtn.addEventListener('click', () => {
        console.log('[AMCSidebar] Toggle clicked');
        document.body.classList.toggle('sidebar-collapsed');
        document.body.classList.toggle('amc-collapsed'); // legacy support

        // Reflow for animation smoothness
        document.getElementById('sidebar')?.getBoundingClientRect();

        const isCollapsed = document.body.classList.contains('sidebar-collapsed');
        localStorage.setItem('amc_sidebar_collapsed', isCollapsed.toString());
        this.collapsed = isCollapsed;

        console.log('[AMCSidebar] New collapsed state:', isCollapsed);

        // Keep UX in sync - wait for animation to complete
        setTimeout(() => {
          this.updateTooltip();
          this.updateLinkTooltips(isCollapsed);
        }, 50); // Small delay to ensure DOM is updated
        
        console.log('[AMCSidebar] Updated tooltip:', toggleBtn.getAttribute('data-tooltip'));
      });
    } else {
      console.error('[AMCSidebar] Toggle button not found! Sidebar may not be rendered yet.');
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        this.toggle();
      }
    });

    // Close on mobile overlay click
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 1024 &&
          !e.target.closest('.amc-sidebar') &&
          document.body.classList.contains('sidebar-open')) {
        this.close();
      }
    });

    // 👇 NEW: Real-time refresh hooks
    // Window resize handler
    window.addEventListener('resize', () => this.applyCollapseState());
    
    // Storage event handler for real-time updates
    window.addEventListener('storage', (e) => {
      if (['user', 'currentUser', 'amc_sidebar_collapsed'].includes(e.key)) {
        console.log('[AMCSidebar] Storage change detected, refreshing sidebar');
        this.refresh();
      }
    });
  }

  /**
   * Toggle sidebar collapse state
   */
  toggle() {
    this.collapsed = !this.collapsed;
    this.applyCollapseState();
    this.storeCollapseState();
  }

  /**
   * Open sidebar (mobile) with smooth animation
   */
  open() {
    document.body.classList.add('sidebar-open', 'sidebar-slide-in');
    this.trackEvent('mobile_open', 'sidebar');
  }

  /**
   * Close sidebar (mobile) with smooth animation
   */
  close() {
    document.body.classList.remove('sidebar-open', 'sidebar-slide-in');
    this.trackEvent('mobile_close', 'sidebar');
  }

  /**
   * Apply collapse state to DOM with smooth animations
   */
  applyCollapseState() {
    if (window.innerWidth > 1024) {
      document.body.classList.toggle('sidebar-collapsed', this.collapsed);
      document.body.classList.toggle('amc-collapsed', this.collapsed); // legacy

      // FIXED: Force immediate visibility restoration when expanding
      const labels = document.querySelectorAll('.sidebar-text, .sidebar-section-header');
      labels.forEach(el => {
        if (this.collapsed) {
          // Collapsing: animate out
          el.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
          el.style.opacity = '0';
          el.style.transform = 'translateX(-8px)';
          el.style.pointerEvents = 'none';
        } else {
          // Expanding: force immediate restoration
          el.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
          el.style.opacity = '1';
          el.style.transform = 'translateX(0)';
          el.style.pointerEvents = 'auto';
          
          // Force reflow to ensure styles are applied
          el.offsetHeight;
        }
      });

      // Keep tooltips + toggle text in sync - wait for animation
      setTimeout(() => {
        this.updateTooltip();
        this.updateLinkTooltips(this.collapsed);
      }, 50); // Reduced delay for better responsiveness
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
      // Check both new and legacy keys
      return localStorage.getItem('amc_sidebar_collapsed') === 'true' ||
             localStorage.getItem('amcSidebarCollapsed') === 'true';
    } catch (e) {
      return false;
    }
  }

  /**
   * Store collapse state in localStorage
   */
  storeCollapseState() {
    try {
      localStorage.setItem('amc_sidebar_collapsed', this.collapsed.toString());
      // Also store in legacy key for compatibility
      localStorage.setItem('amcSidebarCollapsed', this.collapsed.toString());
    } catch (e) {
      console.warn('[AMCSidebar] Could not store collapse state');
    }
  }

  /**
   * Update badge for specific item
   */
  updateBadge(href, badge) {
    const link = document.querySelector(`a[href="${href}"]`);
    if (link) {
      const existingBadge = link.querySelector('.sidebar-badge');
      if (existingBadge) {
        existingBadge.remove();
      }
      
      if (badge) {
        const badgeHTML = this.generateBadgeHTML(badge);
        link.insertAdjacentHTML('beforeend', badgeHTML);
      }
    }
  }

  /**
   * Update tooltip text based on sidebar state
   */
  updateTooltip() {
    const toggleBtn = document.getElementById('sidebarToggle');
    console.log('[AMCSidebar] updateTooltip - button found:', !!toggleBtn);
    
    if (toggleBtn) {
      const collapsed = document.body.classList.contains('sidebar-collapsed');
      const tooltipText = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
      toggleBtn.setAttribute('data-tooltip', tooltipText);
      toggleBtn.setAttribute('aria-label', tooltipText);
      
      console.log('[AMCSidebar] updateTooltip - set to:', tooltipText);
      console.log('[AMCSidebar] updateTooltip - attribute value:', toggleBtn.getAttribute('data-tooltip'));
    } else {
      console.error('[AMCSidebar] updateTooltip - toggle button not found!');
    }
  }

  /**
   * Update link tooltips based on sidebar state with JavaScript tooltip elements
   */
  updateLinkTooltips(isCollapsed = (
    document.body.classList.contains('sidebar-collapsed') ||
    document.body.classList.contains('amc-collapsed')
  )) {
    const links = document.querySelectorAll('#sidebar .sidebar-link');
    console.log('[AMCSidebar] updateLinkTooltips - found links:', links.length, 'collapsed:', isCollapsed);
    
    // Clean up any existing tooltips
    this.cleanupTooltips();
    
    links.forEach((link, index) => {
      const label = link.querySelector('.sidebar-text')?.textContent?.trim();
      console.log(`[AMCSidebar] Link ${index} label:`, label);
      
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
        
        console.log(`[AMCSidebar] Set JS tooltip for link ${index}:`, label);
      }
    });
  }

  /**
   * Create tooltip mouse enter handler
   */
  createTooltipMouseEnter(label) {
    return (event) => {
      const link = event.currentTarget;
      const rect = link.getBoundingClientRect();
      
      // Create tooltip element
      const tooltip = document.createElement('div');
      tooltip.className = 'amc-sidebar-tooltip';
      tooltip.textContent = label;
      tooltip.id = 'amc-tooltip-' + Date.now();
      
      // Style the tooltip
      Object.assign(tooltip.style, {
        position: 'fixed',
        left: '80px', // Just outside collapsed sidebar
        top: Math.max(80, rect.top + rect.height / 2 - 20) + 'px',
        background: document.body.classList.contains('dark-mode') ? '#374151' : '#ffffff',
        color: document.body.classList.contains('dark-mode') ? '#f9fafb' : '#1f2937',
        border: '1px solid ' + (document.body.classList.contains('dark-mode') ? '#4b5563' : '#e5e7eb'),
        padding: '8px 12px',
        borderRadius: '6px',
        fontSize: '13px',
        fontWeight: '500',
        whiteSpace: 'nowrap',
        zIndex: '99999',
        pointerEvents: 'none',
        boxShadow: document.body.classList.contains('dark-mode')
          ? '0 4px 12px rgba(0,0,0,0.25)'
          : '0 4px 12px rgba(0,0,0,0.15)',
        opacity: '0',
        transform: 'translateX(-4px)',
        transition: 'opacity 0.2s ease-out, transform 0.2s ease-out'
      });
      
      // Add to body
      document.body.appendChild(tooltip);
      
      // Trigger animation
      requestAnimationFrame(() => {
        tooltip.style.opacity = '1';
        tooltip.style.transform = 'translateX(0)';
      });
      
      // Store reference on link
      link._currentTooltip = tooltip;
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
        tooltip.style.opacity = '0';
        tooltip.style.transform = 'translateX(-4px)';
        
        setTimeout(() => {
          if (tooltip.parentNode) {
            tooltip.parentNode.removeChild(tooltip);
          }
        }, 200);
        
        link._currentTooltip = null;
      }
    };
  }

  /**
   * Refresh sidebar (useful after role changes)
   */
  refresh(newUserRole = null) {
    if (newUserRole) {
      this.userRole = newUserRole;
    }
    this.cleanupTooltips(); // Clean up before refresh
    this.render();
    this.bindEvents();
    this.applyCollapseState();
    this.highlightActivePage();
    this.bindAnalyticsEvents(); // Re-bind analytics after refresh
    this.updateTooltip(); // Update tooltip after refresh
  }
}

/**
 * Auto-initialize sidebar if container exists
 */
document.addEventListener('DOMContentLoaded', () => {
  const sidebarContainer = document.querySelector('#sidebar');
  if (sidebarContainer) {
    // Get user role from auth system
    let userRole = 'media_user';
    try {
      const user = JSON.parse(localStorage.getItem('user') || localStorage.getItem('currentUser') || '{}');
      userRole = user.role || 'media_user';
    } catch (e) {
      console.warn('[AMCSidebar] Could not parse user role, defaulting to media_user');
    }

    // Initialize sidebar
    window.amcSidebar = new AMCSidebar({
      container: '#sidebar',
      userRole: userRole
    });
  }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AMCSidebar;
}
