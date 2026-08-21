import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { Glass, LoginModal } from "../components";
import { useAdmin, useAuth, useCart, useCurrency, useOrders, useRoute } from "../context";
import { CHECKOUT_STEPS, COUNTRY_JOURNEY_PHOTO } from "../data";
import { getProductPhotoUrl } from "../utils/helpers";

export function CheckoutPage() {
  const { user } = useAuth();
  const { items, updateQty, remove, totalCents, clearCart } = useCart();
  const { go } = useRoute();
  const { addOrder } = useOrders();
  const { getPrice, getAllProducts } = useAdmin();
  const { format } = useCurrency();
  const [loginOpen, setLoginOpen] = useState(false);
  const [step, setStep] = useState(0); // index into CHECKOUT_STEPS
  const [shipping, setShipping] = useState({ name: "", address: "", city: "", country: "", phone: "" });
  const [payment, setPayment] = useState({ cardName: "", cardNumber: "", expiry: "", cvc: "" });
  const [confirmedOrder, setConfirmedOrder] = useState(null);

  if (items.length === 0 && step < 4) {
    return (
      <div className="empty-state" style={{ padding: 80 }}>
        <p>Your bag is empty.</p>
        <button className="btn-outline small" onClick={() => go("shop")}>Browse the shop</button>
      </div>
    );
  }

  const goNext = () => setStep((s) => Math.min(s + 1, 4));

  const placeOrder = (e) => {
    e.preventDefault();
    const order = addOrder(user.email, items.map((i) => ({ id: i.id, qty: i.qty })));
    clearCart();
    setConfirmedOrder(order);
    setStep(4);
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
                  <div className="drawer-thumb" style={{ backgroundImage: `url('${getProductPhotoUrl(p, COUNTRY_JOURNEY_PHOTO)}')` }} />
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
            <button className="btn-primary" onClick={() => setLoginOpen(true)}>Sign in / Create account</button>
          </Glass>
          <LoginModal open={loginOpen} onClose={() => { setLoginOpen(false); }} />
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
        <form className="checkout-form" onSubmit={placeOrder}>
          <h3>Payment</h3>
          <p className="hint payment-note">This is a design prototype — no real payment is processed or stored. Use any fake details.</p>
          <label htmlFor="pay-name">Name on card</label>
          <input id="pay-name" autoComplete="cc-name" value={payment.cardName} onChange={(e) => setPayment({ ...payment, cardName: e.target.value })} required />
          <label htmlFor="pay-number">Card number</label>
          <input id="pay-number" autoComplete="cc-number" value={payment.cardNumber} onChange={(e) => setPayment({ ...payment, cardNumber: e.target.value })} placeholder="4242 4242 4242 4242" required />
          <div className="form-row-2">
            <div>
              <label htmlFor="pay-expiry">Expiry</label>
              <input id="pay-expiry" autoComplete="cc-exp" value={payment.expiry} onChange={(e) => setPayment({ ...payment, expiry: e.target.value })} placeholder="MM/YY" required />
            </div>
            <div>
              <label htmlFor="pay-cvc">CVC</label>
              <input id="pay-cvc" autoComplete="cc-csc" value={payment.cvc} onChange={(e) => setPayment({ ...payment, cvc: e.target.value })} placeholder="123" required />
            </div>
          </div>
          <div className="drawer-total"><span>Total due</span><span>{format(totalCents)}</span></div>
          <button className="btn-primary full" type="submit">Place Order (demo)</button>
        </form>
      )}

      {step === 4 && confirmedOrder && (
        <div className="checkout-confirmed">
          <span className="bean-shape" style={{ margin: "0 auto 16px" }} />
          <p className="eyebrow">order confirmed</p>
          <h2>Thank you — {confirmedOrder.id} is roasting soon</h2>
          <p className="quiz-copy">A confirmation would normally land in your inbox. For now, find it any time in My Aroma Journey.</p>
          <div className="checkout-confirmed-actions">
            <button className="btn-primary" onClick={() => go("journey")}>View my orders</button>
            <button className="btn-outline" onClick={() => go("shop")}>Continue shopping</button>
          </div>
        </div>
      )}
    </div>
  );
}
