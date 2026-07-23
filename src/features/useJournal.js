import { useState, useEffect, useRef } from "react";
import { useStorage } from "../storage/useStorage.js";
import { storageSet, storageSetSync } from "../storage/index.js";
import { todayStr } from "../lib/date.js";
import { emptyForm, normalizeSequence, pruneByDateKey } from "../lib/domain.js";
import { dumpProcess, extractTodos } from "../api/prompts.js";

// ジャーナル本体ドメイン：日記エントリ・選択日・入力フォーム・ダンプ整理・保存トースト。
// アプリの生命線である「手入力の消失防止」機構（800ms自動保存 / 日付切替フラッシュ /
// リロード保険）をここに集約する。設計上、保存経路は多重の保険で守る：
//   - 通常経路: setEntries（useStorage が自動永続化）
//   - 日付切替: フラッシュで setEntries に加え storageSet も明示（保険）
//   - リロード: beforeunload で storageSetSync（同期・await不可の局面）
//
// 横断データ（settings / goals / addExtractedTodos）は引数で受け取る。
export function useJournal({ settings, goals, addExtractedTodos }) {
  const [entries, setEntries] = useStorage("journal-entries", {});
  const [form, setForm] = useState(emptyForm());
  const [selDate, setSelDate] = useState(todayStr());
  const [saved, setSaved] = useState(false);

  const [dumpText, setDumpText] = useState("");
  const [dumpLoading, setDumpLoading] = useState(false);
  const [showDump, setShowDump] = useState(false);

  const [showSaveToast, setShowSaveToast] = useState(false);
  const saveToastTimer = useRef(null);

  // 最新値の参照と編集フラグ（effect のクロージャ古値対策）
  const dirtyRef = useRef(false);
  const formRef = useRef(form);   formRef.current = form;
  const entriesRef = useRef(entries); entriesRef.current = entries;
  const selDateRef = useRef(selDate); selDateRef.current = selDate;

  // エントリ保存（件数制限を適用）。useStorage が永続化する。
  const saveEntryState = (newForm) => {
    const updated = pruneByDateKey({ ...entries, [selDate]: newForm }, settings.limitEntriesDays);
    setEntries(updated);
  };

  // 日付変更時にフォーム同期（同期は外部由来なのでdirtyを立てない）
  useEffect(() => {
    if (entries[selDate]) {
      const entry = { ...emptyForm(), ...entries[selDate] };
      entry.sequence = normalizeSequence(entry.sequence);
      entry.sequenceChecks = entry.sequenceChecks || {};
      setForm(entry);
    } else {
      setForm(emptyForm());
    }
    dirtyRef.current = false;
  }, [selDate, entries]);

  // 編集後しばらくで自動保存（保存ボタン押し忘れ対策）
  useEffect(() => {
    if (!dirtyRef.current) return;
    const t = setTimeout(() => {
      saveEntryState(formRef.current);
      dirtyRef.current = false;
    }, 800);
    return () => clearTimeout(t);
  }, [form]);

  // 日付切替の直前に未保存をフラッシュ（cleanupは旧selDateで走る）
  // 保険として明示 storageSet も併用（消失を絶対に避ける）
  useEffect(() => {
    return () => {
      if (dirtyRef.current) {
        const updated = pruneByDateKey({ ...entriesRef.current, [selDate]: formRef.current }, settings.limitEntriesDays);
        entriesRef.current = updated;
        setEntries(updated);
        storageSet("journal-entries", updated);
        dirtyRef.current = false;
      }
    };
  }, [selDate]);

  // リロード/閉じる時の保険（同期保存）
  useEffect(() => {
    const h = () => {
      if (!dirtyRef.current) return;
      const updated = { ...entriesRef.current, [selDateRef.current]: formRef.current };
      storageSetSync("journal-entries", updated);
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  // 「最後に開いた日」モード時、選択日を記憶
  useEffect(() => {
    if (settings.startDateMode === "last") storageSet("last-date", selDate);
  }, [selDate, settings.startDateMode]);

  // ─── 保存トースト ───
  const showToast = () => {
    clearTimeout(saveToastTimer.current);
    setShowSaveToast(true);
    saveToastTimer.current = setTimeout(() => setShowSaveToast(false), (settings.toastSeconds || 5) * 1000);
  };
  const hideToast = () => {
    clearTimeout(saveToastTimer.current);
    setShowSaveToast(false);
  };

  // ─── 日記保存 ───
  const saveEntry = async () => {
    saveEntryState(form);
    dirtyRef.current = false;
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);

    if (!settings.autoExtractOnSave) return;
    try {
      const extracted = await extractTodos(form.todayGoal, form.tomorrowGoal);
      addExtractedTodos(extracted, selDate);
    } catch {}
  };

  // ─── ダンプ整理 ───
  const runDumpProcess = async () => {
    if (!dumpText.trim()) { alert("ダンプ内容を入力してください"); return; }
    setDumpLoading(true);
    try {
      const result = await dumpProcess(dumpText, form, goals);
      const newForm = {
        grateful: result.grateful || form.grateful || "",
        todayGoal: result.todayGoal || form.todayGoal || "",
        tomorrowGoal: result.tomorrowGoal || form.tomorrowGoal || "",
        memo: result.memo || form.memo || "",
        sequence: result.sequence,
        sequenceChecks: {},
      };
      setForm(newForm);
      dirtyRef.current = false;
      saveEntryState(newForm);
      showToast();

      if (settings.autoExtractOnDump) try {
        const extracted = await extractTodos(newForm.todayGoal, newForm.tomorrowGoal);
        addExtractedTodos(extracted, selDate);
      } catch {}
    } catch (err) {
      alert("整理に失敗しました: " + err.message);
    }
    setDumpLoading(false);
  };

  const clearDump = () => {
    if (!window.confirm("ダンプ入力をクリアしますか？")) return;
    setDumpText("");
  };

  // ジャーナル項目の編集（編集フラグを立てて自動保存の対象にする）
  const updateField = (key, value) => {
    dirtyRef.current = true;
    setForm({ ...form, [key]: value });
  };

  // ─── 稼働シーケンス個別チェック ───
  const toggleSequenceCheck = (idx) => {
    const checks = { ...(form.sequenceChecks || {}) };
    checks[idx] = !checks[idx];
    const newForm = { ...form, sequenceChecks: checks };
    setForm(newForm);
    saveEntryState(newForm);
  };

  return {
    entries, setEntries, form, setForm, selDate, setSelDate, saved,
    dumpText, setDumpText, dumpLoading, showDump, setShowDump,
    showSaveToast, hideToast,
    updateField, saveEntry, runDumpProcess, clearDump, toggleSequenceCheck,
  };
}
