import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { useAdmin, useAuth, useCart, useCurrency, useRoute, useToast, useWishlist, pathFor } from "../context";
import { CHAT_CANNED_RESPONSES, COUNTRY_JOURNEY_PHOTO, COUNTRY_TO_LANGUAGE, CURRENCIES, DESCRIPTOR_TAGS, MARQUEE_IMAGES, TRANSLATE_LANGUAGES } from "../data";
import { useClickOutside, useEscapeKey, useFocusTrap, useGeoLocale, useGoogleTranslate } from "../hooks";
import { getProductPhotoUrl, getStorageConsent, lerpColor, searchSite, setStorageConsent } from "../utils/helpers";
import { api } from "../utils/api";

export function Steam({ className = "" }) {
  return (
    <span className={`steam-wrap ${className}`} aria-hidden="true">
      <span className="steam s1" />
      <span className="steam s2" />
      <span className="steam s3" />
    </span>
  );
}

// Share buttons built on each platform's public share-intent URLs, not their real posting APIs --
// those need OAuth and a server-side secret key, which a client-only site can't hold safely. This
// opens a new tab with the message already filled in; the person still reviews and clicks "Post"
// themselves on the platform's own page. `path` is resolved against the current origin so this
// works correctly regardless of what domain the site is actually deployed to, rather than a
// hardcoded domain the way the static OG tags in index.html have to be.
export function ShareButtons({ path, text, label = "Share" }) {
  const url = `${window.location.origin}${path || window.location.pathname}`;
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(text);
  const links = [
    { name: "X", icon: "𝕏", href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}` },
    // Facebook's sharer only takes a URL, not custom text -- it pulls the title/description/image
    // straight from that page's Open Graph tags for the preview.
    { name: "Facebook", icon: "f", href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
    { name: "WhatsApp", icon: "📱", href: `https://wa.me/?text=${encodedText}%20${encodedUrl}` },
    { name: "LinkedIn", icon: "in", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}` },
  ];
  return (
    <div className="share-buttons">
      <span className="share-buttons-label">{label}</span>
      {links.map((l) => (
        <a key={l.name} href={l.href} target="_blank" rel="noopener noreferrer" className="share-btn" aria-label={`Share on ${l.name}`} title={`Share on ${l.name}`}>
          {l.icon}
        </a>
      ))}
    </div>
  );
}

// A thin wrapper around <img> that shows an animated shimmer placeholder until the image has
// actually decoded, then fades it in — for real <img> elements only (most photo displays on the
// site use a CSS background-image on a div instead, where this onLoad-based approach doesn't
// apply cleanly; those already fall back to a static gradient, which is the right treatment for
// them since it also doubles as the legitimate "no photo" state for custom products, not just a
// loading state).
export function ImgWithSkeleton({ src, alt, className = "", wrapClassName = "", ...rest }) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setLoaded(false); }, [src]);
  return (
    <span className={`img-skeleton-wrap ${wrapClassName}`}>
      {!loaded && <span className="img-skeleton-shimmer" aria-hidden="true" />}
      <img
        src={src}
        alt={alt}
        className={`${className} ${loaded ? "img-loaded" : "img-loading"}`}
        onLoad={() => setLoaded(true)}
        {...rest}
      />
    </span>
  );
}

export function Glass({ children, className = "", dark = false }) {
  return (
    <div className={`glass ${dark ? "glass-dark" : ""} ${className}`}>{children}</div>
  );
}

// A simplified, self-drawn rendition of the four-color Google "G" mark — not a traced copy of
// Google's specific logo artwork, just the same widely-recognized brand colors in a simple
// circular-segment shape, which is the standard way third-party "Sign in with Google" buttons
// signal what they are.
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.87 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.95v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.05l3.02-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

// Real, not a placeholder -- the frontend counterpart to server/src/routes/auth.js's own
// GOOGLE_CLIENT_ID check. This one specifically must be the *same* Client ID as the backend's, or
// verifyIdToken there would correctly reject every token this button produces as issued for the
// wrong app.
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
if (!GOOGLE_CLIENT_ID && import.meta.env.PROD) {
  // Same pattern as VITE_API_URL (utils/api.js) and VITE_PAYSTACK_PUBLIC_KEY (pages/Checkout.jsx)
  // -- fails loudly rather than a Google button that silently never renders, with no clue why.
  console.error("VITE_GOOGLE_CLIENT_ID is not set — Google sign-in cannot be shown. Set it in the frontend service's environment variables.");
}

// Loads Google's real Identity Services script on demand -- same pattern as loadPaystackScript in
// pages/Checkout.jsx: only loaded once (checks whether it's already present first), only when the
// sign-in modal actually needs it, not on every page load site-wide.
function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Couldn't load Google Sign-In. Check your connection and try again."));
    document.body.appendChild(script);
  });
}

// Renders Google's own real Sign-In button (not a custom-styled lookalike) via Identity Services
// -- the officially recommended approach, more reliable than trying to trigger Google's flow from
// an arbitrary custom button. `onCredential` receives the real ID token once someone actually
// completes sign-in; server/src/routes/auth.js's /auth/google is what verifies it's genuine.
function GoogleSignInButton({ active, onCredential }) {
  const containerRef = useRef(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!active || !GOOGLE_CLIENT_ID) return;
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => onCredential(response.credential),
        });
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: "outline", size: "large", width: 320, text: "continue_with",
        });
      })
      .catch((e) => { if (!cancelled) setLoadError(e.message); });
    return () => { cancelled = true; };
  }, [active]);

  if (!GOOGLE_CLIENT_ID) return null; // not configured at all -- nothing to show rather than a broken button
  if (loadError) return <p className="form-error">{loadError}</p>;
  return <div ref={containerRef} style={{ display: "flex", justifyContent: "center" }} />;
}

export function LoginModal({ open, onClose }) {
  const { login, register, requestOtpLogin, verifyOtpLogin, loginWithGoogle, error, setError, verifyTwoFactorLogin, cancelTwoFactorLogin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  // Password mode is real now (backed by the actual deployed backend — see ROADMAP.md) and is
  // genuinely the most reliable path, so it's the default again. OTP is still demo-only pending
  // real email delivery to send the code.
  const [mode, setMode] = useState("password"); // password | otp
  const [authIntent, setAuthIntent] = useState("signin"); // signin | signup — only meaningful in password mode
  const [submitting, setSubmitting] = useState(false);
  const [twoFAStep, setTwoFAStep] = useState(false);
  // Separate from the OTP-simulation state below (enteredCode etc.) -- this is a real code from an
  // authenticator app the person already has, or one of their real backup codes, checked against
  // the actual backend, not a code this app generated and is showing back to them.
  const [twoFACode, setTwoFACode] = useState("");
  const [twoFASubmitting, setTwoFASubmitting] = useState(false);
  const [twoFAError, setTwoFAError] = useState("");

  // Forgot-password flow: null (not active) -> true (real request sent, entering the code)
  const [resetStep, setResetStep] = useState(null);
  const [resetToken, setResetToken] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetDone, setResetDone] = useState(false);

  // OTP state -- real now: otpSent means a real request succeeded (a real email is genuinely on
  // its way), enteredCode is what's being typed, otpError surfaces the backend's real error
  // messages (wrong code, expired, locked out after 3 attempts -- all enforced server-side now,
  // not simulated in state that meant nothing on its own).
  const [otpSent, setOtpSent] = useState(false);
  const [enteredCode, setEnteredCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpSubmitting, setOtpSubmitting] = useState(false);

  const modalRef = useRef(null);
  useEscapeKey(open, onClose);
  useFocusTrap(modalRef, open);

  if (!open) return null;

  const resetOtp = () => {
    setOtpSent(false);
    setEnteredCode("");
    setOtpError("");
  };

  const requestOtpCode = async () => {
    setOtpSubmitting(true);
    setOtpError("");
    const result = await requestOtpLogin(email);
    setOtpSubmitting(false);
    if (result.ok) {
      setOtpSent(true);
      setEnteredCode("");
    } else {
      setOtpError(result.error || "Couldn't send a code. Try again.");
    }
  };

  const verifyOtpCode = async () => {
    setOtpSubmitting(true);
    setOtpError("");
    const result = await verifyOtpLogin(email, enteredCode);
    setOtpSubmitting(false);
    if (result.ok && result.requiresTwoFactor) {
      resetOtp();
      setTwoFAStep(true);
    } else if (result.ok) {
      onClose();
      resetOtp();
    } else {
      setOtpError(result.error || "Incorrect code.");
    }
  };

  // Real 2FA verification -- a live code from the account's authenticator app (or a backup code),
  // checked against the actual backend. Deliberately separate from verifyCode above, which is
  // purely the "email code (preview)" simulation's own local comparison against a code this app
  // generated itself; real 2FA has nothing to compare locally against at all.
  const submitTwoFACode = async () => {
    setTwoFASubmitting(true);
    setTwoFAError("");
    const result = await verifyTwoFactorLogin(twoFACode);
    setTwoFASubmitting(false);
    if (result.ok) {
      onClose();
      setTwoFAStep(false);
      setTwoFACode("");
    } else {
      setTwoFAError(result.error || "Incorrect code.");
    }
  };

  const cancelTwoFAStep = () => {
    cancelTwoFactorLogin();
    setTwoFAStep(false);
    setTwoFACode("");
    setTwoFAError("");
    setPassword("");
  };

  const startResetFlow = async () => {
    if (!email) {
      setError("Enter your email above first, then click \"Forgot password?\"");
      return;
    }
    setError("");
    setResetError("");
    setResetDone(false);
    setResetStep(true);
    // Always the same generic response whether or not the email has an account -- the backend
    // itself never reveals which (see server/src/routes/auth.js) -- so there's nothing to branch
    // on here regardless of outcome.
    await api.requestPasswordReset(email).catch(() => {});
  };
  const cancelResetFlow = () => {
    setResetStep(null);
    setResetToken("");
    setNewPassword("");
    setConfirmPassword("");
    setResetError("");
  };
  const submitNewPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setResetError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError("Passwords don't match.");
      return;
    }
    setResetError("");
    setResetSubmitting(true);
    try {
      await api.confirmPasswordReset(resetToken.trim(), newPassword);
      setResetDone(true);
      setPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setResetToken("");
    } catch (err) {
      setResetError(err.message);
    } finally {
      setResetSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Sign in to Morning Aroma" onClick={twoFAStep ? cancelTwoFAStep : resetStep ? cancelResetFlow : onClose}>
      <div className="login-card" ref={modalRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="login-photo-panel">
          <p className="handwritten login-quote">"Every cup begins as a story —"</p>
        </div>
        <div className="login-form-panel">
        <button className="modal-close" onClick={twoFAStep ? cancelTwoFAStep : resetStep ? cancelResetFlow : onClose} aria-label="Close">×</button>

        {resetStep ? (
          <>
            <p className="eyebrow">reset your password</p>
            <h3 className="modal-title">Enter your reset code</h3>
            {resetDone ? (
              <>
                <p className="form-success">Your password has been reset. Sign in with your new password below.</p>
                <button className="btn-primary full" onClick={cancelResetFlow}>Back to sign in</button>
              </>
            ) : (
              <>
                <p className="hint" style={{ marginTop: 0 }}>We've started a real password reset for <strong>{email}</strong>, if that email has an account.</p>
                <p className="form-error">Automatic email delivery isn't connected yet, so nothing will arrive on its own — contact us directly and we'll send you the reset code another way for now.</p>
                <form onSubmit={submitNewPassword}>
                  <label htmlFor="reset-token">Reset code</label>
                  <input id="reset-token" value={resetToken} onChange={(e) => setResetToken(e.target.value)} autoComplete="off" maxLength={128} required />
                  <label htmlFor="reset-new-password">New password</label>
                  <input id="reset-new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" minLength={8} maxLength={128} required />
                  <label htmlFor="reset-confirm-password">Confirm new password</label>
                  <input id="reset-confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" maxLength={128} required />
                  {resetError && <p className="form-error">{resetError}</p>}
                  <button className="btn-primary full" type="submit" disabled={resetSubmitting}>{resetSubmitting ? "Setting password…" : "Set new password"}</button>
                </form>
              </>
            )}
            <button className="link-btn" style={{ marginTop: 10, display: "block" }} onClick={cancelResetFlow}>← Back to sign in</button>
          </>
        ) : twoFAStep ? (
          <>
            <p className="eyebrow">two-factor authentication</p>
            <h3 className="modal-title">Verify it's you</h3>
            <p className="hint" style={{ marginTop: 0 }}>
              Enter the 6-digit code from your authenticator app, or one of your backup codes if you don't have access to it.
            </p>
            <label htmlFor="twofa-code">Code</label>
            <input
              id="twofa-code"
              value={twoFACode}
              onChange={(e) => { setTwoFACode(e.target.value); setTwoFAError(""); }}
              placeholder="000000"
              inputMode="text"
              autoComplete="one-time-code"
              maxLength={11}
              autoFocus
            />
            {twoFAError && <p className="form-error">{twoFAError}</p>}
            <button className="btn-primary full" onClick={submitTwoFACode} disabled={!twoFACode.trim() || twoFASubmitting}>
              {twoFASubmitting ? "Verifying…" : "Verify & sign in"}
            </button>
            <button className="link-btn" style={{ marginTop: 10, display: "block" }} onClick={cancelTwoFAStep}>← Use a different account</button>
          </>
        ) : (
          <>
            <Steam className="login-steam" />
            <p className="eyebrow login-eyebrow">Welcome back</p>
            <h3 className="modal-title">Step into the aroma</h3>

            <div className="mode-toggle">
              <button className={mode === "password" ? "active" : ""} onClick={() => { setMode("password"); setError(""); }}>
                <span className="mode-toggle-icon" aria-hidden="true">🔑</span> Email &amp; password
              </button>
              <button className={mode === "otp" ? "active" : ""} onClick={() => { setMode("otp"); resetOtp(); }}>
                <span className="mode-toggle-icon" aria-hidden="true">✉️</span> Email code
              </button>
            </div>

            {mode === "password" ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setSubmitting(true);
                  const result = authIntent === "signup" ? await register(email, password, name) : await login(email, password);
                  setSubmitting(false);
                  if (result.ok && result.requiresTwoFactor) {
                    setTwoFAStep(true);
                  } else if (result.ok) {
                    onClose();
                  }
                }}
              >
                <div className="mode-toggle" style={{ marginBottom: 18 }}>
                  <button type="button" className={authIntent === "signin" ? "active" : ""} onClick={() => { setAuthIntent("signin"); setError(""); }}>Sign in</button>
                  <button type="button" className={authIntent === "signup" ? "active" : ""} onClick={() => { setAuthIntent("signup"); setError(""); }}>Create account</button>
                </div>
                {authIntent === "signup" && (
                  <>
                    <label htmlFor="login-name">Name</label>
                    <div className="login-input-group">
                      <span className="login-input-icon" aria-hidden="true">🙂</span>
                      <input id="login-name" value={name} onChange={(e) => setName(e.target.value)} type="text" placeholder="Your name" autoComplete="name" maxLength={100} required />
                    </div>
                  </>
                )}
                <label htmlFor="login-email-pw">Email</label>
                <div className="login-input-group">
                  <span className="login-input-icon" aria-hidden="true">✉️</span>
                  <input id="login-email-pw" value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" autoComplete="username" maxLength={254} required />
                </div>
                <label htmlFor="login-password">Password</label>
                <div className="login-input-group">
                  <span className="login-input-icon" aria-hidden="true">🔒</span>
                  <input
                    id="login-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    placeholder={authIntent === "signup" ? "At least 8 characters" : "••••••••"}
                    autoComplete={authIntent === "signup" ? "new-password" : "current-password"}
                    minLength={authIntent === "signup" ? 8 : undefined}
                    maxLength={128}
                    required
                  />
                </div>
                {error && <p className="form-error">{error}</p>}
                <button type="submit" className="btn-primary full" disabled={submitting}>
                  {submitting ? "Please wait…" : authIntent === "signup" ? "Create account" : "Sign in"}
                </button>
                {authIntent === "signin" && (
                  <button type="button" className="link-btn" style={{ marginTop: 8, marginLeft: 0, display: "block" }} onClick={startResetFlow}>Forgot password?</button>
                )}
                {authIntent === "signup" && (
                  <p className="hint">First account on a fresh deployment becomes admin automatically — see ROADMAP.md.</p>
                )}
              </form>
            ) : (
              <div>
                <label htmlFor="login-email-otp">Email</label>
                <input id="login-email-otp" value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" autoComplete="username" maxLength={254} disabled={otpSent} />
                {!otpSent && <p className="hint" style={{ marginTop: -4 }}>We'll email you a 6-digit code — no password needed. If that email doesn't have an account yet, one is created automatically.</p>}
                {!otpSent ? (
                  <button className="btn-primary full" onClick={requestOtpCode} disabled={!email || otpSubmitting}>
                    {otpSubmitting ? "Sending…" : "Send me a code"}
                  </button>
                ) : (
                  <>
                    <p className="hint">Check <strong>{email}</strong> for a 6-digit code — it's valid for 10 minutes.</p>
                    <label htmlFor="login-otp-code">6-digit code</label>
                    <input
                      id="login-otp-code"
                      value={enteredCode}
                      onChange={(e) => { setEnteredCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setOtpError(""); }}
                      placeholder="000000"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      autoFocus
                    />
                    {otpError && <p className="form-error">{otpError}</p>}
                    <button className="btn-primary full" onClick={verifyOtpCode} disabled={enteredCode.length !== 6 || otpSubmitting}>
                      {otpSubmitting ? "Verifying…" : "Verify & sign in"}
                    </button>
                    <button className="link-btn" style={{ marginTop: 10 }} onClick={requestOtpCode} disabled={otpSubmitting}>Resend code</button>
                  </>
                )}
              </div>
            )}

            <div className="divider"><span>or</span></div>
            <GoogleSignInButton
              active={open}
              onCredential={async (idToken) => {
                const result = await loginWithGoogle(idToken);
                if (result.ok && result.requiresTwoFactor) {
                  setTwoFAStep(true);
                } else if (result.ok) {
                  onClose();
                }
              }}
            />
            {error && <p className="form-error" style={{ marginTop: 8 }}>{error}</p>}
          </>
        )}
        </div>
      </div>
    </div>
  );
}

export function SearchModal({ open, onClose }) {
  const { go } = useRoute();
  const { getAllProducts } = useAdmin();
  const [query, setQuery] = useState("");
  const modalRef = useRef(null);
  useEscapeKey(open, onClose);
  useFocusTrap(modalRef, open);
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);
  if (!open) return null;

  const q = query.trim();
  const results = searchSite(query, getAllProducts());

  const goToResult = (r) => { go(r.page, r.params); onClose(); };
  const viewAllResults = () => { go("searchresults", { id: q }); onClose(); };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Search Morning Aroma" onClick={onClose}>
      <div className="modal-card search-modal-card" ref={modalRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <p className="eyebrow">find it fast</p>
        <h3 className="modal-title">Search</h3>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && q.length > 0) viewAllResults(); }}
          placeholder="A variety, a country, a brew method…"
          maxLength={60}
          aria-label="Search query"
        />
        <div className="search-results">
          {q.length === 0 ? (
            <p className="hint">Try "Kenya", "espresso", or "chocolate".</p>
          ) : results.length === 0 ? (
            <p className="hint">Nothing matched "{query}" — try a different word.</p>
          ) : (
            <>
              {results.slice(0, 8).map((r, i) => (
                <button key={i} className="search-result-row" onClick={() => goToResult(r)}>
                  <span className="search-result-type">{r.type}</span>
                  <span>{r.label}</span>
                </button>
              ))}
              {results.length > 0 && (
                <button className="search-view-all" onClick={viewAllResults}>
                  View all {results.length} result{results.length === 1 ? "" : "s"} →
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function AnnouncementBar() {
  const { settings } = useAdmin();
  const [dismissed, setDismissed] = useState(false);
  if (!settings.announcementEnabled || !settings.announcementText || dismissed) return null;
  return (
    <div className="announcement-bar">
      <span>{settings.announcementText}</span>
      <button className="announcement-close" onClick={() => setDismissed(true)} aria-label="Dismiss">×</button>
    </div>
  );
}

export function ConsentBanner() {
  const { go } = useRoute();
  const [choice, setChoice] = useState(() => getStorageConsent());
  if (choice) return null;
  const decide = (value) => {
    setStorageConsent(value);
    setChoice(value);
  };
  return (
    <div className="consent-banner" role="dialog" aria-label="Local storage preferences">
      <p>
        We use your browser's local storage to remember your cart and wishlist between visits —
        nothing is sent to us or any third party. No tracking cookies, no analytics.{" "}
        <a href={pathFor("privacy")} onClick={(e) => { e.preventDefault(); go("privacy"); }}>Read more</a>
      </p>
      <div className="consent-actions">
        <button className="btn-outline small" onClick={() => decide("declined")}>Decline</button>
        <button className="btn-primary small" onClick={() => decide("accepted")}>Accept</button>
      </div>
    </div>
  );
}

export function CurrencySwitcher({ open, onToggle, onClose }) {
  const { currency, chooseCurrency, ratesLoading } = useCurrency();
  const { addToast } = useToast();
  const ref = useRef(null);
  useEscapeKey(open, onClose);
  useClickOutside(ref, open, onClose);

  const select = (c) => {
    onClose();
    chooseCurrency(c.code);
    addToast(`Prices now shown in ${c.code}`);
  };

  return (
    <div className="lang-switcher notranslate" ref={ref}>
      <button className="cart-btn currency-btn" onClick={onToggle} aria-label={ratesLoading ? "Change currency (fetching live rates…)" : "Change currency"} aria-expanded={open}>
        {currency}
        {ratesLoading && <span className="currency-loading-dot" aria-hidden="true" />}
      </button>
      {open && (
        <div className="lang-panel notranslate" role="menu" aria-label="Choose a currency">
          {CURRENCIES.map((c) => (
            <button key={c.code} className={`lang-option ${c.code === currency ? "active" : ""}`} role="menuitem" onClick={() => select(c)}>
              <span aria-hidden="true">{c.flag}</span> {c.label} <span className="lang-option-code">{c.code}</span>
            </button>
          ))}
          <p className="lang-credit">{ratesLoading ? "Fetching live rates…" : "Live rates — approximate, updated periodically."}</p>
        </div>
      )}
    </div>
  );
}

export function LanguageSwitcher({ open, onToggle, onClose }) {
  const { changeLanguage } = useGoogleTranslate();
  const { addToast } = useToast();
  const ref = useRef(null);
  useEscapeKey(open, onClose);
  useClickOutside(ref, open, onClose);

  const select = (lang) => {
    onClose();
    changeLanguage(lang.code);
    addToast(lang.code === "en" ? "Showing original (English)" : `Translating to ${lang.label}…`);
  };

  return (
    <div className="lang-switcher" ref={ref}>
      <button className="cart-btn" onClick={onToggle} aria-label="Change language" aria-expanded={open}>
        🌐
      </button>
      {open && (
        <div className="lang-panel notranslate" role="menu" aria-label="Choose a language">
          {TRANSLATE_LANGUAGES.map((l) => (
            <button key={l.code} className="lang-option" role="menuitem" onClick={() => select(l)}>
              <span aria-hidden="true">{l.flag}</span> {l.label}
            </button>
          ))}
          <p className="lang-credit">Powered by Google Translate — machine translation, may not be perfect.</p>
        </div>
      )}
    </div>
  );
}

export function TranslateSuggestBanner() {
  const { suggestedLang, countryName } = useGeoLocale(COUNTRY_TO_LANGUAGE);
  const { changeLanguage } = useGoogleTranslate();
  const [dismissed, setDismissed] = useState(false);
  const langInfo = TRANSLATE_LANGUAGES.find((l) => l.code === suggestedLang);

  if (dismissed || !langInfo) return null;

  return (
    <div className="translate-suggest-bar notranslate">
      <span>
        {countryName ? `Browsing from ${countryName}? ` : "Prefer a different language? "}
        View this site in {langInfo.flag} {langInfo.label}?
      </span>
      <div className="translate-suggest-actions">
        <button
          className="btn-outline light small"
          onClick={() => { changeLanguage(suggestedLang); setDismissed(true); }}
        >
          Translate
        </button>
        <button className="translate-suggest-close" onClick={() => setDismissed(true)} aria-label="Dismiss">×</button>
      </div>
    </div>
  );
}

export function Nav({ onOpenLogin, onOpenSearch }) {
  const { user, logout, sessionLoading } = useAuth();
  const { go } = useRoute();
  const { count, setOpen: setCartOpen } = useCart();
  const { count: wishlistCount, setOpen: setWishlistOpen } = useWishlist();
  const [open, setOpen] = useState(false);
  // Coordinates the currency and language dropdowns so opening one closes the other, rather than
  // each managing an independent open/closed boolean with no awareness of its sibling.
  const [openDropdown, setOpenDropdown] = useState(null); // null | "currency" | "language"
  const links = [
    { label: "Shop", page: "shop" },
    { label: "Moments", page: "moments" },
    { label: "Brew Guides", page: "brewguides" },
    { label: "Academy", page: "academy" },
    { label: "Growing", page: "growing" },
    { label: "World Journey", page: "worldjourney" },
    { label: "Our Services", page: "services" },
    { label: "Green Coffee", page: "greenbeans" },
    { label: "History", page: "history" },
    { label: "Our Promise", page: "promise" },
  ];
  return (
    <header className="nav">
      <div className="nav-inner">
        <div className="brand" onClick={() => go("home")} style={{ cursor: "pointer" }}>
          <img src="/logo-mark.png" alt="" className="brand-mark-img" />
          <span className="brand-name">Morning Aroma</span>
        </div>
        <nav className="nav-links">
          {links.map((l) => (
            <a key={l.label} href={pathFor(l.page)} onClick={(e) => { e.preventDefault(); go(l.page); }}>{l.label}</a>
          ))}
        </nav>
        <div className="nav-actions">
          <CurrencySwitcher
            open={openDropdown === "currency"}
            onToggle={() => setOpenDropdown((d) => (d === "currency" ? null : "currency"))}
            onClose={() => setOpenDropdown(null)}
          />
          <LanguageSwitcher
            open={openDropdown === "language"}
            onToggle={() => setOpenDropdown((d) => (d === "language" ? null : "language"))}
            onClose={() => setOpenDropdown(null)}
          />
          <button className="cart-btn" onClick={onOpenSearch} aria-label="Search">
            🔍
          </button>
          <button className="cart-btn" onClick={() => setWishlistOpen(true)} aria-label="Open wishlist">
            ♡{wishlistCount > 0 && <span className="cart-badge">{wishlistCount}</span>}
          </button>
          <button className="cart-btn" onClick={() => setCartOpen(true)} aria-label="Open cart">
            🛍️{count > 0 && <span className="cart-badge">{count}</span>}
          </button>
          {user?.role === "super_admin" && (
            <button className="btn-outline admin-btn" onClick={() => go("admin")}>Admin</button>
          )}
          {user ? (
            <div className="user-chip">
              <span className="dot" /> <a href={pathFor("journey")} onClick={(e) => { e.preventDefault(); go("journey"); }}>{user.name}</a> <span className="role">· {user.role.replace("_", " ")}</span>
              <button className="link-btn" onClick={logout}>Sign out</button>
            </div>
          ) : sessionLoading ? (
            <span className="nav-session-check" aria-hidden="true" />
          ) : (
            <button className="btn-outline" onClick={onOpenLogin}>Sign in</button>
          )}
          <button className="hamburger" onClick={() => setOpen(!open)} aria-label="Menu">☰</button>
        </div>
      </div>
      {open && (
        <div className="nav-mobile">
          {user && <a href={pathFor("journey")} onClick={(e) => { e.preventDefault(); go("journey"); setOpen(false); }}>My Aroma Journey</a>}
          {user?.role === "super_admin" && <a href={pathFor("admin")} onClick={(e) => { e.preventDefault(); go("admin"); setOpen(false); }}>Admin Dashboard</a>}
          {links.map((l) => (
            <a key={l.label} href={pathFor(l.page)} onClick={(e) => { e.preventDefault(); go(l.page); setOpen(false); }}>{l.label}</a>
          ))}
        </div>
      )}
    </header>
  );
}

export function Footer() {
  const { user } = useAuth();
  const { go } = useRoute();
  const { addQuotation, settings } = useAdmin();
  const { addToast } = useToast();
  const [sent, setSent] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [variety, setVariety] = useState("");
  const [quantity, setQuantity] = useState("");
  const [message, setMessage] = useState("");

  return (
    <footer className="footer">
      <div className="footer-grid">
        <div>
          <div className="brand">
            <img src="/logo-mark.png" alt="" className="brand-mark-img" />
            <span className="brand-name light">Morning Aroma</span>
          </div>
          <p className="tagline handwritten">{settings.tagline}</p>
          {(settings.instagramHandle || settings.facebookUrl) && (
            <div className="footer-social">
              {settings.instagramHandle && (
                <a href={`https://instagram.com/${settings.instagramHandle}`} target="_blank" rel="noopener noreferrer">Instagram</a>
              )}
              {settings.facebookUrl && (
                <a href={settings.facebookUrl} target="_blank" rel="noopener noreferrer">Facebook</a>
              )}
            </div>
          )}
        </div>
        <div className="footer-links">
          <h5>Explore</h5>
          <a href={pathFor("worldjourney")} onClick={(e) => { e.preventDefault(); go("worldjourney"); }}>The World Journey</a>
          <a href={pathFor("services")} onClick={(e) => { e.preventDefault(); go("services"); }}>Our Services</a>
          <a href={pathFor("greenbeans")} onClick={(e) => { e.preventDefault(); go("greenbeans"); }}>Green Coffee</a>
          <a href={pathFor("sourcelibrary")} onClick={(e) => { e.preventDefault(); go("sourcelibrary"); }}>Source Library</a>
          <a href={pathFor("rituals")} onClick={(e) => { e.preventDefault(); go("rituals"); }}>Global Rituals</a>
          <a href={pathFor("faq")} onClick={(e) => { e.preventDefault(); go("faq"); }}>FAQ</a>
          <a href={pathFor("contact")} onClick={(e) => { e.preventDefault(); go("contact"); }}>Contact</a>
          {user && <a href={pathFor("journey")} onClick={(e) => { e.preventDefault(); go("journey"); }}>My Aroma Journey</a>}
          <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>
        </div>
        <div className="footer-form">
          <h5>Request a Quotation</h5>
          {sent ? (
            <p className="form-success">Thank you — your note has reached us. We'll reply within two business days.</p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addQuotation({ name, email, variety, quantity, message });
                setSent(true);
                addToast("Quotation request sent");
              }}
            >
              <input aria-label="Name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} required />
              <input aria-label="Email" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={254} required />
              <select aria-label="Variety of interest" value={variety} onChange={(e) => setVariety(e.target.value)} required>
                <option value="" disabled>Variety of interest</option>
                <option>Premium</option>
                <option>Everyday</option>
                <option>Not sure yet</option>
              </select>
              <input aria-label="Estimated quantity" placeholder="Estimated quantity (e.g. 40kg/month)" value={quantity} onChange={(e) => setQuantity(e.target.value)} maxLength={60} />
              <textarea aria-label="Message" placeholder="Tell us what you're looking for" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} />
              <button className="btn-primary full" type="submit">Send request</button>
              <p className="hint" style={{ color: "var(--steam)", opacity: 0.8 }}>
                {user ? "Signed in — we'll route this straight to our trade team." : "Already work with us as a roaster? Sign in and this goes straight to your account rep."}
              </p>
            </form>
          )}
        </div>
      </div>
      <div className="footer-legal">
        <p className="copyright">© {new Date().getFullYear()} Morning Aroma. Roasted with care, everywhere.</p>
        <div className="footer-legal-links">
          <a href={pathFor("privacy")} onClick={(e) => { e.preventDefault(); go("privacy"); }}>Privacy Policy</a>
          <span aria-hidden="true">·</span>
          <a href={pathFor("terms")} onClick={(e) => { e.preventDefault(); go("terms"); }}>Terms of Service</a>
        </div>
      </div>
    </footer>
  );
}

