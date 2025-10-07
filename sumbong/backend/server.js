// Track MongoDB connection status
let dbConnected = false;
// Ensure environment variables loaded immediately (local dev). On Render, vars already in process.env.
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const sanitizeHtml = require('sanitize-html');

// Load connectDB after dotenv and before using it
const connectDB = require('./config/db');
// Connect to MongoDB and update dbConnected status
connectDB()
  .then(() => {
    dbConnected = true;
    console.log('MongoDB connected');
  })
  .catch((err) => {
    dbConnected = false;
    console.error('MongoDB connection error:', err);
  });
const { signup, login, handleUpload, googleSignup, adminLogin, forgotPassword, resetPassword, changePassword, verifyEmail, resendVerification, requestPasswordChange, confirmPasswordChange } = require('./controllers/authController');
const sendEmail = require('./utils/sendEmail');
const {
  complaintStatusTemplate,
  complaintFeedbackTemplate,
  credentialApprovedTemplate,
  credentialRejectedTemplate,
  credentialResubmissionTemplate
} = require('./utils/emailTemplates');
const { generateToken } = require('./controllers/authController');
const mongoose = require('mongoose');
const fs = require('fs');
const User = require('./models/User');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('./config/cloudinary');
const Complaint = require('./models/Complaint');
const jwt = require('jsonwebtoken');
const Notification = require('./models/Notification');
const bus = require('./events/bus');



// Initialize express app before any app.use/app.get/app.post
const app = express();

const trustProxy = process.env.TRUST_PROXY !== undefined ? process.env.TRUST_PROXY : '1';
app.set('trust proxy', trustProxy);
if (['1','true','yes'].includes(String(process.env.CORS_DEBUG||'').toLowerCase())) {
  console.log(`[INIT] trust proxy set to: ${trustProxy}`);
}

// --- CORS MUST RUN EARLY (before rate limiters) so even errors/preflight get headers ---
const corsEnv = process.env.CORS_ORIGINS;
// Default origins include production domain, all Vercel preview domains via wildcard, and localhost.
// Wildcard pattern "https://capstone-sumbong-*.vercel.app" will match preview URLs like
// https://capstone-sumbong-git-main-<hash>.vercel.app or other branch deployments.
// NOTE: If you want to tighten later, set CORS_ORIGINS env var explicitly (comma separated) without the wildcard.
const defaultOrigins = [
  'https://capstone-sumbong.vercel.app',
  'https://capstone-sumbong-*.vercel.app',
  'http://localhost:3000'
];
function buildOriginMatchers(list) {
  return list.map(raw => {
    const origin = raw.trim().replace(/\/$/, '');
    if (!origin) return null;
    if (origin.includes('*')) {
      const esc = origin
        .replace(/[-/\\^$+?.()|[\]{}]/g, r => `\\${r}`)
        .replace(/\\\*/g, '([^.]+\\.)?');
      return { type: 'regex', value: new RegExp(`^${esc}$`, 'i'), display: origin };
    }
    return { type: 'exact', value: origin, display: origin };
  }).filter(Boolean);
}
const originList = corsEnv ? corsEnv.split(',') : defaultOrigins;
const originMatchers = buildOriginMatchers(originList);
const corsDebug = ['1','true','yes'].includes(String(process.env.CORS_DEBUG || '').toLowerCase());
app.use(cors({
  origin: function(origin, callback) {
    if (corsDebug) console.log('[CORS] Incoming origin:', origin || '(none)');
    if (!origin) return callback(null, true);
    const normalized = origin.replace(/\/$/, '');
    const allowed = originMatchers.some(m => (m.type === 'exact' ? m.value === normalized : m.value.test(normalized)));
    if (allowed) {
      if (corsDebug) console.log('[CORS] Allowed:', normalized);
      return callback(null, true);
    }
    if (corsDebug) console.warn('[CORS] Rejected origin:', normalized, 'Allowed list:', originMatchers.map(m => m.display));
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET','POST','PATCH','PUT','DELETE','OPTIONS'],
  // Added 'Cache-Control' (and legacy 'Pragma','Expires') because browser may send these on fetch/EventSource
  // and we were seeing: "Request header field cache-control is not allowed by Access-Control-Allow-Headers in preflight response".
  allowedHeaders: ['Content-Type','Authorization','Accept','X-Requested-With','Cache-Control','Pragma','Expires'],
  exposedHeaders: ['Content-Type','Authorization']
}));
// Friendly CORS error handler (must have 4 params) placed immediately after cors middleware.
// Without this, the generic error handler would typically convert it into a 500 for browsers.
app.use((err, req, res, next) => {
  if (err && err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      message: 'CORS blocked: origin not allowed',
      origin: req.headers.origin || null,
      allowed: originMatchers.map(m => m.display)
    });
  }
  return next(err);
});
if (corsDebug) {
  app.get('/__cors_debug', (req,res) => {
    res.json({ configured: originMatchers.map(m => m.display), receivedOrigin: req.headers.origin || null });
  });
}

// --- Global Security Middleware (after CORS) ---
app.use(helmet({ contentSecurityPolicy: false }));
app.use((req,res,next)=>{ // custom CSP
  // Allow OpenStreetMap tile servers for map tiles (tile.openstreetmap.org and subdomains)
  // Allow unpkg.com for Leaflet CSS
  // Allow nominatim.openstreetmap.org for geocoding API
  res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self' https://nominatim.openstreetmap.org; img-src 'self' https://res.cloudinary.com https://tile.openstreetmap.org https://a.tile.openstreetmap.org https://b.tile.openstreetmap.org https://c.tile.openstreetmap.org data:; media-src 'self' https://res.cloudinary.com https://tile.openstreetmap.org https://a.tile.openstreetmap.org https://b.tile.openstreetmap.org https://c.tile.openstreetmap.org data:; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Permissions-Policy','geolocation=(), microphone=(), camera=()');
  next();
});
// --- Rate limiting (configurable & user-aware) ---
// Environment variables (all optional):
// RATE_LIMIT_WINDOW_MS (default 900000 = 15 min)
// RATE_LIMIT_GENERAL (requests per window for general API, default 600)
// RATE_LIMIT_AUTH (requests per window for auth endpoints, default 50)
// RATE_LIMIT_DEBUG=1 to log 429 decisions
function envInt(name, def) { const v = parseInt(process.env[name] || ''); return Number.isFinite(v) && v > 0 ? v : def; }
const RL_WINDOW = envInt('RATE_LIMIT_WINDOW_MS', 15*60*1000);
const RL_GENERAL = envInt('RATE_LIMIT_GENERAL', 600);
const RL_AUTH = envInt('RATE_LIMIT_AUTH', 50);
const rlDebug = ['1','true','yes'].includes(String(process.env.RATE_LIMIT_DEBUG||'').toLowerCase());

