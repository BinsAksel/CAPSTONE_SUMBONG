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
} else {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

module.exports = cloudinary;
