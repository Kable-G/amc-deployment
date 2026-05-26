// server.js - Main application file

// Global Error Handlers - Place these first!
process.on('uncaughtException', (err, origin) => {
  console.error('<<<<< UNCAUGHT EXCEPTION >>>>>');
  console.error('Error:', err);
  console.error('Origin:', origin);
  // process.exit(1); // Consider exiting after an uncaught exception
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('<<<<< UNHANDLED REJECTION >>>>>');
  console.error('Reason:', reason);
  // console.error('Promise:', promise); // Optional: Log the promise
});

// 1. Import necessary modules
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron'); // For scheduled tasks

// Import Models
const RadarAlert = require('./models/RadarAlert');
const RadarAlertArchive = require('./models/RadarAlertArchive');
const User = require('./models/User'); // Required for populate operations in routes
const Client = require('./models/Client'); // Required for populate operations in routes
const VaultAsset = require('./models/VaultAsset'); // Required for vault expiry cron
// <<< MODIFICATION: Import the new DownloadEvent model for tracking >>>
const DownloadEvent = require('./models/DownloadEvent');
// <<< END MODIFICATION >>>

// Import Routes - REAL AUTHENTICATION ENABLED
const eventsRoutes = require('./routes/events.routes');
const authRoutes = require('./routes/auth.routes'); // REAL AUTH - WITH FULL FUNCTIONALITY INCLUDING PASSWORD RESET
const adminRoutes = require('./routes/admin'); // ADMIN MANAGEMENT - Platform admin only
const adminPageRoutes = require('./routes/adminRoutes'); // PAGE PROTECTION - Admin page serving
const centerRoutes = require('./routes/centerRoutes.js');
const vaultRoutes = require('./routes/vaultRoutes.js');
const vaultAccessRoutes = require('./routes/vaultAccessRoutes.js'); // Journalist access flow: my-vaults, nda-sign, unlock
const notificationRoutes = require('./routes/notificationRoutes.js'); // In-app notification bell
const radarRoutes = require('./routes/radarRoutes.js');
const liveRoutes  = require('./routes/liveRoutes.js');
// const analyticsRoutes = require('./routes/analytics.routes.js'); // DISABLED - Using amcAnalytics.routes.js instead
const amcAnalyticsRoutes = require('./routes/amcAnalytics.routes.js');
const downloadRoutes = require('./routes/downloadRoutes.js');
const zipDownloadRoutes = require('./routes/zip-download-working.routes.js');

// Import Universal Download Tracker Middleware
const { universalDownloadTracker } = require('./middleware/universalDownloadTracker');

// Import Enterprise Client Onboarding Routes
const companyRoutes = require('./routes/companyRoutes');
const userManagementRoutes = require('./routes/userManagement');
const auditRoutes = require('./routes/auditRoutes');
const clientAdminRoutes = require('./routes/clientAdmin');
const assetRoutes = require('./routes/assets');

// 2. Load environment variables
dotenv.config();

// 3. Initialize Express App
const app = express();

// 4. Core Middleware
app.use(cors({
  origin: true, // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
})); // Enable CORS for all origins with explicit methods
app.use(express.json()); // To parse JSON bodies
app.use(express.urlencoded({ extended: true })); // To parse URL-encoded bodies

// Mount Universal Download Tracker Middleware - MUST be before routes
app.use(universalDownloadTracker);

// --- STATIC FILE SERVING ---
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Asset uploads
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads'))); // Legacy uploads
// Serve analytics tracker script
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));
// NOTE: Frontend static files are served AFTER admin route protection (see below)

if (process.env.NODE_ENV === 'development') {
  mongoose.set('debug', true);
}

