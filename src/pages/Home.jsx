import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { Glass, PhotoMarquee, WaveDivider } from "../components";
import { useAdmin, useCart, useCurrency, useRoute, pathFor } from "../context";
import { COUNTRIES, COUNTRY_JOURNEY_PHOTO, MOMENTS } from "../data";
import { slugify, activateOnEnterOrSpace, getProductPhotoUrl } from "../utils/helpers";
import { usePrefersReducedMotion } from "../hooks";

export function TrustBar() {
  // Every item here is a real, already-substantiated fact elsewhere in the app -- not invented
  // marketing copy. $60 matches the live announcement bar's free-shipping threshold; Paystack is
  // the actual checkout provider (see Checkout.jsx); "small batches" and the two-week ship window
  // are the FAQ's real answer on freshness, not "roasted to order" (which the FAQ doesn't
  // actually claim -- roasting doesn't happen after purchase here). No customer/order count is
  // used since there's no real figure anywhere in the app to cite -- "Traceable to origin" (a
  // shorter teaser of the same claim SourceTrust makes further down the page) fills that slot
  // honestly instead.
  const items = [
    { icon: "🚚", text: "Free shipping over $60" },
    { icon: "🔒", text: "Secure checkout via Paystack" },
    { icon: "☕", text: "Small-batch roasted, shipped within 2 weeks" },
    { icon: "🌍", text: "Traceable to origin" },
  ];
  return (
    <div className="trust-bar">
      {items.map((item) => (
        <span key={item.text} className="trust-bar-item">
          <span aria-hidden="true">{item.icon}</span> {item.text}
        </span>
      ))}
    </div>
  );
}

export function Hero() {
  const { go } = useRoute();
  const reducedMotion = usePrefersReducedMotion();
  return (
    <section className="hero">
      <video
        className="hero-video"
        autoPlay={!reducedMotion}
        loop
        muted
        playsInline
        poster="/video/hero-poster.jpg"
        aria-hidden="true"
      >
        <source src="/video/hero-coffee.mp4" type="video/mp4" />
      </video>
      <div className="hero-overlay" />
      <div className="hero-content">
        <p className="handwritten hero-eyebrow">a note from the roastery —</p>
        <h1 className="hero-title">
          Find Your Morning<br />
          <span className="hero-title-accent">Aroma</span>
        </h1>
        <p className="hero-sub">
          Every cup begins as a story — a hillside, a hand, a harvest. We just help it reach yours, still warm.
        </p>
        <div className="hero-actions">
          <button className="btn-primary" onClick={() => go("quiz")}>Take the Aroma Quiz</button>
          <button className="btn-outline light" onClick={() => go("shop")}>Explore the Shop</button>
        </div>
      </div>
      <div className="pour-line" />
    </section>
  );
}

