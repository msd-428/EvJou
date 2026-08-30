import { useState } from "react";
import { useStorage } from "../storage/useStorage.js";
import { callAI, JSON_SYSTEM } from "../api/client.js";
import { extractJson } from "../lib/json.js";

// スケジュールドメイン：ベーススケジュール一覧・選択・AI生成した日次スケジュール。
// generateSchedule はジャーナル/目標という横断データに依存するため、引数で受け取る。
export function useSchedule() {
  const [baseList, setBaseList] = useStorage("base-schedule-list", []);
  const [activeBaseId, setActiveBaseId] = useStorage("active-base-id", null);
  const [generatedScheds, setGeneratedScheds] = useStorage("generated-schedules", {});
  const [schedLoading, setSchedLoading] = useState(false);

  const activeBase = baseList.find(b => b.id === activeBaseId) || null;

  const saveBaseSchedule = (newBase) => {
    const exists = baseList.some(b => b.id === newBase.id);
    const updated = exists
      ? baseList.map(b => b.id === newBase.id ? newBase : b)
      : [...baseList, newBase];
    setBaseList(updated);
    if (!activeBaseId) setActiveBaseId(newBase.id);
  };

  const switchActiveBase = (id) => setActiveBaseId(id);

  const deleteBase = (id) => {
    if (!window.confirm("このスケジュールを削除しますか？")) return;
    const updated = baseList.filter(b => b.id !== id);
    setBaseList(updated);
    if (activeBaseId === id) setActiveBaseId(updated[0]?.id || null);
  };

  // 今日のスケジュール生成。selDate/その日のエントリ/目標/ジャーナル項目/ToDoは App から受け取る。
  const generateSchedule = async ({ selDate, entry, goals, fields, todos }) => {
    if (!activeBase) { alert("先にベーススケジュールを設定してください"); return; }
    setSchedLoading(true);
    const base = activeBase;
    const e = entry;
    const fmt = (arr) => arr.map(b => b.time + " " + b.label).join("\n");
    const openTodos = todos.filter(t => !t.done && t.dueDate === selDate).map(t => `- ${t.text}`).join("\n") || "なし";
    const prompt =
`あなたは日次スケジュール作成AIです。以下の情報をもとに、今日の最適なスケジュールをJSON配列で返してください。コードブロック記号不要、JSONのみ。

## ベーススケジュール名
${base.name}

## 備考
${base.note || "（なし）"}

## 固定ブロック（変えない）
${fmt(base.blocks.filter(b => b.fixed)) || "なし"}

## 可変ブロック（調整OK）
${fmt(base.blocks.filter(b => !b.fixed)) || "なし"}

## 今日のジャーナル
- 大目標: ${goals.bigGoal || "未設定"}
- 中目標: ${goals.midGoal || "未設定"}
- 近目標: ${goals.nearGoal || "未設定"}
${fields.map(f => `- ${f.label}: ${e[f.key] || "未記入"}`).join("\n")}

## 今日の未完了ToDo
${openTodos}

## 出力形式
[{"time":"HH:MM","label":"タスク名","note":"コメント","fixed":true}]`;

    try {
      const result = await callAI([{ role: "user", content: prompt }], JSON_SYSTEM, 1500);
      const parsed = JSON.parse(extractJson(result.text));
      setGeneratedScheds({ ...generatedScheds, [selDate]: parsed });
    } catch (err) {
      alert("スケジュール生成に失敗しました: " + err.message);
    }
    setSchedLoading(false);
  };

  return {
    baseList, setBaseList, activeBaseId, setActiveBaseId,
    generatedScheds, setGeneratedScheds, schedLoading, activeBase,
    saveBaseSchedule, switchActiveBase, deleteBase, generateSchedule,
  };
}