// 5. Database Connection & Cron Job Scheduling
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;
    if (!mongoURI) {
      throw new Error('MongoDB URI not found in .env file. Please set MONGO_URI.');
    }
    
    console.log('🔌 Attempting MongoDB connection...');
    console.log('Connection string:', mongoURI.replace(/:[^:@]*@/, ':****@')); // Hide password in logs
    
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 10000, // 10 second timeout
      socketTimeoutMS: 45000, // 45 second socket timeout
      maxPoolSize: 10, // Maintain up to 10 socket connections
      minPoolSize: 1, // Reduce minimum connections to avoid pool issues
      bufferCommands: false // Disable mongoose buffering
    });
    
    console.log('✅ MongoDB Connected successfully using Atlas!');
    // Start the server immediately after DB connection to bypass blocking issues

    const PORT = process.env.PORT || 5000;
    console.log('About to start listening on port', PORT);
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server listening on port ${PORT} on all interfaces`);
      console.log(`API base URL is http://localhost:${PORT}/api/v1/`);
      console.log('✅ REAL AUTHENTICATION ENABLED - Full JWT-based authentication active');
    });
    try {
      const NodeMediaServer = require('node-media-server');
      const ffmpegPath = process.platform === 'win32'
        ? 'C:/ffmpeg/bin/ffmpeg.exe'
        : '/usr/bin/ffmpeg';
      const nms = new NodeMediaServer({
        rtmp: { port: 1935, chunk_size: 60000, gop_cache: true, ping: 30, ping_timeout: 60 },
        http: { port: 8000, mediaroot: './media', allow_origin: '*' },
        trans: {
          ffmpeg: ffmpegPath,
          tasks: [
            { app: 'live', hls: true, hlsFlags: '[hls_time=2:hls_list_size=0:hls_flags=append_list]', hlsKeep: true, dash: false },
            { app: 'live', mp4: true, mp4Flags: '[movflags=frag_keyframe+empty_moov]' }
          ],
        },
      });
      const LiveEvent = require('./models/LiveEvent');
      nms.on('prePublish', async (id, StreamPath, args) => {
        console.log('[NMS] Stream started:', StreamPath);
        const streamKey = StreamPath.split('/').pop();
        try {
          const event = await LiveEvent.findOne({ streamKey }).lean();
          if (!event) {
            console.log(`[NMS] ⛔ Unknown stream key: ${streamKey} — rejected`);
            const session = nms.getSession(id);
            if (session) session.reject();
            return;
          }
          if (event.status === 'recording' || event.status === 'cancelled') {
            console.log(`[NMS] ⛔ Event "${event.title}" is ${event.status} — rejected`);
            const session = nms.getSession(id);
            if (session) session.reject();
            return;
          }
          // If already live, accept reconnection — don't change status
          if (event.status === 'live') {
            console.log(`[NMS] ✅ OBS reconnected during LIVE broadcast "${event.title}" — status stays LIVE`);
            return;
          }
          // Otherwise flip to ready (private preview)
          await LiveEvent.findByIdAndUpdate(event._id, { status: 'ready' });
          const start = new Date(event.eventDateTime);
          const minsUntil = Math.ceil((start - Date.now()) / 60000);
          console.log(`[NMS] ✅ Stream accepted — "${event.title}" set to READY (private preview). ${minsUntil > 0 ? minsUntil + ' mins until start' : 'Start time passed'}`);
        } catch(err) {
          console.error('[NMS] prePublish check error:', err.message);
        }
      });
      nms.on('donePublish', async (id, StreamPath) => {
        console.log('[NMS] Stream ended:', StreamPath);
        const streamKey = StreamPath.split('/').pop();
        try {
          const event = await LiveEvent.findOne({ streamKey }).lean();
          if (event) {
            // ── Key principle: only the End Stream button archives an event.
            // OBS disconnect during 'live' keeps status as 'live' — broadcaster can reconnect.
            // OBS disconnect during 'ready' (private preview) flips back to 'upcoming'.
            // If status is already 'recording' (End Stream was clicked), save recording paths.
            if (event.status === 'ready') {
              await LiveEvent.findByIdAndUpdate(event._id, { status: 'upcoming' });
              console.log(`[NMS] ✅ Preview ended — "${event.title}" set back to upcoming (OBS disconnected during preview)`);
            } else if (event.status === 'recording') {
              // End Stream was already clicked — save recording paths
              const update = {};
              update.recordingHlsUrl = `/hls/live/${streamKey}/index.m3u8`;
              const fs = require('fs');
              const mp4Dir = path.join(__dirname, 'media', 'live', streamKey);
              try {
                const files = fs.readdirSync(mp4Dir).filter(f => f.endsWith('.mp4')).sort();
                if (files.length > 0) {
                  const latestMp4 = files[files.length - 1];
                  update.recordingMp4Url = `/hls/live/${streamKey}/${latestMp4}`;
                  console.log(`[NMS] 📹 MP4 recording saved: ${update.recordingMp4Url}`);
                }
              } catch(fsErr) {
                console.warn(`[NMS] ⚠️ Could not find MP4 in ${mp4Dir}:`, fsErr.message);
              }
              update.streamEndedAt = new Date();
              await LiveEvent.findByIdAndUpdate(event._id, update);
              console.log(`[NMS] ✅ Recording paths saved for "${event.title}"`);
            } else if (event.status === 'live') {
              // OBS disconnected during live broadcast — DO NOT archive
              // Broadcaster can reconnect, status stays 'live'
              console.log(`[NMS] ⚠️ OBS disconnected during LIVE broadcast "${event.title}" — status stays LIVE, awaiting reconnect`);
            }
          }
        } catch(err) {
          console.error('[NMS] donePublish error:', err.message);
        }
      });
      nms.run();
      console.log('✅ RTMP ingest started on port 1935 — HLS output on http://localhost:8000/live/{streamKey}/index.m3u8');
    } catch(e) {
      console.warn('⚠️  node-media-server not available:', e.message);
    }

    // ── Stream reminder cron — runs every minute ──────────────────────────
    try {
      const LiveReminder = require('./models/LiveReminder');
      const Notification = require('./models/Notification');

      cron.schedule('* * * * *', async () => {
        const now = new Date();
        try {
          const due = await LiveReminder.find({ fireAt: { $lte: now }, fired: false });
          if (!due.length) return;

          for (const reminder of due) {
            const messages = {
              '24h':      `Tomorrow: "${reminder.streamTitle}" by ${reminder.streamBrand} — stream starts in 24 hours`,
              '1h':       `"${reminder.streamTitle}" by ${reminder.streamBrand} starts in 1 hour`,
              'starting': `"${reminder.streamTitle}" by ${reminder.streamBrand} is starting shortly — join now`,
            };

            await Notification.create({
              userId:           reminder.userId,
              type:             'stream_reminder',
              read:             false,
              streamEventId:    reminder.eventId,
              streamTitle:      reminder.streamTitle,
              streamBrand:      reminder.streamBrand,
              streamStartTime:  reminder.streamStartTime,
              streamTimezone:   reminder.streamTimezone,
              streamReminderType: reminder.type,
              message:          messages[reminder.type],
              actionUrl:        `/amc-live-detail.html?id=${reminder.eventId}`,
              // Required existing fields — set to placeholder for stream reminders
              vaultTitle:       reminder.streamTitle,
            });

            await LiveReminder.findByIdAndUpdate(reminder._id, { fired: true });
            console.log(`[StreamReminder] Fired ${reminder.type} reminder for "${reminder.streamTitle}" → user ${reminder.userId}`);
          }
        } catch(err) {
          console.error('[StreamReminder] Cron error:', err.message);
        }
      });
      console.log('✅ Stream reminder cron scheduled (every minute)');
    } catch(e) {
      console.warn('⚠️  Stream reminder cron failed to start:', e.message);
    }

    cron.schedule('* * * * *', async () => { // Your existing cron job logic
        console.log('ARCHIVE TASK: Running scheduled task to archive old Radar Alerts...');
        const now = new Date();
        try {
            const expiredAlerts = await RadarAlert.find({ eventDateTime: { $lt: now } });
            if (expiredAlerts.length > 0) {
                console.log(`ARCHIVE TASK: Found ${expiredAlerts.length} expired Radar Alerts to archive.`);
                for (const alert of expiredAlerts) {
                    // Skip legacy alerts missing clientId — they cannot be archived
                    // due to schema validation. Delete them directly instead.
                    if (!alert.clientId) {
                        console.warn(`ARCHIVE TASK: Deleting legacy alert ${alert._id} ("${alert.title}") — missing clientId, cannot archive.`);
                        try { await RadarAlert.findByIdAndDelete(alert._id); } catch(e) {}
                        continue;
                    }

                    const archiveData = {
                        uuid: alert.uuid, title: alert.title, eventDateTime: alert.eventDateTime,
                        brand: alert.brand, clientId: alert.clientId, region: alert.region,
                        tags: alert.tags, description: alert.description, teaserImagePath: alert.teaserImagePath,
                        status: 'archived',
                        user: alert.user, originalCreatedAt: alert.createdAt,
                        archivedAt: new Date()
                    };
                    try {
                        await RadarAlertArchive.create(archiveData);
                        await RadarAlert.findByIdAndDelete(alert._id);
                        console.log(`ARCHIVE TASK: Successfully archived and deleted Radar Alert: "${alert.title}" (Original ID: ${alert._id}, Client ID: ${archiveData.clientId || 'N/A'})`);
                    } catch (dbError) {
                        console.error(`ARCHIVE TASK: Error processing alert ${alert._id} ("${alert.title}") for archiving:`, dbError.message);
                    }
                }
            } else {
                console.log('ARCHIVE TASK: No expired Radar Alerts to archive at this time.');
            }
        } catch (error) {
            console.error('ARCHIVE TASK: General error during Radar Alert archiving task:', error.message);
        }
    });

    // Email retry cron job - runs daily at 3 AM
    console.log('📧 Setting up email retry cron job...');
    require('./retryCron');
    console.log('✅ Email retry cron job initialized');

    // ── Vault expiry cron — runs daily at 02:00 ───────────────
    // Stage 1: Soft-expire vaults past their vaultExpirationDays
    // Stage 2: Hard-delete vaults that have been expired for 30+ days
    cron.schedule('0 2 * * *', async () => {
        console.log('🔒 VAULT EXPIRY: Running vault lifecycle task...');
        const now = new Date();

        try {
            // ── Stage 1: Soft-expire active vaults past expiry date ──
            // expiry date = createdAt + vaultExpirationDays
            // We query active vaults and check in JS since expiry is computed
            const activeVaults = await VaultAsset.find({ status: 'active' })
                .select('_id title createdAt vaultExpirationDays')
                .lean();

            let softExpiredCount = 0;
            for (const vault of activeVaults) {
                const expiryDate = new Date(vault.createdAt);
                expiryDate.setDate(expiryDate.getDate() + (vault.vaultExpirationDays || 7));
                if (now > expiryDate) {
                    await VaultAsset.findByIdAndUpdate(vault._id, {
                        $set: { status: 'expired', expiredAt: now }
                    });
                    console.log(`🔒 VAULT EXPIRY: Soft-expired vault "${vault.title}" (${vault._id})`);
                    softExpiredCount++;
                }
            }
            if (softExpiredCount === 0) {
                console.log('🔒 VAULT EXPIRY: No vaults to soft-expire.');
            } else {
                console.log(`🔒 VAULT EXPIRY: ${softExpiredCount} vault(s) soft-expired.`);
            }

            // ── Stage 2: Hard-delete vaults expired for 30+ days ────
            const thirtyDaysAgo = new Date(now);
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const hardDeleteCandidates = await VaultAsset.find({
                status: 'expired',
                expiredAt: { $lt: thirtyDaysAgo }
            }).lean();

            let hardDeletedCount = 0;
            for (const vault of hardDeleteCandidates) {
                // Collect all file paths to delete from disk
                const filePaths = [
                    vault.teaserImage,
                    vault.ndaDocument,
                    ...(vault.vaultReleaseDocs  || []),
                    ...(vault.images            || []),
                    ...(vault.videos            || []),
                    ...(vault.supplementaryDocs || []),
                ].filter(Boolean).map(f => f.path).filter(Boolean);

                // Delete physical files
                for (const filePath of filePaths) {
                    try {
                        const fullPath = require('path').join(__dirname, filePath);
                        await require('fs').promises.unlink(fullPath);
                    } catch (e) {
                        if (e.code !== 'ENOENT') {
                            console.warn(`🔒 VAULT EXPIRY: Could not delete file ${filePath}:`, e.message);
                        }
                    }
                }

                // Delete vault document from MongoDB
                await VaultAsset.findByIdAndDelete(vault._id);
                console.log(`🔒 VAULT EXPIRY: Hard-deleted vault "${vault.title}" (${vault._id}) — expired ${Math.round((now - vault.expiredAt) / 86400000)} days ago`);
                hardDeletedCount++;
            }

            if (hardDeletedCount === 0) {
                console.log('🔒 VAULT EXPIRY: No vaults ready for hard deletion.');
            } else {
                console.log(`🔒 VAULT EXPIRY: ${hardDeletedCount} vault(s) permanently deleted.`);
            }

        } catch (err) {
            console.error('🔒 VAULT EXPIRY: Error during vault lifecycle task:', err.message);
        }
    });
    console.log('✅ Vault expiry cron job scheduled (daily at 02:00)');

  } catch (err) {
    console.error('MongoDB Connection Error:', err.message);
    process.exit(1);
  }
};
connectDB();

