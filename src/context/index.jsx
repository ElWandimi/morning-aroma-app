import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { COUNTRY_HISTORY, DEMO_ADMIN, GREEN_BEANS, KENYA_LIVE_MESSAGES_SEED, KNOWN_ROUTES, PAGE_TO_SLUG, PRODUCTS, SLUG_TO_PAGE } from "../data";
import { fmtPrice, getStorageConsent, logPageView, nameFromEmail, slugify, storage } from "../utils/helpers";
import { api } from "../utils/api";

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
  const [passwords, setPasswords] = useState({ [DEMO_ADMIN.email]: DEMO_ADMIN.password });
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingTwoFactorUser, setPendingTwoFactorUser] = useState(null);

  // On mount, try to restore a real session from a previously-saved token -- without this, a real
  // registered/logged-in user would be signed out every time they refresh the page, which is a
  // meaningfully worse experience than the old demo (which never persisted anything anyway, so
  // there was nothing to lose before). Gated behind the same storage-consent check as everything
  // else that touches localStorage in this app.
  useEffect(() => {
    if (getStorageConsent() !== "accepted") { setSessionLoading(false); return; }
    const saved = storage.get("ma_auth_token", null);
    if (!saved) { setSessionLoading(false); return; }
    api.me(saved)
      .then(({ user: realUser }) => { setUser(realUser); setToken(saved); })
      .catch(() => { storage.set("ma_auth_token", null); }) // expired/invalid token — fail silently, just stay signed out
      .finally(() => setSessionLoading(false));
  }, []);

  const persistToken = (newToken) => {
    setToken(newToken);
    if (getStorageConsent() === "accepted") storage.set("ma_auth_token", newToken);
  };

  const findOrCreateUser = (email, displayName) => {
    const clean = email.trim().toLowerCase();
    let found;
    setUsers((prev) => {
      const existing = prev.find((u) => u.email === clean);
      if (existing) {
        found = existing;
        return prev;
      }
      const created = { email: clean, name: displayName || nameFromEmail(clean), role: "customer", twoFactorEnabled: false, createdAt: new Date().toISOString().slice(0, 10), notificationsEnabled: true };
      found = created;
      return [...prev, created];
    });
    return found || { email: clean, name: displayName || nameFromEmail(clean), role: "customer", twoFactorEnabled: false, createdAt: new Date().toISOString().slice(0, 10), notificationsEnabled: true };
  };

  // Real registration against the actual backend. Returns { ok, error? } rather than throwing, so
  // the login modal can show a message inline without needing its own try/catch.
  const register = async (email, password, name) => {
    try {
      const { user: realUser, token: realToken } = await api.register(email, password, name);
      setError("");
      setUser(realUser);
      persistToken(realToken);
      return { ok: true };
    } catch (e) {
      setError(e.message);
      return { ok: false, error: e.message };
    }
  };

  // Real login against the actual backend. NOTE: this is now async (returns a Promise), unlike
  // the old demo version -- every call site needs to await it. 2FA is intentionally NOT part of
  // this real flow yet (the backend doesn't implement it) -- signs straight in on success.
  const login = async (email, password) => {
    try {
      const { user: realUser, token: realToken } = await api.login(email, password);
      setError("");
      setUser(realUser);
      persistToken(realToken);
      return { ok: true, requiresTwoFactor: false };
    } catch (e) {
      setError(e.message);
      return { ok: false };
    }
  };

  const completeTwoFactor = () => {
    if (!pendingTwoFactorUser) return;
    setUser(pendingTwoFactorUser);
    setPendingTwoFactorUser(null);
  };
  const cancelTwoFactor = () => setPendingTwoFactorUser(null);

  const setTwoFactorEnabled = (email, enabled) => {
    setUsers((prev) => prev.map((u) => (u.email === email ? { ...u, twoFactorEnabled: enabled } : u)));
    setUser((prev) => (prev && prev.email === email ? { ...prev, twoFactorEnabled: enabled } : prev));
  };
  // A real, honest preference rather than a promise -- this prototype has no email delivery
  // infrastructure, so nothing actually gets sent either way. The setting is genuinely saved
  // (persists on the account for the session) for whenever real notifications exist to send.
  const setNotificationsEnabled = (email, enabled) => {
    setUsers((prev) => prev.map((u) => (u.email === email ? { ...u, notificationsEnabled: enabled } : u)));
    setUser((prev) => (prev && prev.email === email ? { ...prev, notificationsEnabled: enabled } : prev));
  };

  // Still demo/local-only -- needs real email delivery to send the code, which isn't connected
  // yet (see ROADMAP.md Tier 2).
  const loginWithOtp = (email) => {
    const acct = findOrCreateUser(email);
    setUser(acct);
    setError("");
    return true;
  };

  // Still demo/local-only -- needs a real Google Cloud OAuth app (client ID/secret), which is a
  // manual setup step outside what Claude can do, not just more code.
  const loginWithGoogle = (email, displayName) => {
    const acct = findOrCreateUser(email, displayName);
    setUser(acct);
    setError("");
    return true;
  };

  const logout = () => {
    if (token) api.logout(token).catch(() => {}); // best-effort; stateless JWT means there's nothing to actually invalidate server-side yet
    setUser(null);
    persistToken(null);
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

  // Passwords live in a completely separate `passwords` state (not on the user objects
  // themselves), and this export deliberately never touches that state -- restoring accounts is
  // genuinely useful, but a downloadable file containing plaintext credentials isn't something to
  // build even in a prototype without a real security boundary.
  const exportUsers = () => users;
  const restoreUsers = (data) => { if (Array.isArray(data)) setUsers(data); };

  return (
    <AuthCtx.Provider
      value={{
        user, token, users, login, register, loginWithOtp, loginWithGoogle, logout, setRole, setPermissions, error, setError,
        pendingTwoFactorUser, completeTwoFactor, cancelTwoFactor, setTwoFactorEnabled, setNotificationsEnabled,
        exportUsers, restoreUsers, sessionLoading,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);

function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, "");
  if (!raw) return { page: "home" };
  const [slug, rawId] = raw.split("/");
  const page = SLUG_TO_PAGE[slug];
  if (!page || !KNOWN_ROUTES.has(page)) return { page: "home" };
  return rawId ? { page, id: decodeURIComponent(rawId) } : { page };
}
function buildHash(page, params) {
  const slug = PAGE_TO_SLUG[page] ?? page;
  const path = params.id ? `${slug}/${encodeURIComponent(params.id)}` : slug;
  return `#/${path}`;
}

export const RouteCtx = createContext(null);

export function RouteProvider({ children }) {
  const [route, setRoute] = useState(() => parseHash());

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => { logPageView(route.page); }, [route.page, route.id]);

  const go = (page, params = {}) => {
    const nextHash = buildHash(page, params);
    if (window.location.hash === nextHash) {
      // same destination (e.g. re-clicking a nav link) — hashchange won't fire, so update state directly
      setRoute({ page, ...params });
    } else {
      window.location.hash = nextHash;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return <RouteCtx.Provider value={{ route, go }}>{children}</RouteCtx.Provider>;
}

export const useRoute = () => useContext(RouteCtx);

export const CartCtx = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => storage.get("ma_cart", [])); // { id, qty }
  const [open, setOpen] = useState(false);
  useEffect(() => { if (getStorageConsent() === "accepted") storage.set("ma_cart", items); }, [items]);
  const { getPrice, getStock } = useAdmin();
  const add = (id, qty = 1) => {
    setItems((prev) => {
      const stock = getStock(id);
      const found = prev.find((i) => i.id === id);
      const current = found ? found.qty : 0;
      const nextQty = stock > 0 ? Math.min(current + qty, stock) : current + qty; // stock 0 handled by UI gating; don't hard-block here in case of stale admin state
      if (found) return prev.map((i) => (i.id === id ? { ...i, qty: nextQty } : i));
      return [...prev, { id, qty: nextQty }];
    });
    setOpen(true);
  };
  const updateQty = (id, qty) => {
    setItems((prev) => (qty <= 0 ? prev.filter((i) => i.id !== id) : prev.map((i) => (i.id === id ? { ...i, qty } : i))));
  };
  const remove = (id) => setItems((prev) => prev.filter((i) => i.id !== id));
  const clearCart = () => setItems([]);
  const count = items.reduce((sum, i) => sum + i.qty, 0);
  const totalCents = items.reduce((sum, i) => sum + getPrice(i.id) * i.qty, 0);
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
  const { token, user } = useAuth();
  const [myOrders, setMyOrders] = useState([]);
  const [myOrdersLoading, setMyOrdersLoading] = useState(true);
  const [myOrdersError, setMyOrdersError] = useState("");

  const refetchMyOrders = () => {
    if (!token) { setMyOrdersLoading(false); return; }
    setMyOrdersLoading(true);
    setMyOrdersError("");
    api.getMyOrders(token)
      .then(({ orders }) => setMyOrders(orders))
      .catch((e) => setMyOrdersError(e.message))
      .finally(() => setMyOrdersLoading(false));
  };
  useEffect(() => {
    if (user) refetchMyOrders();
    else { setMyOrders([]); setMyOrdersLoading(false); }
  }, [token, user && user.email]);

  // Both return { ok, order? / error? } rather than throwing, so callers (Checkout, Journey) can
  // show an inline error without needing their own try/catch around every call site.
  const createOrder = async (orderData) => {
    try {
      const { order } = await api.createOrder(token, orderData);
      setMyOrders((prev) => [order, ...prev]);
      return { ok: true, order };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  const cancelOrder = async (orderId) => {
    try {
      const { order } = await api.cancelOrder(token, orderId);
      setMyOrders((prev) => prev.map((o) => (o.id === orderId ? order : o)));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
  const verifyPayment = async (orderId, reference) => {
    try {
      const { order } = await api.verifyPayment(token, orderId, reference);
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

export const AdminCtx = createContext(null);

export function AdminDataProvider({ children }) {
  const { user, token } = useAuth();
  const [realUsers, setRealUsers] = useState([]);
  const [realUsersLoading, setRealUsersLoading] = useState(true);
  const [realUsersError, setRealUsersError] = useState("");
  const refetchRealUsers = () => {
    if (!token) { setRealUsersLoading(false); return; }
    setRealUsersLoading(true);
    setRealUsersError("");
    api.getUsers(token)
      .then(({ users: fetched }) => setRealUsers(fetched))
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
  }, [token, user && user.role]);

  const [realOrders, setRealOrders] = useState([]);
  const [realOrdersLoading, setRealOrdersLoading] = useState(true);
  const [realOrdersError, setRealOrdersError] = useState("");
  const refetchRealOrders = () => {
    if (!token) { setRealOrdersLoading(false); return; }
    setRealOrdersLoading(true);
    setRealOrdersError("");
    api.getAllOrders(token)
      .then(({ orders }) => setRealOrders(orders))
      .catch((e) => { if (e.status !== 403) setRealOrdersError(e.message); }) // same reasoning as realUsers above -- a non-admin 403ing here is expected, not a real error
      .finally(() => setRealOrdersLoading(false));
  };
  useEffect(() => {
    if (user && (user.role === "super_admin" || user.role === "staff")) refetchRealOrders();
    else setRealOrdersLoading(false);
  }, [token, user && user.role]);
  const updateOrderStatus = async (orderId, status) => {
    try {
      await api.updateOrderStatus(token, orderId, status);
      refetchRealOrders();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  const [priceOverrides, setPriceOverrides] = useState({});
  const [tierOverrides, setTierOverrides] = useState({});
  const [stockOverrides, setStockOverrides] = useState({});
  const [customProducts, setCustomProducts] = useState([]);
  const [removedProductIds, setRemovedProductIds] = useState([]);
  const [productPhotoOverrides, setProductPhotoOverrides] = useState({});
  const [customGreenBeans, setCustomGreenBeans] = useState([]);
  const [removedGreenBeanIds, setRemovedGreenBeanIds] = useState([]);
  const [greenPriceOverrides, setGreenPriceOverrides] = useState({});
  const [greenOrders, setGreenOrders] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [kenyaMessages, setKenyaMessages] = useState(KENYA_LIVE_MESSAGES_SEED);
  const [quotations, setQuotations] = useState([]);
  const [serviceInquiries, setServiceInquiries] = useState([]);
  const [liveChats, setLiveChats] = useState([]);
  const [feedbackList, setFeedbackList] = useState([]);
  const [momentOverrides, setMomentOverrides] = useState({});
  const [courseOverrides, setCourseOverrides] = useState({});
  const [countryHistoryOverrides, setCountryHistoryOverrides] = useState({});
  const [settings, setSettingsState] = useState({
    tagline: "Where quality meets its scent.",
    announcementEnabled: true,
    announcementText: "Free shipping on orders over $60 — this week only.",
    contactEmail: "hello@morningaroma.com",
    whatsappNumber: "+254712345678",
    phoneNumber: "+254 712 345 678",
    businessName: "Morning Aroma Coffee Roasters Ltd.",
    businessAddress: "Nairobi, Kenya",
    taxId: "",
    taxRatePercent: 0,
    invoiceNotes: "Payment due within 14 days of invoice date. Thank you for your business.",
    instagramHandle: "",
    facebookUrl: "",
    // Which pending-item types actually generate a bell notification for admin — all on by
    // default, but an admin who doesn't want to be interrupted by, say, live chat pings can turn
    // just that one off without losing the others.
    notificationTypes: ["Orders", "Quotations", "Service Inquiries", "Green Orders", "Feedback", "Live Chat"],
  });

  const logAction = (action, detail) => {
    setAuditLog((prev) =>
      [
        { id: `${Date.now()}-${Math.random()}`, timestamp: new Date().toISOString(), actor: user?.email || "unknown", action, detail },
        ...prev,
      ].slice(0, 200) // cap history so this can't grow unbounded in a long admin session
    );
  };

  const getPrice = (id) => {
    if (priceOverrides[id] != null) return priceOverrides[id];
    const p = PRODUCTS.find((p) => p.id === id) || customProducts.find((p) => p.id === id);
    return p ? p.priceCents : 0;
  };
  const setPrice = (id, cents) => {
    setPriceOverrides((prev) => ({ ...prev, [id]: cents }));
    logAction("Price changed", `${id} → ${fmtPrice(cents)}`);
  };

  const getTier = (id) => {
    if (tierOverrides[id]) return tierOverrides[id];
    const p = PRODUCTS.find((p) => p.id === id) || customProducts.find((p) => p.id === id);
    return p ? p.tier : "everyday";
  };
  const setTier = (id, tier) => {
    setTierOverrides((prev) => ({ ...prev, [id]: tier }));
    logAction("Tier changed", `${id} → ${tier}`);
  };

  const getStock = (id) => {
    if (stockOverrides[id] != null) return stockOverrides[id];
    const p = PRODUCTS.find((p) => p.id === id) || customProducts.find((p) => p.id === id);
    if (p) return p.stock;
    const g = GREEN_BEANS.find((g) => g.id === id) || customGreenBeans.find((g) => g.id === id);
    return g ? g.stockKg : 0;
  };
  const setStock = (id, qty) => {
    setStockOverrides((prev) => ({ ...prev, [id]: Math.max(0, qty) }));
    logAction("Stock updated", `${id} → ${Math.max(0, qty)} units`);
  };

  // Live product catalog: the original static list minus anything discontinued, plus anything
  // admin has added. Scoped deliberately -- this dynamic list drives Shop, the Product detail
  // page, Cart, Wishlist, Checkout, and Admin, but curated/editorial placements (Home's featured
  // tiers, Moments' and Brew Guides' matched-product suggestions, Growing Library, World Journey)
  // intentionally keep showing the original 9 roasted + 9 green products -- exactly like a
  // homepage "featured" section on a real store doesn't auto-update the instant a new SKU exists.
  // Any product (whether one of the original 9 or a custom one) can have its photo replaced by
  // admin -- merged in here so every consumer of getAllProducts() sees the override transparently
  // through the same `photoUrl` field getProductPhotoUrl() already checks, no separate lookup needed.
  const withPhotoOverride = (p) => (productPhotoOverrides[p.id] ? { ...p, photoUrl: productPhotoOverrides[p.id] } : p);
  const getAllProducts = () => [
    ...PRODUCTS.filter((p) => !removedProductIds.includes(p.id)).map(withPhotoOverride),
    ...customProducts.map(withPhotoOverride),
  ];
  const setProductPhoto = (id, dataUrl) => {
    setProductPhotoOverrides((prev) => ({ ...prev, [id]: dataUrl }));
    logAction("Product photo updated", id);
  };
  const addProduct = (data) => {
    const id = slugify(`${data.name}-${data.country}`);
    if (PRODUCTS.some((p) => p.id === id) || customProducts.some((p) => p.id === id)) {
      return { error: "A product with this name and country already exists." };
    }
    const product = { ...data, id, isCustom: true };
    setCustomProducts((prev) => [...prev, product]);
    logAction("Product added", `${data.name} — ${data.country}`);
    return { product };
  };
  const removeProduct = (id) => {
    if (customProducts.some((p) => p.id === id)) {
      setCustomProducts((prev) => prev.filter((p) => p.id !== id));
    } else {
      setRemovedProductIds((prev) => [...prev, id]);
    }
    logAction("Product discontinued", id);
  };

  const getAllGreenBeans = () => [...GREEN_BEANS.filter((g) => !removedGreenBeanIds.includes(g.id)), ...customGreenBeans];
  const addGreenBean = (data) => {
    const id = `green-${slugify(`${data.name}-${data.country}`)}`;
    if (GREEN_BEANS.some((g) => g.id === id) || customGreenBeans.some((g) => g.id === id)) {
      return { error: "A green coffee lot with this name and country already exists." };
    }
    const bean = { ...data, id };
    setCustomGreenBeans((prev) => [...prev, bean]);
    logAction("Green bean lot added", `${data.name} — ${data.country}`);
    return { bean };
  };
  const removeGreenBean = (id) => {
    if (customGreenBeans.some((g) => g.id === id)) {
      setCustomGreenBeans((prev) => prev.filter((g) => g.id !== id));
    } else {
      setRemovedGreenBeanIds((prev) => [...prev, id]);
    }
    logAction("Green bean lot discontinued", id);
  };

  // Green bean (wholesale) pricing — kept separate from getPrice/setPrice above since the units
  // are genuinely different (per-kg wholesale vs. per-bag retail), so mixing them into one
  // function would risk silently applying a retail price where a bulk price belongs.
  const getGreenPrice = (id) => {
    if (greenPriceOverrides[id] != null) return greenPriceOverrides[id];
    const g = GREEN_BEANS.find((g) => g.id === id) || customGreenBeans.find((g) => g.id === id);
    return g ? g.pricePerKgCents : 0;
  };
  const setGreenPrice = (id, cents) => {
    setGreenPriceOverrides((prev) => ({ ...prev, [id]: cents }));
    logAction("Green bean price changed", `${id} → ${fmtPrice(cents)}/kg`);
  };

  const addGreenOrder = (o) =>
    setGreenOrders((prev) => [
      { ...o, id: `GB-${1000 + prev.length}`, status: "New", date: new Date().toISOString().slice(0, 10) },
      ...prev,
    ]);
  const updateGreenOrderStatus = (id, status) =>
    setGreenOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));

  const addKenyaMessage = (msg) => { setKenyaMessages((prev) => [...prev, msg]); logAction("Live message added", msg); };
  const updateKenyaMessage = (i, msg) => { setKenyaMessages((prev) => prev.map((m, idx) => (idx === i ? msg : m))); logAction("Live message edited", msg); };
  const removeKenyaMessage = (i) => { setKenyaMessages((prev) => prev.filter((_, idx) => idx !== i)); logAction("Live message removed", `index ${i}`); };

  const addQuotation = (q) =>
    setQuotations((prev) => [
      { ...q, id: `Q-${1000 + prev.length}`, status: "New", date: new Date().toISOString().slice(0, 10) },
      ...prev,
    ]);
  const updateQuotationStatus = (id, status) =>
    setQuotations((prev) => prev.map((q) => (q.id === id ? { ...q, status } : q)));

  const addServiceInquiry = (s) =>
    setServiceInquiries((prev) => [
      { ...s, id: `SVC-${1000 + prev.length}`, status: "New", date: new Date().toISOString().slice(0, 10) },
      ...prev,
    ]);
  const updateServiceInquiryStatus = (id, status) =>
    setServiceInquiries((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  const setServiceInquiryFee = (id, agreedFeeCents) => {
    setServiceInquiries((prev) => prev.map((s) => (s.id === id ? { ...s, agreedFeeCents } : s)));
    logAction("Consultation fee set", `${id} → ${fmtPrice(agreedFeeCents)}`);
  };

  const startChat = (customerName, customerEmail) => {
    const id = `CHAT-${1000 + liveChats.length}-${Date.now()}`;
    setLiveChats((prev) => [
      { id, customerName, customerEmail, status: "Open", startedAt: new Date().toISOString(), messages: [] },
      ...prev,
    ]);
    return id;
  };
  const sendChatMessage = (chatId, sender, text) => {
    setLiveChats((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? { ...c, messages: [...c.messages, { sender, text, at: new Date().toISOString() }] }
          : c
      )
    );
  };
  const updateChatStatus = (chatId, status) =>
    setLiveChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, status } : c)));

  const addFeedback = (f) =>
    setFeedbackList((prev) => [
      { ...f, id: `FB-${1000 + prev.length}`, date: new Date().toISOString().slice(0, 10), reviewed: false },
      ...prev,
    ]);
  const toggleFeedbackReviewed = (id) =>
    setFeedbackList((prev) => prev.map((f) => (f.id === id ? { ...f, reviewed: !f.reviewed } : f)));

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

  const setSettings = (patch) => {
    setSettingsState((prev) => ({ ...prev, ...patch }));
    logAction("Settings updated", Object.keys(patch).join(", "));
  };

  // Client-side equivalent of a database backup, since there's no real database here to back up --
  // this exports every piece of admin-managed state (the actual catalog changes, overrides, and
  // business records that would be genuinely painful to lose, unlike a customer's cart/wishlist)
  // as one JSON object. Named and structured explicitly rather than just `JSON.stringify`-ing raw
  // internal state, so a restored file is readable and the shape is stable even if internal
  // variable names change later.
  const exportAdminData = () => ({
    priceOverrides, tierOverrides, stockOverrides,
    customProducts, removedProductIds, productPhotoOverrides,
    customGreenBeans, removedGreenBeanIds, greenPriceOverrides, greenOrders,
    auditLog, kenyaMessages, quotations, serviceInquiries, liveChats, feedbackList,
    momentOverrides, courseOverrides, countryHistoryOverrides, settings,
  });
  // Restores each piece independently rather than one big setState -- if the uploaded file is
  // missing a key (an older export, or a hand-edited partial file), that specific piece is simply
  // left as-is instead of the whole restore failing or wiping something the file didn't mention.
  const restoreAdminData = (data) => {
    if (!data || typeof data !== "object") return;
    if (data.priceOverrides) setPriceOverrides(data.priceOverrides);
    if (data.tierOverrides) setTierOverrides(data.tierOverrides);
    if (data.stockOverrides) setStockOverrides(data.stockOverrides);
    if (Array.isArray(data.customProducts)) setCustomProducts(data.customProducts);
    if (Array.isArray(data.removedProductIds)) setRemovedProductIds(data.removedProductIds);
    if (data.productPhotoOverrides) setProductPhotoOverrides(data.productPhotoOverrides);
    if (Array.isArray(data.customGreenBeans)) setCustomGreenBeans(data.customGreenBeans);
    if (Array.isArray(data.removedGreenBeanIds)) setRemovedGreenBeanIds(data.removedGreenBeanIds);
    if (data.greenPriceOverrides) setGreenPriceOverrides(data.greenPriceOverrides);
    if (Array.isArray(data.greenOrders)) setGreenOrders(data.greenOrders);
    if (Array.isArray(data.auditLog)) setAuditLog(data.auditLog);
    if (Array.isArray(data.kenyaMessages)) setKenyaMessages(data.kenyaMessages);
    if (Array.isArray(data.quotations)) setQuotations(data.quotations);
    if (Array.isArray(data.serviceInquiries)) setServiceInquiries(data.serviceInquiries);
    if (Array.isArray(data.liveChats)) setLiveChats(data.liveChats);
    if (Array.isArray(data.feedbackList)) setFeedbackList(data.feedbackList);
    if (data.momentOverrides) setMomentOverrides(data.momentOverrides);
    if (data.courseOverrides) setCourseOverrides(data.courseOverrides);
    if (data.countryHistoryOverrides) setCountryHistoryOverrides(data.countryHistoryOverrides);
    if (data.settings) setSettingsState((prev) => ({ ...prev, ...data.settings }));
    logAction("Backup restored", `${Object.keys(data).length} data sets`);
  };

  return (
    <AdminCtx.Provider
      value={{
        getPrice, setPrice,
        getTier, setTier,
        realUsers, realUsersLoading, realUsersError, refetchRealUsers,
        realOrders, realOrdersLoading, realOrdersError, refetchRealOrders, updateOrderStatus,
        getStock, setStock,
        getAllProducts, addProduct, removeProduct, setProductPhoto,
        getGreenPrice, setGreenPrice,
        getAllGreenBeans, addGreenBean, removeGreenBean,
        greenOrders, addGreenOrder, updateGreenOrderStatus,
        auditLog,
        kenyaMessages, addKenyaMessage, updateKenyaMessage, removeKenyaMessage,
        quotations, addQuotation, updateQuotationStatus,
        serviceInquiries, addServiceInquiry, updateServiceInquiryStatus, setServiceInquiryFee,
        liveChats, startChat, sendChatMessage, updateChatStatus,
        feedbackList, addFeedback, toggleFeedbackReviewed,
        getMomentContent, setMomentContent, momentOverrides,
        getCourseContent, setCourseContent, courseOverrides,
        getCountryHistory, setCountryHistory,
        settings, setSettings,
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
      <div className="toast-stack" aria-live="polite">
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
    fetch("https://ipapi.co/json/")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("geo lookup failed"))))
      .then((data) => {
        if (data && data.currency) setCurrency(data.currency);
      })
      .catch(() => {
        /* stays on USD — a reasonable, always-correct default */
      });
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

  return (
    <CurrencyCtx.Provider value={{ currency, rates, ratesLoading, chooseCurrency, format }}>
      {children}
    </CurrencyCtx.Provider>
  );
}
export const useCurrency = () => useContext(CurrencyCtx);

