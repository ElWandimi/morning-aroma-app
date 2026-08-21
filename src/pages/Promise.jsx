import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { CORE_VALUES } from "../data";

export function OurPromisePage() {
  const [revealed, setRevealed] = useState(new Set());
  const toggle = (i) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  return (
    <div className="promise-page">
      <div className="promise-hero">
        <p className="eyebrow gold">our promise</p>
        <h1>Coffee Is a Relationship, Not a Transaction</h1>
      </div>

      <div className="promise-body">
        <div className="promise-statements">
          <div className="promise-block">
            <p className="filter-label">Our vision</p>
            <p>
              A world where every cup carries the full truth of where it came from — the hillside, the hands, the price paid — and where that
              truth makes the coffee taste better, not just feel better.
            </p>
          </div>
          <div className="promise-block">
            <p className="filter-label">Our mission</p>
            <p>
              We roast and ship coffee that pays growers fairly, names them by name, and reaches you close enough to its harvest that you can
              still taste the season it came from.
            </p>
          </div>
        </div>

        <h2 className="values-head">What we hold ourselves to</h2>
        <p className="hint" style={{ textAlign: "center", marginBottom: 24 }}>Tap a bean to see how we actually do it.</p>
        <div className="values-grid">
          {CORE_VALUES.map((v, i) => {
            const open = revealed.has(i);
            return (
              <div key={v.title} className={`value-card ${open ? "open" : ""}`}>
                <button className="value-bean" onClick={() => toggle(i)} aria-expanded={open} aria-label={`Reveal example for ${v.title}`}>
                  <span className="bean-shape" />
                </button>
                <h3>{v.title}</h3>
                <p className="value-line">{v.line}</p>
                {open && <p className="value-example">{v.example}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
