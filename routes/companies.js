const express = require('express');
const router = express.Router();
const Company = require('../models/Company');
const User = require('../models/User');
const Invite = require('../models/Invite');
const { authMiddleware } = require('../middleware/authMiddleware');
const { platformAdminOnly } = require('../middleware/roleMiddleware');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');

// Configure email transporter
const transporter = nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// GET /api/v1/companies - Get all companies (platform admin only)
router.get('/', authMiddleware, platformAdminOnly, async (req, res) => {
    try {
        const { page = 1, limit = 20, status, search } = req.query;
        
        let query = {};
        if (status) query.status = status;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { domain: { $regex: search, $options: 'i' } },
                { contactEmail: { $regex: search, $options: 'i' } }
            ];
        }
        
        const companies = await Company.find(query)
            .populate('createdBy', 'email firstName lastName')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);
            
        const total = await Company.countDocuments(query);
        
        res.json({
            success: true,
            data: {
                companies,
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / limit),
                totalCompanies: total
            }
        });
        
    } catch (error) {
        console.error('Error fetching companies:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch companies'
        });
    }
});

// POST /api/v1/companies - Create new company
router.post('/', authMiddleware, platformAdminOnly, async (req, res) => {
    try {
        const {
            name,
            domain,
            contactEmail,
            contactFirstName,
            contactLastName,
            planType = 'basic',
            maxUsers = 10
        } = req.body;
        
        // Validate required fields
        if (!name || !contactEmail || !contactFirstName) {
            return res.status(400).json({
                success: false,
                error: 'Company name, contact email, and contact first name are required'
            });
        }
        
        // Check if company with same name or domain already exists
        const existingCompany = await Company.findOne({
            $or: [
                { name: { $regex: new RegExp(`^${name}$`, 'i') } },
                ...(domain ? [{ domain: { $regex: new RegExp(`^${domain}$`, 'i') } }] : [])
            ]
        });
        
        if (existingCompany) {
            return res.status(400).json({
                success: false,
                error: 'Company with this name or domain already exists'
            });
        }
        
        // Check if user with contact email already exists
        const existingUser = await User.findOne({ email: contactEmail });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'User with this email already exists'
            });
        }
        
        // Create company
        const company = new Company({
            name,
            domain,
            contactEmail,
            contactFirstName,
            contactLastName,
            planType,
            maxUsers,
            createdBy: req.user.id,
            status: 'pending'
        });
        
        await company.save();
        
        // Create invitation for client admin
        const inviteToken = jwt.sign(
            {
                companyId: company._id,
                email: contactEmail,
                role: 'client_admin',
                firstName: contactFirstName,
                lastName: contactLastName,
                type: 'company_admin_invite'
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        const invite = new Invite({
            email: contactEmail,
            companyId: company._id,
            invitedBy: req.user.id,
            role: 'client_admin',
            token: inviteToken,
            firstName: contactFirstName,
            lastName: contactLastName,
            status: 'pending'
        });
        
        await invite.save();
        
        // Send invitation email
        const inviteUrl = `${process.env.BASE_URL}/invite-accept.html?token=${inviteToken}`;
        
        const mailOptions = {
            from: process.env.SMTP_USER,
            to: contactEmail,
            subject: 'Welcome to AutoMediaCenter - Complete Your Account Setup',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Welcome to AutoMediaCenter</h2>
                    <p>Hello ${contactFirstName},</p>
                    <p>You've been invited to join AutoMediaCenter as the administrator for <strong>${name}</strong>.</p>
                    <p>Click the button below to complete your account setup:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${inviteUrl}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Complete Setup</a>
                    </div>
                    <p>This invitation will expire in 7 days.</p>
                    <p>If you have any questions, please contact our support team.</p>
                    <hr style="margin: 30px 0;">
                    <p style="color: #666; font-size: 12px;">This email was sent by AutoMediaCenter. If you didn't expect this invitation, please ignore this email.</p>
                </div>
            `
        };
        
        try {
            await transporter.sendMail(mailOptions);
            invite.emailSent = true;
            invite.emailSentAt = new Date();
            await invite.save();
        } catch (emailError) {
            console.error('Failed to send invitation email:', emailError);
            invite.emailError = emailError.message;
            await invite.save();
        }
        
        await company.populate('createdBy', 'email firstName lastName');
        
        res.status(201).json({
            success: true,
            message: 'Company created and invitation sent successfully',
            data: {
                company,
                invite: {
                    id: invite._id,
                    email: invite.email,
                    status: invite.status,
                    emailSent: invite.emailSent
                }
            }
        });
        
    } catch (error) {
        console.error('Error creating company:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create company'
        });
    }
});

// GET /api/v1/companies/:id - Get specific company
router.get('/:id', authMiddleware, platformAdminOnly, async (req, res) => {
    try {
        const company = await Company.findById(req.params.id)
            .populate('createdBy', 'email firstName lastName');
            
        if (!company) {
            return res.status(404).json({
                success: false,
                error: 'Company not found'
            });
        }
        
        // Get company users
        const users = await User.find({ companyId: company._id })
            .select('email firstName lastName role status createdAt lastLogin');
            
        // Get pending invites
        const pendingInvites = await Invite.find({ 
            companyId: company._id, 
            status: 'pending' 
        }).select('email role createdAt emailSent');
        
        res.json({
            success: true,
            data: {
                company,
                users,
                pendingInvites
            }
        });
        
    } catch (error) {
        console.error('Error fetching company:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch company'
        });
    }
});

// PUT /api/v1/companies/:id - Update company
router.put('/:id', authMiddleware, platformAdminOnly, async (req, res) => {
    try {
        const { name, domain, contactEmail, contactFirstName, contactLastName, planType, maxUsers, status } = req.body;
        
        const company = await Company.findById(req.params.id);
        if (!company) {
            return res.status(404).json({
                success: false,
                error: 'Company not found'
            });
        }
        
        // Update fields
        if (name) company.name = name;
        if (domain) company.domain = domain;
        if (contactEmail) company.contactEmail = contactEmail;
        if (contactFirstName) company.contactFirstName = contactFirstName;
        if (contactLastName) company.contactLastName = contactLastName;
        if (planType) company.planType = planType;
        if (typeof maxUsers !== 'undefined') company.maxUsers = maxUsers;
        if (status) company.status = status;
        
        company.updatedAt = new Date();
        await company.save();
        
        await company.populate('createdBy', 'email firstName lastName');
        
        res.json({
            success: true,
            message: 'Company updated successfully',
            data: company
        });
        
    } catch (error) {
        console.error('Error updating company:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update company'
        });
    }
});

// DELETE /api/v1/companies/:id - Delete company
router.delete('/:id', authMiddleware, platformAdminOnly, async (req, res) => {
    try {
        const companyId = req.params.id;
        
        const company = await Company.findById(companyId);
        if (!company) {
            return res.status(404).json({
                success: false,
                error: 'Company not found'
            });
        }
        
        // Check if company has active users
        const activeUsers = await User.countDocuments({ 
            companyId: companyId,
            status: 'active'
        });
        
        if (activeUsers > 0) {
            return res.status(400).json({
                success: false,
                error: `Cannot delete company with ${activeUsers} active users. Please deactivate users first.`
            });
        }
        
        // Delete related data
        await Promise.all([
            // Delete pending invites
            Invite.deleteMany({ companyId: companyId }),
            // Delete inactive users
            User.deleteMany({ companyId: companyId, status: { $ne: 'active' } }),
            // Delete the company
            Company.findByIdAndDelete(companyId)
        ]);
        
        res.json({
            success: true,
            message: 'Company deleted successfully'
        });
        
    } catch (error) {
        console.error('Error deleting company:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete company'
        });
    }
});

// GET /api/v1/companies/:id/users - Get company users
router.get('/:id/users', authMiddleware, platformAdminOnly, async (req, res) => {
    try {
        const users = await User.find({ companyId: req.params.id })
            .select('email firstName lastName role status createdAt lastLogin')
            .sort({ createdAt: -1 });
            
        res.json({
            success: true,
            data: users
        });
        
    } catch (error) {
        console.error('Error fetching company users:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch company users'
        });
    }
});

// GET /api/v1/companies/:id/invites - Get company pending invites
router.get('/:id/invites', authMiddleware, platformAdminOnly, async (req, res) => {
    try {
        const invites = await Invite.find({ 
            companyId: req.params.id,
            status: 'pending'
        })
        .populate('invitedBy', 'email firstName lastName')
        .sort({ createdAt: -1 });
            
        res.json({
            success: true,
            data: invites
        });
        
    } catch (error) {
        console.error('Error fetching company invites:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch company invites'
        });
    }
});

// POST /api/v1/companies/:id/resend-invite - Resend invitation
router.post('/:id/resend-invite', authMiddleware, platformAdminOnly, async (req, res) => {
    try {
        const { inviteId } = req.body;
        
        const invite = await Invite.findOne({
            _id: inviteId,
            companyId: req.params.id,
            status: 'pending'
        }).populate('companyId', 'name');
        
        if (!invite) {
            return res.status(404).json({
                success: false,
                error: 'Invite not found'
            });
        }
        
        // Generate new token
        const newToken = jwt.sign(
            {
                companyId: invite.companyId._id,
                email: invite.email,
                role: invite.role,
                firstName: invite.firstName,
                lastName: invite.lastName,
                type: 'company_admin_invite'
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        invite.token = newToken;
        invite.emailSent = false;
        invite.emailError = null;
        
        // Send email
        const inviteUrl = `${process.env.BASE_URL}/invite-accept.html?token=${newToken}`;
        
        const mailOptions = {
            from: process.env.SMTP_USER,
            to: invite.email,
            subject: 'AutoMediaCenter Invitation - Reminder',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">AutoMediaCenter Invitation Reminder</h2>
                    <p>Hello ${invite.firstName},</p>
                    <p>This is a reminder about your invitation to join AutoMediaCenter as the administrator for <strong>${invite.companyId.name}</strong>.</p>
                    <p>Click the button below to complete your account setup:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${inviteUrl}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Complete Setup</a>
                    </div>
                    <p>This invitation will expire in 7 days.</p>
                </div>
            `
        };
        
        try {
            await transporter.sendMail(mailOptions);
            invite.emailSent = true;
            invite.emailSentAt = new Date();
        } catch (emailError) {
            console.error('Failed to resend invitation email:', emailError);
            invite.emailError = emailError.message;
        }
        
        await invite.save();
        
        res.json({
            success: true,
            message: 'Invitation resent successfully',
            data: {
                emailSent: invite.emailSent,
                emailError: invite.emailError
            }
        });
        
    } catch (error) {
        console.error('Error resending invite:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to resend invitation'
        });
    }
});

module.exports = router;