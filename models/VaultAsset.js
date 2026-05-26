// File: models/VaultAsset.js

const mongoose = require('mongoose');
// const bcrypt = require('bcrypt'); // <<<< Bcrypt import COMMENTED OUT

// Reusable sub-schema for file information
const fileSchemaInfo = new mongoose.Schema({
    originalName: { type: String, required: true },
    path: { type: String, required: true }, // Relative path
    mimetype: { type: String, required: true },
    size: { type: Number, required: true },
    // caption: { type: String, trim: true } // Optional
}, { _id: false });

const vaultAssetSchema = new mongoose.Schema({
    vaultAssetUUID: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    title: {
        type: String,
        required: [true, 'Vault title/name is required'],
        trim: true,
        maxlength: [200, 'Title cannot be more than 200 characters']
    },
    internalDescription: {
        type: String,
        trim: true,
        required: false
    },
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    availabilityDate: {
        type: Date,
        required: [true, 'Availability date is required']
    },
    availabilityTime: {
        type: String, // HH:MM
        required: [true, 'Availability time is required']
    },
    availabilityTimezone: {
        type: String,
        required: [true, 'Availability timezone is required']
    },
    embargoUntil: {
        type: Date,
        required: [true, 'Embargo date/time is required']
    },
    requireNDA: {
        type: Boolean,
        default: false
    },
    ndaDocument: {
        type: fileSchemaInfo,
        required: function() { return this.requireNDA === true; }
    },
    clearanceLevel: {
        type: String,
        enum: ['restricted', 'private', 'global'],
        default: 'restricted',
        required: true
    },
    teaserImage: {
        type: fileSchemaInfo,
        required: false
    },

    vaultReleaseDocs: [fileSchemaInfo],
    images: [fileSchemaInfo],
    videos: [fileSchemaInfo],
    supplementaryDocs: [fileSchemaInfo],

    /* --- VAULT PASSWORD FIELD TEMPORARILY COMMENTED OUT ---
    vaultPassword: {
        type: String,
        required: false, // Password is optional
        trim: true // Trim whitespace
    },
    */
    notifyClientOnAccess: { type: Boolean, default: false },
    notifyClientOnDownload: { type: Boolean, default: false },
    notifyClientOnNda: { type: Boolean, default: false },
    vaultExpirationDays: { type: Number, default: 7 },
    watermarkEnabled: { type: Boolean, default: true },
    geoLockEnabled: { type: Boolean, default: false },
    requireMfaOnAccess: { type: Boolean, default: false },

    vaultLegalTermsAcknowledged: {
        type: Boolean,
        default: false
    },

    status: {
        type: String,
        enum: ['draft', 'active', 'expired', 'archived'],
        default: 'draft'
    },
    expiredAt: {
        type: Date,
        default: null
    },
    brand: {
        type: String,
        trim: true,
        required: false
    },
    companyName: {
        type: String,
        trim: true,
        required: false
    },
    invitedUsers: {
        type: [String],
        default: []
    },
    embargoReminderSentAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true // Automatically adds createdAt and updatedAt
});


/* --- ENTIRE PRE-SAVE HOOK TEMPORARILY COMMENTED OUT ---
// --- Mongoose Pre-Save Hook for Password Hashing ---
vaultAssetSchema.pre('save', async function(next) {
    // Only run this function if vaultPassword was actually modified (or is new)
    if (!this.isModified('vaultPassword')) {
        return next();
    }

    // Also check if the password field is actually populated (not null, undefined, or empty string)
    if (!this.vaultPassword) {
        this.vaultPassword = undefined; // Or null, depending on preference
        return next();
    }

    try {
        console.log("Pre-save hook: Hashing vault password (COST FACTOR 10, using native bcrypt)...");
        const salt = await bcrypt.genSalt(10); // COST FACTOR 10
        this.vaultPassword = await bcrypt.hash(this.vaultPassword, salt);
        console.log("Pre-save hook: Password hashed successfully (COST FACTOR 10, using native bcrypt).");
        next();
    } catch (error) {
        console.error("Error hashing vault password:", error);
        next(error);
    }
});
*/

/* --- COMPAREPASSWORD METHOD TEMPORARILY COMMENTED OUT ---
// --- Optional: Add method to compare passwords (useful for login/access later) ---
vaultAssetSchema.methods.comparePassword = async function(candidatePassword) {
    if (!this.vaultPassword) {
        console.warn("comparePassword: No password stored for this vault asset.");
        return false;
    }
    console.log("comparePassword: Attempting to compare candidate password with stored hash.");
    return bcrypt.compare(candidatePassword, this.vaultPassword);
};
*/

module.exports = mongoose.model('VaultAsset', vaultAssetSchema);