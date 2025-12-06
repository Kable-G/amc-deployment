const express = require('express');
const router = express.Router();

console.log('📦 Minimal ZIP Download routes module loaded successfully');

// Test route to verify routing works
router.get('/test', (req, res) => {
    console.log('🧪 MINIMAL TEST ROUTE HIT - ZIP routes are working!');
    res.json({ message: 'Minimal ZIP routes are working!', timestamp: new Date().toISOString() });
});

// Simple ZIP Download endpoint
router.get('/release/:releaseId/zip', (req, res) => {
    console.log('🚀 MINIMAL ZIP DOWNLOAD ROUTE HIT!');
    console.log('📋 Request params:', req.params);
    
    res.json({ 
        success: true, 
        message: 'Minimal ZIP endpoint reached',
        releaseId: req.params.releaseId,
        timestamp: new Date().toISOString()
    });
});

module.exports = router;