// Real email content and real sending via Resend, once configured (see .env.example for
// RESEND_API_KEY). Every function here does the same honest thing: builds the real subject/body,
// and either sends it for real or logs it server-side outside production -- so the actual call
// site stays genuinely testable end-to-end even without a configured provider, rather than
// silently pretending an email went out or hard-failing local development.

const { Resend } = require("resend");
const { query } = require("../db");

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

async function sendEmail(label, to, subject, body, html) {
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
  // html is genuinely optional -- every existing call site (password reset, login codes, etc.)
  // still sends plain text only, unchanged. Resend accepts both text and html together (most
  // real email clients prefer html when both are present, falling back to text for clients that
  // can't render HTML at all), so passing text alongside html here is a real, correct safety net,
  // not a leftover.
  const { error } = await resend.emails.send(html ? { from: FROM_ADDRESS, to, subject, text: body, html } : { from: FROM_ADDRESS, to, subject, text: body });
  if (error) throw new Error(error.message || "Failed to send email via Resend.");
}

// Real, minimal, table-based HTML -- deliberately simple (no flexbox/grid, every style inline,
// no external stylesheet) because email clients are notoriously inconsistent about modern CSS;
// tables + inline styles are still the actual, honest baseline that renders correctly nearly
// everywhere (Gmail, Outlook, Apple Mail alike). products is the real, already-resolved list
// this function's own caller builds (name, price, absolute photo URL) -- this function only
// renders, it doesn't query anything itself.
function buildWelcomeEmailHtml(user, products) {
  const productCells = products.map((p) => `
    <td style="padding: 0 8px; width: ${Math.floor(100 / products.length)}%; vertical-align: top;">
      <a href="${SITE_URL}/product/${p.id}" style="text-decoration: none; color: inherit;">
        <img src="${p.photoUrl}" alt="${p.name}" width="160" style="width: 100%; max-width: 160px; height: auto; border-radius: 8px; display: block; margin: 0 auto 10px;" />
        <p style="margin: 0 0 2px; font-size: 14px; font-weight: 600; color: #3E2C23; text-align: center;">${p.name}</p>
        <p style="margin: 0; font-size: 13px; color: #8B5A3A; text-align: center;">$${(p.priceCents / 100).toFixed(2)}</p>
      </a>
    </td>`).join("");

  return `<!DOCTYPE html>
<html>
<body style="margin: 0; padding: 0; background-color: #FDF8F0; font-family: Georgia, 'Times New Roman', serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #FDF8F0; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 12px; overflow: hidden;">
          <tr>
            <td style="padding: 32px 32px 16px; text-align: center;">
              <img src="${SITE_URL}/logo-full.png" alt="Morning Aroma" width="180" style="width: 180px; max-width: 60%; height: auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 0 32px 24px; color: #3E2C23; font-size: 15px; line-height: 1.6;">
              <p>Hi ${user.name},</p>
              <p>Thank you for creating an account with Morning Aroma. We're genuinely glad you're here.</p>
              <p>Every bag we sell publishes exactly what we paid the farmer for it — see the Source Library if you're curious where your coffee's money actually goes. Your Aroma Journey keeps a running log of what you've tried and liked, and gets sharper with each review you leave.</p>
            </td>
          </tr>
          ${products.length > 0 ? `
          <tr>
            <td style="padding: 0 24px 24px;">
              <p style="margin: 0 0 12px; padding: 0 8px; color: #8B5A3A; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em;">A few to start with</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${productCells}</tr></table>
            </td>
          </tr>` : ""}
          <tr>
            <td style="padding: 8px 32px 32px; text-align: center;">
              <a href="${SITE_URL}/shop" style="display: inline-block; background-color: #A8583A; color: #FFF7EC; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 15px; font-weight: 600;">Shop the full catalog</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 32px 32px; color: #8B6A3D; font-size: 13px; line-height: 1.6; border-top: 1px solid #E8D5B5; padding-top: 20px;">
              <p style="margin: 0;">If anything's ever wrong with an order, just reply to this email or reach us through the site's contact page — a real person reads it.</p>
              <p style="margin: 12px 0 0;">Warmly,<br/>The Morning Aroma team</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Real, absolute image URL for a product, mirroring src/utils/helpers.js's getProductPhotoUrl --
// that function is frontend-only (relative paths are fine there, resolved against the page's own
// origin) and this backend has no access to it or to COUNTRY_JOURNEY_PHOTO (a frontend-only data
// map), so this is a genuine, if smaller, backend equivalent: real Cloudinary URLs pass through
// unchanged, the 9 real products with bundled static photos get an explicit absolute URL (a bare
// relative path would render as a broken image in an email, unlike on the site itself), and
// anything else falls back to the site's own real, known-good og-image.jpg rather than link to
// something that might not exist.
const PRODUCTS_WITH_BUNDLED_PHOTOS = [
  "geisha-panama", "laurina-brazil", "sl28-kenya", "pacamara-elsalvador", "bourbon-rwanda",
  "typica-guatemala", "caturra-colombia", "catuai-honduras", "yirgacheffe-ethiopia",
];
function productPhotoUrlForEmail(p) {
  if (p.photo_url) return p.photo_url;
  if (PRODUCTS_WITH_BUNDLED_PHOTOS.includes(p.id)) return `${SITE_URL}/photos/products/${p.id}.png`;
  return `${SITE_URL}/og-image.jpg`;
}

async function sendWelcomeEmail(user) {
  const subject = "Welcome to Morning Aroma — where quality meets its scent.";
  const body = `Hi ${user.name},

Thank you for creating an account with Morning Aroma. We're genuinely glad you're here.

A few things worth knowing:
- Browse the full catalog by variety, origin, or how it fits your day: ${SITE_URL}/shop
- Every bag we sell publishes exactly what we paid the farmer for it — see the Source Library if
  you're curious where your coffee's money actually goes.
- Your Aroma Journey (${SITE_URL}/journey) keeps a running log of what you've tried
  and liked, and gets sharper with each review you leave.

If anything's ever wrong with an order, just reply to this email or reach us through the site's
contact page — a real person reads it.

Warmly,
The Morning Aroma team`;

  // Real, live catalog data -- mirrors SignatureCollection's own real selection convention
  // (src/pages/Home.jsx: premium tier first) for consistency with what a customer would already
  // see featured on the actual homepage, rather than inventing a separate, second definition of
  // "featured" just for this email. Capped to 3 (not 8, like the homepage's own grid) -- a real,
  // deliberate choice for an email specifically: three products fit cleanly in one row at a
  // normal email width, and a long welcome email is more likely to go unread than a short one.
  // A real, thrown query error here is caught and swallowed, not left to fail the whole welcome
  // email over a products query -- a customer who successfully registered should still get
  // welcomed even if this one, non-essential enhancement fails for some reason.
  let products = [];
  try {
    const result = await query(
      "SELECT id, name, price_cents, photo_url FROM products WHERE removed = false AND tier = 'premium' ORDER BY name ASC LIMIT 3",
      []
    );
    products = result.rows.map((p) => ({ id: p.id, name: p.name, priceCents: p.price_cents, photoUrl: productPhotoUrlForEmail(p) }));
  } catch (e) {
    console.error("sendWelcomeEmail: failed to load featured products (continuing without them):", e);
  }

  const html = buildWelcomeEmailHtml(user, products);
  await sendEmail("Welcome email", user.email, subject, body, html);
}

async function sendPasswordResetEmail(email, resetToken) {
  const subject = "Reset your Morning Aroma password";
  const body = `We received a request to reset the password on your Morning Aroma account.

To finish resetting it: go to ${SITE_URL}, click "Sign in," then "Forgot password?", and enter
this code when asked for one:

${resetToken}

This code expires in 30 minutes. If you didn't request this, you can safely ignore this email —
your password hasn't been changed.`;
  await sendEmail("Password reset email", email, subject, body);
}

