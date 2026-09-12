import React, { useState } from "react";
import { useAdmin, useAuth, useRoute, useToast } from "../context";
import { FAQ_ITEMS, SERVICES, SERVICE_PROCESS } from "../data";
import { useStructuredData } from "../hooks";

export function OurServicesPage() {
  const { user } = useAuth();
  const { go } = useRoute();
  const { addServiceInquiry, addQuotation } = useAdmin();
  const { addToast } = useToast();
  const [sent, setSent] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [company, setCompany] = useState("");
  const [interest, setInterest] = useState("Remote Consulting");
  const [message, setMessage] = useState("");
  const [openFaqIdx, setOpenFaqIdx] = useState(null);
  // The wholesale quotation form previously lived in the global footer (every page) as a
  // collapsed button; this moves the actual page it opens onto here, its own dedicated section --
  // a genuinely different intent from the consultation form above it (bulk/retail coffee orders,
  // not roasting consulting or auction representation), so it gets its own state and its own
  // addQuotation call rather than folding into the interest dropdown above.
  const [quoteSent, setQuoteSent] = useState(false);
  const [quoteName, setQuoteName] = useState(user?.name || "");
  const [quoteEmail, setQuoteEmail] = useState(user?.email || "");
  const [variety, setVariety] = useState("");
  const [quantity, setQuantity] = useState("");
  const [quoteMessage, setQuoteMessage] = useState("");

  // Real Service structured data -- the same pattern ProductPage and CoursePage already use,
  // previously missing here even though this page is exactly the kind of commercial-offering
  // content that benefits from it (search engines can surface it as a distinct service listing,
  // not just an unstructured page of text).
  useStructuredData({
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Coffee roasting and brewing consulting, coffee auction representation",
    provider: { "@type": "Organization", name: "Morning Aroma", sameAs: `${window.location.origin}/` },
    areaServed: "Worldwide (remote consulting); Kenya (auction representation)",
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Our Services",
      itemListElement: SERVICES.map((s) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: s.title, description: s.description },
      })),
    },
  });

  // Reuses the site's one shared FAQ_ITEMS list (tagged by topic) rather than a second,
  // duplicated set of services-specific questions -- these three also show up on the main FAQ
  // page, so there's one place to keep the actual answers accurate, not two.
  const servicesFaq = FAQ_ITEMS.filter((f) => f.topic === "services");

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

      {servicesFaq.length > 0 && (
        <div className="services-faq">
          <div className="shop-head">
            <p className="eyebrow">questions</p>
            <h2>Common Questions</h2>
          </div>
          <div className="faq-list">
            {servicesFaq.map((f, i) => (
              <div key={f.q} className={`faq-item ${openFaqIdx === i ? "open" : ""}`}>
                <button className="faq-question" onClick={() => setOpenFaqIdx(openFaqIdx === i ? null : i)}>
                  <span>{f.q}</span>
                  <span className="faq-chevron">{openFaqIdx === i ? "−" : "+"}</span>
                </button>
                {openFaqIdx === i && <p className="faq-answer">{f.a}</p>}
              </div>
            ))}
          </div>
          <p className="hint services-faq-more">
            More questions? See the full <button type="button" className="link-btn" onClick={() => go("faq")}>FAQ</button>.
          </p>
        </div>
      )}

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

      <div className="service-inquiry wholesale-inquiry">
        <div className="service-inquiry-inner">
          <div>
            <p className="eyebrow">bulk &amp; retail orders</p>
            <h2>Wholesale &amp; Bulk Orders</h2>
            <p className="shop-sub" style={{ margin: "8px 0 0", maxWidth: 420 }}>
              Roasting for a café, restaurant, or office? Tell us the variety and volume and we'll send a quotation — usually within two business days.
            </p>
          </div>
          <div className="service-inquiry-form">
            {quoteSent ? (
              <p className="form-success">Thank you — your note has reached us. We'll reply within two business days.</p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addQuotation({ name: quoteName, email: quoteEmail, variety, quantity, message: quoteMessage });
                  setQuoteSent(true);
                  addToast("Quotation request sent");
                }}
              >
                <label htmlFor="quote-name">Name</label>
                <input id="quote-name" value={quoteName} onChange={(e) => setQuoteName(e.target.value)} autoComplete="name" maxLength={120} required />
                <label htmlFor="quote-email">Email</label>
                <input id="quote-email" type="email" value={quoteEmail} onChange={(e) => setQuoteEmail(e.target.value)} autoComplete="email" maxLength={254} required />
                <label htmlFor="quote-variety">Variety of interest</label>
                <select id="quote-variety" value={variety} onChange={(e) => setVariety(e.target.value)} required>
                  <option value="" disabled>Variety of interest</option>
                  <option>Premium</option>
                  <option>Everyday</option>
                  <option>Not sure yet</option>
                </select>
                <label htmlFor="quote-quantity">Estimated quantity</label>
                <input id="quote-quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g. 40kg/month" maxLength={60} />
                <label htmlFor="quote-message">Tell us what you're looking for</label>
                <textarea id="quote-message" value={quoteMessage} onChange={(e) => setQuoteMessage(e.target.value)} rows={4} maxLength={1000} />
                <button className="btn-primary full" type="submit" style={{ marginTop: 14 }}>Send request</button>
                <p className="hint" style={{ marginTop: 10 }}>
                  {user ? "Signed in — we'll route this straight to our trade team." : "Already work with us as a roaster? Sign in and this goes straight to your account rep."}
                </p>
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="services-related">
        <p className="eyebrow">related</p>
        <div className="services-related-links">
          <button type="button" className="services-related-card" onClick={() => go("academy")}>
            <span className="service-icon">🎓</span>
            <h4>Academy</h4>
            <p>Prefer to train your own team directly? Our courses cover the same skills these consulting sessions do — self-paced, on your own schedule.</p>
          </button>
          <button type="button" className="services-related-card" onClick={() => go("greenbeans")}>
            <span className="service-icon">🌱</span>
            <h4>Green Coffee</h4>
            <p>Sourcing lots yourself once you know what you're after? The same traceable origins we cup for auction clients are available unroasted, by the kilogram.</p>
          </button>
        </div>
      </div>
    </div>
  );
}