// Key generator prefers user id embedded in JWT to avoid all users behind one NAT IP sharing a bucket.
const rateKeyGenerator = (req) => {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    try {
      const decoded = jwt.decode(auth.split(' ')[1]);
      if (decoded && decoded.id) return `user:${decoded.id}`;
    } catch {/* ignore decode issues */}
  }
  // Fallback to IP (Express considers trust proxy earlier set)
  return `ip:${req.ip}`;
};

// Skip health checks, realtime (SSE) channel, policy file loads, OPTIONS preflight.
const rateSkip = (req) => {
  if (req.method === 'OPTIONS') return true;
  const p = req.path;
  return p.startsWith('/api/health') || p.startsWith('/api/test') || p.startsWith('/api/realtime') || p.startsWith('/api/policies/');
};

const build429Handler = (name) => (req, res, _next, options) => {
  if (rlDebug) {
    console.warn(`[RATE_LIMIT] 429 for key=${rateKeyGenerator(req)} route=${req.originalUrl} limiter=${name}`);
  }
  res.status(options.statusCode).json({
    message: options.message && options.message.message ? options.message.message : 'Too many requests, please slow down.',
    limiter: name,
    windowMs: RL_WINDOW,
    limit: options.limit,
    retryAfterSeconds: Math.ceil((options.windowMs || RL_WINDOW)/1000)
  });
};

const generalLimiter = rateLimit({
  windowMs: RL_WINDOW,
  limit: RL_GENERAL,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateKeyGenerator,
  skip: rateSkip,
  handler: build429Handler('general')
});
const authLimiter = rateLimit({
  windowMs: RL_WINDOW,
  limit: RL_AUTH,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateKeyGenerator,
  skip: rateSkip,
  message: { message: 'Too many auth attempts, please try again later.' },
  handler: build429Handler('auth')
});
app.use('/api/auth/', authLimiter); // auth first (stricter)
app.use('/api/', generalLimiter);
// Sanitization
app.use(mongoSanitize());
const sanitizeBodyFields = (fields=[]) => (req,res,next)=>{ fields.forEach(f=>{ if (req.body && typeof req.body[f] === 'string') { req.body[f] = sanitizeHtml(req.body[f], { allowedTags: [], allowedAttributes: {} }); }}); next(); };

// After DB connection attempt, log a warning if no admin users exist (no auto-create logic)
setTimeout(async () => {
  try {
    const adminCount = await User.countDocuments({ isAdmin: true });
    if (adminCount === 0) {
      console.warn('[STARTUP WARNING] No admin users found. Run: npm run seed:admin');
    }
  } catch (e) {
    console.warn('Admin presence check failed:', e.message);
  }
}, 5000);


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

// Require admin role (token must include isAdmin true)
function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
}

// Get current user profile (for dashboard/profile info)
app.get('/api/user/me', authenticateJWT, async (req, res) => {
  try {
    console.log('GET /api/user/me req.user:', req.user);
    // Debug: print the user id from JWT
    console.log('JWT user id:', req.user.id);
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

// Passport config
// Resolve dynamic callback URL (prefers env override)
const GOOGLE_CALLBACK = process.env.GOOGLE_CALLBACK_URL || `${process.env.BACKEND_BASE_URL || 'https://capstone-sumbong.onrender.com'}/api/auth/google/callback`;
const FRONTEND_BASE = (process.env.FRONTEND_ORIGIN || 'https://capstone-sumbong.vercel.app/').replace(/\/$/, '');

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: GOOGLE_CALLBACK,
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
      return res.redirect(`${FRONTEND_BASE}/complete-profile?${params}`);
    }
    // Existing users: only allow login if approved
    if (!user.approved) {
      // Optionally, you can redirect to a custom pending page or show a message
      return res.redirect(`${FRONTEND_BASE}/login?pending=1`);
    }
    const token = generateToken(user._id);
    return res.redirect(`${FRONTEND_BASE}/dashboard?token=${token}`);
  } catch (err) {
    console.error('Error in Google OAuth callback:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});


// Store connected clients for real-time updates
const connectedClients = new Map(); // userId -> response object

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

// Cloudinary storage configurations
const profileStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    return {
      folder: 'sumbong/profile_pictures',
      resource_type: 'image',
      format: undefined, // keep original
      public_id: `profile_${Date.now()}_${Math.round(Math.random()*1e6)}`
    };
  }
});
const complaintStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    // Determine resource type based on mimetype
    const isVideo = file.mimetype.startsWith('video/');
    const isImage = file.mimetype.startsWith('image/');
    return {
      folder: 'sumbong/complaints',
      resource_type: isVideo ? 'video' : (isImage ? 'image' : 'raw'),
      public_id: `evidence_${Date.now()}_${Math.round(Math.random()*1e6)}`
    };
  }
});
// Helper function to extract Cloudinary publicId from the file path
function extractPublicId(filePath) {
  const regex = /\/([^\/]+)$/; // Matches the last segment of the path
  const match = filePath.match(regex);
  return match ? match[1] : null;
}
// New helper to extract the FULL Cloudinary public_id (including folder path) from a secure URL
// Example: https://res.cloudinary.com/<cloud>/image/upload/v1234567/sumbong/complaints/evidence_abc123.jpg
// Returns: sumbong/complaints/evidence_abc123
function extractFullPublicId(url) {
  if (!url) return null;
  const match = url.match(/\/upload\/v\d+\/([^\.]+)(?=\.)/); // capture segment(s) up to before extension
  return match ? match[1] : null;
}
const profileUpload = multer({ storage: profileStorage });
// 10MB per evidence file limit
const TEN_MB = 10 * 1024 * 1024;
const complaintUpload = multer({
  storage: complaintStorage,
  limits: { fileSize: TEN_MB },
  fileFilter: (req, file, cb) => {
    const allowedImage = ['image/jpeg','image/png','image/gif','image/webp','image/bmp'];
    const allowedVideo = ['video/mp4','video/webm','video/ogg','video/quicktime'];
    if (allowedImage.includes(file.mimetype) || allowedVideo.includes(file.mimetype)) return cb(null,true);
    return cb(new Error('Unsupported evidence file type'));
  }
});

// In-memory storage for credentials (converted to base64 for Cloudinary upload)
const credentialUploadMemory = multer({ storage: multer.memoryStorage(), limits: { fileSize: TEN_MB } });

// Generic helper to extract full Cloudinary publicId from secure URL
function extractCloudinaryPublicId(fullUrl) {
  if (!fullUrl) return null;
  try {
    const m = fullUrl.match(/\/upload\/v\d+\/([^\.]+)(?=\.)/);
    return m ? m[1] : null;
  } catch { return null; }
}

