// タスク別のAI呼び出し（プロンプト＋パース）。
// 出力はJSON。extractJson で前後の地の文・コードフェンスに耐えてパースする。

import { callClaude } from "./client.js";
import { extractJson } from "../lib/json.js";
import { normalizeSequence } from "../lib/domain.js";

// ダンプテキストを4フィールドへ整理し、稼働シーケンスを生成する
export async function dumpProcess(dumpText, form, goals) {
  const prompt =
`あなたはユーザーの外部前頭葉として機能するAIです。ユーザーは疲労や思考混濁の状態で脳内ノイズをそのままテキストとして出力します。以下のダンプテキストを処理してください。

# ユーザーの目標（参考情報・変更しない）
- 大目標: ${goals.bigGoal || "（未設定）"}
- 中目標: ${goals.midGoal || "（未設定）"}
- 近目標: ${goals.nearGoal || "（未設定）"}

# ユーザーのダンプテキスト
${dumpText}

# 既存のフォーム内容（上書きではなく統合する）
- 今日ありがたいこと: ${form.grateful || "（空）"}
- 今日の目標: ${form.todayGoal || "（空）"}
- 明日の目標: ${form.tomorrowGoal || "（空）"}
- ひとこと: ${form.memo || "（空）"}

# 処理タスク
1. ダンプテキストを4フィールドに振り分け整理。既存内容があれば統合・補完。
2. 原文にない情報を勝手に追加しない。
3. タスクが羅列されている場合はMECEに整理し優先順位をつける。
4. 「今日の稼働シーケンス」は必ず配列形式で、1アクション1要素。物理動線ベース。精神論禁止。例:「帰宅したら座らずに浴室へ直行」
5. どのフィールドにも属さない雑多な情報はmemoへ。

# 出力形式（JSONのみ。コードブロック記号不要）
{"grateful":"...","todayGoal":"...","tomorrowGoal":"...","memo":"...","sequence":["アクション1","アクション2"]}`;

  const raw = await callClaude([{ role: "user", content: prompt }], "", 2000);
  const parsed = JSON.parse(extractJson(raw));
  parsed.sequence = normalizeSequence(parsed.sequence);
  return parsed;
}

// 今日/明日の目標から具体的な実行可能ToDoを抽出する
export async function extractTodos(todayGoal, tomorrowGoal) {
  if (!todayGoal && !tomorrowGoal) return [];
  const prompt =
`以下のジャーナル内容から、具体的な実行可能ToDoタスクを抽出してください。

【今日の目標】${todayGoal || "（空）"}
【明日の目標】${tomorrowGoal || "（空）"}

# ルール
- 抽象的な目標ではなく、具体的なアクションのみ抽出
- 1タスク1アクション、15文字程度
- whenは "today" または "tomorrow"
- 最大5件、抽象的なら0件でもOK

# 出力形式（JSONのみ）
[{"text":"...","when":"today"}]`;

  const raw = await callClaude([{ role: "user", content: prompt }], "", 800);
  try { return JSON.parse(extractJson(raw)); }
  catch { return []; }
}
