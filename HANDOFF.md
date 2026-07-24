# Claude Code 引き継ぎ手順

## 1. 配置

このディレクトリの中身をそのままリポジトリのルートに置く。

```
my-journal/
├── CLAUDE.md                    # Claude Codeが自動で読む指示ファイル
├── HANDOFF.md                   # 本ファイル（初回だけ使う。後で消してよい）
├── docs/
│   ├── app-specification.md     # 仕様書（v0.11）
│   └── user-context.md          # 決定履歴・不採用一覧
└── src/
    └── daily-journal.jsx        # アプリ本体（現状の唯一の実体）
```

```bash
cd my-journal
git init && git add -A && git commit -m "init: v0.11 from Claude.ai artifact"
```

`CLAUDE.md` はルートに置けば Claude Code が自動で読む。

## 2. 初回の起動プロンプト

真っ新な状態なので、まず環境整備から入るのが素直。以下をそのまま貼る。

```
Claude.aiのアーティファクトで作っていた個人アプリをこのリポジトリに移した。
CLAUDE.md と docs/ 配下を読んでから始めてほしい。

現状: src/daily-journal.jsx が単一ファイルの実体（約2,400行）。
ビルド設定もテストも依存管理も無い、コードが置いてあるだけの状態。

まずやりたいのは「動かせるようにする」こと。
Vite + React のビルド環境を立てて、npm run dev でブラウザで動く状態にしてほしい。

注意点:
- このコードは window.storage というアーティファクト環境専用APIに依存している。
  通常環境には存在しないので、そこの扱いをどうするか先に方針を提示してほしい。
- モジュール分割やTS化は今回はやらない。まず動かすところまで。

不明点があれば先にまとめて質問して。
```

## 3. 移行時に最初に踏む地雷（既知）

- **`window.storage` が存在しない。** `storageGet`/`storageSet` は try-catch で握り潰して localStorage にフォールバックするので落ちはしないが、実質 localStorage のみで動く状態になる。抽象化して1箇所に閉じ込めるのが筋。
- **Anthropic API の直叩き。** `callCloud()` が `https://api.anthropic.com/v1/messages` をブラウザから叩いている。アーティファクト環境ではキーが自動注入されていたが、**通常環境では認証が通らない**。ローカルモード（OpenAI互換エンドポイント）は素直に動く。
- **単一ファイル・約2,400行。** 分割は移行フェーズの課題。焦って一気にやるとパーサエラーの実績があるので段階的に。

## 4. 次にやることの候補

1. **ビルド環境の整備**（上記プロンプト）— 最優先。動かないと何も検証できない
2. **ストレージ層の抽象化** — `window.storage` 依存の解消
3. **AI推論経路の決着**（BYOK / オンデバイス小型LLM）— 配布方針とセット。**未決着の最大論点**
4. モジュール分割＋TS化
5. PWA化 → デプロイ

## 5. 引き継ぎ時点の状態まとめ

- バージョン **v0.11**（v0.10 ＋ チャット人格切替）
- 直近の変更：エラーログ解析機能を実装 → 撤去し、🔥スパルタ人格として集約
- **プロダクト方針が揺れている**：「個人特化で確定」→ Playストア配布を検討中（未決着）
- ローカル推論と一般配布が矛盾しており、そこが未解決のまま

---

## 6. リファクタリング完了記録（2026-07 / Claude Code）

単一ファイル `daily-journal.jsx`（約2,400行）を **3層分離アーキテクチャ**へ再構成した。
挙動は不変（各段階でビルド＋実機ブラウザ検証を実施）。

### 到達点：3層分離＋ローカルファースト基盤
```
src/
├── main.jsx                     ErrorBoundary + App のマウント
├── daily-journal.jsx            App（オーケストレータ）約720行 ※旧2,377行
├── constants.js                 色・タブ・フィールド・デフォルト値
├── components/                  【UI層】状態を持たない表示コンポーネント
│   ├── ErrorBoundary.jsx        画面全体のクラッシュ防止
│   ├── common.jsx  journal.jsx  todo.jsx  routine.jsx  schedule.jsx  settings.jsx
├── features/                    【ロジック層】ドメインごとのフック
│   ├── useJournal.js ★消失防止機構  useTodos.js  useRoutines.js
│   ├── useGoals.js  useSchedule.js  useSettings.js
├── lib/                         純粋ロジック（date / id / json / domain）
├── api/                         AI通信（client / prompts）
└── storage/                     【ストレージ層】保存先の抽象化
    ├── localStorageAdapter.js   現行実装（契約コメントあり）
    ├── index.js                 ファサード＋アダプタ差し替え点(setStorageAdapter)
    ├── useStorage.js            単一キー永続化フック
    └── backup.js                エクスポート/インポート
```

