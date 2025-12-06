const mongoose = require('mongoose');

const downloadEventSchema = new mongoose.Schema({
    // The specific asset that was downloaded (e.g., the image's _id)
    assetId: { 
        type: mongoose.Schema.Types.ObjectId, 
        required: true 
    },
    // The parent release this asset belongs to
    releaseId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'CenterRelease', 
        required: true 
    },
    // The Client ID of the company that OWNS the asset
    assetOwnerClientId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Client', 
        required: true 
    },
    // The User ID of the person who downloaded the asset
    downloaderUserId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    ipAddress: { type: String },
    userAgent: { type: String },
    timestamp: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model('DownloadEvent', downloadEventSchema);