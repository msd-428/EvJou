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
- レビュー通過後に初めて配布・ネイティブ化の設計へ。

---

## 10. コードレビューは別AIへ委任（レビュー担当者への申し送り）

候補3の全体コードレビューは**別のAIに依頼**する方針。レビュー担当者が知るべき前提を以下に置く。

### レビュー範囲と経緯
- 元は Claude.ai アーティファクトの**単一ファイル 2,377行**（`src/daily-journal.jsx`）。
- そこから3層分離（UI `components/` ／ ロジック `features/` ／ ストレージ `storage/`）へ再構成し、
  IndexedDB ハイブリッド移行と BYOK 設定UIのガワまでを実施済み（6〜9章参照）。
- **挙動不変を維持したリファクタ**であり、機能追加はしていない（BYOKのUIガワを除く）。

### 最優先で見てほしい観点（重要度順）
1. **手入力の消失対策**＝このアプリの生命線。`features/useJournal.js` と
   `storage/indexedDbAdapter.js` の相互作用（800ms自動保存／日付切替フラッシュ／
   beforeunload同期ミラー／レガシー移行／IndexedDB読取失敗時のフォールバック）。
   **端ケースと競合状態**（同一キーへの並行書込、ミラー昇格中のクラッシュ、
   複数タブ同時編集、容量超過/QuotaExceeded、プライベートモードでのIndexedDB不可）。
2. **ストレージ抽象の契約遵守** … `get/set/remove/setSync` の契約が守られているか。
   localStorage がアダプタ内部から漏れていないか（外から不可視であること）。
3. **3層分離の責務境界** … UIに状態が漏れていないか、フックが他ドメインへ手を伸ばしていないか、
   App（オーケストレータ）に残した横断処理（AIパネル／エクスポート／危険ゾーン）の妥当性。
4. **タイムゾーン** … 日付キーは必ず `toLocalDateStr()`（ローカル基準）。`toISOString()` は禁止。
5. **未配線の明示** … BYOK通信（`api/client.js` の `callCloud`）は**意図的に未配線**。
   これは不備ではなく決定事項（実機で認証検証できる環境が未整備）。指摘は歓迎だが修正はしない。

### レビュー担当者が踏まないでほしい地雷
- **`docs/user-context.md` の「不採用の決定一覧」は再提案禁止**（検索機能・通知・ホーム画面・
  ハンバーガーメニュー・ToDoの繰り返し・企業向け展開 等）。良し悪しの議論ではなく決定事項。
- **開発原則は 4S・凡事徹底・質実剛健**。冗長処理・裏口実装・飾りの機能・過剰な抽象化は嫌われる。
  「堅牢にするため」の防御コード追加提案は、消失対策以外では歓迎されにくい。
- **修正は小さく、都度ビルド検証**。大きな一括書き換えは過去にパーサエラーを起こした実績あり。
- **保存経路（`storage/` ・ `useJournal.js`）に触れたら必ず** `npm run test:dataloss`
  （4シナリオ全PASS必須）。ローカルでは初回のみ `npx playwright install chromium`。

### 既知の未修正事項（レビュー前に共有）
- **`cloudModel` の既定値が引退済みモデルID**：`api/client.js` / `components/settings.jsx` /
  `docs/app-specification.md` の3箇所に `claude-sonnet-4-20250514` が残っている。
  このIDは **2026-06-15 に引退済み**で、現在呼ぶと 404 になる。BYOK配線フェーズで
  現行ID（`claude-sonnet-5` もしくは `claude-opus-5`）へ更新すること。
  ※通信は未配線のため現状ユーザ影響はないが、配線した瞬間に効く不具合。
- 全リセット時、`useStorage` の自動永続化により各キーが「削除」ではなく「空値で再作成」される
  （このアプリでは空＝欠損で等価。IndexedDB化後の挙動は再確認の価値あり）。

---

## 11. 配布フェーズの方針（2026-07 決定）

**最終ゴール：Google Play ストアでの一般配布。** iOS も出せれば理想だが後回し（実機はiPadのみ）。
「サクサク進めたい、ただし品質も大事」＝**最短経路で出しつつ、消失対策の品質は落とさない**。

### 技術選定：React Native ではなく **Capacitor** を推奨（方針転換の提案）
仕様書の旧ロードマップは「React Native（Expo）でネイティブ化」だったが、**リファクタ完了後の
現状ではこれは高コストで、Capacitor が明確に有利**。レビュー後に判断すること。

