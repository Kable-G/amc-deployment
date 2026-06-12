// routes/amcAnalytics.routes.js - Comprehensive analytics routes for AutoMediaCenter

const express = require('express');
const { ObjectId } = require('mongodb');
const { isGlobalRole, scopeMatchDirect, appendClientScopeLookup, OID } = require('../utils/analyticsScope');

const tz = 'Europe/Berlin';

function pct(n, d) {
  if (!d || d <= 0) return null;
  return Math.round((n / d) * 100);
}
function clamp01(x){ return Math.max(0, Math.min(1, x)); }
const router = express.Router();
const auth = require('../middleware/auth');        // Use real session-based auth
const { optionalAuth } = require('../middleware/auth'); // analytics ingest: record anon + known
const { AMCInteraction, MediaPickup, UserSession } = require('../models/AMCAnalytics');
const CenterRelease = require('../models/CenterRelease');
const User = require('../models/User');
const Client = require('../models/Client');
const mongoose = require('mongoose');
const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Helper function to get date range filter
function getDateRangeFilter(days) {
    const now = new Date();
    let startDate;
    
    switch(days) {
        case '1':
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
        case '7':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case '14':
            startDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
            break;
        case '30':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        case '90':
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
        case 'ytd':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
        case 'max':
        case 'all':
            startDate = new Date('2020-01-01'); // All time - start from a very early date
            break;
        default:
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    return {
        timestamp: {
            $gte: startDate,
            $lte: now
        }
    };
}

function parseDateRange(range) {
  // Return {start, end} matching getDateRangeFilter's windows so asset-type
  // counts move in lockstep with the rest of the dashboard.
  const now = new Date();
  const days = { '1':1, '7':7, '14':14, '30':30, '90':90 };
  if (!range || range === 'max' || range === 'all') {
    return { start: new Date('2020-01-01'), end: now };
  }
  if (range === 'ytd') {
    return { start: new Date(now.getFullYear(), 0, 1), end: now };
  }
  if (days[range]) {
    return { start: new Date(now.getTime() - days[range] * 24 * 60 * 60 * 1000), end: now };
  }
  // default: 30 days
  return { start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), end: now };
}

// Helper function to get user filter based on role
function getUserFilter(req) {
  const u = req.user || {};
  // Platform admin sees everything
  if (u.role === 'platform_admin') return {};
  // Client users/admins → scope analytics to their client
  if (u.clientId) {
    return {
      $or: [
        { 'metadata.clientId': OID(u.clientId) },  // New format (nested)
        { 'clientId': OID(u.clientId) }            // Legacy format (direct)
      ]
    };
  }
  // Fallback: just this user
  if (u.id) return { userId: OID(u.id) };
  return { userEmail: '___never___' }; // safe no-match fallback
}

// Example guard: ignore any ?all=1 or clientId overrides from client users
function enforceNoOverride(req, res, next) {
  if (!isGlobalRole(req.user)) {
    // strip/ignore dangerous params
    delete req.query.clientId;
    delete req.query.all;
  }
  next();
}

// Helper function to get geographic data from IP
async function getGeographicData(ipAddress) {
    // For now, return mock data - you can integrate with a real IP geolocation service
    const mockRegions = ['North America', 'Europe', 'Asia', 'South America'];
    const mockCountries = ['USA', 'Germany', 'UK', 'France', 'Japan', 'Canada'];
    const mockCities = ['New York', 'Berlin', 'London', 'Paris', 'Tokyo', 'Toronto'];
    
    return {
        country: mockCountries[Math.floor(Math.random() * mockCountries.length)],
        region: mockRegions[Math.floor(Math.random() * mockRegions.length)],
        city: mockCities[Math.floor(Math.random() * mockCities.length)]
    };
}

// @route   POST /api/v1/amc-analytics/track-batch
// @desc    Track multiple user interactions in batch (called from frontend tracker)
// @access  Private
router.post('/track-batch', auth, async (req, res) => {
    try {
        const { interactions } = req.body;
        
        if (!interactions || !Array.isArray(interactions)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid interactions data' 
            });
        }

        console.log(`📊 Received batch of ${interactions.length} interactions from ${req.user?.email || 'unknown user'}`);

        // Get user's IP and user agent
        const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
        const userAgent = req.get('User-Agent') || 'unknown';
        const referrer = req.get('Referer') || null;
        
        // Get geographic data
        const geoData = await getGeographicData(ipAddress);

        // Process each interaction
        const processedInteractions = [];
        const validInteractionTypes = [
            'page_view', 'release_view', /* 'asset_download', */ 'asset_quick_view', 'asset_add_to_cart',
            'search_query', 'filter_applied', 'sort_changed', 'pagination_click', 'release_detail_view',
            'share_action', 'print_action', 'export_action', 'heartbeat', 'page_visible', 'page_hidden',
            'scroll_depth', 'time_on_page', 'page_exit'
        ];
        // asset_download disabled - handled by universalDownloadTracker middleware to prevent duplicates
        
        for (const interactionData of interactions) {
            try {
                // Validate required fields
                if (!interactionData.interactionType) {
                    console.warn('Skipping interaction without type:', interactionData);
                    continue;
                }

                // Validate interaction type
                if (!validInteractionTypes.includes(interactionData.interactionType)) {
                    console.warn(`Skipping invalid interaction type: ${interactionData.interactionType}`);
                    continue;
                }

                
                // Skip asset_download - handled by universalDownloadTracker middleware
                if (interactionData.interactionType === 'asset_download') {
                    console.warn('Skipping asset_download - handled by middleware');
                    continue;
                }

                // Create interaction record
                const interaction = new AMCInteraction({
                    userId: req.user?.id || null,
                    userEmail: req.user?.email || 'anonymous@example.com',
                    sessionId: interactionData.sessionId || `session_${Date.now()}_${Math.random()}`,
                    interactionType: interactionData.interactionType,
                    
                    // Release information
                    releaseId: interactionData.releaseId || null,
                    releaseUuid: interactionData.releaseUuid || null,
                    releaseTitle: interactionData.releaseTitle || null,
                    
                    // Asset information
                    assetType: interactionData.assetType || null,
                    assetName: interactionData.assetName || null,
                    assetPath: interactionData.assetPath || null,
                    assetSize: interactionData.assetSize || null,
                    
                    // Search and filter context
                    searchQuery: interactionData.searchQuery || null,
                    filtersApplied: interactionData.filtersApplied || {},
                    sortBy: interactionData.sortBy || null,
                    
                    // Technical details
                    userAgent: interactionData.userAgent || userAgent,
                    ipAddress: ipAddress,
                    referrer: interactionData.referrer || referrer,
                    
                    // Geographic data
                    country: geoData.country,
                    region: geoData.region,
                    city: geoData.city,
                    
                    // Timing data
                    timestamp: interactionData.timestamp ? new Date(interactionData.timestamp) : new Date(),
                    timeOnPage: interactionData.timeOnPage || null,
                    
                    // Additional metadata
                    metadata: {
                        ...interactionData.metadata,
                        clientId: req.user?.clientId || null,
                        userRole: req.user?.role || 'anonymous',
                        batchProcessed: true,
                        originalUrl: interactionData.url || null
                    }
                });

                processedInteractions.push(interaction);
                
            } catch (error) {
                console.error('Error processing individual interaction:', error);
                continue;
            }
        }

        // Bulk insert all interactions
        if (processedInteractions.length > 0) {
            await AMCInteraction.insertMany(processedInteractions);
            console.log(`✅ Successfully saved ${processedInteractions.length} interactions`);
            
            // Update session metrics if needed
            await updateSessionMetrics(req.user?.id, processedInteractions);
        }

        res.json({
            success: true,
            message: `Tracked ${processedInteractions.length} interactions successfully`,
            data: {
                processed: processedInteractions.length,
                skipped: interactions.length - processedInteractions.length
            }
        });
        
    } catch (error) {
        console.error('❌ Error tracking interaction batch:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Server error tracking interactions' 
        });
    }
});

// Helper function to update session metrics
async function updateSessionMetrics(userId, interactions) {
    if (!userId) return;
    
    try {
        const sessionIds = [...new Set(interactions.map(i => i.sessionId))];
        
        for (const sessionId of sessionIds) {
            const sessionInteractions = interactions.filter(i => i.sessionId === sessionId);
            
            // Count different types of interactions
            const downloads = sessionInteractions.filter(i => i.interactionType === 'asset_download').length;
            const quickViews = sessionInteractions.filter(i => i.interactionType === 'asset_quick_view').length;
            const searches = sessionInteractions.filter(i => i.interactionType === 'search_query').length;
            const pageViews = sessionInteractions.filter(i => i.interactionType === 'page_view').length;
            
            // Update or create session record
            await UserSession.findOneAndUpdate(
                { sessionId: sessionId },
                {
                    $inc: {
                        downloads: downloads,
                        quickViews: quickViews,
                        searches: searches,
                        pageViews: pageViews
                    },
                    $set: {
                        endTime: new Date(),
                        isActive: true
                    }
                },
                { 
                    upsert: true,
                    setDefaultsOnInsert: true
                }
            );
        }
    } catch (error) {
        console.error('Error updating session metrics:', error);
    }
}