async function deleteCloudinaryPublicIds(publicIds = []) {
  for (const pid of publicIds) {
    if (!pid) continue;
    try {
      await cloudinary.uploader.destroy(pid, { resource_type: 'image' });
    } catch (e) {
      // Attempt video fallback if image failed and looks like we stored a video
      if (/\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(pid)) {
        try { await cloudinary.uploader.destroy(pid, { resource_type: 'video' }); } catch {}
      }
      console.warn('Cloudinary destroy failed for', pid, e.message);
    }
  }
}

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
// Auth routes (signup/login/admin login) grouped together
// Explicit OPTIONS for certain routes (helps some stricter browsers / proxies)
app.options('/api/auth/admin/login', cors());
app.options('/api/realtime/:userId', cors());
app.post('/api/auth/signup', handleUpload, signup);
app.post('/api/auth/login', login);
app.post('/api/auth/admin/login', adminLogin);
// Password lifecycle
app.post('/api/auth/forgot-password', forgotPassword);
app.post('/api/auth/reset-password', resetPassword);
app.patch('/api/auth/change-password', authenticateJWT, changePassword);
// Authenticated email confirmation flow for password change
app.post('/api/auth/request-password-change', authenticateJWT, requestPasswordChange);
// Confirmation endpoint (token + current + new password)
app.post('/api/auth/confirm-password-change', confirmPasswordChange);
// Email verification
app.post('/api/auth/verify-email', verifyEmail);
app.post('/api/auth/resend-verification', resendVerification);

// Get all users
app.get('/api/admin/users', authenticateJWT, requireAdmin, async (req, res) => {
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
  const users = await User.find().sort({ createdAt: -1 });
    // Normalize credential entries (now stored as objects) + backward compatibility for legacy string entries
    const usersWithImagePaths = users.map(user => {
      const rawCreds = Array.isArray(user.credentials) ? user.credentials : [];
      const normalizedCreds = rawCreds.map(entry => {
        if (!entry) return null;
        // Legacy string form
        if (typeof entry === 'string') {
          const isAbsolute = /^https?:\/\//.test(entry);
          const url = isAbsolute ? entry : (entry.startsWith('uploads/') ? entry : `uploads/${entry}`);
          return { url, publicId: (typeof extractCloudinaryPublicId === 'function') ? extractCloudinaryPublicId(url) : null };
        }
        // Object form { url, publicId, uploadedAt? }
        if (typeof entry === 'object') {
          // Ensure url is present; if a legacy key name was used, attempt to derive (unlikely but defensive)
          if (!entry.url && entry.path) entry.url = entry.path;
          return entry;
        }
        return null;
      }).filter(Boolean);
      // Profile picture normalization (respect absolute Cloudinary URL)
      const profilePicture = user.profilePicture
        ? (/^https?:\/\//.test(user.profilePicture)
            ? user.profilePicture
            : (user.profilePicture.startsWith('uploads/') ? user.profilePicture : `uploads/${user.profilePicture}`))
        : null;
      // Backward compatibility: flat array of URLs for older frontend code
      const credentialUrls = normalizedCreds.map(c => c.url).filter(Boolean);
      return {
        ...user.toObject(),
        credentials: normalizedCreds,
        credentialUrls,
        profilePicture
      };
    });
    res.json({ users: usersWithImagePaths });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: 'Failed to fetch users', error: err.message });
  }
});

// Verify a user
app.patch('/api/admin/verify/:id', authenticateJWT, requireAdmin, async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { approved: true }, { new: true });
  if (user) {
    try {
      const { subject, html } = credentialApprovedTemplate({ firstName: user.firstName });
      await sendEmail({ to: user.email, subject, html });
    } catch (e) { console.warn('Email (simple verify) failed:', e.message); }
  }
  res.json({ success: true });
});

// Disapprove a user
app.patch('/api/admin/disapprove/:id', authenticateJWT, requireAdmin, async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { approved: false }, { new: true });
  if (user) {
    try {
      const { subject, html } = credentialRejectedTemplate({
        firstName: user.firstName,
        issueDetails: 'Your account was not approved.',
        adminNotes: 'Please review and re-submit credentials.',
        requiredActions: 'Update and upload proper documents.'
      });
      await sendEmail({ to: user.email, subject, html });
    } catch (e) { console.warn('Email (simple disapprove) failed:', e.message); }
  }
  res.json({ success: true });
});

// Delete a user (with admin safety guard)
app.delete('/api/admin/delete/:id', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const targetId = req.params.id;
    const targetUser = await User.findById(targetId).select('_id email isAdmin credentials profilePicture profilePicturePublicId');
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    // Prevent deleting yourself (avoid accidental lockout during admin maintenance)
    if (targetUser._id.toString() === req.user.id) {
      return res.status(400).json({ success: false, message: 'Admins cannot delete their own account' });
    }
    // If target is an admin, enforce extra safeguards
    if (targetUser.isAdmin) {
      const adminCount = await User.countDocuments({ isAdmin: true });
      if (adminCount <= 1) {
        return res.status(400).json({ success: false, message: 'Cannot delete the last remaining admin' });
      }
      return res.status(403).json({ success: false, message: 'Deletion of admin accounts is not allowed via this endpoint' });
    }
    // Collect credential publicIds for cleanup
    const credentialPublicIds = [];
    if (Array.isArray(targetUser.credentials)) {
      targetUser.credentials.forEach(c => {
        if (c && typeof c === 'object') {
          if (c.publicId) credentialPublicIds.push(c.publicId);
          else if (c.url) {
            const pid = extractCloudinaryPublicId(c.url);
            if (pid) credentialPublicIds.push(pid);
          }
        } else if (typeof c === 'string') {
          const pid = extractCloudinaryPublicId(c);
            if (pid) credentialPublicIds.push(pid);
        }
      });
    }
    if (targetUser.profilePicturePublicId) credentialPublicIds.push(targetUser.profilePicturePublicId);
    // Best-effort deletion
    await deleteCloudinaryPublicIds(credentialPublicIds);
    await User.findByIdAndDelete(targetId);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete user', error: err.message });
  }
});

