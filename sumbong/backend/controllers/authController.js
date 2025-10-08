// @desc    Register a new user via Google OAuth (no password required)
// @route   POST /api/auth/google-signup
// @access  Public
const googleSignup = async (req, res) => {
  try {
    const { firstName, lastName, email, phoneNumber, address, acceptedTerms, acceptedPrivacy, policiesVersion, password } = req.body;
    // Validate required fields
    if (!firstName || !lastName || !email || !phoneNumber || !address) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }
    // Password (user may set during complete profile). If not provided yet, force it.
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }
    const strongPw = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!strongPw.test(password)) {
      return res.status(400).json({ success: false, message: 'Weak password. Must be 8+ chars with upper, lower, number & special.' });
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
    // Use provided password (User pre-save hook will hash it)
    const user = await User.create({
      firstName,
      lastName,
      email,
      phoneNumber,
      address,
      password,
      credentials: credentialObjs,
      profilePicture: req.body.profilePicture || null,
      approved: false,
      acceptedTerms: true,
      acceptedPrivacy: true,
      policiesVersion: policiesVersion || '1.0.0',
      acceptedPoliciesAt: new Date()
    });
    if (user) {
      // Generate & send email verification token (Google signup also must verify email)
      try {
        const rawToken = user.createEmailVerificationToken(parseInt(process.env.EMAIL_VERIFY_TOKEN_EXP_MINUTES||'30',10));
        await user.save({ validateBeforeSave:false });
  const FRONTEND = (process.env.FRONTEND_ORIGIN || 'https://sumbong.vercel.app').replace(/\/$/, '');
        const verifyUrl = `${FRONTEND}/verify-email?token=${rawToken}`;
        const { subject, html } = emailVerificationTemplate({ firstName: user.firstName, verifyUrl, minutes: parseInt(process.env.EMAIL_VERIFY_TOKEN_EXP_MINUTES||'30',10) });
        await sendPasswordSecurityEmail(user.email, subject, html);
      } catch (e) { console.warn('Email verification send failed (googleSignup):', e.message); }
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
const crypto = require('crypto');
const { passwordResetTemplate, passwordChangedTemplate, emailVerificationTemplate, emailVerifiedConfirmationTemplate, passwordChangeRequestTemplate } = require('../utils/emailTemplates');

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
        const strongPw = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
        if (!strongPw.test(password)) {
          return res.status(400).json({ success:false, message:'Weak password. Must include upper, lower, number, special; min 8 chars.' });
        }
        // Send email verification
        try {
          const rawToken = user.createEmailVerificationToken(parseInt(process.env.EMAIL_VERIFY_TOKEN_EXP_MINUTES||'30',10));
          await user.save({ validateBeforeSave:false });
          const FRONTEND = (process.env.FRONTEND_ORIGIN || 'https://sumbong.vercel.app').replace(/\/$/, '');
          const verifyUrl = `${FRONTEND}/verify-email?token=${rawToken}`;
          const { subject, html } = emailVerificationTemplate({ firstName: user.firstName, verifyUrl, minutes: parseInt(process.env.EMAIL_VERIFY_TOKEN_EXP_MINUTES||'30',10) });
          await sendPasswordSecurityEmail(user.email, subject, html);
        } catch (e) { console.warn('Email verification send failed (signup):', e.message); }
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
    // Prevent admin accounts from logging in via user route
    if (user.isAdmin) {
      return res.status(403).json({
        success: false,
        code: 'ADMIN_USE_ADMIN_LOGIN',
        message: 'Admin accounts must sign in via the Admin login.'
      });
    }
    // Enforce email verification before approval
    if (!user.emailVerified) {
      return res.status(403).json({ success:false, code:'EMAIL_NOT_VERIFIED', message:'Please verify your email. A verification link was sent.' });
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

async function sendPasswordSecurityEmail(to, subject, html) {
  try { await require('../utils/sendEmail')({ to, subject, html }); } catch (e) { console.warn('Password email send failed:', e.message); }
}


const forgotPassword = async (req,res) => {
  try {
    const { email } = req.body;
    const genericMsg = { success:true, message: 'If that email exists, password reset instructions were sent.' };
    if (!email) return res.json(genericMsg);
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.json(genericMsg);
    const token = user.createPasswordResetToken(parseInt(process.env.RESET_TOKEN_EXPIRY_MINUTES||'15',10));
    await user.save({ validateBeforeSave: false });
    const FRONTEND = (process.env.FRONTEND_ORIGIN || 'https://sumbong.vercel.app').replace(/\/$/,'')
    const resetUrl = `${FRONTEND}/reset-password?token=${token}`;
    const { subject, html } = passwordResetTemplate({ firstName: user.firstName, resetUrl, minutes: parseInt(process.env.RESET_TOKEN_EXPIRY_MINUTES||'15',10) });
    await sendPasswordSecurityEmail(user.email, subject, html);
    return res.json(genericMsg);
  } catch (e) {
    console.error('forgotPassword error:', e);
    return res.json({ success:true, message: 'If that email exists, password reset instructions were sent.' });
  }
};

const resetPassword = async (req,res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ success:false, message:'Token and new password required' });
    const strongPw = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!strongPw.test(password)) return res.status(400).json({ success:false, message:'Weak password. Include upper, lower, number, special; min 8 chars.' });
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({ passwordResetToken: hashed, passwordResetExpires: { $gt: Date.now() } }).select('+passwordResetToken +passwordResetExpires');
    if (!user) return res.status(400).json({ success:false, message:'Invalid or expired reset token' });
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.passwordChangedAt = new Date();
    await user.save();
    const { subject, html } = passwordChangedTemplate({ firstName: user.firstName, when: new Date().toLocaleString() });
    sendPasswordSecurityEmail(user.email, subject, html);
    res.json({ success:true, message:'Password updated. You can now log in.' });
  } catch (e) {
    console.error('resetPassword error:', e);
    res.status(500).json({ success:false, message:'Failed to reset password' });
  }
};

