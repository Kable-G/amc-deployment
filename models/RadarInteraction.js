// Backend/models/RadarInteraction.js
const mongoose = require('mongoose');

const radarInteractionSchema = new mongoose.Schema({
    alertId: { // The specific RadarAlert document this interaction is for
        type: mongoose.Schema.Types.ObjectId,
        ref: 'RadarAlert', // Reference to your RadarAlert model
        required: true,
        index: true
    },
    userId: { // The User (likely media_user) who performed the interaction
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true 
        // Not strictly required if you want to log anonymous views, but good for unique counts
    },
    clientId: { // The Client who OWNS the alertId being interacted with
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client',
        required: true, // Essential for client-specific analytics
        index: true
    },
    brand: { // Brand associated with the alert (denormalized for easier filtering)
        type: String,
        index: true,
        default: ''
    },
    region: { // Region associated with the alert (denormalized)
        type: String,
        index: true,
        default: ''
    },
    interactionType: {
        type: String,
        required: true,
        enum: [
            'view',             // Alert was viewed/displayed on newradarfe.html
            'calendar_add',     // Clicked "Add to Calendar"
            'reminder_set',     // Clicked "Set Reminder"
            'follow_alert',     // Clicked "Follow" on the alert itself
            'quick_view_open'   // <<< THIS IS THE CRITICAL ADDITION
            // 'detail_click'  // If you have a separate detail page for radar alerts
        ],
        index: true
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    ipAddress: { type: String },    // Optional, for geo-analytics (consider privacy)
    userAgent: { type: String }     // Optional, for device/browser analytics
}, { timestamps: false }); // We have a 'timestamp' field, so Mongoose's default createdAt/updatedAt aren't strictly needed here

module.exports = mongoose.model('RadarInteraction', radarInteractionSchema);