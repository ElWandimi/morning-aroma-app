import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { Glass, SignInModal, SignUpModal } from "../components";
import { useAdmin, useAuth, useCart, useCurrency, useOrders, useRoute, useSubscriptions } from "../context";
import { CHECKOUT_STEPS, COUNTRY_JOURNEY_PHOTO } from "../data";
import { getProductPhotoUrl, loadPaystackScript } from "../utils/helpers";

const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
if (!PAYSTACK_PUBLIC_KEY && import.meta.env.PROD) {
  // Same pattern as VITE_API_URL in utils/api.js -- fails loudly in a production build rather
  // than letting a missing key surface later as a confusing runtime error at the moment someone
  // actually tries to pay.
  console.error("VITE_PAYSTACK_PUBLIC_KEY is not set — checkout cannot reach Paystack. Set it in the frontend service's environment variables.");
}

export function CheckoutPage() {
  const { user } = useAuth();
  const { items, updateQty, remove, totalCents, clearCart } = useCart();
  const { go } = useRoute();
  const { createOrder, verifyPayment } = useOrders();
  const { createSubscription } = useSubscriptions();
  const { getPrice, getAllProducts } = useAdmin();
  const { format, rates, ratesLoading } = useCurrency();
  const [authView, setAuthView] = useState(null); // null | "signin" | "signup"
  // Keyed by product id -- tracks the interval chosen and the real submit state for the
  // post-purchase subscribe offer (step 4), independently per item, since a multi-item order can
  // offer more than one product to subscribe to at once.
  const [subOffers, setSubOffers] = useState({});
  // A signed-in customer still starts at Review (0) to see their bag before continuing. A
  // signed-out guest skips straight to Sign-in (1) -- there's nothing for them to do at Review
  // that isn't also available once they're back from signing in, and this is what the cart
  // drawer's "Checkout" button is actually meant to feel like: sign in first, review after.
  // Evaluated once via useState's lazy initializer, not on every render -- if `user` is still
  // resolving (an existing session being restored) at the exact moment this mounts, a guest-looking
  // visitor who turns out to already be signed in will briefly see both this step's Sign-in panel
  // and the "Signed in as ... Continue to shipping" row it already shows once `user` resolves
  // (see below) rather than snapping cleanly to Review -- rare, and not a dead end, so not worth
  // the extra complexity of an effect just to avoid it.
  const [step, setStep] = useState(() => (user ? 0 : 1)); // index into CHECKOUT_STEPS
  const [shipping, setShipping] = useState({ name: "", address: "", city: "", country: "", phone: "" });
  const [confirmedOrder, setConfirmedOrder] = useState(null);
  // The order is created once, on the first payment attempt, and reused across retries -- so a
  // cancelled or failed Paystack popup doesn't leave behind multiple duplicate unpaid orders for
  // the same cart. "idle" | "creating-order" | "awaiting-payment" | "verifying"
  const [pendingOrder, setPendingOrder] = useState(null);
  const [payingStatus, setPayingStatus] = useState("idle");
  const [placeOrderError, setPlaceOrderError] = useState("");

  if (items.length === 0 && step < 4) {
    return (
      <div className="empty-state" style={{ padding: 80 }}>
        <p>Your bag is empty.</p>
        <button className="btn-outline small" onClick={() => go("shop")}>Browse the shop</button>
      </div>
    );
  }

  const goNext = () => setStep((s) => Math.min(s + 1, 4));

  const startPayment = async () => {
    setPlaceOrderError("");
    let order = pendingOrder;

    if (!order) {
      setPayingStatus("creating-order");
      // unitPriceCents is captured now, at the moment of ordering -- locking in what was actually
      // charged, rather than the order forever pointing at "whatever this product currently costs".
      const result = await createOrder({
        items: items.map((i) => ({ id: i.id, qty: i.qty, unitPriceCents: getPrice(i.id) })),
        shippingName: shipping.name,
        shippingAddress: shipping.address,
        shippingCity: shipping.city,
      });
      if (!result.ok) {
        setPlaceOrderError(result.error);
        setPayingStatus("idle");
        return;
      }
      order = result.order;
      setPendingOrder(order);
    }

    try {
      await loadPaystackScript();
    } catch (e) {
      setPlaceOrderError(e.message);
      setPayingStatus("idle");
      return;
    }

    setPayingStatus("awaiting-payment");
    // Converts the order's locked-in USD total to KES using the same live rate CurrencyProvider
    // already fetched for display -- so what Paystack actually charges matches what the customer
    // saw on screen. The backend independently re-verifies this against its own rate lookup with
    // a tolerance for drift (see server/src/routes/orders.js) rather than trusting this number
    // directly -- this is only what gets *requested*, not what gets trusted as paid.
    const amountKesCents = Math.round((order.totalCents / 100) * rates.KES * 100);
    // Unique per attempt (not just per order) -- Date.now() means a retry after a cancelled
    // popup gets its own reference rather than reusing one Paystack (or this app's own database
    // constraint on paystack_reference) might already have a record of.
    const reference = `${order.orderNumber}-${Date.now()}`;

    const popup = new window.PaystackPop();
    popup.newTransaction({
      key: PAYSTACK_PUBLIC_KEY,
      email: user.email,
      amount: amountKesCents,
      currency: "KES",
      reference,
      onSuccess: async () => {
        setPayingStatus("verifying");
        const verifyResult = await verifyPayment(order.id, reference);
        if (verifyResult.ok) {
          clearCart();
          setConfirmedOrder(verifyResult.order);
          setStep(4);
        } else {
          setPlaceOrderError(verifyResult.error);
          setPayingStatus("idle");
        }
      },
      onCancel: () => setPayingStatus("idle"),
      onError: (error) => {
        setPlaceOrderError(error.message || "Something went wrong with the payment. Please try again.");
        setPayingStatus("idle");
      },
    });
  };

  // Real, if uncommon: a product could be discontinued between checkout and this exact click.
  // Keyed by product id, matching subOffers above.
  const subscribeToItem = async (item) => {
    const interval = (subOffers[item.id] && subOffers[item.id].interval) || "monthly";
    setSubOffers((prev) => ({ ...prev, [item.id]: { ...prev[item.id], interval, submitting: true, error: "" } }));
    const result = await createSubscription({
      reference: confirmedOrder.paystackReference,
      productId: item.id,
      quantity: item.qty,
      interval,
      shippingName: shipping.name,
      shippingAddress: shipping.address,
      shippingCity: shipping.city,
    });
    setSubOffers((prev) => ({
      ...prev,
      [item.id]: { ...prev[item.id], interval, submitting: false, done: result.ok, error: result.ok ? "" : result.error },
    }));
  };

  return (
    <div className="checkout-page">
      <div className="checkout-steps">
        {CHECKOUT_STEPS.map((s, i) => (
          <span key={s} className={`checkout-step ${i === step ? "active" : ""} ${i < step ? "done" : ""}`}>{s}</span>
        ))}
      </div>

      {step === 0 && (
        <div className="checkout-grid">
          <div className="checkout-main">
            <h3>Your bag</h3>
            {items.map((i) => {
              const p = getAllProducts().find((p) => p.id === i.id);
              if (!p) return null;
              return (
                <div key={i.id} className="checkout-item">
                  <div className="drawer-thumb" style={{ backgroundImage: `url('${getProductPhotoUrl(p, COUNTRY_JOURNEY_PHOTO, 200)}')` }} />
                  <div className="drawer-item-info">
                    <p className="drawer-item-name">{p.name} — {p.country}</p>
                    <p className="drawer-item-price">{format(getPrice(p.id))}</p>
                    <div className="qty-row small">
                      <button onClick={() => updateQty(i.id, i.qty - 1)}>−</button>
                      <span>{i.qty}</span>
                      <button onClick={() => updateQty(i.id, i.qty + 1)}>+</button>
                      <button className="link-btn" onClick={() => remove(i.id)}>Remove</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="checkout-summary">
            <div className="drawer-total"><span>Total</span><span>{format(totalCents)}</span></div>
            <button className="btn-primary full" onClick={() => setStep(user ? 2 : 1)}>Continue</button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="checkout-auth">
          <Glass className="quiz-panel">
            <p className="eyebrow">almost there</p>
            <h2>Sign in to continue</h2>
            <p className="quiz-copy">Your bag stays exactly as it is — sign in or create an account and we'll pick up right here.</p>
            <div className="checkout-auth-buttons">
              <button className="btn-primary" onClick={() => setAuthView("signin")}>Sign in</button>
              <button className="btn-outline" onClick={() => setAuthView("signup")}>Create account</button>
            </div>
          </Glass>
          <SignInModal open={authView === "signin"} onClose={() => setAuthView(null)} onSwitchToSignUp={() => setAuthView("signup")} />
          <SignUpModal open={authView === "signup"} onClose={() => setAuthView(null)} onSwitchToSignIn={() => setAuthView("signin")} />
          {user && (
            <div className="course-link-row" style={{ marginTop: 20 }}>
              <span>Signed in as {user.name} ✓</span>
              <button className="btn-outline small" onClick={goNext}>Continue to shipping →</button>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <form className="checkout-form" onSubmit={(e) => { e.preventDefault(); goNext(); }}>
          <h3>Shipping details</h3>
          <label htmlFor="ship-name">Full name</label>
          <input id="ship-name" autoComplete="name" value={shipping.name} onChange={(e) => setShipping({ ...shipping, name: e.target.value })} required />
          <label htmlFor="ship-address">Address</label>
          <input id="ship-address" autoComplete="street-address" value={shipping.address} onChange={(e) => setShipping({ ...shipping, address: e.target.value })} required />
          <div className="form-row-2">
            <div>
              <label htmlFor="ship-city">City</label>
              <input id="ship-city" autoComplete="address-level2" value={shipping.city} onChange={(e) => setShipping({ ...shipping, city: e.target.value })} required />
            </div>
            <div>
              <label htmlFor="ship-country">Country</label>
              <input id="ship-country" autoComplete="country-name" value={shipping.country} onChange={(e) => setShipping({ ...shipping, country: e.target.value })} required />
            </div>
          </div>
          <label htmlFor="ship-phone">Phone</label>
          <input id="ship-phone" autoComplete="tel" value={shipping.phone} onChange={(e) => setShipping({ ...shipping, phone: e.target.value })} />
          <button className="btn-primary full" type="submit">Continue to payment</button>
        </form>
      )}

      {step === 3 && (
        <div className="checkout-form">
          <h3>Payment</h3>
          <p className="hint payment-note">Pay securely with Paystack — card, M-Pesa, and more.</p>
          <div className="drawer-total"><span>Total due</span><span>{format(totalCents)}</span></div>
          {placeOrderError && <p className="form-error">{placeOrderError}</p>}
          {ratesLoading ? (
            <p className="hint">Preparing checkout…</p>
          ) : !rates.KES ? (
            <p className="form-error">Couldn't load current exchange rates, so we can't safely charge you the right amount. Please refresh the page and try again.</p>
          ) : (
            <button className="btn-primary full" onClick={startPayment} disabled={payingStatus !== "idle"}>
              {payingStatus === "creating-order" ? "Preparing your order…"
                : payingStatus === "awaiting-payment" ? "Waiting for payment…"
                : payingStatus === "verifying" ? "Confirming payment…"
                : "Pay with Paystack"}
            </button>
          )}
        </div>
      )}

      {step === 4 && confirmedOrder && (
        <div className="checkout-confirmed">
          <span className="bean-shape" style={{ margin: "0 auto 16px" }} />
          <p className="eyebrow">order confirmed</p>
          <h2>Thank you — {confirmedOrder.orderNumber} is roasting soon</h2>
          <p className="quiz-copy">A confirmation would normally land in your inbox. For now, find it any time in My Aroma Journey.</p>
          {confirmedOrder.items && confirmedOrder.items.length > 0 && (
            <div className="checkout-subscribe-offer">
              <p className="eyebrow">subscribe &amp; save the hassle</p>
              {confirmedOrder.items.map((item) => {
                const product = getAllProducts().find((p) => p.id === item.id);
                // A real, if uncommon, edge case: the product was discontinued between checkout
                // and this exact render. Nothing meaningful to offer a subscription on.
                if (!product) return null;
                const offer = subOffers[item.id] || {};
                const interval = offer.interval || "monthly";
                return (
                  <div key={item.id} className="checkout-subscribe-row">
                    {offer.done ? (
                      <p className="form-success">You're subscribed to {product.name} — manage it anytime from My Aroma Journey.</p>
                    ) : (
                      <>
                        <p className="checkout-subscribe-prompt">Get {product.name} delivered automatically?</p>
                        <div className="mode-toggle">
                          <button type="button" className={interval === "monthly" ? "active" : ""} onClick={() => setSubOffers((prev) => ({ ...prev, [item.id]: { ...prev[item.id], interval: "monthly" } }))}>Monthly</button>
                          <button type="button" className={interval === "annually" ? "active" : ""} onClick={() => setSubOffers((prev) => ({ ...prev, [item.id]: { ...prev[item.id], interval: "annually" } }))}>Annually</button>
                        </div>
                        {offer.error && <p className="form-error">{offer.error}</p>}
                        <button className="btn-outline small" onClick={() => subscribeToItem(item)} disabled={offer.submitting}>
                          {offer.submitting ? "Setting up…" : "Subscribe"}
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="checkout-confirmed-actions">
            <button className="btn-primary" onClick={() => go("journey")}>View my orders</button>
            <button className="btn-outline" onClick={() => go("shop")}>Continue shopping</button>
          </div>
        </div>
      )}
    </div>
  );
}
