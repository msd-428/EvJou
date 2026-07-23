import { useState } from "react";
import { useStorage } from "../storage/useStorage.js";
import { uid } from "../lib/id.js";
import { normalizeRoutines, pruneByDateKey } from "../lib/domain.js";

// ルーチンドメイン：導入中/導入済ルーチン、日次チェック履歴、サブタブ、CRUD。
// settings は上限（limitRoutinePerTab）とチェック履歴の件数制限（limitRoutineCheckDays）に使う。
export function useRoutines(settings) {
  const [routines, setRoutines] = useStorage("routines", { active: [], done: [] }, normalizeRoutines);
  const [routineChecks, setRoutineChecks] = useStorage("routine-checks", {});
  const [routineInput, setRoutineInput] = useState("");
  const [routineSubTab, setRoutineSubTab] = useState("check");

  // 保存（useStorage が自動永続化）
  const saveRoutines = (next) => setRoutines(next);

  const addRoutine = () => {
    const text = routineInput.trim();
    if (!text) return;
    const targetTab = routineSubTab === "done" ? "done" : "active";
    const list = routines[targetTab];
    if (list.length >= settings.limitRoutinePerTab) { alert(`1タブ最大${settings.limitRoutinePerTab}個までです`); return; }
    if (list.some(r => r.text === text)) { alert("同じ内容がすでにあります"); return; }
    const newRoutine = { id: uid(), text, schedule: { type: "daily" } };
    saveRoutines({ ...routines, [targetTab]: [...list, newRoutine] });
    setRoutineInput("");
  };

  const removeRoutine = (tabName, id) => {
    saveRoutines({ ...routines, [tabName]: routines[tabName].filter(r => r.id !== id) });
    // 導入中ルーチンを消すときは、チェック履歴に残る孤児idも掃除する
    if (tabName === "active") {
      let changed = false;
      const cleaned = {};
      for (const [d, dc] of Object.entries(routineChecks)) {
        if (dc && dc[id] !== undefined) {
          const { [id]: _drop, ...rest } = dc;
          cleaned[d] = rest;
          changed = true;
        } else cleaned[d] = dc;
      }
      if (changed) setRoutineChecks(cleaned);
    }
  };

  const moveRoutine = (from, id) => {
    const to = from === "active" ? "done" : "active";
    const item = routines[from].find(r => r.id === id);
    if (!item) return;
    saveRoutines({
      ...routines,
      [from]: routines[from].filter(r => r.id !== id),
      [to]: [...routines[to], item],
    });
  };

  const updateRoutineSchedule = (tabName, id, schedule) => {
    saveRoutines({
      ...routines,
      [tabName]: routines[tabName].map(r => r.id === id ? { ...r, schedule } : r),
    });
  };

  const toggleRoutineCheck = (date, routineId) => {
    const dc = routineChecks[date] || {};
    const next = pruneByDateKey({
      ...routineChecks,
      [date]: { ...dc, [routineId]: !dc[routineId] },
    }, settings.limitRoutineCheckDays);
    setRoutineChecks(next);
  };

  return {
    routines, setRoutines, routineChecks, setRoutineChecks,
    routineInput, setRoutineInput, routineSubTab, setRoutineSubTab,
    saveRoutines, addRoutine, removeRoutine, moveRoutine, updateRoutineSchedule, toggleRoutineCheck,
  };
}
