/**
 * 熱平衡探究 — 実験レポート生成 & PDF
 */
(function (global) {
  "use strict";

  const MATERIAL_NAMES = { water: "水", iron: "鉄", aluminum: "アルミ", air: "空気" };

  const TIMELINE_META = global.InquirySteps?.TIMELINE_META || {
    matA: { label: "物体A 物質", fmt: (v) => MATERIAL_NAMES[v] || String(v) },
    matB: { label: "物体B 物質", fmt: (v) => MATERIAL_NAMES[v] || String(v) },
    massA: { label: "質量 mA", fmt: (v) => v + " g" },
    massB: { label: "質量 mB", fmt: (v) => v + " g" },
    tempA: { label: "初期 TA", fmt: (v) => Number(v).toFixed(1) + " ℃" },
    tempB: { label: "初期 TB", fmt: (v) => Number(v).toFixed(1) + " ℃" },
  };

  function esc(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function nl2br(s) {
    return esc(s).replace(/\n/g, "<br>");
  }

  function fmtNum(v, d) {
    if (!Number.isFinite(Number(v))) return "—";
    return Number(v).toFixed(d ?? 1);
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleString("ja-JP", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso || "";
    }
  }

  function formatCompanionBlock(field, text, context, data) {
    const aiKeyMap = { question: "mission", mission: "mission", hypothesisReason: "hypothesis", hypothesis: "hypothesis", planText: "plan", plan: "plan", reflection: "reflection", summaryText: "summary", summary: "summary" };
    const aiKey = aiKeyMap[field] || field;
    const saved = data?.aiComments?.[aiKey];
    const companion = global.InquiryCompanion;
    const mode = data?.companionMode === "expert" ? "expert" : (companion?.getMode?.() || "gentle");
    const comment = saved && String(saved).trim()
      ? saved
      : (companion?.generateComment ? companion.generateComment({ field, text: text || "", mode, context: context || {} }) : "");
    if (!String(comment || "").trim()) return "";
    return (
      '<aside class="report-companion' + (mode === "expert" ? " is-expert" : "") + '">' +
      '<p class="report-companion-head">🤝 伴走AI <span class="report-companion-mode">' + esc(mode === "expert" ? "専門的" : "やさしめ") + "</span></p>" +
      '<p class="report-companion-body">' + nl2br(comment) + "</p></aside>"
    );
  }

  function getMissionReportTexts(data) {
    const mission = global.InquiryMissions?.getMission(data.missionId);
    const hyp = global.InquiryMissions?.getHypothesis(data.hypothesisId);
    const plan = global.InquiryMissions?.getPlan(data.planId);
    return {
      missionTitle: mission?.title || data.question || "（未選択）",
      missionDescription: mission?.description || "",
      hypothesisText: hyp?.text || "（未選択）",
      hypothesisReason: hyp?.reason || "",
      hypothesisFree: data.hypothesisFreeText || data.hypothesisReason || "",
      planText: plan?.text || data.planText || "（未記入）",
      planPurpose: plan?.purpose || "",
      planCompare: plan?.compare || "",
    };
  }

  function getSortedResults(results) {
    if (global.InquiryStorage?.sortResults) return global.InquiryStorage.sortResults(results || []);
    return results || [];
  }

  function planLabels(planChecks) {
    const c = planChecks || {};
    const labels = [];
    if (c.materialPair !== false) labels.push("物質の組 (A/B)");
    if (c.massA) labels.push("質量 mA");
    if (c.massB) labels.push("質量 mB");
    if (c.tempDiff) labels.push("初期温度 TA/TB");
    return labels.length ? labels.join("、") : "（未選択）";
  }

  function formatTimeline(timeline) {
    if (!timeline || timeline.length === 0) return "<p class=\"report-empty\">記録なし</p>";
    return "<ul class=\"report-list\">" + timeline.map((item) => {
      const type = item.type || "matA";
      const meta = TIMELINE_META[type] || TIMELINE_META.matA;
      const toStr = meta.fmt(item.to);
      if (item.from == null) return "<li><strong>" + meta.label + "</strong>：" + toStr + " で開始</li>";
      return "<li><strong>" + meta.label + "</strong>：" + meta.fmt(item.from) + " → " + toStr + "</li>";
    }).join("") + "</ul>";
  }

  function formatPair(matA, matB) {
    return (MATERIAL_NAMES[matA] || matA) + " – " + (MATERIAL_NAMES[matB] || matB);
  }

  function formatContactLogTable(log) {
    const rows = (log || []).map((r, i) => ({ ...r, measureRound: r.measureRound ?? (i + 1) }));
    if (!rows.length) return "";
    const body = rows.map((row) =>
      "<tr>" +
      "<td>" + row.measureRound + "回目</td>" +
      "<td>" + esc(formatPair(row.matA, row.matB)) + "</td>" +
      "<td>" + fmtNum(row.tempAInit) + " / " + fmtNum(row.tempBInit) + " ℃</td>" +
      "<td>" + Math.round(row.Q_loss || 0) + " J</td>" +
      "<td>" + Math.round(row.Q_gain || 0) + " J</td>" +
      "<td>" + fmtNum(row.teqFinal) + " ℃</td>" +
      "</tr>"
    ).join("");
    return (
      '<div class="report-measure-sessions"><h3>接触測定ログ</h3>' +
      '<table class="report-table"><thead><tr><th>回</th><th>A–B</th><th>初期 TA/TB</th><th>Q_loss</th><th>Q_gain</th><th>Teq</th></tr></thead>' +
      "<tbody>" + body + "</tbody></table></div>"
    );
  }

  function formatResultsTable(results, planChecks) {
    const rows = getSortedResults(results);
    if (!rows.length) return "<p class=\"report-empty\">測定データなし</p>";
    const c = planChecks || {};
    let head = "<th>回</th><th>A</th><th>B</th>";
    if (c.massA) head += "<th>mA</th>";
    if (c.massB) head += "<th>mB</th>";
    head += "<th>初期 TA/TB</th><th>ΔTA</th><th>ΔTB</th><th>Q_loss</th><th>Q_gain</th><th>Teq 測定</th><th>Teq 理論</th>";
    const body = rows.map((r) => {
      let cells = "<td>" + r.measureRound + "</td><td>" + esc(MATERIAL_NAMES[r.matA] || r.matA) + "</td><td>" + esc(MATERIAL_NAMES[r.matB] || r.matB) + "</td>";
      if (c.massA) cells += "<td>" + r.massA + " g</td>";
      if (c.massB) cells += "<td>" + r.massB + " g</td>";
      cells +=
        "<td>" + fmtNum(r.tempAInit) + " / " + fmtNum(r.tempBInit) + "</td>" +
        "<td>" + fmtNum(r.deltaTA) + "</td><td>" + fmtNum(r.deltaTB) + "</td>" +
        "<td>" + Math.round(r.Q_loss || 0) + " J</td><td>" + Math.round(r.Q_gain || 0) + " J</td>" +
        "<td>" + fmtNum(r.teqFinal) + " ℃</td><td>" + fmtNum(r.teqTheory) + " ℃</td>";
      return "<tr>" + cells + "</tr>";
    }).join("");
    return "<table class=\"report-table\"><thead><tr>" + head + "</tr></thead><tbody>" + body + "</tbody></table>";
  }

  function analyzeData(data) {
    const rows = getSortedResults(data.results);
    const n = rows.length;

    if (n === 0) {
      return {
        n: 0,
        overview: "まだ接触測定データがありません。",
        trendComment: "シミュレーションで物体 A・B を設定し「接触測定」を押すと、ここに分析結果が表示されます。",
        hypothesisReview: "仮説が選ばれていれば、測定後に Q_loss = Q_gain や Teq を表と照らし合わせてください。",
        physicsNote: "熱量保存の法則：接触中、物体 A が失う熱量 Q_loss と物体 B が得る熱量 Q_gain は等しくなります。平衡温度 Teq = (mA cA TA + mB cB TB) / (mA cA + mB cB)。",
        conclusion: "条件を変えて 2 回以上接触測定すると、規則性が見えてきます。",
      };
    }

    const qMatches = rows.filter((r) => Math.abs((r.Q_loss || 0) - (r.Q_gain || 0)) < 1);
    const teqDiffs = rows.map((r) => Math.abs((r.teqFinal || 0) - (r.teqTheory || 0)));
    const avgTeqErr = teqDiffs.reduce((a, b) => a + b, 0) / teqDiffs.length;
    const teqMin = Math.min(...rows.map((r) => r.teqFinal));
    const teqMax = Math.max(...rows.map((r) => r.teqFinal));

    const parts = [];
    parts.push(n + " 回の接触測定を行いました。");
    parts.push(qMatches.length + " / " + n + " 回で Q_loss ≈ Q_gain（差 1J 未満）でした。");
    parts.push("Teq（測定）は " + fmtNum(teqMin) + " 〜 " + fmtNum(teqMax) + " ℃ の範囲でした。");
    if (avgTeqErr < 2) {
      parts.push("理論 Teq との平均差は " + fmtNum(avgTeqErr) + " ℃ と、式 Teq = (mA cA TA + mB cB TB)/(mA cA + mB cB) とよく一致しています。");
    } else {
      parts.push("理論 Teq との差は平均 " + fmtNum(avgTeqErr) + " ℃ でした。条件をそろえて再測定すると比較しやすくなります。");
    }

    const trendParts = rows.map((r) =>
      r.measureRound + "回目（" + formatPair(r.matA, r.matB) + "）：Q_loss=" + Math.round(r.Q_loss) + "J、Teq=" + fmtNum(r.teqFinal) + "℃"
    );

    let hypReview = "表の Q_loss と Q_gain、Teq 列を見ながら、②の仮説と照らし合わせてみましょう。";
    const h = data.hypothesis || "";
    if (h === "q_equal" && qMatches.length === n) {
      hypReview = "✅ <strong>仮説どおり：</strong>すべての測定で Q_loss ≈ Q_gain でした。";
    } else if (h === "q_equal" && qMatches.length < n) {
      hypReview = "⚠️ 一部の測定で Q_loss と Q_gain に差がありました。温度差 0℃ のケースなど条件を確認してみましょう。";
    } else if (h === "teq_match" && avgTeqErr < 2) {
      hypReview = "✅ <strong>仮説どおり：</strong>測定 Teq と理論 Teq がよく一致しました。";
    } else if (h === "teq_between") {
      const ok = rows.every((r) => {
        const lo = Math.min(r.tempAInit, r.tempBInit);
        const hi = Math.max(r.tempAInit, r.tempBInit);
        return r.teqFinal >= lo - 0.5 && r.teqFinal <= hi + 0.5;
      });
      hypReview = ok
        ? "✅ <strong>仮説どおり：</strong>Teq は初期 TA と TB の間にありました。"
        : "⚠️ Teq が初期温度の範囲外になった行があります。データを確認してみましょう。";
    }

    return {
      n,
      overview: parts[0] + " " + parts[1],
      trendComment: trendParts.join("。") + "。",
      hypothesisReview: hypReview,
      physicsNote: "接触中、高温側から低温側へ熱が移り Q_loss = Q_gain が成り立ちます。平衡では TA = TB = Teq となり、Teq は各物体の熱容量 mc で重み付け平均されます。",
      conclusion: parts.join(" ") + (data.reflection?.trim().length >= 10 ? " ⑧の考察と合わせて、観察→測定→分析の流れができています。" : ""),
    };
  }

  function formatAnalysisBlocks(analysis) {
    return [
      { html: '<div class="report-insight"><h3>📊 測定結果のまとめ</h3><p>' + esc(analysis.overview) + "</p></div>" },
      { html: '<div class="report-insight"><h3>📈 表・グラフから読み取れること</h3><p>' + analysis.trendComment + "</p></div>" },
      { html: '<div class="report-insight"><h3>🔬 理科の考え方</h3><p>' + esc(analysis.physicsNote) + "</p></div>" },
      { html: '<div class="report-insight report-hypothesis"><h3>💡 仮説は当たった？</h3><p>' + analysis.hypothesisReview + "</p></div>" },
    ];
  }

  const PAGE = {
    widthPx: 794,
    heightPx: 1123,
    paddingPx: 57,
    footerPx: 24,
    widthMm: 210,
    heightMm: 297,
    get contentWidthPx() { return this.widthPx - this.paddingPx * 2; },
    get contentHeightPx() { return this.heightPx - this.paddingPx * 2 - this.footerPx; },
  };

  const REPORT_GRAPH = { maxWidthPx: 480, maxHeightPx: 240 };

  function reportGraphSize() {
    return { width: Math.max(240, Math.floor(PAGE.contentWidthPx / 2) - 6), height: 228 };
  }

  function formatGraphFigure(size, caption, seriesKey) {
    const w = size?.width || REPORT_GRAPH.maxWidthPx;
    const h = size?.height || REPORT_GRAPH.maxHeightPx;
    return (
      '<figure class="report-figure">' +
      '<div class="report-graph-frame" data-graph-series="' + esc(seriesKey) + '" data-graph-w="' + w + '" data-graph-h="' + h + '" ' +
      'style="width:' + w + "px;height:" + h + 'px">' +
      '<canvas class="report-graph-canvas" width="' + w + '" height="' + h + '" style="display:block;width:' + w + "px;height:" + h + 'px;"></canvas>' +
      '</div><figcaption class="report-figure-caption">' + caption + '</figcaption></figure>'
    );
  }

  function buildReportGraphSectionHtml(data) {
    const size = reportGraphSize();
    const targets = global.InquirySteps?.getGraphTargets?.(data) || Object.keys(data.ttCurves || {});
    const created = data.graphsCreated || {};
    if (!targets.length) return '<p class="report-empty">グラフ対象の接触データがありません</p>';

    let html = '<div class="report-graph-row">' + targets.map((measureId, i) => {
      const label = global.InquirySteps?.getSessionLabel?.(data, measureId) || ("測定" + (i + 1));
      const caption = "グラフ" + (i + 1) + "：" + label + "（T–t · 橙=A · 青=B）";
      if (created[measureId]) return formatGraphFigure(size, caption, measureId);
      return '<p class="report-empty">グラフ' + (i + 1) + " 未作成</p>";
    }).join("") + "</div>";

    const customGraphs = data.customGraphs || [];
    if (customGraphs.length) {
      html += '<h3 class="report-subsection-title">追加グラフ</h3><div class="report-graph-row">';
      customGraphs.forEach((g, i) => {
        html += formatGraphFigure(size, "追加" + (i + 1) + "：" + (global.InquirySteps?.getCustomGraphCaption?.(g) || ""), "custom:" + g.id);
      });
      html += "</div>";
    }
    return html;
  }

  function ensureWhiteReportCanvas(canvas, w, h) {
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    return ctx;
  }

  function drawReportGraphPlaceholder(canvas, w, h, message) {
    const ctx = ensureWhiteReportCanvas(canvas, w, h);
    if (!ctx) return;
    ctx.fillStyle = "#64748b";
    ctx.font = "11px Inter, Noto Sans JP, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(message || "グラフデータがありません", w / 2, h / 2);
  }

  function paintGraphCanvases(container, data) {
    if (!container) return;
    const reportData = container._inquiryReportData || data;
    const drawTT = global.InquirySteps?.drawReportTTGraph;
    const drawCustom = global.InquirySteps?.drawCustomDataGraph;

    container.querySelectorAll(".report-graph-frame").forEach((frame) => {
      const w = parseInt(frame.getAttribute("data-graph-w"), 10) || REPORT_GRAPH.maxWidthPx;
      const h = parseInt(frame.getAttribute("data-graph-h"), 10) || REPORT_GRAPH.maxHeightPx;
      const seriesKey = frame.getAttribute("data-graph-series");
      if (!seriesKey) return;
      let canvas = frame.querySelector(".report-graph-canvas");
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.className = "report-graph-canvas";
        frame.replaceChildren(canvas);
      }
      ensureWhiteReportCanvas(canvas, w, h);

      if (seriesKey.startsWith("custom:")) {
        const graphDef = (reportData?.customGraphs || []).find((g) => g.id === seriesKey.slice(7));
        if (graphDef && drawCustom) {
          try {
            drawCustom(canvas, reportData, graphDef, { reportMode: true, width: w, height: h });
          } catch {
            drawReportGraphPlaceholder(canvas, w, h, "追加グラフを描画できません");
          }
        } else {
          drawReportGraphPlaceholder(canvas, w, h, "追加グラフデータがありません");
        }
        return;
      }

      const curve = reportData?.ttCurves?.[seriesKey];
      const row = getSortedResults(reportData?.results).find((r) => String(r.measureId) === String(seriesKey));
      if (!drawTT || !curve) {
        drawReportGraphPlaceholder(canvas, w, h, "T–t データがありません");
        return;
      }
      try {
        drawTT(canvas, w, h, curve, {
          matAName: MATERIAL_NAMES[row?.matA] || "物体A",
          matBName: MATERIAL_NAMES[row?.matB] || "物体B",
        });
      } catch {
        drawReportGraphPlaceholder(canvas, w, h, "グラフを描画できません");
      }
    });
  }

  let measureInner = null;

  function getMeasureInner() {
    if (measureInner && measureInner.isConnected) return measureInner;
    const wrap = document.createElement("div");
    wrap.id = "inquiryReportMeasureRoot";
    wrap.setAttribute("aria-hidden", "true");
    wrap.style.cssText = "position:fixed;left:-20000px;top:0;visibility:hidden;pointer-events:none;z-index:-1;";
    wrap.innerHTML = '<div class="measure-inner report-measure-surface" style="width:' + PAGE.contentWidthPx + 'px"></div>';
    document.body.appendChild(wrap);
    measureInner = wrap.querySelector(".measure-inner");
    return measureInner;
  }

  function measureHtmlHeight(html) {
    const el = getMeasureInner();
    el.innerHTML = html;
    return el.scrollHeight;
  }

  function paginateBlocks(blocks) {
    const pages = [];
    let current = [];
    let currentH = 0;

    blocks.forEach((block) => {
      const html = typeof block === "string" ? block : block.html;
      const h = measureHtmlHeight([...current, block].map((b) => (typeof b === "string" ? b : b.html)).join(""));
      if (current.length && h > PAGE.contentHeightPx) {
        pages.push(current);
        current = [block];
        currentH = measureHtmlHeight(html);
      } else {
        current.push(block);
        currentH = h;
      }
    });
    if (current.length) pages.push(current);
    return pages;
  }

  function buildPagedHtml(pages) {
    return '<div class="inquiry-report-pages">' + pages.map((blocks, i) =>
      '<article class="inquiry-report-page">' +
      '<div class="inquiry-report-page-content">' + blocks.map((b) => (typeof b === "string" ? b : b.html)).join("") + "</div>" +
      '<p class="inquiry-report-page-num">' + (i + 1) + " / " + pages.length + "</p></article>"
    ).join("") + "</div>";
  }

  function getHtml2Canvas() {
    return global.html2canvas || null;
  }

  function getJsPDF() {
    if (global.jspdf?.jsPDF) return global.jspdf.jsPDF;
    if (global.jsPDF) return global.jsPDF;
    return null;
  }

  function renderPdfFromPages(pageEls, reportData) {
    const html2canvas = getHtml2Canvas();
    const JsPDF = getJsPDF();
    if (!html2canvas || !JsPDF || !pageEls?.length) {
      return Promise.reject(new Error("pdf libraries or pages missing"));
    }
    const pdf = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
    const pages = Array.from(pageEls);
    let chain = Promise.resolve();
    pages.forEach((pageEl, index) => {
      chain = chain.then(() => new Promise((resolve, reject) => {
        requestAnimationFrame(() => {
          setTimeout(() => {
            paintGraphCanvases(pageEl, reportData);
            html2canvas(pageEl, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false })
              .then(resolve).catch(reject);
          }, 120);
        });
      })).then((canvas) => {
        if (index > 0) pdf.addPage("a4", "portrait");
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, PAGE.widthMm, PAGE.heightMm);
      });
    });
    return chain.then(() => pdf);
  }

  const InquiryReport = {
    analyzeData,

    buildBlocks(data, options) {
      const opts = options || {};
      const exportedAt = data.exportedAt || new Date().toISOString();
      const analysis = analyzeData(data);
      const missionTexts = getMissionReportTexts(data);
      const blocks = [];

      blocks.push({
        html:
          '<header class="report-doc-header">' +
          '<p class="report-doc-badge">PhysLabo 探究学習レポート</p>' +
          "<h1>熱量保存と熱平衡</h1>" +
          '<p class="report-doc-meta">作成日時：' + formatDate(exportedAt) + "　|　Q_loss = Q_gain · Teq</p>" +
          (opts.celebrated ? '<p class="report-doc-celebrate">🎉 探究達成（100%）</p>' : "") +
          "</header>",
      });

      blocks.push({
        html:
          '<section class="report-section"><h2>① 問い（ミッション）</h2>' +
          '<p class="report-line"><strong>' + esc(missionTexts.missionTitle) + "</strong></p>" +
          (missionTexts.missionDescription ? '<div class="report-box">' + nl2br(missionTexts.missionDescription) + "</div>" : "") +
          formatCompanionBlock("mission", missionTexts.missionTitle + " " + missionTexts.missionDescription, { missionId: data.missionId }, data) +
          "</section>",
      });

      blocks.push({
        html:
          '<section class="report-section"><h2>② 仮説</h2>' +
          '<p class="report-line"><strong>選択した仮説：</strong>' + esc(missionTexts.hypothesisText) + "</p>" +
          (missionTexts.hypothesisReason ? '<p class="report-line"><strong>根拠：</strong>' + esc(missionTexts.hypothesisReason) + "</p>" : "") +
          (missionTexts.hypothesisFree ? '<div class="report-box">' + nl2br(missionTexts.hypothesisFree) + "</div>" : "") +
          formatCompanionBlock("hypothesis", missionTexts.hypothesisText, { hypothesisLabel: missionTexts.hypothesisText }, data) +
          "</section>",
      });

      blocks.push({
        html:
          '<section class="report-section"><h2>③ 実験計画</h2>' +
          '<p class="report-line"><strong>調べる条件：</strong>' + esc(planLabels(data.planChecks)) + "</p>" +
          '<div class="report-box">' + nl2br(missionTexts.planText) + "</div>" +
          formatCompanionBlock("plan", missionTexts.planText, null, data) +
          "</section>",
      });

      blocks.push({
        html: '<section class="report-section"><h2>④ 実験ログ</h2>' + formatTimeline(data.timeline) + "</section>",
      });

      const logTable = formatContactLogTable(data.contactMeasureLog);
      if (logTable) {
        blocks.push({ html: '<section class="report-section report-section-continue">' + logTable + "</section>" });
      }

      blocks.push({
        html:
          '<section class="report-section"><h2>⑤ 実験結果</h2>' +
          formatResultsTable(data.results, data.planChecks) +
          "</section>",
      });

      blocks.push({
        html:
          '<section class="report-section report-section-analysis"><h2>⑥ データ分析</h2>' +
          '<div class="report-analysis">' + formatAnalysisBlocks(analysis).map((x) => x.html).join("") + "</div></section>",
      });

      blocks.push({
        html: '<section class="report-section"><h2>⑦ グラフ</h2>' + buildReportGraphSectionHtml(data) + "</section>",
      });

      blocks.push({
        html:
          '<section class="report-section"><h2>⑧ 考察</h2>' +
          '<div class="report-insight"><h3>【データから言えること】</h3><p>' + analysis.trendComment + "</p></div>" +
          '<div class="report-box">' + nl2br(data.reflection || "（未記入）") + "</div>" +
          formatCompanionBlock("reflection", data.reflection, { resultCount: analysis.n }, data) +
          "</section>",
      });

      blocks.push({
        html:
          '<section class="report-section"><h2>⑨ まとめ</h2>' +
          '<div class="report-box">' + nl2br(data.summaryText || "（未記入）") + "</div>" +
          formatCompanionBlock("summaryText", data.summaryText, null, data) +
          '<div class="report-insight report-conclusion-insight"><h3>今回の探究のまとめ</h3><p>' + esc(analysis.conclusion) + "</p></div>" +
          "</section>",
      });

      blocks.push({
        html: '<footer class="report-doc-footer">PhysLabo — 熱量保存と熱平衡 探究モード（データ自動分析付き）</footer>',
      });

      return blocks;
    },

    render(container, data, options) {
      if (!container) return;
      container._inquiryReportData = data;
      try {
        const pages = paginateBlocks(this.buildBlocks(data, options));
        container.innerHTML = buildPagedHtml(pages);
        paintGraphCanvases(container, data);
      } catch (err) {
        console.error("[探究レポート]", err);
        container.innerHTML = '<div class="report-render-error"><h2>レポートの生成に失敗しました</h2><p>' + esc(String(err?.message || err)) + "</p></div>";
      }
    },

    downloadPdf(reportEl, filename) {
      if (!reportEl) return Promise.reject(new Error("report element missing"));
      const name = filename || "heat_equilibrium_inquiry_report.pdf";
      const pageEls = reportEl.querySelectorAll(".inquiry-report-page");
      if (!pageEls.length) return Promise.reject(new Error("no paginated report"));
      return renderPdfFromPages(pageEls, reportEl._inquiryReportData).then((pdf) => pdf.save(name));
    },

    _downloadPdfViaPrint(reportEl) {
      return new Promise((resolve, reject) => {
        paintGraphCanvases(reportEl, reportEl._inquiryReportData);
        const iframe = document.createElement("iframe");
        iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;";
        document.body.appendChild(iframe);
        const doc = iframe.contentDocument;
        if (!doc) { iframe.remove(); reject(new Error("print iframe unavailable")); return; }
        const pageHtml = Array.from(reportEl.querySelectorAll(".inquiry-report-page")).map((p) => p.outerHTML).join("");
        doc.open();
        doc.write("<!DOCTYPE html><html lang=\"ja\"><head><meta charset=\"UTF-8\"><title>探究レポート</title></head><body>" + pageHtml + "</body></html>");
        doc.close();
        setTimeout(() => {
          try { iframe.contentWindow.print(); resolve(); } catch (e) { reject(e); }
          finally { setTimeout(() => iframe.remove(), 1000); }
        }, 500);
      });
    },
  };

  global.InquiryReport = InquiryReport;
})(window);
