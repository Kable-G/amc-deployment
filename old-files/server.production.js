// server.production.js - Production-optimized server configuration

// Global Error Handlers - Place these first!
process.on('uncaughtException', (err, origin) => {
  console.error('<<<<< UNCAUGHT EXCEPTION >>>>>');
  console.error('Error:', err);
  console.error('Origin:', origin);
  process.exit(1); // Exit in production for safety
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('<<<<< UNHANDLED REJECTION >>>>>');
  console.error('Reason:', reason);
  process.exit(1); // Exit in production for safety
});

// 1. Import necessary modules
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');

// Import Models
const RadarAlert = require('./models/RadarAlert');
const RadarAlertArchive = require('./models/RadarAlertArchive');
const User = require('./models/User');
const Client = require('./models/Client');
const DownloadEvent = require('./models/DownloadEvent');

// Import Routes
const eventsRoutes = require('./routes/events.routes');
const fakeAuthRoutes = require('./routes/auth-bypass');
const centerRoutes = require('./routes/centerRoutes.js');
const vaultRoutes = require('./routes/vaultRoutes.js');
const radarRoutes = require('./routes/radarRoutes.js');
const analyticsRoutes = require('./routes/analytics.routes.js');
const amcAnalyticsRoutes = require('./routes/amcAnalytics.routes.js');
const downloadRoutes = require('./routes/downloadRoutes.js');
const zipDownloadRoutes = require('./routes/zip-download-working.routes.js');

// 2. Load production environment variables
dotenv.config({ path: '.env.production' });

// 3. Initialize Express App
const app = express();

// 4. Production Security & Middleware
const corsOptions = {
  origin: [
    'https://automediacenter.com',
    'https://www.automediacenter.com',
    'http://automediacenter.com',
    'http://www.automediacenter.com'
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Trust proxy for proper IP handling behind load balancer
app.set('trust proxy', 1);

// Health check endpoint for load balancer
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// --- STATIC FILE SERVING ---
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));

// Disable mongoose debug in production
if (process.env.NODE_ENV !== 'development') {
  mongoose.set('debug', false);
}

// 5. Database Connection & Cron Job Scheduling
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;
    if (!mongoURI) {
      throw new Error('MongoDB URI not found in .env.production file. Please set MONGO_URI.');
    }
    
    // Production MongoDB connection options
    const mongoOptions = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferMaxEntries: 0,
      bufferCommands: false,
    };
    
    await mongoose.connect(mongoURI, mongoOptions);
    console.log('✅ MongoDB Connected successfully using Atlas (Production)!');
    
    // Start the server immediately after DB connection
    const PORT = process.env.PORT || 5000;
    console.log('🚀 Starting production server on port', PORT);
    
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🌐 Server listening on port ${PORT}`);
      console.log(`🔗 API base URL: https://automediacenter.com/api/v1/`);
      console.log('🔒 Production mode with CORS enabled for automediacenter.com');
    });

    // Graceful shutdown handling
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      server.close(() => {
        mongoose.connection.close();
        process.exit(0);
      });
    });

    // Archive cron job - run every hour in production instead of every minute
    cron.schedule('0 * * * *', async () => {
        console.log('ARCHIVE TASK: Running hourly archive task for old Radar Alerts...');
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
                    try {
                        await RadarAlertArchive.create(archiveData);
                        await RadarAlert.findByIdAndDelete(alert._id);
                        console.log(`ARCHIVE TASK: Successfully archived "${alert.title}"`);
                    } catch (dbError) {
                        console.error(`ARCHIVE TASK: Error archiving alert ${alert._id}:`, dbError.message);
                    }
                }
            } else {
                console.log('ARCHIVE TASK: No expired Radar Alerts to archive.');
            }
        } catch (error) {
            console.error('ARCHIVE TASK: Error during archiving:', error.message);
        }
    });

  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err.message);
    process.exit(1);
  }
};

connectDB();

// --- MOUNT API ROUTERS ---
console.log('🔧 Mounting API routes...');
app.use('/api/v1/auth', fakeAuthRoutes);
app.use('/api/v1/events', eventsRoutes);
app.use('/api/v1/center', centerRoutes);
app.use('/api/v1/vault', vaultRoutes);
app.use('/api/v1/radar', radarRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/amc-analytics', amcAnalyticsRoutes);
app.use('/api/v1/downloads', downloadRoutes);
app.use('/api/v1/zip', zipDownloadRoutes);
console.log('✅ All API routes mounted successfully');

// API 404 handler
app.use('/api/*', (req, res) => {
  console.log('❌ Unmatched API route:', req.method, req.originalUrl);
  res.status(404).json({
    success: false,
    error: 'API route not found',
    method: req.method,
    path: req.originalUrl
  });
});

// --- STATIC FILE SERVING ---
console.log('🔧 Setting up static file serving...');

// Serve public directory files with cache control
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d', // Cache static files for 1 day in production
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Serve Frontend directory files
app.use(express.static(path.join(__dirname, '..', 'Frontend'), {
  maxAge: '1d'
}));

console.log('✅ Static file serving configured for production');

// 7. Production Error Handling Middleware
app.use((err, req, res, next) => {
  console.error("Production Error Handler:", err.name, "-", err.message);
  
  // Don't leak error details in production
  if (res.headersSent) {
    return next(err);
  }
  
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: 'Internal Server Error',
    message: statusCode === 500 ? 'An unexpected error occurred.' : err.message,
  });
});

// Catch-all route for SPA (if needed)
app.get('*', (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  // Try to serve the requested file from Frontend directory
  const filePath = path.join(__dirname, '..', 'Frontend', req.path);
  res.sendFile(filePath, (err) => {
    if (err) {
      // If file doesn't exist, serve automediacenter.html as default
      res.sendFile(path.join(__dirname, '..', 'Frontend', 'automediacenter.html'));
    }
  });
});

console.log('🎯 Production server configuration complete');