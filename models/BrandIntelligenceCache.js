const mongoose = require('mongoose');

const brandIntelligenceCacheSchema = new mongoose.Schema({
    brand: {
        type: String,
        required: true,
        index: true,
        trim: true
    },
    type: {
        type: String,
        required: true,
        enum: ['profile', 'personnel'],
        index: true
    },
    data: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    generatedAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        required: true,
        index: true
    },
    source: {
        type: String,
        default: 'ai-generated'
    }
}, { timestamps: true });

// Compound index for fast lookups
brandIntelligenceCacheSchema.index({ brand: 1, type: 1 });

module.exports = mongoose.model('BrandIntelligenceCache', brandIntelligenceCacheSchema);
