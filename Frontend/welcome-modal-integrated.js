/**
 * Integrated Welcome Modal System
 * Replaces the separate welcome-modal.html page with integrated modals
 * Preserves role-based access control and routing
 */

class IntegratedWelcomeModal {
    constructor() {
        this.modalId = 'integrated-welcome-modal';
        this.backdropId = 'integrated-welcome-backdrop';
        this.isShown = false;
    }

    /**
     * Show welcome modal with role-specific content
     * @param {Object} user - User object with role, email, etc.
     */
    show(user) {
        if (this.isShown) return;
        
        this.createModal(user);
        this.isShown = true;
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
        
        // Show modal with animation
        requestAnimationFrame(() => {
            const backdrop = document.getElementById(this.backdropId);
            if (backdrop) {
                backdrop.classList.add('show');
            }
        });
    }

    /**
     * Hide and remove the modal
     */
    hide() {
        const backdrop = document.getElementById(this.backdropId);
        if (backdrop) {
            backdrop.classList.remove('show');
            setTimeout(() => {
                backdrop.remove();
                document.body.style.overflow = 'auto';
                this.isShown = false;
            }, 300);
        }
    }

    /**
     * Create the modal HTML structure
     * @param {Object} user - User object
     */
    createModal(user) {
        // Remove existing modal if any
        const existing = document.getElementById(this.backdropId);
        if (existing) existing.remove();

        const roleConfig = this.getRoleConfig(user.role);
        const permissions = this.getRolePermissions(user.role);
        
        const modalHTML = `
            <div id="${this.backdropId}" class="integrated-welcome-backdrop">
                <div id="${this.modalId}" class="integrated-welcome-modal">
                    <div class="welcome-modal-header">
                        <div class="welcome-icon">
                            <i class="fas fa-check-circle"></i>
                        </div>
                        <h2>Welcome to AutoMediaCenter!</h2>
                        <p class="welcome-subtitle">You're successfully logged in</p>
                    </div>
                    
                    <div class="welcome-modal-body">
                        <div class="user-info-card ${roleConfig.class}">
                            <div class="user-avatar">
                                <i class="fas ${roleConfig.icon}"></i>
                            </div>
                            <div class="user-details">
                                <h3>${user.email}</h3>
                                <span class="role-badge">${roleConfig.name}</span>
                                <p class="role-description">${roleConfig.description}</p>
                            </div>
                        </div>
                        
                        <div class="permissions-section">
                            <h4><i class="fas fa-key"></i> Your Access Permissions</h4>
                            <ul class="permissions-list">
                                ${permissions.map(permission => `<li><i class="fas fa-check"></i> ${permission}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                    
                    <div class="welcome-modal-footer">
                        <button class="btn-secondary" onclick="integratedWelcomeModal.hide()">
                            <i class="fas fa-times"></i> Close
                        </button>
                        <button class="btn-primary" onclick="integratedWelcomeModal.proceedToDestination('${user.role}')">
                            <i class="fas fa-arrow-right"></i> ${roleConfig.actionText}
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.attachEventListeners();
    }

    /**
     * Get role-specific configuration
     * @param {string} role - User role
     * @returns {Object} Role configuration
     */
    getRoleConfig(role) {
        const configs = {
            'media_user': {
                name: 'Media User',
                class: 'role-media-user',
                icon: 'fa-user',
                description: 'You can view and download media releases from all automotive brands.',
                actionText: 'Browse Media Center'
            },
            'client_user': {
                name: 'Client User',
                class: 'role-client-user',
                icon: 'fa-user-tie',
                description: 'You can upload and manage media releases for your company.',
                actionText: 'Go to Media Center'
            },
            'client_admin': {
                name: 'Client Admin',
                class: 'role-client-admin',
                icon: 'fa-user-cog',
                description: 'You can upload, manage releases, and oversee your company\'s media presence.',
                actionText: 'Go to Media Center'
            },
            'platform_admin': {
                name: 'Platform Admin',
                class: 'role-platform-admin',
                icon: 'fa-crown',
                description: 'You have full system control and can manage all users and companies.',
                actionText: 'Go to Admin Dashboard'
            }
        };
        
        return configs[role] || configs['media_user'];
    }

    /**
     * Get role-specific permissions
     * @param {string} role - User role
     * @returns {Array} List of permissions
     */
    getRolePermissions(role) {
        const permissions = {
            'media_user': [
                'View and download media releases',
                'Access public automotive content',
                'Use search and filtering tools',
                'Create personal watchlists'
            ],
            'client_user': [
                'Upload and manage media releases',
                'Access company media library',
                'View release analytics',
                'Collaborate with team members'
            ],
            'client_admin': [
                'Upload and manage media releases',
                'Manage company users and permissions',
                'Access advanced analytics',
                'Configure company settings',
                'Approve and moderate content'
            ],
            'platform_admin': [
                'Full system administration',
                'Manage all users and companies',
                'Access system-wide analytics',
                'Configure platform settings',
                'Monitor system performance'
            ]
        };
        
        return permissions[role] || permissions['media_user'];
    }

    /**
     * Handle role-based navigation
     * @param {string} role - User role
     */
    proceedToDestination(role) {
        this.hide();
        
        // Role-based routing (preserving original logic)
        setTimeout(() => {
            switch (role) {
                case 'media_user':
                case 'client_user':
                case 'client_admin':
                    // These roles go to automediacenter.html
                    if (window.location.pathname !== '/automediacenter.html') {
                        window.location.href = '/automediacenter.html';
                    }
                    break;
                    
                case 'platform_admin':
                    // Platform admin goes to admin dashboard
                    window.location.href = '/admin-dashboard.html';
                    break;
                    
                default:
                    // Default fallback
                    window.location.href = '/automediacenter.html';
                    break;
            }
        }, 300);
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        const backdrop = document.getElementById(this.backdropId);
        if (backdrop) {
            // Close on backdrop click
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) {
                    this.hide();
                }
            });
            
            // Close on Escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isShown) {
                    this.hide();
                }
            });
        }
    }

    /**
     * Auto-show modal after login success
     * Call this from login success handlers
     * @param {Object} user - User object from login response
     */
    static showAfterLogin(user) {
        // Small delay to ensure page is ready
        setTimeout(() => {
            const modal = new IntegratedWelcomeModal();
            modal.show(user);
        }, 500);
    }
}

// Global instance
window.integratedWelcomeModal = new IntegratedWelcomeModal();

// Auto-initialize if user data is available
document.addEventListener('DOMContentLoaded', () => {
    // Check if we should show welcome modal (e.g., from URL parameter or localStorage flag)
    const urlParams = new URLSearchParams(window.location.search);
    const showWelcome = urlParams.get('welcome');
    
    if (showWelcome === 'true') {
        // Get user data from localStorage or make API call
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        if (token) {
            // Try to get user data from localStorage first
            let user = null;
            try {
                user = JSON.parse(localStorage.getItem('user') || localStorage.getItem('currentUser'));
            } catch (e) {
                console.warn('Could not parse user data from localStorage');
            }
            
            if (user && user.role) {
                IntegratedWelcomeModal.showAfterLogin(user);
                // Clean up URL parameter
                urlParams.delete('welcome');
                const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
                window.history.replaceState({}, '', newUrl);
            }
        }
    }
});