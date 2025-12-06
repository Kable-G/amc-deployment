// AMC Analytics Real-time Features
// This file adds real-time updates and live activity feeds to the analytics dashboard

class AMCAnalyticsRealtime {
    constructor() {
        this.API_BASE_URL = 'http://localhost:5000';
        this.updateInterval = 30000; // 30 seconds
        this.activityInterval = 5000; // 5 seconds for activity feed
        this.intervals = [];
        this.isActive = true;
        
        this.init();
    }
    
    init() {
        console.log('Initializing AMC Analytics Real-time features...');
        
        // Start real-time updates when page loads
        document.addEventListener('DOMContentLoaded', () => {
            this.startRealTimeUpdates();
            this.initActivityFeed();
            this.initLiveIndicators();
            this.setupVisibilityHandling();
        });
    }
    
    startRealTimeUpdates() {
        console.log('Starting real-time analytics updates...');
        
        // Update KPIs every 30 seconds
        const kpiInterval = setInterval(() => {
            if (this.isActive) {
                this.updateKPIsRealtime();
            }
        }, this.updateInterval);
        
        // Update activity feed every 5 seconds
        const activityInterval = setInterval(() => {
            if (this.isActive) {
                this.updateActivityFeed();
            }
        }, this.activityInterval);
        
        // Update charts every 60 seconds
        const chartInterval = setInterval(() => {
            if (this.isActive) {
                this.updateChartsRealtime();
            }
        }, 60000);
        
        this.intervals.push(kpiInterval, activityInterval, chartInterval);
    }
    
