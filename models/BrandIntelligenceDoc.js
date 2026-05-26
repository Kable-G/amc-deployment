const mongoose = require('mongoose');

const brandIntelligenceDocSchema = new mongoose.Schema({
    brand: { type: String, required: true, index: true, trim: true },
    docType: {
        type: String,
        required: true,
        enum: ['profile', 'personnel', 'financials', 'stock'],
        index: true
    },
    filePath: { type: String, required: false },
    originalName: { type: String, required: false },
    intelligence: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: {
        type: String,
        enum: ['processing', 'active', 'error'],
        default: 'processing'
    },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: mongoose.Schema.ObjectId, ref: 'User', required: false },
    errorMessage: { type: String, required: false }
}, { timestamps: true });

brandIntelligenceDocSchema.index({ brand: 1, docType: 1 });

module.exports = mongoose.model('BrandIntelligenceDoc', brandIntelligenceDocSchema);
