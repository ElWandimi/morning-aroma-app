import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { useAdmin, useCart, useCurrency, useRoute, pathFor } from "../context";
import { COUNTRY_JOURNEY_PHOTO, MOMENTS, PRODUCTS } from "../data";
import { slugify, activateOnEnterOrSpace, getProductPhotoUrl } from "../utils/helpers";

const MOMENT_PHOTOS = {
  "first-light": "/photos/moment-first-light.jpg",
  "the-hustle": "/photos/moment-hustle.jpg",
  "the-reset": "/photos/moment-reset.jpg",
  "comfort": "/photos/moment-comfort.jpg",
};

export function MomentsHubPage() {
  const { go } = useRoute();
  const { getMomentContent } = useAdmin();
  return (
    <div className="moments-hub">
      <div className="shop-head">
        <p className="eyebrow">a cup for every hour</p>
        <h1>Coffee Moments</h1>
        <p className="shop-sub">Coffee isn't one mood. Pick the hour, and we'll pick the cup.</p>
      </div>
      <div className="moments-hub-list">
        {MOMENTS.map((raw, i) => {
          const m = getMomentContent(raw);
          const photoFirst = i % 2 === 0; // alternates: photo-left/text-right, then text-left/photo-right
          return (
            <div
              key={m.id}
              className={`moment-story-row ${photoFirst ? "moment-story-row-reverse" : ""}`}
              onClick={() => go("moment", { id: m.id })}
              style={{ cursor: "pointer" }}
            >
              <div className="moment-story-text">
                <span className="moment-icon big">{m.icon}</span>
                <h3>{m.name}</h3>
                <p>{m.benefit}</p>
                <span className="moment-cta">Explore this moment →</span>
              </div>
              <div className="moment-story-photo" style={{ backgroundImage: `url('${MOMENT_PHOTOS[m.id]}')` }} role="img" aria-label={`${m.name} coffee moment`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MomentPage({ id }) {
  const { go } = useRoute();
  const { add } = useCart();
  const { getPrice, getTier, getMomentContent } = useAdmin();
  const { format } = useCurrency();
  const rawMoment = MOMENTS.find((m) => m.id === id);
  if (!rawMoment) {
    return (
      <div className="empty-state" style={{ padding: 80 }}>
        <p>We couldn't find that moment.</p>
        <button className="btn-outline small" onClick={() => go("moments")}>Back to Moments</button>
      </div>
    );
  }
  const moment = getMomentContent(rawMoment);
  const matched = PRODUCTS.filter((p) => p.tags.moment === moment.name);

  return (
    <div className="moment-page">
      <div className={`moment-banner moment-banner-${moment.id}`}>
        <button className="link-btn back-link light" onClick={() => go("moments")}>← All Moments</button>
        <span className="moment-icon big">{moment.icon}</span>
        <h1>{moment.name}</h1>
        <p className="handwritten moment-tagline">{moment.benefit}</p>
      </div>

      <div className="moment-body">
        <div className="moment-story-row">
          <div className="moment-story-text">
            <p className="moment-description">{moment.description}</p>
          </div>
          <div className="moment-story-photo" style={{ backgroundImage: `url('${MOMENT_PHOTOS[moment.id]}')` }} role="img" aria-label={`${moment.name} coffee moment`} />
        </div>

        <div className="mini-brew">
          <div className="mini-brew-head">
            <h3>Mini brew guide — {moment.brewGuide}</h3>
            <a href={pathFor("brewguide", { id: slugify(moment.brewGuide) })} onClick={(e) => { e.preventDefault(); go("brewguide", { id: slugify(moment.brewGuide) }); }}>Full guide →</a>
          </div>
          <ol>
            {moment.brewSteps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>

        <h3 className="matched-head">Coffees for {moment.name}</h3>
        <div className="grid4">
          {matched.map((p) => (
            <div key={p.id} className="everyday-card">
              <div
                className={`everyday-photo ${p.tier === "premium" ? "premium-photo-sm" : ""}`}
                onClick={() => go("product", { id: p.id })}
                onKeyDown={activateOnEnterOrSpace(() => go("product", { id: p.id }))}
                role="link" tabIndex={0} aria-label={`${p.name} — ${p.country} coffee bag`}
                style={{ cursor: "pointer", backgroundImage: `url('${getProductPhotoUrl(p, COUNTRY_JOURNEY_PHOTO)}')` }}
              />
              <h3><span onClick={() => go("product", { id: p.id })} onKeyDown={activateOnEnterOrSpace(() => go("product", { id: p.id }))} role="link" tabIndex={0} style={{ cursor: "pointer" }}>{p.name} — {p.country}</span></h3>
              <p>{p.note}</p>
              <div className="premium-foot">
                <span>{format(getPrice(p.id))}</span>
                <button className="btn-cart" onClick={() => add(p.id)}>🛒 Add to cart</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
