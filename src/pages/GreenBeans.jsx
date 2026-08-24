import React, { useState } from "react";
import { ShareButtons } from "../components";
import { useAdmin, useAuth, useCurrency, useToast } from "../context";
import { COUNTRY_JOURNEY_PHOTO } from "../data";

export function GreenBeansPage() {
  const { user } = useAuth();
  const { getGreenPrice, addGreenOrder, getAllGreenBeans, realGreenBeansLoading, realGreenBeansError, refetchRealGreenBeans } = useAdmin();
  const { format } = useCurrency();
  const { addToast } = useToast();

  const allGreenBeans = getAllGreenBeans();
  // No longer seeded from the static GREEN_BEANS import's first id -- that was a fragile
  // assumption (relies on the real, fetched data happening to still contain that exact id, in
  // whatever order). Starts unselected; the fallback below picks the first real bean once the
  // real data has actually loaded, rather than guessing at an id that might not even exist.
  const [selectedId, setSelectedId] = useState(null);
  const selected = allGreenBeans.find((g) => g.id === selectedId) || allGreenBeans[0];
  // Safe default rather than assuming `selected` exists -- during the brief window before the
  // real catalog has loaded (or if it's ever genuinely empty), `selected` is undefined here, and
  // reading .minOrderKg off it directly would throw a real runtime exception, not just show a
  // stale or misleading value the way a missing product did on the retail Shop page.
  const [quantityKg, setQuantityKg] = useState(selected?.minOrderKg ?? 1);
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [qtyError, setQtyError] = useState("");

  const pricePerKg = selected ? getGreenPrice(selected.id) : 0;
  const subtotalCents = Math.round(pricePerKg * quantityKg);

  const selectBean = (id) => {
    const bean = allGreenBeans.find((g) => g.id === id);
    if (!bean) return;
    setSelectedId(id);
    setQuantityKg(bean.minOrderKg);
    setQtyError("");
  };

  const submit = (e) => {
    e.preventDefault();
    if (!selected) return;
    if (quantityKg < selected.minOrderKg) {
      setQtyError(`Minimum order for this lot is ${selected.minOrderKg}kg.`);
      return;
    }
    if (quantityKg > selected.stockKg) {
      setQtyError(`Only ${selected.stockKg}kg currently in stock for this lot.`);
      return;
    }
    addGreenOrder({
      name, email, company, message,
      beanId: selected.id, beanName: selected.name, quantityKg,
      pricePerKgCentsAtOrder: pricePerKg, totalCents: subtotalCents,
    });
    setSent(true);
    addToast("Wholesale order request sent");
  };

  if (realGreenBeansLoading) return <p className="hint" style={{ padding: 80, textAlign: "center" }}>Loading…</p>;
  if (realGreenBeansError) {
    return (
      <div className="empty-state" style={{ padding: 80 }}>
        <p>Couldn't load the green coffee catalog: {realGreenBeansError}</p>
        <button className="btn-outline small" onClick={refetchRealGreenBeans}>Try again</button>
      </div>
    );
  }
  if (!selected) {
    return (
      <div className="empty-state" style={{ padding: 80 }}>
        <p>No green coffee lots are available right now — check back soon.</p>
      </div>
    );
  }

  return (
    <div className="services-page">
      <div className="services-hero">
        <p className="eyebrow gold">for roasters &amp; serious home-roasters</p>
        <h1>Green Coffee</h1>
        <p className="shop-sub" style={{ color: "var(--steam)" }}>
          The same nine traceable origins we roast ourselves, sold unroasted by the kilogram — so you can develop your own profile from our relationships and sourcing.
        </p>
        <ShareButtons path="#/green-beans" text="Green coffee, sold direct from origin — for roasters and serious home-roasters. Morning Aroma:" label="Share with a roaster" />
      </div>

      <div className="green-bean-grid">
        {allGreenBeans.map((g) => (
          <div
            key={g.id}
            className={`green-bean-card ${selectedId === g.id ? "selected" : ""}`}
            onClick={() => selectBean(g.id)}
          >
            <div className="green-bean-photo" style={{ backgroundImage: `url('${COUNTRY_JOURNEY_PHOTO[g.country]}')` }} />
            <div className="green-bean-info">
              <p className="eyebrow" style={{ marginBottom: 2 }}>{g.country}</p>
              <h3>{g.name}</h3>
              <div className="green-bean-stats">
                <span>Cupping <strong>{g.cuppingScore}</strong></span>
                <span>{g.process}</span>
                <span>Grade {g.grade}</span>
                <span>Moisture {g.moisture}</span>
              </div>
              <p className="note">{g.notes}</p>
              <div className="green-bean-price-row">
                <span className="green-bean-price">{format(getGreenPrice(g.id))}<span className="per-kg"> / kg</span></span>
                <span className={`green-bean-stock ${g.stockKg < 100 ? "low" : ""}`}>{g.stockKg}kg in stock</span>
              </div>
              <p className="hint" style={{ margin: "4px 0 0" }}>Minimum order {g.minOrderKg}kg</p>
            </div>
          </div>
        ))}
      </div>

      <div className="service-inquiry">
        <div className="service-inquiry-inner">
          <div>
            <p className="eyebrow">ready to order</p>
            <h2>Request a Wholesale Order</h2>
            <p className="shop-sub" style={{ margin: "8px 0 0", maxWidth: 420 }}>
              Pick a lot above, tell us how much you need, and we'll follow up with an invoice and shipping details within two business days.
            </p>
          </div>
          <div className="service-inquiry-form">
            {sent ? (
              <p className="form-success">Thank you — your wholesale order request for {selected.name} has reached our team. We'll follow up with an invoice within two business days.</p>
            ) : (
              <form onSubmit={submit}>
                <label htmlFor="gb-bean">Which lot?</label>
                <select id="gb-bean" value={selectedId} onChange={(e) => selectBean(e.target.value)}>
                  {allGreenBeans.map((g) => (
                    <option key={g.id} value={g.id}>{g.name} — {format(getGreenPrice(g.id))}/kg</option>
                  ))}
                </select>

                <label htmlFor="gb-qty">Quantity (kg)</label>
                <input
                  id="gb-qty"
                  type="number"
                  min={selected.minOrderKg}
                  max={selected.stockKg}
                  value={quantityKg}
                  onChange={(e) => { setQuantityKg(Number(e.target.value)); setQtyError(""); }}
                  required
                />
                {qtyError && <p className="form-error">{qtyError}</p>}
                <p className="hint" style={{ marginTop: -6 }}>
                  Min {selected.minOrderKg}kg · {selected.stockKg}kg available · Subtotal <strong>{format(subtotalCents)}</strong>
                </p>

                <label htmlFor="gb-name">Name</label>
                <input id="gb-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} required />
                <label htmlFor="gb-email">Email</label>
                <input id="gb-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={254} required />
                <label htmlFor="gb-company">Roastery / company</label>
                <input id="gb-company" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={120} required />
                <label htmlFor="gb-message">Anything else? (optional)</label>
                <textarea id="gb-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={800} placeholder="Shipping destination, timeline, sample requests…" />
                <button className="btn-primary full" type="submit" style={{ marginTop: 14 }}>Send order request</button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