// --- MOUNT API ROUTERS HERE (prefixed with /api/v1) - REAL AUTH ENABLED ---
console.log('🔧 Mounting API routes...');
app.use('/api/v1/auth', authRoutes); // REAL AUTH - PROPER AUTHENTICATION
app.use('/api/v1/admin', adminRoutes); // ADMIN MANAGEMENT - Platform admin only
app.use('/api/v1/events', eventsRoutes);
const brandIntelRoutes2 = require('./routes/brandIntelligence.routes');
app.use('/api/v1/brand-intel', brandIntelRoutes2);
app.use('/api/v1/center', centerRoutes);
app.use('/api/v1/vault', vaultRoutes);
app.use('/api/v1/vault', vaultAccessRoutes); // Journalist access flow: my-vaults, nda-sign, unlock
app.use('/api/v1/notifications', notificationRoutes); // In-app notification bell
app.use('/api/v1/radar', radarRoutes);
app.use('/api/v1/live',  liveRoutes);
// app.use('/api/v1/analytics', analyticsRoutes); // DISABLED - Using amcAnalytics.routes.js instead
app.use('/api/v1/amc-analytics', amcAnalyticsRoutes);

app.use('/api/v1/downloads', downloadRoutes); // NEW: Comprehensive download tracking routes
app.use('/api/v1/zip', zipDownloadRoutes); // NEW: ZIP download functionality

