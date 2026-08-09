/**
 * 探究モード — 進捗管理
 */
(function (global) {
  "use strict";

  const STEP_WEIGHTS = {
    question: 12,
    hypothesis: 12,
    plan: 12,
    experiment: 16,
    results: 16,
    graph: 16,
    reflection: 12,
    summary: 4,
  };

  const InquiryProgress = {
    STEP_IDS: ["question", "hypothesis", "plan", "experiment", "results", "graph", "reflection", "summary"],

    compute(state, validators) {
      const done = {};
      let total = 0;
      this.STEP_IDS.forEach((id) => {
        const complete = validators[id] ? validators[id](state) : false;
        done[id] = complete;
        if (complete) total += STEP_WEIGHTS[id] || 0;
      });
      return { percent: Math.min(100, total), done };
    },

    render(container, percent, doneMap) {
      const fill = container.querySelector(".inquiry-progress-fill");
      const pctEl = container.querySelector(".inquiry-progress-pct");
      if (fill) fill.style.width = percent + "%";
      if (pctEl) pctEl.textContent = percent + "%";

      container.querySelectorAll(".inquiry-step-dot").forEach((dot, i) => {
        const id = this.STEP_IDS[i];
        dot.classList.remove("active", "done");
        if (doneMap[id]) dot.classList.add("done");
      });
    },
  };

  global.InquiryProgress = InquiryProgress;
})(window);
