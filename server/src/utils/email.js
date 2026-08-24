// Real email content and real sending via Resend, once configured (see .env.example for
// RESEND_API_KEY). Every function here does the same honest thing: builds the real subject/body,
// and either sends it for real or logs it server-side outside production -- so the actual call
// site stays genuinely testable end-to-end even without a configured provider, rather than
// silently pretending an email went out or hard-failing local development.

const { Resend } = require("resend");

// Uses the real, deployed frontend URL already configured for CORS (FRONTEND_URL) rather than a
// hardcoded domain -- there's no real morningaroma.com yet (confirmed with the project owner), so
// hardcoding it would have put broken links, or worse a domain someone else might own, into every
// email sent. Falls back to the Railway URL format only if FRONTEND_URL genuinely isn't set,
// which shouldn't happen in a working deployment (CORS wouldn't work either in that case).
const SITE_URL = process.env.FRONTEND_URL || "https://morning-aroma-app-production.up.railway.app";

// Resend requires a verified domain to send to arbitrary recipients -- without one, the only
// working sender is onboarding@resend.dev, and even that can only deliver to the Resend account's
// own registered email, not real customers (confirmed against Resend's current docs, not assumed).
// Switch this to a real address on a verified domain once one exists.
const FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || "Morning Aroma <onboarding@resend.dev>";

function logInDevOnly(label, to, subject, body) {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[dev only] ${label} to ${to} — Subject: "${subject}"\n${body}`);
  }
}

async function sendEmail(label, to, subject, body) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // No provider configured -- fall back to a dev-mode log rather than fail outright, so local
    // development and the test suite don't require a real Resend account to run at all.
    logInDevOnly(label, to, subject, body);
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY is not set. Add it to this service's environment variables.");
    }
    return;
  }
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({ from: FROM_ADDRESS, to, subject, text: body });
  if (error) throw new Error(error.message || "Failed to send email via Resend.");
}

async function sendWelcomeEmail(user) {
  const subject = "Welcome to Morning Aroma — where quality meets its scent.";
  const body = `Hi ${user.name},

Thank you for creating an account with Morning Aroma. We're genuinely glad you're here.

A few things worth knowing:
- Browse the full catalog by variety, origin, or how it fits your day: ${SITE_URL}/#/shop
- Every bag we sell publishes exactly what we paid the farmer for it — see the Source Library if
  you're curious where your coffee's money actually goes.
- Your Aroma Journey (${SITE_URL}/#/journey) keeps a running log of what you've tried
  and liked, and gets sharper with each review you leave.

If anything's ever wrong with an order, just reply to this email or reach us through the site's
contact page — a real person reads it.

Warmly,
The Morning Aroma team`;
  await sendEmail("Welcome email", user.email, subject, body);
}

async function sendPasswordResetEmail(email, resetToken) {
  const subject = "Reset your Morning Aroma password";
  const resetUrl = `${SITE_URL}/#/reset-password?token=${resetToken}`;
  const body = `We received a request to reset the password on your Morning Aroma account.

Reset it here: ${resetUrl}

This link expires in 30 minutes. If you didn't request this, you can safely ignore this email —
your password hasn't been changed.`;
  await sendEmail("Password reset email", email, subject, body);
}

module.exports = { sendWelcomeEmail, sendPasswordResetEmail };
