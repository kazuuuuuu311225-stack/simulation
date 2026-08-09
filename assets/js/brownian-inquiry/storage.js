/**
 * ブラウン運動 — 探究モード LocalStorage
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "physlabo_brownian_inquiry_v1";

  const DEFAULT_STATE = {
    version: 3,
    missionId: "",
    hypothesisId: "",
    hypothesisFreeText: "",
    planId: "",
    aiComments: { mission: "", hypothesis: "", plan: "", reflection: "", summary: "" },
    question: "",
    hypothesis: "",
    hypothesisReason: "",
    planChecks: { temperature: true, particleSize: false, particleCount: false },
    planText: "",
    timeline: [],
    results: [],
    measureLog: [],
    graphCreated: false,
    graphsCreated: { temperature: false, particleSize: false, particleCount: false },
    curves: {},
    customGraphs: [],
    reflection: "",
    summaryText: "",
    activeStepIndex: 0,
    companionMode: "gentle",
    observationDone: false,
    observationSeconds: 0,
    currentStep: 0,
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
      measureId: row.measureId ?? 0,
      measureRound: row.measureRound ?? 0,
    };
  }

  function migrateState(state) {
    const out = { ...state };
    if (out.planChecks) {
      if ("material" in out.planChecks || "mass" in out.planChecks || "heatQ" in out.planChecks) {
        out.planChecks = { temperature: true, particleSize: false, particleCount: false };
      }
    }
    if (out.companionMode !== "expert" && out.companionMode !== "gentle") out.companionMode = "gentle";
    if (typeof out.activeStepIndex !== "number" || out.activeStepIndex < 0) out.activeStepIndex = 0;
    if (out.activeStepIndex > 7) out.activeStepIndex = 7;
    if (!out.graphsCreated || typeof out.graphsCreated !== "object") {
      out.graphsCreated = { temperature: false, particleSize: false, particleCount: false };
    }
    if (out.graphCreated && !out.graphsCreated.temperature) {
      out.graphsCreated.temperature = true;
    }
    if (!out.curves || typeof out.curves !== "object") out.curves = {};
    if (!Array.isArray(out.customGraphs)) out.customGraphs = [];
    if (!Array.isArray(out.measureLog)) out.measureLog = [];
    if (!out.aiComments || typeof out.aiComments !== "object") {
      out.aiComments = { mission: "", hypothesis: "", plan: "", reflection: "", summary: "" };
    }
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

    migrateResult,
  };

  global.InquiryStorage = InquiryStorage;
})(window);
