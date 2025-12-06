/**
 * AutoMediaCenter Real-Time Analytics Tracker
 * Captures actual user interactions and sends them to backend
 */

class AMCRealTracker {
    constructor() {
        this.apiBase = 'http://localhost:5000/api/v1/analytics';
        this.sessionId = this.generateSessionId();
        this.userId = this.getUserId();
        this.userLevel = this.getUserLevel();
        this.pageLoadTime = Date.now();
        
        // Initialize tracking
        this.init();
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    getUserId() {
        // Get from authentication system
        const user = JSON.parse(localStorage.getItem('currentUser') || localStorage.getItem('user') || '{}');
        return user.email || 'anonymous';
    }

    getUserLevel() {
        const user = JSON.parse(localStorage.getItem('currentUser') || localStorage.getItem('user') || '{}');
        return user.level || 1;
    }

    getAuthToken() {
        return localStorage.getItem('authToken') || localStorage.getItem('token');
    }

    async sendEvent(eventType, data = {}) {
        const token = this.getAuthToken();
        if (!token) {
            console.warn('No auth token - skipping analytics tracking');
            return;
        }

        try {
            const payload = {
                eventType,
                data: {
                    ...data,
                    userId: this.userId,
                    userLevel: this.userLevel,
                    sessionId: this.sessionId,
                    page: window.location.pathname,
                    timestamp: new Date().toISOString()
                }
            };

            const response = await fetch(`${this.apiBase}/track`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                console.warn('Analytics tracking failed:', response.status);
            }
        } catch (error) {
            console.warn('Analytics tracking error:', error);
        }
    }

    init() {
        // Track page view immediately
        this.trackPageView();

        // Track page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.trackPageView();
            }
        });

        // Track downloads
        this.trackDownloads();

        // Track modal interactions
        this.trackModals();

        // Track release detail views
        this.trackReleaseViews();

        // Track time on page when leaving
        window.addEventListener('beforeunload', () => {
            const timeOnPage = Date.now() - this.pageLoadTime;
            this.sendEvent('page_time', { timeOnPage });
        });
    }

    trackPageView() {
        this.sendEvent('page_view', {
            page: window.location.pathname,
            title: document.title,
            referrer: document.referrer
        });
    }

    trackDownloads() {
        // Track all download links
        document.addEventListener('click', (event) => {
            const link = event.target.closest('a[href*="download"], a[download], .download-btn, .btn-download');
            if (link) {
                const href = link.getAttribute('href') || '';
                const fileName = this.extractFileName(href) || link.textContent.trim();
                const fileType = this.getFileType(fileName);
                
                this.sendEvent('download', {
                    fileName,
                    fileType,
                    url: href,
                    linkText: link.textContent.trim()
                });
            }
        });
    }

    trackModals() {
        // Track modal opens
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        // Check for modal classes
                        if (node.classList && (
                            node.classList.contains('modal') ||
                            node.classList.contains('popup') ||
                            node.classList.contains('overlay') ||
                            node.style.display === 'block' && node.classList.contains('hidden')
                        )) {
                            this.sendEvent('modal_open', {
                                modalType: this.getModalType(node),
                                modalId: node.id || 'unknown'
                            });
                        }
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class']
        });

        // Also track button clicks that open modals
        document.addEventListener('click', (event) => {
            const button = event.target.closest('[data-modal], [data-toggle="modal"], .modal-trigger');
            if (button) {
                this.sendEvent('modal_trigger', {
                    triggerType: button.tagName.toLowerCase(),
                    triggerText: button.textContent.trim(),
                    modalTarget: button.getAttribute('data-modal') || button.getAttribute('data-target')
                });
            }
        });
    }

    trackReleaseViews() {
        // Track when release detail pages are viewed
        if (window.location.pathname.includes('release-detail') || 
            window.location.pathname.includes('amc-release-detail')) {
            
            const releaseId = this.extractReleaseId();
            const releaseTitle = document.querySelector('h1, .release-title, .title')?.textContent?.trim();
            
            this.sendEvent('release_view', {
                releaseId,
                releaseTitle
            });
        }

        // Track release card clicks
        document.addEventListener('click', (event) => {
            const releaseCard = event.target.closest('.release-card, .media-card, [data-release-id]');
            if (releaseCard) {
                const releaseId = releaseCard.getAttribute('data-release-id') || 
                                releaseCard.querySelector('[data-release-id]')?.getAttribute('data-release-id');
                const releaseTitle = releaseCard.querySelector('.title, h3, h4')?.textContent?.trim();
                
                this.sendEvent('release_click', {
                    releaseId,
                    releaseTitle
                });
            }
        });
    }

    extractFileName(url) {
        if (!url) return null;
        const parts = url.split('/');
        return parts[parts.length - 1].split('?')[0];
    }

    getFileType(fileName) {
        if (!fileName) return 'unknown';
        const ext = fileName.split('.').pop().toLowerCase();
        const typeMap = {
            'jpg': 'image', 'jpeg': 'image', 'png': 'image', 'gif': 'image', 'webp': 'image',
            'mp4': 'video', 'mov': 'video', 'avi': 'video', 'mkv': 'video',
            'pdf': 'document', 'doc': 'document', 'docx': 'document', 'txt': 'document',
            'zip': 'archive', 'rar': 'archive', '7z': 'archive'
        };
        return typeMap[ext] || 'other';
    }

    getModalType(element) {
        const classList = Array.from(element.classList || []);
        if (classList.some(c => c.includes('download'))) return 'download';
        if (classList.some(c => c.includes('preview'))) return 'preview';
        if (classList.some(c => c.includes('detail'))) return 'detail';
        if (classList.some(c => c.includes('share'))) return 'share';
        return 'general';
    }

    extractReleaseId() {
        // Try to get release ID from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id') || urlParams.get('releaseId') || 
               window.location.pathname.split('/').pop() || 'unknown';
    }

    // Manual tracking methods for specific events
    trackCustomEvent(eventName, data = {}) {
        this.sendEvent('custom', {
            eventName,
            ...data
        });
    }

    trackSearch(query, results = 0) {
        this.sendEvent('search', {
            query,
            resultsCount: results
        });
    }

    trackFilter(filterType, filterValue) {
        this.sendEvent('filter', {
            filterType,
            filterValue
        });
    }
}

// Initialize tracker when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.amcTracker = new AMCRealTracker();
    });
} else {
    window.amcTracker = new AMCRealTracker();
}

// Export for manual use
window.AMCRealTracker = AMCRealTracker;