const changePassword = async (req,res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ success:false, message:'Current and new password required' });
    const user = await User.findById(req.user.id).select('+password');
    if (!user) return res.status(404).json({ success:false, message:'User not found' });
    const match = await user.matchPassword(currentPassword);
    if (!match) return res.status(401).json({ success:false, message:'Current password incorrect' });
    const strongPw = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!strongPw.test(newPassword)) return res.status(400).json({ success:false, message:'Weak new password.' });
    user.password = newPassword;
    user.passwordChangedAt = new Date();
    await user.save();
    const { subject, html } = passwordChangedTemplate({ firstName: user.firstName, when: new Date().toLocaleString() });
    sendPasswordSecurityEmail(user.email, subject, html);
    res.json({ success:true, message:'Password changed successfully' });
  } catch (e) {
    console.error('changePassword error:', e);
    res.status(500).json({ success:false, message:'Failed to change password' });
  }
};

// Authenticated request to send email with confirmation link to change password via token (requires current password)
const requestPasswordChange = async (req,res) => {
  try {
    const { currentPassword } = req.body;
    if (!currentPassword) return res.status(400).json({ success:false, message:'Current password required' });
    const user = await User.findById(req.user.id).select('+password +passwordChangeToken +passwordChangeExpires');
    if (!user) return res.status(404).json({ success:false, message:'User not found' });
    const match = await user.matchPassword(currentPassword);
    if (!match) return res.status(401).json({ success:false, message:'Current password incorrect' });
    const rawToken = user.createPasswordChangeToken(parseInt(process.env.PASSWORD_CHANGE_TOKEN_EXP_MINUTES||'20',10));
    await user.save({ validateBeforeSave:false });
    const FRONTEND = (process.env.FRONTEND_ORIGIN || 'https://capstone-sumbong.vercel.app').replace(/\/$/, '');
    const changeUrl = `${FRONTEND}/change-password?token=${rawToken}`;
    try {
      const { subject, html } = passwordChangeRequestTemplate({ firstName: user.firstName, changeUrl, minutes: parseInt(process.env.PASSWORD_CHANGE_TOKEN_EXP_MINUTES||'20',10) });
      await sendPasswordSecurityEmail(user.email, subject, html);
    } catch (e) { console.warn('Password change request email failed:', e.message); }
    res.json({ success:true, message:'If the password was correct, a confirmation link was sent to your email.' });
  } catch (e) {
    console.error('requestPasswordChange error:', e);
    res.status(500).json({ success:false, message:'Failed to initiate password change' });
  }
};

