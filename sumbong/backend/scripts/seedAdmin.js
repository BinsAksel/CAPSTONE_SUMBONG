/**
 * Seed an admin user safely with hashed password.
 * Usage (PowerShell from backend folder):
 *   node scripts/seedAdmin.js
 * Make sure MONGO_URI and JWT_SECRET exist in .env.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');

const User = require('../models/User');

async function run() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.DATABASE_URL || process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('No Mongo URI found in env (MONGO_URI / DATABASE_URL / MONGODB_URI).');
      process.exit(1);
    }
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

  const email = 'sumbongadmin@gmail.com';
  const plainPassword = '09073645169';

    let admin = await User.findOne({ email });
    if (admin) {
      if (!admin.isAdmin) {
        admin.isAdmin = true;
      }
      if (!admin.approved) {
        admin.approved = true;
        admin.verificationStatus = 'approved';
      }
  // Force reset password each run (optional) by setting plain text; pre-save hook will hash.
  admin.password = plainPassword; // Will trigger isModified('password') and re-hash once
  await admin.save();
  console.log('Updated existing user to admin (and password reset):', email);
    } else {
      admin = await User.create({
        firstName: 'System',
        lastName: 'Admin',
        email,
  phoneNumber: '+639614299982',
        address: 'Barangay East Tapinac Barangay Hall, Olongapo City',
        password: plainPassword, // pre-save hook will hash
        credentials: [],
        profilePicture: null,
        profilePicturePublicId: null,
        approved: true,
        verificationStatus: 'approved',
        isAdmin: true
      });
      console.log('Created new admin user:', email);
    }

    console.log('Admin _id:', admin._id.toString());
    console.log('Login with email:', email, 'password:', plainPassword);
  } catch (err) {
    console.error('Seed admin error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
