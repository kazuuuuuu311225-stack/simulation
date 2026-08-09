/**
 * 熱平衡シミュ — 探究モード LocalStorage
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "physlabo_heat_equilibrium_inquiry_v1";

  const MATERIAL_NAMES = { water: "水", iron: "鉄", aluminum: "アルミ", air: "空気" };

  const DEFAULT_STATE = {
    version: 1,
    missionId: "",
    hypothesisId: "",
    hypothesisFreeText: "",
    planId: "",
    aiComments: { mission: "", hypothesis: "", plan: "", reflection: "", summary: "" },
    question: "",
    hypothesis: "",
    hypothesisReason: "",
    planChecks: { materialPair: true, massA: false, massB: false, tempDiff: false },
    planText: "",
    timeline: [],
    results: [],
    contactMeasureLog: [],
    ttCurves: {},
    graphsCreated: {},
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
    return { type: "matA", from: item.from, to: item.to, at: item.at };
  }

  function migrateResult(row) {
    if (!row) return row;
    const round1 = (v) => Math.round(Number(v) * 10) / 10;
    return {
      measureId: row.measureId ?? 0,
      measureRound: row.measureRound ?? 0,
      matA: row.matA ?? "water",
      matB: row.matB ?? "iron",
      matAName: row.matAName ?? MATERIAL_NAMES[row.matA] ?? "水",
      matBName: row.matBName ?? MATERIAL_NAMES[row.matB] ?? "鉄",
      massA: row.massA ?? 500,
      massB: row.massB ?? 500,
      tempAInit: round1(row.tempAInit ?? row.tempA ?? 80),
      tempBInit: round1(row.tempBInit ?? row.tempB ?? 20),
      tempAFinal: round1(row.tempAFinal ?? row.tempA ?? 0),
      tempBFinal: round1(row.tempBFinal ?? row.tempB ?? 0),
      deltaTA: round1(row.deltaTA ?? (Number(row.tempAFinal ?? 0) - Number(row.tempAInit ?? 0))),
      deltaTB: round1(row.deltaTB ?? (Number(row.tempBFinal ?? 0) - Number(row.tempBInit ?? 0))),
      Q_loss: round1(row.Q_loss ?? 0),
      Q_gain: round1(row.Q_gain ?? 0),
      teqFinal: round1(row.teqFinal ?? row.tempAFinal ?? 0),
      teqTheory: round1(row.teqTheory ?? row.teqTheoretical ?? 0),
      simTime: round1(row.simTime ?? 0),
      tempDiff: round1(Math.abs(Number(row.tempAInit ?? 0) - Number(row.tempBInit ?? 0))),
      massRatio: row.massRatio != null ? round1(row.massRatio) : round1((row.massA ?? 500) / Math.max(row.massB ?? 500, 1)),
    };
  }

  function migrateContactLog(row, index) {
    if (!row) return row;
    const r = migrateResult(row);
    return {
      ...r,
      measureRound: r.measureRound || (index + 1),
      at: row.at ?? row.measureId ?? Date.now(),
    };
  }

  function sortResults(results) {
    return (results || [])
      .map(migrateResult)
      .sort((a, b) => (a.measureRound || 0) - (b.measureRound || 0) || (a.measureId || 0) - (b.measureId || 0));
  }

  function migrateState(state) {
    const out = { ...state };
    if (out.planChecks) {
      if ("material" in out.planChecks || "heatQ" in out.planChecks) {
        out.planChecks = { materialPair: true, massA: false, massB: false, tempDiff: false };
      }
    }
    if (out.companionMode !== "expert" && out.companionMode !== "gentle") out.companionMode = "gentle";
    if (typeof out.activeStepIndex !== "number" || out.activeStepIndex < 0) out.activeStepIndex = 0;
    if (out.activeStepIndex > 7) out.activeStepIndex = 7;
    if (!out.ttCurves || typeof out.ttCurves !== "object") out.ttCurves = {};
    if (!out.graphsCreated || typeof out.graphsCreated !== "object") out.graphsCreated = {};
    if (!Array.isArray(out.customGraphs)) out.customGraphs = [];
    if (Array.isArray(out.timeline)) out.timeline = out.timeline.map(migrateTimelineItem);
    if (Array.isArray(out.results)) out.results = sortResults(out.results);
    if (!Array.isArray(out.contactMeasureLog)) {
      out.contactMeasureLog = Array.isArray(out.heatMeasureLog) ? out.heatMeasureLog : [];
    }
    delete out.heatMeasureLog;
    if (!out.aiComments || typeof out.aiComments !== "object") {
      out.aiComments = { mission: "", hypothesis: "", plan: "", reflection: "", summary: "" };
    }
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
        const toSave = { ...state };
        if (Array.isArray(toSave.results)) {
          toSave.results = sortResults(toSave.results);
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      } catch { /* quota */ }
    },

    clear() {
      localStorage.removeItem(STORAGE_KEY);
    },

    exportForSubmit(state) {
      return {
        exportedAt: new Date().toISOString(),
        simId: "heat_equilibrium",
        chapter: 12,
        ...state,
        results: sortResults(state.results || []),
        contactMeasureLog: (state.contactMeasureLog || []).map(migrateContactLog),
      };
    },

    sortResults,
    migrateResult,
    migrateContactLog,
    MATERIAL_NAMES,
  };

  global.InquiryStorage = InquiryStorage;
})(window);
