import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { useAdmin, useRoute, useToast } from "../context";
import { ACADEMY_CATEGORIES, COURSES, RECIPE_CARDS } from "../data";
import { slugify } from "../utils/helpers";
import { generateRecipeCardPDF } from "../utils/pdf";

export function AcademyHubPage() {
  const { go } = useRoute();
  const { getCourseContent } = useAdmin();
  const [cat, setCat] = useState("All");
  const filtered = (cat === "All" ? COURSES : COURSES.filter((c) => c.category === cat)).map(getCourseContent);
  return (
    <div className="shop-page">
      <div className="shop-head">
        <p className="eyebrow">learn the craft</p>
        <h1>Academy</h1>
        <p className="shop-sub">From your first pour-over to running a bar — taught by working baristas and roasters.</p>
      </div>
      <div className="cat-tabs">
        {ACADEMY_CATEGORIES.map((c) => (
          <button key={c} className={cat === c ? "active" : ""} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>
      <div className="course-grid">
        {filtered.map((c) => (
          <div key={c.name} className="course-card" onClick={() => go("course", { id: slugify(c.name) })}>
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
  );
}

export function CoursePage({ id }) {
  const { go } = useRoute();
  const { getCourseContent } = useAdmin();
  const { addToast } = useToast();
  const [enrolled, setEnrolled] = useState(false);
  const [downloadingRecipe, setDownloadingRecipe] = useState(false);
  const rawCourse = COURSES.find((c) => slugify(c.name) === id);
  if (!rawCourse) {
    return (
      <div className="empty-state" style={{ padding: 80 }}>
        <p>We couldn't find that course.</p>
        <button className="btn-outline small" onClick={() => go("academy")}>Back to Academy</button>
      </div>
    );
  }
  const course = getCourseContent(rawCourse);
  const recipe = RECIPE_CARDS[rawCourse.name];
  const lessonTitles = Array.from({ length: course.lessons }, (_, i) => `Lesson ${i + 1}`);
  const related = COURSES.filter((c) => c.category === course.category && c.name !== course.name).slice(0, 3).map(getCourseContent);

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
          <button className={`btn-primary full ${enrolled ? "disabled" : ""}`} onClick={() => setEnrolled(true)} disabled={enrolled}>
            {enrolled ? "Enrolled ✓" : "Enroll in this course"}
          </button>
          {recipe && (
            <button
              className="btn-outline full recipe-download-btn"
              disabled={downloadingRecipe}
              onClick={async () => {
                setDownloadingRecipe(true);
                try {
                  await generateRecipeCardPDF(rawCourse, recipe);
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
            <span className="lesson-lock">{enrolled ? "▶" : "🔒"}</span>
          </div>
        ))}
      </div>

      {related.length > 0 && (
        <div className="related">
          <h3>More in {course.category}</h3>
          <div className="course-grid">
            {related.map((c) => (
              <div key={c.name} className="course-card" onClick={() => go("course", { id: slugify(c.name) })}>
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