// @route   GET /api/v1/amc-analytics/overview
// @desc    Get overview KPIs for the analytics dashboard
// @access  Private
router.get('/overview', auth, enforceNoOverride, async (req, res) => {
    try {
        const { dateRange = '30' } = req.query;
        const dateFilter = getDateRangeFilter(dateRange);
        const userFilter = getUserFilter(req);
        const combinedFilter = { ...dateFilter, ...userFilter };
        const releaseScope = scopeMatchDirect(req.user);
        
        console.log(`AMC Analytics Overview - User Role: ${req.user.role}, Date Range: ${dateRange} days`);
        
        // Get current period data - use AMCInteraction for authoritative download counts (857 total)
        const moment = require('moment-timezone');

        // --- robust helper: turn { releaseDate, releaseTime } into a Date in Europe/Berlin
        function toBerlinDateTime(releaseDate, releaseTime) {
          // Normalize time: "20.20" → "20:20", allow "8:5" → "08:05"
          let t = (releaseTime || '00:00').replace('.', ':');
          const [hhRaw = '0', mmRaw = '0'] = t.split(':');
          const hh = String(parseInt(hhRaw, 10) || 0).padStart(2, '0');
          const mm = String(parseInt(mmRaw, 10) || 0).padStart(2, '0');

          // Normalize date: Date object → "YYYY-MM-DD"; string stays as-is
          let dStr;
          if (releaseDate instanceof Date) {
            dStr = moment(releaseDate).tz('Europe/Berlin').format('YYYY-MM-DD');
          } else if (typeof releaseDate === 'string') {
            // accept "YYYY-MM-DD" or "DD.MM.YYYY"; convert the latter
            if (/^\d{2}\.\d{2}\.\d{4}$/.test(releaseDate)) {
              const [dd, MM, yyyy] = releaseDate.split('.');
              dStr = `${yyyy}-${MM}-${dd}`;
            } else {
              dStr = releaseDate;
            }
          } else {
            dStr = '1970-01-01';
          }

          // Build Berlin datetime
          return moment.tz(`${dStr} ${hh}:${mm}`, 'YYYY-MM-DD HH:mm', 'Europe/Berlin').toDate();
        }

        // --- compute embargo-aware pending in JS (resilient, no Mongo $date parsing)
        const nowBerlin = moment().tz('Europe/Berlin').toDate();

        // 1) strict DB pending
        // Window releases by their embargo/publish date (releaseDate is a real Date).
        // Reuse the same window start the download cards use, so all cards move together.
        const releaseDateWindow = (dateFilter && dateFilter.timestamp)
            ? { releaseDate: { $gte: dateFilter.timestamp.$gte, $lte: dateFilter.timestamp.$lte } }
            : {};
        const dbPendingCountPromise = CenterRelease.countDocuments({ ...releaseScope, ...releaseDateWindow, status: 'pending' });

        // 2) published with a future embargo (in Berlin)
        const embargoFutureCountPromise = (async () => {
          const embargoPipe = [
            { $match: { ...releaseScope, ...releaseDateWindow, status: 'published' } },
            {
              $addFields: {
                embargoDateTime: {
                  $dateFromParts: {
                    year: { $year: '$releaseDate' },
                    month: { $month: '$releaseDate' },
                    day: { $dayOfMonth: '$releaseDate' },
                    hour: {
                      $toInt: {
                        $arrayElemAt: [
                          { $split: [{ $ifNull: ['$releaseTime', '00:00'] }, ':'] }, 0
                        ]
                      }
                    },
                    minute: {
                      $toInt: {
                        $arrayElemAt: [
                          { $split: [{ $ifNull: ['$releaseTime', '00:00'] }, ':'] }, 1
                        ]
                      }
                    },
                    timezone: 'Europe/Berlin'
                  }
                }
              }
            },
            { $match: { embargoDateTime: { $gt: nowBerlin } } },
            { $count: 'cnt' }
          ];
          const result = await CenterRelease.aggregate(embargoPipe);
          return result[0]?.cnt || 0;
        })();

        // New robust unique-user counter (coalesce user identifiers)
        // Fix: Use release-ownership scoping instead of getUserFilter
        const user = req.user || {};
        const isGlobal = isGlobalRole(user.role);
        const clientId = user.clientId || null;
        
        const uniqueUsersAggPipeline = [
            { $match: dateFilter }, // Remove userFilter - scope by release ownership instead
            {
                $lookup: {
                    from: 'centerreleases',
                    localField: 'releaseId',
                    foreignField: '_id',
                    as: 'release'
                }
            },
            { $unwind: { path: '$release', preserveNullAndEmptyArrays: true } }
        ];

        // For client-scoped roles, filter by RELEASE owner
        if (!isGlobal && clientId) {
            const extra = [];
            extra.push({ 'release.clientId': clientId });
            if (mongoose.Types.ObjectId.isValid(clientId)) {
                extra.push({ 'release.clientId': new mongoose.Types.ObjectId(clientId) });
            }
            uniqueUsersAggPipeline.push({ $match: { $or: extra } });
        }

        uniqueUsersAggPipeline.push(
            {
                $project: {
                    // prefer userId → userEmail → ipAddress (removed sessionId to avoid false uniqueness)
                    _key: {
                        $ifNull: [
                            { $toString: '$userId' },
                            { $ifNull: ['$userEmail', '$ipAddress'] }
                        ]
                    }
                }
            },
            { $match: { _key: { $ne: null, $ne: '' } } },
            { $group: { _id: '$_key' } },
            { $count: 'count' }
        );
        console.log('🔧 DEBUG: uniqueUsersAggPipeline:', JSON.stringify(uniqueUsersAggPipeline, null, 2));
        const uniqueUsersAggPromise = AMCInteraction.aggregate(uniqueUsersAggPipeline);

        // Fix: Create release-ownership scoped pipelines for all interaction counts
        const totalDownloadsPipeline = [
            { $match: { ...dateFilter, interactionType: 'asset_download' } },
            {
                $lookup: {
                    from: 'centerreleases',
                    localField: 'releaseId',
                    foreignField: '_id',
                    as: 'release'
                }
            },
            { $unwind: { path: '$release', preserveNullAndEmptyArrays: true } }
        ];

        const totalPageViewsPipeline = [
            { $match: { ...dateFilter, interactionType: 'page_view' } },
            {
                $lookup: {
                    from: 'centerreleases',
                    localField: 'releaseId',
                    foreignField: '_id',
                    as: 'release'
                }
            },
            { $unwind: { path: '$release', preserveNullAndEmptyArrays: true } }
        ];

        const totalQuickViewsPipeline = [
            { $match: { ...dateFilter, interactionType: 'asset_quick_view' } },
            {
                $lookup: {
                    from: 'centerreleases',
                    localField: 'releaseId',
                    foreignField: '_id',
                    as: 'release'
                }
            },
            { $unwind: { path: '$release', preserveNullAndEmptyArrays: true } }
        ];

        const totalSearchesPipeline = [
            { $match: { ...dateFilter, interactionType: 'search_query' } },
            {
                $lookup: {
                    from: 'centerreleases',
                    localField: 'releaseId',
                    foreignField: '_id',
                    as: 'release'
                }
            },
            { $unwind: { path: '$release', preserveNullAndEmptyArrays: true } }
        ];

        // For client-scoped roles, add release ownership filter to all pipelines
        if (!isGlobal && clientId) {
            const extra = [];
            extra.push({ 'release.clientId': clientId });
            if (mongoose.Types.ObjectId.isValid(clientId)) {
                extra.push({ 'release.clientId': new mongoose.Types.ObjectId(clientId) });
            }
            const clientFilter = { $match: { $or: extra } };
            
            totalDownloadsPipeline.push(clientFilter);
            totalPageViewsPipeline.push(clientFilter);
            totalQuickViewsPipeline.push(clientFilter);
            totalSearchesPipeline.push(clientFilter);
        }

        // Add count stages
        totalDownloadsPipeline.push({ $count: 'total' });
        totalPageViewsPipeline.push({ $count: 'total' });
        totalQuickViewsPipeline.push({ $count: 'total' });
        totalSearchesPipeline.push({ $count: 'total' });

        const [
            totalDownloadsResult,
            uniqueUsersAgg,
            totalPageViewsResult,
            totalQuickViewsResult,
            totalSearchesResult,
            publishedReleases,
            archivedReleases,
            dbPendingCount,
            embargoFutureCount
        ] = await Promise.all([
            AMCInteraction.aggregate(totalDownloadsPipeline),
            uniqueUsersAggPromise,
            AMCInteraction.aggregate(totalPageViewsPipeline),
            AMCInteraction.aggregate(totalQuickViewsPipeline),
            AMCInteraction.aggregate(totalSearchesPipeline),
            CenterRelease.countDocuments({ ...releaseScope, ...releaseDateWindow, status: 'published' }).catch(err => { console.error('Error counting published releases:', err); return 0; }),
            CenterRelease.countDocuments({ ...releaseScope, ...releaseDateWindow, status: 'archived' }).catch(err => { console.error('Error counting archived releases:', err); return 0; }),
            dbPendingCountPromise,
            embargoFutureCountPromise
        ]);

        // Extract counts from aggregation results
        const totalDownloads = totalDownloadsResult[0]?.total || 0;
        const totalPageViews = totalPageViewsResult[0]?.total || 0;
        const totalQuickViews = totalQuickViewsResult[0]?.total || 0;
        const totalSearches = totalSearchesResult[0]?.total || 0;

        // Extract unique users count from aggregation result
        console.log('🔧 DEBUG: uniqueUsersAgg raw result:', uniqueUsersAgg);
        console.log('🔧 DEBUG: uniqueUsersAgg type:', typeof uniqueUsersAgg);
        console.log('🔧 DEBUG: uniqueUsersAgg isArray:', Array.isArray(uniqueUsersAgg));
        console.log('🔧 DEBUG: uniqueUsersAgg length:', uniqueUsersAgg?.length);
        console.log('🔧 DEBUG: uniqueUsersAgg[0]:', uniqueUsersAgg?.[0]);
        const uniqueUsersCount = Array.isArray(uniqueUsersAgg) && uniqueUsersAgg[0]?.count ? uniqueUsersAgg[0].count : 0;
        console.log('🔧 DEBUG: Final uniqueUsersCount:', uniqueUsersCount);

        const pendingReleases = dbPendingCount + embargoFutureCount;

        // Optional: lightweight debug block (only when ?debug=1)
        if (req.query.debug === '1' || req.query.debug === 'true') {
          req._pendingDebug = { dbPendingCount, embargoFutureCount, totalPending: pendingReleases, nowIso: new Date().toISOString() };
        }
        
        console.log('📊 Release counts retrieved:', {
            publishedReleases,
            pendingReleases,
            archivedReleases,
            uniqueUsers: uniqueUsersCount
        });
        
        // Get previous period for comparison using same release-ownership scoping
        const previousPeriodDays = parseInt(dateRange) === 1 ? 1 : parseInt(dateRange) || 30;
        const previousStartDate = new Date(dateFilter.timestamp.$gte.getTime() - (previousPeriodDays * 24 * 60 * 60 * 1000));
        const previousDateFilter = {
            timestamp: {
                $gte: previousStartDate,
                $lt: dateFilter.timestamp.$gte
            }
        };
        
        // Fix: Use release-ownership scoping for previous period calculations
        const prevUsersAggPipeline = [
            { $match: previousDateFilter },
            {
                $lookup: {
                    from: 'centerreleases',
                    localField: 'releaseId',
                    foreignField: '_id',
                    as: 'release'
                }
            },
            { $unwind: { path: '$release', preserveNullAndEmptyArrays: true } }
        ];

        const prevDownloadsPipeline = [
            { $match: { ...previousDateFilter, interactionType: 'asset_download' } },
            {
                $lookup: {
                    from: 'centerreleases',
                    localField: 'releaseId',
                    foreignField: '_id',
                    as: 'release'
                }
            },
            { $unwind: { path: '$release', preserveNullAndEmptyArrays: true } }
        ];

        const prevPageViewsPipeline = [
            { $match: { ...previousDateFilter, interactionType: 'page_view' } },
            {
                $lookup: {
                    from: 'centerreleases',
                    localField: 'releaseId',
                    foreignField: '_id',
                    as: 'release'
                }
            },
            { $unwind: { path: '$release', preserveNullAndEmptyArrays: true } }
        ];

        // For client-scoped roles, add release ownership filter
        if (!isGlobal && clientId) {
            const extra = [];
            extra.push({ 'release.clientId': clientId });
            if (mongoose.Types.ObjectId.isValid(clientId)) {
                extra.push({ 'release.clientId': new mongoose.Types.ObjectId(clientId) });
            }
            const clientFilter = { $match: { $or: extra } };
            
            prevUsersAggPipeline.push(clientFilter);
            prevDownloadsPipeline.push(clientFilter);
            prevPageViewsPipeline.push(clientFilter);
        }

        prevUsersAggPipeline.push(
            {
                $project: {
                    _key: {
                        $ifNull: [
                            { $toString: '$userId' },
                            { $ifNull: ['$userEmail', '$ipAddress'] }
                        ]
                    }
                }
            },
            { $match: { _key: { $ne: null, $ne: '' } } },
            { $group: { _id: '$_key' } },
            { $count: 'count' }
        );

        prevDownloadsPipeline.push({ $count: 'total' });
        prevPageViewsPipeline.push({ $count: 'total' });
        
        const [
            prevDownloadsResult,
            prevUsersAgg,
            prevPageViewsResult
        ] = await Promise.all([
            AMCInteraction.aggregate(prevDownloadsPipeline),
            AMCInteraction.aggregate(prevUsersAggPipeline),
            AMCInteraction.aggregate(prevPageViewsPipeline)
        ]);

        const prevDownloads = prevDownloadsResult[0]?.total || 0;
        const prevPageViews = prevPageViewsResult[0]?.total || 0;
        
        const prevUsersCount = Array.isArray(prevUsersAgg) && prevUsersAgg[0]?.count ? prevUsersAgg[0].count : 0;
        
        // Calculate percentage changes
        const downloadChange = prevDownloads > 0 ? ((totalDownloads - prevDownloads) / prevDownloads * 100) : 0;
        const userChange = prevUsersCount > 0 ? ((uniqueUsersCount - prevUsersCount) / prevUsersCount * 100) : 0;
        const pageViewChange = prevPageViews > 0 ? ((totalPageViews - prevPageViews) / prevPageViews * 100) : 0;
        
        // Get top performing asset and release using release-ownership scoping
        const topAssetPipeline = [
            { $match: { ...dateFilter, interactionType: 'asset_download' } },
            {
                $lookup: {
                    from: 'centerreleases',
                    localField: 'releaseId',
                    foreignField: '_id',
                    as: 'release'
                }
            },
            { $unwind: { path: '$release', preserveNullAndEmptyArrays: true } }
        ];

        const topReleasePipeline = [
            { $match: { ...dateFilter, interactionType: 'asset_download' } },
            {
                $lookup: {
                    from: 'centerreleases',
                    localField: 'releaseId',
                    foreignField: '_id',
                    as: 'release'
                }
            },
            { $unwind: { path: '$release', preserveNullAndEmptyArrays: true } }
        ];

        // For client-scoped roles, add release ownership filter
        if (!isGlobal && clientId) {
            const extra = [];
            extra.push({ 'release.clientId': clientId });
            if (mongoose.Types.ObjectId.isValid(clientId)) {
                extra.push({ 'release.clientId': new mongoose.Types.ObjectId(clientId) });
            }
            const clientFilter = { $match: { $or: extra } };
            
            topAssetPipeline.push(clientFilter);
            topReleasePipeline.push(clientFilter);
        }

        topAssetPipeline.push(
            {
                $group: {
                    _id: '$assetName',
                    downloads: { $sum: 1 },
                    releaseTitle: { $first: '$releaseTitle' },
                    assetType: { $first: '$assetType' }
                }
            },
            { $sort: { downloads: -1 } },
            { $limit: 1 }
        );

        topReleasePipeline.push(
            { $group: { _id: '$releaseTitle', downloads: { $sum: 1 } } },
            { $sort: { downloads: -1 } },
            { $limit: 1 }
        );

        const [topAsset, topRelease] = await Promise.all([
            AMCInteraction.aggregate(topAssetPipeline),
            AMCInteraction.aggregate(topReleasePipeline)
        ]);
        
        // Calculate conversion rate (downloads per page view)
        const conversionRate = totalPageViews > 0 ? ((totalDownloads / totalPageViews) * 100) : 0;
        
        // Calculate average time to first download (mock data for now)
        const avgTimeToDownload = '12m 3s'; // This would need session tracking to calculate properly
        
        // Debug breakdown for pending releases calculation
        const debugBreakdown = {
            dbPendingCount,
            embargoFutureCount,
            totalPending: pendingReleases,
            nowIso: new Date().toISOString()
        };
        
        const data = {
            kpis: {
                totalDownloads: {
                    value: totalDownloads,
                    change: downloadChange,
                    trend: downloadChange >= 0 ? 'positive' : 'negative'
                },
                uniqueUsers: {
                    value: uniqueUsersCount,
                    change: userChange,
                    trend: userChange >= 0 ? 'positive' : 'negative'
                },
                publishedReleases: {
                    value: publishedReleases,
                    change: 0, // Can be calculated later if needed
                    trend: 'positive'
                },
                pendingReleases: {
                    value: pendingReleases,
                    change: 0, // Can be calculated later if needed
                    trend: 'positive'
                },
                archivedReleases: {
                    value: archivedReleases,
                    change: 0, // Can be calculated later if needed
                    trend: 'positive'
                },
                topAsset: {
                    value: topAsset.length > 0 ? topAsset[0]._id : 'No data',
                    downloads: topAsset.length > 0 ? topAsset[0].downloads : 0,
                    type: topAsset.length > 0 ? topAsset[0].assetType : null
                },
                topRelease: {
                    value: topRelease.length > 0 ? topRelease[0]._id : 'No data',
                    downloads: topRelease.length > 0 ? topRelease[0].downloads : 0
                },
                conversionRate: {
                    value: Math.round(conversionRate),
                    unit: '%'
                },
                avgTimeToDownload: {
                    value: avgTimeToDownload
                }
            },
            totals: {
                pageViews: totalPageViews,
                quickViews: totalQuickViews,
                searches: totalSearches
            }
        };

        if (req._pendingDebug) {
          (data.kpis.debug = data.kpis.debug || {}).pending = req._pendingDebug;
        }
        
        // Debug echo for unique users counting method
        if (String(req.query.debug) === '1' || String(req.query.debug) === 'true') {
          (data.kpis.debug = data.kpis.debug || {}).uniqueUsers = {
            method: 'coalesce(userId,userEmail,sessionId,ipAddress)',
            value: uniqueUsersCount
          };
        }

        // --- EXTRA METRICS FOR TOP CARDS ---

        // 1) Media pickup rate - DISABLED PERMANENTLY
        // User requested to remove this card completely
        let mediaPickupRate = null; // Always null to hide the card

        // 2) Engagement rate = downloads / (page_views + quick_views)
        const engagementRate = ((totalPageViews + totalQuickViews) > 0)
            ? Math.round((totalDownloads / (totalPageViews + totalQuickViews)) * 100)
            : 0;

        // 3) Real-time activity (downloads in last 5 minutes)
        // Fix: Use release-ownership scoping instead of getUserFilter
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
        const realtimeActivityPipeline = [
            { $match: { interactionType: 'asset_download', timestamp: { $gte: fiveMinAgo } } },
            {
                $lookup: {
                    from: 'centerreleases',
                    localField: 'releaseId',
                    foreignField: '_id',
                    as: 'release'
                }
            },
            { $unwind: { path: '$release', preserveNullAndEmptyArrays: true } }
        ];

        // For client-scoped roles, filter by RELEASE owner
        if (!isGlobal && clientId) {
            const extra = [];
            extra.push({ 'release.clientId': clientId });
            if (mongoose.Types.ObjectId.isValid(clientId)) {
                extra.push({ 'release.clientId': new mongoose.Types.ObjectId(clientId) });
            }
            realtimeActivityPipeline.push({ $match: { $or: extra } });
        }

        realtimeActivityPipeline.push({ $count: 'total' });
        const realtimeActivityResult = await AMCInteraction.aggregate(realtimeActivityPipeline);
        const realtimeActivity = realtimeActivityResult[0]?.total || 0;

        // 4) Asset utilization = (# unique assets downloaded) / (total assets available)
        // Fix: Use release-ownership scoping instead of getUserFilter
        const downloadedAssetPipeline = [
            { $match: { ...dateFilter, interactionType: 'asset_download' } }, // Remove userFilter
            {
                $lookup: {
                    from: 'centerreleases',
                    localField: 'releaseId',
                    foreignField: '_id',
                    as: 'release'
                }
            },
            { $unwind: { path: '$release', preserveNullAndEmptyArrays: true } }
        ];

        // For client-scoped roles, filter by RELEASE owner (not downloader)
        if (!isGlobal && clientId) {
            const extra = [];
            extra.push({ 'release.clientId': clientId });
            if (mongoose.Types.ObjectId.isValid(clientId)) {
                extra.push({ 'release.clientId': new mongoose.Types.ObjectId(clientId) });
            }
            downloadedAssetPipeline.push({ $match: { $or: extra } });
        }

        downloadedAssetPipeline.push(
            { $group: { _id: '$assetName' } }, // Use assetName instead of assetId for better uniqueness
            { $count: 'count' }
        );

        const totalAssetPipeline = [
            { $match: releaseScope },
            { $project: {
                total: {
                    $add: [
                        { $size: { $ifNull: ['$images', []] } },
                        { $size: { $ifNull: ['$videos', []] } },
                        { $size: { $ifNull: ['$supplementaryDocs', []] } },
                        { $size: { $ifNull: ['$releaseDocs', []] } }
                    ]
                }
            }},
            { $group: { _id: null, total: { $sum: '$total' } } }
        ];

        const [downloadedAssetResult, totalAssetResult] = await Promise.all([
            AMCInteraction.aggregate(downloadedAssetPipeline),
            CenterRelease.aggregate(totalAssetPipeline)
        ]);
        const downloadedAssetCount = downloadedAssetResult[0]?.count || 0;
        const totalAssetCount = totalAssetResult[0]?.total || 0;
        const assetUtilization = (totalAssetCount > 0)
            ? Math.round((downloadedAssetCount / totalAssetCount) * 100)
            : 0;

        // 5) Peak performance = hour of day with highest downloads in the selected range
        // Fix: Use release-ownership scoping instead of getUserFilter
        const peakHourPipeline = [
            { $match: { ...dateFilter, interactionType: 'asset_download' } },
            {
                $lookup: {
                    from: 'centerreleases',
                    localField: 'releaseId',
                    foreignField: '_id',
                    as: 'release'
                }
            },
            { $unwind: { path: '$release', preserveNullAndEmptyArrays: true } }
        ];

        // For client-scoped roles, filter by RELEASE owner
        if (!isGlobal && clientId) {
            const extra = [];
            extra.push({ 'release.clientId': clientId });
            if (mongoose.Types.ObjectId.isValid(clientId)) {
                extra.push({ 'release.clientId': new mongoose.Types.ObjectId(clientId) });
            }
            peakHourPipeline.push({ $match: { $or: extra } });
        }

        peakHourPipeline.push(
            { $project: { h: { $hour: '$timestamp' } } },
            { $group: { _id: '$h', c: { $sum: 1 } } },
            { $sort: { c: -1 } },
            { $limit: 1 }
        );
        const byHour = await AMCInteraction.aggregate(peakHourPipeline);
        const peakHour = (byHour[0]?._id ?? null); // e.g., 14 → "2 PM"

        // 6) Content freshness score = % of downloads from assets <= 14 days old
        // Fix: Use release-ownership scoping instead of getUserFilter
        const contentFreshnessPipeline = [
            { $match: { ...dateFilter, interactionType: 'asset_download', releaseId: { $ne: null } } }, // Remove userFilter
            {
                $lookup: {
                    from: 'centerreleases',
                    localField: 'releaseId',
                    foreignField: '_id',
                    as: 'release'
                }
            },
            { $unwind: { path: '$release', preserveNullAndEmptyArrays: true } }
        ];

        // For client-scoped roles, filter by RELEASE owner (not downloader)
        if (!isGlobal && clientId) {
            const extra = [];
            extra.push({ 'release.clientId': clientId });
            if (mongoose.Types.ObjectId.isValid(clientId)) {
                extra.push({ 'release.clientId': new mongoose.Types.ObjectId(clientId) });
            }
            contentFreshnessPipeline.push({ $match: { $or: extra } });
        }

        contentFreshnessPipeline.push(
            { $group: { _id: '$releaseId', last: { $max: '$timestamp' } } }
        );
        const downloadsWithRelease = await AMCInteraction.aggregate(contentFreshnessPipeline);
        let freshCount = 0;
        for (const row of downloadsWithRelease) {
            const r = await CenterRelease.findOne({ ...releaseScope, _id: row._id }, { releaseDate: 1 }).lean();
            if (!r?.releaseDate) continue;
            const ageDays = Math.floor((Date.now() - new Date(r.releaseDate).getTime()) / (86400000));
            if (ageDays <= 14) freshCount++;
        }
        const contentFreshness = (downloadsWithRelease.length > 0)
            ? Math.round((freshCount / downloadsWithRelease.length) * 100)
            : 0;

        // 7) AMC performance score (very simple composite; tune later)
        // Removed mediaPickupRate from calculation since it's disabled
        const amcScore = Math.max(1,
            Math.min(120, // cap
                Math.round(
                    (engagementRate * 0.4) +
                    (assetUtilization * 0.3) +
                    ((peakHour !== null ? 10 : 0)) +
                    (contentFreshness * 0.3)
                )
            )
        );

        // Media pickup rate - DISABLED (don't include in response)
        // data.kpis.pickupRate = null; // Completely removed
        data.kpis.engagementRate = { value: engagementRate, unit: '%' };
        data.kpis.realtimeActivity = { value: realtimeActivity };
        data.kpis.assetUtilization = { value: assetUtilization, unit: '%' };
        data.kpis.peakHour = { value: peakHour }; // number 0–23; you can format on the frontend
        data.kpis.contentFreshness = { value: contentFreshness, unit: '%' };
        data.kpis.amcScore = { value: amcScore };

        // --- HARDEN: Ensure extended KPIs are present in payload ---
        data.kpis = data.kpis || {};
        Object.assign(data.kpis, {
          // pickupRate: REMOVED - user requested to kill this card
          engagementRate:   { value: engagementRate,    unit: '%' },
          realtimeActivity: { value: realtimeActivity },
          assetUtilization: { value: assetUtilization,  unit: '%' },
          peakHour:         { value: peakHour },
          contentFreshness: { value: contentFreshness,  unit: '%' },
          amcScore:         { value: amcScore }
        });
        console.log('[OVERVIEW] KPI keys ->', Object.keys(data.kpis));

        res.json({
            success: true,
            data: data
        });
        
    } catch (error) {
        console.error('Error fetching AMC analytics overview:', error);
        res.status(500).json({ success: false, error: 'Server error fetching analytics overview' });
    }
});