// Mount Enterprise Client Onboarding Routes
app.use('/api/companies', companyRoutes);
app.use('/api/user-management', userManagementRoutes);
app.use('/api/audit', auditRoutes);

// --- ENTERPRISE CLIENT ONBOARDING ROUTES ---
app.use('/api/v1/companies', companyRoutes); // Company management
app.use('/api/v1/user-management', userManagementRoutes); // User management
app.use('/api/v1/audit', auditRoutes); // Analytics and audit logs
app.use('/api/v1/client-admin', clientAdminRoutes); // Client admin company-scoped operations
app.use('/api/v1/assets', assetRoutes); // Asset management with company isolation
console.log('✅ All API routes mounted successfully with REAL AUTHENTICATION');
console.log('✅ Enterprise client onboarding routes mounted');
console.log('✅ Client admin company-scoped routes mounted');
console.log('✅ Asset management routes mounted with company isolation');

// Add a catch-all API route to debug missing routes
// ── NMS stats proxy — serves stream data to broadcaster panel
// Must be registered BEFORE the catch-all API 404 handler
const { authenticate: authMW } = require('./middleware/authMiddleware');
app.get('/api/v1/stream-stats/:streamKey', authMW, async (req, res) => {
    try {
        const http = require('http');
        const options = { hostname: 'localhost', port: 8000, path: '/api/streams', method: 'GET' };
        const request = http.request(options, (nmsRes) => {
            let data = '';
            nmsRes.on('data', chunk => data += chunk);
            nmsRes.on('end', () => {
                try {
                    const streams = JSON.parse(data);
                    const streamKey = req.params.streamKey;
                    const streamData = streams?.live?.[streamKey];
                    if (!streamData) return res.json({ success: true, connected: false });
                    const pub = streamData.publisher;
                    const subscribers = streamData.subscribers || [];
                    const viewerCount = subscribers.filter(s => s.protocol === 'http' || s.protocol === 'ws').length;
                    const connectedAt = pub?.connectCreated ? new Date(pub.connectCreated) : null;
                    const durationSecs = connectedAt ? Math.floor((Date.now() - connectedAt.getTime()) / 1000) : 0;
                    res.json({
                        success: true, connected: !!pub, viewerCount, durationSecs,
                        connectedAt: pub?.connectCreated,
                        totalBytes: pub?.bytes || 0,
                        video: pub?.video || null,
                        audio: pub?.audio || null,
                    });
                } catch(e) { res.json({ success: true, connected: false }); }
            });
        });
        request.on('error', () => res.json({ success: true, connected: false }));
        request.end();
    } catch(err) { res.json({ success: true, connected: false }); }
});