| | Capacitor（推奨） | React Native / Expo（旧案） |
|---|---|---|
| UI層 | **そのまま使える**（WebView で現行DOMが動く） | **全面書き直し**（DOM不可・inline styleも移植不能） |
| ストレージ | IndexedDB がそのまま動く | AsyncStorage/SQLite へ**全面移行**＋消失対策の再設計 |
| 消失対策テスト | `test:dataloss` が**ほぼ流用可能** | 作り直し |
| 工数 | 小（ラップ＋調整） | 大（実質フルリライト） |

現行コードは**inline style の React DOM ＋ IndexedDB**。RN はこのUI層とストレージ層の
両方を捨てることになり、3層分離の成果を活かせない。Capacitor なら `dist/` をラップするだけ。

### Capacitor 採用時の要対応（品質の勘所）
1. **⚠️ WebView のデータ永続性が最大リスク**。Android では OS/ユーザ操作で WebView データが
   消去されうる。日記アプリとして致命的。→ **`storage/` に Capacitor Filesystem（または
   Preferences）アダプタを追加**し、IndexedDB と二重化する。**抽象化済みなので1ファイル追加で済む**
   ＝ここでリファクタの投資が回収される。採用条件は `test:dataloss` 相当が実機で全PASS。
2. **自動バックアップ導線**（エクスポートは既存）。端末故障・アプリ削除で全損しないこと。
3. `beforeunload` は WebView/アプリ終了で発火が不確実。Capacitor の
   `appStateChange`（background遷移）でのフラッシュを併用する。
4. PWA化（manifest / Service Worker）は Capacitor でも流用でき、Web配布も同時に取れる。

### Google Play の実務チェックリスト
- 開発者アカウント登録（一度きりの登録料。要確認）。
- **⚠️ 新規の個人開発者アカウントは、本番公開前に「12人以上のテスターで14日間の
  クローズドテスト」が必要**というポリシーがある（要確認・変更されうる）。
  **これはスケジュールに直撃する**ので、配布を決めたら**最初に確認・着手**すること。
- プライバシーポリシーの用意＋**データセーフティ申告**。本アプリは
  「日記は端末内のみ・サーバ送信なし」が強い売り。ただし **BYOK有効時は日記が外部APIへ
  送信される**ため、その旨を正しく申告する（虚偽申告はリジェクト/削除リスク）。
- 通知・リマインダーは不採用方針なので通知権限は不要（審査もその分軽い）。

### iOS について（後回し・Mac不要の道はある）
- iOS ビルドは**クラウドビルドサービスを使えば Mac なしでも可能**（要調査）。
  ただし **Apple Developer Program の年額費用**が必要で、審査も Play より厳しめ。
- **iPad はテスト端末として十分機能する**（iPhone向けアプリも実行可）。実機確認の障害にはならない。
- 判断：**まず Play に出して運用が回ってから iOS**。同時進行はしない（4S・最小構成）。

---


## 12. ver 1.1 — EvJou AI 統合（フロントエンド改修）完了記録（2026-07）

BYOK方式から**「EvJou AI（開発者のローカルLLMプロキシ）」をデフォルトとする3モード構成**へ移行。
バックエンド（プロキシサーバー）は別スレッドで構築済み。本セッションではフロントエンド側の改修を実施。

> **【2026-07 訂正】通信方式は Firestore 経由が正。** 本章には当初 HTTP 直叩き＋Cloudflare Tunnel
> 案の記述が混ざっていたが、実装・運用ともに **Firestore の `ai_requests` コレクション経由**
> （アプリが `addDoc` → ワーカーが `onSnapshot` で消化 → 結果を同ドキュメントに書き戻し）で確定。
> `PROXY_BASE_URL` / Cloudflare Tunnel は**不使用**。詳細は `.agents/AGENTS.md` §1 を正とすること。

### 3モード構成（確定）
- **`mode: "proxy"`（🤖 EvJou AI）** … デフォルト。ゼロコンフィグ。Firebase匿名ログイン後、Firestore `ai_requests` へリクエスト文書を作成し、ワーカーの書き戻しを `onSnapshot` で待つ（タイムアウト2分）。
- **`mode: "local"`（🖥 ローカルLLM）** … 既存のまま。ユーザーがエンドポイント/モデル名を設定。
- **`mode: "cloud"`（🔑 APIキー）** … 既存のBYOK。Anthropic APIキーを設定。`x-api-key` ヘッダ配線済み。

