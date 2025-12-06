// AMC Analytics API Integration - Corrected endpoint names
// This file contains the JavaScript code to integrate with the real analytics API

// Replace the existing JavaScript in amc-analytics.html with this corrected version

// Global variables for analytics
const API_BASE_URL = 'http://localhost:5000';
let currentDateRange = '30';
let analyticsData = {};

document.addEventListener('DOMContentLoaded', () => {
    window.allCharts = {};
    window.scene3D = null;
    window.renderer3D = null;
    window.camera3D = null;
    window.animationId = null;
    
    const darkModeToggle = document.getElementById('darkModeToggleHeader');
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const dateRangeFilter = document.getElementById('dateRangeFilter');
    const refreshButton = document.getElementById('refreshButton');
    
    if (sidebarToggle) { sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('collapsed')); }
    
    const applyTheme = (theme) => {
        document.body.classList.toggle('dark-mode', theme === 'dark');
        if (darkModeToggle) darkModeToggle.querySelector('i').className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        setTimeout(() => renderAllVisuals(), 100); // Delay to allow CSS variables to update
    };
    
    if(darkModeToggle) {
        const currentTheme = localStorage.getItem('theme') || (window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light');
        applyTheme(currentTheme);
        darkModeToggle.addEventListener('click', () => {
            const newTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
            localStorage.setItem('theme', newTheme);
            applyTheme(newTheme);
        });
    }

    // Date range filter
    if (dateRangeFilter) {
        dateRangeFilter.addEventListener('change', (e) => {
            currentDateRange = e.target.value;
            loadAnalyticsData();
        });
    }

    // Refresh button
    if (refreshButton) {
        refreshButton.addEventListener('click', () => {
            loadAnalyticsData();
        });
    }

    // Load analytics data on page load
    loadAnalyticsData();

    // Analytics API functions with CORRECTED endpoint names
    async function loadAnalyticsData() {
        try {
            showLoadingState();
            
            console.log('Loading analytics data for date range:', currentDateRange);
            
            // Load all analytics data in parallel with CORRECT endpoint names
            const [overview, downloadsOverTime, assetTypes, regions, engagement, topReleases, topAssets, topUsers, heatmapData] = await Promise.all([
                fetchAnalyticsOverview(),
                fetchDownloadsOverTime(),
                fetchDownloadsByAssetType(), // CORRECTED: was fetchDownloadsByAssetType
                fetchDownloadsByRegion(),
                fetchEngagementBreakdown(),
                fetchTopReleases(),
                fetchTopAssets(),
                fetchTopUsers(),
                fetchHeatmapData()
            ]);
            
            // Store data globally
            analyticsData = {
                overview,
                downloadsOverTime,
                assetTypes,
                regions,
                engagement,
                topReleases,
                topAssets,
                topUsers,
                heatmapData
            };
            
            console.log('Analytics data loaded:', analyticsData);
            
            // Update UI with real data
            updateKPIs(overview);
            renderAllVisuals();
            hideLoadingState();
            
        } catch (error) {
            console.error('Error loading analytics data:', error);
            showErrorState('Failed to load analytics data. Please try again.');
        }
    }
    
    async function fetchAnalyticsOverview() {
        const response = await fetch(`${API_BASE_URL}/api/v1/amc-analytics/overview?dateRange=${currentDateRange}`);
        if (!response.ok) throw new Error('Failed to fetch overview');
        return await response.json();
    }
    
    async function fetchDownloadsOverTime() {
        const response = await fetch(`${API_BASE_URL}/api/v1/amc-analytics/downloads-over-time?dateRange=${currentDateRange}`);
        if (!response.ok) throw new Error('Failed to fetch downloads over time');
        return await response.json();
    }
    
    async function fetchDownloadsByAssetType() {
        // CORRECTED endpoint name
        const response = await fetch(`${API_BASE_URL}/api/v1/amc-analytics/downloads-by-asset-type?dateRange=${currentDateRange}`);
        if (!response.ok) throw new Error('Failed to fetch asset types');
        return await response.json();
    }
    
    async function fetchDownloadsByRegion() {
        // CORRECTED endpoint name
        const response = await fetch(`${API_BASE_URL}/api/v1/amc-analytics/downloads-by-region?dateRange=${currentDateRange}`);
        if (!response.ok) throw new Error('Failed to fetch regional data');
        return await response.json();
    }
    
    async function fetchEngagementBreakdown() {
        // CORRECTED endpoint name
        const response = await fetch(`${API_BASE_URL}/api/v1/amc-analytics/engagement-breakdown?dateRange=${currentDateRange}`);
        if (!response.ok) throw new Error('Failed to fetch engagement data');
        return await response.json();
    }
    
    async function fetchTopReleases() {
        const response = await fetch(`${API_BASE_URL}/api/v1/amc-analytics/top-releases?dateRange=${currentDateRange}&limit=10`);
        if (!response.ok) throw new Error('Failed to fetch top releases');
        return await response.json();
    }
    
    async function fetchTopAssets() {
        const response = await fetch(`${API_BASE_URL}/api/v1/amc-analytics/top-assets?dateRange=${currentDateRange}&limit=10`);
        if (!response.ok) throw new Error('Failed to fetch top assets');
        return await response.json();
    }
    
    async function fetchTopUsers() {
        const response = await fetch(`${API_BASE_URL}/api/v1/amc-analytics/top-users?dateRange=${currentDateRange}&limit=10`);
        if (!response.ok) throw new Error('Failed to fetch top users');
        return await response.json();
    }
    
    async function fetchHeatmapData() {
        // CORRECTED endpoint name
        const response = await fetch(`${API_BASE_URL}/api/v1/amc-analytics/hourly-heatmap?dateRange=${currentDateRange}`);
        if (!response.ok) throw new Error('Failed to fetch heatmap data');
        return await response.json();
    }
    
    function updateKPIs(overview) {
        if (!overview || !overview.data || !overview.data.kpis) {
            console.log('No KPI data available');
            return;
        }
        
        const kpis = overview.data.kpis;
        
        // Update KPI values with real data
        if (kpis.totalDownloads) {
            document.getElementById('kpiTotalDownloads').textContent = kpis.totalDownloads.value?.toLocaleString() || '0';
        }
        if (kpis.uniqueUsers) {
            document.getElementById('kpiUniqueUsers').textContent = kpis.uniqueUsers.value?.toLocaleString() || '0';
        }
        if (kpis.topAsset) {
            document.getElementById('kpiTopAsset').textContent = kpis.topAsset.value || 'No data';
        }
        if (kpis.topRelease) {
            document.getElementById('kpiTopRelease').textContent = kpis.topRelease.value || 'No data';
        }
        
        console.log('KPIs updated with real data:', kpis);
    }
    
    function showLoadingState() {
        // Add loading indicators to charts
        document.querySelectorAll('.chart-container .card-body').forEach(container => {
            if (!container.querySelector('.loading-indicator')) {
                const loader = document.createElement('div');
                loader.className = 'loading-indicator';
                loader.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
                loader.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: var(--text-secondary); z-index: 1000;';
                container.style.position = 'relative';
                container.appendChild(loader);
            }
        });
    }
    
    function hideLoadingState() {
        document.querySelectorAll('.loading-indicator').forEach(loader => loader.remove());
    }
    
    function showErrorState(message) {
        hideLoadingState();
        console.error(message);
        // You could add a toast notification here
    }

    // CORRECTED chart rendering functions to use real data structure
    function renderDownloadsOverTime() {
        const ctx = document.getElementById('downloadsOverTimeChart').getContext('2d');
        const colors = getChartColors();
        
        // Use real data if available, fallback to demo data
        const realData = analyticsData.downloadsOverTime?.data || [];
        console.log('Downloads over time data:', realData);
        
        let labels, downloadData;
        
        if (realData.length > 0) {
            // Format real data - the API returns date objects, we need to format them
            labels = realData.map(d => {
                if (d.date && d.date.year && d.date.month && d.date.day) {
                    return `${d.date.month}/${d.date.day}`;
                }
                return 'Unknown';
            });
            downloadData = realData.map(d => d.downloads || 0);
        } else {
            // Fallback demo data
            labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            downloadData = [120, 190, 300, 500, 200, 320, 450];
        }
        
        const barGradient = createGradient(ctx, colors[0] + '80', colors[0] + '20');
        
        const data = { 
            labels: labels, 
            datasets: [
                { 
                    label: 'Downloads', 
                    data: downloadData, 
                    backgroundColor: barGradient,
                    borderColor: colors[0],
                    borderWidth: 2,
                    borderRadius: 8,
                    borderSkipped: false,
                }
            ] 
        };
        
        if (window.allCharts['downloadsOverTimeChart']) {
            window.allCharts['downloadsOverTimeChart'].destroy();
        }
        
        window.allCharts['downloadsOverTimeChart'] = new Chart(ctx, { 
            type: 'bar', 
            data: data, 
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                animation: {
                    duration: 2000,
                    easing: 'easeOutQuart'
                },
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: colors[0],
                        borderWidth: 1,
                        cornerRadius: 8
                    }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: { grid: { color: 'rgba(0,0,0,0.1)' } }
                }
            } 
        });
    }

    function renderDownloadsByAssetType() {
        const canvas = document.getElementById('downloadsByAssetTypeChart');
        const ctx = canvas.getContext('2d');
        const colors = getChartColors();
        
        // Use real data if available
        const realData = analyticsData.assetTypes?.data || [];
        console.log('Asset types data:', realData);
        
        let labels, downloadData;
        
        if (realData.length > 0) {
            // Use real data structure: assetType and downloads
            labels = realData.map(d => d.assetType || 'Unknown');
            downloadData = realData.map(d => d.downloads || 0);
        } else {
            // Fallback demo data
            labels = ['Images', 'Videos', 'Documents', 'Other'];
            downloadData = [6500, 3500, 1993, 850];
        }
        
        const data = { 
            labels: labels, 
            datasets: [{ 
                data: downloadData, 
                backgroundColor: colors.slice(0, labels.length).map(c => c + 'E6'),
                borderColor: colors.slice(0, labels.length),
                borderWidth: 3,
                hoverBorderWidth: 5,
                hoverOffset: 10
            }] 
        };
        
        if (window.allCharts['downloadsByAssetTypeChart']) {
            window.allCharts['downloadsByAssetTypeChart'].destroy();
        }
        
        window.allCharts['downloadsByAssetTypeChart'] = new Chart(ctx, { 
            type: 'doughnut', 
            data: data, 
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                animation: { animateRotate: true, duration: 2000 },
                cutout: '60%',
                plugins: { 
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed * 100) / total).toFixed(1);
                                return `${context.label}: ${context.parsed.toLocaleString()} (${percentage}%)`;
                            }
                        }
                    }
                } 
            } 
        });
    }

    function renderTopReleasesTable() {
        const table = document.getElementById('topReleasesTable');
        const realData = analyticsData.topReleases?.data || [];
        console.log('Top releases data:', realData);
        
        // Use real data if available, fallback to demo data
        const data = realData.length > 0 ? realData.slice(0, 10).map((item, index) => ({
            rank: index + 1,
            title: item.releaseTitle || 'Unknown Release',
            downloads: item.downloads || 0
        })) : [
            { rank: 1, title: 'Global Reveal of the "Electron" Concept', downloads: 2105 }, 
            { rank: 2, title: 'New V8 Engine Technical Specs Released', downloads: 1840 }, 
            { rank: 3, title: 'Q3 Financial Results & Outlook', downloads: 1532 }
        ];
        
        let tableHtml = '<thead><tr><th class="rank-col">#</th><th class="truncate">Release Title</th><th>Total Downloads</th></tr></thead><tbody>';
        data.forEach(item => { 
            tableHtml += `<tr><td class="rank-col">${item.rank}</td><td class="truncate" title="${item.title}">${item.title}</td><td>${item.downloads.toLocaleString()}</td></tr>`; 
        });
        table.innerHTML = tableHtml + '</tbody>';
    }

    function renderTopAssetsTable() {
        const table = document.getElementById('topAssetsTable');
        const realData = analyticsData.topAssets?.data || [];
        console.log('Top assets data:', realData);
        
        const data = realData.length > 0 ? realData.slice(0, 10).map((item, index) => ({
            rank: index + 1,
            name: item.assetName || 'Unknown Asset',
            release: item.releaseTitle || 'Unknown Release',
            downloads: item.downloads || 0
        })) : [
            { rank: 1, name: 'hero_image_01.jpg', release: 'Global Reveal', downloads: 450 }, 
            { rank: 2, name: 'B-Roll_final.mp4', release: 'Factory Tour', downloads: 320 }
        ];
        
        let tableHtml = '<thead><tr><th class="rank-col">#</th><th class="truncate">Asset Name</th><th class="truncate">From Release</th><th>Downloads</th></tr></thead><tbody>';
        data.forEach(item => { 
            tableHtml += `<tr><td class="rank-col">${item.rank}</td><td class="truncate" title="${item.name}">${item.name}</td><td class="truncate" title="${item.release}">${item.release}</td><td>${item.downloads.toLocaleString()}</td></tr>`; 
        });
        table.innerHTML = tableHtml + '</tbody>';
    }

    function renderTopUsersTable() {
        const table = document.getElementById('topUsersTable');
        const realData = analyticsData.topUsers?.data || [];
        console.log('Top users data:', realData);
        
        const data = realData.length > 0 ? realData.slice(0, 10).map((item, index) => ({
            rank: index + 1,
            user: item.userEmail || 'Unknown User',
            outlet: item.userDetails?.name || 'Unknown Outlet',
            downloads: item.downloads || 0
        })) : [
            { rank: 1, user: 'j.smith@autoweekly.com', outlet: 'AutoWeekly', downloads: 890 }, 
            { rank: 2, user: 'r.davis@motortrend.com', outlet: 'MotorTrend', downloads: 750 }
        ];
        
        let tableHtml = '<thead><tr><th class="rank-col">#</th><th class="truncate">User</th><th class="truncate">Outlet</th><th>Downloads</th></tr></thead><tbody>';
        data.forEach(item => { 
            tableHtml += `<tr><td class="rank-col">${item.rank}</td><td class="truncate" title="${item.user}">${item.user}</td><td class="truncate" title="${item.outlet}">${item.outlet}</td><td>${item.downloads.toLocaleString()}</td></tr>`; 
        });
        table.innerHTML = tableHtml + '</tbody>';
    }

    // Make functions available globally
    window.loadAnalyticsData = loadAnalyticsData;
    window.renderDownloadsOverTime = renderDownloadsOverTime;
    window.renderDownloadsByAssetType = renderDownloadsByAssetType;
    window.renderTopReleasesTable = renderTopReleasesTable;
    window.renderTopAssetsTable = renderTopAssetsTable;
    window.renderTopUsersTable = renderTopUsersTable;
});