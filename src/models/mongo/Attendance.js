const { Schema, model } = require('mongoose');

const attendanceSchema = new Schema({
  employeeId: {
    type: String,
    required: true,
    trim: true
  },
  date: {
    type: Date,
    required: true
  },
  checkInTime: {
    type: String,
    required: false
  },
  checkOutTime: {
    type: String,
    required: false
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'half_day'],
    default: 'present'
  },
  hoursWorked: {
    type: Number,
    default: 0
  },
  location: {
    latitude: Number,
    longitude: Number
  },
  deviceId: String,
  notes: String
}, {
  timestamps: true,
  collection: 'attendances'
});

module.exports = model('Attendance', attendanceSchema);