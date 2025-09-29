const { v2: cloudinary } = require('cloudinary');
require('dotenv').config();

/*
You can either define a single CLOUDINARY_URL in .env like:
  CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
Or define them separately:
  CLOUDINARY_CLOUD_NAME=xxx
  CLOUDINARY_API_KEY=xxx
  CLOUDINARY_API_SECRET=xxx
*/

if (process.env.CLOUDINARY_URL) {
  // url-based config is auto-read by the SDK, call config() with no args
  cloudinary.config();
  if (!/cloudinary:\/\//.test(process.env.CLOUDINARY_URL)) {
    console.warn('[Cloudinary] CLOUDINARY_URL set but format looks unusual.');
  }
} else {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true
  });
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    console.warn('[Cloudinary] Missing one or more credentials:', {
      hasName: !!CLOUDINARY_CLOUD_NAME,
      hasKey: !!CLOUDINARY_API_KEY,
      hasSecret: !!CLOUDINARY_API_SECRET
    });
  }
}

// Helper: quick sanity output (masked key) once per boot
try {
  const maskedKey = process.env.CLOUDINARY_API_KEY ? process.env.CLOUDINARY_API_KEY.replace(/.(?=.{4})/g,'*') : 'NONE';
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[Cloudinary] Configured for cloud: ${process.env.CLOUDINARY_CLOUD_NAME || '(via URL or missing)'} key: ${maskedKey}`);
  }
} catch {}

module.exports = cloudinary;
