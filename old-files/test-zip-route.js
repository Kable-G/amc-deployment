// Quick test to verify ZIP route is accessible
const express = require('express');
const app = express();

// Test route
app.get('/test', (req, res) => {
    res.json({ message: 'Test route works!' });
});

// Import and mount ZIP routes exactly like server.js
const zipDownloadRoutes = require('./routes/zip-download.routes.js');
app.use('/api/v1/zip', zipDownloadRoutes);

// Test the exact path
app.listen(3001, () => {
    console.log('Test server running on port 3001');
    console.log('Test ZIP route at: http://localhost:3001/api/v1/zip/release/test-uuid/zip');
    console.log('Test basic route at: http://localhost:3001/test');
});