import React, { useState, useEffect } from "react";
import { useAdmin, useAuth, useCurrency, useRoute, useSubscriptions, useToast } from "../context";
import { RECIPE_CARDS } from "../data";
import { loadPaystackScript, activateOnEnterOrSpace, initialsFromName, colorFromName } from "../utils/helpers";
import { generateRecipeCardPDF, generateCertificatePDF, generateLessonPDF } from "../utils/pdf";
import { useStructuredData } from "../hooks";
import { api } from "../utils/api";

const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;

export function AcademyHubPage() {
  const { go } = useRoute();
  const { getAllCourses, realCoursesLoading, realCoursesError, refetchRealCourses, settings, getAcademyStats } = useAdmin();
  const { user } = useAuth();
  const { format, rates } = useCurrency();
  const { hasLifetimeAccess, purchaseLifetimeAccess } = useSubscriptions();
  const { addToast } = useToast();
  const [cat, setCat] = useState("All");
  const [lifetimeSubmitting, setLifetimeSubmitting] = useState(false);
  const [lifetimeError, setLifetimeError] = useState("");
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!user) { setStats(null); return; }
    getAcademyStats().then((result) => { if (!cancelled) setStats(result); });
    return () => { cancelled = true; };
  }, [user]);


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

      {stats && stats.xp > 0 && (
        <div className="academy-lifetime-banner">
          <div>
            <p className="academy-lifetime-title">{stats.level} · {stats.xp} XP</p>
            <p className="hint">
              {stats.passedChapterCount} lesson{stats.passedChapterCount === 1 ? "" : "s"} passed
              {stats.certificateCount > 0 && ` · ${stats.certificateCount} certificate${stats.certificateCount === 1 ? "" : "s"}`}
              {stats.streak > 0 && ` · 🔥 ${stats.streak}-day streak`}
            </p>
            {stats.badges.length > 0 && (
              <p className="hint" style={{ marginTop: 6 }}>
                {stats.badges.map((b) => b.name).join(" · ")}
              </p>
            )}
          </div>
        </div>
      )}

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
            <div key={c.id} className="course-card" onClick={() => go("course", { id: c.id })} onKeyDown={activateOnEnterOrSpace(() => go("course", { id: c.id }))} role="link" tabIndex={0}>
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
  const { getAllCourses, getCourseChapters, getChapterContent, getQuiz, submitQuiz, getCertificateEligibility, issueCertificate, realCoursesLoading } = useAdmin();
  const { user } = useAuth();
  const { format, rates } = useCurrency();
  const { mySubscriptions, hasLifetimeAccess, createSubscription } = useSubscriptions();
  const { addToast } = useToast();
  const [downloadingRecipe, setDownloadingRecipe] = useState(false);
  const [interval, setInterval] = useState("monthly");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [chapters, setChapters] = useState([]);
  const [chaptersLoading, setChaptersLoading] = useState(true);
  const [activeQuizChapterId, setActiveQuizChapterId] = useState(null);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState([]);
  const [quizResult, setQuizResult] = useState(null);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [certEligibility, setCertEligibility] = useState(null);
  const [issuingCert, setIssuingCert] = useState(false);
  const [downloadingLessonId, setDownloadingLessonId] = useState(null);
  const [readingChapterId, setReadingChapterId] = useState(null);
  const [readingContent, setReadingContent] = useState(null);
  const [readingLoading, setReadingLoading] = useState(false);
  const [readingError, setReadingError] = useState("");

  const courses = getAllCourses();
  const course = courses.find((c) => c.id === id);

  // Real per-lesson content, fetched fresh for whichever course is actually being viewed --
  // cancelled/ignored on unmount or a fast id change so a slow response for a course the visitor
  // already navigated away from can't overwrite what's now on screen for a different one.
  useEffect(() => {
    let cancelled = false;
    setChaptersLoading(true);
    getCourseChapters(id)
      .then((result) => { if (!cancelled) setChapters(result); })
      .catch(() => { if (!cancelled) setChapters([]); })
      .finally(() => { if (!cancelled) setChaptersLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  // Real certificate eligibility, re-checked server-side -- only meaningful for a signed-in user
  // (an anonymous visitor has no subscription to check against), so this simply doesn't fetch
  // anything for one rather than erroring.
  useEffect(() => {
    let cancelled = false;
    if (!user) { setCertEligibility(null); return; }
    getCertificateEligibility(id).then((result) => { if (!cancelled) setCertEligibility(result); });
    return () => { cancelled = true; };
  }, [id, user]);

  const openQuiz = async (chapterId) => {
    if (activeQuizChapterId === chapterId) {
      setActiveQuizChapterId(null);
      return;
    }
    setActiveQuizChapterId(chapterId);
    setQuizResult(null);
    setQuizAnswers([]);
    setQuizLoading(true);
    try {
      const questions = await getQuiz(chapterId);
      setQuizQuestions(questions);
      setQuizAnswers(new Array(questions.length).fill(null));
    } catch {
      setQuizQuestions([]);
    } finally {
      setQuizLoading(false);
    }
  };

  const selectQuizAnswer = (questionIndex, optionIndex) => {
    setQuizAnswers((prev) => {
      const next = [...prev];
      next[questionIndex] = optionIndex;
      return next;
    });
  };

  // Deliberately not just openQuiz(chapterId) again -- that function toggles closed when the
  // given chapter is already the active one (the normal "click to collapse" behavior for the
  // "Take quiz" button), which is exactly the state a just-graded quiz is already in. Retaking
  // needs to force a fresh fetch and reset regardless of current state, not toggle it shut.
  const retakeQuiz = async (chapterId) => {
    setQuizResult(null);
    setQuizAnswers([]);
    setQuizLoading(true);
    try {
      const questions = await getQuiz(chapterId);
      setQuizQuestions(questions);
      setQuizAnswers(new Array(questions.length).fill(null));
    } catch {
      setQuizQuestions([]);
    } finally {
      setQuizLoading(false);
    }
  };

  const downloadLesson = async (ch) => {
    setDownloadingLessonId(ch.id);
    const result = await getChapterContent(ch.id);
    setDownloadingLessonId(null);
    if (!result.ok) { addToast(result.error); return; }
    await generateLessonPDF(course, ch, result.content);
  };

  // Whether a SPECIFIC lesson number is unlocked -- not just the lesson the current row happens
  // to be rendering, since Next/Previous navigation below needs to check the lock status of an
  // arbitrary adjacent lesson, not only the one a click originated from.
  const isChapterNumberUnlocked = (number) => hasAccess || number === 1;

  const openReading = async (chapterId) => {
    setReadingChapterId(chapterId);
    setReadingError("");
    const chapter = chapters.find((c) => c.id === chapterId);
    if (!chapter || !isChapterNumberUnlocked(chapter.number)) {
      setReadingContent(null);
      return;
    }
    setReadingLoading(true);
    const result = await getChapterContent(chapterId);
    setReadingLoading(false);
    if (result.ok) setReadingContent({ title: result.title, content: result.content });
    else { setReadingContent(null); setReadingError(result.error); }
  };

  const closeReading = () => {
    setReadingChapterId(null);
    setReadingContent(null);
    setReadingError("");
  };

  const goToAdjacentChapter = (direction) => {
    const currentIndex = chapters.findIndex((c) => c.id === readingChapterId);
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= chapters.length) return;
    openReading(chapters[nextIndex].id);
  };

  const submitQuizAnswers = async () => {
    setQuizSubmitting(true);
    const result = await submitQuiz(activeQuizChapterId, quizAnswers);
    setQuizSubmitting(false);
    if (result.ok) {
      setQuizResult(result);
      getCertificateEligibility(id).then(setCertEligibility);
    } else {
      addToast(result.error);
    }
  };

  // Real Course structured data -- called unconditionally, before either early return below,
  // same Rules of Hooks reasoning established elsewhere in this app (see ROADMAP.md).
  useStructuredData(
    course
      ? {
          "@context": "https://schema.org",
          "@type": "Course",
          name: course.name,
          description: course.blurb,
          provider: { "@type": "Organization", name: "Morning Aroma", sameAs: `${window.location.origin}/` },
          hasCourseInstance: {
            "@type": "CourseInstance",
            courseMode: "online",
            instructor: { "@type": "Person", name: course.instructor },
          },
          offers: {
            "@type": "Offer",
            priceCurrency: "USD",
            price: (course.monthlyPriceCents / 100).toFixed(2),
            category: "subscription",
          },
        }
      : null
  );

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
        <div className="course-hero-photo" style={course.heroPhotoUrl ? { backgroundImage: `url(${course.heroPhotoUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
        <div className="product-info">
          <p className="eyebrow">{course.category}</p>
          <h1>{course.name}</h1>
          <p className="course-blurb">{course.blurb}</p>
          <div className="instructor-row">
            {course.instructorPhotoUrl ? (
              <span className="instructor-avatar" style={{ backgroundImage: `url(${course.instructorPhotoUrl})`, backgroundSize: "cover", backgroundPosition: "center" }} />
            ) : (
              <span className="instructor-avatar" style={{ background: colorFromName(course.instructor), display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 600, fontSize: "0.85rem" }}>
                {initialsFromName(course.instructor)}
              </span>
            )}
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
              <div id="subscribe-section" className="mode-toggle">
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
          <p className="hint">{course.lessons} lesson{course.lessons === 1 ? "" : "s"}{recipe ? " · printable recipe card included" : ""}</p>
        </div>
      </div>

      <h3 className="matched-head">Lessons</h3>
      {chaptersLoading ? (
        <p className="hint">Loading lessons…</p>
      ) : chapters.length > 0 ? (
        <div className="lesson-list">
          {chapters.map((ch) => {
            // Chapter 1 is always unlocked as a free preview, regardless of subscription -- see
            // the matching change in hasCourseAccessForChapter server-side. Still requires being
            // signed in, since quiz attempts and content downloads are both tied to a real user;
            // an anonymous visitor sees a sign-in prompt instead of a button that would just fail.
            const isFreePreview = !hasAccess && ch.number === 1;
            const lessonUnlocked = hasAccess || isFreePreview;
            return (
            <div key={ch.id}>
              <div className="lesson-row">
                <span className="lesson-num">{ch.number}</span>
                <span>
                  <strong>{ch.title}</strong>{isFreePreview && <span className="eyebrow" style={{ marginLeft: 8 }}>Free preview</span>}
                  <br />
                  <span className="hint">{ch.description}</span>
                  {ch.objectives && ch.objectives.length > 0 && (
                    <ul style={{ margin: "6px 0 0 0", paddingLeft: 18, fontSize: "0.82rem", color: "#6b5647" }}>
                      {ch.objectives.map((o, i) => <li key={i}>{o}</li>)}
                    </ul>
                  )}
                </span>
                <button
                  type="button"
                  className="lesson-lock"
                  style={{ background: "none", border: "none", cursor: "pointer", font: "inherit" }}
                  aria-label={lessonUnlocked ? `Read ${ch.title}` : `Subscribe to unlock ${ch.title}`}
                  onClick={() => {
                    if (lessonUnlocked) {
                      readingChapterId === ch.id ? closeReading() : openReading(ch.id);
                    } else {
                      document.getElementById("subscribe-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
                      addToast("Subscribe to unlock this lesson");
                    }
                  }}
                >
                  {lessonUnlocked ? "▶" : "🔒"}
                </button>
              </div>
              {lessonUnlocked && !user && (
                <p className="hint lesson-signin-prompt">
                  <button type="button" className="link-btn" onClick={() => { go("home"); addToast("Sign in free to preview this lesson"); }}>Sign in free</button> to read this lesson, take the quiz, or download it.
                </p>
              )}
              {lessonUnlocked && user && (
                <div className="lesson-actions">
                <button className="btn-primary small" onClick={() => readingChapterId === ch.id ? closeReading() : openReading(ch.id)}>
                  {readingChapterId === ch.id ? "Hide lesson" : "Read lesson"}
                </button>
                <button className="btn-outline small" onClick={() => openQuiz(ch.id)}>
                  {activeQuizChapterId === ch.id ? "Hide quiz" : "Take quiz"}
                </button>
                <button
                  className="link-btn"
                  disabled={downloadingLessonId === ch.id}
                  onClick={() => downloadLesson(ch)}
                >
                  {downloadingLessonId === ch.id ? "Preparing…" : "📄 Download (PDF)"}
                </button>
                </div>
              )}
              {readingChapterId === ch.id && (
                <div className="lesson-detail-panel">
                  {readingLoading ? (
                    <p className="hint">Loading lesson…</p>
                  ) : readingError ? (
                    <p className="hint">{readingError}</p>
                  ) : readingContent ? (
                    <>
                      <h4 style={{ marginTop: 0 }}>{readingContent.title}</h4>
                      {readingContent.content.split("\n\n").map((para, i) => (
                        <p key={i} style={{ fontSize: "0.92rem", lineHeight: 1.6 }}>{para}</p>
                      ))}
                    </>
                  ) : null}
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
                    <button
                      type="button"
                      className="link-btn"
                      disabled={chapters.findIndex((c) => c.id === readingChapterId) <= 0}
                      onClick={() => goToAdjacentChapter(-1)}
                    >
                      ← Previous
                    </button>
                    <button
                      type="button"
                      className="link-btn"
                      disabled={chapters.findIndex((c) => c.id === readingChapterId) >= chapters.length - 1}
                      onClick={() => goToAdjacentChapter(1)}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
              {activeQuizChapterId === ch.id && (
                <div className="lesson-detail-panel">
                  {quizLoading ? (
                    <p className="hint">Loading quiz…</p>
                  ) : quizQuestions.length === 0 ? (
                    <p className="hint">This lesson doesn't have a quiz yet.</p>
                  ) : quizResult ? (
                    <div>
                      <p><strong>{quizResult.passed ? "Passed! " : "Not quite — "}</strong>Score: {quizResult.score}%</p>
                      {quizQuestions.map((q, i) => {
                        const r = quizResult.results[i];
                        return (
                          <div key={q.id} style={{ marginBottom: 10 }}>
                            <p>{q.question}</p>
                            <p className="hint">{r.correct ? "✓ Correct" : "✗ Incorrect"} — {r.explanation}</p>
                          </div>
                        );
                      })}
                      <button className="link-btn" onClick={() => retakeQuiz(ch.id)}>Retake quiz</button>
                    </div>
                  ) : (
                    <div>
                      {quizQuestions.map((q, qi) => (
                        <div key={q.id} style={{ marginBottom: 12 }}>
                          <p>{q.question}</p>
                          {q.options.map((opt, oi) => (
                            <label key={oi} style={{ display: "block" }}>
                              <input
                                type="radio"
                                name={`quiz-${q.id}`}
                                checked={quizAnswers[qi] === oi}
                                onChange={() => selectQuizAnswer(qi, oi)}
                              /> {opt}
                            </label>
                          ))}
                        </div>
                      ))}
                      <button
                        className="btn-primary small"
                        disabled={quizSubmitting || quizAnswers.some((a) => a === null)}
                        onClick={submitQuizAnswers}
                      >
                        {quizSubmitting ? "Submitting…" : "Submit answers"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>
      ) : (
        <p className="hint">Lesson content for this course is coming soon.</p>
      )}

      {hasAccess && certEligibility && certEligibility.assessedChapterCount > 0 && (
        <div className="academy-lifetime-banner" style={{ marginTop: 24 }}>
          {certEligibility.eligible ? (
            <>
              <div>
                <p className="academy-lifetime-title">You've completed every quiz in this course 🎉</p>
                <p className="hint">Download your certificate, or verify one anytime at /verify-certificate.</p>
              </div>
              <button
                className="btn-primary"
                disabled={issuingCert}
                onClick={async () => {
                  setIssuingCert(true);
                  const result = await issueCertificate(id);
                  setIssuingCert(false);
                  if (result.ok) {
                    await generateCertificatePDF(result.certificate);
                    addToast("Certificate downloaded");
                  } else {
                    addToast(result.error);
                  }
                }}
              >
                {issuingCert ? "Preparing…" : "Get your certificate"}
              </button>
            </>
          ) : (
            <div>
              <p className="hint" style={{ marginBottom: 6 }}>
                {certEligibility.passedChapterCount} of {certEligibility.assessedChapterCount} lessons passed — pass every lesson's quiz to earn a certificate.
              </p>
              <div style={{ background: "#e8d5b5", borderRadius: 6, height: 8, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${Math.round((certEligibility.passedChapterCount / certEligibility.assessedChapterCount) * 100)}%`,
                    background: "#8B5A3A",
                    height: "100%",
                    borderRadius: 6,
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {related.length > 0 && (
        <div className="related">
          <h3>More in {course.category}</h3>
          <div className="course-grid">
            {related.map((c) => (
              <div key={c.id} className="course-card" onClick={() => go("course", { id: c.id })} onKeyDown={activateOnEnterOrSpace(() => go("course", { id: c.id }))} role="link" tabIndex={0}>
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

// Public, deliberately -- anyone holding a printed certificate's verification code can confirm
// it's real here, without needing an account. Calls api.verifyCertificate directly rather than
// going through AdminDataProvider, since that endpoint needs no auth token at all.
export function VerifyCertificatePage() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const checkCode = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setChecking(true);
    setError("");
    setResult(null);
    try {
      const body = await api.verifyCertificate(code.trim());
      setResult(body);
    } catch (e) {
      setError(e.message || "Couldn't check that code right now. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="shop-page">
      <div className="shop-head">
        <p className="eyebrow">academy</p>
        <h1>Verify a Certificate</h1>
        <p className="shop-sub">Enter the verification code printed on a Morning Aroma Academy certificate.</p>
      </div>
      <form onSubmit={checkCode} style={{ maxWidth: 420, margin: "0 auto" }}>
        <input
          className="admin-content-input"
          placeholder="MA-XXXXXXXX"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={20}
        />
        <button className="btn-primary full" type="submit" disabled={checking} style={{ marginTop: 10 }}>
          {checking ? "Checking…" : "Verify"}
        </button>
      </form>
      {error && <p className="form-error" style={{ textAlign: "center", marginTop: 16 }}>{error}</p>}
      {result && (
        <div style={{ maxWidth: 420, margin: "24px auto", textAlign: "center" }}>
          {result.valid ? (
            <>
              <p><strong>✓ Valid certificate</strong></p>
              <p>{result.studentName} completed <strong>{result.courseName}</strong></p>
              <p className="hint">Issued {new Date(result.issuedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
            </>
          ) : (
            <p className="form-error">No certificate found with that code.</p>
          )}
        </div>
      )}
    </div>
  );
}
