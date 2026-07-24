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
