import { useState, useEffect, useRef } from "react";

// 定数・ロジック・ストレージ・UIコンポーネントは各モジュールへ分離済み。
// このファイルは各フックとUIを組み立てる App（オーケストレータ）のみを担う。
import {
  COLORS, MAIN_TABS, ROUTINE_TABS, AI_SUB_TABS, DEFAULT_SETTINGS,
} from "./constants.js";
import { fmtDate, fmtShort, getRecentDates } from "./lib/date.js";
import {
  emptyForm, emptyGoals, normalizeSequence, normalizeRoutines,
  isRoutineDue, scheduleSummary, pruneByDateKey, pruneTodos,
} from "./lib/domain.js";
import { PERSONAS, DEFAULT_AI_CONFIG, applyAiConfig, callAI, getAiConfig } from "./api/client.js";
import {
  storageGet, storageSet, storageRemove, exportData, importDataFile,
} from "./storage/index.js";
import { useTodos } from "./features/useTodos.js";
import { useRoutines } from "./features/useRoutines.js";
import { useGoals } from "./features/useGoals.js";
import { useSchedule } from "./features/useSchedule.js";
import { useSettings } from "./features/useSettings.js";
import { useJournal } from "./features/useJournal.js";

import { Btn, TabBar, SaveToast, BottomSheet, DateSelector, CollapseSection, SettingButton, Banner, AIResult, EmptyState } from "./components/common.jsx";
import { ScheduleBlock, BaseScheduleEditor } from "./components/schedule.jsx";
import { SequenceChecklist, GoalEditor } from "./components/journal.jsx";
import { TodoListGrouped } from "./components/todo.jsx";
import { RoutineCheckView, RoutineStats, RoutineScheduleEditor } from "./components/routine.jsx";
import { GeneralSettings, AiSettings } from "./components/settings.jsx";

// ═══════════════ メインApp（オーケストレータ） ═══════════════

