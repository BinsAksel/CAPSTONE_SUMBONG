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
  // Credentials for verification (each now stored as object with url + publicId)
  credentials: [{
    url: { type: String, required: true },
    publicId: { type: String, default: null },
    uploadedAt: { type: Date, default: Date.now }
  }],
  // Profile picture (can be added later)
  profilePicture: {
    type: String, // URL to stored profile picture
    default: null
  },
  profilePicturePublicId: {
    type: String,
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
  ,
  // Administrative role flag
  isAdmin: {
    type: Boolean,
    default: false,
    index: true
  }
});

// Backward compatibility: if credentials is an array of strings, convert to objects
userSchema.pre('save', function convertLegacyCredentials(next) {
  try {
    if (Array.isArray(this.credentials) && this.credentials.length > 0) {
      this.credentials = this.credentials.map(c => {
        if (typeof c === 'string') return { url: c, publicId: null, uploadedAt: new Date() };
        return c;
      });
    }
  } catch {}
  next();
});

// Hash password before saving (after legacy conversion)
userSchema.pre('save', async function(next) {
  // Only hash if the password field is newly set or modified
  if (!this.isModified('password')) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Method to compare password
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User; 