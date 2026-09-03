# physLabo — 高校物理シミュレーション

ブラウザで動作する HTML/CSS/Canvas（および Three.js）シミュレーション集です。

## 構成

```
00_physLabo_top.html      … トップ（6分野カード）
00_folder_*.html          … 分野別章一覧（6ファイル）
classical/ thermo/ …      … 分野ごとの sim HTML（各フォルダ100件以内）
assets/                   … 共通 CSS / JS
tools/                    … サーバー・開発スクリプト
```

GitHub 向けに **1フォルダあたり100ファイル以内** となるよう sim は上記6分野フォルダに配置しています。

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

## NEWS（お知らせ）

| ファイル | 役割 |
|----------|------|
| `data/news.json` | 公開記事データ（HP が読み込む） |
| `admin/news.html` | 管理画面（ID/パスワード） |
| `tools/news-server.mjs` | 記事保存 API + ローカル配信 |

### 使い方

1. `data/news-admin.example.json` を `data/news-admin.json` にコピーし、**ID とパスワード**を設定（Git には含めない）
2. `tools/start-news-server.bat` または `node tools/news-server.mjs` を実行
3. ブラウザで `http://localhost:8790/admin/news.html` を開きログイン
4. 記事を書いて **「HPに反映」** → `data/news.json` が更新され、トップの NEWS に表示

初回のみ `news-admin.json` が無い場合、サーバーが `admin` / `admin123` を自動作成します。**必ず変更してください。**

GitHub Pages 等にデプロイする場合は、更新後の `data/news.json` を一緒にアップロードしてください。

### ブラウザから直接更新（GitHub 公開後）

公開サイトの URL から管理画面を開けます（PC の news-server 不要）。

1. ブラウザで **`https://あなたのサイト/admin/news.html`** を開く  
   （例: `https://username.github.io/hyakumasu-calc/projectile-sim/admin/news.html`）
2. （任意）`assets/js/news-github-config.example.js` を `news-github-config.js` にコピーし、ユーザー名・リポジトリ名を記入して GitHub に push
3. GitHub で **Personal Access Token** を作成（リポジトリの **Contents 書き込み** 権限）
4. 管理画面に **ユーザー名・リポジトリ名・トークン** を入力してログイン
5. 記事を書いて **「HPに反映」** → GitHub に直接保存（1〜2分後にサイトに反映）

トークンはブラウザの sessionStorage にだけ保存され、GitHub にはアップロードされません。

## 開発

新規 sim・更新ルールは **`CONVENTIONS.md`** を参照してください。

### アセット同期（ルート → projectile-sim）

```powershell
powershell -File tools/dev/sync-assets-to-sim.ps1
```

### フォルダ整理（sim を分野サブフォルダへ移動）

```powershell
node tools/reorganize-sims-into-folders.mjs --dry-run
node tools/reorganize-sims-into-folders.mjs
```

### 高優先度メンテ一括適用

```powershell
node tools/dev/apply-high-priority-migrations.mjs
```

### 中優先度メンテ一括適用

```powershell
node tools/dev/apply-medium-priority-migrations.mjs
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

- `tools/templates/TEMPLATE_2d_panel.html` — 2D panel 型
- `tools/templates/TEMPLATE_3d_simgrid.html` — 3D sim-grid 型

## 主な共通アセット

| ファイル | 用途 |
|----------|------|
| `assets/js/physlabo-viewport-inline.js` | スマホ viewport スケーリング |
| `assets/css/physlabo-mobile.css` | モバイルレイアウト |
| `assets/css/physlabo-sim-base.css` | 2D sim 共通シェル |
| `assets/js/physlabo-a11y.js` | canvas ラベル · 低モーション |
| `assets/js/auth-gate.js` | 入口パスワード |
