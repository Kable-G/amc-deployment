// amc-analytics-tracker.js - Comprehensive interaction tracking for AutoMediaCenter
// This script tracks all user interactions and sends them to the analytics backend

class AMCAnalyticsTracker {
    constructor() {
        this.apiBaseUrl = '/api/v1/amc-analytics';
        this.sessionId = this.generateSessionId();
        this.pageLoadTime = Date.now();
        this.lastActivityTime = Date.now();
        this.isTracking = true;
        
        // Initialize tracking
        this.init();
    }
    
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    init() {
        // Track page view immediately
        this.trackPageView();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Track time on page when user leaves
        this.setupPageUnloadTracking();
        
        // Track periodic heartbeat
        this.setupHeartbeat();
        
        console.log('AMC Analytics Tracker initialized');
    }
    
    setupEventListeners() {
        // Track download clicks
        document.addEventListener('click', (e) => {
            const target = e.target.closest('a, button');
            if (!target) return;
            
            // Download tracking DISABLED - handled by backend middleware to prevent duplicates
            // Frontend download tracking removed to avoid double-counting with universalDownloadTracker
            // if (target.classList.contains('download-asset-btn') ||
            //     target.classList.contains('download-all-btn') ||
            //     target.href && (target.href.includes('/uploads/') ||
            //                    target.href.includes('/api/v1/center/assets/download/') ||
            //                    target.href.includes('/api/v1/center/releases/') && target.href.includes('/download-all') ||
            //                    target.download)) {
            //     this.trackAssetDownload(target);
            // }
            
            // Quick view tracking - Updated for AutoMediaCenter
            if (target.classList.contains('amc-quick-view-trigger') ||
                target.classList.contains('quick-view-btn') ||
                target.dataset.action === 'quick-view') {
                this.trackQuickView(target);
            }
            
            // Add to cart tracking - Updated for AutoMediaCenter
            if (target.classList.contains('add-to-cart-btn') ||
                target.classList.contains('qv-add-cart-btn') ||
                target.classList.contains('add-to-cart') ||
                target.dataset.action === 'add-to-cart') {
                this.trackAddToCart(target);
            }
            
            // Release view tracking
            if (target.classList.contains('release-link') || target.href?.includes('release-detail') || target.href?.includes('amc-release-detail')) {
                this.trackReleaseView(target);
            }
            
            // Pagination tracking
            if (target.classList.contains('page-link') || target.closest('.pagination') || target.dataset.page) {
                this.trackPagination(target);
            }
            
            // Share action tracking
            if (target.classList.contains('share-btn') || target.dataset.action === 'share') {
                this.trackShareAction(target);
            }
        });
        
        // Track search queries
        const searchInputs = document.querySelectorAll('input[type="search"], input[name*="search"], #searchInput');
        searchInputs.forEach(input => {
            let searchTimeout;
            input.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    if (e.target.value.trim().length > 2) {
                        this.trackSearchQuery(e.target.value.trim());
                    }
                }, 1000); // Debounce search tracking
            });
        });
        
        // Track filter changes
        const filterElements = document.querySelectorAll('select[name*="filter"], input[name*="filter"], .filter-option');
        filterElements.forEach(element => {
            element.addEventListener('change', (e) => {
                this.trackFilterApplied(e.target);
            });
        });
        
        // Track sort changes
        const sortElements = document.querySelectorAll('select[name*="sort"], .sort-option');
        sortElements.forEach(element => {
            element.addEventListener('change', (e) => {
                this.trackSortChanged(e.target);
            });
        });
        
        // Track scroll depth (for engagement metrics)
        this.setupScrollTracking();
    }
    
    setupScrollTracking() {
        let maxScrollDepth = 0;
        let scrollTimeout;
        
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                const scrollDepth = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
                if (scrollDepth > maxScrollDepth) {
                    maxScrollDepth = scrollDepth;
                    // Track significant scroll milestones
                    if (maxScrollDepth >= 25 && maxScrollDepth < 50) {
                        this.trackInteraction('scroll_25_percent');
                    } else if (maxScrollDepth >= 50 && maxScrollDepth < 75) {
                        this.trackInteraction('scroll_50_percent');
                    } else if (maxScrollDepth >= 75) {
                        this.trackInteraction('scroll_75_percent');
                    }
                }
            }, 100);
        });
    }
    
    setupPageUnloadTracking() {
        window.addEventListener('beforeunload', () => {
            const timeOnPage = Math.round((Date.now() - this.pageLoadTime) / 1000);
            this.trackInteraction('page_unload', {
                timeOnPage: timeOnPage
            });
        });
        
        // Track when user becomes inactive
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                const timeOnPage = Math.round((Date.now() - this.pageLoadTime) / 1000);
                this.trackInteraction('page_hidden', {
                    timeOnPage: timeOnPage
                });
            } else {
                this.trackInteraction('page_visible');
            }
        });
    }
    
    setupHeartbeat() {
        // Send periodic heartbeat to track active sessions
        setInterval(() => {
            if (Date.now() - this.lastActivityTime < 60000) { // Only if active in last minute
                this.trackInteraction('heartbeat');
            }
        }, 30000); // Every 30 seconds
    }
    
    // Core tracking methods
    trackPageView() {
        this.trackInteraction('page_view', {
            url: window.location.href,
            referrer: document.referrer,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
        });
    }
    
    trackAssetDownload(element) {
        const assetUrl = element.href || element.dataset.downloadUrl;
        const assetName = this.extractAssetName(assetUrl);
        const assetType = this.determineAssetType(assetName);
        const releaseData = this.extractReleaseData(element);
        
        // DISABLED: Download tracking now handled by backend middleware only
        console.log('🚫 Frontend download tracking disabled - handled by backend');
        return; // Skip frontend download tracking
        
        this.trackInteraction('asset_download', {
            assetName: assetName,
            assetPath: assetUrl,
            assetType: assetType,
            assetSize: element.dataset.fileSize || null,
            releaseId: releaseData.releaseId,
            releaseUuid: releaseData.releaseUuid,
            releaseTitle: releaseData.releaseTitle
        });
    }
    
    trackQuickView(element) {
        const releaseData = this.extractReleaseData(element);
        
        this.trackInteraction('asset_quick_view', {
            releaseId: releaseData.releaseId,
            releaseUuid: releaseData.releaseUuid,
            releaseTitle: releaseData.releaseTitle,
            assetName: element.dataset.assetName || null,
            assetType: element.dataset.assetType || null
        });
    }
    
    trackAddToCart(element) {
        const releaseData = this.extractReleaseData(element);
        
        this.trackInteraction('asset_add_to_cart', {
            releaseId: releaseData.releaseId,
            releaseUuid: releaseData.releaseUuid,
            releaseTitle: releaseData.releaseTitle,
            assetName: element.dataset.assetName || null,
            assetType: element.dataset.assetType || null
        });
    }
    
    trackReleaseView(element) {
        const releaseData = this.extractReleaseData(element);
        
        this.trackInteraction('release_view', {
            releaseId: releaseData.releaseId,
            releaseUuid: releaseData.releaseUuid,
            releaseTitle: releaseData.releaseTitle
        });
    }
    
    trackSearchQuery(query) {
        const currentFilters = this.getCurrentFilters();
        
        this.trackInteraction('search_query', {
            searchQuery: query,
            filtersApplied: currentFilters
        });
    }
    
    trackFilterApplied(element) {
        const filterName = element.name || element.dataset.filter;
        const filterValue = element.value || element.dataset.value;
        const allFilters = this.getCurrentFilters();
        
        this.trackInteraction('filter_applied', {
            filterName: filterName,
            filterValue: filterValue,
            filtersApplied: allFilters
        });
    }
    
    trackSortChanged(element) {
        const sortBy = element.value || element.dataset.sort;
        
        this.trackInteraction('sort_changed', {
            sortBy: sortBy
        });
    }
    
    trackPagination(element) {
        const pageNumber = element.dataset.page || element.textContent;
        
        this.trackInteraction('pagination_click', {
            pageNumber: pageNumber,
            currentUrl: window.location.href
        });
    }
    
    trackShareAction(element) {
        const shareType = element.dataset.shareType || 'unknown';
        const releaseData = this.extractReleaseData(element);
        
        this.trackInteraction('share_action', {
            shareType: shareType,
            releaseId: releaseData.releaseId,
            releaseUuid: releaseData.releaseUuid,
            releaseTitle: releaseData.releaseTitle
        });
    }
    
    // Helper methods
    extractAssetName(url) {
        if (!url) return null;
        const parts = url.split('/');
        return parts[parts.length - 1];
    }
    
    determineAssetType(filename) {
        if (!filename) return 'other';
        
        const ext = filename.split('.').pop().toLowerCase();
        
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
            return 'image';
        } else if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(ext)) {
            return 'video';
        } else if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(ext)) {
            return 'audio';
        } else if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(ext)) {
            return 'document';
        } else {
            return 'other';
        }
    }
    
    extractReleaseData(element) {
        // Try to find release data from various sources - Updated for AutoMediaCenter
        const releaseCard = element.closest('.media-card, .release-card, .media-release, [data-uuid], [data-release-id]');
        
        return {
            releaseId: releaseCard?.dataset.releaseDbId || releaseCard?.dataset.releaseId || element.dataset.releaseId || null,
            releaseUuid: releaseCard?.dataset.uuid || releaseCard?.dataset.releaseUuid || element.dataset.releaseUuid || element.dataset.uuid || null,
            releaseTitle: decodeURIComponent(releaseCard?.dataset.title || '') ||
                         releaseCard?.dataset.releaseTitle || element.dataset.releaseTitle ||
                         releaseCard?.querySelector('.release-title, .title, h3 a')?.textContent?.trim() || null
        };
    }
    
    getCurrentFilters() {
        const filters = {};
        
        // Collect all active filters
        document.querySelectorAll('select[name*="filter"], input[name*="filter"]:checked').forEach(element => {
            if (element.value && element.value !== 'all' && element.value !== '') {
                filters[element.name || element.dataset.filter] = element.value;
            }
        });
        
        return filters;
    }
    
    // Core tracking method that sends data to backend
    trackInteraction(interactionType, additionalData = {}) {
        if (!this.isTracking) return;
        
        this.lastActivityTime = Date.now();
        
        const trackingData = {
            interactionType: interactionType,
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent,
            ...additionalData
        };
        
        // Send to backend
        this.sendTrackingData(trackingData);
    }
    
    async sendTrackingData(data) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/track`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                console.warn('Analytics tracking failed:', response.status);
            }
        } catch (error) {
            console.warn('Analytics tracking error:', error);
            // Store failed requests for retry
            this.storeFailedRequest(data);
        }
    }
    
    storeFailedRequest(data) {
        try {
            const failedRequests = JSON.parse(localStorage.getItem('amc_failed_analytics') || '[]');
            failedRequests.push(data);
            
            // Keep only last 50 failed requests
            if (failedRequests.length > 50) {
                failedRequests.splice(0, failedRequests.length - 50);
            }
            
            localStorage.setItem('amc_failed_analytics', JSON.stringify(failedRequests));
        } catch (error) {
            console.warn('Failed to store analytics data:', error);
        }
    }
    
    // Retry failed requests
    async retryFailedRequests() {
        try {
            const failedRequests = JSON.parse(localStorage.getItem('amc_failed_analytics') || '[]');
            
            if (failedRequests.length === 0) return;
            
            console.log(`Retrying ${failedRequests.length} failed analytics requests`);
            
            for (const request of failedRequests) {
                await this.sendTrackingData(request);
                await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between requests
            }
            
            // Clear failed requests after successful retry
            localStorage.removeItem('amc_failed_analytics');
            
        } catch (error) {
            console.warn('Failed to retry analytics requests:', error);
        }
    }
    
    // Public methods for manual tracking
    trackCustomEvent(eventName, data = {}) {
        this.trackInteraction(eventName, data);
    }
    
    setUserContext(userInfo) {
        this.userContext = userInfo;
    }
    
    disable() {
        this.isTracking = false;
    }
    
    enable() {
        this.isTracking = true;
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize analytics tracker
    window.amcAnalytics = new AMCAnalyticsTracker();
    
    // Retry any failed requests from previous sessions
    setTimeout(() => {
        window.amcAnalytics.retryFailedRequests();
    }, 2000);
    
    // Expose global tracking function for manual use
    window.trackAMCEvent = (eventName, data) => {
        if (window.amcAnalytics) {
            window.amcAnalytics.trackCustomEvent(eventName, data);
        }
    };
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AMCAnalyticsTracker;
}