const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  actorId: {
    type: String,
    required: true,
    index: true
  },
  actorEmployeeId: {
    type: String,
    required: true
  },
  targetEmployeeId: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true,
    index: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed, // Flexible field for various action details
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: false, // We're using our own createdAt field
  collection: 'auditLogs'
});

// Add indexes for common queries
auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ targetEmployeeId: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);