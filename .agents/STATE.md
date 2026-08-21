# STATE — EvJou の現在地

**このファイルはエージェント間の唯一の引き継ぎ経路です。**
チャットの文脈は共有されません。ここに書かれていないことは「**まだ起きていない**」と扱ってください。

更新のしかたは `.agents/PROJECT_RULES.md` §2。要点だけ再掲します。

- **追記で更新する。既存のブロックを置換しない。** 見出しや表を作り直すときは
  保存前に `git diff` の `-` 行を自分で読むこと
- **「未着手」「未発注」「未検証」を、進捗の書き換えで消さない。**
  消してよいのは、それが実際に完了した時だけ

最終更新: **2026-08-21**（エージェント・ハーネス導入セッション / Claude Code）

---

## 1. ブランチと作業ツリー

**このリポジトリに `main` / `master` はありません。** 事実上の主幹は
`claude/daily-journal-refactor-j1v7zs` で、`origin/HEAD` がこれを指しています。

| ブランチ | HEAD | 状態 |
|---|---|---|
| `claude/daily-journal-refactor-j1v7zs` | `ea99b5f` | **事実上の主幹。クリーン。** LPマージ済み・版数 1.1.0 確定済み。**`origin`（`3adba1e`）より5コミット先＝未push** |
| `claude/evjou-landing-page-completion-a2a3df` | `d9a34cc` | **主幹へマージ済み（fast-forward）。役目を終えた。**削除してよいが未削除 |
| `wip/lp-scratch-20260730` | `22deaf7` | **退避専用。** 2026-07-30 のLP試行錯誤と作業ゴミを丸ごと保全。**作業に使わないこと。**捨てた判断を戻したいときだけ参照する |
| `claude/agent-harness-setup-44f86f` | — | 本ハーネス導入の作業ツリー |

2026-08-21 に主幹へ積んだコミット（`52e4ec5` の上）:

```
ea99b5f chore: 既に追跡されていた scratch_cdp/ を追跡対象から外す
2da07b0 chore: スクショ撮影用スクラッチを追跡対象から外す
6d90ea6 chore(android): リリース版数を versionCode 3 / versionName 1.1.0 へ
d9a34cc feat(landing): 実機スクショを実データで撮り直しLPを完成
```

> ### ✅ 主幹ツリーの未コミット作業は処理済み（2026-08-21・**完了**）
>
> 発見時、`E:\!master_0428\Document\Claude\Evjou`（主幹ツリー）はクリーンではなく、
> LPブランチと内容が競合していました。**全量を `wip/lp-scratch-20260730` へ退避**した上で、
> 必要なものだけを主幹へ拾い直しました（下表の「判定」どおりに処理済み）。
> **何も失われていません。**捨てた判断を覆したくなったら退避ブランチから戻せます。
>
> | 未コミットの中身 | 更新日時 | 判定 |
> |---|---|---|
> | `android/app/build.gradle`（`versionCode 1→3` / `versionName "1.0"→"1.1.0"`） | — | **残すべき本物の作業。** `package.json` の `1.1.0` と一致 |
> | `landing/index.html`（176行）・`landing/styles.css`（169行）・`lp_*.png` 8枚の差し替え・`lp_ai_chat.png` / `lp_sequence.png` / `lp_task_sort.png` の追加 | 2026-07-30 20:00〜21:04 | **LPブランチ `d9a34cc`（07-31 17:44）の方が約20時間新しい。** これはその前段の試行錯誤と判断 |
> | `scratch_cdp/`（CDP経由のスクショ自動撮影スクリプト群・未追跡） | 2026-07-30 | 作業ゴミ。`.gitignore` 候補 |
> | `ui.json` / `window_dump.xml`（UI階層のダンプ） | 2026-07-30 | 作業ゴミ。`.gitignore` 候補 |
> | `AGENTS.md`（未追跡・47行） | 2026-08-06 | **Codex 用の入口ファイルが既に作られていた。** `CLAUDE.md` を Claude→Codex に置換した版で、「`HANDOFF.md` — **Codex.ai** アーティファクトからの移行メモ」という置換ミスが残っている。本ハーネスの新しい `AGENTS.md` が置き換える |
>
> **注**: 本ハーネス導入時の初回調査で「Codex の痕跡なし」と報告しましたが、**誤りでした。**
> 未追跡ファイルは別の作業ツリーからは見えないためです。Codex の入口は 2026-08-06 に
> 存在していました（コミットされていないだけ）。

作業ツリーの実パス:

```
E:\!master_0428\Document\Claude\Evjou                                                         主幹
E:\!master_0428\Document\Claude\Evjou\.claude\worktrees\evjou-landing-page-completion-a2a3df  LP
E:\!master_0428\Document\Claude\Evjou\.claude\worktrees\agent-harness-setup-44f86f            本作業
```

