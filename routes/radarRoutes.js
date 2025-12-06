// File: routes/radarRoutes.js

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth-bypass'); // FAKE AUTH - Always allows access
const RadarAlert = require('../models/RadarAlert');
const RadarAlertArchive = require('../models/RadarAlertArchive');
const { z } = require('zod');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose'); 

// --- Zod Schema & Multer Config (Preserved) ---
const createRadarAlertSchema = z.object({
  radarAlertUUID: z.string().uuid().optional().or(z.literal('')),
  title: z.string().min(1).max(250),
  dropDate: z.string().refine((val) => !isNaN(new Date(val).getTime()), { message: "Invalid date format" }),
  brand: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  tags: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  quickViewContent: z.string().optional().nullable(),
  action: z.enum(['draft', 'publish'])
});
const radarUploadDir = path.join(__dirname, '..', 'public', 'uploads', 'radar_teasers');
if (!fs.existsSync(radarUploadDir)) fs.mkdirSync(radarUploadDir, { recursive: true });
const radarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, radarUploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const safeOriginalName = Buffer.from(file.originalname, 'latin1').toString('utf8').replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${uniqueSuffix}_${safeOriginalName}`);
  }
});
const imageFileFilter = (req, file, cb) => { file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Not an image!'), false); };
const radarImageUpload = multer({ storage: radarStorage, fileFilter: imageFileFilter, limits: { fileSize: 5 * 1024 * 1024 }});

// =================================================================================================
// --- ROUTE ORDER IS CRITICAL ---
// =================================================================================================

// @route   GET /api/v1/radar/alerts
// @desc    Get all *ACTIVE, UPCOMING* PUBLISHED alerts for the public Radar page (newradarfe.html).
// @access  Private
router.get('/alerts', auth, async (req, res) => {
    try {
        const now = new Date();
        const alerts = await RadarAlert.find({ status: 'published', eventDateTime: { $gte: now } })
            .sort({ eventDateTime: 1 })
            .populate('user', 'email name').populate('clientId', 'clientName');
        res.status(200).json({ success: true, count: alerts.length, data: alerts });
    } catch (error) {
        console.error('Error fetching public Radar Alerts:', error);
        res.status(500).json({ success: false, error: 'Server error.' });
    }
});

// @route   GET api/v1/radar/all-alerts
// @desc    Get ALL radar alerts (draft, published, archived) for the management page (radar_history.html).
// @access  Private
router.get('/all-alerts', auth, async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const now = new Date();
        
        // FIXED: Proper role-based access control
        let baseQuery = {};
        if (req.user.role === 'client_user' || req.user.role === 'client_admin') {
            // Client users only see alerts from their own client
            if (!req.user.clientId) {
                return res.status(403).json({ success: false, error: 'User client association is missing.' });
            }
            baseQuery.clientId = req.user.clientId;
        } else if (req.user.role === 'platform_admin') {
            // Platform admins see ALL alerts (no query restriction)
            baseQuery = {};
        } else {
            // Individual users see only their own alerts
            baseQuery.user = req.user.id;
        }
        
        console.log(`🔍 ACCESS CONTROL: User ${req.user.email} (${req.user.role}) - Query:`, baseQuery);
        
        const [activeAndDraftAlerts, archivedAlerts] = await Promise.all([
            RadarAlert.find(baseQuery)
                .populate('user', 'email name')
                .populate({
                    path: 'clientId',
                    model: 'Client',
                    select: 'clientName'
                })
                .populate({
                    path: 'user',
                    populate: {
                        path: 'clientId',
                        model: 'Company',
                        select: 'name'
                    }
                })
                .lean(),
            RadarAlertArchive.find(baseQuery)
                .populate('user', 'email name')
                .populate({
                    path: 'clientId',
                    model: 'Client',
                    select: 'clientName'
                })
                .populate({
                    path: 'user',
                    populate: {
                        path: 'clientId',
                        model: 'Company',
                        select: 'name'
                    }
                })
                .lean()
        ]);
        const allUserAlerts = [
            ...activeAndDraftAlerts.map(a => ({...a, computedStatus: a.status === 'draft' ? 'Draft' : (new Date(a.eventDateTime) < now ? 'Archived' : 'Active') })),
            ...archivedAlerts.map(a => ({...a, computedStatus: 'Archived', eventDateTime: a.eventDateTime || a.originalEventDateTime, createdAt: a.originalCreatedAt || a.createdAt }))
        ];
        const uniqueAlerts = Array.from(new Map(allUserAlerts.map(alert => [alert.uuid, alert])).values());
        uniqueAlerts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const totalItems = uniqueAlerts.length;
        const totalPages = Math.ceil(totalItems / limit);
        const paginatedAlerts = uniqueAlerts.slice((page - 1) * limit, page * limit);
        res.json({ success: true, data: { alerts: paginatedAlerts, totalPages, currentPage: parseInt(page), totalItems } });
    } catch (error) {
        console.error('Error fetching all radar alerts:', error);
        res.status(500).json({ success: false, error: 'Server error fetching all alerts' });
    }
});

// --- CREATE Route (for new alerts from AssetDBmenu1.6.html) ---
router.post('/alerts', auth, radarImageUpload.single('radarTeaserImage'), async (req, res) => {
    try {
        console.log('🎯 RADAR ALERT CREATION STARTED');
        console.log('📧 User creating alert:', {
            id: req.user.id,
            email: req.user.email,
            role: req.user.role,
            clientId: req.user.clientId
        });
        
        const validationResult = createRadarAlertSchema.safeParse(req.body);
        if (!validationResult.success) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ success: false, error: 'Invalid input data.', details: validationResult.error.flatten() });
        }
        const { id: userId, clientId: userClientId, role } = req.user;
        let finalClientId = userClientId;
        if (role === 'platform_admin' && req.body.targetClientIdForAdmin) finalClientId = req.body.targetClientIdForAdmin;
        
        const { dropDate, tags, ...rest } = validationResult.data;
        
        const alertData = {
            ...rest,
            uuid: uuidv4(),
            eventDateTime: new Date(dropDate),
            tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
            user: userId,
            clientId: finalClientId,
            // BUG FIX: Map the action 'publish' to the schema value 'published'
            status: validationResult.data.action === 'publish' ? 'published' : 'draft'
        };

        if (req.file) {
             alertData.teaserImagePath = path.join('/uploads/radar_teasers/', req.file.filename).replace(/\\/g, '/');
        }
        
        console.log('💾 Creating radar alert with user ID:', userId);
        console.log('📝 Alert data being saved:', {
            title: alertData.title,
            user: alertData.user,
            userEmail: req.user.email
        });
        
        const newAlert = await RadarAlert.create(alertData);
        
        console.log('✅ RADAR ALERT CREATED SUCCESSFULLY');
        console.log('🔍 Created alert details:', {
            uuid: newAlert.uuid,
            title: newAlert.title,
            user: newAlert.user,
            createdBy: req.user.email
        });
        
        res.status(201).json({ success: true, message: `Radar Alert '${newAlert.title}' created.`, data: newAlert });
    } catch (error) { 
        console.error('Error in POST /api/v1/radar/alerts:', error);
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, error: 'Server error processing the Radar Alert.' });
    }
});


// --- UPDATE Route (for existing alerts from AssetDBmenu1.6.html) ---
router.put('/alerts/:uuid', auth, radarImageUpload.single('radarTeaserImage'), async (req, res) => {
    try {
        const validationResult = createRadarAlertSchema.safeParse(req.body);
        if (!validationResult.success) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ success: false, error: 'Invalid update data.', details: validationResult.error.flatten() });
        }
        const alertToUpdate = await RadarAlert.findOne({ uuid: req.params.uuid, user: req.user.id });
        if (!alertToUpdate) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(404).json({ success: false, error: 'Alert not found or you do not have permission.' });
        }
        
        const { dropDate, tags, ...restOfData } = validationResult.data;
        Object.assign(alertToUpdate, restOfData, { 
            eventDateTime: new Date(dropDate),
            tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
            // BUG FIX: Map the action 'publish' to the schema value 'published'
            status: validationResult.data.action === 'publish' ? 'published' : 'draft'
        });
        
        if (req.file) {
            if (alertToUpdate.teaserImagePath) {
                const oldImageFullPath = path.join(__dirname, '..', 'public', alertToUpdate.teaserImagePath);
                if (fs.existsSync(oldImageFullPath)) fs.unlinkSync(oldImageFullPath);
            }
            alertToUpdate.teaserImagePath = path.join('/uploads/radar_teasers/', req.file.filename).replace(/\\/g, '/');
        }
        const updatedAlert = await alertToUpdate.save();
        res.json({ success: true, message: `Alert '${updatedAlert.title}' successfully updated.`, data: updatedAlert });
    } catch (error) {
        console.error('Error in PUT /alerts/:uuid:', error);
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, error: 'Server error while updating.' });
    }
});


// --- PARAMETERIZED & OTHER ROUTES ---
router.get('/alerts/foredit/:uuid', auth, async (req, res) => {
    try {
        const alert = await RadarAlert.findOne({ uuid: req.params.uuid, user: req.user.id }).lean();
        if (!alert) return res.status(404).json({ success: false, error: 'Alert not found or it has been archived.' });
        alert.dropDate = alert.eventDateTime;
        if (Array.isArray(alert.tags)) alert.tags = alert.tags.join(', ');
        res.json({ success: true, data: alert });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

router.get('/alerts/:uuid', auth, async (req, res) => {
    try {
        const now = new Date();
        const alert = await RadarAlert.findOne({ uuid: req.params.uuid, status: 'published', eventDateTime: { $gte: now } })
            .populate('user', 'email name').populate('clientId', 'clientName');
        if (!alert) return res.status(404).json({ success: false, error: 'Active Radar Alert not found or has passed.' });
        res.status(200).json({ success: true, data: alert });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error.' });
    }
});

router.delete('/alerts/:uuid', auth, async (req, res) => {
    try {
        let alert = await RadarAlert.findOneAndDelete({ uuid: req.params.uuid, user: req.user.id });
        if (!alert) alert = await RadarAlertArchive.findOneAndDelete({ uuid: req.params.uuid, user: req.user.id });
        if (!alert) return res.status(404).json({ success: false, error: 'Alert not found.' });
        if (alert.teaserImagePath) {
            const imageFullPath = path.join(__dirname, '..', 'public', alert.teaserImagePath);
            if (fs.existsSync(imageFullPath)) fs.unlink(imageFullPath, (err) => { if (err) console.error(err); });
        }
        res.json({ success: true, message: 'Alert successfully deleted.' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error while deleting.' });
    }
});

router.get('/history/by-uuid/:uuid', auth, async (req, res) => {
    try {
        console.log('🔍 RADAR ALERT DETAILS REQUEST');
        console.log('📧 User requesting details:', {
            id: req.user.id,
            email: req.user.email,
            role: req.user.role,
            clientId: req.user.clientId
        });
        console.log('🎯 Alert UUID requested:', req.params.uuid);

        // Build query based on user role and company access
        let baseQuery = { uuid: req.params.uuid };
        
        if (req.user.role === 'platform_admin') {
            // Platform admins can see ALL alerts (no additional restrictions)
            console.log('🔓 Platform admin access - no restrictions');
        } else if (req.user.role === 'client_admin' || req.user.role === 'client_user') {
            // Client users can only see alerts from their company
            if (!req.user.clientId) {
                console.warn('❌ Client user missing clientId');
                return res.status(403).json({
                    success: false,
                    error: 'User client association is missing.'
                });
            }
            baseQuery.clientId = req.user.clientId;
            console.log('🏢 Client access - restricted to clientId:', req.user.clientId);
        } else {
            // Individual users (media_user) see only their own alerts
            baseQuery.user = req.user.id;
            console.log('👤 Individual user access - restricted to user:', req.user.id);
        }

        console.log('🔍 Query being executed:', baseQuery);

        // Search in archived alerts first
        let alert = await RadarAlertArchive.findOne(baseQuery)
            .populate('user', 'email name')
            .populate('clientId', 'clientName')
            .lean();
        
        if (!alert) {
            // If not found in archive, search in active alerts
            alert = await RadarAlert.findOne(baseQuery)
                .populate('user', 'email name')
                .populate('clientId', 'clientName')
                .lean();
        }

        if (!alert) {
            console.warn('❌ Alert not found with query:', baseQuery);
            return res.status(404).json({
                success: false,
                error: 'Alert not found in active or archived records.'
            });
        }

        console.log('✅ Alert found:', {
            uuid: alert.uuid,
            title: alert.title,
            clientId: alert.clientId?._id,
            clientName: alert.clientId?.clientName,
            createdBy: alert.user?.email
        });

        res.json({ success: true, data: alert });
    } catch (error) {
        console.error('❌ Error fetching alert details:', error);
        res.status(500).json({ success: false, error: 'Server error fetching alert details' });
    }
});


// --- Legacy /history routes ---
router.get('/history', auth, async (req, res) => {
    console.log('Backend received GET /api/v1/radar/history (Legacy)');
    try {
        const { page = 1, limit = 10, search = '', brand = '' } = req.query;
        let query = {};
        if (req.user && (req.user.role === 'client_user' || req.user.role === 'client_admin')) { 
            if (!req.user.clientId) { return res.status(403).json({ success: false, error: 'User client association is missing.' }); }
            query.clientId = req.user.clientId;
        }
        if (search) query.title = { $regex: search, $options: 'i' };
        if (brand) query.brand = { $regex: `^${brand}$`, $options: 'i' };
        
        const historyAlerts = await RadarAlertArchive.find(query)
            .populate('user', 'email name').populate('clientId', 'clientName')
            .sort({ archivedAt: -1 }).limit(parseInt(limit)).skip((parseInt(page) - 1) * parseInt(limit)).lean();
        const count = await RadarAlertArchive.countDocuments(query);
        res.json({ success: true, data: historyAlerts, totalPages: Math.ceil(count / parseInt(limit)), currentPage: parseInt(page), totalItems: count });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error fetching radar alert history' });
    }
});

router.get('/history/:id', auth, async (req, res) => {
    console.log(`Backend received GET /api/v1/radar/history/${req.params.id} (Legacy)`);
    try {
        const alertDetail = await RadarAlertArchive.findById(req.params.id).populate('user', 'email name').populate('clientId', 'clientName').lean();
        if (!alertDetail) return res.status(404).json({ success: false, error: 'Historical alert not found.' });
        
        if (req.user && (req.user.role === 'client_user' || req.user.role === 'client_admin')) {
            if (!req.user.clientId) { return res.status(403).json({ success: false, error: 'User client association is missing.'}); }
            if (!alertDetail.clientId || alertDetail.clientId._id.toString() !== req.user.clientId.toString()) {
                 return res.status(403).json({ success: false, error: 'Access denied to this historical alert.' });
            }
        } else if (req.user.role !== 'platform_admin') {
            return res.status(403).json({ success: false, error: 'Access denied.'});
        }
        res.json({ success: true, data: alertDetail });
    } catch (error) {
        if (error.kind === 'ObjectId') return res.status(400).json({ success: false, error: 'Invalid ID.' });
        res.status(500).json({ success: false, error: 'Server error.' });
    }
});


router.get('/analytics/summary', auth, async (req, res) => {
    try {
        let queryFilters = {};
        if (req.user && (req.user.role === 'client_user' || req.user.role === 'client_admin')) {
            if (!req.user.clientId) return res.status(403).json({ success: false, error: 'User client association is missing.'});
            queryFilters.clientId = new mongoose.Types.ObjectId(req.user.clientId);
        } else if (req.user.role !== 'platform_admin') {
            return res.status(403).json({ success: false, error: 'Access denied to analytics summary.'});
        }
        
        const totalAlertsLogged = await RadarAlertArchive.countDocuments(queryFilters);
        const [topBrands, topRegions] = await Promise.all([
            RadarAlertArchive.aggregate([ { $match: { ...queryFilters, brand: { $ne: null, $ne: "" } } }, { $group: { _id: "$brand", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 } ]),
            RadarAlertArchive.aggregate([ { $match: { ...queryFilters, region: { $ne: null, $ne: "" } } }, { $group: { _id: "$region", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 } ])
        ]);
        res.json({ success: true, data: { totalAlertsLogged, topBrands, topRegions } });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error fetching analytics summary' });
    }
});

module.exports = router;