/**
 * 探究モード — LocalStorage 永続化
 * 将来: PDF出力・提出・AI添削で同じスキーマを利用
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "physlabo_brownian_inquiry_v1";

  const DEFAULT_STATE = {
    version: 2,
    missionId: "",
    hypothesisId: "",
    hypothesisFreeText: "",
    planId: "",
    question: "",
    hypothesis: "",
    hypothesisReason: "",
    planChecks: { temperature: true, particleSize: false, particleCount: false },
    planText: "",
    timeline: [],
    results: [],
    graphCreated: false,
    reflection: "",
    summaryText: "",
    observationDone: false,
    observationSeconds: 0,
    currentStep: 1,
    welcomeSeen: false,
    summaryCelebrated: false,
    completedSteps: {},
  };

  function migrateTimelineItem(item) {
    if (!item) return item;
    if (item.type) return item;
    return { type: "temperature", from: item.from, to: item.to, at: item.at };
  }

  function migrateResult(row) {
    if (!row) return row;
    return {
      temperature: row.temperature ?? row.temp ?? 300,
      avgSpeed: row.avgSpeed ?? 0,
      largeRadius: row.largeRadius ?? 18,
      particleCount: row.particleCount ?? 100,
      largeSpeedPxS: row.largeSpeedPxS ?? 0,
    };
  }

  function migrateState(state) {
    const out = { ...state };
    if (Array.isArray(out.timeline)) out.timeline = out.timeline.map(migrateTimelineItem);
    if (Array.isArray(out.results)) out.results = out.results.map(migrateResult);
    if (!out.planId && global.InquiryMissions?.DEFAULT_PLAN_CHECKS) {
      out.planChecks = { ...InquiryMissions.DEFAULT_PLAN_CHECKS };
    }
    if (global.InquiryMissions?.syncLegacyFields) {
      return global.InquiryMissions.syncLegacyFields(out);
    }
    return out;
  }

  function deepMerge(base, patch) {
    const out = { ...base };
    Object.keys(patch).forEach((k) => {
      if (patch[k] && typeof patch[k] === "object" && !Array.isArray(patch[k])) {
        out[k] = { ...base[k], ...patch[k] };
      } else if (patch[k] !== undefined) {
        out[k] = patch[k];
      }
    });
    return out;
  }

  const InquiryStorage = {
    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...DEFAULT_STATE };
        return migrateState(deepMerge(DEFAULT_STATE, JSON.parse(raw)));
      } catch {
        return { ...DEFAULT_STATE };
      }
    },

    save(state) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch { /* quota */ }
    },

    clear() {
      localStorage.removeItem(STORAGE_KEY);
    },

    exportForSubmit(state) {
      return {
        exportedAt: new Date().toISOString(),
        simId: "brownian_motion",
        chapter: 12,
        ...state,
      };
    },
  };

  global.InquiryStorage = InquiryStorage;
})(window);
