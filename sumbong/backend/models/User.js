const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    type: String,
    required: false,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  // Credentials for verification (ID, documents proving residency)
  credentials: [{
    type: String, // URLs to stored credential images
    required: true
  }],
  // Profile picture (can be added later)
  profilePicture: {
    type: String, // URL to stored profile picture
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  approved: {
    type: Boolean,
    default: false
  },
  // New verification fields
  verificationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'resubmission_required'],
    default: 'pending'
  },
  verificationDate: {
    type: Date,
    default: null
  },
  adminNotes: {
    type: String,
    default: null
  },
  issueDetails: {
    type: String,
    default: null
  },
  requiredActions: {
    type: String,
    default: null
  },
  rejectionCount: {
    type: Number,
    default: 0
  },
  resubmissionRequested: {
    type: Boolean,
    default: false
  },
  resubmissionReason: {
    type: String,
    default: null
  },
  resubmissionDeadline: {
    type: Date,
    default: null
  },
  resubmissionRequestDate: {
    type: Date,
    default: null
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare password
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User; 