import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { BarRow, ImgWithSkeleton, ShareButtons } from "../components";
import { useAdmin, useCart, useCurrency, useRoute, useToast, useWishlist, pathFor } from "../context";
import { FILTER_DEFS, COUNTRY_JOURNEY_PHOTO } from "../data";
import { getProductPhotoUrl, slugify } from "../utils/helpers";
import { useStructuredData } from "../hooks";

export function ShopPage() {
  const { go } = useRoute();
  const { add } = useCart();
  const { getPrice, getStock, getAllProducts, realProductsLoading } = useAdmin();
  const { format } = useCurrency();
  const { toggle: toggleWishlist, has: hasWishlist } = useWishlist();
  const [filters, setFilters] = useState({ aroma: [], body: "", acidity: "", roast: "", moment: "", brew: "" });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const allProducts = getAllProducts();

  const toggleAroma = (tag) =>
    setFilters((f) => ({
      ...f,
      aroma: f.aroma.includes(tag) ? f.aroma.filter((t) => t !== tag) : [...f.aroma, tag],
    }));

  const setSingle = (key, val) => setFilters((f) => ({ ...f, [key]: f[key] === val ? "" : val }));

  const clearAll = () => setFilters({ aroma: [], body: "", acidity: "", roast: "", moment: "", brew: "" });

  const filtered = allProducts.filter((p) => {
    if (filters.aroma.length && !filters.aroma.some((t) => p.tags.aroma.includes(t))) return false;
    if (filters.body && p.tags.body !== filters.body) return false;
    if (filters.acidity && p.tags.acidity !== filters.acidity) return false;
    if (filters.roast && p.tags.roast !== filters.roast) return false;
    if (filters.moment && p.tags.moment !== filters.moment) return false;
    if (filters.brew && !p.tags.brew.includes(filters.brew)) return false;
    return true;
  });

  const activeCount =
    filters.aroma.length + [filters.body, filters.acidity, filters.roast, filters.moment, filters.brew].filter(Boolean).length;

  return (
    <div className="shop-page">
      <div className="shop-head">
        <p className="eyebrow">the full catalog</p>
        <h1>Shop All Coffee</h1>
        <p className="shop-sub">Named by variety and origin — filter by how it smells, tastes, and where it fits your day.</p>
      </div>
      <button className="shop-filter-toggle" onClick={() => setFiltersOpen(true)} aria-expanded={filtersOpen}>
        Filter{activeCount > 0 ? "s" : ""} {activeCount > 0 && <span className="admin-nav-badge">{activeCount}</span>}
      </button>
      {filtersOpen && <div className="shop-filter-scrim" onClick={() => setFiltersOpen(false)} aria-hidden="true" />}
      <div className="shop-layout">
        <aside className={`shop-filters ${filtersOpen ? "shop-filters-open" : ""}`}>
          <div className="filters-head">
            <h4>Filter</h4>
            <span className="filters-head-actions">
              {activeCount > 0 && <button className="link-btn" onClick={clearAll}>Clear ({activeCount})</button>}
              <button className="shop-filter-close" onClick={() => setFiltersOpen(false)} aria-label="Close filters">✕</button>
            </span>
          </div>

          <p className="filter-label">Aroma</p>
          <div className="chip-row">
            {FILTER_DEFS.aroma.map((t) => (
              <button key={t} className={`chip ${filters.aroma.includes(t) ? "chip-active" : ""}`} onClick={() => toggleAroma(t)}>{t}</button>
            ))}
          </div>

          <p className="filter-label">Body</p>
          <div className="chip-row">
            {FILTER_DEFS.body.map((t) => (
              <button key={t} className={`chip ${filters.body === t ? "chip-active" : ""}`} onClick={() => setSingle("body", t)}>{t}</button>
            ))}
          </div>

          <p className="filter-label">Acidity</p>
          <div className="chip-row">
            {FILTER_DEFS.acidity.map((t) => (
              <button key={t} className={`chip ${filters.acidity === t ? "chip-active" : ""}`} onClick={() => setSingle("acidity", t)}>{t}</button>
            ))}
          </div>

          <p className="filter-label">Roast level</p>
          <div className="chip-row">
            {FILTER_DEFS.roast.map((t) => (
              <button key={t} className={`chip ${filters.roast === t ? "chip-active" : ""}`} onClick={() => setSingle("roast", t)}>{t}</button>
            ))}
          </div>

          <p className="filter-label">Moment</p>
          <div className="chip-row">
            {FILTER_DEFS.moment.map((t) => (
              <button key={t} className={`chip ${filters.moment === t ? "chip-active" : ""}`} onClick={() => setSingle("moment", t)}>{t}</button>
            ))}
          </div>

          <p className="filter-label">Brew method</p>
          <div className="chip-row">
            {FILTER_DEFS.brew.map((t) => (
              <button key={t} className={`chip ${filters.brew === t ? "chip-active" : ""}`} onClick={() => setSingle("brew", t)}>{t}</button>
            ))}
          </div>

          <button className="btn-primary shop-filter-apply" onClick={() => setFiltersOpen(false)}>Show {filtered.length} result{filtered.length === 1 ? "" : "s"}</button>
        </aside>

        <div className="shop-results">
          <p className="results-count">{filtered.length} of {allProducts.length} varieties</p>
          {realProductsLoading ? (
            <p className="hint">Loading the catalog…</p>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <p>Nothing matches yet — try clearing a filter.</p>
              <button className="btn-outline small" onClick={clearAll}>Clear filters</button>
            </div>
          ) : (
            <div className="origin-showcase">
              {filtered.map((p, i) => {
                const stock = getStock(p.id);
                const soldOut = stock === 0;
                const reverse = i % 2 === 1;
                return (
                  <div key={p.id} className={`origin-row ${reverse ? "origin-row-reverse" : ""} ${soldOut ? "sold-out-card" : ""}`}>
                    <div className="origin-row-text">
                      <p className="eyebrow" style={{ marginBottom: 2 }}>{p.tier === "premium" ? "premium" : "everyday"} · {p.country}</p>
                      <h3 onClick={() => go("product", { id: p.id })} style={{ cursor: "pointer" }}>{p.name} — {p.country}</h3>
                      <p className="handwritten origin-tasting-note">{p.note}</p>
                      <p className="origin-growing-note">{p.growing}</p>
                      <div className="premium-foot">
                        <span>{format(getPrice(p.id))}</span>
                        <button className="btn-cart" onClick={() => add(p.id)} disabled={soldOut}>
                          {soldOut ? "Sold Out" : (<>🛒 Add to cart</>)}
                        </button>
                      </div>
                    </div>
                    <div className="origin-row-photo" onClick={() => go("product", { id: p.id })} style={{ cursor: "pointer" }}>
                      <ImgWithSkeleton wrapClassName="origin-row-photo-wrap" src={getProductPhotoUrl(p, COUNTRY_JOURNEY_PHOTO)} alt={`${p.name} — ${p.country} coffee bag`} loading="lazy" />
                      <button
                        className={`wishlist-heart ${hasWishlist(p.id) ? "saved" : ""}`}
                        onClick={(e) => { e.stopPropagation(); toggleWishlist(p.id); }}
                        aria-label={hasWishlist(p.id) ? "Remove from wishlist" : "Save to wishlist"}
                        aria-pressed={hasWishlist(p.id)}
                      >
                        {hasWishlist(p.id) ? "♥" : "♡"}
                      </button>
                      {soldOut && <span className="sold-out-tag">Sold Out</span>}
                      {!soldOut && stock <= 8 && <span className="low-stock-tag">Only {stock} left</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProductPage({ id }) {
  const { go } = useRoute();
  const { add } = useCart();
  const { getPrice, getTier, getStock, getAllProducts, getProductFeedback, realProductsLoading } = useAdmin();
  const { format } = useCurrency();
  const { toggle: toggleWishlist, has: hasWishlist } = useWishlist();
  const { addToast } = useToast();
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState("profile");
  const allProducts = getAllProducts();
  const product = allProducts.find((p) => p.id === id);

  // Real, per-product reviews, fetched from the real backend -- was a synchronous filter over a
  // local, in-memory feedbackList before this (see ROADMAP.md), which no longer exists for a
  // regular customer at all (that data is now real, admin-only backend state). Called
  // unconditionally, before either early return below, for the exact same Rules of Hooks reason
  // useStructuredData is: skipping this hook when product isn't known yet would mean a different
  // number of hooks called between renders once it is.
  const [reviews, setReviews] = useState([]);
  useEffect(() => {
    if (!product) { setReviews([]); return; }
    let cancelled = false;
    getProductFeedback(product.id)
      .then((data) => { if (!cancelled) setReviews(data); })
      .catch(() => { if (!cancelled) setReviews([]); });
    return () => { cancelled = true; };
  }, [product && product.id]);

  // Called unconditionally, before either early return below -- a real, previously-broken Rules
  // of Hooks violation (this hook used to be called only once product was known, meaning it
  // wasn't called at all on the very first render of a fresh page load, before realProducts had
  // finished loading, but was called on the very next render once it had -- a hook count mismatch
  // between renders that crashes the whole component. useStructuredData itself already handles a
  // falsy argument gracefully (see hooks/index.js), so the real fix is keeping the hook call
  // itself unconditional and making only its argument conditional.
  const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const soldOut = product ? getStock(product.id) === 0 : false;
  useStructuredData(
    product
      ? {
          "@context": "https://schema.org",
          "@type": "Product",
          name: `${product.name} — ${product.country}`,
          description: product.note,
          image: (() => {
            const url = getProductPhotoUrl(product, COUNTRY_JOURNEY_PHOTO);
            return url.startsWith("http") ? url : url.startsWith("data:") ? undefined : `${window.location.origin}${url}`;
          })(),
          brand: { "@type": "Brand", name: "Morning Aroma" },
          offers: {
            "@type": "Offer",
            priceCurrency: "USD",
            price: (getPrice(product.id) / 100).toFixed(2),
            availability: soldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
            url: `${window.location.origin}${pathFor("product", { id: product.id })}`,
          },
          ...(reviews.length > 0 ? {
            aggregateRating: { "@type": "AggregateRating", ratingValue: avgRating.toFixed(1), reviewCount: reviews.length, bestRating: 5, worstRating: 1 },
          } : {}),
        }
      : null
  );

  if (realProductsLoading) {
    return <p className="hint" style={{ padding: 80, textAlign: "center" }}>Loading…</p>;
  }

  if (!product) {
    return (
      <div className="empty-state" style={{ padding: 80 }}>
        <p>We couldn't find that variety.</p>
        <button className="btn-outline small" onClick={() => go("shop")}>Back to shop</button>
      </div>
    );
  }

  const related = allProducts.filter((p) => p.tags.moment === product.tags.moment && p.id !== product.id).slice(0, 3);
  const saved = hasWishlist(product.id);
  const stock = getStock(product.id);
  const lowStock = stock > 0 && stock <= 8;

  return (
    <div className="product-page">
      <button className="link-btn back-link" onClick={() => go("shop")}>← Back to shop</button>
      <div className="product-top">
        <div
          className={`product-hero-photo ${getTier(product.id) === "premium" ? "premium-photo-sm" : ""} ${soldOut ? "sold-out-photo" : ""}`}
          style={{ backgroundImage: `url('${getProductPhotoUrl(product, COUNTRY_JOURNEY_PHOTO)}')` }}
          role="img"
          aria-label={`${product.name} — ${product.country} coffee bag`}
        >
          <button
            className={`wishlist-heart ${saved ? "saved" : ""}`}
            onClick={() => { toggleWishlist(product.id); addToast(saved ? "Removed from wishlist" : "Saved to wishlist"); }}
            aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
            aria-pressed={saved}
          >
            {saved ? "♥" : "♡"}
          </button>
          {soldOut && <span className="sold-out-banner">Sold Out</span>}
        </div>
        <div className="product-info">
          <p className="eyebrow">{getTier(product.id) === "premium" ? "premium & rare" : "everyday classic"}</p>
          <h1>{product.name} — {product.country}</h1>
          <p className="handwritten product-note">{product.note}</p>
          <p className="product-price">{format(getPrice(product.id))} <span>/ 340g bag</span></p>
          {soldOut ? (
            <p className="stock-notice out">Currently sold out — check back soon, or explore similar varieties below.</p>
          ) : lowStock ? (
            <p className="stock-notice low">Only {stock} bags left in this batch.</p>
          ) : null}
          <div className="qty-row" style={soldOut ? { opacity: 0.4, pointerEvents: "none" } : undefined}>
            <button onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
            <span>{qty}</span>
            <button onClick={() => setQty((q) => Math.min(stock || 99, q + 1))}>+</button>
          </div>
          <button className="btn-primary full" onClick={() => add(product.id, qty)} disabled={soldOut}>
            {soldOut ? "Sold Out" : "Add to cart"}
          </button>
          <div className="match-row">
            <span className="chip chip-active">{product.tags.moment}</span>
            <a href={pathFor("brewguide", { id: slugify(product.brewGuide) })} onClick={(e) => { e.preventDefault(); go("brewguide", { id: slugify(product.brewGuide) }); }}>Brew guide: {product.brewGuide} →</a>
          </div>
          <ShareButtons path={`/product/${product.id}`} text={`${product.name} — ${product.country}. ${product.note}. Morning Aroma:`} />
        </div>
      </div>

      <div className="tabs">
        <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}>Aroma &amp; Taste</button>
        <button className={tab === "growing" ? "active" : ""} onClick={() => setTab("growing")}>Growing Conditions</button>
        <button className={tab === "brew" ? "active" : ""} onClick={() => setTab("brew")}>Brew &amp; Course</button>
        <button className={tab === "reviews" ? "active" : ""} onClick={() => setTab("reviews")}>Reviews{reviews.length > 0 ? ` (${reviews.length})` : ""}</button>
      </div>

      <div className="tab-panel">
        {tab === "profile" && (
          <div className="bars">
            <BarRow label="Aroma" value={product.profile.aroma} />
            <BarRow label="Body" value={product.profile.body} />
            <BarRow label="Acidity" value={product.profile.acidity} />
            <BarRow label="Sweetness" value={product.profile.sweetness} />
            <BarRow label="Finish" value={product.profile.finish} />
          </div>
        )}
        {tab === "growing" && (
          <div>
            <p>{product.growing}</p>
            <div className="match-row">
              <button className="btn-outline small" onClick={() => go("growingprofile", { id: product.id })}>Full Growing Profile →</button>
              <a className="soil-link" href={pathFor("soilexplorer", { id: product.id })} onClick={(e) => { e.preventDefault(); go("soilexplorer", { id: product.id }); }}>Taste the Soil →</a>
            </div>
          </div>
        )}
        {tab === "brew" && (
          <div className="brew-course">
            <div>
              <h4>Suggested brew</h4>
              <p>{product.brewGuide} — matched to this variety's body and acidity.</p>
            </div>
            <div>
              <h4>Coffee Moment</h4>
              <p>{product.tags.moment}</p>
            </div>
            <div>
              <h4>Academy course</h4>
              <p>{product.course}</p>
              <button className="btn-outline small" onClick={() => go("course", { id: slugify(product.course) })}>View course</button>
            </div>
          </div>
        )}
        {tab === "reviews" && (
          <div className="reviews-panel">
            {reviews.length === 0 ? (
              <p className="hint">No reviews yet for this variety — be the first to leave your aroma from the feedback bubble.</p>
            ) : (
              <>
                <div className="reviews-summary">
                  <div className="reviews-summary-beans">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span key={n} className="bean-shape" style={{ background: n <= Math.round(avgRating) ? "var(--terracotta-btn)" : "var(--gold)", opacity: n <= Math.round(avgRating) ? 1 : 0.4 }} />
                    ))}
                  </div>
                  <p>{avgRating.toFixed(1)} out of 5 — {reviews.length} review{reviews.length === 1 ? "" : "s"}</p>
                </div>
                <div className="reviews-list">
                  {reviews.map((r) => (
                    <div key={r.id} className="review-card">
                      <div className="review-card-beans">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span key={n} className="bean-shape small" style={{ background: n <= r.rating ? "var(--terracotta-btn)" : "var(--gold)", opacity: n <= r.rating ? 1 : 0.4 }} />
                        ))}
                        <span className="hint" style={{ margin: 0 }}>{r.date}</span>
                      </div>
                      {r.tags && r.tags.length > 0 && (
                        <div className="review-card-tags">
                          {r.tags.map((t) => (<span key={t} className="chip">{t}</span>))}
                        </div>
                      )}
                      {r.note && <p className="review-card-note">"{r.note}"</p>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {related.length > 0 && (
        <div className="related">
          <h3>More for {product.tags.moment}</h3>
          <div className="grid4">
            {related.map((p) => (
              <div key={p.id} className="everyday-card">
                <div className="everyday-photo" onClick={() => go("product", { id: p.id })} style={{ cursor: "pointer", backgroundImage: `url('${getProductPhotoUrl(p, COUNTRY_JOURNEY_PHOTO)}')` }} role="img" aria-label={`${p.name} — ${p.country} coffee bag`} />
                <h3 onClick={() => go("product", { id: p.id })} style={{ cursor: "pointer" }}>{p.name} — {p.country}</h3>
                <p>{p.note}</p>
                <div className="premium-foot">
                  <span>{format(getPrice(p.id))}</span>
                  <button className="btn-outline small" onClick={() => add(p.id)}>Add to cart</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
