/**
 * ブラウン運動 — ミッション型探究（問い・仮説・実験計画）
 */
(function (global) {
  "use strict";

  const MISSIONS = [
    {
      id: "temp_brownian",
      title: "温度を上げるとブラウン運動は激しくなる",
      description: "300K→400K→500K と温度を変え、大粒子の平均速度と軌跡の広がりを測って確かめよう。",
    },
    {
      id: "particle_size",
      title: "大粒子が大きいほど動きは小さく見える",
      description: "半径 14px と 26px の大粒子で同温度のブラウン運動を比べ、同じキックでも見かけの動きがどう違うか調べよう。",
    },
    {
      id: "particle_count",
      title: "分子数が多いほどキックが増え運動が活発になる",
      description: "N=50 と N=150 で同温度の衝突回数と大粒子の速度を比べ、分子数とブラウン運動の関係を確かめよう。",
    },
    {
      id: "molecular_kicks",
      title: "ブラウン運動は分子の衝突が原因",
      description: "温度・分子数を変えてキックの回数と大粒子の動きを記録し、不規則な運動の原因をデータで確かめよう。",
    },
  ];

  const HYPOTHESES = [
    {
      id: "tb_h1", missionId: "temp_brownian", text: "温度が高いほど大粒子の平均速度は大きくなる", legacyKey: "stronger",
      reason: "温度が高いほど分子の熱運動が激しく、大粒子へのキックも強くなるはず",
    },
    {
      id: "tb_h2", missionId: "temp_brownian", text: "温度を上げても平均速度はあまり変わらない", legacyKey: "same",
      reason: "大粒子の質量が大きいので、分子の速度が上がっても動きは同じに見えるはず",
    },
    {
      id: "tb_h3", missionId: "temp_brownian", text: "温度が高いほど大粒子の動きは小さくなる", legacyKey: "weaker",
      reason: "高温では分子が速く通り過ぎ、大粒子への力は相殺されやすいはず",
    },
    {
      id: "tb_h4", missionId: "temp_brownian", text: "300K と 500K で軌跡の広がりがはっきり違う", legacyKey: "stronger",
      reason: "温度差が大きいほど平均速度の差が表に出やすいはず",
    },
    {
      id: "ps_h1", missionId: "particle_size", text: "大粒子ほど平均速度は小さく見える", legacyKey: "weaker",
      reason: "質量が大きいほど同じキックでの加速度は小さく、動きは鈍く見えるはず",
    },
    {
      id: "ps_h2", missionId: "particle_size", text: "粒子サイズが違っても平均速度は同じ", legacyKey: "same",
      reason: "同じ温度なら分子のキックは同じで、大粒子の速度も同じになるはず",
    },
    {
      id: "ps_h3", missionId: "particle_size", text: "大粒子ほど軌跡の広がりは小さい", legacyKey: "weaker",
      reason: "半径が大きい粒子は同じ変位でも見かけの揺れが小さく見えるはず",
    },
    {
      id: "ps_h4", missionId: "particle_size", text: "小さい大粒子のほうがキックの影響を受けやすい", legacyKey: "stronger",
      reason: "質量が小さいほど同じ力で大きく動くはず",
    },
    {
      id: "pc_h1", missionId: "particle_count", text: "分子数 N が多いほど平均速度は大きくなる", legacyKey: "stronger",
      reason: "衝突回数が増えるほど大粒子へのキックが多く、動きが活発になるはず",
    },
    {
      id: "pc_h2", missionId: "particle_count", text: "分子数が違っても平均速度は同じ", legacyKey: "same",
      reason: "同じ温度なら分子1個あたりの速度は同じで、大粒子の速度も同じはず",
    },
    {
      id: "pc_h3", missionId: "particle_count", text: "N が多いほどキック回数は増えるが速度は変わらない", legacyKey: "same",
      reason: "キックは増えても向きがランダムなので平均速度は同じになるはず",
    },
    {
      id: "pc_h4", missionId: "particle_count", text: "N=50 と N=150 で軌跡の広がりが違う", legacyKey: "stronger",
      reason: "分子数が多いほど不規則なキックが重なり、動きが大きく見えるはず",
    },
    {
      id: "mk_h1", missionId: "molecular_kicks", text: "キック回数が多いほど大粒子の動きは激しい", legacyKey: "stronger",
      reason: "分子衝突がブラウン運動の原因なら、キックが多いほど動きが大きいはず",
    },
    {
      id: "mk_h2", missionId: "molecular_kicks", text: "温度を上げるとキック回数も平均速度も増える", legacyKey: "stronger",
      reason: "高温で分子が速く動くので、衝突回数とキックの強さが増えるはず",
    },
    {
      id: "mk_h3", missionId: "molecular_kicks", text: "キックがなくても大粒子は動き続ける", legacyKey: "same",
      reason: "一度動き出した大粒子は慣性で止まらないので、キックは関係ないはず",
    },
    {
      id: "mk_h4", missionId: "molecular_kicks", text: "分子数を減らすとキックが減り動きが弱くなる", legacyKey: "weaker",
      reason: "衝突相手が少ないほど大粒子への力は小さくなるはず",
    },
  ];

  const PLANS = [
    {
      id: "tb_p1", missionId: "temp_brownian",
      text: "300K・400K・500K の3条件で測定し平均速度を比べる",
      compare: "低温（300K）と高温（500K）の2条件を比較する",
      purpose: "温度と大粒子の平均速度の関係を表に残す",
      planChecks: { temperature: true, particleSize: false, particleCount: false },
    },
    {
      id: "tb_p2", missionId: "temp_brownian",
      text: "温度だけを 100K 刻みで変えてデータを取る",
      compare: "温度が低い条件と高い条件を順に比較する",
      purpose: "温度上昇に伴う平均速度の増え方を調べる",
      planChecks: { temperature: true, particleSize: false, particleCount: false },
    },
    {
      id: "tb_p3", missionId: "temp_brownian",
      text: "同じ大粒子サイズで温度系列を2回以上測定する",
      compare: "同条件の再測定で傾向が再現するか比較する",
      purpose: "温度–速度の関係の再現性を確かめる",
      planChecks: { temperature: true, particleSize: false, particleCount: false },
    },
    {
      id: "tb_p4", missionId: "temp_brownian",
      text: "軌跡表示をオンにして 300K と 500K の動きを観察する",
      compare: "300K と 500K の軌跡の広がりを目とデータで比較する",
      purpose: "グラフだけでなく視覚的なブラウン運動の違いも記録する",
      planChecks: { temperature: true, particleSize: false, particleCount: false },
    },
    {
      id: "ps_p1", missionId: "particle_size",
      text: "大粒子半径 14px と 26px で同温度（400K）のデータを取る",
      compare: "小さい大粒子と大きい大粒子の2条件を比較する",
      purpose: "粒子サイズと平均速度・軌跡の関係を確かめる",
      planChecks: { temperature: true, particleSize: true, particleCount: false },
    },
    {
      id: "ps_p2", missionId: "particle_size",
      text: "半径 18px を基準に小・大の2条件で測定する",
      compare: "基準サイズより小さい条件と大きい条件を比較する",
      purpose: "サイズ差がブラウン運動の見え方にどう効くか調べる",
      planChecks: { temperature: true, particleSize: true, particleCount: false },
    },
    {
      id: "ps_p3", missionId: "particle_size",
      text: "温度をそろえたうえで粒子サイズだけを変える",
      compare: "同じ 400K でサイズだけ異なる2条件を比較する",
      purpose: "温度の影響を除いてサイズ効果だけを見る",
      planChecks: { temperature: true, particleSize: true, particleCount: false },
    },
    {
      id: "ps_p4", missionId: "particle_size",
      text: "サイズを変えながら軌跡の広がりを記録する",
      compare: "小半径と大半径で軌跡の広がりを比較する",
      purpose: "見かけの動きの違いを定量的に残す",
      planChecks: { temperature: true, particleSize: true, particleCount: false },
    },
    {
      id: "pc_p1", missionId: "particle_count",
      text: "N=50・100・150 の3条件で同温度のデータを取る",
      compare: "N=50 と N=150 の2条件を比較する",
      purpose: "分子数と平均速度・キック回数の関係を調べる",
      planChecks: { temperature: true, particleSize: false, particleCount: true },
    },
    {
      id: "pc_p2", missionId: "particle_count",
      text: "分子数だけを変えて 400K で測定する",
      compare: "分子数が少ない条件と多い条件を比較する",
      purpose: "衝突回数の違いが大粒子の動きにどう表れるか見る",
      planChecks: { temperature: true, particleSize: false, particleCount: true },
    },
    {
      id: "pc_p3", missionId: "particle_count",
      text: "同じ大粒子サイズで N を2段階以上変える",
      compare: "N が小さいときと大きいときの平均速度を比較する",
      purpose: "分子数効果を表とグラフで確かめる",
      planChecks: { temperature: true, particleSize: false, particleCount: true },
    },
    {
      id: "pc_p4", missionId: "particle_count",
      text: "キック回数（HUD）も見ながら N=50 と 150 を測定する",
      compare: "キック回数と平均速度が N でどう違うか比較する",
      purpose: "分子衝突の回数とブラウン運動の関係を確かめる",
      planChecks: { temperature: true, particleSize: false, particleCount: true },
    },
    {
      id: "mk_p1", missionId: "molecular_kicks",
      text: "温度 300K と 500K でキック回数と平均速度を記録する",
      compare: "低温と高温でキック回数・平均速度の両方を比較する",
      purpose: "分子の熱運動とブラウン運動のつながりを確かめる",
      planChecks: { temperature: true, particleSize: false, particleCount: true },
    },
    {
      id: "mk_p2", missionId: "molecular_kicks",
      text: "N と T の両方を変えてキックと速度の関係を調べる",
      compare: "キックが多い条件と少ない条件で大粒子の動きを比較する",
      purpose: "衝突の多さが不規則な動きの原因か確かめる",
      planChecks: { temperature: true, particleSize: false, particleCount: true },
    },
    {
      id: "mk_p3", missionId: "molecular_kicks",
      text: "同温度で N だけを変え、キック回数の差を記録する",
      compare: "N=50 と N=150 のキック回数と平均速度を比較する",
      purpose: "分子数がキック回数に与える効果を分離して見る",
      planChecks: { temperature: true, particleSize: false, particleCount: true },
    },
    {
      id: "mk_p4", missionId: "molecular_kicks",
      text: "軌跡・ベクトル表示を使い衝突の様子を観察しながら測定する",
      compare: "キックが目立つ条件と目立たない条件を比較する",
      purpose: "分子衝突と大粒子の動きを視覚とデータの両方で確かめる",
      planChecks: { temperature: true, particleSize: true, particleCount: true },
    },
  ];

  const DEFAULT_PLAN_CHECKS = { temperature: true, particleSize: false, particleCount: false };

  const SUMMARY_GUIDES = {
    temp_brownian: {
      answerLead: "温度を上げると分子の熱運動が激しくなり、ブラウン運動も強くなるから、",
      prompts: [
        "①の問い「温度を上げるとブラウン運動は激しくなる」— 表・グラフで温度と平均速度がどう違ったか答える",
        "②の仮説は支持・修正・棄却のどれか？ 根拠となるデータを1つ書く",
        "分子の平均速度 ⟨v⟩ と大粒子の動きの関係を短く説明する",
      ],
    },
    particle_size: {
      answerLead: "大粒子が大きいほど同じキックでも動きが小さく見えるから、",
      prompts: [
        "①の問い — 粒子サイズが違うと平均速度や軌跡はどう変わったか答える",
        "②の仮説と結果を照らし合わせ、支持・修正・棄却を決める",
        "質量・サイズとブラウン運動の見え方の関係をまとめる",
      ],
    },
    particle_count: {
      answerLead: "分子数が多いほど衝突（キック）が増え、ブラウン運動が活発になるから、",
      prompts: [
        "①の問い — N=50 と N=150 などでデータはどう違ったか答える",
        "キック回数と平均速度のデータから読み取れることを書く",
        "②の仮説は結果と一致したか",
      ],
    },
    molecular_kicks: {
      answerLead: "ブラウン運動は分子の不規則な衝突（キック）が原因だから、",
      prompts: [
        "①の問い — キック回数と大粒子の動きの関係を答える",
        "温度・分子数を変えたとき、キックと速度がどう連動したか",
        "②の仮説は「分子衝突が原因」という考えと合うか",
      ],
    },
  };

  const DEFAULT_SUMMARY_GUIDE = {
    answerLead: "実験から分かったこと：",
    prompts: [
      "①で選んだ探求テーマへの答え",
      "仮説と結果を比べ、支持・修正・棄却とその根拠",
      "考察の要点を短くまとめる",
    ],
  };

  function getAllMissions() { return MISSIONS.slice(); }
  function getMission(id) { return MISSIONS.find((m) => m.id === id) || null; }
  function getHypothesis(id) { return HYPOTHESES.find((h) => h.id === id) || null; }
  function getPlan(id) { return PLANS.find((p) => p.id === id) || null; }
  function getHypothesesForMission(missionId) { return HYPOTHESES.filter((h) => h.missionId === missionId); }
  function getPlansForMission(missionId) { return PLANS.filter((p) => p.missionId === missionId); }
  function getSummaryGuide(missionId) { return SUMMARY_GUIDES[missionId] || DEFAULT_SUMMARY_GUIDE; }

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
    if (plan) {
      out.planText = plan.text +
        (plan.compare ? "（比較：" + plan.compare + "）" : "") +
        "（ねらい：" + plan.purpose + "）";
      out.planChecks = { ...plan.planChecks };
    } else if (!out.planId) {
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
