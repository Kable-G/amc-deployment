const express = require('express');
const app = express();

app.use(express.json());

// Test ZIP routes mounting
console.log('🔧 Testing ZIP routes mounting...');
const zipRoutes = require('./routes/zip-download-minimal.routes.js');
app.use('/api/v1/zip', zipRoutes);
console.log('✅ ZIP routes mounted successfully');

// Add a catch-all route to see what's being requested
app.use('*', (req, res) => {
    console.log('🔍 Request received:', req.method, req.originalUrl);
    res.status(404).json({ 
        error: 'Route not found', 
        method: req.method, 
        url: req.originalUrl,
        timestamp: new Date().toISOString()
    });
});

const PORT = 5001;
app.listen(PORT, () => {
    console.log(`🚀 Simple test server running on port ${PORT}`);
    console.log(`🧪 Test ZIP route: http://localhost:${PORT}/api/v1/zip/test`);
});