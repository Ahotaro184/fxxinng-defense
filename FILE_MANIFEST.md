# Fxxinng Defense ファイルマニフェスト

作成日: 2026-07-29  
調査対象ブランチ: `main`  
調査対象コミット: `aeb7292e0640c4da8ba5fa2661ff518bf010b73d`

## 1. Git状態

- 作業ブランチ: `main`
- 最新コミット: `aeb7292 Fix loading flow and ranged hero limits`
- 調査開始時の未コミット変更: なし
- 調査開始時の未追跡ファイル: なし
- リモート追跡: `main...origin/main`

この資料、CSV、`handover_export/`、ZIPは引き継ぎ作業で新規作成するため、作成後は未コミットファイルとして残る。

## 2. 起動・ビルド方法

### 必要環境

- Node.js `>=22.13.0`
- npm
- Bash
- `npm run build`にはGNU `timeout`が必要
- `npm run install:ci`にはLinux環境の`flock`、`curl`、`sha256sum`、GNU `timeout`が必要

### 依存関係の導入

```bash
npm install
```

ロックファイルどおりに再構築する場合は、Linux/WSL環境で次を使用する。

```bash
npm ci
```

### 開発起動

Linux/WSL:

```bash
npm run dev
```

`package.json`の`dev`はPOSIX形式の環境変数指定を含むため、Windowsの標準`cmd.exe`からはそのまま実行できない。PowerShellで直接起動する場合は次の形式を使う。

```powershell
$env:WRANGLER_LOG_PATH=".wrangler/wrangler.log"
npx vite
```

ただし、ローカル`workerd`が`wrangler.jsonc`の`compatibility_date`に未対応の場合は起動に失敗する。Linux/WSLまたは対応版Wranglerへの更新を優先する。

### 本番ビルド

```bash
npm run build
```

出力:

- `dist/client/`: 静的アセット
- `dist/server/`: Worker/SSR成果物
- `dist/.openai/`: Sites用メタデータ

### ビルド成果物の起動

Linux/WSL:

```bash
npm run start
```

Cloudflare Workers:

```bash
npx wrangler deploy
```

Worker名は`wrangler.jsonc`の`fxxinng-defense`。`workers_dev`は有効。

### テスト・検証

```bash
npm test
npm run lint
npm run validate:artifact
```

`npm test`はビルド後、生成WorkerがHTTP 200のHTMLを返し、`codex-preview=development`メタ情報を含むことだけを検査する。ゲームロジックの単体テストではない。

## 3. 全フォルダ構成

以下はソース、生成物、キャッシュを区別した現在の構成。