    async updateKPIsRealtime() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/api/v1/amc-analytics/overview?dateRange=${currentDateRange || '30'}`);
            if (!response.ok) return;
            
            const data = await response.json();
            if (data.success && data.data && data.data.kpis) {
                this.animateKPIUpdate(data.data.kpis);
            }
        } catch (error) {
            console.error('Error updating KPIs in real-time:', error);
        }
    }
    
    animateKPIUpdate(kpis) {
        // Animate total downloads
        if (kpis.totalDownloads) {
            this.animateNumber('kpiTotalDownloads', kpis.totalDownloads.value);
        }
        
        // Animate unique users
        if (kpis.uniqueUsers) {
            this.animateNumber('kpiUniqueUsers', kpis.uniqueUsers.value);
        }
        
        // Update top asset and release
        if (kpis.topAsset) {
            this.updateTextWithAnimation('kpiTopAsset', kpis.topAsset.value);
        }
        
        if (kpis.topRelease) {
            this.updateTextWithAnimation('kpiTopRelease', kpis.topRelease.value);
        }
    }
    
    animateNumber(elementId, newValue) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const currentValue = parseInt(element.textContent.replace(/,/g, '')) || 0;
        const difference = newValue - currentValue;
        
        if (difference === 0) return;
        
        // Add pulse animation for changes
        element.style.transition = 'all 0.3s ease';
        element.style.transform = 'scale(1.05)';
        element.style.color = difference > 0 ? 'var(--color-success)' : 'var(--color-warning)';
        
        // Animate the number change
        const duration = 1000;
        const steps = 20;
        const stepValue = difference / steps;
        let currentStep = 0;
        
        const numberInterval = setInterval(() => {
            currentStep++;
            const displayValue = Math.round(currentValue + (stepValue * currentStep));
            element.textContent = displayValue.toLocaleString();
            
            if (currentStep >= steps) {
                clearInterval(numberInterval);
                element.textContent = newValue.toLocaleString();
                
                // Reset styles
                setTimeout(() => {
                    element.style.transform = 'scale(1)';
                    element.style.color = '';
                }, 300);
            }
        }, duration / steps);
    }
    
    updateTextWithAnimation(elementId, newText) {
        const element = document.getElementById(elementId);
        if (!element || element.textContent === newText) return;
        
        // Fade out, change text, fade in
        element.style.transition = 'opacity 0.3s ease';
        element.style.opacity = '0.5';
        
        setTimeout(() => {
            element.textContent = newText;
            element.style.opacity = '1';
        }, 300);
    }
    
    async updateActivityFeed() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/api/v1/amc-analytics/real-time-activity?limit=10`);
            if (!response.ok) return;
            
            const data = await response.json();
            if (data.success && data.data) {
                this.renderActivityFeed(data.data);
            }
        } catch (error) {
            console.error('Error updating activity feed:', error);
        }
    }
    
    renderActivityFeed(activities) {
        const streamContainer = document.getElementById('activityStream');
        if (!streamContainer) return;
        
        // Clear existing activities
        streamContainer.innerHTML = '';
        
        if (activities.length === 0) {
            streamContainer.innerHTML = `
                <div class="activity-item">
                    <div class="activity-icon user">
                        <i class="fas fa-clock"></i>
                    </div>
                    <div class="activity-details">
                        <div class="activity-title">No recent activity</div>
                        <div class="activity-meta">Waiting for user interactions...</div>
                    </div>
                    <div class="activity-time">now</div>
                </div>
            `;
            return;
        }
        
        activities.forEach((activity, index) => {
            const activityItem = this.createActivityItem(activity);
            activityItem.style.animationDelay = `${index * 0.1}s`;
            streamContainer.appendChild(activityItem);
        });
    }
    
    createActivityItem(activity) {
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        
        const iconClass = this.getActivityIcon(activity.interactionType);
        const iconColor = this.getActivityIconColor(activity.interactionType);
        const title = this.getActivityTitle(activity);
        const meta = this.getActivityMeta(activity);
        const timeAgo = this.getTimeAgo(activity.timestamp);
        
        activityItem.innerHTML = `
            <div class="activity-icon ${iconColor}">
                <i class="${iconClass}"></i>
            </div>
            <div class="activity-details">
                <div class="activity-title">${title}</div>
                <div class="activity-meta">${meta}</div>
            </div>
            <div class="activity-time">${timeAgo}</div>
        `;
        
        return activityItem;
    }
    
    getActivityIcon(interactionType) {
        const icons = {
            'asset_download': 'fas fa-download',
            'page_view': 'fas fa-eye',
            'asset_quick_view': 'fas fa-search',
            'search_query': 'fas fa-search',
            'filter_applied': 'fas fa-filter',
            'pagination': 'fas fa-list'
        };
        return icons[interactionType] || 'fas fa-user';
    }
    
    getActivityIconColor(interactionType) {
        const colors = {
            'asset_download': 'download',
            'page_view': 'view',
            'asset_quick_view': 'view',
            'search_query': 'user',
            'filter_applied': 'user',
            'pagination': 'user'
        };
        return colors[interactionType] || 'user';
    }
    
    getActivityTitle(activity) {
        switch (activity.interactionType) {
            case 'asset_download':
                return `${activity.assetName || 'Asset'} downloaded`;
            case 'page_view':
                return `${activity.releaseTitle || 'Page'} viewed`;
            case 'asset_quick_view':
                return `${activity.assetName || 'Asset'} quick view`;
            case 'search_query':
                return `Search: "${activity.searchQuery || 'query'}"`;
            case 'filter_applied':
                return 'Filters applied';
            case 'pagination':
                return 'Page navigation';
            default:
                return 'User activity';
        }
    }
    
    getActivityMeta(activity) {
        const userEmail = activity.userEmail || 'Unknown user';
        const location = activity.region || activity.country || 'Unknown location';
        return `by ${userEmail} from ${location}`;
    }
    
    getTimeAgo(timestamp) {
        const now = new Date();
        const activityTime = new Date(timestamp);
        const diffMs = now - activityTime;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    }
    
    async updateChartsRealtime() {
        try {
            // Only update if the loadAnalyticsData function exists
            if (typeof window.loadAnalyticsData === 'function') {
                console.log('Updating charts with latest data...');
                await window.loadAnalyticsData();
            }
        } catch (error) {
            console.error('Error updating charts in real-time:', error);
        }
    }
    
    initActivityFeed() {
        // Initialize with some sample activity if no real data
        const streamContainer = document.getElementById('activityStream');
        if (!streamContainer) return;
        
        // Start with initial load
        this.updateActivityFeed();
    }
    
    initLiveIndicators() {
        // Add pulsing animation to live indicators
        const liveIndicators = document.querySelectorAll('[id*="live"], .live-indicator');
        liveIndicators.forEach(indicator => {
            const circle = indicator.querySelector('i.fa-circle');
            if (circle) {
                circle.style.animation = 'pulse 2s infinite';
            }
        });
        
        // Add CSS for pulse animation if not exists
        if (!document.querySelector('#pulse-animation-style')) {
            const style = document.createElement('style');
            style.id = 'pulse-animation-style';
            style.textContent = `
                @keyframes pulse {
                    0% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.1); }
                    100% { opacity: 1; transform: scale(1); }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    setupVisibilityHandling() {
        // Pause updates when tab is not visible
        document.addEventListener('visibilitychange', () => {
            this.isActive = !document.hidden;
            console.log(`Analytics real-time updates ${this.isActive ? 'resumed' : 'paused'}`);
        });
        
        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
    }
    
    cleanup() {
        console.log('Cleaning up real-time analytics...');
        this.intervals.forEach(interval => clearInterval(interval));
        this.intervals = [];
    }
    
    // Public methods for manual control
    pause() {
        this.isActive = false;
        console.log('Real-time analytics paused');
    }
    
    resume() {
        this.isActive = true;
        console.log('Real-time analytics resumed');
    }
    
    forceUpdate() {
        console.log('Forcing analytics update...');
        this.updateKPIsRealtime();
        this.updateActivityFeed();
        this.updateChartsRealtime();
    }
}

// Initialize real-time analytics
const amcRealtime = new AMCAnalyticsRealtime();

// Make it globally available
window.amcRealtime = amcRealtime;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AMCAnalyticsRealtime;
}