// Update user profile (name, address, phone number, and profile picture)
// Helper to normalize user object responses
function buildUserResponse(userDoc) {
  if (!userDoc) return null;
  return {
    _id: userDoc._id,
    firstName: userDoc.firstName,
    lastName: userDoc.lastName,
    email: userDoc.email,
    phoneNumber: userDoc.phoneNumber,
    address: userDoc.address,
    credentials: userDoc.credentials,
  // Keep absolute URL from Cloudinary; if legacy relative path, prefix
  profilePicture: userDoc.profilePicture ? (/^https?:\/\//.test(userDoc.profilePicture) ? userDoc.profilePicture : (userDoc.profilePicture.startsWith('uploads/') ? userDoc.profilePicture : `uploads/${userDoc.profilePicture}`)) : null,
    profilePicturePublicId: userDoc.profilePicturePublicId || null,
    approved: userDoc.approved,
    verificationStatus: userDoc.verificationStatus,
    verificationDate: userDoc.verificationDate,
    adminNotes: userDoc.adminNotes,
    issueDetails: userDoc.issueDetails,
    requiredActions: userDoc.requiredActions,
    rejectionCount: userDoc.rejectionCount,
    resubmissionRequested: userDoc.resubmissionRequested,
    createdAt: userDoc.createdAt,
    updatedAt: userDoc.updatedAt
  };
}

// New secure profile update route using JWT (preferred by frontend)
app.patch('/api/user', authenticateJWT, profileUpload.single('profilePic'), async (req, res) => {
  try {
    const { firstName, lastName, address, phoneNumber } = req.body;
    const update = {};
    if (firstName !== undefined) update.firstName = firstName;
    if (lastName !== undefined) update.lastName = lastName;
    if (address !== undefined) update.address = address;
    if (phoneNumber !== undefined) update.phoneNumber = phoneNumber;
    // If uploading a new file, destroy previous Cloudinary image (if any) first
    if (req.file && req.file.path) {
      try {
        const existing = await User.findById(req.user.id).select('profilePicturePublicId');
        if (existing && existing.profilePicturePublicId) {
          const { v2: cloudinary } = require('cloudinary');
          cloudinary.uploader.destroy(existing.profilePicturePublicId, { resource_type: 'image' })
            .catch(err => console.warn('Cloudinary destroy (profile) failed:', err.message));
        }
      } catch (e) {
        console.warn('Lookup previous profile picture failed:', e.message);
      }
      update.profilePicture = req.file.path; // secure URL
      // multer-storage-cloudinary typically exposes filename = public_id
      if (req.file.filename) {
        update.profilePicturePublicId = req.file.filename;
      } else {
        // Fallback: extract from URL
        update.profilePicturePublicId = (req.file.path.match(/upload\/v\d+\/([^\.]+)(?=\.)/) || [])[1] || null;
      }
    }
    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user: buildUserResponse(user) });
  } catch (err) {
    console.error('Update profile error (JWT route):', err);
    res.status(500).json({ message: 'Failed to update profile', error: err.message });
  }
});

// Legacy param-based route secured & restricted to self (can be extended for admin use)
app.patch('/api/user/:id', authenticateJWT, profileUpload.single('profilePic'), async (req, res) => {
  try {
    if (req.user.id !== req.params.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const { firstName, lastName, address, phoneNumber } = req.body;
    const update = {};
    if (firstName !== undefined) update.firstName = firstName;
    if (lastName !== undefined) update.lastName = lastName;
    if (address !== undefined) update.address = address;
    if (phoneNumber !== undefined) update.phoneNumber = phoneNumber;
    if (req.file && req.file.path) {
      update.profilePicture = req.file.path;
    }
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user: buildUserResponse(user) });
  } catch (err) {
    console.error('Update profile error (legacy route):', err);
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
app.post('/api/complaints', authenticateJWT, sanitizeBodyFields(['fullName','contact','location','people','description','type','resolution']), (req, res, next) => {
  complaintUpload.array('evidence', 5)(req, res, function(err){
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'One or more evidence files exceed the 10MB limit.' });
      }
      return res.status(400).json({ message: 'Upload failed', error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    console.log('POST /api/complaints req.user:', req.user);
    console.log('Complaint user id:', req.user.id);
    const evidenceFiles = req.files ? req.files.map(file => file.path || file.secure_url || file.url).filter(Boolean) : [];
    const allowedFields = ['fullName', 'contact', 'date', 'time', 'location', 'people', 'description', 'type', 'resolution', 'anonymous', 'confidential'];
    const complaintData = { user: req.user.id, evidence: evidenceFiles, status: 'pending' };
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) complaintData[field] = req.body[field];
    });
    // Accept locationCoords if provided (frontend sends JSON string)
    if (req.body.locationCoords) {
      try {
        const coords = typeof req.body.locationCoords === 'string' ? JSON.parse(req.body.locationCoords) : req.body.locationCoords;
        const lat = coords && (coords.lat ?? coords.latitude);
        const lng = coords && (coords.lng ?? coords.longitude);
        if (lat != null && lng != null) {
          complaintData.locationCoords = { lat: parseFloat(lat), lng: parseFloat(lng) };
        }
      } catch (e) { /* ignore parse errors */ }
    }
    // Defensive fallback: ensure fullName & contact populated from user record if missing
    if (!complaintData.fullName || !complaintData.contact) {
      const u = await User.findById(req.user.id).select('firstName lastName email');
      if (u) {
        if (!complaintData.fullName) complaintData.fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim();
        if (!complaintData.contact) complaintData.contact = u.email;
      }
    }
  const complaint = await Complaint.create(complaintData);
  try { bus.emit('new_complaint', { complaintId: complaint._id.toString() }); } catch (e) { console.warn('Emit new_complaint failed:', e.message); }
  res.json({ complaint });
  } catch (err) {
    console.error('Submit complaint error:', err);
    res.status(500).json({ message: 'Failed to submit complaint', error: err.message });
  }
});

// Get all complaints by user
app.get('/api/complaints/user/:userId', async (req, res) => {
  // Exclude user-soft-deleted complaints from user listings
  const complaints = await Complaint.find({ user: req.params.userId, isDeletedByUser: { $ne: true } }).sort({ createdAt: -1 });
  res.json({ complaints });
});

// Get single complaint (owner or admin) including threaded feedback entries
app.get('/api/complaints/:id', authenticateJWT, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });
    const isOwner = complaint.user.toString() === req.user.id;
    if (!isOwner && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized to view this complaint' });
    }
    // If user soft-deleted the complaint, prevent the owner (non-admin) from viewing it again
    if (complaint.isDeletedByUser && isOwner && !req.user.isAdmin) {
      return res.status(404).json({ message: 'Complaint not found' });
    }
    res.json({ complaint });
  } catch (e) {
    res.status(500).json({ message: 'Failed to load complaint', error: e.message });
  }
});

