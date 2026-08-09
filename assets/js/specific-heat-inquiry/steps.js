/**
 * 探究モード — 各STEPコンポーネント
 * 将来: PDF/提出/AI添削は各 Step の exportData() を集約
 */
(function (global) {
  "use strict";

  class BaseStep {
    constructor(id, num, title) {
      this.id = id;
      this.num = num;
      this.title = title;
      this.el = null;
    }

    createCardShell(active) {
      const card = document.createElement("section");
      card.className = "inquiry-card" + (active ? " active-card" : "");
      card.dataset.stepId = this.id;
      card.innerHTML =
        '<div class="inquiry-card-head">' +
        '<span class="inquiry-card-num">' + this.num + "</span>" +
        '<h4 class="inquiry-card-title"></h4>' +
        '<span class="inquiry-card-check" aria-hidden="true">✓</span>' +
        "</div>" +
        '<div class="inquiry-card-body"></div>';
      card.querySelector(".inquiry-card-title").textContent = this.title;
      this.el = card;
      this.body = card.querySelector(".inquiry-card-body");
      return card;
    }

    setDone(done) {
      if (!this.el) return;
      this.el.classList.toggle("done-card", done);
      this.el.classList.toggle("active-card", !done);
    }

    scrollIntoView() {
      this.el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    appendConfirmRow(actions) {
      if (!actions?.onConfirm) return;
      const row = document.createElement("div");
      row.className = "inquiry-step-confirm-row";
      const hint = document.createElement("p");
      hint.className = "inquiry-step-confirm-hint";
      hint.setAttribute("aria-live", "polite");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "inquiry-step-confirm-btn";
      const isLast = this.id === "summary";
      btn.textContent = actions.confirmLabel || (isLast ? "決定 → 探究完了" : "決定 → 次へ");
      btn.addEventListener("click", () => actions.onConfirm(this.id, hint, btn));
      row.appendChild(hint);
      row.appendChild(btn);
      this.body.appendChild(row);
      this.confirmHint = hint;
      this.confirmBtn = btn;
    }

    exportData() { return {}; }
  }

  const MATERIAL_NAMES = { water: "水", iron: "鉄", aluminum: "アルミ", air: "空気" };

  const GRAPH_MATERIAL_ORDER = ["water", "iron", "aluminum", "air"];

  const GRAPH_MATERIAL_CONFIG = {
    water: { name: "水", lineColor: "#22d3ee", dotColor: "#67e8f9", showPlateaus: true, meltAt: 0, boilAt: 100, reportNote: "融解・沸騰の平台" },
    iron: { name: "鉄", lineColor: "#fb923c", dotColor: "#fdba74", showPlateaus: true, meltAt: 1538, boilAt: 2862, reportNote: "融点1538℃の平台" },
    aluminum: { name: "アルミ", lineColor: "#a78bfa", dotColor: "#c4b5fd", showPlateaus: true, meltAt: 660, boilAt: 2467, reportNote: "融点660℃の平台" },
    air: { name: "空気", lineColor: "#94a3b8", dotColor: "#cbd5e1", showPlateaus: false, reportNote: "Q = mcΔT" },
  };

  const QT_PLATEAU_STYLE = {
    melt: {
      lineColor: "#c084fc",
      dotColor: "#d8b4fe",
      fillColor: "rgba(192, 132, 252, 0.22)",
      reportFill: "rgba(126, 34, 206, 0.12)",
      reportLine: "#7c3aed",
      reportDot: "#6d28d9",
      label: "融解",
      marker: "○",
    },
    boil: {
      lineColor: "#fb923c",
      dotColor: "#fdba74",
      fillColor: "rgba(251, 146, 60, 0.22)",
      reportFill: "rgba(234, 88, 12, 0.14)",
      reportLine: "#ea580c",
      reportDot: "#c2410c",
      label: "沸騰",
      marker: "△",
    },
  };

  function getGraphTargets(state) {
    const keys = new Set();
    (state?.results || []).forEach((r) => {
      if (r?.materialKey) keys.add(r.materialKey);
    });
    Object.entries(state?.qtCurves || {}).forEach(([k, pts]) => {
      if (Array.isArray(pts) && pts.length > 0) keys.add(k);
    });
    (state?.heatMeasureLog || []).forEach((row) => {
      if (row?.materialKey) keys.add(row.materialKey);
    });
    return GRAPH_MATERIAL_ORDER.filter((k) => keys.has(k));
  }

  function normalizeGraphsCreated(state) {
    const out = { water: false, iron: false, aluminum: false, air: false };
    if (state?.graphsCreated && typeof state.graphsCreated === "object") {
      Object.assign(out, state.graphsCreated);
    }
    if (state?.graphCreatedWater) out.water = true;
    if (state?.graphCreatedIron) out.iron = true;
    return out;
  }

  function syncLegacyGraphFlags(state) {
    if (!state) return;
    state.graphsCreated = normalizeGraphsCreated(state);
    state.graphCreatedWater = !!state.graphsCreated.water;
    state.graphCreatedIron = !!state.graphsCreated.iron;
  }

  const CUSTOM_GRAPH_AXES = {
    heatQ: { label: "加熱量 Q", unit: "J", preferChart: "line", getValue: (r) => Number(r.heatQ) },
    mass: { label: "質量 m", unit: "g", preferChart: "line", getValue: (r) => Number(r.mass) },
    measureRound: { label: "測定回", unit: "回", preferChart: "bar", getValue: (r) => Number(r.measureRound) },
    cumulativeQ: { label: "累積 Q", unit: "J", preferChart: "line", getValue: (r) => Number(r.cumulativeQ) },
    interval: { label: "区間・状態", unit: "", categorical: true, preferChart: "bar", getValue: (r) => String(r.interval ?? "—") },
    deltaT: { label: "温度上昇 ΔT", unit: "℃", getValue: (r) => Number(r.deltaT ?? r.sessionDeltaT) },
    initialCelsius: { label: "加熱前 T", unit: "℃", getValue: (r) => Number(r.initialCelsius ?? r.sessionStartCelsius) },
    finalCelsius: { label: "加熱後 T", unit: "℃", getValue: (r) => Number(r.finalCelsius ?? r.sessionEndCelsius ?? r.tempC) },
  };

  const CUSTOM_GRAPH_X_KEYS = ["heatQ", "mass", "measureRound", "cumulativeQ", "interval"];
  const CUSTOM_GRAPH_Y_KEYS = ["deltaT", "initialCelsius", "finalCelsius"];

  function resolveCustomGraphChartType(graphDef, xDef, categorical) {
    if (categorical || xDef?.preferChart === "bar") return "bar";
    if (xDef?.preferChart === "line") return "line";
    return "line";
  }

  function customGraphChartTypeLabel(chartType) {
    return chartType === "bar" ? "棒グラフ" : "折れ線グラフ";
  }

  function getCustomGraphRows(state, materialKey, xKey) {
    const sessionKeys = ["measureRound", "cumulativeQ"];
    if (sessionKeys.includes(xKey)) {
      return normalizeMeasureLog(state?.heatMeasureLog).filter((r) => r.materialKey === materialKey);
    }
    if (xKey === "interval") {
      return getMergedResults(state?.results || []).filter((r) => r.materialKey === materialKey);
    }
    const intervalRows = getMergedResults(state?.results || []).filter((r) => r.materialKey === materialKey);
    if (intervalRows.length >= 2) return intervalRows;
    return normalizeMeasureLog(state?.heatMeasureLog).filter((r) => r.materialKey === materialKey);
  }

  function buildCustomGraphPoints(state, graphDef) {
    const xKey = graphDef.xKey;
    const yKey = graphDef.yKey;
    const xDef = CUSTOM_GRAPH_AXES[xKey];
    const yDef = CUSTOM_GRAPH_AXES[yKey];
    if (!xDef || !yDef) return { points: [], categorical: false, catLabels: [], chartType: "line" };

    const rows = getCustomGraphRows(state, graphDef.materialKey, xKey);
    if (!rows.length) return { points: [], categorical: false, catLabels: [], chartType: "line" };

    if (xDef.categorical) {
      const seen = new Set();
      const points = [];
      rows.forEach((r) => {
        const cat = xDef.getValue(r);
        if (seen.has(cat)) return;
        seen.add(cat);
        const y = yDef.getValue(r);
        if (!Number.isFinite(y)) return;
        points.push({ x: points.length, y, xLabel: cat });
      });
      const catLabels = points.map((p) => p.xLabel);
      return { points, categorical: true, catLabels, chartType: "bar" };
    }

    const points = rows.map((r) => ({ x: xDef.getValue(r), y: yDef.getValue(r) }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
      .sort((a, b) => a.x - b.x);
    return {
      points,
      categorical: false,
      catLabels: [],
      chartType: resolveCustomGraphChartType(graphDef, xDef, false),
    };
  }

  function getCustomGraphCaption(graphDef) {
    const mat = GRAPH_MATERIAL_CONFIG[graphDef.materialKey]?.name || MATERIAL_NAMES[graphDef.materialKey] || graphDef.materialKey;
    const xDef = CUSTOM_GRAPH_AXES[graphDef.xKey];
    const yDef = CUSTOM_GRAPH_AXES[graphDef.yKey];
    return mat + "（横：" + (xDef?.label || graphDef.xKey) + " · 縦：" + (yDef?.label || graphDef.yKey) + "）";
  }

  function barChartXDomain(points, categorical) {
    const n = points.length;
    if (categorical) {
      return { xMin: -0.5, xMax: Math.max(0.5, n - 0.5) };
    }
    const lo = Math.min(...points.map((p) => p.x));
    const hi = Math.max(...points.map((p) => p.x));
    return { xMin: lo - 0.5, xMax: hi + 0.5 };
  }

  function drawCustomBarSeries(ctx, points, tx, ty, opts) {
    const { yMin, yMax, lineColor, dotColor, reportMode } = opts;
    const yBase = (yMin <= 0 && yMax >= 0) ? 0 : yMin;
    const y0 = ty(yBase);
    const n = points.length;
    const slot = Math.max(1, n);
    const barW = Math.min(opts.barSlotW * 0.62, reportMode ? 36 : 44);

    points.forEach((p) => {
      const cx = tx(p.x);
      const yTop = ty(p.y);
      const top = Math.min(y0, yTop);
      const height = Math.max(1, Math.abs(yTop - y0));
      ctx.fillStyle = reportMode
        ? (dotColor || lineColor || "#0891b2")
        : (lineColor || "#22d3ee") + "cc";
      ctx.fillRect(cx - barW / 2, top, barW, height);
      if (!reportMode) {
        ctx.strokeStyle = dotColor || lineColor || "#67e8f9";
        ctx.lineWidth = 1;
        ctx.strokeRect(cx - barW / 2, top, barW, height);
      }
    });
  }

  function drawCustomDataGraph(canvas, state, graphDef, opts) {
    if (!canvas || !graphDef) return false;
    const o = opts || {};
    const built = buildCustomGraphPoints(state, graphDef);
    const { points, categorical, catLabels, chartType } = built;
    const xDef = CUSTOM_GRAPH_AXES[graphDef.xKey];
    const yDef = CUSTOM_GRAPH_AXES[graphDef.yKey];
    const cfg = GRAPH_MATERIAL_CONFIG[graphDef.materialKey] || {};

    const wrap = canvas.parentElement;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = o.reportMode ? (o.width || wrap?.clientWidth || 480) : Math.max(280, wrap?.clientWidth || 280);
    const h = o.height || 220;
    const ctx = canvas.getContext("2d");
    if (o.reportMode) {
      canvas.width = w;
      canvas.height = h;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    } else {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const pad = o.reportMode ? { ...REPORT_CHART_PAD } : { l: 52, r: 16, t: 22, b: 48 };
    if (categorical) pad.b = Math.max(pad.b, 56);
    if (o.reportMode) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
    } else {
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, "#0a1020");
      bg.addColorStop(1, "#0c1528");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
    }

    const minPoints = chartType === "bar" ? 1 : 2;
    if (points.length < minPoints) {
      ctx.fillStyle = o.reportMode ? "#64748b" : "#64748b";
      ctx.font = "12px Inter, Noto Sans JP, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(o.emptyMsg || "この条件ではグラフにするデータが不足しています", w / 2, h / 2);
      return false;
    }

    let xMin; let xMax; let yMin; let yMax;
    if (categorical) {
      ({ xMin, xMax } = barChartXDomain(points, true));
      yMin = Math.min(...points.map((p) => p.y));
      yMax = Math.max(...points.map((p) => p.y));
    } else if (chartType === "bar") {
      ({ xMin, xMax } = barChartXDomain(points, false));
      yMin = Math.min(...points.map((p) => p.y));
      yMax = Math.max(...points.map((p) => p.y));
    } else {
      xMin = Math.min(...points.map((p) => p.x));
      xMax = Math.max(...points.map((p) => p.x));
      yMin = Math.min(...points.map((p) => p.y));
      yMax = Math.max(...points.map((p) => p.y));
      if (xMin === xMax) { xMin -= 1; xMax += 1; }
    }
    let span = Math.max(yMax - yMin, 1);
    yMin -= span * 0.1;
    yMax += span * 0.12;

    if (o.reportMode) {
      const dataYMin = Math.min(...points.map((p) => p.y));
      const dataYMax = Math.max(...points.map((p) => p.y));
      const ySnap = snapReportNumericRange(yMin, yMax);
      yMin = Math.min(ySnap.min, dataYMin);
      yMax = Math.max(ySnap.max, dataYMax);
      if (!categorical) {
        const dataXMin = Math.min(...points.map((p) => p.x));
        const dataXMax = Math.max(...points.map((p) => p.x));
        const xSnap = snapReportNumericRange(xMin, xMax);
        xMin = Math.min(xSnap.min, dataXMin);
        xMax = Math.max(xSnap.max, dataXMax);
      }
    }

    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;
    const tx = (X) => pad.l + ((X - xMin) / Math.max(xMax - xMin, 1)) * plotW;
    const ty = (Y) => pad.t + plotH * (1 - (Y - yMin) / Math.max(yMax - yMin, 1));
    const axisCatKeys = categorical ? points.map((p) => p.xLabel || catLabels[p.x] || "") : catLabels;

    const axis = { xLabel: xDef.label, xUnit: xDef.unit || "", xKey: graphDef.xKey, yLabel: yDef.label, yUnit: yDef.unit || "" };
    const axisOpts = {
      w, h, pad, xMin, xMax, yMin, yMax, axis, tx, vy: ty,
      categorical, catKeys: categorical ? axisCatKeys : null,
      yAxisLabel: yDef.label + (yDef.unit ? "（" + yDef.unit + "）" : ""),
    };

    if (o.reportMode) {
      drawReportChartAxes(ctx, {
        w, h, pad, xMin, xMax, yMin, yMax,
        axis: { xLabel: xDef.label, xUnit: xDef.unit || "" },
        tx, vy: ty,
        yAxisLabel: yDef.label + (yDef.unit ? "（" + yDef.unit + "）" : ""),
        categorical, catKeys: categorical ? axisCatKeys : null,
      });
    } else {
      drawChartAxes(ctx, axisOpts);
    }

    const lineColor = cfg.lineColor || o.lineColor || "#22d3ee";
    const dotColor = cfg.dotColor || o.dotColor || "#67e8f9";

    if (chartType === "bar") {
      drawClippedSeries(ctx, pad, plotW, plotH, () => {
        drawCustomBarSeries(ctx, points, tx, ty, {
          yMin, yMax, lineColor, dotColor, reportMode: !!o.reportMode,
          barSlotW: plotW / Math.max(xMax - xMin, 1),
        });
      });
      return true;
    }

    const strokeSeries = () => {
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = o.reportMode ? 2 : 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (!o.reportMode) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = lineColor;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.beginPath();
      ctx.moveTo(tx(points[0].x), ty(points[0].y));
      for (let i = 1; i < points.length; i += 1) {
        ctx.lineTo(tx(points[i].x), ty(points[i].y));
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = dotColor;
      points.forEach((p) => {
        ctx.beginPath();
        ctx.arc(tx(p.x), ty(p.y), o.reportMode ? 2.5 : 3, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    if (o.reportMode) {
      drawClippedSeries(ctx, pad, plotW, plotH, strokeSeries);
    } else {
      strokeSeries();
    }
    return true;
  }

  /** 探究画面グラフの目盛り目標本数 */
  const AXIS_TICK_TARGET = 7;
  /** 実験レポート — Q 軸を kJ 表示に切り替えるしきい値（J） */
  const REPORT_Q_KJ_THRESHOLD = 15000;

  function snapReportAxisRange(qMin, qMax, tMin, tMax, dataBounds) {
    const db = dataBounds || {};
    const qTicks = buildTicks(Math.max(0, qMin), Math.max(qMax, 100), AXIS_TICK_TARGET);
    let qMinOut = Math.max(0, qMin);
    let qMaxOut = Math.max(qTicks[qTicks.length - 1] ?? qMax, qMinOut + 1);

    if (Number.isFinite(db.qMin)) qMinOut = Math.min(qMinOut, db.qMin);
    if (Number.isFinite(db.qMax)) qMaxOut = Math.max(qMaxOut, db.qMax);
    if (qMaxOut - qMinOut < 1) qMaxOut = qMinOut + 1;

    const temp = snapReportTemperatureAxis(tMin, tMax, db, REPORT_TEMP_TICK_STEP);
    return { qMin: qMinOut, qMax: qMaxOut, tMin: temp.tMin, tMax: temp.tMax };
  }

  /** 実験レポート Q–T グラフ — 温度軸は 50 ℃ 刻み（負の値も同様） */
  const REPORT_TEMP_TICK_STEP = 50;

  function snapReportTemperatureAxis(tMin, tMax, dataBounds, step) {
    const tickStep = step || REPORT_TEMP_TICK_STEP;
    const db = dataBounds || {};
    const lo = Math.min(tMin, Number.isFinite(db.tMin) ? db.tMin : tMin);
    const hi = Math.max(tMax, Number.isFinite(db.tMax) ? db.tMax : tMax);
    let tMinOut = Math.floor(lo / tickStep) * tickStep;
    let tMaxOut = Math.ceil(hi / tickStep) * tickStep;
    if (tMaxOut - tMinOut < tickStep) tMaxOut = tMinOut + tickStep;
    return { tMin: tMinOut, tMax: tMaxOut };
  }

  function buildFixedStepTicks(min, max, step) {
    const tickStep = Math.max(step || 1, 1e-6);
    const start = Math.floor(min / tickStep) * tickStep;
    const end = Math.ceil(max / tickStep) * tickStep;
    const ticks = [];
    for (let v = start; v <= end + tickStep * 0.001; v += tickStep) {
      ticks.push(Math.round(v * 1e6) / 1e6);
    }
    return ticks.length ? ticks : [min, max];
  }

  function qtDataBounds(pts) {
    if (!pts?.length) return { qMin: 0, qMax: 1, tMin: 0, tMax: 1 };
    return {
      qMin: Math.min(...pts.map((p) => p.x)),
      qMax: Math.max(...pts.map((p) => p.x)),
      tMin: Math.min(...pts.map((p) => p.y)),
      tMax: Math.max(...pts.map((p) => p.y)),
    };
  }

  function snapReportNumericRange(min, max) {
    const ticks = buildTicks(min, max, AXIS_TICK_TARGET);
    return {
      min: ticks[0] ?? min,
      max: ticks[ticks.length - 1] ?? max,
    };
  }

  function formatReportTickValue(value, rangeMax, unit) {
    if (!Number.isFinite(value)) return "";
    if (unit === "J" && rangeMax > REPORT_Q_KJ_THRESHOLD) {
      return String(Math.round(value / 1000));
    }
    const abs = Math.abs(value);
    if (abs >= 1000) return Math.round(value).toLocaleString("ja-JP");
    if (abs >= 100 || abs === 0) return String(Math.round(value));
    if (abs >= 10) return value.toFixed(1);
    return value.toFixed(2);
  }

  function formatReportYTick(v) {
    return String(Math.round(v));
  }

  function reportXAxisTitle(axis, xMax) {
    const useKJ = (axis.xUnit === "J" || String(axis.xLabel || "").includes("Q")) && xMax > REPORT_Q_KJ_THRESHOLD;
    if (useKJ) return axis.xLabel + "（×10³ J）";
    return axis.xLabel + (axis.xUnit ? "（" + axis.xUnit + "）" : "");
  }

  /** 実験レポート — グラフ余白（目盛りラベル用に下側を広めに確保） */
  const REPORT_CHART_PAD = { l: 68, r: 28, t: 16, b: 56 };

  function buildTicks(min, max, targetCount) {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
    if (Math.abs(max - min) < 1e-6) return [min, max];
    const span = max - min;
    const target = Math.max(4, targetCount || AXIS_TICK_TARGET);

    const rough = span / Math.max(target - 1, 1);
    const pow = Math.pow(10, Math.floor(Math.log10(Math.max(rough, 1e-6))));
    const multipliers = [1, 2, 2.5, 5, 10];
    let step = multipliers[multipliers.length - 1] * pow;
    for (const m of multipliers) {
      const s = m * pow;
      if (span / s <= target + 1) {
        step = s;
        break;
      }
    }

    const start = min <= 0 && max >= 0 ? 0 : Math.ceil(min / step) * step;
    const ticks = [];
    for (let v = start; v <= max + step * 0.001; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
    if (ticks.length === 0) ticks.push(min, max);
    if (min <= 0 && max >= 0 && !ticks.some((v) => Math.abs(v) < 1e-9)) ticks.unshift(0);
    return ticks;
  }

  function buildReportTicks(min, max, targetCount, opts) {
    const o = opts || {};
    let ticks = buildTicks(min, max, targetCount)
      .filter((v) => v >= min - 1e-6 && v <= max + 1e-6);
    if (o.forceZero && min <= 0 && max > 0 && !ticks.some((v) => Math.abs(v) < 1e-9)) {
      ticks.unshift(0);
    }
    if (ticks.length < 3) {
      const n = 4;
      ticks = [];
      for (let i = 0; i <= n; i += 1) {
        ticks.push(Math.round((min + (max - min) * (i / n)) * 1000) / 1000);
      }
    }
    return ticks;
  }

  const HYPOTHESIS_LABELS = {
    water_faster: "水のほうがΔTは大きい（温まりやすい）",
    iron_faster: "鉄の方がΔTは大きい（温まりやすい）",
    same_if_mass: "質量が同じなら物質に関係なくΔTは同じ",
  };

  function wireCompanion(fieldEl, field, getContext) {
    if (!global.InquiryCompanion?.attach || !fieldEl) {
      console.warn("[伴走AI] companion.js が読み込まれていません");
      return null;
    }
    const fieldWrap = fieldEl.closest(".inquiry-field") || fieldEl.parentElement;
    return InquiryCompanion.attach(fieldWrap, {
      field,
      inputEl: fieldEl,
      getText: () => fieldEl.value || "",
      getContext: getContext || (() => ({})),
    });
  }

  function wireCompanionWrap(wrapEl, field, getText, getContext) {
    if (!global.InquiryCompanion?.attach || !wrapEl) return null;
    return InquiryCompanion.attach(wrapEl, {
      field,
      getText: getText || (() => ""),
      getContext: getContext || (() => ({})),
    });
  }

  function renderChoiceGrid(container, items, selectedId, nameAttr) {
    container.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "inquiry-choice-grid";
    items.forEach((item) => {
      const card = document.createElement("label");
      card.className = "inquiry-choice-card" + (selectedId === item.id ? " selected" : "");
      card.innerHTML =
        '<input type="radio" name="' + nameAttr + '" value="' + item.id + '"' +
        (selectedId === item.id ? " checked" : "") + ">" +
        '<span class="inquiry-choice-title">' + item.title + "</span>" +
        (item.description ? '<span class="inquiry-choice-desc">' + item.description + "</span>" : "") +
        (item.reason ? '<span class="inquiry-choice-reason">根拠：' + item.reason + "</span>" : "") +
        (item.compare ? '<span class="inquiry-choice-compare">比較：' + item.compare + "</span>" : "") +
        (item.purpose ? '<span class="inquiry-choice-purpose">ねらい：' + item.purpose + "</span>" : "");
      grid.appendChild(card);
    });
    container.appendChild(grid);
    return grid;
  }

  function wireChoiceGrid(grid, onSelect) {
    grid.querySelectorAll('input[type="radio"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        grid.querySelectorAll(".inquiry-choice-card").forEach((c) => c.classList.remove("selected"));
        radio.closest(".inquiry-choice-card")?.classList.add("selected");
        onSelect(radio.value);
      });
    });
  }

  class StepQuestion extends BaseStep {
    constructor() { super("question", "①", "問い（ミッション）"); }

    mount(parent, state, onChange, actions) {
      const card = this.createCardShell(true);
      this.body.innerHTML =
        '<p class="inquiry-card-desc">達成したい探究の問い（ミッション）を1つ選びましょう。選んだ問いはあとから変えられます。</p>' +
        '<div id="inquiryMissionChoices"></div>';
      parent.appendChild(card);

      const missions = global.InquiryMissions?.getAllMissions?.() || [];
      const grid = renderChoiceGrid(
        this.body.querySelector("#inquiryMissionChoices"),
        missions.map((m) => ({ id: m.id, title: m.title, description: m.description })),
        state.missionId,
        "inquiryMission"
      );
      wireChoiceGrid(grid, (id) => {
        const defaults = global.InquiryMissions?.DEFAULT_PLAN_CHECKS || { material: true, mass: false, heatQ: false };
        onChange({
          missionId: id,
          hypothesisId: "",
          planId: "",
          planText: "",
          planChecks: { ...defaults },
        });
        this.companion?.refresh?.();
      });

      this.companion = wireCompanionWrap(
        this.body,
        "mission",
        () => {
          const id = this.body.querySelector('input[name="inquiryMission"]:checked')?.value || state.missionId || "";
          const m = global.InquiryMissions?.getMission(id);
          return m ? m.title + " " + m.description : "";
        },
        () => ({ step: "mission", missionId: state.missionId })
      );

      this.appendConfirmRow(actions);
      return this;
    }

    isComplete(state) {
      return !!state.missionId;
    }

    exportData(state) {
      const m = global.InquiryMissions?.getMission(state.missionId);
      return {
        missionId: state.missionId,
        question: m ? m.title + " — " + m.description : state.question,
      };
    }
  }

  class StepHypothesis extends BaseStep {
    constructor() { super("hypothesis", "②", "仮説"); }

    mount(parent, state, onChange, actions) {
      const card = this.createCardShell(false);
      const mission = global.InquiryMissions?.getMission(state.missionId);
      this.body.innerHTML =
        '<p class="inquiry-card-desc" id="inquiryHypMissionLead">' +
        (mission ? "ミッション「" + mission.title + "」に関する仮説を選びましょう。各選択肢の根拠も読んでください。" : "先に①でミッションを選んでください。") +
        "</p>" +
        '<div id="inquiryHypChoices"></div>' +
        '<div class="inquiry-field" style="margin-top:10px"><label for="inqHypFree">一言で補足（任意）</label>' +
        '<input type="text" class="inquiry-text-input" id="inqHypFree" maxlength="120" placeholder="例：水の方が温度が上がりにくいと思う"></div>';
      parent.appendChild(card);

      const hyps = global.InquiryMissions?.getHypothesesForMission(state.missionId) || [];
      const grid = renderChoiceGrid(
        this.body.querySelector("#inquiryHypChoices"),
        hyps.map((h) => ({ id: h.id, title: h.text, reason: h.reason })),
        state.hypothesisId,
        "inquiryHypothesis"
      );
      wireChoiceGrid(grid, (id) => {
        const h = global.InquiryMissions?.getHypothesis(id);
        onChange({ hypothesisId: id, hypothesis: h?.legacyKey || "" });
        this.companion?.refresh?.();
      });

      const freeEl = this.body.querySelector("#inqHypFree");
      freeEl.value = state.hypothesisFreeText || "";
      freeEl.addEventListener("input", () => {
        onChange({ hypothesisFreeText: freeEl.value });
        this.companion?.refresh?.();
      });

      this.companion = wireCompanionWrap(
        this.body,
        "hypothesis",
        () => {
          const id = this.body.querySelector('input[name="inquiryHypothesis"]:checked')?.value || state.hypothesisId || "";
          const h = global.InquiryMissions?.getHypothesis(id);
          const free = this.body.querySelector("#inqHypFree")?.value || state.hypothesisFreeText || "";
          return (h?.text || "") + (h?.reason ? " 根拠：" + h.reason : "") + (free ? " （" + free + "）" : "");
        },
        () => {
          const id = this.body.querySelector('input[name="inquiryHypothesis"]:checked')?.value || state.hypothesisId || "";
          return {
            step: "hypothesis",
            missionId: state.missionId,
            hypothesisId: id,
            hypothesisLabel: global.InquiryMissions?.getHypothesis(id)?.text || "",
          };
        }
      );

      this.appendConfirmRow(actions);
      this._onChange = onChange;
      this._state = state;
      return this;
    }

    remountChoices(state, onChange) {
      if (onChange) this._onChange = onChange;
      if (state) this._state = state;
      const st = this._state || state || {};
      const change = this._onChange || onChange;
      const mission = global.InquiryMissions?.getMission(st.missionId);
      const lead = this.body?.querySelector("#inquiryHypMissionLead");
      if (lead) {
        lead.textContent = mission
          ? "ミッション「" + mission.title + "」に関する仮説を選びましょう。各選択肢の根拠も読んでください。"
          : "先に①でミッションを選んでください。";
      }
      const container = this.body?.querySelector("#inquiryHypChoices");
      if (!container || !change) return;
      const hyps = global.InquiryMissions?.getHypothesesForMission(st.missionId) || [];
      const grid = renderChoiceGrid(
        container,
        hyps.map((h) => ({ id: h.id, title: h.text, reason: h.reason })),
        st.hypothesisId,
        "inquiryHypothesis"
      );
      wireChoiceGrid(grid, (id) => {
        const h = global.InquiryMissions?.getHypothesis(id);
        change({ hypothesisId: id, hypothesis: h?.legacyKey || "" });
        this.companion?.refresh?.();
      });
    }

    isComplete(state) {
      return !!state.missionId && !!state.hypothesisId;
    }

    exportData(state) {
      const h = global.InquiryMissions?.getHypothesis(state.hypothesisId);
      return {
        missionId: state.missionId,
        hypothesisId: state.hypothesisId,
        hypothesisFreeText: state.hypothesisFreeText,
        hypothesis: state.hypothesis,
        hypothesisReason: state.hypothesisFreeText || state.hypothesisReason,
        hypothesisText: h?.text || "",
      };
    }
  }

  const TIMELINE_META = {
    material: { label: "物質", fmt: (v) => MATERIAL_NAMES[v] || String(v) },
    mass: { label: "質量", fmt: (v) => v + " g" },
    heatQ: { label: "加熱量 Q", fmt: (v) => v + " J" },
  };

  function normalizeResult(r) {
    if (global.InquiryStorage?.migrateResult) return global.InquiryStorage.migrateResult(r);
    return {
      materialKey: r.materialKey ?? "water",
      materialName: r.materialName ?? MATERIAL_NAMES[r.materialKey] ?? "水",
      mass: r.mass ?? 500,
      heatQ: r.heatQ ?? 2000,
      initialCelsius: r.initialCelsius ?? 0,
      finalCelsius: r.finalCelsius ?? 0,
      deltaT: Number(r.deltaT ?? 0),
      interval: r.interval ?? r.phase ?? "—",
      segmentIndex: r.segmentIndex ?? 0,
      measureId: r.measureId ?? 0,
      segmentType: r.segmentType ?? "sensible",
      isPlateau: !!r.isPlateau,
      phase: r.phase ?? "—",
      cumulativeQ: r.cumulativeQ ?? 0,
      segmentHeatJ: r.segmentHeatJ ?? null,
    };
  }

  function getMergedResults(results) {
    if (global.InquiryStorage?.mergeResultsByInterval) {
      return global.InquiryStorage.mergeResultsByInterval(results || []);
    }
    return (results || []).map(normalizeResult);
  }

  function getGraphAxis(planChecks) {
    const c = planChecks || {};
    if (c.material !== false) {
      return {
        xKey: "materialKey", xLabel: "物質", xUnit: "",
        fmtX: (v) => MATERIAL_NAMES[v] || v, categorical: true,
      };
    }
    if (c.mass) {
      return { xKey: "mass", xLabel: "質量", xUnit: "g", fmtX: (v) => Math.round(v) + " g" };
    }
    if (c.heatQ) {
      return { xKey: "heatQ", xLabel: "加熱量 Q", xUnit: "J", fmtX: (v) => Math.round(v) + " J" };
    }
    return {
      xKey: "materialKey", xLabel: "物質", xUnit: "",
      fmtX: (v) => MATERIAL_NAMES[v] || v, categorical: true,
    };
  }

  function formatYTick(v) {
    if (v === 0) return "0";
    if (Math.abs(v) < 10) return v.toFixed(1);
    return String(Math.round(v));
  }

  function drawChartAxes(ctx, opts) {
    const { w, h, pad, xMin, xMax, yMin, yMax, axis, tx, vy } = opts;
    const xTicks = opts.categorical && opts.catKeys?.length
      ? opts.catKeys.map((_, i) => i)
      : buildTicks(xMin, xMax, AXIS_TICK_TARGET);
    const yTicks = buildTicks(yMin, yMax, AXIS_TICK_TARGET);

    ctx.strokeStyle = "rgba(148,163,184,0.15)";
    ctx.lineWidth = 1;
    yTicks.forEach((yv) => {
      const y = vy(yv);
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();
    });
    xTicks.forEach((xv) => {
      const x = tx(xv);
      ctx.beginPath();
      ctx.moveTo(x, pad.t);
      ctx.lineTo(x, h - pad.b);
      ctx.stroke();
    });

    ctx.strokeStyle = "rgba(148,163,184,0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t);
    ctx.lineTo(pad.l, h - pad.b);
    ctx.lineTo(w - pad.r, h - pad.b);
    ctx.stroke();

    ctx.fillStyle = "#94a3b8";
    ctx.font = "9px Inter, Noto Sans JP, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    xTicks.forEach((xv) => {
      const x = tx(xv);
      const label = opts.categorical && opts.catKeys
        ? String(opts.catKeys[xv] ?? "")
        : (axis.xKey === "mass" || axis.xKey === "heatQ" ? Math.round(xv) : String(Math.round(xv)));
      ctx.fillText(String(label), x, h - pad.b + 5);
    });

    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    yTicks.forEach((yv) => {
      const y = vy(yv);
      ctx.fillText(formatYTick(yv), pad.l - 6, y);
    });

    ctx.font = "10px Inter, Noto Sans JP, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(axis.xLabel + (axis.xUnit ? "（" + axis.xUnit + "）" : ""), (pad.l + w - pad.r) / 2, h - 2);

    ctx.save();
    ctx.translate(14, (pad.t + h - pad.b) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText(opts.yAxisLabel || "ΔT（℃）", 0, 0);
    ctx.restore();
  }

  function formatDeltaT(r) {
    const dt = Number(r.deltaT ?? 0);
    if (Math.abs(dt) < 0.05 && r.isPlateau) return "0（平台）";
    const sign = dt > 0 ? "+" : "";
    return sign + dt.toFixed(1) + " ℃";
  }

  function formatSessionDeltaT(row) {
    const dt = Number(row?.sessionDeltaT ?? row?.deltaT ?? NaN);
    if (!Number.isFinite(dt)) return "—";
    if (Math.abs(dt) < 0.05) return "0 ℃";
    return (dt > 0 ? "+" : "") + dt.toFixed(1) + " ℃";
  }

  function normalizeMeasureLog(log) {
    return (log || []).map((row, i) => ({
      ...row,
      measureRound: row.measureRound ?? (i + 1),
      sessionEndCelsius: row.sessionEndCelsius ?? row.tempC ?? null,
    }));
  }

  function getMeasureSessionColumns() {
    return [
      { key: "measureRound", label: "測定回", fmt: (v) => (v || "—") + "回目" },
      { key: "materialName", label: "物質", fmt: (v, r) => v || MATERIAL_NAMES[r.materialKey] || "—" },
      { key: "heatQ", label: "加熱量 Q", fmt: (v) => Math.round(Number(v) || 0) + " J" },
      { key: "sessionStartCelsius", label: "加熱前 T (℃)", fmt: (v) => formatHeatLogTemp(v) },
      { key: "sessionEndCelsius", label: "加熱後 T (℃)", fmt: (v, r) => formatHeatLogTemp(r.sessionEndCelsius ?? r.tempC ?? v) },
      { key: "sessionDeltaT", label: "その回の ΔT (℃)", fmt: (_v, r) => formatSessionDeltaT(r) },
    ];
  }

  function renderMeasureSessionTableHtml(log, newMeasureIds) {
    const rows = normalizeMeasureLog(log);
    const cols = getMeasureSessionColumns();
    if (!rows.length) {
      return '<tr><td colspan="' + cols.length + '" style="color:#64748b">「測定する」を押すと、回ごとの Q と ΔT がここに記録されます…</td></tr>';
    }
    const idSet = new Set(newMeasureIds || []);
    return rows.map((row) => {
      const cls = idSet.has(row.measureId) ? ' class="new-row"' : "";
      const cells = cols.map((c) => "<td>" + (c.fmt.length > 1 ? c.fmt(row[c.key], row) : c.fmt(row[c.key])) + "</td>").join("");
      return "<tr" + cls + ">" + cells + "</tr>";
    }).join("");
  }

  function getResultsColumns(planChecks) {
    const c = planChecks || { material: true, mass: false, heatQ: false };
    const cols = [];
    if (c.material !== false) cols.push({ key: "materialName", label: "物質", fmt: (v) => v });
    cols.push({ key: "interval", label: "区間・状態", fmt: (v) => v });
    cols.push({
      key: "segmentHeatJ",
      label: "合計熱量",
      fmt: (v) => (v != null && Number.isFinite(Number(v)) ? Math.round(Number(v)) + " J" : "—"),
    });
    if (c.mass) cols.push({ key: "mass", label: "質量 (g)", fmt: (v) => v + " g" });
    cols.push({ key: "heatQ", label: "加熱量 Q (J)", fmt: (v) => Math.round(Number(v) || 0) + " J" });
    cols.push({ key: "initialCelsius", label: "加熱前 T (℃)", fmt: (v) => Number(v).toFixed(1) + " ℃" });
    cols.push({ key: "finalCelsius", label: "加熱後 T (℃)", fmt: (v) => Number(v).toFixed(1) + " ℃" });
    cols.push({ key: "deltaT", label: "ΔT (℃)", fmt: (v, r) => formatDeltaT({ ...(r || {}), deltaT: v }) });
    return cols;
  }

  class StepPlan extends BaseStep {
    constructor() { super("plan", "③", "実験計画"); }

    mount(parent, state, onChange, actions) {
      const card = this.createCardShell(false);
      const mission = global.InquiryMissions?.getMission(state.missionId);
      this.body.innerHTML =
        '<p class="inquiry-card-desc" id="inquiryPlanMissionLead">' +
        (mission ? "ミッション「" + mission.title + "」のための実験計画を選びましょう。各選択肢の比較の視点も読んでください。" : "先に①でミッションを選んでください。") +
        "</p>" +
        '<div id="inquiryPlanChoices"></div>' +
        '<p class="inquiry-plan-auto-note">選んだ計画の「操作変数」が記録・分析の対象になります。物質・温度・質量・加熱量は④でいつでも初期条件として設定できます。</p>';
      parent.appendChild(card);

      const plans = global.InquiryMissions?.getPlansForMission(state.missionId) || [];
      const grid = renderChoiceGrid(
        this.body.querySelector("#inquiryPlanChoices"),
        plans.map((p) => ({ id: p.id, title: p.text, compare: p.compare, purpose: p.purpose })),
        state.planId,
        "inquiryPlan"
      );
      wireChoiceGrid(grid, (id) => {
        const patch = global.InquiryMissions?.applyPlanSelection(id) || { planId: id };
        onChange(patch);
        this.companion?.refresh?.();
      });

      this.companion = wireCompanionWrap(
        this.body,
        "plan",
        () => {
          const id = this.body.querySelector('input[name="inquiryPlan"]:checked')?.value || state.planId || "";
          const p = global.InquiryMissions?.getPlan(id);
          return p
            ? p.text +
              (p.compare ? " 比較：" + p.compare : "") +
              "（ねらい：" + p.purpose + "）"
            : "";
        },
        () => ({ step: "plan", missionId: state.missionId, planId: state.planId })
      );

      this.appendConfirmRow(actions);
      this._onChange = onChange;
      this._state = state;
      return this;
    }

    remountChoices(state, onChange) {
      if (onChange) this._onChange = onChange;
      if (state) this._state = state;
      const st = this._state || state || {};
      const change = this._onChange || onChange;
      const mission = global.InquiryMissions?.getMission(st.missionId);
      const lead = this.body?.querySelector("#inquiryPlanMissionLead");
      if (lead) {
        lead.textContent = mission
          ? "ミッション「" + mission.title + "」のための実験計画を選びましょう。各選択肢の比較の視点も読んでください。"
          : "先に①でミッションを選んでください。";
      }
      const container = this.body?.querySelector("#inquiryPlanChoices");
      if (!container || !change) return;
      const plans = global.InquiryMissions?.getPlansForMission(st.missionId) || [];
      const grid = renderChoiceGrid(
        container,
        plans.map((p) => ({ id: p.id, title: p.text, compare: p.compare, purpose: p.purpose })),
        st.planId,
        "inquiryPlan"
      );
      wireChoiceGrid(grid, (id) => {
        const patch = global.InquiryMissions?.applyPlanSelection(id) || { planId: id };
        change(patch);
        this.companion?.refresh?.();
      });
    }

    isComplete(state) {
      return !!state.missionId && !!state.planId;
    }

    exportData(state) {
      const p = global.InquiryMissions?.getPlan(state.planId);
      return {
        missionId: state.missionId,
        planId: state.planId,
        planChecks: state.planChecks,
        planText: state.planText,
        planPurpose: p?.purpose || "",
        planCompare: p?.compare || "",
      };
    }
  }

  class StepExperiment extends BaseStep {
    constructor() { super("experiment", "④", "実験"); }

    mount(parent, state, actions) {
      const card = this.createCardShell(false);
      this.body.innerHTML =
        '<p class="inquiry-card-desc">左の「測定する」で加熱し、水と鉄の2種類の測定を行いましょう。完了したら下の「決定」で次へ進みます。</p>' +
        '<div class="exp-action-row">' +
        '<button type="button" class="inquiry-action-btn exp-measure-btn" id="expMeasureBtn">📏 測定する</button>' +
        '<button type="button" class="inquiry-exp-reset-btn" id="expResetBtn">↺ 実験リセット</button>' +
        "</div>" +
        '<p class="exp-measure-hint" id="expMeasureHint">条件を整えてから測定ボタンを押してください</p>' +
        '<div class="exp-timeline"><h4>🔬 実験ログ（条件の変更履歴）</h4>' +
        '<div class="exp-timeline-list" id="expTimelineList"></div></div>' +
        '<div class="exp-heat-log"><h4>📊 加熱ログ（測定回 · Q · その回の ΔT）</h4>' +
        '<div class="exp-heat-log-list" id="expHeatLogList"></div></div>';
      parent.appendChild(card);
      this.timelineEl = this.body.querySelector("#expTimelineList");
      this.heatLogEl = this.body.querySelector("#expHeatLogList");
      this.measureBtn = this.body.querySelector("#expMeasureBtn");
      this.resetBtn = this.body.querySelector("#expResetBtn");
      this.hintEl = this.body.querySelector("#expMeasureHint");
      if (actions?.onMeasure && this.measureBtn) {
        this.measureBtn.addEventListener("click", actions.onMeasure);
      }
      if (actions?.onReset && this.resetBtn) {
        this.resetBtn.addEventListener("click", actions.onReset);
      }
      this.renderTimeline(state.timeline);
      this.renderHeatLog(state.heatMeasureLog);
      this.appendConfirmRow({ ...actions, confirmLabel: "決定 → 結果を見る" });
      return this;
    }

    setMeasureFeedback(msg, ok) {
      if (!this.hintEl) return;
      this.hintEl.textContent = msg;
      this.hintEl.classList.toggle("is-ok", !!ok);
    }

    renderTimeline(timeline) {
      if (!this.timelineEl) return;
      if (!timeline || timeline.length === 0) {
        this.timelineEl.innerHTML = '<p class="exp-timeline-empty">実験操作で条件を変えるとここに記録されます…</p>';
        return;
      }
      this.timelineEl.innerHTML = timeline.map((item) => {
        const type = item.type || "material";
        const meta = TIMELINE_META[type] || TIMELINE_META.material;
        const toStr = meta.fmt(item.to);
        if (item.from == null) {
          return '<div class="exp-timeline-item"><span class="exp-type">' + meta.label + "</span> " +
            '<span class="temp">' + toStr + "</span> で開始</div>";
        }
        const fromStr = meta.fmt(item.from);
        return '<div class="exp-timeline-item"><span class="exp-type">' + meta.label + "</span> " +
          '<span class="temp">' + fromStr + '</span> <span class="arrow">→</span> <span class="temp">' + toStr + "</span></div>";
      }).join("");
    }

    renderHeatLog(log) {
      if (!this.heatLogEl) return;
      const rows = normalizeMeasureLog(log);
      if (rows.length === 0) {
        this.heatLogEl.innerHTML = '<p class="exp-heat-log-empty">「測定する」で加熱するたび、回・Q・ΔT がここに記録されます…</p>';
        return;
      }
      const body = rows.map((row) =>
        "<tr>" +
        "<td>" + row.measureRound + "回目</td>" +
        "<td>" + escHeatLog(row.materialName || MATERIAL_NAMES[row.materialKey] || row.materialKey || "—") + "</td>" +
        "<td>" + Math.round(row.heatQ || 0) + " J</td>" +
        "<td>" + formatHeatLogTemp(row.sessionStartCelsius) + "</td>" +
        "<td>" + formatHeatLogTemp(row.sessionEndCelsius ?? row.tempC) + "</td>" +
        "<td>" + formatSessionDeltaT(row) + "</td>" +
        "</tr>"
      ).join("");
      this.heatLogEl.innerHTML =
        '<table class="exp-heat-log-table">' +
        "<thead><tr><th>回</th><th>物質</th><th>加熱量 Q</th><th>加熱前 T</th><th>加熱後 T</th><th>その回の ΔT</th></tr></thead>" +
        "<tbody>" + body + "</tbody></table>";
    }

    isComplete(state) {
      return (state.results || []).length >= 1 && (state.timeline || []).length >= 1;
    }

    exportData(state) { return { timeline: state.timeline, heatMeasureLog: state.heatMeasureLog }; }
  }

  function escHeatLog(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function formatHeatLogTemp(v) {
    if (!Number.isFinite(Number(v))) return "—";
    return Number(v).toFixed(1) + " ℃";
  }

  class StepResults extends BaseStep {
    constructor() { super("results", "⑤", "実験結果"); }

    mount(parent, state, actions) {
      const card = this.createCardShell(false);
      this.body.innerHTML =
        '<p class="inquiry-card-desc">「測定する」1回ごとに加えた熱量 Q とその回の温度変化 ΔT を記録します。下段は状態変化の<strong>各区間</strong>をまとめた表です（同じ区間は1行に統合・合計熱量も集計）。</p>' +
        '<h4 class="results-section-title">測定回ごとの記録</h4>' +
        '<div class="results-table-wrap"><table class="results-table">' +
        '<thead><tr id="measureSessionHead"></tr></thead>' +
        '<tbody id="measureSessionBody"></tbody></table></div>' +
        '<h4 class="results-section-title results-section-title--spaced">区間・状態ごとの記録</h4>' +
        '<div class="results-table-wrap"><table class="results-table">' +
        '<thead><tr id="resultsTableHead"></tr></thead>' +
        '<tbody id="resultsTableBody"></tbody></table></div>' +
        '<p class="inquiry-examples" style="margin-top:8px">例：水を十分加熱すると 固体 → 固体→液体 → 液体 → 液体→気体 → 気体 の行が並びます。</p>';
      parent.appendChild(card);
      this.sessionHead = this.body.querySelector("#measureSessionHead");
      this.sessionBody = this.body.querySelector("#measureSessionBody");
      this.thead = this.body.querySelector("#resultsTableHead");
      this.tbody = this.body.querySelector("#resultsTableBody");
      this.updateSessionHeaders();
      this.updateTableHeaders(state.planChecks);
      this.renderMeasureSessions(state.heatMeasureLog, []);
      this.renderTable(state.results, [], state.planChecks);
      this.appendConfirmRow({ ...actions, confirmLabel: "決定 → グラフへ" });
      return this;
    }

    updateSessionHeaders() {
      if (!this.sessionHead) return;
      const cols = getMeasureSessionColumns();
      this.sessionHead.innerHTML = cols.map((c) => "<th>" + c.label + "</th>").join("");
    }

    renderMeasureSessions(log, newMeasureIds) {
      if (!this.sessionBody) return;
      this.sessionBody.innerHTML = renderMeasureSessionTableHtml(log, newMeasureIds);
    }

    updateTableHeaders(planChecks) {
      if (!this.thead) return;
      const cols = getResultsColumns(planChecks);
      this.thead.innerHTML = cols.map((c) => "<th>" + c.label + "</th>").join("");
    }

    renderTable(results, newKeys, planChecks) {
      if (!this.tbody) return;
      const cols = getResultsColumns(planChecks);
      const colSpan = Math.max(cols.length, 1);
      const merged = getMergedResults(results);
      if (!merged || merged.length === 0) {
        this.tbody.innerHTML = '<tr><td colspan="' + colSpan + '" style="color:#64748b">データ待ち…</td></tr>';
        return;
      }
      const keySet = new Set(newKeys || []);
      this.tbody.innerHTML = merged.map((raw) => {
        const r = normalizeResult(raw);
        const rowKey = [r.materialKey, r.interval].join("|");
        const cls = keySet.has(rowKey) ? ' class="new-row"' : "";
        const cells = cols.map((c) => "<td>" + (c.fmt.length > 1 ? c.fmt(r[c.key], r) : c.fmt(r[c.key])) + "</td>").join("");
        return "<tr" + cls + ">" + cells + "</tr>";
      }).join("");
    }

    isComplete(state) {
      return getMergedResults(state.results).length >= 2;
    }

    exportData(state) {
      return { results: state.results, heatMeasureLog: state.heatMeasureLog };
    }
  }

  function computeQTAxisRange(pts, opts) {
    const o = opts || {};
    const qMin = 0;
    let qMax = Math.max(...pts.map((p) => p.x), 100);
    qMax += Math.max(qMax * 0.08, 60);

    let tLo = Math.min(...pts.map((p) => p.y));
    let tHi = Math.max(...pts.map((p) => p.y));
    if (o.showPlateaus) {
      tLo = Math.min(tLo, 0);
      tHi = Math.max(tHi, 100);
    }
    let span = Math.max(tHi - tLo, 6);
    let tMin = tLo - span * 0.12;
    let tMax = tHi + span * 0.15;
    if (tMax - tMin < 10) {
      const mid = (tMax + tMin) / 2;
      tMin = mid - 5;
      tMax = mid + 5;
    }
    return { qMin, qMax, tMin, tMax };
  }

  function prepareQTPoints(rawPts) {
    return (rawPts || [])
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
      .slice()
      .sort((a, b) => a.x - b.x || a.y - b.y)
      .reduce((acc, p) => {
        const last = acc[acc.length - 1];
        if (last && Math.abs(last.x - p.x) < 1) {
          last.y = p.y;
          return acc;
        }
        acc.push({ x: p.x, y: p.y });
        return acc;
      }, []);
  }

  function getMaterialPhaseConfig(materialKey, opts) {
    const key = materialKey || opts?.materialKey || "";
    const cfg = GRAPH_MATERIAL_CONFIG[key] || {};
    return {
      meltAt: cfg.meltAt ?? null,
      boilAt: cfg.boilAt ?? null,
      showPlateaus: cfg.showPlateaus !== false && opts?.showPlateaus !== false,
    };
  }

  function isStateChangeInterval(interval) {
    const iv = String(interval || "");
    return iv.includes("→") || iv.includes("融解") || iv.includes("沸騰");
  }

  function stateChangeKindFromInterval(interval) {
    const iv = String(interval || "");
    if (iv.includes("固体") && iv.includes("液体")) return "melt";
    if (iv.includes("液体") && iv.includes("気体")) return "boil";
    if (iv.includes("融解")) return "melt";
    if (iv.includes("沸騰")) return "boil";
    return null;
  }

  /** 区間別表の合計熱量から、状態変化区間の Q 範囲を復元 */
  function buildPhaseChangeQRanges(materialKey, results) {
    const merged = getMergedResults(results || []).filter((r) => r.materialKey === materialKey);
    if (!merged.length) return [];
    let qCursor = 0;
    const ranges = [];
    merged.forEach((row) => {
      const heat = Number(row.segmentHeatJ);
      const hasHeat = Number.isFinite(heat) && heat > 0;
      const iv = String(row.interval || "");
      const kind = isStateChangeInterval(iv) ? stateChangeKindFromInterval(iv) : null;

      if (kind && hasHeat) {
        ranges.push({
          kind,
          qMin: qCursor,
          qMax: qCursor + heat,
          interval: iv,
        });
      }

      if (hasHeat) {
        qCursor += heat;
      } else if (!isStateChangeInterval(iv)) {
        qCursor += Number(row.heatQ) || 0;
      }
    });
    return ranges;
  }

  function classifyPlateauKind(avgT, phaseCfg) {
    if (!phaseCfg?.showPlateaus) return "sensible";
    const meltAt = phaseCfg.meltAt;
    const boilAt = phaseCfg.boilAt;
    const tol = 3;
    const dM = meltAt != null ? Math.abs(avgT - meltAt) : Infinity;
    const dB = boilAt != null ? Math.abs(avgT - boilAt) : Infinity;
    if (dM <= tol && dM <= dB) return "melt";
    if (dB <= tol && dB < dM) return "boil";
    return "sensible";
  }

  function kindFromPhaseRanges(qMid, dT, tMid, phaseCfg, phaseRanges) {
    if (!phaseRanges?.length) return null;
    if (dT > 0.5) return null;
    for (const r of phaseRanges) {
      if (qMid < r.qMin - 8 || qMid > r.qMax + 8) continue;
      if (r.kind === "melt" && phaseCfg.meltAt != null && Math.abs(tMid - phaseCfg.meltAt) > 4) continue;
      if (r.kind === "boil" && phaseCfg.boilAt != null && Math.abs(tMid - phaseCfg.boilAt) > 4) continue;
      return r.kind;
    }
    return null;
  }

  function segmentKindBetween(pts, i, phaseCfg, phaseRanges) {
    const dT = Math.abs(pts[i + 1].y - pts[i].y);
    const dQ = pts[i + 1].x - pts[i].x;
    if (dQ < 5) return "sensible";
    const qMid = (pts[i].x + pts[i + 1].x) / 2;
    const tMid = (pts[i].y + pts[i + 1].y) / 2;

    const fromResults = kindFromPhaseRanges(qMid, dT, tMid, phaseCfg, phaseRanges);
    if (fromResults) return fromResults;

    // 結果表がない場合のみ：温度一定かつ融点/沸点付近の厳密判定
    if (dT > 0.45 || dQ < 15) return "sensible";
    const kind = classifyPlateauKind(tMid, phaseCfg);
    return kind === "sensible" ? "sensible" : kind;
  }

  function buildQTSegments(pts, phaseCfg, phaseRanges) {
    if (!pts || pts.length < 2) return [{ kind: "sensible", points: (pts || []).slice() }];
    const segments = [];
    let start = 0;
    let curKind = segmentKindBetween(pts, 0, phaseCfg, phaseRanges);
    for (let i = 1; i < pts.length - 1; i += 1) {
      const k = segmentKindBetween(pts, i, phaseCfg, phaseRanges);
      if (k !== curKind) {
        segments.push({ kind: curKind, points: pts.slice(start, i + 1) });
        start = i;
        curKind = k;
      }
    }
    segments.push({ kind: curKind, points: pts.slice(start) });
    return segments.filter((s) => s.points.length >= 2);
  }

  function drawQTPlateauLegend(ctx, x, y, flags, reportMode) {
    if (!flags?.hasMelt && !flags?.hasBoil) return;
    const items = [];
    if (flags.hasMelt) {
      const st = QT_PLATEAU_STYLE.melt;
      items.push({
        marker: st.marker,
        label: st.label,
        color: reportMode ? st.reportLine : st.lineColor,
      });
    }
    if (flags.hasBoil) {
      const st = QT_PLATEAU_STYLE.boil;
      items.push({
        marker: st.marker,
        label: st.label,
        color: reportMode ? st.reportLine : st.lineColor,
      });
    }
    ctx.font = (reportMode ? "9px" : "10px") + " Inter, Noto Sans JP, sans-serif";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    let cx = x;
    items.forEach((item) => {
      ctx.fillStyle = item.color;
      const text = item.marker + " " + item.label;
      ctx.fillText(text, cx, y);
      cx += ctx.measureText(text).width + 14;
    });
  }

  function drawQTSegmentedSeries(ctx, segments, tx, ty, opts) {
    const reportMode = !!opts.reportMode;
    const defaultLine = opts.lineColor || (reportMode ? "#0891b2" : "#22d3ee");
    const defaultDot = opts.dotColor || (reportMode ? "#0e7490" : "#67e8f9");
    const flags = { hasMelt: false, hasBoil: false };

    segments.forEach((seg) => {
      const pts = seg.points;
      if (pts.length < 2) return;
      const style = QT_PLATEAU_STYLE[seg.kind];
      const isPlateau = seg.kind === "melt" || seg.kind === "boil";
      const lineColor = isPlateau && style
        ? (reportMode ? style.reportLine : style.lineColor)
        : defaultLine;
      const dotColor = isPlateau && style
        ? (reportMode ? style.reportDot : style.dotColor)
        : defaultDot;

      if (isPlateau && style) {
        flags.hasMelt = flags.hasMelt || seg.kind === "melt";
        flags.hasBoil = flags.hasBoil || seg.kind === "boil";
        const x0 = tx(pts[0].x);
        const x1 = tx(pts[pts.length - 1].x);
        const yMid = ty((pts[0].y + pts[pts.length - 1].y) / 2);
        const bandH = reportMode ? 8 : 10;
        ctx.fillStyle = reportMode ? style.reportFill : style.fillColor;
        ctx.fillRect(Math.min(x0, x1), yMid - bandH / 2, Math.abs(x1 - x0), bandH);
      }

      ctx.strokeStyle = lineColor;
      ctx.lineWidth = reportMode ? 2 : 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (!reportMode) {
        ctx.shadowBlur = isPlateau ? 10 : 6;
        ctx.shadowColor = lineColor;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.beginPath();
      ctx.moveTo(tx(pts[0].x), ty(pts[0].y));
      for (let i = 1; i < pts.length; i += 1) {
        ctx.lineTo(tx(pts[i].x), ty(pts[i].y));
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = dotColor;
      pts.forEach((p) => {
        ctx.beginPath();
        ctx.arc(tx(p.x), ty(p.y), reportMode ? 2.5 : 3, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    return flags;
  }

  function drawClippedSeries(ctx, pad, plotW, plotH, drawFn) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(pad.l, pad.t, plotW, plotH);
    ctx.clip();
    drawFn();
    ctx.restore();
  }

  function drawReportChartAxes(ctx, opts) {
    const {
      w, h, pad, xMin, xMax, yMin, yMax, axis, tx, vy, yAxisLabel,
      categorical, catKeys,
    } = opts;

    const xTicksRaw = categorical && catKeys?.length
      ? catKeys.map((_, i) => i)
      : buildReportTicks(xMin, xMax, AXIS_TICK_TARGET, { forceZero: xMin <= 0 && xMax > 0 });
    const yTicksRaw = opts.yTickStep
      ? buildFixedStepTicks(yMin, yMax, opts.yTickStep)
      : buildReportTicks(yMin, yMax, AXIS_TICK_TARGET);

    const axisBottom = h - pad.b;

    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    yTicksRaw.forEach((yv) => {
      const y = vy(yv);
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();
    });
    xTicksRaw.forEach((xv) => {
      const x = tx(xv);
      ctx.beginPath();
      ctx.moveTo(x, pad.t);
      ctx.lineTo(x, axisBottom);
      ctx.stroke();
    });

    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t);
    ctx.lineTo(pad.l, axisBottom);
    ctx.lineTo(w - pad.r, axisBottom);
    ctx.stroke();

    ctx.fillStyle = "#1e293b";
    ctx.font = "11px Inter, Noto Sans JP, sans-serif";
    xTicksRaw.forEach((xv) => {
      const x = tx(xv);
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, axisBottom);
      ctx.lineTo(x, axisBottom + 5);
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      let label;
      if (categorical && catKeys) {
        label = String(catKeys[xv] ?? xv);
      } else {
        label = formatReportTickValue(xv, xMax, axis.xUnit || "");
      }
      ctx.fillText(label, x, axisBottom + 7);
    });

    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.font = "10px Inter, Noto Sans JP, sans-serif";
    yTicksRaw.forEach((yv) => {
      ctx.fillText(formatReportYTick(yv), pad.l - 8, vy(yv));
    });

    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.font = "10px Inter, Noto Sans JP, sans-serif";
    ctx.fillStyle = "#334155";
    ctx.fillText(reportXAxisTitle(axis, xMax), (pad.l + w - pad.r) / 2, h - 4);

    ctx.save();
    ctx.translate(16, (pad.t + axisBottom) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#1e293b";
    ctx.font = "10px Inter, Noto Sans JP, sans-serif";
    ctx.fillText(yAxisLabel || "温度 T（℃）", 0, 0);
    ctx.restore();
  }

  /** 実験レポート用 — 白背景・目盛り付き Q–T グラフ */
  function drawReportQTGraph(canvas, w, h, rawPts, opts) {
    if (!canvas || w < 40 || h < 40) return false;
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const o = opts || {};
    const pts = prepareQTPoints(rawPts);
    const pad = { ...REPORT_CHART_PAD };

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    if (pts.length < 2) {
      ctx.fillStyle = "#64748b";
      ctx.font = "11px Inter, Noto Sans JP, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(o.emptyMsg || "グラフデータがありません", w / 2, h / 2);
      return false;
    }

    let { qMin, qMax, tMin, tMax } = computeQTAxisRange(pts, o);
    const dataBounds = qtDataBounds(pts);
    ({ qMin, qMax, tMin, tMax } = snapReportAxisRange(qMin, qMax, tMin, tMax, dataBounds));
    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;
    const tx = (Q) => pad.l + ((Q - qMin) / Math.max(qMax - qMin, 1)) * plotW;
    const ty = (T) => pad.t + plotH * (1 - (T - tMin) / Math.max(tMax - tMin, 1));

    drawReportChartAxes(ctx, {
      w, h, pad, xMin: qMin, xMax: qMax, yMin: tMin, yMax: tMax,
      axis: { xLabel: "与えた熱量 Q", xUnit: "J" },
      tx, vy: ty, yAxisLabel: "温度 T（℃）",
      categorical: false, catKeys: null,
      yTickStep: REPORT_TEMP_TICK_STEP,
    });

    drawClippedSeries(ctx, pad, plotW, plotH, () => {
      const phaseCfg = getMaterialPhaseConfig(o.materialKey, o);
      const phaseRanges = buildPhaseChangeQRanges(o.materialKey, o.results);
      const segments = buildQTSegments(pts, phaseCfg, phaseRanges);
      const flags = drawQTSegmentedSeries(ctx, segments, tx, ty, {
        lineColor: o.lineColor,
        dotColor: o.dotColor,
        reportMode: true,
      });
      drawQTPlateauLegend(ctx, pad.l + 6, pad.t + 10, flags, true);
    });
    return true;
  }

  function drawMaterialQTGraph(canvas, rawPts, opts) {
    if (!canvas) return false;
    const pts = prepareQTPoints(rawPts);
    const o = opts || {};
    const wrap = canvas.parentElement;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(280, wrap?.clientWidth || 280);
    const h = 220;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const pad = { l: 52, r: 16, t: 22, b: 48 };
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "#0a1020");
    bg.addColorStop(1, "#0c1528");

    if (pts.length < 2) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#64748b";
      ctx.font = "12px Inter, Noto Sans JP, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(o.emptyMsg || "測定データが不足しています", w / 2, h / 2 - 8);
      ctx.font = "10px Inter, Noto Sans JP, sans-serif";
      ctx.fillText("「測定する」で加熱を2回以上行ってください", w / 2, h / 2 + 12);
      return false;
    }

    const qMin = 0;
    const { qMax, tMin, tMax } = computeQTAxisRange(pts, o);
    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;
    const tx = (Q) => pad.l + ((Q - qMin) / Math.max(qMax - qMin, 1)) * plotW;
    const ty = (T) => pad.t + plotH * (1 - (T - tMin) / Math.max(tMax - tMin, 1));

    const axis = { xLabel: "与えた熱量 Q", xUnit: "J", fmtX: (v) => Math.round(v) };
    const axisOpts = {
      w, h, pad, xMin: qMin, xMax: qMax, yMin: tMin, yMax: tMax,
      axis, tx, vy: ty, categorical: false, catKeys: null,
      yAxisLabel: "温度 T（℃）",
    };

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    drawChartAxes(ctx, axisOpts);

    const phaseCfg = getMaterialPhaseConfig(o.materialKey, o);
    const phaseRanges = buildPhaseChangeQRanges(o.materialKey, o.results);
    const segments = buildQTSegments(pts, phaseCfg, phaseRanges);
    const flags = drawQTSegmentedSeries(ctx, segments, tx, ty, {
      lineColor: o.lineColor,
      dotColor: o.dotColor,
      reportMode: false,
    });
    drawQTPlateauLegend(ctx, pad.l + 6, pad.t + 10, flags, false);

    return true;
  }

  class StepGraph extends BaseStep {
    constructor() {
      super("graph", "⑥", "グラフ");
      this.graphWrap = null;
      this.customWrap = null;
      this.blocks = new Map();
      this._onChange = null;
      this._lastTargetsKey = "";
      this._lastCustomKey = "";
    }

    mount(parent, state, onChange, actions) {
      const card = this.createCardShell(false);
      this.body.innerHTML =
        '<p class="inquiry-card-desc" id="graphStepDesc">測定した物質ごとに、温度–熱量グラフ（Q 横軸 · T 縦軸）を作成しましょう。<strong>状態変化の区間だけ</strong>色分けされます（融解 <span class="graph-legend-inline graph-legend-melt">○ 紫</span> · 沸騰 <span class="graph-legend-inline graph-legend-boil">△ 橙</span>）。</p>' +
        '<div class="graph-dual-wrap" id="graphTargetsWrap"></div>' +
        '<div class="graph-custom-section">' +
        '<h5 class="graph-block-title graph-custom-title">追加グラフ</h5>' +
        '<p class="inquiry-card-desc graph-custom-desc">物質・横軸・縦軸を選んでから「グラフを追加」を押してください。</p>' +
        '<div class="graph-custom-form">' +
        '<label class="graph-custom-field"><span>物質</span><select id="customGraphMaterial"></select></label>' +
        '<label class="graph-custom-field"><span>横軸</span><select id="customGraphX"></select></label>' +
        '<label class="graph-custom-field"><span>縦軸</span><select id="customGraphY"></select></label>' +
        '<button type="button" class="inquiry-action-btn graph-custom-add-btn" id="customGraphAddBtn">＋ グラフを追加</button>' +
        "</div>" +
        '<p class="graph-custom-hint" id="customGraphHint" aria-live="polite"></p>' +
        '<div class="graph-dual-wrap" id="customGraphsWrap"></div>' +
        "</div>";
      parent.appendChild(card);
      this.graphWrap = this.body.querySelector("#graphTargetsWrap");
      this.customWrap = this.body.querySelector("#customGraphsWrap");
      this.customMaterialSel = this.body.querySelector("#customGraphMaterial");
      this.customXSel = this.body.querySelector("#customGraphX");
      this.customYSel = this.body.querySelector("#customGraphY");
      this.customHint = this.body.querySelector("#customGraphHint");
      this._onChange = onChange;
      this._state = state;

      this.customXSel.innerHTML = CUSTOM_GRAPH_X_KEYS.map((k) =>
        '<option value="' + k + '">' + CUSTOM_GRAPH_AXES[k].label + "</option>"
      ).join("");
      this.customYSel.innerHTML = CUSTOM_GRAPH_Y_KEYS.map((k) =>
        '<option value="' + k + '">' + CUSTOM_GRAPH_AXES[k].label + "</option>"
      ).join("");

      this.body.querySelector("#customGraphAddBtn")?.addEventListener("click", () => this._addCustomGraph());
      this.updateCustomFormOptions(state);
      this.renderTargets(state);
      this.renderCustomGraphs(state);
      this.appendConfirmRow({ ...actions, confirmLabel: "決定 → 考察へ" });
      return this;
    }

    updateCustomFormOptions(state) {
      const targets = getGraphTargets(state);
      if (this.customMaterialSel) {
        this.customMaterialSel.innerHTML = targets.length
          ? targets.map((k) => {
            const name = GRAPH_MATERIAL_CONFIG[k]?.name || MATERIAL_NAMES[k] || k;
            return '<option value="' + k + '">' + name + "</option>";
          }).join("")
          : '<option value="">（測定データなし）</option>';
        this.customMaterialSel.disabled = targets.length === 0;
      }
      const addBtn = this.body.querySelector("#customGraphAddBtn");
      if (addBtn) addBtn.disabled = targets.length === 0;
    }

    _addCustomGraph() {
      const materialKey = this.customMaterialSel?.value;
      const xKey = this.customXSel?.value;
      const yKey = this.customYSel?.value;
      if (!materialKey || !xKey || !yKey) {
        if (this.customHint) this.customHint.textContent = "物質・横軸・縦軸を選んでください。";
        return;
      }
      if (xKey === yKey) {
        if (this.customHint) this.customHint.textContent = "横軸と縦軸は別の項目を選んでください。";
        return;
      }
      const graphDef = {
        id: "cg_" + Date.now(),
        materialKey,
        xKey,
        yKey,
        created: true,
      };
      const next = [...(this._state?.customGraphs || []), graphDef];
      if (this.customHint) {
        const chartLabel = customGraphChartTypeLabel(resolveCustomGraphChartType(
          graphDef, CUSTOM_GRAPH_AXES[xKey], !!CUSTOM_GRAPH_AXES[xKey]?.categorical
        ));
        this.customHint.textContent = getCustomGraphCaption(graphDef) + " の" + chartLabel + "を追加しました。";
      }
      this._onChange?.({ customGraphs: next });
    }

    _removeCustomGraph(graphId) {
      const graphs = this._state?.customGraphs || [];
      const target = graphs.find((g) => g.id === graphId);
      if (!target) return;
      const next = graphs.filter((g) => g.id !== graphId);
      if (this.customHint) {
        this.customHint.textContent = getCustomGraphCaption(target) + " のグラフを削除しました。";
      }
      this._lastCustomKey = "";
      this._onChange?.({ customGraphs: next });
    }

    _targetsKey(targets) {
      return targets.join(",");
    }

    _customKey(graphs) {
      return (graphs || []).map((g) => [g.id, g.materialKey, g.xKey, g.yKey, g.created].join(":")).join("|");
    }

    renderTargets(state) {
      const targets = getGraphTargets(state);
      const key = this._targetsKey(targets);
      if (key === this._lastTargetsKey && this.blocks.size === targets.length) {
        this._refreshCreatedPanels(state);
        return;
      }
      this._lastTargetsKey = key;
      this.blocks.clear();
      if (!this.graphWrap) return;

      if (targets.length === 0) {
        this.graphWrap.innerHTML =
          '<p class="exp-timeline-empty">まだ測定データがありません。実験ステップで「測定をする」を押してからグラフを作成してください。</p>';
        return;
      }

      this.graphWrap.innerHTML = targets.map((materialKey, i) => {
        const cfg = GRAPH_MATERIAL_CONFIG[materialKey] || { name: MATERIAL_NAMES[materialKey] || materialKey };
        const num = i + 1;
        const canvasId = "inquiryGraphCanvas_" + materialKey;
        return (
          '<div class="graph-block" data-material="' + materialKey + '">' +
          '<h5 class="graph-block-title">グラフ' + num + " " + cfg.name + "の温度–熱量グラフ（Q 横軸 · T 縦軸）</h5>" +
          '<button type="button" class="inquiry-action-btn" data-graph-btn="' + materialKey + '">📈 グラフ' + num + "を作成</button>" +
          '<div class="graph-panel" data-graph-panel="' + materialKey + '" style="display:none">' +
          '<div class="graph-canvas-wrap"><canvas id="' + canvasId + '"></canvas></div>' +
          '<p class="graph-plateau-legend">状態変化の区間のみ色分け · ○ 固体→液体 · △ 液体→気体</p></div>' +
          "</div>"
        );
      }).join("");

      targets.forEach((materialKey, i) => {
        const btn = this.graphWrap.querySelector('[data-graph-btn="' + materialKey + '"]');
        const panel = this.graphWrap.querySelector('[data-graph-panel="' + materialKey + '"]');
        const canvas = this.graphWrap.querySelector("#inquiryGraphCanvas_" + materialKey);
        btn?.addEventListener("click", () => {
          this._onChange?.({ graphsCreated: { [materialKey]: true } });
        });
        this.blocks.set(materialKey, { btn, panel, canvas, num: i + 1 });
      });

      this._refreshCreatedPanels(state);
    }

    renderCustomGraphs(state) {
      this._state = state;
      const graphs = state?.customGraphs || [];
      const key = this._customKey(graphs);
      if (!this.customWrap) return;

      if (!graphs.length) {
        this.customWrap.innerHTML = '<p class="exp-timeline-empty">追加グラフはまだありません。</p>';
        this._lastCustomKey = key;
        return;
      }

      if (key !== this._lastCustomKey) {
        this.customWrap.innerHTML = graphs.map((g, i) => {
          const caption = getCustomGraphCaption(g);
          return (
            '<div class="graph-block graph-block-custom" data-custom-id="' + g.id + '">' +
            '<div class="graph-block-head">' +
            '<h5 class="graph-block-title">追加グラフ' + (i + 1) + " " + caption + "</h5>" +
            '<button type="button" class="graph-custom-delete-btn" data-custom-delete="' + g.id + '" title="このグラフを削除">🗑 消す</button>' +
            "</div>" +
            '<div class="graph-panel" style="display:block">' +
            '<div class="graph-canvas-wrap"><canvas id="inquiryCustomCanvas_' + g.id + '"></canvas></div></div>' +
            "</div>"
          );
        }).join("");
        this.customWrap.querySelectorAll("[data-custom-delete]").forEach((btn) => {
          btn.addEventListener("click", () => this._removeCustomGraph(btn.getAttribute("data-custom-delete")));
        });
        this._lastCustomKey = key;
      }

      graphs.forEach((g) => {
        const canvas = this.customWrap.querySelector("#inquiryCustomCanvas_" + g.id);
        if (canvas) drawCustomDataGraph(canvas, state, g, { emptyMsg: "データが不足しています（測定回数や区間を増やしてください）" });
      });
    }

    syncFromState(state) {
      this._state = state;
      this.updateCustomFormOptions(state);
      this.renderTargets(state);
      this.renderCustomGraphs(state);
    }

    _refreshCreatedPanels(state) {
      const created = normalizeGraphsCreated(state);
      this.blocks.forEach((block, materialKey) => {
        if (created[materialKey]) {
          this.drawMaterialGraph(materialKey, state?.qtCurves, state);
        } else if (block.panel) {
          block.panel.style.display = "none";
          if (block.btn) {
            block.btn.disabled = false;
            block.btn.textContent = "📈 グラフ" + block.num + "を作成";
          }
        }
      });
    }

    drawMaterialGraph(materialKey, qtCurves, state) {
      const block = this.blocks.get(materialKey);
      if (!block?.canvas) return;
      const cfg = GRAPH_MATERIAL_CONFIG[materialKey] || {};
      const name = cfg.name || MATERIAL_NAMES[materialKey] || materialKey;
      const ok = drawMaterialQTGraph(block.canvas, qtCurves?.[materialKey], {
        materialKey,
        material: name,
        results: state?.results,
        lineColor: cfg.lineColor,
        dotColor: cfg.dotColor,
        showPlateaus: !!cfg.showPlateaus,
        emptyMsg: name + "の加熱曲線データがありません",
      });
      if (!ok) {
        block.btn.disabled = true;
        block.btn.textContent = name + "で測定（加熱）を2回以上行ってから作成";
        return;
      }
      block.btn.disabled = false;
      block.panel.style.display = "block";
      block.btn.textContent = "↺ グラフ" + block.num + "を再作成";
    }

    drawCustomGraphById(state, graphId) {
      const g = (state?.customGraphs || []).find((x) => x.id === graphId);
      if (!g || !this.customWrap) return;
      const canvas = this.customWrap.querySelector("#inquiryCustomCanvas_" + g.id);
      if (canvas) drawCustomDataGraph(canvas, state, g);
    }

    isComplete(state) {
      const targets = getGraphTargets(state);
      if (!targets.length) return false;
      const created = normalizeGraphsCreated(state);
      return targets.every((k) => !!created[k]);
    }

    exportData(state) {
      syncLegacyGraphFlags(state);
      return {
        graphsCreated: normalizeGraphsCreated(state),
        graphCreatedWater: !!state.graphCreatedWater,
        graphCreatedIron: !!state.graphCreatedIron,
        qtCurves: state.qtCurves,
        customGraphs: state.customGraphs || [],
      };
    }
  }

  class StepReflection extends BaseStep {
    constructor() { super("reflection", "⑦", "考察"); }

    mount(parent, state, onChange, actions) {
      const card = this.createCardShell(false);
      this.body.innerHTML =
        '<p class="inquiry-card-desc">結果から考えよう。今回の実験から分かったことを書いてください。入力中は達成画面は表示されません。</p>' +
        '<div class="inquiry-field"><label for="inqReflection">考察</label>' +
        '<textarea id="inqReflection" rows="4" placeholder="比熱が大きいほどΔTは小さかった。Q=mcΔT から…"></textarea></div>' +
        '<button type="button" class="inquiry-action-btn reflection-finish-btn" id="reflectionFinishBtn" style="display:none">✅ 考察を終えて探究を完了する</button>';
      parent.appendChild(card);
      this.ta = this.body.querySelector("#inqReflection");
      this.finishBtn = this.body.querySelector("#reflectionFinishBtn");
      this.ta.value = state.reflection || "";
      this.ta.addEventListener("input", () => onChange({ reflection: this.ta.value }));
      this.companion = wireCompanion(this.ta, "reflection", () => ({
        resultCount: actions?.getResultCount?.() ?? (state.results || []).length,
      }));
      this.ta.addEventListener("focus", () => actions?.onFocus?.());
      this.ta.addEventListener("blur", () => actions?.onBlur?.());
      if (this.finishBtn && actions?.onFinish) {
        this.finishBtn.addEventListener("click", () => actions.onFinish());
      }
      this.appendConfirmRow({ ...actions, confirmLabel: "決定 → まとめへ" });
      return this;
    }

    updateFinishButton(state, percent, celebrated) {
      if (!this.finishBtn) return;
      const ready = percent >= 100 && !celebrated && this.isComplete(state);
      this.finishBtn.style.display = ready ? "block" : "none";
    }

    isComplete(state) { return (state.reflection || "").trim().length >= 10; }
    exportData(state) { return { reflection: state.reflection }; }
  }

  function bindAutoResizeTextarea(ta, minPx) {
    if (!ta) return;
    const minHeight = minPx || 180;
    const resize = () => {
      ta.style.height = "auto";
      ta.style.height = Math.max(minHeight, ta.scrollHeight) + "px";
    };
    ta.addEventListener("input", resize);
    requestAnimationFrame(resize);
    return resize;
  }

  class StepSummary extends BaseStep {
    constructor() { super("summary", "⑧", "まとめ"); }

    _buildSummaryDraft(state) {
      const mission = global.InquiryMissions?.getMission(state.missionId);
      const hyp = global.InquiryMissions?.getHypothesis(state.hypothesisId);
      const guide = global.InquiryMissions?.getSummaryGuide?.(state.missionId) || {};
      const reflection = (state.reflection || "").trim();
      const refSnippet = reflection.length > 100 ? reflection.slice(0, 100) + "…" : reflection;
      const lines = [];

      lines.push("【探求テーマ】" + (mission?.title || "（①でミッションを選んでください）"));
      if (mission?.description) lines.push("　" + mission.description);
      lines.push("");
      lines.push("【問いへの答え】");
      lines.push((guide.answerLead || "実験から分かったこと：") + " ");
      lines.push("");
      if (hyp) {
        lines.push("【仮説と結果】");
        lines.push("仮説「" + hyp.text + "」は、実験結果と比べて　　　（支持／修正／棄却）。");
        lines.push("根拠：");
        lines.push("");
      }
      if (reflection) {
        lines.push("【考察の要点】");
        lines.push(refSnippet);
        lines.push("");
      }
      lines.push("【一言まとめ】");
      lines.push("");
      return lines.join("\n");
    }

    updateMissionGuide(state) {
      const mission = global.InquiryMissions?.getMission(state?.missionId);
      const guide = global.InquiryMissions?.getSummaryGuide?.(state?.missionId) || {};
      const titleEl = this.body?.querySelector("#summaryMissionTitle");
      const descEl = this.body?.querySelector("#summaryMissionDesc");
      const outlineEl = this.body?.querySelector("#summaryAnswerOutline");
      const boxEl = this.body?.querySelector("#summaryMissionBox");
      const draftBtn = this.body?.querySelector("#summaryInsertDraftBtn");

      if (titleEl) titleEl.textContent = mission?.title || "（①で探求テーマを選んでください）";
      if (descEl) {
        descEl.textContent = mission?.description || "① 問い（ミッション）で探求テーマを選ぶと、ここに表示されます。";
        descEl.classList.toggle("is-empty", !mission);
      }
      if (boxEl) boxEl.classList.toggle("is-empty", !mission);
      if (outlineEl) {
        const prompts = guide.prompts || [];
        outlineEl.innerHTML = prompts.map((p) => "<li>" + p + "</li>").join("");
      }
      if (draftBtn) draftBtn.disabled = !mission;
      if (this.summaryTa) {
        this.summaryTa.placeholder = mission
          ? "「" + mission.title + "」への答えとして、実験で分かったことを自分の言葉で…"
          : "①で選んだ探求テーマへの答えを、実験・考察を振り返って書きましょう…";
      }
    }

    mount(parent, state, allDone, actions) {
      const card = this.createCardShell(false);
      card.classList.add("step-summary");
      const locked = allDone !== true;
      this.body.innerHTML =
        '<div class="summary-mission-box" id="summaryMissionBox">' +
        '<p class="summary-mission-kicker">① で選んだ探求テーマ</p>' +
        '<p class="summary-mission-title" id="summaryMissionTitle">—</p>' +
        '<p class="summary-mission-desc" id="summaryMissionDesc"></p>' +
        "</div>" +
        '<div class="summary-answer-guide" id="summaryAnswerGuide">' +
        '<p class="summary-answer-guide-lead">このテーマへの<strong>答え</strong>を、次の流れでまとめましょう。</p>' +
        '<ol class="summary-answer-outline" id="summaryAnswerOutline"></ol>' +
        '<button type="button" class="summary-draft-btn" id="summaryInsertDraftBtn">📝 下書きの型を挿入</button>' +
        "</div>" +
        '<div class="inquiry-field summary-text-field" id="summaryTextField">' +
        '<label for="inqSummary">まとめ（①の探求テーマへの答え）</label>' +
        '<textarea id="inqSummary" rows="8" placeholder="問い→仮説→実験→考察を振り返って…"></textarea></div>' +
        '<div class="summary-celebrate' + (locked ? " locked" : " unlocked") + '" id="summaryCelebrate">' +
        '<p class="summary-title">' + (locked ? "🔒 探究を完了しよう" : "🎉 探究完了！") + "</p>" +
        '<p class="summary-sub">すべてのステップを終えると、達成画面と実験レポートが表示されます。</p>' +
        '<ul class="summary-checklist" id="summaryChecklist"></ul>' +
        '<div class="summary-rate" id="summaryRate">0%</div>' +
        '<div class="summary-celebrate-actions">' +
        '<button type="button" class="summary-open-btn" id="summaryOpenBtn" style="display:none">🎉 達成画面を見る</button>' +
        '<button type="button" class="summary-report-btn" id="summaryReportBtn" style="display:none">📄 実験レポートを見る</button>' +
        "</div></div>" +
        '<p class="inquiry-card-desc" style="margin-top:8px">まとめを書いている間は達成画面は表示されません。「決定 → 探究完了」を押すと達成画面とレポートが開きます。</p>' +
        '<div class="inquiry-ai-generate-bar" id="inquiryAiGenerateBar">' +
        '<p class="inquiry-ai-generate-lead">各項目の伴走AIコメントを一括生成してレポートに載せられます。</p>' +
        '<button type="button" class="inquiry-ai-generate-btn" id="inqGenerateAiBtn">🤝 AIコメントを生成</button>' +
        '<p class="inquiry-ai-generate-status" id="inqAiGenerateStatus" aria-live="polite"></p>' +
        "</div>";
      parent.appendChild(card);
      this.celebrateEl = this.body.querySelector("#summaryCelebrate");
      this.checklistEl = this.body.querySelector("#summaryChecklist");
      this.rateEl = this.body.querySelector("#summaryRate");
      this.openBtn = this.body.querySelector("#summaryOpenBtn");
      this.reportBtn = this.body.querySelector("#summaryReportBtn");
      if (this.openBtn && actions?.onOpenSummary) {
        this.openBtn.addEventListener("click", actions.onOpenSummary);
      }
      if (this.reportBtn && actions?.onOpenReport) {
        this.reportBtn.addEventListener("click", actions.onOpenReport);
      }
      this.summaryTa = this.body.querySelector("#inqSummary");
      this._resizeSummaryTa = bindAutoResizeTextarea(this.summaryTa, 180);
      if (this.summaryTa && actions?.onChange) {
        this.summaryTa.value = state.summaryText || "";
        this.summaryTa.addEventListener("input", () => actions.onChange({ summaryText: this.summaryTa.value }));
        this.summaryTa.addEventListener("focus", () => actions?.onSummaryFocus?.());
        this.summaryTa.addEventListener("blur", () => actions?.onSummaryBlur?.());
        this.companion = wireCompanion(this.summaryTa, "summaryText", () => ({
          missionTitle: global.InquiryMissions?.getMission((actions?.getState?.() || state).missionId)?.title || "",
        }));
      }
      const draftBtn = this.body.querySelector("#summaryInsertDraftBtn");
      if (draftBtn && actions?.onChange) {
        draftBtn.addEventListener("click", () => {
          const st = actions.getState?.() || state;
          const draft = this._buildSummaryDraft(st);
          if (!draft.trim()) return;
          if (this.summaryTa.value.trim() && !window.confirm("入力中のまとめを下書きの型で置き換えますか？")) return;
          this.summaryTa.value = draft;
          this.summaryTa.focus();
          actions.onChange({ summaryText: draft });
          this.companion?.refresh?.();
          this._resizeSummaryTa?.();
        });
      }
      this.updateMissionGuide(state);
      const genBtn = this.body.querySelector("#inqGenerateAiBtn");
      if (genBtn && actions?.onGenerateAiComments) {
        genBtn.addEventListener("click", () => actions.onGenerateAiComments(this.body.querySelector("#inqAiGenerateStatus")));
      }
      this.appendConfirmRow(actions);
      return this;
    }

    update(doneMap, percent, labels) {
      const allDone = percent >= 100;
      if (this.celebrateEl) {
        this.celebrateEl.classList.toggle("locked", !allDone);
        this.celebrateEl.classList.toggle("unlocked", allDone);
        const title = this.celebrateEl.querySelector(".summary-title");
        const sub = this.celebrateEl.querySelector(".summary-sub");
        if (title) title.textContent = allDone ? "🎉 探究完了！" : "🔒 探究を完了しよう";
        if (sub) {
          sub.textContent = allDone
            ? "おめでとう！ 実験レポートを確認して PDF で保存できます。"
            : "すべてのステップを終えると、達成画面と実験レポートが表示されます。";
        }
      }
      if (this.openBtn) this.openBtn.style.display = allDone ? "inline-block" : "none";
      if (this.reportBtn) this.reportBtn.style.display = allDone ? "inline-block" : "none";
      if (this.checklistEl) {
        this.checklistEl.innerHTML = labels.map((lbl, i) => {
          const id = InquiryProgress.STEP_IDS[i];
          const done = doneMap[id];
          return '<li class="' + (done ? "done" : "") + '">' + lbl + "</li>";
        }).join("");
      }
      if (this.rateEl) this.rateEl.textContent = percent + "%";
    }

    isComplete(state) {
      return (state.summaryText || "").trim().length >= 4;
    }
  }

  global.InquirySteps = {
    BaseStep,
    StepQuestion,
    StepHypothesis,
    StepPlan,
    StepExperiment,
    StepResults,
    StepGraph,
    StepReflection,
    StepSummary,
    drawReportQTGraph,
    drawReportChartAxes,
    REPORT_Q_KJ_THRESHOLD,
    getGraphTargets,
    normalizeGraphsCreated,
    syncLegacyGraphFlags,
    GRAPH_MATERIAL_ORDER,
    GRAPH_MATERIAL_CONFIG,
    buildCustomGraphPoints,
    drawCustomDataGraph,
    getCustomGraphCaption,
    CUSTOM_GRAPH_AXES,
    CUSTOM_GRAPH_X_KEYS,
    CUSTOM_GRAPH_Y_KEYS,
  };
})(window);
