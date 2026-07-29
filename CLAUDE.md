# CLAUDE.md

毎日のジャーナルアプリ（EvJou）。ますださんの「外部前頭葉」として機能する、ローカルファーストな日記＋タスク管理アプリ。

## まず読むもの
- `docs/app-specification.md` — 仕様書（v0.11）。機能・データ構造・決定済み仕様。
- `docs/user-context.md` — 決定履歴と**不採用一覧（再提案禁止）**。
- `HANDOFF.md` — Claude.ai アーティファクトからの移行メモ（初回用）。

## 開発の原則（ますださんの信条）
- **4S・凡事徹底・質実剛健**。最小構成を好む。冗長処理・裏口実装・飾りの機能を嫌う。
- 褒めより**建設的な批判・異論**を歓迎。応答は**簡潔**に。
- 「一発で決まるとは思ってない」→**段階的に**詰める。大きな一括書き換えは過去にパーサエラーを起こしたので、**小さく変えて都度ビルド検証**する。

## アーキテクチャ方針（リファクタリングの目標）
Microsoft To Do / Google ToDo のような **ローカルファースト設計**。将来 Firebase/Supabase でアカウント同期。まずはオフライン完結の堅牢な基盤を作る。

3層分離を進める：
1. **UI層** (`src/components/`) — 状態を持たない表示コンポーネント。
2. **ロジック層** (`src/lib/`, `src/api/`, 将来 `src/features/` のフック) — 状態管理・ドメインルール・AI通信。
3. **ストレージ層** (`src/storage/`) — 保存先を抽象化。`localStorage` → 将来 IndexedDB / クラウドDB へアダプタ差し替えで対応。UI・ロジックは保存先の実体を知らない。

`src/components/ErrorBoundary.jsx` で画面全体のクラッシュを防ぐ。

## ビルド・実行
```bash
npm install
npm run dev            # 開発サーバ
npm run build          # 本番ビルド（リファクタ後は必ず通す）
npm run test:dataloss  # 手入力消失対策の実機ブラウザ回帰テスト（生命線）
```

`test:dataloss` は Playwright で「自動保存(800ms)／日付切替フラッシュ／リロード保険(beforeunload)」を検証する。
ブラウザが別管理の環境では `PLAYWRIGHT_CHROMIUM=<chromiumパス>` を渡す。
**ジャーナルの保存経路（`src/features/useJournal.js`）を触ったら必ず通すこと。**

## 既知の地雷
- **`window.storage`**：Claude.ai アーティファクト専用API。通常環境には無い。`src/storage/` のアダブタに閉じ込め済み（localStorage 実装）。生の `window.storage` は追加しない。
- **クラウドAI**：`callCloud()` は Anthropic API をブラウザから直叩き。アーティファクト環境ではキーが自動注入されていたが、通常環境では認証が通らない。配布時のAI推論経路（BYOK / オンデバイス小型LLM）は**未決着の最大論点**。
- **タイムゾーン**：日付は必ず `toLocalDateStr()`（ローカル基準）。`toISOString()`（UTC）は使わない。

## 再提案禁止（`docs/user-context.md` 参照）
**恒久的に不採用**：ホーム画面追加 / ToDoの繰り返し / 目標の履歴保持 / ハンバーガーメニュー / 企業向け展開（認証・マルチユーザー・サーバDB）/ エラーログ解析の専用タブ / インアプリ疑似通知 等。

**v1スコープ外（否定ではない・リリース後なら再検討可）**：OS通知・リマインダー / 検索機能 / 古いデータの自動要約。
v1が出るまでは提案しないこと。判断基準は `docs/user-context.md` の該当表を見る。
