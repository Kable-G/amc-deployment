// routes/events.routes.js
const mongoose = require('mongoose');
const express = require('express');
const router = express.Router();
const { z } = require('zod');
const AssetEvent = require('../models/AssetEvent');
const { authenticate } = require('../middleware/authMiddleware'); // Real authentication
const admin = require('../middleware/admin');
const RadarInteraction = require('../models/RadarInteraction');
const RadarAlert = require('../models/RadarAlert');

// --- Define Zod Schema for POST /log input validation ---
const LogEventSchema = z.object({
    assetId: z.string().min(1, { message: "Asset ID cannot be empty" }),
    eventType: z.enum(['preview', 'download', 'stream', 'publish', 'draft', 'publish_attempt']),
    relatedInfo: z.string().optional().nullable()
});

// --- Define Zod Schema for POST /log-radar-interaction ---
const LogRadarInteractionSchema = z.object({
    alertId: z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), { message: "Invalid Alert ID format" }),
    interactionType: z.enum([
        'view',
        'calendar_add',
        'reminder_set',
        'follow_alert',
        'quick_view_open' // <<< ADDED THIS VALUE
        // 'detail_click' // Add if you have a separate detail page for radar alerts
    ])
});

// --- Route Definition 1: Log a generic asset event ---
router.post('/log', authenticate, async (req, res, next) => {
    console.log('API received request for POST /log');
    console.log('Request body for /log:', req.body);

    try {
        const parsed = LogEventSchema.safeParse(req.body);
        if (!parsed.success) {
            console.error('Event log validation failed (Zod):', parsed.error.flatten().fieldErrors);
            return res.status(400).json({ success: false, error: 'Invalid input data for event log.', details: parsed.error.flatten().fieldErrors });
        }

        const { assetId, eventType, relatedInfo } = parsed.data;

        const event = new AssetEvent({
            userId: req.user.id,
            assetId: assetId,
            eventType: eventType,
            relatedInfo: relatedInfo || undefined,
            referrer: req.headers.referer || 'Direct/Unknown',
            ip: req.ip || req.socket.remoteAddress,
            userAgent: req.headers['user-agent'] || 'Unknown',
        });

        const savedEvent = await event.save();
        console.log(`Asset event logged successfully: ${savedEvent._id} for eventType: ${eventType}`);

        res.status(201).json({ success: true, message: 'Event logged successfully.', eventId: savedEvent._id });

    } catch (err) {
        console.error('Error in POST /log route:', err);
        res.status(500).json({ success: false, error: 'Server error logging event.' });
    }
});

// --- Route Definition 2: Retrieve all generic asset events ---
router.get('/all', [authenticate, admin], async (req, res, next) => {
    console.log('API received request for GET /api/v1/events/all (Admin only)');
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const skip = (page - 1) * limit;

        console.log(`Fetching events for admin. Page: ${page}, Limit: ${limit}, Skip: ${skip}`);

        const eventsQuery = AssetEvent.find()
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit)
            .populate('userId', 'email name role')
            .populate('assetId')
            .lean();

        const events = await eventsQuery;
        const totalEvents = await AssetEvent.countDocuments();

        console.log(`Found ${events.length} events for page ${page}. Total events: ${totalEvents}`);

        res.json({
            success: true,
            data: {
                events,
                currentPage: page,
                totalPages: Math.ceil(totalEvents / limit),
                totalEvents
            }
        });

    } catch (err) {
        console.error('Error in GET /all route:', err);
        res.status(500).json({ success: false, error: 'Server error retrieving events.' });
    }
});

// --- NEW ROUTE: Log a Radar Alert Interaction ---
router.post('/log-radar-interaction', authenticate, async (req, res) => {
    console.log('API received request for POST /log-radar-interaction');
    console.log('Request body for /log-radar-interaction:', req.body);
    try {
        const validationResult = LogRadarInteractionSchema.safeParse(req.body);
        if (!validationResult.success) {
            console.error('Radar interaction log validation failed (Zod):', validationResult.error.flatten().fieldErrors);
            return res.status(400).json({
                success: false,
                error: 'Invalid input data for radar interaction log.',
                details: validationResult.error.flatten().fieldErrors
            });
        }

        const { alertId, interactionType } = validationResult.data;

        const alert = await RadarAlert.findById(alertId);
        if (!alert) {
            console.warn(`Attempt to log interaction for non-existent RadarAlert ID: ${alertId}`);
            return res.status(404).json({ success: false, error: 'Source Radar Alert not found.' });
        }

        if (!alert.clientId) {
            console.warn(`RadarAlert ${alertId} is missing a clientId. Cannot log interaction.`);
            return res.status(400).json({ success: false, error: 'Radar Alert is not associated with a client. Cannot log interaction.' });
        }

        const interactionData = {
            alertId: alert._id,
            interactionType,
            userId: req.user ? req.user.id : null,
            clientId: alert.clientId,
            brand: alert.brand || '',
            region: alert.region || '',
            ipAddress: req.ip || req.socket.remoteAddress,
            userAgent: req.headers['user-agent'] || 'Unknown',
        };

        const newInteraction = new RadarInteraction(interactionData);
        await newInteraction.save();

        console.log(`Radar interaction logged: ${interactionType} for alert ${alertId} by user ${req.user ? req.user.id : 'anonymous/unauthenticated'}`);
        res.status(201).json({ success: true, message: `Radar interaction '${interactionType}' logged.` });

    } catch (error) {
        console.error('Error in POST /log-radar-interaction route:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                error: 'Database Validation Failed for Radar Interaction',
                details: Object.values(error.errors).map(val => val.message)
            });
        }
        res.status(500).json({ success: false, error: 'Server error logging radar interaction.' });
    }
});

module.exports = router;