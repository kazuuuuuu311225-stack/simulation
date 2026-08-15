/**
 * ミッション型探究 — 問い・仮説・実験計画のマスタデータ
 */
(function (global) {
  "use strict";

  const MISSIONS = [
    {
      id: "specific_heat",
      title: "同じ Q・m でも ΔT が物質で違う",
      description: "Q=mcΔT より比熱 c が大きいほど ΔT は小さい。水・鉄・アルミを同条件で加熱し、表と Q–T グラフの傾きを比べよう。",
    },
    {
      id: "water_iron",
      title: "水は温まりにくく、鉄は温まりやすい",
      description: "同じ Q・m で水と鉄の ΔT を測り、Q–T グラフの傾きから比熱 c の違いを数値で確かめよう。",
    },
    {
      id: "phase_change",
      title: "融解・沸騰中は温度がほとんど上がらない",
      description: "固体→液体→気体の各区間で T と ΔT を記録し、状態が変わる区間で温度が止まる理由を確かめよう。",
    },
    {
      id: "latent_heat",
      title: "潜熱 Q=mL のとき温度は上がらない",
      description: "加熱曲線の「平台」と区間別表の ΔT=0 を確かめ、潜熱で結合が切れる区間を特定しよう。",
    },
  ];

  const HYPOTHESES = [
    {
      id: "sh_h1", missionId: "specific_heat", text: "比熱 c が大きいほど ΔT は小さくなる", legacyKey: "water_faster",
      reason: "Q=mcΔT で c が分母なので、同じ Q なら c が大きいほど ΔT は小さくなるはず",
    },
    {
      id: "sh_h2", missionId: "specific_heat", text: "質量 m が大きいほど ΔT は小さくなる", legacyKey: "same_if_mass",
      reason: "mc が大きいほど同じ Q では全体の温度上昇は小さくなるはず",
    },
    {
      id: "sh_h3", missionId: "specific_heat", text: "加熱量 Q が大きいほど ΔT は大きくなる", legacyKey: "iron_faster",
      reason: "Q=mcΔT より Q と ΔT は比例関係になるはず",
    },
    {
      id: "sh_h4", missionId: "specific_heat", text: "物質が違っても Q と m が同じなら ΔT も同じ", legacyKey: "same_if_mass",
      reason: "Q と m をそろえれば c も同じはずなので、ΔT も同じになるはず",
    },
    {
      id: "wi_h1", missionId: "water_iron", text: "水のほうが ΔT は小さい（温まりにくい）", legacyKey: "water_faster",
      reason: "水の比熱 c は鉄より大きいので、同じ Q で ΔT は小さくなるはず",
    },
    {
      id: "wi_h2", missionId: "water_iron", text: "鉄のほうが ΔT は大きい（温まりやすい）", legacyKey: "iron_faster",
      reason: "鉄の比熱 c は水より小さいので、同じ Q で ΔT は大きくなるはず",
    },
    {
      id: "wi_h3", missionId: "water_iron", text: "同じ Q・m なら水と鉄で ΔT は同じ", legacyKey: "same_if_mass",
      reason: "Q と m をそろえれば物質に関係なく ΔT は同じになるはず",
    },
    {
      id: "wi_h4", missionId: "water_iron", text: "加熱を続けるほど水と鉄の ΔT の差がはっきりする", legacyKey: "water_faster",
      reason: "測定を重ねるほど比熱 c の差が ΔT の差として読み取りやすくなるはず",
    },
    {
      id: "pc_h1", missionId: "phase_change", text: "融解・沸騰中は温度がほとんど上がらない", legacyKey: "water_faster",
      reason: "状態変化では Q=mL が使われ、熱が分子の結合の変化に向かうはず",
    },
    {
      id: "pc_h2", missionId: "phase_change", text: "固体→液体の区間だけ ΔT=0 になる", legacyKey: "water_faster",
      reason: "融解の潜熱区間だけ温度が一定になり、液体加热区間では再び ΔT が現れるはず",
    },
    {
      id: "pc_h3", missionId: "phase_change", text: "気体になると ΔT の上がり方が液体と違う", legacyKey: "iron_faster",
      reason: "気体は分子が自由に動くので、同じ Q でも液体区間と ΔT の上がり方が変わるはず",
    },
    {
      id: "pc_h4", missionId: "phase_change", text: "温度が変わる区間では Q=mcΔT が成り立つ", legacyKey: "same_if_mass",
      reason: "固体・液体・気体の「加热」区間では Q=mcΔT で説明できるはず",
    },
    {
      id: "lh_h1", missionId: "latent_heat", text: "平台区間では Q=mL が使われ温度は一定", legacyKey: "water_faster",
      reason: "潜熱 Q=mL の区間では熱が状態変化に使われ、温度 T は一定のはず",
    },
    {
      id: "lh_h2", missionId: "latent_heat", text: "潜熱は比熱よりずっと大きな熱量が必要", legacyKey: "water_faster",
      reason: "結合を切り離すには、分子の運動エネルギーを増やす以上の熱が必要なはず",
    },
    {
      id: "lh_h3", missionId: "latent_heat", text: "0℃ と 100℃ 付近で平台が現れる", legacyKey: "water_faster",
      reason: "水の融点・沸点付近では状態変化が起こるため、温度が一定になると予想する",
    },
    {
      id: "lh_h4", missionId: "latent_heat", text: "鉄も 1538℃ 付近で融解の平台が現れる", legacyKey: "iron_faster",
      reason: "鉄の融点 1538℃ 付近でも融解の潜熱で ΔT=0 の平台が現れるはず",
    },
  ];

  const PLANS = [
    {
      id: "sh_p1", missionId: "specific_heat",
      text: "水・鉄・アルミを同じ Q・m で加熱し ΔT を比べる",
      compare: "水・鉄・アルミの3物質を同条件で比較する",
      purpose: "物質（比熱 c）の違いが ΔT にどう表れるかを見る",
      planChecks: { material: true, mass: false, heatQ: false },
    },
    {
      id: "sh_p2", missionId: "specific_heat",
      text: "同じ物質で質量 m だけを変えて ΔT を調べる",
      compare: "同じ物質で質量が小さい条件と大きい条件を比較する",
      purpose: "Q=mcΔT の m の効果（熱容量）を確かめる",
      planChecks: { material: true, mass: true, heatQ: false },
    },
    {
      id: "sh_p3", missionId: "specific_heat",
      text: "同じ物質で加熱量 Q だけを変えて ΔT を調べる",
      compare: "同じ物質で加熱量が小さい条件と大きい条件を比較する",
      purpose: "Q と ΔT の比例関係を確かめる",
      planChecks: { material: true, mass: false, heatQ: true },
    },
    {
      id: "sh_p4", missionId: "specific_heat",
      text: "水と鉄を同条件で2回以上測定し表とグラフで比較する",
      compare: "水と鉄の2物質を同条件で対照する",
      purpose: "比較実験の再現性と傾向を確かめる",
      planChecks: { material: true, mass: false, heatQ: false },
    },
    {
      id: "wi_p1", missionId: "water_iron",
      text: "水と鉄を Q=2000J・m=500g で交互に測定する",
      compare: "水と鉄を同じ Q・m 条件で直接比較する",
      purpose: "定番条件で水と鉄の ΔT 差を直接比べる",
      planChecks: { material: true, mass: false, heatQ: false },
    },
    {
      id: "wi_p2", missionId: "water_iron",
      text: "加熱量 Q を変えながら水・鉄それぞれの ΔT を記録する",
      compare: "水と鉄それぞれで Q を変えたときの ΔT を比較する",
      purpose: "Q–ΔT の関係が両物質でどう違うか見る",
      planChecks: { material: true, mass: false, heatQ: true },
    },
    {
      id: "wi_p3", missionId: "water_iron",
      text: "質量 m を変えて水と鉄の ΔT を比べる",
      compare: "水と鉄で質量 m が違う条件同士を比較する",
      purpose: "m をそろえたうえでの比熱の差を確かめる",
      planChecks: { material: true, mass: true, heatQ: false },
    },
    {
      id: "wi_p4", missionId: "water_iron",
      text: "Q–T グラフ（水・鉄）を作成し傾きを比べる",
      compare: "水と鉄の Q–T グラフの傾きを比較する",
      purpose: "グラフから比熱の違い（温まりやすさ）を読み取る",
      planChecks: { material: true, mass: false, heatQ: false },
    },
    {
      id: "pc_p1", missionId: "phase_change",
      text: "水を十分加熱し固体→液体→気体の各区間を記録する",
      compare: "固体・融解中・液体・沸騰中・気体の各区間を順に比較する",
      purpose: "状態変化の各区間と ΔT の関係を表に残す",
      planChecks: { material: true, mass: false, heatQ: false },
    },
    {
      id: "pc_p2", missionId: "phase_change",
      text: "0℃ 付近と 100℃ 付近で加熱を続け ΔT を観察する",
      compare: "0℃ 付近（融解）と 100℃ 付近（沸騰）の2つの平台を比較する",
      purpose: "融解・沸騰の平台（ΔT≈0）を確かめる",
      planChecks: { material: true, mass: false, heatQ: true },
    },
    {
      id: "pc_p3", missionId: "phase_change",
      text: "加熱量 Q を増やしながら区間ごとの温度変化を追う",
      compare: "加熱量 Q が小さいときと大きいときの各区間の変化を比較する",
      purpose: "Q–T 曲線の平台部分をグラフで見る",
      planChecks: { material: true, mass: false, heatQ: true },
    },
    {
      id: "pc_p4", missionId: "phase_change",
      text: "鉄と水を比べ、状態変化の有無の違いを調べる",
      compare: "水（状態変化あり）と鉄（状態変化なし）の加熱を比較する",
      purpose: "物質による状態変化の違いを対照する",
      planChecks: { material: true, mass: false, heatQ: false },
    },
    {
      id: "lh_p1", missionId: "latent_heat",
      text: "水の加熱曲線を作成し 0℃・100℃ の平台を確認する",
      compare: "0℃ と 100℃ の2つの平台区間をグラフで比較する",
      purpose: "潜熱区間で温度が一定になることをグラフで示す",
      planChecks: { material: true, mass: false, heatQ: false },
    },
    {
      id: "lh_p2", missionId: "latent_heat",
      text: "固体→液体・液体→気体の行（ΔT=0）を結果表で集める",
      compare: "固体→液体と液体→気体の2つの区間を比較する",
      purpose: "区間別表から潜熱の効果を読み取る",
      planChecks: { material: true, mass: false, heatQ: false },
    },
    {
      id: "lh_p3", missionId: "latent_heat",
      text: "加熱量 Q を大きくして平台が長くなるか調べる",
      compare: "加熱量 Q が小さいときと大きいときの平台の長さを比較する",
      purpose: "Q と状態変化の進み・平台の関係を調べる",
      planChecks: { material: true, mass: false, heatQ: true },
    },
    {
      id: "lh_p4", missionId: "latent_heat",
      text: "鉄（平台なし）と水（平台あり）の Q–T を比較する",
      compare: "水（平台あり）と鉄（平台なし）の Q–T 曲線を比較する",
      purpose: "潜熱のある物質とない物質の加熱曲線の違いを見る",
      planChecks: { material: true, mass: false, heatQ: false },
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

  const DEFAULT_PLAN_CHECKS = { material: true, mass: false, heatQ: false };

  /** ⑧まとめ — ミッションごとの回答の書き方ガイド */
  const SUMMARY_GUIDES = {
    specific_heat: {
      answerLead: "同じ加熱量Qを与えても物質によってΔTが違うのは、比熱cの違いだから、",
      prompts: [
        "①の問い「同じ Q・m でも ΔT が物質で違う」— Q=mcΔT と表・グラフの傾きから、なぜΔTが違うか答える",
        "Q=mcΔT の関係を、測定した数値や傾向から説明する",
        "②の仮説は支持・修正・棄却のどれか？ 根拠となるデータを1つ書く",
      ],
    },
    water_iron: {
      answerLead: "水は温まりにくく鉄は温まりやすいのは、比熱cの違いだから、",
      prompts: [
        "①の問い「水は温まりにくく、鉄は温まりやすい」— 同じQ・mでΔTとグラフ傾きがどう違ったか答える",
        "水と鉄の比較実験から読み取れる「温まりやすさ」の理由",
        "②の仮説と結果を照らし合わせ、支持・修正・棄却を決める",
      ],
    },
    phase_change: {
      answerLead: "融解・沸騰のとき温度が一定なのは、潜熱で状態が変わるから、",
      prompts: [
        "①の問い「融解・沸騰中は温度がほとんど上がらない」— 固体→液体→気体で何が起きたか答える",
        "ΔT=0 の区間（平台）が表・グラフのどこに現れたか",
        "②の仮説は、状態変化中の温度の変化と一致したか",
      ],
    },
    latent_heat: {
      answerLead: "平台区間ではQ=mLが使われ温度が上がらないから、",
      prompts: [
        "①の問い「潜熱 Q=mL のとき温度は上がらない」— 平台とΔT=0の意味を答える",
        "比熱区間と潜熱区間の違いを、加熱曲線から説明する",
        "②の仮説は、平台の有無や位置と一致したか",
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

  /** 選択内容をレガシー state フィールドへ同期（レポート分析・互換用） */
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
    } else if (!out.planChecks || out.planChecks.material === false) {
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