// @route   GET /api/v1/amc-analytics/downloads-over-time
// @desc    Get downloads over time data for charts
// @access  Private
router.get('/downloads-over-time', auth, async (req, res) => {
    try {
        const { dateRange = '30', granularity = 'day' } = req.query;
        const dateFilter = getDateRangeFilter(dateRange);
        const userFilter = getUserFilter(req);
        const combinedFilter = { ...dateFilter, ...userFilter, interactionType: 'asset_download' };
        
        let groupBy;
        switch (granularity) {
            case 'hour':
                groupBy = {
                    year: { $year: '$timestamp' },
                    month: { $month: '$timestamp' },
                    day: { $dayOfMonth: '$timestamp' },
                    hour: { $hour: '$timestamp' }
                };
                break;
            case 'day':
                groupBy = {
                    year: { $year: '$timestamp' },
                    month: { $month: '$timestamp' },
                    day: { $dayOfMonth: '$timestamp' }
                };
                break;
            case 'week':
                groupBy = {
                    year: { $year: '$timestamp' },
                    week: { $week: '$timestamp' }
                };
                break;
            default:
                groupBy = {
                    year: { $year: '$timestamp' },
                    month: { $month: '$timestamp' },
                    day: { $dayOfMonth: '$timestamp' }
                };
        }
        
        const downloadsOverTime = await AMCInteraction.aggregate([
            { $match: combinedFilter },
            {
                $group: {
                    _id: groupBy,
                    downloads: { $sum: 1 },
                    uniqueUsers: { $addToSet: '$userId' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } },
            {
                $project: {
                    _id: 0,
                    date: '$_id',
                    downloads: 1,
                    uniqueUsers: { $size: '$uniqueUsers' }
                }
            }
        ]);
        
        res.json({
            success: true,
            data: downloadsOverTime
        });
        
    } catch (error) {
        console.error('Error fetching downloads over time:', error);
        res.status(500).json({ success: false, error: 'Server error fetching downloads over time' });
    }
});

// ---- COMPANY-AWARE DOWNLOADS BY ASSET TYPE ----
router.get('/downloads-by-asset-type', auth, async (req, res) => {
  const debug = String(req.query.debug || '').toLowerCase() === '1';
  try {
    const { dateRange = 'max' } = req.query;
    const { start, end } = parseDateRange(dateRange);

    const user = req.user || {};
    const isClientUser = ['client_admin', 'client_user'].includes(user.role);
    const userClientId = user.clientId || null;

    // Discover the actual releases collection name dynamically (avoids pluralization surprises)
    const releasesColl = CenterRelease.collection.name; // e.g. 'centerreleases'

    // Base match on interaction docs
    const baseMatch = { interactionType: 'asset_download' };

    // Allow either 'timestamp' or 'createdAt'
    if (start || end) {
      baseMatch.$or = [
        { timestamp: { ...(start ? { $gte: start } : {}), ...(end ? { $lt: end } : {}) } },
        { createdAt: { ...(start ? { $gte: start } : {}), ...(end ? { $lt: end } : {}) } },
      ];
    }

    // Build pipeline
    const pipeline = [
      { $match: baseMatch },
      // Attach release for company scoping
      {
        $lookup: {
          from: releasesColl,
          localField: 'releaseId',
          foreignField: '_id',
          as: 'rel',
        }
      },
      { $unwind: '$rel' },
      // Normalise asset type
      {
        $addFields: {
          assetTypeNorm: {
            $switch: {
              branches: [
                { case: { $in: ['$assetType', ['image','video','document','release']] }, then: '$assetType' }
              ],
              default: 'document'
            }
          }
        }
      }
    ];

    // Apply company scope for client users (cover both ObjectId and string schemas)
    if (isClientUser && userClientId) {
      let clientIdAsObj = null;
      if (mongoose.Types.ObjectId.isValid(userClientId)) {
        clientIdAsObj = new mongoose.Types.ObjectId(userClientId);
      }
      pipeline.push({
        $match: {
          $or: [
            { 'rel.clientId': userClientId },      // string schema
            ...(clientIdAsObj ? [{ 'rel.clientId': clientIdAsObj }] : [])
          ]
        }
      });
    }

    // Group and project
    pipeline.push(
      { $group: { _id: '$assetTypeNorm', downloads: { $sum: 1 } } },
      { $project: { _id: 0, assetType: '$_id', downloads: 1 } }
    );

    const raw = await AMCInteraction.aggregate(pipeline).allowDiskUse(true);

    // Ensure all buckets exist
    const buckets = { image: 0, video: 0, document: 0, release: 0 };
    for (const r of raw) {
      if (r && r.assetType in buckets) buckets[r.assetType] = r.downloads;
    }
    const data = Object.entries(buckets).map(([assetType, downloads]) => ({ assetType, downloads }));

    return res.json({ success: true, data, ...(debug ? { debug: { pipeline } } : {}) });
  } catch (err) {
    console.error('downloads-by-asset-type error:', err);
    if (debug) {
      return res.status(500).json({ success: false, error: err.message || String(err) });
    }
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   GET /api/v1/amc-analytics/downloads-by-region
// @desc    Get downloads breakdown by geographic region
// @access  Private
router.get('/downloads-by-region', auth, async (req, res) => {
    try {
        const { dateRange = '30' } = req.query;
        const dateFilter = getDateRangeFilter(dateRange);
        const userFilter = getUserFilter(req);
        const combinedFilter = { ...dateFilter, ...userFilter, interactionType: 'asset_download' };
        
        const downloadsByRegion = await AMCInteraction.aggregate([
            { $match: combinedFilter },
            {
                $group: {
                    _id: '$region',
                    downloads: { $sum: 1 },
                    uniqueUsers: { $addToSet: '$userId' },
                    countries: { $addToSet: '$country' }
                }
            },
            { $sort: { downloads: -1 } },
            {
                $project: {
                    _id: 0,
                    region: '$_id',
                    downloads: 1,
                    uniqueUsers: { $size: '$uniqueUsers' },
                    countries: { $size: '$countries' }
                }
            }
        ]);
        
        res.json({
            success: true,
            data: downloadsByRegion
        });
        
    } catch (error) {
        console.error('Error fetching downloads by region:', error);
        res.status(500).json({ success: false, error: 'Server error fetching downloads by region' });
    }
});

// @route   GET /api/v1/amc-analytics/engagement-breakdown
// @desc    Get engagement type breakdown (downloads, views, quick views)
// @access  Private
router.get('/engagement-breakdown', auth, async (req, res) => {
    try {
        const { dateRange = '30' } = req.query;
        const dateFilter = getDateRangeFilter(dateRange);
        const userFilter = getUserFilter(req);
        const combinedFilter = { ...dateFilter, ...userFilter };
        
        const engagementBreakdown = await AMCInteraction.aggregate([
            { $match: combinedFilter },
            {
                $group: {
                    _id: '$interactionType',
                    count: { $sum: 1 },
                    uniqueUsers: { $addToSet: '$userId' }
                }
            },
            { $sort: { count: -1 } },
            {
                $project: {
                    _id: 0,
                    interactionType: '$_id',
                    count: 1,
                    uniqueUsers: { $size: '$uniqueUsers' }
                }
            }
        ]);
        
        res.json({
            success: true,
            data: engagementBreakdown
        });
        
    } catch (error) {
        console.error('Error fetching engagement breakdown:', error);
        res.status(500).json({ success: false, error: 'Server error fetching engagement breakdown' });
    }
});

// @route   GET /api/v1/amc-analytics/hourly-heatmap
// @desc    Get hourly download heatmap data
// @access  Private
router.get('/hourly-heatmap', auth, async (req, res) => {
    try {
        const { dateRange = '30' } = req.query;
        const dateFilter = getDateRangeFilter(dateRange);
        const userFilter = getUserFilter(req);
        const combinedFilter = { ...dateFilter, ...userFilter, interactionType: 'asset_download' };
        
        const heatmapData = await AMCInteraction.aggregate([
            { $match: combinedFilter },
            {
                $group: {
                    _id: {
                        dayOfWeek: { $dayOfWeek: '$timestamp' },
                        hour: { $hour: '$timestamp' }
                    },
                    downloads: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    dayOfWeek: '$_id.dayOfWeek',
                    hour: '$_id.hour',
                    downloads: 1
                }
            }
        ]);
        
        res.json({
            success: true,
            data: heatmapData
        });
        
    } catch (error) {
        console.error('Error fetching hourly heatmap:', error);
        res.status(500).json({ success: false, error: 'Server error fetching hourly heatmap' });
    }
});

// @route   GET /api/v1/amc-analytics/top-releases
// @desc    Get top performing releases by downloads
// @access  Private
router.get('/top-releases', auth, async (req, res) => {
    try {
        const { dateRange = '30', limit = 10 } = req.query;
        const dateFilter = getDateRangeFilter(dateRange);
        const userFilter = getUserFilter(req);
        const combinedFilter = { ...dateFilter, ...userFilter, interactionType: 'asset_download' };
        
        const topReleases = await AMCInteraction.aggregate([
            { $match: { ...combinedFilter, releaseTitle: { $ne: null } } },
            {
                $group: {
                    _id: {
                        releaseId: '$releaseId',
                        releaseTitle: '$releaseTitle'
                    },
                    downloads: { $sum: 1 },
                    uniqueUsers: { $addToSet: '$userId' },
                    assetTypes: { $addToSet: '$assetType' }
                }
            },
            { $sort: { downloads: -1 } },
            { $limit: parseInt(limit) },
            {
                $project: {
                    _id: 0,
                    releaseId: '$_id.releaseId',
                    releaseTitle: '$_id.releaseTitle',
                    downloads: 1,
                    uniqueUsers: { $size: '$uniqueUsers' },
                    assetTypes: 1
                }
            }
        ]);
        
        res.json({
            success: true,
            data: topReleases
        });
        
    } catch (error) {
        console.error('Error fetching top releases:', error);
        res.status(500).json({ success: false, error: 'Server error fetching top releases' });
    }
});

// GET /api/v1/amc-analytics/top-assets?dateRange=30&limit=50&type=image
router.get('/top-assets', auth, async (req, res) => {
  try {
    const { dateRange = '30', limit = 10, type } = req.query;

    // Build your date filter the same way the rest of the file does
    const dateFilter = getDateRangeFilter(dateRange);
    const userFilter = getUserFilter(req);
    const combinedFilter = {
      ...dateFilter,
      ...userFilter,
      interactionType: 'asset_download',
      assetName: { $ne: null }
    };

    // Optional, but recommended: whitelist asset types
    const allowed = new Set(['image', 'video', 'document', 'release']);
    if (type && allowed.has(String(type).toLowerCase())) {
      combinedFilter.assetType = String(type).toLowerCase();
    }

    const pipeline = [
      { $match: combinedFilter },
      {
        $group: {
          _id: {
            assetName: '$assetName',
            assetType: '$assetType',
            releaseTitle: '$releaseTitle',
            releaseId: '$releaseId'
          },
          downloads: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' }
        }
      },
      { $project: {
          _id: 0,
          assetName: '$_id.assetName',
          assetType: '$_id.assetType',
          releaseTitle: '$_id.releaseTitle',
          releaseId: '$_id.releaseId',
          downloads: 1,
          uniqueUsers: { $size: '$uniqueUsers' }
      }},
      { $sort: { downloads: -1 } },
      { $limit: Number.parseInt(limit, 10) || 10 }
    ];
    appendClientScopeLookup(pipeline, req.user);

    const topAssets = await AMCInteraction.aggregate(pipeline);
    return res.json({ success: true, data: topAssets });
  } catch (err) {
    console.error('Top assets error:', err);
    return res.status(500).json({ success: false, error: 'Server error fetching top assets' });
  }
});

// @route   GET /api/v1/amc-analytics/top-users
// @desc    Get top users by download activity
// @access  Private
router.get('/top-users', auth, async (req, res) => {
    try {
        const { dateRange = '30', limit = 10 } = req.query;
        const dateFilter = getDateRangeFilter(dateRange);
        const userFilter = getUserFilter(req);
        const combinedFilter = { ...dateFilter, ...userFilter, interactionType: 'asset_download' };
        
        const topUsers = await AMCInteraction.aggregate([
            { $match: combinedFilter },
            {
                $group: {
                    _id: {
                        userId: '$userId',
                        userEmail: '$userEmail'
                    },
                    downloads: { $sum: 1 },
                    releases: { $addToSet: '$releaseId' },
                    assetTypes: { $addToSet: '$assetType' }
                }
            },
            { $sort: { downloads: -1 } },
            { $limit: parseInt(limit) },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id.userId',
                    foreignField: '_id',
                    as: 'userDetails'
                }
            },
            {
                $project: {
                    _id: 0,
                    userId: '$_id.userId',
                    userEmail: '$_id.userEmail',
                    downloads: 1,
                    uniqueReleases: { $size: '$releases' },
                    assetTypes: 1,
                    userDetails: { $arrayElemAt: ['$userDetails', 0] }
                }
            }
        ]);
        
        res.json({
            success: true,
            data: topUsers
        });
        
    } catch (error) {
        console.error('Error fetching top users:', error);
        res.status(500).json({ success: false, error: 'Server error fetching top users' });
    }
});

// @route   GET /api/v1/amc-analytics/recent-users
// @desc    Get recent users by last visit time (not by download count)
// @access  Private
router.get('/recent-users', auth, async (req, res) => {
    try {
        const { dateRange = '30', limit = 10 } = req.query;
        const dateFilter = getDateRangeFilter(dateRange);
        const userFilter = getUserFilter(req);
        const combinedFilter = { ...dateFilter, ...userFilter };
        
        const pipeline = [
            { $match: combinedFilter },
            {
                $group: {
                    _id: {
                        userId: '$userId',
                        userEmail: '$userEmail'
                    },
                    lastVisit: { $max: '$timestamp' },
                    downloads: {
                        $sum: {
                            $cond: [{ $eq: ['$interactionType', 'asset_download'] }, 1, 0]
                        }
                    },
                    totalInteractions: { $sum: 1 },
                    interactionTypes: { $addToSet: '$interactionType' }
                }
            },
            { $sort: { lastVisit: -1 } }, // Most recent first
            { $limit: parseInt(limit) },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id.userId',
                    foreignField: '_id',
                    as: 'userDetails'
                }
            },
            {
                $project: {
                    _id: 0,
                    userId: '$_id.userId',
                    userEmail: '$_id.userEmail',
                    lastVisit: 1,
                    downloads: 1,
                    totalInteractions: 1,
                    interactionTypes: 1,
                    userDetails: { $arrayElemAt: ['$userDetails', 0] }
                }
            }
        ];
        appendClientScopeLookup(pipeline, req.user);
        
        const recentUsers = await AMCInteraction.aggregate(pipeline);
        
        res.json({
            success: true,
            data: recentUsers
        });
        
    } catch (error) {
        console.error('Error fetching recent users:', error);
        res.status(500).json({ success: false, error: 'Server error fetching recent users' });
    }
});

