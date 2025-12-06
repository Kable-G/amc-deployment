const mongoose = require("mongoose");

const auditEventSchema = new mongoose.Schema({
  // Company this event belongs to (null for platform-level events)
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    index: true
  },
  
  // User who performed the action
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  
  // Email snapshot at time of event (for audit trail even if user is deleted)
  emailSnapshot: {
    type: String,
    required: true
  },
  
  // Action performed
  action: {
    type: String,
    required: true,
    enum: [
      // Company lifecycle
      "company.created",
      "company.updated",
      "company.suspended",
      "company.cancelled",
      "company.reactivated",
      "company.deleted",
      
      // User management
      "user.invited",
      "user.created",
      "user.role_changed",
      "user.suspended",
      "user.reactivated",
      "user.deleted",
      "user.login",
      
      // Authentication events
      "auth.password_reset_requested",
      "auth.password_reset_completed",
      "auth.login_attempt",
      "auth.login_success",
      "auth.login_failed",
      "auth.logout",
      
      // Invitations
      "invite.sent",
      "invite.resent",
      "invite.accepted",
      "invite.expired",
      "invite.revoked",
      
      // Content management
      "upload.created",
      "upload.updated",
      "upload.deleted",
      "release.created",
      "release.published",
      "alert.created",
      
      // Permissions
      "permission.granted",
      "permission.revoked",
      "role.assigned",
      "role.removed",
      
      // Security events
      "security.company_mismatch_detected",
      "security.validation_error",
      "security.access_validated"
    ]
  },
  
  // Type of target object
  targetType: {
    type: String,
    enum: ["user", "company", "invite", "upload", "release", "alert", "permission", "system"],
    required: true
  },
  
  // ID of the target object
  targetId: {
    type: String,
    required: true
  },
  
  // Additional metadata about the event
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Request metadata for security
  ip: {
    type: String
  },
  
  userAgent: {
    type: String
  },
  
  // Event timestamp
  createdAt: {
    type: Date,
    default: Date.now,
    required: true
  }
});

// Indexes for efficient querying
auditEventSchema.index({ clientId: 1, createdAt: -1 });
auditEventSchema.index({ userId: 1, createdAt: -1 });
auditEventSchema.index({ action: 1, createdAt: -1 });
auditEventSchema.index({ targetType: 1, targetId: 1 });

// Static method to log an event
auditEventSchema.statics.logEvent = async function(eventData) {
  const {
    clientId,
    userId,
    emailSnapshot,
    action,
    targetType,
    targetId,
    metadata = {},
    ip,
    userAgent
  } = eventData;

  return await this.create({
    clientId,
    userId,
    emailSnapshot,
    action,
    targetType,
    targetId,
    metadata,
    ip,
    userAgent,
    createdAt: new Date()
  });
};

// Static method to get audit trail for a client
auditEventSchema.statics.getClientAuditTrail = function(clientId, options = {}) {
  const {
    limit = 50,
    skip = 0,
    action,
    startDate,
    endDate
  } = options;

  const query = { clientId };
  
  if (action) {
    query.action = action;
  }
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  return this.find(query)
    .populate('userId', 'name email role')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to get audit trail for a user
auditEventSchema.statics.getUserAuditTrail = function(userId, options = {}) {
  const {
    limit = 50,
    skip = 0,
    action,
    startDate,
    endDate
  } = options;

  const query = { userId };
  
  if (action) {
    query.action = action;
  }
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  return this.find(query)
    .populate('clientId', 'name')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to get platform-wide audit trail (for platform admins)
auditEventSchema.statics.getPlatformAuditTrail = function(options = {}) {
  const {
    limit = 100,
    skip = 0,
    action,
    clientId,
    startDate,
    endDate
  } = options;

  const query = {};
  
  if (action) {
    query.action = action;
  }
  
  if (clientId) {
    query.clientId = clientId;
  }
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  return this.find(query)
    .populate('userId', 'name email role')
    .populate('clientId', 'name')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

module.exports = mongoose.model("AuditEvent", auditEventSchema);