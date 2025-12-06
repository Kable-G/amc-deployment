const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 5002;

console.log('🚀 Starting Full ZIP Test Server...');

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
    console.log(`📥 ${req.method} ${req.url}`);
    next();
});

// Mount ZIP routes
const zipRoutes = require('./routes/zip-download-full.routes');
app.use('/api/v1/zip', zipRoutes);

// Catch-all route for debugging
app.use('*', (req, res) => {
    console.log(`🔍 Catch-all route hit: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ 
        error: 'Route not found', 
        method: req.method, 
        url: req.originalUrl,
        availableRoutes: [
            'GET /api/v1/zip/test',
            'GET /api/v1/zip/release/:releaseId/zip',
            'GET /api/v1/zip/release/:releaseId/zip-db'
        ]
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Server error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Full ZIP Test Server running on http://localhost:${PORT}`);
    console.log(`🧪 Test endpoint: http://localhost:${PORT}/api/v1/zip/test`);
    console.log(`📦 ZIP endpoint: http://localhost:${PORT}/api/v1/zip/release/test-uuid/zip`);
    console.log(`🗄️ DB ZIP endpoint: http://localhost:${PORT}/api/v1/zip/release/test-uuid/zip-db`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down Full ZIP Test Server...');
    process.exit(0);
});