/*
 * Migration Script: Local uploads -> Cloudinary
 * Usage:
 *   1. Ensure .env has Mongo + Cloudinary credentials.
 *   2. From backend directory run:  node scripts/migrateUploadsToCloudinary.js
 *      (or after adding npm script: npm run migrate:uploads)
 *   3. ALWAYS backup your database before running.
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const cloudinary = require('../config/cloudinary');
const User = require('../models/User');
const Complaint = require('../models/Complaint');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

function exists(p) { return fs.existsSync(p); }
function isHttp(url) { return /^https?:\/\//i.test(url || ''); }

async function migrateUserProfilePictures() {
  const users = await User.find({ profilePicture: { $exists: true, $ne: null } });
  let migrated = 0, skipped = 0, missing = 0;
  for (const u of users) {
    const pic = u.profilePicture;
    if (!pic) { skipped++; continue; }
    if (isHttp(pic)) { skipped++; continue; }
    const localRel = pic.replace(/^uploads\//, '');
    const localPath = path.join(UPLOADS_DIR, localRel);
    if (!exists(localPath)) { missing++; continue; }
    try {
      const res = await cloudinary.uploader.upload(localPath, {
        folder: 'sumbong/profile_pictures',
        public_id: `migrated_profile_${u._id}`,
        overwrite: true
      });
      u.profilePicture = res.secure_url;
      await u.save();
      migrated++;
      console.log('[USER] Migrated', u._id.toString());
    } catch (e) {
      console.error('[USER] Failed', u._id.toString(), e.message);
    }
  }
  return { migrated, skipped, missing };
}

async function migrateComplaintEvidence() {
  const complaints = await Complaint.find({ evidence: { $exists: true, $ne: [] } });
  let migratedEntries = 0, complaintsUpdated = 0;
  for (const c of complaints) {
    let changed = false;
    const newEvidence = [];
    for (const ev of c.evidence) {
      if (isHttp(ev)) { newEvidence.push(ev); continue; }
      const localRel = ev.replace(/^uploads\//, '');
      const localPath = path.join(UPLOADS_DIR, localRel);
      if (!exists(localPath)) { newEvidence.push(ev); continue; }
      try {
        const res = await cloudinary.uploader.upload(localPath, {
          folder: 'sumbong/complaints'
        });
        newEvidence.push(res.secure_url);
        migratedEntries++;
        changed = true;
        console.log('[COMPLAINT] Migrated evidence for', c._id.toString());
      } catch (e) {
        console.error('[COMPLAINT] Failed evidence', c._id.toString(), e.message);
        newEvidence.push(ev); // keep old reference
      }
    }
    if (changed) {
      c.evidence = newEvidence;
      await c.save();
      complaintsUpdated++;
    }
  }
  return { migratedEntries, complaintsUpdated };
}

async function main() {
  const start = Date.now();
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    // Extra debug to help diagnose environment loading issues
    console.error('Missing MONGODB_URI (preferred) or MONGO_URI in .env');
    console.error('[DEBUG] Current working directory:', process.cwd());
    console.error('[DEBUG] __dirname:', __dirname);
    console.error('[DEBUG] .env attempt (showing keys only):', Object.keys(process.env).filter(k => /(MONGO|CLOUDINARY|PORT|NODE_ENV)/i.test(k)).sort());
    console.error('Add one of the following to your .env file, e.g.');
    console.error('  MONGODB_URI=mongodb://localhost:27017/sumbong');
    console.error('or for Atlas:');
    console.error('  MONGODB_URI=mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/sumbong');
    console.error('If MONGODB_URI is present but still not detected, ensure you are running the script from the backend folder and that the file name is exactly ".env"');
    process.exit(1);
  }
  console.log('Connecting to Mongo using URI:', mongoUri.replace(/:[^:@/]+@/,'://****@'));
  await mongoose.connect(mongoUri);
  console.log('Connected. Starting migration.');

  const profileRes = await migrateUserProfilePictures();
  const complaintRes = await migrateComplaintEvidence();

  console.log('--- Migration Summary ---');
  console.log('User profile pictures migrated:', profileRes.migrated);
  console.log('User profile pictures skipped (already URL):', profileRes.skipped);
  console.log('User profile pictures missing local file:', profileRes.missing);
  console.log('Complaint evidence migrated entries:', complaintRes.migratedEntries);
  console.log('Complaints updated:', complaintRes.complaintsUpdated);
  console.log('Elapsed ms:', Date.now() - start);

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch(e => { console.error('Migration run failed:', e); process.exit(1); });