async function sendLoginCodeEmail(email, code) {
  const subject = `${code} is your Morning Aroma sign-in code`;
  const body = `Here's the code to sign in to Morning Aroma:

${code}

Enter it on the sign-in screen at ${SITE_URL}. This code expires in 10 minutes and can only be
used once. If you didn't request this, you can safely ignore this email — no account changes were
made.`;
  await sendEmail("Login code email", email, subject, body);
}

async function sendEmailVerificationCode(user, code) {
  const subject = `${code} is your Morning Aroma verification code`;
  const body = `Hi ${user.name},

Thanks for creating a Morning Aroma account. Enter this code to verify your email and finish
signing in:

${code}

This code expires in 15 minutes and can only be used once. If you didn't create this account, you
can safely ignore this email.`;
  await sendEmail("Email verification code", user.email, subject, body);
}

// Sent to every super_admin the moment a customer cancels a paid order (see
// routes/orders.js's POST /:id/cancel) -- a real refund is now owed, and this is the only signal
// an admin gets that one is needed, since refunds are deliberately a manual, admin-triggered
// action (POST /:id/refund) rather than fully automatic. Fire-and-forget from the caller's
// perspective, same as every other email in this file -- a notification failing to send must
// never block the cancellation itself from succeeding.
async function sendRefundNeededEmail(adminEmail, order) {
  const subject = `Refund needed — ${order.order_number ? `MA-${order.order_number}` : "an order"} (${(order.total_cents / 100).toFixed(2)} USD)`;
  const body = `A customer has cancelled a paid order within the cancellation window and is owed a refund.

Order: MA-${order.order_number}
Amount paid: ${order.paid_currency || "KES"} ${order.paid_amount_cents ? (order.paid_amount_cents / 100).toFixed(2) : "—"}
Paystack reference: ${order.paystack_reference || "—"}

Please process this refund soon — aim for within 2 hours of cancellation, since the customer is
waiting on their money back. You can trigger it directly from Admin > Orders (which calls
Paystack's real refund API on your behalf), or process it manually from your Paystack dashboard.

Note Paystack itself can take up to 10 business days to actually deliver funds back to the
customer once a refund is initiated -- initiating it promptly is what's in your control.`;
  await sendEmail("Refund needed notification", adminEmail, subject, body);
}

