// Real image uploads via Cloudinary. Kept in its own module so tests can substitute a fake
// implementation for the network call itself (this sandbox can't reach api.cloudinary.com any
// more than it could reach api.paystack.co, Resend, Railway, or Postgres directly earlier this
// project -- confirmed, not assumed, the same network restriction hit repeatedly this session)
// while still exercising the real upload-resolution logic in routes/products.js unmodified.

const cloudinary = require("cloudinary").v2;

function requireConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    // Fails loudly rather than silently proceeding with missing config, which would just produce
    // a confusing auth error from Cloudinary instead of a clear error pointing at what's missing.
    throw new Error("Cloudinary isn't configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.");
  }
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
}

// Uploads a real image and returns its real, permanently-hosted URL. Accepts a base64 data URL
// directly -- Cloudinary's own upload API supports this as a source, same as a file path or a
// remote URL -- so the existing client-side resize-then-base64-encode flow already built into the
// admin photo upload forms needs no changes; only what the backend does with that string changes.
async function uploadImage(dataUrl, folder) {
  requireConfig();
  const result = await cloudinary.uploader.upload(dataUrl, {
    folder,
    // Real images get resized client-side before this is ever called, but this is a second, real
    // safety net server-side -- caps the stored asset's largest dimension regardless of what a
    // client actually sent, without upscaling anything genuinely smaller.
    transformation: [{ width: 1600, height: 1600, crop: "limit" }],
  });
  return result.secure_url;
}

// Resolves whatever was submitted as a photo into a real, stable URL. If it's a base64 data URL
// (what a fresh upload from the admin forms actually looks like), uploads it for real and returns
// Cloudinary's hosted URL. Anything else (already a real URL, e.g. unchanged from a previous save,
// or null/undefined) passes through untouched -- avoids re-uploading an image that's already real
// every time an unrelated field on the same product gets edited.
// Real image types only -- previously any data: URL was accepted and forwarded to Cloudinary
// unchecked. Lower severity than a public upload endpoint (this is admin/staff-only, gated by
// requireAuth + requirePermission in routes/products.js and routes/greenBeans.js), but still a
// real, previously-missing check: a compromised or malicious admin session could otherwise submit
// arbitrary file content disguised as a photo upload.
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

async function resolvePhotoUrl(photoUrl, folder) {
  if (!photoUrl || typeof photoUrl !== "string") return photoUrl;
  if (!photoUrl.startsWith("data:")) return photoUrl;
  const mimeMatch = photoUrl.match(/^data:([^;]+);/);
  if (!mimeMatch || !ALLOWED_IMAGE_TYPES.includes(mimeMatch[1])) {
    throw new Error(`Unsupported image type. Please use JPEG, PNG, WebP, or GIF.`);
  }
  return uploadImage(photoUrl, folder);
}

module.exports = { uploadImage, resolvePhotoUrl };
