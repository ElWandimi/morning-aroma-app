import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { Glass, PhotoMarquee, Steam, WaveDivider } from "../components";
import { useAdmin, useCart, useCurrency, useRoute, pathFor } from "../context";
import { COUNTRY_JOURNEY_PHOTO, MOMENTS } from "../data";
import { slugify, activateOnEnterOrSpace, getProductPhotoUrl } from "../utils/helpers";
import { usePrefersReducedMotion } from "../hooks";

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
      <Steam className="hero-steam" />
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
  return (
    <section className="premium">
      <div className="section-head dark">
        <p className="eyebrow gold">rare &amp; limited</p>
        <h2>The Premium &amp; Rare Tier</h2>
      </div>
      <div className="hscroll">
        {premiumProducts.map((c) => (
          <div key={c.id} className="premium-card">
            <div className="premium-photo" aria-hidden="true" style={{ backgroundImage: `url('${getProductPhotoUrl(c, COUNTRY_JOURNEY_PHOTO, 450)}')` }} />
            <h3>{c.name} — {c.country}</h3>
            <p className="note handwritten">{c.note}</p>
            <div className="premium-foot">
              <span>{format(getPrice(c.id))}</span>
              <button className="btn-outline light small" onClick={() => go("product", { id: c.id })}>View</button>
            </div>
          </div>
        ))}
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
              <h4>{m.name}</h4>
              <a href={pathFor("moment", { id: m.id })} onClick={(e) => { e.preventDefault(); go("moment", { id: m.id }); }} aria-label={`Explore ${m.name}`}>Explore →</a>
            </div>
          ))}
        </div>
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
          <h4>{i.t}</h4>
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
      <PhotoMarquee />
      <LiveMessageBar messages={kenyaMessages} />
      <PremiumTier />
      <WaveDivider fill="#E8D5B5" />
      <QuizPanel />
      <EverydayTier />
      <MomentsSnapshot />
      <SourceTrust />
      <SeasonalBanner />
    </>
  );
}
