/**
 * 探究学習の伴走AI — 入力文に連動するルールベースコメント
 * 正解・数値計算は提示しない。似た汎用文は使わない。
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
      ["水", "水"], ["氷", "氷"], ["蒸気", "水蒸気"], ["鉄", "鉄"], ["アルミ", "アルミ"],
      ["比熱", "比熱"], ["熱容量", "熱容量"], ["潜熱", "潜熱"], ["融解", "融解"], ["沸騰", "沸騰"],
      ["固体", "固体"], ["液体", "液体"], ["気体", "気体"], ["平台", "温度平台"],
      ["ΔT", "ΔT"], ["温度", "温度"], ["加熱", "加熱"], ["質量", "質量"], ["物質", "物質"],
      ["性質", "物質の性質"], ["Q", "熱量Q"], ["mcΔT", "Q=mcΔT"],
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

  /** 上ほど優先。最初に当たったルールが主コメント。 */
  function buildRuleCatalog() {
    return [
      {
        id: "water_iron_delta",
        test: (t) => hasAll(t, ["水", "鉄"]) && hasAny(t, ["ΔT", "温度", "温まり", "上がり", "違", "比"]),
        gentle: (t) =>
          "「" + snip(t) + "」— 水と鉄の ΔT の違いに直接触れています。左で Q=2000J・m=500g をそろえ、両方「測定する」と表の数値と自分の文が結びつきます。",
        expert: (t) =>
          "記述「" + snip(t) + "」は比較対象（水・鉄）と従属変数（ΔT）が明示されています。操作変数 Q, m を固定した対照実験で検証可能な問いです。",
      },
      {
        id: "water_slow_warm",
        test: (t) => hasAny(t, ["水", "氷"]) && hasAny(t, ["温まりにく", "温まりにくい", "上がりにく", "なかなか上が", "時間がかか"]),
        gentle: (t) =>
          "「" + snip(t) + "」— “水は温まりにくい” という日常の感覚を問いにしていますね。同じ Q で鉄の ΔT と並べると、自分の言葉の意味がデータで確かめられます。",
        expert: (t) =>
          "「" + snip(t) + "」— 水側の ΔT 相対的低下（比熱 c が大きい効果）を疑問化した記述です。Q–T グラフの傾き比較と対応づけてください。",
      },
      {
        id: "iron_fast_warm",
        test: (t) => has(t, "鉄") && hasAny(t, ["温まりやす", "すぐ上が", "早く上が", "ΔTが大"]),
        gentle: (t) =>
          "「" + snip(t) + "」— 鉄はすぐ温まる、という予感を言葉にしていますね。水と Q・m を揃えて測ると、鉄側の ΔT が表に残り、仮説と照合できます。",
        expert: (t) =>
          "「" + snip(t) + "」— 鉄の ΔT 相対的増大を予想する記述です。比輴 c の小ささと整合するか、測定後に定性的に評価しましょう。",
      },
      {
        id: "melt_boil_plateau",
        test: (t) => hasAny(t, ["融解", "沸騰", "平台", "0℃", "0度", "100℃", "100度", "一定", "上がらない", "止ま"]),
        gentle: (t) => {
          const w = quotedWords(t).filter((x) => ["融解", "沸騰", "温度平台"].includes(x));
          const focus = w.length ? w.join("・") : "状態変化";
          return "「" + snip(t) + "」— " + focus + " 中の温度の動きが問いの中心です。水を十分加熱すると結果表に「固体→液体」「液体→気体」行（ΔT=0）が出ます。";
        },
        expert: (t) =>
          "「" + snip(t) + "」— 潜熱区間（融解・沸騰）の平台を問う記述です。顕熱区間との ΔT 差を区間別表で分離して読み取ってください。",
      },
      {
        id: "latent_explicit",
        test: (t) => hasAny(t, ["潜熱", "融解熱", "汽化熱", "Lf", "Lv"]),
        gentle: (t) =>
          "「" + snip(t) + "」— 潜熱という言葉を自分で使えています。加熱しても温度が止まる区間の表の行と、この文を並べてみましょう。",
        expert: (t) =>
          "「" + snip(t) + "」— エネルギーが顕熱ではなく潜熱に使われる区間についての記述です。Q–T 曲線の水平部分と対応づけ可能です。",
      },
      {
        id: "mcqt_formula",
        test: (t) => hasAny(t, ["mcΔT", "Q=mc", "Q＝mc", "mcΔ", "比熱容"]) || (has(t, "Q") && hasAny(t, ["mc", "式", "公式"])),
        gentle: (t) =>
          "「" + snip(t) + "」— Q = mcΔT を問いに組み込んでいます。グラフの Q 軸と T 軸を見ながら、どの文字が表のどの列か対応づけてみてください。",
        expert: (t) =>
          "「" + snip(t) + "」— 定式 Q = mcΔT に言及した記述です。操作変数（Q, m, 物質→c）と ΔT の関係を、数値代入前に定性的に整理しましょう。",
      },
      {
        id: "specific_heat_word",
        test: (t) => hasAny(t, ["比熱", "熱容量"]),
        gentle: (t) =>
          "「" + snip(t) + "」— “比熱” に注目した問いです。同じ Q でも ΔT が変わる理由を、水と鉄の2回測定で自分の言葉と結びつけられます。",
        expert: (t) =>
          "「" + snip(t) + "」— 比熱 c / 熱容量 mc が鍵になる記述です。ΔT ∝ 1/c の関係を、グラフ傾きの比として読む視点が有効です。",
      },
      {
        id: "material_property",
        test: (t) => hasAny(t, ["物質", "性質", "素性", "sosei", "material"]) && !hasAll(t, ["水", "鉄"]),
        gentle: (t) =>
          "「" + snip(t) + "」— 特定の数値より“物質の性質”そのものを問う書き方です。まず水→鉄の順に測り、表の「区間・状態」列ごとの ΔT を比べてみましょう。",
        expert: (t) =>
          "「" + snip(t) + "」— 物質固有量（比熱 c）の違いを背景にした記述です。比較実験で c の効果が ΔT にどう現れるか、データ列を指定して検証しましょう。",
      },
      {
        id: "mass_effect",
        test: (t) => hasAny(t, ["質量", "重さ", "500g", "グラム"]) || (/\bm\b/.test(t) && hasAny(t, ["大き", "小さ", "変"])),
        gentle: (t) =>
          "「" + snip(t) + "」— 質量 m に言及していますね。③で「質量 m」にチェックを入れると左のスライダが使え、同じ物質で m だけ変えた比較ができます。",
        expert: (t) =>
          "「" + snip(t) + "」— 熱容量 C=mc の m 依存を問う記述です。Q 一定で m を操作変数にしたとき ΔT がどう変わるか、表で確認できます。",
      },
      {
        id: "heatq_effect",
        test: (t) => hasAny(t, ["加熱量", "熱量", "2000J", "ジュール"]) || (has(t, "Q") && hasAny(t, ["大き", "小さ", "増", "与"])),
        gentle: (t) =>
          "「" + snip(t) + "」— 与える Q の大きさが焦点です。同じ物質・同じ m で Q だけ変えて測ると、ΔT が Q とどう結びつくか自分で確かめられます。",
        expert: (t) =>
          "「" + snip(t) + "」— 独立変数 Q に着目した記述です。Q–T グラフ上で Q 増加に対する T 上昇率（傾き）を読み取ると整理が進みます。",
      },
      {
        id: "water_only",
        test: (t) => hasAny(t, ["水", "氷", "蒸気"]) && !has(t, "鉄"),
        gentle: (t) =>
          "「" + snip(t) + "」— 水（氷・蒸気含む）だけを主語にした文です。水の固体→液体→気体と区間が増える点も、あとで表に残ります。",
        expert: (t) =>
          "「" + snip(t) + "」— 水の相変化を含む記述です。比熱 c と潜熱 Lf, Lv が混在するため、区間別の結果行で分けて解釈してください。",
      },
      {
        id: "iron_only",
        test: (t) => has(t, "鉄") && !hasAny(t, ["水", "氷"]),
        gentle: (t) =>
          "「" + snip(t) + "」— 鉄だけについて書いています。鉄は状態変化がなく ΔT が一直線に読みやすいので、Q–T グラフ②との対応が取りやすいです。",
        expert: (t) =>
          "「" + snip(t) + "」— 単相（固体）加熱として扱える記述です。Q = mcΔT が区間分割なしで適用できるケースとしてデータを読んでください。",
      },
      {
        id: "graph_data",
        test: (t) => hasAny(t, ["グラフ", "曲線", "傾き", "表", "データ", "測定", "点"]),
        gentle: (t) =>
          "「" + snip(t) + "」— 記録したグラフ・表を根拠にしようとしています。⑤の区間別表と⑥の Q–T グラフの、どの部分を指しているか一文足すと考察が具体化します。",
        expert: (t) =>
          "「" + snip(t) + "」— 実測データ参照型の記述です。引用するグラフ特征（傾き・平台・区間名）を明示すると、因果の議論が検証可能になります。",
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
          return "「" + snip(t) + "」— " + subj + " に対する因果問いです。操作変数1つ・従属変数 ΔT に絞ると、検証可能な予測に落とし込めます。";
        },
      },
      {
        id: "compare_general",
        test: (t) => hasAny(t, ["違", "比べ", "比較", "どちら", "より", "差"]),
        gentle: (t) =>
          "「" + snip(t) + "」— 2つ以上を“比べる”意図が読み取れます。比べるなら Q・m・初期温度をそろえたうえで、物質だけ変えるのがこのシミュの基本です。",
        expert: (t) =>
          "「" + snip(t) + "」— 比較検証型の記述です。統制条件（Q, m, T₀）を固定し、比較軸（物質 c または区間）を1つに限定すると議論が明確になります。",
      },
      {
        id: "hypothesis_link",
        test: (t, ctx) => (ctx.field === "hypothesisReason" || ctx.field === "hypothesis") && ctx.hypothesisLabel,
        gentle: (t, ctx) =>
          "理由「" + snip(t, 22) + "」は仮説「" + ctx.hypothesisLabel + "」を支える方向の記述です。測定後、この理由のどの部分が表・グラフと合ったか自分でチェックしてみましょう。",
        expert: (t, ctx) =>
          "根拠「" + snip(t, 22) + "」→ 仮説「" + ctx.hypothesisLabel + "」。予測とデータの対応関係を、ΔT の大小または平台の有無で評価する枠組みが使えます。",
      },
      {
        id: "reflection_data",
        test: (t, ctx) => ctx.field === "reflection" && (ctx.resultCount || 0) > 0,
        gentle: (t, ctx) =>
          "「" + snip(t) + "」— すでに " + ctx.resultCount + " 区間分のデータがあります。この文に、表の「区間・状態」か数値（加熱前T・ΔT）を1つ引用すると説得力が増します。",
        expert: (t, ctx) =>
          "考察「" + snip(t) + "」— 測定 " + ctx.resultCount + " 行を参照可能です。定性的主張ごとに、対応する区間行または Q–T グラフ上の特徴を紐づけてください。",
      },
      {
        id: "reflection_nodata",
        test: (t, ctx) => ctx.field === "reflection" && !(ctx.resultCount > 0),
        gentle: (t) =>
          "「" + snip(t) + "」— 考察の骨格は見えています。④で水・鉄を測定してから、同じ文に表の数値を1つ足すと一気に具体化します。",
        expert: (t) =>
          "「" + snip(t) + "」— 理論整理型の考察です。測定データ取得後、主張各文に対応する evidence（区間・ΔT）を追加すると検証可能になります。",
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
        ? "「" + s + "」だけでは意図が読み取りにくいです。例：「水はなぜ温まりにくい？」のように、物質名か現象を1語足してみてください。"
        : "入力「" + s + "」— 情報量が不足しています。操作変数（物質/Q/m）のいずれかを明示してください。";
    }

    if (words.length >= 1) {
      const w = words.join("・");
      if (mode === "gentle") {
        return "「" + s + "」— 文中の「" + w + "」がキーワードです。この語が表のどの列（ΔT・区間・物質）と関係するか、自分で1つ指定してみましょう。";
      }
      return "「" + s + "」— 検出語：" + w + "。この語を従属変数 ΔT または区間状態のどちらに結びつけるか決めると、探究が具体化します。";
    }

    if (field === "planText" || field === "plan") {
      return mode === "gentle"
        ? "「" + s + "」— 計画として「先に水、次に鉄」「Qは2000J固定」など、順番とそろえる条件を1行足すと実行しやすくなります。"
        : "計画「" + s + "」— 操作手順（物質切替順）と統制条件（Q, m, T₀）を追記してください。";
    }

    if (field === "summaryText") {
      return mode === "gentle"
        ? "「" + s + "」— まとめに、自分の問い（①）か仮説（②）から単語を1つ引用すると、他の人にも伝わりやすくなります。"
        : "まとめ「" + s + "」— 問い→仮説→実験→考察のどの段階の学びか、キーワードを1つ明示してください。";
    }

    const tail = t.slice(-Math.min(8, t.length));
    return mode === "gentle"
      ? "「" + s + "」— 特に「" + tail + "」の部分が気になります。これは温度・物質・状態変化のどれについて言っていますか？"
      : "記述「" + s + "」— 末尾「" + tail + "」を、ΔT / 比熱 c / 潜熱のいずれかに関連づけて再記述してみてください。";
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
        planText: { gentle: "実験の順番（例：水→鉄、Q固定）を書くと、計画に沿ったコメントが出ます。", expert: "操作手順を入力すると、統制条件の観点でフィードバックします。" },
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
    const resultCount = global.InquiryStorage?.mergeResultsByInterval
      ? global.InquiryStorage.mergeResultsByInterval(st.results || []).length
      : (st.results || []).length;
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
