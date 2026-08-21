import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { useAdmin, useCart, useCurrency, useRoute } from "../context";
import { BREW_GUIDES, PRODUCTS } from "../data";
import { slugify } from "../utils/helpers";

// Hub-page photography (sourced from Pexels) — a distinct, complete set covering all 6 methods,
// separate from BREW_GUIDE_PHOTOS below (which only covers the 2 guides with a matching detail-page photo).
const BREW_GUIDE_HUB_PHOTOS = {
  "Pour-Over": "https://images.pexels.com/photos/8004598/pexels-photo-8004598.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "French Press": "https://images.pexels.com/photos/34067716/pexels-photo-34067716.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "Espresso": "https://images.pexels.com/photos/8429813/pexels-photo-8429813.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "Cold Brew": "https://images.pexels.com/photos/34170574/pexels-photo-34170574.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "Moka Pot": "https://images.pexels.com/photos/6255/pexels-photo-6255.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "Aeropress": "https://images.pexels.com/photos/31967899/pexels-photo-31967899.jpeg?auto=compress&cs=tinysrgb&w=1200",
};

export function BrewGuidesHubPage() {
  const { go } = useRoute();
  return (
    <div className="shop-page">
      <div className="shop-head">
        <p className="eyebrow">three steps, every method</p>
        <h1>Brew Guides</h1>
        <p className="shop-sub">Pick your equipment — we'll tell you the ratio, the timing, and what to expect in the cup.</p>
      </div>
      <div className="moments-hub-list">
        {BREW_GUIDES.map((g, i) => {
          const photoFirst = i % 2 === 0;
          return (
            <div
              key={g.name}
              className={`moment-story-row ${photoFirst ? "moment-story-row-reverse" : ""}`}
              onClick={() => go("brewguide", { id: slugify(g.name) })}
              style={{ cursor: "pointer" }}
            >
              <div className="moment-story-text">
                <span className="guide-icon">{g.icon}</span>
                <h3>{g.name}</h3>
                <p>{g.flavor}</p>
                <span className="moment-cta">View guide →</span>
              </div>
              <div className="moment-story-photo" style={{ backgroundImage: `url('${BREW_GUIDE_HUB_PHOTOS[g.name]}')` }} role="img" aria-label={`${g.name} brewing`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

const BREW_GUIDE_PHOTOS = {
  "Pour-Over": "/photos/brew-pourover.jpg",
  "French Press": "/photos/brew-frenchpress.jpg",
  "Espresso": "https://images.pexels.com/photos/8429813/pexels-photo-8429813.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "Cold Brew": "https://images.pexels.com/photos/34170574/pexels-photo-34170574.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "Moka Pot": "https://images.pexels.com/photos/6255/pexels-photo-6255.jpeg?auto=compress&cs=tinysrgb&w=1200",
  "Aeropress": "https://images.pexels.com/photos/31967899/pexels-photo-31967899.jpeg?auto=compress&cs=tinysrgb&w=1200",
};

export function BrewGuidePage({ id }) {
  const { go } = useRoute();
  const { add } = useCart();
  const { getPrice } = useAdmin();
  const { format } = useCurrency();
  const guide = BREW_GUIDES.find((g) => slugify(g.name) === id);
  if (!guide) {
    return (
      <div className="empty-state" style={{ padding: 80 }}>
        <p>We couldn't find that brew guide.</p>
        <button className="btn-outline small" onClick={() => go("brewguides")}>Back to Brew Guides</button>
      </div>
    );
  }
  let matched = PRODUCTS.filter((p) => p.tags.brew.includes(guide.name));
  if (matched.length === 0) matched = PRODUCTS.slice(0, 3);
  const guidePhoto = BREW_GUIDE_PHOTOS[guide.name];

  return (
    <div className="product-page">
      <button className="link-btn back-link" onClick={() => go("brewguides")}>← All Brew Guides</button>
      <div className="guide-detail-head">
        <span className="guide-icon big">{guide.icon}</span>
        <h1>{guide.name}</h1>
        <p className="handwritten moment-tagline dark">{guide.flavor}</p>
      </div>

      {guidePhoto ? (
        <div className="moment-story-row">
          <div className="moment-story-text">
            <div className="mini-brew" style={{ marginTop: 0 }}>
              <h3>Method</h3>
              <ol>
                {guide.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </div>
          </div>
          <div className="moment-story-photo" style={{ backgroundImage: `url('${guidePhoto}')` }} role="img" aria-label={`${guide.name} brewing`} />
        </div>
      ) : (
        <div className="mini-brew">
          <h3>Method</h3>
          <ol>
            {guide.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      )}

      <div className="course-link-row">
        <span>Want to go deeper?</span>
        <button className="btn-outline small" onClick={() => go("course", { id: slugify(guide.course) })}>Take the {guide.course} course →</button>
      </div>

      <h3 className="matched-head">Match Your Aroma</h3>
      <div className="hscroll light">
        {matched.map((p) => (
          <div key={p.id} className="premium-card light-card">
            <div className={`premium-photo ${p.tier === "premium" ? "" : "everyday-tone"}`} onClick={() => go("product", { id: p.id })} style={{ cursor: "pointer", backgroundImage: `url('/photos/products/${p.id}.png')` }} />
            <h3 onClick={() => go("product", { id: p.id })} style={{ cursor: "pointer" }}>{p.name} — {p.country}</h3>
            <p className="note">{p.note}</p>
            <div className="premium-foot">
              <span>{format(getPrice(p.id))}</span>
              <button className="btn-cart" onClick={() => add(p.id)}>🛒 Add</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
