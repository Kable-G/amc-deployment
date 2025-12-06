/**
 * Analytics Optimization - Industry-leading features and performance enhancements
 * Advanced analytics capabilities that set your platform apart from competitors
 */

const mongoose = require('mongoose');
const { AMCInteraction, MediaPickup, UserSession } = require('./models/AMCAnalytics');
const CenterRelease = require('./models/CenterRelease');
const User = require('./models/User');

// Advanced Analytics Class with Industry-Leading Features
class AdvancedAnalytics {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    // Predictive Analytics - Predict user behavior and download patterns
    async getPredictiveInsights(timeframe = '30d') {
        const cacheKey = `predictive_${timeframe}`;
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        try {
            const startDate = this.getStartDate(timeframe);
            
            // Analyze user behavior patterns
            const userPatterns = await AMCInteraction.aggregate([
                { $match: { timestamp: { $gte: startDate } } },
                {
                    $group: {
                        _id: '$userId',
                        interactions: { $push: '$$ROOT' },
                        totalInteractions: { $sum: 1 },
                        downloadCount: {
                            $sum: { $cond: [{ $eq: ['$interactionType', 'asset_download'] }, 1, 0] }
                        },
                        avgTimeOnPage: { $avg: '$timeOnPage' },
                        preferredAssetTypes: { $addToSet: '$assetType' },
                        sessionCount: { $addToSet: '$sessionId' }
                    }
                },
                {
                    $project: {
                        userId: '$_id',
                        engagementScore: {
                            $add: [
                                { $multiply: ['$downloadCount', 3] }, // Downloads worth 3 points
                                { $multiply: ['$totalInteractions', 1] }, // Interactions worth 1 point
                                { $multiply: [{ $size: '$sessionCount' }, 2] } // Sessions worth 2 points
                            ]
                        },
                        downloadRate: { $divide: ['$downloadCount', '$totalInteractions'] },
                        avgTimeOnPage: 1,
                        preferredAssetTypes: 1,
                        isHighValue: { $gt: ['$downloadCount', 5] }
                    }
                }
            ]);

            // Predict trending content
            const trendingPredictions = await this.predictTrendingContent(startDate);
            
            // Predict peak usage times
            const peakTimePredictions = await this.predictPeakTimes(startDate);
            
            // User segmentation
            const userSegments = await this.segmentUsers(userPatterns);

            const insights = {
                userBehaviorPatterns: userPatterns.slice(0, 100), // Top 100 users
                trendingPredictions,
                peakTimePredictions,
                userSegments,
                recommendations: this.generateRecommendations(userPatterns, trendingPredictions)
            };

            this.cache.set(cacheKey, { data: insights, timestamp: Date.now() });
            return insights;

        } catch (error) {
            console.error('Error generating predictive insights:', error);
            throw error;
        }
    }

