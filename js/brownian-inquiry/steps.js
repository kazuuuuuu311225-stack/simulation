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

    exportData() { return {}; }
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

    mount(parent, state, onChange, onObserve) {
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
      });

      this.observeBtn = this.body.querySelector("#btnStartObserve");
      if (this.observeBtn && onObserve) {
        this.observeBtn.addEventListener("click", () => onObserve());
      }
      if (state.observationDone && this.observeBtn) {
        this.observeBtn.textContent = "↺ もう一度30秒観察する";
        this.observeBtn.dataset.done = "1";
      }
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

    mount(parent, state, onChange) {
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
      });

      const freeEl = this.body.querySelector("#inqHypFree");
      freeEl.value = state.hypothesisFreeText || state.hypothesisReason || "";
      freeEl.addEventListener("input", () => onChange({ hypothesisFreeText: freeEl.value, hypothesisReason: freeEl.value }));

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

  function getGraphAxis(planChecks) {
    const c = planChecks || {};
    if (c.temperature !== false) {
      return { xKey: "temperature", xLabel: "温度", xUnit: "K", fmtX: (v) => Math.round(v) + " K" };
    }
    if (c.particleSize) {
      return { xKey: "largeRadius", xLabel: "粒子サイズ", xUnit: "px", fmtX: (v) => Math.round(v) + " px" };
    }
    if (c.particleCount) {
      return { xKey: "particleCount", xLabel: "粒子数 N", xUnit: "個", fmtX: (v) => Math.round(v) + " 個" };
    }
    return { xKey: "temperature", xLabel: "温度", xUnit: "K", fmtX: (v) => Math.round(v) + " K" };
  }

  function buildTicks(min, max, targetCount) {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
    if (Math.abs(max - min) < 1e-6) return [min];
    const span = max - min;
    const rough = span / Math.max(targetCount - 1, 1);
    const pow = Math.pow(10, Math.floor(Math.log10(Math.max(rough, 1e-6))));
    const steps = [1, 2, 2.5, 5, 10].map((m) => m * pow);
    let step = steps[steps.length - 1];
    for (const s of steps) {
      if (span / s <= targetCount + 1) step = s;
    }
    const start = Math.ceil(min / step) * step;
    const ticks = [];
    for (let v = start; v <= max + step * 0.001; v += step) ticks.push(v);
    if (ticks.length === 0) ticks.push(min, max);
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
    const xTicks = buildTicks(xMin, xMax, 5);
    const yTicks = buildTicks(yMin, yMax, 5);

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
      const num = axis.xKey === "particleCount" ? Math.round(xv) : Math.round(xv);
      ctx.fillText(String(num), x, h - pad.b + 5);
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
    ctx.fillText(axis.xLabel + "（" + axis.xUnit + "）", (pad.l + w - pad.r) / 2, h - 2);

    ctx.save();
    ctx.translate(14, (pad.t + h - pad.b) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.fillText("平均速度（px/s）", 0, 0);
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

  class StepPlan extends BaseStep {
    constructor() { super("plan", "③", "実験計画"); }

    mount(parent, state, onChange) {
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
      });

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
        '<div class="exp-timeline-list" id="expTimelineList"></div></div>';
      parent.appendChild(card);
      this.timelineEl = this.body.querySelector("#expTimelineList");
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

    isComplete(state) {
      return (state.results || []).length >= 1 && (state.timeline || []).length >= 1;
    }

    exportData(state) { return { timeline: state.timeline }; }
  }

  class StepResults extends BaseStep {
    constructor() { super("results", "⑤", "実験結果"); }

    mount(parent, state) {
      const card = this.createCardShell(false);
      this.body.innerHTML =
        '<p class="inquiry-card-desc">シミュレーションから取得したデータが表に入ります。</p>' +
        '<div class="results-table-wrap"><table class="results-table">' +
        '<thead><tr id="resultsTableHead"></tr></thead>' +
        '<tbody id="resultsTableBody"></tbody></table></div>' +
        '<p class="inquiry-examples" style="margin-top:8px">「測定する」ボタンを押すと、現在の条件のデータが1行追加されます。</p>';
      parent.appendChild(card);
      this.thead = this.body.querySelector("#resultsTableHead");
      this.tbody = this.body.querySelector("#resultsTableBody");
      this.updateTableHeaders(state.planChecks);
      this.renderTable(state.results, [], state.planChecks);
      return this;
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

    exportData(state) { return { results: state.results }; }
  }

  class StepGraph extends BaseStep {
    constructor() { super("graph", "⑥", "グラフ"); }

    mount(parent, state, onChange) {
      const card = this.createCardShell(false);
      this.body.innerHTML =
        '<p class="inquiry-card-desc">データから折れ線グラフを作成し、温度と平均速度の関係を可視化しましょう。</p>' +
        '<button type="button" class="inquiry-action-btn" id="btnMakeGraph">📈 グラフを作成する</button>' +
        '<div class="graph-panel" id="graphPanel" style="display:none">' +
        '<div class="graph-canvas-wrap"><canvas id="inquiryGraphCanvas"></canvas></div></div>';
      parent.appendChild(card);

      this.graphPanel = this.body.querySelector("#graphPanel");
      this.canvas = this.body.querySelector("#inquiryGraphCanvas");
      this.btn = this.body.querySelector("#btnMakeGraph");

      this.btn.addEventListener("click", () => onChange({ graphCreated: true }));

      if (state.graphCreated && (state.results || []).length > 0) {
        this.graphPanel.style.display = "block";
        requestAnimationFrame(() => this.drawGraph(state.results, state.planChecks));
      }
      return this;
    }

    drawGraph(results, planChecks) {
      if (!results || results.length < 2) {
        this.btn.disabled = true;
        this.btn.textContent = "データが2点以上必要です";
        return;
      }
      this.graphPanel.style.display = "block";
      const axis = getGraphAxis(planChecks);
      const normalized = results.map(normalizeResult);
      const wrap = this.canvas.parentElement;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(280, wrap.clientWidth);
      const h = 240;
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      const ctx = this.canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const pad = { l: 52, r: 16, t: 22, b: 48 };
      const sorted = [...normalized].sort((a, b) => a[axis.xKey] - b[axis.xKey]);
      const xMin = sorted[0][axis.xKey];
      const xMax = sorted[sorted.length - 1][axis.xKey];
      const vMin = 0;
      const vMax = Math.max(...sorted.map((r) => r.avgSpeed)) * 1.15;

      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, "#0a1020");
      bg.addColorStop(1, "#0c1528");

      const plotW = w - pad.l - pad.r;
      const plotH = h - pad.t - pad.b;
      const tx = (X) => pad.l + ((X - xMin) / Math.max(xMax - xMin, 1)) * plotW;
      const vy = (v) => pad.t + plotH * (1 - (v - vMin) / Math.max(vMax - vMin, 0.1));
      const axisOpts = { w, h, pad, xMin, xMax, yMin: vMin, yMax: vMax, axis, tx, vy };

      const points = sorted.map((r) => ({ x: tx(r[axis.xKey]), y: vy(r.avgSpeed), ...r }));
      let animProgress = 0;
      const start = performance.now();

      const drawFrame = (progress) => {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);
        drawChartAxes(ctx, axisOpts);

        const endIdx = Math.floor(progress * (points.length - 1));
        const frac = (progress * (points.length - 1)) - endIdx;

        ctx.strokeStyle = "#22d3ee";
        ctx.lineWidth = 2.5;
        ctx.shadowBlur = 12;
        ctx.shadowColor = "#22d3ee";
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i <= endIdx; i++) {
          ctx.lineTo(points[i].x, points[i].y);
        }
        if (endIdx < points.length - 1) {
          const p0 = points[endIdx];
          const p1 = points[endIdx + 1];
          ctx.lineTo(p0.x + (p1.x - p0.x) * frac, p0.y + (p1.y - p0.y) * frac);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        points.forEach((p, i) => {
          if (i > endIdx + (frac > 0 ? 1 : 0)) return;
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 6);
          g.addColorStop(0, "#e0f2fe");
          g.addColorStop(1, "#a855f7");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
          ctx.fill();
        });
      };

      const animate = (now) => {
        animProgress = Math.min(1, (now - start) / 1200);
        drawFrame(animProgress);
        if (animProgress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }

    isComplete(state) { return !!state.graphCreated; }
    exportData(state) { return { graphCreated: state.graphCreated }; }
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
      this.ta.addEventListener("focus", () => actions?.onFocus?.());
      this.ta.addEventListener("blur", () => actions?.onBlur?.());
      if (this.finishBtn && actions?.onFinish) {
        this.finishBtn.addEventListener("click", () => actions.onFinish());
      }
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

  class StepSummary extends BaseStep {
    constructor() { super("summary", "⑧", "まとめ"); }

    mount(parent, state, allDone, actions) {
      const card = this.createCardShell(false);
      const locked = allDone !== true;
      this.body.innerHTML =
        '<div class="summary-celebrate' + (locked ? " locked" : " unlocked") + '" id="summaryCelebrate">' +
        '<p class="summary-title">' + (locked ? "🔒 探究を完了しよう" : "🎉 探究完了！") + "</p>" +
        '<p class="summary-sub">すべてのステップを終えると、達成画面と実験レポートが表示されます。</p>' +
        '<ul class="summary-checklist" id="summaryChecklist"></ul>' +
        '<div class="summary-rate" id="summaryRate">0%</div>' +
        '<button type="button" class="summary-open-btn" id="summaryOpenBtn" style="display:none">🎉 達成画面を見る</button>' +
        '<button type="button" class="summary-report-btn" id="summaryReportBtn" style="display:none">📄 実験レポートを見る</button>' +
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
      return false;
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
  };
})(window);
