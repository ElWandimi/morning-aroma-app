import React, { useState } from "react";
import { useAdmin, useAuth, useCurrency, useRoute, useSubscriptions, useToast } from "../context";
import { RECIPE_CARDS } from "../data";
import { loadPaystackScript } from "../utils/helpers";
import { generateRecipeCardPDF } from "../utils/pdf";

const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;

export function AcademyHubPage() {
  const { go } = useRoute();
  const { getAllCourses, realCoursesLoading, realCoursesError, refetchRealCourses, settings } = useAdmin();
  const { user } = useAuth();
  const { format, rates } = useCurrency();
  const { hasLifetimeAccess, purchaseLifetimeAccess } = useSubscriptions();
  const { addToast } = useToast();
  const [cat, setCat] = useState("All");
  const [lifetimeSubmitting, setLifetimeSubmitting] = useState(false);
  const [lifetimeError, setLifetimeError] = useState("");

  const courses = getAllCourses();
  const categories = ["All", ...new Set(courses.map((c) => c.category))];
  const filtered = cat === "All" ? courses : courses.filter((c) => c.category === cat);
  const lifetimePriceCents = (settings && settings.academyLifetimePriceCents) || 24900;

  const buyLifetimeAccess = async () => {
    if (!user) { go("home"); addToast("Sign in first to get lifetime access"); return; }
    setLifetimeSubmitting(true);
    setLifetimeError("");
    try {
      await loadPaystackScript();
    } catch (e) {
      setLifetimeError(e.message);
      setLifetimeSubmitting(false);
      return;
    }
    if (!rates.KES) {
      setLifetimeError("Couldn't load current exchange rates. Please refresh and try again.");
      setLifetimeSubmitting(false);
      return;
    }
    const amountKesCents = Math.round((lifetimePriceCents / 100) * rates.KES * 100);
    const reference = `ACADEMY-LIFETIME-${Date.now()}`;
    const popup = new window.PaystackPop();
    popup.newTransaction({
      key: PAYSTACK_PUBLIC_KEY,
      email: user.email,
      amount: amountKesCents,
      currency: "KES",
      reference,
      onSuccess: async () => {
        const result = await purchaseLifetimeAccess(reference);
        setLifetimeSubmitting(false);
        if (result.ok) addToast("You now have lifetime access to every course.");
        else setLifetimeError(result.error);
      },
      onCancel: () => setLifetimeSubmitting(false),
      onError: (error) => {
        setLifetimeError(error.message || "Something went wrong with the payment. Please try again.");
        setLifetimeSubmitting(false);
      },
    });
  };

  return (
    <div className="shop-page">
      <div className="shop-head">
        <p className="eyebrow">learn the craft</p>
        <h1>Academy</h1>
        <p className="shop-sub">From your first pour-over to running a bar — taught by working baristas and roasters.</p>
      </div>

      {hasLifetimeAccess ? (
        <div className="academy-lifetime-banner unlocked">
          <p><strong>You have lifetime access</strong> — every course, including ones added later, is unlocked for you.</p>
        </div>
      ) : (
        <div className="academy-lifetime-banner">
          <div>
            <p className="academy-lifetime-title">Get lifetime access to everything</p>
            <p className="hint">One payment, every course unlocked forever — including ones we add later.</p>
          </div>
          <div className="academy-lifetime-cta">
            <span className="academy-lifetime-price">{format(lifetimePriceCents)}</span>
            <button className="btn-primary" onClick={buyLifetimeAccess} disabled={lifetimeSubmitting}>
              {lifetimeSubmitting ? "Processing…" : "Get lifetime access"}
            </button>
          </div>
        </div>
      )}
      {lifetimeError && <p className="form-error">{lifetimeError}</p>}

      <div className="cat-tabs">
        {categories.map((c) => (
          <button key={c} className={cat === c ? "active" : ""} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>

      {realCoursesLoading ? (
        <p className="hint">Loading courses…</p>
      ) : realCoursesError ? (
        <div>
          <p className="form-error">Couldn't load courses: {realCoursesError}</p>
          <button className="btn-outline small" onClick={refetchRealCourses}>Try again</button>
        </div>
      ) : (
        <div className="course-grid">
          {filtered.map((c) => (
            <div key={c.id} className="course-card" onClick={() => go("course", { id: c.id })}>
              <p className="eyebrow">{c.category}</p>
              <h3>{c.name}</h3>
              <p>{c.blurb}</p>
              <div className="course-meta">
                <span>{c.lessons} lessons</span>
                <span>{c.instructor}</span>
              </div>
              <p className="course-price">{format(c.monthlyPriceCents)}/mo</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CoursePage({ id }) {
  const { go } = useRoute();
  const { getAllCourses, realCoursesLoading } = useAdmin();
  const { user } = useAuth();
  const { format, rates } = useCurrency();
  const { mySubscriptions, hasLifetimeAccess, createSubscription } = useSubscriptions();
  const { addToast } = useToast();
  const [downloadingRecipe, setDownloadingRecipe] = useState(false);
  const [interval, setInterval] = useState("monthly");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const courses = getAllCourses();
  const course = courses.find((c) => c.id === id);

  if (realCoursesLoading) {
    return <p className="hint" style={{ padding: 80, textAlign: "center" }}>Loading course…</p>;
  }
  if (!course) {
    return (
      <div className="empty-state" style={{ padding: 80 }}>
        <p>We couldn't find that course.</p>
        <button className="btn-outline small" onClick={() => go("academy")}>Back to Academy</button>
      </div>
    );
  }

  // Real access, not a local toggle -- lifetime access unlocks everything, or a real, currently
  // active subscription specifically for this course.
  const activeCourseSub = mySubscriptions.find((s) => s.courseId === course.id && (s.status === "active" || s.status === "paused"));
  const hasAccess = hasLifetimeAccess || !!activeCourseSub;

  const recipe = RECIPE_CARDS[course.name];
  const lessonTitles = Array.from({ length: course.lessons }, (_, i) => `Lesson ${i + 1}`);
  const related = courses.filter((c) => c.category === course.category && c.id !== course.id).slice(0, 3);
  const priceCents = interval === "monthly" ? course.monthlyPriceCents : course.annualPriceCents;

  const subscribeToCourse = async () => {
    if (!user) { go("home"); addToast("Sign in first to subscribe"); return; }
    setSubmitting(true);
    setError("");
    try {
      await loadPaystackScript();
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
      return;
    }
    if (!rates.KES) {
      setError("Couldn't load current exchange rates. Please refresh and try again.");
      setSubmitting(false);
      return;
    }
    const amountKesCents = Math.round((priceCents / 100) * rates.KES * 100);
    const reference = `ACADEMY-${course.id}-${Date.now()}`;
    const popup = new window.PaystackPop();
    popup.newTransaction({
      key: PAYSTACK_PUBLIC_KEY,
      email: user.email,
      amount: amountKesCents,
      currency: "KES",
      reference,
      onSuccess: async () => {
        const result = await createSubscription({ reference, courseId: course.id, interval });
        setSubmitting(false);
        if (result.ok) addToast(`Subscribed to ${course.name} — enjoy the course!`);
        else setError(result.error);
      },
      onCancel: () => setSubmitting(false),
      onError: (err) => {
        setError(err.message || "Something went wrong with the payment. Please try again.");
        setSubmitting(false);
      },
    });
  };

  return (
    <div className="product-page">
      <button className="link-btn back-link" onClick={() => go("academy")}>← All Courses</button>
      <div className="course-top">
        <div className="course-hero-photo" />
        <div className="product-info">
          <p className="eyebrow">{course.category}</p>
          <h1>{course.name}</h1>
          <p className="course-blurb">{course.blurb}</p>
          <div className="instructor-row">
            <span className="instructor-avatar" />
            <div>
              <p className="instructor-name">{course.instructor}</p>
              <p className="instructor-role">Instructor</p>
            </div>
          </div>

          {hasAccess ? (
            <>
              <button className="btn-primary full disabled" disabled>
                {hasLifetimeAccess ? "Unlocked — lifetime access ✓" : `Enrolled ✓ (${activeCourseSub.status === "paused" ? "paused" : activeCourseSub.interval})`}
              </button>
              {activeCourseSub && activeCourseSub.status === "paused" && (
                <p className="hint">Your subscription is paused — resume it from My Aroma Journey to keep learning.</p>
              )}
            </>
          ) : (
            <>
              <div className="mode-toggle">
                <button type="button" className={interval === "monthly" ? "active" : ""} onClick={() => setInterval("monthly")}>Monthly — {format(course.monthlyPriceCents)}</button>
                <button type="button" className={interval === "annually" ? "active" : ""} onClick={() => setInterval("annually")}>Annually — {format(course.annualPriceCents)} <span className="hint">(save 20%)</span></button>
              </div>
              {error && <p className="form-error">{error}</p>}
              <button className="btn-primary full" onClick={subscribeToCourse} disabled={submitting}>
                {submitting ? "Processing…" : `Subscribe — ${format(priceCents)}`}
              </button>
              <p className="hint">Or get <button type="button" className="link-btn" onClick={() => go("academy")}>lifetime access to every course</button> instead.</p>
            </>
          )}

          {recipe && (
            <button
              className="btn-outline full recipe-download-btn"
              disabled={downloadingRecipe}
              onClick={async () => {
                setDownloadingRecipe(true);
                try {
                  await generateRecipeCardPDF(course, recipe);
                  addToast("Recipe card downloaded");
                } finally {
                  setDownloadingRecipe(false);
                }
              }}
            >
              📄 {downloadingRecipe ? "Preparing card…" : "Download Recipe Card (PDF)"}
            </button>
          )}
          <p className="hint">{course.lessons} video lessons{recipe ? " · printable recipe card included" : ""}</p>
        </div>
      </div>

      <h3 className="matched-head">Lessons</h3>
      <div className="lesson-list">
        {lessonTitles.map((l, i) => (
          <div key={l} className="lesson-row">
            <span className="lesson-num">{i + 1}</span>
            <span>{l}: {course.name} technique {i === 0 ? "— fundamentals" : i === course.lessons - 1 ? "— putting it together" : ""}</span>
            <span className="lesson-lock">{hasAccess ? "▶" : "🔒"}</span>
          </div>
        ))}
      </div>

      {related.length > 0 && (
        <div className="related">
          <h3>More in {course.category}</h3>
          <div className="course-grid">
            {related.map((c) => (
              <div key={c.id} className="course-card" onClick={() => go("course", { id: c.id })}>
                <p className="eyebrow">{c.category}</p>
                <h3>{c.name}</h3>
                <p>{c.blurb}</p>
                <div className="course-meta">
                  <span>{c.lessons} lessons</span>
                  <span>{c.instructor}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
