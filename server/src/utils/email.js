// Real email content, staged for the moment a provider actually gets connected (see
// ROADMAP.md Tier 2 -- no decision made yet on Resend/Postmark/SendGrid). Every function here
// does the same honest thing: builds the real subject/body, and either sends it for real (once
// EMAIL_PROVIDER_API_KEY or equivalent exists) or logs it server-side outside production so the
// actual call site stays genuinely testable end-to-end right now, rather than silently pretending
// an email went out. This mirrors the exact pattern already used for password-reset tokens in
// routes/auth.js, pulled into one place now that there's a second email to send.

function logInDevOnly(label, to, subject, body) {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[dev only] ${label} to ${to} — Subject: "${subject}"\n${body}`);
  }
  // TODO(Tier 2 — real email delivery): once a provider is chosen, this is the one place that
  // needs to change -- replace this log with an actual API call (e.g. Resend's
  // `resend.emails.send(...)`), using the same `to`/`subject`/`body` already built below. Every
  // call site in routes/ already calls through here, so nothing else needs touching when that
  // happens.
}

async function sendWelcomeEmail(user) {
  const subject = "Welcome to Morning Aroma — where quality meets its scent.";
  const body = `Hi ${user.name},

Thank you for creating an account with Morning Aroma. We're genuinely glad you're here.

A few things worth knowing:
- Browse the full catalog by variety, origin, or how it fits your day: https://morningaroma.com/#/shop
- Every bag we sell publishes exactly what we paid the farmer for it — see the Source Library if
  you're curious where your coffee's money actually goes.
- Your Aroma Journey (https://morningaroma.com/#/journey) keeps a running log of what you've tried
  and liked, and gets sharper with each review you leave.

If anything's ever wrong with an order, just reply to this email or reach us through the site's
contact page — a real person reads it.

Warmly,
The Morning Aroma team`;
  logInDevOnly("Welcome email", user.email, subject, body);
}

async function sendPasswordResetEmail(email, resetToken) {
  const subject = "Reset your Morning Aroma password";
  const resetUrl = `https://morningaroma.com/#/reset-password?token=${resetToken}`;
  const body = `We received a request to reset the password on your Morning Aroma account.

Reset it here: ${resetUrl}

This link expires in 30 minutes. If you didn't request this, you can safely ignore this email —
your password hasn't been changed.`;
  logInDevOnly("Password reset email", email, subject, body);
}

module.exports = { sendWelcomeEmail, sendPasswordResetEmail };
