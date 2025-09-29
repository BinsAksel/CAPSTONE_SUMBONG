const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');
const { signup, login, handleUpload, googleSignup } = require('./controllers/authController');
const sendEmail = require('./utils/sendEmail');
const { generateToken } = require('./controllers/authController');
const mongoose = require('mongoose');
const fs = require('fs');
const User = require('./models/User');
const multer = require('multer');
const Complaint = require('./models/Complaint');
const jwt = require('jsonwebtoken');

let dbConnected = false;

// Connect to MongoDB and track connection state
connectDB();

mongoose.connection.on('connected', () => {
  dbConnected = true;
  console.log('MongoDB connected');
});
mongoose.connection.on('disconnected', () => {
  dbConnected = false;
  console.log('MongoDB disconnected');
});
mongoose.connection.on('error', (err) => {
  dbConnected = false;
  console.error('MongoDB connection error:', err);
});

// Initialize express app before any app.use/app.get/app.post
const app = express();

// --- CORS middleware at the very top ---


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).json({ message: 'Invalid token' });
      }
      req.user = decoded;
      next();
    });
  } else {
    res.status(401).json({ message: 'No token provided' });
  }
}

// Get current user profile (for dashboard/profile info)
app.get('/api/user/me', authenticateJWT, async (req, res) => {
  try {
    console.log('GET /api/user/me req.user:', req.user);
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        address: user.address,
        credentials: user.credentials,
        profilePicture: user.profilePicture,
        approved: user.approved,
        verificationStatus: user.verificationStatus,
        verificationDate: user.verificationDate,
        adminNotes: user.adminNotes,
        issueDetails: user.issueDetails,
        requiredActions: user.requiredActions,
        rejectionCount: user.rejectionCount,
        resubmissionRequested: user.resubmissionRequested
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch user profile', error: err.message });
  }
});

// PATCH /api/user with profile picture upload support
app.patch('/api/user', authenticateJWT, profileUpload.single('profilePic'), async (req, res) => {
  try {
    const update = {};
    if (req.body.firstName !== undefined) update.firstName = req.body.firstName;
    if (req.body.lastName !== undefined) update.lastName = req.body.lastName;
    if (req.body.phoneNumber !== undefined) update.phoneNumber = req.body.phoneNumber;
    if (req.body.address !== undefined) update.address = req.body.address;
    if (req.file) {
      update.profilePicture = `uploads/${req.file.filename}`;
    }
    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update profile', error: err.message });
  }
});

// Passport config
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: 'https://capstone-sumbong.onrender.com/api/auth/google/callback',
}, async (accessToken, refreshToken, profile, done) => {
  try {
    console.log('Google profile:', profile);
    if (!profile.emails || !profile.emails.length) {
      console.error('No email found in Google profile');
      return done(new Error('No email found in Google profile'), null);
    }
    // Find user by email
    let user = await User.findOne({ email: profile.emails[0].value });
    console.log('User found in DB:', user);
    if (user) {
      return done(null, user);
    }
    // If user does not exist, check for required info
    const firstName = (profile.name && profile.name.givenName) ? profile.name.givenName : '';
    const lastName = (profile.name && profile.name.familyName) ? profile.name.familyName : '';
    const email = profile.emails[0].value;
    const profilePicture = (profile.photos && profile.photos[0]) ? profile.photos[0].value : null;
    console.log('Returning isNewGoogleUser for:', email);
    // If phoneNumber or address is missing, pass partial info to callback
    // We'll handle user creation after collecting missing info
    return done(null, {
      isNewGoogleUser: true,
      firstName,
      lastName,
      email,
      profilePicture
    });
  } catch (err) {
    console.error('Error in GoogleStrategy:', err);
    return done(err, null);
  }
}));

passport.serializeUser((user, done) => {
    // If this is a new Google user (not yet in DB), serialize the whole object
    if (user && user.isNewGoogleUser) {
      return done(null, { isNewGoogleUser: true, ...user });
    }
    // Otherwise, serialize by user id
    done(null, user.id);
});
passport.deserializeUser(async (id, done) => {
  // If this is a new Google user, just return the object
  if (id && id.isNewGoogleUser) {
    return done(null, id);
  }
  // Otherwise, look up the user in the DB
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Session middleware (required for Passport)
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    sameSite: 'none',
    secure: true
  }
}));
app.use(passport.initialize());
app.use(passport.session());

