# physLabo — 高校物理シミュレーション

ブラウザで動作する HTML/CSS/Canvas（および Three.js）シミュレーション集です。

## 構成

```
00_physLabo_top.html      … トップ（6分野カード）
00_folder_*.html          … 分野別章一覧（6ファイル）
{章}_{topic}.html         … 各シミュレーション（約200本）
assets/                   … 共通 CSS / JS
```

## 閲覧方法

1. `00_physLabo_top.html` をブラウザで開く
2. 分野を選び、章・sim を選ぶ

GitHub Pages 等に `projectile-sim/` ごとデプロイする運用を想定しています。

## 認証（auth-gate）方針

| ページ | パスワード |
|--------|------------|
| トップ `00_physLabo_top.html` | **あり** |
| 分野フォルダ `00_folder_*.html`（6本） | **あり** |
| 個別 sim HTML | **なし** |

### 理由

- **入口（トップ・章一覧）で一度認証**すれば、同一ブラウザセッション内は `sessionStorage` によりフォルダ間を再入力なしで移動できる
- sim URL を **直接共有・ブックマーク** した場合は、授業中の個別リンクとして使いやすいよう **sim 本体は無保護** とする

### 変更したい場合

- sim も保護する → 各 sim の `<head>` に `auth-gate.js` を追加（約200ファイル）
- 保護をやめる → トップ・フォルダから `auth-gate.js` を削除

設定ファイル: `assets/js/auth-gate.js`

## 開発

新規 sim・更新ルールは **`CONVENTIONS.md`** を参照してください。

### アセット同期（ルート → projectile-sim）

```powershell
powershell -File sync-assets-to-sim.ps1
```

### 高優先度メンテ一括適用

```powershell
node apply-high-priority-migrations.mjs
```

### 中優先度メンテ一括適用

```powershell
node apply-medium-priority-migrations.mjs
```

- `physlabo-a11y.js` を sim に追加
- 数式クラスの CSS エイリアス更新

## 索引ページ

| ファイル | 役割 |
|----------|------|
| `index.html` | → `00_physLabo_top.html` へリダイレクト |
| `index-full.html` | 旧フラット一覧（同上リダイレクト） |
| **正:** `00_physLabo_top.html` | トップ + 6分野カード |

## 新規 sim テンプレート

- `TEMPLATE_2d_panel.html` — 2D panel 型
- `TEMPLATE_3d_simgrid.html` — 3D sim-grid 型

## 主な共通アセット

| ファイル | 用途 |
|----------|------|
| `assets/js/physlabo-viewport-inline.js` | スマホ viewport スケーリング |
| `assets/css/physlabo-mobile.css` | モバイルレイアウト |
| `assets/css/physlabo-sim-base.css` | 2D sim 共通シェル |
| `assets/js/physlabo-a11y.js` | canvas ラベル · 低モーション |
| `assets/js/auth-gate.js` | 入口パスワード |