app.use('/api/*', (req, res) => {
  console.log('❌ Unmatched API route:', req.method, req.originalUrl);
  console.log('❌ Request headers:', req.headers);
  console.log('❌ Request body:', req.body);
  res.status(404).json({
    success: false,
    error: 'API route not found',
    method: req.method,
    path: req.originalUrl,
    availableRoutes: ['/api/companies/invite', '/api/v1/companies/invite']
  });
});

// --- PORTAL ROUTING (MUST BE BEFORE ADMIN ROUTES) ---
console.log('🔧 Setting up portal routes...');

// Test route to debug
app.get('/test', (req, res) => {
  res.send('TEST ROUTE WORKS! Server is responding.');
});

// Root route - main landing/login page
app.get('/', (req, res) => {
  console.log('ROOT ROUTE HIT - Attempting to serve landing page');
  const filePath = path.join(__dirname, 'Frontend', 'landing-page-twitter-style.html');
  console.log('File path:', filePath);
  res.sendFile(filePath, (err) => {
    // Only send error if headers haven't been sent yet (prevents crash on aborted requests)
    if (err && !res.headersSent) {
      console.error('Error serving file:', err);
      res.status(500).send('Error serving file: ' + err.message);
    }
  });
});

// Main login route (Twitter-style)
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'Frontend', 'landing-page-twitter-style.html'));
});

