// Test-only mock, never shipped or imported by production code. Substitutes for the real
// `resend` package (this sandbox can't reach Resend's API any more than it could reach
// api.paystack.co, Railway, or Postgres directly earlier this project) while still exercising
// the real sending logic in utils/email.js unmodified. Matches the real SDK's shape: a `Resend`
// class, instantiated with an API key, exposing `.emails.send(...)`.

let nextError = null;
let sentEmails = [];

function setNextError(message) { nextError = message; }
function clearError() { nextError = null; }
function getSentEmails() { return sentEmails; }
function resetSentEmails() { sentEmails = []; }

class Resend {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }
  get emails() {
    return {
      send: async (params) => {
        if (nextError) {
          return { data: null, error: { message: nextError } };
        }
        sentEmails.push(params);
        return { data: { id: "mock-email-id" }, error: null };
      },
    };
  }
}

module.exports = { Resend, setNextError, clearError, getSentEmails, resetSentEmails };