// Google OAuth routes
app.get('/api/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/api/auth/google/callback', passport.authenticate('google', {
  failureRedirect: '/login',
  session: true
}), async (req, res) => {
  try {
    const user = req.user;
    console.log('OAuth callback user:', user);
    if (!user) {
      console.error('No user found in OAuth callback');
      return res.status(500).json({ success: false, message: 'No user found after Google OAuth' });
    }
    // Only redirect to complete-profile for new Google users
    if (user.isNewGoogleUser) {
      const params = new URLSearchParams({
        firstName: user.firstName || (user.name && user.name.givenName) || '',
        lastName: user.lastName || (user.name && user.name.familyName) || '',
        email: user.email || (user.emails && user.emails[0] && user.emails[0].value) || '',
        profilePicture: user.profilePicture || (user.photos && user.photos[0] && user.photos[0].value) || ''
      }).toString();
      return res.redirect(`https://sumbong.netlify.app/complete-profile?${params}`);
    }
    // Existing users: only allow login if approved
    if (!user.approved) {
      // Optionally, you can redirect to a custom pending page or show a message
      return res.redirect('https://sumbong.netlify.app/login?pending=1');
    }
    const token = generateToken(user._id);
    return res.redirect(`https://sumbong.netlify.app/dashboard?token=${token}`);
  } catch (err) {
    console.error('Error in Google OAuth callback:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});


// Store connected clients for real-time updates
const connectedClients = new Map(); // userId -> response object

// Middleware
const allowedOrigins = [
  'https://sumbong.netlify.app',
  'http://localhost:3000'
];
app.use(cors({
  origin: function(origin, callback) {
    // allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Google signup endpoint for complete-profile form (must be after app is initialized and middleware is set up)
app.post('/api/auth/google-signup', handleUpload, googleSignup);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Uploads directory created successfully');
  } catch (error) {
    console.error('Error creating uploads directory:', error);
  }
}

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// Configure multer for single image upload
const profileStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const profileUpload = multer({ storage: profileStorage });

// Configure multer for complaint upload
const complaintStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const complaintUpload = multer({ storage: complaintStorage });

// Test route to verify database connection
app.get('/api/test', async (req, res) => {
  try {
    // Try to get the database connection status
    const dbState = mongoose.connection.readyState;
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    
    res.json({
      status: 'success',
      message: 'Database connection test',
      databaseState: states[dbState],
      databaseName: mongoose.connection.name,
      host: mongoose.connection.host
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Database connection test failed',
      error: error.message
    });
  }
});

// Simple test route to check if server is running
app.get('/api/health', (req, res) => {
  res.json({
    status: 'success',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    database: {
      connected: dbConnected,
      status: dbConnected ? 'Connected' : 'Not Connected (Test Mode)',
      message: dbConnected ? 'MongoDB is connected and ready' : 'Running in test mode with sample data'
    },
    endpoints: {
      test: '/api/test',
      users: '/api/admin/users',
      complaints: '/api/complaints',
      approveCredentials: '/api/admin/approve-credentials/:userId',
      rejectCredentials: '/api/admin/reject-credentials/:userId',
      requestResubmission: '/api/admin/request-resubmission/:userId',
      verificationHistory: '/api/admin/verification-history'
    },
    note: dbConnected ? null : '⚠️ System is running in TEST MODE. Install MongoDB for full functionality.'
  });
});




// Routes
app.post('/api/auth/signup', handleUpload, signup);
app.post('/api/auth/login', login);

// Get all users
app.get('/api/admin/users', async (req, res) => {
  if (!dbConnected) {
    console.log('⚠️ Database not connected, returning sample data for testing');
    // Return sample data for testing when MongoDB is not connected
    const sampleUsers = [
      {
        _id: 'test-user-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phoneNumber: '+1234567890',
        address: '123 Main St, City, State',
        credentials: ['uploads/sample-id-1.jpg', 'uploads/sample-utility-1.jpg'],
        profilePicture: null,
        approved: false,
        verificationStatus: 'pending',
        createdAt: new Date()
      },
      {
        _id: 'test-user-2',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        phoneNumber: '+0987654321',
        address: '456 Oak Ave, Town, State',
        credentials: ['uploads/sample-id-2.jpg'],
        profilePicture: null,
        approved: true,
        verificationStatus: 'approved',
        verificationDate: new Date(),
        adminNotes: 'All documents verified successfully',
        createdAt: new Date()
      }
    ];
    
    return res.json({ 
      users: sampleUsers,
      message: '⚠️ Using sample data - MongoDB not connected'
    });
  }
  
  try {
    const users = await User.find();
    // Add full path to credentials and profile pictures
    const usersWithImagePaths = users.map(user => ({
      ...user.toObject(),
      credentials: user.credentials ? user.credentials.map(img => img.startsWith('uploads/') ? img : `uploads/${img}`) : [],
      profilePicture: user.profilePicture ? (user.profilePicture.startsWith('uploads/') ? user.profilePicture : `uploads/${user.profilePicture}`) : null
    }));
    res.json({ users: usersWithImagePaths });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: 'Failed to fetch users', error: err.message });
  }
});

// Verify a user
app.patch('/api/admin/verify/:id', async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { approved: true }, { new: true });
  // Send approval email
  if (user) {
    await sendEmail({
      to: user.email,
      subject: 'Your account has been approved!',
      html: `<p>Congratulations, ${user.firstName}! Your account is now approved. You can log in to the system.</p>`
    });
  }
  res.json({ success: true });
});

// Disapprove a user
app.patch('/api/admin/disapprove/:id', async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { approved: false }, { new: true });
  // Send disapproval email
  if (user) {
    await sendEmail({
      to: user.email,
      subject: 'Your account was not approved',
      html: `<p>Sorry, ${user.firstName}. Your account was not approved. Please check your credentials and try again.</p>`
    });
  }
  res.json({ success: true });
});

