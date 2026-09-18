import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { COUNTRY_HISTORY, DEFAULT_PRODUCT_SIZE, DEFAULT_SETTINGS, DEMO_ADMIN, KNOWN_ROUTES, PAGE_TO_SLUG, priceForSize, SLUG_TO_PAGE } from "../data";
import { fmtPrice, getStorageConsent, logPageView, storage } from "../utils/helpers";
import { api } from "../utils/api";

// Pulls `field` out of a parsed API response body and throws instead of returning `undefined` if
// it's missing or the wrong shape. Every fetch below used to do `.then(({ field }) => setX(field))`
// directly -- if a response ever came back without that field (wrong endpoint, a non-JSON body that
// silently parsed to {}, an error body shaped differently than expected, etc.), `field` would
// destructure to `undefined` and get handed straight to setState, permanently overwriting a safe
// initial value like `useState([])`. The next render's `.find()`/`.map()` on that now-undefined
// state would then crash the whole app days later, far from the actual bad response that caused it.
// Throwing here instead routes a malformed response into the same .catch() the caller already has
// for real network errors, so it becomes a visible, retryable error state instead of a silent crash.
function pluck(body, field, { array = false } = {}) {
  const value = body && body[field];
  if (array ? !Array.isArray(value) : value === undefined) {
    throw new Error(`Unexpected response from the server — missing "${field}". Please try again.`);
  }
  return value;
}

export const AuthCtx = createContext(null);

