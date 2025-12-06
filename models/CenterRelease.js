// File: models/CenterRelease.js

const mongoose = require('mongoose');

// Reusable sub-schema for file information
// <<< MODIFICATION: The '{ _id: false }' option is REMOVED. This is the root cause of the entire problem and allows Mongoose to generate unique IDs for each asset. >>>
const fileSchemaInfo = new mongoose.Schema({
    originalName: { type: String, required: true },
    path: { type: String, required: true }, // Relative path like /uploads/center_assets/filename.jpg
    mimetype: { type: String, required: true },
    size: { type: Number, required: true },
    thumbPath: { type: String, required: false } // Thumbnail path for videos
});
// <<< END MODIFICATION >>>

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
    
    // <<< MODIFICATION: This field was missing, causing a conflict with routes/centerRoutes.js. It is now added. >>>
    cardTeaserImageMeta: fileSchemaInfo,
    // <<< END MODIFICATION >>>

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

module.exports = mongoose.model('CenterRelease', centerReleaseSchema);