    // Real-time Anomaly Detection
    async detectAnomalies(timeframe = '24h') {
        try {
            const startDate = this.getStartDate(timeframe);
            const previousPeriodStart = new Date(startDate.getTime() - (Date.now() - startDate.getTime()));

            // Current period data
            const currentData = await AMCInteraction.aggregate([
                { $match: { timestamp: { $gte: startDate } } },
                {
                    $group: {
                        _id: { $hour: '$timestamp' },
                        interactions: { $sum: 1 },
                        downloads: {
                            $sum: { $cond: [{ $eq: ['$interactionType', 'asset_download'] }, 1, 0] }
                        },
                        uniqueUsers: { $addToSet: '$userId' }
                    }
                }
            ]);

            // Previous period data for comparison
            const previousData = await AMCInteraction.aggregate([
                { 
                    $match: { 
                        timestamp: { 
                            $gte: previousPeriodStart, 
                            $lt: startDate 
                        } 
                    } 
                },
                {
                    $group: {
                        _id: { $hour: '$timestamp' },
                        interactions: { $sum: 1 },
                        downloads: {
                            $sum: { $cond: [{ $eq: ['$interactionType', 'asset_download'] }, 1, 0] }
                        },
                        uniqueUsers: { $addToSet: '$userId' }
                    }
                }
            ]);

            // Detect anomalies
            const anomalies = [];
            const threshold = 2.0; // 200% increase/decrease threshold

            currentData.forEach(current => {
                const previous = previousData.find(p => p._id === current._id);
                if (previous) {
                    const interactionChange = (current.interactions - previous.interactions) / previous.interactions;
                    const downloadChange = (current.downloads - previous.downloads) / (previous.downloads || 1);

                    if (Math.abs(interactionChange) > threshold || Math.abs(downloadChange) > threshold) {
                        anomalies.push({
                            hour: current._id,
                            type: interactionChange > threshold ? 'spike' : 'drop',
                            interactionChange: Math.round(interactionChange * 100),
                            downloadChange: Math.round(downloadChange * 100),
                            currentInteractions: current.interactions,
                            previousInteractions: previous.interactions,
                            severity: Math.abs(interactionChange) > 3 ? 'high' : 'medium'
                        });
                    }
                }
            });

            return {
                anomalies,
                summary: {
                    totalAnomalies: anomalies.length,
                    highSeverity: anomalies.filter(a => a.severity === 'high').length,
                    spikes: anomalies.filter(a => a.type === 'spike').length,
                    drops: anomalies.filter(a => a.type === 'drop').length
                }
            };

        } catch (error) {
            console.error('Error detecting anomalies:', error);
            throw error;
        }
    }

