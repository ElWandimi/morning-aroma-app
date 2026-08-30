export const CSS = `
:root {
  --cream: #FDF8F0;
  --gold: #E8D5B5;
  --almond: #C5A181;
  --almond-text: #8B6A3D; /* same warm tan family as --almond, darkened for 4.5:1+ text contrast on cream/white */
  --chestnut: #8B5A3A;
  --espresso: #3E2C23;
  --steam: #F9E6D4;
  --green: #6B7B50;
  /* text-on-dark-photo palette — for hero/photo sections specifically, not the light-background pages */
  --ivory: #F5EFE6;
  --beige-text: #D8D0C4;
  --hero-sub-text: #E2DCD3;
  --nav-text-dark: #C8C1B7;
  --taupe-text: #A9A095;
  --terracotta: #C98263;
  --terracotta-btn: #A8583A; /* deeper variant for button backgrounds — #C98263 only reaches ~2.9:1 with cream text, fails WCAG AA */
  --btn-cream: #FFF7EC;
}
.ma-root { font-family: 'Inter', sans-serif; background: var(--cream); color: var(--espresso); }
.ma-root h1, .ma-root h2, .ma-root h3, .ma-root h4 { font-family: 'Cormorant Garamond', serif; color: var(--chestnut); margin: 0; }
.handwritten { font-family: 'Caveat', cursive; }
.eyebrow { text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.75rem; font-weight: 700; color: var(--almond-text); margin: 0 0 6px; }
.eyebrow.gold { color: var(--gold); }
a { color: inherit; text-decoration: none; }

/* texture */
.hero-video {
  position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center;
}
.hero-overlay {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(180deg, rgba(20,13,9,0.6) 0%, rgba(20,13,9,0.35) 45%, rgba(253,248,240,0.94) 92%),
    radial-gradient(circle at 20% 30%, rgba(139,90,58,0.08) 0, transparent 40%);
}
@media (prefers-reduced-motion: reduce) { .hero-video { display: none; } .hero { background: #14100d center/cover url('/video/hero-poster.jpg'); } }

/* buttons */
.btn-primary { background: var(--terracotta-btn); color: var(--btn-cream); border: none; padding: 12px 22px; border-radius: 30px; font-weight: 700; cursor: pointer; transition: transform .15s, background .2s, box-shadow .2s; }
.btn-primary:hover { background: var(--espresso); transform: translateY(-2px); box-shadow: 0 8px 18px rgba(62,44,35,0.28); }
.btn-primary:active { transform: translateY(0); }
.btn-secondary { background: var(--gold); color: var(--espresso); border: none; padding: 12px 22px; border-radius: 30px; font-weight: 700; cursor: pointer; transition: transform .15s; }
.btn-secondary:hover { transform: translateY(-2px); }
.btn-outline { background: transparent; border: 1.5px solid var(--terracotta-btn); color: var(--terracotta-btn); padding: 10px 18px; border-radius: 30px; font-weight: 700; cursor: pointer; transition: transform .15s, background .2s, color .2s; }
.btn-outline:hover { background: var(--terracotta-btn); color: var(--btn-cream); transform: translateY(-2px); }
.btn-outline.light { border-color: var(--cream); color: var(--cream); }
.btn-outline.light:hover { background: var(--cream); color: var(--terracotta-btn); }
.btn-outline.small { padding: 6px 14px; font-size: 0.85rem; }
.btn-ghost { background: transparent; border: none; color: var(--espresso); font-weight: 700; text-decoration: underline; cursor: pointer; transition: color .15s; }
.btn-ghost:hover { color: var(--terracotta-btn); }
.btn-google { background: white; border: 1px solid #dadce0; color: #3c4043; padding: 11px 16px; border-radius: 10px; font-weight: 600; font-family: inherit; font-size: 0.92rem; cursor: pointer; transition: transform .15s, box-shadow .15s, background .15s; display: flex; align-items: center; justify-content: center; gap: 10px; }
.btn-google:hover { background: #f7f8f8; transform: translateY(-1px); box-shadow: 0 4px 10px rgba(60,64,67,0.15); }
.full { width: 100%; }
.link-btn { background: none; border: none; color: var(--terracotta-btn); text-decoration: underline; cursor: pointer; margin-left: 8px; font-size: 0.85rem; }

/* nav */
.nav { position: sticky; top: 0; z-index: 40; background: rgba(253,248,240,0.9); backdrop-filter: blur(8px); border-bottom: 1px solid var(--gold); }
.nav-inner { max-width: 1200px; margin: 0 auto; display: flex; flex-wrap: wrap; row-gap: 8px; align-items: center; justify-content: space-between; padding: 14px 24px; }
.brand { display: flex; align-items: center; gap: 8px; }
.brand-mark-img { height: 46px; width: auto; display: block; }
.brand-name { font-family: 'Cormorant Garamond', serif; font-weight: 700; font-size: 1.3rem; color: var(--chestnut); }
.brand-name.light { color: var(--cream); }
.nav-links { display: none; gap: 22px; flex-wrap: wrap; row-gap: 6px; font-weight: 600; font-size: 0.92rem; }
.nav-actions { display: flex; align-items: center; gap: 14px; }
.hamburger { background: none; border: none; font-size: 1.3rem; cursor: pointer; }
.nav-mobile { display: flex; flex-direction: column; padding: 12px 24px 18px; gap: 10px; font-weight: 600; }
/* Overrides link-btn's small, underlined, inline-link styling (built for sitting next to text in
   the desktop user-chip) so this reads as a normal item in the mobile menu's vertical list,
   consistent with its sibling <a> links rather than looking like a stray inline link. */
.nav-mobile-signout { text-align: left; text-decoration: none; margin-left: 0; font-size: inherit; font-weight: inherit; color: inherit; padding: 0; }
.user-chip { display: flex; align-items: center; gap: 4px; font-size: 0.85rem; font-weight: 700; }
.user-chip .dot { width: 8px; height: 8px; background: var(--green); border-radius: 50%; display: inline-block; }
.user-chip .role { color: var(--almond-text); font-weight: 600; }
@media (min-width: 900px) { .nav-links { display: flex; } .nav-mobile { display: none; } .hamburger { display: none; } }
@media (max-width: 480px) {
  .nav-inner { padding: 12px 14px; }
  .nav-actions { gap: 6px; }
  .admin-btn { display: none; } /* still reachable via the hamburger menu's "Admin Dashboard" link */
  /* Whole chip hidden, not just the role badge -- a real Playwright trace at this exact width
     (390px, iPhone 13) showed the user-chip's "Sign out" button physically intercepting clicks
     meant for the hamburger next to it: 6 icon buttons, the user's name, Sign out, and the
     hamburger all crowded into one row with no wrapping was a real, not hypothetical, mobile
     usability bug -- a signed-in visitor on a real narrow phone would hit the same problem.
     "My Aroma Journey" and "Sign out" are both reachable via the hamburger menu instead. */
  .user-chip { display: none; }
  .brand-name { font-size: 1.05rem; }
  .brand-mark-img { height: 36px; }
  .cart-btn { min-width: 40px; min-height: 40px; font-size: 1.15rem; }
}

/* hero */
.hero { position: relative; overflow: hidden; padding: 100px 24px 130px; text-align: center; }
.hero-content { position: relative; max-width: 640px; margin: 0 auto; }
.hero-eyebrow { font-size: 1.4rem; color: var(--beige-text); margin-bottom: 4px; text-shadow: 0 2px 10px rgba(0,0,0,0.4); }
.hero-title { font-size: clamp(2.4rem, 6vw, 4rem); line-height: 1.05; margin-bottom: 18px; color: var(--ivory); text-shadow: 0 4px 20px rgba(0,0,0,0.45); }
.hero-title-accent { color: var(--terracotta); }
.hero-sub { font-size: 1.1rem; color: var(--hero-sub-text); margin-bottom: 28px; text-shadow: 0 2px 12px rgba(0,0,0,0.4); }
.hero-actions { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
.hero .btn-ghost { color: var(--cream); }
.pour-line { position: absolute; left: 50%; bottom: 0; width: 2px; height: 60px; background: linear-gradient(var(--chestnut), transparent); }

/* steam */
.steam-wrap { position: relative; display: inline-block; width: 40px; height: 60px; }
.steam { position: absolute; bottom: 0; left: 50%; width: 6px; height: 30px; background: rgba(139,90,58,0.25); border-radius: 50%; filter: blur(4px); animation: rise 4s ease-in-out infinite; }
.s2 { left: 30%; animation-delay: 1.2s; }
.s3 { left: 70%; animation-delay: 2.4s; }
@keyframes rise { 0% { transform: translateY(0) scaleX(1); opacity: 0; } 30% { opacity: 0.6; } 100% { transform: translateY(-50px) scaleX(1.6); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .steam { animation: none; opacity: 0; } }

/* premium (dark) */
.premium {
  position: relative; padding: 60px 0; overflow: hidden;
  background:
    linear-gradient(rgba(20,13,9,0.82), rgba(20,13,9,0.88)),
    url('https://images.unsplash.com/photo-1753837787691-84a06d715d24?auto=format&fit=crop&w=1800&q=70') center/cover fixed;
}
@media (prefers-reduced-motion: reduce) { .premium { background-attachment: scroll; } }
.section-head { max-width: 1200px; margin: 0 auto 26px; padding: 0 24px; }
.section-head.dark h2 { color: var(--gold); }
.section-head h2 { font-size: 2rem; }
.hscroll { display: flex; gap: 18px; overflow-x: auto; padding: 0 24px 12px; scroll-snap-type: x mandatory; }
.premium-card { scroll-snap-align: start; min-width: 240px; background: rgba(255,255,255,0.08); backdrop-filter: blur(6px); border: 1px solid rgba(232,213,181,0.25); border-radius: 14px; padding: 16px; color: var(--cream); transition: transform .2s ease, background .2s ease; }
.premium-card:hover { transform: translateY(-5px); background: rgba(255,255,255,0.13); }
.premium-photo { height: 120px; border-radius: 10px; margin-bottom: 12px; background: linear-gradient(135deg, var(--chestnut), var(--espresso)); background-size: contain; background-repeat: no-repeat; background-position: center; }
.premium-card h3 { color: var(--gold); font-size: 1.2rem; }
.premium-card .note { color: var(--steam); font-size: 1.1rem; margin: 6px 0 14px; }
.premium-foot { display: flex; flex-direction: column; align-items: stretch; gap: 8px; }
.premium-foot > span { white-space: nowrap; font-size: 1.05rem; font-weight: 700; color: var(--chestnut); }
.premium-foot .btn-cart, .premium-foot .btn-outline { width: 100%; justify-content: center; box-sizing: border-box; }

/* glass */
.glass { backdrop-filter: blur(12px); background: rgba(255,255,255,0.35); border: 1px solid rgba(255,245,235,0.5); border-radius: 20px; }
.glass-dark { background: rgba(62,44,35,0.55); border-color: rgba(232,213,181,0.3); color: var(--cream); }
.quiz-section {
  position: relative; padding: 70px 24px; display: flex; justify-content: center; overflow: hidden;
  background:
    linear-gradient(rgba(232,213,181,0.75), rgba(253,248,240,0.9)),
    url('https://images.unsplash.com/photo-1757688341742-ce7978cdb186?auto=format&fit=crop&w=1600&q=65') center 30%/cover fixed;
}
@media (prefers-reduced-motion: reduce) { .quiz-section { background-attachment: scroll; } }
.quiz-panel { max-width: 560px; padding: 40px; text-align: center; }
.quiz-copy { margin: 12px 0 22px; color: #6b5647; }

/* everyday grid */
.everyday { padding: 60px 24px; max-width: 1200px; margin: 0 auto; }
.grid4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; }
.everyday-card { background: white; border: 1px solid var(--gold); border-radius: 14px; padding: 16px; }
.everyday-photo { height: 100px; border-radius: 10px; background: linear-gradient(135deg, var(--almond), var(--gold)); background-size: contain; background-repeat: no-repeat; background-position: center; margin-bottom: 10px; position: relative; }
.everyday-card p { font-size: 0.9rem; color: #6b5647; margin: 6px 0 12px; }

/* moments */
.moments { padding: 60px 24px; max-width: 1200px; margin: 0 auto; }
.moment-card { background: var(--steam); border-radius: 14px; padding: 24px; text-align: center; }
.moment-icon { font-size: 2rem; }
.moment-card h4 { margin: 10px 0 6px; }
.moment-card a { font-weight: 700; color: var(--chestnut); }

/* trust */
.trust { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px,1fr)); gap: 20px; max-width: 900px; margin: 0 auto; padding: 30px 24px 60px; text-align: center; }
.trust-col h4 { color: var(--chestnut); }
.trust-col p { font-size: 0.9rem; color: #6b5647; }

/* seasonal */
.seasonal {
  position: relative; padding: 40px 24px; overflow: hidden;
  background:
    linear-gradient(100deg, rgba(139,90,58,0.92), rgba(107,123,80,0.85)),
    url('https://images.unsplash.com/photo-1753652735948-47b47c1d5713?auto=format&fit=crop&w=1600&q=65') center/cover;
}
.seasonal-inner { max-width: 1000px; margin: 0 auto; display: flex; flex-wrap: wrap; gap: 20px; align-items: center; justify-content: space-between; color: var(--cream); }
.seasonal-inner h3 { color: var(--cream); font-size: 1.5rem; }

/* footer */
.footer {
  position: relative; color: var(--steam); padding: 50px 24px 20px;
  background:
    linear-gradient(rgba(20,13,9,0.93), rgba(20,13,9,0.96)),
    url('https://images.unsplash.com/photo-1753837787691-84a06d715d24?auto=format&fit=crop&w=1600&q=60') center/cover;
}
.footer-grid { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px,1fr)); gap: 30px; }
.footer .tagline { margin-top: 8px; font-size: 1.2rem; color: var(--gold); }
.footer-links h5, .footer-form h5 { color: var(--gold); font-family: 'Cormorant Garamond', serif; font-size: 1.1rem; margin-bottom: 10px; }
.footer-links a { display: block; margin-bottom: 6px; font-size: 0.9rem; opacity: 0.85; transition: opacity .15s, padding-left .15s; }
.footer-links a:hover { opacity: 1; padding-left: 4px; }
.footer-form form { display: flex; flex-direction: column; gap: 8px; }
.footer-form input, .footer-form select, .footer-form textarea { padding: 9px 12px; border-radius: 8px; border: 1px solid rgba(232,213,181,0.3); background: rgba(255,255,255,0.06); color: var(--cream); font-family: inherit; }
.form-success { color: var(--gold); font-size: 0.9rem; }
.copyright { text-align: center; margin-top: 40px; font-size: 0.8rem; opacity: 0.6; }

/* feedback bean */
.feedback-bean { position: fixed; bottom: 24px; right: 24px; width: 58px; height: 58px; border-radius: 50%; background: var(--chestnut); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 18px rgba(62,44,35,0.35); z-index: 30; }
.bean-shape { width: 24px; height: 30px; background: var(--gold); border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%; position: relative; }
.bean-shape::after { content: ''; position: absolute; top: 4px; left: 50%; width: 1.5px; height: 22px; background: var(--espresso); }
.bean-steam { position: absolute; top: -30px; }
.feedback-bean:hover .steam { animation-duration: 2s; }

/* modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(62,44,35,0.5); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 20px; }
.modal-card { background: var(--cream); border-radius: 18px; padding: 30px; max-width: 380px; width: 100%; position: relative; }
.modal-close { position: absolute; top: 14px; right: 16px; background: none; border: none; font-size: 1.4rem; cursor: pointer; color: var(--chestnut); }
.modal-title { font-size: 1.6rem; margin-bottom: 16px; }
.login-steam { display: block; margin: 0 auto 4px; opacity: 0.8; }
.login-eyebrow { text-align: left; }
.login-switch-line { text-align: center; margin-top: 16px; font-size: 0.9rem; color: var(--almond-text); }
.login-name-row { display: flex; gap: 12px; }
.login-name-row > div { flex: 1; }
.mode-toggle { display: flex; gap: 8px; margin-bottom: 16px; }
.mode-toggle button { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 8px; border-radius: 999px; border: 1px solid var(--gold); background: var(--cream); cursor: pointer; font-size: 0.8rem; font-weight: 700; color: var(--chestnut); transition: background .15s ease, box-shadow .15s ease, transform .15s ease; }
.mode-toggle button:hover { background: var(--steam); }
.mode-toggle button.active { background: var(--chestnut); color: var(--cream); box-shadow: 0 4px 12px rgba(139,90,58,0.3); border-color: var(--chestnut); }
.mode-toggle-icon { font-size: 0.95rem; line-height: 1; }
.modal-card label { display: block; font-size: 0.8rem; font-weight: 700; margin: 10px 0 4px; color: var(--chestnut); }
.modal-card input { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--gold); font-family: inherit; box-sizing: border-box; }
.form-error { color: #b5432f; font-size: 0.85rem; margin-top: 8px; }
.hint { font-size: 0.78rem; color: #8a7660; margin-top: 10px; }
.divider { display: flex; align-items: center; gap: 10px; margin: 18px 0; color: var(--almond-text); font-size: 0.8rem; }
.divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: var(--gold); }

/* cart button */
.cart-btn { position: relative; background: none; border: none; font-size: 1.3rem; cursor: pointer; min-width: 44px; min-height: 44px; display: flex; align-items: center; justify-content: center; }
.cart-badge { position: absolute; top: -6px; right: -8px; background: var(--chestnut); color: var(--cream); font-size: 0.65rem; font-weight: 700; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; }

/* shop page */
.shop-page { max-width: 1200px; margin: 0 auto; padding: 50px 24px 80px; }
.shop-head { text-align: center; margin-bottom: 40px; }
.shop-head h1 { font-size: 2.4rem; }
.shop-sub { color: #6b5647; max-width: 480px; margin: 8px auto 0; }
.shop-layout { display: grid; grid-template-columns: 220px 1fr; gap: 36px; align-items: start; }
@media (max-width: 800px) { .shop-layout { grid-template-columns: 1fr; } }
.shop-filters { position: sticky; top: 90px; background: white; border: 1px solid var(--gold); border-radius: 14px; padding: 18px; }
.filters-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.filters-head h4 { font-size: 1.1rem; }
.filters-head-actions { display: flex; align-items: center; gap: 10px; }

/* Mobile filter drawer: the toggle button and scrim only exist/show below 800px (the same
   breakpoint .shop-layout already collapses at) — on desktop the filters stay exactly as they
   were, a plain always-visible sticky sidebar, untouched. */
.shop-filter-toggle { display: none; }
.shop-filter-scrim { display: none; }
.shop-filter-close { display: none; }
.shop-filter-apply { display: none; }
@media (max-width: 800px) {
  .shop-filter-toggle {
    display: flex; align-items: center; gap: 8px; margin: 0 0 18px; padding: 10px 18px;
    background: white; border: 1px solid var(--gold); border-radius: 30px; font-weight: 700;
    color: var(--chestnut); cursor: pointer; box-shadow: 0 4px 12px rgba(62,44,35,0.08);
  }
  .shop-filter-scrim { display: block; position: fixed; inset: 0; background: rgba(20,13,9,0.5); z-index: 40; }
  .shop-filters {
    position: fixed; top: 0; right: 0; bottom: 0; width: min(340px, 86vw); max-width: none;
    border-radius: 0; z-index: 50; overflow-y: auto; transform: translateX(100%); visibility: hidden;
    transition: transform .25s ease, visibility .25s; padding: 20px 18px 90px;
  }
  .shop-filters.shop-filters-open { transform: translateX(0); visibility: visible; }
  .shop-filter-close {
    display: flex; align-items: center; justify-content: center; width: 30px; height: 30px;
    border-radius: 50%; border: 1px solid var(--gold); background: white; color: var(--chestnut);
    font-size: 0.9rem; cursor: pointer;
  }
  .shop-filter-apply {
    display: block; position: sticky; bottom: 0; width: 100%; margin-top: 20px;
  }
}
@media (prefers-reduced-motion: reduce) { .shop-filters { transition: none; } }
.filter-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--almond-text); font-weight: 700; margin: 14px 0 6px; }
.chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { border: 1px solid var(--gold); background: var(--cream); color: var(--espresso); border-radius: 20px; padding: 5px 12px; font-size: 0.78rem; cursor: pointer; text-transform: capitalize; }
.chip-active { background: var(--chestnut); color: var(--cream); border-color: var(--chestnut); }
.results-count { font-size: 0.85rem; color: var(--almond-text); margin-bottom: 14px; font-weight: 700; }
.empty-state { text-align: center; padding: 40px 20px; color: #6b5647; }
.premium-photo-sm { background: linear-gradient(135deg, var(--chestnut), var(--espresso)); background-size: contain; background-repeat: no-repeat; background-position: center; }

/* product page */
.product-page { max-width: 1000px; margin: 0 auto; padding: 30px 24px 80px; }
.back-link { padding: 0; margin-bottom: 14px; display: inline-block; }
.product-top { display: grid; grid-template-columns: 1fr 1fr; gap: 36px; align-items: start; }
@media (max-width: 760px) { .product-top { grid-template-columns: 1fr; } }
.product-hero-photo { height: 340px; border-radius: 16px; background: linear-gradient(135deg, var(--almond), var(--gold)); background-size: contain; background-repeat: no-repeat; background-position: center; position: relative; }
.product-info h1 { font-size: 2.2rem; margin: 6px 0 10px; }
.product-note { font-size: 1.3rem; color: var(--almond-text); margin-bottom: 14px; }
.product-price { font-size: 1.4rem; font-weight: 700; color: var(--chestnut); margin-bottom: 16px; }
.product-price span { font-size: 0.85rem; font-weight: 400; color: #8a7660; }
.qty-row { display: inline-flex; align-items: center; gap: 14px; border: 1px solid var(--gold); border-radius: 30px; padding: 6px 18px; margin-bottom: 16px; }
.qty-row.small { border: none; padding: 0; gap: 8px; margin: 0; }
.qty-row button { background: none; border: none; font-size: 1.1rem; cursor: pointer; color: var(--chestnut); font-weight: 700; }
.match-row { display: flex; align-items: center; gap: 14px; margin-top: 16px; flex-wrap: wrap; }
.match-row a { font-weight: 700; color: var(--chestnut); font-size: 0.9rem; }

.tabs { display: flex; gap: 6px; margin: 40px 0 20px; border-bottom: 1px solid var(--gold); }
.tabs button { background: none; border: none; padding: 10px 16px; font-weight: 700; cursor: pointer; color: #8a7660; border-bottom: 2px solid transparent; }
.tabs button.active { color: var(--chestnut); border-color: var(--chestnut); }
.tab-panel { padding: 10px 0 30px; }
.bars { display: flex; flex-direction: column; gap: 12px; max-width: 480px; }
.bar-row { display: grid; grid-template-columns: 90px 1fr 44px; align-items: center; gap: 10px; }
.bar-label { font-size: 0.85rem; font-weight: 700; color: var(--chestnut); }
.bar-track { height: 10px; background: var(--gold); border-radius: 6px; overflow: hidden; }
.bar-fill { height: 100%; background: var(--chestnut); border-radius: 6px; }
.bar-value { font-size: 0.78rem; color: #8a7660; }
.soil-link { display: inline-block; margin-top: 12px; font-weight: 700; color: var(--chestnut); }
.brew-course { display: grid; grid-template-columns: repeat(auto-fit,minmax(180px,1fr)); gap: 20px; }
.brew-course h4 { font-size: 1.1rem; margin-bottom: 4px; }
.related { margin-top: 30px; }
.related h3 { margin-bottom: 16px; }

/* cart drawer */
.drawer-overlay { position: fixed; inset: 0; background: rgba(62,44,35,0.4); z-index: 55; display: flex; justify-content: flex-end; }
.drawer { background: var(--cream); width: 380px; max-width: 100%; height: 100%; padding: 24px; overflow-y: auto; box-sizing: border-box; }
.drawer-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.drawer-head .modal-close { position: static; }
.drawer-items { display: flex; flex-direction: column; gap: 16px; }
.drawer-item { display: flex; gap: 12px; border-bottom: 1px solid var(--gold); padding-bottom: 14px; }
.drawer-item-info { flex: 1; min-width: 0; }
.drawer-thumb { width: 56px; height: 56px; border-radius: 10px; background: linear-gradient(135deg, var(--almond), var(--gold)); background-size: contain; background-repeat: no-repeat; background-position: center; flex-shrink: 0; }
.drawer-item-name { font-weight: 700; }
.drawer-item-price { font-size: 0.85rem; color: var(--almond-text); margin: 2px 0 6px; }
.drawer-total { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; font-weight: 700; font-size: 1.1rem; margin: 20px 0 16px; padding-top: 16px; border-top: 1px solid var(--gold); }

/* moments hub */
.moments-hub { max-width: 1100px; margin: 0 auto; padding: 50px 24px 80px; }
.moments-hub-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 20px; }
.moment-hero-card { background: var(--steam); border-radius: 18px; padding: 32px 24px; text-align: center; cursor: pointer; transition: transform .15s; }
.moment-hero-card:hover { transform: translateY(-4px); }
.moment-hero-card p { color: #6b5647; font-size: 0.9rem; margin: 6px 0 14px; }
.moment-icon.big { font-size: 2.8rem; }
.moment-cta { font-weight: 700; color: var(--chestnut); font-size: 0.9rem; }

/* individual moment page */
.moment-banner { padding: 80px 24px 70px; text-align: center; color: var(--cream); position: relative; background-size: cover; background-position: center; }
.moment-banner-first-light { background-image: linear-gradient(135deg, rgba(197,161,129,0.55), rgba(139,90,58,0.75)), url('https://images.unsplash.com/photo-1740593021483-a898ac0d4ab7?auto=format&fit=crop&w=1600&q=65'); }
.moment-banner-the-hustle { background-image: linear-gradient(135deg, rgba(62,44,35,0.75), rgba(107,123,80,0.65)), url('https://images.unsplash.com/photo-1461988091159-192b6df7054f?auto=format&fit=crop&w=1600&q=65'); }
.moment-banner-the-reset { background-image: linear-gradient(135deg, rgba(107,123,80,0.65), rgba(139,90,58,0.75)), url('https://images.unsplash.com/photo-1753652735948-47b47c1d5713?auto=format&fit=crop&w=1600&q=65'); }
.moment-banner-comfort { background-image: linear-gradient(135deg, rgba(62,44,35,0.78), rgba(139,90,58,0.7)), url('https://images.unsplash.com/photo-1639527924446-3edc522ae4b0?auto=format&fit=crop&w=1600&q=65'); }
.moment-banner h1 { color: var(--cream); font-size: 2.6rem; margin: 10px 0 6px; }
.moment-tagline { font-size: 1.3rem; color: var(--steam); }
.back-link.light { color: var(--cream); }
.moment-body { max-width: 800px; margin: 0 auto; padding: 40px 24px 80px; }
.moment-description { font-size: 1.05rem; line-height: 1.7; color: #4a3a30; margin-bottom: 34px; }
.mini-brew { background: white; border: 1px solid var(--gold); border-radius: 16px; padding: 24px; margin-bottom: 40px; }
.mini-brew h3 { margin-bottom: 12px; }
.mini-brew ol { padding-left: 20px; display: flex; flex-direction: column; gap: 8px; color: #4a3a30; }
.mini-brew-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px; }
.mini-brew-head a { font-weight: 700; color: var(--chestnut); font-size: 0.85rem; }
.matched-head { margin-bottom: 16px; }

/* brew guides */
.guide-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; max-width: 1100px; margin: 0 auto; }
.guide-card { background: white; border: 1px solid var(--gold); border-radius: 16px; padding: 26px; text-align: center; cursor: pointer; transition: transform .15s; }
.guide-card:hover { transform: translateY(-4px); }
.guide-card p { color: #6b5647; font-size: 0.88rem; margin: 6px 0 14px; }
.guide-icon { font-size: 2.2rem; }
.guide-icon.big { font-size: 3rem; }
.guide-detail-head { text-align: center; margin: 20px 0 30px; }
.guide-detail-head h1 { font-size: 2.2rem; margin: 8px 0 6px; }
.moment-tagline.dark { color: var(--almond-text); font-size: 1.2rem; }
.course-link-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; background: var(--steam); border-radius: 14px; padding: 16px 20px; margin-bottom: 36px; font-weight: 700; }
.hscroll.light { background: transparent; }
.light-card { background: white; border: 1px solid var(--gold); color: var(--espresso); }
.light-card h3 { color: var(--chestnut); }
.light-card .note { color: #6b5647; font-family: 'Inter', sans-serif; font-style: normal; }
.everyday-tone { background: linear-gradient(135deg, var(--almond), var(--gold)); background-size: contain; background-repeat: no-repeat; background-position: center; }

/* academy */
.cat-tabs { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-bottom: 30px; }
.cat-tabs button { border: 1px solid var(--gold); background: white; color: var(--espresso); border-radius: 20px; padding: 8px 16px; font-weight: 700; font-size: 0.85rem; cursor: pointer; }
.cat-tabs button.active { background: var(--chestnut); color: var(--cream); border-color: var(--chestnut); }
.course-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; max-width: 1100px; margin: 0 auto; }
.course-card { background: white; border: 1px solid var(--gold); border-radius: 16px; padding: 22px; cursor: pointer; transition: transform .15s; }
.course-card:hover { transform: translateY(-4px); }
.course-card p { color: #6b5647; font-size: 0.88rem; margin: 6px 0 12px; }
.course-meta { display: flex; justify-content: space-between; font-size: 0.78rem; color: var(--almond-text); font-weight: 700; }
.course-top { display: grid; grid-template-columns: 1fr 1fr; gap: 36px; align-items: start; }
@media (max-width: 760px) { .course-top { grid-template-columns: 1fr; } }
.course-hero-photo { height: 300px; border-radius: 16px; background: linear-gradient(rgba(62,44,35,0.15), rgba(62,44,35,0.35)), url('https://images.unsplash.com/photo-1761271046396-97d231b59dd7?auto=format&fit=crop&w=1200&q=70') center/cover; }
.course-blurb { color: #6b5647; margin: 8px 0 18px; font-size: 1.02rem; }
.instructor-row { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.instructor-avatar { width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, var(--gold), var(--almond)); flex-shrink: 0; }
.instructor-name { font-weight: 700; }
.instructor-role { font-size: 0.8rem; color: var(--almond-text); }
.btn-primary.disabled { opacity: 0.6; cursor: default; }
.lesson-list { display: flex; flex-direction: column; gap: 2px; margin-bottom: 30px; }
.lesson-row { display: grid; grid-template-columns: 32px 1fr 24px; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--gold); background: white; }
.lesson-num { font-weight: 700; color: var(--almond-text); }
.lesson-lock { text-align: right; }

/* live message bar */
.live-bar { display: flex; align-items: center; gap: 10px; background: var(--espresso); color: var(--steam); padding: 10px 24px; font-size: 0.85rem; flex-wrap: wrap; }
.live-dot { width: 8px; height: 8px; border-radius: 50%; background: #7fbf7f; flex-shrink: 0; animation: pulse 2s infinite; }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
@media (prefers-reduced-motion: reduce) { .live-dot { animation: none; } }
.live-label { font-weight: 700; color: var(--gold); text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.08em; }

/* mini calendar */
.mini-cal { display: flex; gap: 3px; margin: 10px 0; }
.mini-cal-dot { width: 20px; height: 20px; border-radius: 5px; background: var(--gold); color: var(--espresso); font-size: 0.6rem; font-weight: 700; display: flex; align-items: center; justify-content: center; opacity: 0.4; }
.mini-cal-dot.active { background: var(--chestnut); color: var(--cream); opacity: 1; }

/* growing library */
.soil-explorer-cta { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; background: var(--steam); border-radius: 16px; padding: 24px; margin-top: 40px; max-width: 1100px; margin-left: auto; margin-right: auto; }
.soil-explorer-cta h4 { font-size: 1.2rem; }
.soil-explorer-cta p { font-size: 0.88rem; color: #6b5647; }

.stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 30px; }
.stat-card { background: white; border: 1px solid var(--gold); border-radius: 12px; padding: 16px; }
.stat-value { font-weight: 700; color: var(--chestnut); font-size: 1.05rem; }

.country-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
@media (max-width: 700px) { .country-grid { grid-template-columns: 1fr; } }
.region-list { padding-left: 18px; display: flex; flex-direction: column; gap: 6px; }
.region-list li { color: #4a3a30; }

/* soil explorer */
.soil-select-row { display: flex; align-items: center; gap: 12px; justify-content: center; margin-bottom: 30px; flex-wrap: wrap; }
.soil-select-row label { font-weight: 700; color: var(--chestnut); }
.soil-select-row select { padding: 10px 14px; border-radius: 8px; border: 1px solid var(--gold); font-family: inherit; }
.soil-panel { display: grid; grid-template-columns: 1fr 1.2fr; gap: 30px; align-items: center; margin-bottom: 30px; }
@media (max-width: 700px) { .soil-panel { grid-template-columns: 1fr; } }
.soil-3d { border-radius: 16px; overflow: hidden; height: 220px; display: flex; flex-direction: column; box-shadow: inset 0 0 0 1px var(--gold); }
.soil-layer { flex: 1; }
.soil-layer.topsoil { background: linear-gradient(135deg, #6B7B50, #4a5a38); }
.soil-layer.subsoil { background: linear-gradient(135deg, var(--chestnut), #6b4530); }
.soil-layer.bedrock { background: linear-gradient(135deg, var(--espresso), #2a1c16); }
.ph-scale { height: 14px; border-radius: 8px; background: linear-gradient(90deg, #c94f3d, #e8d5b5, #6b7b50, #3e6b8b); position: relative; margin-top: 6px; }
.ph-marker { position: absolute; top: -4px; width: 4px; height: 22px; background: var(--espresso); border-radius: 2px; transform: translateX(-2px); }
.ph-labels { display: flex; justify-content: space-between; font-size: 0.7rem; color: #8a7660; margin-top: 4px; }

/* seasons calendar */
.calendar-table { max-width: 1000px; margin: 0 auto; display: flex; flex-direction: column; gap: 4px; }
.calendar-row { display: grid; grid-template-columns: 160px 1fr; align-items: center; gap: 16px; padding: 10px 16px; border-radius: 10px; cursor: pointer; }
.calendar-row:not(.calendar-header):hover { background: var(--steam); }
.calendar-header { font-weight: 700; color: var(--almond-text); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; cursor: default; }
.calendar-months { display: flex; gap: 3px; }
.calendar-months span { width: 20px; text-align: center; }
.calendar-country { font-weight: 700; }

/* history — the bean's journey */
.history-intro { text-align: center; padding: 60px 24px 20px; }
.history-intro h1 { font-size: clamp(2rem, 5vw, 2.8rem); margin: 8px 0; }
.history-timeline { position: fixed; top: 100px; right: 18px; width: 4px; height: 60vh; z-index: 20; display: none; }
@media (min-width: 1000px) { .history-timeline { display: block; } }
.history-timeline-track { position: absolute; inset: 0; background: var(--gold); border-radius: 4px; }
.history-timeline-bean { position: absolute; left: -6px; width: 16px; height: 16px; border-radius: 50%; transition: top .3s ease, background .3s ease; box-shadow: 0 0 0 3px var(--cream); }
.history-section { position: relative; min-height: 90vh; display: flex; align-items: center; justify-content: center; padding: 60px 24px; background-attachment: fixed; background-size: cover; content-visibility: auto; contain-intrinsic-size: 800px; }
@media (prefers-reduced-motion: reduce) { .history-section { background-attachment: scroll; } }
.history-texture { position: absolute; inset: 0; background-image: radial-gradient(circle at 30% 20%, rgba(255,255,255,0.08) 0, transparent 40%), radial-gradient(circle at 75% 80%, rgba(0,0,0,0.15) 0, transparent 50%); }
.history-panel { position: relative; max-width: 560px; padding: 40px; }
.history-title { color: var(--cream); font-size: 2rem; margin: 6px 0 16px; }
.history-story { color: var(--steam); line-height: 1.7; margin-bottom: 16px; font-size: 0.98rem; }
.history-quote { color: var(--gold); font-size: 1.3rem; margin-bottom: 20px; }

/* our promise */
.promise-page { }
.promise-body { max-width: 900px; margin: 0 auto; padding: 0 24px 90px; }
.promise-hero {
  text-align: center; padding: 90px 24px; margin-bottom: 44px; color: var(--cream);
  background:
    linear-gradient(rgba(62,44,35,0.6), rgba(62,44,35,0.72)),
    url('https://images.unsplash.com/photo-1753652735948-47b47c1d5713?auto=format&fit=crop&w=1600&q=65') center/cover;
}
.promise-hero h1 { font-size: clamp(2rem, 5vw, 2.6rem); color: var(--cream); text-shadow: 0 3px 16px rgba(0,0,0,0.35); }
.promise-statements { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 50px; }
@media (max-width: 700px) { .promise-statements { grid-template-columns: 1fr; } }
.promise-block { background: white; border: 1px solid var(--gold); border-radius: 16px; padding: 24px; }
.promise-block p:last-child { line-height: 1.7; color: #4a3a30; }
.values-head { text-align: center; font-size: 1.8rem; }
.values-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; }
.value-card { background: var(--steam); border-radius: 16px; padding: 22px; text-align: center; }
.value-bean { background: none; border: none; cursor: pointer; padding: 8px; margin-bottom: 6px; }
.value-card .bean-shape { width: 30px; height: 38px; margin: 0 auto; }
.value-line { font-size: 0.88rem; color: #6b5647; margin: 6px 0 4px; }
.value-example { font-size: 0.85rem; color: var(--chestnut); font-weight: 600; margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--gold); text-align: left; }
.value-card.open { background: white; box-shadow: 0 4px 14px rgba(139,90,58,0.12); }

/* google picker */
.google-account-list { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
.google-account-row { display: flex; align-items: center; gap: 12px; background: white; border: 1px solid var(--gold); border-radius: 10px; padding: 10px 14px; cursor: pointer; text-align: left; }
.google-account-row:hover { background: var(--steam); }
.google-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, var(--almond), var(--gold)); flex-shrink: 0; }
.google-name { display: block; font-weight: 700; font-size: 0.9rem; }
.google-email { display: block; font-size: 0.78rem; color: #8a7660; }
.otp-demo-code { background: var(--steam); border-radius: 10px; padding: 10px 12px; }

/* my aroma journey */
.journey-locked { max-width: 420px; margin: 80px auto; text-align: center; padding: 0 24px; }
.journey-locked p { color: #6b5647; margin: 10px 0 20px; }
.journey-page { max-width: 1000px; margin: 0 auto; padding: 40px 24px 80px; }
.journey-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 20px; }
@media (max-width: 760px) { .journey-grid { grid-template-columns: 1fr; } }
.journey-col { display: flex; flex-direction: column; gap: 20px; }
.radar-wrap { display: flex; justify-content: center; }
.radar-svg { width: 100%; max-width: 260px; }
.radar-ring { fill: none; stroke: var(--gold); stroke-width: 1; }
.radar-axis { stroke: var(--gold); stroke-width: 1; }
.radar-fill { fill: rgba(139,90,58,0.35); stroke: var(--chestnut); stroke-width: 2; }
.radar-label { font-size: 9px; fill: var(--chestnut); font-family: 'Inter', sans-serif; font-weight: 700; }
.reco-card { background: var(--steam); }
.reco-name { font-weight: 700; color: var(--chestnut); margin-bottom: 4px; }
.star-row { display: flex; gap: 6px; margin: 4px 0 10px; }
.star { background: none; border: none; font-size: 1.4rem; color: var(--gold); cursor: pointer; padding: 0; }
.star.filled { color: var(--chestnut); }
.journal-list, .order-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 30px; }
.journal-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; background: white; border: 1px solid var(--gold); border-radius: 12px; padding: 14px 16px; }
.journal-name { font-weight: 700; }
.journal-stars { color: var(--chestnut); letter-spacing: 2px; margin: 2px 0; }
.journal-note { font-style: italic; color: #6b5647; font-size: 0.9rem; margin: 4px 0; }
.journal-date { font-size: 0.75rem; color: var(--almond-text); }
.order-card { background: white; border: 1px solid var(--gold); border-radius: 14px; padding: 16px; }
.order-head { display: flex; justify-content: space-between; font-weight: 700; margin-bottom: 4px; }
.order-status { color: var(--green); font-size: 0.85rem; }
.order-items { padding-left: 18px; margin: 8px 0 12px; font-size: 0.9rem; color: #4a3a30; }

/* checkout */
.checkout-page { max-width: 900px; margin: 0 auto; padding: 40px 24px 90px; }
.checkout-steps { display: flex; justify-content: center; gap: 8px; margin-bottom: 40px; flex-wrap: wrap; }
.checkout-step { font-size: 0.78rem; font-weight: 700; color: var(--almond-text); padding: 6px 14px; border-radius: 20px; background: var(--steam); }
.checkout-step.active { background: var(--chestnut); color: var(--cream); }
.checkout-step.done { background: var(--green); color: var(--cream); }
.checkout-grid { display: grid; grid-template-columns: 1.6fr 1fr; gap: 30px; align-items: start; }
@media (max-width: 700px) { .checkout-grid { grid-template-columns: 1fr; } }
.checkout-item { display: flex; gap: 14px; border-bottom: 1px solid var(--gold); padding: 14px 0; }
.checkout-summary { background: white; border: 1px solid var(--gold); border-radius: 14px; padding: 20px; position: sticky; top: 90px; }
.checkout-auth { max-width: 480px; margin: 0 auto; text-align: center; }
.checkout-auth-buttons { display: flex; gap: 12px; justify-content: center; }
.checkout-auth-buttons .btn-primary, .checkout-auth-buttons .btn-outline { flex: 1; }
.checkout-form { max-width: 480px; margin: 0 auto; background: white; border: 1px solid var(--gold); border-radius: 16px; padding: 26px; }
.checkout-form label { display: block; font-size: 0.8rem; font-weight: 700; margin: 12px 0 4px; color: var(--chestnut); }
.checkout-form input { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--gold); font-family: inherit; box-sizing: border-box; }
.form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.payment-note { background: var(--steam); border-radius: 10px; padding: 10px 12px; margin: 8px 0 4px; }
.checkout-confirmed { max-width: 480px; margin: 0 auto; text-align: center; }
.checkout-confirmed h2 { font-size: 1.8rem; margin: 10px 0; }
.checkout-confirmed-actions { display: flex; gap: 12px; justify-content: center; margin-top: 20px; flex-wrap: wrap; }

/* feedback overlay */
.feedback-card { max-width: 420px; max-height: 88vh; overflow-y: auto; }
.feedback-card label { display: block; font-size: 0.8rem; font-weight: 700; margin: 12px 0 4px; color: var(--chestnut); }
.feedback-card select, .feedback-card textarea { width: 100%; padding: 9px 12px; border-radius: 8px; border: 1px solid var(--gold); font-family: inherit; box-sizing: border-box; }
.bean-rating-row { display: flex; justify-content: center; gap: 10px; margin: 16px 0 4px; }
.bean-rate-btn { background: none; border: none; cursor: pointer; padding: 4px; perspective: 300px; }
.rate-bean { width: 26px; height: 32px; display: block; transition: background .2s; }
.bean-flip {
  position: relative; display: block; width: 26px; height: 32px;
  transition: transform .45s var(--spring); transform-style: preserve-3d;
}
.bean-rate-btn:hover .bean-flip,
.bean-rate-btn:focus-visible .bean-flip,
.bean-rate-btn.is-rated .bean-flip { transform: rotateY(180deg); }
.bean-flip-face { position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden; }
.bean-flip-back {
  transform: rotateY(180deg);
  border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
  display: flex; align-items: center; justify-content: center;
  color: var(--btn-cream); font-weight: 700; font-size: 0.85rem; font-family: 'Cormorant Garamond', serif;
}
@media (prefers-reduced-motion: reduce) { .bean-flip { transition: none; } }
.slider { width: 100%; margin: 4px 0 2px; accent-color: var(--chestnut); }
.feedback-thanks { text-align: center; padding: 10px 0; }

/* aroma quiz */
.quiz-page { max-width: 600px; margin: 0 auto; padding: 60px 24px 90px; }
.quiz-progress { display: flex; justify-content: center; gap: 8px; margin-bottom: 24px; }
.quiz-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--gold); }
.quiz-dot.active { background: var(--chestnut); }
.quiz-question-panel { padding: 40px; text-align: center; }
.quiz-question-panel h2 { font-size: 1.7rem; margin: 6px 0 22px; }
.quiz-options { display: flex; flex-direction: column; gap: 10px; }
.quiz-option { background: white; border: 1.5px solid var(--gold); border-radius: 30px; padding: 12px 20px; font-weight: 700; cursor: pointer; color: var(--espresso); }
.quiz-option:hover { background: var(--chestnut); color: var(--cream); border-color: var(--chestnut); }
.quiz-result { text-align: center; }
.quiz-result h1 { font-size: 2rem; margin: 8px 0; }
.quiz-result-actions { display: flex; gap: 12px; justify-content: center; margin-top: 20px; flex-wrap: wrap; }

/* history outro */
.history-outro { text-align: center; padding: 70px 24px; }
.history-outro h3 { margin: 8px 0 20px; font-size: 1.6rem; }

/* global rituals */
.rituals-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; max-width: 1100px; margin: 0 auto; }
.ritual-card { background: white; border: 1px solid var(--gold); border-radius: 16px; padding: 26px; }
.ritual-card p { color: #6b5647; font-size: 0.92rem; margin: 8px 0 16px; line-height: 1.6; }

/* faq */
.faq-list { max-width: 700px; margin: 0 auto; display: flex; flex-direction: column; gap: 10px; }
.faq-item { background: white; border: 1px solid var(--gold); border-radius: 12px; overflow: hidden; }
.faq-question { width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 16px 18px; background: none; border: none; cursor: pointer; font-weight: 700; text-align: left; color: var(--espresso); font-size: 0.98rem; }
.faq-item.open .faq-question { color: var(--chestnut); }
.faq-chevron { font-size: 1.3rem; color: var(--chestnut); }
.faq-answer { padding: 0 18px 18px; color: #6b5647; line-height: 1.6; }

/* source library */
.fob-table { max-width: 800px; margin: 0 auto; display: flex; flex-direction: column; gap: 4px; }
.fob-row { display: grid; grid-template-columns: 1.3fr 1fr 1fr 1.3fr; gap: 10px; padding: 10px 16px; border-radius: 10px; cursor: pointer; align-items: center; }
.fob-row:not(.fob-header):hover { background: var(--steam); }
.fob-header { font-weight: 700; color: var(--almond-text); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; cursor: default; }

/* admin dashboard */
.admin-btn { border-color: var(--chestnut); color: var(--chestnut); font-size: 0.85rem; padding: 8px 14px; }
.admin-page {
  display: grid; grid-template-columns: 220px 1fr; min-height: 70vh; max-width: 1200px; margin: 20px auto 40px;
  border-radius: 18px; overflow: hidden; box-shadow: 0 24px 60px rgba(62,44,35,0.16);
}
@media (max-width: 800px) { .admin-page { grid-template-columns: 1fr; } }
.admin-sidebar {
  display: flex; flex-direction: column; gap: 2px; padding: 28px 0;
  background: linear-gradient(165deg, var(--espresso) 0%, var(--chestnut) 100%);
}
.admin-nav-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; text-align: left; background: none; border: none; padding: 11px 20px; font-weight: 700; font-size: 0.9rem; color: var(--nav-text-dark); cursor: pointer; border-left: 3px solid transparent; transition: background .15s ease, color .15s ease; }
.admin-nav-item:hover { background: rgba(255,255,255,0.06); color: var(--cream); }
.admin-nav-item.active { background: rgba(232,213,181,0.14); color: var(--gold); border-left-color: var(--gold); }
.admin-nav-badge { background: var(--terracotta-btn); color: var(--btn-cream); font-size: 0.68rem; font-weight: 700; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; line-height: 1; }
.admin-content { padding: 30px 24px 80px; background: radial-gradient(circle at 15% 0%, rgba(232,213,181,0.18) 0%, transparent 45%), var(--cream); }
.admin-content-head { margin-bottom: 24px; }
.admin-content-head-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }

.notification-bell-wrap { position: relative; flex-shrink: 0; }
.notification-bell-btn { position: relative; background: white; border: 1px solid var(--gold); border-radius: 50%; width: 42px; height: 42px; font-size: 1.15rem; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(62,44,35,0.08); transition: transform .15s ease; }
.notification-bell-btn:hover { transform: translateY(-1px); }
.notification-bell-badge { position: absolute; top: -4px; right: -4px; background: var(--terracotta-btn); color: var(--btn-cream); font-size: 0.65rem; font-weight: 700; min-width: 18px; height: 18px; padding: 0 4px; border-radius: 10px; display: flex; align-items: center; justify-content: center; border: 2px solid var(--cream); }
.notification-bell-panel { position: absolute; top: calc(100% + 10px); right: 0; width: 260px; background: white; border: 1px solid var(--gold); border-radius: 14px; box-shadow: 0 16px 40px rgba(62,44,35,0.2); padding: 14px 0; z-index: 20; }
.notification-bell-title { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--almond-text); padding: 0 16px 10px; margin: 0; }
.notification-bell-item { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 16px; background: none; border: none; text-align: left; font-family: inherit; font-size: 0.85rem; font-weight: 600; color: var(--espresso); cursor: pointer; transition: background .15s ease; }
.notification-bell-item:hover { background: var(--steam); }
.admin-content-head h1 { font-size: 1.8rem; }

.admin-kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px; margin-bottom: 34px; }
.admin-kpi-card { background: linear-gradient(160deg, white 0%, var(--cream) 100%); border: 1px solid var(--gold); border-top: 3px solid var(--terracotta-btn); border-radius: 12px; padding: 16px; box-shadow: 0 6px 18px rgba(62,44,35,0.08); }
.admin-kpi-value { font-size: 1.5rem; font-weight: 700; color: var(--chestnut); font-family: 'Cormorant Garamond', serif; }

.admin-status-bars { display: flex; flex-direction: column; gap: 10px; max-width: 500px; }
.admin-status-row { display: grid; grid-template-columns: 100px 1fr 30px; align-items: center; gap: 10px; font-size: 0.88rem; }
.admin-status-row-wide { grid-template-columns: 150px 1fr 70px; }
.admin-status-track { height: 10px; background: var(--gold); border-radius: 6px; overflow: hidden; }
.admin-status-fill { height: 100%; background: var(--chestnut); }

.admin-table { display: flex; flex-direction: column; gap: 2px; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 14px rgba(62,44,35,0.06); }
.admin-row { display: grid; grid-template-columns: 1fr 1.4fr 1fr 1fr 1fr 1fr; gap: 10px; align-items: center; padding: 10px 14px; background: white; border-bottom: 1px solid var(--gold); font-size: 0.86rem; transition: background .15s ease; }
.admin-table .admin-row:not(.admin-header):hover { background: var(--steam); }
.admin-table-products .admin-row { grid-template-columns: 1.2fr 1fr 1fr 1fr 1fr; }
.admin-header { font-weight: 700; color: var(--almond-text); text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.05em; background: linear-gradient(180deg, var(--steam), rgba(249,230,212,0.5)); }
.admin-row select { padding: 6px 8px; border-radius: 6px; border: 1px solid var(--gold); font-family: inherit; font-size: 16px; }
.admin-price-input { width: 70px; padding: 5px 8px; border-radius: 6px; border: 1px solid var(--gold); font-family: inherit; font-size: 16px; }
.role-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 700; text-transform: capitalize; background: var(--steam); color: var(--chestnut); }
.role-badge.super_admin { background: var(--chestnut); color: var(--cream); }
.role-badge.premium { background: var(--espresso); color: var(--gold); }
.role-badge.everyday { background: var(--gold); color: var(--espresso); }
.admin-table-orders .admin-row { grid-template-columns: 0.9fr 1.3fr 0.9fr 0.7fr 0.8fr 0.9fr 1.2fr; }
.payment-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 700; text-transform: capitalize; }
.payment-badge.unpaid { background: #fdecea; color: #b3261e; }
.payment-badge.paid { background: #e6f4ea; color: #1e7e34; }
.payment-badge.refunded { background: var(--steam); color: var(--chestnut); }
.payment-badge.refund_pending { background: #fff3cd; color: #7a5c00; }
.payment-mode-badge { display: inline-block; margin-left: 5px; padding: 1px 6px; border-radius: 10px; font-size: 0.6rem; font-weight: 800; letter-spacing: 0.03em; background: #fff3cd; color: #7a5c00; }

.admin-card-list { display: flex; flex-direction: column; gap: 12px; }
.admin-card { background: linear-gradient(160deg, white 0%, var(--cream) 100%); border: 1px solid var(--gold); border-left: 3px solid var(--terracotta-btn); border-radius: 12px; padding: 16px; box-shadow: 0 6px 16px rgba(62,44,35,0.07); transition: box-shadow .15s ease; }
.admin-card:hover { box-shadow: 0 8px 22px rgba(62,44,35,0.12); }
.admin-card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; gap: 10px; flex-wrap: wrap; }
.admin-card-head select { padding: 6px 8px; border-radius: 6px; border: 1px solid var(--gold); font-family: inherit; font-size: 16px; }
.reviewed-toggle { font-size: 0.8rem; display: flex; align-items: center; gap: 6px; font-weight: 700; color: var(--chestnut); }
.admin-message-edit { width: 100%; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--gold); font-family: inherit; box-sizing: border-box; margin-bottom: 8px; }
.admin-add-message { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; max-width: 500px; }
.admin-add-message textarea { padding: 8px 10px; border-radius: 8px; border: 1px solid var(--gold); font-family: inherit; box-sizing: border-box; }

/* scroll reveal */
.section-head, .hscroll, .quiz-panel, .trust, .seasonal-inner, .faq-list, .calendar-table, .country-grid, .promise-statements, .checkout-steps {
  opacity: 0; transform: translateY(22px); transition: opacity .7s ease, transform .7s ease;
}
.section-head.revealed, .hscroll.revealed, .quiz-panel.revealed, .trust.revealed, .seasonal-inner.revealed, .faq-list.revealed, .calendar-table.revealed, .country-grid.revealed, .promise-statements.revealed, .checkout-steps.revealed {
  opacity: 1; transform: translateY(0);
}

.grid4 > *, .guide-grid > *, .course-grid > *, .moments-hub-grid > *, .rituals-grid > *, .values-grid > *, .stat-grid > * {
  opacity: 0; transform: translateY(18px); transition: opacity .55s ease, transform .55s ease;
}
.grid4.revealed > *, .guide-grid.revealed > *, .course-grid.revealed > *, .moments-hub-grid.revealed > *, .rituals-grid.revealed > *, .values-grid.revealed > *, .stat-grid.revealed > * {
  opacity: 1; transform: translateY(0);
}
.grid4.revealed > *:nth-child(1), .guide-grid.revealed > *:nth-child(1), .course-grid.revealed > *:nth-child(1), .moments-hub-grid.revealed > *:nth-child(1), .rituals-grid.revealed > *:nth-child(1), .values-grid.revealed > *:nth-child(1), .stat-grid.revealed > *:nth-child(1) { transition-delay: .04s; }
.grid4.revealed > *:nth-child(2), .guide-grid.revealed > *:nth-child(2), .course-grid.revealed > *:nth-child(2), .moments-hub-grid.revealed > *:nth-child(2), .rituals-grid.revealed > *:nth-child(2), .values-grid.revealed > *:nth-child(2), .stat-grid.revealed > *:nth-child(2) { transition-delay: .10s; }
.grid4.revealed > *:nth-child(3), .guide-grid.revealed > *:nth-child(3), .course-grid.revealed > *:nth-child(3), .moments-hub-grid.revealed > *:nth-child(3), .rituals-grid.revealed > *:nth-child(3), .values-grid.revealed > *:nth-child(3), .stat-grid.revealed > *:nth-child(3) { transition-delay: .16s; }
.grid4.revealed > *:nth-child(4), .guide-grid.revealed > *:nth-child(4), .course-grid.revealed > *:nth-child(4), .moments-hub-grid.revealed > *:nth-child(4), .rituals-grid.revealed > *:nth-child(4), .values-grid.revealed > *:nth-child(4), .stat-grid.revealed > *:nth-child(4) { transition-delay: .22s; }
.grid4.revealed > *:nth-child(5), .guide-grid.revealed > *:nth-child(5), .course-grid.revealed > *:nth-child(5), .moments-hub-grid.revealed > *:nth-child(5), .rituals-grid.revealed > *:nth-child(5), .values-grid.revealed > *:nth-child(5), .stat-grid.revealed > *:nth-child(5) { transition-delay: .28s; }
.grid4.revealed > *:nth-child(6), .guide-grid.revealed > *:nth-child(6), .course-grid.revealed > *:nth-child(6), .moments-hub-grid.revealed > *:nth-child(6), .rituals-grid.revealed > *:nth-child(6), .values-grid.revealed > *:nth-child(6), .stat-grid.revealed > *:nth-child(6) { transition-delay: .34s; }
.grid4.revealed > *:nth-child(7), .guide-grid.revealed > *:nth-child(7), .course-grid.revealed > *:nth-child(7), .moments-hub-grid.revealed > *:nth-child(7), .rituals-grid.revealed > *:nth-child(7), .values-grid.revealed > *:nth-child(7), .stat-grid.revealed > *:nth-child(7) { transition-delay: .40s; }
.grid4.revealed > *:nth-child(8), .guide-grid.revealed > *:nth-child(8), .course-grid.revealed > *:nth-child(8), .moments-hub-grid.revealed > *:nth-child(8), .rituals-grid.revealed > *:nth-child(8), .values-grid.revealed > *:nth-child(8), .stat-grid.revealed > *:nth-child(8) { transition-delay: .46s; }

@media (prefers-reduced-motion: reduce) {
  .section-head, .hscroll, .quiz-panel, .trust, .seasonal-inner, .faq-list, .calendar-table, .country-grid, .promise-statements, .checkout-steps,
  .grid4 > *, .guide-grid > *, .course-grid > *, .moments-hub-grid > *, .rituals-grid > *, .values-grid > *, .stat-grid > * {
    opacity: 1 !important; transform: none !important; transition: none !important;
  }
}

/* idle motion */
@keyframes gentleBounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
.feedback-bean { animation: gentleBounce 3.2s ease-in-out infinite; }
.feedback-bean:hover { animation: none; transform: scale(1.06); }
.cart-badge { animation: pulse 1.6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .feedback-bean, .cart-badge { animation: none; } }

/* card hover lift, site-wide */
.everyday-card, .value-card, .stat-card, .order-card, .admin-kpi-card, .journal-row, .faq-item {
  transition: transform .2s ease, box-shadow .2s ease;
}
.everyday-card:hover, .value-card:hover, .stat-card:hover, .admin-kpi-card:hover {
  transform: translateY(-4px); box-shadow: 0 10px 22px rgba(139,90,58,0.14);
}

/* announcement bar */
.announcement-bar { background: var(--espresso); color: var(--gold); text-align: center; padding: 8px 40px; font-size: 0.82rem; font-weight: 700; position: relative; }
.announcement-close { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--gold); font-size: 1.1rem; cursor: pointer; line-height: 1; }

/* page fade transition */
@keyframes pageFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
.page-fade { animation: pageFadeIn .35s ease; }
@media (prefers-reduced-motion: reduce) { .page-fade { animation: none; } }

/* toasts */
.toast-stack { position: fixed; bottom: 100px; left: 24px; display: flex; flex-direction: column; gap: 8px; z-index: 80; }
@media (max-width: 600px) { .toast-stack { left: 12px; right: 12px; } }
.toast { background: var(--espresso); color: var(--cream); padding: 12px 18px; border-radius: 30px; font-size: 0.85rem; font-weight: 600; display: flex; align-items: center; gap: 10px; box-shadow: 0 8px 20px rgba(0,0,0,0.25); animation: toastIn .3s ease; }
.toast-bean { width: 14px; height: 18px; background: var(--gold); flex-shrink: 0; }
@keyframes toastIn { from { opacity: 0; transform: translateY(10px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
@media (prefers-reduced-motion: reduce) { .toast { animation: none; } }

/* admin content / settings forms */
.admin-content-input { width: 100%; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--gold); font-family: inherit; box-sizing: border-box; margin-bottom: 8px; }
.admin-settings-form { max-width: 480px; display: flex; flex-direction: column; }
.admin-settings-form input[type="text"], .admin-settings-form input:not([type="checkbox"]) { padding: 10px 12px; border-radius: 8px; border: 1px solid var(--gold); font-family: inherit; box-sizing: border-box; width: 100%; }
.admin-settings-form input[type="checkbox"] { width: auto; }

/* image hover zoom */
.everyday-card { overflow: hidden; position: relative; }
.everyday-photo { transition: transform .4s ease; }
.everyday-card:hover .everyday-photo { transform: scale(1.08); }
.premium-card { overflow: hidden; position: relative; }
.premium-photo { transition: transform .4s ease; }
.premium-card:hover .premium-photo { transform: scale(1.08); }

/* ---------- loosen up: hand-placed tilt + springy motion ---------- */
:root { --spring: cubic-bezier(0.34, 1.56, 0.64, 1); }

/* give ritual cards the same lift the other cards already have */
.ritual-card { transition: transform .25s var(--spring), box-shadow .25s ease; }
.ritual-card:hover { transform: translateY(-4px) rotate(0deg); box-shadow: 0 10px 22px rgba(139,90,58,0.14); }

/* springier hover on everything that already lifts */
.btn-primary, .btn-secondary, .btn-outline, .btn-google { transition-timing-function: var(--spring); }
.everyday-card, .value-card, .stat-card, .admin-kpi-card, .guide-card, .course-card, .moment-hero-card, .premium-card {
  transition-timing-function: var(--spring);
}

/* hand-placed tilt on card grids — straightens and lifts on hover */
.grid4.revealed > .everyday-card:nth-child(odd):not(:hover) { transform: rotate(-0.7deg); }
.grid4.revealed > .everyday-card:nth-child(even):not(:hover) { transform: rotate(0.6deg); }
.guide-grid.revealed > .guide-card:nth-child(odd):not(:hover) { transform: rotate(-0.6deg); }
.guide-grid.revealed > .guide-card:nth-child(even):not(:hover) { transform: rotate(0.7deg); }
.course-grid.revealed > .course-card:nth-child(odd):not(:hover) { transform: rotate(-0.5deg); }
.course-grid.revealed > .course-card:nth-child(even):not(:hover) { transform: rotate(0.5deg); }
.moments-hub-grid.revealed > .moment-hero-card:nth-child(odd):not(:hover) { transform: rotate(-0.8deg); }
.moments-hub-grid.revealed > .moment-hero-card:nth-child(even):not(:hover) { transform: rotate(0.7deg); }
.rituals-grid.revealed > .ritual-card:nth-child(odd):not(:hover) { transform: rotate(-0.6deg); }
.rituals-grid.revealed > .ritual-card:nth-child(even):not(:hover) { transform: rotate(0.6deg); }
.values-grid.revealed > .value-card:nth-child(odd):not(:hover) { transform: rotate(-0.7deg); }
.values-grid.revealed > .value-card:nth-child(even):not(:hover) { transform: rotate(0.6deg); }
.premium-card:nth-child(odd):not(:hover) { transform: rotate(-0.8deg); }
.premium-card:nth-child(even):not(:hover) { transform: rotate(0.7deg); }
@media (prefers-reduced-motion: reduce) {
  .grid4.revealed > .everyday-card:not(:hover), .guide-grid.revealed > .guide-card:not(:hover),
  .course-grid.revealed > .course-card:not(:hover), .moments-hub-grid.revealed > .moment-hero-card:not(:hover),
  .rituals-grid.revealed > .ritual-card:not(:hover), .values-grid.revealed > .value-card:not(:hover),
  .premium-card:not(:hover) { transform: none !important; }
}

/* looser, less uniform reveal stagger */
.grid4.revealed > *:nth-child(1), .guide-grid.revealed > *:nth-child(1), .course-grid.revealed > *:nth-child(1), .moments-hub-grid.revealed > *:nth-child(1), .rituals-grid.revealed > *:nth-child(1), .values-grid.revealed > *:nth-child(1), .stat-grid.revealed > *:nth-child(1) { transition-delay: .03s; }
.grid4.revealed > *:nth-child(2), .guide-grid.revealed > *:nth-child(2), .course-grid.revealed > *:nth-child(2), .moments-hub-grid.revealed > *:nth-child(2), .rituals-grid.revealed > *:nth-child(2), .values-grid.revealed > *:nth-child(2), .stat-grid.revealed > *:nth-child(2) { transition-delay: .11s; }
.grid4.revealed > *:nth-child(3), .guide-grid.revealed > *:nth-child(3), .course-grid.revealed > *:nth-child(3), .moments-hub-grid.revealed > *:nth-child(3), .rituals-grid.revealed > *:nth-child(3), .values-grid.revealed > *:nth-child(3), .stat-grid.revealed > *:nth-child(3) { transition-delay: .15s; }
.grid4.revealed > *:nth-child(4), .guide-grid.revealed > *:nth-child(4), .course-grid.revealed > *:nth-child(4), .moments-hub-grid.revealed > *:nth-child(4), .rituals-grid.revealed > *:nth-child(4), .values-grid.revealed > *:nth-child(4), .stat-grid.revealed > *:nth-child(4) { transition-delay: .24s; }
.grid4.revealed > *:nth-child(5), .guide-grid.revealed > *:nth-child(5), .course-grid.revealed > *:nth-child(5), .moments-hub-grid.revealed > *:nth-child(5), .rituals-grid.revealed > *:nth-child(5), .values-grid.revealed > *:nth-child(5), .stat-grid.revealed > *:nth-child(5) { transition-delay: .29s; }
.grid4.revealed > *:nth-child(6), .guide-grid.revealed > *:nth-child(6), .course-grid.revealed > *:nth-child(6), .moments-hub-grid.revealed > *:nth-child(6), .rituals-grid.revealed > *:nth-child(6), .values-grid.revealed > *:nth-child(6), .stat-grid.revealed > *:nth-child(6) { transition-delay: .39s; }
.grid4.revealed > *:nth-child(7), .guide-grid.revealed > *:nth-child(7), .course-grid.revealed > *:nth-child(7), .moments-hub-grid.revealed > *:nth-child(7), .rituals-grid.revealed > *:nth-child(7), .values-grid.revealed > *:nth-child(7), .stat-grid.revealed > *:nth-child(7) { transition-delay: .43s; }
.grid4.revealed > *:nth-child(8), .guide-grid.revealed > *:nth-child(8), .course-grid.revealed > *:nth-child(8), .moments-hub-grid.revealed > *:nth-child(8), .rituals-grid.revealed > *:nth-child(8), .values-grid.revealed > *:nth-child(8), .stat-grid.revealed > *:nth-child(8) { transition-delay: .52s; }

/* nicer, looser link hover: underline grows from center instead of a hard color snap */
.footer-links a, .nav-links a { position: relative; }
.nav-links a::after { content: ''; position: absolute; left: 50%; right: 50%; bottom: -4px; height: 2px; background: var(--chestnut); transition: left .25s var(--spring), right .25s var(--spring); }
.nav-links a:hover::after { left: 0; right: 0; }
.moment-cta, .value-bean, .btn-ghost { transition: transform .2s var(--spring); }
.moment-hero-card:hover .moment-cta { transform: translateX(3px); }
.recipe-download-btn { margin-top: 10px; }

/* accessibility: skip link */
.skip-link {
  position: absolute; left: -999px; top: 0; background: var(--chestnut); color: var(--cream);
  padding: 12px 20px; z-index: 200; border-radius: 0 0 8px 0; font-weight: 700; text-decoration: none;
}
.skip-link:focus { left: 0; }

/* photo marquee — continuous right-to-left scroll */
.photo-marquee { overflow: hidden; width: 100%; background: var(--espresso); padding: 14px 0; }
.photo-marquee-track { display: flex; width: max-content; gap: 12px; padding: 0 12px; animation: marqueeScroll 130s linear infinite; }
.photo-marquee:hover .photo-marquee-track { animation-play-state: paused; }
.photo-marquee-item-wrap { width: 220px; height: 140px; flex-shrink: 0; border-radius: 6px; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.25); position: relative; }
.photo-marquee-item { width: 100%; height: 100%; object-fit: cover; object-position: center; filter: saturate(1.05); display: block; }
@keyframes marqueeScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@media (prefers-reduced-motion: reduce) { .photo-marquee-track { animation: none; } }
@media (max-width: 600px) { .photo-marquee-item { width: 160px; height: 100px; } }

/* wave divider — organic break between hard section edges */
.wave-divider { line-height: 0; position: relative; margin-top: -2px; z-index: 2; }
.wave-divider svg { display: block; width: 100%; height: 44px; }

/* customer care widget */
.care-bubble {
  position: fixed; bottom: 24px; left: 24px; width: 58px; height: 58px; border-radius: 50%;
  background: var(--green); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 6px 18px rgba(62,44,35,0.3); z-index: 60; font-size: 1.4rem; transition: transform .2s var(--spring);
}
.care-bubble:hover { transform: scale(1.07); }
.care-panel {
  position: fixed; bottom: 92px; left: 24px; width: 300px; max-width: calc(100vw - 48px);
  background: var(--cream); border-radius: 18px; box-shadow: 0 12px 32px rgba(0,0,0,0.25); z-index: 60; padding: 20px;
  animation: toastIn .25s ease;
}
.care-panel-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; gap: 10px; }
.care-options { display: flex; flex-direction: column; gap: 8px; }
.care-option {
  display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 12px; text-decoration: none;
  color: var(--espresso); background: white; border: 1px solid var(--gold); transition: transform .15s var(--spring), background .15s ease;
}
.care-option:hover { transform: translateX(3px); background: var(--steam); }
.care-option-icon { font-size: 1.3rem; }
.care-option-detail { display: block; font-size: 0.8rem; color: var(--almond-text); font-weight: 400; }
@media (max-width: 600px) { .care-panel { left: 12px; bottom: 90px; } }

/* world journey */
.world-journey-page { padding-bottom: 0; }
.wj-section {
  min-height: 82vh; display: flex; align-items: center; justify-content: center;
  background-size: cover; background-position: center; background-attachment: fixed;
  padding: 70px 24px; position: relative; content-visibility: auto; contain-intrinsic-size: 700px;
}
@media (prefers-reduced-motion: reduce) { .wj-section { background-attachment: scroll; } }
.wj-inner { max-width: 640px; color: var(--cream); text-align: left; }
.wj-head { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
.wj-flag { font-size: 2.6rem; }
.wj-head h2 { color: var(--cream); font-size: 2.4rem; margin: 0; text-shadow: 0 3px 14px rgba(0,0,0,0.4); }
.wj-history { font-size: 1.05rem; line-height: 1.75; color: var(--steam); margin-bottom: 26px; max-width: 560px; }
.wj-varieties { margin-bottom: 20px; }
.wj-varieties-label { text-transform: uppercase; letter-spacing: 0.1em; font-size: 0.72rem; font-weight: 700; color: var(--gold); margin-bottom: 10px; }
.wj-chip { background: rgba(255,255,255,0.12); border-color: rgba(232,213,181,0.4); color: var(--cream); }
.wj-chip:hover { background: rgba(255,255,255,0.22); }
.wj-actions { display: flex; gap: 12px; flex-wrap: wrap; }
.wj-outro { text-align: center; padding: 80px 24px; background: var(--espresso); color: var(--cream); }
.wj-outro h3 { color: var(--cream); font-size: 1.7rem; margin: 8px 0 22px; }
.wj-outro-actions { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }

/* legendary coffee moments */
.legend-intro { text-align: center; padding: 70px 24px 30px; background: var(--espresso); }
.legend-intro h2 { color: var(--gold); font-size: 2.1rem; margin: 8px 0; }
.legend-grid { background: var(--espresso); padding: 10px 24px 70px !important; max-width: 1200px !important; }
.legend-card {
  border-radius: 16px; padding: 24px; min-height: 230px; display: flex; flex-direction: column; justify-content: flex-end;
  background-size: cover; background-position: center; color: var(--cream); position: relative; overflow: hidden;
  transition: transform .3s var(--spring), box-shadow .3s ease; content-visibility: auto; contain-intrinsic-size: 230px;
}
.legend-card:hover { transform: translateY(-6px) scale(1.02); box-shadow: 0 16px 32px rgba(0,0,0,0.4); }
.legend-year { font-family: 'Cormorant Garamond', serif; font-size: 2.1rem; font-weight: 700; color: var(--gold); text-shadow: 0 2px 10px rgba(0,0,0,0.5); }
.legend-card h3 { color: var(--cream); font-size: 1.2rem; margin: 4px 0 8px; text-shadow: 0 2px 10px rgba(0,0,0,0.5); }
.legend-card p { font-size: 0.88rem; color: var(--steam); line-height: 1.55; margin: 0; }

/* wishlist heart */
.wishlist-heart {
  position: absolute; top: 8px; right: 8px; background: rgba(255,255,255,0.85); border: none; border-radius: 50%;
  width: 34px; height: 34px; font-size: 1.2rem; display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: var(--terracotta-btn); transition: transform .2s var(--spring), background .2s ease; z-index: 3;
}
.wishlist-heart.small { width: 28px; height: 28px; font-size: 1rem; }
.wishlist-heart:hover { transform: scale(1.15); background: white; }
.wishlist-heart.saved { color: #C9424B; }

/* search */
.search-modal-card { max-width: 480px; }
.search-modal-card input { width: 100%; padding: 12px 14px; border-radius: 10px; border: 1px solid var(--gold); font-family: inherit; font-size: 1rem; box-sizing: border-box; margin-top: 10px; }
.search-results { margin-top: 16px; max-height: 340px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
.search-result-row { display: flex; align-items: center; gap: 12px; background: none; border: none; text-align: left; padding: 10px 8px; border-radius: 10px; cursor: pointer; font-size: 0.95rem; color: var(--espresso); }
.search-result-row:hover { background: var(--steam); }
.search-result-type { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--terracotta-btn); background: var(--steam); padding: 3px 8px; border-radius: 10px; flex-shrink: 0; }

/* our services */
.services-hero {
  text-align: center; padding: 90px 24px 70px; color: var(--cream);
  background: linear-gradient(rgba(20,13,9,0.68), rgba(20,13,9,0.8)), url('https://images.unsplash.com/photo-1457414254764-c87b209f5249?auto=format&fit=crop&w=1600&q=65') center/cover;
}
.services-hero h1 { color: var(--ivory); font-size: clamp(2rem, 5vw, 2.8rem); margin: 8px 0 14px; text-shadow: 0 3px 14px rgba(0,0,0,0.4); }
.services-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; max-width: 1100px; margin: -50px auto 0; padding: 0 24px 60px; position: relative; z-index: 2; }
.service-card { background: white; border: 1px solid var(--gold); border-radius: 20px; padding: 32px; box-shadow: 0 12px 30px rgba(62,44,35,0.1); }
.service-icon { font-size: 2.4rem; }
.service-card h2 { font-size: 1.5rem; margin: 10px 0 4px; }
.service-tagline { font-size: 1.15rem; color: var(--terracotta-btn); margin-bottom: 14px; }
.service-description { color: #4a3a30; line-height: 1.65; margin-bottom: 16px; }
.service-bullets { padding-left: 20px; display: flex; flex-direction: column; gap: 8px; color: #4a3a30; margin-bottom: 20px; }
.service-fee { background: var(--steam); border-radius: 12px; padding: 14px 16px; }
.service-fee p:last-child { color: var(--espresso); font-weight: 600; margin: 2px 0 0; }

.service-process { background: var(--cream); padding: 50px 24px 60px; }
.process-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; max-width: 1100px; margin: 0 auto; }
.process-card { text-align: center; padding: 10px; }
.process-step { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; background: var(--terracotta-btn); color: var(--btn-cream); font-family: 'Cormorant Garamond', serif; font-size: 1.3rem; font-weight: 700; margin-bottom: 10px; }
.process-card h4 { margin-bottom: 6px; }
.process-card p { font-size: 0.88rem; color: #6b5647; }

.service-inquiry { background: var(--espresso); padding: 70px 24px; }
.service-inquiry-inner { max-width: 1000px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: start; }
@media (max-width: 760px) { .service-inquiry-inner { grid-template-columns: 1fr; } }
.service-inquiry h2 { color: var(--ivory); font-size: 2rem; }
.service-inquiry-form { background: var(--cream); border-radius: 18px; padding: 26px; }
.service-inquiry-form label { display: block; font-size: 0.8rem; font-weight: 700; margin: 12px 0 4px; color: var(--chestnut); }
.service-inquiry-form input, .service-inquiry-form select, .service-inquiry-form textarea { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--gold); font-family: inherit; box-sizing: border-box; }

/* disabled buttons, site-wide */
.btn-primary:disabled, .btn-outline:disabled {
  opacity: 0.5; cursor: not-allowed; transform: none !important; box-shadow: none !important;
}
.btn-primary:disabled:hover { background: var(--terracotta-btn); }
.btn-outline:disabled:hover { background: transparent; color: var(--terracotta-btn); }
.qty-row button:disabled { opacity: 0.35; cursor: not-allowed; }

/* stock badges — shop cards */
.sold-out-tag, .low-stock-tag {
  position: absolute; bottom: 8px; left: 8px; font-size: 0.68rem; font-weight: 700; padding: 4px 9px; border-radius: 20px; z-index: 3;
}
.sold-out-tag { background: rgba(20,13,9,0.85); color: var(--cream); }
.low-stock-tag { background: var(--terracotta-btn); color: var(--btn-cream); }
.sold-out-card { opacity: 0.72; }
.sold-out-card .everyday-photo { filter: grayscale(0.5); }

/* stock — product page */
.sold-out-photo { filter: grayscale(0.5); }
.sold-out-banner {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-8deg);
  background: rgba(20,13,9,0.88); color: var(--cream); font-family: 'Cormorant Garamond', serif;
  font-size: 1.6rem; font-weight: 700; padding: 8px 24px; border-radius: 8px; border: 2px solid var(--cream);
  letter-spacing: 0.05em; z-index: 4;
}
.stock-notice { font-size: 0.85rem; font-weight: 600; margin: 6px 0 14px; padding: 8px 12px; border-radius: 8px; }
.stock-notice.out { background: var(--steam); color: var(--espresso); }
.stock-notice.low { background: rgba(201,130,99,0.15); color: var(--terracotta-btn); }

/* admin: stock column + audit log */
.admin-table-products-stock .admin-row { grid-template-columns: 1fr 1fr 0.8fr 0.9fr 1fr 1.4fr; }
.stock-badge { font-size: 0.8rem; font-weight: 600; }
.stock-badge.low { color: var(--terracotta-btn); font-weight: 700; }
.stock-badge.out { color: #a33; font-weight: 700; }
.audit-row { grid-template-columns: 1.1fr 1.3fr 1.2fr 2fr; font-size: 0.85rem; }

/* live chat widget */
.care-option-btn { width: 100%; border: 1px solid var(--gold); background: white; font-family: inherit; cursor: pointer; text-align: left; }
.chat-online-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #4caf6b; margin-right: 5px; animation: pulse 1.8s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .chat-online-dot { animation: none; } }
.chat-panel { display: flex; flex-direction: column; height: 420px; max-height: 70vh; padding: 16px; }
.chat-start-form { display: flex; flex-direction: column; }
.chat-start-form label { display: block; font-size: 0.8rem; font-weight: 700; margin: 10px 0 4px; color: var(--chestnut); }
.chat-start-form input { width: 100%; padding: 9px 12px; border-radius: 8px; border: 1px solid var(--gold); font-family: inherit; box-sizing: border-box; }
.chat-messages { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding: 8px 2px; }
.chat-bubble { max-width: 82%; padding: 9px 13px; border-radius: 14px; font-size: 0.88rem; line-height: 1.4; }
.chat-bubble-agent { align-self: flex-start; background: var(--steam); color: var(--espresso); border-bottom-left-radius: 4px; }
.chat-bubble-user { align-self: flex-end; background: var(--terracotta-btn); color: var(--btn-cream); border-bottom-right-radius: 4px; }
.chat-typing { display: flex; gap: 4px; padding: 12px 14px; align-items: center; }
.chat-typing span { width: 6px; height: 6px; border-radius: 50%; background: var(--almond-text); animation: typingBounce 1.2s infinite; }
.chat-typing span:nth-child(2) { animation-delay: 0.15s; }
.chat-typing span:nth-child(3) { animation-delay: 0.3s; }
@keyframes typingBounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.5; } 30% { transform: translateY(-4px); opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .chat-typing span { animation: none; opacity: 0.8; } }
.chat-input-row { display: flex; gap: 8px; margin-top: 10px; }
.chat-input-row input { flex: 1; padding: 10px 12px; border-radius: 20px; border: 1px solid var(--gold); font-family: inherit; box-sizing: border-box; }
.chat-send-btn { padding: 8px 18px; border-radius: 20px; }
@media (max-width: 600px) { .chat-panel { height: 60vh; } }

/* admin: live chat transcripts */
.chat-transcript { margin-top: 10px; padding: 12px; background: var(--cream); border-radius: 10px; display: flex; flex-direction: column; gap: 6px; max-height: 260px; overflow-y: auto; }
.chat-transcript-line { font-size: 0.85rem; }
.chat-transcript-line.from-user strong { color: var(--terracotta-btn); }
.chat-transcript-line.from-agent strong { color: var(--chestnut); }

/* consent banner */
.consent-banner {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 90; background: var(--espresso); color: var(--steam);
  padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; gap: 20px;
  flex-wrap: wrap; box-shadow: 0 -4px 16px rgba(0,0,0,0.2);
}
.consent-banner p { margin: 0; font-size: 0.88rem; max-width: 640px; }
.consent-banner a { color: var(--gold); font-weight: 700; text-decoration: underline; }
.consent-actions { display: flex; gap: 10px; flex-shrink: 0; }
.btn-primary.small { padding: 8px 16px; font-size: 0.85rem; }
@media (max-width: 600px) { .consent-banner { flex-direction: column; align-items: stretch; text-align: center; } }

/* legal pages */
.legal-page { max-width: 760px; margin: 0 auto; padding: 50px 24px 90px; }
.legal-body h3 { margin: 26px 0 8px; font-size: 1.25rem; }
.legal-body p { color: #4a3a30; line-height: 1.7; margin: 0 0 4px; }
.legal-body code { background: var(--steam); padding: 2px 6px; border-radius: 4px; font-size: 0.85em; }
.legal-callout { background: var(--steam); border-radius: 14px; padding: 20px; margin-top: 30px; }
.legal-callout p { color: var(--espresso); }

/* footer legal row */
.footer-legal { max-width: 1200px; margin: 40px auto 0; padding-top: 20px; border-top: 1px solid rgba(232,213,181,0.15); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
.footer-legal .copyright { margin: 0; }
.footer-legal-links { display: flex; gap: 8px; font-size: 0.8rem; opacity: 0.85; }
.footer-legal-links a:hover { opacity: 1; text-decoration: underline; }

/* language switcher */
.lang-switcher { position: relative; }
.lang-panel {
  position: absolute; top: calc(100% + 10px); left: 0; background: var(--cream); border-radius: 14px;
  box-shadow: 0 12px 30px rgba(62,44,35,0.2); padding: 10px; width: 200px; max-width: calc(100vw - 24px); z-index: 70;
  display: flex; flex-direction: column; gap: 2px; animation: toastIn .2s ease; max-height: 70vh; overflow-y: auto;
}
.lang-option { display: flex; align-items: center; gap: 10px; background: none; border: none; text-align: left; padding: 9px 10px; border-radius: 8px; font-family: inherit; font-size: 0.9rem; cursor: pointer; color: var(--espresso); }
.lang-option:hover { background: var(--steam); }
.lang-option.active { background: var(--steam); font-weight: 700; }
.lang-option-code { margin-left: auto; font-size: 0.72rem; color: var(--almond-text); font-weight: 700; }
.lang-credit { font-size: 0.68rem; color: var(--almond-text); padding: 8px 10px 2px; margin: 0; border-top: 1px solid var(--gold); margin-top: 4px; }
.currency-btn { font-size: 0.78rem !important; font-weight: 700; letter-spacing: 0.02em; position: relative; }
.currency-loading-dot { position: absolute; top: 2px; right: 2px; width: 6px; height: 6px; border-radius: 50%; background: var(--terracotta-btn); animation: currency-pulse 1.2s ease-in-out infinite; }
@keyframes currency-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
@media (prefers-reduced-motion: reduce) { .currency-loading-dot { animation: none; } }

/* translate suggestion bar */
.translate-suggest-bar {
  background: var(--chestnut); color: var(--cream); padding: 10px 20px; font-size: 0.85rem;
  display: flex; align-items: center; justify-content: center; gap: 16px; flex-wrap: wrap; position: relative;
}
.translate-suggest-actions { display: flex; align-items: center; gap: 10px; }
.translate-suggest-close { background: none; border: none; color: var(--cream); font-size: 1.1rem; cursor: pointer; opacity: 0.8; line-height: 1; }
.translate-suggest-close:hover { opacity: 1; }

/* polished "Add to cart" button for product grid cards — replaces the plain outline pill */
.btn-cart {
  background: var(--terracotta-btn); color: var(--btn-cream); border: none; padding: 7px 14px 7px 12px;
  border-radius: 20px; font-weight: 700; font-size: 0.8rem; cursor: pointer; font-family: inherit;
  display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; flex-shrink: 0;
  box-shadow: 0 3px 10px rgba(139,90,58,0.28); transition: transform .15s var(--spring), box-shadow .15s ease, background .15s ease;
}
.btn-cart:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 7px 16px rgba(139,90,58,0.4); background: var(--espresso); }
.btn-cart:active:not(:disabled) { transform: translateY(0); }
.btn-cart:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }

/* text-left / photo-right story block — shared across Moments, Brew Guides, Growing, History */
.moment-story-row {
  display: flex; gap: 44px; align-items: center; max-width: 1100px; margin: 0 auto 40px;
  padding: 40px 24px; flex-wrap: wrap;
}
.moment-story-text { flex: 1 1 320px; min-width: 280px; }
.moment-story-text .moment-description { margin: 0; }
.moment-story-photo {
  flex: 1 1 340px; min-width: 280px; min-height: 320px; border-radius: 18px;
  background-size: cover; background-position: center; box-shadow: 0 14px 34px rgba(62,44,35,0.22);
}
@media (max-width: 700px) {
  .moment-story-row { flex-direction: column; padding: 28px 20px; }
  .moment-story-photo { width: 100%; min-height: 240px; order: -1; } /* photo shows first on mobile, reads naturally above the text it illustrates */
}
.moment-story-row-reverse { flex-direction: row-reverse; }

/* Moments hub / Brew Guides hub — clickable alternating list built on the story-row pattern above */
.moments-hub-list { display: flex; flex-direction: column; gap: 0; margin-top: 10px; }
.moments-hub-list .moment-story-row { border-bottom: 1px solid var(--gold); transition: opacity .2s ease; }
.moments-hub-list .moment-story-row:last-child { border-bottom: none; }
.moments-hub-list .moment-story-row:hover { opacity: 0.9; }
.moments-hub-list .moment-story-row:hover .moment-story-photo { transform: scale(1.02); }
.moments-hub-list .moment-story-photo { transition: transform .4s var(--spring); }
.moments-hub-list .guide-icon { font-size: 1.8rem; display: block; margin-bottom: 6px; }

/* Shop page — alternating premium origin showcase (real product packaging photography) */
.origin-showcase { display: flex; flex-direction: column; gap: 64px; padding: 10px 0 20px; }
.origin-row { display: flex; align-items: center; gap: 50px; flex-wrap: wrap; }
.origin-row-reverse { flex-direction: row-reverse; }
.origin-row-text { flex: 1 1 320px; min-width: 280px; }
.origin-row-text h3 { font-size: 1.7rem; margin-bottom: 4px; }
.origin-tasting-note { font-size: 1.25rem; color: var(--terracotta-btn); margin: 4px 0 14px; }
.origin-growing-note { color: #6b5647; font-size: 0.92rem; line-height: 1.65; margin: 0 0 20px; max-width: 440px; }
.origin-row-photo {
  flex: 1 1 260px; min-width: 200px; max-width: 320px; position: relative; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  background: var(--cream); border-radius: 22px; padding: 22px;
  box-shadow: 0 16px 34px rgba(62,44,35,0.18); transition: transform .4s var(--spring);
}
.origin-row-photo img { width: 100%; max-width: 260px; height: auto; display: block; border-radius: 10px; }
.origin-row-photo-wrap { width: 100%; max-width: 260px; }
.origin-row:hover .origin-row-photo { transform: translateY(-6px) scale(1.02); }
.origin-row.sold-out-card .origin-row-photo img { filter: grayscale(0.55); opacity: 0.7; }
@media (max-width: 760px) {
  .origin-row, .origin-row-reverse { flex-direction: column; }
  .origin-row-photo { max-width: 260px; order: -1; }
}

/* Green Coffee (wholesale) page */
.green-bean-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 22px; max-width: 1200px; margin: -50px auto 40px; padding: 0 24px; position: relative; z-index: 2; }
.green-bean-card { background: white; border: 2px solid transparent; border-radius: 18px; overflow: hidden; box-shadow: 0 12px 28px rgba(62,44,35,0.12); cursor: pointer; transition: border-color .2s ease, transform .2s ease; }
.green-bean-card:hover { transform: translateY(-3px); }
.green-bean-card.selected { border-color: var(--terracotta-btn); }
.green-bean-photo { height: 140px; background-size: cover; background-position: center; }
.green-bean-info { padding: 18px 20px 20px; }
.green-bean-stats { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 0.8rem; color: var(--almond-text); margin: 6px 0 10px; }
.green-bean-stats strong { color: var(--chestnut); }
.green-bean-price-row { display: flex; justify-content: space-between; align-items: baseline; margin-top: 12px; }
.green-bean-price { font-size: 1.25rem; font-weight: 700; color: var(--terracotta-btn); }
.green-bean-price .per-kg { font-size: 0.8rem; font-weight: 400; color: var(--almond-text); }
.green-bean-stock { font-size: 0.78rem; color: var(--green); font-weight: 600; }
.green-bean-stock.low { color: var(--terracotta-btn); }

/* new admin sections — Inventory, Invoices, Green Orders */
.admin-subhead { font-family: 'Cormorant Garamond', serif; font-size: 1.25rem; color: var(--chestnut); margin: 28px 0 10px; }
.admin-subhead:first-of-type { margin-top: 16px; }
.admin-stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; margin: 14px 0 24px; }
.admin-stat-card { background: linear-gradient(160deg, white 0%, var(--cream) 100%); border: 1px solid var(--gold); border-top: 3px solid var(--green); border-radius: 12px; padding: 16px 18px; box-shadow: 0 6px 18px rgba(62,44,35,0.08); }
.admin-stat-alert { border-color: var(--terracotta-btn); background: #fdf0ea; }
.admin-stat-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--almond-text); margin: 0 0 6px; }
.admin-stat-value { font-size: 1.5rem; font-weight: 700; color: var(--chestnut); margin: 0; }
.admin-table-inventory .admin-row { grid-template-columns: 1.4fr 1fr 1fr 1fr; }
.admin-table-invoices .admin-row { grid-template-columns: 0.8fr 1.4fr 0.8fr 0.8fr 1fr; }
.admin-table-invoices-service .admin-row { grid-template-columns: 1.2fr 1.4fr 0.8fr 0.8fr 1fr; }
.admin-table-invoices-service .admin-price-input { width: 80px; }
.admin-inline-edit { display: flex; align-items: center; gap: 8px; }
.inv-status { font-size: 0.78rem; font-weight: 700; padding: 3px 10px; border-radius: 20px; display: inline-block; width: fit-content; }
.inv-status.ok { background: #e8f0e0; color: var(--green); }
.inv-status.low { background: #fdf0ea; color: var(--terracotta-btn); }
.inv-status.out { background: #f5e0e0; color: #a8433f; }
.admin-badge-sold-out { background: #f5e0e0; color: #a8433f; margin-left: 6px; }
.footer-social { display: flex; gap: 16px; margin-top: 10px; }
.footer-social a { font-size: 0.85rem; text-decoration: underline; opacity: 0.85; }
.footer-social a:hover { opacity: 1; }
.admin-table-toolbar { display: flex; gap: 10px; align-items: center; margin: 10px 0 14px; flex-wrap: wrap; }
.admin-search-input { flex: 1 1 240px; min-width: 180px; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--gold); font-family: inherit; font-size: 16px; }
.admin-add-form { background: white; border: 1px solid var(--gold); border-radius: 14px; padding: 20px 22px; margin-bottom: 20px; }
.admin-form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px 18px; }
.admin-form-grid input, .admin-form-grid select { width: 100%; box-sizing: border-box; }
.admin-tag-checks { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.admin-tag-checks .chip { cursor: pointer; user-select: none; }

/* login modal — coffee-themed two-column layout */
.login-card { display: flex; max-width: 720px; width: 100%; border-radius: 20px; overflow: hidden; box-shadow: 0 30px 70px rgba(20,13,9,0.35); }
.login-photo-panel {
  flex: 0 0 42%; min-height: 480px; position: relative;
  background-image: linear-gradient(180deg, rgba(20,13,9,0.15) 0%, rgba(20,13,9,0.75) 100%), url('/photos/moment-comfort.jpg');
  background-size: cover; background-position: center;
  display: flex; align-items: flex-end; padding: 32px 26px;
}
.login-quote { color: var(--ivory); font-size: 1.4rem; line-height: 1.3; text-shadow: 0 2px 10px rgba(0,0,0,0.5); margin: 0; }
.login-form-panel { flex: 1 1 auto; background: var(--cream); padding: 34px 32px; position: relative; min-width: 0; overflow-y: auto; }
@media (max-width: 640px) {
  .login-card { flex-direction: column; max-width: 420px; }
  .login-photo-panel { flex: 0 0 140px; min-height: 140px; padding: 16px 20px; }
  .login-quote { font-size: 1.05rem; }
}

/* public product reviews (Reviews tab on the Product page) */
.bean-shape.small { width: 14px; height: 18px; }
.reviews-summary { display: flex; align-items: center; gap: 14px; margin-bottom: 22px; }
.reviews-summary-beans { display: flex; gap: 4px; }
.reviews-summary p { margin: 0; font-weight: 700; color: var(--chestnut); }
.reviews-list { display: flex; flex-direction: column; gap: 16px; }
.review-card { background: white; border: 1px solid var(--gold); border-radius: 12px; padding: 16px 18px; }
.review-card-beans { display: flex; align-items: center; gap: 4px; margin-bottom: 8px; }
.review-card-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.review-card-note { margin: 0; font-style: italic; color: var(--espresso); line-height: 1.5; }
.admin-photo-upload-row { display: flex; align-items: flex-start; gap: 14px; }
.admin-photo-preview { width: 70px; height: 70px; object-fit: cover; border-radius: 10px; border: 1px solid var(--gold); flex-shrink: 0; background: white; }
.admin-photo-label { cursor: pointer; }
.role-badge.staff { background: var(--green); color: var(--cream); }
.admin-permissions-row { background: var(--steam); border-radius: 10px; padding: 14px 16px; margin: -2px 0 6px; }
.admin-pager { display: flex; align-items: center; justify-content: center; gap: 16px; padding: 16px 0 4px; }
.admin-sortable { cursor: pointer; user-select: none; }
.admin-sortable:hover { color: var(--chestnut); }

/* search: quick-search modal's "view all" link, and the dedicated results page */
.search-view-all { display: block; width: 100%; text-align: center; background: var(--steam); border: none; padding: 12px; border-radius: 10px; margin-top: 8px; font-weight: 700; color: var(--terracotta-btn); cursor: pointer; }
.search-view-all:hover { background: var(--gold); }
.search-page-box { max-width: 480px; margin: 0 auto; }
.search-page-box input { width: 100%; box-sizing: border-box; padding: 14px 18px; border-radius: 30px; border: 1px solid var(--gold); font-size: 1rem; font-family: inherit; }
.search-results-page { max-width: 900px; margin: 0 auto; padding: 0 24px 60px; }
.search-results-group { margin-bottom: 32px; }
.search-results-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.search-result-card { background: white; border: 1px solid var(--gold); border-radius: 12px; padding: 16px 18px; text-align: left; cursor: pointer; font-size: 0.95rem; color: var(--espresso); font-family: inherit; transition: transform .15s, box-shadow .15s; }
.search-result-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(62,44,35,0.12); border-color: var(--terracotta-btn); }

/* ImgWithSkeleton — shimmer placeholder shown until a real <img> has actually decoded */
.img-skeleton-wrap { position: relative; display: block; }
.img-skeleton-shimmer {
  position: absolute; inset: 0; border-radius: inherit;
  background: linear-gradient(100deg, var(--steam) 30%, var(--gold) 50%, var(--steam) 70%);
  background-size: 200% 100%; animation: img-shimmer 1.4s ease-in-out infinite;
}
@keyframes img-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { .img-skeleton-shimmer { animation: none; } }
.img-loading { opacity: 0; }
.img-loaded { opacity: 1; transition: opacity .35s ease; }

/* Login form fields — .modal-card's label/input rules stopped applying here once the login modal
   moved to its own .login-card/.login-form-panel wrapper (Search and Feedback still use
   .modal-card directly, so those were unaffected). Restyled rather than just patched: block
   labels and full-width inputs fix the actual bug, everything else is the requested premium pass. */
.login-form-panel label { display: block; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; margin: 18px 0 7px; color: var(--almond-text); }
.login-form-panel label:first-of-type { margin-top: 2px; }
.login-form-panel input {
  width: 100%; padding: 13px 14px; border-radius: 10px; border: 1.5px solid var(--gold);
  font-family: inherit; font-size: 16px; box-sizing: border-box; background: white; color: var(--espresso);
  transition: border-color .15s ease, box-shadow .15s ease;
}
.login-form-panel input:focus { outline: none; border-color: var(--chestnut); box-shadow: 0 0 0 4px rgba(139,90,58,0.14); }
.login-form-panel input::placeholder { color: var(--almond); }
.login-input-group { position: relative; }
.login-input-group input { padding-left: 40px; }
.login-input-icon { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); font-size: 0.92rem; opacity: 0.55; pointer-events: none; }

/* Visually hides an element while keeping it in the tab order and the accessibility tree —
   unlike display:none, which removes a form control from both. Used to hide the raw <input
   type="checkbox"> inside a chip-styled <label> that visually represents the checked state,
   without losing keyboard and screen-reader access to the actual control. */
.visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
.chip:focus-within { outline: 2px solid var(--chestnut); outline-offset: 2px; }
.admin-chunk-loading { min-height: 60vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; color: var(--chestnut); }
.admin-chunk-loading .bean-shape { animation: pulse 1.2s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .admin-chunk-loading .bean-shape { animation: none; } }

.share-buttons { display: flex; align-items: center; gap: 8px; margin-top: 18px; flex-wrap: wrap; }
.share-buttons-label { font-size: 0.78rem; font-weight: 700; color: inherit; opacity: 0.75; margin-right: 2px; }
.share-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
  background: var(--cream); color: var(--chestnut); border: 1px solid var(--gold);
  font-size: 0.85rem; font-weight: 700; text-decoration: none;
  transition: transform .15s ease, box-shadow .15s ease;
}
.share-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 10px rgba(62,44,35,0.25); }

.analytics-bar-chart { display: flex; align-items: flex-end; gap: 6px; height: 140px; padding: 10px 4px 0; overflow-x: auto; margin-bottom: 24px; }
.analytics-bar-col { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; min-width: 28px; flex: 1; }
.analytics-bar { width: 100%; max-width: 24px; background: linear-gradient(180deg, var(--terracotta-btn), var(--chestnut)); border-radius: 4px 4px 0 0; transition: opacity .15s ease; cursor: default; }
.analytics-bar:hover { opacity: 0.8; }
.analytics-bar.green { background: linear-gradient(180deg, var(--green), #4d5a38); }
.analytics-bar-label { font-size: 0.65rem; color: var(--almond-text); margin-top: 6px; white-space: nowrap; }
.admin-backup-actions { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-top: 4px; }
.nav-session-check { display: inline-block; width: 84px; height: 39px; }
`;