// @route   GET /api/v1/amc-analytics/media-pickups
// @desc    Get recent media pickups for live feed
// @access  Private
router.get('/media-pickups', auth, async (req, res) => {
    try {
        const { limit = 20 } = req.query;
        const userFilter = getUserFilter(req);
        
        const pipeline = [
            { $sort: { detectedAt: -1 } },
            { $limit: parseInt(limit) },
            {
                $lookup: {
                    from: 'centerreleases',
                    localField: 'releaseId',
                    foreignField: '_id',
                    as: 'releaseDetails'
                }
            },
            {
                $project: {
                    detectedAt: 1,
                    releaseId: 1,
                    outlet: 1,
                    url: 1,
                    title: 1,
                    releaseDetails: { $arrayElemAt: ['$releaseDetails', 0] }
                }
            }
        ];
        appendClientScopeLookup(pipeline, req.user);
        
        const recentPickups = await MediaPickup.aggregate(pipeline);
        
        res.json({
            success: true,
            data: recentPickups
        });
        
    } catch (error) {
        console.error('Error fetching media pickups:', error);
        res.status(500).json({ success: false, error: 'Server error fetching media pickups' });
    }
});

// @route   GET /api/v1/amc-analytics/real-time-activity
// @desc    Get real-time activity stream
// @access  Private
router.get('/real-time-activity', auth, async (req, res) => {
    try {
        const { limit = 20 } = req.query;
        const userFilter = getUserFilter(req);
        
        // Get recent interactions from last 24 hours
        const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentActivity = await AMCInteraction.find({
            ...userFilter,
            timestamp: { $gte: last24Hours }
        })
        .sort({ timestamp: -1 })
        .limit(parseInt(limit))
        .lean();
        
        res.json({
            success: true,
            data: recentActivity
        });
        
    } catch (error) {
        console.error('Error fetching real-time activity:', error);
        res.status(500).json({ success: false, error: 'Server error fetching real-time activity' });
    }
});

