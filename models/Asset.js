const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    description: {
        type: String,
        trim: true,
        maxlength: 1000
    },
    category: {
        type: String,
        required: true,
        enum: ['press-release', 'image', 'video', 'document', 'media-kit', 'general'],
        default: 'general'
    },
    type: {
        type: String,
        required: true,
        enum: ['document', 'image', 'video', 'audio', 'archive'],
        default: 'document'
    },
    filename: {
        type: String,
        required: true
    },
    originalName: {
        type: String,
        required: true
    },
    path: {
        type: String,
        required: true
    },
    size: {
        type: Number,
        required: true
    },
    mimetype: {
        type: String,
        required: true
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },
    isPublic: {
        type: Boolean,
        default: false
    },
    tags: [{
        type: String,
        trim: true
    }],
    metadata: {
        uploadedAt: {
            type: Date,
            default: Date.now
        },
        uploadedFrom: String,
        userAgent: String,
        fileHash: String,
        thumbnailPath: String,
        previewPath: String
    },
    accessLog: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        accessedAt: {
            type: Date,
            default: Date.now
        },
        action: {
            type: String,
            enum: ['view', 'download', 'edit', 'delete'],
            required: true
        },
        ipAddress: String,
        userAgent: String
    }],
    downloadCount: {
        type: Number,
        default: 0
    },
    viewCount: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['active', 'archived', 'deleted'],
        default: 'active'
    }
}, {
    timestamps: true
});

// Indexes for performance
assetSchema.index({ companyId: 1, isPublic: 1 });
assetSchema.index({ uploadedBy: 1 });
assetSchema.index({ category: 1, type: 1 });
assetSchema.index({ createdAt: -1 });
assetSchema.index({ tags: 1 });

// Virtual for file URL
assetSchema.virtual('fileUrl').get(function() {
    return `${process.env.BASE_URL || 'http://localhost:5000'}${this.path}`;
});

// Method to log access
assetSchema.methods.logAccess = function(userId, action, ipAddress, userAgent) {
    this.accessLog.push({
        userId,
        action,
        ipAddress,
        userAgent,
        accessedAt: new Date()
    });
    
    if (action === 'download') {
        this.downloadCount += 1;
    } else if (action === 'view') {
        this.viewCount += 1;
    }
    
    return this.save();
};

// Static method to get company assets
assetSchema.statics.getCompanyAssets = function(companyId, options = {}) {
    const { page = 1, limit = 20, category, type, isPublic } = options;
    
    let query = { companyId, status: 'active' };
    if (category) query.category = category;
    if (type) query.type = type;
    if (typeof isPublic !== 'undefined') query.isPublic = isPublic;
    
    return this.find(query)
        .populate('uploadedBy', 'email firstName lastName')
        .populate('companyId', 'name')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);
};

// Static method to get public assets
assetSchema.statics.getPublicAssets = function(options = {}) {
    const { page = 1, limit = 20, category, type } = options;
    
    let query = { isPublic: true, status: 'active' };
    if (category) query.category = category;
    if (type) query.type = type;
    
    return this.find(query)
        .populate('uploadedBy', 'email firstName lastName')
        .populate('companyId', 'name')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);
};

// Pre-save middleware to ensure company isolation
assetSchema.pre('save', function(next) {
    if (this.isNew && !this.companyId) {
        return next(new Error('Company ID is required for all assets'));
    }
    next();
});

// Pre-remove middleware to clean up files
assetSchema.pre('remove', async function(next) {
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
        // Delete main file
        const filePath = path.join(__dirname, '..', this.path);
        await fs.unlink(filePath);
        
        // Delete thumbnail if exists
        if (this.metadata.thumbnailPath) {
            const thumbPath = path.join(__dirname, '..', this.metadata.thumbnailPath);
            await fs.unlink(thumbPath);
        }
        
        // Delete preview if exists
        if (this.metadata.previewPath) {
            const previewPath = path.join(__dirname, '..', this.metadata.previewPath);
            await fs.unlink(previewPath);
        }
    } catch (error) {
        console.warn('Error cleaning up asset files:', error.message);
    }
    
    next();
});

module.exports = mongoose.model('Asset', assetSchema);