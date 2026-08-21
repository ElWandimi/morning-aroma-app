import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { useAdmin, useAuth, useToast } from "../context";
import { SERVICES, SERVICE_PROCESS } from "../data";

export function OurServicesPage() {
  const { user } = useAuth();
  const { addServiceInquiry } = useAdmin();
  const { addToast } = useToast();
  const [sent, setSent] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [company, setCompany] = useState("");
  const [interest, setInterest] = useState("Remote Consulting");
  const [message, setMessage] = useState("");

  return (
    <div className="services-page">
      <div className="services-hero">
        <p className="eyebrow gold">for roasters, cafés &amp; buyers</p>
        <h1>Our Services</h1>
        <p className="shop-sub" style={{ color: "var(--steam)" }}>
          Coffee expertise, on your terms — whether that's a video call with your bar staff or a seat beside us on the Nairobi auction floor.
        </p>
      </div>

      <div className="services-grid">
        {SERVICES.map((s) => (
          <div key={s.id} className="service-card">
            <span className="service-icon">{s.icon}</span>
            <h2>{s.title}</h2>
            <p className="service-tagline handwritten">{s.tagline}</p>
            <p className="service-description">{s.description}</p>
            <ul className="service-bullets">
              {s.bullets.map((b, i) => (<li key={i}>{b}</li>))}
            </ul>
            <div className="service-fee">
              <p className="filter-label" style={{ marginTop: 0 }}>Fee</p>
              <p>{s.fee}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="service-process">
        <div className="shop-head">
          <p className="eyebrow">how it works</p>
          <h2>From inquiry to your cup — or your cupping table</h2>
        </div>
        <div className="process-grid">
          {SERVICE_PROCESS.map((p) => (
            <div key={p.step} className="process-card">
              <span className="process-step">{p.step}</span>
              <h4>{p.title}</h4>
              <p>{p.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="service-inquiry">
        <div className="service-inquiry-inner">
          <div>
            <p className="eyebrow">let's talk</p>
            <h2>Request a Consultation</h2>
            <p className="shop-sub" style={{ margin: "8px 0 0", maxWidth: 420 }}>
              Tell us what you need and we'll follow up within two business days — usually with a couple of times for a short discovery call.
            </p>
          </div>
          <div className="service-inquiry-form">
            {sent ? (
              <p className="form-success">Thank you — your request has reached our services team. We'll be in touch within two business days.</p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addServiceInquiry({ name, email, company, interest, message });
                  setSent(true);
                  addToast("Service inquiry sent");
                }}
              >
                <label htmlFor="svc-name">Name</label>
                <input id="svc-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} required />
                <label htmlFor="svc-email">Email</label>
                <input id="svc-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={254} required />
                <label htmlFor="svc-company">Company / café (optional)</label>
                <input id="svc-company" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={120} />
                <label htmlFor="svc-interest">Which service?</label>
                <select id="svc-interest" value={interest} onChange={(e) => setInterest(e.target.value)}>
                  <option>Remote Consulting</option>
                  <option>Kenyan Auction Representation</option>
                  <option>Both / not sure yet</option>
                </select>
                <label htmlFor="svc-message">Tell us more</label>
                <textarea id="svc-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={1000} placeholder="What are you hoping to get out of this?" required />
                <button className="btn-primary full" type="submit" style={{ marginTop: 14 }}>Send request</button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