// Sent once, the moment a certificate is genuinely issued for the first time (see
// routes/certificates.js's POST /courses/:courseId/certificate) -- not on every re-request of an
// already-issued certificate, since that would re-send this every time someone re-downloads their
// own PDF. Fire-and-forget from the caller's perspective, same reasoning as every other email in
// this file -- a notification failing to send must never block the certificate itself from being
// issued, since the certificate is the real, durable outcome here.
async function sendCourseCompletionEmail(user, course, certificate, nextCourse) {
  const subject = `You did it -- ${course.name} complete! 🎉`;
  const nextCourseBlock = nextCourse
    ? `\nSince you enjoyed ${course.name}, you might like ${nextCourse.name} next: ${SITE_URL}/academy/course/${nextCourse.id}\n`
    : "";
  const body = `Hi ${user.name},

Congratulations -- you've passed every quiz in ${course.name} and earned your certificate.

Your certificate is ready to download from the course page, and anyone can verify it's genuine
at ${SITE_URL}/verify-certificate using its code: ${certificate.verificationCode}
${nextCourseBlock}
See everything you've earned so far in the Academy: ${SITE_URL}/academy

Nicely done,
The Morning Aroma Academy team`;
  await sendEmail("Course completion email", user.email, subject, body);
}

// Sent by the abandoned-cart scheduled job (see abandonedCartJob.js) -- items is the real,
// resolved list this job already looked up (name, size, qty, unitPriceCents), not raw cart data,
// since this function shouldn't need its own database access to build an email.
async function sendAbandonedCartEmail(user, items, totalCents) {
  const subject = items.length === 1
    ? `Your ${items[0].name} is still in your bag`
    : "You left some coffee behind";
  const lines = items.map((i) => `- ${i.name} (${i.size}) x${i.qty} — $${(i.unitPriceCents * i.qty / 100).toFixed(2)}`).join("\n");
  const body = `Hi ${user.name},

Your bag's still holding onto this:

${lines}

Total: $${(totalCents / 100).toFixed(2)}

No rush -- it'll be here whenever you're ready. Pick up right where you left off:
${SITE_URL}/shop

Warmly,
The Morning Aroma team`;
  await sendEmail("Abandoned cart email", user.email, subject, body);
}

module.exports = { sendWelcomeEmail, sendPasswordResetEmail, sendLoginCodeEmail, sendEmailVerificationCode, sendRefundNeededEmail, sendCourseCompletionEmail, sendAbandonedCartEmail };
