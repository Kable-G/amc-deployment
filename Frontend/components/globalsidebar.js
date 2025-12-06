/**
 * AutoMediaCenter Global Sidebar Component
 * Enhanced sidebar with badge support, tooltips, and state management
 */

import { sidebarMenuData, badgeConfig, roleLabels } from './globalsidebardata.js';

export class GlobalSidebar {
  constructor({ container, role, currentPage, onRoleChange }) {
    this.container = document.querySelector(container);
    this.role = role || this.detectUserRole();
    this.currentPage = currentPage || this.getCurrentPage();
    this.onRoleChange = onRoleChange;
    this.menuData = sidebarMenuData[this.role] || sidebarMenuData['media_user'];
    
    if (!this.container) {
      console.error('GlobalSidebar: Container not found');
      return;
    }
    
    this.init();
  }

  init() {
    this.restoreState();
    this.render();
    this.bindEvents();
    this.setupResizeObserver();
  }

  detectUserRole() {
    // Try to get role from localStorage, token, or default
    const storedRole = localStorage.getItem('amc_user_role');
    if (storedRole && sidebarMenuData[storedRole]) {
      return storedRole;
    }
    
    // Try to extract from JWT token if available
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.user && payload.user.role) {
          return payload.user.role;
        }
      } catch (e) {
        console.warn('Could not parse token for role detection');
      }
    }
    
    return 'media_user'; // Default fallback
  }

  getCurrentPage() {
    const path = window.location.pathname;
    return path.split('/').pop() || 'index.html';
  }

  restoreState() {
    const collapsed = localStorage.getItem('amc_sidebar_collapsed') === 'true';
    if (collapsed) {
      document.body.classList.add('amc-collapsed');
    }
  }

  render() {
    const roleLabel = roleLabels[this.role] || 'User';
    
    const html = `
      <div class="sidebar-header">
        <div class="sidebar-brand">
          <i class="fas fa-car-side"></i>
          <span class="brand-text">AMC</span>
        </div>
        <button id="sidebarToggle" class="sidebar-toggle" title="Toggle sidebar">
          <i class="fas fa-bars"></i>
        </button>
      </div>
      
      <div class="sidebar-user-info">
        <div class="user-role-badge" data-role="${this.role}">
          ${roleLabel}
        </div>
      </div>
      
      <nav class="sidebar-nav">
        <ul class="sidebar-menu">
          ${this.renderMenuItems()}
        </ul>
      </nav>
      
      <div class="sidebar-footer">
        <div class="sidebar-version">v2.1.0</div>
      </div>
    `;
    
    this.container.innerHTML = html;
  }

  renderMenuItems() {
    return this.menuData.map(item => {
      if (item.divider) {
        return '<li class="sidebar-divider"><hr></li>';
      }
      
      const isActive = item.page === this.currentPage;
      const badge = item.badge ? this.renderBadge(item.badge) : '';
      
      return `
        <li class="sidebar-item ${isActive ? 'active' : ''}" data-page="${item.page}">
          <a href="${item.page}" class="sidebar-link" title="${item.description || item.label}">
            <span class="sidebar-icon">
              <i class="${item.icon}"></i>
            </span>
            <span class="sidebar-label">${item.label}</span>
            ${badge}
          </a>
        </li>
      `;
    }).join('');
  }

  renderBadge(badgeType) {
    const config = badgeConfig[badgeType];
    if (!config) return '';
    
    return `
      <span class="sidebar-badge" style="background-color: ${config.color}">
        ${config.text}
      </span>
    `;
  }

  bindEvents() {
    this.bindToggleEvent();
    this.bindMenuEvents();
    this.bindTooltipEvents();
  }

  bindToggleEvent() {
    const toggle = this.container.querySelector('#sidebarToggle');
    if (toggle) {
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleSidebar();
      });
    }
  }

  bindMenuEvents() {
    const menuItems = this.container.querySelectorAll('.sidebar-item a');
    menuItems.forEach(link => {
      link.addEventListener('click', (e) => {
        // Remove active class from all items
        this.container.querySelectorAll('.sidebar-item').forEach(item => {
          item.classList.remove('active');
        });
        
        // Add active class to clicked item
        const parentItem = link.closest('.sidebar-item');
        if (parentItem) {
          parentItem.classList.add('active');
        }
        
        // Update current page
        this.currentPage = link.getAttribute('href');
      });
    });
  }

  bindTooltipEvents() {
    const menuItems = this.container.querySelectorAll('.sidebar-link');
    menuItems.forEach(link => {
      link.addEventListener('mouseenter', (e) => {
        if (document.body.classList.contains('amc-collapsed')) {
          this.showTooltip(e.target, link.title);
        }
      });
      
      link.addEventListener('mouseleave', () => {
        this.hideTooltips();
      });
    });
  }

  showTooltip(element, text) {
    this.hideTooltips(); // Remove any existing tooltips
    
    const tooltip = document.createElement('div');
    tooltip.className = 'sidebar-tooltip';
    tooltip.textContent = text;
    document.body.appendChild(tooltip);
    
    const rect = element.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    
    tooltip.style.position = 'fixed';
    tooltip.style.left = `${rect.right + 10}px`;
    tooltip.style.top = `${rect.top + (rect.height - tooltipRect.height) / 2}px`;
    tooltip.style.zIndex = '10000';
  }

  hideTooltips() {
    document.querySelectorAll('.sidebar-tooltip').forEach(tooltip => {
      tooltip.remove();
    });
  }

  toggleSidebar() {
    const isCollapsed = document.body.classList.toggle('amc-collapsed');
    localStorage.setItem('amc_sidebar_collapsed', isCollapsed);
    
    // Hide tooltips when expanding
    if (!isCollapsed) {
      this.hideTooltips();
    }
    
    // Dispatch custom event for other components
    window.dispatchEvent(new CustomEvent('sidebarToggle', {
      detail: { collapsed: isCollapsed }
    }));
  }

  setupResizeObserver() {
    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver(entries => {
        // Handle responsive behavior if needed
        const width = entries[0].contentRect.width;
        if (width < 768 && !document.body.classList.contains('amc-collapsed')) {
          this.toggleSidebar();
        }
      });
      
      resizeObserver.observe(document.body);
    }
  }

  // Public methods for external control
  updateRole(newRole) {
    if (sidebarMenuData[newRole]) {
      this.role = newRole;
      this.menuData = sidebarMenuData[newRole];
      localStorage.setItem('amc_user_role', newRole);
      this.render();
      this.bindEvents();
      
      if (this.onRoleChange) {
        this.onRoleChange(newRole);
      }
    }
  }

  setActivePage(page) {
    this.currentPage = page;
    
    // Update active states
    this.container.querySelectorAll('.sidebar-item').forEach(item => {
      const link = item.querySelector('a');
      if (link && link.getAttribute('href') === page) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  destroy() {
    this.hideTooltips();
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

// Auto-initialize if container exists
document.addEventListener('DOMContentLoaded', () => {
  const sidebarContainer = document.querySelector('#amc-sidebar');
  if (sidebarContainer && !sidebarContainer.dataset.initialized) {
    window.amcSidebar = new GlobalSidebar({
      container: '#amc-sidebar'
    });
    sidebarContainer.dataset.initialized = 'true';
  }
});