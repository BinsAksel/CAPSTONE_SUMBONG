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
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Complaint', complaintSchema);
