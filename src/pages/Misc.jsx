import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { useAdmin, useAuth, useRoute } from "../context";
import { COUNTRIES, FAQ_ITEMS, PROCESSING_METHODS } from "../data";
import { fmtPrice, slugify } from "../utils/helpers";
import { useStructuredData } from "../hooks";

export function PrivacyPolicyPage() {
  return (
    <div className="legal-page">
      <div className="shop-head">
        <p className="eyebrow">last updated August 2026</p>
        <h1>Privacy Policy</h1>
      </div>
      <div className="legal-body">
        <p className="hint" style={{ marginBottom: 24 }}>
          This is a working prototype, and this policy is written to reflect what a real Morning Aroma
          deployment would need — see the "What this prototype actually does" note at the end for the
          honest, current state of data handling in this build specifically.
        </p>

        <h3>What we collect</h3>
        <p>When you use Morning Aroma, we collect information you give us directly: your name and email
        when you create an account or sign in; shipping details at checkout; the notes, ratings, and
        varieties you log in My Aroma Journey; messages you send through the contact form, the footer
        quotation form, the Our Services inquiry form, the Green Coffee wholesale order form, or live
        chat; and reviews submitted through "Leave Your Aroma."</p>

        <h3>How we use it</h3>
        <p>We use this information to fulfil orders, respond to inquiries, personalize recommendations
        based on your tasting history, and improve the site. We do not sell your personal information
        to third parties.</p>

        <h3>Local storage and cookies</h3>
        <p>Your shopping cart and wishlist are saved in your browser's local storage so they survive a
        page refresh — this data stays on your device and is not transmitted to us or any third party.
        We do not currently use tracking cookies or third-party analytics; if that changes, this policy
        will be updated first.</p>

        <h3>Data retention and your rights</h3>
        <p>You can request a copy of the data we hold about you, ask us to correct it, or ask us to
        delete your account and associated data, by contacting us at the email address below. We retain
        order records as required for accounting and legal purposes; other data is kept only as long as
        your account is active or as needed to provide the service.</p>

        <h3>Children's privacy</h3>
        <p>Morning Aroma is not directed at children under 16, and we do not knowingly collect
        information from them.</p>

        <h3>Changes to this policy</h3>
        <p>If we make material changes to how we handle your data, we'll update this page and, where
        appropriate, notify account holders directly.</p>

        <h3>Contact</h3>
        <p>Questions about this policy can be sent to the contact details in our footer.</p>

        <div className="legal-callout">
          <p className="filter-label" style={{ marginTop: 0 }}>What this prototype actually does, specifically</p>
          <p>This build has no real backend or database. Accounts, orders, journal entries, and admin
          edits exist only in your browser's memory for the current session and are lost on refresh —
          only the cart and wishlist persist, via local storage, exactly as described above. Nothing
          you enter anywhere on this site is transmitted to a real server. See <code>SECURITY.md</code> in
          the project repository for the full technical detail.</p>
        </div>
      </div>
    </div>
  );
}

export function TermsOfServicePage() {
  return (
    <div className="legal-page">
      <div className="shop-head">
        <p className="eyebrow">last updated August 2026</p>
        <h1>Terms of Service</h1>
      </div>
      <div className="legal-body">
        <h3>Acceptance of terms</h3>
        <p>By using Morning Aroma, you agree to these terms. If you don't agree, please don't use the
        site.</p>

        <h3>Using the site</h3>
        <p>You must be at least 16 years old to create an account. You agree to provide accurate
        information and to use the site only for lawful purposes — not to abuse, disrupt, or attempt to
        gain unauthorized access to any part of it, including the Admin Dashboard.</p>

        <h3>Accounts</h3>
        <p>You're responsible for keeping your account credentials confidential and for any activity
        under your account. Tell us right away if you believe your account has been compromised.</p>

        <h3>Orders and payment</h3>
        <p>Prices are shown at the time of browsing and are subject to change. Placing an order is an
        offer to purchase, which we may accept or decline — for example if a variety sells out between
        when you added it to your cart and when you check out.</p>

        <h3>Order cancellation and refunds</h3>
        <p>You can cancel an order yourself from My Aroma Journey while it's still in the "Processing"
        stage, before roasting has begun. Once an order moves to "Roasting" or beyond, cancellation is
        no longer available to you directly — contact us and we'll do what we can. Refunds are handled
        case by case and noted on your order's status.</p>

        <h3>Green coffee (wholesale)</h3>
        <p>Green, unroasted coffee is sold separately from our retail roasted catalog, by the kilogram,
        subject to the minimum order quantity listed on each lot. Submitting the wholesale order form
        on our Green Coffee page is a request, not a confirmed order — we follow up with a formal
        invoice and shipping details before anything is fulfilled or charged.</p>

        <h3>Our Services (consulting and auction representation)</h3>
        <p>Remote roasting/brewing consulting and Kenyan auction representation, described on our
        Our Services page, are provided under separate written terms agreed with each client following
        an inquiry, covering scope, fees, and cancellation — these general Terms of Service apply to
        your use of the website itself.</p>

        <h3>Reviews and content you submit</h3>
        <p>Reviews submitted through "Leave Your Aroma," along with journal notes and messages you
        submit, remain yours, but you grant us permission to use anonymized or aggregated versions (for
        example, in review summaries) in connection with operating the site. We moderate reviews before
        they're published publicly on a product's page, and may decline to publish a review at our
        discretion.</p>

        <h3>Intellectual property</h3>
        <p>The Morning Aroma name, branding, and site content are our property or used with permission.
        You may not reproduce or redistribute them without our consent.</p>

        <h3>Disclaimers</h3>
        <p>We work to keep information on this site accurate, including growing data, sensory profiles,
        and historical content, but we don't guarantee it's error-free. The site is provided "as is."</p>

        <h3>Changes to these terms</h3>
        <p>We may update these terms from time to time; continued use of the site after a change means
        you accept the update.</p>

        <h3>Contact</h3>
        <p>Questions about these terms can be sent to the contact details in our footer.</p>
      </div>
    </div>
  );
}

