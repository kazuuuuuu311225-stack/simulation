/**
 * 熱平衡探究 — メインオーケストレータ
 * HeatEquilibriumSim API と連携
 */
(function (global) {
  "use strict";

  const STEP_LABELS = ["問い", "仮説", "実験計画", "実験", "実験結果", "グラフ", "考察", "まとめ"];

  const STEP_CONFIRM_HINTS = {
    question: "ミッション（問い）を1つ選んでから「決定」を押してください。",
    hypothesis: "仮説を1つ選んでから「決定」を押してください。",
    plan: "実験計画を1つ選んでから「決定」を押してください。",
    experiment: "左の「接触測定」で少なくとも1回、熱平衡まで測定してから「決定」を押してください。",
    results: "接触セッションが2回以上記録されてから「決定」を押してください。",
    graph: "各接触セッションの T–t グラフを作成してから「決定」を押してください。",
    reflection: "考察を10文字以上書いてから「決定」を押してください。",
    summary: "まとめを4文字以上書いてから「決定」を押してください。",
  };

  const MATERIAL_NAMES = { water: "水", iron: "鉄", aluminum: "アルミ", air: "空気" };

  class InquiryMode {
    constructor(options) {
      this.noteEl = options.noteEl;
      this.progressEl = options.progressEl;
      this.welcomeEl = options.welcomeEl;
      this.summaryScreenEl = options.summaryScreenEl;
      this.reportScreenEl = options.reportScreenEl;
      this.reportDocEl = options.reportDocEl;
      this.onTabActive = options.onTabActive || (() => {});

      this.state = InquiryStorage.load();
      this.steps = [];
      this.validators = {};
      this.lastRecorded = { matA: null, matB: null, massA: null, massB: null, tempA: null, tempB: null, materialPair: null };
      this.confettiRAF = null;
      this.celebrated = !!this.state.summaryCelebrated;
      this.recordingEnabled = false;
      this._lastDoneMap = {};
      this._lastPercent = 0;
      this._reflectionFocused = false;
      this._summaryFocused = false;

      if (global.InquiryCompanion?.setMode) {
        InquiryCompanion.setMode(this.state.companionMode || "gentle", false);
      }
      this._buildSteps();
      this._bindWelcome();
      this._bindSummaryScreen();
      this._bindReportScreen();
      this._bindCompanionMode();
      this._bindExperimentActions();
      this._setupSimRecording();
      this.updateExperimentControls();
    }

    _buildSteps() {
      this.steps = [];
      this.validators = {};
      const S = InquirySteps;
      const instances = [
        new S.StepQuestion(),
        new S.StepHypothesis(),
        new S.StepPlan(),
        new S.StepExperiment(),
        new S.StepResults(),
        new S.StepGraph(),
        new S.StepReflection(),
        new S.StepSummary(),
      ];

      this.noteEl.innerHTML = "";
      const confirmAction = (stepId, hintEl) => this.confirmStep(stepId, hintEl);

      instances.forEach((step) => {
        if (step.id === "experiment") {
          step.mount(this.noteEl, this.state, {
            onMeasure: () => this.measureNow(),
            onReset: () => this.resetExperiment(),
            onConfirm: confirmAction,
          });
        } else if (step.id === "results") {
          step.mount(this.noteEl, this.state, { onConfirm: confirmAction });
        } else if (step.id === "summary") {
          step.mount(this.noteEl, this.state, false, {
            onOpenSummary: () => this._showSummaryScreen(this._lastDoneMap || {}, this._lastPercent || 0),
            onOpenReport: () => this.showReport(),
            onChange: (patch) => this._patch(patch),
            onGenerateAiComments: (statusEl) => this._generateAiComments(statusEl),
            onSummaryFocus: () => { this._summaryFocused = true; },
            onSummaryBlur: () => { this._summaryFocused = false; },
            getState: () => this.state,
            onConfirm: confirmAction,
          });
        } else if (step.id === "reflection") {
          step.mount(this.noteEl, this.state, (patch) => this._patch(patch), {
            onFocus: () => { this._reflectionFocused = true; },
            onBlur: () => {
              this._reflectionFocused = false;
              this._tryCelebrateIfReady();
            },
            onFinish: () => this._tryCelebrateIfReady(true),
            getResultCount: () => (this.state.results || []).length,
            onConfirm: confirmAction,
          });
        } else {
          step.mount(this.noteEl, this.state, (patch) => this._patch(patch), { onConfirm: confirmAction });
        }
        this.steps.push(step);
        this.validators[step.id] = (st) => step.isComplete(st);
      });

      this._renderProgressDots();
      this._updateStepVisibility();
      this._refreshUI();
    }

    confirmStep(stepId, hintEl) {
      const idx = this.steps.findIndex((s) => s.id === stepId);
      if (idx < 0) return;

      const valid = this.validators[stepId]?.(this.state);
      if (!valid) {
        if (hintEl) hintEl.textContent = STEP_CONFIRM_HINTS[stepId] || "入力を完了してから「決定」を押してください。";
        return;
      }
      if (hintEl) hintEl.textContent = "";

      if (stepId === "summary") {
        this._tryCelebrateIfReady(true);
        return;
      }

      const next = Math.min(idx + 1, this.steps.length - 1);
      this.state.activeStepIndex = next;
      if (this.steps[next]?.id === "experiment") {
        this._syncPlanChecksFromPlanId();
        this.updateExperimentControls();
      }
      InquiryStorage.save(this.state);
      this._updateStepVisibility();
      this._refreshUI();
      if (this.noteEl) this.noteEl.scrollTop = 0;
      if (this.steps[next]?.id === "experiment") this._scrollToSim();
    }

    _updateStepVisibility() {
      const idx = Math.max(0, Math.min(this.state.activeStepIndex ?? 0, this.steps.length - 1));
      this.state.activeStepIndex = idx;
      this.steps.forEach((step, i) => {
        if (!step.el) return;
        step.el.classList.toggle("step-hidden", i !== idx);
        step.el.classList.toggle("step-current", i === idx);
      });
    }

    _renderProgressDots() {
      const dots = this.progressEl.querySelector(".inquiry-step-dots");
      if (!dots) return;
      dots.innerHTML = STEP_LABELS.map((lbl, i) =>
        '<button type="button" class="inquiry-step-dot" data-idx="' + i + '" title="' + lbl + '">' + (i + 1) + "</button>"
      ).join("");
      dots.querySelectorAll(".inquiry-step-dot").forEach((btn) => {
        btn.addEventListener("click", () => {
          const idx = +btn.dataset.idx;
          this.state.activeStepIndex = idx;
          if (this.steps[idx]?.id === "experiment") this._syncPlanChecksFromPlanId();
          InquiryStorage.save(this.state);
          this.updateExperimentControls();
          this._updateStepVisibility();
          this._refreshUI();
          if (this.noteEl) this.noteEl.scrollTop = 0;
        });
      });
    }

    _patch(patch) {
      const graphsPatch = { ...(patch.graphsCreated || {}) };
      const { graphsCreated, ...rest } = patch;
      Object.assign(this.state, rest);
      if (Object.keys(graphsPatch).length) {
        this.state.graphsCreated = { ...(this.state.graphsCreated || {}), ...graphsPatch };
        const gStep = this.steps.find((s) => s.id === "graph");
        Object.entries(graphsPatch).forEach(([measureId, created]) => {
          if (created && gStep?.drawSessionGraph) {
            gStep.drawSessionGraph(measureId, this.state);
          }
        });
      }
      if (patch.customGraphs) {
        const gStep = this.steps.find((s) => s.id === "graph");
        if (gStep?.renderCustomGraphs) gStep.renderCustomGraphs(this.state);
      }
      if (global.InquiryMissions?.syncLegacyFields) {
        Object.assign(this.state, InquiryMissions.syncLegacyFields(this.state));
      }
      if (Object.prototype.hasOwnProperty.call(patch, "missionId")) {
        this.steps.find((s) => s.id === "hypothesis")?.remountChoices?.(this.state, (p) => this._patch(p));
        this.steps.find((s) => s.id === "plan")?.remountChoices?.(this.state, (p) => this._patch(p));
      }
      InquiryStorage.save(this.state);
      if (patch.planChecks || Object.prototype.hasOwnProperty.call(patch, "planId") ||
          Object.prototype.hasOwnProperty.call(patch, "missionId")) {
        this._syncPlanChecksFromPlanId();
        this.updateExperimentControls();
      } else if (Object.prototype.hasOwnProperty.call(patch, "activeStepIndex")) {
        this.updateExperimentControls();
      }
      this._refreshUI();
    }

    _syncPlanChecksFromPlanId() {
      const plan = global.InquiryMissions?.getPlan?.(this.state.planId);
      if (plan?.planChecks) {
        this.state.planChecks = { ...plan.planChecks };
        return;
      }
      const defaults = global.InquiryMissions?.DEFAULT_PLAN_CHECKS || { materialPair: true, massA: false, massB: false, tempDiff: false };
      if (!this.state.planChecks || this.state.planChecks.materialPair === false) {
        this.state.planChecks = { ...defaults };
      }
    }

    _setPanelState(el, on) {
      if (!el) return;
      el.classList.toggle("is-enabled", on);
      el.classList.toggle("is-disabled", !on);
      const body = el.querySelector(".inq-var-body") || el;
      body.querySelectorAll("input, button, select").forEach((ctrl) => {
        ctrl.disabled = !on;
      });
    }

    updateExperimentControls() {
      this._syncPlanChecksFromPlanId();
      const c = this.state.planChecks || global.InquiryMissions?.DEFAULT_PLAN_CHECKS || { materialPair: true, massA: false, massB: false, tempDiff: false };
      const panels = {
        materialPair: document.getElementById("inqVarMaterialPair"),
        matA: document.getElementById("inqVarMatA"),
        matB: document.getElementById("inqVarMatB"),
        massA: document.getElementById("inqVarMassA"),
        massB: document.getElementById("inqVarMassB"),
        tempA: document.getElementById("inqVarTempA"),
        tempB: document.getElementById("inqVarTempB"),
      };
      Object.values(panels).forEach((el) => {
        if (el) this._setPanelState(el, true);
      });

      const investigate = [];
      if (c.materialPair !== false) investigate.push("物質の組 (A/B)");
      if (c.massA) investigate.push("質量 mA");
      if (c.massB) investigate.push("質量 mB");
      if (c.tempDiff) investigate.push("初期温度 TA/TB");

      const badge = document.getElementById("inqPlanBadge");
      if (badge) {
        badge.textContent = investigate.length ? "（操作変数：" + investigate.join(" · ") + "）" : "";
      }
      const hint = document.getElementById("inqPlanHint");
      if (hint) {
        hint.innerHTML = investigate.length
          ? "初期条件はすべて設定できます。<strong>③ 実験計画</strong>で記録・分析する操作変数：<strong>" +
            investigate.join("、") + "</strong>。"
          : "③ 実験計画を選ぶと、記録・分析する操作変数が決まります。";
      }

      const resStep = this.steps.find((s) => s.id === "results");
      if (resStep?.updateTableHeaders) resStep.updateTableHeaders(c);

      const sim = global.HeatEquilibriumSim;
      if (sim && this.recordingEnabled) {
        const s = sim.getState();
        const now = Date.now();
        const pairKey = s.matA + "|" + s.matB;
        const entries = [
          { check: c.materialPair !== false, type: "materialPair", key: "materialPair", val: { matA: s.matA, matB: s.matB }, compare: pairKey },
          { check: c.materialPair !== false, type: "matA", key: "matA", val: s.matA },
          { check: c.materialPair !== false, type: "matB", key: "matB", val: s.matB },
          { check: !!c.massA, type: "massA", key: "massA", val: s.massA },
          { check: !!c.massB, type: "massB", key: "massB", val: s.massB },
          { check: !!c.tempDiff, type: "tempA", key: "tempA", val: s.tempA },
          { check: !!c.tempDiff, type: "tempB", key: "tempB", val: s.tempB },
        ];
        entries.forEach(({ check, type, key, val, compare }) => {
          if (!check || this.lastRecorded[key] != null) return;
          if (compare != null && this.lastRecorded.materialPair === compare) return;
          this.lastRecorded[key] = val;
          if (key === "materialPair") this.lastRecorded.materialPair = compare;
          this.state.timeline.push({ type, from: null, to: val, at: now });
        });
        InquiryStorage.save(this.state);
        const expStep = this.steps.find((st) => st.id === "experiment");
        if (expStep?.renderTimeline) expStep.renderTimeline(this.state.timeline);
      }
    }

    _validators() {
      const v = {};
      this.steps.forEach((step) => {
        if (step.id === "summary") return;
        v[step.id] = (st) => step.isComplete(st);
      });
      v.summary = (st) => this.steps.find((s) => s.id === "summary")?.isComplete(st);
      return v;
    }

    _refreshUI() {
      const vals = this._validators();
      const { percent, done } = InquiryProgress.compute(this.state, vals);
      this._lastDoneMap = done;
      this._lastPercent = percent;

      InquiryProgress.render(this.progressEl, percent, done);
      const activeIdx = Math.max(0, Math.min(this.state.activeStepIndex ?? 0, this.steps.length - 1));
      this.progressEl.querySelectorAll(".inquiry-step-dot").forEach((dot, i) => {
        const id = InquiryProgress.STEP_IDS[i];
        dot.classList.remove("active", "done");
        if (done[id]) dot.classList.add("done");
        if (i === activeIdx) dot.classList.add("active");
      });

      this._updateStepVisibility();
      this.steps.forEach((step) => { if (step.setDone) step.setDone(done[step.id]); });
      this._updateMissionBanner();

      const expStep = this.steps.find((s) => s.id === "experiment");
      if (expStep?.renderTimeline) expStep.renderTimeline(this.state.timeline);
      if (expStep?.renderContactLog) expStep.renderContactLog(this.state.contactMeasureLog);

      const resStep = this.steps.find((s) => s.id === "results");
      if (resStep?.renderTable) resStep.renderTable(this.state.results, [], this.state.planChecks);
      if (resStep?.renderMeasureSessions) resStep.renderMeasureSessions(this.state.contactMeasureLog, []);

      const sumStep = this.steps.find((s) => s.id === "summary");
      if (sumStep?.update) sumStep.update(done, percent, STEP_LABELS);
      if (sumStep?.updateMissionGuide) sumStep.updateMissionGuide(this.state);

      const gStep = this.steps.find((s) => s.id === "graph");
      if (gStep?.syncFromState) gStep.syncFromState(this.state);

      if (percent >= 100 && !this.celebrated) this._tryCelebrateIfReady();

      const refStep = this.steps.find((s) => s.id === "reflection");
      if (refStep?.updateFinishButton) refStep.updateFinishButton(this.state, percent, this.celebrated);
    }

    _updateMissionBanner() {
      const banner = document.getElementById("inquiryMissionBanner");
      if (!banner) return;
      const mission = global.InquiryMissions?.getMission(this.state.missionId);
      const hyp = global.InquiryMissions?.getHypothesis(this.state.hypothesisId);
      const plan = global.InquiryMissions?.getPlan(this.state.planId);
      const activeIdx = Math.max(0, this.state.activeStepIndex ?? 0);
      const show = !!mission && activeIdx >= 3;
      banner.classList.toggle("hidden", !show);
      if (!show) return;

      const missionEl = document.getElementById("inquiryBannerMission");
      const hypEl = document.getElementById("inquiryBannerHyp");
      const planEl = document.getElementById("inquiryBannerPlan");
      if (missionEl) {
        missionEl.innerHTML = "<strong>問い：</strong>" + (mission?.title || "—") +
          (mission?.description ? '<span class="inquiry-banner-desc">' + mission.description + "</span>" : "");
      }
      if (hypEl) {
        const free = (this.state.hypothesisFreeText || "").trim();
        hypEl.innerHTML = "<strong>仮説：</strong>" + (hyp?.text || "（未選択）") +
          (free ? ' <span class="inquiry-banner-free">（' + free + "）</span>" : "");
      }
      if (planEl) {
        planEl.innerHTML = "<strong>計画：</strong>" + (plan?.text || "（未選択）") +
          (plan?.purpose ? ' <span class="inquiry-banner-purpose">ねらい：' + plan.purpose + "</span>" : "");
      }
    }

    _generateAiComments(statusEl) {
      if (!global.InquiryCompanion?.generateAllForState) {
        if (statusEl) statusEl.textContent = "伴走AIモジュールが読み込まれていません。";
        return;
      }
      if (statusEl) statusEl.textContent = "AIコメントを生成中…";
      this.state.aiComments = { ...(this.state.aiComments || {}), ...InquiryCompanion.generateAllForState(this.state) };
      InquiryStorage.save(this.state);
      if (statusEl) statusEl.textContent = "AIコメントを生成しました。レポートに反映されます。";
    }

    _tryCelebrateIfReady(force) {
      if (this.celebrated) return;
      if (!force && (this._reflectionFocused || this._summaryFocused || this._isOnSummaryStep())) return;
      const { percent, done } = InquiryProgress.compute(this.state, this._validators());
      if (percent >= 100) this._triggerCelebration(done, percent);
    }

    _isOnSummaryStep() {
      const idx = Math.max(0, this.state.activeStepIndex ?? 0);
      return this.steps[idx]?.id === "summary";
    }

    _triggerCelebration(done, percent) {
      if (this.celebrated) return;
      this.celebrated = true;
      this.state.summaryCelebrated = true;
      InquiryStorage.save(this.state);
      this._launchConfetti();
      this._showSummaryScreen(done, percent);
      setTimeout(() => {
        this.summaryScreenEl?.classList.add("hidden");
        this.summaryScreenEl?.setAttribute("aria-hidden", "true");
        this.showReport();
      }, 900);
    }

    _bindSummaryScreen() {
      const closeBtn = this.summaryScreenEl?.querySelector(".summary-screen-close");
      const reportBtn = this.summaryScreenEl?.querySelector("#summaryScreenReportBtn");
      if (closeBtn) {
        closeBtn.addEventListener("click", () => {
          this.summaryScreenEl?.classList.add("hidden");
          this.summaryScreenEl?.setAttribute("aria-hidden", "true");
          const sumIdx = this.steps.findIndex((s) => s.id === "summary");
          if (sumIdx >= 0) {
            this.state.activeStepIndex = sumIdx;
            InquiryStorage.save(this.state);
            this._updateStepVisibility();
          }
        });
      }
      if (reportBtn) {
        reportBtn.addEventListener("click", () => {
          this.summaryScreenEl?.classList.add("hidden");
          this.showReport();
        });
      }
    }

    _bindCompanionMode() {
      const bar = this.progressEl?.querySelector("#inqCompanionModeBar");
      if (!bar || !global.InquiryCompanion?.setMode) return;
      const syncButtons = (mode) => {
        bar.querySelectorAll(".inq-companion-mode-btn").forEach((btn) => {
          btn.classList.toggle("active", btn.dataset.mode === mode);
        });
      };
      syncButtons(this.state.companionMode || InquiryCompanion.getMode());
      bar.querySelectorAll(".inq-companion-mode-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const mode = btn.dataset.mode === "expert" ? "expert" : "gentle";
          this.state.companionMode = mode;
          InquiryCompanion.setMode(mode, true);
          syncButtons(mode);
          InquiryStorage.save(this.state);
        });
      });
    }

    _bindReportScreen() {
      document.getElementById("reportDownloadPdfBtn")?.addEventListener("click", () => this.downloadReportPdf());
      document.getElementById("reportCloseBtn")?.addEventListener("click", () => {
        this.reportScreenEl?.classList.add("hidden");
        this.reportScreenEl?.setAttribute("aria-hidden", "true");
      });
    }

    showReport() {
      if (!this.reportDocEl || !global.InquiryReport) {
        alert("レポートを表示できません。ページを再読み込みしてください。");
        return;
      }
      this.welcomeEl?.classList.add("hidden");
      this.summaryScreenEl?.classList.add("hidden");
      try {
        InquiryReport.render(this.reportDocEl, this.exportAll(), { celebrated: this._lastPercent >= 100 });
      } catch (err) {
        console.error("[探究レポート]", err);
      }
      const pageCount = this.reportDocEl.querySelectorAll(".inquiry-report-page").length;
      const badge = this.reportScreenEl?.querySelector(".report-format-badge");
      if (badge) badge.textContent = pageCount > 0 ? "A4 縦 " + pageCount + "ページ" : "A4 縦";
      this.reportScreenEl?.classList.remove("hidden");
      this.reportScreenEl?.setAttribute("aria-hidden", "false");
    }

    downloadReportPdf() {
      if (!this.reportDocEl || !global.InquiryReport) return;
      const btn = document.getElementById("reportDownloadPdfBtn");
      const orig = btn?.textContent;
      if (btn) { btn.disabled = true; btn.textContent = "PDF作成中…"; }
      const stamp = new Date().toISOString().slice(0, 10);
      InquiryReport.downloadPdf(this.reportDocEl, "heat_equilibrium_inquiry_report_" + stamp + ".pdf")
        .catch(() => InquiryReport._downloadPdfViaPrint(this.reportDocEl))
        .finally(() => {
          if (btn) { btn.disabled = false; btn.textContent = orig || "⬇ A4 PDFでダウンロード"; }
        });
    }

    _showSummaryScreen(doneMap, percent) {
      const el = this.summaryScreenEl;
      if (!el) return;
      const list = el.querySelector("#summaryScreenChecklist");
      const rate = el.querySelector("#summaryScreenRate");
      if (list) {
        list.innerHTML = STEP_LABELS.map((lbl, i) => {
          const id = InquiryProgress.STEP_IDS[i];
          return '<li class="' + (doneMap[id] ? "done" : "") + '">' + lbl + "</li>";
        }).join("");
      }
      if (rate) rate.textContent = percent + "%";
      el.classList.remove("hidden");
      el.setAttribute("aria-hidden", "false");
    }

    _bindExperimentActions() {
      document.getElementById("inqMeasureBtn")?.addEventListener("click", () => this.measureNow());
      document.getElementById("inqExpResetBtn")?.addEventListener("click", () => this.resetExperiment());
      document.getElementById("inqFocusSimBtn")?.addEventListener("click", () => this._scrollToSim());
    }

    _bindWelcome() {
      const startBtn = this.welcomeEl?.querySelector(".welcome-start");
      if (!startBtn) return;
      startBtn.addEventListener("click", () => {
        this.welcomeEl.classList.add("hidden");
        this.state.welcomeSeen = true;
        InquiryStorage.save(this.state);
        this.state.activeStepIndex = 0;
        this._updateStepVisibility();
        this._refreshUI();
      });
    }

    _scrollToSim() {
      const stage = document.getElementById("inquirySimStage");
      (stage || document.getElementById("simCanvasWrap"))?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    activate() {
      this.recordingEnabled = true;
      this.onTabActive();
      this.updateExperimentControls();
      if (!this.state.welcomeSeen) this.welcomeEl?.classList.remove("hidden");
      this._refreshUI();
    }

    deactivate() {
      this.recordingEnabled = false;
    }

    measureNow() {
      if (this._measuring) return;
      if (document.getElementById("tabInquiry")?.classList.contains("active")) {
        this.recordingEnabled = true;
      }
      const sim = global.HeatEquilibriumSim;
      if (!sim) {
        this._setMeasureFeedback("シミュレーションの準備ができていません", false);
        return;
      }
      if (sim.isContacting && sim.isContacting()) {
        this._setMeasureFeedback("接触中です。熱平衡までお待ちください。", false);
        return;
      }

      this._measuring = true;
      const before = sim.getState();
      const tempAInit = before.tempA;
      const tempBInit = before.tempB;
      sim.startContact();

      const finish = () => {
        const s = sim.getState();
        if (!sim.isEquilibrium || !sim.isEquilibrium()) {
          this._setMeasureFeedback("熱平衡に達しませんでした。条件を確認して再試行してください。", false);
          this._measuring = false;
          return;
        }

        const measureId = Date.now();
        const measureRound = (this.state.contactMeasureLog?.length || 0) + 1;
        const round1 = (v) => Math.round(Number(v) * 10) / 10;
        const chartData = sim.getChartData?.() || { seriesA: [], seriesB: [] };

        const row = {
          measureId,
          measureRound,
          matA: s.matA,
          matB: s.matB,
          matAName: MATERIAL_NAMES[s.matA] || s.matA,
          matBName: MATERIAL_NAMES[s.matB] || s.matB,
          massA: s.massA,
          massB: s.massB,
          tempAInit: round1(tempAInit),
          tempBInit: round1(tempBInit),
          tempAFinal: round1(s.tempA),
          tempBFinal: round1(s.tempB),
          deltaTA: round1((s.tempA ?? 0) - tempAInit),
          deltaTB: round1((s.tempB ?? 0) - tempBInit),
          Q_loss: round1(s.Q_loss),
          Q_gain: round1(s.Q_gain),
          teqFinal: round1(s.tempA),
          teqTheory: round1(s.teqTheoretical ?? s.teqTheory ?? 0),
          simTime: round1(s.simTime),
          tempDiff: round1(Math.abs(tempAInit - tempBInit)),
          massRatio: round1((s.massA ?? 500) / Math.max(s.massB ?? 500, 1)),
          at: measureId,
        };

        this.state.results = [...(this.state.results || []), row];
        if (!this.state.contactMeasureLog) this.state.contactMeasureLog = [];
        this.state.contactMeasureLog.push(row);

        if (!this.state.ttCurves) this.state.ttCurves = {};
        this.state.ttCurves[measureId] = {
          seriesA: (chartData.seriesA || []).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
          seriesB: (chartData.seriesB || []).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
        };

        InquiryStorage.save(this.state);

        const resStep = this.steps.find((st) => st.id === "results");
        if (resStep?.updateTableHeaders) resStep.updateTableHeaders(this.state.planChecks);
        if (resStep?.renderMeasureSessions) resStep.renderMeasureSessions(this.state.contactMeasureLog, [measureId]);
        if (resStep?.renderTable) resStep.renderTable(this.state.results, [measureId], this.state.planChecks);
        this._refreshUI();

        const qErr = Math.abs(row.Q_loss - row.Q_gain);
        this._setMeasureFeedback(
          "接触測定完了：" + measureRound + "回目 · Q_loss=" + Math.round(row.Q_loss) + "J · Teq=" + row.teqFinal + "℃" +
          (qErr < 1 ? "（Q_loss≈Q_gain ✓）" : ""),
          true
        );
        document.getElementById("inqMeasureBtn")?.classList.add("is-flash");
        setTimeout(() => document.getElementById("inqMeasureBtn")?.classList.remove("is-flash"), 600);
        this._measuring = false;
      };

      const poll = () => {
        if (sim.isEquilibrium && sim.isEquilibrium()) {
          finish();
          return;
        }
        if (!sim.isContacting || !sim.isContacting()) {
          this._setMeasureFeedback("接触が中断されました。", false);
          this._measuring = false;
          return;
        }
        requestAnimationFrame(poll);
      };
      requestAnimationFrame(poll);
    }

    _setMeasureFeedback(msg, ok) {
      this.steps.find((s) => s.id === "experiment")?.setMeasureFeedback?.(msg, ok);
      const hint = document.getElementById("inqMeasureStatus");
      if (hint) {
        hint.textContent = msg;
        hint.classList.toggle("is-ok", !!ok);
      }
    }

    resetExperiment() {
      if (!confirm("実験ログと接触測定データをリセットしますか？")) return;
      const sim = global.HeatEquilibriumSim;
      this.state.timeline = [];
      this.state.results = [];
      this.state.contactMeasureLog = [];
      this.state.graphsCreated = {};
      this.state.ttCurves = {};
      this.state.customGraphs = [];
      this.lastRecorded = { matA: null, matB: null, massA: null, massB: null, tempA: null, tempB: null, materialPair: null };

      if (sim) {
        const s = sim.getState();
        const now = Date.now();
        const c = this.state.planChecks || {};
        if (c.materialPair !== false) {
          this.state.timeline.push({ type: "matA", from: null, to: s.matA, at: now });
          this.state.timeline.push({ type: "matB", from: null, to: s.matB, at: now });
          this.lastRecorded.matA = s.matA;
          this.lastRecorded.matB = s.matB;
          this.lastRecorded.materialPair = s.matA + "|" + s.matB;
        }
        if (c.massA) {
          this.state.timeline.push({ type: "massA", from: null, to: s.massA, at: now });
          this.lastRecorded.massA = s.massA;
        }
        if (c.massB) {
          this.state.timeline.push({ type: "massB", from: null, to: s.massB, at: now });
          this.lastRecorded.massB = s.massB;
        }
        if (c.tempDiff) {
          this.state.timeline.push({ type: "tempA", from: null, to: s.tempA, at: now });
          this.state.timeline.push({ type: "tempB", from: null, to: s.tempB, at: now });
          this.lastRecorded.tempA = s.tempA;
          this.lastRecorded.tempB = s.tempB;
        }
      }

      if (sim?.reset) sim.reset();
      InquiryStorage.save(this.state);
      this.steps.find((s) => s.id === "graph")?.syncFromState?.(this.state);
      this._setMeasureFeedback("実験データをリセットしました。", false);
      this._refreshUI();
    }

    _setupSimRecording() {
      const sim = global.HeatEquilibriumSim;
      if (!sim) return;

      if (!this._simStateListenerAttached) {
        sim.onStateUpdate((st) => this._onSimUpdate(st));
        this._simStateListenerAttached = true;
      }

      if (this.state.timeline.length === 0) {
        const s = sim.getState();
        const now = Date.now();
        const c = this.state.planChecks || {};
        if (c.materialPair !== false) {
          this.state.timeline.push({ type: "matA", from: null, to: s.matA, at: now });
          this.state.timeline.push({ type: "matB", from: null, to: s.matB, at: now });
          this.lastRecorded.matA = s.matA;
          this.lastRecorded.matB = s.matB;
          this.lastRecorded.materialPair = s.matA + "|" + s.matB;
        }
        if (c.massA) {
          this.state.timeline.push({ type: "massA", from: null, to: s.massA, at: now });
          this.lastRecorded.massA = s.massA;
        }
        if (c.massB) {
          this.state.timeline.push({ type: "massB", from: null, to: s.massB, at: now });
          this.lastRecorded.massB = s.massB;
        }
        if (c.tempDiff) {
          this.state.timeline.push({ type: "tempA", from: null, to: s.tempA, at: now });
          this.state.timeline.push({ type: "tempB", from: null, to: s.tempB, at: now });
          this.lastRecorded.tempA = s.tempA;
          this.lastRecorded.tempB = s.tempB;
        }
        InquiryStorage.save(this.state);
      }
    }

    _logChange(type, from, to) {
      this.state.timeline.push({ type, from, to, at: Date.now() });
      InquiryStorage.save(this.state);
      const expStep = this.steps.find((s) => s.id === "experiment");
      if (expStep?.renderTimeline) expStep.renderTimeline(this.state.timeline);
      if (expStep?.renderContactLog) expStep.renderContactLog(this.state.contactMeasureLog);
      this._refreshUI();
    }

    _onSimUpdate(simState) {
      if (!this.recordingEnabled) return;
      const c = this.state.planChecks || {};
      const pairKey = simState.matA + "|" + simState.matB;

      if (c.materialPair !== false) {
        if (simState.matA !== this.lastRecorded.matA) {
          this._logChange("matA", this.lastRecorded.matA, simState.matA);
          this.lastRecorded.matA = simState.matA;
        }
        if (simState.matB !== this.lastRecorded.matB) {
          this._logChange("matB", this.lastRecorded.matB, simState.matB);
          this.lastRecorded.matB = simState.matB;
        }
        if (pairKey !== this.lastRecorded.materialPair) {
          this.lastRecorded.materialPair = pairKey;
        }
      }
      if (c.massA && simState.massA !== this.lastRecorded.massA) {
        this._logChange("massA", this.lastRecorded.massA, simState.massA);
        this.lastRecorded.massA = simState.massA;
      }
      if (c.massB && simState.massB !== this.lastRecorded.massB) {
        this._logChange("massB", this.lastRecorded.massB, simState.massB);
        this.lastRecorded.massB = simState.massB;
      }
      if (c.tempDiff && simState.tempA !== this.lastRecorded.tempA) {
        this._logChange("tempA", this.lastRecorded.tempA, simState.tempA);
        this.lastRecorded.tempA = simState.tempA;
      }
      if (c.tempDiff && simState.tempB !== this.lastRecorded.tempB) {
        this._logChange("tempB", this.lastRecorded.tempB, simState.tempB);
        this.lastRecorded.tempB = simState.tempB;
      }
    }

    _launchConfetti() {
      let canvas = document.getElementById("confettiCanvas");
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.id = "confettiCanvas";
        document.body.appendChild(canvas);
      }
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const colors = ["#22d3ee", "#fb923c", "#38bdf8", "#fde047", "#86efac"];
      const pieces = Array.from({ length: 120 }, () => ({
        x: Math.random() * window.innerWidth,
        y: -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 4,
        vy: 2 + Math.random() * 5,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.2,
        color: colors[Math.floor(Math.random() * colors.length)],
        w: 6 + Math.random() * 6,
        h: 4 + Math.random() * 4,
      }));
      const start = performance.now();
      const frame = (now) => {
        const elapsed = now - start;
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        pieces.forEach((p) => {
          p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.rot += p.vr;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, 1 - elapsed / 4000);
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        });
        if (elapsed < 4000) requestAnimationFrame(frame);
        else ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      };
      requestAnimationFrame(frame);
    }

    exportAll() {
      const data = {};
      this.steps.forEach((step) => {
        if (step.exportData) Object.assign(data, step.exportData(this.state));
      });
      return InquiryStorage.exportForSubmit({ ...this.state, ...data });
    }

    resetProgress() {
      if (!confirm("探究ノートの記録をすべて消して、最初からやり直しますか？")) return;
      InquiryStorage.clear();
      this.state = InquiryStorage.load();
      this.state.activeStepIndex = 0;
      this.state.welcomeSeen = false;
      InquiryStorage.save(this.state);
      this.celebrated = false;
      this.lastRecorded = { matA: null, matB: null, massA: null, massB: null, tempA: null, tempB: null, materialPair: null };
      if (global.HeatEquilibriumSim?.reset) global.HeatEquilibriumSim.reset();
      this._buildSteps();
      this._bindSummaryScreen();
      this._bindReportScreen();
      this._bindExperimentActions();
      this._setupSimRecording();
      this.updateExperimentControls();
      this._refreshUI();
    }
  }

  global.InquiryMode = InquiryMode;
})(window);
