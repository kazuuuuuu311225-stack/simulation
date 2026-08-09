/**
 * 熱平衡探究 — 伴走AI（ルールベース）
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
      ["熱平衡", "熱平衡"], ["平衡", "熱平衡"], ["Teq", "平衡温度Teq"], ["Q_loss", "Q_loss"],
      ["Q_gain", "Q_gain"], ["接触", "接触"], ["比熱", "比熱"], ["質量", "質量"],
      ["温度差", "温度差"], ["物体A", "物体A"], ["物体B", "物体B"], ["A", "物体A"], ["B", "物体B"],
      ["水", "水"], ["鉄", "鉄"], ["アルミ", "アルミ"], ["熱量保存", "熱量保存"],
      ["ΔT", "ΔT"], ["温度", "温度"], ["mc", "熱容量mc"],
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
        id: "q_loss_gain",
        test: (t) => hasAny(t, ["Q_loss", "Q_gain", "失う", "得る"]) || hasAll(t, ["熱量", "等"]),
        gentle: (t) =>
          "「" + snip(t) + "」— Q_loss = Q_gain に直接触れています。左で「接触開始」→ 平衡まで待って、表の Q 列と自分の文を並べてみましょう。",
        expert: (t) =>
          "記述「" + snip(t) + "」— 熱量保存則 Q_loss = Q_gain を検証可能な問いです。接触セッションごとの Q 値で定量的に評価できます。",
      },
      {
        id: "teq_formula",
        test: (t) => hasAny(t, ["Teq", "平衡温度", "加重平均", "mA cA", "mc"]),
        gentle: (t) =>
          "「" + snip(t) + "」— 平衡温度 Teq の式に言及しています。結果表の Teq（理論）と Teq（測定）列を比べると、式とデータが結びつきます。",
        expert: (t) =>
          "「" + snip(t) + "」— Teq = Σ(mcT)/Σ(mc) の記述です。操作変数 m, c, T₀ を固定した対照実験で検証可能です。",
      },
      {
        id: "thermal_equilibrium",
        test: (t) => hasAny(t, ["熱平衡", "平衡", "収束", "同じ温度", "一定"]),
        gentle: (t) =>
          "「" + snip(t) + "」— 熱平衡の様子を問う文です。T–t グラフの橙（A）と青（B）の 2 本が同じ温度で交わる点を確かめてみましょう。",
        expert: (t) =>
          "「" + snip(t) + "」— 熱平衡状態（TA = TB = Teq）についての記述です。T–t 曲線の収束点と Q_loss = Q_gain の同時成立を確認してください。",
      },
      {
        id: "contact_measure",
        test: (t) => hasAny(t, ["接触", "触れ", "くっつ", "接する"]),
        gentle: (t) =>
          "「" + snip(t) + "」— 接触実験が中心の問いです。④で条件を整え「接触測定」を押すと、接触ログと結果表に 1 セッション分が残ります。",
        expert: (t) =>
          "「" + snip(t) + "」— 接触による熱移動実験の記述です。非接触→接触→平衡の 3 段階を 1 セッションとして記録・分析してください。",
      },
      {
        id: "temp_diff",
        test: (t) => hasAny(t, ["温度差", "差が大", "TA", "TB", "高温", "低温"]),
        gentle: (t) =>
          "「" + snip(t) + "」— 温度差に注目しています。③で「温度差 tempDiff」にチェックを入れると、初期 TA/TB の変更がログに残り、Q の大きさと比べられます。",
        expert: (t) =>
          "「" + snip(t) + "」— 初期温度差 ΔT₀ を独立変数とする記述です。Q 移動量との相関を接触セッション表で確認できます。",
      },
      {
        id: "mass_effect",
        test: (t) => hasAny(t, ["質量", "mA", "mB", "500g", "グラム"]) || (/\bm\b/.test(t) && hasAny(t, ["大き", "小さ", "変"])),
        gentle: (t) =>
          "「" + snip(t) + "」— 質量 m に言及しています。③で massA / massB にチェックを入れると、左のスライダ変更が実験ログに記録されます。",
        expert: (t) =>
          "「" + snip(t) + "」— 熱容量 C=mc の m 依存を問う記述です。Teq への m の効果を表の Teq 列で確認できます。",
      },
      {
        id: "specific_heat",
        test: (t) => hasAny(t, ["比熱", "cA", "cB", "熱容量"]),
        gentle: (t) =>
          "「" + snip(t) + "」— 比熱 c が Teq に効くという考えです。水と鉄など c が違う組み合わせで 2 回接触測定すると、Teq の差が表に現れます。",
        expert: (t) =>
          "「" + snip(t) + "」— 比熱 c による Teq シフトについての記述です。materialPair を操作変数にした対照実験が有効です。",
      },
      {
        id: "object_ab",
        test: (t) => hasAny(t, ["物体A", "物体B", "AとB", "A と B"]),
        gentle: (t) =>
          "「" + snip(t) + "」— 物体 A と B を対にした文です。T–t グラフでは A=橙・B=青の 2 本で、どちらが温まり/冷えるか読み取れます。",
        expert: (t) =>
          "「" + snip(t) + "」— 二物体系の記述です。ΔTA と ΔTB の符号の逆転（一方が失熱・他方が得熱）を表で確認してください。",
      },
      {
        id: "water_iron",
        test: (t) => hasAll(t, ["水", "鉄"]) || hasAll(t, ["水", "鉄"]),
        gentle: (t) =>
          "「" + snip(t) + "」— 水と鉄の組み合わせです。水の c が大きいので、Teq は水側（A または B）の初期温度に近づきやすい傾向があります。",
        expert: (t) =>
          "「" + snip(t) + "」— 水–鉄系（c_water >> c_iron）の記述です。Teq の理論値と mc 比の関係を数値で照合してください。",
      },
      {
        id: "graph_data",
        test: (t) => hasAny(t, ["グラフ", "曲線", "傾き", "表", "データ", "測定", "T–t", "T-t"]),
        gentle: (t) =>
          "「" + snip(t) + "」— 記録したグラフ・表を根拠にしようとしています。⑤の接触セッション表と⑥の T–t グラフのどの部分を指しているか一文足すと考察が具体化します。",
        expert: (t) =>
          "「" + snip(t) + "」— 実測データ参照型の記述です。引用する特徴（Teq・Q 値・T–t 収束）を明示すると議論が検証可能になります。",
      },
      {
        id: "why_general",
        test: (t) => isQuestion(t),
        gentle: (t) => {
          const w = quotedWords(t);
          const subj = w.length ? w.slice(0, 2).join("と") : "その現象";
          return "「" + snip(t) + "」— " + subj + " について“なぜ”を問う文です。左で 1 つ変数だけ変えて接触測定すると、理由の仮説をデータで確かめやすくなります。";
        },
        expert: (t) => {
          const w = quotedWords(t);
          const subj = w.length ? w.join("・") : "対象";
          return "「" + snip(t) + "」— " + subj + " に対する因果問いです。操作変数 1 つ・従属変数 Teq または Q に絞ると検証可能な予測に落とし込めます。";
        },
      },
      {
        id: "compare_general",
        test: (t) => hasAny(t, ["違", "比べ", "比較", "どちら", "より", "差"]),
        gentle: (t) =>
          "「" + snip(t) + "」— 2 つ以上を“比べる”意図が読み取れます。比べるなら m・初期温度をそろえたうえで、物質の組み合わせだけ変えるのが基本です。",
        expert: (t) =>
          "「" + snip(t) + "」— 比較検証型の記述です。統制条件（m, T₀）を固定し、比較軸（materialPair または tempDiff）を 1 つに限定すると議論が明確になります。",
      },
      {
        id: "hypothesis_link",
        test: (t, ctx) => (ctx.field === "hypothesisReason" || ctx.field === "hypothesis") && ctx.hypothesisLabel,
        gentle: (t, ctx) =>
          "理由「" + snip(t, 22) + "」は仮説「" + ctx.hypothesisLabel + "」を支える方向の記述です。接触測定後、この理由のどの部分が表・グラフと合ったか自分でチェックしてみましょう。",
        expert: (t, ctx) =>
          "根拠「" + snip(t, 22) + "」→ 仮説「" + ctx.hypothesisLabel + "」。予測とデータの対応を Q 値・Teq・T–t グラフで評価する枠組みが使えます。",
      },
      {
        id: "reflection_data",
        test: (t, ctx) => ctx.field === "reflection" && (ctx.resultCount || 0) > 0,
        gentle: (t, ctx) =>
          "「" + snip(t) + "」— すでに " + ctx.resultCount + " 回分の接触データがあります。この文に、表の Q_loss か Teq を 1 つ引用すると説得力が増します。",
        expert: (t, ctx) =>
          "考察「" + snip(t) + "」— 測定 " + ctx.resultCount + " セッションを参照可能です。主張ごとに対応する Q 値または Teq を紐づけてください。",
      },
      {
        id: "reflection_nodata",
        test: (t, ctx) => ctx.field === "reflection" && !(ctx.resultCount > 0),
        gentle: (t) =>
          "「" + snip(t) + "」— 考察の骨格は見えています。④で接触測定してから、同じ文に表の数値を 1 つ足すと一気に具体化します。",
        expert: (t) =>
          "「" + snip(t) + "」— 理論整理型の考察です。接触測定データ取得後、主張各文に evidence（Q, Teq）を追加すると検証可能になります。",
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
        ? "「" + s + "」だけでは意図が読み取りにくいです。例：「接触すると Q_loss と Q_gain は等しい？」のように、現象か数値を 1 語足してみてください。"
        : "入力「" + s + "」— 情報量が不足しています。操作変数（materialPair/m/tempDiff）のいずれかを明示してください。";
    }

    if (words.length >= 1) {
      const w = words.join("・");
      if (mode === "gentle") {
        return "「" + s + "」— 文中の「" + w + "」がキーワードです。この語が表のどの列（Q_loss・Teq・ΔTA）と関係するか、自分で 1 つ指定してみましょう。";
      }
      return "「" + s + "」— 検出語：" + w + "。この語を従属変数 Teq または Q に結びつけると、探究が具体化します。";
    }

    if (field === "planText" || field === "plan") {
      return mode === "gentle"
        ? "「" + s + "」— 計画として「先に水–鉄、次に水–アルミ」「TA=80℃ 固定」など、順番とそろえる条件を 1 行足すと実行しやすくなります。"
        : "計画「" + s + "」— 操作手順と統制条件（m, T₀, 物質組）を追記してください。";
    }

    if (field === "summaryText") {
      return mode === "gentle"
        ? "「" + s + "」— まとめに、自分の問い（①）か仮説（②）から単語を 1 つ引用すると、他の人にも伝わりやすくなります。"
        : "まとめ「" + s + "」— 問い→仮説→接触実験→考察のどの段階の学びか、キーワードを 1 つ明示してください。";
    }

    const tail = t.slice(-Math.min(8, t.length));
    return mode === "gentle"
      ? "「" + s + "」— 特に「" + tail + "」の部分が気になります。これは Q・Teq・温度差のどれについて言っていますか？"
      : "記述「" + s + "」— 末尾「" + tail + "」を、Q_loss=Q_gain / Teq / 比熱 c のいずれかに関連づけて再記述してみてください。";
  }

  function generateComment(opts) {
    const field = opts.field || "question";
    const text = norm(opts.text || "");
    const mode = opts.mode === "expert" ? "expert" : opts.mode === "gentle" ? "gentle" : getMode();
    const max = lineBudget(text);
    const ctx = { ...(opts.context || {}), field };

    if (!text) {
      const empty = {
        mission: { gentle: "ミッションを選ぶと、その問いに合わせたコメントがここに出ます。", expert: "ミッション（問い）を選択してください。選択内容に連動したフィードバックを返します。" },
        hypothesis: { gentle: "仮説を選び、必要なら一言補足を書くと、その組み合わせ専用のコメントが出ます。", expert: "仮説選択＋自由記述を入力すると、検証可能な予測への変換を支援します。" },
        plan: { gentle: "実験計画を選ぶと、ねらいに沿った実行のヒントがここに出ます。", expert: "実験計画を選択すると、操作変数と統制条件の観点でフィードバックします。" },
        question: { gentle: "問いの欄に一文入力すると、その言葉に合わせたコメントがここに出ます。", expert: "問いを入力してください。入力語に連動したフィードバックを返します。" },
        planText: { gentle: "実験の順番（例：水–鉄→水–アルミ）を書くと、計画に沿ったコメントが出ます。", expert: "操作手順を入力すると、統制条件の観点でフィードバックします。" },
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
        lines.push("この文では「" + w[0] + "」と「" + w[1] + "」が両方出てきます。どちらを先に接触実験で確かめるか決めると、探究の順序がはっきりします。");
      } else if (w.length >= 2 && mode === "expert") {
        lines.push("複合キーワード（" + w.slice(0, 3).join("・") + "）— 一度に 1 変数ずつ操作した方が因果が読み取りやすくなります。");
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
