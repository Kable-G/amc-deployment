// --- UNCAUGHT EXCEPTION HANDLER ---
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.name, '-', err.message);
  console.error('Stack:', err.stack);
  // process.exit(1); // Consider exiting after an uncaught exception
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // console.error('Promise:', promise); // Optional: Log the promise
});

// --- IMPORTS ---
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Import Models
const RadarAlert = require('./models/RadarAlert');

// Import Routes
const eventsRoutes = require('./routes/events.routes');
const authRoutes = require('./routes/auth.routes');
const authTestRoutes = require('./routes/authTestRoutes'); // Authentication testing routes
const centerRoutes = require('./routes/centerRoutes.js');
const vaultRoutes = require('./routes/vaultRoutes.js');
const radarRoutes = require('./routes/radarRoutes.js');
const analyticsRoutes = require('./routes/analytics.routes.js');

// --- EXPRESS APP SETUP ---
const app = express();

// 4. Core Middleware
app.use(cors()); // Enable CORS for all origins (suitable for development)
app.use(express.json()); // To parse JSON bodies
app.use(express.urlencoded({ extended: true })); // To parse URL-encoded bodies

// --- STATIC FILE SERVING ---
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// --- MONGODB CONNECTION ---
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB Connected successfully using Atlas!');
    
    // Start the archive task scheduler after successful DB connection
    startArchiveTaskScheduler();
    
    // Start the server immediately after DB connection
    const PORT = process.env.PORT || 5000;
    console.log('About to start listening on port', PORT);
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
      console.log(`API base URL is http://localhost:${PORT}/api/v1/`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// --- ARCHIVE TASK SCHEDULER ---
function startArchiveTaskScheduler() {
    const ARCHIVE_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
    
    const archiveExpiredAlerts = async () => {
        try {
            const now = new Date();
            const expiredAlerts = await RadarAlert.find({ eventDateTime: { $lt: now } });
            if (expiredAlerts.length > 0) {
                console.log(`ARCHIVE TASK: Found ${expiredAlerts.length} expired Radar Alerts to archive.`);
                
                // Move to archive collection (implement as needed)
                // For now, just log the action
                console.log('ARCHIVE TASK: Expired alerts archived successfully.');
            } else {
                console.log('ARCHIVE TASK: No expired Radar Alerts to archive at this time.');
            }
        } catch (error) {
            console.error('ARCHIVE TASK: Error during archive task:', error);
        }
    };
    
    // Run immediately and then every interval
    archiveExpiredAlerts();
    setInterval(archiveExpiredAlerts, ARCHIVE_INTERVAL);
    
    console.log(`Archive task scheduler started. Running every ${ARCHIVE_INTERVAL / 1000 / 60} minutes.`);
}

// --- MOUNT API ROUTERS HERE (prefixed with /api/v1) ---
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/auth-test', authTestRoutes); // Authentication testing routes
app.use('/api/v1/events', eventsRoutes);
app.use('/api/v1/center', centerRoutes);
app.use('/api/v1/vault', vaultRoutes);
app.use('/api/v1/radar', radarRoutes);
app.use('/api/v1/analytics', analyticsRoutes);

// --- ACCESS DENIED PAGE ---
app.get('/access-denied', (req, res) => {
    const reason = req.query.reason || 'unknown';
    const page = req.query.page || 'unknown';
    
    const accessDeniedPage = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Access Denied - AutoMediaCenter</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f8f9fa; }
                .error-container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                h1 { color: #dc3545; margin-bottom: 20px; }
                p { color: #6c757d; margin-bottom: 15px; }
                .btn { display: inline-block; padding: 12px 24px; background: #0d6efd; color: white; text-decoration: none; border-radius: 5px; margin: 10px; transition: background 0.3s; }
                .btn:hover { background: #0b5ed7; }
                .btn-secondary { background: #6c757d; }
                .btn-secondary:hover { background: #5a6268; }
            </style>
        </head>
        <body>
            <div class="error-container">
                <h1>🚫 Access Denied</h1>
                <p><strong>You don't have permission to access this page.</strong></p>
                <p>Page requested: <code>${page}</code></p>
                <p>Reason: ${reason === 'auth_required' ? 'Authentication required' : 'Insufficient permissions'}</p>
                <div>
                    <a href="login-test.html" class="btn">Login</a>
                    <a href="automediacenter.html" class="btn btn-secondary">Go Home</a>
                </div>
            </div>
        </body>
        </html>
    `;
    
    res.status(reason === 'auth_required' ? 401 : 403).send(accessDeniedPage);
});

// --- STATIC FILE SERVING ---
app.use(express.static(path.join(__dirname, '..', 'Frontend')));

// 7. Error Handling Middleware
app.use((err, req, res, next) => {
  console.error("Express Error Handler Caught:", err.name, "-", err.message);
  console.error("Stack:", err.stack);
  
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
             ? 'Internal server error' 
             : err.message,
  });
});