export function FeedbackBean() {
  const { addFeedback, getAllProducts } = useAdmin();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState("form"); // form | thanks
  const [rating, setRating] = useState(0);
  const [aroma, setAroma] = useState(5);
  const [texture, setTexture] = useState(5);
  const [tags, setTags] = useState([]);
  const [productId, setProductId] = useState("");
  const [note, setNote] = useState("");

  const toggleTag = (t) => setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const resetAndClose = () => {
    setOpen(false);
    setStep("form");
    setRating(0);
    setAroma(5);
    setTexture(5);
    setTags([]);
    setProductId("");
    setNote("");
  };

  const roastColor = rating === 0 ? "var(--gold)" : lerpColor("E8D5B5", "3E2C23", rating / 5);

  const feedbackModalRef = useRef(null);
  useEscapeKey(open, resetAndClose);
  useFocusTrap(feedbackModalRef, open);

  return (
    <>
      <button className="feedback-bean" onClick={() => setOpen(true)} aria-label="Leave your aroma">
        <span className="bean-shape" />
        <Steam className="bean-steam" />
      </button>
      {open && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Leave your aroma" onClick={resetAndClose}>
          <div className="modal-card feedback-card" ref={feedbackModalRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={resetAndClose}>×</button>

            {step === "form" ? (
              <>
                <p className="eyebrow">leave your aroma</p>
                <h3 className="modal-title">How was your cup?</h3>

                <div className="bean-rating-row">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`bean-rate-btn ${n <= rating ? "is-rated" : ""}`}
                      onClick={() => setRating(n)}
                      aria-label={`Rate ${n} bean${n > 1 ? "s" : ""}`}
                      aria-pressed={n <= rating}
                    >
                      <span className="bean-flip">
                        <span
                          className="bean-shape rate-bean bean-flip-face bean-flip-front"
                          style={{ background: n <= rating ? roastColor : "var(--gold)", opacity: n <= rating ? 1 : 0.5 }}
                        />
                        <span className="bean-flip-face bean-flip-back" style={{ background: roastColor }} aria-hidden="true">
                          {n}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
                <p className="hint" style={{ textAlign: "center", marginTop: 0 }}>{rating === 0 ? "Tap a bean to rate" : `${rating} of 5 beans — roasted ${rating <= 2 ? "light" : rating <= 4 ? "medium" : "dark"}`}</p>

                <label htmlFor="fb-product">Which coffee (optional)</label>
                <select id="fb-product" value={productId} onChange={(e) => setProductId(e.target.value)}>
                  <option value="">Not sure / general feedback</option>
                  {getAllProducts().map((p) => (
                    <option key={p.id} value={p.id}>{p.name} — {p.country}</option>
                  ))}
                </select>

                <label htmlFor="fb-aroma">Aroma intensity — {aroma}/10</label>
                <input id="fb-aroma" type="range" min="0" max="10" value={aroma} onChange={(e) => setAroma(Number(e.target.value))} className="slider" />

                <label htmlFor="fb-texture">Texture / body — {texture}/10</label>
                <input id="fb-texture" type="range" min="0" max="10" value={texture} onChange={(e) => setTexture(Number(e.target.value))} className="slider" />

                <label id="fb-describe-label">Describe it</label>
                <div className="chip-row" style={{ marginBottom: 10 }} role="group" aria-labelledby="fb-describe-label">
                  {DESCRIPTOR_TAGS.map((t) => (
                    <button key={t} type="button" className={`chip ${tags.includes(t) ? "chip-active" : ""}`} onClick={() => toggleTag(t)} aria-pressed={tags.includes(t)}>{t}</button>
                  ))}
                </div>

                <label htmlFor="fb-note">A note, if you'd like</label>
                <textarea id="fb-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="What stood out to you?" maxLength={500} />

                <button
                  className="btn-primary full"
                  disabled={rating === 0}
                  onClick={() => {
                    addFeedback({ rating, aroma, texture, tags, productId, note });
                    setStep("thanks");
                  }}
                >
                  Brew My Review
                </button>
              </>
            ) : (
              <div className="feedback-thanks">
                <span className="bean-shape" style={{ background: roastColor, width: 30, height: 38, margin: "0 auto 14px" }} />
                <p className="eyebrow">thank you</p>
                <h3 className="modal-title">Your aroma is steeping in</h3>
                <p className="hint" style={{ textAlign: "center" }}>We read every review — this one just reached the roastery.</p>
                <button className="btn-primary full" onClick={resetAndClose}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function matchCannedResponse(text) {
  const t = text.toLowerCase();
  const hit = CHAT_CANNED_RESPONSES.find((r) => r.keywords.some((k) => t.includes(k)));
  return hit
    ? hit.reply
    : "Thanks for reaching out — I've noted that, and someone from our team will follow up by email within a few hours. Anything else I can help with right now?";
}

function LiveChatPanel({ onBack, onClose }) {
  const { user } = useAuth();
  const { liveChats, startChat, sendChatMessage } = useAdmin();
  const [chatId, setChatId] = useState(null);
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [draft, setDraft] = useState("");
  const [agentTyping, setAgentTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const chat = liveChats.find((c) => c.id === chatId);

  useEffect(() => {
    if (user && !chatId) {
      const id = startChat(user.name, user.email);
      setChatId(id);
      sendChatMessage(id, "agent", `Hi ${user.name.split(" ")[0]}! I'm here — what can I help you with today?`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat?.messages?.length, agentTyping]);

  const beginChat = (e) => {
    e.preventDefault();
    const id = startChat(name, email);
    setChatId(id);
    sendChatMessage(id, "agent", `Hi ${name.split(" ")[0]}! Thanks for reaching out — what can I help you with today?`);
  };

  const send = () => {
    const text = draft.trim();
    if (!text || !chatId) return;
    sendChatMessage(chatId, "user", text);
    setDraft("");
    setAgentTyping(true);
    const delay = 900 + Math.random() * 900;
    setTimeout(() => {
      sendChatMessage(chatId, "agent", matchCannedResponse(text));
      setAgentTyping(false);
    }, delay);
  };

  if (!chatId) {
    return (
      <div className="care-panel chat-panel">
        <div className="care-panel-head">
          <div>
            <button className="link-btn" style={{ marginLeft: 0, marginBottom: 4 }} onClick={onBack}>← Back</button>
            <p className="eyebrow" style={{ marginBottom: 2 }}>live conversation</p>
            <h4 style={{ margin: 0, fontFamily: "'Cormorant Garamond', serif", fontSize: "1.3rem", color: "var(--chestnut)" }}>Start a chat</h4>
          </div>
          <button className="modal-close" style={{ position: "static" }} onClick={onClose} aria-label="Close">×</button>
        </div>
        <form onSubmit={beginChat} className="chat-start-form">
          <label htmlFor="chat-name">Name</label>
          <input id="chat-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} required />
          <label htmlFor="chat-email">Email</label>
          <input id="chat-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={254} required />
          <button className="btn-primary full" type="submit" style={{ marginTop: 10 }}>Start chat</button>
        </form>
      </div>
    );
  }

  return (
    <div className="care-panel chat-panel chat-panel-active">
      <div className="care-panel-head">
        <div>
          <p className="eyebrow" style={{ marginBottom: 2 }}>
            <span className="chat-online-dot" aria-hidden="true" /> live conversation
          </p>
          <h4 style={{ margin: 0, fontFamily: "'Cormorant Garamond', serif", fontSize: "1.3rem", color: "var(--chestnut)" }}>Morning Aroma team</h4>
        </div>
        <button className="modal-close" style={{ position: "static" }} onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="chat-messages">
        {(chat?.messages || []).map((m, i) => (
          <div key={i} className={`chat-bubble ${m.sender === "user" ? "chat-bubble-user" : "chat-bubble-agent"}`}>
            {m.text}
          </div>
        ))}
        {agentTyping && (
          <div className="chat-bubble chat-bubble-agent chat-typing" aria-live="polite">
            <span />
            <span />
            <span />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form
        className="chat-input-row"
        onSubmit={(e) => { e.preventDefault(); send(); }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message…"
          maxLength={500}
          aria-label="Chat message"
        />
        <button type="submit" className="btn-primary chat-send-btn" disabled={!draft.trim()}>Send</button>
      </form>
    </div>
  );
}

export function CustomerCareWidget() {
  const { settings } = useAdmin();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("options"); // "options" | "chat"
  const widgetRef = useRef(null);
  useEscapeKey(open, () => setOpen(false));
  useClickOutside(widgetRef, open, () => setOpen(false));

  const digitsOnly = (s) => (s || "").replace(/[^\d]/g, "");
  const waHref = `https://wa.me/${digitsOnly(settings.whatsappNumber)}?text=${encodeURIComponent("Hi Morning Aroma, I have a question about ")}`;
  const telHref = `tel:${(settings.phoneNumber || "").replace(/[^\d+]/g, "")}`;
  const mailHref = `mailto:${settings.contactEmail}`;

  const options = [
    { key: "chat", icon: "💬", label: "Live Chat", detail: "Talk with us right now", onClick: () => setView("chat") },
    { key: "whatsapp", href: waHref, icon: "🟢", label: "WhatsApp", detail: "Chat with our team", external: true },
    { key: "call", href: telHref, icon: "📞", label: "Call us", detail: settings.phoneNumber, external: false },
    { key: "email", href: mailHref, icon: "✉️", label: "Email", detail: settings.contactEmail, external: false },
  ];

  const closeAll = () => { setOpen(false); setView("options"); };

  return (
    <div ref={widgetRef}>
      <button className="care-bubble" onClick={() => setOpen((o) => !o)} aria-label="Contact customer care" aria-expanded={open}>
        <span aria-hidden="true">💬</span>
      </button>
      {open && view === "chat" && (
        <LiveChatPanel onBack={() => setView("options")} onClose={closeAll} />
      )}
      {open && view === "options" && (
        <div className="care-panel" role="dialog" aria-modal="false" aria-label="Contact customer care">
          <div className="care-panel-head">
            <div>
              <p className="eyebrow" style={{ marginBottom: 2 }}>we're here to help</p>
              <h4 style={{ margin: 0, fontFamily: "'Cormorant Garamond', serif", fontSize: "1.3rem", color: "var(--chestnut)" }}>Talk to Morning Aroma</h4>
            </div>
            <button className="modal-close" style={{ position: "static" }} onClick={closeAll} aria-label="Close">×</button>
          </div>
          <div className="care-options">
            {options.map((opt) =>
              opt.onClick ? (
                <button key={opt.key} className="care-option care-option-btn" onClick={opt.onClick}>
                  <span className="care-option-icon" aria-hidden="true">{opt.icon}</span>
                  <span>
                    <strong>{opt.label}</strong>
                    <span className="care-option-detail">{opt.detail}</span>
                  </span>
                </button>
              ) : (
                <a
                  key={opt.key}
                  href={opt.href}
                  className="care-option"
                  target={opt.external ? "_blank" : undefined}
                  rel={opt.external ? "noopener noreferrer" : undefined}
                >
                  <span className="care-option-icon" aria-hidden="true">{opt.icon}</span>
                  <span>
                    <strong>{opt.label}</strong>
                    <span className="care-option-detail">{opt.detail}</span>
                  </span>
                </a>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function BarRow({ label, value }) {
  return (
    <div className="bar-row">
      <span className="bar-label">{label}</span>
      <div className="bar-track"><div className="bar-fill" style={{ width: `${value * 10}%` }} /></div>
      <span className="bar-value">{value}/10</span>
    </div>
  );
}

export function CartDrawer() {
  const { items, updateQty, remove, totalCents, open, setOpen } = useCart();
  const { go } = useRoute();
  const { getPrice, getStock, getAllProducts } = useAdmin();
  const { format } = useCurrency();
  const cartDrawerRef = useRef(null);
  useEscapeKey(open, () => setOpen(false));
  useFocusTrap(cartDrawerRef, open);
  if (!open) return null;
  return (
    <div className="drawer-overlay" onClick={() => setOpen(false)}>
      <div className="drawer" ref={cartDrawerRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h3>Your bag</h3>
          <button className="modal-close" onClick={() => setOpen(false)}>×</button>
        </div>
        {items.length === 0 ? (
          <p className="hint" style={{ padding: "20px 0" }}>Nothing here yet — go find a variety you love.</p>
        ) : (
          <>
            <div className="drawer-items">
              {items.map((i) => {
                const p = getAllProducts().find((p) => p.id === i.id);
                if (!p) return null;
                const stock = getStock(p.id);
                return (
                  <div key={i.id} className="drawer-item">
                    <div className="drawer-thumb" style={{ backgroundImage: `url('${getProductPhotoUrl(p, COUNTRY_JOURNEY_PHOTO)}')` }} />
                    <div className="drawer-item-info">
                      <p className="drawer-item-name">{p.name} — {p.country}</p>
                      <p className="drawer-item-price">{format(getPrice(p.id))}</p>
                      {i.qty >= stock && stock > 0 && <p className="hint" style={{ margin: "2px 0" }}>Max available: {stock}</p>}
                      <div className="qty-row small">
                        <button onClick={() => updateQty(i.id, i.qty - 1)}>−</button>
                        <span>{i.qty}</span>
                        <button onClick={() => updateQty(i.id, Math.min(stock, i.qty + 1))} disabled={i.qty >= stock}>+</button>
                        <button className="link-btn" onClick={() => remove(i.id)}>Remove</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="drawer-total">
              <span>Total</span>
              <span>{format(totalCents)}</span>
            </div>
            <button className="btn-primary full" onClick={() => { setOpen(false); go("checkout"); }}>Checkout</button>
          </>
        )}
      </div>
    </div>
  );
}

export function WishlistDrawer() {
  const { items, remove, open, setOpen } = useWishlist();
  const { add: addToCart } = useCart();
  const { getPrice, getAllProducts } = useAdmin();
  const { format } = useCurrency();
  const { go } = useRoute();
  const { addToast } = useToast();
  const wishlistDrawerRef = useRef(null);
  useEscapeKey(open, () => setOpen(false));
  useFocusTrap(wishlistDrawerRef, open);
  if (!open) return null;
  return (
    <div className="drawer-overlay" onClick={() => setOpen(false)}>
      <div className="drawer" ref={wishlistDrawerRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h3>Your wishlist</h3>
          <button className="modal-close" onClick={() => setOpen(false)}>×</button>
        </div>
        {items.length === 0 ? (
          <p className="hint" style={{ padding: "20px 0" }}>Nothing saved yet — tap the heart on any variety to keep it here.</p>
        ) : (
          <div className="drawer-items">
            {items.map((id) => {
              const p = getAllProducts().find((p) => p.id === id);
              if (!p) return null;
              return (
                <div key={id} className="drawer-item">
                  <div className="drawer-thumb" onClick={() => { setOpen(false); go("product", { id: p.id }); }} style={{ cursor: "pointer", backgroundImage: `url('${getProductPhotoUrl(p, COUNTRY_JOURNEY_PHOTO)}')` }} />
                  <div className="drawer-item-info">
                    <p className="drawer-item-name" onClick={() => { setOpen(false); go("product", { id: p.id }); }} style={{ cursor: "pointer" }}>{p.name} — {p.country}</p>
                    <p className="drawer-item-price">{format(getPrice(p.id))}</p>
                    <div className="qty-row small">
                      <button className="link-btn" style={{ marginLeft: 0 }} onClick={() => { addToCart(p.id); addToast("Added to cart"); }}>Add to cart</button>
                      <button className="link-btn" onClick={() => remove(id)}>Remove</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function MiniCalendar({ start, end }) {
  const months = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
  const active = new Set();
  if (start <= end) {
    for (let m = start; m <= end; m++) active.add(m);
  } else {
    for (let m = start; m <= 11; m++) active.add(m);
    for (let m = 0; m <= end; m++) active.add(m);
  }
  return (
    <div className="mini-cal">
      {months.map((m, i) => (
        <span key={i} className={`mini-cal-dot ${active.has(i) ? "active" : ""}`}>{m}</span>
      ))}
    </div>
  );
}

export function RadarChart({ profile }) {
  const axes = ["aroma", "body", "acidity", "sweetness", "finish"];
  const labels = { aroma: "Aroma", body: "Body", acidity: "Acidity", sweetness: "Sweetness", finish: "Finish" };
  const size = 240, center = size / 2, radius = 84;
  const step = (Math.PI * 2) / axes.length;
  const pt = (val, i) => {
    const r = (val / 10) * radius;
    const angle = -Math.PI / 2 + i * step;
    return [center + r * Math.cos(angle), center + r * Math.sin(angle)];
  };
  const polygon = axes.map((a, i) => pt(profile[a] || 0, i).join(",")).join(" ");
  const rings = [0.25, 0.5, 0.75, 1].map((f) => axes.map((a, i) => pt(f * 10, i).join(",")).join(" "));
  const axisEnds = axes.map((a, i) => pt(10, i));
  const labelPts = axes.map((a, i) => {
    const [x, y] = pt(12.4, i);
    return { x, y, label: labels[a] };
  });
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="radar-svg" role="img" aria-label="Flavor fingerprint radar chart">
      {rings.map((r, i) => (<polygon key={i} points={r} className="radar-ring" />))}
      {axisEnds.map((p, i) => (<line key={i} x1={center} y1={center} x2={p[0]} y2={p[1]} className="radar-axis" />))}
      <polygon points={polygon} className="radar-fill" />
      {labelPts.map((l, i) => (<text key={i} x={l.x} y={l.y} className="radar-label" textAnchor="middle">{l.label}</text>))}
    </svg>
  );
}

export function NotFoundPage() {
  const { go } = useRoute();
  return (
    <div className="empty-state" style={{ padding: "100px 24px", textAlign: "center" }}>
      <span className="bean-shape" style={{ margin: "0 auto 20px" }} />
      <h2 style={{ marginBottom: 10 }}>We couldn't find that page</h2>
      <p style={{ marginBottom: 20 }}>It may have moved, or the link might be off — let's get you back on track.</p>
      <button className="btn-primary" onClick={() => go("home")}>Back to the homepage</button>
    </div>
  );
}

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error("Morning Aroma — unexpected error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      const wrap = { fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "100px 24px", background: "#FDF8F0", minHeight: "100vh", color: "#3E2C23" };
      const btn = { background: "#8B5A3A", color: "#FDF8F0", border: "none", padding: "12px 22px", borderRadius: 30, fontWeight: 700, cursor: "pointer", fontSize: "1rem", marginTop: 8 };
      return (
        <div className="error-boundary-screen" style={wrap}>
          <div style={{ width: 34, height: 44, background: "#E8D5B5", borderRadius: "50%", margin: "0 auto 20px" }} />
          <h2 style={{ marginBottom: 10 }}>Something went wrong brewing this page</h2>
          <p style={{ marginBottom: 8, opacity: 0.8 }}>A prototype hiccup, not your fault. Reloading usually clears it.</p>
          <button style={btn} onClick={() => window.location.reload()}>Reload the page</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function PhotoMarquee() {
  const track = [...MARQUEE_IMAGES, ...MARQUEE_IMAGES]; // duplicated once for a seamless loop
  return (
    <div className="photo-marquee" role="img" aria-label="A scrolling strip of coffee photography">
      <div className="photo-marquee-track">
        {track.map((src, i) => (
          <ImgWithSkeleton key={i} wrapClassName="photo-marquee-item-wrap" className="photo-marquee-item" src={src} alt="" loading="lazy" decoding="async" />
        ))}
      </div>
    </div>
  );
}

export function WaveDivider({ fill = "#E8D5B5" }) {
  return (
    <div className="wave-divider" aria-hidden="true">
      <svg viewBox="0 0 1200 60" preserveAspectRatio="none">
        <path d="M0,20 C200,55 400,-5 600,25 C800,55 1000,-5 1200,20 L1200,60 L0,60 Z" fill={fill} />
      </svg>
    </div>
  );
}