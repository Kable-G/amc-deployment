const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Asset = require('../models/Asset');
const { authenticate } = require('../middleware/authMiddleware');
const { enforceCompanyScope } = require('../middleware/companyPermission');
const { validateActiveUserAndCompany } = require('../middleware/securityAudit');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/assets');
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow common file types
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|ppt|pptx|mp4|mov|avi|zip/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

// GET /api/v1/assets - Get assets (public + company-specific)
router.get('/', authenticate, validateActiveUserAndCompany, async (req, res) => {
    try {
        const { page = 1, limit = 20, type, category } = req.query;
        const user = req.user;
        
        // Build query based on user role and company
        let query = {};
        
        if (user.role === 'platform_admin') {
            // Platform admins can see all assets
            if (req.query.companyId) {
                query.companyId = req.query.companyId;
            }
        } else if (user.role === 'client_admin' || user.role === 'client_user') {
            // Client users can only see public assets + their company assets
            query.$or = [
                { isPublic: true },
                { companyId: user.clientId }
            ];
        } else {
            // Media users can only see public assets
            query.isPublic = true;
        }
        
        // Add filters
        if (type) query.type = type;
        if (category) query.category = category;
        
        const assets = await Asset.find(query)
            .populate('uploadedBy', 'email firstName lastName')
            .populate('companyId', 'name')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);
            
        const total = await Asset.countDocuments(query);
        
        res.json({
            success: true,
            data: {
                assets,
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalAssets: total
            }
        });
        
    } catch (error) {
        console.error('Error fetching assets:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch assets'
        });
    }
});

// POST /api/v1/assets - Upload new asset
router.post('/', authenticate, validateActiveUserAndCompany, upload.single('file'), async (req, res) => {
    try {
        const { title, description, category, type, isPublic = false } = req.body;
        const user = req.user;
        const file = req.file;
        
        if (!file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }
        
        // Only client_admin and platform_admin can upload company assets
        if (!isPublic && !['client_admin', 'platform_admin'].includes(user.role)) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions to upload company assets'
            });
        }
        
        const asset = new Asset({
            title: title || file.originalname,
            description,
            category: category || 'general',
            type: type || 'document',
            filename: file.filename,
            originalName: file.originalname,
            path: `/uploads/assets/${file.filename}`,
            size: file.size,
            mimetype: file.mimetype,
            uploadedBy: user.id,
            companyId: user.clientId,
            isPublic: isPublic === 'true' || isPublic === true,
            metadata: {
                uploadedAt: new Date(),
                uploadedFrom: req.ip,
                userAgent: req.get('User-Agent')
            }
        });
        
        await asset.save();
        await asset.populate('uploadedBy', 'email firstName lastName');
        await asset.populate('companyId', 'name');
        
        res.status(201).json({
            success: true,
            message: 'Asset uploaded successfully',
            data: asset
        });
        
    } catch (error) {
        console.error('Error uploading asset:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to upload asset'
        });
    }
});

// GET /api/v1/assets/:id - Get specific asset
router.get('/:id', authenticate, validateActiveUserAndCompany, async (req, res) => {
    try {
        const asset = await Asset.findById(req.params.id)
            .populate('uploadedBy', 'email firstName lastName')
            .populate('companyId', 'name');
            
        if (!asset) {
            return res.status(404).json({
                success: false,
                error: 'Asset not found'
            });
        }
        
        // Check access permissions
        const user = req.user;
        const hasAccess = 
            asset.isPublic || 
            user.role === 'platform_admin' ||
            (asset.companyId && asset.companyId._id.toString() === user.clientId);
            
        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                error: 'Access denied to this asset'
            });
        }
        
        res.json({
            success: true,
            data: asset
        });
        
    } catch (error) {
        console.error('Error fetching asset:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch asset'
        });
    }
});

// PUT /api/v1/assets/:id - Update asset
router.put('/:id', authenticate, validateActiveUserAndCompany, enforceCompanyScope, async (req, res) => {
    try {
        const { title, description, category, type, isPublic } = req.body;
        const user = req.user;
        
        const asset = await Asset.findById(req.params.id);
        if (!asset) {
            return res.status(404).json({
                success: false,
                error: 'Asset not found'
            });
        }
        
        // Check permissions
        const canEdit = 
            user.role === 'platform_admin' ||
            (asset.uploadedBy.toString() === user.id) ||
            (user.role === 'client_admin' && asset.companyId.toString() === user.clientId);
            
        if (!canEdit) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions to edit this asset'
            });
        }
        
        // Update fields
        if (title) asset.title = title;
        if (description) asset.description = description;
        if (category) asset.category = category;
        if (type) asset.type = type;
        if (typeof isPublic !== 'undefined') {
            // Only platform_admin can change public status
            if (user.role === 'platform_admin') {
                asset.isPublic = isPublic === 'true' || isPublic === true;
            }
        }
        
        asset.updatedAt = new Date();
        await asset.save();
        
        await asset.populate('uploadedBy', 'email firstName lastName');
        await asset.populate('companyId', 'name');
        
        res.json({
            success: true,
            message: 'Asset updated successfully',
            data: asset
        });
        
    } catch (error) {
        console.error('Error updating asset:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update asset'
        });
    }
});

// DELETE /api/v1/assets/:id - Delete asset
router.delete('/:id', authenticate, validateActiveUserAndCompany, enforceCompanyScope, async (req, res) => {
    try {
        const user = req.user;
        const asset = await Asset.findById(req.params.id);
        
        if (!asset) {
            return res.status(404).json({
                success: false,
                error: 'Asset not found'
            });
        }
        
        // Check permissions
        const canDelete = 
            user.role === 'platform_admin' ||
            (asset.uploadedBy.toString() === user.id) ||
            (user.role === 'client_admin' && asset.companyId.toString() === user.clientId);
            
        if (!canDelete) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions to delete this asset'
            });
        }
        
        // Delete file from filesystem
        try {
            const filePath = path.join(__dirname, '..', asset.path);
            await fs.unlink(filePath);
        } catch (fileError) {
            console.warn('Could not delete file:', fileError.message);
        }
        
        await Asset.findByIdAndDelete(req.params.id);
        
        res.json({
            success: true,
            message: 'Asset deleted successfully'
        });
        
    } catch (error) {
        console.error('Error deleting asset:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete asset'
        });
    }
});

// GET /api/v1/assets/company/:companyId - Get company-specific assets (platform admin only)
router.get('/company/:companyId', authenticate, validateActiveUserAndCompany, async (req, res) => {
    try {
        const user = req.user;
        
        // Only platform admins can access this endpoint
        if (user.role !== 'platform_admin') {
            return res.status(403).json({
                success: false,
                error: 'Access denied - platform admin required'
            });
        }
        
        const { page = 1, limit = 20 } = req.query;
        const companyId = req.params.companyId;
        
        const assets = await Asset.find({ companyId })
            .populate('uploadedBy', 'email firstName lastName')
            .populate('companyId', 'name')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);
            
        const total = await Asset.countDocuments({ companyId });
        
        res.json({
            success: true,
            data: {
                assets,
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalAssets: total
            }
        });
        
    } catch (error) {
        console.error('Error fetching company assets:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch company assets'
        });
    }
});

module.exports = router;