/**
 * AMC Avatar System - Fixed Version
 * Enterprise-grade profile avatar with role-based halo rings
 * Fixes the SVG explosion issue by using proper size constraints
 */

class AMCAvatarSystem {
    constructor() {
        this.container = null;
        this.modal = null;
        this.isInitialized = false;
        this.roleColors = {
            media_user: "#3B82F6",      // blue
            client_user: "#10B981",     // green  
            client_admin: "#F59E0B",    // amber
            platform_admin: "#EF4444"  // red
        };
        
        this.init();
    }

    init() {
        if (this.isInitialized) return;
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        this.container = document.getElementById('amc-avatar-container');
        this.modal = document.getElementById('amc-profile-modal');
        
        if (!this.container) {
            console.warn('AMC Avatar: Container not found');
            return;
        }

        this.createAvatar();
        this.setupEventListeners();
        this.loadUserData();
        this.isInitialized = true;
    }

    createAvatar() {
        // Create the fixed-size avatar wrapper with proper constraints
        this.container.innerHTML = `
            <div id="profile-avatar" class="avatar-wrapper" aria-label="User menu" tabindex="0">
                <svg viewBox="0 0 24 24" fill="currentColor" class="avatar-img">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
            </div>
        `;

        // Inject the CSS styles directly to ensure proper sizing
        this.injectStyles();
    }

    injectStyles() {
        const styleId = 'amc-avatar-fixed-styles';
        if (document.getElementById(styleId)) return;

        const styles = `
            /* Avatar container - FIXED SIZE */
            .avatar-wrapper {
                position: relative;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                overflow: hidden;
                border: 3px solid var(--role-color, #9ca3af);
                transition: border-color 0.3s ease, box-shadow 0.3s ease;
                background-color: var(--bg-secondary, #ffffff);
                flex-shrink: 0;
            }

            /* Ensure SVG scales properly inside container */
            .avatar-img {
                width: 24px !important;
                height: 24px !important;
                color: var(--role-color, #9ca3af);
                flex-shrink: 0;
            }

            /* Hover effect */
            .avatar-wrapper:hover {
                transform: scale(1.05);
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            }

            /* Halo pulse animation on login */
            @keyframes haloPulse {
                0% { 
                    box-shadow: 0 0 0 0 var(--role-color-alpha, rgba(59,130,246,0.6));
                    transform: scale(1);
                }
                70% { 
                    box-shadow: 0 0 0 8px var(--role-color-alpha-transparent, rgba(59,130,246,0));
                    transform: scale(1.05);
                }
                100% { 
                    box-shadow: 0 0 0 0 var(--role-color-alpha-transparent, rgba(59,130,246,0));
                    transform: scale(1);
                }
            }

            .avatar-wrapper.pulse {
                animation: haloPulse 1.2s ease-out;
            }

            /* Focus state for accessibility */
            .avatar-wrapper:focus {
                outline: 2px solid var(--role-color, #3B82F6);
                outline-offset: 2px;
            }
        `;

        const styleSheet = document.createElement('style');
        styleSheet.id = styleId;
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
    }

