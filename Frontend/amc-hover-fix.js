/**
 * AMC Hover Fix - Addresses inconsistent hover responsiveness
 * Fixes cards that don't respond to hover and modal trigger issues
 * Preserves all existing functionality while ensuring reliable hover detection
 */

class AMCHoverFix {
    constructor() {
        this.init();
    }

    init() {
        // Wait for DOM to be fully loaded and other scripts to initialize
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => this.applyHoverFixes(), 500);
            });
        } else {
            setTimeout(() => this.applyHoverFixes(), 500);
        }
    }

    applyHoverFixes() {
        console.log('🔧 Applying AMC hover responsiveness fixes...');
        
        // Fix 1: Ensure all media cards have proper hover detection
        this.fixCardHoverDetection();
        
        // Fix 2: Fix modal trigger responsiveness
        this.fixModalTriggers();
        
        // Fix 3: Add fallback hover handlers for non-responsive cards
        this.addFallbackHoverHandlers();
        
        console.log('✅ AMC hover fixes applied successfully');
    }

    fixCardHoverDetection() {
        const mediaCards = document.querySelectorAll('.media-card');
        
        mediaCards.forEach((card, index) => {
            // Ensure each card has proper event handling
            if (!card.dataset.hoverFixed) {
                // Add mouse enter/leave handlers as backup
                card.addEventListener('mouseenter', (e) => {
                    this.handleCardHover(e.currentTarget, true);
                }, { passive: true });
                
                card.addEventListener('mouseleave', (e) => {
                    this.handleCardHover(e.currentTarget, false);
                }, { passive: true });
                
                // Mark as fixed to avoid duplicate handlers
                card.dataset.hoverFixed = 'true';
                
                // Debug: Log cards that might have issues
                const overlay = card.querySelector('.card-image-hover-buttons-overlay');
                if (!overlay) {
                    console.warn(`⚠️ Card ${index} missing hover overlay:`, card);
                }
            }
        });
    }

    handleCardHover(card, isHovering) {
        const overlay = card.querySelector('.card-image-hover-buttons-overlay');
        if (!overlay) return;
        
        if (isHovering) {
            // Force show overlay if CSS hover isn't working
            overlay.style.opacity = '1';
            overlay.style.pointerEvents = 'auto';
            card.style.transform = 'translateY(-6px)';
        } else {
            // Reset to CSS control
            overlay.style.opacity = '';
            overlay.style.pointerEvents = '';
            card.style.transform = '';
        }
    }

    fixModalTriggers() {
        // Ensure quick view buttons are properly clickable
        document.addEventListener('click', (e) => {
            const quickViewBtn = e.target.closest('.amc-quick-view-trigger');
            if (quickViewBtn && !e.defaultPrevented) {
                // Force trigger if the original handler didn't work
                const uuid = quickViewBtn.dataset.uuid;
                if (uuid && typeof window.openAmcQuickViewModal === 'function') {
                    e.preventDefault();
                    window.openAmcQuickViewModal(uuid);
                }
            }
        }, { capture: true });
    }

    addFallbackHoverHandlers() {
        // Add CSS-based fallback for browsers with hover issues
        const fallbackStyles = document.createElement('style');
        fallbackStyles.id = 'amc-hover-fallback';
        fallbackStyles.textContent = `
            /* Fallback hover styles for problematic browsers */
            .media-card[data-hover-fixed="true"]:hover .card-image-hover-buttons-overlay {
                opacity: 1 !important;
                pointer-events: auto !important;
            }
            
            .media-card[data-hover-fixed="true"]:hover {
                transform: translateY(-6px) !important;
                border-color: rgba(var(--accent-primary-rgb), 0.5) !important;
                box-shadow: 0 12px 28px rgba(var(--accent-primary-rgb), 0.2), 0 0 0 1.5px rgba(var(--accent-primary-rgb), 0.25) !important;
            }
            
            /* Ensure buttons are always clickable */
            .card-image-hover-buttons-overlay .btn {
                pointer-events: auto !important;
                position: relative !important;
                z-index: 10 !important;
            }
        `;
        
        document.head.appendChild(fallbackStyles);
    }

    // Method to force refresh hover states (useful after dynamic content loading)
    refreshHoverStates() {
        console.log('🔄 Refreshing hover states...');
        
        // Remove existing fixes
        document.querySelectorAll('.media-card[data-hover-fixed]').forEach(card => {
            card.removeAttribute('data-hover-fixed');
        });
        
        // Reapply fixes
        setTimeout(() => this.applyHoverFixes(), 100);
    }

    // Debug method to identify problematic cards
    debugHoverIssues() {
        const mediaCards = document.querySelectorAll('.media-card');
        const issues = [];
        
        mediaCards.forEach((card, index) => {
            const overlay = card.querySelector('.card-image-hover-buttons-overlay');
            const quickViewBtn = card.querySelector('.amc-quick-view-trigger');
            const addToCartBtn = card.querySelector('.add-to-cart-btn');
            const downloadBtn = card.querySelector('.download-all-btn');
            
            const cardIssues = [];
            if (!overlay) cardIssues.push('Missing hover overlay');
            if (!quickViewBtn) cardIssues.push('Missing quick view button');
            if (!addToCartBtn) cardIssues.push('Missing add to cart button');
            if (!downloadBtn) cardIssues.push('Missing download button');
            
            if (cardIssues.length > 0) {
                issues.push({ index, card, issues: cardIssues });
            }
        });
        
        if (issues.length > 0) {
            console.warn('🐛 Found cards with potential hover issues:', issues);
        } else {
            console.log('✅ All cards appear to have proper hover elements');
        }
        
        return issues;
    }
}

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
    window.amcHoverFix = new AMCHoverFix();
    
    // Expose debug method globally
    window.debugAMCHover = () => {
        if (window.amcHoverFix) {
            return window.amcHoverFix.debugHoverIssues();
        }
    };
    
    // Expose refresh method globally
    window.refreshAMCHover = () => {
        if (window.amcHoverFix) {
            window.amcHoverFix.refreshHoverStates();
        }
    };
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AMCHoverFix;
}