```text
Fxxinng-Defense-latest/
├─ .git/                         Git履歴。引き継ぎZIPから除外
├─ .openai/
│  └─ hosting.json              OpenAI Sitesのproject_idとD1/R2論理設定
├─ .sites-runtime/               Sites/npm実行用キャッシュ・ログ。生成物、除外
├─ .vinext/                      Vinextキャッシュ。生成物、除外
├─ .wrangler/                    Wrangler状態・ログ・デプロイ一時設定。除外
├─ app/
│  ├─ page.tsx                  ゲーム本体、全数値、AI、UI、セーブ処理、描画
│  ├─ blade-rules.mjs           Blade数値、範囲対象、地面隆起時間計算
│  ├─ globals.css               全画面UI、ロード画面、メニュー、戦闘HUD
│  ├─ layout.tsx                Next.jsルートレイアウト、メタ情報、favicon
│  └─ chatgpt-auth.ts           未参照の任意認証ヘルパー
├─ build/
│  └─ sites-vite-plugin.ts      SitesメタデータとDrizzle情報をdistへ梱包
├─ db/
│  ├─ index.ts                  未使用のD1/Drizzle接続ヘルパー
│  └─ schema.ts                 空のDBスキーマ
├─ dist/                         最新ビルド成果物。再生成可能、ZIPから除外
├─ drizzle/
│  └─ meta/_journal.json        空スキーマのDrizzle管理情報
├─ examples/
│  └─ d1/                       未使用のD1メモAPIサンプル
├─ handover_export/              引き継ぎ用複製。今回新規作成
├─ node_modules/                 npm依存関係。ZIPから除外
├─ public/
│  ├─ favicon.svg               layout.tsxから参照
│  ├─ file.svg                  未参照のスターター素材
│  ├─ globe.svg                 未参照のスターター素材
│  ├─ window.svg                未参照のスターター素材
│  └─ game/
│     ├─ backgrounds/
│     │  ├─ base.png            拠点画像
│     │  └─ stage-01.png        全ステージ共通背景
│     ├─ bosses/
│     │  ├─ executioner.png     未参照の大型単体画像
│     │  └─ sixarm.png          未参照の大型単体画像
│     ├─ cards/
│     │  ├─ gunslinger.png
│     │  ├─ riot.png
│     │  ├─ rifleman.png
│     │  ├─ oniyama.png
│     │  ├─ hyperman.png
│     │  └─ mu.png
│     ├─ effects/
│     │  ├─ hyperman-wave-sheet/
│     │  │  └─ 00.png～04.png  実際に使用するHYPERMAN衝撃波
│     │  └─ hyperman-shockwave/
│     │     └─ 00.png～04.png  未参照の旧エフェクト
│     ├─ ui/
│     │  └─ portraits/
│     │     └─ muu.png           バトル中ミスター・ムゥ出撃アイコン
│     └─ sprites/
│        ├─ gunslinger/         伊集院 ひろし
│        ├─ riot/               佐藤 剛
│        ├─ rifleman/           諸星 虎太郎
│        ├─ oniyama/            鬼山 タケシ
│        ├─ hyperman/           HYPERMAN
│        ├─ mu/                 ミスター・ムゥ
│        ├─ office/             ノーマルゾンビ
│        ├─ fat/                デブゾンビ
│        ├─ executioner/        処刑人
│        ├─ sixarm/             6本腕
│        ├─ blade/              ブレードゾンビ
│        └─ zeus/               ゼウスゾンビ
│           各キャラ配下: idle / walk / attack / hit / death
├─ scripts/
│  ├─ build-verified.sh         時間制限付きVinextビルド＋成果物検証
│  ├─ install-ci.sh             Linux向け安全なnpm ci
│  ├─ sites-env.sh              プロジェクト内キャッシュ/一時領域設定
│  └─ validate-artifact.sh      Worker ESM default.fetchとmanifest検査
├─ tests/
│  └─ rendered-html.test.mjs    生成WorkerのHTML応答メタ情報テスト
├─ worker/
│  └─ index.ts                  Cloudflare Worker入口、画像最適化、Vinext転送
├─ characters.csv               最終味方数値・画像・解放条件
├─ enemies.csv                  最終敵数値・出現ステージ・特殊攻撃
├─ stages.csv                   5ステージのスポーン・ボス・クリア条件
├─ GAME_SPECIFICATION.md        現行ゲーム仕様
├─ FILE_MANIFEST.md             本ファイル一覧
├─ .gitignore                   依存関係、秘密情報、キャッシュ、distの除外
├─ .npmrc                       npmキャッシュと通知設定
├─ drizzle.config.ts            任意D1スキーマ生成設定
├─ eslint.config.mjs            ESLint設定
├─ next.config.ts               Next.js設定
├─ package.json                 コマンドと依存関係
├─ package-lock.json            npm依存関係の固定
├─ postcss.config.mjs           Tailwind CSS PostCSS設定
├─ README.md                    Vinextスターター由来の説明。現状と不一致あり
├─ tsconfig.json                TypeScript設定
├─ vite.config.ts               Vinext、Sites、Cloudflare Vite構成
└─ wrangler.jsonc               Worker名、assets、Images、互換日付
```

## 4. 主要ファイルの役割と入口

| ファイル | 役割 | 実行時参照 |
|---|---|---|
| `app/layout.tsx` | App RouterのHTMLルート、フォント、メタ情報 | 参照される |
| `app/page.tsx` | `/`のクライアントゲーム本体 | 参照される |
| `app/blade-rules.mjs` | Blade設定、範囲攻撃対象、地面隆起寿命 | `page.tsx`から参照 |
| `app/globals.css` | 全UIとレスポンシブ表示 | `layout.tsx`から参照 |
| `worker/index.ts` | Cloudflare Workerの本番入口 | Wrangler/Vinextから参照 |
| `vite.config.ts` | 開発・ビルド入口 | Viteから参照 |
| `build/sites-vite-plugin.ts` | ビルド終了時のSites情報梱包 | `vite.config.ts`から参照 |
| `wrangler.jsonc` | Workersデプロイ設定 | `wrangler deploy`から参照 |
| `package.json` | npmコマンド・依存関係 | 必須 |
| `package-lock.json` | 再現可能な依存関係 | 必須 |

ゲーム起動時の論理的な流れ:

1. `worker/index.ts`
2. `vinext/server/app-router-entry`
3. `app/layout.tsx`
4. `app/page.tsx`
5. `app/globals.css`と`public/`内の画像

## 5. ゲームデータの保存場所

| データ | 場所 |
|---|---|
| 味方キャラクターID・数値 | `app/page.tsx`の`UNITS` |
| 味方解放条件 | `isUnitUnlocked`、`finishClear` |
| 待機・追跡上限 | `HERO_PATROL_LIMIT_RATIO`、`RANGED_HERO_LIMIT_RATIO`、`HERO_CHASE_LIMIT_RATIO` |
| 敵のステージ別HP/攻撃力 | `STANDARD_ENEMY_STATS` |
| ボス・エリート数値 | `ELITE_ENEMY_STATS` |
| Blade固有数値・範囲 | `app/blade-rules.mjs`の`BLADE_CONFIG` |
| ステージ進行・スポーン | メインゲームループ内の`spawnClock`、`stage5EliteKinds`、ボス出現処理 |
| アニメーション枚数 | `FRAME_COUNTS` |
| ロード画面対象 | `LOADING_CHARACTERS` |
| セーブデータ型と初期値 | `SaveData`、`DEFAULT_SAVE`（version 2） |
| セーブ読込・互換処理 | `loadSave` |
| セーブ保存先 | ブラウザ`localStorage`の`fxxinng-turret-save-v1` |
| UI状態 | `Home`内のReact state |
| ゲーム中の一時状態 | `stateRef` |

