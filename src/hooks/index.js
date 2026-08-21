import React, { useState, useEffect, useRef, createContext, useContext } from "react";

// Fonts are loaded directly from a <link> tag in index.html (not injected here at runtime) so the
// browser's preload scanner can start fetching them in parallel with the JS bundle, rather than
// only after React mounts and this hook would have fired.

export const REVEAL_SELECTOR =
  ".section-head, .hscroll, .quiz-panel, .trust, .seasonal-inner, .faq-list, .calendar-table, .country-grid, .promise-statements, .checkout-steps, .grid4, .guide-grid, .course-grid, .moments-hub-grid, .rituals-grid, .values-grid, .stat-grid";

export function useScrollReveal(dep) {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll(REVEAL_SELECTOR)).filter((el) => !el.classList.contains("revealed"));
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("revealed");
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [dep]);
}

export function useEscapeKey(active, onClose) {
  useEffect(() => {
    if (!active) return;
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [active, onClose]);
}

// Closes an open dropdown/panel when the user clicks anywhere outside the element `ref` points
// to. Uses mousedown (fires before click) so a click on a *different* dropdown's own toggle
// button — which lives outside this ref — correctly closes this one first, before that button's
// own click handler opens the other.
export function useClickOutside(ref, active, onClose) {
  useEffect(() => {
    if (!active) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, active, onClose]);
}

// Sets real document.title + <meta name="description"> + Open Graph tags per page — this only
// does anything useful now that routing is hash-based (see context/index.jsx RouteProvider),
// since before that every "page" was the same single document with nothing to distinguish it.
function upsertMeta(selector, attr, attrValue, content) {
  let tag = document.querySelector(selector);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, attrValue);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}
// Respects the visitor's OS-level "reduce motion" preference for anything JS needs to gate
// (CSS media queries handle this fine for animations, but <video autoPlay> can't be conditionally
// disabled through CSS alone).
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

export function useDocumentMeta(title, description) {
  useEffect(() => {
    if (title) {
      document.title = title;
      upsertMeta('meta[property="og:title"]', "property", "og:title", title);
    }
    if (description) {
      upsertMeta('meta[name="description"]', "name", "description", description);
      upsertMeta('meta[property="og:description"]', "property", "og:description", description);
    }
  }, [title, description]);
}

// Injects a JSON-LD <script type="application/ld+json"> tag for the given schema.org object,
// removing it on unmount or when `data` changes to a new object — so navigating between pages
// doesn't leave stale structured data from a previous page in the document. Uses .textContent
// (imperative DOM, the same approach useDocumentMeta already uses for meta tags) rather than
// dangerouslySetInnerHTML; the data here is always app-generated (product info, FAQ content,
// business details), never raw user input, but this keeps the pattern consistent regardless.
// Google's crawler executes JavaScript and will see this; crawlers that don't (some link-preview
// bots) won't — same fundamental limitation as the dynamic per-page Open Graph tags.
let structuredDataCounter = 0;
export function useStructuredData(data) {
  useEffect(() => {
    if (!data) return;
    const id = `structured-data-${structuredDataCounter++}`;
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = id;
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
    return () => { document.getElementById(id)?.remove(); };
  }, [JSON.stringify(data)]);
}

// --- Google Translate integration ---
// Loads Google's real, free "Website Translator" widget (the classic translate_a/element.js
// embed many sites still use). It renders its own <select class="goog-te-combo"> into a hidden
// container; changeLanguage() finds that select and drives it programmatically, so our own
// styled UI (LanguageSwitcher) can trigger a real translation without showing Google's default
// banner/UI at all.
const GOOGLE_TRANSLATE_ELEMENT_ID = "google_translate_element";
let googleTranslateLoadStarted = false;

export function useGoogleTranslate() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!document.getElementById(GOOGLE_TRANSLATE_ELEMENT_ID)) {
      const div = document.createElement("div");
      div.id = GOOGLE_TRANSLATE_ELEMENT_ID;
      div.style.display = "none";
      document.body.appendChild(div);
    }

    if (window.google && window.google.translate) {
      setReady(true);
      return;
    }

    window.googleTranslateElementInit = () => {
      // eslint-disable-next-line no-new
      new window.google.translate.TranslateElement(
        { pageLanguage: "en", autoDisplay: false },
        GOOGLE_TRANSLATE_ELEMENT_ID
      );
      setReady(true);
    };

    if (!googleTranslateLoadStarted) {
      googleTranslateLoadStarted = true;
      const script = document.createElement("script");
      script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      script.async = true;
      document.body.appendChild(script);
    } else {
      const check = setInterval(() => {
        if (window.google && window.google.translate) {
          setReady(true);
          clearInterval(check);
        }
      }, 300);
      return () => clearInterval(check);
    }
  }, []);

  // Fire-and-forget with a short retry window — Google injects the <select> asynchronously
  // after the widget initializes, so it may not exist yet on the very first call.
  const changeLanguage = (langCode, attempt = 0) => {
    const select = document.querySelector(".goog-te-combo");
    if (select) {
      select.value = langCode;
      select.dispatchEvent(new Event("change"));
      return;
    }
    if (attempt < 15) setTimeout(() => changeLanguage(langCode, attempt + 1), 300);
  };

  return { ready, changeLanguage };
}

// --- Geo/locale detection ---
// Tries a free, no-API-key IP geolocation lookup (ipapi.co) to suggest a language based on the
// visitor's country; falls back to browser language (navigator.language) alone if that lookup
// fails for any reason (ad blockers, rate limits, offline, CORS in some environments) — this is
// a UX suggestion only, never a hard requirement, so a failed lookup degrades gracefully rather
// than breaking anything.
export function useGeoLocale(countryToLanguage) {
  const [locale, setLocale] = useState({ countryCode: null, countryName: null, suggestedLang: null, loading: true });

  useEffect(() => {
    let cancelled = false;
    const browserLang = (navigator.language || "en").split("-")[0];

    fetch("https://ipapi.co/json/")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("geo lookup failed"))))
      .then((data) => {
        if (cancelled) return;
        const countryCode = data.country_code;
        const suggestedLang = countryToLanguage[countryCode] || (browserLang !== "en" ? browserLang : null);
        setLocale({ countryCode, countryName: data.country_name, suggestedLang, loading: false });
      })
      .catch(() => {
        if (cancelled) return;
        setLocale({ countryCode: null, countryName: null, suggestedLang: browserLang !== "en" ? browserLang : null, loading: false });
      });

    return () => {
      cancelled = true;
    };
  }, [countryToLanguage]);

  return locale;
}
