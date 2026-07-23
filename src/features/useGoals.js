import { useState } from "react";
import { useStorage } from "../storage/useStorage.js";
import { emptyGoals } from "../lib/domain.js";

// 目標ドメイン：大・中・近の3レイヤー（最新1セットのみ保持・上書き）。
// goalsEditing は編集用ドラフト。GoalEditor を開くときに goals から同期される（JSX側）。
export function useGoals() {
  const [goals, setGoals] = useStorage("goals", emptyGoals());
  const [goalsEditing, setGoalsEditing] = useState(emptyGoals());
  const [showGoals, setShowGoals] = useState(false);

  const saveGoals = () => {
    setGoals(goalsEditing);   // useStorage が自動永続化
    setShowGoals(false);
  };

  return { goals, setGoals, goalsEditing, setGoalsEditing, showGoals, setShowGoals, saveGoals };
}
