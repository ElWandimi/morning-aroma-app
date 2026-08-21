import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { Glass } from "../components";
import { useAdmin, useCart, useRoute } from "../context";
import { QUIZ_QUESTIONS } from "../data";

export function QuizPage() {
  const { go } = useRoute();
  const { add } = useCart();
  const { getAllProducts } = useAdmin();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});

  const pick = (opt) => {
    setAnswers((prev) => ({ ...prev, ...opt }));
    setStep((s) => s + 1);
  };

  const restart = () => { setAnswers({}); setStep(0); };

  if (step >= QUIZ_QUESTIONS.length) {
    let best = null, bestScore = -1;
    getAllProducts().forEach((p) => {
      let score = 0;
      if (answers.body && p.tags.body === answers.body) score += 2;
      if (answers.acidity && p.tags.acidity === answers.acidity) score += 2;
      if (answers.moment && p.tags.moment === answers.moment) score += 3;
      if (score > bestScore) { bestScore = score; best = p; }
    });
    return (
      <div className="quiz-page">
        <div className="quiz-result">
          <p className="eyebrow gold">your match</p>
          <h1>{best.name} — {best.country}</h1>
          <p className="handwritten product-note">{best.note}</p>
          <p className="quiz-copy">Matched to how you like to feel, the body and acidity you're after, and when you'll actually drink it.</p>
          <div className="quiz-result-actions">
            <button className="btn-primary" onClick={() => go("product", { id: best.id })}>View this variety</button>
            <button className="btn-outline" onClick={() => add(best.id)}>Add to cart</button>
          </div>
          <button className="link-btn" style={{ marginTop: 16 }} onClick={restart}>Take the quiz again</button>
        </div>
      </div>
    );
  }

  const q = QUIZ_QUESTIONS[step];
  return (
    <div className="quiz-page">
      <div className="quiz-progress">
        {QUIZ_QUESTIONS.map((_, i) => (
          <span key={i} className={`quiz-dot ${i <= step ? "active" : ""}`} />
        ))}
      </div>
      <Glass className="quiz-question-panel">
        <p className="eyebrow">question {step + 1} of {QUIZ_QUESTIONS.length}</p>
        <h2>{q.prompt}</h2>
        <div className="quiz-options">
          {q.options.map((opt) => (
            <button key={opt.label} className="quiz-option" onClick={() => pick(opt)}>{opt.label}</button>
          ))}
        </div>
      </Glass>
    </div>
  );
}
