// ドメインロジック（純粋関数）。UI・保存先に依存しない。
// 空フォーム生成、ToDoのグルーピング、稼働シーケンス／ルーチンの正規化、件数制限など。

import { uid } from "./id.js";
import { todayStr, getOffsetDate, getEndOfWeek } from "./date.js";
import { LIMITS, WEEKDAYS, DEFAULT_JOURNAL_FIELDS, CORE_FIELD_KEYS } from "../constants.js";

// ─── ジャーナル項目 ───
// 項目定義を正規化する。旧 settings.hiddenFields（表示/非表示だけの時代）からの移行もここで吸収。
// コア項目は削除不可なので、欠けていれば既定値から復元する。
export function normalizeJournalFields(fields, hiddenFields) {
  const source = Array.isArray(fields) && fields.length > 0
    ? fields
    : DEFAULT_JOURNAL_FIELDS.filter(f => !(hiddenFields || []).includes(f.key));

  const seen = new Set();
  const out = [];
  for (const f of source) {
    if (!f || !f.key || seen.has(f.key)) continue;
    seen.add(f.key);
    out.push({
      key: f.key,
      label: f.label || f.key,
      placeholder: f.placeholder || "",
      rows: f.rows || 3,
      core: CORE_FIELD_KEYS.includes(f.key),
    });
  }
  for (const c of DEFAULT_JOURNAL_FIELDS) {
    if (CORE_FIELD_KEYS.includes(c.key) && !seen.has(c.key)) out.push({ ...c, core: true });
  }
  return out;
}

// 空フォーム。項目はユーザー設定で増減するので定義から組み立てる。
export const emptyForm = (fields = DEFAULT_JOURNAL_FIELDS) => {
  const form = {};
  for (const f of fields) form[f.key] = "";
  return form;
};
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
// ToDoから導出する派生ビュー。シーケンス自体は保存しない（データはtodosに一元化）。
// 対象は「期限が今日以前」のToDo。繰り越し（昨日以前）と今日ぶんを分けて返す。
// 並び順は配列の格納順を維持する（AIが朝→夜の動線順で提案し、その順に追加されるため）。
export function buildTodaySequence(todos, today = todayStr()) {
  const inScope = (todos || []).filter(t => t.dueDate && t.dueDate <= today);
  const carried = inScope.filter(t => t.dueDate < today)
                         .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
  const todayItems = inScope.filter(t => t.dueDate === today);
  const all = [...carried, ...todayItems];
  return {
    carried,
    today: todayItems,
    total: all.length,
    doneCount: all.filter(t => t.done).length,
  };
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
