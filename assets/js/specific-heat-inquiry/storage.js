/**
 * 比熱シミュ — 探究モード LocalStorage
 */
(function (global) {
  "use strict";

  const STORAGE_KEY = "physlabo_specific_heat_inquiry_v1";

  const DEFAULT_STATE = {
    version: 2,
    missionId: "",
    hypothesisId: "",
    hypothesisFreeText: "",
    planId: "",
    aiComments: { mission: "", hypothesis: "", plan: "", reflection: "", summary: "" },
    question: "",
    hypothesis: "",
    hypothesisReason: "",
    planChecks: { material: true, mass: false, heatQ: false },
    planText: "",
    timeline: [],
    results: [],
    heatMeasureLog: [],
    graphCreatedWater: false,
    graphCreatedIron: false,
    graphsCreated: { water: false, iron: false, aluminum: false, air: false },
    qtCurves: {},
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
    return { type: "material", from: item.from, to: item.to, at: item.at };
  }

  const INTERVAL_ORDER = ["固体", "固体→液体", "液体", "液体→気体", "気体"];
  const MATERIAL_ORDER = ["water", "iron", "aluminum", "air"];

  function canonicalInterval(raw) {
    const s = String(raw ?? "").trim();
    if (!s || s === "—") return "—";
    if (s === "固体" || s === "固体（氷）") return "固体";
    if (s === "液体" || s === "液体（水）") return "液体";
    if (s === "気体" || s === "気体（水蒸気）") return "気体";
    if (s === "固体→液体" || s.includes("融解")) return "固体→液体";
    if (s === "液体→気体" || s.includes("沸騰")) return "液体→気体";
    if (s.includes("固体") && s.includes("液体")) return "固体→液体";
    if (s.includes("液体") && s.includes("気体")) return "液体→気体";
    if (s.includes("氷") && !s.includes("→")) return "固体";
    if (s.includes("蒸気") && !s.includes("→")) return "気体";
    return s;
  }

  function migrateResult(row) {
    if (!row) return row;
    const interval = canonicalInterval(row.interval ?? row.phase);
    return {
      materialKey: row.materialKey ?? "water",
      materialName: row.materialName ?? "水",
      mass: row.mass ?? 500,
      heatQ: row.heatQ ?? 2000,
      initialCelsius: row.initialCelsius ?? 0,
      finalCelsius: row.finalCelsius ?? 0,
      deltaT: Number(row.deltaT ?? 0),
      interval,
      segmentIndex: row.segmentIndex ?? 0,
      measureId: row.measureId ?? 0,
      segmentType: row.segmentType ?? "sensible",
      isPlateau: !!row.isPlateau || interval.includes("→"),
      phase: interval,
      cumulativeQ: row.cumulativeQ ?? 0,
      segmentHeatJ: row.segmentHeatJ ?? null,
    };
  }

  function sumHeatQByMeasure(rows) {
    const byMeasure = new Map();
    for (const r of rows) byMeasure.set(r.measureId, r.heatQ);
    let total = 0;
    for (const q of byMeasure.values()) total += Number(q) || 0;
    return total;
  }

  function mergeResultGroup(rows) {
    if (!rows || rows.length === 0) return null;
    if (rows.length === 1) return { ...rows[0] };

    const first = rows[0];
    const last = rows[rows.length - 1];
    const round1 = (v) => Math.round(v * 10) / 10;
    const isPlateau = first.isPlateau || String(first.interval || "").includes("→");

    if (isPlateau) {
      return {
        ...first,
        heatQ: sumHeatQByMeasure(rows),
        segmentHeatJ: Math.round(rows.reduce((sum, r) => sum + (Number(r.segmentHeatJ) || 0), 0)),
        initialCelsius: round1(first.initialCelsius),
        finalCelsius: round1(last.finalCelsius),
        deltaT: 0,
        isPlateau: true,
        measureId: last.measureId,
        mergedCount: rows.length,
      };
    }

    const initial = Number(first.initialCelsius);
    const final = Number(last.finalCelsius);
    return {
      ...first,
      heatQ: sumHeatQByMeasure(rows),
      segmentHeatJ: Math.round(rows.reduce((sum, r) => sum + (Number(r.segmentHeatJ) || 0), 0)),
      initialCelsius: round1(initial),
      finalCelsius: round1(final),
      deltaT: round1(final - initial),
      isPlateau: false,
      measureId: last.measureId,
      mergedCount: rows.length,
    };
  }

  function mergeResultsByInterval(results) {
    if (!Array.isArray(results) || results.length === 0) return [];

    const indexed = results.map((raw, i) => ({ r: migrateResult(raw), i }));
    const groups = new Map();

    for (const item of indexed) {
      const key = item.r.materialKey + "\0" + item.r.interval;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }

    const merged = [];
    for (const items of groups.values()) {
      items.sort((a, b) => a.i - b.i);
      const row = mergeResultGroup(items.map((x) => x.r));
      if (row) merged.push(row);
    }

    merged.sort((a, b) => {
      const ma = MATERIAL_ORDER.indexOf(a.materialKey) - MATERIAL_ORDER.indexOf(b.materialKey);
      if (ma !== 0) return ma;
      const ia = INTERVAL_ORDER.indexOf(a.interval);
      const ib = INTERVAL_ORDER.indexOf(b.interval);
      const oa = ia >= 0 ? ia : 999;
      const ob = ib >= 0 ? ib : 999;
      if (oa !== ob) return oa - ob;
      return String(a.interval).localeCompare(String(b.interval), "ja");
    });

    return merged;
  }

  function migrateState(state) {
    const out = { ...state };
    if (out.planChecks) {
      if ("temperature" in out.planChecks || "particleSize" in out.planChecks) {
        out.planChecks = { material: true, mass: false, heatQ: false };
      }
    }
    if (out.hypothesis === "water_slower") out.hypothesis = "water_faster";
    if (out.companionMode !== "expert" && out.companionMode !== "gentle") out.companionMode = "gentle";
    if (typeof out.activeStepIndex !== "number" || out.activeStepIndex < 0) out.activeStepIndex = 0;
    if (out.activeStepIndex > 7) out.activeStepIndex = 7;
    if (out.graphCreated && !out.graphCreatedWater) out.graphCreatedWater = !!out.graphCreated;
    if (out.graphCreatedDeltaT) out.graphCreatedWater = !!out.graphCreatedDeltaT;
    if (out.graphCreatedQT) out.graphCreatedIron = !!out.graphCreatedQT;
    delete out.graphCreated;
    delete out.graphCreatedDeltaT;
    delete out.graphCreatedQT;
    if (!out.qtCurves || typeof out.qtCurves !== "object") {
      out.qtCurves = {};
    }
    if (!out.graphsCreated || typeof out.graphsCreated !== "object") {
      out.graphsCreated = { water: false, iron: false, aluminum: false, air: false };
    }
    if (!Array.isArray(out.customGraphs)) out.customGraphs = [];
    if (out.graphCreatedWater) out.graphsCreated.water = true;
    if (out.graphCreatedIron) out.graphsCreated.iron = true;
    out.graphCreatedWater = !!out.graphsCreated.water;
    out.graphCreatedIron = !!out.graphsCreated.iron;
    if (Array.isArray(out.timeline)) out.timeline = out.timeline.map(migrateTimelineItem);
    if (Array.isArray(out.results)) out.results = mergeResultsByInterval(out.results);
    if (!Array.isArray(out.heatMeasureLog)) out.heatMeasureLog = [];
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
          toSave.results = mergeResultsByInterval(toSave.results);
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
        simId: "specific_heat_capacity",
        chapter: 12,
        ...state,
        results: mergeResultsByInterval(state.results || []),
      };
    },

    mergeResultsByInterval,
    migrateResult,
    canonicalInterval,
  };

  global.InquiryStorage = InquiryStorage;
})(window);