// Delete a user
app.delete('/api/admin/delete/:id', async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// Update user profile (name, address, phone number, and profile picture)
app.patch('/api/user/:id', profileUpload.single('profilePic'), async (req, res) => {
  try {
    const { firstName, lastName, address, phoneNumber } = req.body;
    let update = { firstName, lastName };
    if (address !== undefined) update.address = address;
    if (phoneNumber !== undefined) update.phoneNumber = phoneNumber;
    if (req.file) {
      update.profilePicture = `uploads/${req.file.filename}`;
    }
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json({ user });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ message: 'Failed to update profile', error: err.message });
  }
});

// Get a single user by ID
app.get('/api/user/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  
  // Add full path to profile picture
  const userWithImagePath = {
    ...user.toObject(),
    profilePicture: user.profilePicture ? (user.profilePicture.startsWith('uploads/') ? user.profilePicture : `uploads/${user.profilePicture}`) : null
  };
  
  res.json({ user: userWithImagePath });
});

// Submit a new complaint
app.post('/api/complaints', authenticateJWT, complaintUpload.array('evidence', 5), async (req, res) => {
  try {
    console.log('POST /api/complaints req.user:', req.user);
    const evidenceFiles = req.files ? req.files.map(file => `uploads/${file.filename}`) : [];
    // Only allow fields that should be set by the user
    const allowedFields = ['fullName', 'contact', 'date', 'time', 'location', 'people', 'description', 'type', 'resolution', 'anonymous', 'confidential'];
    const complaintData = { user: req.user.id, evidence: evidenceFiles, status: 'pending' };
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) complaintData[field] = req.body[field];
    });
    const complaint = await Complaint.create(complaintData);
    res.json({ complaint });
  } catch (err) {
    res.status(500).json({ message: 'Failed to submit complaint', error: err.message });
  }
});

// Get all complaints by user
app.get('/api/complaints/user/:userId', async (req, res) => {
  const complaints = await Complaint.find({ user: req.params.userId }).sort({ createdAt: -1 });
  res.json({ complaints });
});

