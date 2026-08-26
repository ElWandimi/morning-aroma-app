const crypto = require("crypto");
// otplib v13 is a complete rewrite from earlier versions -- no `authenticator` singleton anymore,
// just plain functions. Confirmed directly against the installed version's own README rather than
// assumed from an older API shape, since guessing wrong here would silently produce codes that
// never verify.
const { generateSecret, generate, verify, generateURI } = require("otplib");
const QRCode = require("qrcode");

const ISSUER = "Morning Aroma";
const BACKUP_CODE_COUNT = 8;

function newSecret() {
  return generateSecret();
}

// Returns both the raw otpauth:// URI (for a "can't scan? enter this code manually" fallback,
// which every real authenticator app supports and expects to be offered) and a QR code rendered
// as a data URL, so the frontend can just drop it straight into an <img src> with no client-side
// QR library of its own needed.
async function totpQrCode(email, secret) {
  const uri = generateURI({ issuer: ISSUER, label: email, secret });
  const qrDataUrl = await QRCode.toDataURL(uri);
  return { uri, qrDataUrl };
}

async function verifyTotp(secret, token) {
  if (!secret || typeof token !== "string" || !token.trim()) return false;
  try {
    const result = await verify({ secret, token: token.trim() });
    return result.valid;
  } catch {
    // otplib throws (rather than returning { valid: false }) for a wrong-shaped input -- e.g. a
    // backup code like "7FA31-9C0D2" isn't 6 digits. The caller (routes/auth.js) always tries a
    // TOTP check first, then falls back to checking backup codes if that fails, so any shape
    // mismatch here genuinely does mean "not a valid TOTP code," not a real server error.
    return false;
  }
}

// Human-typeable, grouped for readability (e.g. "7FA31-9C0D2") -- 10 hex characters is a large
// enough space that offline brute-forcing a specific code isn't practical, and online guessing is
// already covered by the same rate limiter every other auth route sits behind.
function generateBackupCodes(count = BACKUP_CODE_COUNT) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(5).toString("hex").toUpperCase();
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5, 10)}`);
  }
  return codes;
}

// Same principle as password-reset tokens (utils/tokens.js): only ever store a hash, never the
// raw code, so a compromised database alone can't be used to bypass 2FA on every account that has
// it enabled. sha256 (not bcrypt) deliberately, matching reset tokens for the same reason: these
// are high-entropy random values being compared for exact equality, not low-entropy passwords
// needing bcrypt's expensive-by-design slowness to resist offline brute-forcing.
function hashBackupCode(raw) {
  return crypto.createHash("sha256").update(raw.trim().toUpperCase()).digest("hex");
}

module.exports = { newSecret, totpQrCode, verifyTotp, generateBackupCodes, hashBackupCode, BACKUP_CODE_COUNT };
