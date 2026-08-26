// Test-only mock, never shipped or imported by production code. Substitutes for
// google-auth-library's real network call to Google's servers (this sandbox can't reach
// oauth2.googleapis.com any more than it could reach Railway, Postgres, Paystack, Resend, or
// Cloudinary directly earlier this project) while still exercising the real verification logic in
// routes/auth.js unmodified. Configure the next response via setNextGooglePayload /
// setNextGoogleError before each test call.

let nextPayload = null;
let nextError = null;

function setNextGooglePayload(payload) { nextPayload = payload; nextError = null; }
function setNextGoogleError(message) { nextError = message; nextPayload = null; }

class OAuth2Client {
  // Real OAuth2Client's constructor takes a config object (clientId, etc.) -- accepted and
  // ignored here, since the mock's behavior is entirely controlled by setNextGooglePayload /
  // setNextGoogleError instead, the same way paystack.mock.js's functions ignore their real
  // arguments too.
  constructor() {}

  async verifyIdToken() {
    if (nextError) throw new Error(nextError);
    if (!nextPayload) throw new Error("Test setup error: call setNextGooglePayload() before hitting /auth/google in a test.");
    // The real OAuth2Client returns a LoginTicket with a .getPayload() method, not the payload
    // object directly -- matched here so routes/auth.js's real `ticket.getPayload()` call works
    // completely unmodified against this mock.
    return { getPayload: () => nextPayload };
  }
}

module.exports = { OAuth2Client, setNextGooglePayload, setNextGoogleError };