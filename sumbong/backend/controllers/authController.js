// @desc    Register a new user via Google OAuth (no password required)
// @route   POST /api/auth/google-signup
// @access  Public
const googleSignup = async (req, res) => {
  try {
    const { firstName, lastName, email, phoneNumber, address } = req.body;
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
    // Get credential URLs
    const credentialUrls = req.files ? req.files.map(file => `uploads/${file.filename}`) : [];
    if (credentialUrls.length === 0) {
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
      credentials: credentialUrls,
      profilePicture: req.body.profilePicture || null,
      approved: false
    });
    if (user) {
      res.status(201).json({
        success: true,
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

// Configure multer for credential upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10000000 }, // 10MB limit for documents
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  }
}).array('credentials', 5); // Allow up to 5 credential files

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

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// @desc    Register a new user
// @route   POST /api/auth/signup
// @access  Public
const signup = async (req, res) => {
  try {
    const { firstName, lastName, email, phoneNumber, password } = req.body;
      
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

      // Get credential URLs
      const credentialUrls = req.files ? req.files.map(file => `uploads/${file.filename}`) : [];

      // Validate that credentials were uploaded
      if (credentialUrls.length === 0) {
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
        credentials: credentialUrls,
        profilePicture: null, // Profile picture will be added later
        approved: false // User must be approved by admin
      });

      if (user) {
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
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Login failed. Please try again.'
    });
  }
};

module.exports = {
  signup,
  login,
  handleUpload
};