import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { useAdmin, useCurrency, useRoute } from "../context";
import { COUNTRIES, COUNTRY_JOURNEY_PHOTO, PRODUCTS } from "../data";
import { slugify } from "../utils/helpers";

export function WorldJourneyPage() {
  const { go } = useRoute();
  const { getPrice, getCountryHistory } = useAdmin();
  const { format } = useCurrency();
  return (
    <div className="world-journey-page">
      <div className="shop-head">
        <p className="eyebrow">every bag starts somewhere</p>
        <h1>The World Journey</h1>
        <p className="shop-sub">Eight countries, eight stories, one plant. Scroll through where your coffee actually comes from.</p>
      </div>

      {COUNTRIES.map((country) => {
        const varieties = PRODUCTS.filter((p) => p.country === country.name);
        return (
          <section
            key={country.name}
            className="wj-section"
            style={{ backgroundImage: `linear-gradient(rgba(20,13,9,0.58), rgba(20,13,9,0.72)), url('${COUNTRY_JOURNEY_PHOTO[country.name]}')` }}
          >
            <div className="wj-inner">
              <div className="wj-head">
                <span className="wj-flag">{country.flag}</span>
                <h2>{country.name}</h2>
              </div>
              <p className="wj-history">{getCountryHistory(country.name)}</p>

              <div className="wj-varieties">
                <p className="wj-varieties-label">Coffee grown here</p>
                <div className="chip-row">
                  {varieties.map((v) => (
                    <button key={v.id} className="chip wj-chip" onClick={() => go("product", { id: v.id })}>
                      {v.name} · {format(getPrice(v.id))}
                    </button>
                  ))}
                </div>
              </div>

              <div className="wj-actions">
                <button className="btn-outline light small" onClick={() => go("country", { id: slugify(country.name) })}>Climate &amp; regions →</button>
                <button className="btn-outline light small" onClick={() => go("seasons")}>Harvest calendar →</button>
              </div>
            </div>
          </section>
        );
      })}

      <div className="wj-outro">
        <p className="eyebrow">the journey doesn't end here</p>
        <h3>See how these origins connect to every cup we roast</h3>
        <div className="wj-outro-actions">
          <button className="btn-primary" onClick={() => go("sourcelibrary")}>Visit the Source Library</button>
          <button className="btn-outline" onClick={() => go("shop")}>Shop all coffee</button>
        </div>
      </div>
    </div>
  );
}
