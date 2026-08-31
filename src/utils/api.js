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

async function request(path, options = {}) {
  const res = await fetch(`${API_URL || ""}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  let body;
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  if (!res.ok) {
    const error = new Error(body.error || "Something went wrong. Please try again.");
    error.status = res.status;
    throw error;
  }
  return body;
}

export const api = {
  register: (email, password, name) =>
    request("/auth/register", { method: "POST", body: JSON.stringify({ email, password, name }) }),
  login: (email, password) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: (token) =>
    request("/auth/me", { headers: { Authorization: `Bearer ${token}` } }),
  logout: (token) =>
    request("/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${token}` } }),
  requestPasswordReset: (email) =>
    request("/auth/password-reset/request", { method: "POST", body: JSON.stringify({ email }) }),
  confirmPasswordReset: (token, newPassword) =>
    request("/auth/password-reset/confirm", { method: "POST", body: JSON.stringify({ token, newPassword }) }),
  setupTwoFactor: (token) =>
    request("/auth/2fa/setup", { method: "POST", headers: { Authorization: `Bearer ${token}` } }),
  verifyTwoFactorSetup: (token, code) =>
    request("/auth/2fa/verify-setup", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ code }) }),
  // Deliberately no Authorization header -- there's no real session yet at this point (that's the
  // whole reason a *pending* token exists), so the pending token itself, in the body, is what
  // authorizes this specific call. See signPendingTwoFactorToken's own comment (server/src/utils/tokens.js)
  // for why it can't be used as a Bearer token to reach anything else.
  verifyTwoFactorLogin: (pendingToken, code) =>
    request("/auth/2fa/verify-login", { method: "POST", body: JSON.stringify({ pendingToken, code }) }),
  disableTwoFactor: (token, password) =>
    request("/auth/2fa/disable", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ password }) }),
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
  getUsers: (token) =>
    request("/users", { headers: { Authorization: `Bearer ${token}` } }),
  updateUser: (token, id, updates) =>
    request(`/users/${id}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(updates) }),
  createOrder: (token, order) =>
    request("/orders", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(order) }),
  getMyOrders: (token) =>
    request("/orders/mine", { headers: { Authorization: `Bearer ${token}` } }),
  getAllOrders: (token) =>
    request("/orders", { headers: { Authorization: `Bearer ${token}` } }),
  updateOrderStatus: (token, id, status) =>
    request(`/orders/${id}/status`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ status }) }),
  cancelOrder: (token, id) =>
    request(`/orders/${id}/cancel`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }),
  verifyPayment: (token, id, reference) =>
    request(`/orders/${id}/verify-payment`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ reference }) }),
  refundOrder: (token, id) =>
    request(`/orders/${id}/refund`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }),
  createSubscription: (token, subscription) =>
    request("/subscriptions", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(subscription) }),
  getMySubscriptions: (token) =>
    request("/subscriptions/mine", { headers: { Authorization: `Bearer ${token}` } }),
  pauseSubscription: (token, id) =>
    request(`/subscriptions/${id}/pause`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }),
  resumeSubscription: (token, id) =>
    request(`/subscriptions/${id}/resume`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }),
  cancelSubscription: (token, id) =>
    request(`/subscriptions/${id}/cancel`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }),
  getAllSubscriptions: (token) =>
    request("/subscriptions", { headers: { Authorization: `Bearer ${token}` } }),
  getProducts: () => request("/products"),
  createProduct: (token, product) =>
    request("/products", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(product) }),
  updateProduct: (token, id, updates) =>
    request(`/products/${id}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(updates) }),
  deleteProduct: (token, id) =>
    request(`/products/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }),
  getGreenBeans: () => request("/green-beans"),
  createGreenBean: (token, greenBean) =>
    request("/green-beans", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(greenBean) }),
  updateGreenBean: (token, id, updates) =>
    request(`/green-beans/${id}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(updates) }),
  deleteGreenBean: (token, id) =>
    request(`/green-beans/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }),
  getSettings: () => request("/settings"),
  updateSettings: (token, patch) =>
    request("/settings", { method: "PATCH", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(patch) }),
};