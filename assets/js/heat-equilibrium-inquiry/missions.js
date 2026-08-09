/**
 * 熱平衡探究 — ミッション型探究マスタデータ
 */
(function (global) {
  "use strict";

  const MISSIONS = [
    {
      id: "heat_conservation",
      title: "接触すると、失った熱量＝得た熱量になる",
      description: "物体AとBを接触させ、Aが失う熱量とBが得る熱量が等しいか、表の数値で確かめよう。",
    },
    {
      id: "teq_formula",
      title: "接触後、2物体の温度はどこでそろうか",
      description: "接触が終わって2物体の温度が一致するとき（熱平衡）の温度を予想し、シミュレーションの結果と比べよう。",
    },
    {
      id: "mass_specific_heat",
      title: "質量や比熱が大きいほど、最終温度はその物体に近づく",
      description: "物体A・Bの質量や比熱を変えると、接触後にそろう共通温度がどう変わるか、複数回測って調べよう。",
    },
    {
      id: "material_compare",
      title: "水と鉄など、物質の組み合わせで最終温度が変わる",
      description: "A・Bに選ぶ物質（水・鉄・アルミなど）を変え、同じ初期温度でも接触後の共通温度がどう違うか比べよう。",
    },
  ];

  const HYPOTHESES = [
    {
      id: "hc_h1", missionId: "heat_conservation", text: "接触後、Aが失う熱量とBが得る熱量は等しい", legacyKey: "q_equal",
      reason: "熱は一方から他方へ移るだけなので、失った量と得た量は等しくなるはず",
    },
    {
      id: "hc_h2", missionId: "heat_conservation", text: "最初の温度差が大きいほど、移動する熱量も大きい", legacyKey: "temp_diff_q",
      reason: "初期の温度差が大きいほど、移動する熱量も大きくなるはず",
    },
    {
      id: "hc_h3", missionId: "heat_conservation", text: "接触時間が長いほど、移動した熱量の合計は大きくなる", legacyKey: "time_q",
      reason: "熱の移動が続くほど、失った・得た熱量の合計が大きくなるはず",
    },
    {
      id: "hc_h4", missionId: "heat_conservation", text: "最初から同じ温度なら、移動する熱量は0", legacyKey: "q_zero",
      reason: "温度差がなければ熱は移動しないので、熱量は0になるはず",
    },
    {
      id: "tf_h1", missionId: "teq_formula", text: "最終温度は、2物体の初期温度の間にある", legacyKey: "teq_between",
      reason: "高温側は冷え、低温側は温まるので、最終温度は中間付近になるはず",
    },
    {
      id: "tf_h2", missionId: "teq_formula", text: "質量×比熱（熱容量）が大きい物体ほど、最終温度はその物体の初期温度に近い", legacyKey: "teq_weighted",
      reason: "温まりにくい・冷めにくい物体ほど、最終温度はその物体側に引き寄せられるはず",
    },
    {
      id: "tf_h3", missionId: "teq_formula", text: "シミュレーションの最終温度と、式で求めた値はほぼ一致する", legacyKey: "teq_match",
      reason: "理論式どおり計算した温度と、接触後の温度が一致するはず",
    },
    {
      id: "tf_h4", missionId: "teq_formula", text: "同じ物質・同じ質量なら、最終温度は2つの初期温度の平均", legacyKey: "teq_arithmetic",
      reason: "条件がそろえば、最終温度＝（Aの温度＋Bの温度）÷2 になるはず",
    },
    {
      id: "ms_h1", missionId: "mass_specific_heat", text: "Aの質量が大きいほど、最終温度はAの初期温度に近づく", legacyKey: "mass_a_te",
      reason: "Aの質量が大きいほど、Aの温度の影響が強く残るはず",
    },
    {
      id: "ms_h2", missionId: "mass_specific_heat", text: "比熱が大きい物質ほど、最終温度はその物質の初期温度に近い", legacyKey: "c_affects_teq",
      reason: "比熱が大きいと温まりにくいので、最終温度はその物質側に引かれるはず",
    },
    {
      id: "ms_h3", missionId: "mass_specific_heat", text: "同じ熱量なら、質量を2倍にすると温度変化は半分になる", legacyKey: "mass_half_dt",
      reason: "質量が大きいほど、同じ熱量でも温度の変化は小さくなるはず",
    },
    {
      id: "ms_h4", missionId: "mass_specific_heat", text: "質量と比熱を同時に変えると、最終温度の予測が難しい", legacyKey: "mc_complex",
      reason: "質量×比熱の積が効くので、両方変えると最終温度の変化は複雑になるはず",
    },
    {
      id: "mc_h1", missionId: "material_compare", text: "水（A）と鉄（B）では、最終温度は水側に近い", legacyKey: "water_iron_teq",
      reason: "水の比熱が大きいので、最終温度は高温側の水の温度に近づくはず",
    },
    {
      id: "mc_h2", missionId: "material_compare", text: "同じ質量・同じ初期温度でも、物質が違えば最終温度も違う", legacyKey: "material_teq",
      reason: "比熱が違うと温まり方が変わるので、最終温度も変わるはず",
    },
    {
      id: "mc_h3", missionId: "material_compare", text: "アルミと鉄では最終温度が同じになる", legacyKey: "same_teq",
      reason: "同じ質量・同じ初期温度なら、金属同士で最終温度も同じになるはず",
    },
    {
      id: "mc_h4", missionId: "material_compare", text: "AとBを入れ替えても最終温度は同じ", legacyKey: "swap_same",
      reason: "2物体の接触は対称なので、入れ替えても最終温度は変わらないはず",
    },
  ];

  const PLANS = [
    {
      id: "hc_p1", missionId: "heat_conservation",
      text: "水（A）と鉄（B）を接触させ、失った熱量と得た熱量を記録する",
      compare: "同じ条件で2回以上接触し、失った量＝得た量か確認する",
      purpose: "熱量保存（失った熱量＝得た熱量）を数値で確かめる",
      planChecks: { materialPair: true, massA: false, massB: false, tempDiff: false },
    },
    {
      id: "hc_p2", missionId: "heat_conservation",
      text: "最初の温度差だけを変えて、移動する熱量の大きさを調べる",
      compare: "温度差が小さい条件と大きい条件で移動熱量を比較する",
      purpose: "温度差と移動する熱量の関係を調べる",
      planChecks: { materialPair: true, massA: false, massB: false, tempDiff: true },
    },
    {
      id: "hc_p3", missionId: "heat_conservation",
      text: "最初から同じ温度のとき、移動する熱量が0になるか確かめる",
      compare: "温度差あり・なしの2条件を比較する",
      purpose: "温度差がなければ熱が移動しないことを確かめる",
      planChecks: { materialPair: true, massA: false, massB: false, tempDiff: true },
    },
    {
      id: "hc_p4", missionId: "heat_conservation",
      text: "物質の組み合わせを変えても、失った熱量＝得た熱量か調べる",
      compare: "水–鉄・水–アルミなど複数の組み合わせを比較する",
      purpose: "物質に関係なく熱量保存が成り立つか確かめる",
      planChecks: { materialPair: true, massA: false, massB: false, tempDiff: false },
    },
    {
      id: "tf_p1", missionId: "teq_formula",
      text: "式で求めた最終温度と、接触後の温度を表で比べる",
      compare: "理論値と測定値の差を各回記録する",
      purpose: "最終温度の計算式が成り立つか確かめる",
      planChecks: { materialPair: true, massA: false, massB: false, tempDiff: false },
    },
    {
      id: "tf_p2", missionId: "teq_formula",
      text: "A・Bの初期温度を変えて、最終温度が2つの温度の間にあるか調べる",
      compare: "Aが高温・Aが低温の2パターンを比較する",
      purpose: "最終温度が初期温度の間に来ることを確かめる",
      planChecks: { materialPair: true, massA: false, massB: false, tempDiff: true },
    },
    {
      id: "tf_p3", missionId: "teq_formula",
      text: "温度–時間グラフで、2物体が同じ温度にそろうか見る",
      compare: "A（橙）とB（青）の2本の線が同じ温度で交わるか確認する",
      purpose: "グラフから熱平衡の様子を読み取る",
      planChecks: { materialPair: true, massA: false, massB: false, tempDiff: false },
    },
    {
      id: "tf_p4", missionId: "teq_formula",
      text: "同じ物質・同じ質量（各500g）で、最終温度が2つの初期温度の平均になるか調べる",
      compare: "同じ物質・同じ質量で初期温度だけ変えて最終温度を比較する",
      purpose: "条件がそろえば最終温度＝平均になることを確かめる",
      planChecks: { materialPair: true, massA: true, massB: true, tempDiff: true },
    },
    {
      id: "ms_p1", missionId: "mass_specific_heat",
      text: "Aの質量だけを変えて、最終温度の変化を記録する",
      compare: "Aの質量が小さい条件と大きい条件で最終温度を比較する",
      purpose: "Aの質量が最終温度に与える効果を調べる",
      planChecks: { materialPair: true, massA: true, massB: false, tempDiff: false },
    },
    {
      id: "ms_p2", missionId: "mass_specific_heat",
      text: "Bの質量だけを変えて、最終温度の変化を記録する",
      compare: "Bの質量が小さい条件と大きい条件で最終温度を比較する",
      purpose: "Bの質量が最終温度に与える効果を調べる",
      planChecks: { materialPair: true, massA: false, massB: true, tempDiff: false },
    },
    {
      id: "ms_p3", missionId: "mass_specific_heat",
      text: "AとBの質量を同時に変えて最終温度を比べる",
      compare: "AとBの質量比が違う2条件を比較する",
      purpose: "質量×比熱（熱容量）の比が最終温度を決めることを確かめる",
      planChecks: { materialPair: true, massA: true, massB: true, tempDiff: false },
    },
    {
      id: "ms_p4", missionId: "mass_specific_heat",
      text: "同じ質量で、比熱の違う2物質の最終温度を比べる",
      compare: "水–鉄と水–アルミなど比熱が違う組み合わせを比較する",
      purpose: "比熱の違いが最終温度にどう表れるか読み取る",
      planChecks: { materialPair: true, massA: false, massB: false, tempDiff: false },
    },
    {
      id: "mc_p1", missionId: "material_compare",
      text: "水（A）–鉄（B）と 水（A）–アルミ（B）の最終温度を比べる",
      compare: "Bの物質だけ変えた2条件を直接比較する",
      purpose: "Bの比熱が最終温度にどう効くか見る",
      planChecks: { materialPair: true, massA: false, massB: false, tempDiff: false },
    },
    {
      id: "mc_p2", missionId: "material_compare",
      text: "AとBの物質を入れ替えて、最終温度が変わるか調べる",
      compare: "水–鉄と 鉄–水の2条件を比較する",
      purpose: "物質の入れ替えで最終温度がどう変わるか確かめる",
      planChecks: { materialPair: true, massA: false, massB: false, tempDiff: false },
    },
    {
      id: "mc_p3", missionId: "material_compare",
      text: "温度差をそろえて3組み合わせの最終温度を記録する",
      compare: "水–鉄・鉄–アルミ・水–空気など複数組を比較する",
      purpose: "物質の組み合わせごとの最終温度の傾向を表にまとめる",
      planChecks: { materialPair: true, massA: false, massB: false, tempDiff: true },
    },
    {
      id: "mc_p4", missionId: "material_compare",
      text: "温度–時間グラフで、物質ごとの温度変化の速さを比べる",
      compare: "比熱が大きい物質ほど温度の変化が緩やかかグラフで確認する",
      purpose: "比熱の違いをグラフの傾きから読む",
      planChecks: { materialPair: true, massA: false, massB: false, tempDiff: false },
    },
  ];

  function getAllMissions() {
    return MISSIONS.slice();
  }

  function getMission(id) {
    return MISSIONS.find((m) => m.id === id) || null;
  }

  function getHypothesis(id) {
    return HYPOTHESES.find((h) => h.id === id) || null;
  }

  function getPlan(id) {
    return PLANS.find((p) => p.id === id) || null;
  }

  function getHypothesesForMission(missionId) {
    return HYPOTHESES.filter((h) => h.missionId === missionId);
  }

  function getPlansForMission(missionId) {
    return PLANS.filter((p) => p.missionId === missionId);
  }

  const DEFAULT_PLAN_CHECKS = { materialPair: true, massA: false, massB: false, tempDiff: false };

  const SUMMARY_GUIDES = {
    heat_conservation: {
      answerLead: "接触すると失った熱量と得た熱量が等しいのは、熱量保存の法則だから、",
      prompts: [
        "①の問い — 表の「失った熱量」と「得た熱量」を比べ、等しかったか答える",
        "温度差と移動する熱量の関係を、測定データから説明する",
        "②の仮説は支持・修正・棄却のどれか？ 根拠となる数値を1つ書く",
      ],
    },
    teq_formula: {
      answerLead: "質量×比熱（熱容量）が大きい物体ほど、最終温度はその物体の初期温度に近づくから、",
      prompts: [
        "①の問い — 式で求めた最終温度と、接触後の温度がどう一致したか答える",
        "最終温度が2物体の初期温度の間にある理由を説明する",
        "②の仮説と温度–時間グラフ・結果表を照らし合わせる",
      ],
    },
    mass_specific_heat: {
      answerLead: "質量や比熱が大きいほど、最終温度はその物体の初期温度に近づくから、",
      prompts: [
        "①の問い — 質量や比熱を変えたとき、最終温度がどう変わったか答える",
        "質量×比熱（熱容量）の違いが最終温度にどう表れたか",
        "②の仮説は、表の最終温度の列と一致したか",
      ],
    },
    material_compare: {
      answerLead: "物質（比熱）が違うと最終温度も変わるから、",
      prompts: [
        "①の問い — 水–鉄・水–アルミなどで最終温度がどう違ったか答える",
        "温度–時間グラフの2本の線から読み取れること",
        "②の仮説は、複数回の接触測定と一致したか",
      ],
    },
  };

  const DEFAULT_SUMMARY_GUIDE = {
    answerLead: "実験から分かったこと：",
    prompts: [
      "①で選んだ探求テーマへの答え（実験で分かったこと）",
      "仮説と結果を比べ、支持・修正・棄却のどれかとその根拠",
      "考察で書いた要点を、テーマへの答えとして短くまとめる",
    ],
  };

  function getSummaryGuide(missionId) {
    return SUMMARY_GUIDES[missionId] || DEFAULT_SUMMARY_GUIDE;
  }

  function formatMaterialPair(matA, matB) {
    const names = { water: "水", iron: "鉄", aluminum: "アルミ", air: "空気" };
    return (names[matA] || matA) + " – " + (names[matB] || matB);
  }

  function syncLegacyFields(state) {
    const out = { ...state };
    const mission = getMission(out.missionId);
    const hyp = getHypothesis(out.hypothesisId);
    const plan = getPlan(out.planId);

    if (mission) {
      out.question = mission.title + " — " + mission.description;
    }
    if (hyp) {
      out.hypothesis = hyp.legacyKey || "";
    }
    if (out.hypothesisFreeText != null) {
      out.hypothesisReason = out.hypothesisFreeText;
    }
    if (plan) {
      out.planText = plan.text +
        (plan.compare ? "（比較：" + plan.compare + "）" : "") +
        "（ねらい：" + plan.purpose + "）";
      out.planChecks = { ...plan.planChecks };
    } else if (!out.planId) {
      out.planChecks = { ...DEFAULT_PLAN_CHECKS };
    } else if (!out.planChecks || out.planChecks.materialPair === false) {
      out.planChecks = { ...DEFAULT_PLAN_CHECKS };
    }
    return out;
  }

  function applyPlanSelection(planId) {
    const plan = getPlan(planId);
    if (!plan) return {};
    return {
      planId,
      planChecks: { ...plan.planChecks },
      planText: plan.text +
        (plan.compare ? "（比較：" + plan.compare + "）" : "") +
        "（ねらい：" + plan.purpose + "）",
    };
  }

  global.InquiryMissions = {
    MISSIONS,
    HYPOTHESES,
    PLANS,
    DEFAULT_PLAN_CHECKS,
    formatMaterialPair,
    getAllMissions,
    getMission,
    getHypothesis,
    getPlan,
    getHypothesesForMission,
    getPlansForMission,
    getSummaryGuide,
    syncLegacyFields,
    applyPlanSelection,
  };
})(window);
