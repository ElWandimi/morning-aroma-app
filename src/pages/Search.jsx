import React, { useState } from "react";
import { useAdmin, useRoute } from "../context";
import { searchSite } from "../utils/helpers";

export function SearchResultsPage({ id }) {
  const { go } = useRoute();
  const { getAllProducts } = useAdmin();
  const [query, setQuery] = useState(id || "");
  const q = query.trim();
  const results = searchSite(query, getAllProducts());

  // Grouped by type so a broad query (e.g. "coffee") reads as organized sections rather than one
  // long undifferentiated list — the quick-search modal stays flat since it only ever shows 8.
  const grouped = results.reduce((acc, r) => {
    (acc[r.type] = acc[r.type] || []).push(r);
    return acc;
  }, {});

  return (
    <div className="shop-page">
      <div className="shop-head">
        <p className="eyebrow">find it fast</p>
        <h1>Search</h1>
        <div className="search-page-box">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="A variety, a country, a brew method…"
            maxLength={60}
            aria-label="Search query"
          />
        </div>
        {q.length > 0 && (
          <p className="shop-sub">
            {results.length === 0 ? `Nothing matched "${q}".` : `${results.length} result${results.length === 1 ? "" : "s"} for "${q}"`}
          </p>
        )}
      </div>

      {q.length === 0 ? (
        <p className="hint" style={{ textAlign: "center" }}>Try "Kenya", "espresso", or "chocolate".</p>
      ) : results.length === 0 ? (
        <p className="hint" style={{ textAlign: "center" }}>No matches — try a different word, or check the spelling.</p>
      ) : (
        <div className="search-results-page">
          {Object.entries(grouped).map(([type, items]) => (
            <div key={type} className="search-results-group">
              <h3 className="admin-subhead" style={{ marginTop: 0 }}>{type}{items.length > 1 ? "s" : ""} ({items.length})</h3>
              <div className="search-results-grid">
                {items.map((r, i) => (
                  <button key={i} className="search-result-card" onClick={() => go(r.page, r.params)}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
