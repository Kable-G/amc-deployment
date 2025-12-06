// Ultra-simple test to verify the exact issue
const express = require('express');
const app = express();

// Simple test route
app.get('/test-simple', (req, res) => {
    console.log('✅ SIMPLE TEST ROUTE WORKS!');
    res.json({ message: 'Simple route works!' });
});

// Import and test ZIP routes directly
const zipRoutes = require('./routes/zip-download.routes.js');
app.use('/api/v1/zip', zipRoutes);

app.listen(3001, () => {
    console.log('🧪 Simple test server on port 3001');
    console.log('Test: http://localhost:3001/test-simple');
    console.log('ZIP test: http://localhost:3001/api/v1/zip/test');
});