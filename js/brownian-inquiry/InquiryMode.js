/**
 * 探究モード — メインオーケストレータ
 * BrownianSim API と連携。将来: submitToTeacher(), exportPDF() をここに追加
 */
(function (global) {
  "use strict";

  const STEP_LABELS = ["問い（ミッション）", "仮説", "実験計画", "実験", "実験結果", "グラフ", "考察", "まとめ"];

  class InquiryMode {
    constructor(options) {
      this.noteEl = options.noteEl;
      this.progressEl = options.progressEl;
      this.simMountEl = options.simMountEl;
      this.simSourceEl = options.simSourceEl;
      this.welcomeEl = options.welcomeEl;
      this.observeOverlayEl = options.observeOverlayEl;
      this.controlsEl = options.controlsEl;
      this.summaryScreenEl = options.summaryScreenEl;
      this.reportScreenEl = options.reportScreenEl;
      this.reportDocEl = options.reportDocEl;
      this.onTabActive = options.onTabActive || (() => {});

      this.state = InquiryStorage.load();
      this.steps = [];
      this.validators = {};
      this.lastRecorded = { temperature: null, largeRadius: null, particleCount: null };
      this.confettiRAF = null;
      this.celebrated = !!this.state.summaryCelebrated;
      this.recordingEnabled = false;

      this._lastDoneMap = {};
      this._lastPercent = 0;
      this._reflectionFocused = false;

      this._buildSteps();
      this._bindWelcome();
      this._bindSummaryScreen();
      this._bindReportScreen();
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
      instances.forEach((step, i) => {
        if (step.id === "experiment") {
          step.mount(this.noteEl, this.state, {
            onMeasure: () => this.measureNow(),
            onReset: () => this.resetExperiment(),
          });
        } else if (step.id === "results") {
          step.mount(this.noteEl, this.state);
        } else if (step.id === "summary") {
          step.mount(this.noteEl, this.state, false, {
            onOpenSummary: () => this._showSummaryScreen(this._lastDoneMap || {}, this._lastPercent || 0),
            onOpenReport: () => this.showReport(),
          });
        } else if (step.id === "question") {
          step.mount(this.noteEl, this.state, (patch) => this._patch(patch), () => this.restartObservation());
        } else if (step.id === "reflection") {
          step.mount(this.noteEl, this.state, (patch) => this._patch(patch), {
            onFocus: () => { this._reflectionFocused = true; },
            onBlur: () => {
              this._reflectionFocused = false;
              this._tryCelebrateIfReady();
            },
            onFinish: () => this._tryCelebrateIfReady(true),
          });
        } else {
          step.mount(this.noteEl, this.state, (patch) => this._patch(patch));
        }
        this.steps.push(step);
        this.validators[step.id] = (st) => step.isComplete(st);
      });

      this._renderProgressDots();
      this._refreshUI();
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
          this.steps[idx]?.scrollIntoView();
        });
      });
    }

    _patch(patch) {
      Object.assign(this.state, patch);
      if (global.InquiryMissions?.syncLegacyFields) {
        Object.assign(this.state, InquiryMissions.syncLegacyFields(this.state));
      }
      if (Object.prototype.hasOwnProperty.call(patch, "missionId")) {
        const hypStep = this.steps.find((s) => s.id === "hypothesis");
        if (hypStep?.remountChoices) hypStep.remountChoices(this.state, (p) => this._patch(p));
        const planStep = this.steps.find((s) => s.id === "plan");
        if (planStep?.remountChoices) planStep.remountChoices(this.state, (p) => this._patch(p));
      }
      InquiryStorage.save(this.state);
      if (patch.planChecks || Object.prototype.hasOwnProperty.call(patch, "planId") ||
          Object.prototype.hasOwnProperty.call(patch, "missionId")) {
        this._syncPlanChecksFromPlanId();
        this.updateExperimentControls();
      } else if (patch.graphCreated) {
        const gStep = this.steps.find((s) => s.id === "graph");
        if (gStep?.drawGraph) gStep.drawGraph(this.state.results || [], this.state.planChecks);
      } else {
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
      const defaults = global.InquiryMissions?.DEFAULT_PLAN_CHECKS || { temperature: true, particleSize: false, particleCount: false };
      if (!this.state.planChecks) {
        this.state.planChecks = { ...defaults };
      }
    }

    _isPlanChecked(key, c) {
      if (key === "temperature") return c.temperature !== false;
      return !!c[key];
    }

    _setPanelState(el, on) {
      if (!el) return;
      el.classList.toggle("is-enabled", on);
      el.classList.toggle("is-disabled", !on);
      el.querySelectorAll("input, button").forEach((ctrl) => {
        ctrl.disabled = !on;
      });
    }

    updateExperimentControls() {
      this._syncPlanChecksFromPlanId();
      const c = this.state.planChecks || global.InquiryMissions?.DEFAULT_PLAN_CHECKS || { temperature: true, particleSize: false, particleCount: false };
      const panels = {
        temperature: document.getElementById("inqVarTemp"),
        particleSize: document.getElementById("inqVarSize"),
        particleCount: document.getElementById("inqVarCount"),
      };
      const labels = [];
      Object.keys(panels).forEach((key) => {
        const el = panels[key];
        if (!el) return;
        const on = this._isPlanChecked(key, c);
        this._setPanelState(el, on);
        if (on) {
          if (key === "temperature") labels.push("温度");
          if (key === "particleSize") labels.push("粒子サイズ");
          if (key === "particleCount") labels.push("粒子数");
        }
      });
      const badge = document.getElementById("inqPlanBadge");
      if (badge) badge.textContent = labels.length ? "（" + labels.join(" · ") + "）" : "";
      const hint = document.getElementById("inqPlanHint");
      if (hint) {
        hint.innerHTML = labels.length
          ? "初期条件はすべて設定できます。<strong>③ 実験計画</strong>で「操作変数」として記録・分析する項目：<strong>" +
            labels.join("、") + "</strong>（変更は実験ログに記録）。"
          : "③ 実験計画を選ぶと、記録・分析する操作変数が決まります。";
      }
      const resStep = this.steps.find((s) => s.id === "results");
      if (resStep?.updateTableHeaders) resStep.updateTableHeaders(c);

      const sizeItem = document.getElementById("inqStatSizeItem");
      const countItem = document.getElementById("inqStatCountItem");
      if (sizeItem) sizeItem.style.display = c.particleSize ? "" : "none";
      if (countItem) countItem.style.display = c.particleCount ? "" : "none";

      const sim = global.BrownianSim;
      if (sim && this.recordingEnabled) {
        const s = sim.getState();
        const now = Date.now();
        const entries = [
          { check: c.temperature !== false, type: "temperature", key: "temperature", val: s.temperature },
          { check: !!c.particleSize, type: "particleSize", key: "largeRadius", val: s.largeRadius },
          { check: !!c.particleCount, type: "particleCount", key: "particleCount", val: s.particleCount },
        ];
        entries.forEach(({ check, type, key, val }) => {
          if (!check || this.lastRecorded[key] != null) return;
          this.lastRecorded[key] = val;
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
      const otherIds = InquiryProgress.STEP_IDS.filter((id) => id !== "summary");
      v.summary = (st) => otherIds.every((id) => v[id](st));
      return v;
    }

    _refreshUI() {
      const vals = this._validators();
      const { percent, done } = InquiryProgress.compute(this.state, vals);
      this._lastDoneMap = done;
      this._lastPercent = percent;

      InquiryProgress.render(this.progressEl, percent, done);
      this.progressEl.querySelectorAll(".inquiry-step-dot").forEach((dot, i) => {
        const id = InquiryProgress.STEP_IDS[i];
        dot.classList.remove("active", "done");
        if (done[id]) dot.classList.add("done");
      });
      const firstOpen = InquiryProgress.STEP_IDS.findIndex((id) => !done[id]);
      if (firstOpen >= 0) {
        const activeDot = this.progressEl.querySelector('.inquiry-step-dot[data-idx="' + firstOpen + '"]');
        if (activeDot) activeDot.classList.add("active");
      }

      this.steps.forEach((step) => {
        if (step.setDone) step.setDone(done[step.id]);
      });

      const expStep = this.steps.find((s) => s.id === "experiment");
      if (expStep?.renderTimeline) expStep.renderTimeline(this.state.timeline);

      const resStep = this.steps.find((s) => s.id === "results");
      if (resStep?.renderTable) resStep.renderTable(this.state.results, [], this.state.planChecks);

      const sumStep = this.steps.find((s) => s.id === "summary");
      if (sumStep?.update) sumStep.update(done, percent, STEP_LABELS);

      const qStep = this.steps.find((s) => s.id === "question");
      if (qStep?.setObservationDone && !this.observeOverlayEl?.classList.contains("is-active")) {
        qStep.setObservationDone(this.state.observationDone);
      }

      if (percent >= 100 && !this.celebrated) {
        this._tryCelebrateIfReady();
      }

      const refStep = this.steps.find((s) => s.id === "reflection");
      if (refStep?.updateFinishButton) refStep.updateFinishButton(this.state, percent, this.celebrated);
    }

    _isReflectionFocused() {
      const el = document.getElementById("inqReflection");
      return !!(el && document.activeElement === el);
    }

    _tryCelebrateIfReady(force) {
      if (this.celebrated) return;
      if (!force && (this._reflectionFocused || this._isReflectionFocused())) return;

      const vals = this._validators();
      const { percent, done } = InquiryProgress.compute(this.state, vals);
      if (percent >= 100) {
        this._triggerCelebration(done, percent);
      }
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

      const refStep = this.steps.find((s) => s.id === "reflection");
      if (refStep?.updateFinishButton) refStep.updateFinishButton(this.state, percent, true);
    }

    _bindSummaryScreen() {
      const closeBtn = this.summaryScreenEl?.querySelector(".summary-screen-close");
      const reportBtn = this.summaryScreenEl?.querySelector("#summaryScreenReportBtn");
      if (closeBtn) {
        closeBtn.addEventListener("click", () => {
          this.summaryScreenEl?.classList.add("hidden");
          this.summaryScreenEl?.setAttribute("aria-hidden", "true");
          this.steps.find((s) => s.id === "summary")?.scrollIntoView();
        });
      }
      if (reportBtn) {
        reportBtn.addEventListener("click", () => {
          this.summaryScreenEl?.classList.add("hidden");
          this.summaryScreenEl?.setAttribute("aria-hidden", "true");
          this.showReport();
        });
      }
    }

    _bindReportScreen() {
      const dlBtn = document.getElementById("reportDownloadPdfBtn");
      const closeBtn = document.getElementById("reportCloseBtn");
      if (dlBtn) dlBtn.onclick = () => this.downloadReportPdf();
      if (closeBtn) {
        closeBtn.onclick = () => {
          this.reportScreenEl?.classList.add("hidden");
          this.reportScreenEl?.setAttribute("aria-hidden", "true");
        };
      }
    }

    showReport() {
      if (!this.reportDocEl || !global.InquiryReport) return;
      const data = this.exportAll();
      const graphSize = InquiryReport.getGraphDisplaySize();
      InquiryReport.render(this.reportDocEl, data, {
        celebrated: this._lastPercent >= 100,
        graphSize: data.graphCreated ? graphSize : null,
      });
      const pageCount = this.reportDocEl.querySelectorAll(".inquiry-report-page").length;
      const badge = this.reportScreenEl?.querySelector(".report-format-badge");
      if (badge) badge.textContent = "A4 縦 " + pageCount + "ページ";
      this.reportScreenEl?.classList.remove("hidden");
      this.reportScreenEl?.setAttribute("aria-hidden", "false");
      this.reportScreenEl?.querySelector(".report-screen-scroll")?.scrollTo(0, 0);
    }

    downloadReportPdf() {
      if (!this.reportDocEl || !global.InquiryReport) return;
      const btn = document.getElementById("reportDownloadPdfBtn");
      const orig = btn?.textContent;
      if (btn) {
        btn.disabled = true;
        btn.textContent = "PDF作成中…";
      }
      const stamp = new Date().toISOString().slice(0, 10);
      InquiryReport.downloadPdf(this.reportDocEl, "brownian_inquiry_report_" + stamp + ".pdf")
        .catch(() => InquiryReport._downloadPdfViaPrint(this.reportDocEl))
        .catch(() => {
          alert("PDFの保存に失敗しました。ブラウザの設定でポップアップとダウンロードを許可してから、もう一度お試しください。");
        })
        .finally(() => {
          if (btn) {
            btn.disabled = false;
            btn.textContent = orig || "⬇ A4 PDFでダウンロード";
          }
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
          const done = doneMap[id];
          return '<li class="' + (done ? "done" : "") + '">' + lbl + "</li>";
        }).join("");
      }
      if (rate) rate.textContent = percent + "%";
      el.classList.remove("hidden");
      el.setAttribute("aria-hidden", "false");
    }

    _bindExperimentActions() {
      const m = document.getElementById("inqMeasureBtn");
      const r = document.getElementById("inqExpResetBtn");
      if (m) m.onclick = () => this.measureNow();
      if (r) r.onclick = () => this.resetExperiment();
    }

    _isInquiryTabActive() {
      return !!document.getElementById("tabInquiry")?.classList.contains("active");
    }

    measureNow() {
      if (this._isInquiryTabActive()) {
        this.recordingEnabled = true;
      }
      const sim = global.BrownianSim;
      if (!sim) {
        this._setMeasureFeedback("シミュレーションの準備ができていません", false);
        return;
      }
      if (sim.refreshStats) sim.refreshStats();
      const s = sim.getState();
      if (!Number.isFinite(s.avgSpeedPxS) || s.avgSpeedPxS <= 0) {
        this._setMeasureFeedback("速度データが取得できません。シミュレーションを少し待ってから再測定してください。", false);
        return;
      }
      const before = (this.state.results || []).length;
      this._tryRecordResult();
      const after = (this.state.results || []).length;
      const msg = after > before
        ? "測定完了：平均速度 " + Math.round(s.avgSpeedPxS * 10) / 10 + " px/s を記録しました（" + after + " 件）"
        : "測定完了：同じ条件のデータを更新しました（" + Math.round(s.avgSpeedPxS * 10) / 10 + " px/s）";
      this._setMeasureFeedback(msg, true);
      document.getElementById("inqMeasureBtn")?.classList.add("is-flash");
      setTimeout(() => document.getElementById("inqMeasureBtn")?.classList.remove("is-flash"), 600);
      this.steps.find((st) => st.id === "results")?.scrollIntoView?.();
    }

    _setMeasureFeedback(msg, ok) {
      const expStep = this.steps.find((s) => s.id === "experiment");
      if (expStep?.setMeasureFeedback) expStep.setMeasureFeedback(msg, ok);
      const hint = document.getElementById("inqMeasureStatus");
      if (hint) {
        hint.textContent = msg;
        hint.classList.toggle("is-ok", !!ok);
      }
    }

    resetExperiment() {
      if (!confirm("実験ログと測定データをリセットしますか？\n（条件の変更履歴と結果表が消えます）")) return;
      const sim = global.BrownianSim;
      this.state.timeline = [];
      this.state.results = [];
      this.state.graphCreated = false;
      this.lastRecorded = { temperature: null, largeRadius: null, particleCount: null };

      if (sim) {
        const s = sim.getState();
        const now = Date.now();
        const c = this.state.planChecks || {};
        if (c.temperature !== false) {
          this.state.timeline.push({ type: "temperature", from: null, to: s.temperature, at: now });
          this.lastRecorded.temperature = s.temperature;
        }
        if (c.particleSize) {
          this.state.timeline.push({ type: "particleSize", from: null, to: s.largeRadius, at: now });
          this.lastRecorded.largeRadius = s.largeRadius;
        }
        if (c.particleCount) {
          this.state.timeline.push({ type: "particleCount", from: null, to: s.particleCount, at: now });
          this.lastRecorded.particleCount = s.particleCount;
        }
      }

      InquiryStorage.save(this.state);
      const gStep = this.steps.find((s) => s.id === "graph");
      if (gStep?.graphPanel) gStep.graphPanel.style.display = "none";
      if (gStep?.btn) {
        gStep.btn.disabled = false;
        gStep.btn.textContent = "📈 グラフを作成する";
      }
      this._setMeasureFeedback("実験データをリセットしました。条件を変えてから測定してください。", false);
      this._refreshUI();
    }

    _bindWelcome() {
      const startBtn = this.welcomeEl?.querySelector(".welcome-start");
      if (!startBtn) return;
      startBtn.addEventListener("click", () => {
        this.welcomeEl.classList.add("hidden");
        this.state.welcomeSeen = true;
        InquiryStorage.save(this.state);
        this._scrollToSim();
        setTimeout(() => this._startObservation(), 200);
        this.steps[0]?.scrollIntoView();
      });
    }

    _scrollToSim() {
      const wrap = document.getElementById("simCanvasWrap");
      if (wrap) wrap.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    activate() {
      this.recordingEnabled = true;
      this.onTabActive();
      this.updateExperimentControls();
      if (!this.state.welcomeSeen) {
        this.welcomeEl?.classList.remove("hidden");
      } else if (!this.state.observationDone) {
        this._scrollToSim();
        setTimeout(() => this._startObservation(), 350);
      }
      this._refreshUI();
      const qStep = this.steps.find((s) => s.id === "question");
      if (qStep?.setObservationDone) qStep.setObservationDone(this.state.observationDone);
    }

    deactivate() {
      this.recordingEnabled = false;
      this._stopObservation();
    }

    restartObservation() {
      this.state.observationDone = false;
      this.state.observationSeconds = 0;
      InquiryStorage.save(this.state);
      this._scrollToSim();
      setTimeout(() => this._startObservation(true), 150);
      this._refreshUI();
    }

    _startObservation(force) {
      if (!force && this.state.observationDone) return;
      if (!this.observeOverlayEl) return;
      this._stopObservation();
      this.observeOverlayEl.classList.add("is-active");
      this.observeOverlayEl.setAttribute("aria-hidden", "false");

      const qStep = this.steps.find((s) => s.id === "question");
      if (qStep?.setObserving) qStep.setObserving(true);

      let remaining = 30;
      const countEl = this.observeOverlayEl.querySelector(".observe-count");
      const skipBtn = this.observeOverlayEl.querySelector(".observe-skip");

      const tick = () => {
        if (countEl) countEl.textContent = String(remaining);
        if (remaining <= 0) {
          this._finishObservation();
          return;
        }
        remaining -= 1;
        this.state.observationSeconds = 30 - remaining;
        this._observeTimer = setTimeout(tick, 1000);
      };

      if (skipBtn) {
        skipBtn.onclick = () => this._finishObservation();
      }
      if (countEl) countEl.textContent = "30";
      tick();
    }

    _stopObservation() {
      clearTimeout(this._observeTimer);
    }

    _finishObservation() {
      this._stopObservation();
      this.state.observationDone = true;
      InquiryStorage.save(this.state);
      this.observeOverlayEl?.classList.remove("is-active");
      this.observeOverlayEl?.setAttribute("aria-hidden", "true");
      const qStep = this.steps.find((s) => s.id === "question");
      if (qStep?.setObservationDone) qStep.setObservationDone(true);
      this._refreshUI();
    }

    _setupSimRecording() {
      const sim = global.BrownianSim;
      if (!sim) return;

      const s = sim.getState();
      if (this.state.timeline.length === 0) {
        const now = Date.now();
        if (this._planEnabled("temperature")) {
          this.state.timeline.push({ type: "temperature", from: null, to: s.temperature, at: now });
          this.lastRecorded.temperature = s.temperature;
        }
        if (this._planEnabled("particleSize")) {
          this.state.timeline.push({ type: "particleSize", from: null, to: s.largeRadius, at: now });
          this.lastRecorded.largeRadius = s.largeRadius;
        }
        if (this._planEnabled("particleCount")) {
          this.state.timeline.push({ type: "particleCount", from: null, to: s.particleCount, at: now });
          this.lastRecorded.particleCount = s.particleCount;
        }
        InquiryStorage.save(this.state);
      } else {
        this._migrateTimeline();
        this.state.timeline.forEach((item) => {
          const type = item.type || "temperature";
          if (item.to != null) this.lastRecorded[type === "particleSize" ? "largeRadius" : type === "particleCount" ? "particleCount" : "temperature"] = item.to;
        });
      }

      sim.onStateUpdate((st) => this._onSimUpdate(st));
    }

    _planEnabled(key) {
      const c = this.state.planChecks || {};
      return c[key] !== false && (key === "temperature" ? c.temperature !== false : !!c[key]);
    }

    _migrateTimeline() {
      let changed = false;
      this.state.timeline = (this.state.timeline || []).map((item) => {
        if (item.type) return item;
        changed = true;
        return { type: "temperature", from: item.from, to: item.to, at: item.at };
      });
      if (changed) InquiryStorage.save(this.state);
    }

    _logChange(type, from, to) {
      this.state.timeline.push({ type, from, to, at: Date.now() });
      InquiryStorage.save(this.state);
      const expStep = this.steps.find((s) => s.id === "experiment");
      if (expStep?.renderTimeline) expStep.renderTimeline(this.state.timeline);
      this._refreshUI();
    }

    _onSimUpdate(simState) {
      if (!this.recordingEnabled) return;
      const c = this.state.planChecks || {};

      if (c.temperature !== false && simState.temperature !== this.lastRecorded.temperature) {
        this._logChange("temperature", this.lastRecorded.temperature, simState.temperature);
        this.lastRecorded.temperature = simState.temperature;
      }

      if (c.particleSize && simState.largeRadius !== this.lastRecorded.largeRadius) {
        this._logChange("particleSize", this.lastRecorded.largeRadius, simState.largeRadius);
        this.lastRecorded.largeRadius = simState.largeRadius;
      }

      if (c.particleCount && simState.particleCount !== this.lastRecorded.particleCount) {
        this._logChange("particleCount", this.lastRecorded.particleCount, simState.particleCount);
        this.lastRecorded.particleCount = simState.particleCount;
      }
    }

    _resultKey(r) {
      const n = {
        temperature: r.temperature ?? r.temp ?? 300,
        largeRadius: r.largeRadius ?? 18,
        particleCount: r.particleCount ?? 100,
      };
      return [n.temperature, n.largeRadius, n.particleCount].join("|");
    }

    _tryRecordResult() {
      const sim = global.BrownianSim;
      if (!sim) return;
      if (sim.refreshStats) sim.refreshStats();
      const s = sim.getState();
      const row = {
        temperature: s.temperature,
        avgSpeed: Math.round(s.avgSpeedPxS * 10) / 10,
        largeRadius: s.largeRadius,
        particleCount: s.particleCount,
        largeSpeedPxS: Math.round(s.largeSpeedPxS * 10) / 10,
      };
      if (!Number.isFinite(row.avgSpeed)) return;

      const results = [...(this.state.results || [])];
      const key = this._resultKey(row);
      const idx = results.findIndex((r) => this._resultKey(r) === key);
      if (idx >= 0) {
        results[idx] = { ...results[idx], ...row };
      } else {
        results.push(row);
      }
      this.state.results = results;
      InquiryStorage.save(this.state);

      const resStep = this.steps.find((st) => st.id === "results");
      if (resStep?.updateTableHeaders) resStep.updateTableHeaders(this.state.planChecks);
      if (resStep?.renderTable) resStep.renderTable(results, [key], this.state.planChecks);
      this._refreshUI();
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

      const colors = ["#22d3ee", "#a855f7", "#86efac", "#fde047", "#fb923c"];
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
      const duration = 4000;

      const frame = (now) => {
        const elapsed = now - start;
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        pieces.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.06;
          p.rot += p.vr;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, 1 - elapsed / duration);
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        });
        if (elapsed < duration) {
          this.confettiRAF = requestAnimationFrame(frame);
        } else {
          ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        }
      };
      if (this.confettiRAF) cancelAnimationFrame(this.confettiRAF);
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
      if (!confirm("探究ノートの記録をすべて消して、最初からやり直しますか？\n（問い・仮説・実験データ・考察などが削除されます）")) return;
      this._stopObservation();
      InquiryStorage.clear();
      this.state = InquiryStorage.load();
      this.celebrated = false;
      this.state.summaryCelebrated = false;
      this.lastRecorded = { temperature: null, largeRadius: null, particleCount: null };
      this.noteEl.innerHTML = "";
      this._buildSteps();
      this._bindExperimentActions();
      this._setupSimRecording();
      this.updateExperimentControls();
      this._refreshUI();
      if (this.recordingEnabled) {
        this._scrollToSim();
        setTimeout(() => this._startObservation(true), 300);
      }
    }
  }

  global.InquiryMode = InquiryMode;
})(window);