    setupEventListeners() {
        const avatar = this.container.querySelector('.avatar-wrapper');
        if (!avatar) return;

        // Click to open modal
        avatar.addEventListener('click', (e) => {
            e.preventDefault();
            this.openModal();
        });

        // Keyboard support
        avatar.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.openModal();
            }
        });

        // Modal event listeners
        if (this.modal) {
            // Close button
            const closeBtn = this.modal.querySelector('#amc-profile-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.closeModal());
            }

            // Click outside to close
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    this.closeModal();
                }
            });

            // Sign out functionality
            const signOutBtn = this.modal.querySelector('#amc-profile-signout');
            if (signOutBtn) {
                signOutBtn.addEventListener('click', () => this.handleSignOut());
            }

            // Theme toggle
            const themeToggle = this.modal.querySelector('#amc-theme-toggle');
            if (themeToggle) {
                themeToggle.addEventListener('click', (e) => {
                    if (e.target.classList.contains('amc-theme-option')) {
                        this.handleThemeChange(e.target.dataset.theme);
                    }
                });
            }
        }
    }

    loadUserData() {
        // Get user data from localStorage (supporting both keys)
        let user = null;
        try {
            const userData = localStorage.getItem('user') || localStorage.getItem('currentUser');
            if (userData) {
                user = JSON.parse(userData);
            }
        } catch (e) {
            console.warn('AMC Avatar: Error parsing user data', e);
        }

        if (!user) {
            console.warn('AMC Avatar: No user data found');
            return;
        }

        // Set role-based styling
        this.setRoleBasedStyling(user.role || 'media_user');

        // Update modal with user info
        this.updateModalUserInfo(user);

        // Trigger login pulse animation
        this.triggerLoginPulse();
    }

    setRoleBasedStyling(role) {
        const avatar = this.container.querySelector('.avatar-wrapper');
        if (!avatar) return;

        const color = this.roleColors[role] || this.roleColors.media_user;
        
        // Set CSS custom properties for role-based styling
        avatar.style.setProperty('--role-color', color);
        
        // Create alpha versions for animations
        const rgbColor = this.hexToRgb(color);
        if (rgbColor) {
            avatar.style.setProperty('--role-color-alpha', `rgba(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}, 0.6)`);
            avatar.style.setProperty('--role-color-alpha-transparent', `rgba(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}, 0)`);
        }
    }

    updateModalUserInfo(user) {
        if (!this.modal) return;

        const nameEl = this.modal.querySelector('.amc-profile-name');
        const emailEl = this.modal.querySelector('.amc-profile-email');
        const roleEl = this.modal.querySelector('.amc-profile-role');

        if (nameEl) nameEl.textContent = user.name || user.email || 'User';
        if (emailEl) emailEl.textContent = user.email || 'No email';
        if (roleEl) {
            const roleDisplay = this.formatRoleDisplay(user.role);
            roleEl.textContent = roleDisplay;
        }
    }

    formatRoleDisplay(role) {
        const roleMap = {
            media_user: 'Media User',
            client_user: 'Client User', 
            client_admin: 'Client Admin',
            platform_admin: 'Platform Admin'
        };
        return roleMap[role] || 'User';
    }

    triggerLoginPulse() {
        const avatar = this.container.querySelector('.avatar-wrapper');
        if (!avatar) return;

        // Add pulse class
        avatar.classList.add('pulse');
        
        // Remove after animation completes
        setTimeout(() => {
            avatar.classList.remove('pulse');
        }, 1500);
    }

    openModal() {
        if (!this.modal) return;
        
        this.modal.style.display = 'flex';
        this.modal.classList.add('amc-modal-open');
        
        // Focus management
        const closeBtn = this.modal.querySelector('#amc-profile-close');
        if (closeBtn) closeBtn.focus();
    }

    closeModal() {
        if (!this.modal) return;
        
        this.modal.classList.remove('amc-modal-open');
        setTimeout(() => {
            this.modal.style.display = 'none';
        }, 200);
        
        // Return focus to avatar
        const avatar = this.container.querySelector('.avatar-wrapper');
        if (avatar) avatar.focus();
    }

    handleSignOut() {
        // Clear all authentication data
        const authKeys = [
            'token', 'authToken', 'jwt', 'jwtToken', 'accessToken', 'bearerToken',
            'user', 'currentUser', 'userData', 'userInfo', 'userProfile',
            'session', 'sessionData', 'sessionToken', 'sessionId',
            'auth', 'authData', 'authentication', 'credentials',
            'loginData', 'loginToken', 'userSession', 'clientData'
        ];
        
        authKeys.forEach(key => {
            localStorage.removeItem(key);
            sessionStorage.removeItem(key);
        });
        
        // Redirect to login page
        window.location.href = 'landing-page-twitter-style.html';
    }

    handleThemeChange(theme) {
        const body = document.body;
        const themeOptions = this.modal.querySelectorAll('.amc-theme-option');
        
        // Update theme
        if (theme === 'dark') {
            body.classList.add('dark-mode');
        } else {
            body.classList.remove('dark-mode');
        }
        
        // Update active state
        themeOptions.forEach(option => {
            option.classList.toggle('active', option.dataset.theme === theme);
        });
        
        // Save preference
        localStorage.setItem('theme', theme);
    }

    // Utility function to convert hex to RGB
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
}

// Initialize the avatar system when the script loads
document.addEventListener('DOMContentLoaded', () => {
    new AMCAvatarSystem();
});

// Also initialize immediately if DOM is already ready
if (document.readyState !== 'loading') {
    new AMCAvatarSystem();
}