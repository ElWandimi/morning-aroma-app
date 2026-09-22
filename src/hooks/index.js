import { useState, useEffect, useRef } from "react";

// Fonts are loaded directly from a <link> tag in index.html (not injected here at runtime) so the
// browser's preload scanner can start fetching them in parallel with the JS bundle, rather than
// only after React mounts and this hook would have fired.

export const REVEAL_SELECTOR =
  ".section-head, .hscroll, .quiz-panel, .trust, .seasonal-inner, .faq-list, .calendar-table, .country-grid, .promise-statements, .checkout-steps, .grid4, .guide-grid, .course-grid, .moments-hub-grid, .rituals-grid, .values-grid, .stat-grid, .trust-grid, .signature-grid, .quality-split";

export function useScrollReveal(dep) {
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            // Deferred one frame: elements that mount already inside the viewport (e.g. a grid
            // that only renders once an async product/rating fetch resolves, via the
            // MutationObserver path below) can have this callback fire before the browser has
            // committed a first paint of the un-revealed (opacity: 0) state. With nothing
            // painted to transition *from*, the opacity/transform transition never runs and the
            // element is left stuck at its base opacity: 0 permanently, even though `.revealed`
            // is present on it from that point on -- a real, confirmed production bug (see the
            // signature-card investigation), not a CSS specificity or source-order issue. A
            // double rAF guarantees a completed paint of the base state exists before the class
            // (and its transition) is applied.
            const target = e.target;
            requestAnimationFrame(() => requestAnimationFrame(() => {
              target.classList.add("revealed");
            }));
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    const observe = (el) => {
      if (!el.classList.contains("revealed")) obs.observe(el);
    };

    // Elements already in the DOM at the moment this effect runs.
    document.querySelectorAll(REVEAL_SELECTOR).forEach(observe);

    // Elements that mount *after* this effect has already run -- e.g. this effect is keyed to
    // `dep` (the current route) and lives in a component above the lazy-loaded route's Suspense
    // boundary, so on a fresh page load this effect can fire before that route's chunk has
    // finished fetching/evaluating. Without watching for later arrivals, a section that isn't in
    // the DOM yet at that moment is queried for once, found missing, and then never observed
    // again for the life of this effect (routeKey doesn't change just because the lazy chunk
    // finally resolved) -- leaving it permanently hidden by whatever CSS gates on `.revealed`.
    // Navigating away and back "fixes" it only because the chunk is cached by then and resolves
    // fast enough to already be in the DOM the next time this effect runs.
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          if (node.matches?.(REVEAL_SELECTOR)) observe(node);
          node.querySelectorAll?.(REVEAL_SELECTOR).forEach(observe);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      obs.disconnect();
      mo.disconnect();
    };
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

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Keeps Tab/Shift+Tab cycling within a modal or drawer's own focusable elements while it's open,
// rather than letting focus escape to whatever's behind it -- a real, common accessibility gap for
// anyone navigating by keyboard, not just screen reader users. Also moves focus onto the container
// itself the moment it opens, so a keyboard user doesn't land back at the very top of the page
// (wherever focus happened to be before) and have to tab all the way back down to reach a modal
// that's now covering the screen. Restores focus to whatever triggered the modal once it closes,
// so closing doesn't strand a keyboard user's position either.
export function useFocusTrap(ref, active) {
  const previouslyFocused = useRef(null);

  useEffect(() => {
    if (!active || !ref.current) return;
    previouslyFocused.current = document.activeElement;

    // Doesn't steal focus from a specific field a modal already wants focused on open (e.g.
    // SearchModal's autoFocus input) -- only moves focus to the container itself if nothing
    // inside it already has focus by the time this runs.
    if (!ref.current.contains(document.activeElement)) {
      ref.current.focus();
    }

    const handleKeyDown = (e) => {
      if (e.key !== "Tab" || !ref.current) return;
      const focusable = Array.from(ref.current.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null // visible only -- skips anything hidden by a conditional render inside the same modal
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Only restores focus to an element that's still actually in the document and focusable --
      // the trigger could have been removed or disabled while the modal was open (e.g. an admin
      // row that got deleted), and calling .focus() on a detached element is a silent no-op that
      // would otherwise just leave focus wherever it happened to end up instead.
      if (previouslyFocused.current && document.contains(previouslyFocused.current)) {
        previouslyFocused.current.focus();
      }
    };
  }, [ref, active]);
}

// Sets real document.title + <meta name="description"> + Open Graph tags per page — this only
// does anything useful now that routing is real (see context/index.jsx RouteProvider), since
// before that every "page" was the same single document with nothing to distinguish it.
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

function upsertLink(rel, href) {
  let tag = document.querySelector(`link[rel="${rel}"]`);
  if (!tag) {
    tag = document.createElement("link");
    tag.setAttribute("rel", rel);
    document.head.appendChild(tag);
  }
  tag.setAttribute("href", href);
}

export function useDocumentMeta(title, description, canonicalPath, image) {
  useEffect(() => {
    if (title) {
      document.title = title;
      upsertMeta('meta[property="og:title"]', "property", "og:title", title);
    }
    if (description) {
      upsertMeta('meta[name="description"]', "name", "description", description);
      upsertMeta('meta[property="og:description"]', "property", "og:description", description);
    }
    // Real, previously-live bug this fixes: index.html shipped exactly one static
    // <link rel="canonical" href="https://morning-aroma.com/">, which -- since this is a single
    // HTML shell every route loads into -- applied to literally every page on the site
    // (products, brew guides, countries, everything). That tells search engines every one of
    // those pages is a duplicate of the homepage, which can mean they never get indexed
    // separately at all. Confirmed directly: grepped the whole src/ tree and found no dynamic
    // canonical logic anywhere, only that one static tag. This upserts (rather than requiring
    // index.html's tag be removed first) a real, per-page canonical whenever a path is known,
    // and simply leaves the static one in place as the correct value for "/" itself when no
    // canonicalPath is given (the home route's own getPageMeta call below doesn't pass one).
    if (canonicalPath) {
      upsertLink("canonical", `https://morning-aroma.com${canonicalPath}`);
    }
    // Real, previously-missing per-page og:image -- every page shared the one static, generic
    // homepage banner from index.html regardless of what was actually being shared (a specific
    // coffee bag's own real photo, for instance), which is a real, meaningful loss for anyone
    // sharing a product link on WhatsApp or Instagram. Resets back to the site's own real default
    // when `image` isn't provided (most pages), rather than letting a previous page's product
    // photo incorrectly persist into whatever's navigated to next.
    upsertMeta('meta[property="og:image"]', "property", "og:image", image || "https://morning-aroma.com/og-image.jpg");
    upsertMeta('meta[name="twitter:image"]', "name", "twitter:image", image || "https://morning-aroma.com/og-image.jpg");
  }, [title, description, canonicalPath, image]);
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