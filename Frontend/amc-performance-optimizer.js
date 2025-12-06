/**
 * AMC Performance Optimizer - Lightweight enhancement layer
 * Enhances hover performance without touching core functionality
 * Preserves all existing features while optimizing responsiveness
 */

class AMCPerformanceOptimizer {
    constructor() {
        this.isOptimizing = false;
        this.hoverTimeout = null;
        this.lastHoverTime = 0;
        this.init();
    }

    init() {
        // Only optimize if performance issues are detected
        this.detectPerformanceIssues();
        
        // Add subtle optimizations that don't affect functionality
        this.optimizeHoverResponsiveness();
        this.optimizeScrollPerformance();
        
        console.log('🚀 AMC Performance Optimizer initialized (non-invasive mode)');
    }

    detectPerformanceIssues() {
        // Detect if we're on a slower device or browser
        const isSlowDevice = navigator.hardwareConcurrency < 4 || 
                           navigator.deviceMemory < 4 ||
                           /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isSlowDevice) {
            this.isOptimizing = true;
            console.log('📱 Slow device detected, enabling performance optimizations');
        }
    }

    optimizeHoverResponsiveness() {
        if (!this.isOptimizing) return;

        // Add CSS optimizations via style injection (non-destructive)
        const optimizationStyles = document.createElement('style');
        optimizationStyles.id = 'amc-performance-optimizations';
        optimizationStyles.textContent = `
            /* Performance optimizations for slower devices */
            .media-card {
                will-change: transform, box-shadow;
                backface-visibility: hidden;
                transform: translateZ(0); /* Force hardware acceleration */
            }
            
            .media-card:hover {
                transition: transform 0.2s ease-out, box-shadow 0.2s ease-out !important;
            }
            
            .card-image-hover-buttons-overlay {
                will-change: opacity;
                backface-visibility: hidden;
            }
            
            /* Reduce motion for better performance on slow devices */
            @media (prefers-reduced-motion: reduce) {
                .media-card:hover {
                    transform: none !important;
                }
                .card-image-hover-buttons-overlay {
                    transition: opacity 0.1s ease !important;
                }
            }
        `;
        
        document.head.appendChild(optimizationStyles);
    }

    optimizeScrollPerformance() {
        if (!this.isOptimizing) return;

        // Throttle scroll events for better performance
        let scrollTimeout;
        const originalScrollHandler = window.onscroll;
        
        window.addEventListener('scroll', () => {
            if (scrollTimeout) return;
            
            scrollTimeout = setTimeout(() => {
                if (originalScrollHandler) originalScrollHandler();
                scrollTimeout = null;
            }, 16); // ~60fps
        }, { passive: true });
    }

    // Method to temporarily disable optimizations if needed
    disable() {
        const optimizationStyles = document.getElementById('amc-performance-optimizations');
        if (optimizationStyles) {
            optimizationStyles.remove();
        }
        this.isOptimizing = false;
        console.log('🔧 Performance optimizations disabled');
    }

    // Method to re-enable optimizations
    enable() {
        this.isOptimizing = true;
        this.optimizeHoverResponsiveness();
        console.log('⚡ Performance optimizations re-enabled');
    }
}

// Auto-initialize only if performance issues are detected
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we detect potential performance issues
    const shouldOptimize = navigator.hardwareConcurrency < 4 || 
                          navigator.deviceMemory < 4 ||
                          /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (shouldOptimize) {
        window.amcPerformanceOptimizer = new AMCPerformanceOptimizer();
    } else {
        console.log('💎 High-performance device detected, keeping full visual fidelity');
    }
});

// Export for manual control if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AMCPerformanceOptimizer;
}