export default function App() {
  const [tab, setTab] = useState("write");

  const [editorState, setEditorState] = useState(null);
  const [showBaseList, setShowBaseList] = useState(false);

  const [routineSchedEdit, setRoutineSchedEdit] = useState(null);

  const [aiSubTab, setAiSubTab] = useState("chat");
  const [chatMsgs, setChatMsgs] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [trendText, setTrendText] = useState("");
  const [trendLoading, setTrendLoading] = useState(false);
  const [goalsText, setGoalsText] = useState("");
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [aiRemaining, setAiRemaining] = useState(null);
  const [aiLoadingStatus, setAiLoadingStatus] = useState("idle");
  const chatEndRef = useRef(null);

  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef(null);

  // ─── ドメインフック（状態管理・ロジックを分離） ───
  const { settings, setSettings, aiCfg, setAiCfg, saveAiCfg, saveSettings } = useSettings();
  const {
    todos, setTodos, todoInput, setTodoInput,
    saveTodos, addTodoManual, toggleTodo, removeTodo,
    updateTodoDueDate, updateTodoText, clearDoneTodos, addExtractedTodos,
  } = useTodos(settings);
  const {
    routines, setRoutines, routineChecks, setRoutineChecks,
    routineInput, setRoutineInput, routineSubTab, setRoutineSubTab,
    saveRoutines, addRoutine, addRoutinesDirect, removeRoutine, moveRoutine, updateRoutineSchedule, toggleRoutineCheck,
  } = useRoutines(settings);
  const {
    goals, setGoals, goalsEditing, setGoalsEditing, showGoals, setShowGoals, saveGoals,
  } = useGoals();
  const {
    baseList, setBaseList, activeBaseId, setActiveBaseId,
    generatedScheds, setGeneratedScheds, schedLoading, activeBase,
    saveBaseSchedule, switchActiveBase, deleteBase, generateSchedule,
  } = useSchedule();
  const {
    entries, setEntries, form, setForm, selDate, setSelDate, saved,
    dumpText, setDumpText, dumpLoading, showDump, setShowDump,
    showSaveToast, hideToast, proposedTodos, setProposedTodos,
    updateField, saveEntry, runDumpProcess, clearDump, toggleSequenceCheck,
  } = useJournal({ settings, goals });

  // AI提案タスクの承認。ToDo・ルーチンそれぞれ 1回の更新にまとめてから投入する。
  const handleApproveProposed = () => {
    const selected = proposedTodos.filter(p => p.selected);
    const toTodo = selected.filter(p => p.when !== "routine").map(p => ({ text: p.text, when: p.when }));
    const toRoutine = selected.filter(p => p.when === "routine").map(p => p.text);

    if (toTodo.length > 0) addExtractedTodos(toTodo, selDate);
    const rejected = toRoutine.length > 0 ? addRoutinesDirect(toRoutine) : 0;
    if (rejected > 0) alert(`${rejected}件のルーチンは上限超過または重複のため追加できませんでした。`);

    setProposedTodos([]);
  };

  // 初期ロード（日記本体と、起動時の表示設定）
  // 設定・各ドメインの値は各フックが useStorage で自ロードする。
  // ここは横断的な起動時挙動（開くタブ・開く日付）だけを担う。
  useEffect(() => {
    (async () => {
      const st = await storageGet("app-settings");
      if (st) {
        if (st.defaultTab) setTab(st.defaultTab);
        if (st.startDateMode === "last") {
          const last = await storageGet("last-date");
          if (last && typeof last === "string") setSelDate(last);
        }
      }
    })();
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMsgs, chatLoading]);

  // EvJou AI 初回同意チェック。同意済みなら true、未同意なら確認ダイアログを出す。
  const checkProxyConsent = () => {
    if (aiCfg.mode !== "proxy" || aiCfg.proxyConsent) return true;
    if (window.confirm("EvJou AIを利用すると、日記の内容が開発者のサーバーに送信されます。\nサーバー上にデータは保存されません。\n\n利用しますか？")) {
      const next = { ...aiCfg, proxyConsent: true };
      saveAiCfg(next);
      return true;
    }
    return false;
  };

  // AI呼び出し結果から残り回数を更新
  const updateRemaining = (result) => {
    if (result?.remaining != null) setAiRemaining(result.remaining);
  };

  // AIエラーのメッセージ生成
  const aiErrorMessage = (err) => {
    if (err?.type === "rate_limit") return "AI利用制限に達しました。しばらくしてからお試しください。";
    if (err?.type === "server_down") return "AIサーバーがメンテナンス中です。日記やToDoは通常通り使えます。";
    if (err?.type === "auth") return "認証に失敗しました。アプリを再起動してください。";
    if (err?.type === "network") return "インターネット接続を確認してください。";
    return "AI接続エラーが発生しました。";
  };

  const todaySched = generatedScheds[selDate] || null;
  const sortedDates = Object.keys(entries).sort().reverse();

  // ─── AI ───
  const buildChatSystem = (date) => {
    const e = entries[date] || form;
    const openTodos = todos.filter(t => !t.done).map(t => `・${t.text}${t.dueDate ? `（〜${fmtShort(t.dueDate)}）` : ""}`).join("\n") || "なし";
    const dueR = routines.active.filter(r => isRoutineDue(r, date));
    const dc = routineChecks[date] || {};
    const rDone = dueR.filter(r => dc[r.id]).length;
    const routineLine = dueR.length ? `${rDone}/${dueR.length} 達成（${dueR.map(r => (dc[r.id] ? "✓" : "□") + r.text).join("、")}）` : "対象なし";
    const sched = (generatedScheds[date] || []).map(b => `${b.time} ${b.label}`).join(" / ") || "未生成";
    const persona = PERSONAS[aiCfg.persona] || PERSONAS.spartan;
    const journalLines = settings.journalFields.map(f => `【${f.label}】${e[f.key] || "未記入"}`).join("\n");
    return `${persona.tone}
以下は${fmtDate(date)}のジャーナルエントリだ。この人格を最後まで崩さず会話すること。
【大目標】${goals.bigGoal || "未設定"}
【中目標】${goals.midGoal || "未設定"}
【近目標】${goals.nearGoal || "未設定"}
${journalLines}
【未完了ToDo】
${openTodos}
【本日のルーチン】${routineLine}
【本日のスケジュール】${sched}
最初のメッセージでは内容を簡潔にまとめてコメントし「何か話したいことはありますか？」と聞いてください。`;
  };

  const startChat = async (date) => {
    if (!checkProxyConsent()) return;
    setAiSubTab("chat"); setTab("ai"); setChatMsgs([]); setChatLoading(true);
    try {
      const result = await callAI(
        [{ role: "user", content: "今日のエントリをまとめてコメントしてください。" }],
        buildChatSystem(date),
        1200,
        (status) => setAiLoadingStatus(status)
      );
      updateRemaining(result);
      setChatMsgs([{ role: "assistant", content: result.text }]);
    } catch (err) {
      setChatMsgs([{ role: "assistant", content: aiErrorMessage(err) }]);
    }
    setChatLoading(false);
    setAiLoadingStatus("idle");
  };

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    if (!checkProxyConsent()) return;
    const next = [...chatMsgs, { role: "user", content: chatInput.trim() }];
    setChatMsgs(next); setChatInput(""); setChatLoading(true);
    try {
      const result = await callAI(next, buildChatSystem(selDate), 1200, (status) => setAiLoadingStatus(status));
      updateRemaining(result);
      setChatMsgs([...next, { role: "assistant", content: result.text }]);
    } catch (err) {
      setChatMsgs([...next, { role: "assistant", content: aiErrorMessage(err) }]);
    }
    setChatLoading(false);
    setAiLoadingStatus("idle");
  };

  const runTrend = async () => {
    if (!checkProxyConsent()) return;
    setAiSubTab("trend"); setTrendLoading(true);
    const recent = Object.keys(entries).sort().slice(-7).map(d => {
      const e = entries[d];
      const body = settings.journalFields.map(f => `${f.label}: ${e[f.key] || ""}`).join("\n");
      return `=== ${fmtDate(d)} ===\n${body}`;
    }).join("\n\n");
    try {
      const result = await callAI([{ role: "user", content: "以下の直近の日記を分析し、傾向・成長・アドバイスをください。\n\n" + recent }], null, 1200, (status) => setAiLoadingStatus(status));
      updateRemaining(result);
      setTrendText(result.text);
    } catch (err) { setTrendText(aiErrorMessage(err)); }
    setTrendLoading(false);
    setAiLoadingStatus("idle");
  };

  const runGoals = async () => {
    if (!checkProxyConsent()) return;
    setAiSubTab("goals"); setGoalsLoading(true);
    const recent = Object.keys(entries).sort().slice(-14).map(d => {
      const e = entries[d];
      const body = settings.journalFields.map(f => `${f.label}=「${e[f.key] || ""}」`).join(" ");
      return `${fmtDate(d)}: ${body}`;
    }).join("\n");
    const openTodos = todos.filter(t => !t.done).map(t => `・${t.text}`).join("\n") || "なし";
    const recentDates = getRecentDates(settings.statsLongDays);
    const routineSummary = routines.active.map(r => {
      const due = recentDates.filter(d => isRoutineDue(r, d));
      const done = due.filter(d => routineChecks[d] && routineChecks[d][r.id]).length;
      const rate = due.length ? Math.round((done / due.length) * 100) : 0;
      return `・${r.text}: ${rate}%`;
    }).join("\n") || "なし";
    const prompt =
`ユーザーの設定した目標と直近の行動を比較し、目標との整合性を分析してください。

【大目標】${goals.bigGoal || "未設定"}
【中目標】${goals.midGoal || "未設定"}
【近目標】${goals.nearGoal || "未設定"}

【直近14日の記録】
${recent}

【未完了ToDo】
${openTodos}

【ルーチン達成率（直近${settings.statsLongDays}日）】
${routineSummary}

1. 最近の行動は各目標にどれだけ近づいているか
2. 目標との乖離や注意すべきパターン
3. 目標達成のための具体的な次のアクション提案`;
    try {
      const result = await callAI([{ role: "user", content: prompt }], null, 1200, (status) => setAiLoadingStatus(status));
      updateRemaining(result);
      setGoalsText(result.text);
    }
    catch (err) { setGoalsText(aiErrorMessage(err)); }
    setGoalsLoading(false);
    setAiLoadingStatus("idle");
  };

  // ─── 設定 ───
  const handleExport = () => {
    exportData({ entries, baseList, activeBaseId, generatedScheds, routines, routineChecks, todos, goals, aiCfg, settings });
  };

  const manualPrune = async () => {
    if (!window.confirm("件数制限を超えた古いデータを削除します。よろしいですか？")) return;
    const e = pruneByDateKey(entries, settings.limitEntriesDays);
    const t = pruneTodos(todos, settings.limitDoneTodos);
    const c = pruneByDateKey(routineChecks, settings.limitRoutineCheckDays);
    setEntries(e); setTodos(t); setRoutineChecks(c);
    await storageSet("journal-entries", e);
    await storageSet("todos", t);
    await storageSet("routine-checks", c);
    alert("整理が完了しました");
  };

  // ─── 危険ゾーン：個別/全削除 ───
  const clearDataType = async (type) => {
    const meta = {
      entries:  { label: "日記の記録", setter: setEntries, store: "journal-entries", empty: {} },
      todos:    { label: "ToDo", setter: setTodos, store: "todos", empty: [] },
      routines: { label: "ルーチン", setter: setRoutines, store: "routines", empty: { active: [], done: [] } },
      schedules:{ label: "生成スケジュール", setter: setGeneratedScheds, store: "generated-schedules", empty: {} },
    }[type];
    if (!meta) return;
    if (!window.confirm(`「${meta.label}」をすべて削除します。元に戻せません。よろしいですか？`)) return;
    meta.setter(meta.empty);
    await storageSet(meta.store, meta.empty);
    alert(`${meta.label}を削除しました`);
  };

  const resetAllData = async () => {
    if (!window.confirm("すべてのデータ（日記・目標・ToDo・ルーチン・スケジュール・設定）を削除します。元に戻せません。")) return;
    if (!window.confirm("本当に全消去してよろしいですか？ この操作は取り消せません。")) return;
    const keys = ["journal-entries","goals","base-schedule-list","active-base-id",
      "generated-schedules","routines","routine-checks","todos","ai-config","app-settings"];
    for (const k of keys) {
      await storageRemove(k);
    }
    setEntries({}); setGoals(emptyGoals()); setGoalsEditing(emptyGoals());
    setBaseList([]); setActiveBaseId(null); setGeneratedScheds({});
    setRoutines({ active: [], done: [] }); setRoutineChecks({}); setTodos([]);
    setAiCfg(DEFAULT_AI_CONFIG); applyAiConfig(DEFAULT_AI_CONFIG);
    saveSettings(DEFAULT_SETTINGS);   // journalFields を正規化して戻す
    setForm(emptyForm());
    alert("全データを削除しました");
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError("");
    try {
      const data = await importDataFile(file);
      if (!data || typeof data !== "object" || !data.version) {
        throw new Error("フォーマットが正しくありません");
      }
      const isPlainObj = (v) => v && typeof v === "object" && !Array.isArray(v);
      // フィールドごとに期待する型を検証（壊れたデータの復元を防ぐ）
      const SHAPES = {
        entries: isPlainObj,
        baseList: Array.isArray,
        activeBaseId: (v) => typeof v === "string",
        generatedScheds: isPlainObj,
        routines: (v) => isPlainObj(v) && Array.isArray(v.active) && Array.isArray(v.done),
        routineChecks: isPlainObj,
        todos: Array.isArray,
        goals: isPlainObj,
        aiCfg: isPlainObj,
      };
      const restore = async (key, setter, storeKey, transform) => {
        if (data[key] === undefined || data[key] === null) return;
        if (SHAPES[key] && !SHAPES[key](data[key])) {
          throw new Error(`「${key}」のデータ形式が不正です`);
        }
        const value = transform ? transform(data[key]) : data[key];
        setter(value);
        await storageSet(storeKey, value);
      };
      await restore("entries", setEntries, "journal-entries");
      await restore("baseList", setBaseList, "base-schedule-list");
      await restore("activeBaseId", setActiveBaseId, "active-base-id");
      await restore("generatedScheds", setGeneratedScheds, "generated-schedules");
      await restore("routines", setRoutines, "routines", normalizeRoutines);
      await restore("routineChecks", setRoutineChecks, "routine-checks");
      await restore("todos", setTodos, "todos");
      if (data.goals) {
        if (!isPlainObj(data.goals)) throw new Error("「goals」のデータ形式が不正です");
        setGoals(data.goals); setGoalsEditing(data.goals);
        await storageSet("goals", data.goals);
      }
      if (data.aiCfg && isPlainObj(data.aiCfg)) {
        await saveAiCfg(data.aiCfg);
      }
      if (data.settings && isPlainObj(data.settings)) {
        await saveSettings(data.settings);
      }
      setImportSuccess(true);
      setTimeout(() => setImportSuccess(false), 3000);
    } catch (err) {
      setImportError(err.message);
    }
    e.target.value = "";
  };

  // ═══════════════ Render ═══════════════

  return (
    <div style={{ fontFamily:"'Helvetica Neue', sans-serif", maxWidth:680, margin:"0 auto", padding:16, background:"#f8f5f0", minHeight:"100vh" }}>

      {editorState && <BaseScheduleEditor initial={editorState.base} onSave={saveBaseSchedule} onClose={() => setEditorState(null)} />}
      {routineSchedEdit && (
        <RoutineScheduleEditor
          routine={routineSchedEdit.routine}
          onSave={(schedule) => { updateRoutineSchedule(routineSchedEdit.tab, routineSchedEdit.routine.id, schedule); setRoutineSchedEdit(null); }}
          onClose={() => setRoutineSchedEdit(null)}
        />
      )}
      <SaveToast visible={showSaveToast} onClose={hideToast} />

      {showSettings && (
        <BottomSheet title="⚙️ アプリ設定" onClose={() => { setShowSettings(false); setImportError(""); setImportSuccess(false); }}>
          <p style={{ margin:"0 0 12px", fontWeight:700, fontSize:13, color:"#aaa", letterSpacing:1 }}>AI接続</p>
          <AiSettings cfg={aiCfg} onSave={saveAiCfg} aiRemaining={aiRemaining} />

          <p style={{ margin:"0 0 12px", fontWeight:700, fontSize:13, color:"#aaa", letterSpacing:1 }}>表示・動作</p>
          <GeneralSettings settings={settings} onSave={saveSettings} />

          <p style={{ margin:"0 0 12px", fontWeight:700, fontSize:13, color:"#aaa", letterSpacing:1 }}>データ管理</p>
          <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:24 }}>
            <SettingButton icon="📤" title="エクスポート" desc="全データをJSONで保存" onClick={handleExport} />
            <SettingButton icon="📥" title="インポート" desc="JSONから復元" onClick={() => fileInputRef.current?.click()} />
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} style={{ display:"none" }} />
            <SettingButton icon="🧹" title="古いデータを整理" desc="件数制限を超えた古いデータを削除します" onClick={manualPrune} variant="warm" />
          </div>

          {importSuccess && <Banner type="success">✅ インポート完了！</Banner>}
          {importError && <Banner type="error">❌ {importError}</Banner>}

          <p style={{ margin:"0 0 12px", fontWeight:700, fontSize:13, color:"#aaa", letterSpacing:1 }}>アプリ情報</p>
          <div style={{ background:"#f8f5f0", borderRadius:12, padding:"12px 16px", fontSize:13, color:"#888", lineHeight:1.8, marginBottom:24 }}>
            <p style={{ margin:0 }}>バージョン: v0.10</p>
            <p style={{ margin:0 }}>記録数: {Object.keys(entries).length} 日分 <span style={{ fontSize:11, color:"#bbb" }}>(上限 {settings.limitEntriesDays}日)</span></p>
            <p style={{ margin:0 }}>ベーススケジュール: {baseList.length} 件</p>
            <p style={{ margin:0 }}>ルーチン: {routines.active.length} 導入中 / {routines.done.length} 導入済</p>
            <p style={{ margin:0 }}>ルーチンチェック: {Object.keys(routineChecks).length} 日分 <span style={{ fontSize:11, color:"#bbb" }}>(上限 {settings.limitRoutineCheckDays}日)</span></p>
            <p style={{ margin:0 }}>ToDo: {todos.filter(t => !t.done).length} 未完了 / {todos.filter(t => t.done).length} 完了済 <span style={{ fontSize:11, color:"#bbb" }}>(完了済上限 {settings.limitDoneTodos}件)</span></p>
          </div>

          <p style={{ margin:"0 0 12px", fontWeight:700, fontSize:13, color:COLORS.danger, letterSpacing:1 }}>⚠️ 危険ゾーン</p>
          <div style={{ border:`1px solid #f5c2c2`, borderRadius:12, padding:14, marginBottom:8 }}>
            <p style={{ margin:"0 0 10px", fontSize:12, color:COLORS.textSub, lineHeight:1.6 }}>削除したデータは元に戻せません。先にエクスポートでバックアップを推奨します。</p>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:12 }}>
              <Btn variant="danger" small onClick={() => clearDataType("entries")}>日記を削除</Btn>
              <Btn variant="danger" small onClick={() => clearDataType("todos")}>ToDoを削除</Btn>
              <Btn variant="danger" small onClick={() => clearDataType("routines")}>ルーチンを削除</Btn>
              <Btn variant="danger" small onClick={() => clearDataType("schedules")}>生成予定を削除</Btn>
            </div>
            <button onClick={resetAllData} style={{
              width:"100%", padding:"12px", borderRadius:10, border:"none", cursor:"pointer",
              background:COLORS.danger, color:"#fff", fontWeight:700, fontSize:14,
            }}>🗑 全データをリセット</button>
          </div>
        </BottomSheet>
      )}

      <div style={{ position:"relative", marginBottom:20 }}>
        <h1 style={{ textAlign:"center", color:COLORS.text, fontSize:22, margin:"0 0 4px" }}>📓 {settings.appTitle || "毎日のジャーナル"}</h1>
        <p style={{ textAlign:"center", color:COLORS.textSub, fontSize:13, margin:0 }}>{settings.appSubtitle || ""}</p>
        <button onClick={() => setShowSettings(true)} aria-label="設定" title="設定"
          style={{ position:"absolute", top:0, right:0, background:"none", border:"none", cursor:"pointer", fontSize:18, color:"#c4bfb8", padding:"4px 6px", lineHeight:1 }}>⚙️</button>
      </div>

      <TabBar tabs={MAIN_TABS} active={tab} onChange={setTab} />

      {tab === "write" && (
        <div>
          <DateSelector value={selDate} onChange={setSelDate} />

          {/* ダンプモード */}
          {settings.showDumpMode && (
          <CollapseSection
            open={showDump} onToggle={() => setShowDump(!showDump)}
            title="🧠 ダンプモード" titleColor="#6c63ff"
            openBorder="2px solid #6c63ff" closedBg="#f0eeff" closedBorder="1px dashed #c4bfff"
          >
            <p style={{ margin:"0 0 10px", fontSize:12, color:"#888", lineHeight:1.6 }}>
              思考をそのまま吐き出してください。整理されていなくてOK。AIが各フィールドに振り分け、今日の物理的な稼働シーケンスも出力します。
            </p>
            <textarea value={dumpText} onChange={e => setDumpText(e.target.value)}
              placeholder="例：大きな目標は前回同様。近いうちにぬか床調整したい。今日は洗濯と豆の小分け。"
              rows={7}
              style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:"1px solid #e0dcd5", fontSize:14, resize:"vertical", background:"#fafafa", boxSizing:"border-box", lineHeight:1.7, color:"#333", marginBottom:10 }} />
            <div style={{ display:"flex", gap:8 }}>
              <Btn variant="primary" onClick={runDumpProcess} disabled={dumpLoading || !dumpText.trim()} style={{ flex:2, padding:"12px" }}>
                {dumpLoading ? "⏳ AIが整理中..." : "✨ AIで整理する"}
              </Btn>
              <Btn variant="ghost" onClick={clearDump} disabled={dumpLoading || !dumpText} style={{ flex:1, padding:"12px" }}>🗑 クリア</Btn>
            </div>
            <SequenceChecklist sequence={form.sequence} checks={form.sequenceChecks} onToggle={toggleSequenceCheck} />
          </CollapseSection>
          )}

          {/* 目標 */}
          <CollapseSection
            open={showGoals} onToggle={() => { setShowGoals(!showGoals); setGoalsEditing(goals); }}
            title="🎯 目標" titleColor="#38a169"
            openBorder="2px solid #38a169" closedBg="#fafafa" closedBorder="1px solid #e0dcd5"
            compact
            summary={!showGoals && (goals.bigGoal || goals.midGoal || goals.nearGoal) ? (
              <div style={{ marginTop:10, fontSize:12, color:"#666", lineHeight:1.8 }}>
                {goals.bigGoal && <div><strong style={{ color:"#38a169" }}>大:</strong> {goals.bigGoal}</div>}
                {goals.midGoal && <div><strong style={{ color:"#d97706" }}>中:</strong> {goals.midGoal}</div>}
                {goals.nearGoal && <div><strong style={{ color:"#6c63ff" }}>近:</strong> {goals.nearGoal}</div>}
              </div>
            ) : null}
            closedHint={(goals.bigGoal || goals.midGoal || goals.nearGoal) ? "（タップで編集）" : "（未設定・タップで編集）"}
          >
            <p style={{ margin:"0 0 12px", fontSize:12, color:"#888", lineHeight:1.6 }}>
              目標は別管理されます。全ての機能（AIチャット・スケジュール生成・ダンプ整理）で参照されます。
            </p>
            <GoalEditor goals={goalsEditing} onChange={setGoalsEditing} />
            <div style={{ display:"flex", gap:8 }}>
              <Btn variant="success" onClick={saveGoals} style={{ flex:2, padding:"11px" }}>💾 目標を保存</Btn>
              <Btn variant="ghost" onClick={() => { setShowGoals(false); setGoalsEditing(goals); }} style={{ flex:1, padding:"11px" }}>キャンセル</Btn>
            </div>
          </CollapseSection>

          {settings.journalFields.map(f => (
            <div key={f.key} style={{ marginBottom:16 }}>
              <label style={{ display:"block", fontWeight:700, color:"#3a3a3a", fontSize:14, marginBottom:6 }}>{f.label}</label>
              {/* 項目を追加した直後はフォームにキーが無いので "" で埋める（非制御化を防ぐ） */}
              <textarea value={form[f.key] ?? ""} onChange={e => updateField(f.key, e.target.value)}
                placeholder={f.placeholder} rows={f.rows}
                style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:"1px solid #e0dcd5", fontSize:14, resize:"vertical", background:"#fff", boxSizing:"border-box", lineHeight:1.6, color:"#333" }} />
            </div>
          ))}

          {proposedTodos.length > 0 && (
            <div style={{ padding: "14px 16px", background: "#f0eeff", borderRadius: 12, marginBottom: 16, border: "2px solid #c4bfff", boxShadow: "0 4px 12px rgba(108,99,255,0.15)" }}>
              <h4 style={{ margin: "0 0 12px", color: "#6c63ff", fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 18 }}>✨</span> AIからの提案タスク
              </h4>
              <p style={{ margin: "0 0 12px", fontSize: 12, color: "#666" }}>追加先を選んで承認してください。</p>
              <div style={{ display:"flex", flexDirection:"column", gap: 8, marginBottom: 16 }}>
                {proposedTodos.map((p) => (
                  <div key={p.id} style={{ display:"flex", alignItems:"center", gap: 10, background:"#fff", padding: "10px 12px", borderRadius: 8, border: "1px solid #e0dcd5" }}>
                    <input type="checkbox" checked={p.selected} onChange={e => {
                      const checked = e.target.checked;
                      setProposedTodos(prev => prev.map(item => item.id === p.id ? { ...item, selected: checked } : item));
                    }} style={{ width: 18, height: 18, accentColor: "#6c63ff", cursor: "pointer", margin: 0 }} />
                    <span style={{ flex: 1, fontSize: 14, color: p.selected ? "#333" : "#aaa", textDecoration: p.selected ? "none" : "line-through", wordBreak: "break-word" }}>
                      {p.text}
                    </span>
                    <select value={p.when} disabled={!p.selected} onChange={e => {
                      const when = e.target.value;
                      setProposedTodos(prev => prev.map(item => item.id === p.id ? { ...item, when } : item));
                    }} style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #ccc", fontSize: 12, background: p.selected ? "#fafafa" : "#eee", color: p.selected ? "#333" : "#999", outline: "none", cursor: p.selected ? "pointer" : "default" }}>
                      <option value="today">今日のToDo</option>
                      <option value="tomorrow">明日のToDo</option>
                      <option value="routine">ルーティン</option>
                    </select>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", gap: 8 }}>
                <Btn variant="primary" onClick={handleApproveProposed} style={{ flex: 2, padding: "11px", fontWeight: 700 }}>✅ 選択したものを追加</Btn>
                <Btn variant="ghost" onClick={() => setProposedTodos([])} style={{ flex: 1, padding: "11px", color: "#888" }}>すべて破棄</Btn>
              </div>
            </div>
          )}

          <div style={{ display:"flex", gap:8 }}>
            <Btn variant={saved ? "success" : "primary"} onClick={saveEntry} style={{ flex:2, padding:"13px" }}>
              {saved ? "✓ 保存しました！" : "💾 保存する"}
            </Btn>
            <Btn variant="outline" onClick={() => startChat(selDate)} style={{ flex:1, padding:"13px" }}>🤖 AIと話す</Btn>
          </div>
        </div>
      )}

      {tab === "schedule" && (
        <div>
          <DateSelector value={selDate} onChange={setSelDate} />

              <div style={{
                background:"#fff", borderRadius:12, padding: showBaseList ? 16 : "12px 14px",
                marginBottom:16, boxShadow:"0 1px 4px rgba(0,0,0,.08)",
              }}>
                <button onClick={() => setShowBaseList(!showBaseList)} style={{
                  width:"100%", background:"none", border:"none", cursor:"pointer",
                  display:"flex", alignItems:"center", justifyContent:"space-between", padding:0,
                }}>
                  <span style={{ fontWeight:700, fontSize:14, color:"#3a3a3a" }}>
                    ⚙️ ベーススケジュール
                    {!showBaseList && activeBase && (
                      <span style={{ fontSize:11, color:"#888", fontWeight:400, marginLeft:8 }}>
                        選択中: <span style={{ color:"#6c63ff", fontWeight:600 }}>{activeBase.name}</span>
                      </span>
                    )}
                    {!showBaseList && !activeBase && (
                      <span style={{ fontSize:11, color:"#aaa", fontWeight:400, marginLeft:8 }}>未選択</span>
                    )}
                  </span>
                  <span style={{ fontSize:14, color:"#888" }}>{showBaseList ? "▲" : "▼"}</span>
                </button>

                {showBaseList && (
                  <div style={{ marginTop:12 }}>
                    <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:10 }}>
                      <Btn variant="warm" small onClick={() => setEditorState({ base: null })}>＋ 新規作成</Btn>
                    </div>
                    {baseList.length === 0 ? (
                      <p style={{ fontSize:13, color:"#aaa", margin:0 }}>まだ作成されていません。</p>
                    ) : (
                      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                        {baseList.map(b => {
                          const isActive = b.id === activeBaseId;
                          return (
                            <div key={b.id} onClick={() => switchActiveBase(b.id)} style={{
                              display:"flex", alignItems:"center", gap:8, padding:"10px 12px", borderRadius:10, cursor:"pointer",
                              border: isActive ? "2px solid #6c63ff" : "2px solid #eee",
                              background: isActive ? "#f8f7ff" : "#fafafa",
                            }}>
                              <div style={{ flex:1, minWidth:0 }}>
                                <p style={{ margin:0, fontWeight:700, fontSize:14, color: isActive ? "#6c63ff" : "#3a3a3a" }}>
                                  {isActive && "✓ "}{b.name}
                                </p>
                                {b.note && <p style={{ margin:"3px 0 0", fontSize:12, color:"#888", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{b.note}</p>}
                              </div>
                              <div style={{ display:"flex", gap:6 }} onClick={e => e.stopPropagation()}>
                                <Btn variant="ghost" small onClick={() => setEditorState({ base: b })}>編集</Btn>
                                <Btn variant="danger" small onClick={() => deleteBase(b.id)}>削除</Btn>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Btn variant="primary" disabled={schedLoading || !activeBase} onClick={() => generateSchedule({ selDate, entry: entries[selDate] || form, goals, fields: settings.journalFields })}
                style={{ width:"100%", padding:"13px", fontSize:15, marginBottom:16 }}>
                {schedLoading ? "⏳ スケジュール生成中..." : "✨ 今日のスケジュールを生成"}
              </Btn>

              {todaySched ? (
                <div style={{ background:"#fff", borderRadius:14, padding:"20px 16px", boxShadow:"0 1px 4px rgba(0,0,0,.08)" }}>
                  <p style={{ margin:"0 0 18px", fontSize:13, color:"#888" }}>
                    📅 {fmtDate(selDate)} のスケジュール
                    {activeBase && <span style={{ marginLeft:8, background:"#f0eeff", color:"#6c63ff", borderRadius:10, padding:"1px 8px", fontSize:11, fontWeight:600 }}>{activeBase.name}</span>}
                  </p>
                  {todaySched.map((item, i) => <ScheduleBlock key={i} item={item} idx={i} isLast={i === todaySched.length - 1} />)}
                </div>
              ) : (
                <EmptyState icon="🗓" text="ベーススケジュールを選んで生成ボタンを押してください" />
              )}
        </div>
      )}

      {tab === "todo" && (
        <div>
              <div style={{ display:"flex", gap:8, marginBottom:16 }}>
                <input value={todoInput} onChange={e => setTodoInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") addTodoManual(); }}
                  placeholder="ToDoを追加…"
                  style={{ flex:1, padding:"10px 14px", borderRadius:10, border:"1px solid #e0dcd5", fontSize:14, background:"#fff" }} />
                <Btn variant="primary" onClick={addTodoManual} disabled={!todoInput.trim()} style={{ padding:"10px 18px", fontSize:18 }}>＋</Btn>
              </div>

              <div style={{ background:"#f0eeff", borderRadius:10, padding:"10px 12px", marginBottom:14, fontSize:12, color:"#6c63ff" }}>
                💡 日記を保存/整理すると「今日の目標」「明日の目標」からAIが自動でToDoを抽出します
              </div>

              {todos.length === 0 ? (
                <EmptyState icon="✅" text="ToDoはまだありません" />
              ) : (
                <TodoListGrouped
                  todos={todos} onToggle={toggleTodo} onRemove={removeTodo}
                  onUpdateDueDate={updateTodoDueDate} onUpdateText={updateTodoText}
                  onClearDone={clearDoneTodos}
                />
              )}
            </div>
          )}

      {tab === "routine" && (
        <div>
          <TabBar tabs={ROUTINE_TABS} active={routineSubTab} onChange={setRoutineSubTab} />

          {routineSubTab === "check" && (
            <RoutineCheckView selDate={selDate} setSelDate={setSelDate}
              routines={routines} routineChecks={routineChecks} onToggle={toggleRoutineCheck} />
          )}

          {routineSubTab === "stats" && (
            <RoutineStats routines={routines} routineChecks={routineChecks} getRecentDates={getRecentDates}
              shortDays={settings.statsShortDays} longDays={settings.statsLongDays} />
          )}

          {(routineSubTab === "active" || routineSubTab === "done") && (
            <div>
              <div style={{ display:"flex", gap:8, marginBottom:16 }}>
                <input value={routineInput} onChange={e => setRoutineInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") addRoutine(); }}
                  placeholder={"ルーチンを入力… (" + routines[routineSubTab].length + "/" + settings.limitRoutinePerTab + ")"}
                  style={{ flex:1, padding:"10px 14px", borderRadius:10, border:"1px solid #e0dcd5", fontSize:14, background:"#fff" }} />
                <Btn variant="primary" onClick={addRoutine} disabled={!routineInput.trim() || routines[routineSubTab].length >= settings.limitRoutinePerTab}
                  style={{ padding:"10px 18px", fontSize:18 }}>＋</Btn>
              </div>

              {routines[routineSubTab].length === 0 ? (
                <EmptyState
                  icon={routineSubTab === "active" ? "🔄" : "✅"}
                  text={routineSubTab === "active" ? "導入中のルーチンを追加しよう" : "導入済みのルーチンはまだありません"}
                />
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {routines[routineSubTab].map((item) => {
                    const isActive = routineSubTab === "active";
                    return (
                      <div key={item.id} style={{ display:"flex", alignItems:"center", gap:10, background:"#fff", borderRadius:12, padding:"12px 14px", boxShadow:"0 1px 4px rgba(0,0,0,.07)" }}>
                        <button onClick={() => moveRoutine(routineSubTab, item.id)}
                          style={{
                            background: isActive ? "#f0fff4" : "#f0eeff",
                            border:"none", borderRadius:8, padding:"6px 10px", cursor:"pointer", fontSize:14, flexShrink:0,
                            color: isActive ? "#38a169" : "#6c63ff",
                          }}>{isActive ? "✓" : "↩"}</button>
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{
                            margin:0, fontSize:14, lineHeight:1.5,
                            textDecoration: !isActive ? "line-through" : "none",
                            color: !isActive ? "#aaa" : "#3a3a3a",
                          }}>{item.text}</p>
                          {isActive && (
                            <button onClick={() => setRoutineSchedEdit({ tab: routineSubTab, routine: item })}
                              style={{ marginTop:4, background:"#f0eeff", color:"#6c63ff", border:"none", borderRadius:8, padding:"2px 9px", fontSize:11, fontWeight:600, cursor:"pointer" }}>
                              🗓 {scheduleSummary(item.schedule)}
                            </button>
                          )}
                        </div>
                        <button onClick={() => removeRoutine(routineSubTab, item.id)}
                          style={{ background:"none", border:"none", cursor:"pointer", fontSize:16, color:"#ccc", flexShrink:0, padding:"4px" }}>✕</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "ai" && (
        <div>
          <TabBar tabs={AI_SUB_TABS} active={aiSubTab} onChange={(t) => {
            if (t === "chat") { if (chatMsgs.length === 0) startChat(selDate); else setAiSubTab("chat"); }
            if (t === "trend") runTrend();
            if (t === "goals") runGoals();
            if (t === "history") setAiSubTab("history");
          }} />

          {aiSubTab === "chat" && (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <div style={{ background:"#fff", borderRadius:12, padding:16, minHeight:300, maxHeight:420, overflowY:"auto", boxShadow:"0 1px 4px rgba(0,0,0,.08)" }}>
                {chatMsgs.length === 0 && !chatLoading && <p style={{ color:"#bbb", textAlign:"center", paddingTop:40, fontSize:14 }}>「AIと話す」で会話を始めよう</p>}
                {chatMsgs.map((m, i) => {
                  const isUser = m.role === "user";
                  return (
                    <div key={i} style={{ display:"flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom:12 }}>
                      <div style={{
                        maxWidth:"85%", padding:"10px 14px", fontSize:14, lineHeight:1.7, whiteSpace:"pre-wrap",
                        borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                        background: isUser ? "#6c63ff" : "#f0eeff",
                        color: isUser ? "#fff" : "#333",
                      }}>{m.content}</div>
                    </div>
                  );
                })}
                {chatLoading && (
                  <div style={{ display:"flex", justifyContent:"flex-start", marginBottom:12 }}>
                    <div style={{ padding:"10px 16px", borderRadius:"18px 18px 18px 4px", background:"#f0eeff", color:"#888", fontSize:14 }}>
                      {aiLoadingStatus === "waiting_for_server"
                        ? "AIサーバーの応答を待っています..."
                        : aiLoadingStatus === "pending"
                          ? "順番待ち中..."
                          : "AIが考え中..."}
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <textarea value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                  placeholder="メッセージを入力" rows={2}
                  style={{ flex:1, padding:"10px 12px", borderRadius:10, border:"1px solid #e0dcd5", fontSize:14, resize:"none", lineHeight:1.5 }} />
                <Btn variant="primary" onClick={sendChat} disabled={chatLoading || !chatInput.trim()} style={{ padding:"0 18px", fontSize:20 }}>➤</Btn>
              </div>
            </div>
          )}

          {aiSubTab === "trend" && <AIResult loading={trendLoading} text={trendText} placeholder="直近7日を分析します" />}
          {aiSubTab === "goals" && <AIResult loading={goalsLoading} text={goalsText} placeholder="目標と行動のギャップを分析します" />}

          {aiSubTab === "history" && (
            <div>
              <div style={{ marginBottom:14 }}>
                <span style={{ fontWeight:700, fontSize:15, color:COLORS.text }}>📋 記録一覧</span>
              </div>
              {sortedDates.length === 0 ? (
                <p style={{ textAlign:"center", color:"#aaa", padding:40 }}>まだ記録がありません</p>
              ) : sortedDates.map(d => {
                const e = entries[d];
                const seq = normalizeSequence(e.sequence);
                return (
                  <div key={d} style={{ background:"#fff", borderRadius:12, padding:16, marginBottom:12, boxShadow:"0 1px 4px rgba(0,0,0,.08)" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                      <span style={{ fontWeight:700, color:"#6c63ff", fontSize:14 }}>{fmtDate(d)}</span>
                      <div style={{ display:"flex", gap:6 }}>
                        <Btn variant="ghost" small onClick={() => { setSelDate(d); setTab("write"); }}>編集</Btn>
                        <Btn variant="outline" small onClick={() => { setSelDate(d); startChat(d); }}>🤖 AIと話す</Btn>
                      </div>
                    </div>
                    {settings.journalFields.map(f => e[f.key] && (
                      <div key={f.key} style={{ marginBottom:7 }}>
                        <span style={{ fontSize:11, color:"#aaa", fontWeight:600 }}>{f.label}</span>
                        <p style={{ margin:"2px 0 0", fontSize:13, color:"#444", lineHeight:1.6 }}>{e[f.key]}</p>
                      </div>
                    ))}
                    {seq.length > 0 && (
                      <div style={{ marginTop:7, background:"#fff7e6", borderRadius:8, padding:"8px 12px" }}>
                        <span style={{ fontSize:11, color:"#92400e", fontWeight:700 }}>🎯 稼働シーケンス</span>
                        {seq.map((item, idx) => {
                          const checked = !!(e.sequenceChecks && e.sequenceChecks[idx]);
                          return (
                            <p key={idx} style={{
                              margin:"3px 0 0", fontSize:12, lineHeight:1.5,
                              color: checked ? "#276749" : "#78350f",
                              textDecoration: checked ? "line-through" : "none",
                            }}>{checked ? "✓" : "・"} {item}</p>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
