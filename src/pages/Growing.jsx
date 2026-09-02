import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { BarRow, MiniCalendar } from "../components";
import { useAdmin, useCurrency, useRoute } from "../context";
import { COUNTRIES, GROWING_FACTORS, GROWING_PATHS, GROWING_PROFILES, PRODUCTS } from "../data";
import { LiveMessageBar } from "./Home";
import { slugify, activateOnEnterOrSpace } from "../utils/helpers";

export function GrowingHubPage() {
  const { go } = useRoute();
  const [path, setPath] = useState("Variety");
  return (
    <div className="shop-page">
      <div className="shop-head">
        <p className="eyebrow">before the roast</p>
        <h1>Growing Library</h1>
        <p className="shop-sub">Coffee starts as farming. Explore it by variety, by country, or by the growing factors that shape flavor.</p>
      </div>

      <div className="moment-story-row">
        <div className="moment-story-text">
          <p className="moment-description">
            Every bag we roast starts long before the roaster — on a hillside, in soil we can trace, picked by
            hand at the peak of ripeness. Altitude, rainfall, and soil chemistry shape flavor as much as the
            roast itself, and the farmers behind each lot are the reason any of this is worth publishing at all.
          </p>
        </div>
        <div className="moment-story-photo" style={{ backgroundImage: "url('/photos/growing-hero.jpg')" }} role="img" aria-label="Coffee beans and a cup on a farm table" />
      </div>

      <div className="cat-tabs">
        {GROWING_PATHS.map((p) => (
          <button key={p} className={path === p ? "active" : ""} onClick={() => setPath(p)}>{p}</button>
        ))}
      </div>

      {path === "Variety" && (
        <div className="grid4">
          {PRODUCTS.map((p) => (
            <div key={p.id} className="everyday-card">
              <div
                className={`everyday-photo ${p.tier === "premium" ? "premium-photo-sm" : ""}`}
                onClick={() => go("growingprofile", { id: p.id })}
                onKeyDown={activateOnEnterOrSpace(() => go("growingprofile", { id: p.id }))}
                role="link" tabIndex={0} aria-label={`${p.name} — ${p.country} coffee bag`}
                style={{ cursor: "pointer", backgroundImage: `url('/photos/products/${p.id}.png')` }}
              />
              <h3 onClick={() => go("growingprofile", { id: p.id })} onKeyDown={activateOnEnterOrSpace(() => go("growingprofile", { id: p.id }))} role="link" tabIndex={0} style={{ cursor: "pointer" }}>{p.name} — {p.country}</h3>
              <p>{GROWING_PROFILES[p.id].altitude} · {GROWING_PROFILES[p.id].soilType}</p>
              <button className="btn-outline small" onClick={() => go("growingprofile", { id: p.id })}>View profile</button>
            </div>
          ))}
        </div>
      )}

      {path === "Country" && (
        <div>
          <div className="course-link-row">
            <span>Want the full picture?</span>
            <button className="btn-outline small" onClick={() => go("seasons")}>See the Global Harvest Calendar →</button>
          </div>
          <div className="guide-grid">
            {COUNTRIES.map((c) => (
              <div key={c.name} className="guide-card" onClick={() => go("country", { id: slugify(c.name) })} onKeyDown={activateOnEnterOrSpace(() => go("country", { id: slugify(c.name) }))} role="link" tabIndex={0}>
                <span className="guide-icon">{c.flag}</span>
                <h3>{c.name}</h3>
                <p>{c.climate}</p>
                <MiniCalendar start={c.harvestStart} end={c.harvestEnd} />
                <span className="moment-cta">Explore →</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {path === "Growing Factor" && (
        <div className="guide-grid">
          {GROWING_FACTORS.map((f) => (
            <div key={f.name} className="guide-card" onClick={() => go("growingfactor", { id: slugify(f.name) })} onKeyDown={activateOnEnterOrSpace(() => go("growingfactor", { id: slugify(f.name) }))} role="link" tabIndex={0}>
              <span className="guide-icon">{f.icon}</span>
              <h3>{f.name}</h3>
              <p>{f.explain.slice(0, 80)}…</p>
              <span className="moment-cta">Learn more →</span>
            </div>
          ))}
        </div>
      )}

      <div className="soil-explorer-cta">
        <div>
          <h4>Curious what's actually in the ground?</h4>
          <p>Try the Soil Explorer — pH, nutrients, and soil type for every variety we carry.</p>
        </div>
        <button className="btn-primary" onClick={() => go("soilexplorer", {})}>Open Soil Explorer</button>
      </div>
    </div>
  );
}

export function GrowingProfilePage({ id }) {
  const { go } = useRoute();
  const product = PRODUCTS.find((p) => p.id === id);
  const gp = GROWING_PROFILES[id];
  if (!product || !gp) {
    return (
      <div className="empty-state" style={{ padding: 80 }}>
        <p>We couldn't find that growing profile.</p>
        <button className="btn-outline small" onClick={() => go("growing")}>Back to Growing Library</button>
      </div>
    );
  }
  const stats = [
    { label: "Altitude", value: gp.altitude },
    { label: "Temperature", value: gp.temp },
    { label: "Rainfall", value: gp.rainfall },
    { label: "Soil type", value: gp.soilType },
    { label: "Soil pH", value: gp.pH },
    { label: "Shade", value: gp.shade },
    { label: "Pest management", value: gp.pests },
  ];
  return (
    <div className="product-page">
      <button className="link-btn back-link" onClick={() => go("growing")}>← Growing Library</button>
      <div className="guide-detail-head">
        <h1>{product.name} — {product.country}</h1>
        <p className="handwritten moment-tagline dark">Growing conditions behind this cup</p>
      </div>
      <div className="stat-grid">
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <p className="filter-label">{s.label}</p>
            <p className="stat-value">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="course-link-row">
        <span>See exactly what's in the soil</span>
        <button className="btn-outline small" onClick={() => go("soilexplorer", { id: product.id })}>Taste the Soil →</button>
      </div>
      <button className="btn-primary" onClick={() => go("product", { id: product.id })}>Back to product page</button>
    </div>
  );
}

export function CountryPage({ id }) {
  const { go } = useRoute();
  const { getPrice, getCountryHistory } = useAdmin();
  const { format } = useCurrency();
  const { kenyaMessages } = useAdmin();
  const country = COUNTRIES.find((c) => slugify(c.name) === id);
  if (!country) {
    return (
      <div className="empty-state" style={{ padding: 80 }}>
        <p>We couldn't find that country.</p>
        <button className="btn-outline small" onClick={() => go("growing")}>Back to Growing Library</button>
      </div>
    );
  }
  const varieties = PRODUCTS.filter((p) => p.country === country.name);
  const liveMessages = country.name === "Kenya" ? kenyaMessages : country.liveMessages;
  return (
    <div className="product-page">
      <button className="link-btn back-link" onClick={() => go("seasons")}>← Harvest Calendar</button>
      <div className="guide-detail-head">
        <span className="guide-icon big">{country.flag}</span>
        <h1>{country.name}</h1>
        <p className="handwritten moment-tagline dark">{country.climate}</p>
      </div>

      {liveMessages && liveMessages.length > 0 && <LiveMessageBar messages={liveMessages} />}

      <div className="country-grid">
        <div className="mini-brew">
          <h3>Soil profile</h3>
          <p>{country.soil}</p>
        </div>
        <div className="mini-brew">
          <h3>Growing regions</h3>
          <ul className="region-list">
            {country.regions.map((r) => (
              <li key={r.name}><strong>{r.name}</strong> — {r.note}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mini-brew">
        <h3>Seasonal cycle</h3>
        <MiniCalendar start={country.harvestStart} end={country.harvestEnd} />
        <p style={{ marginTop: 10 }}>{country.auction}</p>
      </div>

      <div className="mini-brew">
        <h3>The story here</h3>
        <p>{getCountryHistory(country.name)}</p>
        <button className="btn-outline small" style={{ marginTop: 10 }} onClick={() => go("worldjourney")}>See the full World Journey →</button>
      </div>

      {varieties.length > 0 && (
        <>
          <h3 className="matched-head">Varieties from {country.name}</h3>
          <div className="grid4">
            {varieties.map((p) => (
              <div key={p.id} className="everyday-card">
                <div
                  className={`everyday-photo ${p.tier === "premium" ? "premium-photo-sm" : ""}`}
                  onClick={() => go("product", { id: p.id })}
                  onKeyDown={activateOnEnterOrSpace(() => go("product", { id: p.id }))}
                  role="link" tabIndex={0} aria-label={`${p.name} coffee bag`}
                  style={{ cursor: "pointer", backgroundImage: `url('/photos/products/${p.id}.png')` }}
                />
                <h3 onClick={() => go("product", { id: p.id })} onKeyDown={activateOnEnterOrSpace(() => go("product", { id: p.id }))} role="link" tabIndex={0} style={{ cursor: "pointer" }}>{p.name}</h3>
                <p>{p.note}</p>
                <span>{format(getPrice(p.id))}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function GrowingFactorPage({ id }) {
  const { go } = useRoute();
  const factor = GROWING_FACTORS.find((f) => slugify(f.name) === id);
  if (!factor) {
    return (
      <div className="empty-state" style={{ padding: 80 }}>
        <p>We couldn't find that growing factor.</p>
        <button className="btn-outline small" onClick={() => go("growing")}>Back to Growing Library</button>
      </div>
    );
  }
  const low = PRODUCTS.find((p) => p.id === factor.lowId);
  const high = PRODUCTS.find((p) => p.id === factor.highId);
  return (
    <div className="product-page">
      <button className="link-btn back-link" onClick={() => go("growing")}>← Growing Library</button>
      <div className="guide-detail-head">
        <span className="guide-icon big">{factor.icon}</span>
        <h1>{factor.name}</h1>
      </div>
      <p className="moment-description" style={{ maxWidth: 640, margin: "0 auto 34px" }}>{factor.explain}</p>
      <div className="country-grid">
        {[{ label: "Lower", p: low }, { label: "Higher", p: high }].map(({ label, p }) => (
          <div key={label} className="mini-brew">
            <p className="filter-label">{label} {factor.name}</p>
            <h3>{p.name} — {p.country}</h3>
            <p>{GROWING_PROFILES[p.id][
              factor.name === "Altitude" ? "altitude" : factor.name === "Rainfall" ? "rainfall" : factor.name === "Soil pH" ? "pH" : "shade"
            ]}</p>
            <button className="btn-outline small" onClick={() => go("product", { id: p.id })}>View variety →</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SoilExplorerPage({ id }) {
  const { go } = useRoute();
  const [selected, setSelected] = useState(id || PRODUCTS[0].id);
  const product = PRODUCTS.find((p) => p.id === selected);
  const gp = GROWING_PROFILES[selected];
  const phPercent = (gp.pH / 14) * 100;
  return (
    <div className="product-page">
      <button className="link-btn back-link" onClick={() => go("growing")}>← Growing Library</button>
      <div className="guide-detail-head">
        <h1>Soil Explorer</h1>
        <p className="handwritten moment-tagline dark">Every variety, one soil profile at a time</p>
      </div>

      <div className="soil-select-row">
        <label htmlFor="soil-variety">Variety</label>
        <select id="soil-variety" value={selected} onChange={(e) => setSelected(e.target.value)}>
          {PRODUCTS.map((p) => (
            <option key={p.id} value={p.id}>{p.name} — {p.country}</option>
          ))}
        </select>
      </div>

      <div className="soil-panel">
        <div className="soil-3d" aria-hidden="true">
          <div className="soil-layer topsoil" />
          <div className="soil-layer subsoil" />
          <div className="soil-layer bedrock" />
        </div>
        <div className="soil-data">
          <h3>{product.name} — {product.country}</h3>
          <p className="filter-label">Soil type</p>
          <p style={{ marginBottom: 14 }}>{gp.soilType}</p>

          <p className="filter-label">pH ({gp.pH})</p>
          <div className="ph-scale">
            <div className="ph-marker" style={{ left: `${phPercent}%` }} />
          </div>
          <div className="ph-labels"><span>Acidic</span><span>Neutral</span><span>Alkaline</span></div>

          <div className="bars" style={{ marginTop: 20 }}>
            <BarRow label="Nitrogen" value={gp.nutrients.n} />
            <BarRow label="Phosphorus" value={gp.nutrients.p} />
            <BarRow label="Potassium" value={gp.nutrients.k} />
          </div>
        </div>
      </div>
      <button className="btn-primary" onClick={() => go("growingprofile", { id: product.id })}>Full growing profile →</button>
    </div>
  );
}

export function SeasonsPage() {
  const { go } = useRoute();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return (
    <div className="shop-page">
      <div className="shop-head">
        <p className="eyebrow">the global harvest</p>
        <h1>Coffee Seasons &amp; Auctions</h1>
        <p className="shop-sub">Coffee ripens somewhere on earth almost every month. Here's when, by country.</p>
      </div>
      <div className="calendar-table">
        <div className="calendar-row calendar-header">
          <span className="calendar-country">Country</span>
          <div className="calendar-months">
            {months.map((m) => <span key={m}>{m}</span>)}
          </div>
        </div>
        {COUNTRIES.map((c) => (
          <div key={c.name} className="calendar-row" onClick={() => go("country", { id: slugify(c.name) })} onKeyDown={activateOnEnterOrSpace(() => go("country", { id: slugify(c.name) }))} role="link" tabIndex={0}>
            <span className="calendar-country">{c.flag} {c.name}</span>
            <MiniCalendar start={c.harvestStart} end={c.harvestEnd} />
          </div>
        ))}
      </div>
      <p className="hint" style={{ textAlign: "center", marginTop: 20 }}>Tap a country for its full seasonal cycle and auction details.</p>
    </div>
  );
}
