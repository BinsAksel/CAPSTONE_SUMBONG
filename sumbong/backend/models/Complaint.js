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
  evidence: [String], // file paths
  type: String,
  resolution: String,
  confidential: Boolean,
  status: { type: String, enum: ['pending', 'in progress', 'solved'], default: 'pending' },
  feedback: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Complaint', complaintSchema);
