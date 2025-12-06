/**
 * AMC Avatar System - Premium Enterprise-Grade Avatar with Role-Based Halo
 * Replaces existing avatar systems with unified, role-aware implementation
 * Features: Role-based halo rings, login pulse animation, Google-style modal
 */

class AMCAvatar {
    constructor() {
        this.user = null;
        this.modal = null;
        this.avatar = null;
        this.roleColors = {
            media_user: "#3B82F6",
            client_user: "#10B981", 
            client_admin: "#F59E0B",
            platform_admin: "#EF4444"
        };
        
        this.init();
    }

    init() {
        // Load user data from localStorage (dual-key support)
        this.loadUserData();
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    loadUserData() {
        const userString = localStorage.getItem('user') || localStorage.getItem('currentUser');
        if (userString) {
            try {
                this.user = JSON.parse(userString);
            } catch (e) {
                console.error('Error parsing user data:', e);
                this.user = { email: 'user@example.com', role: 'media_user' };
            }
        } else {
            this.user = { email: 'user@example.com', role: 'media_user' };
        }
    }

    setup() {
        this.createAvatarHTML();
        this.createModalHTML();
        this.bindEvents();
        this.applyRoleStyles();
        this.triggerLoginPulse();
        this.initializeTheme();
    }

    createAvatarHTML() {
        // Find existing avatar anchor or create new one
        let avatarContainer = document.getElementById('amcAvatar');
        
        if (!avatarContainer) {
            // Create new avatar in header
            const headerRight = document.querySelector('.amc-header-right') || 
                               document.querySelector('.user-info') ||
                               document.querySelector('.app-header .user-info');
            
            if (headerRight) {
                avatarContainer = document.createElement('div');
                avatarContainer.id = 'amcAvatar';
                avatarContainer.className = 'amc-avatar';
                headerRight.appendChild(avatarContainer);
            }
        }

        if (avatarContainer) {
            avatarContainer.innerHTML = `
                <div class="amc-avatar-ring">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" class="amc-avatar-icon">
                        <circle cx="32" cy="24" r="12" fill="#cbd5e1"/>
                        <path d="M12 54c0-11 9-20 20-20s20 9 20 20" fill="#cbd5e1"/>
                    </svg>
                </div>
            `;
            this.avatar = avatarContainer;
        }
    }

    createModalHTML() {
        // Remove existing modal if present
        const existingModal = document.getElementById('avatarModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create new modal
        const modalHTML = `
            <div id="avatarModal" class="avatar-modal hidden">
                <div class="avatar-modal-content">
                    <div class="avatar-modal-header">
                        <div class="avatar-modal-avatar">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" class="amc-avatar-icon">
                                <circle cx="32" cy="24" r="12" fill="#cbd5e1"/>
                                <path d="M12 54c0-11 9-20 20-20s20 9 20 20" fill="#cbd5e1"/>
                            </svg>
                        </div>
                        <div class="avatar-email" id="avatarEmail">${this.user.email}</div>
                        <div class="avatar-role" id="avatarRole">${this.formatRole(this.user.role)}</div>
                    </div>
                    <div class="avatar-modal-section">
                        <button class="modal-btn" id="accountSettings">
                            <i class="fas fa-user-cog"></i> Account Settings
                        </button>
                        <button class="modal-btn" id="languageSettings">
                            <i class="fas fa-language"></i> Language Settings
                        </button>
                        <button class="modal-btn" id="toggleTheme">
                            <i class="fas fa-palette"></i> Toggle Light/Dark Mode
                        </button>
                        <hr class="modal-divider">
                        <button class="modal-btn modal-btn-danger" id="signOut">
                            <i class="fas fa-sign-out-alt"></i> Sign Out
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('avatarModal');
    }

    bindEvents() {
        if (this.avatar) {
            this.avatar.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleModal();
            });
        }

        // Close modal when clicking outside
        document.addEventListener('click', (e) => {
            if (this.modal && !this.modal.contains(e.target) && !this.avatar?.contains(e.target)) {
                this.closeModal();
            }
        });

        // Reposition modal on window resize
        window.addEventListener('resize', () => {
            if (this.modal && !this.modal.classList.contains('hidden')) {
                this.positionModal();
            }
        });

        // Reposition modal on scroll
        window.addEventListener('scroll', () => {
            if (this.modal && !this.modal.classList.contains('hidden')) {
                this.positionModal();
            }
        });

        // Modal button events
        this.bindModalEvents();
    }

    bindModalEvents() {
        const accountSettings = document.getElementById('accountSettings');
        const languageSettings = document.getElementById('languageSettings');
        const toggleTheme = document.getElementById('toggleTheme');
        const signOut = document.getElementById('signOut');

        if (accountSettings) {
            accountSettings.addEventListener('click', () => {
                console.log('Account Settings clicked');
                // Future implementation
                this.closeModal();
            });
        }

        if (languageSettings) {
            languageSettings.addEventListener('click', () => {
                console.log('Language Settings clicked');
                // Future implementation
                this.closeModal();
            });
        }

        if (toggleTheme) {
            toggleTheme.addEventListener('click', () => {
                // Toggle main page theme, not just modal
                const currentTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
                const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                
                if (newTheme === 'dark') {
                    document.body.classList.add('dark-mode');
                } else {
                    document.body.classList.remove('dark-mode');
                }
                
                // Update header button icon if it exists
                const headerBtn = document.getElementById('darkModeToggleHeader');
                const headerIcon = headerBtn?.querySelector('i');
                if (headerIcon) {
                    headerIcon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
                }
                
                // Store theme preference
                localStorage.setItem('theme', newTheme);
                
                // Update modal theme icon
                this.updateThemeIcon();
                
                // Close modal after theme change
                this.closeModal();
            });
        }

        if (signOut) {
            signOut.addEventListener('click', () => {
                this.handleSignOut();
            });
        }
    }

    toggleModal() {
        if (this.modal) {
            if (this.modal.classList.contains('hidden')) {
                this.positionModal();
                this.modal.classList.remove('hidden');
            } else {
                this.modal.classList.add('hidden');
            }
        }
    }

    positionModal() {
        if (!this.modal || !this.avatar) return;
        
        const avatarRect = this.avatar.getBoundingClientRect();
        const modalWidth = 320;
        const modalHeight = 300; // Approximate height
        const padding = 10;
        
        // Calculate position relative to viewport
        let top = avatarRect.bottom + padding;
        let right = window.innerWidth - avatarRect.right;
        
        // Ensure modal doesn't go off-screen vertically
        if (top + modalHeight > window.innerHeight) {
            top = avatarRect.top - modalHeight - padding;
        }
        
        // Ensure modal doesn't go off-screen horizontally
        if (right + modalWidth > window.innerWidth) {
            right = padding;
        }
        
        // Apply positioning
        this.modal.style.top = `${top}px`;
        this.modal.style.right = `${right}px`;
    }

    closeModal() {
        if (this.modal) {
            this.modal.classList.add('hidden');
        }
    }

    applyRoleStyles() {
        const roleColor = this.roleColors[this.user.role] || this.roleColors.media_user;
        document.documentElement.style.setProperty('--avatar-ring', roleColor);
    }

    triggerLoginPulse() {
        if (this.avatar) {
            this.avatar.classList.add('halo-pulse');
            setTimeout(() => {
                if (this.avatar) {
                    this.avatar.classList.remove('halo-pulse');
                }
            }, 1200);
        }
    }

    formatRole(role) {
        const roleMap = {
            media_user: 'Media User',
            client_user: 'Client User', 
            client_admin: 'Client Admin',
            platform_admin: 'Platform Admin'
        };
        return roleMap[role] || 'User';
    }

    updateThemeIcon() {
        const themeBtn = document.getElementById('toggleTheme');
        if (themeBtn) {
            const isDark = document.body.classList.contains('dark-mode');
            const icon = themeBtn.querySelector('i');
            if (icon) {
                icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
            }
        }
    }

    initializeTheme() {
        // Initialize theme icon based on current theme
        setTimeout(() => {
            this.updateThemeIcon();
        }, 100);
    }

    handleSignOut() {
        // Clear all authentication tokens
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        
        // Redirect to login page
        window.location.href = 'landing-page-twitter-style.html';
    }

    // Public method to refresh user data
    refreshUser() {
        this.loadUserData();
        this.applyRoleStyles();
        
        const emailEl = document.getElementById('avatarEmail');
        const roleEl = document.getElementById('avatarRole');
        
        if (emailEl) emailEl.textContent = this.user.email;
        if (roleEl) roleEl.textContent = this.formatRole(this.user.role);
    }
}

// Auto-initialize when script loads
let amcAvatarInstance = null;

// Initialize avatar system
function initAMCAvatar() {
    if (!amcAvatarInstance) {
        amcAvatarInstance = new AMCAvatar();
    }
    return amcAvatarInstance;
}

// Export for external use
window.AMCAvatar = AMCAvatar;
window.initAMCAvatar = initAMCAvatar;

// Auto-initialize
initAMCAvatar();