### 変更したファイル
- **[NEW] `src/lib/firebase.js`** … Firebase遅延初期化・匿名ログイン・`getIdToken(false)` によるトークン取得。
  Reactに依存しない純粋ロジック。AI通信時にのみ初期化される（アプリ起動時には走らない）。
- **`src/api/client.js`** … `callClaude` → `callAI` に改名。`callProxy` 新規追加。
  デフォルトmode を `"proxy"` に変更。戻り値を `{ text, remaining? }` に統一。
  エラーに `type` プロパティを付与（`rate_limit` / `server_down` / `auth` / `network`）。
- **`src/api/prompts.js`** / **`src/features/useSchedule.js`** … `callClaude` → `callAI`、`result.text` 対応。
- **`src/components/settings.jsx`** … 3モードUI。EvJou AIモード時はゼロコンフィグ＋残り回数表示。
- **`src/daily-journal.jsx`** … 初回同意ダイアログ（`proxyConsent`）、エラー型別メッセージ、
  残り回数state、ローディング文言改善（5秒後に「順番待ち中」）。
- **`proxy/index.js`** … Ollama転送先をOpenAI互換（`/v1/chat/completions`）に変更。
  NDJSON→一括JSON。`X-RateLimit-Remaining` / `X-RateLimit-Limit` ヘッダ追加。

### 変更しなかったファイル（設計意図）
- `src/storage/*` / `src/features/useJournal.js` / `src/main.jsx` — 保存経路・起動経路は不変。
- ストレージ層の抽象化のおかげで、AI通信の改修がストレージに一切波及しなかった。

### テスト結果
- `npm run build` … ✅ PASS（76 modules, gzip 107KB）
- `npm run test:dataloss` … ✅ 4/4 PASS（autosave / dateswitch / beforeunload / legacy migration）

### ⚠️ 実機での残作業（コード外の設定）
1. **Firebase Web API キー** … `src/lib/firebase.js` の `FIREBASE_CONFIG.apiKey` に設定。
   Firebaseコンソール → プロジェクト設定 → ウェブアプリ追加 → 表示される apiKey。
2. **Firebase匿名認証の有効化** … Firebaseコンソール → Authentication → ログイン方法 → 匿名 → 有効。
3. **Firestore の有効化とセキュリティルール** … `ai_requests` コレクションを、
   作成者本人（`uid` 一致）だけが読み書きできるルールにする。ワーカーは Admin SDK なので制限外。
   ※ URL 設定は不要（Firestore 経由のため公開エンドポイントを持たない）。
4. **実機疎通確認** … 上記設定後に、EvJou AI / ローカル / BYOK の各モードで動作確認。

### 次のステップ
1. 上記の残作業（Firebase設定・Firestoreルール・実機確認）を完了する。
2. プロキシワーカー（`proxy/index.js`）を自宅PCで常駐起動する（ポート開放・Tunnel は不要）。
3. 実機で3モード全ての動作を検証し、Play ストア配布に向けた最終調整へ進む。


---

## 13. レビュー修正 ＋ Dynamic Journal Fields 完了記録（2026-07-29 / Claude Code）

### やったこと
1. **前セッション実装（Dump Mode ToDo Approval）のレビューと修正**
   - 🔴 `addRoutineDirect` をループで複数回呼んでいたため、setState 未反映の古い `routines` を
     基点に上書きが起き、**ルーチンを2件以上承認すると1件しか保存されなかった**。
     `addRoutinesDirect(texts)` に変更し、1回の更新にまとめた（バッチ内重複・上限も判定）。
   - `useJournal` の未使用引数 `addExtractedTodos` を削除（承認は App 側の責務に移行済み）。
   - 提案リストの更新を関数アップデータ化。
2. **Dynamic Journal Fields**（バックログ消化）… 詳細は `.agents/AGENTS.md` §4。
3. **ドキュメントの矛盾解消** … §12 の Cloudflare Tunnel 記述に Firestore 正の訂正を追記。

### 設計上の判断（次に触る人が壊しやすい順）
1. **項目の `key` は絶対に変更しない。** 保存済みエントリとの対応そのもの。編集できるのは表示名だけ。
   設定UIも label しか書き換えない作りにしてある。
2. **項目を削除しても `entries` のデータは消さない。** 項目を戻せば過去の記録が再び見える。
   「見えない＝消えた」にしないこと（消失対策の原則）。
