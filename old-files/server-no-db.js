// Ultra minimal server with NO database connection
const express = require('express');
const cors = require('cors');

// Initialize Express App
const app = express();

// Core Middleware
app.use(cors());
app.use(express.json());

console.log('🔧 Mounting minimal ZIP routes only...');
const zipDownloadRoutes = require('./routes/zip-download-minimal.routes.js');
app.use('/api/v1/zip', zipDownloadRoutes);
console.log('✅ Minimal ZIP routes mounted successfully');

// Start server on port 5000
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`🚀 NO-DB Server listening on port ${PORT}`);
  console.log(`📦 ZIP API available at http://localhost:${PORT}/api/v1/zip/`);
});