// Real register/login/session/logout, backed by the actual deployed backend (server/, see
// ROADMAP.md). Deliberately NOT real yet, pending their own backend work: OTP/email-code login,
// "Continue with Google", 2FA, and the admin Customers section's user list / role management --
// all of that still operates on demo, in-memory-only data, same as before this change. That
// split is intentional and called out at each function below, not an oversight -- registering a
// real account and having it actually persist in Postgres is the part that matters most right
// now; the rest genuinely needs its own backend endpoints this round didn't build.
export function AuthProvider({ children }) {
  // Still-demo user list, used only by Admin > Customers for staff/role management -- these are
  // NOT the real accounts in the real database. A customer who registers for real through the
  // login modal will not appear here. See ROADMAP.md Tier 1.5 (admin user-management API) for
  // when this gets connected to something real.
  const [users, setUsers] = useState([
    { email: DEMO_ADMIN.email, name: DEMO_ADMIN.name, role: DEMO_ADMIN.role, twoFactorEnabled: true, createdAt: "2025-11-02", notificationsEnabled: true },
  ]);
  const [user, setUser] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [error, setError] = useState("");
  // Holds the short-lived pending-2FA session token (server/src/utils/tokens.js) between "password
  // correct, second factor needed" and "code confirmed" -- deliberately not the user object itself
  // (that was the old demo shape), since nothing about who this account belongs to should be
  // trusted or displayed until the second factor actually checks out.
  const [pendingTwoFactorToken, setPendingTwoFactorToken] = useState(null);
  // Same pattern as pendingTwoFactorToken, for the email verification step registration (and,
  // less commonly, a later /login on a still-unverified account) can now require.
  const [pendingEmailVerificationToken, setPendingEmailVerificationToken] = useState(null);

  // On mount, try to restore a real session -- without this, a real registered/logged-in user
  // would be signed out every time they refresh the page, which is a meaningfully worse
  // experience than the old demo (which never persisted anything anyway, so there was nothing to
  // lose before). The real session token now lives only in an httpOnly cookie the browser
  // attaches automatically (see src/utils/api.js) -- there's no local value to check for before
  // asking; api.me() itself is the check, succeeding if a valid session cookie came along and
  // failing (silently, here) if it didn't or has expired. Genuinely simpler than the previous
  // localStorage-token version, not just different: there's no saved value to read, restore, or
  // invalidate on this end at all anymore.
  useEffect(() => {
    api.me()
      .then((body) => setUser(pluck(body, "user")))
      .catch(() => {}) // no session cookie, or an expired one -- either way, just stay signed out
      .finally(() => setSessionLoading(false));
  }, []);

  // Real registration against the actual backend. No longer signs the person in directly -- a
  // password-based signup now requires verifying a real code sent to the email first (see
  // ROADMAP.md), so this stashes the pending token for verifyEmailCode to use, the same pattern
  // login() already uses for 2FA below. Returns { ok, error? } rather than throwing, so the
  // sign-up modal can show a message inline without needing its own try/catch.
  const register = async (email, password, name) => {
    try {
      const body = await api.register(email, password, name);
      setPendingEmailVerificationToken(pluck(body, "pendingToken"));
      setError("");
      return { ok: true, requiresEmailVerification: true };
    } catch (e) {
      setError(e.message);
      return { ok: false, error: e.message };
    }
  };

  // Real login against the actual backend, including real 2FA now: an account with it enabled
  // never gets a real session token from this call alone (see /auth/login's own branch,
  // server/src/routes/auth.js) -- only a short-lived pending token, stashed here for
  // verifyTwoFactorLogin to use once the actual second factor is confirmed.
  const login = async (email, password) => {
    try {
      const body = await api.login(email, password);
      if (body.requiresEmailVerification) {
        // The right password, but this account was created via password registration and never
        // finished verifying its email -- same pending-token shape as 2FA below, just a
        // different step. A fresh code was already sent server-side by this same call.
        setPendingEmailVerificationToken(pluck(body, "pendingToken"));
        setError("");
        return { ok: true, requiresEmailVerification: true };
      }
      if (body.requiresTwoFactor) {
        setPendingTwoFactorToken(pluck(body, "pendingToken"));
        setError("");
        return { ok: true, requiresTwoFactor: true };
      }
      setError("");
      setUser(pluck(body, "user"));
      return { ok: true, requiresTwoFactor: false };
    } catch (e) {
      setError(e.message);
      return { ok: false };
    }
  };

  // The verification step registration (or an unverified account's later /login) now requires:
  // a real 6-digit code from the email just sent. Only actually signs the person in (real user +
  // real persisted token) once this succeeds -- register()/login() alone never do for an
  // unverified account. Handles the account already turning out to have 2FA on too (a real,
  // if unusual, edge case: registering with an email that already has a 2FA-protected account
  // just signs that existing user in instead of erroring), matching verifyTwoFactorLogin's own
  // shape rather than assuming it can't happen.
  const verifyEmailCode = async (code) => {
    if (!pendingEmailVerificationToken) {
      return { ok: false, error: "That verification session has expired. Please sign in again." };
    }
    try {
      const body = await api.verifyEmailCode(pendingEmailVerificationToken, code);
      if (body.requiresTwoFactor) {
        setPendingEmailVerificationToken(null);
        setPendingTwoFactorToken(pluck(body, "pendingToken"));
        setError("");
        return { ok: true, requiresTwoFactor: true };
      }
      setUser(pluck(body, "user"));
      setPendingEmailVerificationToken(null);
      setError("");
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  const resendEmailVerificationCode = async () => {
    if (!pendingEmailVerificationToken) {
      return { ok: false, error: "That verification session has expired. Please sign in again." };
    }
    try {
      await api.resendEmailVerificationCode(pendingEmailVerificationToken);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  const cancelEmailVerification = () => setPendingEmailVerificationToken(null);

  // The second step of a 2FA login: a live 6-digit code from the account's authenticator app, or
  // one of its remaining backup codes -- server/src/routes/auth.js's /2fa/verify-login accepts
  // either. Only actually signs the person in (real user + real persisted token) once this
  // succeeds; the earlier login() call alone never does for a 2FA account.
  const verifyTwoFactorLogin = async (code) => {
    if (!pendingTwoFactorToken) {
      return { ok: false, error: "That sign-in session has expired. Please sign in again." };
    }
    try {
      const body = await api.verifyTwoFactorLogin(pendingTwoFactorToken, code);
      setUser(pluck(body, "user"));
      setPendingTwoFactorToken(null);
      setError("");
      return { ok: true, usedBackupCode: !!body.usedBackupCode };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  const cancelTwoFactorLogin = () => setPendingTwoFactorToken(null);

  // --- Real 2FA setup/disable, from Settings (Journey.jsx) once already signed in ---
  // Setup is a two-step handshake matching the backend exactly (server/src/routes/auth.js): this
  // generates and stores a *pending* secret and hands back a QR code, but doesn't turn 2FA on yet
  // -- confirmTwoFactorSetup below only enables it once the person proves they can actually
  // produce a matching code from it.
  const startTwoFactorSetup = async () => {
    try {
      const body = await api.setupTwoFactor();
      return { ok: true, secret: body.secret, uri: body.uri, qrDataUrl: body.qrDataUrl };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  const confirmTwoFactorSetup = async (code) => {
    try {
      const body = await api.verifyTwoFactorSetup(code);
      // Backup codes are returned exactly once, right here -- there's no way to see them again
      // later, since the backend only ever stores their hashes. The caller (Journey.jsx) is
      // responsible for actually showing them to the person before this moment passes.
      setUser((prev) => (prev ? { ...prev, twoFactorEnabled: true } : prev));
      return { ok: true, backupCodes: body.backupCodes };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  // Requires re-entering the password (not just trusting the existing session) for the same
  // reason the backend itself insists on it (server/src/routes/auth.js's /2fa/disable): turning
  // off 2FA is a real security downgrade, not a cosmetic preference toggle.
  const disableTwoFactor = async (password) => {
    try {
      await api.disableTwoFactor(password);
      setUser((prev) => (prev ? { ...prev, twoFactorEnabled: false } : prev));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  // A real, honest preference rather than a promise -- this prototype has no email delivery
  // infrastructure, so nothing actually gets sent either way. The setting is genuinely saved
  // (persists on the account for the session) for whenever real notifications exist to send.
  const setNotificationsEnabled = (email, enabled) => {
    setUsers((prev) => prev.map((u) => (u.email === email ? { ...u, notificationsEnabled: enabled } : u)));
    setUser((prev) => (prev && prev.email === email ? { ...prev, notificationsEnabled: enabled } : prev));
  };

  // Real OTP (email-code) login, backed by the actual deployed backend
  // (server/src/routes/auth.js's /auth/otp/request + /verify) -- two real steps, not a single
  // local function like the old fake version. requestOtpLogin sends a real email with a real
  // code; verifyOtpLogin is what actually signs someone in once they enter it, same 2FA branch as
  // login()/loginWithGoogle() above, since an account reached this way is subject to the same
  // real 2FA gate as any other.
  const requestOtpLogin = async (email) => {
    try {
      await api.requestOtpLogin(email);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  const verifyOtpLogin = async (email, code) => {
    try {
      const body = await api.verifyOtpLogin(email, code);
      if (body.requiresTwoFactor) {
        setPendingTwoFactorToken(pluck(body, "pendingToken"));
        setError("");
        return { ok: true, requiresTwoFactor: true };
      }
      setError("");
      setUser(pluck(body, "user"));
      return { ok: true, requiresTwoFactor: false };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  // Real Google sign-in, backed by the actual deployed backend (server/src/routes/auth.js's
  // /auth/google). Takes the real ID token Google's own Sign-In button produces
  // (components/index.jsx's GoogleSignInButton) -- not a locally-picked demo email like before.
  // Mirrors login()'s own 2FA branch exactly, since an account reached through Google is subject
  // to the same real 2FA gate as one reached through a password.
  const loginWithGoogle = async (idToken) => {
    try {
      const body = await api.loginWithGoogle(idToken);
      if (body.requiresTwoFactor) {
        setPendingTwoFactorToken(pluck(body, "pendingToken"));
        setError("");
        return { ok: true, requiresTwoFactor: true };
      }
      setError("");
      setUser(pluck(body, "user"));
      return { ok: true, requiresTwoFactor: false };
    } catch (e) {
      setError(e.message);
      return { ok: false };
    }
  };

  // Genuinely NOT fire-and-forget anymore -- it used to be, on the reasoning that clearing local
  // UI state shouldn't wait on a network round-trip. In practice this masked a real bug: if
  // api.logout() ever failed for any reason (a transient network blip, a CSRF-token timing edge
  // case, anything), setUser(null) still ran unconditionally, so the UI looked signed out while
  // the actual httpOnly session cookie was untouched server-side -- exactly reproduced by
  // reported behavior: sign out looks like it worked, then a hard refresh (which re-asks the
  // backend via api.me(), not anything cached client-side) shows the same account still signed
  // in, because the cookie that determines that was never actually cleared. One retry before
  // giving up, since the one real failure mode worth absorbing here is a single dropped request,
  // not a persistent backend outage -- and the caller now genuinely learns whether this worked,
  // rather than the previous version's blanket "assume yes."
  const logout = async () => {
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await api.logout();
        setUser(null);
        return { ok: true };
      } catch (e) {
        lastError = e;
      }
    }
    // Even after both attempts failed, still clear the LOCAL UI state -- staying stuck on "still
    // showing signed in" after someone explicitly asked to sign out is worse than showing signed
    // out optimistically. What changed is that the caller now finds out this didn't fully
    // succeed (via the returned { ok: false }), instead of the failure being invisible. The real
    // session cookie may still be live server-side in this case -- Nav's own logout handler is
    // what surfaces that to the person, since this function has no rendered UI of its own to show
    // it in.
    setUser(null);
    return { ok: false, error: lastError?.message };
  };

  const setRole = (email, role) => {
    setUsers((prev) => prev.map((u) => (u.email === email ? { ...u, role, permissions: role === "staff" ? (u.permissions || []) : [] } : u)));
    setUser((prev) => (prev && prev.email === email ? { ...prev, role, permissions: role === "staff" ? (prev.permissions || []) : [] } : prev));
  };
  // Staff can be granted access to a specific subset of admin sections rather than the binary
  // customer/super_admin split -- Overview stays universally visible to any admin-level user as
  // a safe, read-only landing page regardless of what else they're granted.
  const setPermissions = (email, permissions) => {
    setUsers((prev) => prev.map((u) => (u.email === email ? { ...u, permissions } : u)));
    setUser((prev) => (prev && prev.email === email ? { ...prev, permissions } : prev));
  };

  // exportUsers/restoreUsers only ever touch `users` (demo-only staff/role metadata, unrelated to
  // real authentication -- see the users state's own comment above), never anything password-
  // related: real accounts' credentials live entirely in the backend's database now, never in
  // this app's own state at all, so there's no plaintext-credential export risk to guard against
  // here in the first place.
  const exportUsers = () => users;
  const restoreUsers = (data) => { if (Array.isArray(data)) setUsers(data); };

  return (
    <AuthCtx.Provider
      value={{
        user, users, login, register, requestOtpLogin, verifyOtpLogin, loginWithGoogle, logout, setRole, setPermissions, error, setError,
        pendingTwoFactorToken, verifyTwoFactorLogin, cancelTwoFactorLogin,
        pendingEmailVerificationToken, verifyEmailCode, resendEmailVerificationCode, cancelEmailVerification,
        startTwoFactorSetup, confirmTwoFactorSetup, disableTwoFactor, setNotificationsEnabled,
        exportUsers, restoreUsers, sessionLoading,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);

function parsePath() {
  const raw = window.location.pathname.replace(/^\/+/, "");
  if (!raw) return { page: "home" };
  const [slug, rawId] = raw.split("/");
  const page = SLUG_TO_PAGE[slug];
  if (!page || !KNOWN_ROUTES.has(page)) return { page: "home" };
  return rawId ? { page, id: decodeURIComponent(rawId) } : { page };
}
// Exported (not just used internally by go() below) so any component can build a real href for
// an internal link -- important now that paths are real: a crawler discovers internal links by
// parsing raw href attributes in the HTML, not by executing JS and watching for click handlers,
// so an href="#" placeholder (harmless for a real user, since the actual navigation happens via
// onClick) would make every one of those links invisible to anything that doesn't run JS.
export function pathFor(page, params = {}) {
  const slug = PAGE_TO_SLUG[page] ?? page;
  const path = params.id ? `${slug}/${encodeURIComponent(params.id)}` : slug;
  return `/${path}`;
}

export const RouteCtx = createContext(null);

export function RouteProvider({ children }) {
  const [route, setRoute] = useState(() => parsePath());

  useEffect(() => {
    // popstate fires on browser back/forward, and on window.history.pushState/replaceState calls
    // made elsewhere -- but NOT when this same code calls pushState itself (pushState never fires
    // its own popstate, by design), which is why go() below updates state directly rather than
    // relying on this listener to catch its own navigation.
    const onPopState = () => setRoute(parsePath());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => { logPageView(route.page); }, [route.page, route.id]);

  const go = (page, params = {}) => {
    const nextPath = pathFor(page, params);
    if (window.location.pathname !== nextPath) {
      window.history.pushState(null, "", nextPath);
    }
    // Always updates state directly (not just on a path change) -- re-clicking a nav link to the
    // same destination should still work (e.g. re-triggering a fresh page-view log), and unlike
    // the old hash-based version, pushState never fires an event this could otherwise rely on.
    setRoute({ page, ...params });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return <RouteCtx.Provider value={{ route, go }}>{children}</RouteCtx.Provider>;
}

export const useRoute = () => useContext(RouteCtx);

export const CartCtx = createContext(null);

export function CartProvider({ children }) {
  // Real, confirmed bug this fixes: cart items added to localStorage BEFORE this size feature
  // existed are genuinely just { id, qty } -- no size field at all, since there was nothing to
  // store. Reading those back with the new size-aware code (i.size, getPriceForSize(id, i.size))
  // without normalizing first produces literal `undefined`, which renders as "()" in the UI
  // (confirmed directly: "Caturra — Colombia ()") and would price the item at the fallback (still
  // correct, since priceForSize's own fallback is DEFAULT_PRODUCT_SIZE, but silently, with no
  // indication anything was defaulted). Normalizing once here, at the single point every
  // consumer's `items` ultimately comes from, means every downstream reader (CartDrawer,
  // Checkout, order creation) can trust i.size is always a real, valid size string -- rather than
  // needing the same defensive `i.size || DEFAULT_PRODUCT_SIZE` repeated at every read site.
  const [items, setItems] = useState(() =>
    storage.get("ma_cart", []).map((i) => ({ ...i, size: i.size || DEFAULT_PRODUCT_SIZE }))
  ); // { id, size, qty }
  const [open, setOpen] = useState(false);
  useEffect(() => { if (getStorageConsent() === "accepted") storage.set("ma_cart", items); }, [items]);
  const { user } = useAuth();
  // Real, periodic sync of the actual cart to the backend -- see routes/cart.js's own comment
  // for the full reasoning (this table only exists so the abandoned-cart email job has real,
  // server-side data to check; the cart displayed here and read by every other part of this app
  // still comes entirely from `items`/localStorage above, unchanged). Only for a real,
  // signed-in user -- there's no real email to send an anonymous guest's cart reminder to, so
  // syncing one would just be wasted real backend work.
  //
  // itemsRef mirrors `items` without being a real dependency of the interval effect below -- a
  // genuinely important, real distinction: if the effect depended on `items` directly, it would
  // tear down and recreate its setInterval on every single cart edit (add/remove/qty change),
  // which defeats the whole point of a 2-minute throttle (confirmed by tracing through: an
  // earlier version of this code did exactly that, and would have synced on nearly every cart
  // edit instead of genuinely every 2 minutes). The ref lets the interval's own callback always
  // read the CURRENT real cart contents when it fires, without the interval itself restarting
  // every time those contents change.
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

  const lastSyncedRef = useRef(null);
  useEffect(() => {
    if (!user) { lastSyncedRef.current = null; return; }
    const syncIfChanged = () => {
      const current = itemsRef.current;
      const snapshot = JSON.stringify(current);
      // A genuinely empty cart still needs syncing WHEN it represents a real change (the
      // customer just cleared it, or checked out) -- skipping it outright would leave a stale,
      // non-empty snapshot on the backend forever, and the abandoned-cart job would incorrectly
      // email someone about coffee they no longer have in their real cart. Only skipped when
      // it's ALREADY empty on both sides (lastSyncedRef holds "[]" from a previous real sync, or
      // is still null and current is also empty) -- that's genuinely nothing worth a real
      // network call for.
      if (snapshot === lastSyncedRef.current) return;
      if (current.length === 0 && lastSyncedRef.current === null) return;
      api.syncCart(current).then(() => { lastSyncedRef.current = snapshot; }).catch(() => {
        // A real, transient sync failure isn't worth surfacing to the customer at all -- this
        // is invisible, best-effort backend bookkeeping for a later email reminder, not
        // something that should ever interrupt or alarm someone who's just trying to shop.
        // lastSyncedRef intentionally NOT updated on failure, so the next interval tick
        // genuinely retries this same real state rather than silently giving up on it.
      });
    };
    syncIfChanged(); // Real, immediate sync on sign-in/mount too, not just the first interval tick 2 minutes later -- someone who was already shopping as a guest and then signs in shouldn't have to wait a real 2 minutes before their existing cart is even known to the backend at all.
    const interval = setInterval(syncIfChanged, 2 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user && user.email]);
  const { getPriceForSize, getStock } = useAdmin();
  // size defaults to DEFAULT_PRODUCT_SIZE ("1kg") so every existing call site that doesn't yet
  // know about sizes (any add(id) call without a size argument) keeps behaving exactly as it did
  // before this feature existed -- the same size the product's own single price always meant.
  const add = (id, qty = 1, size = DEFAULT_PRODUCT_SIZE) => {
    setItems((prev) => {
      const stock = getStock(id);
      // Two different sizes of the same product are genuinely different purchase choices -- a
      // real line item each, at their own (different) price -- not the same cart row with a
      // combined quantity, which is why identity here is the (id, size) pair, not id alone.
      const found = prev.find((i) => i.id === id && i.size === size);
      const current = found ? found.qty : 0;
      const nextQty = stock > 0 ? Math.min(current + qty, stock) : current + qty; // stock 0 handled by UI gating; don't hard-block here in case of stale admin state
      if (found) return prev.map((i) => (i.id === id && i.size === size ? { ...i, qty: nextQty } : i));
      return [...prev, { id, size, qty: nextQty }];
    });
    setOpen(true);
  };
  const updateQty = (id, size, qty) => {
    setItems((prev) => (qty <= 0 ? prev.filter((i) => !(i.id === id && i.size === size)) : prev.map((i) => (i.id === id && i.size === size ? { ...i, qty } : i))));
  };
  const remove = (id, size) => setItems((prev) => prev.filter((i) => !(i.id === id && i.size === size)));
  const clearCart = () => setItems([]);
  const count = items.reduce((sum, i) => sum + i.qty, 0);
  const totalCents = items.reduce((sum, i) => sum + getPriceForSize(i.id, i.size) * i.qty, 0);
  return (
    <CartCtx.Provider value={{ items, add, updateQty, remove, clearCart, count, totalCents, open, setOpen }}>
      {children}
    </CartCtx.Provider>
  );
}

export const useCart = () => useContext(CartCtx);

export const WishlistCtx = createContext(null);

export function WishlistProvider({ children }) {
  const [items, setItems] = useState(() => storage.get("ma_wishlist", [])); // array of product ids
  const [open, setOpen] = useState(false);
  useEffect(() => { if (getStorageConsent() === "accepted") storage.set("ma_wishlist", items); }, [items]);
  const toggle = (id) => setItems((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const has = (id) => items.includes(id);
  const remove = (id) => setItems((prev) => prev.filter((x) => x !== id));
  return (
    <WishlistCtx.Provider value={{ items, toggle, has, remove, count: items.length, open, setOpen }}>
      {children}
    </WishlistCtx.Provider>
  );
}

export const useWishlist = () => useContext(WishlistCtx);

export const JournalCtx = createContext(null);

export function JournalProvider({ children }) {
  const [byUser, setByUser] = useState({}); // { [email]: [{id, productId, rating, note, date}] }
  const addEntry = (email, productId, rating, note) => {
    setByUser((prev) => {
      const list = prev[email] || [];
      const entry = { id: `${productId}-${Date.now()}`, productId, rating, note, date: new Date().toISOString().slice(0, 10) };
      return { ...prev, [email]: [entry, ...list] };
    });
  };
  const removeEntry = (email, id) => {
    setByUser((prev) => ({ ...prev, [email]: (prev[email] || []).filter((e) => e.id !== id) }));
  };
  const entriesFor = (email) => byUser[email] || [];
  return <JournalCtx.Provider value={{ addEntry, removeEntry, entriesFor }}>{children}</JournalCtx.Provider>;
}

export const useJournal = () => useContext(JournalCtx);

export const OrdersCtx = createContext(null);

export function OrdersProvider({ children }) {
  const { user } = useAuth();
  const [myOrders, setMyOrders] = useState([]);
  const [myOrdersLoading, setMyOrdersLoading] = useState(true);
  const [myOrdersError, setMyOrdersError] = useState("");

  const refetchMyOrders = () => {
    if (!user) { setMyOrdersLoading(false); return; }
    setMyOrdersLoading(true);
    setMyOrdersError("");
    api.getMyOrders()
      .then((body) => setMyOrders(pluck(body, "orders", { array: true })))
      .catch((e) => setMyOrdersError(e.message))
      .finally(() => setMyOrdersLoading(false));
  };
  useEffect(() => {
    if (user) refetchMyOrders();
    else { setMyOrders([]); setMyOrdersLoading(false); }
  }, [user && user.email]);

  // Both return { ok, order? / error? } rather than throwing, so callers (Checkout, Journey) can
  // show an inline error without needing their own try/catch around every call site.
  const createOrder = async (orderData) => {
    try {
      const { order } = await api.createOrder(orderData);
      setMyOrders((prev) => [order, ...prev]);
      return { ok: true, order };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  const cancelOrder = async (orderId) => {
    try {
      const { order } = await api.cancelOrder(orderId);
      setMyOrders((prev) => prev.map((o) => (o.id === orderId ? order : o)));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  const verifyPayment = async (orderId, reference) => {
    try {
      const { order } = await api.verifyPayment(orderId, reference);
      setMyOrders((prev) => prev.map((o) => (o.id === orderId ? order : o)));
      return { ok: true, order };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  return (
    <OrdersCtx.Provider value={{ myOrders, myOrdersLoading, myOrdersError, refetchMyOrders, createOrder, cancelOrder, verifyPayment }}>
      {children}
    </OrdersCtx.Provider>
  );
}

export const useOrders = () => useContext(OrdersCtx);

export const SubscriptionsCtx = createContext(null);

export function SubscriptionsProvider({ children }) {
  const { user } = useAuth();
  const [mySubscriptions, setMySubscriptions] = useState([]);
  const [mySubscriptionsLoading, setMySubscriptionsLoading] = useState(true);
  const [mySubscriptionsError, setMySubscriptionsError] = useState("");

  const refetchMySubscriptions = () => {
    if (!user) { setMySubscriptionsLoading(false); return; }
    setMySubscriptionsLoading(true);
    setMySubscriptionsError("");
    api.getMySubscriptions()
      .then((body) => setMySubscriptions(pluck(body, "subscriptions", { array: true })))
      .catch((e) => setMySubscriptionsError(e.message))
      .finally(() => setMySubscriptionsLoading(false));
  };
  useEffect(() => {
    if (user) refetchMySubscriptions();
    else { setMySubscriptions([]); setMySubscriptionsLoading(false); }
  }, [user && user.email]);

  // All four return { ok, error? } rather than throwing, matching useOrders' own pattern, so
  // callers (Checkout, Journey) can show an inline error without their own try/catch.
  const createSubscription = async (subscriptionData) => {
    try {
      const { subscription } = await api.createSubscription(subscriptionData);
      setMySubscriptions((prev) => [subscription, ...prev]);
      return { ok: true, subscription };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  const pauseSubscription = async (id) => {
    try {
      const { subscription } = await api.pauseSubscription(id);
      setMySubscriptions((prev) => prev.map((s) => (s.id === id ? subscription : s)));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  const resumeSubscription = async (id) => {
    try {
      const { subscription } = await api.resumeSubscription(id);
      setMySubscriptions((prev) => prev.map((s) => (s.id === id ? subscription : s)));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  const cancelSubscription = async (id) => {
    try {
      const { subscription } = await api.cancelSubscription(id);
      setMySubscriptions((prev) => prev.map((s) => (s.id === id ? subscription : s)));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  // Real one-time lifetime Academy access -- fundamentally not a subscription (no recurring
  // charge, no pause/resume/cancel), so this is its own separate piece of state, not folded into
  // mySubscriptions above.
  const [hasLifetimeAccess, setHasLifetimeAccess] = useState(false);
  const [lifetimeAccessLoading, setLifetimeAccessLoading] = useState(true);
  const refetchLifetimeAccess = () => {
    if (!user) { setLifetimeAccessLoading(false); return; }
    setLifetimeAccessLoading(true);
    api.getMyLifetimeAccess()
      .then((body) => setHasLifetimeAccess(!!body.hasLifetimeAccess))
      .catch(() => {})
      .finally(() => setLifetimeAccessLoading(false));
  };
  useEffect(() => {
    if (user) refetchLifetimeAccess();
    else { setHasLifetimeAccess(false); setLifetimeAccessLoading(false); }
  }, [user && user.email]);
  const purchaseLifetimeAccess = async (reference) => {
    try {
      await api.purchaseLifetimeAccess(reference);
      setHasLifetimeAccess(true);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  return (
    <SubscriptionsCtx.Provider
      value={{
        mySubscriptions, mySubscriptionsLoading, mySubscriptionsError, refetchMySubscriptions, createSubscription, pauseSubscription, resumeSubscription, cancelSubscription,
        hasLifetimeAccess, lifetimeAccessLoading, refetchLifetimeAccess, purchaseLifetimeAccess,
      }}
    >
      {children}
    </SubscriptionsCtx.Provider>
  );
}

export const useSubscriptions = () => useContext(SubscriptionsCtx);

export const AdminCtx = createContext(null);

export function AdminDataProvider({ children }) {
  const { user } = useAuth();
  const [realUsers, setRealUsers] = useState([]);
  const [realUsersLoading, setRealUsersLoading] = useState(true);
  const [realUsersError, setRealUsersError] = useState("");
  const refetchRealUsers = () => {
    if (!user) { setRealUsersLoading(false); return; }
    setRealUsersLoading(true);
    setRealUsersError("");
    api.getUsers()
      .then((body) => setRealUsers(pluck(body, "users", { array: true })))
      .catch((e) => {
        // A non-admin's token 403ing here is expected and not a real error -- their dashboard
        // access is already gated elsewhere, so surfacing "you're not allowed" for a section they
        // were never going to see serves no one. Anything else (network issue, a genuine 500) is
        // a real failure for an actual admin and should stay visible with a way to retry, not
        // fail the exact same silent way as the expected case.
        if (e.status !== 403) setRealUsersError(e.message);
      })
      .finally(() => setRealUsersLoading(false));
  };
  // Only fetch once there's actually a signed-in admin/staff user, not on every token change for
  // every visitor -- a plain customer's token would just get a 403 here for no benefit.
  useEffect(() => {
    if (user && (user.role === "super_admin" || user.role === "staff")) refetchRealUsers();
    else setRealUsersLoading(false);
  }, [user && user.role]);

  const [realOrders, setRealOrders] = useState([]);
  const [realOrdersLoading, setRealOrdersLoading] = useState(true);
  const [realOrdersError, setRealOrdersError] = useState("");
  const refetchRealOrders = () => {
    if (!user) { setRealOrdersLoading(false); return; }
    setRealOrdersLoading(true);
    setRealOrdersError("");
    api.getAllOrders()
      .then((body) => setRealOrders(pluck(body, "orders", { array: true })))
      .catch((e) => { if (e.status !== 403) setRealOrdersError(e.message); }) // same reasoning as realUsers above -- a non-admin 403ing here is expected, not a real error
      .finally(() => setRealOrdersLoading(false));
  };
  useEffect(() => {
    if (user && (user.role === "super_admin" || user.role === "staff")) refetchRealOrders();
    else setRealOrdersLoading(false);
  }, [user && user.role]);

  const [realSubscriptions, setRealSubscriptions] = useState([]);
  const [realSubscriptionsLoading, setRealSubscriptionsLoading] = useState(true);
  const [realSubscriptionsError, setRealSubscriptionsError] = useState("");
  const refetchRealSubscriptions = () => {
    if (!user) { setRealSubscriptionsLoading(false); return; }
    setRealSubscriptionsLoading(true);
    setRealSubscriptionsError("");
    api.getAllSubscriptions()
      .then((body) => setRealSubscriptions(pluck(body, "subscriptions", { array: true })))
      .catch((e) => { if (e.status !== 403) setRealSubscriptionsError(e.message); }) // same reasoning as realUsers/realOrders above
      .finally(() => setRealSubscriptionsLoading(false));
  };
  useEffect(() => {
    if (user && (user.role === "super_admin" || user.role === "staff")) refetchRealSubscriptions();
    else setRealSubscriptionsLoading(false);
  }, [user && user.role]);

  const [realLifetimeAccess, setRealLifetimeAccess] = useState([]);
  const [realLifetimeAccessLoading, setRealLifetimeAccessLoading] = useState(true);
  const [realLifetimeAccessError, setRealLifetimeAccessError] = useState("");
  const refetchRealLifetimeAccess = () => {
    if (!user) { setRealLifetimeAccessLoading(false); return; }
    setRealLifetimeAccessLoading(true);
    setRealLifetimeAccessError("");
    api.getAllLifetimeAccess()
      .then((body) => setRealLifetimeAccess(pluck(body, "lifetimeAccess", { array: true })))
      .catch((e) => { if (e.status !== 403) setRealLifetimeAccessError(e.message); })
      .finally(() => setRealLifetimeAccessLoading(false));
  };
  useEffect(() => {
    if (user && (user.role === "super_admin" || user.role === "staff")) refetchRealLifetimeAccess();
    else setRealLifetimeAccessLoading(false);
  }, [user && user.role]);

  // Real, backend-persisted feedback/reviews -- was purely local, in-memory state before this
  // (see ROADMAP.md). Exposed as feedbackList (the same name it always had) so AdminFeedback.jsx
  // and every other existing consumer keep working unchanged.
  const [feedbackList, setFeedbackList] = useState([]);
  const [feedbackListLoading, setFeedbackListLoading] = useState(true);
  const [feedbackListError, setFeedbackListError] = useState("");
  const refetchFeedbackList = () => {
    if (!user) { setFeedbackListLoading(false); return; }
    setFeedbackListLoading(true);
    setFeedbackListError("");
    api.getAllFeedback()
      .then((body) => setFeedbackList(pluck(body, "feedback", { array: true })))
      .catch((e) => { if (e.status !== 403) setFeedbackListError(e.message); })
      .finally(() => setFeedbackListLoading(false));
  };
  useEffect(() => {
    if (user && (user.role === "super_admin" || user.role === "staff")) refetchFeedbackList();
    else setFeedbackListLoading(false);
  }, [user && user.role]);

  const updateOrderStatus = async (orderId, status) => {
    try {
      await api.updateOrderStatus(orderId, status);
      refetchRealOrders();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  // Real refund via Paystack's own API, called only when an admin deliberately clicks it in Admin
  // Orders -- never automatic. Only succeeds for an order genuinely awaiting one
  // (payment_status = 'refund_pending', set when a customer cancels a paid order within the
  // cancellation window), enforced server-side, not just by hiding the button.
  const refundOrder = async (orderId) => {
    try {
      await api.refundOrder(orderId);
      refetchRealOrders();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  // Real product catalog, fetched once on app load -- unlike realUsers/realOrders (admin-only,
  // fetched conditionally), this is fetched unconditionally for every visitor, logged in or not,
  // since the Shop page and product browsing are core public-facing functionality, not an admin
  // concern. GET /products needs no auth at all.
  const [realProducts, setRealProducts] = useState([]);
  const [realProductsLoading, setRealProductsLoading] = useState(true);
  const [realProductsError, setRealProductsError] = useState("");
  const refetchRealProducts = () => {
    setRealProductsLoading(true);
    setRealProductsError("");
    api.getProducts()
      .then((body) => setRealProducts(pluck(body, "products", { array: true })))
      .catch((e) => setRealProductsError(e.message))
      .finally(() => setRealProductsLoading(false));
  };
  useEffect(() => { refetchRealProducts(); }, []);

  // Real Academy courses, fetched the same way as realProducts above -- replacing courseOverrides
  // (a purely local, in-memory patch that never persisted past a page refresh, the same
  // pre-migration pattern products themselves used to have) with real, backend-persisted data.
  const [realCourses, setRealCourses] = useState([]);
  const [realCoursesLoading, setRealCoursesLoading] = useState(true);
  const [realCoursesError, setRealCoursesError] = useState("");
  const refetchRealCourses = () => {
    setRealCoursesLoading(true);
    setRealCoursesError("");
    api.getCourses()
      .then((body) => setRealCourses(pluck(body, "courses", { array: true })))
      .catch((e) => setRealCoursesError(e.message))
      .finally(() => setRealCoursesLoading(false));
  };
  useEffect(() => { refetchRealCourses(); }, []);

  // Real green coffee (wholesale) catalog, fetched the same way as realProducts above --
  // unconditionally on app load, since the Green Coffee page is public-facing too, not admin-only.
  const [realGreenBeans, setRealGreenBeans] = useState([]);
  const [realGreenBeansLoading, setRealGreenBeansLoading] = useState(true);
  const [realGreenBeansError, setRealGreenBeansError] = useState("");
  const refetchRealGreenBeans = () => {
    setRealGreenBeansLoading(true);
    setRealGreenBeansError("");
    api.getGreenBeans()
      .then((body) => setRealGreenBeans(pluck(body, "greenBeans", { array: true })))
      .catch((e) => setRealGreenBeansError(e.message))
      .finally(() => setRealGreenBeansLoading(false));
  };
  useEffect(() => { refetchRealGreenBeans(); }, []);

  const [auditLog, setAuditLog] = useState([]);
  // Real, backend-persisted live chat -- was purely local, in-memory state before this (see
  // migrations/023_live_chat.sql for the full reasoning). Exposed as liveChats (the same name it
  // always had) so AdminLiveChat.jsx and every other existing consumer keep working unchanged --
  // they only ever read this as a plain array (.length, .map, .filter), same shape as before.
  const [liveChats, setLiveChats] = useState([]);
  const [liveChatsLoading, setLiveChatsLoading] = useState(true);
  const [liveChatsError, setLiveChatsError] = useState("");
  const refetchLiveChats = () => {
    if (!user) { setLiveChatsLoading(false); return; }
    setLiveChatsLoading(true);
    setLiveChatsError("");
    api.getAllLiveChats()
      .then((body) => setLiveChats(pluck(body, "chats", { array: true })))
      .catch((e) => { if (e.status !== 403) setLiveChatsError(e.message); })
      .finally(() => setLiveChatsLoading(false));
  };
  // A real, genuine bug this fixes: AdminLiveChat's own background poll (every 8s, while a real
  // admin might be mid-reply) was calling refetchLiveChats itself -- which sets liveChatsLoading
  // true on every single call, not just the first one. Since AdminLiveChat's render gates its
  // ENTIRE tree (including the reply <input> an admin is actively typing into) behind
  // `if (liveChatsLoading) return <p>Loading...</p>`, every poll tick was unmounting that input
  // and wiping whatever text was in it -- confirmed directly, a real admin reported exactly this:
  // the page "kept refreshing" before they could finish typing a reply. A silent, separate
  // refresh path fixes this correctly: it still updates the real data (so a new customer message
  // does appear), but never touches liveChatsLoading/liveChatsError, so it can't unmount anything
  // an admin is actively using. Errors are swallowed here deliberately -- a poll tick failing
  // silently and trying again in 8s is the right behavior for a background refresh; surfacing a
  // real error banner (and blowing away the admin's in-progress work) for a single missed poll
  // would be a worse real experience than just quietly retrying.
  const refetchLiveChatsSilently = () => {
    if (!user) return;
    api.getAllLiveChats()
      .then((body) => setLiveChats(pluck(body, "chats", { array: true })))
      .catch(() => {});
  };
  useEffect(() => {
    if (user && (user.role === "super_admin" || user.role === "staff")) refetchLiveChats();
    else setLiveChatsLoading(false);
  }, [user && user.role]);

  // Real, backend-persisted career applications -- see migrations/025_career_applications.sql
  // for the full reasoning. Public submission needs no auth (submitCareerApplication below);
  // only the admin-facing list/status-update needs it, same real split as live chat.
  const [careerApplications, setCareerApplications] = useState([]);
  const [careerApplicationsLoading, setCareerApplicationsLoading] = useState(true);
  const [careerApplicationsError, setCareerApplicationsError] = useState("");
  const refetchCareerApplications = () => {
    if (!user) { setCareerApplicationsLoading(false); return; }
    setCareerApplicationsLoading(true);
    setCareerApplicationsError("");
    api.getCareerApplications()
      .then((body) => setCareerApplications(pluck(body, "applications", { array: true })))
      .catch((e) => { if (e.status !== 403) setCareerApplicationsError(e.message); })
      .finally(() => setCareerApplicationsLoading(false));
  };
  useEffect(() => {
    if (user && (user.role === "super_admin" || user.role === "staff")) refetchCareerApplications();
    else setCareerApplicationsLoading(false);
  }, [user && user.role]);
  // A real, honest, returned {ok, error} shape -- same convention as every other real submit
  // function in this file (addFeedback, startChat, etc.) -- lets the real careers page show its
  // own genuine success/error state without this function needing to know anything about how
  // it's displayed.
  const submitCareerApplication = async (application) => {
    try {
      const { application: created } = await api.submitCareerApplication(application);
      return { ok: true, application: created };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  const setCareerApplicationStatus = async (id, status) => {
    try {
      const { application } = await api.setCareerApplicationStatus(id, status);
      setCareerApplications((prev) => prev.map((a) => (a.id === id ? application : a)));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  // Real, backend-persisted blog -- see migrations/026_blog_posts.sql for the full reasoning.
  // blogPosts is the real, PUBLIC list (published only, server-enforced) -- fetched
  // unconditionally on app load, same as realProducts, since a visitor (and Google's own
  // crawler) needs to see this with no sign-in at all. adminBlogPosts is the genuinely separate
  // admin editing queue (every real post regardless of status), only fetched for a real
  // signed-in admin/staff user.
  const [blogPosts, setBlogPosts] = useState([]);
  const [blogPostsLoading, setBlogPostsLoading] = useState(true);
  useEffect(() => {
    api.getBlogPosts()
      .then((body) => setBlogPosts(pluck(body, "posts", { array: true })))
      .catch(() => {})
      .finally(() => setBlogPostsLoading(false));
  }, []);

  const [adminBlogPosts, setAdminBlogPosts] = useState([]);
  const [adminBlogPostsLoading, setAdminBlogPostsLoading] = useState(true);
  const [adminBlogPostsError, setAdminBlogPostsError] = useState("");
  const refetchAdminBlogPosts = () => {
    if (!user) { setAdminBlogPostsLoading(false); return; }
    setAdminBlogPostsLoading(true);
    setAdminBlogPostsError("");
    api.getAllBlogPostsAdmin()
      .then((body) => setAdminBlogPosts(pluck(body, "posts", { array: true })))
      .catch((e) => { if (e.status !== 403) setAdminBlogPostsError(e.message); })
      .finally(() => setAdminBlogPostsLoading(false));
  };
  useEffect(() => {
    if (user && (user.role === "super_admin" || user.role === "staff")) refetchAdminBlogPosts();
    else setAdminBlogPostsLoading(false);
  }, [user && user.role]);

  const createBlogPost = async (post) => {
    try {
      const { post: created } = await api.createBlogPost(post);
      setAdminBlogPosts((prev) => [created, ...prev]);
      return { ok: true, post: created };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  const updateBlogPost = async (id, patch) => {
    try {
      const { post: updated } = await api.updateBlogPost(id, patch);
      setAdminBlogPosts((prev) => prev.map((p) => (p.id === id ? updated : p)));
      // A real, published post edited from the admin side should reflect immediately in the
      // real, public blogPosts list too (e.g. a typo fix going live right away), not require a
      // full page reload to show up -- this keeps both real lists in sync from the one
      // successful write, rather than silently letting the public list go stale until the next
      // unconditional refetch.
      setBlogPosts((prev) => {
        const stillPublished = updated.status === "Published";
        const alreadyThere = prev.some((p) => p.id === id);
        if (stillPublished && alreadyThere) return prev.map((p) => (p.id === id ? updated : p));
        if (stillPublished && !alreadyThere) return [updated, ...prev].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
        return prev.filter((p) => p.id !== id); // moved back to Draft -- no longer real/public
      });
      return { ok: true, post: updated };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  const deleteBlogPost = async (id) => {
    try {
      await api.deleteBlogPost(id);
      setAdminBlogPosts((prev) => prev.filter((p) => p.id !== id));
      setBlogPosts((prev) => prev.filter((p) => p.id !== id));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  const [momentOverrides, setMomentOverrides] = useState({});
  const [courseOverrides, setCourseOverrides] = useState({});
  const [countryHistoryOverrides, setCountryHistoryOverrides] = useState({});
  // Real business settings, fetched the same way as realProducts/realGreenBeans above --
  // unconditionally on app load, since the announcement banner and structured data (business
  // name, contact info) are shown to every visitor, not gated behind an admin/staff role.
  // DEFAULT_SETTINGS is still the *initial* value here, purely to avoid a flash of empty content
  // for the very first render before the real fetch resolves -- it's immediately replaced by the
  // real, fetched settings once that completes, same reasoning as any other loading state.
  const [settings, setSettingsState] = useState(DEFAULT_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState("");
  const refetchSettings = () => {
    setSettingsLoading(true);
    setSettingsError("");
    api.getSettings()
      .then((body) => setSettingsState(pluck(body, "settings")))
      .catch((e) => setSettingsError(e.message))
      .finally(() => setSettingsLoading(false));
  };
  useEffect(() => { refetchSettings(); }, []);

  const logAction = (action, detail) => {
    setAuditLog((prev) =>
      [
        { id: `${Date.now()}-${Math.random()}`, timestamp: new Date().toISOString(), actor: user?.email || "unknown", action, detail },
        ...prev,
      ].slice(0, 200) // cap history so this can't grow unbounded in a long admin session
    );
  };

  const getPrice = (id) => {
    const p = realProducts.find((p) => p.id === id);
    return p ? p.priceCents : 0;
  };
  // getPrice above stays exactly what it always was (the 1kg price) -- this is a separate,
  // additive helper for the one real new place a size actually gets chosen (Shop's product
  // cards, the product detail page), rather than changing what getPrice(id) means everywhere
  // else in the app (Home, Moments, BrewGuides, Growing, WorldJourney, etc. all keep working
  // unchanged). See src/data/index.js's own comment on why the multiplier math itself lives
  // there, and why the backend has its own matching copy.
  const getPriceForSize = (id, sizeId) => priceForSize(getPrice(id), sizeId);
  const setPrice = async (id, cents) => {
    try {
      await api.updateProduct(id, { priceCents: cents });
      refetchRealProducts();
      logAction("Price changed", `${id} → ${fmtPrice(cents)}`);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  // General-purpose product edit -- unlike setPrice/setStock/setTier above (each narrow,
  // single-field wrappers), this accepts an arbitrary partial patch, for the full "Edit details"
  // form (name, country, tier, price, stock, tags, note, growing, photo all at once). The
  // backend's PATCH /products/:id already genuinely supported this for every field; this was
  // purely a missing frontend capability -- there was previously no way to fix a product's name,
  // country, or tier at all once created, only price/stock/photo.
  const updateProductDetails = async (id, patch) => {
    try {
      await api.updateProduct(id, patch);
      refetchRealProducts();
      logAction("Product details updated", id);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  const getTier = (id) => {
    const p = realProducts.find((p) => p.id === id);
    return p ? p.tier : "everyday";
  };
  const setTier = async (id, tier) => {
    try {
      await api.updateProduct(id, { tier });
      refetchRealProducts();
      logAction("Tier changed", `${id} → ${tier}`);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  // Handles both real retail products and real green beans (as of this round, both are genuinely
  // backed by the database) -- still has to dispatch based on which list an id belongs to, since
  // they're two separate tables with two separate update endpoints, not one shared mechanism.
  const getStock = (id) => {
    const p = realProducts.find((p) => p.id === id);
    if (p) return p.stock;
    const g = realGreenBeans.find((g) => g.id === id);
    return g ? g.stockKg : 0;
  };
  const setStock = async (id, qty) => {
    const safeQty = Math.max(0, qty);
    const isRealProduct = realProducts.some((p) => p.id === id);
    try {
      if (isRealProduct) {
        await api.updateProduct(id, { stock: safeQty });
        refetchRealProducts();
      } else {
        await api.updateGreenBean(id, { stockKg: safeQty });
        refetchRealGreenBeans();
      }
      logAction("Stock updated", `${id} → ${safeQty} units`);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  // Live product catalog -- now the real thing from the database, not the old static list plus
  // client-side-only overrides. Curated/editorial placements (Home's featured tiers, Moments' and
  // Brew Guides' matched-product suggestions, Growing Library, World Journey) deliberately keep
  // reading the original static PRODUCTS import directly instead of this function, unchanged from
  // before -- exactly like a homepage "featured" section on a real store doesn't auto-update the
  // instant a catalog change happens elsewhere. That split was already true before this migration
  // and stays true now.
  const getAllProducts = () => realProducts;
  const setProductPhoto = async (id, dataUrl) => {
    try {
      await api.updateProduct(id, { photoUrl: dataUrl });
      refetchRealProducts();
      logAction("Product photo updated", id);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  const addProduct = async (data) => {
    try {
      const { product } = await api.createProduct(data);
      refetchRealProducts();
      logAction("Product added", `${data.name} — ${data.country}`);
      return { product };
    } catch (e) {
      return { error: e.message };
    }
  };
  const removeProduct = async (id) => {
    try {
      await api.deleteProduct(id);
      refetchRealProducts();
      logAction("Product discontinued", id);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  // A simple, stateless wrapper, not global/cached state like realProducts above -- this is
  // inherently per-product-page-visit data (only ever needed by whichever product a visitor is
  // actually looking at right now), so the caller (ProductPage) owns its own loading state and
  // calls this directly in its own effect, rather than this context managing it.
  const getProductFeedback = async (productId) => {
    const body = await api.getProductFeedback(productId);
    return Array.isArray(body && body.feedback) ? body.feedback : [];
  };

  // Real Academy course admin actions, mirroring the equivalent product functions exactly.
  const getAllCourses = () => realCourses;
  const addCourse = async (data) => {
    try {
      const { course } = await api.createCourse(data);
      refetchRealCourses();
      logAction("Course added", data.name);
      return { course };
    } catch (e) {
      return { error: e.message };
    }
  };
  const updateCourseDetails = async (id, patch) => {
    try {
      await api.updateCourse(id, patch);
      refetchRealCourses();
      logAction("Course details updated", id);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  const removeCourse = async (id) => {
    try {
      await api.deleteCourse(id);
      refetchRealCourses();
      logAction("Course discontinued", id);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  // Real per-course lesson content -- fetched on demand per course, not preloaded alongside the
  // course list itself, the same reasoning getProductFeedback above is fetched on demand rather
  // than bundled into getAllProducts: most views of the course catalog never need any course's
  // actual lesson list, only CoursePage does, for the one course being viewed.
  const getCourseChapters = async (courseId) => {
    const body = await api.getChapters(courseId);
    return Array.isArray(body && body.chapters) ? body.chapters : [];
  };
  const addChapter = async (courseId, data) => {
    try {
      const { chapter } = await api.createChapter(courseId, data);
      logAction("Chapter added", `${courseId} — ${data.title}`);
      return { chapter };
    } catch (e) {
      return { error: e.message };
    }
  };
  const updateChapterDetails = async (id, patch) => {
    try {
      const { chapter } = await api.updateChapter(id, patch);
      logAction("Chapter updated", id);
      return { ok: true, chapter };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  const removeChapter = async (id) => {
    try {
      await api.deleteChapter(id);
      logAction("Chapter removed", id);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  // Real, access-gated lesson content -- fetched only when a visitor actually clicks to download
  // a specific lesson, same on-demand reasoning as getCourseChapters and getQuiz above.
  const getChapterContent = async (chapterId) => {
    try {
      const body = await api.getChapterContent(chapterId);
      return { ok: true, ...body };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  const getChapterContentAdmin = async (chapterId) => {
    try {
      const body = await api.getChapterContentAdmin(chapterId);
      return { ok: true, ...body };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  // Real quizzes -- quizExists is public (no token needed, matches the backend's own public
  // /exists route), but the real questions, submission, and attempt history all require a real,
  // signed-in user, since access itself is gated server-side on that user's real subscription or
  // lifetime access, not just cosmetically hidden client-side.
  const quizExists = async (chapterId) => {
    const body = await api.getQuizExists(chapterId);
    return !!(body && body.exists);
  };
  const getQuiz = async (chapterId) => {
    const body = await api.getQuiz(chapterId);
    return Array.isArray(body && body.questions) ? body.questions : [];
  };
  const submitQuiz = async (chapterId, answers) => {
    try {
      const body = await api.submitQuiz(chapterId, answers);
      return { ok: true, ...body };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  const getMyQuizAttempts = async (chapterId) => {
    const body = await api.getMyQuizAttempts(chapterId);
    return Array.isArray(body && body.attempts) ? body.attempts : [];
  };
  const getQuizQuestionsAdmin = async (chapterId) => {
    const body = await api.getQuizQuestionsAdmin(chapterId);
    return Array.isArray(body && body.questions) ? body.questions : [];
  };
  const addQuizQuestion = async (chapterId, data) => {
    try {
      const { question } = await api.createQuizQuestion(chapterId, data);
      logAction("Quiz question added", chapterId);
      return { question };
    } catch (e) {
      return { error: e.message };
    }
  };
  const updateQuizQuestionDetails = async (id, patch) => {
    try {
      const { question } = await api.updateQuizQuestion(id, patch);
      logAction("Quiz question updated", id);
      return { ok: true, question };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  const removeQuizQuestion = async (id) => {
    try {
      await api.deleteQuizQuestion(id);
      logAction("Quiz question removed", id);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  // Real certificates -- eligibility and issuance both require a signed-in user (checked
  // server-side against real quiz attempts and real course access, never trusted from the
  // client). Verifying a certificate's code, by contrast, is public and doesn't go through this
  // provider at all -- see api.verifyCertificate, called directly from the public verify page.
  const getCertificateEligibility = async (courseId) => {
    try {
      return await api.getCertificateEligibility(courseId);
    } catch {
      return { eligible: false, assessedChapterCount: 0, passedChapterCount: 0 };
    }
  };
  const issueCertificate = async (courseId) => {
    try {
      const { certificate } = await api.issueCertificate(courseId);
      return { ok: true, certificate };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  const getMyCertificates = async () => {
    const body = await api.getMyCertificates();
    return Array.isArray(body && body.certificates) ? body.certificates : [];
  };

  // Real progress stats -- XP, level, streak, and badges are all computed server-side from real
  // quiz_attempts and certificates rows, not stored anywhere separately, so there's nothing here
  // that can ever drift out of sync with what a user actually did.
  const getAcademyStats = async () => {
    try {
      return await api.getAcademyStats();
    } catch {
      return null;
    }
  };

  const getAllGreenBeans = () => realGreenBeans;
  const addGreenBean = async (data) => {
    try {
      const { greenBean } = await api.createGreenBean(data);
      refetchRealGreenBeans();
      logAction("Green bean lot added", `${data.name} — ${data.country}`);
      return { bean: greenBean };
    } catch (e) {
      return { error: e.message };
    }
  };
  const removeGreenBean = async (id) => {
    try {
      await api.deleteGreenBean(id);
      refetchRealGreenBeans();
      logAction("Green bean lot discontinued", id);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  // Green bean (wholesale) pricing — kept separate from getPrice/setPrice above since the units
  // are genuinely different (per-kg wholesale vs. per-bag retail), so mixing them into one
  // function would risk silently applying a retail price where a bulk price belongs.
  const getGreenPrice = (id) => {
    const g = realGreenBeans.find((g) => g.id === id);
    return g ? g.pricePerKgCents : 0;
  };
  const setGreenPrice = async (id, cents) => {
    try {
      await api.updateGreenBean(id, { pricePerKgCents: cents });
      refetchRealGreenBeans();
      logAction("Green bean price changed", `${id} → ${fmtPrice(cents)}/kg`);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  // Real, backend-persisted green coffee wholesale orders -- previously pure local React state
  // (see migrations/006_green_beans.sql's own comment, which documented this exact gap from an
  // earlier round: green_beans, the catalog, got a real migration; green_orders never did). A
  // real order request now genuinely reaches the backend, gets its price recomputed server-side
  // from the live green_beans table (never trusting whatever the client's own preview
  // calculation sent), and is visible to every admin, not just whoever's browser tab submitted
  // it.
  const [greenOrders, setGreenOrders] = useState([]);
  const [greenOrdersLoading, setGreenOrdersLoading] = useState(true);
  const [greenOrdersError, setGreenOrdersError] = useState("");
  const refetchGreenOrders = () => {
    if (!user) { setGreenOrdersLoading(false); return; }
    setGreenOrdersLoading(true);
    setGreenOrdersError("");
    api.getGreenOrders()
      .then((body) => setGreenOrders(pluck(body, "orders", { array: true })))
      .catch((e) => { if (e.status !== 403) setGreenOrdersError(e.message); })
      .finally(() => setGreenOrdersLoading(false));
  };
  useEffect(() => {
    if (user && (user.role === "super_admin" || user.role === "staff")) refetchGreenOrders();
    else setGreenOrdersLoading(false);
  }, [user && user.role]);
  const addGreenOrder = async (o) => {
    try {
      const { order } = await api.submitGreenOrder(o);
      return { ok: true, order };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  const updateGreenOrderStatus = async (id, status) => {
    try {
      const { order } = await api.setGreenOrderStatus(id, status);
      setGreenOrders((prev) => prev.map((o) => (o.id === id ? order : o)));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  // Real, backend-persisted now -- these three used to only update local React state (see
  // ROADMAP.md), meaning an edit looked like it worked in the same tab but never actually reached
  // any other visitor, or even the same admin after a page refresh. Now genuinely part of
  // settings, the same real, shared value the homepage and Kenya's country page both read.
  const addKenyaMessage = async (msg) => {
    const updated = [...(settings.kenyaLiveMessages || []), msg];
    const result = await setSettings({ kenyaLiveMessages: updated });
    logAction("Live message added", msg);
    return result;
  };
  const updateKenyaMessage = async (i, msg) => {
    const updated = (settings.kenyaLiveMessages || []).map((m, idx) => (idx === i ? msg : m));
    const result = await setSettings({ kenyaLiveMessages: updated });
    logAction("Live message edited", msg);
    return result;
  };
  const removeKenyaMessage = async (i) => {
    const updated = (settings.kenyaLiveMessages || []).filter((_, idx) => idx !== i);
    const result = await setSettings({ kenyaLiveMessages: updated });
    logAction("Live message removed", `index ${i}`);
    return result;
  };

  // Real, backend-persisted quotations and service inquiries -- both previously pure local React
  // state, discovered alongside green_orders during a direct audit of this codebase (both had
  // real permission names and a real, working admin UI, but no backend at all behind either).
  const [quotations, setQuotations] = useState([]);
  const [quotationsLoading, setQuotationsLoading] = useState(true);
  const [quotationsError, setQuotationsError] = useState("");
  const refetchQuotations = () => {
    if (!user) { setQuotationsLoading(false); return; }
    setQuotationsLoading(true);
    setQuotationsError("");
    api.getQuotations()
      .then((body) => setQuotations(pluck(body, "quotations", { array: true })))
      .catch((e) => { if (e.status !== 403) setQuotationsError(e.message); })
      .finally(() => setQuotationsLoading(false));
  };
  useEffect(() => {
    if (user && (user.role === "super_admin" || user.role === "staff")) refetchQuotations();
    else setQuotationsLoading(false);
  }, [user && user.role]);
  const addQuotation = async (q) => {
    try {
      const { quotation } = await api.submitQuotation(q);
      return { ok: true, quotation };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  const updateQuotationStatus = async (id, status) => {
    try {
      const { quotation } = await api.setQuotationStatus(id, status);
      setQuotations((prev) => prev.map((q) => (q.id === id ? quotation : q)));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  const [serviceInquiries, setServiceInquiries] = useState([]);
  const [serviceInquiriesLoading, setServiceInquiriesLoading] = useState(true);
  const [serviceInquiriesError, setServiceInquiriesError] = useState("");
  const refetchServiceInquiries = () => {
    if (!user) { setServiceInquiriesLoading(false); return; }
    setServiceInquiriesLoading(true);
    setServiceInquiriesError("");
    api.getServiceInquiries()
      .then((body) => setServiceInquiries(pluck(body, "inquiries", { array: true })))
      .catch((e) => { if (e.status !== 403) setServiceInquiriesError(e.message); })
      .finally(() => setServiceInquiriesLoading(false));
  };
  useEffect(() => {
    if (user && (user.role === "super_admin" || user.role === "staff")) refetchServiceInquiries();
    else setServiceInquiriesLoading(false);
  }, [user && user.role]);
  const addServiceInquiry = async (s) => {
    try {
      const { inquiry } = await api.submitServiceInquiry(s);
      return { ok: true, inquiry };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  const updateServiceInquiryStatus = async (id, status) => {
    try {
      const { inquiry } = await api.setServiceInquiryStatus(id, status);
      setServiceInquiries((prev) => prev.map((s) => (s.id === id ? inquiry : s)));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  const setServiceInquiryFee = async (id, agreedFeeCents) => {
    try {
      const { inquiry } = await api.setServiceInquiryFee(id, agreedFeeCents);
      setServiceInquiries((prev) => prev.map((s) => (s.id === id ? inquiry : s)));
      logAction("Consultation fee set", `${id} → ${fmtPrice(agreedFeeCents)}`);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  // Real, backend-persisted general contact messages -- previously the ContactPage form's own
  // onSubmit never called any real API at all, just setSent(true); every message anyone sent
  // was silently discarded the instant the tab closed. Found during the same audit as
  // quotations/service_inquiries/green_orders. Uses the "Feedback" admin permission rather than
  // a new dedicated one -- a real, deliberate choice for a genuinely small, single-purpose inbox
  // with no multi-stage workflow of its own.
  const [contactMessages, setContactMessages] = useState([]);
  const [contactMessagesLoading, setContactMessagesLoading] = useState(true);
  const [contactMessagesError, setContactMessagesError] = useState("");
  const refetchContactMessages = () => {
    if (!user) { setContactMessagesLoading(false); return; }
    setContactMessagesLoading(true);
    setContactMessagesError("");
    api.getContactMessages()
      .then((body) => setContactMessages(pluck(body, "messages", { array: true })))
      .catch((e) => { if (e.status !== 403) setContactMessagesError(e.message); })
      .finally(() => setContactMessagesLoading(false));
  };
  useEffect(() => {
    if (user && (user.role === "super_admin" || user.role === "staff")) refetchContactMessages();
    else setContactMessagesLoading(false);
  }, [user && user.role]);
  const submitContactMessage = async (msg) => {
    try {
      const { message } = await api.submitContactMessage(msg);
      return { ok: true, message };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  const setContactMessageRead = async (id, read) => {
    try {
      const { message } = await api.setContactMessageRead(id, read);
      setContactMessages((prev) => prev.map((m) => (m.id === id ? message : m)));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  // Real, backend-persisted live chat -- previously synchronous (a bare local-state write,
  // returning a fake id immediately). Every real call now needs to be a genuine network request,
  // so this is async now, awaited by LiveChatPanel (src/components/index.jsx), rather than the
  // fire-and-forget pattern the fake version could get away with. Returns { ok, chat } / { ok:
  // false, error }, same real convention as addFeedback/toggleFeedbackReviewed above.
  const startChat = async (customerName, customerEmail) => {
    try {
      const { chat } = await api.startLiveChat(customerName, customerEmail);
      return { ok: true, chat };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  // The narrow, one-time real greeting endpoint (see server's own route comment for why this
  // isn't just sendChatMessage(id, "agent", ...) anymore -- an anonymous caller genuinely
  // shouldn't be able to post as "agent" freely, only this one specific, real first message).
  const sendLiveChatGreeting = async (chatId, text) => {
    try {
      const { chat } = await api.sendLiveChatGreeting(chatId, text);
      return { ok: true, chat };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  // The customer's own real message -- always lands as sender "user" server-side regardless of
  // what's sent here (see live-chat.js's own comment), so there's no sender argument anymore.
  const sendChatMessage = async (chatId, text) => {
    try {
      const { chat } = await api.sendLiveChatMessage(chatId, text);
      return { ok: true, chat };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  // A real admin's own reply -- a genuinely different real action from a customer's own message
  // above (different route, auth-gated, sender is always "agent" server-side).
  const replyToLiveChat = async (chatId, text) => {
    try {
      const { chat } = await api.replyToLiveChat(chatId, text);
      setLiveChats((prev) => prev.map((c) => (c.id === chatId ? chat : c)));
      return { ok: true, chat };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  const updateChatStatus = async (chatId, status) => {
    try {
      const { chat } = await api.setLiveChatStatus(chatId, status);
      setLiveChats((prev) => prev.map((c) => (c.id === chatId ? chat : c)));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  // Public, anonymous submission -- no token needed, matching the real, existing "Leave Your
  // Aroma" UX (never asked for a name or login before this either). Doesn't touch feedbackList
  // (the admin-wide moderation list) at all -- a regular customer submitting a review has no
  // access to that data in the first place, only admin does.
  const addFeedback = async (f) => {
    try {
      const { feedback } = await api.submitFeedback(f);
      return { ok: true, feedback };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  const toggleFeedbackReviewed = async (id) => {
    try {
      const current = feedbackList.find((f) => f.id === id);
      const { feedback } = await api.setFeedbackReviewed(id, !(current && current.reviewed));
      setFeedbackList((prev) => prev.map((f) => (f.id === id ? feedback : f)));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  // Real, backend-persisted newsletter subscribers -- same public/anonymous submission and
  // admin-gated list pattern as feedback above, not client-only state (a subscriber who typed
  // their email into the footer form genuinely needs it to survive their next page load).
  const addNewsletterSubscriber = async (s) => {
    try {
      const { subscriber } = await api.subscribeNewsletter(s);
      return { ok: true, subscriber };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  const [newsletterSubscribers, setNewsletterSubscribers] = useState([]);
  const [newsletterSubscribersLoading, setNewsletterSubscribersLoading] = useState(true);
  const refetchNewsletterSubscribers = () => {
    if (!user) { setNewsletterSubscribersLoading(false); return; }
    setNewsletterSubscribersLoading(true);
    api.getNewsletterSubscribers()
      .then((body) => setNewsletterSubscribers(pluck(body, "subscribers", { array: true })))
      .catch(() => {})
      .finally(() => setNewsletterSubscribersLoading(false));
  };
  useEffect(() => {
    if (user && (user.role === "super_admin" || user.role === "staff")) refetchNewsletterSubscribers();
    else setNewsletterSubscribersLoading(false);
  }, [user && user.role]);

  const getMomentContent = (m) => ({ ...m, ...(momentOverrides[m.id] || {}) });
  const setMomentContent = (id, patch) => {
    setMomentOverrides((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));
    logAction("Moment content edited", id);
  };

  const getCourseContent = (c) => ({ ...c, ...(courseOverrides[c.name] || {}) });
  const setCourseContent = (name, patch) => {
    setCourseOverrides((prev) => ({ ...prev, [name]: { ...(prev[name] || {}), ...patch } }));
    logAction("Course content edited", name);
  };

  const getCountryHistory = (countryName) => countryHistoryOverrides[countryName] ?? COUNTRY_HISTORY[countryName];
  const setCountryHistory = (countryName, text) => {
    setCountryHistoryOverrides((prev) => ({ ...prev, [countryName]: text }));
    logAction("Country history edited", countryName);
  };

  const setSettings = async (patch) => {
    try {
      const { settings: updated } = await api.updateSettings(patch);
      setSettingsState(updated);
      logAction("Settings updated", Object.keys(patch).join(", "));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  // Client-side equivalent of a database backup, since there's no real database here to back up
  // for what's STILL genuinely in-memory only. Retail products, quotations, service inquiries,
  // green orders, and live chats are all real now (Postgres) -- same reasoning already applied
  // when users and orders became real: a live database needs its own real backup strategy
  // (Railway's own database backups), not an ad-hoc JSON download. Removed from both this export
  // and the restore below, the same real audit that closed the quotations/service-inquiries/
  // green-orders gap also caught that liveChats had been left in this list since it went real
  // earlier this session -- exporting it suggested a real backup that Railway's own database
  // backups already do properly, and "restoring" it would have silently overwritten real,
  // fetched state with stale JSON, with zero actual effect on the real database.
  const exportAdminData = () => ({
    auditLog,
    momentOverrides, courseOverrides, countryHistoryOverrides,
  });
  // Restores each piece independently rather than one big setState -- if the uploaded file is
  // missing a key (an older export, or a hand-edited partial file), that specific piece is simply
  // left as-is instead of the whole restore failing or wiping something the file didn't mention.
  const restoreAdminData = (data) => {
    if (!data || typeof data !== "object") return;
    if (Array.isArray(data.auditLog)) setAuditLog(data.auditLog);
    if (data.momentOverrides) setMomentOverrides(data.momentOverrides);
    if (data.courseOverrides) setCourseOverrides(data.courseOverrides);
    if (data.countryHistoryOverrides) setCountryHistoryOverrides(data.countryHistoryOverrides);
    logAction("Backup restored", `${Object.keys(data).length} data sets`);
  };

  return (
    <AdminCtx.Provider
      value={{
        getPrice, getPriceForSize, setPrice, updateProductDetails,
        getTier, setTier,
        realUsers, realUsersLoading, realUsersError, refetchRealUsers,
        realOrders, realOrdersLoading, realOrdersError, refetchRealOrders, updateOrderStatus, refundOrder,
        realSubscriptions, realSubscriptionsLoading, realSubscriptionsError, refetchRealSubscriptions,
        realLifetimeAccess, realLifetimeAccessLoading, realLifetimeAccessError, refetchRealLifetimeAccess,
        getStock, setStock,
        getAllProducts, addProduct, removeProduct, setProductPhoto,
        realProductsLoading, realProductsError, refetchRealProducts, getProductFeedback,
        getAllCourses, addCourse, updateCourseDetails, removeCourse,
        getCourseChapters, addChapter, updateChapterDetails, removeChapter, getChapterContent, getChapterContentAdmin,
        quizExists, getQuiz, submitQuiz, getMyQuizAttempts, getQuizQuestionsAdmin, addQuizQuestion, updateQuizQuestionDetails, removeQuizQuestion,
        getCertificateEligibility, issueCertificate, getMyCertificates, getAcademyStats,
        realCoursesLoading, realCoursesError, refetchRealCourses,
        getGreenPrice, setGreenPrice,
        getAllGreenBeans, addGreenBean, removeGreenBean,
        realGreenBeansLoading, realGreenBeansError, refetchRealGreenBeans,
        greenOrders, greenOrdersLoading, greenOrdersError, refetchGreenOrders, addGreenOrder, updateGreenOrderStatus,
        auditLog,
        kenyaMessages: settings.kenyaLiveMessages || [], addKenyaMessage, updateKenyaMessage, removeKenyaMessage,
        quotations, quotationsLoading, quotationsError, refetchQuotations, addQuotation, updateQuotationStatus,
        serviceInquiries, serviceInquiriesLoading, serviceInquiriesError, refetchServiceInquiries, addServiceInquiry, updateServiceInquiryStatus, setServiceInquiryFee,
        contactMessages, contactMessagesLoading, contactMessagesError, refetchContactMessages, submitContactMessage, setContactMessageRead,
        liveChats, liveChatsLoading, liveChatsError, refetchLiveChats, refetchLiveChatsSilently,
        careerApplications, careerApplicationsLoading, careerApplicationsError, refetchCareerApplications, submitCareerApplication, setCareerApplicationStatus,
        blogPosts, blogPostsLoading, adminBlogPosts, adminBlogPostsLoading, adminBlogPostsError, refetchAdminBlogPosts, createBlogPost, updateBlogPost, deleteBlogPost,
        startChat, sendLiveChatGreeting, sendChatMessage, replyToLiveChat, updateChatStatus,
        feedbackList, addFeedback, toggleFeedbackReviewed,
        newsletterSubscribers, newsletterSubscribersLoading, addNewsletterSubscriber, refetchNewsletterSubscribers,
        getMomentContent, setMomentContent, momentOverrides,
        getCourseContent, setCourseContent, courseOverrides,
        getCountryHistory, setCountryHistory,
        settings, setSettings, settingsLoading, settingsError, refetchSettings,
        exportAdminData, restoreAdminData,
      }}
    >
      {children}
    </AdminCtx.Provider>
  );
}

export const useAdmin = () => useContext(AdminCtx);

export const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const addToast = (message) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200);
  };
  return (
    <ToastCtx.Provider value={{ addToast }}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <span className="bean-shape toast-bean" /> {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

// --- Currency: auto-detected local currency + live exchange rates ---
// Prices are stored (and remain, everywhere in Admin) in USD cents — this is purely a display
// layer for the customer-facing storefront. Rates come from a free, no-API-key endpoint
// (open.er-api.com); if that fetch fails for any reason, `rates` stays {USD: 1} and format()
// correctly falls back to showing USD rather than a broken or wrong conversion.
export const CurrencyCtx = createContext(null);

// A real, reasonably broad fallback for the most common regions this app's visitors are likely
// to be in -- not exhaustive (Intl doesn't expose a built-in region->currency mapping), but
// covers East Africa specifically (this is a Kenya-based business) plus the world's other major
// currencies, so the fallback below is genuinely useful, not just "give up and use USD".
const REGION_TO_CURRENCY = {
  KE: "KES", TZ: "TZS", UG: "UGX", RW: "RWF", ET: "ETB", BI: "BIF",
  US: "USD", GB: "GBP", CA: "CAD", AU: "AUD", NZ: "NZD",
  DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR", IE: "EUR", PT: "EUR",
  IN: "INR", JP: "JPY", CN: "CNY", ZA: "ZAR", NG: "NGN", GH: "GHS",
  BR: "BRL", MX: "MXN", CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK",
};

export function CurrencyProvider({ children }) {
  const [currency, setCurrency] = useState("USD");
  const [rates, setRates] = useState({ USD: 1 });
  const [ratesLoading, setRatesLoading] = useState(true);
  const [userChose, setUserChose] = useState(false); // once true, auto-detection never overrides the visitor's own pick

  useEffect(() => {
    fetch("https://open.er-api.com/v6/latest/USD")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("rate fetch failed"))))
      .then((data) => {
        if (data && data.rates) setRates(data.rates);
      })
      .catch(() => {
        /* keep the {USD: 1} default — format() below always degrades to correct USD pricing */
      })
      .finally(() => setRatesLoading(false));
  }, []);

  useEffect(() => {
    if (userChose) return;
    // A real, offline fallback -- doesn't depend on the geo-IP service (or any network call)
    // succeeding. The browser's own locale (e.g. "en-KE") is a genuine, if imperfect, signal for
    // region: not as reliable as a real IP-based lookup (a machine's configured region doesn't
    // always match where its user physically is -- confirmed directly during testing, where a
    // US-configured browser in Kenya still resolved to USD here too), but meaningfully better
    // than silently defaulting to USD every time the geo-IP service is unavailable.
    const localeFallback = () => {
      try {
        const region = new Intl.Locale(navigator.language).maximize().region;
        if (region && REGION_TO_CURRENCY[region]) setCurrency(REGION_TO_CURRENCY[region]);
      } catch {
        /* stays on USD — a reasonable, always-correct default */
      }
    };
    // ipwho.is, not the previously-used ipapi.co -- confirmed during real testing that ipapi.co
    // fails routinely (429 rate-limited, which also strips its CORS header, so the browser
    // reports it as a CORS failure). ipwho.is is HTTPS-capable (verified directly; many free
    // geo-IP services, e.g. ip-api.com, are HTTP-only and would silently fail on this app's real,
    // HTTPS production site even if they worked in local dev), needs no API key, and its free
    // tier's 1,000-request daily limit is far more generous than what was actually failing here.
    // Its free tier doesn't return a currency field directly, only country_code, so that's mapped
    // through the same REGION_TO_CURRENCY table the locale fallback above also uses.
    fetch("https://ipwho.is/")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("geo lookup failed"))))
      .then((data) => {
        if (data && data.success && data.country_code && REGION_TO_CURRENCY[data.country_code]) {
          setCurrency(REGION_TO_CURRENCY[data.country_code]);
        } else {
          localeFallback();
        }
      })
      .catch(localeFallback);
  }, [userChose]);

  const chooseCurrency = (code) => {
    setUserChose(true);
    setCurrency(code);
  };

  // Converts a USD-cents integer to the active currency and formats it via Intl.NumberFormat,
  // which knows each currency's correct symbol, decimal places, and separator conventions
  // natively — far more reliable than hand-rolling currency-specific formatting rules.
  const format = (usdCents) => {
    const usdAmount = (usdCents || 0) / 100;
    const effectiveCurrency = rates[currency] ? currency : "USD";
    const rate = rates[effectiveCurrency] || 1;
    const converted = usdAmount * rate;
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: effectiveCurrency }).format(converted);
    } catch {
      return `$${usdAmount.toFixed(2)}`;
    }
  };

  // A real, pre-existing display quirk this fixes: a cart/checkout total shown as the straight
  // currency-converted sum of raw USD cents can differ by the smallest display unit (a cent, a
  // shilling-cent, etc.) from what you get by adding up the SEPARATELY-ROUNDED lines a customer
  // actually sees above it -- each format() call above rounds its own conversion independently,
  // and rounding is not additive (round(a) + round(b) doesn't always equal round(a + b)). Genuinely
  // confirmed live: a 3-item KES cart (873.81 + 1,165.08 + 2,330.17 = 4,369.06) displayed a total
  // of 4,369.07. Call with the array of each line's own usdCents (not a pre-summed total) so this
  // can round each one exactly as its own displayed line already does, then sum those rounded
  // values -- guaranteeing the total a customer sees always exactly matches what the lines above
  // it add up to, which is the property that actually matters for a receipt to look trustworthy,
  // even though it means this total can differ by a cent from a pure USD->KES conversion of the
  // combined amount. Falls back to plain format() summing behavior if usdCentsArray isn't an array
  // (defensive; every real call site is being updated to pass an array, but this avoids a hard
  // crash if some caller doesn't).
  const formatSumOf = (usdCentsArray) => {
    if (!Array.isArray(usdCentsArray)) return format(usdCentsArray);
    const effectiveCurrency = rates[currency] ? currency : "USD";
    const rate = rates[effectiveCurrency] || 1;
    // Sums in integer display-currency CENTS, not floating-point currency units -- summing
    // rounded floats (e.g. 152.48 + 203.3 + 406.6) doesn't reliably land on an exact value in
    // IEEE 754 (genuinely reproduced: it can come out 762.3800000000001, not 762.38), which
    // Intl.NumberFormat would then render as an extra fractional digit or silently mis-round.
    // Rounding each line to the nearest integer cent FIRST, then summing those integers, and only
    // dividing back to currency units once at the very end, is the standard way to avoid
    // accumulating floating-point error in money math.
    const roundedSumCents = usdCentsArray.reduce((sum, usdCents) => {
      const convertedCents = ((usdCents || 0) / 100) * rate * 100;
      return sum + Math.round(convertedCents);
    }, 0);
    const roundedSum = roundedSumCents / 100;
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: effectiveCurrency }).format(roundedSum);
    } catch {
      return `$${roundedSum.toFixed(2)}`;
    }
  };

  return (
    <CurrencyCtx.Provider value={{ currency, rates, ratesLoading, chooseCurrency, format, formatSumOf }}>
      {children}
    </CurrencyCtx.Provider>
  );
}
export const useCurrency = () => useContext(CurrencyCtx);