// Edit a complaint
app.patch('/api/complaints/:id', complaintUpload.array('evidence', 5), async (req, res) => {
  try {
    const evidenceFiles = req.files ? req.files.map(file => `uploads/${file.filename}`) : [];
    const update = { ...req.body };
    if (evidenceFiles.length > 0) {
      update.evidence = evidenceFiles;
    }
    // Only update feedback if present
    if (typeof req.body.feedback !== 'undefined') {
      update.feedback = req.body.feedback;
    }
    
    // Get the complaint before update to check if status changed
    const oldComplaint = await Complaint.findById(req.params.id);
    
    const complaint = await Complaint.findByIdAndUpdate(req.params.id, update, { new: true });
    
    // If status changed, send real-time update and email
    if (oldComplaint && oldComplaint.status !== complaint.status) {
      sendRealTimeUpdate(complaint.user.toString(), {
        type: 'status_update',
        complaintId: complaint._id,
        oldStatus: oldComplaint.status,
        newStatus: complaint.status,
        message: `Your complaint status has been updated from "${oldComplaint.status}" to "${complaint.status}"`
      });
      // Send email notification for status change
      const user = await User.findById(complaint.user);
      if (user) {
        await sendEmail({
          to: user.email,
          subject: `Update on your complaint: ${complaint._id}`,
          html: `<p>Your complaint status has been updated from <b>${oldComplaint.status}</b> to <b>${complaint.status}</b>.</p>`
        });
      }
    }
    // If feedback was added/updated, send real-time update and email
    if (req.body.feedback && req.body.feedback !== oldComplaint?.feedback) {
      sendRealTimeUpdate(complaint.user.toString(), {
        type: 'feedback_update',
        complaintId: complaint._id,
        feedback: req.body.feedback,
        message: 'Admin has added feedback to your complaint'
      });
      // Send email notification for feedback
      const user = await User.findById(complaint.user);
      if (user) {
        await sendEmail({
          to: user.email,
          subject: `Feedback on your complaint: ${complaint._id}`,
          html: `<p>Admin has added feedback to your complaint:<br/>${req.body.feedback}</p>`
        });
      }
    }
    
    res.json({ complaint });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update complaint', error: err.message });
  }
});

// Delete a complaint
app.delete('/api/complaints/:id', async (req, res) => {
  try {
    await Complaint.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete complaint', error: err.message });
  }
});

// Get all complaints (admin view, with user info)
app.get('/api/complaints', async (req, res) => {
  const complaints = await Complaint.find().populate('user', 'firstName lastName email').sort({ createdAt: -1 });
  // Add user info to each complaint
  const complaintsWithUser = complaints.map(c => ({
    ...c.toObject(),
    fullName: c.user ? `${c.user.firstName} ${c.user.lastName}` : 'Anonymous',
    contact: c.user ? c.user.email : 'N/A',
  }));
  res.json({ complaints: complaintsWithUser });
});

