import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { SignInModal, SignUpModal, RadarChart } from "../components";
import { useAdmin, useAuth, useCart, useJournal, useOrders, useRoute, useToast } from "../context";

// Must match CANCELLATION_WINDOW_MINUTES in server/src/routes/orders.js exactly -- this only
// controls whether the Cancel button is shown at all (a UX nicety, avoiding a guaranteed-to-fail
// click once the window has passed); the real enforcement is server-side regardless of what this
// value is set to here.
const CANCELLATION_WINDOW_MS = 10 * 60 * 1000;

// Real 2FA setup/disable, wired to the actual backend (server/src/routes/auth.js). A small local
// state machine rather than a single boolean toggle, matching the real multi-step flow: setup
// isn't instant (scan a QR code, prove you can produce a matching code, save backup codes you'll
// never see again), and disabling deliberately asks for the password again rather than just
// flipping a switch.
function TwoFactorPanel({ user }) {
  const { startTwoFactorSetup, confirmTwoFactorSetup, disableTwoFactor } = useAuth();
  const { addToast } = useToast();
  const [step, setStep] = useState("idle"); // idle | setup | backupCodes | disabling
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [setupError, setSetupError] = useState("");
  const [setupSubmitting, setSetupSubmitting] = useState(false);
  const [backupCodes, setBackupCodes] = useState([]);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableError, setDisableError] = useState("");
  const [disableSubmitting, setDisableSubmitting] = useState(false);

  const beginSetup = async () => {
    setSetupError("");
    const result = await startTwoFactorSetup();
    if (result.ok) {
      setQrDataUrl(result.qrDataUrl);
      setSecret(result.secret);
      setStep("setup");
    } else {
      setSetupError(result.error || "Couldn't start setup. Try again.");
    }
  };

  const confirmSetup = async (e) => {
    e.preventDefault();
    setSetupSubmitting(true);
    setSetupError("");
    const result = await confirmTwoFactorSetup(setupCode);
    setSetupSubmitting(false);
    if (result.ok) {
      setBackupCodes(result.backupCodes);
      setSetupCode("");
      setStep("backupCodes");
    } else {
      setSetupError(result.error || "Incorrect code.");
    }
  };

  const finishSetup = () => {
    setStep("idle");
    setBackupCodes([]);
    setQrDataUrl("");
    setSecret("");
    addToast("Two-factor authentication enabled");
  };

  const cancelSetup = () => {
    setStep("idle");
    setQrDataUrl("");
    setSecret("");
    setSetupCode("");
    setSetupError("");
  };

  const confirmDisable = async (e) => {
    e.preventDefault();
    setDisableSubmitting(true);
    setDisableError("");
    const result = await disableTwoFactor(disablePassword);
    setDisableSubmitting(false);
    if (result.ok) {
      setStep("idle");
      setDisablePassword("");
      addToast("Two-factor authentication disabled");
    } else {
      setDisableError(result.error || "Incorrect password.");
    }
  };

  const cancelDisable = () => {
    setStep("idle");
    setDisablePassword("");
    setDisableError("");
  };

  if (step === "backupCodes") {
    return (
      <>
        <p className="hint" style={{ marginTop: 0 }}>{user.email}</p>
        <p className="form-error" style={{ marginTop: 0 }}>
          Save these somewhere safe — each code works once, and this is the only time they'll ever be shown. If you lose access to your authenticator app, they're the only way back in.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", margin: "12px 0" }}>
          {backupCodes.map((code) => (
            <code key={code} style={{ padding: "6px 10px", border: "1px solid currentColor", borderRadius: 6, fontSize: 14 }}>{code}</code>
          ))}
        </div>
        <button className="btn-primary full" onClick={finishSetup}>I've saved these — done</button>
      </>
    );
  }

  if (step === "setup") {
    return (
      <>
        <p className="hint" style={{ marginTop: 0 }}>{user.email}</p>
        <p className="hint">Scan this with an authenticator app (Google Authenticator, Authy, 1Password, etc.):</p>
        {qrDataUrl && <img src={qrDataUrl} alt="Two-factor authentication QR code" width={180} height={180} />}
        <p className="hint">Can't scan it? Enter this code manually: <code>{secret}</code></p>
        <form onSubmit={confirmSetup}>
          <label htmlFor="twofa-setup-code">6-digit code from the app</label>
          <input id="twofa-setup-code" value={setupCode} onChange={(e) => { setSetupCode(e.target.value); setSetupError(""); }} placeholder="000000" inputMode="numeric" maxLength={6} autoFocus required />
          {setupError && <p className="form-error">{setupError}</p>}
          <button type="submit" className="btn-primary full" disabled={setupSubmitting}>{setupSubmitting ? "Verifying…" : "Confirm & enable"}</button>
        </form>
        <button className="link-btn" style={{ marginTop: 10 }} onClick={cancelSetup}>Cancel</button>
      </>
    );
  }

  if (step === "disabling") {
    return (
      <>
        <p className="hint" style={{ marginTop: 0 }}>{user.email}</p>
        <form onSubmit={confirmDisable}>
          <label htmlFor="twofa-disable-password">Confirm your password to turn this off</label>
          <input id="twofa-disable-password" type="password" value={disablePassword} onChange={(e) => { setDisablePassword(e.target.value); setDisableError(""); }} autoComplete="current-password" autoFocus required />
          {disableError && <p className="form-error">{disableError}</p>}
          <button type="submit" className="btn-outline full" disabled={disableSubmitting}>{disableSubmitting ? "Please wait…" : "Disable two-factor authentication"}</button>
        </form>
        <button className="link-btn" style={{ marginTop: 10 }} onClick={cancelDisable}>Cancel</button>
      </>
    );
  }

  return (
    <>
      <p className="hint" style={{ marginTop: 0 }}>{user.email}</p>
      <p className="hint">
        {user.twoFactorEnabled
          ? "Enabled — after your password, you'll need a code from your authenticator app to sign in."
          : "Off — sign in with just your password. Turn this on for an extra layer of protection."}
      </p>
      {setupError && <p className="form-error">{setupError}</p>}
      {user.twoFactorEnabled ? (
        <button className="btn-outline small" onClick={() => setStep("disabling")}>Disable two-factor authentication</button>
      ) : (
        <button className="btn-outline small" onClick={beginSetup}>Enable two-factor authentication</button>
      )}
    </>
  );
}

