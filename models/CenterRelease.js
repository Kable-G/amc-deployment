// File: models/CenterRelease.js
// UPDATED: Added companyName, categories, primaryLanguage, markets fields for content filtering

const mongoose = require('mongoose');

// Reusable sub-schema for file information
const fileSchemaInfo = new mongoose.Schema({
    originalName: { type: String, required: true },
    path: { type: String, required: true }, // Relative path like /uploads/center_assets/filename.jpg
    mimetype: { type: String, required: true },
    size: { type: Number, required: true },
    thumbPath: { type: String, required: false } // Thumbnail path for videos
});

const centerReleaseSchema = new mongoose.Schema({
    uuid: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    title: {
        type: String,
        required: [true, 'Please add a release title'],
        trim: true,
        maxlength: [200, 'Title cannot be more than 200 characters']
    },
    releaseDate: {
        type: Date,
        required: [true, 'Please specify the release date']
    },
    releaseTime: {
        type: String,
        required: false
    },
    brand: {
        type: String,
        required: [true, 'Please specify the brand']
    },
    
    // ==========================================
    // NEW FIELDS FOR CONTENT FILTERING
    // ==========================================
    companyName: {
        type: String,
        required: false, // Optional for backward compatibility
        trim: true,
        index: true // Index for faster filtering
    },
    categories: {
        type: [String], // Array of category values: ['general', 'product-launch', etc.]
        required: false,
        default: []
    },
    primaryLanguage: {
        type: String, // Language code: 'en', 'de', 'fr', etc.
        required: false,
        trim: true,
        index: true
    },
    markets: {
        type: [String], // Array of market values: ['Global', 'Germany', 'USA', etc.]
        required: false,
        default: []
    },
    // ==========================================
    // END NEW FIELDS
    // ==========================================
    
    tags: {
        type: [String],
        required: false
    },
    summary: {
        type: String,
        required: [true, 'Please add a summary/body for the release']
    },
    status: {
        type: String,
        enum: ['draft', 'pending', 'published', 'archived'],
        default: 'draft'
    },
    user: { // The individual user who created/submitted this release
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    clientId: { // The client company this release belongs to
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client',
        required: false, // Allow null for platform_admin users
        index: true
    },

    cardTeaserImagePath: {
        type: String,
        required: false 
    },
    
    cardTeaserImageMeta: fileSchemaInfo,

    releaseDocs: [fileSchemaInfo],
    images: [fileSchemaInfo],
    videos: [fileSchemaInfo],
    supplementaryDocs: [fileSchemaInfo],

    // PDF text extraction fields
    extractedPdfText: {
        type: String,
        required: false
    },
    pdfTextExtracted: {
        type: Boolean,
        default: false
    },

    watermarkEnabled: {
        type: Boolean,
        default: false
    },
    monitoringEnabled: {
        type: Boolean,
        default: true
    },
    legalTermsAcknowledged: {
        type: Boolean,
        default: false
    },

}, {
    timestamps: true 
});

// Add indexes for faster filtering queries
centerReleaseSchema.index({ companyName: 1, brand: 1 });
centerReleaseSchema.index({ categories: 1 });
centerReleaseSchema.index({ primaryLanguage: 1 });
centerReleaseSchema.index({ markets: 1 });

module.exports = mongoose.model('CenterRelease', centerReleaseSchema);