const express = require('express');
const app = express();

// Basic middleware
app.use(express.json());

// Direct route test
app.get('/test', (req, res) => {
    console.log('✅ Direct test route hit!');
    res.json({ message: 'Direct route works!' });
});

// Test ZIP routes mounting
console.log('🔧 Testing ZIP routes mounting...');
try {
    const zipRoutes = require('./routes/zip-download-minimal.routes.js');
    app.use('/api/v1/zip', zipRoutes);
    console.log('✅ ZIP routes mounted successfully');
} catch (error) {
    console.error('❌ Error mounting ZIP routes:', error.message);
}

// List all routes
app._router.stack.forEach(function(r){
    if (r.route && r.route.path){
        console.log('📍 Route found:', r.route.path);
    } else if (r.name === 'router') {
        console.log('📍 Router middleware found');
        if (r.regexp) {
            console.log('   Pattern:', r.regexp);
        }
    }
});

const PORT = 5001;
app.listen(PORT, () => {
    console.log(`🚀 Test server running on port ${PORT}`);
    console.log(`🧪 Test direct: http://localhost:${PORT}/test`);
    console.log(`🧪 Test ZIP: http://localhost:${PORT}/api/v1/zip/test`);
});