// server-enhanced-auth.js - Main application file with enhanced authentication
// This replaces server.js with our new comprehensive authentication system

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
const passport = require('passport');
const session = require('express-session');
const MongoStore = require('connect-mongo');

// Import Models
const RadarAlert = require('./models/RadarAlert');
const RadarAlertArchive = require('./models/RadarAlertArchive');
const User = require('./models/User'); // Required for populate operations in routes
const Client = require('./models/Client'); // Required for populate operations in routes
const DownloadEvent = require('./models/DownloadEvent');
// Import Enhanced Models (using existing models for now)
const PublicUser = require('./models/PublicUser');
const UserAnalytics = require('./models/UserAnalytics');

// Import Enhanced Authentication Components
const authMiddleware = require('./middleware/authMiddleware');
const analyticsMiddleware = require('./middleware/analyticsMiddleware');

// Import Routes - ENHANCED AUTHENTICATION SYSTEM
const eventsRoutes = require('./routes/events.routes');
const centerRoutes = require('./routes/centerRoutes.js');
const vaultRoutes = require('./routes/vaultRoutes.js');
const radarRoutes = require('./routes/radarRoutes.js');
const analyticsRoutes = require('./routes/analytics.routes.js');
const amcAnalyticsRoutes = require('./routes/amcAnalytics.routes.js');
const downloadRoutes = require('./routes/downloadRoutes.js');
const zipDownloadRoutes = require('./routes/zip-download-working.routes.js');

// Import Enhanced Authentication Routes
const authRoutes = require('./routes/auth.routes');
const oauthRoutes = require('./routes/oauth.routes');
const userRoutes = require('./routes/user.routes');

// Import Passport Configuration (will create if needed)
// require('./config/passport');

// 2. Load environment variables
dotenv.config();

// 3. Initialize Express App
const app = express();

// 4. Core Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://automediacenter.com', 'https://www.automediacenter.com']
    : ['http://localhost:3000', 'http://localhost:5000'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' })); // Increased limit for file uploads
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 5. Session Configuration for OAuth
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-super-secret-session-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    touchAfter: 24 * 3600 // lazy session update
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// 6. Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

// 7. Analytics Middleware - Track all requests
app.use(analyticsMiddleware);

// --- STATIC FILE SERVING ---
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
// Serve analytics tracker script
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));

if (process.env.NODE_ENV === 'development') {
  mongoose.set('debug', true);
}

