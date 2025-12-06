/**
 * AutoMediaCenter Analytics Connector
 * Connects existing amc-analytics.html to real-time data from backend
 */

class AMCAnalyticsConnector {
    constructor() {
        this.apiBase = 'http://localhost:5000/api/v1/analytics';
        this.refreshInterval = 30000; // 30 seconds
        this.isConnected = false;
        this.init();
    }

    getAuthToken() {
        return localStorage.getItem('authToken') || localStorage.getItem('token');
    }

    async fetchRealTimeData() {
        const token = this.getAuthToken();
        if (!token) {
            console.warn('No auth token - cannot fetch analytics data');
            return null;
        }

        try {
            const response = await fetch(`${this.apiBase}/data`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            if (result.success) {
                this.isConnected = true;
                return result.data;
            } else {
                throw new Error(result.error || 'Failed to fetch data');
            }
        } catch (error) {
            console.error('Analytics data fetch error:', error);
            this.isConnected = false;
            return null;
        }
    }

    updateDashboard(data) {
        if (!data) return;

        // Update main statistics
        this.updateElement('totalPageViews', data.totalPageViews);
        this.updateElement('totalDownloads', data.totalDownloads);
        this.updateElement('totalModalOpens', data.totalModalOpens);
        this.updateElement('totalReleaseViews', data.totalReleaseViews);
        this.updateElement('activeUsers', data.activeUsers);
        this.updateElement('totalEvents', data.totalEvents);

        // Update today's statistics
        this.updateElement('todayPageViews', data.todayPageViews);
        this.updateElement('todayDownloads', data.todayDownloads);
        this.updateElement('todayModalOpens', data.todayModalOpens);
        this.updateElement('todayReleaseViews', data.todayReleaseViews);

        // Update charts if they exist
        this.updateHourlyChart(data.hourlyActivity);
        this.updateTopPages(data.topPages);
        this.updateTopDownloads(data.topDownloads);
        this.updateRecentActivity(data.recentEvents);

        // Update connection status
        this.updateConnectionStatus(true, data.lastUpdated);
    }

    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            // Handle different element types
            if (element.tagName === 'INPUT') {
                element.value = value || 0;
            } else {
                element.textContent = value || 0;
            }
        }
    }

    updateHourlyChart(hourlyData) {
        // Try to update Chart.js chart if it exists
        if (window.hourlyChart && hourlyData) {
            window.hourlyChart.data.datasets[0].data = hourlyData;
            window.hourlyChart.update();
        }

        // Also update any table or list showing hourly data
        const hourlyTable = document.getElementById('hourlyActivityTable');
        if (hourlyTable && hourlyData) {
            const tbody = hourlyTable.querySelector('tbody');
            if (tbody) {
                tbody.innerHTML = '';
                hourlyData.forEach((count, hour) => {
                    if (count > 0) {
                        const row = tbody.insertRow();
                        row.insertCell(0).textContent = `${hour}:00`;
                        row.insertCell(1).textContent = count;
                    }
                });
            }
        }
    }

    updateTopPages(topPages) {
        const container = document.getElementById('topPagesContainer') || 
                         document.getElementById('topPages') ||
                         document.querySelector('.top-pages');
        
        if (container && topPages) {
            container.innerHTML = '';
            topPages.forEach((item, index) => {
                const div = document.createElement('div');
                div.className = 'analytics-item';
                div.innerHTML = `
                    <span class="rank">${index + 1}.</span>
                    <span class="name">${item.page}</span>
                    <span class="count">${item.count} views</span>
                `;
                container.appendChild(div);
            });
        }
    }

    updateTopDownloads(topDownloads) {
        const container = document.getElementById('topDownloadsContainer') || 
                         document.getElementById('topDownloads') ||
                         document.querySelector('.top-downloads');
        
        if (container && topDownloads) {
            container.innerHTML = '';
            topDownloads.forEach((item, index) => {
                const div = document.createElement('div');
                div.className = 'analytics-item';
                div.innerHTML = `
                    <span class="rank">${index + 1}.</span>
                    <span class="name">${item.file}</span>
                    <span class="count">${item.count} downloads</span>
                `;
                container.appendChild(div);
            });
        }
    }

    updateRecentActivity(recentEvents) {
        const container = document.getElementById('recentActivityContainer') || 
                         document.getElementById('recentActivity') ||
                         document.querySelector('.recent-activity');
        
        if (container && recentEvents) {
            container.innerHTML = '';
            recentEvents.slice(0, 10).forEach(event => {
                const div = document.createElement('div');
                div.className = 'activity-item';
                const time = new Date(event.timestamp).toLocaleTimeString();
                const eventText = this.formatEventText(event);
                div.innerHTML = `
                    <span class="time">${time}</span>
                    <span class="event">${eventText}</span>
                `;
                container.appendChild(div);
            });
        }
    }

    formatEventText(event) {
        switch (event.type) {
            case 'page_view':
                return `Page view: ${event.data.page}`;
            case 'download':
                return `Download: ${event.data.fileName}`;
            case 'modal_open':
                return `Modal opened: ${event.data.modalType}`;
            case 'release_view':
                return `Release viewed: ${event.data.releaseTitle || event.data.releaseId}`;
            case 'search':
                return `Search: "${event.data.query}"`;
            default:
                return `${event.type}: ${JSON.stringify(event.data).substring(0, 50)}`;
        }
    }

    updateConnectionStatus(connected, lastUpdated) {
        const statusElement = document.getElementById('connectionStatus') || 
                             document.querySelector('.connection-status');
        
        if (statusElement) {
            if (connected) {
                statusElement.innerHTML = `
                    <span class="status-indicator connected"></span>
                    Connected - Last updated: ${new Date(lastUpdated).toLocaleTimeString()}
                `;
                statusElement.className = 'connection-status connected';
            } else {
                statusElement.innerHTML = `
                    <span class="status-indicator disconnected"></span>
                    Disconnected - Check authentication
                `;
                statusElement.className = 'connection-status disconnected';
            }
        }
    }

    async init() {
        console.log('AMC Analytics Connector initializing...');
        
        // Initial data fetch
        const data = await this.fetchRealTimeData();
        if (data) {
            this.updateDashboard(data);
            console.log('Analytics dashboard updated with real data');
        }

        // Set up periodic refresh
        setInterval(async () => {
            const data = await this.fetchRealTimeData();
            if (data) {
                this.updateDashboard(data);
            }
        }, this.refreshInterval);

        // Add refresh button functionality
        const refreshBtn = document.getElementById('refreshAnalytics') || 
                          document.querySelector('.refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                refreshBtn.disabled = true;
                refreshBtn.textContent = 'Refreshing...';
                
                const data = await this.fetchRealTimeData();
                if (data) {
                    this.updateDashboard(data);
                }
                
                refreshBtn.disabled = false;
                refreshBtn.textContent = 'Refresh';
            });
        }

        console.log(`Analytics connector initialized. Refreshing every ${this.refreshInterval/1000} seconds.`);
    }

    // Manual refresh method
    async refresh() {
        const data = await this.fetchRealTimeData();
        if (data) {
            this.updateDashboard(data);
            return true;
        }
        return false;
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.amcAnalyticsConnector = new AMCAnalyticsConnector();
    });
} else {
    window.amcAnalyticsConnector = new AMCAnalyticsConnector();
}

// Add some basic CSS for the connection status if it doesn't exist
if (!document.querySelector('style[data-amc-analytics]')) {
    const style = document.createElement('style');
    style.setAttribute('data-amc-analytics', 'true');
    style.textContent = `
        .connection-status {
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 0.9em;
            margin: 10px 0;
        }
        .connection-status.connected {
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .connection-status.disconnected {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .status-indicator {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 8px;
        }
        .status-indicator.connected {
            background-color: #28a745;
        }
        .status-indicator.disconnected {
            background-color: #dc3545;
        }
        .analytics-item {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
            border-bottom: 1px solid #eee;
        }
        .activity-item {
            display: flex;
            justify-content: space-between;
            padding: 3px 0;
            font-size: 0.9em;
        }
        .activity-item .time {
            color: #666;
            font-size: 0.8em;
        }
    `;
    document.head.appendChild(style);
}

// Export for manual use
window.AMCAnalyticsConnector = AMCAnalyticsConnector;