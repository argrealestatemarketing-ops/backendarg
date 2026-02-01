const mongoose = require('mongoose');

const loginAttemptSchema = new mongoose.Schema({
  ipAddress: {
    type: String,
    required: true,
    maxlength: 45, // Supports IPv6
  },
  employeeId: {
    type: String,
    required: true,
    maxlength: 20,
    index: true
  },
  success: {
    type: Boolean,
    required: true,
    default: false
  },
  userAgent: {
    type: String,
    default: null
  },
  failureReason: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: false, // We're using our own createdAt field
  collection: 'loginAttempts'
});

// Add indexes (createdOn field already indexed via createdAt)
loginAttemptSchema.index({ ipAddress: 1, createdAt: 1 });
loginAttemptSchema.index({ employeeId: 1, createdAt: 1 });
loginAttemptSchema.index({ success: 1 });

module.exports = mongoose.model('LoginAttempt', loginAttemptSchema);