// 8. Database Connection & Cron Job Scheduling
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;
    if (!mongoURI) {
      throw new Error('MongoDB URI not found in .env file. Please set MONGO_URI.');
    }
    await mongoose.connect(mongoURI);
    console.log('MongoDB Connected successfully using Atlas!');
    
    // Start the server on a different port to not interfere with existing system
    const PORT = process.env.ENHANCED_AUTH_PORT || 3001;
    console.log('About to start listening on port', PORT);
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
      console.log(`API base URL is http://localhost:${PORT}/api/v1/`);
      console.log('🔐 ENHANCED AUTHENTICATION SYSTEM ENABLED');
      console.log('🎯 Three-Level Access Control Active');
      console.log('🔗 OAuth Integration Ready (Google, Microsoft, LinkedIn, GitHub)');
      console.log('📊 Comprehensive User Analytics Tracking');
    });

    // Cron job for archiving old Radar Alerts
    cron.schedule('* * * * *', async () => {
        console.log('ARCHIVE TASK: Running scheduled task to archive old Radar Alerts...');
        const now = new Date();
        try {
            const expiredAlerts = await RadarAlert.find({ eventDateTime: { $lt: now } });
            if (expiredAlerts.length > 0) {
                console.log(`ARCHIVE TASK: Found ${expiredAlerts.length} expired Radar Alerts to archive.`);
                for (const alert of expiredAlerts) {
                    const archiveData = {
                        uuid: alert.uuid, title: alert.title, eventDateTime: alert.eventDateTime,
                        brand: alert.brand, clientId: alert.clientId, region: alert.region,
                        tags: alert.tags, description: alert.description, teaserImagePath: alert.teaserImagePath,
                        status: 'archived',
                        user: alert.user, originalCreatedAt: alert.createdAt,
                        archivedAt: new Date()
                    };
                    if (!archiveData.clientId && alert.user) {
                        console.warn(`ARCHIVE TASK: Alert ${alert._id} ("${alert.title}") is missing clientId. User: ${alert.user}. This may cause issues if RadarAlertArchiveSchema requires clientId.`);
                    }
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

  } catch (err) {
    console.error('MongoDB Connection Error:', err.message);
    process.exit(1);
  }
};
connectDB();

// --- MOUNT API ROUTERS HERE (prefixed with /api/v1) - ENHANCED AUTH ENABLED ---
console.log('🔧 Mounting Enhanced Authentication API routes...');

// Authentication Routes (Public)
app.use('/api/v1/auth', authRoutes); // Enhanced authentication with registration, login, etc.
app.use('/api/v1/oauth', oauthRoutes); // OAuth routes for Google, Microsoft, LinkedIn, GitHub
app.use('/api/v1/users', userRoutes); // User management routes with analytics

// Existing Routes (with enhanced authentication middleware where needed)
app.use('/api/v1/events', eventsRoutes);
app.use('/api/v1/center', centerRoutes);
app.use('/api/v1/vault', vaultRoutes);
app.use('/api/v1/radar', radarRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/amc-analytics', amcAnalyticsRoutes);
app.use('/api/v1/downloads', downloadRoutes);
app.use('/api/v1/zip', zipDownloadRoutes);

console.log('✅ All Enhanced Authentication API routes mounted successfully');

// Add a catch-all API route to debug missing routes
app.use('/api/*', (req, res) => {
  console.log('❌ Unmatched API route:', req.method, req.originalUrl);
  res.status(404).json({
    success: false,
    error: 'API route not found',
    method: req.method,
    path: req.originalUrl,
    availableRoutes: [
      '/api/v1/auth/register',
      '/api/v1/auth/login',
      '/api/v1/oauth/google',
      '/api/v1/oauth/microsoft',
      '/api/v1/oauth/linkedin',
      '/api/v1/oauth/github',
      '/api/v1/users/profile',
      '/api/v1/users/track-activity',
      '/api/v1/center/releases',
      '/api/v1/zip/test'
    ]
  });
});

// --- STATIC FILE SERVING - WITH AUTHENTICATION CHECKS ---
console.log('🔧 Setting up static file serving with authentication...');

// Serve public directory files (including success page) with cache control
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Serve Frontend directory files
app.use(express.static(path.join(__dirname, '..', 'Frontend')));
console.log('✅ Static file serving configured with authentication');

// Protected Admin Routes (Level 3 required) - will implement when middleware is ready
// app.get('/admin/*', authMiddleware.requireLevel(3), (req, res, next) => {
//   express.static(path.join(__dirname, '..', 'Frontend'))(req, res, next);
// });

// Protected Client Routes (Level 2+ required) - will implement when middleware is ready
// app.get('/dashboard/*', authMiddleware.requireLevel(2), (req, res, next) => {
//   express.static(path.join(__dirname, '..', 'Frontend'))(req, res, next);
// });

// 9. Error Handling Middleware
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

console.log('🚀 Enhanced Authentication Server Ready!');
console.log('📋 Features Enabled:');
console.log('  • Three-Level User Access Control (Public L1, Client L2, Admin L3)');
console.log('  • OAuth Integration (Google, Microsoft, LinkedIn, GitHub)');
console.log('  • Comprehensive User Analytics & Data Collection');
console.log('  • JWT Token Authentication');
console.log('  • Session Management');
console.log('  • GDPR Compliance Tracking');
console.log('  • Business Intelligence Data Collection');
console.log('  • Enhanced Security Middleware');