// Edit a complaint
app.patch('/api/complaints/:id', sanitizeBodyFields(['fullName','contact','location','people','description','type','resolution']), complaintUpload.array('evidence', 5), async (req, res) => {
  try {
    // Load existing complaint first for logic & deletion
    const existingComplaint = await Complaint.findById(req.params.id);
    if (!existingComplaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }

    // Normalize existing evidence into array of { url, publicId }
    const normalizeEvidenceItem = (item) => {
      if (!item) return null;
      if (typeof item === 'string') {
  return { url: item, publicId: extractFullPublicId(item) };
      }
  if (item.url) return { url: item.url, publicId: item.publicId || extractFullPublicId(item.url) };
      return null;
    };
    const existingEvidence = Array.isArray(existingComplaint.evidence)
      ? existingComplaint.evidence.map(normalizeEvidenceItem).filter(Boolean)
      : [];

    // New uploads (secure Cloudinary URLs)
    const newEvidenceRaw = req.files ? req.files.map(f => f.path || f.secure_url || f.url).filter(Boolean) : [];
    const newEvidenceObjs = newEvidenceRaw.map(url => ({
      url,
  publicId: extractFullPublicId(url)
    }));

    const update = {};
    const replace = ['true', '1', true].includes(req.body.replaceEvidence);
    if (newEvidenceObjs.length > 0) {
      if (replace) {
        update.evidence = newEvidenceObjs;
      } else {
        update.evidence = existingEvidence.concat(newEvidenceObjs);
      }
    } else if (replace) {
      // Replace requested but no new uploads provided: clear evidence
      update.evidence = [];
    }

    // Delete old evidence assets if replacing
    if (replace && existingEvidence.length > 0) {
      for (const ev of existingEvidence) {
        if (!ev.publicId) continue;
        const urlLower = (ev.url || '').toLowerCase();
        const isVideo = /(mp4|webm|ogg|mov|avi|mkv)$/i.test(urlLower);
        const resourceTypesToTry = isVideo ? ['video','image'] : ['image','video'];
        for (const rType of resourceTypesToTry) {
          try {
            const resp = await cloudinary.uploader.destroy(ev.publicId, { resource_type: rType });
            if (resp && (resp.result === 'ok' || resp.result === 'not found')) break; // stop trying other types
          } catch (e) {
            // Continue to next resource type
            if (rType === resourceTypesToTry[resourceTypesToTry.length -1]) {
              console.warn('Failed to delete old evidence asset', ev.publicId, e.message);
            }
          }
        }
      }
    }

    // Copy over primitive updatable fields
    const allowed = ['fullName','contact','date','time','location','people','description','type','resolution','anonymous','confidential'];
    allowed.forEach(f => { if (req.body[f] !== undefined) update[f] = req.body[f]; });
    // Allow updating locationCoords if provided
    if (req.body.locationCoords) {
      try {
        const coords = typeof req.body.locationCoords === 'string' ? JSON.parse(req.body.locationCoords) : req.body.locationCoords;
        const lat = coords && (coords.lat ?? coords.latitude);
        const lng = coords && (coords.lng ?? coords.longitude);
        if (lat != null && lng != null) update.locationCoords = { lat: parseFloat(lat), lng: parseFloat(lng) };
      } catch (e) { /* ignore parse errors */ }
    }

    // Legacy single feedback update support (kept for backward compatibility)
    if (typeof req.body.feedback !== 'undefined') {
      update.feedback = req.body.feedback;
    }

    const oldStatus = existingComplaint.status;
    const oldFeedback = existingComplaint.feedback;

    // Apply update
    const complaint = await Complaint.findByIdAndUpdate(req.params.id, update, { new: true });
    
    // If status changed, send real-time update and email
    if (oldStatus && oldStatus !== complaint.status) {
      sendRealTimeUpdate(complaint.user.toString(), {
        type: 'status_update',
        complaintId: complaint._id,
        oldStatus: oldStatus,
        newStatus: complaint.status,
        message: `Your complaint status has been updated from "${oldStatus}" to "${complaint.status}"`
      });
      const user = await User.findById(complaint.user).select('email firstName');
      if (user) {
        const { subject, html } = complaintStatusTemplate({
          firstName: user.firstName,
          complaintId: complaint._id,
          oldStatus,
          newStatus: complaint.status
        });
        try { await sendEmail({ to: user.email, subject, html }); } catch (e) { console.warn('Status email failed:', e.message); }
      }
    }
    // If feedback was added/updated, send real-time update and email
    if (req.body.feedback && req.body.feedback !== oldFeedback) {
      sendRealTimeUpdate(complaint.user.toString(), {
        type: 'feedback_update',
        complaintId: complaint._id,
        feedback: req.body.feedback,
        message: 'Admin has added feedback to your complaint'
      });
      const user = await User.findById(complaint.user).select('email firstName');
      if (user) {
        const { subject, html } = complaintFeedbackTemplate({
          firstName: user.firstName,
          complaintId: complaint._id,
          message: req.body.feedback
        });
        try { await sendEmail({ to: user.email, subject, html }); } catch (e) { console.warn('Feedback email failed:', e.message); }
      }
    }
    
    res.json({ complaint });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update complaint', error: err.message });
  }
});

// Threaded feedback entry (admin or user) - requires JWT auth for user; admin identified via isAdmin in token
app.post('/api/complaints/:id/feedback-entry', authenticateJWT, sanitizeBodyFields(['message']), async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message is required' });
    }
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });
    // Only authorise: user who owns complaint OR admin
    const isOwner = complaint.user.toString() === req.user.id;
    const authorType = req.user.isAdmin ? 'admin' : 'user';
    if (!isOwner && authorType !== 'admin') {
      return res.status(403).json({ message: 'Not authorised to post feedback on this complaint' });
    }
    const entry = { authorType, message: message.trim(), createdAt: new Date() };
    complaint.feedbackEntries = complaint.feedbackEntries || [];
    complaint.feedbackEntries.push(entry);
  // Do NOT auto-overwrite legacy single feedback field; keep summary independent of thread entries
    await complaint.save();
    // Real-time notify: always update the owner (so their thread updates live)
    sendRealTimeUpdate(complaint.user.toString(), {
      type: 'feedback_thread_update',
      complaintId: complaint._id,
      entry
    });
    // Additionally notify all admins when the USER posts a new entry so they see/respond quickly
    if (authorType === 'user') {
      try {
        const adminIds = await User.find({ isAdmin: true }).select('_id');
        console.log('[feedback-entry] user post -> broadcasting to admins', { complaintId: complaint._id.toString(), adminCount: adminIds.length });
        adminIds.forEach(a => {
          // Avoid duplicate notify if somehow user is also admin (edge case)
          if (a._id.toString() === complaint.user.toString()) return;
          sendRealTimeUpdate(a._id.toString(), {
            type: 'feedback_thread_update',
            complaintId: complaint._id,
            entry
          });
        });
        try {
          bus.emit('user_feedback_entry', { complaintId: complaint._id.toString(), entryMessage: entry.message });
          console.log('[feedback-entry] emitted user_feedback_entry', { complaintId: complaint._id.toString(), preview: entry.message.slice(0,60) });
        } catch (e2) { console.warn('Emit user_feedback_entry failed:', e2.message); }
      } catch (e) {
        console.warn('Failed to broadcast feedback thread update to admins:', e.message);
      }
    }
    // Always email user when an ADMIN posts a feedback entry
    if (authorType === 'admin') {
      try {
        const user = await User.findById(complaint.user).select('email firstName');
        if (user && user.email) {
          const { subject, html } = complaintFeedbackTemplate({
            firstName: user.firstName,
            complaintId: complaint._id,
            message: entry.message
          });
          await sendEmail({ to: user.email, subject, html });
        }
      } catch (e) {
        console.warn('Email (feedback-entry) failed:', e.message);
      }
    }
    res.json({ success: true, complaint });
  } catch (err) {
    console.error('Add feedback entry error:', err);
    res.status(500).json({ message: 'Failed to add feedback entry', error: err.message });
  }
});