// Public endpoint (no auth) to actually set new password using passwordChangeToken + require current again optionally? (design: only via token, ask for current + new + confirm on page) but backend must verify token & current.
const confirmPasswordChange = async (req,res) => {
  try {
    const { token, currentPassword, newPassword } = req.body;
    if (!token || !currentPassword || !newPassword) return res.status(400).json({ success:false, message:'Token, current and new password required' });
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({ passwordChangeToken: hashed, passwordChangeExpires: { $gt: Date.now() } }).select('+password +passwordChangeToken +passwordChangeExpires');
    if (!user) return res.status(400).json({ success:false, message:'Invalid or expired link' });
    // Re-verify current password to mitigate email compromise risk
    const match = await user.matchPassword(currentPassword);
    if (!match) return res.status(401).json({ success:false, message:'Current password incorrect' });
    const strongPw = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!strongPw.test(newPassword)) return res.status(400).json({ success:false, message:'Weak new password.' });
    user.password = newPassword;
    user.passwordChangedAt = new Date();
    user.passwordChangeToken = undefined;
    user.passwordChangeExpires = undefined;
    await user.save();
    try {
      const { subject, html } = passwordChangedTemplate({ firstName: user.firstName, when: new Date().toLocaleString() });
      sendPasswordSecurityEmail(user.email, subject, html);
    } catch (e) { console.warn('Password changed email failed:', e.message); }
    res.json({ success:true, message:'Password updated successfully. You can log in with the new password.' });
  } catch (e) {
    console.error('confirmPasswordChange error:', e);
    res.status(500).json({ success:false, message:'Failed to update password' });
  }
};

// Email verification handlers
const verifyEmail = async (req,res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success:false, message:'Token required' });
    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({ emailVerificationToken: hashed, emailVerificationExpires: { $gt: Date.now() } }).select('+emailVerificationToken +emailVerificationExpires');
    if (!user) return res.status(400).json({ success:false, message:'Invalid or expired token' });
    if (user.emailVerified) return res.json({ success:true, alreadyVerified:true, message:'Email already verified.' });
    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave:false });
    try {
      const { subject, html } = emailVerifiedConfirmationTemplate({ firstName: user.firstName });
      await sendPasswordSecurityEmail(user.email, subject, html);
    } catch (e) { console.warn('Verification confirmation email failed:', e.message); }
    return res.json({ success:true, message:'Email verified. Awaiting admin approval.' });
  } catch (e) {
    console.error('verifyEmail error:', e);
    res.status(500).json({ success:false, message:'Verification failed' });
  }
};

const resendVerification = async (req,res) => {
  try {
    const { email } = req.body;
    const generic = { success:true, message:'If that email exists and is unverified, a link was sent.' };
    if (!email) return res.status(200).json(generic);
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+emailVerificationToken +emailVerificationExpires');
    if (!user) return res.status(200).json(generic);
    if (user.emailVerified) return res.status(200).json({ success:true, message:'Email already verified.' });
    const rawToken = user.createEmailVerificationToken(parseInt(process.env.EMAIL_VERIFY_TOKEN_EXP_MINUTES||'30',10));
    await user.save({ validateBeforeSave:false });
    try {
  const FRONTEND = (process.env.FRONTEND_ORIGIN || 'https://sumbong.vercel.app').replace(/\/$/, '');
      const verifyUrl = `${FRONTEND}/verify-email?token=${rawToken}`;
      const { subject, html } = emailVerificationTemplate({ firstName: user.firstName, verifyUrl, minutes: parseInt(process.env.EMAIL_VERIFY_TOKEN_EXP_MINUTES||'30',10) });
      await sendPasswordSecurityEmail(user.email, subject, html);
    } catch (e) { console.warn('Resend verification email failed:', e.message); }
    return res.status(200).json(generic);
  } catch (e) {
    console.error('resendVerification error:', e);
    return res.status(200).json({ success:true, message:'If that email exists and is unverified, a link was sent.' });
  }
};

module.exports = {
  signup,
  login,
  handleUpload,
  googleSignup,
  generateToken,
  adminLogin,
  forgotPassword,
  resetPassword,
  changePassword,
  requestPasswordChange,
  confirmPasswordChange,
  verifyEmail,
  resendVerification
};