export function JourneyPage() {
  const { user, setNotificationsEnabled } = useAuth();
  const { go } = useRoute();
  const { addEntry, removeEntry, entriesFor } = useJournal();
  const { add: addToCart } = useCart();
  const { addToast } = useToast();
  const { getAllProducts } = useAdmin();
  const allProducts = getAllProducts();
  const [authView, setAuthView] = useState(null); // null | "signin" | "signup"
  const [selectedProduct, setSelectedProduct] = useState(allProducts[0].id);
  const [rating, setRating] = useState(5);
  const [note, setNote] = useState("");

  if (!user) {
    return (
      <div className="journey-locked">
        <span className="bean-shape" style={{ width: 36, height: 46, margin: "0 auto 16px" }} />
        <h2>Your Aroma Journey is waiting</h2>
        <p>Sign in to log the coffees you've tasted, see your flavor fingerprint, and get recommendations from your barista.</p>
        <button className="btn-primary" onClick={() => setAuthView("signin")}>Sign in</button>
        <SignInModal open={authView === "signin"} onClose={() => setAuthView(null)} onSwitchToSignUp={() => setAuthView("signup")} />
        <SignUpModal open={authView === "signup"} onClose={() => setAuthView(null)} onSwitchToSignIn={() => setAuthView("signin")} />
      </div>
    );
  }

  const entries = entriesFor(user.email);
  const journaledIds = new Set(entries.map((e) => e.productId));
  const PROFILE_KEYS = ["aroma", "body", "acidity", "sweetness", "finish"];

  const avgProfile = (() => {
    if (entries.length === 0) return null;
    const sums = { aroma: 0, body: 0, acidity: 0, sweetness: 0, finish: 0 };
    let n = 0;
    entries.forEach((e) => {
      const p = allProducts.find((p) => p.id === e.productId);
      if (!p) return;
      PROFILE_KEYS.forEach((k) => (sums[k] += p.profile[k]));
      n++;
    });
    if (n === 0) return null;
    const out = {};
    PROFILE_KEYS.forEach((k) => (out[k] = +(sums[k] / n).toFixed(1)));
    return out;
  })();

  const recommendation = (() => {
    const candidates = allProducts.filter((p) => !journaledIds.has(p.id));
    if (candidates.length === 0) return null;
    if (!avgProfile) return candidates.find((p) => p.id === "bourbon-rwanda") || candidates[0];
    let best = null, bestDist = Infinity;
    candidates.forEach((p) => {
      const dist = Math.sqrt(PROFILE_KEYS.reduce((s, k) => s + (p.profile[k] - avgProfile[k]) ** 2, 0));
      if (dist < bestDist) { bestDist = dist; best = p; }
    });
    return best;
  })();

  const { myOrders: orders, myOrdersLoading, myOrdersError, refetchMyOrders, cancelOrder } = useOrders();

  const submitEntry = (e) => {
    e.preventDefault();
    addEntry(user.email, selectedProduct, rating, note.trim());
    setNote("");
    addToast("Added to your journal");
  };

  return (
    <div className="journey-page">
      <div className="shop-head">
        <p className="eyebrow">signed in as {user.name}</p>
        <h1>My Aroma Journey</h1>
        <p className="shop-sub">Every coffee you log sharpens your flavor fingerprint — and your recommendations.</p>
      </div>

      <div className="journey-grid">
        <div className="journey-col">
          <div className="mini-brew">
            <h3>Account &amp; Security</h3>
            <TwoFactorPanel user={user} />
            <label className="filter-label" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 18 }}>
              <input
                type="checkbox"
                checked={user.notificationsEnabled !== false}
                onChange={(e) => {
                  setNotificationsEnabled(user.email, e.target.checked);
                  addToast(e.target.checked ? "Order & account notifications on" : "Order & account notifications off");
                }}
              />
              Order &amp; account notifications
            </label>
            <p className="hint">
              This is a real, saved preference — but this prototype has no email delivery set up yet, so nothing is actually sent
              either way right now. It's here for when that's wired up.
            </p>
          </div>

          <div className="mini-brew">
            <h3>Flavor Fingerprint</h3>
            {avgProfile ? (
              <div className="radar-wrap"><RadarChart profile={avgProfile} /></div>
            ) : (
              <p className="hint">Log your first coffee to build your fingerprint.</p>
            )}
          </div>

          {recommendation && (
            <div className="mini-brew reco-card">
              <h3>Your Barista Recommends</h3>
              <p className="reco-name">{recommendation.name} — {recommendation.country}</p>
              <p>{recommendation.note}</p>
              <button className="btn-outline small" onClick={() => go("product", { id: recommendation.id })}>View variety →</button>
            </div>
          )}
        </div>

        <div className="journey-col">
          <div className="mini-brew">
            <h3>Log a Coffee</h3>
            <form onSubmit={submitEntry}>
              <label htmlFor="journal-variety">Variety</label>
              <select id="journal-variety" value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}>
                {allProducts.map((p) => (<option key={p.id} value={p.id}>{p.name} — {p.country}</option>))}
              </select>
              <label id="journal-rating-label">Rating</label>
              <div className="star-row" role="group" aria-labelledby="journal-rating-label">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button type="button" key={n} className={`star ${n <= rating ? "filled" : ""}`} onClick={() => setRating(n)} aria-label={`${n} beans`} aria-pressed={n === rating}>●</button>
                ))}
              </div>
              <label htmlFor="journal-note">Private notes</label>
              <textarea id="journal-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Tasting notes, brew method, how it made you feel…" maxLength={500} />
              <button type="submit" className="btn-primary full">Add to Journal</button>
            </form>
          </div>
        </div>
      </div>

      <h3 className="matched-head">Your entries</h3>
      {entries.length === 0 ? (
        <p className="hint">Nothing logged yet.</p>
      ) : (
        <div className="journal-list">
          {entries.map((e) => {
            const p = allProducts.find((p) => p.id === e.productId);
            return (
              <div key={e.id} className="journal-row">
                <div>
                  <p className="journal-name">{p ? `${p.name} — ${p.country}` : e.productId}</p>
                  <p className="journal-stars">{"●".repeat(e.rating)}{"○".repeat(5 - e.rating)}</p>
                  {e.note && <p className="journal-note">"{e.note}"</p>}
                  <p className="journal-date">{e.date}</p>
                </div>
                <button className="link-btn" onClick={() => removeEntry(user.email, e.id)}>Remove</button>
              </div>
            );
          })}
        </div>
      )}

      <h3 className="matched-head">Order history</h3>
      {myOrdersLoading ? (
        <p className="hint">Loading your orders…</p>
      ) : myOrdersError ? (
        <div>
          <p className="form-error">Couldn't load your orders: {myOrdersError}</p>
          <button className="btn-outline small" onClick={refetchMyOrders}>Try again</button>
        </div>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <p>No orders yet — your roast is one click away.</p>
          <button className="btn-outline small" onClick={() => go("shop")}>Browse the shop</button>
        </div>
      ) : (
        <div className="order-list">
          {orders.map((o) => (
            <div key={o.id} className="order-card">
              <div className="order-head">
                <span>{o.orderNumber}</span>
                <span className="order-status">{o.status}</span>
              </div>
              <p className="hint">{o.createdAt.slice(0, 10)}</p>
              <ul className="order-items">
                {o.items.map((it) => {
                  const p = allProducts.find((p) => p.id === it.id);
                  return <li key={it.id}>{p ? `${p.name} — ${p.country}` : "Discontinued item"} × {it.qty}</li>;
                })}
              </ul>
              <button
                className="btn-outline small"
                onClick={() => {
                  const availableItems = o.items.filter((it) => allProducts.some((p) => p.id === it.id));
                  availableItems.forEach((it) => addToCart(it.id, it.qty));
                  const skipped = o.items.length - availableItems.length;
                  if (availableItems.length === 0) addToast("Those items are no longer available");
                  else if (skipped > 0) addToast(`Added ${availableItems.length} item${availableItems.length === 1 ? "" : "s"} — ${skipped} no longer available`);
                  else addToast("Order added to your bag");
                }}
              >
                Reorder
              </button>
              {o.status === "Processing" && (o.paymentStatus === "unpaid" || (o.paymentStatus === "paid" && Date.now() - new Date(o.paidAt).getTime() <= CANCELLATION_WINDOW_MS)) && (
                <button
                  className="link-btn"
                  style={{ marginLeft: 10 }}
                  onClick={async () => {
                    if (window.confirm(`Cancel order ${o.orderNumber}? This can't be undone.`)) {
                      const result = await cancelOrder(o.id);
                      addToast(result.ok ? "Order cancelled" : result.error);
                    }
                  }}
                >
                  Cancel order
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
