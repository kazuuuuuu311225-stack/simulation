/**
 * 探究モード — 実験レポート生成（データ分析付き）& PDF ダウンロード
 */
(function (global) {
  "use strict";

  const MATERIAL_NAMES = { water: "水", iron: "鉄", aluminum: "アルミ", air: "空気" };

  const HYPOTHESIS_LABELS = {
    water_faster: "水のほうがΔTは大きい（温まりやすい）",
    iron_faster: "鉄の方がΔTは大きい（温まりやすい）",
    same_if_mass: "質量が同じなら物質に関係なくΔTは同じ",
  };

  const TIMELINE_META = {
    material: { label: "物質", fmt: (v) => MATERIAL_NAMES[v] || String(v) },
    mass: { label: "質量", fmt: (v) => v + " g" },
    heatQ: { label: "加熱量 Q", fmt: (v) => v + " J" },
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

  function formatCompanionBlock(field, text, context, data) {
    const aiKeyMap = {
      question: "mission",
      mission: "mission",
      hypothesisReason: "hypothesis",
      hypothesis: "hypothesis",
      planText: "plan",
      plan: "plan",
      reflection: "reflection",
      summaryText: "summary",
      summary: "summary",
    };
    const aiKey = aiKeyMap[field] || field;
    const saved = data?.aiComments?.[aiKey];
    const companion = global.InquiryCompanion;
    const mode = data?.companionMode === "expert" ? "expert" : (companion?.getMode?.() || "gentle");
    const modeLabel = mode === "expert" ? "専門的" : "やさしめ";
    const comment = saved && String(saved).trim()
      ? saved
      : (companion?.generateComment
        ? companion.generateComment({ field, text: text || "", mode, context: context || {} })
        : "");
    if (!String(comment || "").trim()) return "";
    return (
      '<aside class="report-companion' + (mode === "expert" ? " is-expert" : "") + '">' +
      '<p class="report-companion-head">🤝 伴走AI <span class="report-companion-mode">' + esc(modeLabel) + "</span></p>" +
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
      hypothesisText: hyp?.text || HYPOTHESIS_LABELS[data.hypothesis] || "（未選択）",
      hypothesisReason: hyp?.reason || "",
      hypothesisFree: data.hypothesisFreeText || data.hypothesisReason || "",
      planText: plan?.text || data.planText || "（未記入）",
      planPurpose: plan?.purpose || "",
      planCompare: plan?.compare || "",
    };
  }

  function normalizeResult(r) {
    if (global.InquiryStorage?.migrateResult) return global.InquiryStorage.migrateResult(r);
    return {
      materialKey: r.materialKey ?? "water",
      materialName: r.materialName ?? MATERIAL_NAMES[r.materialKey] ?? "水",
      mass: r.mass ?? 500,
      heatQ: r.heatQ ?? 2000,
      initialCelsius: Number(r.initialCelsius ?? 0),
      finalCelsius: Number(r.finalCelsius ?? 0),
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

  function planLabels(planChecks) {
    const c = planChecks || {};
    const labels = [];
    if (c.material !== false) labels.push("物質");
    if (c.mass) labels.push("質量");
    if (c.heatQ) labels.push("加熱量 Q");
    return labels.length ? labels.join("、") : "（未選択）";
  }

  const INTERVAL_SORT = ["固体", "固体→液体", "液体", "液体→気体", "気体"];

  function canonicalInterval(raw) {
    if (global.InquiryStorage?.canonicalInterval) return global.InquiryStorage.canonicalInterval(raw);
    const s = String(raw ?? "").trim();
    return !s || s === "—" ? "—" : s;
  }

  function inferIntervalFromRow(r) {
    const raw = canonicalInterval(r.interval ?? r.phase);
    const plateau = !!r.isPlateau || String(r.segmentType || "") === "latent"
      || (raw.includes("→") && Math.abs(Number(r.deltaT)) < 0.05);
    if (plateau) {
      const t = Number(r.initialCelsius ?? r.finalCelsius ?? 0);
      if (isWaterRow(r)) {
        if (Math.abs(t) < 5) return "固体→液体";
        if (Math.abs(t - 100) < 5) return "液体→気体";
      }
      if (raw.includes("→")) return raw;
      return "固体→液体";
    }
    if (isWaterRow(r)) {
      const t = Number(r.initialCelsius ?? r.finalCelsius ?? 0);
      if (t < 0) return "固体";
      if (t < 100) return "液体";
      return "気体";
    }
    return "—";
  }

  function resolveInterval(r) {
    const iv = canonicalInterval(r.interval ?? r.phase);
    return iv && iv !== "—" ? iv : inferIntervalFromRow(r);
  }

  function isPlateauRow(r) {
    if (!!r.isPlateau) return true;
    const raw = canonicalInterval(r.interval ?? r.phase);
    if (raw.includes("→") && Math.abs(Number(r.deltaT)) < 0.05) return true;
    if (String(r.segmentType || "") === "latent" && Math.abs(Number(r.deltaT)) < 0.05) return true;
    return false;
  }

  function shouldUseIntervalAxis(rows) {
    if (!rows || rows.length < 2) return false;
    const phaseKeys = new Set(rows.map((r) => resolveInterval(r)).filter((v) => v && v !== "—"));
    if (phaseKeys.size >= 2) return true;
    const materials = uniqueRowValues(rows, "materialKey");
    if (materials.length === 1 && rows.some(isPlateauRow) && rows.some((r) => !isPlateauRow(r))) return true;
    return false;
  }

  function buildIntervalAxis(materials) {
    const onlyWater = materials.length === 1 && materials[0] === "water";
    return {
      xKey: "interval", xLabel: "区間・状態", xUnit: "",
      yKey: "deltaT", yLabel: "温度上昇 ΔT", yUnit: "℃",
      physics: onlyWater
        ? "水を加熱すると、氷（固体）→融解→液体→沸騰→水蒸気（気体）と状態が変わります。融解・沸騰のあいだは温度が一定（ΔT=0）で、潜熱が使われます。"
        : "加熱すると固体→液体→気体と状態が変わることがあります。状態が変わるあいだは温度が一定（ΔT=0）になることがあります。",
      categorical: true,
      sortOrder: INTERVAL_SORT,
      compositeLabel: true,
    };
  }

  function uniqueRowValues(rows, key) {
    return [...new Set((rows || []).map((r) => r[key]).filter((v) => v != null && v !== "" && v !== "—"))];
  }

  function pickAnalysisAxis(rows, planChecks) {
    const c = planChecks || {};
    if (c.mass) {
      return {
        xKey: "mass", xLabel: "質量 m", xUnit: "g",
        yKey: "deltaT", yLabel: "温度上昇 ΔT", yUnit: "℃",
        physics: "質量が大きいほど、物体全体の「熱をためる力」（熱容量）が大きくなります。だから同じ熱量を加えても、温度の上がり（ΔT）は小さくなりやすいです。",
      };
    }
    if (c.heatQ) {
      return {
        xKey: "heatQ", xLabel: "加熱量 Q", xUnit: "J",
        yKey: "deltaT", yLabel: "温度上昇 ΔT", yUnit: "℃",
        physics: "加える熱量 Q が大きいほど、温度の上がり ΔT も大きくなります（融解・沸騰で温度が止まる区間を除く）。",
      };
    }

    const materials = uniqueRowValues(rows, "materialKey");

    if (shouldUseIntervalAxis(rows)) {
      return buildIntervalAxis(materials);
    }

    if (c.material !== false && materials.length >= 2) {
      return {
        xKey: "materialKey", xLabel: "物質", xUnit: "",
        yKey: "deltaT", yLabel: "温度上昇 ΔT", yUnit: "℃",
        physics: "同じ熱量を加えても、物質によって温度の上がり方（ΔT）が違います。比熱が大きい物質ほど、温度は上がりにくくなります（Q = mcΔT）。",
        categorical: true,
        sortOrder: ["water", "iron", "aluminum", "air"],
      };
    }

    return getPrimaryAxis(planChecks);
  }

  function getPrimaryAxis(planChecks) {
    const c = planChecks || {};
    if (c.material !== false) {
      return {
        xKey: "materialKey", xLabel: "物質", xUnit: "",
        yKey: "deltaT", yLabel: "温度上昇 ΔT", yUnit: "℃",
        physics: "同じ熱量を加えても、物質によって温度の上がり方（ΔT）が違います。比熱が大きい物質ほど、温度は上がりにくくなります（Q = mcΔT）。",
        categorical: true,
        sortOrder: ["water", "iron", "aluminum", "air"],
      };
    }
    if (c.mass) {
      return {
        xKey: "mass", xLabel: "質量 m", xUnit: "g",
        yKey: "deltaT", yLabel: "温度上昇 ΔT", yUnit: "℃",
        physics: "質量が大きいほど、物体全体の「熱をためる力」（熱容量）が大きくなります。だから同じ熱量を加えても、温度の上がり（ΔT）は小さくなりやすいです。",
      };
    }
    if (c.heatQ) {
      return {
        xKey: "heatQ", xLabel: "加熱量 Q", xUnit: "J",
        yKey: "deltaT", yLabel: "温度上昇 ΔT", yUnit: "℃",
        physics: "加える熱量 Q が大きいほど、温度の上がり ΔT も大きくなります（融解・沸騰で温度が止まる区間を除く）。",
      };
    }
    return {
      xKey: "materialKey", xLabel: "物質", xUnit: "",
      yKey: "deltaT", yLabel: "温度上昇 ΔT", yUnit: "℃",
      physics: "式 Q = mcΔT より、比熱の違いが「同じ熱量でも温度の上がり方が違う」原因になります。",
      categorical: true,
      sortOrder: ["water", "iron", "aluminum", "air"],
    };
  }

  function resultColumns(planChecks) {
    const c = planChecks || {};
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
    cols.push({ key: "deltaT", label: "ΔT (℃)", fmt: (v, r) => {
      const row = r || {};
      const dt = Number(row.deltaT ?? v ?? 0);
      if (row.isPlateau && Math.abs(dt) < 0.05) return "0（平台）";
      const sign = dt > 0 ? "+" : "";
      return sign + dt.toFixed(1) + " ℃";
    }});
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
      const type = item.type || "material";
      const meta = TIMELINE_META[type] || TIMELINE_META.material;
      const toStr = meta.fmt(item.to);
      if (item.from == null) {
        return "<li><strong>" + meta.label + "</strong>：" + toStr + " で開始</li>";
      }
      return "<li><strong>" + meta.label + "</strong>：" + meta.fmt(item.from) + " → " + toStr + "</li>";
    }).join("") + "</ul>";
  }

  function formatSessionDeltaTReport(row) {
    const dt = Number(row?.sessionDeltaT ?? NaN);
    if (!Number.isFinite(dt)) return "—";
    if (Math.abs(dt) < 0.05) return "0 ℃";
    return (dt > 0 ? "+" : "") + fmtNum(dt, 1) + " ℃";
  }

  function formatMeasureSessionTable(log) {
    const rows = (log || []).map((row, i) => ({
      ...row,
      measureRound: row.measureRound ?? (i + 1),
      sessionEndCelsius: row.sessionEndCelsius ?? row.tempC ?? null,
    }));
    if (!rows.length) return "";
    const body = rows.map((row) =>
      "<tr>" +
      "<td>" + row.measureRound + "回目</td>" +
      "<td>" + esc(row.materialName || MATERIAL_NAMES[row.materialKey] || row.materialKey || "—") + "</td>" +
      "<td>" + Math.round(row.heatQ || 0) + " J</td>" +
      "<td>" + fmtNum(row.sessionStartCelsius, 1) + " ℃</td>" +
      "<td>" + fmtNum(row.sessionEndCelsius, 1) + " ℃</td>" +
      "<td>" + formatSessionDeltaTReport(row) + "</td>" +
      "</tr>"
    ).join("");
    return (
      '<div class="report-measure-sessions" style="margin-bottom:14px">' +
      "<h3>測定回ごとの記録</h3>" +
      '<table class="report-table report-measure-session-table">' +
      "<thead><tr><th>測定回</th><th>物質</th><th>加熱量 Q</th><th>加熱前 T</th><th>加熱後 T</th><th>その回の ΔT</th></tr></thead>" +
      "<tbody>" + body + "</tbody></table></div>"
    );
  }

  function formatHeatMeasureLog(log) {
    return formatMeasureSessionTable(log);
  }

  function formatResultsTable(results, planChecks) {
    const cols = resultColumns(planChecks);
    const rows = getMergedResults(results);
    if (rows.length === 0) return "<p class=\"report-empty\">測定データなし</p>";
    const head = cols.map((c) => "<th>" + c.label + "</th>").join("");
    const body = rows.map((r) => {
      const cells = cols.map((c) => "<td>" + c.fmt(r[c.key], r) + "</td>").join("");
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
    let sorted;
    if (axis.categorical && axis.xKey === "interval") {
      sorted = [...rows].sort((a, b) => {
        const ia = INTERVAL_SORT.indexOf(resolveInterval(a));
        const ib = INTERVAL_SORT.indexOf(resolveInterval(b));
        return (ia >= 0 ? ia : 999) - (ib >= 0 ? ib : 999);
      });
    } else if (axis.categorical && axis.sortOrder) {
      sorted = [...rows].sort((a, b) => axis.sortOrder.indexOf(a[axis.xKey]) - axis.sortOrder.indexOf(b[axis.xKey]));
    } else {
      sorted = [...rows].sort((a, b) => a[axis.xKey] - b[axis.xKey]);
    }
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

  function isWaterRow(r) {
    return r.materialKey === "water" || r.materialName === "水";
  }

  function inferPhaseFromContext(r, rows) {
    if (isPlateauRow(r)) {
      const t = Number(r.initialCelsius ?? r.finalCelsius ?? NaN);
      if (isWaterRow(r) && !Number.isNaN(t) && Math.abs(t - 100) < 5) return "沸騰中";
      if (isWaterRow(r) && !Number.isNaN(t) && Math.abs(t) < 5) return "融解中";
      const plateaus = (rows || []).filter(isPlateauRow);
      const idx = plateaus.indexOf(r);
      if (idx === 0) return "融解中";
      if (idx === 1) return "沸騰中";
      return "状態変化中";
    }
    if (isWaterRow(r)) {
      const t = Number(r.initialCelsius ?? r.finalCelsius ?? NaN);
      if (!Number.isNaN(t)) {
        if (t < 0) return "氷・固体";
        if (t < 100) return "液体";
        return "水蒸気";
      }
      const sensibles = (rows || []).filter((x) => !isPlateauRow(x));
      const maxDt = sensibles.reduce((m, x) => Math.max(m, Number(x.deltaT) || 0), 0);
      const dt = Number(r.deltaT) || 0;
      if (dt >= maxDt - 0.1 && maxDt > 150) return "氷・固体";
      if (dt > 0) return "液体";
    }
    return "—";
  }

  function friendlyIntervalLabel(r, rows) {
    const iv = resolveInterval(r);
    if (isWaterRow(r)) {
      if (iv === "固体") return "氷・固体";
      if (iv === "固体→液体") return "融解中";
      if (iv === "液体") return "液体";
      if (iv === "液体→気体") return "沸騰中";
      if (iv === "気体") return "水蒸気";
    }
    if (iv === "固体") return "固体";
    if (iv === "気体") return "気体";
    if (iv && iv !== "—") return iv;
    return inferPhaseFromContext(r, rows);
  }

  function resultDisplayLabel(r, axis, rows) {
    const contextRows = rows || null;
    const mat = r.materialName || MATERIAL_NAMES[r.materialKey] || "—";
    const phase = friendlyIntervalLabel(r, contextRows);
    if (phase && phase !== "—") return mat + "（" + phase + "）";
    if (axis.categorical && axis.xKey === "materialKey") {
      return mat;
    }
    return rowLabel(r, axis);
  }

  function formatRowDeltaT(r, axis) {
    if (isPlateauRow(r)) {
      return axis.yLabel + " = 0 " + axis.yUnit + "（温度は一定・潜熱で状態が変わる）";
    }
    return axis.yLabel + " = " + fmtNum(r[axis.yKey]) + " " + axis.yUnit;
  }

  function pickMaterialCompareRow(rows, materialKey) {
    const matRows = (rows || []).filter((r) => r.materialKey === materialKey);
    if (!matRows.length) return null;
    const liquid = matRows.find((r) => r.interval === "液体" && !isPlateauRow(r));
    if (liquid) return liquid;
    const sensible = matRows.find((r) => !isPlateauRow(r) && Number(r.deltaT) > 0.05);
    return sensible || matRows[0];
  }

  function appendWaterPhaseNotes(rows, parts) {
    const waterRows = rows.filter((r) => r.materialKey === "water");
    if (!waterRows.length) return;

    const has = (iv) => waterRows.some((r) => resolveInterval(r) === iv);
    if (has("気体")) {
      parts.push("水蒸気（気体）まで記録されており、加熱による状態変化を一通りたどれています");
      return;
    }
    if (has("液体→気体") && !has("気体")) {
      parts.push("沸騰中（液体→気体）まで記録されています。さらに加熱を続けると 水（水蒸気）の区間も表に現れます");
      return;
    }
    if (has("液体") && !has("液体→気体") && !has("気体")) {
      parts.push("液体まで記録されています。十分に加熱を続けると、沸騰の平台や 水（水蒸気）の区間も現れます");
    }
  }

  function rowLabel(r, axis) {
    if (axis.categorical && axis.xKey === "materialKey") {
      return MATERIAL_NAMES[r[axis.xKey]] || String(r[axis.xKey]);
    }
    if (axis.categorical && axis.xKey === "interval") {
      return friendlyIntervalLabel(r, null);
    }
    return String(r[axis.xKey]) + axis.xUnit;
  }

  function buildConcreteSummary(trend, axis) {
    if (trend.sorted.length < 2) {
      return "データが1つだけなので、まだ比べられません。条件を変えて2回以上「測定する」と、違いがはっきり見えてきます。";
    }

    const parts = [];

    if (axis.categorical) {
      const sortedRows = trend.sorted;
      sortedRows.forEach((r) => {
        parts.push(resultDisplayLabel(r, axis, sortedRows) + " では " + formatRowDeltaT(r, axis));
      });

      const sensible = sortedRows.filter((r) => !isPlateauRow(r));
      if (sensible.length >= 2) {
        const maxRow = sensible.reduce((a, b) => (a[axis.yKey] >= b[axis.yKey] ? a : b));
        const minRow = sensible.reduce((a, b) => (a[axis.yKey] <= b[axis.yKey] ? a : b));
        if (Math.abs(maxRow[axis.yKey] - minRow[axis.yKey]) >= 0.5) {
          parts.push(
            "温度が上がった区間では、いちばん大きかったのは " + resultDisplayLabel(maxRow, axis, sortedRows) +
            "（" + fmtNum(maxRow[axis.yKey]) + " " + axis.yUnit + "）、いちばん小さかったのは " +
            resultDisplayLabel(minRow, axis, sortedRows) + "（" + fmtNum(minRow[axis.yKey]) + " " + axis.yUnit + "）でした"
          );
        } else if (sensible.length === trend.sorted.length) {
          parts.push("温度が上がる区間では、" + axis.yLabel + " はほとんど同じでした");
        }
      }

      if (axis.xKey === "interval" || shouldUseIntervalAxis(trend.sorted)) {
        appendWaterPhaseNotes(trend.sorted, parts);
      }

      if (axis.xKey === "materialKey") {
        const law = analyzeSpecificHeat(trend.sorted);
        if (law) parts.push(law.comment.replace(/\.$/, ""));
      }
      return parts.join("。") + "。";
    }

    const first = trend.sorted[0];
    const last = trend.sorted[trend.sorted.length - 1];
    const y0 = first[axis.yKey];
    const y1 = last[axis.yKey];
    parts.push(
      axis.xLabel + " " + rowLabel(first, axis) + " のとき " + axis.yLabel + " = " + fmtNum(y0) + " " + axis.yUnit + "、" +
      axis.xLabel + " " + rowLabel(last, axis) + " のとき " + fmtNum(y1) + " " + axis.yUnit + " でした"
    );

    if (Math.abs(y1 - y0) < 0.5) {
      parts.push(axis.xLabel + "を変えても、" + axis.yLabel + "はほとんど同じでした");
    } else if (y1 > y0) {
      parts.push(
        axis.xLabel + "を大きくするほど、" + axis.yLabel + "も大きくなりました（" +
        fmtNum(y0) + " " + axis.yUnit + " → " + fmtNum(y1) + " " + axis.yUnit + "）"
      );
      if (axis.xKey === "heatQ") {
        parts.push("これは「熱量を多く与えると温度がより上がる」という Q = mcΔT のイメージと合います（融解・沸騰の平台を除く）");
      }
    } else {
      parts.push(
        axis.xLabel + "を大きくするほど、" + axis.yLabel + "は小さくなりました（" +
        fmtNum(y0) + " " + axis.yUnit + " → " + fmtNum(y1) + " " + axis.yUnit + "）"
      );
      if (axis.xKey === "mass") {
        parts.push("これは「質量が大きいと温まりにくい（熱容量が大きい）」という Q = mcΔT のイメージと合います");
      }
    }

    return parts.join("。") + "。";
  }

  function analyzeSpecificHeat(rows) {
    const water = pickMaterialCompareRow(rows, "water");
    const iron = pickMaterialCompareRow(rows, "iron");
    if (!water || !iron) return null;
    return {
      water, iron,
      comment: "液体など温度が上がる区間で比べると、水の ΔT = " + fmtNum(water.deltaT) + " ℃、鉄は ΔT = " + fmtNum(iron.deltaT) +
        " ℃ でした。同じ熱量・同じ質量なのに差が出たのは、水の比熱（4.2）が鉄（0.45）より大きいからです",
    };
  }

  function reviewHypothesis(hypothesis, axis, trend) {
    const h = hypothesis || "";
    if (!h) {
      return "仮説がまだ選ばれていません。上の「表・グラフから読み取れること」を見て、自分の予想と合うか考えてみましょう。";
    }

    if (axis.xKey === "interval") {
      const plateaus = trend.sorted.filter((r) => isPlateauRow(r));
      const hasGas = trend.sorted.some((r) => r.materialKey === "water" && resolveInterval(r) === "気体");
      if (h === "water_faster" || h === "iron_faster" || h === "same_if_mass") {
        return "今回のデータは、水の状態変化（氷・融解・液体・沸騰など）を区間ごとに記録しています。表の「区間・状態」列と ΔT を見ながら、仮説と照らし合わせてみましょう。";
      }
      if (plateaus.length > 0) {
        return "✅ 融解・沸騰の区間で ΔT = 0（温度一定）が記録されていれば、「状態が変わるあいだ温度は上がらない」という考えと合います。" +
          (hasGas ? " 水蒸気（気体）まで記録されているので、加熱を続けた結果も表に残っています。" : "");
      }
      return "区間ごとの ΔT を表と照らし合わせ、仮説の言葉と合うか考えてみましょう。";
    }

    const water = pickMaterialCompareRow(trend.sorted, "water");
    const iron = pickMaterialCompareRow(trend.sorted, "iron");

    if (h === "water_faster" || h === "water_slower") {
      if (water && iron && water.deltaT > iron.deltaT) {
        return "✅ <strong>仮説どおり：</strong>水の方が ΔT が大きかったので、「水の方が温まりやすい」という予想と合いました。";
      }
      if (water && iron) {
        return "❌ <strong>仮説とちがう：</strong>実際は水の方が ΔT が小さかったです。水は比熱が大きいので、同じ熱量では温度が上がりにくい、と説明できます。";
      }
      return "⚠️ 水と鉄の両方のデータがあると、仮説と比べやすくなります。";
    }
    if (h === "iron_faster") {
      if (water && iron && iron.deltaT > water.deltaT) {
        return "✅ <strong>仮説どおり：</strong>鉄の方が ΔT が大きかったので、「鉄の方が温まりやすい」という予想と合いました。";
      }
      return "⚠️ 水と鉄のデータを表で比べ、Q = mcΔT の式で理由を考えてみましょう。";
    }
    if (h === "same_if_mass") {
      const spread = trend.yMax - trend.yMin;
      if (spread < 0.5) {
        return "✅ <strong>仮説どおり：</strong>物質を変えても ΔT はほとんど同じでした。";
      }
      return "❌ <strong>仮説とちがう：</strong>物質によって ΔT が違いました。比熱の違いが効いていると考えられます。";
    }
    return "";
  }

  function buildDataPointsComment(trend, axis) {
    if (trend.sorted.length === 0) return "";
    return trend.sorted.map((r) => {
      return resultDisplayLabel(r, axis, trend.sorted) + " のとき " + formatRowDeltaT(r, axis);
    }).join("。") + "。";
  }

  function buildTrendComment(trend, axis) {
    return buildConcreteSummary(trend, axis);
  }

  function buildConclusion(analysis, data) {
    const parts = [];
    if (analysis.n < 2) {
      parts.push("今回はシミュレーションで比熱と Q = mcΔT を調べましたが、データが少ないので、まだはっきりした結論までは言えません。");
      parts.push("条件を変えて何度か測定し、表やグラフにまとめると、規則性が見えてきます。");
      return parts.join(" ");
    }

    parts.push(analysis.n + " 回測定しました。");
    parts.push(buildConcreteSummary(analysis.trend, analysis.axis));

    if (data.reflection && data.reflection.trim().length >= 10) {
      parts.push("⑧の考察と合わせると、観察→測定→分析の流れができています。");
    } else {
      parts.push("⑧の考察に、上の数値を使って自分の言葉で理由を書くと、探究がより完成します。");
    }

    return parts.join(" ");
  }

  function analyzeData(data) {
    const rows = getMergedResults(data.results);
    const axis = pickAnalysisAxis(rows, data.planChecks);
    const trend = analyzeTrend(rows, axis);
    const n = rows.length;

    const overview = n === 0
      ? "まだ測定データがありません。シミュレーションで条件を変えて「測定する」ボタンを押すと、ここに分析結果が表示されます。"
      : n + " 回測定しました。" + axis.yLabel + " は " + fmtNum(trend.yMin) + " 〜 " + fmtNum(trend.yMax) + " " + axis.yUnit + " の範囲でした。";

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
      '<div class="report-insight"><h3>📊 測定結果のまとめ</h3><p>' + esc(analysis.overview) + "</p></div>",
    ];
    if (analysis.dataPoints) {
      items.push('<div class="report-insight"><h3>📋 測定した値</h3><p>' + esc(analysis.dataPoints) + "</p></div>");
    }
    items.push(
      '<div class="report-insight"><h3>📈 表・グラフから読み取れること</h3><p>' + analysis.trendComment + "</p></div>",
      '<div class="report-insight"><h3>🔬 理科の考え方</h3><p>' + esc(analysis.physicsNote) + "</p></div>",
      '<div class="report-insight report-hypothesis"><h3>💡 仮説は当たった？</h3><p>' + analysis.hypothesisReview + "</p></div>"
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
    maxHeightPx: 240,
  };

  const REPORT_GRAPH_SERIES = {
    water: { lineColor: "#0891b2", dotColor: "#0e7490", showPlateaus: true, meltAt: 0, boilAt: 100, note: "融解・沸騰の平台" },
    iron: { lineColor: "#c2410c", dotColor: "#ea580c", showPlateaus: true, meltAt: 1538, boilAt: 2862, note: "融点1538℃の平台" },
    aluminum: { lineColor: "#7c3aed", dotColor: "#8b5cf6", showPlateaus: true, meltAt: 660, boilAt: 2467, note: "融点660℃の平台" },
    air: { lineColor: "#475569", dotColor: "#64748b", showPlateaus: false, note: "Q = mcΔT" },
  };

  const REPORT_MATERIAL_NAMES = { water: "水", iron: "鉄", aluminum: "アルミ", air: "空気" };

  function reportGraphTargets(data) {
    if (global.InquirySteps?.getGraphTargets) return InquirySteps.getGraphTargets(data);
    const keys = new Set();
    if (data?.graphCreatedWater) keys.add("water");
    if (data?.graphCreatedIron) keys.add("iron");
    Object.keys(data?.qtCurves || {}).forEach((k) => keys.add(k));
    return ["water", "iron", "aluminum", "air"].filter((k) => keys.has(k));
  }

  function reportGraphsCreated(data) {
    if (global.InquirySteps?.normalizeGraphsCreated) return InquirySteps.normalizeGraphsCreated(data);
    return {
      water: !!data?.graphCreatedWater,
      iron: !!data?.graphCreatedIron,
      aluminum: false,
      air: false,
    };
  }

  function reportGraphSize() {
    const gap = 12;
    const w = Math.floor((PAGE.contentWidthPx - gap) / 2);
    return { width: Math.max(240, w), height: 228 };
  }

  function buildReportGraphSectionHtml(data) {
    const size = reportGraphSize();
    const targets = reportGraphTargets(data);
    const created = reportGraphsCreated(data);

    if (!targets.length) {
      return '<p class="report-empty">グラフ対象の測定データがありません</p>';
    }

    const cols = targets.map((key, i) => {
      const cfg = REPORT_GRAPH_SERIES[key] || REPORT_GRAPH_SERIES.water;
      const matName = REPORT_MATERIAL_NAMES[key] || key;
      const caption = "グラフ" + (i + 1) + "：" + matName + "（Q 横 · T 縦）— " + (cfg.note || "Q–T 曲線");
      if (created[key]) {
        return formatGraphFigure(size, caption, key);
      }
      return '<p class="report-empty report-graph-slot-empty">グラフ' + (i + 1) + "（" + matName + "）未作成</p>";
    }).join("");

    let html = '<div class="report-graph-row">' + cols + "</div>";

    if (targets.length >= 2) {
      const names = targets.map((k) => REPORT_MATERIAL_NAMES[k] || k).join("と");
      html += '<p class="report-graph-note">' + names + "のグラフを比べ、温まりやすさや平台の有無を考えてみましょう。</p>";
    } else if (targets.includes("water")) {
      html += '<p class="report-graph-note"><strong>状態変化の区間だけ</strong>色分けされています（融解 <span class="graph-legend-inline graph-legend-melt">○ 紫</span> · 沸騰 <span class="graph-legend-inline graph-legend-boil">△ 橙</span>）。固体・液体・気体の加热区間は通常色のままです。</p>';
    }

    const customGraphs = data.customGraphs || [];
    if (customGraphs.length) {
      html += '<h3 class="report-subsection-title" style="margin-top:16px">追加グラフ</h3><div class="report-graph-row">';
      customGraphs.forEach((g, i) => {
        const caption = "追加" + (i + 1) + "：" + (global.InquirySteps?.getCustomGraphCaption?.(g) || g.materialKey);
        html += formatGraphFigure(size, caption, "custom:" + g.id);
      });
      html += "</div>";
    }

    return html;
  }

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

  function formatGraphFigure(size, caption, seriesKey) {
    const w = size?.width || REPORT_GRAPH.maxWidthPx;
    const h = size?.height || REPORT_GRAPH.maxHeightPx;
    const key = seriesKey || "water";
    return (
      '<figure class="report-figure">' +
      '<div class="report-graph-frame" data-graph-series="' + esc(key) + '" data-graph-w="' + w + '" data-graph-h="' + h + '" ' +
      'style="width:' + w + "px;height:" + h + 'px">' +
      '<canvas class="report-graph-canvas" width="' + w + '" height="' + h + '" ' +
      'style="display:block;width:' + w + "px;height:" + h + 'px;"></canvas>' +
      "</div>" +
      '<figcaption class="report-figure-caption">' + caption + "</figcaption>" +
      "</figure>"
    );
  }

  function getReportGraphData(container, data) {
    if (data?.qtCurves) return data;
    const root = container?.closest?.("#inquiryReportDocument") || container;
    return root?._inquiryReportData || null;
  }

  function ensureWhiteReportCanvas(canvas, w, h) {
    if (!canvas) return null;
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    canvas.style.display = "block";
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
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
    const reportData = getReportGraphData(container, data);
    const drawReport = global.InquirySteps?.drawReportQTGraph;
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
        const graphId = seriesKey.slice(7);
        const graphDef = (reportData?.customGraphs || []).find((g) => g.id === graphId);
        if (graphDef && drawCustom) {
          try {
            drawCustom(canvas, reportData, graphDef, { reportMode: true, width: w, height: h });
          } catch (err) {
            console.warn("[探究レポート] 追加グラフ描画に失敗:", graphId, err);
            drawReportGraphPlaceholder(canvas, w, h, "追加グラフを描画できません");
          }
        } else {
          drawReportGraphPlaceholder(canvas, w, h, "追加グラフデータがありません");
        }
        return;
      }

      const seriesOpts = {
        ...(REPORT_GRAPH_SERIES[seriesKey] || REPORT_GRAPH_SERIES.water),
        materialKey: seriesKey,
        results: reportData?.results,
      };
      const pts = reportData?.qtCurves?.[seriesKey];
      if (!drawReport) {
        drawReportGraphPlaceholder(canvas, w, h, "グラフ描画機能を読み込めません");
        return;
      }
      try {
        drawReport(canvas, w, h, pts, seriesOpts);
      } catch (err) {
        console.warn("[探究レポート] グラフ描画に失敗:", seriesKey, err);
        drawReportGraphPlaceholder(canvas, w, h, "グラフを描画できません");
      }
    });
  }

  function clonePageHtmlWithGraphImages(pageEl) {
    const clone = pageEl.cloneNode(true);
    const liveFrames = pageEl.querySelectorAll(".report-graph-frame");
    const cloneFrames = clone.querySelectorAll(".report-graph-frame");
    cloneFrames.forEach((frame, idx) => {
      const liveCanvas = liveFrames[idx]?.querySelector(".report-graph-canvas");
      if (!liveCanvas || liveCanvas.width < 2 || liveCanvas.height < 2) return;
      const img = document.createElement("img");
      img.src = liveCanvas.toDataURL("image/png");
      img.className = "report-graph-img";
      img.alt = "実験データのグラフ";
      img.width = liveCanvas.width;
      img.height = liveCanvas.height;
      img.style.cssText = liveCanvas.style.cssText || ("display:block;width:" + liveCanvas.width + "px;height:" + liveCanvas.height + "px;");
      frame.replaceChildren(img);
    });
    return clone.outerHTML;
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

  function measureHtmlHeight(html) {
    const el = getMeasureInner();
    el.innerHTML = html;
    return el.scrollHeight;
  }

  function measureBlocksHtml(blocks) {
    const html = blocks.map((b) => (typeof b === "string" ? b : b.html)).join("");
    return measureHtmlHeight(html);
  }

  function insertContinueNote(html) {
    if (!html.includes("report-continue-note")) {
      return html.replace(/(<section[^>]*>)/, "$1<p class=\"report-continue-note\">（続き）</p>");
    }
    return html;
  }

  function splitByTableRows(html, maxH) {
    const el = getMeasureInner();
    el.innerHTML = html;
    const tbody = el.querySelector("tbody");
    if (!tbody || tbody.rows.length <= 1) return null;

    const snapshot = el.innerHTML;
    const tbodyHtml = tbody.outerHTML;
    const emptyTbody = "<tbody></tbody>";
    if (!snapshot.includes(tbodyHtml)) return null;
    const shellHtml = snapshot.replace(tbodyHtml, emptyTbody);
    const rows = Array.from(tbody.rows).map((row) => row.outerHTML);

    const chunks = [];
    let buf = [];
    rows.forEach((rowHtml) => {
      const trialHtml = shellHtml.replace(emptyTbody, "<tbody>" + buf.concat([rowHtml]).join("") + "</tbody>");
      if (buf.length && measureHtmlHeight(trialHtml) > maxH) {
        chunks.push(shellHtml.replace(emptyTbody, "<tbody>" + buf.join("") + "</tbody>"));
        buf = [rowHtml];
      } else {
        buf.push(rowHtml);
      }
    });
    if (buf.length) chunks.push(shellHtml.replace(emptyTbody, "<tbody>" + buf.join("") + "</tbody>"));
    if (chunks.length <= 1) return null;
    return chunks.map((chunk, i) => ({
      html: i === 0 ? chunk : insertContinueNote(chunk),
    }));
  }

  function splitByListItems(html, maxH) {
    const el = getMeasureInner();
    el.innerHTML = html;
    const ul = el.querySelector("ul.report-list");
    if (!ul || ul.children.length <= 1) return null;

    const snapshot = el.innerHTML;
    const ulHtml = ul.outerHTML;
    const emptyUl = "<ul class=\"report-list\"></ul>";
    if (!snapshot.includes(ulHtml)) return null;
    const shellHtml = snapshot.replace(ulHtml, emptyUl);
    const items = Array.from(ul.children).map((li) => li.outerHTML);

    const chunks = [];
    let buf = [];
    items.forEach((itemHtml) => {
      const trialHtml = shellHtml.replace(emptyUl, "<ul class=\"report-list\">" + buf.concat([itemHtml]).join("") + "</ul>");
      if (buf.length && measureHtmlHeight(trialHtml) > maxH) {
        chunks.push(shellHtml.replace(emptyUl, "<ul class=\"report-list\">" + buf.join("") + "</ul>"));
        buf = [itemHtml];
      } else {
        buf.push(itemHtml);
      }
    });
    if (buf.length) chunks.push(shellHtml.replace(emptyUl, "<ul class=\"report-list\">" + buf.join("") + "</ul>"));
    if (chunks.length <= 1) return null;
    return chunks.map((chunk, i) => ({
      html: i === 0 ? chunk : insertContinueNote(chunk),
    }));
  }

  function splitByReportCompanion(html, maxH) {
    const el = getMeasureInner();
    el.innerHTML = html;
    const aside = el.querySelector(".report-companion");
    const body = aside?.querySelector(".report-companion-body");
    if (!aside || !body) return null;

    const lines = String(body.innerHTML || "")
      .split(/<br\s*\/?>/i)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length <= 1) return null;

    const snapshot = el.innerHTML;
    const asideHtml = aside.outerHTML;
    const headHtml = aside.querySelector(".report-companion-head")?.outerHTML || "";
    const className = aside.className || "report-companion";
    const shellHtml = snapshot.replace(asideHtml, "{{COMPANION}}");
    const buildAside = (lineHtmls, continued) => (
      shellHtml.replace(
        "{{COMPANION}}",
        '<aside class="' + className + '">' + headHtml +
        '<p class="report-companion-body">' + lineHtmls.join("<br>") + "</p></aside>"
      ).replace(/(<section[^>]*>)/, continued ? "$1<p class=\"report-continue-note\">（続き）</p>" : "$1")
    );

    const chunks = [];
    let buf = [];
    lines.forEach((line) => {
      const trialHtml = buildAside(buf.concat([line]), chunks.length > 0);
      if (buf.length && measureHtmlHeight(trialHtml) > maxH) {
        chunks.push(buildAside(buf, chunks.length > 0));
        buf = [line];
      } else {
        buf.push(line);
      }
    });
    if (buf.length) chunks.push(buildAside(buf, chunks.length > 0));
    if (chunks.length <= 1) return null;
    return chunks.map((chunk, i) => ({ html: i === 0 ? chunk.replace(/<p class="report-continue-note">（続き）<\/p>/, "") : chunk }));
  }

  function splitByReportBox(html, maxH) {
    const el = getMeasureInner();
    el.innerHTML = html;
    const box = el.querySelector(".report-box");
    if (!box) return null;

    const lines = String(box.innerHTML || "")
      .split(/<br\s*\/?>/i)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (lines.length <= 1) return null;

    const snapshot = el.innerHTML;
    const boxHtml = box.outerHTML;
    const shellHtml = snapshot.replace(boxHtml, "{{REPORT_BOX}}");
    const buildChunk = (lineHtmls, continued) => (
      shellHtml.replace("{{REPORT_BOX}}", '<div class="report-box">' + lineHtmls.join("<br>") + "</div>")
        .replace(/(<section[^>]*>)/, continued ? "$1<p class=\"report-continue-note\">（続き）</p>" : "$1")
    );

    const chunks = [];
    let buf = [];
    lines.forEach((line) => {
      const trialHtml = buildChunk(buf.concat([line]), chunks.length > 0);
      if (buf.length && measureHtmlHeight(trialHtml) > maxH) {
        chunks.push(buildChunk(buf, chunks.length > 0));
        buf = [line];
      } else {
        buf.push(line);
      }
    });
    if (buf.length) chunks.push(buildChunk(buf, chunks.length > 0));
    if (chunks.length <= 1) return null;
    return chunks.map((chunk, i) => ({ html: i === 0 ? chunk.replace(/<p class="report-continue-note">（続き）<\/p>/, "") : chunk }));
  }

  function splitHtmlForPagination(html, maxH) {
    if (measureHtmlHeight(html) <= maxH) return [{ html }];
    return splitByTableRows(html, maxH)
      || splitByListItems(html, maxH)
      || splitByReportCompanion(html, maxH)
      || splitByReportBox(html, maxH)
      || [{ html }];
  }

  function expandBlocksForPagination(blocks, maxH) {
    const expanded = [];
    blocks.forEach((block) => {
      const html = typeof block === "string" ? block : block.html;
      const parts = splitHtmlForPagination(html, maxH);
      parts.forEach((part) => expanded.push({ html: part.html }));
    });
    return expanded;
  }

  function paginateBlocks(blocks) {
    const maxH = PAGE.contentHeightPx;
    const expanded = expandBlocksForPagination(blocks, maxH);
    const pages = [];
    let current = [];

    expanded.forEach((block) => {
      const trial = current.concat([block]);
      const trialH = measureBlocksHtml(trial);
      const soloH = measureBlocksHtml([block]);

      if (soloH > maxH) {
        if (current.length) {
          pages.push(current.map((b) => ({ html: b.html, height: measureBlocksHtml([b]) })));
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

  function renderPdfFromPages(pageEls, reportData) {
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
              paintGraphCanvases(pageEl, reportData);
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
      const graphSizes = opts.graphSizes || null;
      const analysis = analyzeData(data);
      const axis = analysis.axis;
      const blocks = [];
      const missionTexts = getMissionReportTexts(data);

      blocks.push({
        html:
          '<header class="report-doc-header">' +
          '<p class="report-doc-badge">PhysLabo 探究学習レポート</p>' +
          "<h1>比熱・熱量と状態変化</h1>" +
          '<p class="report-doc-meta">作成日時：' + formatDate(exportedAt) + "　|　第12章 熱と比熱 — Q = mcΔT と潜熱</p>" +
          (opts.celebrated ? '<p class="report-doc-celebrate">🎉 探究達成（100%）</p>' : "") +
          "</header>",
      });

      blocks.push({
        html:
          '<section class="report-section"><h2>① 問い（ミッション）</h2>' +
          '<p class="report-line"><strong>' + esc(missionTexts.missionTitle) + "</strong></p>" +
          (missionTexts.missionDescription
            ? '<div class="report-box">' + nl2br(missionTexts.missionDescription) + "</div>"
            : "") +
          formatCompanionBlock("mission", missionTexts.missionTitle + " " + missionTexts.missionDescription, {
            missionId: data.missionId,
          }, data) +
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
          formatCompanionBlock("hypothesis", missionTexts.hypothesisText + " " + missionTexts.hypothesisFree, {
            hypothesisLabel: missionTexts.hypothesisText,
          }, data) +
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
          formatCompanionBlock(
            "plan",
            missionTexts.planText + " " + missionTexts.planCompare + " " + missionTexts.planPurpose,
            null,
            data
          ) +
          "</section>",
      });

      blocks.push({
        html:
          '<section class="report-section"><h2>④ 実験ログ</h2>' +
          formatTimeline(data.timeline) +
          "</section>",
      });

      const experimentLogTable = formatHeatMeasureLog(data.heatMeasureLog);
      if (experimentLogTable) {
        blocks.push({
          html:
            '<section class="report-section report-section-continue">' +
            experimentLogTable +
            "</section>",
        });
      }

      blocks.push({
        html:
          '<section class="report-section"><h2>⑤ 実験結果</h2>' +
          formatMeasureSessionTable(data.heatMeasureLog) +
          "</section>",
      });

      blocks.push({
        html:
          '<section class="report-section report-section-continue">' +
          '<h3 class="report-subsection-title">区間・状態ごとの記録</h3>' +
          formatResultsTable(data.results, data.planChecks) +
          "</section>",
      });

      blocks.push({
        html:
          '<section class="report-section report-section-analysis"><h2>⑥ データ分析</h2>' +
          '<p class="report-analysis-lead">測定データ ' + analysis.n + ' 件を、高校生向けのやさしい言葉でまとめました（<strong>' +
          esc(axis.xLabel) + "</strong> と <strong>" + esc(axis.yLabel) + "</strong> の関係）。</p>" +
          '<div class="report-analysis">' +
          formatAnalysisBlocks(analysis).map((item) => item.html).join("") +
          "</div></section>",
      });

      blocks.push({
        html:
          '<section class="report-section"><h2>⑦ グラフ</h2>' +
          buildReportGraphSectionHtml(data) +
          "</section>",
      });

      blocks.push({
        html:
          '<section class="report-section"><h2>⑧ 考察</h2>' +
          '<div class="report-insight report-reflection-hint"><h3>【データから言えること】</h3><p>' + analysis.trendComment + "</p></div>" +
          '<p class="report-line"><strong>あなたの考察：</strong></p>' +
          '<div class="report-box">' + nl2br(data.reflection || "（未記入）") + "</div>" +
          formatCompanionBlock("reflection", data.reflection, {
            resultCount: getMergedResults(data.results).length,
          }, data) +
          "</section>",
      });

      blocks.push({
        html:
          '<section class="report-section"><h2>⑨ まとめ</h2>' +
          '<p class="report-line"><strong>あなたのまとめ：</strong></p>' +
          '<div class="report-box">' + nl2br(data.summaryText || "（未記入）") + "</div>" +
          "</section>",
      });

      const summaryCompanion = formatCompanionBlock("summaryText", data.summaryText, null, data);
      if (summaryCompanion) {
        blocks.push({
          html: '<section class="report-section report-section-continue">' + summaryCompanion + "</section>",
        });
      }

      blocks.push({
        html:
          '<section class="report-section report-section-continue">' +
          '<div class="report-insight report-conclusion-insight">' +
          "<h3>今回の探究のまとめ</h3><p>" + esc(analysis.conclusion) + "</p></div>" +
          "</section>",
      });

      blocks.push({
        html: '<footer class="report-doc-footer">PhysLabo — 比熱・熱量と状態変化 探究モード（データ自動分析付き）</footer>',
      });

      return blocks;
    },

    buildHtml(data, options) {
      const pages = paginateBlocks(this.buildBlocks(data, options));
      return buildPagedHtml(pages);
    },

    render(container, data, options) {
      if (!container) return;
      container._inquiryReportData = data;
      try {
        const pages = paginateBlocks(this.buildBlocks(data, options));
        container.innerHTML = buildPagedHtml(pages);
        paintGraphCanvases(container, data);
      } catch (err) {
        console.error("[探究レポート] render failed:", err);
        container.innerHTML =
          '<div class="report-box report-render-error">' +
          "<h2>レポートの生成に失敗しました</h2>" +
          "<p>ページを再読み込み（Ctrl+Shift+R）してから、もう一度お試しください。</p>" +
          '<p style="font-size:0.85em;color:#64748b;margin-top:8px">' + esc(String(err?.message || err)) + "</p>" +
          "</div>";
      }
    },

    getGraphDisplaySize(sourceId) {
      const canvas = document.getElementById(sourceId);
      if (!canvas || canvas.width < 2) return null;
      const { logicW, logicH } = getGraphLogicSize(canvas);
      return fitGraphSize(logicW, logicH);
    },

    getGraphDisplaySizes(data) {
      const targets = reportGraphTargets(data || {});
      const out = {};
      targets.forEach((key) => {
        out[key] = this.getGraphDisplaySize("inquiryGraphCanvas_" + key);
      });
      return out;
    },

    downloadPdf(reportEl, filename) {
      if (!reportEl) return Promise.reject(new Error("report element missing"));

      const name = filename || "specific_heat_inquiry_report.pdf";
      const pageEls = reportEl.querySelectorAll(".inquiry-report-page");
      if (!pageEls.length) {
        return Promise.reject(new Error("no paginated report"));
      }

      return waitForExportReady(reportEl)
        .then(() => {
          const reportData = reportEl._inquiryReportData;
          paintGraphCanvases(reportEl, reportData);
          return renderPdfFromPages(pageEls, reportData);
        })
        .then((pdf) => {
          pdf.save(name);
        });
    },

    _downloadPdfViaPrint(reportEl) {
      return new Promise((resolve, reject) => {
        const reportData = reportEl._inquiryReportData;
        paintGraphCanvases(reportEl, reportData);

        const pages = reportEl.querySelectorAll(".inquiry-report-page");
        const pageHtml = pages.length
          ? Array.from(pages).map((page) => clonePageHtmlWithGraphImages(page)).join("")
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
          ".report-graph-frame { margin: 0 auto; line-height: 0; overflow: hidden; border: 1px solid #e2e8f0; border-radius: 6px; background: #fff; }" +
          ".report-graph-canvas, .report-graph-img { display: block; margin: 0; background: #fff; }" +
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
