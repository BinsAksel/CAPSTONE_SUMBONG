## Cloudinary Integration Guide

This project now uses Cloudinary for all profile pictures and complaint evidence uploads.

### 1. Environment Variables

You can configure Cloudinary via a single URL or discrete variables.

Option A (single URL):
```
CLOUDINARY_URL=cloudinary://<API_KEY>:<API_SECRET>@<CLOUD_NAME>
```

Option B (separate vars):
```
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret
```

All uploads are done over HTTPS (secure: true).

### 2. Folders Used
| Purpose | Cloudinary Folder |
|---------|-------------------|
| Profile Pictures | `sumbong/profile_pictures` |
| Complaint Evidence (images / video / raw) | `sumbong/complaints` |

Resource type is auto‑detected (image / video / raw) during evidence upload.

### 3. Returned Fields
The backend now stores full Cloudinary secure URLs in:
- `user.profilePicture`
- `complaint.evidence[]`

Legacy local paths (`uploads/...`) are still served. The frontend checks if a path starts with `http` before prefixing.

### 4. Thumbnail / Transformation Suggestions (Optional)
You can request a transformed version of an image or video without re-uploading. Insert a transformation segment after `/upload/` in the URL.

Examples:
```
Original: https://res.cloudinary.com/<cloud>/image/upload/v1234567/sumbong/complaints/evidence_abc.png
Thumbnail: https://res.cloudinary.com/<cloud>/image/upload/w_300,h_300,c_fill,q_auto,f_auto/v1234567/sumbong/complaints/evidence_abc.png
Blurred Preview: .../image/upload/w_60,e_blur:200,q_auto,f_auto/.../file.png
Video Poster Frame: append `#t=1s` to video URL in a <video> tag.
```

### 5. Local Legacy File Migration
Old files reside in `backend/uploads/` and database records reference `uploads/<filename>`.

Options:
1. Leave as-is (they continue to work).
2. Run the migration script (see below) to upload each legacy file to Cloudinary, update DB, then optionally delete local file.

### 6. Migration Script (Example Logic)
Create a script like `scripts/migrateUploadsToCloudinary.js`:
```js
// Run with: node scripts/migrateUploadsToCloudinary.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const cloudinary = require('../backend/config/cloudinary');
const User = require('../backend/models/User');
const Complaint = require('../backend/models/Complaint');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const uploadsDir = path.join(__dirname, '..', 'backend', 'uploads');

  // Migrate user profile pictures
  const users = await User.find({ profilePicture: { $exists: true, $ne: null } });
  for (const user of users) {
    if (/^https?:\/\//.test(user.profilePicture)) continue; // already migrated
    const localPath = path.join(uploadsDir, user.profilePicture.replace(/^uploads\//, ''));
    if (!fs.existsSync(localPath)) continue;
    try {
      const res = await cloudinary.uploader.upload(localPath, {
        folder: 'sumbong/profile_pictures',
        public_id: `migrated_profile_${user._id}`,
        overwrite: true
      });
      user.profilePicture = res.secure_url;
      await user.save();
      console.log('Migrated profile:', user._id);
    } catch (e) {
      console.error('Profile migrate failed', user._id, e.message);
    }
  }

  // Migrate complaint evidence
  const complaints = await Complaint.find({ evidence: { $exists: true, $ne: [] } });
  for (const c of complaints) {
    let changed = false;
    const newEvidence = [];
    for (const ev of c.evidence) {
      if (/^https?:\/\//.test(ev)) { newEvidence.push(ev); continue; }
      const localPath = path.join(uploadsDir, ev.replace(/^uploads\//, ''));
      if (!fs.existsSync(localPath)) { newEvidence.push(ev); continue; }
      try {
        const res = await cloudinary.uploader.upload(localPath, {
          folder: 'sumbong/complaints'
        });
        newEvidence.push(res.secure_url);
        changed = true;
      } catch (e) {
        console.error('Evidence migrate failed', c._id, e.message);
        newEvidence.push(ev);
      }
    }
    if (changed) {
      c.evidence = newEvidence;
      await c.save();
      console.log('Migrated complaint:', c._id);
    }
  }

  console.log('Migration complete');
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
```

Important: back up your database before running migration.

### 7. Deleting a File
To delete from Cloudinary later, you need its `public_id`. Currently only URLs are stored; if deletion becomes a feature, persist `public_id` alongside the URL.

Example upload route adjustment:
```js
// After upload: store both
const { secure_url, public_id } = req.file; // via multer-storage-cloudinary meta mapping
```

### 8. Security Notes
- Do not expose API secret client-side.
- For signed transformations or authenticated assets, use backend signing endpoints.

### 9. Troubleshooting
| Symptom | Cause | Fix |
|---------|-------|-----|
| 400 Invalid Signature | Wrong credentials | Re-check .env values |
| Uploaded file shows as RAW | Unsupported MIME or forced resource type | Inspect `file.mimetype` and adjust logic |
| Slow images | Missing transformations / large originals | Add `q_auto,f_auto,w_XXX` transformations |

---
Cloudinary integration complete.