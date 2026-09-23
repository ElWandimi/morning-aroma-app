// Talks to the real backend deployed in server/ (see ROADMAP.md for what's live). The base URL
// comes from an environment variable rather than being hardcoded, since it's genuinely different
// between local development and the deployed Railway service, and Vite requires the VITE_ prefix
// to expose an env var to client-side code at all.
const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL && import.meta.env.PROD) {
  // Fails loudly in a production build rather than silently sending requests to nowhere -- an
  // empty API_URL would make every fetch call below resolve against the frontend's own origin,
  // which would fail in a confusing way (404s that look unrelated to the real cause) rather than
  // a clear error pointing at the actual missing configuration.
  console.error("VITE_API_URL is not set — the app cannot reach the auth backend. Set it in the frontend service's environment variables.");
}

// The real session token now lives only in an httpOnly cookie the backend sets (see
// server/src/utils/tokens.js) -- this app's own JS genuinely cannot read it, which is the whole
// point (an XSS payload can no longer exfiltrate it the way reading it out of localStorage would
// have let one). credentials: "include" below is what makes the browser actually attach that
// cookie to a cross-origin request at all; without it, every request would silently go out
// unauthenticated regardless of whether a real session exists.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS", undefined]);

// The CSRF cookie is deliberately NOT httpOnly (see server/src/utils/csrf.js) -- this app's own
// frontend JS has to be able to read it to echo it back in a header, since proving "this request
// came from a page that can read this origin's cookies" is the entire mechanism. A third-party
// site can plant its own cookies here but can't read this one back off this origin to forge the
// matching header, which is what actually makes the check meaningful.
//
// In production, though, the frontend and backend are genuinely separate domains
// (morning-aroma.com vs *.up.railway.app) with no shared parent -- a cookie the backend sets can
// never be scoped to be visible to document.cookie on the frontend's own origin, confirmed
// directly (a real, valid session with every mutating request 403ing on CSRF, in production).
// The backend now also returns the same token in the JSON body of every auth response
// (server/src/routes/auth.js's issueSession) specifically to give the frontend a channel that
// isn't subject to cross-origin cookie-visibility rules at all -- a fetch response body is exactly
// as inaccessible to a third-party page as a cookie would be, so this preserves the real security
// property. Held in memory (a module-level variable, not React state -- this file isn't a
// component) since it only needs to survive for the lifetime of this page load, the same as the
// session cookie itself only needs to be attached automatically for that long.
let inMemoryCsrfToken = null;
export function setCsrfToken(token) {
  inMemoryCsrfToken = token;
}