    // Advanced User Journey Analysis
    async analyzeUserJourneys(userId = null, timeframe = '7d') {
        try {
            const startDate = this.getStartDate(timeframe);
            const matchFilter = { timestamp: { $gte: startDate } };
            if (userId) matchFilter.userId = new mongoose.Types.ObjectId(userId);

            const journeys = await AMCInteraction.aggregate([
                { $match: matchFilter },
                { $sort: { userId: 1, timestamp: 1 } },
                {
                    $group: {
                        _id: '$userId',
                        journey: {
                            $push: {
                                interactionType: '$interactionType',
                                timestamp: '$timestamp',
                                assetType: '$assetType',
                                releaseTitle: '$releaseTitle',
                                timeOnPage: '$timeOnPage'
                            }
                        },
                        totalInteractions: { $sum: 1 },
                        sessionCount: { $addToSet: '$sessionId' },
                        firstInteraction: { $first: '$timestamp' },
                        lastInteraction: { $last: '$timestamp' }
                    }
                },
                {
                    $project: {
                        userId: '$_id',
                        journey: 1,
                        totalInteractions: 1,
                        sessionCount: { $size: '$sessionCount' },
                        journeyDuration: {
                            $divide: [
                                { $subtract: ['$lastInteraction', '$firstInteraction'] },
                                1000 * 60 // Convert to minutes
                            ]
                        },
                        conversionPath: {
                            $map: {
                                input: '$journey',
                                as: 'step',
                                in: '$$step.interactionType'
                            }
                        }
                    }
                }
            ]);

            // Analyze common conversion paths
            const conversionPaths = {};
            journeys.forEach(journey => {
                const pathKey = journey.conversionPath.join(' -> ');
                if (!conversionPaths[pathKey]) {
                    conversionPaths[pathKey] = { count: 0, avgDuration: 0, users: [] };
                }
                conversionPaths[pathKey].count++;
                conversionPaths[pathKey].avgDuration += journey.journeyDuration;
                conversionPaths[pathKey].users.push(journey.userId);
            });

            // Calculate averages and sort by popularity
            const popularPaths = Object.entries(conversionPaths)
                .map(([path, data]) => ({
                    path,
                    count: data.count,
                    avgDuration: Math.round(data.avgDuration / data.count),
                    uniqueUsers: data.users.length,
                    conversionRate: data.users.filter(userId => 
                        journeys.find(j => j.userId === userId)?.conversionPath.includes('asset_download')
                    ).length / data.users.length
                }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);

            return {
                totalJourneys: journeys.length,
                popularPaths,
                avgJourneyLength: journeys.reduce((sum, j) => sum + j.totalInteractions, 0) / journeys.length,
                avgJourneyDuration: journeys.reduce((sum, j) => sum + j.journeyDuration, 0) / journeys.length,
                journeyDetails: userId ? journeys : journeys.slice(0, 50) // Limit for performance
            };

        } catch (error) {
            console.error('Error analyzing user journeys:', error);
            throw error;
        }
    }

    // Content Performance Scoring
    async getContentPerformanceScores(timeframe = '30d') {
        try {
            const startDate = this.getStartDate(timeframe);

            const contentScores = await AMCInteraction.aggregate([
                { $match: { timestamp: { $gte: startDate }, releaseId: { $ne: null } } },
                {
                    $group: {
                        _id: '$releaseId',
                        releaseTitle: { $first: '$releaseTitle' },
                        totalInteractions: { $sum: 1 },
                        downloads: {
                            $sum: { $cond: [{ $eq: ['$interactionType', 'asset_download'] }, 1, 0] }
                        },
                        views: {
                            $sum: { $cond: [{ $eq: ['$interactionType', 'page_view'] }, 1, 0] }
                        },
                        quickViews: {
                            $sum: { $cond: [{ $eq: ['$interactionType', 'asset_quick_view'] }, 1, 0] }
                        },
                        uniqueUsers: { $addToSet: '$userId' },
                        avgTimeOnPage: { $avg: '$timeOnPage' },
                        assetTypes: { $addToSet: '$assetType' }
                    }
                },
                {
                    $project: {
                        releaseId: '$_id',
                        releaseTitle: 1,
                        totalInteractions: 1,
                        downloads: 1,
                        views: 1,
                        quickViews: 1,
                        uniqueUsers: { $size: '$uniqueUsers' },
                        avgTimeOnPage: 1,
                        assetTypes: 1,
                        conversionRate: { $divide: ['$downloads', { $add: ['$views', 1] }] },
                        engagementRate: { $divide: ['$quickViews', { $add: ['$views', 1] }] },
                        performanceScore: {
                            $add: [
                                { $multiply: ['$downloads', 10] }, // Downloads worth 10 points
                                { $multiply: ['$views', 2] }, // Views worth 2 points
                                { $multiply: ['$quickViews', 5] }, // Quick views worth 5 points
                                { $multiply: [{ $size: '$uniqueUsers' }, 3] } // Unique users worth 3 points
                            ]
                        }
                    }
                },
                { $sort: { performanceScore: -1 } }
            ]);

            // Calculate percentile rankings
            const totalReleases = contentScores.length;
            contentScores.forEach((release, index) => {
                release.percentileRank = Math.round(((totalReleases - index) / totalReleases) * 100);
                release.performanceGrade = this.getPerformanceGrade(release.percentileRank);
            });

            return {
                totalReleases,
                topPerformers: contentScores.slice(0, 10),
                averageScore: contentScores.reduce((sum, r) => sum + r.performanceScore, 0) / totalReleases,
                scoreDistribution: this.getScoreDistribution(contentScores),
                allScores: contentScores
            };

        } catch (error) {
            console.error('Error calculating content performance scores:', error);
            throw error;
        }
    }

    // Advanced Cohort Analysis
    async performCohortAnalysis(cohortType = 'monthly') {
        try {
            const cohorts = await AMCInteraction.aggregate([
                {
                    $group: {
                        _id: '$userId',
                        firstInteraction: { $min: '$timestamp' },
                        interactions: { $push: '$$ROOT' }
                    }
                },
                {
                    $project: {
                        userId: '$_id',
                        cohortPeriod: cohortType === 'weekly' ? 
                            { $week: '$firstInteraction' } :
                            { $month: '$firstInteraction' },
                        cohortYear: { $year: '$firstInteraction' },
                        interactions: 1,
                        firstInteraction: 1
                    }
                },
                {
                    $group: {
                        _id: {
                            period: '$cohortPeriod',
                            year: '$cohortYear'
                        },
                        users: { $addToSet: '$userId' },
                        totalUsers: { $sum: 1 },
                        totalInteractions: { $sum: { $size: '$interactions' } }
                    }
                },
                { $sort: { '_id.year': 1, '_id.period': 1 } }
            ]);

            // Calculate retention rates
            const cohortAnalysis = [];
            for (const cohort of cohorts) {
                const cohortStart = new Date(cohort._id.year, cohort._id.period - 1, 1);
                const retentionData = await this.calculateRetention(cohort.users, cohortStart);
                
                cohortAnalysis.push({
                    cohortPeriod: `${cohort._id.year}-${cohort._id.period.toString().padStart(2, '0')}`,
                    initialUsers: cohort.totalUsers,
                    totalInteractions: cohort.totalInteractions,
                    avgInteractionsPerUser: Math.round(cohort.totalInteractions / cohort.totalUsers),
                    retention: retentionData
                });
            }

            return {
                cohortType,
                cohorts: cohortAnalysis,
                summary: {
                    totalCohorts: cohortAnalysis.length,
                    avgRetentionWeek1: this.calculateAvgRetention(cohortAnalysis, 'week1'),
                    avgRetentionMonth1: this.calculateAvgRetention(cohortAnalysis, 'month1'),
                    avgRetentionMonth3: this.calculateAvgRetention(cohortAnalysis, 'month3')
                }
            };

        } catch (error) {
            console.error('Error performing cohort analysis:', error);
            throw error;
        }
    }

    // Helper Methods
    getStartDate(timeframe) {
        const now = new Date();
        const timeframes = {
            '1h': 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000,
            '30d': 30 * 24 * 60 * 60 * 1000,
            '90d': 90 * 24 * 60 * 60 * 1000
        };
        return new Date(now.getTime() - (timeframes[timeframe] || timeframes['30d']));
    }

    async predictTrendingContent(startDate) {
        const trending = await AMCInteraction.aggregate([
            { $match: { timestamp: { $gte: startDate }, interactionType: 'asset_download' } },
            {
                $group: {
                    _id: {
                        releaseId: '$releaseId',
                        assetType: '$assetType'
                    },
                    downloads: { $sum: 1 },
                    recentDownloads: {
                        $sum: {
                            $cond: [
                                { $gte: ['$timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)] },
                                1,
                                0
                            ]
                        }
                    },
                    releaseTitle: { $first: '$releaseTitle' }
                }
            },
            {
                $project: {
                    releaseId: '$_id.releaseId',
                    assetType: '$_id.assetType',
                    releaseTitle: 1,
                    downloads: 1,
                    recentDownloads: 1,
                    trendScore: { $divide: ['$recentDownloads', { $add: ['$downloads', 1] }] }
                }
            },
            { $sort: { trendScore: -1 } },
            { $limit: 10 }
        ]);

        return trending;
    }

    async predictPeakTimes(startDate) {
        const hourlyData = await AMCInteraction.aggregate([
            { $match: { timestamp: { $gte: startDate } } },
            {
                $group: {
                    _id: { $hour: '$timestamp' },
                    interactions: { $sum: 1 },
                    downloads: {
                        $sum: { $cond: [{ $eq: ['$interactionType', 'asset_download'] }, 1, 0] }
                    }
                }
            },
            { $sort: { '_id': 1 } }
        ]);

        return hourlyData.map(hour => ({
            hour: hour._id,
            interactions: hour.interactions,
            downloads: hour.downloads,
            isPeakHour: hour.interactions > (hourlyData.reduce((sum, h) => sum + h.interactions, 0) / hourlyData.length) * 1.5
        }));
    }

    segmentUsers(userPatterns) {
        const segments = {
            highValue: userPatterns.filter(u => u.isHighValue && u.downloadRate > 0.3),
            engaged: userPatterns.filter(u => u.engagementScore > 50 && !u.isHighValue),
            casual: userPatterns.filter(u => u.engagementScore <= 50 && u.downloadRate > 0),
            browsers: userPatterns.filter(u => u.downloadRate === 0)
        };

        return {
            highValue: { count: segments.highValue.length, avgScore: this.avgScore(segments.highValue) },
            engaged: { count: segments.engaged.length, avgScore: this.avgScore(segments.engaged) },
            casual: { count: segments.casual.length, avgScore: this.avgScore(segments.casual) },
            browsers: { count: segments.browsers.length, avgScore: this.avgScore(segments.browsers) }
        };
    }

    generateRecommendations(userPatterns, trendingContent) {
        const recommendations = [];

        // Content recommendations
        if (trendingContent.length > 0) {
            recommendations.push({
                type: 'content',
                priority: 'high',
                title: 'Promote Trending Content',
                description: `${trendingContent[0].releaseTitle} is trending with ${trendingContent[0].recentDownloads} recent downloads`,
                action: 'Feature this content prominently on the homepage'
            });
        }

        // User engagement recommendations
        const lowEngagementUsers = userPatterns.filter(u => u.engagementScore < 10).length;
        if (lowEngagementUsers > userPatterns.length * 0.3) {
            recommendations.push({
                type: 'engagement',
                priority: 'medium',
                title: 'Improve User Engagement',
                description: `${lowEngagementUsers} users have low engagement scores`,
                action: 'Consider onboarding improvements or personalized content recommendations'
            });
        }

        return recommendations;
    }

    getPerformanceGrade(percentile) {
        if (percentile >= 90) return 'A+';
        if (percentile >= 80) return 'A';
        if (percentile >= 70) return 'B+';
        if (percentile >= 60) return 'B';
        if (percentile >= 50) return 'C+';
        if (percentile >= 40) return 'C';
        return 'D';
    }

    getScoreDistribution(scores) {
        const ranges = { 'A+': 0, 'A': 0, 'B+': 0, 'B': 0, 'C+': 0, 'C': 0, 'D': 0 };
        scores.forEach(score => {
            ranges[score.performanceGrade]++;
        });
        return ranges;
    }

    async calculateRetention(userIds, cohortStart) {
        const week1 = new Date(cohortStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        const month1 = new Date(cohortStart.getTime() + 30 * 24 * 60 * 60 * 1000);
        const month3 = new Date(cohortStart.getTime() + 90 * 24 * 60 * 60 * 1000);

        const [week1Users, month1Users, month3Users] = await Promise.all([
            AMCInteraction.distinct('userId', { 
                userId: { $in: userIds }, 
                timestamp: { $gte: cohortStart, $lt: week1 } 
            }),
            AMCInteraction.distinct('userId', { 
                userId: { $in: userIds }, 
                timestamp: { $gte: cohortStart, $lt: month1 } 
            }),
            AMCInteraction.distinct('userId', { 
                userId: { $in: userIds }, 
                timestamp: { $gte: cohortStart, $lt: month3 } 
            })
        ]);

        return {
            week1: Math.round((week1Users.length / userIds.length) * 100),
            month1: Math.round((month1Users.length / userIds.length) * 100),
            month3: Math.round((month3Users.length / userIds.length) * 100)
        };
    }

    calculateAvgRetention(cohorts, period) {
        const validCohorts = cohorts.filter(c => c.retention[period] !== undefined);
        return validCohorts.length > 0 ? 
            Math.round(validCohorts.reduce((sum, c) => sum + c.retention[period], 0) / validCohorts.length) : 0;
    }

    avgScore(users) {
        return users.length > 0 ? 
            Math.round(users.reduce((sum, u) => sum + u.engagementScore, 0) / users.length) : 0;
    }
}

module.exports = AdvancedAnalytics;