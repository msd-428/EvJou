import { useState } from "react";
import { useStorage } from "../storage/useStorage.js";
import { uid } from "../lib/id.js";
import { todayStr, getOffsetDate } from "../lib/date.js";
import { pruneTodos } from "../lib/domain.js";

// ToDoドメインの状態とロジック。保存先は storage 層（useStorage）に隠蔽。
// settings は件数制限（limitDoneTodos）の参照にのみ使う。
export function useTodos(settings) {
  const [todos, setTodos] = useStorage("todos", []);
  const [todoInput, setTodoInput] = useState("");

  // 保存（完了ToDoの件数制限を適用）。useStorage が自動で永続化する。
  // 関数アップデータも受け付ける（提案タスクを1件ずつ連続で追加しても取りこぼさないため）。
  //
  // **下の操作はすべて関数アップデータで呼ぶこと。** クロージャの todos を読んで渡すと、
  // 同一描画サイクル内に2回操作したとき2回目が古い配列を基に上書きし、先の更新が消える
  // （連打で取りこぼす。docs/operations.md §5-1）。値渡しに戻さないこと。
  const saveTodos = (next) => setTodos(prev =>
    pruneTodos(typeof next === "function" ? next(prev) : next, settings.limitDoneTodos));

  const addTodoManual = () => {
    const text = todoInput.trim();
    if (!text) return;
    saveTodos(prev => [...prev, {
      id: uid(), text, done: false, source: "manual",
      createdAt: todayStr(), dueDate: null,
    }]);
    setTodoInput("");
  };

  const toggleTodo = (id) => saveTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const removeTodo = (id) => saveTodos(prev => prev.filter(t => t.id !== id));
  const updateTodoDueDate = (id, dueDate) => saveTodos(prev => prev.map(t => t.id === id ? { ...t, dueDate } : t));
  const updateTodoText = (id, text) => saveTodos(prev => prev.map(t => t.id === id ? { ...t, text } : t));

  const clearDoneTodos = () => {
    if (!window.confirm("完了済みのToDoをすべて削除しますか？")) return;
    saveTodos(prev => prev.filter(t => !t.done));
  };

  // AI抽出結果をToDoへ統合（既存テキストと重複しないものだけ追加）。
  // 日記保存・ダンプ整理の両方から呼ばれる共通処理。
  const addExtractedTodos = (extracted, baseDate) => {
    if (!extracted?.length) return;
    saveTodos(prev => {
      const existing = new Set(prev.map(t => t.text));
      const newTodos = extracted
        .filter(e => e.text && !existing.has(e.text))
        .map(e => ({
          id: uid(), text: e.text, done: false,
          source: "ai-" + (e.when || "today"),
          createdAt: baseDate,
          dueDate: e.when === "tomorrow" ? getOffsetDate(baseDate, 1) : baseDate,
        }));
      return newTodos.length > 0 ? [...prev, ...newTodos] : prev;
    });
  };

  return {
    todos, setTodos, todoInput, setTodoInput,
    saveTodos, addTodoManual, toggleTodo, removeTodo,
    updateTodoDueDate, updateTodoText, clearDoneTodos, addExtractedTodos,
  };
}
