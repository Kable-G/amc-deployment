// Minimal server with ONLY ZIP routes to test on port 5000
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');

// Load environment variables
dotenv.config();

// Initialize Express App
const app = express();

// Core Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static file serving
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use(express.static(path.join(__dirname, '..', 'Frontend')));

// Database Connection
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI;
    if (!mongoURI) {
      throw new Error('MongoDB URI not found in .env file. Please set MONGO_URI.');
    }
    await mongoose.connect(mongoURI);
    console.log('MongoDB Connected successfully!');
  } catch (err) {
    console.error('MongoDB Connection Error:', err.message);
    process.exit(1);
  }
};

// Connect to database
connectDB();

// ONLY mount ZIP routes
console.log('🔧 Mounting minimal ZIP routes only...');
const zipDownloadRoutes = require('./routes/zip-download-minimal.routes.js');
app.use('/api/v1/zip', zipDownloadRoutes);
console.log('✅ Minimal ZIP routes mounted successfully');

// Add catch-all API route for debugging
app.use('/api/*', (req, res) => {
  console.log('❌ Unmatched API route:', req.method, req.originalUrl);
  res.status(404).json({
    success: false,
    error: 'API route not found',
    method: req.method,
    path: req.originalUrl,
    availableRoutes: ['/api/v1/zip/test', '/api/v1/zip/release/:id/zip']
  });
});

// Start server on port 5000
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`🚀 ZIP-ONLY Server listening on port ${PORT}`);
  console.log(`📦 ZIP API available at http://localhost:${PORT}/api/v1/zip/`);
  console.log('🧪 Test endpoints:');
  console.log(`   - http://localhost:${PORT}/api/v1/zip/test`);
  console.log(`   - http://localhost:${PORT}/api/v1/zip/release/[UUID]/zip`);
});