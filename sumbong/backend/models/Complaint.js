const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fullName: String,
  contact: String,
  anonymous: Boolean,
  date: String,
  time: String,
  location: String,
  people: String,
  description: String,
  // Store evidence as objects so we can manage Cloudinary deletions. Backward compatibility: old records may still be strings.
  evidence: [{
    type: mongoose.Schema.Types.Mixed, // either string (legacy) or { url, publicId }
  }],
  type: String,
  resolution: String,
  confidential: Boolean,
  status: { type: String, enum: ['pending', 'in progress', 'solved'], default: 'pending' },
  feedback: { type: String, default: '' },
  // New threaded feedback entries (backward compatible with single feedback field)
  feedbackEntries: [{
    authorType: { type: String, enum: ['admin', 'user'], required: true },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  // Soft delete by user (kept for admin history)
  isDeletedByUser: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Complaint', complaintSchema);