function readCsrfCookie() {
  const match = document.cookie.match(/(?:^|; )ma_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// Prefers the cookie when it's actually readable (same-domain deployments, or local dev where
// frontend and backend can genuinely share a cookie) and falls back to the in-memory value from
// the most recent auth response otherwise -- covers both cases with one function rather than
// making every call site decide which source to trust.
function getCsrfToken() {
  return readCsrfCookie() || inMemoryCsrfToken;
}

// Real, confirmed bug: this in-memory token is per-tab, but the CSRF claim it has to match lives
// in ONE shared session cookie for the whole browser. Signed-in with the site open in more than
// one tab -- an everyday case, not an edge case -- and whichever tab's own /auth/me happens to
// resolve most recently silently re-signs that shared cookie with a NEW claim, invalidating every
// OTHER tab's already-cached inMemoryCsrfToken even though it was genuinely valid the moment it
// was minted. That other tab's next mutating request (submitting a quiz, syncing the cart,
// checking out) then gets a real 403 ("Invalid or missing CSRF token.") despite a perfectly valid
// session -- reproduced directly: two tabs open, mint a token in tab A, mint a fresh one in tab B
// (rotating the shared cookie), and tab A's old token is now rejected even though nothing about
// tab A's own session ever expired or became invalid on its own.
//
// Fixed the same way the double-submit-cookie pattern always recovers from a rotated token: on a
// 403 whose body is specifically this CSRF error (not just any 403, which could be a real
// permissions failure this shouldn't mask), re-fetch /auth/me to pick up the CURRENT token that
// matches whatever the cookie now actually holds, and retry the original request exactly once
// with it. A second, still-failing 403 after that retry is left alone and surfaced normally --
// almost certainly means the session itself is genuinely gone (signed out elsewhere, expired),
// which requireAuth's own 401 downstream is the correct signal for, not something to keep retrying.
const CSRF_ERROR_MESSAGE = "Invalid or missing CSRF token.";

async function request(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const isSafe = SAFE_METHODS.has(method);

  const doFetch = async () => {
    const csrfToken = !isSafe ? getCsrfToken() : null;
    const res = await fetch(`${API_URL || ""}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
        ...options.headers,
      },
    });
    let body;
    try {
      body = await res.json();
    } catch {
      body = {};
    }
    return { res, body };
  };

  let { res, body } = await doFetch();

  if (!res.ok && res.status === 403 && !isSafe && body.error === CSRF_ERROR_MESSAGE) {
    try {
      const meBody = await request("/auth/me");
      if (meBody.csrfToken) setCsrfToken(meBody.csrfToken);
    } catch {
      // /auth/me itself failing (e.g. genuinely signed out) means the retry below will just hit
      // the same 403 (or a 401) again, which falls through to the normal error handling as-is.
    }
    ({ res, body } = await doFetch());
  }

  if (!res.ok) {
    const error = new Error(body.error || "Something went wrong. Please try again.");
    error.status = res.status;
    throw error;
  }
  // Captured generically here (not per-call-site) so every current and future endpoint that goes
  // through issueSession on the backend keeps the in-memory fallback correctly up to date, without
  // needing to remember to wire this in wherever a new auth-adjacent call gets added later.
  if (body.csrfToken) setCsrfToken(body.csrfToken);
  return body;
}

export const api = {
  register: (email, password, name) =>
    request("/auth/register", { method: "POST", body: JSON.stringify({ email, password, name }) }),
  login: (email, password) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: () =>
    request("/auth/me"),
  logout: () =>
    request("/auth/logout", { method: "POST" }),
  // Self-service "delete my account" -- server/src/routes/auth.js's POST /auth/me/delete soft-
  // deletes the row (sets deleted_at, keeps everything else intact and restorable) rather than a
  // real DELETE, but from the frontend's perspective this behaves exactly like an irreversible
  // account deletion: the session dies immediately server-side, and there is no route this app
  // exposes to undo it from here.
  deleteAccount: () =>
    request("/auth/me/delete", { method: "POST" }),
  requestPasswordReset: (email) =>
    request("/auth/password-reset/request", { method: "POST", body: JSON.stringify({ email }) }),
  confirmPasswordReset: (token, newPassword) =>
    request("/auth/password-reset/confirm", { method: "POST", body: JSON.stringify({ token, newPassword }) }),
  setupTwoFactor: () =>
    request("/auth/2fa/setup", { method: "POST" }),
  verifyTwoFactorSetup: (code) =>
    request("/auth/2fa/verify-setup", { method: "POST", body: JSON.stringify({ code }) }),
  // Deliberately no Authorization header -- there's no real session yet at this point (that's the
  // whole reason a *pending* token exists), so the pending token itself, in the body, is what
  // authorizes this specific call. See signPendingTwoFactorToken's own comment (server/src/utils/tokens.js)
  // for why it can't be used as a Bearer token to reach anything else.
  verifyTwoFactorLogin: (pendingToken, code) =>
    request("/auth/2fa/verify-login", { method: "POST", body: JSON.stringify({ pendingToken, code }) }),
  disableTwoFactor: (password) =>
    request("/auth/2fa/disable", { method: "POST", body: JSON.stringify({ password }) }),
  // Same reasoning as verifyTwoFactorLogin above -- deliberately no Authorization header, the
  // pending token in the body is what authorizes this specific call.
  verifyEmailCode: (pendingToken, code) =>
    request("/auth/verify-email", { method: "POST", body: JSON.stringify({ pendingToken, code }) }),
  resendEmailVerificationCode: (pendingToken) =>
    request("/auth/verify-email/resend", { method: "POST", body: JSON.stringify({ pendingToken }) }),
  // idToken is what Google's own Sign-In button hands back client-side (see components/index.jsx's
  // GoogleSignInButton) -- a JWT Google itself already signed, not anything this app generates.
  loginWithGoogle: (idToken) =>
    request("/auth/google", { method: "POST", body: JSON.stringify({ idToken }) }),
  requestOtpLogin: (email) =>
    request("/auth/otp/request", { method: "POST", body: JSON.stringify({ email }) }),
  verifyOtpLogin: (email, code) =>
    request("/auth/otp/verify", { method: "POST", body: JSON.stringify({ email, code }) }),
  getUsers: () =>
    request("/users"),
  updateUser: (id, updates) =>
    request(`/users/${id}`, { method: "PATCH", body: JSON.stringify(updates) }),
  createOrder: (order) =>
    request("/orders", { method: "POST", body: JSON.stringify(order) }),
  getMyOrders: () =>
    request("/orders/mine"),
  getAllOrders: () =>
    request("/orders"),
  updateOrderStatus: (id, status) =>
    request(`/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  cancelOrder: (id) =>
    request(`/orders/${id}/cancel`, { method: "POST" }),
  verifyPayment: (id, reference) =>
    request(`/orders/${id}/verify-payment`, { method: "POST", body: JSON.stringify({ reference }) }),
  refundOrder: (id) =>
    request(`/orders/${id}/refund`, { method: "POST" }),
  createSubscription: (subscription) =>
    request("/subscriptions", { method: "POST", body: JSON.stringify(subscription) }),
  getMySubscriptions: () =>
    request("/subscriptions/mine"),
  pauseSubscription: (id) =>
    request(`/subscriptions/${id}/pause`, { method: "POST" }),
  resumeSubscription: (id) =>
    request(`/subscriptions/${id}/resume`, { method: "POST" }),
  cancelSubscription: (id) =>
    request(`/subscriptions/${id}/cancel`, { method: "POST" }),
  getAllSubscriptions: () =>
    request("/subscriptions"),
  purchaseLifetimeAccess: (reference) =>
    request("/subscriptions/lifetime", { method: "POST", body: JSON.stringify({ reference }) }),
  getMyLifetimeAccess: () =>
    request("/subscriptions/lifetime/mine"),
  getAllLifetimeAccess: () =>
    request("/subscriptions/lifetime"),
  submitFeedback: (feedback) =>
    request("/feedback", { method: "POST", body: JSON.stringify(feedback) }),
  getProductFeedback: (productId) => request(`/feedback/product/${productId}`),
  getAllFeedback: () =>
    request("/feedback"),
  setFeedbackReviewed: (id, reviewed) =>
    request(`/feedback/${id}/reviewed`, { method: "PATCH", body: JSON.stringify({ reviewed }) }),
  subscribeNewsletter: (subscriber) =>
    request("/newsletter", { method: "POST", body: JSON.stringify(subscriber) }),
  getNewsletterSubscribers: () =>
    request("/newsletter"),
  startLiveChat: (customerName, customerEmail) =>
    request("/live-chat", { method: "POST", body: JSON.stringify({ customerName, customerEmail }) }),
  sendLiveChatGreeting: (chatId, text) =>
    request(`/live-chat/${chatId}/greeting`, { method: "POST", body: JSON.stringify({ text }) }),
  sendLiveChatMessage: (chatId, text) =>
    request(`/live-chat/${chatId}/messages`, { method: "POST", body: JSON.stringify({ text }) }),
  getLiveChat: (chatId) =>
    request(`/live-chat/${chatId}`),
  getAllLiveChats: () =>
    request("/live-chat"),
  replyToLiveChat: (chatId, text) =>
    request(`/live-chat/${chatId}/reply`, { method: "POST", body: JSON.stringify({ text }) }),
  setLiveChatStatus: (chatId, status) =>
    request(`/live-chat/${chatId}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  submitCareerApplication: (application) =>
    request("/career-applications", { method: "POST", body: JSON.stringify(application) }),
  getCareerApplications: () =>
    request("/career-applications"),
  setCareerApplicationStatus: (id, status) =>
    request(`/career-applications/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  getBlogPosts: () => request("/blog"),
  getBlogPost: (slug) => request(`/blog/${slug}`),
  getAllBlogPostsAdmin: () => request("/blog/admin/all"),
  getBlogPostAdmin: (id) => request(`/blog/admin/${id}`),
  createBlogPost: (post) =>
    request("/blog", { method: "POST", body: JSON.stringify(post) }),
  updateBlogPost: (id, patch) =>
    request(`/blog/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteBlogPost: (id) =>
    request(`/blog/${id}`, { method: "DELETE" }),
  submitQuotation: (quotation) =>
    request("/quotations", { method: "POST", body: JSON.stringify(quotation) }),
  getQuotations: () => request("/quotations"),
  setQuotationStatus: (id, status) =>
    request(`/quotations/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  submitServiceInquiry: (inquiry) =>
    request("/service-inquiries", { method: "POST", body: JSON.stringify(inquiry) }),
  getServiceInquiries: () => request("/service-inquiries"),
  setServiceInquiryStatus: (id, status) =>
    request(`/service-inquiries/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  setServiceInquiryFee: (id, agreedFeeCents) =>
    request(`/service-inquiries/${id}/fee`, { method: "PATCH", body: JSON.stringify({ agreedFeeCents }) }),
  submitGreenOrder: (order) =>
    request("/green-orders", { method: "POST", body: JSON.stringify(order) }),
  getGreenOrders: () => request("/green-orders"),
  setGreenOrderStatus: (id, status) =>
    request(`/green-orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  submitContactMessage: (msg) =>
    request("/contact-messages", { method: "POST", body: JSON.stringify(msg) }),
  getContactMessages: () => request("/contact-messages"),
  setContactMessageRead: (id, read) =>
    request(`/contact-messages/${id}/read`, { method: "PATCH", body: JSON.stringify({ read }) }),
  getCourses: () => request("/courses"),
  createCourse: (course) =>
    request("/courses", { method: "POST", body: JSON.stringify(course) }),
  updateCourse: (id, updates) =>
    request(`/courses/${id}`, { method: "PATCH", body: JSON.stringify(updates) }),
  deleteCourse: (id) =>
    request(`/courses/${id}`, { method: "DELETE" }),
  getChapters: (courseId) => request(`/courses/${courseId}/chapters`),
  getChapterContent: (chapterId) => request(`/chapters/${chapterId}/content`),
  getChapterContentAdmin: (chapterId) => request(`/admin/chapters/${chapterId}/content`),
  createChapter: (courseId, chapter) =>
    request(`/courses/${courseId}/chapters`, { method: "POST", body: JSON.stringify(chapter) }),
  updateChapter: (id, updates) =>
    request(`/chapters/${id}`, { method: "PATCH", body: JSON.stringify(updates) }),
  deleteChapter: (id) =>
    request(`/chapters/${id}`, { method: "DELETE" }),
  getQuizExists: (chapterId) => request(`/chapters/${chapterId}/quiz/exists`),
  getQuiz: (chapterId) => request(`/chapters/${chapterId}/quiz`),
  submitQuiz: (chapterId, answers) =>
    request(`/chapters/${chapterId}/quiz/submit`, { method: "POST", body: JSON.stringify({ answers }) }),
  getMyQuizAttempts: (chapterId) =>
    request(`/chapters/${chapterId}/quiz/my-attempts`),
  getQuizQuestionsAdmin: (chapterId) =>
    request(`/admin/chapters/${chapterId}/quiz-questions`),
  createQuizQuestion: (chapterId, question) =>
    request(`/chapters/${chapterId}/quiz-questions`, { method: "POST", body: JSON.stringify(question) }),
  updateQuizQuestion: (id, updates) =>
    request(`/quiz-questions/${id}`, { method: "PATCH", body: JSON.stringify(updates) }),
  deleteQuizQuestion: (id) =>
    request(`/quiz-questions/${id}`, { method: "DELETE" }),
  getCertificateEligibility: (courseId) =>
    request(`/courses/${courseId}/certificate-eligibility`),
  issueCertificate: (courseId) =>
    request(`/courses/${courseId}/certificate`, { method: "POST" }),
  getMyCertificates: () => request("/users/me/certificates"),
  verifyCertificate: (code) => request(`/certificates/verify/${code}`),
  getAcademyStats: () => request("/users/me/academy-stats"),
  getProducts: () => request("/products"),
  createProduct: (product) =>
    request("/products", { method: "POST", body: JSON.stringify(product) }),
  updateProduct: (id, updates) =>
    request(`/products/${id}`, { method: "PATCH", body: JSON.stringify(updates) }),
  deleteProduct: (id) =>
    request(`/products/${id}`, { method: "DELETE" }),
  getGreenBeans: () => request("/green-beans"),
  createGreenBean: (greenBean) =>
    request("/green-beans", { method: "POST", body: JSON.stringify(greenBean) }),
  updateGreenBean: (id, updates) =>
    request(`/green-beans/${id}`, { method: "PATCH", body: JSON.stringify(updates) }),
  deleteGreenBean: (id) =>
    request(`/green-beans/${id}`, { method: "DELETE" }),
  getSettings: () => request("/settings"),
  updateSettings: (patch) =>
    request("/settings", { method: "PATCH", body: JSON.stringify(patch) }),
  syncCart: (items) =>
    request("/cart", { method: "PUT", body: JSON.stringify({ items }) }),
  getContentOverrides: () => request("/content-overrides"),
  updateMomentContent: (id, patch) =>
    request(`/content-overrides/moments/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) }),
  updateCountryHistory: (name, text) =>
    request(`/content-overrides/countries/${encodeURIComponent(name)}`, { method: "PATCH", body: JSON.stringify({ text }) }),
  getAuditLog: () => request("/audit-log"),
  logAdminAction: (action, detail) =>
    request("/audit-log", { method: "POST", body: JSON.stringify({ action, detail }) }),
};