ステージ専用データファイルは存在しない。5ステージ分の分岐と数値は`app/page.tsx`に直接記述されている。

## 6. 画像・音声・エフェクト

### 現在参照される画像

- `public/favicon.svg`
- `public/game/backgrounds/base.png`
- `public/game/backgrounds/stage-01.png`
- `public/game/cards/*.png`の6ファイル
- `public/game/ui/portraits/muu.png`（バトル中ムゥ出撃アイコン）
- `public/game/sprites/*/{idle,walk,attack,hit,death}/*.png`
  - 実際に使う状態は`FRAME_COUNTS`に定義された組み合わせ
  - Bladeは`public/game/sprites/blade/{idle,walk,attack,death}/`
- `public/game/effects/hyperman-wave-sheet/00.png`～`04.png`

### 音声

- 音声ファイル: なし
- BGM/効果音の再生コード: なし
- 設定画面のサウンドボタン: 「準備中」で機能未実装

### コード描画エフェクト

- ゼウス雷撃、地面放電、画面フラッシュ、揺れ
- ゼウス死亡時の発光、放射線、爆発、粒子
- ミスター・ムゥの可愛い爆発
- BladeのCanvas地面隆起岩棘
- HYPERMANの衝撃波はPNGフレームを加算合成

## 7. 現在参照されているファイル

ゲーム動作またはビルドに必要:

- `app/page.tsx`
- `app/blade-rules.mjs`
- `app/layout.tsx`
- `app/globals.css`
- `worker/index.ts`
- `build/sites-vite-plugin.ts`
- `.openai/hosting.json`
- `.gitignore`
- `.npmrc`
- `package.json`
- `package-lock.json`
- `vite.config.ts`
- `next.config.ts`
- `postcss.config.mjs`
- `eslint.config.mjs`
- `tsconfig.json`
- `wrangler.jsonc`
- `scripts/*.sh`
- `tests/rendered-html.test.mjs`
- 上記「現在参照される画像」

`README.md`は実行時には不要だが、環境情報の参考資料として引き継ぎ対象に含める。

## 8. 未使用の疑いがあるファイル

静的import、文字列パス、動的パス生成、`FRAME_COUNTS`を照合した結果。

| 対象 | 判定理由 | 引き継ぎZIP |
|---|---|---|
| `public/game/bosses/executioner.png` | コード参照なし。実戦はspritesを使用 | 除外 |
| `public/game/bosses/sixarm.png` | コード参照なし。実戦はspritesを使用 | 除外 |
| `public/game/effects/hyperman-shockwave/*.png` | コードは`hyperman-wave-sheet`だけを参照 | 除外 |
| `public/file.svg` | コード参照なしのスターター素材 | 除外 |
| `public/globe.svg` | コード参照なしのスターター素材 | 除外 |
| `public/window.svg` | コード参照なしのスターター素材 | 除外 |
| `app/chatgpt-auth.ts` | どのルートからもimportされていない | 参考コードとして含む |
| `db/**` | ゲームからimportされず、D1設定もnull | 参考コードとして含む |
| `drizzle/**` | DBスキーマが空 | ビルド構成維持のため含む |
| `examples/d1/**` | サンプルであり実ルート外 | 参考コードとして含む |
| `drizzle.config.ts` | 現在DB未使用 | 将来拡張用として含む |

ZIPから除外する未参照画像は合計約2.466 MiB。原本側では削除していない。

## 9. 削除してはいけないファイル

最低限、次は削除禁止。

- `app/page.tsx`
- `app/layout.tsx`
- `app/globals.css`
- `worker/index.ts`
- `vite.config.ts`
- `build/sites-vite-plugin.ts`
- `.openai/hosting.json`
- `wrangler.jsonc`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `postcss.config.mjs`
- `public/favicon.svg`
- `public/game/backgrounds/base.png`
- `public/game/backgrounds/stage-01.png`
- `public/game/cards/*.png`
- `public/game/ui/portraits/muu.png`
- `public/game/sprites/**`
- `public/game/effects/hyperman-wave-sheet/**`
- `scripts/build-verified.sh`
- `scripts/sites-env.sh`
- `scripts/validate-artifact.sh`

`FRAME_COUNTS`の数値だけを変えて対応画像を追加・削除しない場合、存在しないフレーム参照または未使用フレームが発生するため、コードと画像を必ず同時に確認する。

## 10. キャッシュ・秘密情報・除外方針

引き継ぎZIPから除外:

- `.git/`
- `node_modules/`
- `.next/`
- `.vinext/`
- `.wrangler/`
- `.sites-runtime/`
- `dist/`
- `out/`
- `coverage/`
- `.env*`
- ログ、OS一時ファイル
- 前節の未参照大型画像

調査時点で`.env`、秘密鍵、トークン、パスワード候補ファイルは検出されなかった。`.openai/hosting.json`の`project_id`はサイト識別子であり認証秘密ではない。
