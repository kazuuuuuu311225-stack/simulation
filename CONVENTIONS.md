# physLabo シミュレーション開発規約

`projectile-sim/` 配下の HTML シミュレーションを追加・更新するときの共通ルールです。

## ファイル命名

| 種類 | 規則 | 例 |
|------|------|-----|
| 章 sim | `{章番号2桁}_{topic}.html` | `22_capacitor_parallel_connection.html` |
| 3D sim | 上記 + `_3D_sim` 等 | `54_electromagnetic_induction_3D_sim.html` |
| 探究 sim | `{topic}_simulation.html` | `brownian_motion_simulation.html` |
| 分野索引 | `00_folder_{分野}.html` | `00_folder_electromagnetism.html` |
| トップ | `00_physLabo_top.html` | — |

## `<head>` 必須タグ（sim ページ）

```html
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<script src="assets/js/physlabo-viewport-inline.js?v=20260810"></script>
<title>第N章 … — タイトル</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Noto+Sans+JP:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/css/physlabo-sim-base.css?v=20260826">
<style>
  /* :root の accent 色と sim 固有スタイルのみ */
  :root {
    --accent: #818cf8;
    --accent-light: #a5b4fc;
    --panel: rgba(10, 12, 28, 0.9);
    --border: rgba(129, 140, 248, 0.28);
    --back-text: #e0e7ff;
  }
  body { background: linear-gradient(...); /* 任意 */ }
</style>
<link rel="stylesheet" href="assets/css/physlabo-mobile.css?v=20260626c">
<script src="assets/js/physlabo-mobile.js?v=20260626c" defer></script>
```

- **viewport** は inline コピー禁止。必ず `physlabo-viewport-inline.js` を参照する。
- **シェル CSS**（panel / back / formula / slider）は `physlabo-sim-base.css` に任せ、`<style>` には差分のみ書く。

## 戻るリンク（`#back`）

**文言:** `← {分野名} · 第{N}章`（EX は `← EX · 探究`）

**href:** `00_folder_{分野}.html#chapter-{N}`

| 分野 | フォルダ | 表示名 |
|------|----------|--------|
| 力学 | `00_folder_classical.html` | 力学 |
| 熱力学 | `00_folder_thermo.html` | 熱力学 |
| 波動 | `00_folder_waves.html` | 波動 |
| 電磁気 | `00_folder_electromagnetism.html` | 電磁気 |
| 原子 | `00_folder_atom.html` | 原子 |
| EX | `00_folder_ex.html` | EX |

例:

```html
<a id="back" href="00_folder_electromagnetism.html#chapter-22">← 電磁気 · 第22章</a>
```

## 新 sim 追加手順

1. 上記規約に従い HTML を作成
2. 該当 `00_folder_*.html` の章 `<ul class="sim-list">` に `menu-link` を追加
3. `00_physLabo_top.html` の章 sim 数（`chapter-count`）を更新（必要なら）
4. `assets/` を編集した場合は `sync-assets-to-sim.ps1` を実行
5. ブラウザで PC / スマホ表示・戻るリンク・章アコーディオン展開を確認

## 3D sim（`.sim-grid` 型）

- 上記シェル CSS は使わず、既存 3D テンプレ（`61_mutual_induction_wireless_power_3D_sim.html` 等）をコピー
- viewport 外部 JS と戻るリンク規約は **同じく適用**

## 認証（auth-gate）

- **保護対象:** トップ + 6 分野フォルダのみ
- **sim 直リンク:** パスワードなし（意図的。詳細は `README.md`）
- sim ページに `auth-gate.js` は **付けない**

## アセット同期

```
powershell -File sync-assets-to-sim.ps1
```

リポジトリルート `assets/` → `projectile-sim/assets/` にミラーします。

## 一括メンテナンス

```
node apply-high-priority-migrations.mjs
node apply-medium-priority-migrations.mjs
```

## テンプレート（新規 sim 用）

| ファイル | 用途 |
|----------|------|
| `TEMPLATE_2d_panel.html` | 2D canvas + panel 型 |
| `TEMPLATE_3d_simgrid.html` | Three.js + sim-grid 型 |

## 数式表示

- 標準: `.formula-box`（静的）+ `.formula-live`（更新）
- 3D 系の `.formula-main` / `.eqn-panel` も `physlabo-sim-base.css` で同等スタイル

## アクセシビリティ

- 全 sim に `physlabo-a11y.js` — canvas へ `aria-label`、低モーション検出
- シミュレーション内で `PhysLaboA11y.REDUCED` を参照可能

viewport 外部化・戻るリンク統一・sim-base CSS リンク追加を再実行できます。