// Admin endpoint to update complaint status
app.patch('/api/complaints/:id/status', async (req, res) => {
  try {
    const { status, feedback } = req.body;
    
    // Validate status
    if (!['pending', 'in progress', 'solved'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }
    
    // Get the complaint before update to check if status changed
    const oldComplaint = await Complaint.findById(req.params.id);
    if (!oldComplaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }
    
    const update = { status };
    if (feedback !== undefined) {
      update.feedback = feedback;
    }
    
    const complaint = await Complaint.findByIdAndUpdate(req.params.id, update, { new: true });
    
    // Send real-time update to the user
    if (oldComplaint.status !== status) {
      sendRealTimeUpdate(complaint.user.toString(), {
        type: 'status_update',
        complaintId: complaint._id,
        oldStatus: oldComplaint.status,
        newStatus: status,
        message: `Your complaint status has been updated from "${oldComplaint.status}" to "${status}"`
      });
    }
    
    // If feedback was added/updated, send real-time update
    if (feedback && feedback !== oldComplaint.feedback) {
      sendRealTimeUpdate(complaint.user.toString(), {
        type: 'feedback_update',
        complaintId: complaint._id,
        feedback: feedback,
        message: 'Admin has added feedback to your complaint'
      });
    }
    
    res.json({ complaint });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update complaint status', error: err.message });
  }
});

// Admin endpoint to approve user credentials
app.patch('/api/admin/approve-credentials/:userId', async (req, res) => {
  try {
    console.log('Approve credentials called for userId:', req.params.userId);
    const { adminNotes } = req.body;
    
    if (!req.params.userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    if (!dbConnected) {
      console.log('⚠️ Database not connected, simulating approval for testing');
      return res.json({
        success: true,
        message: 'User credentials approved successfully (TEST MODE - No database)',
        user: {
          _id: req.params.userId,
          verificationStatus: 'approved',
          verificationDate: new Date(),
          adminNotes: adminNotes || 'Credentials verified successfully'
        }
      });
    }
    
    const user = await User.findById(req.params.userId);
    if (!user) {
      console.log('User not found:', req.params.userId);
      return res.status(404).json({ message: 'User not found' });
    }
    
    console.log('Found user:', user.email);
    
    // Update user verification status
    const update = {
      approved: true,
      verificationStatus: 'approved',
      verificationDate: new Date(),
      adminNotes: adminNotes || 'Credentials verified successfully'
    };
    
    const updatedUser = await User.findByIdAndUpdate(req.params.userId, update, { new: true });
    console.log('User updated successfully:', updatedUser.email);
    
    // Send real-time notification to user
    if (connectedClients.has(user._id.toString())) {
      sendRealTimeUpdate(user._id.toString(), {
        type: 'credential_verification',
        status: 'approved',
        message: 'Your credentials have been verified and approved!',
        adminNotes: update.adminNotes,
        verificationDate: update.verificationDate
      });
    }
    
    res.json({ 
      success: true, 
      message: 'User credentials approved successfully',
      user: updatedUser 
    });
  } catch (err) {
    console.error('Error in approve-credentials:', err);
    res.status(500).json({ message: 'Failed to approve credentials', error: err.message });
  }
});

// Admin endpoint to reject user credentials with issue details
app.patch('/api/admin/reject-credentials/:userId', async (req, res) => {
  try {
    console.log('Reject credentials called for userId:', req.params.userId);
    const { issueDetails, adminNotes, requiredActions } = req.body;
    
    if (!req.params.userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    if (!issueDetails) {
      return res.status(400).json({ message: 'Issue details are required' });
    }
    
    if (!dbConnected) {
      console.log('⚠️ Database not connected, simulating rejection for testing');
      return res.json({
        success: true,
        message: 'User credentials rejected with issue details (TEST MODE - No database)',
        user: {
          _id: req.params.userId,
          verificationStatus: 'rejected',
          verificationDate: new Date(),
          issueDetails: issueDetails,
          adminNotes: adminNotes || 'Credentials rejected due to issues found',
          requiredActions: requiredActions || 'Please upload corrected credentials',
          rejectionCount: 1
        }
      });
    }
    
    const user = await User.findById(req.params.userId);
    if (!user) {
      console.log('User not found:', req.params.userId);
      return res.status(404).json({ message: 'User not found' });
    }
    
    console.log('Found user:', user.email);
    
    // Update user verification status
    const update = {
      approved: false,
      verificationStatus: 'rejected',
      verificationDate: new Date(),
      issueDetails: issueDetails,
      adminNotes: adminNotes || 'Credentials rejected due to issues found',
      requiredActions: requiredActions || 'Please upload corrected credentials',
      rejectionCount: (user.rejectionCount || 0) + 1
    };
    
    const updatedUser = await User.findByIdAndUpdate(req.params.userId, update, { new: true });
    console.log('User updated successfully:', updatedUser.email);
    
    // Send real-time notification to user
    if (connectedClients.has(user._id.toString())) {
      sendRealTimeUpdate(user._id.toString(), {
        type: 'credential_verification',
        status: 'rejected',
        message: 'Your credentials have been reviewed and issues were found.',
        issueDetails: issueDetails,
        adminNotes: adminNotes,
        requiredActions: requiredActions,
        verificationDate: update.verificationDate
      });
    }
    
    // Send email to user with all details
    await sendEmail({
      to: user.email,
      subject: 'Credential Issues Found - Action Required',
      html: `<h3>Credential Issues Found</h3>
        <p><b>Issue Details:</b> ${issueDetails}</p>
        <p><b>Admin Notes:</b> ${adminNotes || 'None'}</p>
        <p><b>Required Actions:</b> ${requiredActions || 'Please upload corrected credentials.'}</p>
        <p>Please log in to your account to address these issues.</p>`
    });
    res.json({ 
      success: true, 
      message: 'User credentials rejected with issue details',
      user: updatedUser 
    });
  } catch (err) {
    console.error('Error in reject-credentials:', err);
    res.status(500).json({ message: 'Failed to reject credentials', error: err.message });
  }
});

// Admin endpoint to get credential verification history
app.get('/api/admin/verification-history', async (req, res) => {
  try {
    const users = await User.find({
      $or: [
        { verificationStatus: { $exists: true } },
        { adminNotes: { $exists: true } },
        { issueDetails: { $exists: true } }
      ]
    }).select('firstName lastName email verificationStatus verificationDate adminNotes issueDetails requiredActions rejectionCount approved createdAt');
    
    res.json({ 
      success: true, 
      verificationHistory: users 
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch verification history', error: err.message });
  }
});

// Admin endpoint to request credential resubmission
app.patch('/api/admin/request-resubmission/:userId', async (req, res) => {
  try {
    console.log('Request resubmission called for userId:', req.params.userId);
    const { reason, deadline } = req.body;
    
    if (!req.params.userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    if (!dbConnected) {
      console.log('⚠️ Database not connected, simulating resubmission request for testing');
      return res.json({
        success: true,
        message: 'Resubmission requested successfully (TEST MODE - No database)',
        user: {
          _id: req.params.userId,
          verificationStatus: 'resubmission_required',
          resubmissionRequested: true,
          resubmissionReason: reason,
          resubmissionDeadline: deadline ? new Date(deadline) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          resubmissionRequestDate: new Date()
        }
      });
    }
    
    const user = await User.findById(req.params.userId);
    if (!user) {
      console.log('User not found:', req.params.userId);
      return res.status(404).json({ message: 'User not found' });
    }
    
    console.log('Found user:', user.email);
    
    // Update user status to request resubmission
    const update = {
      verificationStatus: 'resubmission_required',
      resubmissionRequested: true,
      resubmissionReason: reason,
      resubmissionDeadline: deadline ? new Date(deadline) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 7 days
      resubmissionRequestDate: new Date()
    };
    
    const updatedUser = await User.findByIdAndUpdate(req.params.userId, update, { new: true });
    console.log('User updated successfully:', updatedUser.email);
    
    // Send real-time notification to user
    if (connectedClients.has(user._id.toString())) {
      sendRealTimeUpdate(user._id.toString(), {
        type: 'credential_resubmission',
        message: 'You are required to resubmit your credentials.',
        reason: reason,
        deadline: update.resubmissionDeadline,
        requestDate: update.resubmissionRequestDate
      });
    }
    
    // Send email to user for resubmission request
    await sendEmail({
      to: user.email,
      subject: 'Credential Resubmission Requested',
      html: `<h3>Credential Resubmission Requested</h3>
        <p><b>Reason:</b> ${reason || 'Please resubmit your credentials.'}</p>
        <p><b>Deadline:</b> ${update.resubmissionDeadline ? new Date(update.resubmissionDeadline).toLocaleString() : 'N/A'}</p>
        <p>Please log in to your account and upload the required documents before the deadline.</p>`
    });
    res.json({ 
      success: true, 
      message: 'Resubmission requested successfully',
      user: updatedUser 
    });
  } catch (err) {
    console.error('Error in request-resubmission:', err);
    res.status(500).json({ message: 'Failed to request resubmission', error: err.message });
  }
});

// Real-time updates endpoint using Server-Sent Events
app.get('/api/realtime/:userId', (req, res) => {
  const userId = req.params.userId;
  
  // Set headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Real-time connection established' })}\n\n`);

  // Store this client's response object
  connectedClients.set(userId, res);

  // Handle client disconnect
  req.on('close', () => {
    connectedClients.delete(userId);
    console.log(`Client ${userId} disconnected from real-time updates`);
  });

  // Keep connection alive
  const keepAlive = setInterval(() => {
    if (connectedClients.has(userId)) {
      res.write(`data: ${JSON.stringify({ type: 'ping', timestamp: Date.now() })}\n\n`);
    } else {
      clearInterval(keepAlive);
    }
  }, 30000); // Send ping every 30 seconds
});

// Function to send real-time updates to specific user
const sendRealTimeUpdate = (userId, data) => {
  const client = connectedClients.get(userId);
  if (client) {
    try {
      client.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      console.error('Error sending real-time update:', error);
      connectedClients.delete(userId);
    }
  }
};

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});