// File: routes/radarRoutes.js
console.log('🔄 radarRoutes.js loaded — using .fields() multer config');

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const RadarAlert = require('../models/RadarAlert');
const RadarAlertArchive = require('../models/RadarAlertArchive');
const { z } = require('zod');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const createRadarAlertSchema = z.object({
  radarAlertUUID:      z.string().uuid().optional().or(z.literal('')),
  title:               z.string().min(1).max(250),
  dropDate:            z.string().refine((val) => !isNaN(new Date(val).getTime()), { message: 'Invalid date format' }),
  brand:               z.string().optional().nullable(),
  companyName:         z.string().optional().nullable(),
  region:              z.string().optional().nullable(),
  tags:                z.string().optional().nullable(),
  description:         z.string().optional().nullable(),
  quickViewContent:    z.string().optional().nullable(),
  action:              z.enum(['draft', 'publish']),
  eventDateTime:       z.string().optional().nullable(),
  eventTimezone:       z.string().optional().nullable(),
  contentCategory:     z.string().optional().nullable(),
  primaryLanguage:     z.string().optional().nullable(),
  targetMarkets:       z.string().optional().nullable(),
  languageVariantsJson:z.string().optional().nullable(),
  legalTermsAck:       z.string().optional().nullable(),
});

const radarUploadDir  = path.join(__dirname, '..', 'public', 'uploads', 'radar_teasers');
const radarDocDir     = path.join(__dirname, '..', 'public', 'uploads', 'radar_docs');