// @route   POST /api/v1/amc-analytics/track
// @desc    Track single user interaction (called from frontend)
// @access  Private
router.post('/track', optionalAuth, async (req, res) => {
    try {
        const {
            interactionType,
            releaseId,
            releaseUuid,
            releaseTitle,
            assetType,
            assetName,
            assetPath,
            assetSize,
            searchQuery,
            filtersApplied,
            sortBy,
            timeOnPage,
            metadata
        } = req.body;
        
        // Get user's IP and user agent
        const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
        const userAgent = req.get('User-Agent') || 'unknown';
        const referrer = req.get('Referer') || null;
        
        // Get geographic data
        const geoData = await getGeographicData(ipAddress);
        
        
            // Skip asset_download - handled by universalDownloadTracker middleware
            if (interactionType === 'asset_download') {
                return res.status(200).json({ 
                    success: true, 
                    message: 'Download tracking handled by middleware',
                    skipped: true 
                });
            }

            // Anonymise IP for GDPR (Breyer): keep geo utility, drop identifying full IP.
            const anonIp = (ipAddress || '').includes(':')
                ? (ipAddress.split(':').slice(0,3).join(':') + '::')      // IPv6 → first 3 groups
                : (ipAddress || '').replace(/\.\d+$/, '.0');             // IPv4 → zero last octet

            // Create interaction record
            const interaction = new AMCInteraction({
                userId: req.user?.id || null,
            userEmail: req.user?.email || null,
            identityStatus: req.user?.id ? 'authenticated' : 'anonymous',
            sessionId: req.sessionID || `session_${Date.now()}_${Math.random()}`,
            interactionType,
            releaseId: releaseId || null,
            releaseUuid: releaseUuid || null,
            releaseTitle: releaseTitle || null,
            assetType: assetType || null,
            assetName: assetName || null,
            assetPath: assetPath || null,
            assetSize: assetSize || null,
            searchQuery: searchQuery || null,
            filtersApplied: filtersApplied || {},
            sortBy: sortBy || null,
            userAgent,
            ipAddress: anonIp,
            referrer,
            country: geoData.country,
            region: geoData.region,
            city: geoData.city,
            timeOnPage: timeOnPage || null,
            metadata: {
                ...metadata,
                clientId: req.user?.clientId || null,
                userRole: req.user?.role || 'anonymous'
            }
        });
        
        await interaction.save();
        
        res.json({
            success: true,
            message: 'Interaction tracked successfully'
        });
        
    } catch (error) {
        console.error('Error tracking interaction:', error);
        res.status(500).json({ success: false, error: 'Server error tracking interaction' });
    }
});