// Delete a complaint (owner or admin)
app.delete('/api/complaints/:id', authenticateJWT, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ message: 'Complaint not found' });
    }
    const isOwner = complaint.user && complaint.user.toString() === req.user.id;
    if (!isOwner && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized to delete this complaint' });
    }
    // If owner deletes: soft delete only (keep for admin history)
    if (isOwner && !req.user.isAdmin) {
      if (complaint.isDeletedByUser) {
        return res.json({ success: true, softDeleted: true, message: 'Complaint already removed from user view' });
      }
      complaint.isDeletedByUser = true;
      complaint.deletedAt = new Date();
      await complaint.save();
      return res.json({ success: true, softDeleted: true });
    }

    // Admin deletion: hard delete including Cloudinary assets
    // Normalize evidence list to objects with url + publicId
    const evidenceItems = Array.isArray(complaint.evidence) ? complaint.evidence : [];
    const toDelete = [];
    evidenceItems.forEach(item => {
      if (!item) return;
      let url = null; let publicId = null;
      if (typeof item === 'string') {
        url = item;
      } else if (item.url) {
        url = item.url;
        if (item.publicId) publicId = item.publicId;
      }
      if (!publicId && url) {
        publicId = extractFullPublicId(url);
      }
      if (publicId && !publicId.includes('/') && url) {
        if (url.includes('/sumbong/complaints/')) publicId = 'sumbong/complaints/' + publicId;
        else if (url.includes('/sumbong/profile_pictures/')) publicId = 'sumbong/profile_pictures/' + publicId;
      }
      if (publicId) {
        const lower = (url || '').toLowerCase();
        const isVideo = /(mp4|webm|ogg|mov|avi|mkv)$/i.test(lower);
        toDelete.push({ publicId, resource_type: isVideo ? 'video' : 'image' });
      }
    });

    const deletionResults = [];
    for (const asset of toDelete) {
      try {
        const resp = await cloudinary.uploader.destroy(asset.publicId, { resource_type: asset.resource_type });
        if (resp && (resp.result === 'ok' || resp.result === 'not found')) {
          deletionResults.push({ publicId: asset.publicId, status: resp.result });
        } else {
          deletionResults.push({ publicId: asset.publicId, status: 'unexpected', response: resp });
        }
      } catch (e) {
        deletionResults.push({ publicId: asset.publicId, status: 'failed', error: e.message });
      }
    }

    await Complaint.findByIdAndDelete(req.params.id);

    res.json({ success: true, hardDeleted: true, deletedAssets: deletionResults, attempted: deletionResults.length });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete complaint', error: err.message });
  }
});

// Admin: list complaints soft-deleted by users (Complaint History)
app.get('/api/admin/complaints/history', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const complaints = await Complaint.find({ isDeletedByUser: true }).populate('user', 'firstName lastName email').sort({ deletedAt: -1, createdAt: -1 });
    const mapped = complaints.map(c => ({
      ...c.toObject(),
      fullName: c.user ? `${c.user.firstName} ${c.user.lastName}` : (c.fullName || 'Anonymous'),
      contact: c.user ? c.user.email : (c.contact || 'N/A')
    }));
    res.json({ complaints: mapped });
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch complaint history', error: e.message });
  }
});

// Get all complaints (admin view, with user info)
app.get('/api/complaints', authenticateJWT, requireAdmin, async (req, res) => {
  const includeDeleted = ['1','true','yes'].includes(String(req.query.includeDeleted||'').toLowerCase());
  const filter = includeDeleted ? {} : { isDeletedByUser: { $ne: true } };
  const complaints = await Complaint.find(filter).populate('user', 'firstName lastName email').sort({ createdAt: -1 });
  // Add user info to each complaint
  const complaintsWithUser = complaints.map(c => ({
    ...c.toObject(),
    fullName: c.user ? `${c.user.firstName} ${c.user.lastName}` : 'Anonymous',
    contact: c.user ? c.user.email : 'N/A',
  }));
  res.json({ complaints: complaintsWithUser });
});

// Admin endpoint to update complaint status (legacy feedback removed; feedback text becomes a thread entry)
app.patch('/api/complaints/:id/status', authenticateJWT, requireAdmin, sanitizeBodyFields(['feedback']), async (req, res) => {
  try {
    const { status, feedback } = req.body;
    if (!['pending', 'in progress', 'solved'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ message: 'Complaint not found' });
    const oldStatus = complaint.status;
    complaint.status = status;
    // Convert provided feedback into a thread entry instead of touching complaint.feedback (deprecated)
    if (feedback && feedback.trim()) {
      complaint.feedbackEntries = complaint.feedbackEntries || [];
      complaint.feedbackEntries.push({ authorType: 'admin', message: feedback.trim(), createdAt: new Date() });
    }
    await complaint.save();
    if (oldStatus !== status) {
      sendRealTimeUpdate(complaint.user.toString(), {
        type: 'status_update',
        complaintId: complaint._id,
        oldStatus,
        newStatus: status,
        message: `Your complaint status has been updated from "${oldStatus}" to "${status}"`
      });
      try {
        const user = await User.findById(complaint.user).select('email firstName');
        if (user && user.email) {
          const { subject, html } = complaintStatusTemplate({
            firstName: user.firstName,
            complaintId: complaint._id,
            oldStatus,
            newStatus: status
          });
          await sendEmail({ to: user.email, subject, html });
        }
      } catch (e) { console.warn('Email (status change) failed:', e.message); }
    }
    if (feedback && feedback.trim()) {
      const entry = complaint.feedbackEntries[complaint.feedbackEntries.length - 1];
      sendRealTimeUpdate(complaint.user.toString(), {
        type: 'feedback_thread_update',
        complaintId: complaint._id,
        entry
      });
      try {
        const user = await User.findById(complaint.user).select('email firstName');
        if (user && user.email) {
          const { subject, html } = complaintFeedbackTemplate({
            firstName: user.firstName,
            complaintId: complaint._id,
            message: entry.message
          });
          await sendEmail({ to: user.email, subject, html });
        }
      } catch (e) { console.warn('Email (status feedback) failed:', e.message); }
    }
    res.json({ complaint });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update complaint status', error: err.message });
  }
});

