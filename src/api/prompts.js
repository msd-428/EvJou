// タスク別のAI呼び出し（プロンプト＋パース）。
// 出力はJSON。extractJson で前後の地の文・コードフェンスに耐えてパースする。

import { callAI, JSON_SYSTEM } from "./client.js";
import { extractJson } from "../lib/json.js";

// ダンプテキストをジャーナル項目へ整理する。
// 稼働シーケンスはここでは作らない：実行タスクは extractTodos → ToDo に一元化し、
// 「今日の稼働シーケンス」はその ToDo から導出する（データの二重管理を避ける）。
// 項目はユーザーが増減・リネームできるため、プロンプトも出力スキーマも fields から組み立てる。
export async function dumpProcess(dumpText, form, goals, fields) {
  const current = fields.map(f => `- ${f.label}: ${form[f.key] || "（空）"}`).join("\n");
  const keyMap = fields.map(f => `- ${f.key} = ${f.label}`).join("\n");
  const schema = fields.map(f => `"${f.key}":""`).join(",");
  const memoField = fields.find(f => f.key === "memo");
  const prompt =
`あなたはユーザーの外部前頭葉として機能するAIです。ユーザーは疲労や思考混濁の状態で脳内ノイズをそのままテキストとして出力します。以下のダンプテキストを処理してください。

# ユーザーの目標（参考情報・変更しない）
- 大目標: ${goals.bigGoal || "（未設定）"}
- 中目標: ${goals.midGoal || "（未設定）"}
- 近目標: ${goals.nearGoal || "（未設定）"}

# ユーザーのダンプテキスト
${dumpText}

# 既存のフォーム内容（上書きではなく統合する）
${current}

# 処理タスク
1. ダンプテキストを上記${fields.length}個の項目に振り分け整理。既存内容があれば統合・補完。
2. 原文にない情報を勝手に追加しない。
3. タスクが羅列されている場合はMECEに整理し、実行する順序（朝→夜の物理動線）に沿って並べ替える。精神論ではなく動作で書く。
4. ${memoField ? `どの項目にも属さない雑多な情報は「${memoField.label}」へ。` : "どの項目にも当てはまらない情報は捨てる。"}

# 出力形式（JSONのみ。コードブロック記号不要）
キーと項目の対応:
${keyMap}

キーは上記${fields.length}個だけ。値は日本語の文字列1つで、項目名や絵文字を値に含めない。
{${schema}}`;

  const messages = [{ role: "user", content: prompt }];
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await callAI(messages, JSON_SYSTEM, 2000);
    try {
      return JSON.parse(extractJson(result.text));
    } catch {
      if (attempt === 1) {
        throw new Error("AIの整理結果を読み取れませんでした。もう一度お試しください。");
      }
    }
  }
}

// 今日/明日の目標から具体的な実行可能ToDoを抽出する。
// 配列の並び順がそのまま「今日の稼働シーケンス」の並びになるため、順序を重視させる。
export async function extractTodos(todayGoal, tomorrowGoal) {
  if (!todayGoal && !tomorrowGoal) return [];
  const prompt =
`以下のジャーナル内容から、具体的な実行可能ToDoタスクを抽出してください。

【今日の目標】${todayGoal || "（空）"}
【明日の目標】${tomorrowGoal || "（空）"}

# ルール
- 抽象的な目標ではなく、具体的なアクションのみ抽出
- 1タスク1アクション、15文字程度。精神論ではなく物理的な動作で書く
- whenは "today" または "tomorrow"
- **配列は実行する順序で並べること**。todayのタスクは今日の物理的な動線（朝→昼→夜）順、
  同じ場所・同じ道具でまとめられるものは隣り合わせる。tomorrowはtodayの後ろにまとめる
- 最大5件、抽象的なら0件でもOK

# 出力形式（JSONのみ）
[{"text":"...","when":"today"}]`;

  const result = await callAI([{ role: "user", content: prompt }], JSON_SYSTEM, 800);
  try { return JSON.parse(extractJson(result.text)); }
  catch { return []; }
}