3. **`settings.journalFields` を `useJournal` の useEffect 依存に入れてはいけない。**
   設定保存のたびに新しい配列になるため、依存に入れると**入力中の未保存フォームが `entries` の
   内容で巻き戻る＝消失する**。欠損キーは UI 側で `?? ""` として扱うことで回避している
   （`useJournal.js` の該当箇所にコメントあり）。

### 検証
- `npm run build` … ✅ PASS
- `npm run test:dataloss` … ✅ **4/4 PASS**
- 実ブラウザ操作で項目の追加/リネーム/並替/削除/永続化/コア項目保護を確認 … ✅ 9/9
  （使い捨てスクリプトのため未コミット。恒久テスト化はしていない）

### 次のセッションへ
**→ バックログ最後の1件：Proxy Worker Queueing System（`proxy/index.js`）。**

⚠️ **キューは既に実装済み。作り直さないこと。** `p-queue`（`concurrency: 1` で直列＝GPU OOM回避）、
`processing` マーク、Ollama の5回リトライ＋`waiting_for_server` まで入っている。
残作業は**穴を塞ぐこと**で、具体的な指摘は `.agents/AGENTS.md` §4 に列挙した。要点：
- **最重要：クライアント2分タイムアウトとキュー滞留の衝突。** `api/client.js` の `callProxy` は
  120秒で reject する。直列処理＋リトライ（待機だけで最大20秒超）だと数件詰まっただけで超える。
- **`processing` のまま孤児化した文書が復帰しない**（監視クエリが `status == 'pending'` のため）。
- **UTC日付バグ**：`checkAndIncrementUsage()` の `toISOString().split('T')[0]` は
  **プロジェクト禁止事項**（日付はローカル基準）。日次カウンタが JST 9時に切り替わる。
- **上限は実際には課されていない**（カウントアップのみ）。`"無料利用枠"` の分岐は到達不能。
- **`ai_requests` の完了文書が溜まり続ける**（掃除処理なし）。

フロントは既に「5秒後に『順番待ち中』」へ文言が切り替わる作りになっている。活かせる。

### 製品方針 — オフライン優先の段階戦略（2026-07-29 決定・`docs/user-context.md` が正）
「一生オフラインのみ」ではない。フェーズを分ける戦略なので、取り違えないこと。
- **フェーズ1（当面の最優先）＝完全オフラインがデフォルト。** アカウント不要・端末内完結。
  テスト版を広める際の最初のフックが「手軽さ」と「ローカル完結の安心感」。
- **フェーズ2（リリース後）＝アカウント登録による端末間クラウド同期を"オプション"で提供する構想あり。**
  **ただし実装は後回し。** 同期を前提にした設計変更・データモデル変更を先回りで入れないこと。
  （ストレージ層は抽象化済みなので、後からアダプタを足せばよい）
- フェーズ2は**個人の端末間同期**の話。不採用一覧の**企業向け展開（マルチユーザー・サーバDB）とは別物**。

---

## 14. Proxy Worker Queueing System 完了記録（Antigravity）

### やったこと
1. **Dynamic Journal Fields** の実装（前回のセッションで対応済だった未コミット分）をコミット。
2. **バックログ「Proxy Worker Queueing System」の穴塞ぎ**を `proxy/index.js` で完遂。
   - **クライアントタイムアウトとキュー滞留の衝突解消**: `queue.size + queue.pending > 3` の場合、直ちに `errorType: 'rate_limit'` でエラー応答を返し、フロントエンドが120秒待たずに「現在サーバーが混み合っています」と表示できるようにした。
   - **孤児ドキュメントの救済**: 起動時に `processing` や `waiting_for_server` のまま放置されたドキュメントを `pending` に戻す `rescueOrphanedRequests` を追加。
   - **UTC日付バグの修正**: `Date.now() + 9 * 60 * 60 * 1000` を用いて、JSTの深夜0時に確実に利用回数がリセットされるように修正。
   - **利用回数上限（Limit）の実装**: 1日50回の上限を設け、超過時は明確にエラーをthrowしてクライアントに伝え、残り回数（`remaining`）も正しく計算して返却するようにした。
   - **`ai_requests` コレクションのクリーンアップ**: 起動時に、1時間以上経過した古い `completed` / `error` のドキュメントを一括削除する `cleanupOldRequests` を追加し、Firestoreの肥大化を防止。

### 次のステップ
- ローカル環境および実機（OPPO Reno A などの古いデバイスを含む）で、すべてのプロキシキューイングの挙動やAI利用回数の表示などを再確認する。
- 問題がなければ、Playストア配布に向けた最終のビルド・調整へと進む。
