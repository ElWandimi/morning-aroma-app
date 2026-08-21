import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { useRoute } from "../context";
import { GLOBAL_RITUALS } from "../data";

export function RitualsPage() {
  const { go } = useRoute();
  return (
    <div className="shop-page">
      <div className="shop-head">
        <p className="eyebrow">coffee, everywhere</p>
        <h1>Global Rituals</h1>
        <p className="shop-sub">The same plant, a hundred different ceremonies. A few of our favorites.</p>
      </div>
      <div className="rituals-grid">
        {GLOBAL_RITUALS.map((r) => (
          <div key={r.name} className="ritual-card">
            <span className="guide-icon big">{r.flag}</span>
            <h3>{r.name}</h3>
            <p>{r.story}</p>
            <button className="btn-outline small" onClick={() => go("course", { id: r.courseId })}>Learn the craft →</button>
          </div>
        ))}
      </div>
    </div>
  );
}