[radarUploadDir, radarDocDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const radarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, file.fieldname === 'radarAlertDoc' ? radarDocDir : radarUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const safeName = Buffer.from(file.originalname, 'latin1')
      .toString('utf8')
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${uniqueSuffix}_${safeName}`);
  }
});

const radarFileFilter = (req, file, cb) => {
  if (file.fieldname === 'radarTeaserImage') {
    file.mimetype.startsWith('image/')
      ? cb(null, true)
      : cb(new Error('Teaser must be an image'), false);
  } else if (file.fieldname === 'radarAlertDoc') {
    ['application/pdf',
     'application/msword',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      .includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Alert document must be PDF or DOCX'), false);
  } else {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
  }
};

const radarUpload = multer({
  storage:    radarStorage,
  fileFilter: radarFileFilter,
  limits:     { fileSize: 10 * 1024 * 1024 }
}).fields([
  { name: 'radarTeaserImage', maxCount: 1 },
  { name: 'radarAlertDoc',    maxCount: 1 }
]);

const cleanupFiles = (req) => {
  if (!req.files) return;
  Object.values(req.files).flat().forEach(f => {
    if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
  });
};

const buildAlertData = (validatedData, req) => {
  const { dropDate, tags, action, radarAlertUUID, ...rest } = validatedData;

  const data = {
    ...rest,
    eventDateTime: new Date(dropDate),
    tags:          tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    status:        action === 'publish' ? 'published' : 'draft',
    user:          req.user.id,
  };

  let finalClientId = req.user.clientId;
  if (req.user.role === 'platform_admin' && req.body.targetClientIdForAdmin) {
    finalClientId = req.body.targetClientIdForAdmin;
  }
  data.clientId = finalClientId;

  const teaserFile = req.files?.radarTeaserImage?.[0];
  if (teaserFile) {
    data.teaserImagePath = `/uploads/radar_teasers/${teaserFile.filename}`;
  }

  const docFile = req.files?.radarAlertDoc?.[0];
  if (docFile) {
    data.alertDocPath = `/uploads/radar_docs/${docFile.filename}`;
    data.alertDocOriginalName = docFile.originalname || docFile.filename;
  }

  return data;
};


// =================================================================================================
// ROUTES
// =================================================================================================

// GET /api/v1/radar/alerts — public upcoming published alerts (newradarfe.html)
router.get('/alerts', authenticate, async (req, res) => {
  try {
    const now = new Date();
    const alerts = await RadarAlert.find({ status: 'published', eventDateTime: { $gte: now } })
      .sort({ eventDateTime: 1 })
      .populate('user', 'email name')
      .populate('clientId', 'clientName');
    res.status(200).json({ success: true, count: alerts.length, data: alerts });
  } catch (error) {
    console.error('Error fetching public Radar Alerts:', error);
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

// GET /api/v1/radar/all-alerts — all alerts for management page
router.get('/all-alerts', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 10, title = '', brand = '', status = '' } = req.query;
    const now = new Date();

    let baseQuery = {};
    if (req.user.role === 'client_user' || req.user.role === 'client_admin') {
      if (!req.user.clientId) return res.status(403).json({ success: false, error: 'User client association is missing.' });
      baseQuery.clientId = req.user.clientId;
    } else if (req.user.role !== 'platform_admin') {
      baseQuery.user = req.user.id;
    }

    const [activeAndDraftAlerts, archivedAlerts] = await Promise.all([
      RadarAlert.find(baseQuery)
        .populate('user', 'email name')
        .populate({ path: 'clientId', model: 'Client', select: 'clientName' })
        .lean(),
      RadarAlertArchive.find(baseQuery)
        .populate('user', 'email name')
        .populate({ path: 'clientId', model: 'Client', select: 'clientName' })
        .lean()
    ]);

    const allAlerts = [
      ...activeAndDraftAlerts.map(a => ({ ...a, computedStatus: a.status === 'draft' ? 'Draft' : (new Date(a.eventDateTime) < now ? 'Archived' : 'Active') })),
      ...archivedAlerts.map(a => ({ ...a, computedStatus: 'Archived', eventDateTime: a.eventDateTime || a.originalEventDateTime, createdAt: a.originalCreatedAt || a.createdAt }))
    ];

    let unique = Array.from(new Map(allAlerts.map(a => [a.uuid, a])).values());
    unique.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // ── Search: title param searches across title, brand, tags, description ──
    if (title) {
      const term = title.toLowerCase();
      unique = unique.filter(a =>
        (a.title || '').toLowerCase().includes(term) ||
        (a.brand || '').toLowerCase().includes(term) ||
        (a.description || '').toLowerCase().includes(term) ||
        (Array.isArray(a.tags) ? a.tags.join(' ') : (a.tags || '')).toLowerCase().includes(term)
      );
    }

    // ── Brand filter (separate, partial match) ──
    if (brand) {
      const b = brand.toLowerCase();
      unique = unique.filter(a => (a.brand || '').toLowerCase().includes(b));
    }

    // ── Status filter ──
    if (status) {
      const s = status.toLowerCase();
      unique = unique.filter(a => (a.computedStatus || '').toLowerCase() === s);
    }

    const totalItems = unique.length;
    res.json({
      success: true,
      data: {
        alerts:      unique.slice((page - 1) * limit, page * limit),
        totalPages:  Math.ceil(totalItems / limit),
        currentPage: parseInt(page),
        totalItems,
        totalAlerts: totalItems   // explicit alias for frontend counter
      }
    });
  } catch (error) {
    console.error('Error fetching all radar alerts:', error);
    res.status(500).json({ success: false, error: 'Server error fetching all alerts' });
  }
});

// POST /api/v1/radar/alerts — CREATE new alert
router.post('/alerts', authenticate, radarUpload, async (req, res) => {
  try {
    console.log('🎯 RADAR ALERT CREATION STARTED — user:', req.user.email);

    const validationResult = createRadarAlertSchema.safeParse(req.body);
    if (!validationResult.success) {
      cleanupFiles(req);
      return res.status(400).json({ success: false, error: 'Invalid input data.', details: validationResult.error.flatten() });
    }

    const alertData = {
      ...buildAlertData(validationResult.data, req),
      uuid: uuidv4(),
    };

    const newAlert = await RadarAlert.create(alertData);
    console.log('✅ RADAR ALERT CREATED:', newAlert.uuid, newAlert.title);

    res.status(201).json({ success: true, message: `Radar Alert '${newAlert.title}' created.`, data: newAlert });
  } catch (error) {
    cleanupFiles(req);
    console.error('Error in POST /api/v1/radar/alerts:', error);
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ success: false, error: 'MulterError', message: error.message });
    }
    res.status(500).json({ success: false, error: 'Server error processing the Radar Alert.' });
  }
});

// PUT /api/v1/radar/alerts/:uuid — UPDATE existing alert
router.put('/alerts/:uuid', authenticate, radarUpload, async (req, res) => {
  try {
    const validationResult = createRadarAlertSchema.safeParse(req.body);
    if (!validationResult.success) {
      cleanupFiles(req);
      return res.status(400).json({ success: false, error: 'Invalid update data.', details: validationResult.error.flatten() });
    }

    const ownerQuery = req.user.role === 'platform_admin'
      ? { uuid: req.params.uuid }
      : { uuid: req.params.uuid, user: req.user.id };

    const alertToUpdate = await RadarAlert.findOne(ownerQuery);
    if (!alertToUpdate) {
      cleanupFiles(req);
      return res.status(404).json({ success: false, error: 'Alert not found or you do not have permission.' });
    }

    const updates = buildAlertData(validationResult.data, req);

    if (req.files?.radarTeaserImage?.[0] && alertToUpdate.teaserImagePath) {
      const oldPath = path.join(__dirname, '..', 'public', alertToUpdate.teaserImagePath);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    if (req.files?.radarAlertDoc?.[0] && alertToUpdate.alertDocPath) {
      const oldPath = path.join(__dirname, '..', 'public', alertToUpdate.alertDocPath);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    Object.assign(alertToUpdate, updates);
    const updatedAlert = await alertToUpdate.save();

    res.json({ success: true, message: `Alert '${updatedAlert.title}' updated.`, data: updatedAlert });
  } catch (error) {
    cleanupFiles(req);
    console.error('Error in PUT /alerts/:uuid:', error);
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ success: false, error: 'MulterError', message: error.message });
    }
    res.status(500).json({ success: false, error: 'Server error while updating.' });
  }
});

// GET /api/v1/radar/alerts/foredit/:uuid
router.get('/alerts/foredit/:uuid', authenticate, async (req, res) => {
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

// GET /api/v1/radar/alerts/:uuid — single published alert (amc-alert-detail.html)
router.get('/alerts/:uuid', authenticate, async (req, res) => {
  try {
    const now = new Date();
    const alert = await RadarAlert.findOne({ uuid: req.params.uuid, status: 'published', eventDateTime: { $gte: now } })
      .populate('user', 'email name')
      .populate('clientId', 'clientName');
    if (!alert) return res.status(404).json({ success: false, error: 'Active Radar Alert not found or has passed.' });
    res.status(200).json({ success: true, data: alert });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

// DELETE /api/v1/radar/alerts/:uuid
router.delete('/alerts/:uuid', authenticate, async (req, res) => {
  try {
    let alert = await RadarAlert.findOneAndDelete({ uuid: req.params.uuid, user: req.user.id });
    if (!alert) alert = await RadarAlertArchive.findOneAndDelete({ uuid: req.params.uuid, user: req.user.id });
    if (!alert) return res.status(404).json({ success: false, error: 'Alert not found.' });

    [alert.teaserImagePath, alert.alertDocPath].forEach(filePath => {
      if (!filePath) return;
      const full = path.join(__dirname, '..', 'public', filePath);
      if (fs.existsSync(full)) fs.unlink(full, err => { if (err) console.error(err); });
    });

    res.json({ success: true, message: 'Alert successfully deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error while deleting.' });
  }
});

// GET /api/v1/radar/history/by-uuid/:uuid — detail view (amc-alert-detail.html)
router.get('/history/by-uuid/:uuid', authenticate, async (req, res) => {
  try {
    let baseQuery = { uuid: req.params.uuid };

    if (req.user.role === 'client_admin' || req.user.role === 'client_user') {
      if (!req.user.clientId) return res.status(403).json({ success: false, error: 'User client association is missing.' });
      baseQuery.clientId = req.user.clientId;
    } else if (req.user.role !== 'platform_admin') {
      baseQuery.user = req.user.id;
    }

    let alert = await RadarAlertArchive.findOne(baseQuery).populate('user', 'email name').populate('clientId', 'clientName').lean();
    if (!alert) alert = await RadarAlert.findOne(baseQuery).populate('user', 'email name').populate('clientId', 'clientName').lean();
    if (!alert) return res.status(404).json({ success: false, error: 'Alert not found in active or archived records.' });

    res.json({ success: true, data: alert });
  } catch (error) {
    console.error('Error fetching alert details:', error);
    res.status(500).json({ success: false, error: 'Server error fetching alert details' });
  }
});

// GET /api/v1/radar/history — legacy
router.get('/history', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', brand = '' } = req.query;
    let query = {};
    if (req.user.role === 'client_user' || req.user.role === 'client_admin') {
      if (!req.user.clientId) return res.status(403).json({ success: false, error: 'User client association is missing.' });
      query.clientId = req.user.clientId;
    }
    if (search) query.title = { $regex: search, $options: 'i' };
    if (brand)  query.brand = { $regex: `^${brand}$`, $options: 'i' };

    const historyAlerts = await RadarAlertArchive.find(query)
      .populate('user', 'email name').populate('clientId', 'clientName')
      .sort({ archivedAt: -1 }).limit(parseInt(limit)).skip((parseInt(page) - 1) * parseInt(limit)).lean();
    const count = await RadarAlertArchive.countDocuments(query);
    res.json({ success: true, data: historyAlerts, totalPages: Math.ceil(count / parseInt(limit)), currentPage: parseInt(page), totalItems: count });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error fetching radar alert history' });
  }
});

// GET /api/v1/radar/history/:id — legacy
router.get('/history/:id', authenticate, async (req, res) => {
  try {
    const alertDetail = await RadarAlertArchive.findById(req.params.id).populate('user', 'email name').populate('clientId', 'clientName').lean();
    if (!alertDetail) return res.status(404).json({ success: false, error: 'Historical alert not found.' });

    if (req.user.role === 'client_user' || req.user.role === 'client_admin') {
      if (!req.user.clientId) return res.status(403).json({ success: false, error: 'User client association is missing.' });
      if (!alertDetail.clientId || alertDetail.clientId._id.toString() !== req.user.clientId.toString()) {
        return res.status(403).json({ success: false, error: 'Access denied to this historical alert.' });
      }
    } else if (req.user.role !== 'platform_admin') {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }
    res.json({ success: true, data: alertDetail });
  } catch (error) {
    if (error.kind === 'ObjectId') return res.status(400).json({ success: false, error: 'Invalid ID.' });
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

// GET /api/v1/radar/analytics/summary
router.get('/analytics/summary', authenticate, async (req, res) => {
  try {
    let queryFilters = {};
    if (req.user.role === 'client_user' || req.user.role === 'client_admin') {
      if (!req.user.clientId) return res.status(403).json({ success: false, error: 'User client association is missing.' });
      queryFilters.clientId = new mongoose.Types.ObjectId(req.user.clientId);
    } else if (req.user.role !== 'platform_admin') {
      return res.status(403).json({ success: false, error: 'Access denied to analytics summary.' });
    }

    const totalAlertsLogged = await RadarAlertArchive.countDocuments(queryFilters);
    const [topBrands, topRegions] = await Promise.all([
      RadarAlertArchive.aggregate([{ $match: { ...queryFilters, brand: { $ne: null, $ne: '' } } }, { $group: { _id: '$brand', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
      RadarAlertArchive.aggregate([{ $match: { ...queryFilters, region: { $ne: null, $ne: '' } } }, { $group: { _id: '$region', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }])
    ]);
    res.json({ success: true, data: { totalAlertsLogged, topBrands, topRegions } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Server error fetching analytics summary' });
  }
});

module.exports = router;
