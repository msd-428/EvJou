// ドメインロジック（純粋関数）。UI・保存先に依存しない。
// 空フォーム生成、ToDoのグルーピング、稼働シーケンス／ルーチンの正規化、件数制限など。

import { uid } from "./id.js";
import { todayStr, getOffsetDate, getEndOfWeek } from "./date.js";
import { LIMITS, WEEKDAYS } from "../constants.js";

export const emptyForm = () => ({ grateful: "", todayGoal: "", tomorrowGoal: "", memo: "", sequence: [], sequenceChecks: {} });
export const emptyGoals = () => ({ bigGoal: "", midGoal: "", nearGoal: "" });

// ─── ToDoの期限グループ ───
export function getTodoGroup(dueDate) {
  if (!dueDate) return "none";
  const t = todayStr();
  if (dueDate < t) return "overdue";
  if (dueDate === t) return "today";
  if (dueDate === getOffsetDate(t, 1)) return "tomorrow";
  if (dueDate <= getEndOfWeek(t)) return "thisWeek";
  return "future";
}

// ─── 稼働シーケンス ───
// sequenceを常に配列に正規化（旧形式の文字列も配列化）
export function normalizeSequence(seq) {
  if (Array.isArray(seq)) return seq.filter(Boolean);
  if (typeof seq === "string") {
    return seq.split("\n").map(s => s.replace(/^[-・•*]\s*/, "").trim()).filter(Boolean);
  }
  return [];
}

// ─── ルーチンのスケジュール ───
// 旧形式（文字列）→ 新形式（オブジェクト）へ正規化
export function normalizeRoutine(r) {
  if (typeof r === "string") return { id: uid(), text: r, schedule: { type: "daily" } };
  return {
    id: r.id || uid(),
    text: r.text || "",
    schedule: r.schedule || { type: "daily" },
  };
}

export function normalizeRoutines(obj) {
  const o = obj || { active: [], done: [] };
  return {
    active: (o.active || []).map(normalizeRoutine),
    done: (o.done || []).map(normalizeRoutine),
  };
}

// その日にルーチンが対象かどうか
export function isRoutineDue(routine, dateStr) {
  const s = routine.schedule || { type: "daily" };
  if (s.type === "weekly") {
    const dow = new Date(dateStr).getDay();
    return Array.isArray(s.days) && s.days.includes(dow);
  }
  if (s.type === "interval") {
    if (!s.interval || s.interval < 1) return false;
    const anchor = s.anchor || dateStr;
    const diff = Math.round((new Date(dateStr) - new Date(anchor)) / 86400000);
    return diff >= 0 && diff % s.interval === 0;
  }
  return true; // daily
}

// スケジュールの要約ラベル
export function scheduleSummary(schedule) {
  const s = schedule || { type: "daily" };
  if (s.type === "weekly") {
    if (!s.days || s.days.length === 0) return "曜日未設定";
    if (s.days.length === 7) return "毎日";
    return "毎週 " + s.days.slice().sort((a, b) => a - b).map(d => WEEKDAYS[d]).join("");
  }
  if (s.type === "interval") return (s.interval || 1) + "日ごと";
  return "毎日";
}

// ─── 件数制限 ───
export function pruneByDateKey(obj, limit) {
  const keys = Object.keys(obj).sort();
  if (keys.length <= limit) return obj;
  const pruned = {};
  keys.slice(-limit).forEach(k => { pruned[k] = obj[k]; });
  return pruned;
}

export function pruneTodos(todos, limit = LIMITS.DONE_TODOS) {
  const done = todos.filter(t => t.done);
  const undone = todos.filter(t => !t.done);
  if (done.length <= limit) return todos;
  const keepDone = done.slice().sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""))
                       .slice(-limit);
  return undone.concat(keepDone);
}
