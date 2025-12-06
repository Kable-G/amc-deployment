// Minimal server for debugging
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

// Import Routes
const authRoutes = require('./routes/auth.routes');
const authTestRoutes = require('./routes/authTestRoutes');

// Test route
app.get('/test', (req, res) => {
    res.json({ message: 'Server is working!' });
});

// Mount API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/auth-test', authTestRoutes);

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'Frontend')));

// Database Connection
const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGO_URI;
        if (!mongoURI) {
            throw new Error('MongoDB URI not found in .env file. Please set MONGO_URI.');
        }
        await mongoose.connect(mongoURI);
        console.log('MongoDB Connected successfully using Atlas!');
    } catch (err) {
        console.error('MongoDB Connection Error:', err.message);
        process.exit(1);
    }
};

// Start server
const startServer = async () => {
    try {
        await connectDB();
        
        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => {
            console.log(`Minimal server listening on port ${PORT}`);
            console.log(`Test URL: http://localhost:${PORT}/test`);
        });
    } catch (error) {
        console.error('Server startup error:', error);
        process.exit(1);
    }
};

startServer();