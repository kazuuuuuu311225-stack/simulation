/**
 * 探究モード — 各STEPコンポーネント（ブラウン運動）
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

  const GRAPH_TARGET_ORDER = ["temperature", "particleSize", "particleCount"];

  const GRAPH_TARGET_CONFIG = {
    temperature: {
      name: "温度",
      lineColor: "#22d3ee",
      dotColor: "#67e8f9",
      xLabel: "温度 T",
      xUnit: "K",
      yLabel: "平均速度",
      yUnit: "px/s",
      xKey: "temperature",
      yKey: "avgSpeed",
      reportNote: "T–v グラフ",
    },
    particleSize: {
      name: "粒子サイズ",
      lineColor: "#a78bfa",
      dotColor: "#c4b5fd",
      xLabel: "粒子サイズ",
      xUnit: "px",
      yLabel: "大粒子速度",
      yUnit: "px/s",
      xKey: "largeRadius",
      yKey: "largeSpeedPxS",
      reportNote: "半径–大粒子速度",
    },
    particleCount: {
      name: "粒子数",
      lineColor: "#fb923c",
      dotColor: "#fdba74",
      xLabel: "粒子数 N",
      xUnit: "個",
      yLabel: "平均速度",
      yUnit: "px/s",
      xKey: "particleCount",
      yKey: "avgSpeed",
      reportNote: "N–v グラフ",
    },
  };

  const CUSTOM_GRAPH_AXES = {
    temperature: { label: "温度 T", unit: "K", preferChart: "line", getValue: (r) => Number(r.temperature) },
    largeRadius: { label: "粒子サイズ", unit: "px", preferChart: "line", getValue: (r) => Number(r.largeRadius) },
    particleCount: { label: "粒子数 N", unit: "個", preferChart: "line", getValue: (r) => Number(r.particleCount) },
    measureRound: { label: "測定回", unit: "回", preferChart: "bar", getValue: (r) => Number(r.measureRound) },
    avgSpeed: { label: "平均速度", unit: "px/s", getValue: (r) => Number(r.avgSpeed) },
    largeSpeedPxS: { label: "大粒子速度", unit: "px/s", getValue: (r) => Number(r.largeSpeedPxS) },
  };

  const CUSTOM_GRAPH_X_KEYS = ["temperature", "largeRadius", "particleCount", "measureRound"];
  const CUSTOM_GRAPH_Y_KEYS = ["avgSpeed", "largeSpeedPxS"];

  const AXIS_TICK_TARGET = 7;

  function getGraphTargets(state) {
    const c = state?.planChecks || {};
    const keys = new Set();
    (state?.results || []).forEach(() => {
      if (c.temperature !== false) keys.add("temperature");
      if (c.particleSize) keys.add("particleSize");
      if (c.particleCount) keys.add("particleCount");
    });
    Object.entries(state?.curves || {}).forEach(([k, pts]) => {
      if (Array.isArray(pts) && pts.length > 0) keys.add(k);
    });
    (state?.measureLog || []).forEach(() => {
      if (c.temperature !== false) keys.add("temperature");
      if (c.particleSize) keys.add("particleSize");
      if (c.particleCount) keys.add("particleCount");
    });
    return GRAPH_TARGET_ORDER.filter((k) => keys.has(k));
  }

  function normalizeGraphsCreated(state) {
    const out = { temperature: false, particleSize: false, particleCount: false };
    if (state?.graphsCreated && typeof state.graphsCreated === "object") {
      Object.assign(out, state.graphsCreated);
    }
    if (state?.graphCreated) out.temperature = true;
    return out;
  }

  function syncLegacyGraphFlags(state) {
    if (!state) return;
    state.graphsCreated = normalizeGraphsCreated(state);
    state.graphCreated = !!state.graphsCreated.temperature;
  }

  function resolveCustomGraphChartType(graphDef, xDef, categorical) {
    if (categorical || xDef?.preferChart === "bar") return "bar";
    if (xDef?.preferChart === "line") return "line";
    return "line";
  }

  function customGraphChartTypeLabel(chartType) {
    return chartType === "bar" ? "棒グラフ" : "折れ線グラフ";
  }

  function getCustomGraphRows(state, _targetKey, xKey) {
    const sessionKeys = ["measureRound"];
    if (sessionKeys.includes(xKey)) {
      return normalizeMeasureLog(state?.measureLog);
    }
    const results = (state?.results || []).map(normalizeResult);
    if (results.length >= 2) return results;
    return normalizeMeasureLog(state?.measureLog);
  }

  function buildCustomGraphPoints(state, graphDef) {
    const xKey = graphDef.xKey;
    const yKey = graphDef.yKey;
    const xDef = CUSTOM_GRAPH_AXES[xKey];
    const yDef = CUSTOM_GRAPH_AXES[yKey];
    if (!xDef || !yDef) return { points: [], categorical: false, catLabels: [], chartType: "line" };

    const rows = getCustomGraphRows(state, graphDef.targetKey, xKey);
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
    const cfg = GRAPH_TARGET_CONFIG[graphDef.targetKey] || {};
    const name = cfg.name || graphDef.targetKey || "データ";
    const xDef = CUSTOM_GRAPH_AXES[graphDef.xKey];
    const yDef = CUSTOM_GRAPH_AXES[graphDef.yKey];
    return name + "（横：" + (xDef?.label || graphDef.xKey) + " · 縦：" + (yDef?.label || graphDef.yKey) + "）";
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

  function drawClippedSeries(ctx, pad, plotW, plotH, drawFn) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(pad.l, pad.t, plotW, plotH);
    ctx.clip();
    drawFn();
    ctx.restore();
  }

  function drawCustomDataGraph(canvas, state, graphDef, opts) {
    if (!canvas || !graphDef) return false;
    const o = opts || {};
    const built = buildCustomGraphPoints(state, graphDef);
    const { points, categorical, catLabels, chartType } = built;
    const xDef = CUSTOM_GRAPH_AXES[graphDef.xKey];
    const yDef = CUSTOM_GRAPH_AXES[graphDef.yKey];
    const cfg = GRAPH_TARGET_CONFIG[graphDef.targetKey] || {};

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
      ctx.fillStyle = "#64748b";
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

    const axis = {
      xLabel: xDef.label,
      xUnit: xDef.unit || "",
      xKey: graphDef.xKey,
      yLabel: yDef.label,
      yUnit: yDef.unit || "",
    };
    const yAxisLabel = yDef.label + (yDef.unit ? "（" + yDef.unit + "）" : "");

    if (o.reportMode) {
      drawReportChartAxes(ctx, {
        w, h, pad, xMin, xMax, yMin, yMax,
        axis: { xLabel: xDef.label, xUnit: xDef.unit || "" },
        tx, vy: ty,
        yAxisLabel,
        categorical, catKeys: categorical ? axisCatKeys : null,
      });
    } else {
      drawChartAxes(ctx, {
        w, h, pad, xMin, xMax, yMin, yMax, axis, tx, vy: ty,
        categorical, catKeys: categorical ? axisCatKeys : null,
        yAxisLabel,
      });
    }

    const lineColor = cfg.lineColor || o.lineColor || (o.reportMode ? "#0891b2" : "#22d3ee");
    const dotColor = cfg.dotColor || o.dotColor || (o.reportMode ? "#0e7490" : "#67e8f9");

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
    strokeSeries();
    return true;
  }

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
    constructor() { super("question", "①", "問い"); }

    mount(parent, state, onChange, actions) {
      const card = this.createCardShell(true);
      const mission = global.InquiryMissions?.getMission(state.missionId);
      this.body.innerHTML =
        '<p class="inquiry-card-desc" id="inquiryMissionLead">' +
        (mission
          ? "ミッション「" + mission.title + "」— まず30秒観察してから決定しましょう。"
          : "達成したい探究の問い（ミッション）を1つ選び、30秒観察してから決定しましょう。") +
        "</p>" +
        '<button type="button" class="inquiry-observe-btn" id="btnStartObserve">▶ 30秒観察をはじめる</button>' +
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
        const defaults = global.InquiryMissions?.DEFAULT_PLAN_CHECKS || { temperature: true, particleSize: false, particleCount: false };
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

      this.observeBtn = this.body.querySelector("#btnStartObserve");
      if (this.observeBtn && actions?.onObserve) {
        this.observeBtn.addEventListener("click", () => actions.onObserve());
      }
      if (state.observationDone && this.observeBtn) {
        this.observeBtn.textContent = "↺ もう一度30秒観察する";
        this.observeBtn.dataset.done = "1";
      }

      this.appendConfirmRow(actions);
      this._onChange = onChange;
      this._state = state;
      return this;
    }

    remountChoices(state, onChange) {
      if (onChange) this._onChange = onChange;
      if (state) this._state = state;
      const st = this._state || state || {};
      const mission = global.InquiryMissions?.getMission(st.missionId);
      const lead = this.body?.querySelector("#inquiryMissionLead");
      if (lead) {
        lead.textContent = mission
          ? "ミッション「" + mission.title + "」— まず30秒観察してから決定しましょう。"
          : "達成したい探究の問い（ミッション）を1つ選び、30秒観察してから決定しましょう。";
      }
    }

    setObserving(active) {
      if (!this.observeBtn) return;
      this.observeBtn.classList.toggle("is-running", active);
      this.observeBtn.textContent = active ? "👀 観察中…" : (this.observeBtn.dataset.done === "1" ? "↺ もう一度30秒観察する" : "▶ 30秒観察をはじめる");
    }

    setObservationDone(done) {
      if (!this.observeBtn) return;
      if (done) this.observeBtn.dataset.done = "1";
      this.observeBtn.textContent = done ? "↺ もう一度30秒観察する" : "▶ 30秒観察をはじめる";
      this.observeBtn.classList.remove("is-running");
    }

    isComplete(state) {
      return !!state.missionId && !!state.observationDone;
    }

    exportData(state) {
      const m = global.InquiryMissions?.getMission(state.missionId);
      return {
        missionId: state.missionId,
        question: m ? m.title + " — " + m.description : state.question,
        observationDone: state.observationDone,
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
        '<input type="text" class="inquiry-text-input" id="inqHypFree" maxlength="120" placeholder="例：温度が高いほど分子のキックが強いと思う"></div>';
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
      freeEl.value = state.hypothesisFreeText || state.hypothesisReason || "";
      freeEl.addEventListener("input", () => {
        onChange({ hypothesisFreeText: freeEl.value, hypothesisReason: freeEl.value });
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
    temperature: { label: "温度", fmt: (v) => v + " K" },
    particleSize: { label: "粒子サイズ", fmt: (v) => v + " px" },
    particleCount: { label: "粒子数", fmt: (v) => v + " 個" },
  };

  function normalizeResult(r) {
    return {
      temperature: r.temperature ?? r.temp ?? 300,
      avgSpeed: r.avgSpeed ?? 0,
      largeRadius: r.largeRadius ?? 18,
      particleCount: r.particleCount ?? 100,
      largeSpeedPxS: r.largeSpeedPxS ?? 0,
    };
  }

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

  function formatYTick(v) {
    if (v === 0) return "0";
    if (Math.abs(v) < 10) return v.toFixed(1);
    return String(Math.round(v));
  }

  function snapReportNumericRange(min, max) {
    const ticks = buildTicks(min, max, AXIS_TICK_TARGET);
    return {
      min: ticks[0] ?? min,
      max: ticks[ticks.length - 1] ?? max,
    };
  }

  function formatReportTickValue(value) {
    if (!Number.isFinite(value)) return "";
    const abs = Math.abs(value);
    if (abs >= 1000) return Math.round(value).toLocaleString("ja-JP");
    if (abs >= 100 || abs === 0) return String(Math.round(value));
    if (abs >= 10) return value.toFixed(1);
    return value.toFixed(2);
  }

  function formatReportYTick(v) {
    return formatYTick(v);
  }

  function reportXAxisTitle(axis) {
    return axis.xLabel + (axis.xUnit ? "（" + axis.xUnit + "）" : "");
  }

  const REPORT_CHART_PAD = { l: 68, r: 28, t: 16, b: 56 };

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

  function drawReportChartAxes(ctx, opts) {
    const {
      w, h, pad, xMin, xMax, yMin, yMax, axis, tx, vy, yAxisLabel,
      categorical, catKeys,
    } = opts;

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
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, axisBottom);
      ctx.lineTo(x, axisBottom + 5);
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const label = categorical && catKeys
        ? String(catKeys[xv] ?? xv)
        : formatReportTickValue(xv);
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
    ctx.fillText(reportXAxisTitle(axis), (pad.l + w - pad.r) / 2, h - 4);

    ctx.save();
    ctx.translate(16, (pad.t + axisBottom) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#1e293b";
    ctx.font = "10px Inter, Noto Sans JP, sans-serif";
    ctx.fillText(yAxisLabel || "平均速度（px/s）", 0, 0);
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
        : String(Math.round(xv));
      ctx.fillText(label, x, h - pad.b + 5);
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
    ctx.fillText(opts.yAxisLabel || "平均速度（px/s）", 0, 0);
    ctx.restore();
  }

  function getResultsColumns(planChecks) {
    const c = planChecks || { temperature: true, particleSize: false, particleCount: false };
    const cols = [];
    if (c.temperature !== false) cols.push({ key: "temperature", label: "温度 (K)", fmt: (v) => v + " K" });
    if (c.particleSize) cols.push({ key: "largeRadius", label: "粒子サイズ (px)", fmt: (v) => v + " px" });
    if (c.particleCount) cols.push({ key: "particleCount", label: "粒子数 N", fmt: (v) => String(v) });
    cols.push({ key: "avgSpeed", label: "平均速度 (px/s)", fmt: (v) => Number(v).toFixed(1) });
    return cols;
  }

  function normalizeMeasureLog(log) {
    return (log || []).map((row, i) => ({
      ...normalizeResult(row),
      measureRound: row.measureRound ?? (i + 1),
      measureId: row.measureId ?? row.at ?? null,
    }));
  }

  function getMeasureSessionColumns() {
    return [
      { key: "measureRound", label: "測定回", fmt: (v) => (v || "—") + "回目" },
      { key: "temperature", label: "温度 (K)", fmt: (v) => v + " K" },
      { key: "largeRadius", label: "粒子サイズ (px)", fmt: (v) => v + " px" },
      { key: "particleCount", label: "粒子数 N", fmt: (v) => String(v) },
      { key: "avgSpeed", label: "平均速度 (px/s)", fmt: (v) => Number(v).toFixed(1) },
      { key: "largeSpeedPxS", label: "大粒子速度 (px/s)", fmt: (v) => Number(v).toFixed(1) },
    ];
  }

  function renderMeasureSessionTableHtml(log, newMeasureIds) {
    const rows = normalizeMeasureLog(log);
    const cols = getMeasureSessionColumns();
    if (!rows.length) {
      return '<tr><td colspan="' + cols.length + '" style="color:#64748b">「測定する」を押すと、回ごとの条件と速度がここに記録されます…</td></tr>';
    }
    const idSet = new Set(newMeasureIds || []);
    return rows.map((row) => {
      const cls = idSet.has(row.measureId) ? ' class="new-row"' : "";
      const cells = cols.map((c) => "<td>" + c.fmt(row[c.key]) + "</td>").join("");
      return "<tr" + cls + ">" + cells + "</tr>";
    }).join("");
  }

  function escMeasureLog(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
        '<p class="inquiry-plan-auto-note">選んだ計画の「操作変数」が記録・分析の対象になります。温度・粒子サイズ・分子数は④でいつでも変更できます。</p>';
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
        '<p class="inquiry-card-desc">左で条件を変え、準備ができたら「測定する」でデータを記録しましょう。変更は実験ログに自動で残ります。</p>' +
        '<div class="exp-action-row">' +
        '<button type="button" class="inquiry-action-btn exp-measure-btn" id="expMeasureBtn">📏 測定する</button>' +
        '<button type="button" class="inquiry-exp-reset-btn" id="expResetBtn">↺ 実験リセット</button>' +
        "</div>" +
        '<p class="exp-measure-hint" id="expMeasureHint">条件を整えてから測定ボタンを押してください</p>' +
        '<div class="exp-timeline"><h4>🔬 実験ログ（条件の変更履歴）</h4>' +
        '<div class="exp-timeline-list" id="expTimelineList"></div></div>' +
        '<div class="exp-heat-log"><h4>📊 測定ログ（測定回 · 条件 · 速度）</h4>' +
        '<div class="exp-heat-log-list" id="expMeasureLogList"></div></div>';
      parent.appendChild(card);
      this.timelineEl = this.body.querySelector("#expTimelineList");
      this.measureLogEl = this.body.querySelector("#expMeasureLogList");
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
      this.renderMeasureLog(state.measureLog);
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
        const type = item.type || "temperature";
        const meta = TIMELINE_META[type] || TIMELINE_META.temperature;
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

    renderMeasureLog(log) {
      if (!this.measureLogEl) return;
      const rows = normalizeMeasureLog(log);
      if (rows.length === 0) {
        this.measureLogEl.innerHTML = '<p class="exp-heat-log-empty">「測定する」を押すたび、回・条件・速度がここに記録されます…</p>';
        return;
      }
      const body = rows.map((row) =>
        "<tr>" +
        "<td>" + row.measureRound + "回目</td>" +
        "<td>" + escMeasureLog(row.temperature) + " K</td>" +
        "<td>" + escMeasureLog(row.largeRadius) + " px</td>" +
        "<td>" + escMeasureLog(row.particleCount) + "</td>" +
        "<td>" + Number(row.avgSpeed).toFixed(1) + " px/s</td>" +
        "<td>" + Number(row.largeSpeedPxS).toFixed(1) + " px/s</td>" +
        "</tr>"
      ).join("");
      this.measureLogEl.innerHTML =
        '<table class="exp-heat-log-table">' +
        "<thead><tr><th>回</th><th>温度</th><th>粒子サイズ</th><th>粒子数</th><th>平均速度</th><th>大粒子速度</th></tr></thead>" +
        "<tbody>" + body + "</tbody></table>";
    }

    isComplete(state) {
      return (state.results || []).length >= 1 && (state.timeline || []).length >= 1;
    }

    exportData(state) {
      return { timeline: state.timeline, measureLog: state.measureLog };
    }
  }

  class StepResults extends BaseStep {
    constructor() { super("results", "⑤", "実験結果"); }

    mount(parent, state, actions) {
      const card = this.createCardShell(false);
      this.body.innerHTML =
        '<p class="inquiry-card-desc">「測定する」1回ごとの記録と、条件ごとにまとめた結果表です。</p>' +
        '<h4 class="results-section-title">測定回ごとの記録</h4>' +
        '<div class="results-table-wrap"><table class="results-table">' +
        '<thead><tr id="measureSessionHead"></tr></thead>' +
        '<tbody id="measureSessionBody"></tbody></table></div>' +
        '<h4 class="results-section-title results-section-title--spaced">条件ごとの記録</h4>' +
        '<div class="results-table-wrap"><table class="results-table">' +
        '<thead><tr id="resultsTableHead"></tr></thead>' +
        '<tbody id="resultsTableBody"></tbody></table></div>' +
        '<p class="inquiry-examples" style="margin-top:8px">「測定する」ボタンを押すと、現在の条件のデータが1行追加されます。</p>';
      parent.appendChild(card);
      this.sessionHead = this.body.querySelector("#measureSessionHead");
      this.sessionBody = this.body.querySelector("#measureSessionBody");
      this.thead = this.body.querySelector("#resultsTableHead");
      this.tbody = this.body.querySelector("#resultsTableBody");
      this.updateSessionHeaders();
      this.updateTableHeaders(state.planChecks);
      this.renderMeasureSessions(state.measureLog, []);
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
      if (!results || results.length === 0) {
        this.tbody.innerHTML = '<tr><td colspan="' + colSpan + '" style="color:#64748b">データ待ち…</td></tr>';
        return;
      }
      const keySet = new Set(newKeys || []);
      this.tbody.innerHTML = results.map((raw) => {
        const r = normalizeResult(raw);
        const rowKey = [r.temperature, r.largeRadius, r.particleCount].join("|");
        const cls = keySet.has(rowKey) ? ' class="new-row"' : "";
        const cells = cols.map((c) => "<td>" + c.fmt(r[c.key]) + "</td>").join("");
        return "<tr" + cls + ">" + cells + "</tr>";
      }).join("");
    }

    isComplete(state) {
      return (state.results || []).length >= 2;
    }

    exportData(state) {
      return { results: state.results, measureLog: state.measureLog };
    }
  }

  function prepareLinePoints(rawPts) {
    return (rawPts || [])
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
      .slice()
      .sort((a, b) => a.x - b.x || a.y - b.y)
      .reduce((acc, p) => {
        const last = acc[acc.length - 1];
        if (last && Math.abs(last.x - p.x) < 1e-6) {
          last.y = p.y;
          return acc;
        }
        acc.push({ x: p.x, y: p.y });
        return acc;
      }, []);
  }

  function drawTargetLineGraph(canvas, rawPts, opts) {
    if (!canvas) return false;
    const o = opts || {};
    const cfg = GRAPH_TARGET_CONFIG[o.targetKey] || {};
    const pts = prepareLinePoints(rawPts);
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
      ctx.fillText("「測定する」で同じ操作変数を2回以上変えてください", w / 2, h / 2 + 12);
      return false;
    }

    const xMin = pts[0].x;
    const xMax = pts[pts.length - 1].x;
    let yMin = Math.min(...pts.map((p) => p.y));
    let yMax = Math.max(...pts.map((p) => p.y));
    let span = Math.max(yMax - yMin, 0.1);
    yMin = Math.max(0, yMin - span * 0.1);
    yMax += span * 0.15;

    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;
    const tx = (X) => pad.l + ((X - xMin) / Math.max(xMax - xMin, 1)) * plotW;
    const ty = (Y) => pad.t + plotH * (1 - (Y - yMin) / Math.max(yMax - yMin, 0.1));

    const axis = {
      xLabel: cfg.xLabel || "横軸",
      xUnit: cfg.xUnit || "",
      xKey: cfg.xKey || "x",
    };
    const yAxisLabel = (cfg.yLabel || "縦軸") + (cfg.yUnit ? "（" + cfg.yUnit + "）" : "");

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    drawChartAxes(ctx, {
      w, h, pad, xMin, xMax, yMin, yMax, axis, tx, vy: ty,
      categorical: false, catKeys: null, yAxisLabel,
    });

    const lineColor = cfg.lineColor || o.lineColor || "#22d3ee";
    const dotColor = cfg.dotColor || o.dotColor || "#67e8f9";

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2.5;
    ctx.shadowBlur = 10;
    ctx.shadowColor = lineColor;
    ctx.beginPath();
    ctx.moveTo(tx(pts[0].x), ty(pts[0].y));
    for (let i = 1; i < pts.length; i += 1) {
      ctx.lineTo(tx(pts[i].x), ty(pts[i].y));
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    pts.forEach((p) => {
      const g = ctx.createRadialGradient(tx(p.x), ty(p.y), 0, tx(p.x), ty(p.y), 6);
      g.addColorStop(0, "#e0f2fe");
      g.addColorStop(1, dotColor);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(tx(p.x), ty(p.y), 5, 0, Math.PI * 2);
      ctx.fill();
    });

    return true;
  }

  /** 実験レポート用 — 白背景・印刷向け折れ線グラフ */
  function drawReportTargetGraph(canvas, w, h, rawPts, opts) {
    if (!canvas || w < 40 || h < 40) return false;
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const o = opts || {};
    const cfg = GRAPH_TARGET_CONFIG[o.targetKey] || {};
    const pts = prepareLinePoints(rawPts);
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

    let xMin = pts[0].x;
    let xMax = pts[pts.length - 1].x;
    let yMin = Math.min(...pts.map((p) => p.y));
    let yMax = Math.max(...pts.map((p) => p.y));
    let span = Math.max(yMax - yMin, 0.1);
    yMin = Math.max(0, yMin - span * 0.1);
    yMax += span * 0.15;

    const dataYMin = Math.min(...pts.map((p) => p.y));
    const dataYMax = Math.max(...pts.map((p) => p.y));
    const ySnap = snapReportNumericRange(yMin, yMax);
    yMin = Math.min(ySnap.min, dataYMin);
    yMax = Math.max(ySnap.max, dataYMax);
    const dataXMin = Math.min(...pts.map((p) => p.x));
    const dataXMax = Math.max(...pts.map((p) => p.x));
    const xSnap = snapReportNumericRange(xMin, xMax);
    xMin = Math.min(xSnap.min, dataXMin);
    xMax = Math.max(xSnap.max, dataXMax);

    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;
    const tx = (X) => pad.l + ((X - xMin) / Math.max(xMax - xMin, 1)) * plotW;
    const ty = (Y) => pad.t + plotH * (1 - (Y - yMin) / Math.max(yMax - yMin, 0.1));

    const axis = {
      xLabel: cfg.xLabel || "横軸",
      xUnit: cfg.xUnit || "",
    };
    const yAxisLabel = (cfg.yLabel || "縦軸") + (cfg.yUnit ? "（" + cfg.yUnit + "）" : "");

    drawReportChartAxes(ctx, {
      w, h, pad, xMin, xMax, yMin, yMax,
      axis, tx, vy: ty,
      yAxisLabel,
      categorical: false,
      catKeys: null,
    });

    const lineColor = cfg.lineColor || o.lineColor || "#0891b2";
    const dotColor = cfg.dotColor || o.dotColor || "#0e7490";

    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(tx(pts[0].x), ty(pts[0].y));
    for (let i = 1; i < pts.length; i += 1) {
      ctx.lineTo(tx(pts[i].x), ty(pts[i].y));
    }
    ctx.stroke();

    ctx.fillStyle = dotColor;
    pts.forEach((p) => {
      ctx.beginPath();
      ctx.arc(tx(p.x), ty(p.y), 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    return true;
  }

  function getTargetGraphTitle(targetKey, num) {
    const cfg = GRAPH_TARGET_CONFIG[targetKey] || {};
    const name = cfg.name || targetKey;
    if (targetKey === "temperature") {
      return "グラフ" + num + " " + name + " T–平均速度グラフ";
    }
    if (targetKey === "particleSize") {
      return "グラフ" + num + " " + name + " 半径–大粒子速度グラフ";
    }
    if (targetKey === "particleCount") {
      return "グラフ" + num + " " + name + " N–平均速度グラフ";
    }
    return "グラフ" + num + " " + name;
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
        '<p class="inquiry-card-desc" id="graphStepDesc">③で選んだ操作変数ごとに、測定データから折れ線グラフを作成しましょう。</p>' +
        '<div class="graph-dual-wrap" id="graphTargetsWrap"></div>' +
        '<div class="graph-custom-section">' +
        '<h5 class="graph-block-title graph-custom-title">追加グラフ</h5>' +
        '<p class="inquiry-card-desc graph-custom-desc">操作変数・横軸・縦軸を選んでから「グラフを追加」を押してください。</p>' +
        '<div class="graph-custom-form">' +
        '<label class="graph-custom-field"><span>操作変数</span><select id="customGraphTarget"></select></label>' +
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
      this.customTargetSel = this.body.querySelector("#customGraphTarget");
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
      if (this.customTargetSel) {
        this.customTargetSel.innerHTML = targets.length
          ? targets.map((k) => {
            const name = GRAPH_TARGET_CONFIG[k]?.name || k;
            return '<option value="' + k + '">' + name + "</option>";
          }).join("")
          : '<option value="">（測定データなし）</option>';
        this.customTargetSel.disabled = targets.length === 0;
      }
      const addBtn = this.body.querySelector("#customGraphAddBtn");
      if (addBtn) addBtn.disabled = targets.length === 0;
    }

    _addCustomGraph() {
      const targetKey = this.customTargetSel?.value;
      const xKey = this.customXSel?.value;
      const yKey = this.customYSel?.value;
      if (!targetKey || !xKey || !yKey) {
        if (this.customHint) this.customHint.textContent = "操作変数・横軸・縦軸を選んでください。";
        return;
      }
      if (xKey === yKey) {
        if (this.customHint) this.customHint.textContent = "横軸と縦軸は別の項目を選んでください。";
        return;
      }
      const graphDef = {
        id: "cg_" + Date.now(),
        targetKey,
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
      return (graphs || []).map((g) => [g.id, g.targetKey, g.xKey, g.yKey, g.created].join(":")).join("|");
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
          '<p class="exp-timeline-empty">まだ測定データがありません。実験ステップで「測定する」を押してからグラフを作成してください。</p>';
        return;
      }

      this.graphWrap.innerHTML = targets.map((targetKey, i) => {
        const num = i + 1;
        const canvasId = "inquiryGraphCanvas_" + targetKey;
        return (
          '<div class="graph-block" data-target="' + targetKey + '">' +
          '<h5 class="graph-block-title">' + getTargetGraphTitle(targetKey, num) + "</h5>" +
          '<button type="button" class="inquiry-action-btn" data-graph-btn="' + targetKey + '">📈 グラフ' + num + "を作成</button>" +
          '<div class="graph-panel" data-graph-panel="' + targetKey + '" style="display:none">' +
          '<div class="graph-canvas-wrap"><canvas id="' + canvasId + '"></canvas></div></div>' +
          "</div>"
        );
      }).join("");

      targets.forEach((targetKey, i) => {
        const btn = this.graphWrap.querySelector('[data-graph-btn="' + targetKey + '"]');
        const panel = this.graphWrap.querySelector('[data-graph-panel="' + targetKey + '"]');
        const canvas = this.graphWrap.querySelector("#inquiryGraphCanvas_" + targetKey);
        btn?.addEventListener("click", () => {
          this._onChange?.({ graphsCreated: { [targetKey]: true } });
        });
        this.blocks.set(targetKey, { btn, panel, canvas, num: i + 1 });
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
        if (canvas) drawCustomDataGraph(canvas, state, g, { emptyMsg: "データが不足しています（測定回数を増やしてください）" });
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
      this.blocks.forEach((block, targetKey) => {
        if (created[targetKey]) {
          this.drawTargetGraph(targetKey, state?.curves, state);
        } else if (block.panel) {
          block.panel.style.display = "none";
          if (block.btn) {
            block.btn.disabled = false;
            block.btn.textContent = "📈 グラフ" + block.num + "を作成";
          }
        }
      });
    }

    drawTargetGraph(targetKey, curves, state) {
      const block = this.blocks.get(targetKey);
      if (!block?.canvas) return;
      const cfg = GRAPH_TARGET_CONFIG[targetKey] || {};
      const name = cfg.name || targetKey;
      let pts = curves?.[targetKey];
      if (!pts?.length && state?.results?.length) {
        const xKey = cfg.xKey;
        const yKey = cfg.yKey;
        pts = (state.results || []).map(normalizeResult).map((r) => ({
          x: r[xKey],
          y: r[yKey],
        }));
      }
      const ok = drawTargetLineGraph(block.canvas, pts, {
        targetKey,
        lineColor: cfg.lineColor,
        dotColor: cfg.dotColor,
        emptyMsg: name + "の測定データがありません",
      });
      if (!ok) {
        block.btn.disabled = true;
        block.btn.textContent = name + "で測定を2回以上行ってから作成";
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
      return targets.every((k) => !!created[k]);
    }

    exportData(state) {
      syncLegacyGraphFlags(state);
      return {
        graphsCreated: normalizeGraphsCreated(state),
        graphCreated: !!state.graphCreated,
        curves: state.curves,
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
        '<textarea id="inqReflection" rows="4" placeholder="温度を上げると平均速度が増えた。だからブラウン運動は…"></textarea></div>' +
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
        descEl.textContent = mission?.description || "① 問いで探求テーマを選ぶと、ここに表示されます。";
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
    getGraphTargets,
    normalizeGraphsCreated,
    syncLegacyGraphFlags,
    GRAPH_TARGET_ORDER,
    GRAPH_TARGET_CONFIG,
    buildCustomGraphPoints,
    drawCustomDataGraph,
    drawReportTargetGraph,
    getCustomGraphCaption,
    CUSTOM_GRAPH_AXES,
    CUSTOM_GRAPH_X_KEYS,
    CUSTOM_GRAPH_Y_KEYS,
  };
})(window);