export function PremiumTier() {
  const { go } = useRoute();
  const { getPrice, getAllProducts } = useAdmin();
  const { format } = useCurrency();
  const premiumProducts = getAllProducts().filter((p) => p.tier === "premium");
  // Same reasoning as EverydayTier below: premium-tier products come from the live, admin-editable
  // catalog, not static data -- if every one is ever discontinued or briefly unset, rendering the
  // section's own dark photo background and heading around an empty scroll row would look like a
  // real bug rather than a quiet moment, so nothing to show means the section doesn't render.
  if (premiumProducts.length === 0) return null;
  // A real flag per card (COUNTRIES already has one for every country a real product uses,
  // verified against the live catalog, not just the specific names an example list happened to
  // mention) plus one of 3 subtle warm-palette tint variants, cycled by position -- reusing the
  // site's own existing tokens (gold/terracotta/green, already used elsewhere on this page)
  // rather than generating arbitrary per-origin colors that could clash with the palette. The
  // card layout, photo, price, and button are all untouched -- only a small flag badge and a
  // barely-there tint are added.
  const accentClasses = ["accent-a", "accent-b", "accent-c"];
  return (
    <section className="premium">
      <div className="section-head dark">
        <p className="eyebrow gold">rare &amp; limited</p>
        <h2>The Premium &amp; Rare Tier</h2>
      </div>
      <div className="hscroll">
        {premiumProducts.map((c, i) => {
          const countryInfo = COUNTRIES.find((co) => co.name === c.country);
          return (
            <div key={c.id} className={`premium-card ${accentClasses[i % accentClasses.length]}`}>
              <div className="premium-photo" aria-hidden="true" style={{ backgroundImage: `url('${getProductPhotoUrl(c, COUNTRY_JOURNEY_PHOTO, 450)}')` }}>
                {countryInfo?.flag && <span className="premium-flag" aria-hidden="true">{countryInfo.flag}</span>}
              </div>
              <h3>{c.name} — {c.country}</h3>
              <p className="note handwritten">{c.note}</p>
              <div className="premium-foot">
                <span>{format(getPrice(c.id))}</span>
                <button className="btn-outline light small" onClick={() => go("product", { id: c.id })}>View</button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function QuizPanel() {
  const { go } = useRoute();
  return (
    <section className="quiz-section">
      <Glass className="quiz-panel">
        <p className="eyebrow">two minutes, one perfect cup</p>
        <h2>What's Your Aroma?</h2>
        <p className="quiz-copy">
          Tell us how you take your mornings — slow and floral, or bold and urgent — and we'll pour you a match.
        </p>
        <button className="btn-primary" onClick={() => go("quiz")}>Start the Quiz</button>
      </Glass>
    </section>
  );
}

export function EverydayTier() {
  const { go } = useRoute();
  const { add } = useCart();
  const { getPrice, getAllProducts } = useAdmin();
  const { format } = useCurrency();
  const everydayProducts = getAllProducts().filter((p) => p.tier === "everyday");
  // Unlike MOMENTS (static data below, always non-empty), everyday-tier products come from the
  // live catalog -- if every one is ever discontinued or briefly unset, rendering the section's
  // own background wash and heading around an empty grid would look like a real bug rather than
  // an intentionally quiet moment, so this follows the same convention as LiveMessageBar above:
  // nothing to show means the section doesn't render at all.
  if (everydayProducts.length === 0) return null;
  return (
    <section className="everyday">
      <div className="everyday-inner">
        <div className="section-head">
          <h2>Most Consumed</h2>
          <p className="section-sub">The bags our regulars keep reordering — what's actually poured every morning, not just what's featured.</p>
        </div>
        <div className="grid4">
          {everydayProducts.map((c) => (
            <div key={c.id} className="everyday-card">
              <div
                className="everyday-photo"
                onClick={() => go("product", { id: c.id })}
                onKeyDown={activateOnEnterOrSpace(() => go("product", { id: c.id }))}
                role="link" tabIndex={0} aria-label={`${c.name} — ${c.country} coffee bag`}
                style={{ cursor: "pointer", backgroundImage: `url('${getProductPhotoUrl(c, COUNTRY_JOURNEY_PHOTO, 450)}')` }}
              />
              <h3><span onClick={() => go("product", { id: c.id })} onKeyDown={activateOnEnterOrSpace(() => go("product", { id: c.id }))} role="link" tabIndex={0} style={{ cursor: "pointer" }}>{c.name} — {c.country}</span></h3>
              <p>{c.note}</p>
              <div className="premium-foot">
                <span>{format(getPrice(c.id))}</span>
                <button className="btn-cart" onClick={() => add(c.id)}>🛒 Add to cart</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function MomentsSnapshot() {
  const { go } = useRoute();
  return (
    <section className="moments">
      <div className="moments-inner">
        <div className="section-head">
          <h2>Coffee Moments</h2>
          <p className="section-sub">Every hour of the day has its own cup. Find the one that matches yours.</p>
        </div>
        <div className="grid4">
          {MOMENTS.map((m) => (
            <div key={m.id} className="moment-card" onClick={() => go("moment", { id: m.id })} style={{ cursor: "pointer" }}>
              <span className="moment-icon">{m.icon}</span>
              <h3>{m.name}</h3>
              <a href={pathFor("moment", { id: m.id })} onClick={(e) => { e.preventDefault(); go("moment", { id: m.id }); }} aria-label={`Explore ${m.name}`}>Explore →</a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SocialProof() {
  const { getAllProducts, getProductFeedback, realProductsLoading } = useAdmin();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const premiumProducts = getAllProducts().filter((p) => p.tier === "premium");

  useEffect(() => {
    if (realProductsLoading || premiumProducts.length === 0) return;
    let cancelled = false;
    // Real, already-public per-product feedback (the same api.getProductFeedback ProductPage
    // uses, no auth token required) -- sampled across a handful of premium products rather than
    // one hardcoded product id, matching how PremiumTier itself reads the live catalog instead of
    // assuming a fixed list. Real customer feedback here is intentionally anonymous (no name
    // field exists on a review record at all, confirmed against ProductPage's own rendering of
    // it) -- quotes are attributed by what was bought, not a fabricated customer name.
    const sample = premiumProducts.slice(0, 5);
    Promise.all(sample.map((p) => getProductFeedback(p.id).then((list) => list.map((r) => ({ ...r, product: p })))))
      .then((results) => {
        if (cancelled) return;
        const withNotes = results.flat().filter((r) => r.note && r.note.trim());
        setReviews(withNotes);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [realProductsLoading, premiumProducts.length]);

  // Nothing invented here: this only renders once real, written feedback actually exists (a note
  // field a customer genuinely typed, not a rating alone) -- an empty state that shows nothing is
  // more honest than a placeholder implying reviews exist when this environment simply hasn't
  // collected any yet.
  if (loading || reviews.length === 0) return null;

  const featured = reviews.slice(0, 4);
  const avgRating = (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1);

  return (
    <section className="social-proof">
      <div className="section-head">
        <p className="eyebrow">from real orders</p>
        <h2>What People Are Saying</h2>
        <p className="section-sub">{avgRating}/5 average from {reviews.length} review{reviews.length === 1 ? "" : "s"} across our premium lots.</p>
      </div>
      <div className="social-proof-grid">
        {featured.map((r) => (
          <div key={r.id} className="social-proof-card">
            <div className="social-proof-beans">
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className="bean-shape small" style={{ background: n <= r.rating ? "var(--terracotta-btn)" : "var(--gold)", opacity: n <= r.rating ? 1 : 0.4 }} />
              ))}
            </div>
            <p className="social-proof-note">"{r.note}"</p>
            <p className="social-proof-attribution">— {r.product.name}, {r.product.country}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AcademyTeaser() {
  const { go } = useRoute();
  const { getAllCourses, realCoursesLoading } = useAdmin();
  const { format } = useCurrency();
  // Three courses, not the whole catalog -- this is a teaser pointing at Academy, not a second
  // catalog page. Picks the first three the admin-managed list returns, so it always reflects
  // real, current courses rather than a hardcoded set of ids that would silently go stale (or
  // break entirely) the day one of those specific courses is renamed or discontinued.
  const featured = getAllCourses().slice(0, 3);
  // Same convention as EverydayTier/PremiumTier above: nothing real to feature means the section
  // doesn't render, rather than showing an empty teaser for a catalog that doesn't exist yet.
  if (realCoursesLoading || featured.length === 0) return null;
  return (
    <section className="academy-teaser">
      <div className="section-head">
        <h2>You Might Be Interested in Our Academy</h2>
        <p className="section-sub">Real courses on brewing, tasting, and roasting — taught by people who do this for a living, not just write about it.</p>
      </div>
      <div className="course-grid">
        {featured.map((c) => (
          <div key={c.id} className="course-card" onClick={() => go("course", { id: c.id })} onKeyDown={activateOnEnterOrSpace(() => go("course", { id: c.id }))} role="link" tabIndex={0}>
            <p className="eyebrow">{c.category}</p>
            <h3>{c.name}</h3>
            <p>{c.blurb}</p>
            <div className="course-meta">
              <span>{c.lessons} lessons</span>
              <span>{c.instructor}</span>
            </div>
            <p className="course-price">{format(c.monthlyPriceCents)}/mo</p>
          </div>
        ))}
      </div>
      <div className="academy-teaser-cta">
        <button className="btn-outline" onClick={() => go("academy")}>See All Courses</button>
      </div>
    </section>
  );
}

export function SourceTrust() {
  const items = [
    { t: "Traceable", d: "Every bag names its farm." },
    { t: "Fair FOB", d: "Prices published, not hidden." },
    { t: "Direct trade", d: "We visit before we buy." },
  ];
  return (
    <section className="trust">
      {items.map((i) => (
        <div key={i.t} className="trust-col">
          <h3>{i.t}</h3>
          <p>{i.d}</p>
        </div>
      ))}
    </section>
  );
}

export function LiveMessageBar({ messages, label = "Auction Beat" }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!messages || messages.length < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % messages.length), 5000);
    return () => clearInterval(t);
  }, [messages]);
  if (!messages || messages.length === 0) return null;
  return (
    <div className="live-bar">
      <span className="live-dot" aria-hidden="true" />
      <span className="live-label">{label}</span>
      <span className="live-message">{messages[i]}</span>
    </div>
  );
}

export function SeasonalBanner() {
  const { go } = useRoute();
  return (
    <section className="seasonal">
      <div className="seasonal-inner">
        <div>
          <p className="eyebrow gold">just arrived</p>
          <h3>Kenya's main harvest is landing now</h3>
        </div>
        <button className="btn-outline light" onClick={() => go("country", { id: slugify("Kenya") })}>See the Harvest Calendar</button>
      </div>
    </section>
  );
}

export function HomePage() {
  const { kenyaMessages } = useAdmin();
  return (
    <>
      <Hero />
      <TrustBar />
      <PhotoMarquee />
      <LiveMessageBar messages={kenyaMessages} />
      <PremiumTier />
      <WaveDivider fill="#E8D5B5" />
      <QuizPanel />
      <EverydayTier />
      <MomentsSnapshot />
      <AcademyTeaser />
      <SocialProof />
      <SourceTrust />
      <SeasonalBanner />
    </>
  );
}