// Helper function to get asset type from filename
function getAssetTypeFromFilename(filename, releaseContext = null) {
    if (!filename) return 'document';
    
    const ext = filename.toLowerCase().split('.').pop();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
    if (['mp4', 'mov', 'avi', 'wmv', 'webm'].includes(ext)) return 'video';
    if (['pdf', 'doc', 'docx', 'txt'].includes(ext)) {
        // Check if this is a media release PDF
        if (releaseContext && releaseContext.isMediaRelease) {
            return 'release';
        }
        return 'document';
    }
    return 'other';
}

// @route   POST /api/v1/amc-analytics/update-with-real-assets
// @desc    Update analytics data with real asset names from actual releases
// @access  Private
router.post('/update-with-real-assets', auth, async (req, res) => {
    try {
        console.log('🔄 Updating analytics with real asset names...');
        
        // Get real releases (remove strict asset requirement for now)
        const releases = await CenterRelease.find({
            status: 'published'
        }).limit(50).lean();
        
        console.log(`📊 Found ${releases.length} releases with assets`);
        
        if (releases.length === 0) {
            return res.json({
                success: false,
                message: 'No releases with assets found'
            });
        }
        
        // Collect all real assets (handle different asset structures)
        const realAssets = [];
        releases.forEach(release => {
            // Check if release has assets array
            if (release.assets && Array.isArray(release.assets) && release.assets.length > 0) {
                release.assets.forEach(asset => {
                    if (asset.filename || asset.originalName) {
                        realAssets.push({
                            filename: asset.filename || asset.originalName,
                            releaseTitle: release.title || release.name,
                            releaseId: release._id,
                            assetId: asset._id
                        });
                    }
                });
            } else {
                // If no assets, create a placeholder entry using the release title
                realAssets.push({
                    filename: `${(release.title || release.name || 'Unknown Release').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
                    releaseTitle: release.title || release.name,
                    releaseId: release._id,
                    assetId: null
                });
            }
        });
        
        console.log(`📁 Found ${realAssets.length} real assets`);
        
        if (realAssets.length === 0) {
            return res.json({
                success: false,
                message: 'No assets with filenames found'
            });
        }
        
        // Update existing download interactions with real asset names
        const downloadInteractions = await AMCInteraction.find({
            interactionType: 'asset_download'
        });
        
        console.log(`📥 Found ${downloadInteractions.length} download interactions to update`);
        
        let updateCount = 0;
        for (const interaction of downloadInteractions) {
            // Pick a random real asset
            const randomAsset = realAssets[Math.floor(Math.random() * realAssets.length)];
            
            // Update the interaction with real asset data
            await AMCInteraction.updateOne(
                { _id: interaction._id },
                {
                    $set: {
                        assetName: randomAsset.filename,
                        releaseTitle: randomAsset.releaseTitle,
                        releaseId: randomAsset.releaseId,
                        assetId: randomAsset.assetId,
                        assetType: getAssetTypeFromFilename(randomAsset.filename, { isMediaRelease: true })
                    }
                }
            );
            updateCount++;
        }
        
        console.log(`✅ Updated ${updateCount} download interactions with real asset names`);
        
        // Get some examples
        const updatedInteractions = await AMCInteraction.find({
            interactionType: 'asset_download'
        }).limit(5);
        
        const examples = updatedInteractions.map(interaction => ({
            assetName: interaction.assetName,
            releaseTitle: interaction.releaseTitle,
            assetType: interaction.assetType
        }));
        
        res.json({
            success: true,
            message: `Updated ${updateCount} download interactions with real asset names`,
            data: {
                totalUpdated: updateCount,
                totalRealAssets: realAssets.length,
                totalReleases: releases.length,
                examples: examples
            }
        });
        
    } catch (error) {
        console.error('❌ Error updating analytics data:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating analytics data',
            error: error.message
        });
    }
});

// @route   POST /api/v1/amc-analytics/sync-download-events
// @desc    Sync download events to analytics interactions
// @access  Private
router.post('/sync-download-events', auth, async (req, res) => {
    try {
        console.log('🔄 Syncing download events to analytics...');
        
        // Import DownloadEvent model
        const DownloadEvent = require('../models/DownloadEvent');
        
        // Get recent download events that haven't been synced to analytics
        const recentDownloads = await DownloadEvent.find({
            timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
        }).populate('releaseId', 'title brand uuid').lean();
        
        console.log(`📥 Found ${recentDownloads.length} recent download events`);
        
        let syncCount = 0;
        for (const download of recentDownloads) {
            // Check if this download event already exists in analytics
            const existingInteraction = await AMCInteraction.findOne({
                'metadata.downloadEventId': download._id
            });
            
            if (!existingInteraction) {
                // Get asset details
                const release = download.releaseId;
                let assetName = 'Unknown Asset';
                let assetType = 'document';
                
                if (release) {
                    // Try to find the asset in the release
                    const fullRelease = await CenterRelease.findById(release._id);
                    if (fullRelease) {
                        // Look for the asset in all asset arrays
                        const allAssets = [
                            ...(fullRelease.images || []),
                            ...(fullRelease.videos || []),
                            ...(fullRelease.releaseDocs || []),
                            ...(fullRelease.supplementaryDocs || [])
                        ];
                        
                        const asset = allAssets.find(a => a._id.toString() === download.assetId.toString());
                        if (asset) {
                            assetName = asset.originalName || asset.filename || assetName;
                            assetType = getAssetTypeFromFilename(assetName, { isMediaRelease: true });
                        }
                    }
                }
                
                
                // DISABLED: Download tracking now handled by universalDownloadTracker middleware
                console.log('⚠️ Skipping download sync - handled by middleware');
                return res.status(200).json({ 
                    success: true, 
                    message: 'Download sync disabled - handled by middleware',
                    skipped: true 
                });

                // Create analytics interaction (DISABLED)
                const interaction = new AMCInteraction({
                    userId: download.downloaderUserId,
                    userEmail: 'user@example.com', // We'll need to get this from user lookup
                    sessionId: `download_sync_${download._id}`,
                    interactionType: 'asset_download',
                    releaseId: download.releaseId?._id || null,
                    releaseUuid: download.releaseId?.uuid || null,
                    releaseTitle: download.releaseId?.title || null,
                    assetType: assetType,
                    assetName: assetName,
                    assetPath: null,
                    assetSize: null,
                    userAgent: download.userAgent || 'Unknown',
                    ipAddress: download.ipAddress || 'Unknown',
                    referrer: null,
                    timestamp: download.timestamp,
                    metadata: {
                        downloadEventId: download._id,
                        clientId: download.assetOwnerClientId,
                        syncedFromDownloadEvent: true
                    }
                });
                
                await interaction.save();
                syncCount++;
            }
        }
        
        console.log(`✅ Synced ${syncCount} download events to analytics`);
        
        res.json({
            success: true,
            message: `Synced ${syncCount} download events to analytics`,
            data: {
                totalDownloadEvents: recentDownloads.length,
                newlySynced: syncCount,
                alreadySynced: recentDownloads.length - syncCount
            }
        });
        
    } catch (error) {
        console.error('❌ Error syncing download events:', error);
        res.status(500).json({
            success: false,
            message: 'Error syncing download events',
            error: error.message
        });
    }
});

// @route   GET /api/v1/amc-analytics/total-releases-count
// @desc    Get total count of active releases
// @access  Private
router.get('/total-releases-count', auth, async (req, res) => {
    try {
        const { dateRange = '30' } = req.query;
        const dateFilter = getDateRangeFilter(dateRange);
        const userFilter = getUserFilter(req);
        const combinedFilter = { ...dateFilter, ...userFilter, interactionType: 'asset_download' };
        
        // Get unique release titles from download interactions
        const uniqueReleases = await AMCInteraction.distinct('releaseTitle', {
            ...combinedFilter,
            releaseTitle: { $ne: null }
        });
        
        res.json({
            success: true,
            data: {
                totalReleases: uniqueReleases.length,
                dateRange: dateRange
            }
        });
        
    } catch (error) {
        console.error('Error fetching total releases count:', error);
        res.status(500).json({ success: false, error: 'Server error fetching total releases count' });
    }
});

// @route   GET /api/v1/amc-analytics/asset-type-count/:type
// @desc    Get download count for specific asset type (image, video, document)
// @access  Private
router.get('/asset-type-count/:type', auth, enforceNoOverride, async (req, res) => {
    try {
        const { type } = req.params;
        const { dateRange = 'all' } = req.query;
        
        // Validate asset type
        const validTypes = ['image', 'video', 'document', 'audio', 'other'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                error: `Invalid asset type. Must be one of: ${validTypes.join(', ')}`
            });
        }
        
        const dateFilter = getDateRangeFilter(dateRange);
        const combinedFilter = {
            ...dateFilter,
            interactionType: 'asset_download',
            assetType: type
        };
        
        console.log(`📊 Getting ${type} download count with filter:`, combinedFilter);
        
        // Use aggregation pipeline with proper client scoping
        const pipeline = [
            { $match: combinedFilter }
        ];
        appendClientScopeLookup(pipeline, req.user);
        pipeline.push({ $count: 'total' });
        
        const result = await AMCInteraction.aggregate(pipeline);
        const count = result[0]?.total || 0;
        
        console.log(`📈 ${type.toUpperCase()} downloads: ${count}`);
        
        res.json({
            success: true,
            data: {
                assetType: type,
                downloads: count,
                dateRange: dateRange
            }
        });
        
    } catch (error) {
        console.error(`Error fetching ${req.params.type} download count:`, error);
        res.status(500).json({
            success: false,
            error: `Server error fetching ${req.params.type} download count`
        });
    }
});

// @route   GET /api/v1/amc-analytics/combined-media-downloads
// @desc    Get combined count of image and video downloads (for media release combined downloads card)
// @access  Private
router.get('/combined-media-downloads', auth, enforceNoOverride, async (req, res) => {
    try {
        const { dateRange = 'all' } = req.query;
        const dateFilter = getDateRangeFilter(dateRange);
        const combinedFilter = {
            ...dateFilter,
            interactionType: 'asset_download',
            assetType: { $in: ['image', 'video'] }
        };
        
        console.log('📊 Getting combined media downloads with filter:', combinedFilter);
        
        // Use aggregation pipeline with proper client scoping for total count
        const totalPipeline = [
            { $match: combinedFilter }
        ];
        appendClientScopeLookup(totalPipeline, req.user);
        totalPipeline.push({ $count: 'total' });
        
        // Use aggregation pipeline with proper client scoping for breakdown
        const breakdownPipeline = [
            { $match: combinedFilter }
        ];
        appendClientScopeLookup(breakdownPipeline, req.user);
        breakdownPipeline.push({
            $group: {
                _id: '$assetType',
                count: { $sum: 1 }
            }
        });
        
        const [totalResult, breakdown] = await Promise.all([
            AMCInteraction.aggregate(totalPipeline),
            AMCInteraction.aggregate(breakdownPipeline)
        ]);
        
        const totalCount = totalResult[0]?.total || 0;
        const imageCount = breakdown.find(b => b._id === 'image')?.count || 0;
        const videoCount = breakdown.find(b => b._id === 'video')?.count || 0;
        
        console.log(`📈 Combined media downloads: ${totalCount} (Images: ${imageCount}, Videos: ${videoCount})`);
        
        res.json({
            success: true,
            data: {
                totalDownloads: totalCount,
                breakdown: {
                    images: imageCount,
                    videos: videoCount
                },
                dateRange: dateRange
            }
        });
        
    } catch (error) {
        console.error('Error fetching combined media downloads:', error);
        res.status(500).json({
            success: false,
            error: 'Server error fetching combined media downloads'
        });
    }
});
// @route   GET /api/v1/amc-analytics/releases-by-status/:status
// @desc    Get releases by status for modal content
// @access  Private
router.get('/releases-by-status/:status', auth, enforceNoOverride, async (req, res) => {
  try {
    const { status } = req.params;
    const { limit = 10, offset = 0 } = req.query;
    const userFilter = getUserFilter(req);
    const releaseScope = scopeMatchDirect(req.user);

    if (status === 'pending') {
      const moment = require('moment-timezone');
      const nowBerlin = moment().tz('Europe/Berlin').toDate();

      const pendingFilter = {
        ...releaseScope,
        $or: [
          { status: 'pending' },
          // published but future embargo
          {
            $and: [
              { status: 'published' },
              {
                $expr: {
                  $gt: [
                    {
                      $dateFromParts: {
                        year:  { $year: '$releaseDate' },
                        month: { $month: '$releaseDate' },
                        day:   { $dayOfMonth: '$releaseDate' },
                        hour: {
                          $toInt: {
                            $arrayElemAt: [
                              { $split: [ { $ifNull: ['$releaseTime','00:00'] }, ':' ] }, 0
                            ]
                          }
                        },
                        minute: {
                          $toInt: {
                            $arrayElemAt: [
                              { $split: [ { $ifNull: ['$releaseTime','00:00'] }, ':' ] }, 1
                            ]
                          }
                        },
                        timezone: 'Europe/Berlin'
                      }
                    },
                    nowBerlin
                  ]
                }
              }
            ]
          }
        ]
      };

      const releases = await CenterRelease.find(pendingFilter)
        .sort({ releaseDate: -1, createdAt: -1 })
        .skip(parseInt(offset)).limit(parseInt(limit))
        .lean();

      const total = await CenterRelease.countDocuments(pendingFilter);

      return res.json({ success: true, data: { releases, pagination: { total, limit: +limit, offset: +offset, hasMore: (+offset + +limit) < total } } });
    }

    // published / archived: original logic with scoping
    const filter = { ...releaseScope, status };

    const releases = await CenterRelease.find(filter)
      .sort({ createdAt: -1 })
      .skip(parseInt(offset)).limit(parseInt(limit))
      .lean();

    const total = await CenterRelease.countDocuments(filter);

    res.json({ success: true, data: { releases, pagination: { total, limit: +limit, offset: +offset, hasMore: (+offset + +limit) < total } } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error fetching releases' });
  }
});


// >>> ADD THIS DEBUG ROUTE <<<
router.get('/whoami', auth, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user?._id,
      email: req.user?.email,
      role: req.user?.role,
      clientId: req.user?.clientId
    },
    meta: {
      host: req.headers.host,
      path: req.path
    }
  });
});

// @route   GET /api/v1/amc-analytics/upload-volume
// @desc    Get total upload volume (MB/GB) with role-based scoping
// @access  Private
router.get('/upload-volume', auth, enforceNoOverride, async (req, res) => {
    try {
        const { dateRange = '30' } = req.query;
        const dateFilter = getDateRangeFilter(dateRange);
        const releaseScope = scopeMatchDirect(req.user);
        
        console.log(`📊 Upload Volume - User Role: ${req.user.role}, Date Range: ${dateRange} days`);
        
        // Build aggregation pipeline to sum asset sizes from releases
        const pipeline = [
            {
                $match: {
                    ...releaseScope,
                    createdAt: dateFilter.timestamp || {} // Use createdAt for release creation date
                }
            },
            {
                $project: {
                    totalSize: {
                        $add: [
                            // Sum sizes from all asset arrays
                            { $sum: { $ifNull: ['$images.size', []] } },
                            { $sum: { $ifNull: ['$videos.size', []] } },
                            { $sum: { $ifNull: ['$releaseDocs.size', []] } },
                            { $sum: { $ifNull: ['$supplementaryDocs.size', []] } },
                            // Include card teaser image if present
                            { $ifNull: ['$cardTeaserImageMeta.size', 0] }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalBytes: { $sum: '$totalSize' },
                    releaseCount: { $sum: 1 }
                }
            }
        ];
        
        const result = await CenterRelease.aggregate(pipeline);
        const totalBytes = result[0]?.totalBytes || 0;
        const releaseCount = result[0]?.releaseCount || 0;
        
        // Convert bytes to appropriate unit
        let value, unit;
        if (totalBytes >= 1024 * 1024 * 1024) {
            value = Math.round((totalBytes / (1024 * 1024 * 1024)) * 100) / 100;
            unit = 'GB';
        } else if (totalBytes >= 1024 * 1024) {
            value = Math.round((totalBytes / (1024 * 1024)) * 100) / 100;
            unit = 'MB';
        } else if (totalBytes >= 1024) {
            value = Math.round((totalBytes / 1024) * 100) / 100;
            unit = 'KB';
        } else {
            value = totalBytes;
            unit = 'bytes';
        }
        
        console.log(`📈 Upload Volume: ${value} ${unit} (${totalBytes} bytes) from ${releaseCount} releases`);
        
        res.json({
            success: true,
            data: {
                value,
                unit,
                totalBytes,
                releaseCount,
                dateRange,
                userRole: req.user.role,
                scope: req.user.role === 'platform_admin' ? 'all_companies' : 'client_scoped'
            }
        });
        
    } catch (error) {
        console.error('Error fetching upload volume:', error);
        res.status(500).json({
            success: false,
            error: 'Server error fetching upload volume'
        });
    }
});

// @route   GET /api/v1/amc-analytics/download-volume
// @desc    Get total download volume (MB/GB) with role-based scoping
// @access  Private
router.get('/download-volume', auth, enforceNoOverride, async (req, res) => {
  try {
    const { dateRange = '30' } = req.query;
    const dateFilter = getDateRangeFilter(dateRange); // e.g. { timestamp: { $gte, $lte } }

    const user = req.user || {};
    const isGlobal = isGlobalRole(user.role); // platform_admin etc.
    const clientId = user.clientId || null;

    console.log(`📊 Download Volume - User Role: ${user.role}, Date Range: ${dateRange} days`);

    // Base match: only date + "asset_download"
    const baseMatch = {
      ...(dateFilter || {}),
      interactionType: 'asset_download'
    };

    // --- Build aggregation pipeline ---
    const fs   = require('fs');
    const path = require('path');

    const pipeline = [
      { $match: baseMatch },
      {
        $lookup: {
          from: 'centerreleases',
          localField: 'releaseId',
          foreignField: '_id',
          as: 'release'
        }
      },
      { $unwind: { path: '$release', preserveNullAndEmptyArrays: true } }
    ];

    // For client-scoped roles, filter by RELEASE owner (not downloader)
    if (!isGlobal && clientId) {
      const mongoose = require('mongoose');
      const extra = [];

      // match string form
      extra.push({ 'release.clientId': clientId });

      // match ObjectId form
      if (mongoose.Types.ObjectId.isValid(clientId)) {
        extra.push({ 'release.clientId': new mongoose.Types.ObjectId(clientId) });
      }

      pipeline.push({ $match: { $or: extra } });
    }

    console.log('📊 Download Volume pipeline:', JSON.stringify(pipeline, null, 2));

    const interactions = await AMCInteraction.aggregate(pipeline);
    console.log(`📊 Found ${interactions.length} download interactions to process`);

    // For debug info: how many raw downloads in this date range (before client scoping)
    const totalDownloads = await AMCInteraction.countDocuments(baseMatch);

    let totalBytes = 0;
    let downloadsWithOriginalSize   = 0;
    let downloadsWithCalculatedSize = 0;

    for (const interaction of interactions) {
      let assetSize = 0;

      // 1. Use existing assetSize if available
      if (interaction.assetSize && interaction.assetSize > 0) {
        assetSize = interaction.assetSize;
        downloadsWithOriginalSize++;
        console.log(`📊 Using original size for ${interaction.assetName}: ${assetSize} bytes`);
      } else {
        // 2. Try to find size from CenterRelease assets
        if (interaction.release) {
          const allAssets = [
            ...(interaction.release.images || []),
            ...(interaction.release.videos || []),
            ...(interaction.release.releaseDocs || []),
            ...(interaction.release.supplementaryDocs || [])
          ];

          const matchingAsset = allAssets.find(asset => {
            const interactionName = (interaction.assetName || '').split('/').pop();
            const original = (asset.originalName || '').split('/').pop();
            const filename = (asset.filename || '').split('/').pop();
            return (
              interactionName &&
              (interactionName === original || interactionName === filename)
            );
          });

          if (matchingAsset && matchingAsset.size) {
            assetSize = matchingAsset.size;
            downloadsWithCalculatedSize++;
            console.log(
              `📊 Found size in release data for ${interaction.assetName}: ${assetSize} bytes`
            );
          }
        }

        // 3. Try filesystem as last resort
        if (assetSize === 0 && interaction.assetPath) {
          try {
            const fullPath = path.join(__dirname, '.', interaction.assetPath);
            if (fs.existsSync(fullPath)) {
              const stats = fs.statSync(fullPath);
              assetSize = stats.size;
              downloadsWithCalculatedSize++;
              console.log(
                `📊 Got filesystem size for ${interaction.assetName}: ${assetSize} bytes`
              );
            }
          } catch (err) {
            console.log(
              `📊 Could not get filesystem size for ${interaction.assetName}: ${err.message}`
            );
          }
        }
      }

      totalBytes += assetSize;
    }

    const downloadCount   = interactions.length;
    const downloadsWithSize =
      downloadsWithOriginalSize + downloadsWithCalculatedSize;

    console.log('📊 Final calculation result:', {
      totalBytes,
      downloadCount,
      downloadsWithOriginalSize,
      downloadsWithCalculatedSize
    });

    // --- Unit conversion (same as upload-volume) ---
    let value, unit;
    if (totalBytes >= 1024 * 1024 * 1024) {
      value = Math.round((totalBytes / (1024 * 1024 * 1024)) * 100) / 100;
      unit  = 'GB';
    } else if (totalBytes >= 1024 * 1024) {
      value = Math.round((totalBytes / (1024 * 1024)) * 100) / 100;
      unit  = 'MB';
    } else if (totalBytes >= 1024) {
      value = Math.round((totalBytes / 1024) * 100) / 100;
      unit  = 'KB';
    } else {
      value = totalBytes;
      unit  = 'bytes';
    }

    console.log(
      `📈 Download Volume: ${value} ${unit} (${totalBytes} bytes) from ${downloadCount} downloads`
    );

    res.json({
      success: true,
      data: {
        value,
        unit,
        totalBytes,
        downloadCount,
        downloadsWithSize,
        dateRange,
        userRole: user.role,
        scope: isGlobal ? 'all_companies' : 'client_scoped',
        debug: {
          totalDownloads,
          downloadsWithOriginalSize,
          downloadsWithCalculatedSize,
          message:
            totalBytes === 0
              ? 'No size could be resolved from assetSize, release metadata or filesystem'
              : 'Real data available'
        }
      }
    });
  } catch (error) {
    console.error('Error fetching download volume:', error);
    res.status(500).json({
      success: false,
      error: 'Server error fetching download volume'
    });
  }
});

// AMC AI Agent - Anthropic-powered intelligence agent
router.post('/ai-agent/query', auth, async (req, res) => {
  try {
    const { query, context, agent } = req.body;

    if (!query && !context) {
      return res.status(400).json({
        success: false,
        error: 'query or context required'
      });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('⚠️  AMC AI Agent: ANTHROPIC_API_KEY not set in .env');
      return res.status(503).json({
        success: false,
        error: 'AI agent not configured — ANTHROPIC_API_KEY missing from .env'
      });
    }

    console.log(`🤖 AMC AI Agent: agent=${agent || 'launch'} user=${req.user?.email || 'unknown'}`);

    const systemPrompts = {
      launch: `You are the AMC Launch Investigator, a specialist agent for automotive communications intelligence on the AutoMediaCenter platform.
You analyse why specific media releases over- or under-performed.
You have access to: download counts, journalist activity, geographic spread, asset format mix, timing data, and engagement rates.
Respond with:
1) **Verdict** — one sentence: over or underperformed and by how much
2) **Root Causes** — 3-5 specific factors drawn from the data provided
3) **Comparison** — how this compares to the platform context given
4) **Recommended Actions** — concrete next steps with priority order
Be direct. Reference specific numbers from the data. Use **bold** for section headers.`,

      timing: `You are the AMC Timing Intelligence agent, specialist in automotive media release embargo strategy.
You analyse journalist activity heatmap data and historical patterns to recommend optimal embargo lift timing.
Respond with:
1) **Optimal Window** — specific day and time (include timezone)
2) **Data Rationale** — what in the provided data supports this recommendation
3) **Market Considerations** — any market-specific factors
4) **What to Avoid** — specific timing risks
Give exact times. Automotive press operates on tight editorial cycles.`,

      journalist: `You are the AMC Journalist Relations agent, specialist in media relationship intelligence for automotive communications directors.
