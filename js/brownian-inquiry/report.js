/**
 * 探究モード — 実験レポート生成（データ分析付き）& PDF ダウンロード
 */
(function (global) {
  "use strict";

  const HYPOTHESIS_LABELS = {
    stronger: "温度を上げるとブラウン運動は激しくなる",
    same: "温度を上げてもあまり変わらない",
    weaker: "温度を上げるとブラウン運動は弱くなる",
  };

  const TIMELINE_META = {
    temperature: { label: "温度", fmt: (v) => v + " K" },
    particleSize: { label: "粒子サイズ", fmt: (v) => v + " px" },
    particleCount: { label: "粒子数", fmt: (v) => v + " 個" },
  };

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function nl2br(s) {
    return esc(s).replace(/\n/g, "<br>");
  }

  function normalizeResult(r) {
    return {
      temperature: r.temperature ?? r.temp ?? 300,
      avgSpeed: Number(r.avgSpeed ?? 0),
      largeRadius: r.largeRadius ?? 18,
      particleCount: r.particleCount ?? 100,
      largeSpeedPxS: Number(r.largeSpeedPxS ?? 0),
    };
  }

  function planLabels(planChecks) {
    const c = planChecks || {};
    const labels = [];
    if (c.temperature !== false) labels.push("温度");
    if (c.particleSize) labels.push("粒子サイズ");
    if (c.particleCount) labels.push("粒子数");
    return labels.length ? labels.join("、") : "（未選択）";
  }

  function getMissionReportTexts(data) {
    const mission = global.InquiryMissions?.getMission(data.missionId);
    const hyp = global.InquiryMissions?.getHypothesis(data.hypothesisId);
    const plan = global.InquiryMissions?.getPlan(data.planId);
    return {
      missionTitle: mission?.title || data.question || "（未選択）",
      missionDescription: mission?.description || "",
      hypothesisText: hyp?.text || HYPOTHESIS_LABELS[data.hypothesis] || "（未選択）",
      hypothesisReason: hyp?.reason || "",
      hypothesisFree: data.hypothesisFreeText || data.hypothesisReason || "",
      planText: plan?.text || data.planText || "（未記入）",
      planPurpose: plan?.purpose || "",
      planCompare: plan?.compare || "",
    };
  }

  function getPrimaryAxis(planChecks) {
    const c = planChecks || {};
    if (c.temperature !== false) {
      return {
        xKey: "temperature", xLabel: "温度", xUnit: "K",
        yKey: "avgSpeed", yLabel: "分子の平均速度 ⟨v⟩", yUnit: "px/s",
        physics: "温度が高いほど分子の熱運動が激しくなり、平均速度は大きくなる傾向がある（√T に比例するイメージ）。",
      };
    }
    if (c.particleSize) {
      return {
        xKey: "largeRadius", xLabel: "大粒子のサイズ", xUnit: "px",
        yKey: "largeSpeedPxS", yLabel: "大粒子の速度", yUnit: "px/s",
        physics: "大粒子が大きいほど慣性が増し、同じ衝突でも速度の変化が小さくなる。一方で受ける衝突面積も変わる。",
      };
    }
    if (c.particleCount) {
      return {
        xKey: "particleCount", xLabel: "分子数", xUnit: "個",
        yKey: "largeSpeedPxS", yLabel: "大粒子の速度", yUnit: "px/s",
        physics: "分子数が多いほど大粒子への衝突回数が増え、ブラウン運動は不規則だが活発になる傾向がある。",
      };
    }
    return {
      xKey: "temperature", xLabel: "温度", xUnit: "K",
      yKey: "avgSpeed", yLabel: "分子の平均速度 ⟨v⟩", yUnit: "px/s",
      physics: "温度が高いほど分子の熱運動が激しくなる。",
    };
  }

  function resultColumns(planChecks) {
    const c = planChecks || {};
    const cols = [];
    if (c.temperature !== false) cols.push({ key: "temperature", label: "温度 (K)", fmt: (v) => v + " K" });
    if (c.particleSize) cols.push({ key: "largeRadius", label: "粒子サイズ (px)", fmt: (v) => v + " px" });
    if (c.particleCount) cols.push({ key: "particleCount", label: "粒子数 N", fmt: (v) => String(v) });
    cols.push({ key: "avgSpeed", label: "⟨v⟩ 平均速度 (px/s)", fmt: (v) => Number(v).toFixed(1) });
    return cols;
  }

  function formatDate(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString("ja-JP", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso || "";
    }
  }

  function formatTimeline(timeline) {
    if (!timeline || timeline.length === 0) return "<p class=\"report-empty\">記録なし</p>";
    return "<ul class=\"report-list\">" + timeline.map((item) => {
      const type = item.type || "temperature";
      const meta = TIMELINE_META[type] || TIMELINE_META.temperature;
      const toStr = meta.fmt(item.to);
      if (item.from == null) {
        return "<li><strong>" + meta.label + "</strong>：" + toStr + " で開始</li>";
      }
      return "<li><strong>" + meta.label + "</strong>：" + meta.fmt(item.from) + " → " + toStr + "</li>";
    }).join("") + "</ul>";
  }

  function formatResultsTable(results, planChecks) {
    const cols = resultColumns(planChecks);
    const rows = (results || []).map(normalizeResult);
    if (rows.length === 0) return "<p class=\"report-empty\">測定データなし</p>";
    const head = cols.map((c) => "<th>" + c.label + "</th>").join("");
    const body = rows.map((r) => {
      const cells = cols.map((c) => "<td>" + c.fmt(r[c.key]) + "</td>").join("");
      return "<tr>" + cells + "</tr>";
    }).join("");
    return "<table class=\"report-table\"><thead><tr>" + head + "</tr></thead><tbody>" + body + "</tbody></table>";
  }

  function fmtNum(v, digits) {
    if (!Number.isFinite(v)) return "—";
    return Number(v).toFixed(digits ?? 1);
  }

  function fmtPct(ratio) {
    if (!Number.isFinite(ratio)) return "—";
    const sign = ratio > 0 ? "+" : "";
    return sign + Math.round(ratio * 10) / 10 + "%";
  }

  function uniqueBy(rows, key) {
    const seen = new Set();
    return rows.filter((r) => {
      const k = r[key];
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  function analyzeTrend(rows, axis) {
    const sorted = [...rows].sort((a, b) => a[axis.xKey] - b[axis.xKey]);
    const xs = sorted.map((r) => r[axis.xKey]);
    const ys = sorted.map((r) => r[axis.yKey]);

    const xMin = xs[0];
    const xMax = xs[xs.length - 1];
    const yAtMin = ys[0];
    const yAtMax = ys[ys.length - 1];
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    const delta = yAtMax - yAtMin;
    const rel = yAtMin > 0.01 ? (delta / yAtMin) * 100 : 0;

    let trend = "ほぼ変化なし";
    if (rel > 8) trend = "増加";
    else if (rel < -8) trend = "減少";
    else if (rel > 3) trend = "やや増加";
    else if (rel < -3) trend = "やや減少";

    let monotonic = true;
    for (let i = 1; i < ys.length; i += 1) {
      if (ys[i] < ys[i - 1] - 0.5) monotonic = false;
    }

    return {
      sorted, xs, ys, xMin, xMax, yAtMin, yAtMax, yMin, yMax, delta, rel, trend, monotonic,
    };
  }

  function analyzeTemperatureLaw(rows) {
    const byT = uniqueBy(
      [...rows].sort((a, b) => a.temperature - b.temperature),
      "temperature"
    );
    if (byT.length < 2) return null;
    const lo = byT[0];
    const hi = byT[byT.length - 1];
    const vRatio = hi.avgSpeed / Math.max(lo.avgSpeed, 0.01);
    const sqrtTRatio = Math.sqrt(hi.temperature / lo.temperature);
    const diff = Math.abs(vRatio - sqrtTRatio);
    return {
      lo, hi, vRatio, sqrtTRatio,
      roughlySqrt: diff < 0.25,
      comment: diff < 0.25
        ? "速度の比（" + fmtNum(vRatio, 2) + "）は温度比の平方根（" + fmtNum(sqrtTRatio, 2) + "）に近く、√T に比例する関係と整合的です。"
        : "速度は温度とともに変化していますが、厳密な √T 比例とは一部ずれがあります（衝突のランダム性や測定タイミングの影響）。",
    };
  }

  function reviewHypothesis(hypothesis, axis, trend) {
    const h = hypothesis || "";
    if (axis.xKey !== "temperature") {
      return "今回の主な実験条件は「" + axis.xLabel + "」です。仮説は温度に関する予想のため、直接の照合は参考程度に留め、データから読み取れる傾向を優先して考察してください。";
    }
    if (!h) return "仮説が未選択のため、データに基づく傾向（" + trend.trend + "）を中心に考察を深めましょう。";

    const speedUp = trend.rel > 5;
    const speedDown = trend.rel < -5;
    const flat = !speedUp && !speedDown;

    if (h === "stronger") {
      if (speedUp) return "✅ <strong>仮説と一致：</strong>温度を上げると「" + axis.yLabel + "」が増加しました。温度上昇でブラウン運動が激しくなるという予想がデータで支持されました。";
      if (flat) return "⚠️ <strong>部分的：</strong>温度を変えても速度の変化は小さめでした。測定条件の幅を広げるか、観察時間を長くすると傾向がはっきりする可能性があります。";
      return "❌ <strong>仮説と異なる：</strong>温度を上げても速度が増えませんでした。実験条件や測定のタイミングを見直し、なぜかを考察してみましょう。";
    }
    if (h === "weaker") {
      if (speedDown) return "✅ <strong>仮説と一致：</strong>温度を上げると速度が減少しました（このシミュ条件における結果として）。";
      if (speedUp) return "❌ <strong>仮説と異なる：</strong>温度を上げると速度が増加しました。分子の熱運動のイメージと照らし合わせてみましょう。";
      return "⚠️ <strong>部分的：</strong>大きな変化は見られず、「弱くなる」という仮説の検証には温度幅の拡大が必要かもしれません。";
    }
    if (h === "same") {
      if (flat) return "✅ <strong>仮説と一致：</strong>温度を変えても速度は大きく変わりませんでした。";
      if (speedUp) return "❌ <strong>仮説と異なる：</strong>温度を上げると速度が増加しました。熱運動の強さと温度の関係を再考する良い機会です。";
      return "❌ <strong>仮説と異なる：</strong>温度を変えると速度が減少しました。";
    }
    return "";
  }

  function buildDataPointsComment(trend, axis) {
    if (trend.sorted.length === 0) return "";
    return trend.sorted.map((r) => {
      return axis.xLabel + " " + r[axis.xKey] + axis.xUnit + " のとき " + axis.yLabel + " = " + fmtNum(r[axis.yKey]) + " " + axis.yUnit;
    }).join("、") + "。";
  }

  function buildTrendComment(trend, axis) {
    if (trend.sorted.length < 2) {
      return "測定が1点のみのため傾向分析にはデータが不足しています。条件を変えて2点以上測定すると、関係が読み取りやすくなります。";
    }

    const parts = [];
    parts.push(
      axis.xLabel + "を " + trend.xMin + axis.xUnit + " から " + trend.xMax + axis.xUnit +
      " の範囲で変化させたとき、" + axis.yLabel + " は " + fmtNum(trend.yAtMin) + " " + axis.yUnit +
      " から " + fmtNum(trend.yAtMax) + " " + axis.yUnit + " へ変化しました（" + fmtPct(trend.rel) + "）。"
    );
    parts.push("全体の傾向は<strong>「" + trend.trend + "」</strong>です。");

    if (trend.monotonic && trend.sorted.length >= 3) {
      parts.push("各測定点で値が一貫して変化しており、条件と" + axis.yLabel + "の相関が示唆されます。");
    } else if (!trend.monotonic && trend.sorted.length >= 3) {
      parts.push("途中で増減がみられるため、他の条件（温度など）が同時に変わっていないか確認するとよいでしょう。");
    }

    if (axis.xKey === "temperature") {
      const law = analyzeTemperatureLaw(trend.sorted);
      if (law) parts.push(law.comment);
    }

    if (axis.xKey === "particleSize") {
      if (trend.rel > 5) {
        parts.push("大粒子のサイズを変えると観察対象の動き（速度）にも影響が出ています。衝突面積と慣性のバランスを考えてみましょう。");
      } else if (trend.rel < -5) {
        parts.push("サイズを大きくすると大粒子の速度が小さくなる傾向があります。慣性の増加が効いている可能性があります。");
      } else {
        parts.push("分子の平均速度 ⟨v⟩ は大粒子サイズではほとんど変わりません。ブラウン運動の観察には大粒子の速度や軌跡の広がりに注目するとよいです。");
      }
    }

    if (axis.xKey === "particleCount") {
      if (trend.rel > 5) {
        parts.push("分子数を増やすと大粒子への衝突が増え、動きが活発になる傾向が見られます。");
      } else if (trend.rel < -5) {
        parts.push("分子数が減ると衝突が少なくなり、大粒子の動きが穏やかになる可能性があります。");
      } else {
        parts.push("今回の測定範囲では分子数の変化による速度の差は小さめでした。衝突頻度の変化を定性的に観察することも有効です。");
      }
    }

    return parts.join(" ");
  }

  function buildConclusion(analysis, data) {
    const parts = [];
    if (analysis.n < 2) {
      parts.push("今回の探究ではシミュレーションを用いてブラウン運動を調べましたが、測定データが少ないため定量的な結論には至っていません。");
      parts.push("複数の条件で「測定する」を繰り返し、グラフ化すると法則性が見えてきます。");
      return parts.join(" ");
    }

    parts.push("本実験では「" + analysis.axis.xLabel + "」を変えたときの「" + analysis.axis.yLabel + "」を " + analysis.n + " 点測定しました。");
    parts.push("データからは<strong>" + analysis.trend.trend + "</strong>の傾向が読み取れます。");

    if (analysis.axis.xKey === "temperature") {
      parts.push("これは温度が高いほど分子の熱運動が激しくなり、ブラウン運動の土台となる分子衝突が強くなることを示唆しています。");
    }

    if (data.reflection && data.reflection.trim().length >= 10) {
      parts.push("自身の考察（⑦）と合わせると、観察・測定・分析の一連の流れが探究として成立しています。");
    } else {
      parts.push("⑦の考察に、今回の数値と傾向を自分の言葉で書き添えると、探究の完成度がさらに高まります。");
    }

    return parts.join(" ");
  }

  function analyzeData(data) {
    const rows = (data.results || []).map(normalizeResult);
    const axis = getPrimaryAxis(data.planChecks);
    const trend = analyzeTrend(rows, axis);
    const n = rows.length;

    const overview = n === 0
      ? "測定データがありません。シミュレーションで条件を変え、「測定する」ボタンでデータを取得してください。"
      : "全 " + n + " 件の測定について、" + axis.yLabel + " は " + fmtNum(trend.yMin) + "〜" + fmtNum(trend.yMax) + " " + axis.yUnit + " の範囲でした。";

    return {
      n,
      axis,
      trend,
      overview,
      dataPoints: buildDataPointsComment(trend, axis),
      trendComment: buildTrendComment(trend, axis),
      hypothesisReview: reviewHypothesis(data.hypothesis, axis, trend),
      physicsNote: axis.physics,
      conclusion: buildConclusion({ n, axis, trend }, data),
    };
  }

  function formatAnalysisBlocks(analysis) {
    if (!analysis) return [{ html: "<p class=\"report-empty\">分析できませんでした</p>" }];
    const items = [
      '<div class="report-insight"><h3>📊 データ概要</h3><p>' + esc(analysis.overview) + "</p></div>",
    ];
    if (analysis.dataPoints) {
      items.push('<div class="report-insight"><h3>📋 測定値一覧（要約）</h3><p>' + esc(analysis.dataPoints) + "</p></div>");
    }
    items.push(
      '<div class="report-insight"><h3>📈 傾向分析</h3><p>' + analysis.trendComment + "</p></div>",
      '<div class="report-insight"><h3>🔬 物理的な読み取り</h3><p>' + esc(analysis.physicsNote) + "</p></div>",
      '<div class="report-insight report-hypothesis"><h3>💡 仮説との照合</h3><p>' + analysis.hypothesisReview + "</p></div>"
    );
    return items.map((html) => ({ html }));
  }

  const PAGE = {
    widthPx: 794,
    heightPx: 1123,
    paddingPx: 57,
    footerPx: 24,
    widthMm: 210,
    heightMm: 297,
    get contentWidthPx() {
      return this.widthPx - this.paddingPx * 2;
    },
    get contentHeightPx() {
      return this.heightPx - this.paddingPx * 2 - this.footerPx;
    },
  };

  const REPORT_GRAPH = {
    maxWidthPx: 480,
    maxHeightPx: 200,
  };

  function getGraphLogicSize(canvas) {
    const cssW = Math.max(1, canvas.clientWidth || 0);
    const cssH = Math.max(1, canvas.clientHeight || 0);
    if (cssW > 1 && cssH > 1) {
      return { logicW: cssW, logicH: cssH };
    }
    const dpr = canvas.width / Math.max(1, cssW || canvas.width);
    return {
      logicW: Math.max(1, Math.round(canvas.width / dpr)),
      logicH: Math.max(1, Math.round(canvas.height / dpr) || 240),
    };
  }

  function fitGraphSize(natW, natH) {
    const safeW = Math.max(1, natW);
    const safeH = Math.max(1, natH);
    const scale = Math.min(
      REPORT_GRAPH.maxWidthPx / safeW,
      REPORT_GRAPH.maxHeightPx / safeH
    );
    return {
      width: Math.max(1, Math.round(safeW * scale)),
      height: Math.max(1, Math.round(safeH * scale)),
    };
  }

  function formatGraphFigure(size, caption) {
    const w = size?.width || REPORT_GRAPH.maxWidthPx;
    const h = size?.height || REPORT_GRAPH.maxHeightPx;
    return (
      '<figure class="report-figure">' +
      '<div class="report-graph-frame" data-graph-w="' + w + '" data-graph-h="' + h + '" ' +
      'style="width:' + w + "px;height:" + h + 'px">' +
      '<canvas class="report-graph-canvas" width="' + w + '" height="' + h + '" ' +
      'style="display:block;width:' + w + "px;height:" + h + 'px;"></canvas>' +
      "</div>" +
      '<figcaption class="report-figure-caption">' + caption + "</figcaption>" +
      "</figure>"
    );
  }

  function paintGraphCanvases(container) {
    const source = document.getElementById("inquiryGraphCanvas");
    if (!source || !container) return;
    container.querySelectorAll(".report-graph-frame").forEach((frame) => {
      const w = parseInt(frame.getAttribute("data-graph-w"), 10) || REPORT_GRAPH.maxWidthPx;
      const h = parseInt(frame.getAttribute("data-graph-h"), 10) || REPORT_GRAPH.maxHeightPx;
      let canvas = frame.querySelector(".report-graph-canvas");
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.className = "report-graph-canvas";
        frame.replaceChildren(canvas);
      }
      canvas.width = w;
      canvas.height = h;
      canvas.style.display = "block";
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(source, 0, 0, source.width, source.height, 0, 0, w, h);
    });
  }

  let measureInner = null;

  function getMeasureInner() {
    if (measureInner && measureInner.isConnected) return measureInner;
    const root = document.getElementById("inquiryReportMeasureRoot");
    if (root) {
      measureInner = root.querySelector(".measure-inner");
      return measureInner;
    }
    const wrap = document.createElement("div");
    wrap.id = "inquiryReportMeasureRoot";
    wrap.setAttribute("aria-hidden", "true");
    wrap.style.cssText = "position:fixed;left:-20000px;top:0;visibility:hidden;pointer-events:none;z-index:-1;";
    wrap.innerHTML =
      '<div class="measure-inner report-measure-surface" style="width:' +
      PAGE.contentWidthPx + 'px"></div>';
    document.body.appendChild(wrap);
    measureInner = wrap.querySelector(".measure-inner");
    return measureInner;
  }

  function measureBlocksHtml(blocks) {
    const el = getMeasureInner();
    const html = blocks.map((b) => (typeof b === "string" ? b : b.html)).join("");
    el.innerHTML = html;
    return el.scrollHeight;
  }

  function paginateBlocks(blocks) {
    const maxH = PAGE.contentHeightPx;
    const pages = [];
    let current = [];

    blocks.forEach((block) => {
      const trial = current.concat([block]);
      const trialH = measureBlocksHtml(trial);
      const soloH = measureBlocksHtml([block]);

      if (soloH > maxH) {
        if (current.length) {
          pages.push(current);
          current = [];
        }
        pages.push([{ html: block.html, height: soloH }]);
        return;
      }

      if (trialH > maxH && current.length) {
        pages.push(current.map((b) => ({ html: b.html, height: measureBlocksHtml([b]) })));
        current = [block];
        return;
      }

      current.push(block);
    });

    if (current.length) {
      pages.push(current.map((b) => ({ html: b.html, height: measureBlocksHtml([b]) })));
    }
    if (!pages.length) pages.push([]);
    return pages;
  }

  function buildPagedHtml(pages) {
    const total = pages.length;
    return (
      '<div class="inquiry-report-pages">' +
      pages.map((pageBlocks, index) => {
        const inner = pageBlocks.map((b) => b.html).join("");
        return (
          '<section class="inquiry-report-page" data-page="' + (index + 1) + '">' +
          '<div class="inquiry-report-page-content">' + inner + "</div>" +
          '<p class="inquiry-report-page-num">' + (index + 1) + " / " + total + "</p>" +
          "</section>"
        );
      }).join("") +
      "</div>"
    );
  }

  function getHtml2Canvas() {
    return global.html2canvas || null;
  }

  function getJsPDF() {
    if (global.jspdf && global.jspdf.jsPDF) return global.jspdf.jsPDF;
    if (global.jsPDF) return global.jsPDF;
    return null;
  }

  function waitForExportReady(rootEl) {
    const fontReady = document.fonts && document.fonts.ready
      ? document.fonts.ready.catch(() => undefined)
      : Promise.resolve();

    return fontReady.then(() => new Promise((resolve) => {
      const imgs = rootEl.querySelectorAll("img");
      const afterImages = () => {
        requestAnimationFrame(() => setTimeout(resolve, 180));
      };
      if (imgs.length === 0) {
        afterImages();
        return;
      }
      let pending = imgs.length;
      const done = () => {
        pending -= 1;
        if (pending <= 0) afterImages();
      };
      imgs.forEach((img) => {
        if (img.complete) done();
        else {
          img.addEventListener("load", done);
          img.addEventListener("error", done);
        }
      });
      setTimeout(resolve, 4000);
    }));
  }

  function renderPdfFromPages(pageEls) {
    const html2canvas = getHtml2Canvas();
    const JsPDF = getJsPDF();
    if (!html2canvas || !JsPDF) {
      return Promise.reject(new Error("pdf libraries missing"));
    }
    if (!pageEls || !pageEls.length) {
      return Promise.reject(new Error("no report pages"));
    }

    const screenEl = document.getElementById("inquiryReportScreen");
    const scrollEl = screenEl?.querySelector(".report-screen-scroll");
    const prevBackdrop = screenEl?.style.backdropFilter || "";
    const prevBackground = screenEl?.style.background || "";

    if (screenEl) {
      screenEl.style.backdropFilter = "none";
      screenEl.style.background = "#64748b";
    }

    const pdf = new JsPDF({
      unit: "mm",
      format: "a4",
      orientation: "portrait",
      compress: true,
    });

    const pages = Array.from(pageEls);

    const captureAll = (scale) => {
      let chain = Promise.resolve();
      pages.forEach((pageEl, index) => {
        chain = chain.then(() => new Promise((resolve, reject) => {
          if (scrollEl) {
            const top = pageEl.offsetTop - scrollEl.offsetTop - 16;
            scrollEl.scrollTop = Math.max(0, top);
          }
          requestAnimationFrame(() => {
            setTimeout(() => {
              paintGraphCanvases(pageEl);
              html2canvas(pageEl, {
                scale: scale,
                useCORS: true,
                allowTaint: true,
                logging: false,
                backgroundColor: "#ffffff",
                scrollX: 0,
                scrollY: 0,
                onclone: (clonedDoc, node) => {
                  node.style.boxShadow = "none";
                  const liveCanvases = pageEl.querySelectorAll(".report-graph-canvas");
                  const cloneCanvases = node.querySelectorAll(".report-graph-canvas");
                  cloneCanvases.forEach((cloneCanvas, idx) => {
                    const liveCanvas = liveCanvases[idx];
                    if (!liveCanvas || !cloneCanvas.getContext) return;
                    cloneCanvas.width = liveCanvas.width;
                    cloneCanvas.height = liveCanvas.height;
                    cloneCanvas.style.width = liveCanvas.style.width;
                    cloneCanvas.style.height = liveCanvas.style.height;
                    cloneCanvas.style.display = "block";
                    const ctx = cloneCanvas.getContext("2d");
                    if (ctx) {
                      ctx.drawImage(liveCanvas, 0, 0);
                    }
                  });
                },
              }).then((canvas) => {
                resolve(canvas);
              }).catch((err) => {
                reject(err);
              });
            }, 120);
          });
        })).then((canvas) => {
          if (index > 0) pdf.addPage("a4", "portrait");
          const imgData = canvas.toDataURL("image/jpeg", 0.92);
          const pageRatio = PAGE.widthMm / PAGE.heightMm;
          const imgRatio = canvas.width / canvas.height;
          let drawW = PAGE.widthMm;
          let drawH = PAGE.heightMm;
          let offsetX = 0;
          let offsetY = 0;
          if (Math.abs(imgRatio - pageRatio) > 0.01) {
            if (imgRatio > pageRatio) {
              drawH = PAGE.widthMm / imgRatio;
              offsetY = (PAGE.heightMm - drawH) / 2;
            } else {
              drawW = PAGE.heightMm * imgRatio;
              offsetX = (PAGE.widthMm - drawW) / 2;
            }
          }
          pdf.addImage(imgData, "JPEG", offsetX, offsetY, drawW, drawH);
        });
      });
      return chain.then(() => pdf);
    };

    return captureAll(2).catch(() => captureAll(1)).finally(() => {
      if (screenEl) {
        screenEl.style.backdropFilter = prevBackdrop;
        screenEl.style.background = prevBackground;
      }
    });
  }

  const InquiryReport = {
    analyzeData,

    buildBlocks(data, options) {
      const opts = options || {};
      const exportedAt = data.exportedAt || new Date().toISOString();
      const graphSize = opts.graphSize || null;
      const analysis = analyzeData(data);
      const axis = analysis.axis;
      const missionTexts = getMissionReportTexts(data);
      const blocks = [];

      blocks.push({
        html:
          '<header class="report-doc-header">' +
          '<p class="report-doc-badge">PhysLabo 探究学習レポート</p>' +
          "<h1>ブラウン運動の探究</h1>" +
          '<p class="report-doc-meta">作成日時：' + formatDate(exportedAt) + "　|　第12章 熱と比熱</p>" +
          (opts.celebrated ? '<p class="report-doc-celebrate">🎉 探究達成（100%）</p>' : "") +
          "</header>",
      });

      blocks.push({
        html:
          '<section class="report-section"><h2>① 問い（ミッション）</h2>' +
          '<p class="report-line"><strong>' + esc(missionTexts.missionTitle) + "</strong></p>" +
          (missionTexts.missionDescription
            ? '<p class="report-line">' + esc(missionTexts.missionDescription) + "</p>"
            : "") +
          "</section>",
      });

      blocks.push({
        html:
          '<section class="report-section"><h2>② 仮説</h2>' +
          '<p class="report-line"><strong>選択した仮説：</strong>' + esc(missionTexts.hypothesisText) + "</p>" +
          (missionTexts.hypothesisReason
            ? '<p class="report-line"><strong>根拠：</strong>' + esc(missionTexts.hypothesisReason) + "</p>"
            : "") +
          (missionTexts.hypothesisFree
            ? '<div class="report-box"><strong>一言補足</strong><br>' + nl2br(missionTexts.hypothesisFree) + "</div>"
            : "") +
          "</section>",
      });

      blocks.push({
        html:
          '<section class="report-section"><h2>③ 実験計画</h2>' +
          '<p class="report-line"><strong>調べる条件：</strong>' + esc(planLabels(data.planChecks)) + "</p>" +
          '<div class="report-box">' + nl2br(missionTexts.planText) + "</div>" +
          (missionTexts.planCompare
            ? '<p class="report-line"><strong>比較の視点：</strong>' + esc(missionTexts.planCompare) + "</p>"
            : "") +
          (missionTexts.planPurpose
            ? '<p class="report-line"><strong>ねらい：</strong>' + esc(missionTexts.planPurpose) + "</p>"
            : "") +
          "</section>",
      });

      blocks.push({
        html:
          '<section class="report-section"><h2>④ 実験ログ</h2>' +
          formatTimeline(data.timeline) + "</section>",
      });

      blocks.push({
        html:
          '<section class="report-section"><h2>⑤ 実験結果</h2>' +
          formatResultsTable(data.results, data.planChecks) + "</section>",
      });

      blocks.push({
        html:
          '<section class="report-section report-section-analysis"><h2>⑥ データ分析とコメント</h2>' +
          '<p class="report-analysis-lead">取得した ' + analysis.n + ' 件の測定データを自動分析しました（主な変数：<strong>' +
          esc(axis.xLabel) + "</strong> → <strong>" + esc(axis.yLabel) + "</strong>）。</p>" +
          '<div class="report-analysis">' +
          formatAnalysisBlocks(analysis).map((item) => item.html).join("") +
          "</div></section>",
      });

      blocks.push({
        html:
          '<section class="report-section"><h2>⑦ グラフ</h2>' +
          (data.graphCreated && graphSize
            ? formatGraphFigure(
              graphSize,
              "横軸：" + esc(axis.xLabel) + "（" + esc(axis.xUnit) + "）　縦軸：" + esc(axis.yLabel) + "（" + esc(axis.yUnit) + "）"
            ) +
              '<p class="report-graph-note">グラフの傾向は⑥の分析結果（<strong>' + esc(analysis.trend.trend) + "</strong>）と照らし合わせて確認してください。</p>"
            : '<p class="report-empty">' + (data.graphCreated ? "グラフ画像を取得できませんでした" : "グラフ未作成 — ⑥の分析コメントと結果表で傾向を確認できます") + "</p>") +
          "</section>",
      });

      blocks.push({
        html:
          '<section class="report-section"><h2>⑧ 考察</h2>' +
          '<div class="report-insight report-reflection-hint"><h3>【分析からの示唆】</h3><p>' + analysis.trendComment + "</p></div>" +
          '<p class="report-line"><strong>あなたの考察：</strong></p>' +
          '<div class="report-box">' + nl2br(data.reflection || "（未記入）") + "</div></section>",
      });

      blocks.push({
        html:
          '<section class="report-section"><h2>⑨ まとめ</h2>' +
          '<div class="report-box report-conclusion">' + esc(analysis.conclusion) + "</div></section>",
      });

      blocks.push({
        html: '<footer class="report-doc-footer">PhysLabo — ブラウン運動シミュレーション 探究モード（データ自動分析付き）</footer>',
      });

      return blocks;
    },

    buildHtml(data, options) {
      const pages = paginateBlocks(this.buildBlocks(data, options));
      return buildPagedHtml(pages);
    },

    render(container, data, options) {
      if (!container) return;
      const pages = paginateBlocks(this.buildBlocks(data, options));
      container.innerHTML = buildPagedHtml(pages);
      paintGraphCanvases(container);
    },

    getGraphDisplaySize() {
      const canvas = document.getElementById("inquiryGraphCanvas");
      if (!canvas || canvas.width < 2) return null;
      const { logicW, logicH } = getGraphLogicSize(canvas);
      return fitGraphSize(logicW, logicH);
    },

    downloadPdf(reportEl, filename) {
      if (!reportEl) return Promise.reject(new Error("report element missing"));

      const name = filename || "brownian_inquiry_report.pdf";
      const pageEls = reportEl.querySelectorAll(".inquiry-report-page");
      if (!pageEls.length) {
        return Promise.reject(new Error("no paginated report"));
      }

      return waitForExportReady(reportEl)
        .then(() => {
          paintGraphCanvases(reportEl);
          return renderPdfFromPages(pageEls);
        })
        .then((pdf) => {
          pdf.save(name);
        });
    },

    _downloadPdfViaPrint(reportEl) {
      return new Promise((resolve, reject) => {
        const pages = reportEl.querySelectorAll(".inquiry-report-page");
        const pageHtml = pages.length
          ? Array.from(pages).map((page) => page.outerHTML).join("")
          : reportEl.innerHTML;

        const iframe = document.createElement("iframe");
        iframe.setAttribute("title", "探究レポート印刷");
        iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;";
        document.body.appendChild(iframe);

        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) {
          iframe.remove();
          reject(new Error("print iframe unavailable"));
          return;
        }

        const cleanup = () => {
          setTimeout(() => iframe.remove(), 1000);
        };

        doc.open();
        doc.write(
          "<!DOCTYPE html><html lang=\"ja\"><head><meta charset=\"UTF-8\">" +
          "<title>探究レポート（A4）</title>" +
          "<link href=\"https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap\" rel=\"stylesheet\">" +
          "<style>" +
          "@page { size: A4 portrait; margin: 0; }" +
          "html, body { margin: 0; padding: 0; background: #fff; }" +
          "body { font-family: 'Noto Sans JP', sans-serif; color: #111; }" +
          ".inquiry-report-pages { display: block; }" +
          ".inquiry-report-page { width: 210mm; height: 297mm; box-sizing: border-box; padding: 15mm; page-break-after: always; break-after: page; background: #fff; position: relative; overflow: hidden; font-size: 9.5pt; line-height: 1.55; box-shadow: none; }" +
          ".inquiry-report-page:last-child { page-break-after: auto; break-after: auto; }" +
          ".inquiry-report-page-content { height: calc(297mm - 30mm - 8mm); overflow: hidden; }" +
          ".inquiry-report-page-num { position: absolute; bottom: 8mm; left: 0; right: 0; margin: 0; text-align: center; font-size: 9px; color: #94a3b8; }" +
          "table { border-collapse: collapse; width: 100%; font-size: 8.5pt; }" +
          "th, td { border: 1px solid #cbd5e1; padding: 4px 5px; text-align: center; }" +
          "th { background: #f1f5f9; }" +
          "h1 { font-size: 16pt; margin: 0 0 8px; }" +
          "h2 { font-size: 11pt; margin: 10px 0 5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; }" +
          ".report-section { margin-bottom: 8px; }" +
          ".report-box, .report-insight { padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc; margin-bottom: 6px; }" +
          ".report-figure { margin: 8px auto 0; text-align: center; }" +
          ".report-graph-frame { margin: 0 auto; line-height: 0; overflow: hidden; border: 1px solid #e2e8f0; border-radius: 6px; }" +
          ".report-graph-canvas { display: block; margin: 0; }" +
          ".report-figure-caption { margin-top: 6px; font-size: 9px; color: #64748b; line-height: 1.45; }" +
          "</style></head><body><div class=\"inquiry-report-pages\">" + pageHtml +
          "</div></body></html>"
        );
        doc.close();

        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            cleanup();
            resolve();
          } catch (err) {
            iframe.remove();
            reject(err);
          }
        }, 500);
      });
    },
  };

  global.InquiryReport = InquiryReport;
})(window);