**古いツリーはありません。** ただし主幹ツリーで LP の作業結果（`d9a34cc`）を探しても
見つからないので注意してください。LP の変更を見たい場合は LP ツリーを開くこと。

---

## 2. ビルドとテストの状態（2026-08-21 実測）

| 項目 | 結果 | 実測時のコミット |
|---|---|---|
| `npm run build` | **通る**（`✓ built in 3.44s` / 82 modules transformed） | `52e4ec5` |
| `npm run test:dataloss` | **4件すべて PASS** | `52e4ec5` |

`test:dataloss` の実出力:

```
PASS  autosave→reload
PASS  dateswitch flush
PASS  beforeunload save
PASS  legacy migration
```

ビルドは「chunks are larger than 500 kB」警告を出しますが**無害**です
（`dist/assets/index-DOxdGjEC.js` が 921.20 kB）。`PROJECT_RULES.md` §6 参照。

**CI はありません。** 上記は人が手で走らせた結果です。

---

## 3. 既知の未解決問題

### 外部環境（プロキシワーカー / Firestore）

- **Firestore のルール変更が未適用。** キューイング実装が要求するルール変更がまだ当たっていません。
  出典は**旧 `.agents/AGENTS.md` §4**（`git show 52e4ec5:.agents/AGENTS.md` で読める）と
  `HANDOFF.md` §14。**本セッションでは未検証**
- **旧コードで動く2つ目のワーカーが、このリポジトリ外のマシンで同じコレクションを
  消費しているのが観測されています。** `claimRequest()` により二重処理自体は無害化済みですが、
  **その野良ワーカーはまだ発見も停止もされていません**。出典は同上。**本セッションでは未検証**
- **ワーカーは自動で復活しません。** detached プロセスなので PC のスリープ・再起動で落ちます。
  自動起動も自動再起動も未設定（`docs/operations.md` §5-3）

### 文書とコードの食い違い（2026-08-21 に実測して発見・**未修正**）

- **`docs/operations.md` の `DAILY_LIMIT` 記載が古い。**
  同 §4 の表と §6 のトラブルシューティングは **200** と書いていますが、
  `proxy/index.js:18` の既定値は **50** です（`52e4ec5` で 200→50 に変更された際の取り残し）

### アプリ本体（`docs/operations.md` §5 より・いずれも未修正）

- **§5-1 ボタン連打で更新を取りこぼす。** `src/features/useTodos.js` が関数アップデータではなく
  クロージャの `todos` を見ているため、同一描画サイクル内の2操作で先の更新が消えます。
  人間の指では通常踏みません。データは壊れません
- **§5-2 過去の日付を開いた状態の「🔥 今日へ」が今日にならない。**
  `src/daily-journal.jsx` の `fileProposal` が「今日」ではなく「画面で選択中の日付」を期限に入れます。
  ボタンのラベルと実挙動が食い違っています
- **§5-4 同意ダイアログの文言が実態と食い違う。**
  「サーバー上にデータは保存されません」と表示しますが、実際にはリクエスト文書（日記本文を含む）が
  Firestore 上に**最大24時間**（`KEEP_HOURS`）残ります。
  **他人に配布する前に文言を直すか `KEEP_HOURS` を短くすること。v1リリース前の宿題**

### 機能の欠落（`docs/TODO.md` より）

- **ToDoがスケジュール生成に渡っていない。** `src/features/useSchedule.js` の `generateSchedule` は
  AIプロンプトに「目標」と「ひとこと」は渡しますが、**「今日のToDo一覧」を渡していません**。
  そのためダンプモードで書き出したタスクが一日のスケジュールに組み込まれません

### 未決着の設計論点

- **配布時のAI推論経路が未決着**（BYOK / オンデバイス小型LLM）。
  `callCloud()` は Anthropic API をブラウザから直叩きしており、通常環境では認証が通りません。
  **このプロジェクト最大の未決論点です**
- ~~**LP用スクリーンショット素材が空状態**~~ → **2026-08-21 解消済み。**
  `d9a34cc` を主幹へマージし、空素材19点を削除して実データの `shot_*.png` 8点に差し替えました。
  `shot_sequence.png`（稼働シーケンス 3/7完了）と `shot_ai_chat.png` を実際に開いて、
  **実データであること・日本語が破綻していないこと・個人情報が写っていないこと**を確認済み。
  マージ後に `npm run build` 通過、`landing/index.html` が8枚すべて新素材を参照することも確認。
  - **残った軽微な指摘（未対応）**: `shot_ai_chat.png` で AI の返答が
    `1. **事前準備と計画**:` と**Markdown が未レンダリングのまま**表示されています。
    アプリ側の表示処理の問題で、LPの画像にもそのまま写っています

