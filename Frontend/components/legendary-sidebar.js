// ============ LEGENDARY SIDEBAR COMPONENT ============
// Complete sidebar system extracted from test_globalshell.html
// Includes: hamburger icon, tooltips, collapsible sections, colored bars

class LegendarySidebar extends HTMLElement {
    constructor() {
        super();
        this.sidebarData = null;
        this.collapsedSections = [];
    }

    connectedCallback() {
        this.render();
        this.initializeFeatures();
        this.loadSidebarData();
    }

    render() {
        this.className = 'amc-sidebar';
        this.id = 'sidebar';
        
        this.innerHTML = `
            <!-- Sidebar Header with Hamburger -->
            <div class="sidebar-header">
                <button id="sidebarToggle" data-tooltip="Collapse sidebar">
                    <div class="hamburger"></div>
                </button>
            </div>
            
            <!-- Sidebar Content (will be populated by loadSidebarData) -->
            <div class="sidebar-content">
                <!-- Content will be dynamically generated -->
            </div>
        `;
    }

    initializeFeatures() {
        this.initHamburgerToggle();
        this.initTooltipSystem();
        this.initGlowMarker();
        this.initCollapsedSectionBars();
        this.observeSidebarState();
    }

    initHamburgerToggle() {
        const toggleBtn = this.querySelector('#sidebarToggle');
        if (!toggleBtn) return;

        toggleBtn.addEventListener('click', () => {
            const isCollapsed = document.body.classList.contains('amc-collapsed') || 
                              document.body.classList.contains('sidebar-collapsed');
            
            if (isCollapsed) {
                // Expand
                document.body.classList.remove('amc-collapsed', 'sidebar-collapsed');
                toggleBtn.setAttribute('data-tooltip', 'Collapse sidebar');
            } else {
                // Collapse
                document.body.classList.add('amc-collapsed');
                toggleBtn.setAttribute('data-tooltip', 'Expand sidebar');
            }
            
            // Save state
            localStorage.setItem('sidebarCollapsed', !isCollapsed);
            
            console.log(`🍔 Sidebar ${isCollapsed ? 'expanded' : 'collapsed'}`);
        });

        // Restore saved state
        const savedCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        if (savedCollapsed) {
            document.body.classList.add('amc-collapsed');
            toggleBtn.setAttribute('data-tooltip', 'Expand sidebar');
        }
    }

    initTooltipSystem() {
        // Tooltip system for collapsed sidebar items
        this.addEventListener('mouseenter', (e) => {
            const target = e.target.closest('.sidebar-link, .collapsed-section-bar, #sidebarToggle');
            if (!target) return;

            const isCollapsed = document.body.classList.contains('amc-collapsed') || 
                              document.body.classList.contains('sidebar-collapsed');
            
            if (isCollapsed) {
                const tooltipText = target.getAttribute('data-tooltip') || 
                                  target.getAttribute('title') || 
                                  target.textContent.trim();
                
                if (tooltipText) {
                    this.showTooltip(target, tooltipText);
                }
            }
        }, true);

        this.addEventListener('mouseleave', (e) => {
            if (!this.contains(e.relatedTarget)) {
                this.hideTooltips();
            }
        }, true);
    }

