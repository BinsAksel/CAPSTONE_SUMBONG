// @desc    Register a new user via Google OAuth (no password required)
// @route   POST /api/auth/google-signup
// @access  Public
const googleSignup = async (req, res) => {
  try {
    const { firstName, lastName, email, phoneNumber, address, acceptedTerms, acceptedPrivacy, policiesVersion } = req.body;
    // Validate required fields
    if (!firstName || !lastName || !email || !phoneNumber || !address) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }
    // Validate phone number format (basic validation)
    const phoneRegex = /^\+?[\d\s-]{10,}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid phone number'
      });
    }
  // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }
    // Enforce policy acceptance
    if (!acceptedTerms || !acceptedPrivacy) {
      return res.status(400).json({ success: false, message: 'You must accept Terms and Privacy Policy' });
    }
    // Upload credentials to Cloudinary (temporary folder until full user provisioning logic)
    const credentialObjs = [];
    for (const f of (req.files || [])) {
      const b64 = `data:${f.mimetype};base64,${f.buffer.toString('base64')}`;
      const up = await cloudinary.uploader.upload(b64, {
        folder: 'sumbong/credentials/google_temp',
        resource_type: 'image',
        use_filename: true,
        unique_filename: true,
        overwrite: false
      });
      credentialObjs.push({ url: up.secure_url, publicId: up.public_id, uploadedAt: new Date() });
    }
    if (credentialObjs.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please upload credentials for verification'
      });
    }
    // Generate a random password (not used for login, but required by schema)
    const randomPassword = Math.random().toString(36).slice(-8);
    // Create user
    const user = await User.create({
      firstName,
      lastName,
      email,
      phoneNumber,
      address,
      password: randomPassword,
      credentials: credentialObjs,
      profilePicture: req.body.profilePicture || null,
      approved: false,
      acceptedTerms: true,
      acceptedPrivacy: true,
      policiesVersion: policiesVersion || '1.0.0',
      acceptedPoliciesAt: new Date()
    });
    if (user) {
      try {
        const bus = require('../events/bus');
        bus.emit('new_user', { userId: user._id.toString() });
      } catch (e) { console.warn('Emit new_user (googleSignup) failed:', e.message); }
      res.status(201).json({
        success: true,
        token: generateToken(user._id),
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          address: user.address,
          credentials: user.credentials,
          profilePicture: user.profilePicture
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid user data'
      });
    }
  } catch (error) {
    console.error('Google Signup error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Registration failed. Please try again.'
    });
  }
};
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Memory storage -> direct Cloudinary upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: function(req, file, cb) { checkFileType(file, cb); }
}).array('credentials', 5);

const cloudinary = require('../config/cloudinary');

// Create a middleware that handles both cases - with and without files
const handleUpload = (req, res, next) => {
  upload(req, res, function(err) {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({ 
        success: false,
        message: err.toString() 
      });
    }
    next();
  });
};

// Check file type - now accepts more document types
function checkFileType(file, cb) {
  const filetypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb('Error: Images, PDF, and Word documents only!');
  }
}

// Generate JWT Token (optionally embed role flags)
const generateToken = (id, extra = {}) => {
  return jwt.sign({ id, ...extra }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// @desc    Register a new user
// @route   POST /api/auth/signup
// @access  Public
const signup = async (req, res) => {
  try {
    const { firstName, lastName, email, phoneNumber, password, acceptedTerms, acceptedPrivacy, policiesVersion } = req.body;
      
      // Validate required fields
      if (!firstName || !lastName || !email || !phoneNumber || !password) {
        return res.status(400).json({
          success: false,
          message: 'Please provide all required fields'
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid email address'
        });
      }

      // Validate phone number format (basic validation)
      const phoneRegex = /^\+?[\d\s-]{10,}$/;
      if (!phoneRegex.test(phoneNumber)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid phone number'
        });
      }

      // Check if user already exists
      const userExists = await User.findOne({ email });
      if (userExists) {
        return res.status(400).json({ 
          success: false,
          message: 'User already exists' 
        });
      }

      if (!acceptedTerms || !acceptedPrivacy) {
        return res.status(400).json({ success: false, message: 'You must accept Terms and Privacy Policy' });
      }

      // Upload credential files to Cloudinary
      const credentialObjs = [];
      for (const f of (req.files || [])) {
        const b64 = `data:${f.mimetype};base64,${f.buffer.toString('base64')}`;
        const up = await cloudinary.uploader.upload(b64, {
          folder: 'sumbong/credentials/signup',
          resource_type: 'image',
          use_filename: true,
          unique_filename: true,
          overwrite: false
        });
        credentialObjs.push({ url: up.secure_url, publicId: up.public_id, uploadedAt: new Date() });
      }

      if (credentialObjs.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Please upload credentials for verification'
        });
      }

      // Create user
      const user = await User.create({
        firstName,
        lastName,
        email,
        phoneNumber,
        address: req.body.address || '',
        password,
        credentials: credentialObjs,
        profilePicture: null, // Profile picture will be added later
        approved: false, // User must be approved by admin
        acceptedTerms: true,
        acceptedPrivacy: true,
        policiesVersion: policiesVersion || '1.0.0',
        acceptedPoliciesAt: new Date()
      });

      if (user) {
        try {
          const bus = require('../events/bus');
          bus.emit('new_user', { userId: user._id.toString() });
        } catch (e) { console.warn('Emit new_user (signup) failed:', e.message); }
        res.status(201).json({
          success: true,
          token: generateToken(user._id),
          user: {
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phoneNumber: user.phoneNumber,
            address: user.address,
            credentials: user.credentials,
            profilePicture: user.profilePicture
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Invalid user data'
        });
      }
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Registration failed. Please try again.'
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check for user email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid email or password' 
      });
    }

    // Check if user is approved
    if (!user.approved) {
      return res.status(403).json({
        success: false,
        message: 'Your account is not yet approved by the admin.'
      });
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid email or password' 
      });
    }

    res.json({
      success: true,
      token: generateToken(user._id, { isAdmin: !!user.isAdmin }),
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        address: user.address,
        credentials: user.credentials,
        profilePicture: user.profilePicture,
        isAdmin: !!user.isAdmin
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Login failed. Please try again.'
    });
  }
};

// @desc Admin login (requires existing user with isAdmin true)
// @route POST /api/auth/admin/login
// @access Public (credentials required)
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email, isAdmin: true });
    if (!user) return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
    const match = await user.matchPassword(password);
    if (!match) return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
    return res.json({
      success: true,
      token: generateToken(user._id, { isAdmin: true }),
      user: { _id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, isAdmin: true }
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ success: false, message: 'Admin login failed' });
  }
};

module.exports = {
  signup,
  login,
  handleUpload,
  googleSignup,
  generateToken,
  adminLogin
};