You analyse journalist engagement patterns from the AutoMediaCenter platform.
Respond with:
1) **VIP Tier** — who warrants personal briefings and advance notice
2) **At-Risk Relationships** — patterns suggesting download-but-no-publish behaviour
3) **Emerging Contacts** — journalists increasing engagement worth cultivating
4) **Outreach Recommendations** — specific actions for specific account types
Focus on actionable relationship intelligence.`,

      gap: `You are the AMC Coverage Gap Analyst, specialist in identifying media outreach failures and missed opportunities for automotive communications.
Respond with:
1) **Primary Gaps** — ranked by impact, with evidence from the data
2) **Root Hypothesis** — why each gap exists
3) **Target Actions** — specific journalists, outlets, or markets to address
4) **Timeline** — quick wins (this week) vs strategic fixes (next quarter)
Be analytical. Prioritise gaps by business impact.`,

      exec: `You are the AMC Executive Brief Generator for automotive communications directors and their leadership teams.
Format your response as a structured executive brief:

**EXECUTIVE SUMMARY**
[3 sentences maximum]

**KEY WINS**
[Bullet points with specific numbers]

**RISKS & CONCERNS**
[Bullet points requiring attention]

**RECOMMENDED ACTIONS**
[Numbered list, prioritised by urgency]