// Admin endpoint to approve user credentials
app.patch('/api/admin/approve-credentials/:userId', authenticateJWT, requireAdmin, async (req, res) => {
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
    
    // Email notification
    try {
      const { subject, html } = credentialApprovedTemplate({ firstName: user.firstName });
      await sendEmail({ to: user.email, subject, html });
    } catch (e) { console.warn('Email (credential approved) failed:', e.message); }

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
app.patch('/api/admin/reject-credentials/:userId', authenticateJWT, requireAdmin, async (req, res) => {
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
    try {
      const { subject, html } = credentialRejectedTemplate({
        firstName: user.firstName,
        issueDetails,
        adminNotes,
        requiredActions
      });
      await sendEmail({ to: user.email, subject, html });
    } catch (e) { console.warn('Email (credential rejected) failed:', e.message); }
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
app.get('/api/admin/verification-history', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({
      isAdmin: { $ne: true }, // exclude admin accounts from verification history
      $or: [
        { verificationStatus: { $exists: true } },
        { adminNotes: { $exists: true } },
        { issueDetails: { $exists: true } }
      ]
    }).select('firstName lastName email verificationStatus verificationDate adminNotes issueDetails requiredActions rejectionCount approved createdAt isAdmin');
    
    res.json({ 
      success: true, 
      verificationHistory: users 
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch verification history', error: err.message });
  }
});

// Admin endpoint to request credential resubmission
app.patch('/api/admin/request-resubmission/:userId', authenticateJWT, requireAdmin, async (req, res) => {
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
    try {
      const { subject, html } = credentialResubmissionTemplate({
        firstName: user.firstName,
        reason,
        deadline: update.resubmissionDeadline
      });
      await sendEmail({ to: user.email, subject, html });
    } catch (e) { console.warn('Email (credential resubmission) failed:', e.message); }
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

// Upload user credential images (max 5) -> Cloudinary folder per user
app.post('/api/user/credentials', authenticateJWT, credentialUploadMemory.array('credentials', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No credential files uploaded' });
    }
    const user = await User.findById(req.user.id).select('credentials');
    if (!user) return res.status(404).json({ message: 'User not found' });
  const folder = `sumbong/credentials/${req.user.id}`;
    const uploaded = [];
    for (const f of req.files) {
      const b64 = `data:${f.mimetype};base64,${f.buffer.toString('base64')}`;
      const up = await cloudinary.uploader.upload(b64, {
        folder,
        resource_type: 'image',
        use_filename: true,
        unique_filename: true,
        overwrite: false
      });
      uploaded.push({ url: up.secure_url, publicId: up.public_id, uploadedAt: new Date() });
    }
    user.credentials = user.credentials.concat(uploaded);
    await user.save();
    res.json({ success: true, credentials: user.credentials });
  } catch (e) {
    console.error('Credential upload error:', e);
    res.status(500).json({ message: 'Failed to upload credentials', error: e.message });
  }
});

// Delete a single credential by publicId
app.delete('/api/user/credentials/:publicId', authenticateJWT, async (req, res) => {
  try {
    const encoded = req.params.publicId;
    const decoded = decodeURIComponent(encoded);
    const user = await User.findById(req.user.id).select('credentials');
    if (!user) return res.status(404).json({ message: 'User not found' });
    const match = user.credentials.find(c => (c.publicId === decoded) || extractCloudinaryPublicId(c.url) === decoded);
    if (!match) return res.status(404).json({ message: 'Credential not found' });
    await deleteCloudinaryPublicIds([match.publicId || extractCloudinaryPublicId(match.url)]);
    user.credentials = user.credentials.filter(c => c !== match);
    await user.save();
    res.json({ success: true, credentials: user.credentials });
  } catch (e) {
    console.error('Credential delete error:', e);
    res.status(500).json({ message: 'Failed to delete credential', error: e.message });
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
      console.log('[SSE push]', { userId, type: data.type });
      client.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      console.error('Error sending real-time update:', error);
      connectedClients.delete(userId);
    }
  }
};

// Helper: create notifications for all admins
async function notifyAdmins(payloadBuilder) {
  try {
    const admins = await User.find({ isAdmin: true }).select('_id');
    if (!admins.length) return;
    const notifications = [];
    for (const a of admins) {
      const nPayload = payloadBuilder(a._id);
      notifications.push({ ...nPayload, recipient: a._id });
    }
    if (notifications.length) {
      console.log('[notifyAdmins] inserting notifications', notifications.length, notifications[0]?.type);
      const created = await Notification.insertMany(notifications);
      // Broadcast via SSE
      created.forEach(n => {
        sendRealTimeUpdate(n.recipient.toString(), { type: 'admin_notification', notification: n });
      });
      console.log('[notifyAdmins] broadcast complete');
    }
  } catch (e) {
    console.warn('notifyAdmins failed:', e.message);
  }
}

// Event subscriptions
bus.on('new_user', async ({ userId }) => {
  try {
    const user = await User.findById(userId).select('firstName lastName email');
    if (!user) return;
    await notifyAdmins(() => ({
      type: 'new_user',
      entityType: 'user',
      entityId: user._id,
      message: `New user registered: ${user.firstName} ${user.lastName}`,
      meta: { email: user.email }
    }));
  } catch (e) { console.warn('new_user handler failed:', e.message); }
});

bus.on('new_complaint', async ({ complaintId }) => {
  try {
    const c = await Complaint.findById(complaintId).populate('user','firstName lastName');
    if (!c) return;
    await notifyAdmins(() => {
      const actorFirst = c.user?.firstName || '';
      const actorLast = c.user?.lastName || '';
      const fullName = (actorFirst + ' ' + actorLast).trim() || 'Unknown User';
      return {
        type: 'new_complaint',
        entityType: 'complaint',
        entityId: c._id,
        message: `New complaint submitted by ${fullName}`,
        meta: { status: c.status, type: c.type, actorFirst, actorLast, actorFullName: fullName }
      };
    });
  } catch (e) { console.warn('new_complaint handler failed:', e.message); }
});

bus.on('user_feedback_entry', async ({ complaintId, entryMessage }) => {
  try {
    console.log('[bus] user_feedback_entry received', { complaintId, preview: (entryMessage||'').slice(0,60) });
    const c = await Complaint.findById(complaintId).populate('user','firstName lastName');
    if (!c) return;
    await notifyAdmins(() => {
      const actorFirst = c.user?.firstName || '';
      const actorLast = c.user?.lastName || '';
      const fullName = (actorFirst + ' ' + actorLast).trim() || 'User';
      return {
        type: 'user_feedback',
        entityType: 'complaint',
        entityId: c._id,
        message: `${fullName} replied on complaint ${c._id}`,
        meta: { preview: entryMessage.slice(0,180), actorFirst, actorLast, actorFullName: fullName }
      };
    });
    console.log('[bus] user_feedback_entry processed -> notifications created');
  } catch (e) { console.warn('user_feedback_entry handler failed:', e.message); }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// --- Policy Endpoints (simple file serving) ---
const policyBase = path.join(__dirname, 'policies');
app.get('/api/policies/:name', (req,res) => {
  const name = req.params.name;
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) return res.status(400).json({ message: 'Invalid policy name'});
  const file = path.join(policyBase, `${name}.md`);
  fs.readFile(file,'utf8',(err,data)=>{
    if (err) return res.status(404).json({ message: 'Policy not found'});
    res.type('text/markdown').send(data);
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Delete current profile picture
app.delete('/api/user/profile-picture', authenticateJWT, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('profilePicture profilePicturePublicId');
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.profilePicturePublicId) {
      try {
        const { v2: cloudinary } = require('cloudinary');
        await cloudinary.uploader.destroy(user.profilePicturePublicId, { resource_type: 'image' });
      } catch (e) {
        console.warn('Cloudinary destroy (remove profile) failed:', e.message);
      }
    }
    user.profilePicture = null;
    user.profilePicturePublicId = null;
    await user.save();
    res.json({ user: buildUserResponse(user), message: 'Profile picture removed' });
  } catch (err) {
    console.error('Remove profile picture error:', err);
    res.status(500).json({ message: 'Failed to remove profile picture', error: err.message });
  }
});

// --- Admin Notifications Endpoints ---
// List notifications (supports query ?unread=1 & ?limit=50)
app.get('/api/admin/notifications', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const filter = { recipient: req.user.id };
    if (['1','true','yes'].includes(String(req.query.unread||'').toLowerCase())) filter.read = false;
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const notifications = await Notification.find(filter).sort({ createdAt: -1 }).limit(limit);
    res.json({ notifications });
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch notifications', error: e.message });
  }
});
// Fallback without /api prefix (deployed path variance safeguard)
// (Early fallback mount) Admin notifications (non /api) for hosting environments that strip /api
app.get('/admin/notifications', authenticateJWT, requireAdmin, async (req, res) => {
  console.log('[HTTP] GET /admin/notifications (fallback)');
  try {
    const filter = { recipient: req.user.id };
    if (['1','true','yes'].includes(String(req.query.unread||'').toLowerCase())) filter.read = false;
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const notifications = await Notification.find(filter).sort({ createdAt: -1 }).limit(limit);
    res.json({ notifications, fallback: true });
  } catch (e) {
    res.status(500).json({ message: 'Failed to fetch notifications', error: e.message });
  }
});

// Diagnostic: force-create a test notification for current admin (remove in production)
app.post('/admin/notifications/test', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const n = await Notification.create({
      recipient: req.user.id,
      type: 'diagnostic',
      entityType: 'system',
      entityId: req.user.id,
      message: 'Test notification ' + new Date().toISOString(),
      meta: { source: 'diagnostic-endpoint' }
    });
    // SSE push
    sendRealTimeUpdate(req.user.id, { type: 'admin_notification', notification: n });
    res.json({ created: n });
  } catch (e) {
    res.status(500).json({ message: 'Failed to create test notification', error: e.message });
  }
});

// Mark single notification as read
app.patch('/api/admin/notifications/:id/read', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const notif = await Notification.findOneAndUpdate({ _id: req.params.id, recipient: req.user.id }, { read: true }, { new: true });
    if (!notif) return res.status(404).json({ message: 'Notification not found' });
    res.json({ notification: notif });
  } catch (e) {
    res.status(500).json({ message: 'Failed to mark notification read', error: e.message });
  }
});
app.patch('/admin/notifications/:id/read', authenticateJWT, requireAdmin, async (req, res) => {
  console.log('[HTTP] PATCH /admin/notifications/:id/read (fallback)', req.params.id);
  try {
    const notif = await Notification.findOneAndUpdate({ _id: req.params.id, recipient: req.user.id }, { read: true }, { new: true });
    if (!notif) return res.status(404).json({ message: 'Notification not found' });
    res.json({ notification: notif, fallback: true });
  } catch (e) {
    res.status(500).json({ message: 'Failed to mark notification read', error: e.message });
  }
});

