const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  employeeId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  role: {
    type: String,
    required: true,
    default: 'employee',
    index: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  mustChangePassword: {
    type: Boolean,
    default: false
  },
  passwordChangedAt: {
    type: Date
  },
  tokenVersion: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'locked'],
    default: 'active'
  },
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  lockedUntil: {
    type: Date
  },
  lastLoginAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'users'
});

// Add indexes (avoiding duplicates since they're already defined in the schema)
userSchema.index({ status: 1 });
userSchema.index({ lockedUntil: 1 });

// Pre-save middleware to update the updatedAt field
userSchema.pre('save', function() {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('User', userSchema);