### 完了した要件
1. **UIとロジックの分離** … UIは `components/`、状態・ドメインルールは `features/` のフックへ。
2. **ストレージ層の抽象化** … `useStorage` ＋ アダプタ。保存先変更は `setStorageAdapter` の1点のみ。
   生の `window.storage` / `localStorage` 直叩きは全廃（`window.storage` 依存も除去）。
3. **Error Boundary** … `components/ErrorBoundary.jsx` で全体をラップ。
4. **ビルド環境** … Vite + React（`npm run dev` / `build`）。
5. **消失対策のテスト常設** … `npm run test:dataloss`（Playwright実機・自己完結）。

### ⚠️ 次に IndexedDB / クラウドへ差し替える人へ（重要）
- **アダプタを1つ作るだけ**：`localStorageAdapter.js` 冒頭の契約（get/set/remove/setSync）を満たす
  実装を書き、起動時に `setStorageAdapter(indexedDbAdapter)` を呼ぶ（`main.jsx` あたり）。
  UI・ロジック・フックは一切変更不要。get/set/remove は最初から Promise 返却で非同期対応済み。
- **`setSync` の落とし穴**：`beforeunload` の同期保存（`useJournal.js`）は localStorage の同期APIに依存。
  **IndexedDB は beforeunload で確実な同期書き込みができない**。移行時は
  「編集中エントリだけ localStorage にミラーする」等の保険を別途用意すること。
  ここは消失対策の生命線なので、`test:dataloss` を IndexedDB でも必ず通してから採用する。
- 全リセット時、`useStorage` の自動永続化で各キーが「削除」でなく「空値で再作成」される
  （このアプリでは空＝欠損で等価。IndexedDB化の際は挙動を再確認）。

### 次のステップ候補（優先順）
1. **AI推論経路の決着（BYOK / オンデバイス小型LLM）** … 配布方針とセットの最大論点（未着手）。
   `api/client.js` の `callCloud`（Anthropic直叩き）は通常環境で認証が通らない点も未解決。
2. **IndexedDB アダプタ**（上記の注意点つき）。オフライン堅牢性の底上げ。
3. **TypeScript 化** … モジュール分割済みで着手しやすくなった。`storage` の契約を型に落とすと安全。
4. （任意）AIパネル・バックアップ処理を `useAi` / `useBackup` として App から更に分離。

---

## 7. 次フェーズの決定事項（2026-07 確定・この順で進める）

### 候補1：IndexedDB への移行 ← **次セッションの着手点**
- `storage/` のアダプタを差し替えて IndexedDB 化する。**localStorage とのハイブリッド保存**とする。
  - 通常の get/set/remove は IndexedDB を正とする。
  - `beforeunload` 等の同期保存（`useJournal.js` の生命線）は IndexedDB では確実に書けないため、
    **編集中エントリだけ localStorage にミラー**して保険にする（起動時は両者を突き合わせて復元）。
- 実装は `localStorageAdapter.js` の契約（get/set/remove/setSync）を満たす `indexedDbAdapter` を作り、
  `main.jsx` あたりで `setStorageAdapter(indexedDbAdapter)` するだけ。UI・ロジックは無改修。
- **受け入れ条件：`npm run test:dataloss` が IndexedDB 構成でも 3シナリオ PASS すること（必須）。**
  消失対策の生命線なので、PASS しない実装は採用しない。

### 候補2：AI機能の決着（BYOK 方式）
- 方針：**デフォルトはローカルLLM、オプションで APIキー入力の BYOK（Bring Your Own Key）**。
- **⚠️ 重要な制約：現在はローカルLLMの実通信テストができない環境。**
  裏側の通信ロジック（`api/client.js` の `callLocal` / `callCloud` の実挙動）は**深追いしない**。
  今は **設定画面・UIの「ガワ（骨組み）」だけ**を作る：
  - BYOK 用のAPIキー入力欄、ローカル/BYOK の切替UI、保存導線など。
  - 通信の疎通確認や認証の実検証は、実機で試せる環境が整ってから。
- 既存の `components/settings.jsx`（AiSettings）と `api/client.js` を土台に、UIの器を整える範囲に留める。

### 候補3：スマホアプリ化（の前に徹底的なコードレビュー）
- ネイティブ化（React Native / Expo 等）に進む**前に、徹底的なコードレビューを挟む**。
- リファクタ直後の今こそ、3層分離の妥当性・命名・責務境界・消失対策の穴を総点検する。
- レビュー通過後に初めて配布・ネイティブ化の設計へ。

---

