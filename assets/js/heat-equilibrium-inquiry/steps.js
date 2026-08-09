/**
 * 熱平衡探究 — 各 STEP コンポーネント
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
    }

    exportData() { return {}; }
  }

  const MATERIAL_NAMES = { water: "水", iron: "鉄", aluminum: "アルミ", air: "空気" };

  const SERIES_A_COLOR = { line: "#fb923c", dot: "#fdba74" };
  const SERIES_B_COLOR = { line: "#38bdf8", dot: "#7dd3fc" };

  const AXIS_TICK_TARGET = 7;
  const REPORT_CHART_PAD = { l: 68, r: 28, t: 16, b: 56 };
  const REPORT_TEMP_TICK_STEP = 5;

  const TIMELINE_META = {
    matA: { label: "物体A 物質", fmt: (v) => MATERIAL_NAMES[v] || String(v) },
    matB: { label: "物体B 物質", fmt: (v) => MATERIAL_NAMES[v] || String(v) },
    materialPair: { label: "物質の組", fmt: (v) => {
      if (v && typeof v === "object") {
        return (MATERIAL_NAMES[v.matA] || v.matA) + " – " + (MATERIAL_NAMES[v.matB] || v.matB);
      }
      return String(v);
    }},
    massA: { label: "質量 mA", fmt: (v) => v + " g" },
    massB: { label: "質量 mB", fmt: (v) => v + " g" },
    tempA: { label: "初期 TA", fmt: (v) => Number(v).toFixed(1) + " ℃" },
    tempB: { label: "初期 TB", fmt: (v) => Number(v).toFixed(1) + " ℃" },
    tempDiff: { label: "温度差", fmt: (v) => Number(v).toFixed(1) + " ℃" },
  };

  const CUSTOM_GRAPH_AXES = {
    measureRound: { label: "測定回", unit: "回", preferChart: "bar", getValue: (r) => Number(r.measureRound) },
    tempDiff: { label: "初期温度差", unit: "℃", preferChart: "line", getValue: (r) => Number(r.tempDiff) },
    massRatio: { label: "質量比 mA/mB", unit: "", preferChart: "line", getValue: (r) => Number(r.massRatio) },
    simTime: { label: "接触時間", unit: "s", preferChart: "line", getValue: (r) => Number(r.simTime) },
    deltaTA: { label: "ΔTA", unit: "℃", getValue: (r) => Number(r.deltaTA) },
    deltaTB: { label: "ΔTB", unit: "℃", getValue: (r) => Number(r.deltaTB) },
    teqFinal: { label: "Teq（測定）", unit: "℃", getValue: (r) => Number(r.teqFinal) },
    Q_loss: { label: "Q_loss", unit: "J", getValue: (r) => Number(r.Q_loss) },
  };

  const CUSTOM_GRAPH_X_KEYS = ["measureRound", "tempDiff", "massRatio", "simTime"];
  const CUSTOM_GRAPH_Y_KEYS = ["deltaTA", "deltaTB", "teqFinal", "Q_loss"];

  function buildTicks(min, max, targetCount) {
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    const span = Math.max(hi - lo, 1);
    const target = Math.max(4, targetCount || AXIS_TICK_TARGET);
    const rawStep = span / target;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const norm = rawStep / mag;
    let step = mag;
    if (norm <= 1) step = mag;
    else if (norm <= 2) step = 2 * mag;
    else if (norm <= 5) step = 5 * mag;
    else step = 10 * mag;
    const start = Math.floor(lo / step) * step;
    const ticks = [];
    for (let v = start; v <= hi + step * 0.01; v += step) {
      if (v >= lo - step * 0.01) ticks.push(Math.round(v * 1000) / 1000);
    }
    return ticks.length ? ticks : [lo, hi];
  }

  function buildReportTicks(min, max, targetCount, opts) {
    let ticks = buildTicks(min, max, targetCount);
    if (opts?.forceZero && min <= 0 && max > 0 && !ticks.includes(0)) {
      ticks = [0, ...ticks.filter((t) => t !== 0)].sort((a, b) => a - b);
    }
    return ticks;
  }

  function formatYTick(v) {
    if (v === 0) return "0";
    if (Math.abs(v) < 10) return v.toFixed(1);
    return String(Math.round(v));
  }

  function formatReportTickValue(v, xMax, unit) {
    if (Math.abs(v) < 10 && unit === "℃") return v.toFixed(1);
    if (Math.abs(v) >= 1000) return Math.round(v);
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  }

  function formatReportYTick(v) {
    return formatYTick(v);
  }

  function snapReportNumericRange(min, max) {
    const span = Math.max(max - min, 1);
    const pad = span * 0.08;
    return { min: min - pad, max: max + pad };
  }

  function drawClippedSeries(ctx, pad, plotW, plotH, drawFn) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(pad.l, pad.t, plotW, plotH);
    ctx.clip();
    drawFn();
    ctx.restore();
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
        : formatReportTickValue(xv, xMax, axis.xUnit || "");
      ctx.fillText(String(label), x, h - pad.b + 5);
    });

    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    yTicks.forEach((yv) => {
      ctx.fillText(formatYTick(yv), pad.l - 6, vy(yv));
    });

    ctx.font = "10px Inter, Noto Sans JP, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(axis.xLabel + (axis.xUnit ? "（" + axis.xUnit + "）" : ""), (pad.l + w - pad.r) / 2, h - 2);

    ctx.save();
    ctx.translate(14, (pad.t + h - pad.b) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText(opts.yAxisLabel || "T（℃）", 0, 0);
    ctx.restore();
  }

  function drawReportChartAxes(ctx, opts) {
    const { w, h, pad, xMin, xMax, yMin, yMax, axis, tx, vy, yAxisLabel, categorical, catKeys } = opts;
    const xTicksRaw = categorical && catKeys?.length
      ? catKeys.map((_, i) => i)
      : buildReportTicks(xMin, xMax, AXIS_TICK_TARGET, { forceZero: xMin <= 0 && xMax > 0 });
    const yTicksRaw = buildReportTicks(yMin, yMax, AXIS_TICK_TARGET);
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
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const label = categorical && catKeys
        ? String(catKeys[xv] ?? xv)
        : formatReportTickValue(xv, xMax, axis.xUnit || "");
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
    ctx.fillStyle = "#334155";
    ctx.fillText(axis.xLabel + (axis.xUnit ? "（" + axis.xUnit + "）" : ""), (pad.l + w - pad.r) / 2, h - 4);

    ctx.save();
    ctx.translate(16, (pad.t + axisBottom) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#1e293b";
    ctx.fillText(yAxisLabel || "温度 T（℃）", 0, 0);
    ctx.restore();
  }

  function normalizeResult(r) {
    if (global.InquiryStorage?.migrateResult) return global.InquiryStorage.migrateResult(r);
    return r;
  }

  function getSortedResults(results) {
    if (global.InquiryStorage?.sortResults) return global.InquiryStorage.sortResults(results || []);
    return (results || []).map(normalizeResult);
  }

  function normalizeContactLog(log) {
    return (log || []).map((row, i) => {
      const r = normalizeResult(row);
      return { ...r, measureRound: r.measureRound || (i + 1) };
    });
  }

  function formatPairLabel(matA, matB) {
    return (MATERIAL_NAMES[matA] || matA) + " – " + (MATERIAL_NAMES[matB] || matB);
  }

  function formatSignedDelta(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    if (Math.abs(n) < 0.05) return "0 ℃";
    return (n > 0 ? "+" : "") + n.toFixed(1) + " ℃";
  }

  function escHtml(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function getContactSessionColumns() {
    return [
      { key: "measureRound", label: "測定回", fmt: (v) => (v || "—") + "回目" },
      { key: "matA", label: "A/B 物質", fmt: (_v, r) => formatPairLabel(r.matA, r.matB) },
      { key: "tempAInit", label: "初期 TA/TB", fmt: (_v, r) => Number(r.tempAInit).toFixed(1) + " / " + Number(r.tempBInit).toFixed(1) + " ℃" },
      { key: "Q_loss", label: "Q_loss", fmt: (v) => Math.round(Number(v) || 0) + " J" },
      { key: "Q_gain", label: "Q_gain", fmt: (v) => Math.round(Number(v) || 0) + " J" },
      { key: "teqFinal", label: "Teq", fmt: (v) => Number(v).toFixed(1) + " ℃" },
    ];
  }

  function getResultsColumns(planChecks) {
    const c = planChecks || {};
    const cols = [
      { key: "measureRound", label: "回", fmt: (v) => v + "回目" },
      { key: "matA", label: "A 物質", fmt: (v) => MATERIAL_NAMES[v] || v },
      { key: "matB", label: "B 物質", fmt: (v) => MATERIAL_NAMES[v] || v },
    ];
    if (c.massA) cols.push({ key: "massA", label: "mA (g)", fmt: (v) => v + " g" });
    if (c.massB) cols.push({ key: "massB", label: "mB (g)", fmt: (v) => v + " g" });
    cols.push(
      { key: "tempAInit", label: "初期 TA", fmt: (v) => Number(v).toFixed(1) + " ℃" },
      { key: "tempBInit", label: "初期 TB", fmt: (v) => Number(v).toFixed(1) + " ℃" },
      { key: "tempAFinal", label: "最終 TA", fmt: (v) => Number(v).toFixed(1) + " ℃" },
      { key: "tempBFinal", label: "最終 TB", fmt: (v) => Number(v).toFixed(1) + " ℃" },
      { key: "deltaTA", label: "ΔTA", fmt: (v) => formatSignedDelta(v) },
      { key: "deltaTB", label: "ΔTB", fmt: (v) => formatSignedDelta(v) },
      { key: "Q_loss", label: "Q_loss (J)", fmt: (v) => Math.round(Number(v) || 0) + " J" },
      { key: "Q_gain", label: "Q_gain (J)", fmt: (v) => Math.round(Number(v) || 0) + " J" },
      { key: "teqFinal", label: "Teq 測定", fmt: (v) => Number(v).toFixed(1) + " ℃" },
      { key: "teqTheory", label: "Teq 理論", fmt: (v) => Number(v).toFixed(1) + " ℃" }
    );
    if (c.tempDiff) cols.splice(4, 0, { key: "tempDiff", label: "温度差", fmt: (v) => Number(v).toFixed(1) + " ℃" });
    return cols;
  }

  function prepareTTPoints(series) {
    return (series || [])
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
      .slice()
      .sort((a, b) => a.x - b.x);
  }

  function computeTTAxisRange(seriesA, seriesB) {
    const pts = [...prepareTTPoints(seriesA), ...prepareTTPoints(seriesB)];
    if (!pts.length) return { tMin: 0, tMax: 10, tempMin: 0, tempMax: 100 };
    const tMin = 0;
    const tMax = Math.max(...pts.map((p) => p.x), 1) * 1.08;
    let tempLo = Math.min(...pts.map((p) => p.y));
    let tempHi = Math.max(...pts.map((p) => p.y));
    const span = Math.max(tempHi - tempLo, 6);
    const tempMin = tempLo - span * 0.1;
    const tempMax = tempHi + span * 0.12;
    return { tMin, tMax, tempMin, tempMax };
  }

  function drawTTSeries(ctx, pts, tx, ty, colors, reportMode) {
    if (!pts || pts.length < 2) return;
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = reportMode ? 2 : 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (!reportMode) {
      ctx.shadowBlur = 8;
      ctx.shadowColor = colors.line;
    }
    ctx.beginPath();
    ctx.moveTo(tx(pts[0].x), ty(pts[0].y));
    for (let i = 1; i < pts.length; i += 1) {
      ctx.lineTo(tx(pts[i].x), ty(pts[i].y));
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = colors.dot;
    pts.forEach((p) => {
      ctx.beginPath();
      ctx.arc(tx(p.x), ty(p.y), reportMode ? 2.5 : 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawTTGraphCore(canvas, w, h, curveData, opts) {
    const o = opts || {};
    const reportMode = !!o.reportMode;
    const seriesA = prepareTTPoints(curveData?.seriesA);
    const seriesB = prepareTTPoints(curveData?.seriesB);
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const pad = reportMode ? { ...REPORT_CHART_PAD } : { l: 52, r: 16, t: 28, b: 48 };

    if (reportMode) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
    } else {
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, "#0a1020");
      bg.addColorStop(1, "#0c1528");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
    }

    if (seriesA.length < 2 && seriesB.length < 2) {
      ctx.fillStyle = reportMode ? "#64748b" : "#64748b";
      ctx.font = "12px Inter, Noto Sans JP, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(o.emptyMsg || "T–t データがありません", w / 2, h / 2);
      return false;
    }

    const { tMin, tMax, tempMin, tempMax } = computeTTAxisRange(seriesA, seriesB);
    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;
    const tx = (t) => pad.l + ((t - tMin) / Math.max(tMax - tMin, 0.01)) * plotW;
    const ty = (T) => pad.t + plotH * (1 - (T - tempMin) / Math.max(tempMax - tempMin, 0.01));

    const axisOpts = {
      w, h, pad, xMin: tMin, xMax: tMax, yMin: tempMin, yMax: tempMax,
      axis: { xLabel: "時間 t", xUnit: "s" },
      tx, vy: ty, yAxisLabel: "温度 T（℃）",
      categorical: false, catKeys: null,
    };

    if (reportMode) {
      drawReportChartAxes(ctx, axisOpts);
    } else {
      drawChartAxes(ctx, axisOpts);
    }

    drawClippedSeries(ctx, pad, plotW, plotH, () => {
      drawTTSeries(ctx, seriesA, tx, ty, SERIES_A_COLOR, reportMode);
      drawTTSeries(ctx, seriesB, tx, ty, SERIES_B_COLOR, reportMode);
    });

    ctx.font = (reportMode ? "9px" : "10px") + " Inter, Noto Sans JP, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const matAName = o.matAName || "物体A";
    const matBName = o.matBName || "物体B";
    ctx.fillStyle = SERIES_A_COLOR.line;
    ctx.fillText("— " + matAName + " (A)", pad.l + 4, pad.t + 8);
    ctx.fillStyle = SERIES_B_COLOR.line;
    ctx.fillText("— " + matBName + " (B)", pad.l + 4, pad.t + 22);

    return true;
  }

  function drawReportTTGraph(canvas, w, h, curveData, opts) {
    if (!canvas || w < 40 || h < 40) return false;
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    return drawTTGraphCore(canvas, w, h, curveData, { ...(opts || {}), reportMode: true });
  }

  function drawSessionTTGraph(canvas, curveData, opts) {
    if (!canvas) return false;
    const wrap = canvas.parentElement;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(280, wrap?.clientWidth || 280);
    const h = 220;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return drawTTGraphCore(canvas, w, h, curveData, opts);
  }

  function getGraphTargets(state) {
    const ids = new Set();
    (state?.results || []).forEach((r) => {
      if (r?.measureId) ids.add(String(r.measureId));
    });
    Object.keys(state?.ttCurves || {}).forEach((k) => ids.add(String(k)));
    (state?.contactMeasureLog || []).forEach((r) => {
      if (r?.measureId) ids.add(String(r.measureId));
    });
    return [...ids].sort((a, b) => Number(a) - Number(b));
  }

  function normalizeGraphsCreated(state) {
    const out = {};
    if (state?.graphsCreated && typeof state.graphsCreated === "object") {
      Object.assign(out, state.graphsCreated);
    }
    return out;
  }

  function getSessionLabel(state, measureId) {
    const row = getSortedResults(state?.results).find((r) => String(r.measureId) === String(measureId))
      || normalizeContactLog(state?.contactMeasureLog).find((r) => String(r.measureId) === String(measureId));
    if (!row) return "測定 " + measureId;
    return row.measureRound + "回目 · " + formatPairLabel(row.matA, row.matB);
  }

  function buildCustomGraphPoints(state, graphDef) {
    const xKey = graphDef.xKey;
    const yKey = graphDef.yKey;
    const xDef = CUSTOM_GRAPH_AXES[xKey];
    const yDef = CUSTOM_GRAPH_AXES[yKey];
    if (!xDef || !yDef) return { points: [], categorical: false, catLabels: [], chartType: "line" };

    const rows = getSortedResults(state?.results);
    if (!rows.length) return { points: [], categorical: false, catLabels: [], chartType: "line" };

    if (xDef.categorical) {
      const points = [];
      const seen = new Set();
      rows.forEach((r) => {
        const cat = xDef.getValue(r);
        if (seen.has(cat)) return;
        seen.add(cat);
        const y = yDef.getValue(r);
        if (!Number.isFinite(y)) return;
        points.push({ x: points.length, y, xLabel: cat });
      });
      return { points, categorical: true, catLabels: points.map((p) => p.xLabel), chartType: "bar" };
    }

    const points = rows.map((r) => ({ x: xDef.getValue(r), y: yDef.getValue(r) }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
      .sort((a, b) => a.x - b.x);
    return { points, categorical: false, catLabels: [], chartType: "line" };
  }

  function getCustomGraphCaption(graphDef) {
    const xDef = CUSTOM_GRAPH_AXES[graphDef.xKey];
    const yDef = CUSTOM_GRAPH_AXES[graphDef.yKey];
    return "横：" + (xDef?.label || graphDef.xKey) + " · 縦：" + (yDef?.label || graphDef.yKey);
  }

  function barChartXDomain(points, categorical) {
    const n = points.length;
    if (categorical) return { xMin: -0.5, xMax: Math.max(0.5, n - 0.5) };
    const lo = Math.min(...points.map((p) => p.x));
    const hi = Math.max(...points.map((p) => p.x));
    return { xMin: lo - 0.5, xMax: hi + 0.5 };
  }

  function drawCustomBarSeries(ctx, points, tx, ty, opts) {
    const { yMin, yMax, lineColor, dotColor, reportMode } = opts;
    const yBase = (yMin <= 0 && yMax >= 0) ? 0 : yMin;
    const y0 = ty(yBase);
    const barW = Math.min(opts.barSlotW * 0.62, reportMode ? 36 : 44);
    points.forEach((p) => {
      const cx = tx(p.x);
      const yTop = ty(p.y);
      const top = Math.min(y0, yTop);
      const height = Math.max(1, Math.abs(yTop - y0));
      ctx.fillStyle = reportMode ? (dotColor || lineColor || "#0891b2") : (lineColor || "#22d3ee") + "cc";
      ctx.fillRect(cx - barW / 2, top, barW, height);
    });
  }

  function drawCustomDataGraph(canvas, state, graphDef, opts) {
    if (!canvas || !graphDef) return false;
    const o = opts || {};
    const built = buildCustomGraphPoints(state, graphDef);
    const { points, categorical, catLabels, chartType } = built;
    const xDef = CUSTOM_GRAPH_AXES[graphDef.xKey];
    const yDef = CUSTOM_GRAPH_AXES[graphDef.yKey];

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
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
    } else {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, "#0a1020");
      bg.addColorStop(1, "#0c1528");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
    }

    const pad = o.reportMode ? { ...REPORT_CHART_PAD } : { l: 52, r: 16, t: 22, b: 48 };
    const minPoints = chartType === "bar" ? 1 : 2;
    if (points.length < minPoints) {
      ctx.fillStyle = "#64748b";
      ctx.font = "12px Inter, Noto Sans JP, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(o.emptyMsg || "データが不足しています", w / 2, h / 2);
      return false;
    }

    let xMin; let xMax; let yMin; let yMax;
    if (categorical || chartType === "bar") {
      ({ xMin, xMax } = barChartXDomain(points, categorical));
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

    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;
    const tx = (X) => pad.l + ((X - xMin) / Math.max(xMax - xMin, 1)) * plotW;
    const ty = (Y) => pad.t + plotH * (1 - (Y - yMin) / Math.max(yMax - yMin, 1));
    const axisCatKeys = categorical ? points.map((p) => p.xLabel || "") : catLabels;

    if (o.reportMode) {
      drawReportChartAxes(ctx, {
        w, h, pad, xMin, xMax, yMin, yMax,
        axis: { xLabel: xDef.label, xUnit: xDef.unit || "" },
        tx, vy: ty,
        yAxisLabel: yDef.label + (yDef.unit ? "（" + yDef.unit + "）" : ""),
        categorical, catKeys: categorical ? axisCatKeys : null,
      });
    } else {
      drawChartAxes(ctx, {
        w, h, pad, xMin, xMax, yMin, yMax,
        axis: { xLabel: xDef.label, xUnit: xDef.unit || "" },
        tx, vy: ty, categorical, catKeys: categorical ? axisCatKeys : null,
        yAxisLabel: yDef.label + (yDef.unit ? "（" + yDef.unit + "）" : ""),
      });
    }

    const lineColor = o.lineColor || "#22d3ee";
    const dotColor = o.dotColor || "#67e8f9";

    if (chartType === "bar") {
      drawClippedSeries(ctx, pad, plotW, plotH, () => {
        drawCustomBarSeries(ctx, points, tx, ty, {
          yMin, yMax, lineColor, dotColor, reportMode: !!o.reportMode,
          barSlotW: plotW / Math.max(xMax - xMin, 1),
        });
      });
      return true;
    }

    drawClippedSeries(ctx, pad, plotW, plotH, () => {
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = o.reportMode ? 2 : 2.5;
      ctx.beginPath();
      ctx.moveTo(tx(points[0].x), ty(points[0].y));
      for (let i = 1; i < points.length; i += 1) ctx.lineTo(tx(points[i].x), ty(points[i].y));
      ctx.stroke();
      ctx.fillStyle = dotColor;
      points.forEach((p) => {
        ctx.beginPath();
        ctx.arc(tx(p.x), ty(p.y), o.reportMode ? 2.5 : 3, 0, Math.PI * 2);
        ctx.fill();
      });
    });
    return true;
  }

  function wireCompanion(fieldEl, field, getContext) {
    if (!global.InquiryCompanion?.attach || !fieldEl) return null;
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
        '<p class="inquiry-card-desc">熱量保存と熱平衡について、達成したい問い（ミッション）を1つ選びましょう。測定表の列名（Teq など）は物理の記号ですが、選択肢は日本語で書いています。</p>' +
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
        const defaults = global.InquiryMissions?.DEFAULT_PLAN_CHECKS || { materialPair: true, massA: false, massB: false, tempDiff: false };
        onChange({ missionId: id, hypothesisId: "", planId: "", planText: "", planChecks: { ...defaults } });
        this.companion?.refresh?.();
      });

      this.companion = wireCompanionWrap(
        this.body, "mission",
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

    isComplete(state) { return !!state.missionId; }

    exportData(state) {
      const m = global.InquiryMissions?.getMission(state.missionId);
      return { missionId: state.missionId, question: m ? m.title + " — " + m.description : state.question };
    }
  }

  class StepHypothesis extends BaseStep {
    constructor() { super("hypothesis", "②", "仮説"); }

    mount(parent, state, onChange, actions) {
      const card = this.createCardShell(false);
      const mission = global.InquiryMissions?.getMission(state.missionId);
      this.body.innerHTML =
        '<p class="inquiry-card-desc" id="inquiryHypMissionLead">' +
        (mission ? "ミッション「" + mission.title + "」に関する仮説を選びましょう。" : "先に①でミッションを選んでください。") +
        "</p>" +
        '<div id="inquiryHypChoices"></div>' +
        '<div class="inquiry-field" style="margin-top:10px"><label for="inqHypFree">一言で補足（任意）</label>' +
        '<input type="text" class="inquiry-text-input" id="inqHypFree" maxlength="120" placeholder="例：失った熱量と得た熱量は等しくなると思う"></div>';
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

      this.companion = wireCompanionWrap(this.body, "hypothesis", () => {
        const id = this.body.querySelector('input[name="inquiryHypothesis"]:checked')?.value || state.hypothesisId || "";
        const h = global.InquiryMissions?.getHypothesis(id);
        const free = this.body.querySelector("#inqHypFree")?.value || state.hypothesisFreeText || "";
        return (h?.text || "") + (h?.reason ? " 根拠：" + h.reason : "") + (free ? " （" + free + "）" : "");
      }, () => ({
        step: "hypothesis",
        missionId: state.missionId,
        hypothesisId: state.hypothesisId,
        hypothesisLabel: global.InquiryMissions?.getHypothesis(state.hypothesisId)?.text || "",
      }));

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
          ? "ミッション「" + mission.title + "」に関する仮説を選びましょう。"
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

    isComplete(state) { return !!state.missionId && !!state.hypothesisId; }

    exportData(state) {
      const h = global.InquiryMissions?.getHypothesis(state.hypothesisId);
      return {
        hypothesisId: state.hypothesisId,
        hypothesisFreeText: state.hypothesisFreeText,
        hypothesis: state.hypothesis,
        hypothesisReason: state.hypothesisFreeText || state.hypothesisReason,
        hypothesisText: h?.text || "",
      };
    }
  }

  class StepPlan extends BaseStep {
    constructor() { super("plan", "③", "実験計画"); }

    mount(parent, state, onChange, actions) {
      const card = this.createCardShell(false);
      const mission = global.InquiryMissions?.getMission(state.missionId);
      this.body.innerHTML =
        '<p class="inquiry-card-desc" id="inquiryPlanMissionLead">' +
        (mission ? "ミッション「" + mission.title + "」のための接触実験計画を選びましょう。" : "先に①でミッションを選んでください。") +
        "</p>" +
        '<div id="inquiryPlanChoices"></div>' +
        '<p class="inquiry-plan-auto-note">選んだ計画の「操作変数」が記録・分析の対象になります。物質・質量・初期温度は④でいつでも設定できます。</p>';
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

      this.companion = wireCompanionWrap(this.body, "plan", () => {
        const id = this.body.querySelector('input[name="inquiryPlan"]:checked')?.value || state.planId || "";
        const p = global.InquiryMissions?.getPlan(id);
        return p ? p.text + (p.compare ? " 比較：" + p.compare : "") + "（ねらい：" + p.purpose + "）" : "";
      }, () => ({ step: "plan", missionId: state.missionId, planId: state.planId }));

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
        change(global.InquiryMissions?.applyPlanSelection(id) || { planId: id });
        this.companion?.refresh?.();
      });
    }

    isComplete(state) { return !!state.missionId && !!state.planId; }

    exportData(state) {
      const p = global.InquiryMissions?.getPlan(state.planId);
      return { planId: state.planId, planChecks: state.planChecks, planText: state.planText, planPurpose: p?.purpose || "", planCompare: p?.compare || "" };
    }
  }

  class StepExperiment extends BaseStep {
    constructor() { super("experiment", "④", "実験"); }

    mount(parent, state, actions) {
      const card = this.createCardShell(false);
      this.body.innerHTML =
        '<p class="inquiry-card-desc">左で物体 A・B の条件を整え、「接触測定」で熱平衡まで記録しましょう。2 回以上、条件を変えて測定すると比較しやすくなります。</p>' +
        '<div class="exp-action-row">' +
        '<button type="button" class="inquiry-action-btn exp-measure-btn" id="expMeasureBtn">📏 接触測定</button>' +
        '<button type="button" class="inquiry-exp-reset-btn" id="expResetBtn">↺ 実験リセット</button>' +
        "</div>" +
        '<p class="exp-measure-hint" id="expMeasureHint">条件を整えてから接触測定ボタンを押してください</p>' +
        '<div class="exp-timeline"><h4>🔬 実験ログ（条件の変更履歴）</h4>' +
        '<div class="exp-timeline-list" id="expTimelineList"></div></div>' +
        '<div class="exp-heat-log"><h4>📊 接触測定ログ（回 · Q · Teq）</h4>' +
        '<div class="exp-heat-log-list" id="expContactLogList"></div></div>';
      parent.appendChild(card);
      this.timelineEl = this.body.querySelector("#expTimelineList");
      this.contactLogEl = this.body.querySelector("#expContactLogList");
      this.measureBtn = this.body.querySelector("#expMeasureBtn");
      this.resetBtn = this.body.querySelector("#expResetBtn");
      this.hintEl = this.body.querySelector("#expMeasureHint");
      if (actions?.onMeasure && this.measureBtn) this.measureBtn.addEventListener("click", actions.onMeasure);
      if (actions?.onReset && this.resetBtn) this.resetBtn.addEventListener("click", actions.onReset);
      this.renderTimeline(state.timeline);
      this.renderContactLog(state.contactMeasureLog);
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
        const type = item.type || "matA";
        const meta = TIMELINE_META[type] || TIMELINE_META.matA;
        const toStr = meta.fmt(item.to);
        if (item.from == null) {
          return '<div class="exp-timeline-item"><span class="exp-type">' + meta.label + "</span> " +
            '<span class="temp">' + toStr + "</span> で開始</div>";
        }
        return '<div class="exp-timeline-item"><span class="exp-type">' + meta.label + "</span> " +
          '<span class="temp">' + meta.fmt(item.from) + '</span> <span class="arrow">→</span> <span class="temp">' + toStr + "</span></div>";
      }).join("");
    }

    renderContactLog(log) {
      if (!this.contactLogEl) return;
      const rows = normalizeContactLog(log);
      if (rows.length === 0) {
        this.contactLogEl.innerHTML = '<p class="exp-heat-log-empty">「接触測定」するたび、回・Q·Teq がここに記録されます…</p>';
        return;
      }
      const body = rows.map((row) =>
        "<tr>" +
        "<td>" + row.measureRound + "回目</td>" +
        "<td>" + escHtml(formatPairLabel(row.matA, row.matB)) + "</td>" +
        "<td>" + Number(row.tempAInit).toFixed(1) + " / " + Number(row.tempBInit).toFixed(1) + " ℃</td>" +
        "<td>" + Math.round(row.Q_loss || 0) + " J</td>" +
        "<td>" + Math.round(row.Q_gain || 0) + " J</td>" +
        "<td>" + Number(row.teqFinal).toFixed(1) + " ℃</td>" +
        "</tr>"
      ).join("");
      this.contactLogEl.innerHTML =
        '<table class="exp-heat-log-table">' +
        "<thead><tr><th>回</th><th>A–B</th><th>初期 TA/TB</th><th>Q_loss</th><th>Q_gain</th><th>Teq</th></tr></thead>" +
        "<tbody>" + body + "</tbody></table>";
    }

    isComplete(state) {
      return (state.results || []).length >= 1 && (state.timeline || []).length >= 1;
    }

    exportData(state) { return { timeline: state.timeline, contactMeasureLog: state.contactMeasureLog }; }
  }

  class StepResults extends BaseStep {
    constructor() { super("results", "⑤", "実験結果"); }

    mount(parent, state, actions) {
      const card = this.createCardShell(false);
      this.body.innerHTML =
        '<p class="inquiry-card-desc">接触測定1回ごとに、初期条件・温度変化・失った/得た熱量・最終温度を記録します（表の列名は Teq・Q_loss などの記号表記）。</p>' +
        '<h4 class="results-section-title">接触測定ログ</h4>' +
        '<div class="results-table-wrap"><table class="results-table">' +
        '<thead><tr id="measureSessionHead"></tr></thead>' +
        '<tbody id="measureSessionBody"></tbody></table></div>' +
        '<h4 class="results-section-title results-section-title--spaced">接触セッション詳細</h4>' +
        '<div class="results-table-wrap"><table class="results-table">' +
        '<thead><tr id="resultsTableHead"></tr></thead>' +
        '<tbody id="resultsTableBody"></tbody></table></div>';
      parent.appendChild(card);
      this.sessionHead = this.body.querySelector("#measureSessionHead");
      this.sessionBody = this.body.querySelector("#measureSessionBody");
      this.thead = this.body.querySelector("#resultsTableHead");
      this.tbody = this.body.querySelector("#resultsTableBody");
      this.updateSessionHeaders();
      this.updateTableHeaders(state.planChecks);
      this.renderMeasureSessions(state.contactMeasureLog, []);
      this.renderTable(state.results, [], state.planChecks);
      this.appendConfirmRow({ ...actions, confirmLabel: "決定 → グラフへ" });
      return this;
    }

    updateSessionHeaders() {
      if (!this.sessionHead) return;
      this.sessionHead.innerHTML = getContactSessionColumns().map((c) => "<th>" + c.label + "</th>").join("");
    }

    renderMeasureSessions(log, newMeasureIds) {
      if (!this.sessionBody) return;
      const rows = normalizeContactLog(log);
      const cols = getContactSessionColumns();
      const idSet = new Set(newMeasureIds || []);
      if (!rows.length) {
        this.sessionBody.innerHTML = '<tr><td colspan="' + cols.length + '" style="color:#64748b">接触測定データ待ち…</td></tr>';
        return;
      }
      this.sessionBody.innerHTML = rows.map((row) => {
        const cls = idSet.has(row.measureId) ? ' class="new-row"' : "";
        const cells = cols.map((c) => "<td>" + (c.fmt.length > 1 ? c.fmt(row[c.key], row) : c.fmt(row[c.key])) + "</td>").join("");
        return "<tr" + cls + ">" + cells + "</tr>";
      }).join("");
    }

    updateTableHeaders(planChecks) {
      if (!this.thead) return;
      this.thead.innerHTML = getResultsColumns(planChecks).map((c) => "<th>" + c.label + "</th>").join("");
    }

    renderTable(results, newMeasureIds, planChecks) {
      if (!this.tbody) return;
      const cols = getResultsColumns(planChecks);
      const colSpan = Math.max(cols.length, 1);
      const rows = getSortedResults(results);
      if (!rows.length) {
        this.tbody.innerHTML = '<tr><td colspan="' + colSpan + '" style="color:#64748b">データ待ち…</td></tr>';
        return;
      }
      const idSet = new Set(newMeasureIds || []);
      this.tbody.innerHTML = rows.map((raw) => {
        const r = normalizeResult(raw);
        const cls = idSet.has(r.measureId) ? ' class="new-row"' : "";
        const cells = cols.map((c) => "<td>" + (c.fmt.length > 1 ? c.fmt(r[c.key], r) : c.fmt(r[c.key])) + "</td>").join("");
        return "<tr" + cls + ">" + cells + "</tr>";
      }).join("");
    }

    isComplete(state) { return getSortedResults(state.results).length >= 2; }

    exportData(state) { return { results: state.results, contactMeasureLog: state.contactMeasureLog }; }
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
        '<p class="inquiry-card-desc">各接触セッションの <strong>T–t グラフ</strong>（橙=物体A · 青=物体B）を作成しましょう。</p>' +
        '<div class="graph-dual-wrap" id="graphTargetsWrap"></div>' +
        '<div class="graph-custom-section">' +
        '<h5 class="graph-block-title graph-custom-title">追加グラフ</h5>' +
        '<p class="inquiry-card-desc graph-custom-desc">横軸・縦軸を選んで「グラフを追加」を押してください。</p>' +
        '<div class="graph-custom-form">' +
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
      this.renderTargets(state);
      this.renderCustomGraphs(state);
      this.appendConfirmRow({ ...actions, confirmLabel: "決定 → 考察へ" });
      return this;
    }

    _addCustomGraph() {
      const xKey = this.customXSel?.value;
      const yKey = this.customYSel?.value;
      if (!xKey || !yKey) {
        if (this.customHint) this.customHint.textContent = "横軸・縦軸を選んでください。";
        return;
      }
      if (xKey === yKey) {
        if (this.customHint) this.customHint.textContent = "横軸と縦軸は別の項目を選んでください。";
        return;
      }
      const graphDef = { id: "cg_" + Date.now(), xKey, yKey, created: true };
      const next = [...(this._state?.customGraphs || []), graphDef];
      if (this.customHint) this.customHint.textContent = getCustomGraphCaption(graphDef) + " のグラフを追加しました。";
      this._onChange?.({ customGraphs: next });
    }

    _removeCustomGraph(graphId) {
      const graphs = this._state?.customGraphs || [];
      const target = graphs.find((g) => g.id === graphId);
      if (!target) return;
      this._lastCustomKey = "";
      this._onChange?.({ customGraphs: graphs.filter((g) => g.id !== graphId) });
      if (this.customHint) this.customHint.textContent = getCustomGraphCaption(target) + " のグラフを削除しました。";
    }

    renderTargets(state) {
      this._state = state;
      const targets = getGraphTargets(state);
      const key = targets.join(",");
      if (key === this._lastTargetsKey && this.blocks.size === targets.length) {
        this._refreshCreatedPanels(state);
        return;
      }
      this._lastTargetsKey = key;
      this.blocks.clear();
      if (!this.graphWrap) return;

      if (!targets.length) {
        this.graphWrap.innerHTML = '<p class="exp-timeline-empty">まだ接触測定データがありません。④で「接触測定」を押してください。</p>';
        return;
      }

      this.graphWrap.innerHTML = targets.map((measureId, i) => {
        const label = getSessionLabel(state, measureId);
        const canvasId = "inquiryGraphCanvas_" + measureId;
        return (
          '<div class="graph-block" data-measure-id="' + measureId + '">' +
          '<h5 class="graph-block-title">グラフ' + (i + 1) + " " + escHtml(label) + "（T–t）</h5>" +
          '<button type="button" class="inquiry-action-btn" data-graph-btn="' + measureId + '">📈 グラフ' + (i + 1) + "を作成</button>" +
          '<div class="graph-panel" data-graph-panel="' + measureId + '" style="display:none">' +
          '<div class="graph-canvas-wrap"><canvas id="' + canvasId + '"></canvas></div>' +
          '<p class="graph-plateau-legend"><span style="color:#fb923c">— 物体A</span> · <span style="color:#38bdf8">— 物体B</span></p></div>' +
          "</div>"
        );
      }).join("");

      targets.forEach((measureId, i) => {
        const btn = this.graphWrap.querySelector('[data-graph-btn="' + measureId + '"]');
        const panel = this.graphWrap.querySelector('[data-graph-panel="' + measureId + '"]');
        const canvas = this.graphWrap.querySelector("#inquiryGraphCanvas_" + measureId);
        btn?.addEventListener("click", () => {
          this._onChange?.({ graphsCreated: { [measureId]: true } });
        });
        this.blocks.set(measureId, { btn, panel, canvas, num: i + 1 });
      });

      this._refreshCreatedPanels(state);
    }

    renderCustomGraphs(state) {
      this._state = state;
      const graphs = state?.customGraphs || [];
      const key = graphs.map((g) => g.id + g.xKey + g.yKey).join("|");
      if (!this.customWrap) return;

      if (!graphs.length) {
        this.customWrap.innerHTML = '<p class="exp-timeline-empty">追加グラフはまだありません。</p>';
        this._lastCustomKey = key;
        return;
      }

      if (key !== this._lastCustomKey) {
        this.customWrap.innerHTML = graphs.map((g, i) =>
          '<div class="graph-block graph-block-custom" data-custom-id="' + g.id + '">' +
          '<div class="graph-block-head">' +
          '<h5 class="graph-block-title">追加グラフ' + (i + 1) + " " + escHtml(getCustomGraphCaption(g)) + "</h5>" +
          '<button type="button" class="graph-custom-delete-btn" data-custom-delete="' + g.id + '">🗑 消す</button>' +
          "</div>" +
          '<div class="graph-panel" style="display:block">' +
          '<div class="graph-canvas-wrap"><canvas id="inquiryCustomCanvas_' + g.id + '"></canvas></div></div></div>'
        ).join("");
        this.customWrap.querySelectorAll("[data-custom-delete]").forEach((btn) => {
          btn.addEventListener("click", () => this._removeCustomGraph(btn.getAttribute("data-custom-delete")));
        });
        this._lastCustomKey = key;
      }

      graphs.forEach((g) => {
        const canvas = this.customWrap.querySelector("#inquiryCustomCanvas_" + g.id);
        if (canvas) drawCustomDataGraph(canvas, state, g, { emptyMsg: "接触測定を 2 回以上行ってください" });
      });
    }

    syncFromState(state) {
      this._state = state;
      this.renderTargets(state);
      this.renderCustomGraphs(state);
    }

    _refreshCreatedPanels(state) {
      const created = normalizeGraphsCreated(state);
      this.blocks.forEach((block, measureId) => {
        if (created[measureId]) {
          this.drawSessionGraph(measureId, state);
        } else if (block.panel) {
          block.panel.style.display = "none";
          if (block.btn) {
            block.btn.disabled = false;
            block.btn.textContent = "📈 グラフ" + block.num + "を作成";
          }
        }
      });
    }

    drawSessionGraph(measureId, state) {
      const block = this.blocks.get(measureId);
      if (!block?.canvas) return;
      const curve = state?.ttCurves?.[measureId];
      const row = getSortedResults(state?.results).find((r) => String(r.measureId) === String(measureId));
      const ok = drawSessionTTGraph(block.canvas, curve, {
        matAName: MATERIAL_NAMES[row?.matA] || "物体A",
        matBName: MATERIAL_NAMES[row?.matB] || "物体B",
        emptyMsg: "T–t データがありません",
      });
      if (!ok) {
        block.btn.disabled = true;
        block.btn.textContent = "接触測定後に作成";
        return;
      }
      block.btn.disabled = false;
      block.panel.style.display = "block";
      block.btn.textContent = "↺ グラフ" + block.num + "を再作成";
    }

    isComplete(state) {
      const targets = getGraphTargets(state);
      if (!targets.length) return false;
      const created = normalizeGraphsCreated(state);
      return targets.every((id) => !!created[id]);
    }

    exportData(state) {
      return { graphsCreated: normalizeGraphsCreated(state), ttCurves: state.ttCurves, customGraphs: state.customGraphs || [] };
    }
  }

  class StepReflection extends BaseStep {
    constructor() { super("reflection", "⑦", "考察"); }

    mount(parent, state, onChange, actions) {
      const card = this.createCardShell(false);
      this.body.innerHTML =
        '<p class="inquiry-card-desc">熱量保存や最終温度について、実験結果から考えたことを書きましょう。</p>' +
        '<div class="inquiry-field"><label for="inqReflection">考察</label>' +
        '<textarea id="inqReflection" rows="4" placeholder="接触後、失った熱量と得た熱量が等しかった。最終温度は式どおり…"></textarea></div>' +
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
      if (this.finishBtn && actions?.onFinish) this.finishBtn.addEventListener("click", () => actions.onFinish());
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
        outlineEl.innerHTML = (guide.prompts || []).map((p) => "<li>" + p + "</li>").join("");
      }
      if (draftBtn) draftBtn.disabled = !mission;
    }

    mount(parent, state, allDone, actions) {
      const card = this.createCardShell(false);
      card.classList.add("step-summary");
      const locked = allDone !== true;
      this.body.innerHTML =
        '<div class="summary-mission-box" id="summaryMissionBox">' +
        '<p class="summary-mission-kicker">① で選んだ探求テーマ</p>' +
        '<p class="summary-mission-title" id="summaryMissionTitle">—</p>' +
        '<p class="summary-mission-desc" id="summaryMissionDesc"></p></div>' +
        '<div class="summary-answer-guide" id="summaryAnswerGuide">' +
        '<p class="summary-answer-guide-lead">このテーマへの<strong>答え</strong>をまとめましょう。</p>' +
        '<ol class="summary-answer-outline" id="summaryAnswerOutline"></ol>' +
        '<button type="button" class="summary-draft-btn" id="summaryInsertDraftBtn">📝 下書きの型を挿入</button></div>' +
        '<div class="inquiry-field summary-text-field"><label for="inqSummary">まとめ</label>' +
        '<textarea id="inqSummary" rows="8" placeholder="失った熱量＝得た熱量、最終温度について…"></textarea></div>' +
        '<div class="summary-celebrate' + (locked ? " locked" : " unlocked") + '" id="summaryCelebrate">' +
        '<p class="summary-title">' + (locked ? "🔒 探究を完了しよう" : "🎉 探究完了！") + "</p>" +
        '<ul class="summary-checklist" id="summaryChecklist"></ul>' +
        '<div class="summary-rate" id="summaryRate">0%</div>' +
        '<div class="summary-celebrate-actions">' +
        '<button type="button" class="summary-open-btn" id="summaryOpenBtn" style="display:none">🎉 達成画面を見る</button>' +
        '<button type="button" class="summary-report-btn" id="summaryReportBtn" style="display:none">📄 実験レポートを見る</button>' +
        "</div></div>" +
        '<div class="inquiry-ai-generate-bar">' +
        '<button type="button" class="inquiry-ai-generate-btn" id="inqGenerateAiBtn">🤝 AIコメントを生成</button>' +
        '<p class="inquiry-ai-generate-status" id="inqAiGenerateStatus" aria-live="polite"></p></div>';
      parent.appendChild(card);
      this.celebrateEl = this.body.querySelector("#summaryCelebrate");
      this.checklistEl = this.body.querySelector("#summaryChecklist");
      this.rateEl = this.body.querySelector("#summaryRate");
      this.openBtn = this.body.querySelector("#summaryOpenBtn");
      this.reportBtn = this.body.querySelector("#summaryReportBtn");
      if (this.openBtn && actions?.onOpenSummary) this.openBtn.addEventListener("click", actions.onOpenSummary);
      if (this.reportBtn && actions?.onOpenReport) this.reportBtn.addEventListener("click", actions.onOpenReport);
      this.summaryTa = this.body.querySelector("#inqSummary");
      this._resizeSummaryTa = bindAutoResizeTextarea(this.summaryTa, 180);
      if (this.summaryTa && actions?.onChange) {
        this.summaryTa.value = state.summaryText || "";
        this.summaryTa.addEventListener("input", () => actions.onChange({ summaryText: this.summaryTa.value }));
        this.summaryTa.addEventListener("focus", () => actions?.onSummaryFocus?.());
        this.summaryTa.addEventListener("blur", () => actions?.onSummaryBlur?.());
        this.companion = wireCompanion(this.summaryTa, "summaryText", () => ({}));
      }
      const draftBtn = this.body.querySelector("#summaryInsertDraftBtn");
      if (draftBtn && actions?.onChange) {
        draftBtn.addEventListener("click", () => {
          const st = actions.getState?.() || state;
          const draft = this._buildSummaryDraft(st);
          if (!draft.trim()) return;
          if (this.summaryTa.value.trim() && !window.confirm("入力中のまとめを下書きの型で置き換えますか？")) return;
          this.summaryTa.value = draft;
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
      }
      if (this.openBtn) this.openBtn.style.display = allDone ? "inline-block" : "none";
      if (this.reportBtn) this.reportBtn.style.display = allDone ? "inline-block" : "none";
      if (this.checklistEl) {
        this.checklistEl.innerHTML = labels.map((lbl, i) => {
          const id = InquiryProgress.STEP_IDS[i];
          return '<li class="' + (doneMap[id] ? "done" : "") + '">' + lbl + "</li>";
        }).join("");
      }
      if (this.rateEl) this.rateEl.textContent = percent + "%";
    }

    isComplete(state) { return (state.summaryText || "").trim().length >= 4; }
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
    drawReportTTGraph,
    drawReportChartAxes,
    drawSessionTTGraph,
    drawCustomDataGraph,
    getGraphTargets,
    normalizeGraphsCreated,
    getCustomGraphCaption,
    getSessionLabel,
    CUSTOM_GRAPH_AXES,
    CUSTOM_GRAPH_X_KEYS,
    CUSTOM_GRAPH_Y_KEYS,
    MATERIAL_NAMES,
    TIMELINE_META,
  };
})(window);