// Legacy portal routes (keeping for backward compatibility)
app.get('/client', (req, res) => {
  res.sendFile(path.join(__dirname, 'Frontend', 'client.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'Frontend', 'admin.html'));
});

console.log('✅ Portal routes configured');

// --- EXPLICIT ROUTE FOR AssetDBmenu1.6.html (MUST BE BEFORE adminPageRoutes) ---
app.get('/AssetDBmenu1.6.html', (req, res) => {
  const filePath = path.join(__dirname, 'Frontend', 'AssetDBmenu1.6.html');
  console.log('Serving AssetDBmenu1.6.html from:', filePath);
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error sending AssetDBmenu1.6.html:', err);
      res.status(404).send('File not found at: ' + filePath);
    }
  });
});

// --- MOUNT ADMIN PAGE ROUTES (for protected page serving) ---
console.log('🔧 Mounting admin page routes...');
app.use('/', adminPageRoutes); // PAGE PROTECTION - Admin page serving with authentication
console.log('✅ Admin page routes mounted successfully');

// --- ACCESS DENIED PAGE ---
app.get('/access-denied', (req, res) => {
    const reason = req.query.reason || 'unknown';
    const page = req.query.page || 'unknown';
    const role = req.query.role || 'unknown';
    
    res.status(403).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <title>Access Denied - AutoMediaCenter</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
                .error-container { background: white; padding: 3rem; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); text-align: center; max-width: 500px; }
                h1 { color: #dc3545; margin-bottom: 1rem; font-size: 2rem; }
                p { color: #6c757d; margin-bottom: 2rem; line-height: 1.6; }
                .btn { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 8px; margin: 0 10px; font-weight: 500; transition: background 0.3s; }
                .btn:hover { background: #0056b3; }
                .btn-secondary { background: #6c757d; }
                .btn-secondary:hover { background: #545b62; }
                .details { background: #f8f9fa; padding: 1rem; border-radius: 8px; margin: 1rem 0; font-size: 0.9em; color: #495057; }
            </style>
        </head>
        <body>
            <div class="error-container">
                <h1>🚫 Access Denied</h1>
                <p><strong>Your account is not authorized to perform this action.</strong></p>
                <div class="details">
                    <strong>Reason:</strong> ${reason}<br>
                    <strong>Page:</strong> ${page}<br>
                    <strong>Your Role:</strong> ${role}
                </div>
                <p>If you believe this is an error, please contact the AutoMediaCenter administrator.</p>
                <a href="/" class="btn">🏠 Go to AutoMediaCenter</a>
                <a href="/login" class="btn btn-secondary">🔐 Login</a>
            </div>
        </body>
        </html>
    `);
});

// --- STATIC FILE SERVING - SIMPLIFIED! ---
console.log('🔧 Setting up static file serving...');

// ✅ ONLY SERVE Frontend/ - This eliminates confusion!
app.use(express.static(path.join(__dirname, 'Frontend'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// ✅ ONLY serve specific public assets that Frontend/ doesn't have
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// HLS media proxy — serves node-media-server output through port 5000 (avoids CORS)
app.use('/hls', express.static(path.join(__dirname, 'media'), {
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache');
  }
}));

// (optional) ensure direct file route works:
app.get('/amc-analytics-saved.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'Frontend', 'amc-analytics-saved.html'));
});

console.log('✅ Static file serving configured');

// 7. Error Handling Middleware
app.use((err, req, res, next) => {
  console.error("Express Error Handler Caught:", err.name, "-", err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }
  if (res.headersSent) {
    return next(err);
  }
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.name || 'ServerError',
    message: process.env.NODE_ENV === 'production' && statusCode === 500
             ? 'An unexpected internal server error occurred.'
             : err.message,
  });
});

// 8. Start the Server - REMOVED DUPLICATE (server starts in connectDB function)
console.log('REACHED END OF SERVER.JS FILE');