---

## 4. 保留中の決定

- **保護ブランチは指定されていません。** ユーザーの決定（2026-08-21）により、
  **マージは Claude Code（進行管理役）が実行してよい**。
  条件は `PROJECT_RULES.md` §1「誰も勝手にやらないこと」——
  マージ前に `npm run build` が通っていること、`--force` push と履歴書き換えはユーザー確認。
  将来 `main` を切るかどうかは**未決**
- **`52e4ec5` が未push のままです。** push するかどうかの判断は**未確認**

---

## 5. 次にやること

- **ハーネスのブランチ `claude/agent-harness-setup-44f86f` を主幹へマージする。**
  内容はユーザー確認済み。マージすると主幹に `AGENTS.md` が入ります
  （主幹に未追跡で存在した旧 `AGENTS.md` は退避ブランチへ保全済みで、現在は主幹に存在しません）
- **`origin` への push が未実施**（主幹は origin より5コミット先）。**判断待ち**
- **プロキシワーカーの起動**（現在停止中・§6）。手順は `docs/operations.md` §2③
- 上記以外は **未発注**です。§3 の未解決問題はどれも**まだ誰にも渡していません**。
  「報告待ち」ではなく「発注していない」状態であることに注意してください
  （例外: `DAILY_LIMIT` の文書修正は別セッションへ発注済み・進行中）

---

## 6. 外部環境の状態

**2026-08-21 実測**（`adb devices -l` / Ollama の `/api/tags` / `node.exe` のコマンドライン走査）。

| 対象 | 状態 |
|---|---|
| 実機 Xiaomi Mi 10 Pro（`a5f1d85` / `cmi` / Android 13） | **接続中**（USBデバッグON）。EvJou の主検証機。**ユーザー本人の実データが入っている**。アプリの現在の導入状態は未確認 |
| 実機 OPPO Reno A（`1d05e7bc` / `CPH1983` / ColorOS） | **接続中**。旧WebView（Chrome 74 相当）の互換確認用。`vite.config.js` の `chrome74` ターゲットはこの端末向け |
| 実機 Samsung `SCG13`（`R5CT43R8P0D` / Galaxy S22・au） | **接続中。EvJou とは無関係の可能性が高い。触らないこと** |
| Ollama（`localhost:11434`） | **稼働中。** `qwen2.5:7b`（ワーカー既定モデル）・`bge-m3:latest`・`gemma4:e4b-it-qat` を保持 |
| プロキシワーカー（`proxy/index.js`・自宅PC） | **停止中。** `proxy/index.js` を実行している node プロセスは見つからなかった。**AI機能は現在スマホから使えない状態**。起動手順は `docs/operations.md` §2③ |
| Firestore（`evjou-efd9b`） | **未確認**（Console へのログインが要るため）。§3 のルール未適用と野良ワーカーの件が未解決 |

> ⚠️ **adb に3台が同時接続されています。`-s <シリアル>` を必ず付けてください。**
> 省略すると `error: more than one device` で止まるか、意図しない端末に当たります。
> 鉄則は `PROJECT_RULES.md` §6。

起動手順と疎通確認は `docs/operations.md` §2。

---

## 7. 更新履歴

- **2026-08-21 / Claude Code（追記3）** — 主幹ツリーの未コミット作業を `wip/lp-scratch-20260730`
  へ退避し、LPブランチ `d9a34cc` を fast-forward マージ。版数 1.1.0 を拾い直し、
  `scratch_cdp/` 等を追跡対象から除外。マージ後に `npm run build` 通過を確認。**主幹はクリーン**。
  併せて `-t` 必須という記録が誤りだったことを実機で確定させ、正典・事故台帳・記憶を訂正。
- **2026-08-21 / Claude Code（追記2）** — ユーザー決定により、**Claude Code が3役すべてを兼ねる**
  体制へ変更（`PROJECT_RULES.md` §1）。Codex / Antigravity は「必要なときに開く」扱い。
  併せて外部環境を実測し、**adb に3台が同時接続**していること、**Ollama は稼働・ワーカーは停止中**
  であることを確認して §6 を更新。LPブランチの素材が実データであることを検証して §3 を更新。
- **2026-08-21 / Claude Code** — エージェント・ハーネスを新規導入。
  `.agents/PROJECT_RULES.md`（正典）と本ファイルを作成し、入口3ファイルを薄い役割差分へ作り直した。
  併せて `npm run build` と `npm run test:dataloss` を実測（両方通過）。
  `docs/operations.md` の `DAILY_LIMIT` 記載ずれを発見（**未修正**）。
  **本体コードは一切変更していない。コミット・マージもしていない**