export function FaqPage() {
  const [openIdx, setOpenIdx] = useState(null);
  useStructuredData({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  });
  return (
    <div className="shop-page">
      <div className="shop-head">
        <p className="eyebrow">questions</p>
        <h1>FAQ</h1>
      </div>
      <div className="faq-list">
        {FAQ_ITEMS.map((f, i) => (
          <div key={f.q} className={`faq-item ${openIdx === i ? "open" : ""}`}>
            <button className="faq-question" onClick={() => setOpenIdx(openIdx === i ? null : i)}>
              <span>{f.q}</span>
              <span className="faq-chevron">{openIdx === i ? "−" : "+"}</span>
            </button>
            {openIdx === i && <p className="faq-answer">{f.a}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ContactPage() {
  const { user } = useAuth();
  const [sent, setSent] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [message, setMessage] = useState("");
  return (
    <div className="shop-page">
      <div className="shop-head">
        <p className="eyebrow">say hello</p>
        <h1>Contact Us</h1>
        <p className="shop-sub">Questions, wholesale, press, or just a coffee story you want to share — we read every message.</p>
      </div>
      <div className="checkout-form" style={{ maxWidth: 480 }}>
        {sent ? (
          <p className="form-success">Thanks — your message has reached us. We'll reply within two business days.</p>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
            <label htmlFor="contact-name">Name</label>
            <input id="contact-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} required />
            <label htmlFor="contact-email">Email</label>
            <input id="contact-email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" maxLength={254} required />
            <label htmlFor="contact-message">Message</label>
            <textarea id="contact-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={5} required maxLength={2000} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--gold)", fontFamily: "inherit", boxSizing: "border-box" }} />
            <button className="btn-primary full" type="submit" style={{ marginTop: 14 }}>Send message</button>
          </form>
        )}
      </div>
    </div>
  );
}

export function SourceLibraryPage() {
  const { go } = useRoute();
  // getPrice was never actually imported here at all -- a real, pre-existing bug that would
  // have crashed this exact page with the original 9 products too, just never triggered because
  // nobody had visited Source Library until now.
  const { getPrice, getAllProducts } = useAdmin();
  const products = getAllProducts();
  return (
    <div className="shop-page">
      <div className="shop-head">
        <p className="eyebrow">transparency, by design</p>
        <h1>Source Library</h1>
        <p className="shop-sub">Origin, producers, process, and price — the full picture behind every bag.</p>
      </div>

      <h3 className="matched-head">Origin map</h3>
      <div className="guide-grid" style={{ marginBottom: 40 }}>
        {COUNTRIES.map((c) => (
          <div key={c.name} className="guide-card" onClick={() => go("country", { id: slugify(c.name) })}>
            <span className="guide-icon">{c.flag}</span>
            <h3>{c.name}</h3>
            <p>{c.regions.map((r) => r.name).join(" · ")}</p>
            <span className="moment-cta">Explore →</span>
          </div>
        ))}
      </div>

      <h3 className="matched-head">Processing methods</h3>
      <div className="grid4" style={{ marginBottom: 40 }}>
        {PROCESSING_METHODS.map((m) => (
          <div key={m.name} className="everyday-card">
            <span className="guide-icon">{m.icon}</span>
            <h3>{m.name}</h3>
            <p>{m.note}</p>
          </div>
        ))}
      </div>

      <h3 className="matched-head">Published FOB pricing</h3>
      <div className="fob-table">
        <div className="fob-row fob-header">
          <span>Variety</span><span>Country</span><span>Retail</span><span>Paid to farmer (FOB)</span>
        </div>
        {products.map((p) => (
          <div key={p.id} className="fob-row" onClick={() => go("product", { id: p.id })}>
            <span>{p.name}</span>
            <span>{p.country}</span>
            <span>{fmtPrice(getPrice(p.id))}</span>
            <span>{fmtPrice(Math.round(getPrice(p.id) * 0.62))}</span>
          </div>
        ))}
      </div>
      <p className="hint" style={{ textAlign: "center", marginTop: 16 }}>FOB figures are illustrative for this prototype — the production build pulls live figures from each contract.</p>
    </div>
  );
}