    showTooltip(element, text) {
        this.hideTooltips(); // Remove existing tooltips
        
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

    initGlowMarker() {
        // 🌟 GLOW MARKER: 2px cyan vertical line that follows cursor
        this.addEventListener('mousemove', (e) => {
            const rect = this.getBoundingClientRect();
            const y = e.clientY - rect.top;
            this.style.setProperty('--glow-y', `${y}px`);
        });
        
        this.addEventListener('mouseleave', () => {
            this.style.setProperty('--glow-y', '-20px');
        });
    }

    initCollapsedSectionBars() {
        // Initialize collapsed section bars for when sidebar is collapsed
        const sectionNames = ['core', 'management', 'analytics', 'admin'];
        const sectionTitles = {
            'core': 'Core',
            'management': 'Management', 
            'analytics': 'Analytics',
            'admin': 'Admin'
        };

        // Wait for sidebar content to be populated
        setTimeout(() => {
            const sections = this.querySelectorAll('.sidebar-section');
            
            sections.forEach((section, index) => {
                const sectionName = sectionNames[index] || `section-${index}`;
                
                let collapsedBar = section.querySelector('.collapsed-section-bar');
                if (!collapsedBar) {
                    collapsedBar = document.createElement('div');
                    collapsedBar.className = 'collapsed-section-bar';
                    collapsedBar.setAttribute('data-section', sectionName);
                    collapsedBar.setAttribute('data-tooltip', sectionTitles[sectionName] || sectionName);
                    
                    section.insertBefore(collapsedBar, section.firstChild);
                    
                    // Click handler for collapsed bars
                    collapsedBar.addEventListener('click', () => {
                        this.toggleSection(sectionName);
                    });
                }
            });
            
            this.updateSectionBarStates();
        }, 1000);
    }

    toggleSection(sectionName) {
        const section = this.querySelector(`[data-section="${sectionName}"]`).closest('.sidebar-section');
        const sectionHeader = section.querySelector('.sidebar-section-header');
        const sectionList = section.querySelector('.sidebar-list');
        
        if (!sectionHeader || !sectionList) return;
        
        const isCurrentlyCollapsed = sectionHeader.classList.contains('collapsed');
        
        if (isCurrentlyCollapsed) {
            // Expand
            sectionHeader.classList.remove('collapsed');
            sectionList.classList.remove('collapsed');
            sectionList.style.maxHeight = sectionList.scrollHeight + 'px';
            sectionList.style.opacity = '1';
            sectionList.style.marginBottom = '14px';
            sectionList.style.paddingTop = '4px';
            
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
            
            const chevron = sectionHeader.querySelector('.section-toggle');
            if (chevron) chevron.style.transform = 'rotate(-90deg)';
        }
        
        // Save state
        this.collapsedSections = JSON.parse(localStorage.getItem('collapsedSections') || '[]');
        if (sectionHeader.classList.contains('collapsed')) {
            if (!this.collapsedSections.includes(sectionName)) {
                this.collapsedSections.push(sectionName);
            }
        } else {
            const index = this.collapsedSections.indexOf(sectionName);
            if (index > -1) {
                this.collapsedSections.splice(index, 1);
            }
        }
        localStorage.setItem('collapsedSections', JSON.stringify(this.collapsedSections));
        
        this.updateSectionBarStates();
        
        document.dispatchEvent(new CustomEvent('sectionToggled', {
            detail: { section: sectionName, isCollapsed: !isCurrentlyCollapsed }
        }));
    }

    updateSectionBarStates() {
        const collapsedSections = JSON.parse(localStorage.getItem('collapsedSections') || '[]');
        const sectionNames = ['core', 'management', 'analytics', 'admin'];
        
        sectionNames.forEach(sectionName => {
            const collapsedBar = this.querySelector(`[data-section="${sectionName}"].collapsed-section-bar`);
            if (collapsedBar) {
                const isExpanded = !collapsedSections.includes(sectionName);
                collapsedBar.classList.toggle('expanded', isExpanded);
            }
        });
    }

    observeSidebarState() {
        // Watch for body class changes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    this.updateSectionBarStates();
                }
            });
        });
        
        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['class']
        });
        
        // Listen for localStorage changes
        window.addEventListener('storage', (e) => {
            if (e.key === 'collapsedSections') {
                this.updateSectionBarStates();
            }
        });
        
        // Listen for custom events
        document.addEventListener('sectionToggled', () => {
            this.updateSectionBarStates();
        });
    }

    async loadSidebarData() {
        try {
            // Try to load from external file first
            const response = await fetch('components/globalsidebardata.js');
            if (response.ok) {
                const text = await response.text();
                // Extract the sidebarData from the file
                const match = text.match(/const sidebarData = (\{[\s\S]*?\});/);
                if (match) {
                    this.sidebarData = eval('(' + match[1] + ')');
                }
            }
        } catch (error) {
            console.warn('Could not load external sidebar data, using fallback');
        }

        // Fallback sidebar data
        if (!this.sidebarData) {
            this.sidebarData = {
                core: [
                    { icon: 'fas fa-home', text: 'AutoMediaCenter', href: 'automediacenter.html' },
                    { icon: 'fas fa-database', text: 'AutoMediaDatabase', href: 'AssetDBmenu1.6.html' },
                    { icon: 'fas fa-broadcast-tower', text: 'AutoMediaLive', href: '#', badge: 'NEW' }
                ],
                management: [
                    { icon: 'fas fa-building', text: 'Company Dashboard', href: 'company-portal.html' },
                    { icon: 'fas fa-upload', text: 'Upload Dashboard', href: '#' },
                    { icon: 'fas fa-rocket', text: 'Manage Releases', href: 'manage_releases.html' },
                    { icon: 'fas fa-history', text: 'Radar History', href: 'radar_history.html' },
                    { icon: 'fas fa-cogs', text: 'Manage Live Events', href: '#' },
                    { icon: 'fas fa-shield-alt', text: 'Manage Vault Assets', href: '#' }
                ],
                analytics: [
                    { icon: 'fas fa-chart-line', text: 'Company Analytics', href: 'company-analytics-dashboard.html', badge: 'NEW' },
                    { icon: 'fas fa-chart-bar', text: 'AMC Analytics', href: 'amc-analytics.html' },
                    { icon: 'fas fa-satellite-dish', text: 'Radar Analytics', href: 'radar_analytics.html' },
                    { icon: 'fas fa-eye', text: 'Live Analytics', href: '#' },
                    { icon: 'fas fa-chart-pie', text: 'Vault Analytics', href: '#' }
                ],
                admin: [
                    { icon: 'fas fa-crown', text: 'Platform Admin Dashboard', href: 'platform-admin-dashboard.html', badge: 'NEW' },
                    { icon: 'fas fa-users-cog', text: 'User Management', href: '#' },
                    { icon: 'fas fa-building', text: 'Client Management', href: '#' },
                    { icon: 'fas fa-key', text: 'Access Control', href: '#' },
                    { icon: 'fas fa-cog', text: 'System Settings', href: '#' }
                ]
            };
        }

        this.renderSidebarContent();
        this.initCollapsibleSections();
    }

    renderSidebarContent() {
        const sidebarContent = this.querySelector('.sidebar-content');
        if (!sidebarContent) return;

        const sectionTitles = {
            core: 'Core',
            management: 'Management', 
            analytics: 'Analytics',
            admin: 'Admin'
        };

        let html = '';
        
        Object.keys(this.sidebarData).forEach((sectionKey, index) => {
            const items = this.sidebarData[sectionKey];
            const sectionTitle = sectionTitles[sectionKey] || sectionKey;
            
            html += `
                <div class="sidebar-section">
                    <div class="sidebar-section-header" data-section="${sectionKey}">
                        ${sectionTitle}
                    </div>
                    <ul class="sidebar-list" data-section-content="${sectionKey}">
            `;
            
            items.forEach(item => {
                const badgeHtml = item.badge ? `<span class="sidebar-badge">${item.badge}</span>` : '';
                html += `
                    <li class="sidebar-item">
                        <a href="${item.href}" class="sidebar-link" data-tooltip="${item.text}">
                            <span class="i"><i class="${item.icon}"></i></span>
                            <span class="t">${item.text}</span>
                            ${badgeHtml}
                        </a>
                    </li>
                `;
            });
            
            html += `
                    </ul>
                </div>
            `;
        });

        sidebarContent.innerHTML = html;
    }

    initCollapsibleSections() {
        setTimeout(() => {
            const sectionHeaders = this.querySelectorAll('.sidebar-section-header');
            
            sectionHeaders.forEach((header, index) => {
                if (header.classList.contains('collapsible')) return;
                
                header.classList.add('collapsible');
                header.style.cursor = 'pointer';
                header.style.display = 'flex';
                header.style.justifyContent = 'space-between';
                header.style.alignItems = 'center';
                
                // Add chevron icon
                const chevron = document.createElement('i');
                chevron.className = 'fas fa-chevron-down section-toggle';
                chevron.style.fontSize = '13px';
                chevron.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                chevron.style.marginLeft = 'auto';
                chevron.style.opacity = '0.7';
                header.appendChild(chevron);

                // Hover effects
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
                
                // Click handler
                header.addEventListener('click', () => {
                    const section = header.dataset.section;
                    this.toggleSection(section);
                });
                
                // Enhanced hover effects
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
            
            // Restore collapsed state
            this.collapsedSections = JSON.parse(localStorage.getItem('collapsedSections') || '[]');
            this.collapsedSections.forEach(section => {
                const header = this.querySelector(`[data-section="${section}"]`);
                const content = this.querySelector(`[data-section-content="${section}"]`);
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
            
            console.log(`✅ Initialized ${sectionHeaders.length} collapsible sidebar sections`);
        }, 500);
    }
}

// Register the custom element
customElements.define('legendary-sidebar', LegendarySidebar);

// Export for use in other files
window.LegendarySidebar = LegendarySidebar;

console.log('🎯 Legendary Sidebar Component loaded successfully');