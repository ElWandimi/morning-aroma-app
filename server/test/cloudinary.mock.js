// Test-only mock, never shipped or imported by production code. Substitutes for the real
// `cloudinary` package (this sandbox can't reach api.cloudinary.com any more than it could reach
// api.paystack.co, Resend, Railway, or Postgres directly earlier this project) while still
// exercising the real upload-resolution logic in utils/cloudinary.js unmodified.

let nextUploadError = null;
let uploadedImages = [];
let uploadCounter = 0;

function setNextUploadError(message) { nextUploadError = message; }
function clearUploadError() { nextUploadError = null; }
function getUploadedImages() { return uploadedImages; }
function resetUploadedImages() { uploadedImages = []; }

const v2 = {
  config: () => {}, // no-op -- the mock doesn't need real credentials to "work"
  uploader: {
    upload: async (dataUrl, options) => {
      if (nextUploadError) {
        const err = new Error(nextUploadError);
        throw err;
      }
      uploadCounter += 1;
      const record = { dataUrl, options, publicId: `mock-upload-${uploadCounter}` };
      uploadedImages.push(record);
      return {
        secure_url: `https://res.cloudinary.com/mock-cloud/image/upload/${record.publicId}.jpg`,
        public_id: record.publicId,
      };
    },
  },
};

module.exports = { v2, setNextUploadError, clearUploadError, getUploadedImages, resetUploadedImages };
