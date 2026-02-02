const { Schema, model } = require('mongoose');

const leaveBalanceSchema = new Schema({
  employeeId: {
    type: String,
    required: true,
    trim: true
  },
  annualLeave: {
    type: Number,
    default: 0
  },
  sickLeave: {
    type: Number,
    default: 0
  },
  personalLeave: {
    type: Number,
    default: 0
  },
  maternityLeave: {
    type: Number,
    default: 0
  },
  paternityLeave: {
    type: Number,
    default: 0
  },
  otherLeave: {
    type: Number,
    default: 0
  },
  year: {
    type: Number,
    required: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'leavebalances'
});

module.exports = model('LeaveBalance', leaveBalanceSchema);