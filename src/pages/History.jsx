import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { Glass } from "../components";
import { useRoute } from "../context";
import { HISTORY_SECTIONS, LEGENDARY_MOMENTS } from "../data";
import { lerpColor } from "../utils/helpers";

export function HistorySection({ section, onLink }) {
  const ref = useRef(null);
  const setActive = onLink.setActive;
  const idx = onLink.idx;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(idx);
        });
      },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [idx, setActive]);

  return (
    <section
      ref={ref}
      className="history-section"
      style={{
        backgroundImage: `linear-gradient(160deg, ${section.colors[0]}dd, ${section.colors[1]}f0), url('${section.photo}')`,
      }}
    >
      <div className="history-texture" />
      <Glass className="history-panel" dark>
        <p className="eyebrow gold">{section.era}</p>
        <h2 className="history-title">{section.title}</h2>
        <p className="history-story">{section.story}</p>
        <p className="handwritten history-quote">{section.quote}</p>
        <button className="btn-outline light small" onClick={() => onLink.go(section.linkPage, section.linkId ? { id: section.linkId } : {})}>
          {section.linkLabel}
        </button>
      </Glass>
    </section>
  );
}

export function HistoryPage() {
  const { go } = useRoute();
  const [active, setActive] = useState(0);
  const t = HISTORY_SECTIONS.length > 1 ? active / (HISTORY_SECTIONS.length - 1) : 0;
  const beanColor = lerpColor("6B7B50", "3E2C23", t);

  return (
    <div className="history-page">
      <div className="history-intro">
        <p className="eyebrow">the bean's journey</p>
        <h1>From a Dancing Goat to Your Cup</h1>
        <p className="shop-sub">Twelve centuries, six turning points, one plant. Scroll to follow the story.</p>
      </div>

      <div className="history-timeline" aria-hidden="true">
        <div className="history-timeline-track" />
        <div className="history-timeline-bean" style={{ top: `${t * 100}%`, background: beanColor }} />
      </div>

      {HISTORY_SECTIONS.map((s, i) => (
        <HistorySection key={s.id} section={s} onLink={{ go, setActive, idx: i }} />
      ))}

      <div className="legend-intro">
        <p className="eyebrow gold">moments that changed everything</p>
        <h2>Legendary Coffee Moments</h2>
        <p className="shop-sub" style={{ color: "var(--steam)" }}>Eight sparks, five centuries apart, that turned a shrub into a ritual the whole world shares.</p>
      </div>
      <div className="guide-grid legend-grid">
        {LEGENDARY_MOMENTS.map((m) => (
          <div key={m.year} className="legend-card" style={{ backgroundImage: `linear-gradient(rgba(20,13,9,0.35), rgba(20,13,9,0.85)), url('${m.photo}')` }}>
            <span className="legend-year">{m.year}</span>
            <h3>{m.title}</h3>
            <p>{m.story}</p>
          </div>
        ))}
      </div>

      <div className="moment-story-row" style={{ background: "var(--espresso)", maxWidth: "none", padding: "70px 24px" }}>
        <div className="moment-story-text">
          <p className="eyebrow gold">five centuries, one plant</p>
          <p className="moment-description" style={{ color: "var(--steam)" }}>
            From a goat herder's discovery in the Ethiopian highlands to the third-wave roasters treating it like
            wine, coffee's history is really a history of people finding reasons to gather around it. Every cup
            we roast today carries that same thread forward — a hillside, a hand, a harvest, still.
          </p>
        </div>
        <div className="moment-story-photo" style={{ backgroundImage: "url('/photos/history-outro.jpg')" }} role="img" aria-label="Coffee cup resting on scattered roasted beans" />
      </div>

      <div className="history-outro">
        <p className="eyebrow">the story continues today</p>
        <h3>See how coffee is still ritual, everywhere</h3>
        <button className="btn-primary" onClick={() => go("rituals")}>Explore Global Rituals →</button>
      </div>
    </div>
  );
}
