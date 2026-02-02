const { Schema, model } = require('mongoose');

const importJobSchema = new Schema({
  type: {
    type: String,
    required: true,
    enum: ['fingerprint', 'fingerprint_to_mongo', 'file_upload']
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'running', 'completed', 'failed', 'cancelled']
  },
  startedAt: {
    type: Date,
    required: true
  },
  finishedAt: Date,
  createdBy: String, // User ID who initiated the job
  result: Schema.Types.Mixed, // Store result data or error message
  error: String, // Error message if job failed
  summary: Schema.Types.Mixed // Detailed summary of the import
}, {
  timestamps: true,
  collection: 'importjobs'
});

module.exports = model('ImportJob', importJobSchema);