// Mark all notifications as read
app.patch('/api/admin/notifications/read-all', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.user.id, read: false }, { $set: { read: true } });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: 'Failed to mark all notifications read', error: e.message });
  }
});
app.patch('/admin/notifications/read-all', authenticateJWT, requireAdmin, async (req, res) => {
  console.log('[HTTP] PATCH /admin/notifications/read-all (fallback)');
  try {
    await Notification.updateMany({ recipient: req.user.id, read: false }, { $set: { read: true } });
    res.json({ success: true, fallback: true });
  } catch (e) {
    res.status(500).json({ message: 'Failed to mark all notifications read', error: e.message });
  }
});

// Delete a single notification
app.delete('/api/admin/notifications/:id', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const deleted = await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user.id });
    if (!deleted) return res.status(404).json({ message: 'Notification not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: 'Failed to delete notification', error: e.message });
  }
});
app.delete('/admin/notifications/:id', authenticateJWT, requireAdmin, async (req, res) => {
  console.log('[HTTP] DELETE /admin/notifications/:id (fallback)', req.params.id);
  try {
    const deleted = await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user.id });
    if (!deleted) return res.status(404).json({ message: 'Notification not found' });
    res.json({ success: true, fallback: true });
  } catch (e) {
    res.status(500).json({ message: 'Failed to delete notification', error: e.message });
  }
});

// Clear all notifications for current admin
app.delete('/api/admin/notifications', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    const recipient = req.user.id;
    const before = await Notification.countDocuments({ recipient });
    console.log('[NOTIFICATIONS] Clear all request (API) user=', recipient, 'countBefore=', before);
    const delResult = await Notification.deleteMany({ recipient });
    const after = await Notification.countDocuments({ recipient });
    console.log('[NOTIFICATIONS] Clear all completed (API) user=', recipient, 'deleted=', delResult.deletedCount, 'countAfter=', after);
    res.json({ success: true, deleted: delResult.deletedCount, remaining: after });
  } catch (e) {
    console.error('[NOTIFICATIONS] Clear all failed (API):', e);
    res.status(500).json({ message: 'Failed to clear notifications', error: e.message });
  }
});
app.delete('/admin/notifications', authenticateJWT, requireAdmin, async (req, res) => {
  console.log('[HTTP] DELETE /admin/notifications (fallback)');
  try {
    const recipient = req.user.id;
    const before = await Notification.countDocuments({ recipient });
    console.log('[NOTIFICATIONS] Clear all request (fallback) user=', recipient, 'countBefore=', before);
    const delResult = await Notification.deleteMany({ recipient });
    const after = await Notification.countDocuments({ recipient });
    console.log('[NOTIFICATIONS] Clear all completed (fallback) user=', recipient, 'deleted=', delResult.deletedCount, 'countAfter=', after);
    res.json({ success: true, fallback: true, deleted: delResult.deletedCount, remaining: after });
  } catch (e) {
    console.error('[NOTIFICATIONS] Clear all failed (fallback):', e);
    res.status(500).json({ message: 'Failed to clear notifications', error: e.message });
  }
});

// (Duplicate auth route declarations removed above to prevent stacking handlers.)