**FORWARD LOOK**
[1-2 sentences on what to watch next period]

Write for C-suite. No filler.`
    };

    let selectedSystem;
    if (agent === 'brand') {
        selectedSystem = `You are a brand intelligence researcher providing factual, publicly available information about automotive companies to professional journalists. Provide accurate information based on your knowledge, clearly noting approximate dates. For financial data use the most recently publicly reported figures you know, stating the period. Format as clean JSON when requested. If you do not know specific figures, provide your best estimate clearly marked as approximate.`;
    } else {
        selectedSystem = systemPrompts[agent] || systemPrompts.launch;
    }

    // Brand agent uses web search for live data
    const createParams = {
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: selectedSystem,
      messages: [
        {
          role: 'user',
          content: context || query
        }
      ]
    };
    // web search disabled for speed

    const message = await anthropic.messages.create(createParams);

    const responseText = message.content?.filter(c => c.type === 'text').map(c => c.text).join('\n') || 'Analysis complete.';

    console.log(`✅ AMC AI Agent: response generated (${message.usage?.input_tokens}in + ${message.usage?.output_tokens}out tokens)`);

    res.json({
      success: true,
      response: responseText,
      agent: agent || 'launch',
      usage: {
        inputTokens:  message.usage?.input_tokens,
        outputTokens: message.usage?.output_tokens
      }
    });

  } catch (error) {
    console.error('❌ AMC AI Agent error:', error.message);

    if (error.status === 401) {
      return res.status(503).json({
        success: false,
        error: 'AI agent authentication failed — check ANTHROPIC_API_KEY in .env'
      });
    }
    if (error.status === 429) {
      return res.status(429).json({
        success: false,
        error: 'AI agent rate limited — try again in a moment'
      });
    }
    if (error.status === 529) {
      return res.status(503).json({
        success: false,
        error: 'Anthropic API overloaded — try again shortly'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Server error from AI agent',
      details: error.message
    });
  }
});

module.exports = router;