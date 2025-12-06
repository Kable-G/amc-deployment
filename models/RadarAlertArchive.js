// Backend/models/RadarAlertArchive.js
const mongoose = require('mongoose');

const RadarAlertArchiveSchema = new mongoose.Schema({
    // Fields copied from RadarAlert
    uuid: { 
        type: String,
        required: true,
        index: true, 
    },
    title: { 
        type: String, 
        required: true 
    },
    eventDateTime: { 
        type: Date, 
        required: true 
    },
    brand: { 
        type: String,
        default: null 
    },
    // --- NEWLY ADDED clientId FIELD ---
    clientId: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client', // This MUST match the name used in mongoose.model('Client', ...)
        required: true, // Should be required if the original alert had one
        index: true     // Good for querying archived alerts by client
    },
    // --- END NEWLY ADDED clientId FIELD ---
    region: { 
        type: String,
        default: null
    },
    tags: {
        type: [String],
        default: []
    },
    description: { 
        type: String,
        default: null
    },
    teaserImagePath: { 
        type: String,
        default: null 
    },
    status: { 
        type: String,
        enum: ['draft', 'published', 'archived', 'cancelled'], 
        required: true
    },
    user: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    originalCreatedAt: { 
        type: Date,
        required: true 
    },
    
    // Fields specific to the archive entry itself
    archivedAt: { 
        type: Date, 
        default: Date.now 
    },
}, {
    timestamps: true // Adds createdAt and updatedAt for the archive document itself
});

module.exports = mongoose.model('RadarAlertArchive', RadarAlertArchiveSchema);