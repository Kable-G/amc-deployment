// Backend/models/RadarAlert.js

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid'); // For generating UUIDs

const radarAlertSchema = new mongoose.Schema({
    uuid: {
        type: String,
        default: uuidv4,
        unique: true,
        required: true,
        index: true,
    },
    title: {
        type: String,
        required: [true, 'Alert title is required.'],
        trim: true,
        maxlength: [250, 'Title cannot be more than 250 characters.']
    },
    eventDateTime: {
        type: Date,
        required: [true, 'Event/Drop date and time are required.']
    },
    brand: { // The specific brand for the alert (e.g., "Corolla", "Mustang", or "Toyota", "Ford")
        type: String,
        trim: true,
        default: ''
    },
    clientId: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client', 
        required: true, 
        index: true     
    },
    region: {
        type: String,
        trim: true,
        default: ''
    },
    tags: {
        type: [String],
        default: []
    },
    description: { 
        type: String,
        trim: true,
        default: ''
    },
    quickViewContent: {
        type: String,
        trim: true,
        default: null
    },
    user: { 
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['draft', 'published', 'archived', 'cancelled'],
        default: 'draft',
        required: true
    },
    teaserImagePath: { 
        type: String,
        trim: true,
        default: null 
    },
    alertDocPath: {
        type: String,
        trim: true,
        default: null
    },
    alertDocOriginalName: {
        type: String,
        trim: true,
        default: null
    }
}, {
    timestamps: true // Automatically adds createdAt and updatedAt
});

// Pre-save hook for tags (remains the same)
radarAlertSchema.pre('save', function(next) {
    if (this.isModified('tags') && this.tags) {
        this.tags = this.tags.map(tag => tag.trim()).filter(tag => tag.length > 0);
    }
    next();
});

const RadarAlert = mongoose.model('RadarAlert', radarAlertSchema);

module.exports = RadarAlert;
