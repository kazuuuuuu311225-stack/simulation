/**
 * ブラウン運動 — 探究学習の伴走AI（ルールベース）
 */
(function (global) {
  "use strict";

  const instances = [];

  function getMode() {
    const ext = global.INQUIRY_COMPANION_MODE;
    if (ext === "gentle" || ext === "expert") return ext;
    try {
      const q = new URLSearchParams(global.location?.search || "").get("companionMode");
      if (q === "gentle" || q === "expert") return q;
    } catch { /* ignore */ }
    return "gentle";
  }

  function setMode(mode, refreshAll) {
    const m = mode === "expert" ? "expert" : "gentle";
    global.INQUIRY_COMPANION_MODE = m;
    instances.forEach((inst) => {
      inst.applyMode(m);
      if (refreshAll !== false) inst.refresh();
    });
    return m;
  }

  function lineBudget(text) {
    const n = String(text || "").trim().length;
    if (n <= 20) return 1;
    if (n <= 80) return 3;
    return 5;
  }

  function norm(text) {
    return String(text || "").trim().replace(/\s+/g, " ");
  }

  function has(text, w) {
    return String(text || "").includes(w);
  }

  function hasAny(text, words) {
    return words.some((w) => has(text, w));
  }

  function hasAll(text, words) {
    return words.every((w) => has(text, w));
  }

  function isQuestion(text) {
    return /[?？]|なぜ|どうして|何で|なんで/.test(text);
  }

  function snip(text, n) {
    const t = norm(text);
    const clause = (t.split(/[。．!\?？\n,，、]/)[0] || t).trim();
    const lim = n || 26;
    return clause.length <= lim ? clause : clause.slice(0, lim) + "…";
  }

  function quotedWords(text) {
    const found = [];
    const dict = [
      ["温度", "温度"], ["ブラウン", "ブラウン運動"], ["分子", "分子"], ["大粒子", "大粒子"],
      ["粒子数", "粒子数 N"], ["サイズ", "粒子サイズ"], ["半径", "大粒子半径"],
      ["平均速度", "平均速度"], ["変位", "変位"], ["軌跡", "軌跡"], ["キック", "分子のキック"],
      ["衝突", "分子衝突"], ["√T", "v∝√T"], ["熱運動", "熱運動"], ["不規則", "不規則な動き"],
    ];
    for (const [key, label] of dict) {
      if (has(text, key)) found.push(label);
    }
    return [...new Set(found)];
  }

  function joinLines(lines, max) {
    const out = [];
    const seen = new Set();
    for (const line of lines) {
      if (!line || seen.has(line)) continue;
      seen.add(line);
      out.push(line);
      if (out.length >= max) break;
    }
    return out.join("\n");
  }

  function buildRuleCatalog() {
    return [
      {
        id: "temp_speed",
        test: (t) => hasAny(t, ["温度", "K", "300", "500"]) && hasAny(t, ["速度", "平均", "激し", "ブラウン", "動き"]),
        gentle: (t) =>
          "「" + snip(t) + "」— 温度と大粒子・分子の動きに直接触れています。左で 300K→400K→500K と変えて「測定する」と、表の平均速度と自分の文が結びつきます。",
        expert: (t) =>
          "記述「" + snip(t) + "」— 独立変数（温度 T）と従属変数（平均速度）が明示されています。v ∝ √T の定性的検証に適した問いです。",
      },
      {
        id: "sqrt_t",
        test: (t) => hasAny(t, ["√T", "ルート", "平方根", "比例"]) && hasAny(t, ["温度", "速度"]),
        gentle: (t) =>
          "「" + snip(t) + "」— 温度の平方根と速度の関係に言及していますね。グラフで T を横軸・平均速度を縦軸にすると、傾向が見えやすくなります。",
        expert: (t) =>
          "「" + snip(t) + "」— 分子運動論の v ∝ √T を背景にした記述です。測定点を log–log せずとも、複数温度の比で定性的に確かめられます。",
      },
      {
        id: "particle_size",
        test: (t) => hasAny(t, ["大粒子", "サイズ", "半径", "px"]) && hasAny(t, ["小さ", "大き", "動き", "速度", "ブラウン"]),
        gentle: (t) =>
          "「" + snip(t) + "」— 大粒子のサイズと見かけの動きについて書いています。同じ温度で半径 14px と 26px を測ると、表とグラフで比べやすいです。",
        expert: (t) =>
          "「" + snip(t) + "」— 大粒子半径と大粒子速度の関係を問う記述です。慣性・衝突面積の効果を分離するには温度を固定してください。",
      },
      {
        id: "particle_count",
        test: (t) => hasAny(t, ["分子数", "粒子数", "N=", "N＝", "個"]) && hasAny(t, ["多い", "少ない", "キック", "衝突", "活発"]),
        gentle: (t) =>
          "「" + snip(t) + "」— 分子数 N とキックの多さに注目しています。③で「粒子数」にチェックを入れると左のスライダが使え、N=50 と 150 を比べられます。",
        expert: (t) =>
          "「" + snip(t) + "」— 衝突頻度（N 依存）と大粒子の不規則運動を結びつけた記述です。同温度で N だけを操作変数にしてください。",
      },
      {
        id: "molecular_kick",
        test: (t) => hasAny(t, ["分子", "キック", "衝突", "ぶつか"]) && hasAny(t, ["原因", "ブラウン", "不規則", "ランダム"]),
        gentle: (t) =>
          "「" + snip(t) + "」— 分子の衝突がブラウン運動の原因、という考えに沿った文です。キック回数（HUD）と平均速度を表に並べてみましょう。",
        expert: (t) =>
          "「" + snip(t) + "」— 分子衝突モデルに基づく記述です。N または T を変えたときキック回数と ⟨v⟩ がどう連動するかデータで確かめてください。",
      },
      {
        id: "displacement",
        test: (t) => hasAny(t, ["変位", "軌跡", "広が", "ランダムウォーク", "ジグザグ"]),
        gentle: (t) =>
          "「" + snip(t) + "」— 変位や軌跡の広がりに注目しています。軌跡表示をオンにし、300K と 500K の見え方も記録に加えると考察が深まります。",
        expert: (t) =>
          "「" + snip(t) + "」— 拡散的な変位（MSD 的な量）に言及した記述です。時間平均の変位と温度・N の関係を表の数値で補強できます。",
      },
      {
        id: "stronger_weaker",
        test: (t) => hasAny(t, ["激し", "強く", "弱く", "大きく", "小さく"]) && hasAny(t, ["温度", "ブラウン", "動き", "速度"]),
        gentle: (t) =>
          "「" + snip(t) + "」— 「激しい／弱い」という比較の言葉が使われています。2条件以上測って、平均速度の大小を表で確認すると仮説と照合できます。",
        expert: (t) =>
          "「" + snip(t) + "」— 定性的比較（強度の大小）の記述です。従属変数（平均速度または大粒子速度）の数値差を明示すると検証可能になります。",
      },
      {
        id: "graph_data",
        test: (t) => hasAny(t, ["グラフ", "表", "データ", "測定", "点", "傾き"]),
        gentle: (t) =>
          "「" + snip(t) + "」— 記録したグラフ・表を根拠にしようとしています。⑤の表と⑥のグラフの、どの列・どの点を指しているか一文足すと考察が具体化します。",
        expert: (t) =>
          "「" + snip(t) + "」— 実測データ参照型の記述です。引用するグラフ特征（傾き・データ点）を明示すると因果の議論が検証可能になります。",
      },
      {
        id: "why_general",
        test: (t) => isQuestion(t),
        gentle: (t) => {
          const w = quotedWords(t);
          const subj = w.length ? w.slice(0, 2).join("と") : "その現象";
          return "「" + snip(t) + "」— " + subj + " について“なぜ”を問う文です。左で1つ変数だけ変えて測ると、理由の仮説をデータで確かめやすくなります。";
        },
        expert: (t) => {
          const w = quotedWords(t);
          const subj = w.length ? w.join("・") : "対象";
          return "「" + snip(t) + "」— " + subj + " に対する因果問いです。操作変数1つ・従属変数（平均速度等）に絞ると、検証可能な予測に落とし込めます。";
        },
      },
      {
        id: "compare_general",
        test: (t) => hasAny(t, ["違", "比べ", "比較", "どちら", "より", "差"]),
        gentle: (t) =>
          "「" + snip(t) + "」— 2つ以上を“比べる”意図が読み取れます。比べるなら粒子サイズ・分子数・温度のうち1つだけを変え、他はそろえるのが基本です。",
        expert: (t) =>
          "「" + snip(t) + "」— 比較検証型の記述です。統制条件を固定し、比較軸（T / N / 半径）を1つに限定すると議論が明確になります。",
      },
      {
        id: "hypothesis_link",
        test: (t, ctx) => (ctx.field === "hypothesisReason" || ctx.field === "hypothesis") && ctx.hypothesisLabel,
        gentle: (t, ctx) =>
          "理由「" + snip(t, 22) + "」は仮説「" + ctx.hypothesisLabel + "」を支える方向の記述です。測定後、この理由のどの部分が表・グラフと合ったか自分でチェックしてみましょう。",
        expert: (t, ctx) =>
          "根拠「" + snip(t, 22) + "」→ 仮説「" + ctx.hypothesisLabel + "」。予測とデータの対応関係を、平均速度の大小またはキック回数で評価する枠組みが使えます。",
      },
      {
        id: "reflection_data",
        test: (t, ctx) => ctx.field === "reflection" && (ctx.resultCount || 0) > 0,
        gentle: (t, ctx) =>
          "「" + snip(t) + "」— すでに " + ctx.resultCount + " 件のデータがあります。この文に、表の温度か平均速度を1つ引用すると説得力が増します。",
        expert: (t, ctx) =>
          "考察「" + snip(t) + "」— 測定 " + ctx.resultCount + " 行を参照可能です。主張ごとに対応する数値（T, ⟨v⟩）を紐づけてください。",
      },
      {
        id: "reflection_nodata",
        test: (t, ctx) => ctx.field === "reflection" && !(ctx.resultCount > 0),
        gentle: (t) =>
          "「" + snip(t) + "」— 考察の骨格は見えています。④で条件を変えて測定してから、同じ文に表の数値を1つ足すと一気に具体化します。",
        expert: (t) =>
          "「" + snip(t) + "」— 理論整理型の考察です。測定データ取得後、主張各文に対応する evidence を追加すると検証可能になります。",
      },
    ];
  }

  const RULES = buildRuleCatalog();

  function matchRules(text, ctx) {
    const hits = [];
    for (const rule of RULES) {
      try {
        if (rule.test(text, ctx)) hits.push(rule);
      } catch { /* skip */ }
    }
    return hits;
  }

  function fallbackComment(text, field, mode, ctx) {
    const t = norm(text);
    const s = snip(t, 18);
    const words = quotedWords(t);
    const len = t.length;

    if (len <= 3) {
      return mode === "gentle"
        ? "「" + s + "」だけでは意図が読み取りにくいです。例：「温度を上げるとブラウン運動は激しくなる？」のように、変数か現象を1語足してみてください。"
        : "入力「" + s + "」— 情報量が不足しています。操作変数（温度 T / N / 半径）のいずれかを明示してください。";
    }

    if (words.length >= 1) {
      const w = words.join("・");
      if (mode === "gentle") {
        return "「" + s + "」— 文中の「" + w + "」がキーワードです。この語が表のどの列（温度・平均速度・粒子数）と関係するか、自分で1つ指定してみましょう。";
      }
      return "「" + s + "」— 検出語：" + w + "。この語を従属変数 ⟨v⟩ または大粒子速度のどちらに結びつけるか決めると、探究が具体化します。";
    }

    if (field === "planText" || field === "plan") {
      return mode === "gentle"
        ? "「" + s + "」— 計画として「先に300K、次に500K」「大粒子サイズは18px固定」など、順番とそろえる条件を1行足すと実行しやすくなります。"
        : "計画「" + s + "」— 操作手順と統制条件（固定する T, N, 半径）を追記してください。";
    }

    if (field === "summaryText") {
      return mode === "gentle"
        ? "「" + s + "」— まとめに、自分の問い（①）か仮説（②）から単語を1つ引用すると、他の人にも伝わりやすくなります。"
        : "まとめ「" + s + "」— 問い→仮説→実験→考察のどの段階の学びか、キーワードを1つ明示してください。";
    }

    const tail = t.slice(-Math.min(8, t.length));
    return mode === "gentle"
      ? "「" + s + "」— 特に「" + tail + "」の部分が気になります。これは温度・分子数・大粒子サイズのどれについて言っていますか？"
      : "記述「" + s + "」— 末尾「" + tail + "」を、平均速度 / キック回数 / 変位のいずれかに関連づけて再記述してみてください。";
  }

  function generateComment(opts) {
    const field = opts.field || "question";
    const text = norm(opts.text || "");
    const mode = opts.mode === "expert" ? "expert" : opts.mode === "gentle" ? "gentle" : getMode();
    const max = lineBudget(text);
    const ctx = { ...(opts.context || {}), field };

    if (!text) {
      const empty = {
        mission: { gentle: "ミッションを選ぶと、その問いに合わせたコメントがここに出ます。", expert: "ミッション（問い）を選択してください。" },
        hypothesis: { gentle: "仮説を選び、必要なら一言補足を書くと、その組み合わせ専用のコメントが出ます。", expert: "仮説選択＋自由記述を入力すると、検証可能な予測への変換を支援します。" },
        plan: { gentle: "実験計画を選ぶと、ねらいに沿った実行のヒントがここに出ます。", expert: "実験計画を選択すると、操作変数と統制条件の観点でフィードバックします。" },
        question: { gentle: "問いの欄に一文入力すると、その言葉に合わせたコメントがここに出ます。", expert: "問いを入力してください。" },
        planText: { gentle: "実験の順番（例：300K→500K、N固定）を書くと、計画に沿ったコメントが出ます。", expert: "操作手順を入力すると、統制条件の観点でフィードバックします。" },
        hypothesisReason: { gentle: "仮説を選び、理由を書くと、その組み合わせ専用のコメントが出ます。", expert: "仮説＋根拠を入力すると、検証可能な予測への変換を支援します。" },
        reflection: { gentle: "測定結果を見ながら書いた考察に、データ引用を促すコメントが出ます。", expert: "考察文に対し、evidence の紐づけを促します。" },
        summaryText: { gentle: "上の探求テーマへの答えを書くと、その内容に合わせたコメントが出ます。", expert: "①のテーマに対する結論が含まれるよう、問い→仮説→結果の対応を明示してください。" },
      };
      const e = empty[field] || empty.question;
      return e[mode];
    }

    const hits = matchRules(text, ctx);
    const lines = [];

    if (hits.length > 0) {
      const fn = hits[0][mode];
      if (fn) lines.push(fn(text, ctx));
      for (let i = 1; i < hits.length && lines.length < max; i++) {
        const extraFn = hits[i][mode + "Extra"] || hits[i][mode];
        if (!extraFn) continue;
        const line = extraFn(text, ctx, true);
        if (line && line !== lines[0]) lines.push(line);
      }
    } else {
      lines.push(fallbackComment(text, field, mode, ctx));
    }

    if (lines.length < max && hits.length > 0 && hits[0].id !== "graph_data") {
      const w = quotedWords(text);
      if (w.length >= 2 && mode === "gentle") {
        lines.push("この文では「" + w[0] + "」と「" + w[1] + "」が両方出てきます。どちらを先に実験で確かめるか決めると、探究の順序がはっきりします。");
      } else if (w.length >= 2 && mode === "expert") {
        lines.push("複合キーワード（" + w.slice(0, 3).join("・") + "）— 一度に1変数ずつ操作した方が因果が読み取りやすくなります。");
      }
    }

    return joinLines(lines, max);
  }

  function attach(el, options) {
    if (!el) return { refresh: () => {} };

    const field = options.field || "question";
    const getText = options.getText || (() => "");
    const getContext = options.getContext || (() => ({}));

    const wrap = document.createElement("div");
    wrap.className = "inquiry-companion is-visible";
    wrap.setAttribute("role", "status");
    wrap.setAttribute("aria-live", "polite");
    wrap.innerHTML =
      '<div class="inquiry-companion-head">' +
      '<span class="inquiry-companion-icon" aria-hidden="true">🤝</span>' +
      '<span class="inquiry-companion-label">伴走AIコメント</span>' +
      '<span class="inquiry-companion-mode"></span>' +
      "</div>" +
      '<p class="inquiry-companion-text"></p>';

    el.appendChild(wrap);
    const textEl = wrap.querySelector(".inquiry-companion-text");
    const modeEl = wrap.querySelector(".inquiry-companion-mode");

    const applyMode = (m) => {
      const mode = m === "expert" ? "expert" : "gentle";
      wrap.classList.toggle("is-expert", mode === "expert");
      if (modeEl) modeEl.textContent = mode === "expert" ? "専門的" : "やさしめ";
    };

    let timer = null;
    let lastComment = "";

    const refresh = () => {
      const raw = getText();
      const mode = getMode();
      applyMode(mode);
      const comment = generateComment({
        field,
        text: raw,
        mode,
        context: getContext(),
      });
      if (comment !== lastComment) {
        textEl.textContent = comment;
        lastComment = comment;
      }
    };

    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 120);
    };

    if (options.inputEl) {
      options.inputEl.addEventListener("input", schedule);
      options.inputEl.addEventListener("change", schedule);
      options.inputEl.addEventListener("blur", refresh);
    }

    const inst = { refresh, applyMode, wrap };
    instances.push(inst);
    applyMode(getMode());
    refresh();
    return { refresh, el: wrap };
  }

  function refreshAll() {
    instances.forEach((inst) => inst.refresh());
  }

  function generateAllForState(state) {
    const st = state || {};
    const mode = st.companionMode === "expert" ? "expert" : getMode();
    const mission = global.InquiryMissions?.getMission(st.missionId);
    const hyp = global.InquiryMissions?.getHypothesis(st.hypothesisId);
    const plan = global.InquiryMissions?.getPlan(st.planId);
    const resultCount = (st.results || []).length;
    const hypText = (hyp?.text || "") + (st.hypothesisFreeText ? " （" + st.hypothesisFreeText + "）" : "");

    return {
      mission: generateComment({
        field: "mission",
        text: mission ? mission.title + " " + mission.description : "",
        mode,
        context: { missionId: st.missionId },
      }),
      hypothesis: generateComment({
        field: "hypothesis",
        text: hypText,
        mode,
        context: { hypothesisLabel: hyp?.text || "", missionId: st.missionId },
      }),
      plan: generateComment({
        field: "plan",
        text: plan ? plan.text + " " + plan.purpose : st.planText || "",
        mode,
        context: { planId: st.planId },
      }),
      reflection: generateComment({
        field: "reflection",
        text: st.reflection || "",
        mode,
        context: { resultCount },
      }),
      summary: generateComment({
        field: "summaryText",
        text: st.summaryText || "",
        mode,
      }),
    };
  }

  global.InquiryCompanion = {
    getMode,
    setMode,
    generateComment,
    generateAllForState,
    attach,
    refreshAll,
    lineBudget,
    quotedWords,
  };
})(window);
