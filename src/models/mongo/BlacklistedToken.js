const mongoose = require('mongoose');

const blacklistedTokenSchema = new mongoose.Schema({
  tokenHash: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  tokenType: {
    type: String,
    enum: ['access', 'refresh'],
    default: 'access',
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  reason: {
    type: String,
    default: null
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: false, // We're using our own createdAt field
  collection: 'blacklistedTokens'
});

// Add compound index for efficient querying
blacklistedTokenSchema.index({ userId: 1, expiresAt: -1 });

module.exports = mongoose.model('BlacklistedToken', blacklistedTokenSchema);