## 8. 候補1（IndexedDB 移行）完了記録（2026-07 / Claude Code）

**IndexedDB を正とする localStorage ハイブリッド**へ移行。UI・ロジック・フックは無改修。

- `src/storage/indexedDbAdapter.js` を新規追加（契約 name/get/set/remove/setSync は localStorage 版と同一）。
- `src/main.jsx` で `setStorageAdapter(indexedDbAdapter)` の1点差替えのみ。
- localStorage はアダプタ内部にのみ残り、**3用途**に閉じ込め（外からは不可視）：
  1. **ミラー**（`journal_v1_mirror_<key>`）… `beforeunload` の同期保険。IndexedDB は同期書込不可のため。
     起動時 `get` が突合し IndexedDB へ昇格→ミラー削除。
  2. **レガシー移行**（`journal_v1_<key>`）… 旧 localStorageAdapter の既存データ。IndexedDB が空なら
     `get` で読み出し取込む（**既存ユーザの消失防止**）。
  3. 本体は IndexedDB（`journal_v1/kv`）。
- `get` の優先順位＝ ミラー ＞ IndexedDB ＞ レガシー。
- **受入条件クリア**：`npm run test:dataloss` が IndexedDB 構成で全 PASS。
  生命線として **4)「旧データの IndexedDB 移行」シナリオを恒久追加**（既存3＝自動保存/日付切替/beforeunload に加え）。

### レガシー移行を組み込んだ意図（重要・指示外の自発対応）
- 当初のハイブリッド定義は「ミラー保険」中心で、旧データ移行は明記が無かった。
- しかし移行なしで IndexedDB へ切替えると、**既存ユーザ（ますださん）の localStorage 上の日記が
  すべて不可視になり全消失に等しい**。これは本アプリの生命線（消失対策）に真っ向から反する。
- よって「冗長機能」ではなく**正当性の一部＝救済処理**として最小限で同梱した（`get` 内の数行）。
- 一度でも IndexedDB に書けば以後はレガシーを読まない。旧 localStorage は破棄せず凍結スナップショット
  として温存（追加の保険）。

### 次のステップ（この順・確定）
**→ 候補2：AI機能の決着（BYOK 方式）— ただし「設定画面・UIのガワ（骨組み）」のみ。**
- 方針：デフォルトはローカルLLM、オプションで APIキー入力の BYOK。
- ⚠️ **現在ローカルLLMの実通信テストができない環境。`api/client.js` の `callLocal`/`callCloud` の
  実挙動は深追いしない。** UI の器（BYOKキー入力欄／ローカル⇔BYOK切替UI／保存導線）だけを
  `components/settings.jsx`(AiSettings) と `api/client.js` を土台に整える範囲に留める。
- その後：候補3（ネイティブ化前の徹底コードレビュー）。

---

## 9. 候補2（AI: BYOK 方式）完了記録 — ガワのみ（2026-07 / Claude Code）

指示通り **UIの「ガワ（骨組み）」だけ**を実装。**通信ロジックは不変**（実機で認証検証できる環境が
整うまで深追いしない）。

- `components/settings.jsx`(AiSettings)：モード切替を「🖥 ローカル / 🔑 BYOK」に。
  BYOK 選択時に **APIキー入力欄（password）**、「キーは端末内にのみ保存」の注記、外部送信の警告を表示。
- `api/client.js`：`DEFAULT_AI_CONFIG` に `apiKey: ""` を追加（端末内保存）。
  `callCloud` には **NOTE のみ**を残し、`x-api-key` ヘッダへの配線は**未実施**（意図的保留）。
- 内部 `mode` は `local|cloud` を維持（"cloud" の表示名を BYOK に）→ **データ移行不要**。
- 保存経路(`useJournal`)・storage層は不変のため **test:dataloss 対象外**。`npm run build` 通過。

### 未配線（次に実機環境が整ったら）
- BYOK の実送信：`callCloud` で `headers` に `x-api-key: aiConfig.apiKey`（＋ `anthropic-version`）を配線。
- ローカルLLM(`callLocal`)の疎通確認。CORS 等の実挙動確認。

### 次のステップ（この順・確定）
**→ 候補3：スマホアプリ化の前に、徹底的なコードレビュー。**
- 今回の一連（3層分離リファクタ ＋ 候補1 IndexedDB ＋ 候補2 BYOKガワ）を総点検する。
- 観点：3層分離の責務境界／命名／消失対策の穴（ミラー・レガシー移行の端ケース）／
  IndexedDB アダプタの例外系・並行書込／BYOKガワの整合／未配線箇所の明示。
- レビュー通過後に初めて配布・ネイティブ化（React Native / Expo 等）の設計へ。
