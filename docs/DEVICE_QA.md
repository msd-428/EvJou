# OPPO Reno A 実機QA結果（2026-08-23）

## 1. 検証概要・環境同一性

- **検証日時**: 2026-08-23 05:16〜05:22 JST
- **担当**: Antigravity (実機QA・観測記録)
- **対象端末**: OPPO Reno A (`CPH1983` / ColorOS / Android 9 / Chrome 74 相当の WebView)
  - adb serial: `1d05e7bc`
- **対象パッケージ**: `com.masuda.evjou`
- **ビルド情報**:
  - `versionCode`: 3
  - `versionName`: 1.1.0
  - `lastUpdateTime`: `2026-08-23 05:09:10` (事前確認コマンド `adb -s 1d05e7bc shell dumpsys package com.masuda.evjou | findstr lastUpdateTime` にて確認一致)
- **対象コードブランチ**: `claude/evjou-ui-fixes-1f4fa5` (`E:/!master_0428/Document/Claude/evjou-ui-fixes`)

---

## 2. 検証結果一覧

| 項目 | 検証内容 | 判定 | 証拠スクリーンショット |
|---|---|---|---|
| **A. BottomSheet のヘッダー固定** | 設定シート・ルーチン詳細シート・スケジュール編集シートの最下部スクロール時にタイトルと✕ボタンが上部に固定されるか | **PASS** | `A1_settings_before_scroll.png`<br>`A1_settings_after_scroll.png`<br>`A2_routine_before_scroll.png`<br>`A2_routine_after_scroll.png`<br>`A3_schedule_before_scroll.png`<br>`A3_schedule_after_scroll.png` |
| **B. Android の戻るボタンでシートが閉じる** | 開いた状態の各シートで戻るボタン（`KEYCODE_BACK` / 4）を1回押下したとき、シートが閉じアプリが終了しないか | **PASS** | `B1_settings_after_back.png`<br>`B2_routine_after_back.png`<br>`B3_schedule_after_back.png` |
| **C. 通常画面での戻るボタン挙動** | シートを開いていない通常画面で戻るボタンを押下したとき、アプリが終了せず画面が保持されるか | **PASS** | `C_after_back_normal.png`<br>`C_after_back_journal.png` |
| **D. Markdown の描画** | AIタブの返答がアスタリスク等の生テキストではなくMarkdownとして描画されるか | **未実施**<br>(ワーカー停止のため) | `11_ai_tab.png`<br>`12_ai_history.png` |

---

## 3. 詳細な検証手順と観測事実

### A. BottomSheet のヘッダー固定（★本命項目）
- **設定シート (⚙️ アプリ設定)**:
  - 画面右上の ⚙️ アイコンをタップして設定シートを表示。
  - スクロール前: タイトル「⚙️ アプリ設定」と「✕」ボタンが上部に表示。
  - 最下部（「🗑 全データをリセット」）までスクロール: 上部のタイトル「⚙️ アプリ設定」および「✕」ボタンが画面上部に固定されて残り続けることを確認。Chrome 74 相当環境における縦Flex＋`min-height:0` / `overflowY:auto` の動作を確認。
  - **判定: PASS**
- **ルーチン詳細シート (🗓 てst)**:
  - 「🔁 ルーチン」→「🔄 導入中」→ ルーチン「てst」の「📅 毎日」ボタンをタップして詳細シートを表示。
  - スクロール前: タイトル「🗓 てst」と「✕」ボタンが表示。
  - 「曜日指定」展開・下部スクロール後: タイトル「🗓 てst」と「✕」ボタンが画面上部に固定表示されていることを確認。
  - **判定: PASS**
- **スケジュール編集シート (➕ 新しいベーススケジュール)**:
  - 「📅 予定」→「⚙️ ベーススケジュール」→「＋ 新規作成」をタップして編集シートを表示。
  - スクロール前: タイトル「➕ 新しいベーススケジュール」と「✕」ボタンが表示。
  - 最下部（「＋ ブロック追加」「💾 保存する」）までスクロール: タイトル「➕ 新しいベーススケジュール」と「✕」ボタンが画面上部に固定されて残り続けることを確認。
  - **判定: PASS**

### B. Android の戻るボタンでシートが閉じる
- **設定シート**:
  - 設定シートを開いた状態で `adb -s 1d05e7bc shell input keyevent 4` を実行。
  - 観測: 設定シートが閉じ、記録画面へ復帰。アプリは終了せずフォアグラウンドを維持。
  - **判定: PASS**
- **ルーチン詳細シート**:
  - ルーチン詳細シートを開いた状態で戻るボタンを押下。
  - 観測: ルーチン詳細シートが閉じ、ルーチン一覧画面へ復帰。アプリは終了せずフォアグラウンドを維持。
  - **判定: PASS**
- **スケジュール編集シート**:
  - スケジュール編集シートを開いた状態で戻るボタンを押下。
  - 観測: スケジュール編集シートが閉じ、予定画面へ復帰。アプリは終了せずフォアグラウンドを維持。
  - **判定: PASS**

### C. 何も開いていないときの戻るボタン
- シートを開いていない予定画面および記録画面で `adb -s 1d05e7bc shell input keyevent 4` を実行。
- 観測: アプリが終了せず、画面遷移も発生せず、現在の画面状態が維持された。
- **判定: PASS**

### D. Markdown の描画
- 観測事実:
  - 自宅PC上のプロキシワーカー（`proxy/index.js`）が停止中（nodeプロセス不在）であることを確認。
  - OPPO Reno A 端末内の AI タブ履歴（「履歴」サブタブ）は「まだ記録がありません」の状態であり、過去の返答データが存在しない。
- 判定: プロキシワーカー停止および端末内履歴不在のため、推測によるPASS判定は行わず、指示書のルールに基づき **「ワーカー停止のため未実施」** と記録。

---

## 4. スクリーンショット一覧（保存先: `docs/qa_screenshots_20260823/`）

1. `00_initial.png` — アプリ起動時の初期画面
2. `A1_settings_before_scroll.png` — 設定シート（スクロール前）
3. `A1_settings_after_scroll.png` — 設定シート（最下部スクロール後・ヘッダー固定確認）
4. `B1_settings_after_back.png` — 設定シートで戻るボタン押下後
5. `01_routine_tab.png` — ルーチンタブ画面
6. `02_routine_intro.png` / `03_routine_intro_active.png` — ルーチン導入中画面
7. `04_routine_added.png` / `06_routine_list.png` — ルーチン追加後画面
8. `A2_routine_before_scroll.png` — ルーチン詳細シート（スクロール前）
9. `A2_routine_after_scroll.png` — ルーチン詳細シート（スクロール後・ヘッダー固定確認）
10. `B2_routine_after_back.png` — ルーチン詳細シートで戻るボタン押下後
11. `07_schedule_tab.png` / `08_schedule_tab_active.png` / `09_schedule_tab.png` — 予定タブ画面
12. `10_schedule_base_open.png` — ベーススケジュール展開画面
13. `A3_schedule_before_scroll.png` — スケジュール編集シート（スクロール前）
14. `A3_schedule_after_scroll.png` — スケジュール編集シート（最下部スクロール後・ヘッダー固定確認）
15. `B3_schedule_after_back.png` — スケジュール編集シートで戻るボタン押下後
16. `C_after_back_normal.png` — 通常画面（予定）での戻るボタン押下後
17. `C_after_back_journal.png` — 通常画面（記録）での戻るボタン押下後
18. `11_ai_tab.png` — AIタブ画面
19. `12_ai_history.png` — AI履歴画面（履歴なし確認）
