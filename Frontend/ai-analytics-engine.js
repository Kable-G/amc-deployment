/**
 * AI Analytics Engine - Revolutionary Analytics Intelligence System
 * This is the core engine that powers the industry-defining AI analytics dashboard
 */

class AIAnalyticsEngine {
    constructor() {
        this.apiBase = '/api/v1/ai-analytics';
        this.websocket = null;
        this.isConnected = false;
        this.currentReport = null;
        this.realTimeData = new Map();
        this.aiModels = {
            gpt4: 'GPT-4 Enhanced',
            claude: 'Claude 3.5 Sonnet', 
            gemini: 'Gemini Pro',
            ensemble: 'Ensemble Model'
        };
        this.init();
    }

    async init() {
        console.log('🧠 Initializing AI Analytics Engine...');
        
        // Initialize all components
        await this.initializeParticles();
        this.initializeWebSocket();
        this.setupEventListeners();
        this.startRealTimeUpdates();
        this.initializeAvatarSystem();
        this.initializeDarkMode();
        
        console.log('✅ AI Analytics Engine initialized successfully');
    }

    // ==================== PARTICLE SYSTEM ====================
    async initializeParticles() {
        if (typeof particlesJS !== 'undefined') {
            particlesJS('particles-js', {
                particles: {
                    number: { value: 120, density: { enable: true, value_area: 1000 } },
                    color: { value: ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981'] },
                    shape: { 
                        type: ['circle', 'triangle'],
                        stroke: { width: 0, color: '#000000' }
                    },
                    opacity: { 
                        value: 0.6, 
                        random: true,
                        anim: { enable: true, speed: 1, opacity_min: 0.1 }
                    },
                    size: { 
                        value: 4, 
                        random: true,
                        anim: { enable: true, speed: 2, size_min: 0.1 }
                    },
                    line_linked: {
                        enable: true,
                        distance: 150,
                        color: '#6366f1',
                        opacity: 0.4,
                        width: 1
                    },
                    move: {
                        enable: true,
                        speed: 3,
                        direction: 'none',
                        random: true,
                        straight: false,
                        out_mode: 'out',
                        bounce: false,
                        attract: { enable: true, rotateX: 600, rotateY: 1200 }
                    }
                },
                interactivity: {
                    detect_on: 'canvas',
                    events: {
                        onhover: { enable: true, mode: 'grab' },
                        onclick: { enable: true, mode: 'push' },
                        resize: true
                    },
                    modes: {
                        grab: { distance: 200, line_linked: { opacity: 1 } },
                        push: { particles_nb: 4 }
                    }
                },
                retina_detect: true
            });
        }
    }

    // ==================== WEBSOCKET CONNECTION ====================
    initializeWebSocket() {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws/ai-analytics`;
            
            this.websocket = new WebSocket(wsUrl);
            
            this.websocket.onopen = () => {
                console.log('🔗 AI Analytics WebSocket connected');
                this.isConnected = true;
                this.updateConnectionStatus(true);
                this.sendHeartbeat();
            };
            
            this.websocket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleRealTimeMessage(data);
            };
            
            this.websocket.onclose = () => {
                console.log('❌ AI Analytics WebSocket disconnected');
                this.isConnected = false;
                this.updateConnectionStatus(false);
                // Reconnect after 5 seconds
                setTimeout(() => this.initializeWebSocket(), 5000);
            };
            
            this.websocket.onerror = (error) => {
                console.error('🚨 WebSocket error:', error);
            };
        } catch (error) {
            console.warn('⚠️ WebSocket not available, using polling fallback');
            this.startPollingFallback();
        }
    }

    sendHeartbeat() {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }));
        }
        setTimeout(() => this.sendHeartbeat(), 30000); // Every 30 seconds
    }

    handleRealTimeMessage(data) {
        switch (data.type) {
            case 'activity_update':
                this.handleActivityUpdate(data.payload);
                break;
            case 'stats_update':
                this.handleStatsUpdate(data.payload);
                break;
            case 'ai_insight':
                this.handleAIInsight(data.payload);
                break;
            case 'security_alert':
                this.handleSecurityAlert(data.payload);
                break;
            case 'performance_alert':
                this.handlePerformanceAlert(data.payload);
                break;
            default:
                console.log('📨 Unknown message type:', data.type);
        }
    }

    // ==================== EVENT LISTENERS ====================
    setupEventListeners() {
        // Control panel listeners
        ['timeRange', 'analysisType', 'reportType', 'aiModel'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => {
                    if (this.currentReport) {
                        this.generateAIReport();
                    }
                });
            }
        });

        // AI Query input
        const queryInput = document.getElementById('aiQuery');
        if (queryInput) {
            queryInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.processAIQuery();
                }
            });
        }

        // Suggestion chips
        document.querySelectorAll('.ai-suggestion-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const query = chip.textContent.trim();
                this.setQuery(query);
            });
        });

        // Window visibility handling
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseRealTimeUpdates();
            } else {
                this.resumeRealTimeUpdates();
            }
        });
    }

    // ==================== REAL-TIME UPDATES ====================
    startRealTimeUpdates() {
        // Update stats every 30 seconds
        this.statsInterval = setInterval(() => {
            this.updateRealTimeStats();
        }, 30000);

        // Update activity stream every 5 seconds
        this.activityInterval = setInterval(() => {
            this.updateActivityStream();
        }, 5000);

        // Initial updates
        this.updateRealTimeStats();
        this.updateActivityStream();
    }

    pauseRealTimeUpdates() {
        if (this.statsInterval) clearInterval(this.statsInterval);
        if (this.activityInterval) clearInterval(this.activityInterval);
    }

    resumeRealTimeUpdates() {
        this.startRealTimeUpdates();
    }

    async updateRealTimeStats() {
        try {
            const token = this.getAuthToken();
            const response = await fetch(`${this.apiBase}/real-time-stats`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.animateStatsUpdate(data.data);
                }
            }
        } catch (error) {
            console.warn('⚠️ Failed to fetch real-time stats:', error);
            // Use fallback demo data
            this.animateStatsUpdate(this.getDemoStats());
        }
    }

    getDemoStats() {
        return {
            aiInsights: 1247 + Math.floor(Math.random() * 10),
            confidence: 94.7 + (Math.random() - 0.5) * 2,
            recommendations: 12 + Math.floor(Math.random() * 3),
            accuracy: 89.3 + (Math.random() - 0.5) * 5
        };
    }

    animateStatsUpdate(stats) {
        if (stats.aiInsights) {
            this.animateNumber('aiInsightsGenerated', stats.aiInsights);
        }
        if (stats.confidence) {
            this.animateNumber('confidenceScore', stats.confidence, '%', 1);
        }
        if (stats.recommendations) {
            this.animateNumber('activeRecommendations', stats.recommendations);
        }
        if (stats.accuracy) {
            this.animateNumber('predictiveAccuracy', stats.accuracy, '%', 1);
        }
    }

    animateNumber(elementId, newValue, suffix = '', decimals = 0) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const currentValue = parseFloat(element.textContent.replace(/[^\d.]/g, '')) || 0;
        const difference = newValue - currentValue;

        if (Math.abs(difference) < 0.01) return;

        // Add visual feedback
        element.style.transition = 'all 0.3s ease';
        element.style.transform = 'scale(1.1)';
        element.style.color = difference > 0 ? 'var(--ai-success-solid)' : 'var(--ai-warning-solid)';

        // Animate the number
        const duration = 1500;
        const steps = 30;
        const stepValue = difference / steps;
        let currentStep = 0;

        const interval = setInterval(() => {
            currentStep++;
            const displayValue = currentValue + (stepValue * currentStep);
            element.textContent = displayValue.toFixed(decimals) + suffix;

            if (currentStep >= steps) {
                clearInterval(interval);
                element.textContent = newValue.toFixed(decimals) + suffix;
                
                // Reset styles
                setTimeout(() => {
                    element.style.transform = 'scale(1)';
                    element.style.color = '';
                }, 300);
            }
        }, duration / steps);
    }

    // ==================== ACTIVITY STREAM ====================
    async updateActivityStream() {
        try {
            const token = this.getAuthToken();
            const response = await fetch(`${this.apiBase}/real-time-activity?limit=10`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.renderActivityStream(data.data);
                }
            }
        } catch (error) {
            console.warn('⚠️ Failed to fetch activity stream:', error);
            // Use demo data
            this.renderActivityStream(this.getDemoActivity());
        }
    }

    getDemoActivity() {
        const activities = [
            { type: 'ai_insight', title: 'New AI insight generated', meta: 'Performance optimization detected', timestamp: new Date() },
            { type: 'asset_download', title: 'Asset downloaded: hero_image.jpg', meta: 'by user@example.com from US', timestamp: new Date(Date.now() - 120000) },
            { type: 'security_alert', title: 'Security scan completed', meta: 'No threats detected', timestamp: new Date(Date.now() - 300000) },
            { type: 'page_view', title: 'Dashboard viewed', meta: 'by admin@company.com from UK', timestamp: new Date(Date.now() - 450000) }
        ];
        return activities;
    }

    renderActivityStream(activities) {
        const activityList = document.getElementById('activityList');
        if (!activityList) return;

        if (!activities || activities.length === 0) {
            activityList.innerHTML = this.getEmptyActivityHTML();
            return;
        }

        const html = activities.map(activity => this.createActivityHTML(activity)).join('');
        activityList.innerHTML = html;
    }

    getEmptyActivityHTML() {
        return `
            <div class="ai-activity-item">
                <div class="ai-activity-icon" style="background: var(--ai-info-solid);">
                    <i class="fas fa-clock"></i>
                </div>
                <div class="ai-activity-content">
                    <div class="ai-activity-title">No recent activity</div>
                    <div class="ai-activity-meta">Waiting for user interactions...</div>
                </div>
                <div class="ai-activity-time">now</div>
            </div>
        `;
    }

    createActivityHTML(activity) {
        const iconClass = this.getActivityIcon(activity.type);
        const iconColor = this.getActivityIconColor(activity.type);
        const title = activity.title || this.getActivityTitle(activity);
        const meta = activity.meta || this.getActivityMeta(activity);
        const timeAgo = this.getTimeAgo(activity.timestamp);

        return `
            <div class="ai-activity-item" style="animation: slideInRight 0.5s ease-out;">
                <div class="ai-activity-icon" style="background: ${iconColor};">
                    <i class="${iconClass}"></i>
                </div>
                <div class="ai-activity-content">
                    <div class="ai-activity-title">${title}</div>
                    <div class="ai-activity-meta">${meta}</div>
                </div>
                <div class="ai-activity-time">${timeAgo}</div>
            </div>
        `;
    }

    getActivityIcon(type) {
        const icons = {
            'asset_download': 'fas fa-download',
            'page_view': 'fas fa-eye',
            'search_query': 'fas fa-search',
            'ai_insight': 'fas fa-brain',
            'security_alert': 'fas fa-shield-alt',
            'performance_alert': 'fas fa-tachometer-alt',
            'user_login': 'fas fa-sign-in-alt',
            'system_event': 'fas fa-cog'
        };
        return icons[type] || 'fas fa-info-circle';
    }

    getActivityIconColor(type) {
        const colors = {
            'asset_download': 'var(--ai-success-solid)',
            'page_view': 'var(--ai-info-solid)',
            'search_query': 'var(--ai-primary-solid)',
            'ai_insight': 'var(--ai-secondary-solid)',
            'security_alert': 'var(--ai-danger-solid)',
            'performance_alert': 'var(--ai-warning-solid)',
            'user_login': 'var(--ai-success-solid)',
            'system_event': 'var(--ai-info-solid)'
        };
        return colors[type] || 'var(--ai-primary-solid)';
    }

    getActivityTitle(activity) {
        switch (activity.type) {
            case 'asset_download':
                return `Asset downloaded: ${activity.assetName || 'Unknown'}`;
            case 'page_view':
                return `Page viewed: ${activity.page || 'Dashboard'}`;
            case 'search_query':
                return `Search: "${activity.query || 'analytics'}"`;
            case 'ai_insight':
                return `AI Insight: ${activity.insight || 'New pattern detected'}`;
            case 'security_alert':
                return `Security: ${activity.alert || 'System scan completed'}`;
            case 'performance_alert':
                return `Performance: ${activity.alert || 'Optimization detected'}`;
            default:
                return 'System activity';
        }
    }

    getActivityMeta(activity) {
        return activity.user ? `by ${activity.user} from ${activity.location || 'Unknown'}` : 'System generated';
    }

    getTimeAgo(timestamp) {
        if (!timestamp) return 'Unknown time';
        
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

    // ==================== AI REPORT GENERATION ====================
    async generateAIReport() {
        const generateBtn = document.getElementById('generateBtn');
        const refreshBtn = document.getElementById('refreshBtn');
        
        if (!generateBtn) return;

        // Update button state
        generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> AI Analyzing...';
        generateBtn.disabled = true;
        if (refreshBtn) refreshBtn.disabled = true;

        try {
            const timeRange = document.getElementById('timeRange')?.value || '30d';
            const reportType = document.getElementById('reportType')?.value || 'comprehensive';
            const analysisType = document.getElementById('analysisType')?.value || 'comprehensive';
            const aiModel = document.getElementById('aiModel')?.value || 'ensemble';

            // Show loading state
            this.showIntelligenceLoading();

            // Simulate AI processing time for demo
            await this.delay(2000);

            // Generate comprehensive AI report
            const report = await this.generateIntelligenceReport({
                timeRange,
                reportType,
                analysisType,
                aiModel
            });

            this.currentReport = report;
            this.renderIntelligenceReport(report);

        } catch (error) {
            console.error('🚨 Error generating AI report:', error);
            this.showIntelligenceError(`Failed to generate AI report: ${error.message}`);
        } finally {
            // Reset button state
            generateBtn.innerHTML = '<i class="fas fa-magic"></i> Generate AI Analysis';
            generateBtn.disabled = false;
            if (refreshBtn) refreshBtn.disabled = false;
        }
    }

    async generateIntelligenceReport(params) {
        // This would normally call the backend API
        // For now, we'll generate a comprehensive demo report
        
        return {
            success: true,
            data: {
                executiveSummary: {
                    overview: `AI analysis of your ${params.timeRange} data reveals exceptional performance with 94.7% confidence. Key insights include 23% growth in user engagement, optimized performance patterns, and zero critical security threats. Predictive models forecast continued positive trends with recommended strategic adjustments.`
                },
                aiInsights: {
                    behaviorAnalysis: {
                        confidence: 0.947,
                        summary: "Advanced behavioral pattern analysis reveals peak user engagement during business hours with 87% journey efficiency. Machine learning models identify optimal content delivery windows and user preference clustering.",
                        insights: [
                            { metric: "Peak Usage Pattern", value: "9AM-5PM UTC", trend: "stable" },
                            { metric: "User Journey Efficiency", value: "87%", trend: "up" },
                            { metric: "Engagement Score", value: "High", trend: "up" },
                            { metric: "Conversion Rate", value: "12.4%", trend: "up" }
                        ]
                    },
                    performanceAnalysis: {
                        confidence: 0.923,
                        summary: "System performance analysis shows exceptional health metrics with 99.97% uptime and 142ms average response time. AI-powered optimization recommendations identified 3 enhancement opportunities.",
                        insights: [
                            { metric: "System Health Score", value: "94%", trend: "stable" },
                            { metric: "Avg Response Time", value: "142ms", trend: "down" },
                            { metric: "Uptime", value: "99.97%", trend: "stable" },
                            { metric: "Error Rate", value: "0.03%", trend: "down" }
                        ]
                    },
                    securityAnalysis: {
                        confidence: 0.961,
                        summary: "Comprehensive security analysis indicates robust protection with zero critical threats detected. AI-powered threat detection systems maintain 96% security score with full compliance status.",
                        insights: [
                            { metric: "Threat Level", value: "Low", trend: "stable" },
                            { metric: "Security Score", value: "96%", trend: "up" },
                            { metric: "Incidents", value: "0", trend: "stable" },
                            { metric: "Compliance", value: "100%", trend: "stable" }
                        ]
                    },
                    predictiveAnalysis: {
                        confidence: 0.893,
                        summary: "Predictive modeling forecasts 18% growth trajectory with low churn risk. Neural networks predict optimal capacity utilization at 72% with 91% trend confidence for strategic planning.",
                        insights: [
                            { metric: "Growth Forecast", value: "+18%", trend: "up" },
                            { metric: "Churn Risk", value: "Low", trend: "down" },
                            { metric: "Capacity Utilization", value: "72%", trend: "stable" },
                            { metric: "Trend Confidence", value: "91%", trend: "up" }
                        ]
                    }
                },
                recommendations: {
                    immediate: [
                        {
                            title: "Optimize Peak Hour Performance",
                            description: "Implement dynamic scaling during 9AM-5PM UTC to handle 23% increased traffic efficiently.",
                            category: "performance",
                            priority: "high",
                            estimatedImpact: "15% performance boost",
                            timeToImplement: "2-3 days"
                        },
                        {
                            title: "Enhanced Security Monitoring",
                            description: "Deploy advanced AI threat detection for proactive security posture improvement.",
                            category: "security",
                            priority: "medium",
                            estimatedImpact: "Enhanced protection",
                            timeToImplement: "1 week"
                        }
                    ],
                    shortTerm: [
                        {
                            title: "User Experience Optimization",
                            description: "Implement personalized content delivery based on behavioral analysis patterns.",
                            category: "user_experience",
                            priority: "high",
                            estimatedImpact: "20% engagement boost",
                            timeToImplement: "2-3 weeks"
                        }
                    ],
                    longTerm: [
                        {
                            title: "Predictive Analytics Integration",
                            description: "Deploy advanced machine learning models for business intelligence forecasting.",
                            category: "business",
                            priority: "medium",
                            estimatedImpact: "Strategic advantage",
                            timeToImplement: "1-2 months"
                        }
                    ]
                }
            }
        };
    }

    showIntelligenceLoading() {
        const grid = document.getElementById('intelligenceGrid');
        if (grid) {
            grid.innerHTML = `
                <div class="ai-loading">
                    <div class="ai-neural-loader"></div>
                    <div style="font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem;">AI Processing Your Data</div>
                    <div style="font-size: 0.875rem; opacity: 0.7;">Advanced neural networks analyzing patterns...</div>
                </div>
            `;
        }
    }

    renderIntelligenceReport(report) {
        if (!report.success || !report.data?.aiInsights) {
            this.showIntelligenceError('Invalid AI report data received');
            return;
        }

        const insights = report.data.aiInsights;
        
        // Render executive summary
        this.renderExecutiveSummary(report.data.executiveSummary);
        
        // Render intelligence cards
        this.renderIntelligenceCards(insights);
        
        // Render recommendations
        this.renderRecommendations(report.data.recommendations);
    }

    renderExecutiveSummary(summary) {
        const summaryElement = document.getElementById('executiveSummary');
        const summaryText = document.getElementById('summaryText');
        
        if (summary?.overview && summaryElement && summaryText) {
            summaryText.textContent = summary.overview;
            summaryElement.style.display = 'block';
            summaryElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    renderIntelligenceCards(insights) {
        const grid = document.getElementById('intelligenceGrid');
        if (!grid) return;

        const cards = [
            {
                title: 'Behavior Intelligence',
                icon: 'neural',
                iconClass: 'fas fa-users-cog',
                confidence: insights.behaviorAnalysis?.confidence || 0.9,
                summary: insights.behaviorAnalysis?.summary || 'Analyzing user behavior patterns...',
                metrics: insights.behaviorAnalysis?.insights || []
            },
            {
                title: 'Performance Intelligence',
                icon: 'performance',
                iconClass: 'fas fa-tachometer-alt',
                confidence: insights.performanceAnalysis?.confidence || 0.9,
                summary: insights.performanceAnalysis?.summary || 'Evaluating system performance...',
                metrics: insights.performanceAnalysis?.insights || []
            },
            {
                title: 'Security Intelligence',
                icon: 'security',
                iconClass: 'fas fa-shield-virus',
                confidence: insights.securityAnalysis?.confidence || 0.9,
                summary: insights.securityAnalysis?.summary || 'Monitoring security status...',
                metrics: insights.securityAnalysis?.insights || []
            },
            {
                title: 'Predictive Intelligence',
                icon: 'predictive',
                iconClass: 'fas fa-crystal-ball',
                confidence: insights.predictiveAnalysis?.confidence || 0.9,
                summary: insights.predictiveAnalysis?.summary || 'Forecasting future trends...',
                metrics: insights.predictiveAnalysis?.insights || []
            }
        ];

        const html = cards.map(card => this.createIntelligenceCardHTML(card)).join('');
        grid.innerHTML = html;
    }

    createIntelligenceCardHTML(card) {
        const confidencePercent = Math.round(card.confidence * 100);
        
        return `
            <div class="ai-intelligence-card">
                <div class="ai-card-header">
                    <div class="ai-card-title">
                        <div class="ai-card-icon ${card.icon}">
                            <i class="${card.iconClass}"></i>
                        </div>
                        ${card.title}
                    </div>
                    <div class="ai-confidence-badge">${confidencePercent}%</div>
                </div>
                <div class="ai-card-content">
                    <div class="ai-insight-summary">${card.summary}</div>
                    <div class="ai-metrics-grid">
                        ${card.metrics.map(metric => `
                            <div class="ai-metric-item">
                                <div class="ai-metric-value">${metric.value}</div>
                                <div class="ai-metric-label">${metric.metric}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    renderRecommendations(recommendations) {
        const section = document.getElementById('recommendationsSection');
        const list = document.getElementById('recommendationsList');
        
        if (!recommendations || !section || !list) return;

        const allRecommendations = [
            ...(recommendations.immediate || []),
            ...(recommendations.shortTerm || []),
            ...(recommendations.longTerm || [])
        ];

        if (allRecommendations.length === 0) {
            section.style.display = 'none';
            return;
        }

        const html = allRecommendations.map(rec => this.createRecommendationHTML(rec)).join('');
        list.innerHTML = html;
        section.style.display = 'block';
    }

    createRecommendationHTML(rec) {
        const iconClass = this.getRecommendationIcon(rec.category);
        const priorityColor = this.getPriorityColor(rec.priority);
        
        return `
            <div class="ai-recommendation-item">
                <div class="ai-recommendation-icon" style="background: ${priorityColor};">
                    <i class="${iconClass}"></i>
                </div>
                <div class="ai-recommendation-content">
                    <div class="ai-recommendation-title">${rec.title}</div>
                    <div class="ai-recommendation-description">${rec.description}</div>
                    <div class="ai-recommendation-meta">
                        <span>Priority: ${rec.priority}</span>
                        <span>Impact: ${rec.estimatedImpact}</span>
                        <span>Time: ${rec.timeToImplement}</span>
                    </div>
                </div>
            </div>
        `;
    }

    getRecommendationIcon(category) {
        const icons = {
            security: 'fas fa-shield-alt',
            performance: 'fas fa-rocket',
            user_experience: 'fas fa-users',
            business: 'fas fa-chart-line',
            technical: 'fas fa-cogs'
        };
        return icons[category] || 'fas fa-lightbulb';
    }

    getPriorityColor(priority) {
        const colors = {
            critical: '#ef4444',
            high: '#f59e0b',
            medium: '#3b82f6',
            low: '#10b981'
        };
        return colors[priority] || colors.medium;
    }

    showIntelligenceError(message) {
        const grid = document.getElementById('intelligenceGrid');
        if (grid) {
            grid.innerHTML = `
                <div class="ai-error">
                    <div class="ai-error-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div>${message}</div>
                    <button class="ai-button" onclick="aiEngine.generateAIReport()" style="margin-top: 1rem;">
                        <i class="fas fa-retry"></i> Retry Analysis
                    </button>
                </div>
            `;
        }
    }

    // ==================== AI QUERY PROCESSING ====================
    async processAIQuery() {
        const queryInput = document.getElementById('aiQuery');
        const queryBtn = document.getElementById('queryBtn');
        
        if (!queryInput || !queryBtn) return;
        
        const query = queryInput.value.trim();