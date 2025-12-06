
// Backend/models/Client.js
const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
    clientName: {
        type: String,
        required: [true, 'Client name is required.'],
        trim: true,
        unique: true // Assuming client names should be unique for your platform
    },
    contactPerson: { // Optional: Main contact person for this client
        type: String,
        trim: true
    },
    contactEmail: { // Main contact email for this client
        type: String,
        required: [true, 'Contact email is required.'],
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address.']
    },
    contactPhone: {
        type: String,
        trim: true
    },
    companyWebsite: {
        type: String,
        trim: true
    },
    status: {
        type: String,
        enum: ["pending", "active", "suspended", "cancelled"],
        default: "pending",
        required: true
    },
    billingStatus: {
        type: String,
        enum: ["ok", "overdue", "terminated"],
        default: "ok",
        required: true
    },
    // Legacy field for backward compatibility
    isActive: {
        type: Boolean,
        default: true
    },
    // Future-ready fields
    planType: {
        type: String,
        enum: ['free', 'pro', 'enterprise'],
        default: 'enterprise'
    },
    settings: {
        maxUsers: { type: Number, default: 100 },
        uploadLimitMB: { type: Number, default: 1000 },
        embargoAccess: { type: Boolean, default: true },
        analyticsAccess: { type: Boolean, default: true }
    }
}, { timestamps: true }); // Adds createdAt and updatedAt fields automatically

// Optional: You could add pre-save hooks or methods to the clientSchema if needed in the future

module.exports = mongoose.model('Client', clientSchema); 
// The first argument 'Client' is the singular name of the collection your model is for.
// Mongoose automatically looks for the plural, lowercased version of your model name (i.e., 'clients' collection).