/**
 * AMC Analytics Tracker - Comprehensive tracking for AutoMediaCenter interactions
 * This script captures ALL user interactions on automediacenter.html and sends them to analytics
 */

class AMCAnalyticsTracker {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.startTime = Date.now();
        this.interactions = [];
        this.currentUser = null;
        this.isTracking = true;
        this.batchSize = 10;
        this.flushInterval = 5000; // 5 seconds
        this.pageViewTracked = false;
        
        // Initialize tracking
        this.init();
    }

    generateSessionId() {
        return `amc_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    async init() {
        console.log('🔍 AMC Analytics Tracker initialized');
        
        // Get current user info
        await this.getCurrentUser();
        
        // Track page view
        this.trackPageView();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Start batch processing
        this.startBatchProcessor();
        
        // Track page unload
        this.setupUnloadTracking();
    }

    async getCurrentUser() {
        try {
            const response = await fetch('/api/v1/auth/me', {
                credentials: 'include'
            });
            if (response.ok) {
                this.currentUser = await response.json();
                console.log('👤 Current user:', this.currentUser.email);
            }
        } catch (error) {
            console.warn('Could not get current user:', error);
        }
    }

    trackPageView() {
        if (this.pageViewTracked) return;
        
        this.track({
            interactionType: 'page_view',
            metadata: {
                url: window.location.href,
                referrer: document.referrer,
                userAgent: navigator.userAgent,
                screenResolution: `${screen.width}x${screen.height}`,
                viewportSize: `${window.innerWidth}x${window.innerHeight}`,
                timestamp: new Date().toISOString()
            }
        });
        
        this.pageViewTracked = true;
        console.log('📄 Page view tracked');
    }

    setupEventListeners() {
        // Download tracking - most important for your analytics
        this.setupDownloadTracking();
        
        // Search and filter tracking
        this.setupSearchTracking();
        
        // Asset interaction tracking
        this.setupAssetInteractionTracking();
        
        // Navigation tracking
        this.setupNavigationTracking();
        
        // General click tracking
        this.setupClickTracking();
        
        // Scroll and engagement tracking
        this.setupEngagementTracking();
    }

    setupDownloadTracking() {
        // Track all download links and buttons
        document.addEventListener('click', (event) => {
            const target = event.target.closest('a[href*="download"], button[data-action="download"], .download-btn, [onclick*="download"]');
            if (target) {
                this.trackDownload(target, event);
            }
        });

        // Track form submissions that might be downloads
        document.addEventListener('submit', (event) => {
            const form = event.target;
            if (form.action && form.action.includes('download')) {
                this.trackDownloadForm(form);
            }
        });

        // Monitor for dynamic download triggers
        this.observeDownloadElements();
    }

    trackDownload(element, event) {
        const href = element.href || element.getAttribute('data-href');
        const assetName = this.extractAssetName(href, element);
        const assetType = this.detectAssetType(assetName, href);
        const releaseInfo = this.extractReleaseInfo(element);

        console.log('⬇️ Download tracked:', assetName, assetType);

        this.track({
            interactionType: 'asset_download',
            assetName: assetName,
            assetType: assetType,
            assetPath: href,
            releaseId: releaseInfo.releaseId,
            releaseUuid: releaseInfo.releaseUuid,
            releaseTitle: releaseInfo.releaseTitle,
            metadata: {
                downloadMethod: 'click',
                elementType: element.tagName.toLowerCase(),
                elementText: element.textContent?.trim(),
                elementClasses: element.className,
                timestamp: new Date().toISOString()
            }
        });
    }

    extractAssetName(href, element) {
        // Try to get asset name from various sources
        if (element.getAttribute('data-asset-name')) {
            return element.getAttribute('data-asset-name');
        }
        
        if (element.getAttribute('data-filename')) {
            return element.getAttribute('data-filename');
        }
        
        if (href) {
            // Extract filename from URL
            const urlParts = href.split('/');
            const filename = urlParts[urlParts.length - 1];
            if (filename && filename.includes('.')) {
                return decodeURIComponent(filename);
            }
        }
        
        // Fallback to element text
        const text = element.textContent?.trim();
        if (text && text.length < 100) {
            return text;
        }
        
        return 'Unknown Asset';
    }

    detectAssetType(assetName, href) {
        const name = (assetName || href || '').toLowerCase();
        
        if (name.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/)) return 'image';
        if (name.match(/\.(mp4|mov|avi|wmv|webm|mkv|flv)$/)) return 'video';
        if (name.match(/\.(pdf|doc|docx|txt|rtf)$/)) return 'document';
        if (name.match(/\.(mp3|wav|aac|flac|ogg)$/)) return 'audio';
        if (name.match(/\.(zip|rar|7z|tar|gz)$/)) return 'archive';
        
        return 'other';
    }

    extractReleaseInfo(element) {
        // Look for release information in various places
        const releaseContainer = element.closest('[data-release-id], [data-release-uuid], .release-item, .press-release');
        
        if (releaseContainer) {
            return {
                releaseId: releaseContainer.getAttribute('data-release-id'),
                releaseUuid: releaseContainer.getAttribute('data-release-uuid'),
                releaseTitle: releaseContainer.getAttribute('data-release-title') || 
                            releaseContainer.querySelector('.release-title, .title, h1, h2, h3')?.textContent?.trim()
            };
        }
        
        // Try to find release info in page context
        const pageTitle = document.title;
        const h1 = document.querySelector('h1')?.textContent?.trim();
        
        return {
            releaseId: null,
            releaseUuid: null,
            releaseTitle: h1 || pageTitle || null
        };
    }

    setupSearchTracking() {
        // Track search inputs
        const searchInputs = document.querySelectorAll('input[type="search"], input[name*="search"], .search-input, #search');
        searchInputs.forEach(input => {
            let searchTimeout;
            input.addEventListener('input', (event) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    if (event.target.value.trim().length > 2) {
                        this.track({
                            interactionType: 'search_query',
                            searchQuery: event.target.value.trim(),
                            metadata: {
                                searchField: input.name || input.id || 'unknown',
                                timestamp: new Date().toISOString()
                            }
                        });
                    }
                }, 1000);
            });
        });

        // Track search form submissions
        document.addEventListener('submit', (event) => {
            const form = event.target;
            const searchInput = form.querySelector('input[type="search"], input[name*="search"]');
            if (searchInput && searchInput.value.trim()) {
                this.track({
                    interactionType: 'search_query',
                    searchQuery: searchInput.value.trim(),
                    metadata: {
                        searchMethod: 'form_submit',
                        timestamp: new Date().toISOString()
                    }
                });
            }
        });
    }

    setupAssetInteractionTracking() {
        // Track asset quick views, previews, and modal opens
        document.addEventListener('click', (event) => {
            const target = event.target.closest('.asset-preview, .quick-view, .modal-trigger, [data-action="preview"]');
            if (target) {
                const assetInfo = this.extractAssetInfo(target);
                this.track({
                    interactionType: 'asset_quick_view',
                    assetName: assetInfo.name,
                    assetType: assetInfo.type,
                    releaseId: assetInfo.releaseId,
                    releaseTitle: assetInfo.releaseTitle,
                    metadata: {
                        previewType: target.getAttribute('data-preview-type') || 'modal',
                        timestamp: new Date().toISOString()
                    }
                });
            }
        });

        // Track add to cart/collection actions
        document.addEventListener('click', (event) => {
            const target = event.target.closest('.add-to-cart, [data-action="add-to-cart"], .collect-asset');
            if (target) {
                const assetInfo = this.extractAssetInfo(target);
                this.track({
                    interactionType: 'asset_add_to_cart',
                    assetName: assetInfo.name,
                    assetType: assetInfo.type,
                    releaseId: assetInfo.releaseId,
                    releaseTitle: assetInfo.releaseTitle,
                    metadata: {
                        timestamp: new Date().toISOString()
                    }
                });
            }
        });
    }

    extractAssetInfo(element) {
        const container = element.closest('[data-asset-name], [data-filename], .asset-item');
        return {
            name: container?.getAttribute('data-asset-name') || 
                  container?.getAttribute('data-filename') || 
                  element.getAttribute('alt') || 
                  element.textContent?.trim() || 
                  'Unknown Asset',
            type: this.detectAssetType(container?.getAttribute('data-asset-type') || element.getAttribute('data-type')),
            releaseId: container?.getAttribute('data-release-id'),
            releaseTitle: container?.getAttribute('data-release-title')
        };
    }

    setupNavigationTracking() {
        // Track filter applications
        document.addEventListener('change', (event) => {
            const target = event.target;
            if (target.matches('.filter-select, .filter-checkbox, .filter-radio, [data-filter]')) {
                this.trackFilterChange(target);
            }
        });

        // Track sorting changes
        document.addEventListener('change', (event) => {
            const target = event.target;
            if (target.matches('.sort-select, [data-sort], [name*="sort"]')) {
                this.track({
                    interactionType: 'sort_changed',
                    sortBy: target.value,
                    metadata: {
                        sortField: target.name || target.id,
                        timestamp: new Date().toISOString()
                    }
                });
            }
        });

        // Track pagination
        document.addEventListener('click', (event) => {
            const target = event.target.closest('.pagination a, .page-link, [data-page]');
            if (target) {
                this.track({
                    interactionType: 'pagination_click',
                    metadata: {
                        page: target.getAttribute('data-page') || target.textContent?.trim(),
                        timestamp: new Date().toISOString()
                    }
                });
            }
        });
    }

    trackFilterChange(element) {
        const filterType = element.getAttribute('data-filter') || element.name || 'unknown';
        const filterValue = element.type === 'checkbox' ? element.checked : element.value;
        
        this.track({
            interactionType: 'filter_applied',
            filtersApplied: {
                [filterType]: filterValue
            },
            metadata: {
                filterType: filterType,
                filterValue: filterValue,
                timestamp: new Date().toISOString()
            }
        });
    }

    setupClickTracking() {
        // Track release detail views
        document.addEventListener('click', (event) => {
            const target = event.target.closest('.release-link, .release-title, [data-action="view-release"]');
            if (target) {
                const releaseInfo = this.extractReleaseInfo(target);
                this.track({
                    interactionType: 'release_detail_view',
                    releaseId: releaseInfo.releaseId,
                    releaseUuid: releaseInfo.releaseUuid,
                    releaseTitle: releaseInfo.releaseTitle,
                    metadata: {
                        linkText: target.textContent?.trim(),
                        timestamp: new Date().toISOString()
                    }
                });
            }
        });

        // Track share actions
        document.addEventListener('click', (event) => {
            const target = event.target.closest('.share-btn, [data-action="share"], .social-share');
            if (target) {
                this.track({
                    interactionType: 'share_action',
                    metadata: {
                        shareType: target.getAttribute('data-share-type') || 'unknown',
                        timestamp: new Date().toISOString()
                    }
                });
            }
        });

        // Track print actions
        document.addEventListener('click', (event) => {
            const target = event.target.closest('.print-btn, [data-action="print"]');
            if (target) {
                this.track({
                    interactionType: 'print_action',
                    metadata: {
                        timestamp: new Date().toISOString()
                    }
                });
            }
        });
    }

    setupEngagementTracking() {
        // Track scroll depth
        let maxScrollDepth = 0;
        let scrollTimeout;
        
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                const scrollDepth = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
                if (scrollDepth > maxScrollDepth && scrollDepth % 25 === 0) {
                    maxScrollDepth = scrollDepth;
                    this.track({
                        interactionType: 'scroll_depth',
                        metadata: {
                            scrollDepth: scrollDepth,
                            timestamp: new Date().toISOString()
                        }
                    });
                }
            }, 100);
        });

        // Track time on page
        setInterval(() => {
            const timeOnPage = Math.round((Date.now() - this.startTime) / 1000);
            if (timeOnPage % 30 === 0) { // Every 30 seconds
                this.track({
                    interactionType: 'time_on_page',
                    timeOnPage: timeOnPage,
                    metadata: {
                        timestamp: new Date().toISOString()
                    }
                });
            }
        }, 30000);
    }

    observeDownloadElements() {
        // Use MutationObserver to track dynamically added download elements
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const downloadElements = node.querySelectorAll('a[href*="download"], .download-btn, [data-action="download"]');
                        downloadElements.forEach((element) => {
                            // Add tracking to new download elements
                            element.addEventListener('click', (event) => {
                                this.trackDownload(element, event);
                            });
                        });
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    setupUnloadTracking() {
        window.addEventListener('beforeunload', () => {
            const timeOnPage = Math.round((Date.now() - this.startTime) / 1000);
            
            // Send final batch with page exit info
            this.track({
                interactionType: 'page_exit',
                timeOnPage: timeOnPage,
                metadata: {
                    totalInteractions: this.interactions.length,
                    timestamp: new Date().toISOString()
                }
            }, true); // Force immediate send
        });
    }

    track(data, immediate = false) {
        if (!this.isTracking) return;

        const interaction = {
            ...data,
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            referrer: document.referrer
        };

        // Add user info if available
        if (this.currentUser) {
            interaction.userId = this.currentUser.id;
            interaction.userEmail = this.currentUser.email;
        }

        this.interactions.push(interaction);
        console.log('📊 Tracked:', data.interactionType, data);

        if (immediate || this.interactions.length >= this.batchSize) {
            this.flushInteractions();
        }
    }

    async flushInteractions() {
        if (this.interactions.length === 0) return;

        const batch = [...this.interactions];
        this.interactions = [];

        try {
            const response = await fetch('/api/v1/amc-analytics/track-batch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ interactions: batch })
            });

            if (response.ok) {
                console.log(`✅ Sent ${batch.length} interactions to analytics`);
            } else {
                console.error('❌ Failed to send analytics batch:', response.status);
                // Re-add failed interactions to queue
                this.interactions.unshift(...batch);
            }
        } catch (error) {
            console.error('❌ Error sending analytics:', error);
            // Re-add failed interactions to queue
            this.interactions.unshift(...batch);
        }
    }

    startBatchProcessor() {
        setInterval(() => {
            if (this.interactions.length > 0) {
                this.flushInteractions();
            }
        }, this.flushInterval);
    }

    // Public methods for manual tracking
    trackCustomEvent(eventType, data = {}) {
        this.track({
            interactionType: eventType,
            ...data,
            metadata: {
                ...data.metadata,
                customEvent: true,
                timestamp: new Date().toISOString()
            }
        });
    }

    trackDownloadComplete(assetName, assetType, releaseInfo = {}) {
        this.track({
            interactionType: 'asset_download',
            assetName: assetName,
            assetType: assetType,
            ...releaseInfo,
            metadata: {
                downloadStatus: 'completed',
                timestamp: new Date().toISOString()
            }
        });
    }

    // Disable/enable tracking
    setTracking(enabled) {
        this.isTracking = enabled;
        console.log(`📊 Analytics tracking ${enabled ? 'enabled' : 'disabled'}`);
    }
}

// Initialize tracker when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.amcTracker = new AMCAnalyticsTracker();
    });
} else {
    window.amcTracker = new AMCAnalyticsTracker();
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AMCAnalyticsTracker;
}