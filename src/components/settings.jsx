import { useState, useEffect } from "react";
import { COLORS, JOURNAL_FIELDS, MAIN_TABS } from "../constants.js";
import { Btn } from "./common.jsx";

export function GeneralSettings({ settings, onSave }) {
  const [draft, setDraft] = useState(settings);
  const [savedFlag, setSavedFlag] = useState(false);
  useEffect(() => { setDraft(settings); }, [settings]);

  const set = (k, v) => setDraft({ ...draft, [k]: v });
  const num = (k, v, min, max) => {
    const n = parseInt(v, 10);
    set(k, isNaN(n) ? min : Math.min(max, Math.max(min, n)));
  };
  const save = async () => {
    await onSave(draft);
    setSavedFlag(true);
    setTimeout(() => setSavedFlag(false), 2000);
  };

  const Toggle = ({ label, k }) => (
    <button onClick={() => set(k, !draft[k])} style={{
      display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%",
      padding:"10px 12px", borderRadius:8, border:`1px solid ${COLORS.border}`, background:COLORS.white,
      cursor:"pointer", marginBottom:8,
    }}>
      <span style={{ fontSize:13, color:COLORS.text }}>{label}</span>
      <span style={{
        width:42, height:24, borderRadius:12, flexShrink:0, position:"relative", display:"inline-block",
        background: draft[k] ? COLORS.success : "#ccc",
      }}>
        <span style={{
          position:"absolute", top:2, left: draft[k] ? 20 : 2, width:20, height:20, borderRadius:"50%",
          background:"#fff",
        }} />
      </span>
    </button>
  );

  const numField = (label, k, min, max, unit) => (
    <div style={{ marginBottom:10 }}>
      <label style={{ display:"block", fontSize:12, color:COLORS.textSub, fontWeight:600, marginBottom:4 }}>{label}</label>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <input type="number" min={min} max={max} value={draft[k]}
          onChange={e => num(k, e.target.value, min, max)}
          style={{ width:120, padding:"9px 12px", borderRadius:8, border:`1px solid ${COLORS.border}`, fontSize:13 }} />
        <span style={{ fontSize:12, color:COLORS.textSub }}>{unit}</span>
      </div>
    </div>
  );

  return (
    <div style={{ background:COLORS.bg, borderRadius:12, padding:"14px 16px", marginBottom:24 }}>
      <label style={{ display:"block", fontSize:12, color:COLORS.textSub, fontWeight:600, marginBottom:4 }}>アプリ名</label>
      <input value={draft.appTitle} onChange={e => set("appTitle", e.target.value)} placeholder="毎日のジャーナル"
        style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:`1px solid ${COLORS.border}`, fontSize:13, boxSizing:"border-box", marginBottom:10 }} />

      <label style={{ display:"block", fontSize:12, color:COLORS.textSub, fontWeight:600, marginBottom:4 }}>サブタイトル</label>
      <input value={draft.appSubtitle} onChange={e => set("appSubtitle", e.target.value)} placeholder="（空でも可）"
        style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:`1px solid ${COLORS.border}`, fontSize:13, boxSizing:"border-box", marginBottom:12 }} />

      <label style={{ display:"block", fontSize:12, color:COLORS.textSub, fontWeight:600, marginBottom:4 }}>起動時に開くタブ</label>
      <select value={draft.defaultTab} onChange={e => set("defaultTab", e.target.value)}
        style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:`1px solid ${COLORS.border}`, fontSize:13, background:COLORS.white, marginBottom:12 }}>
        {MAIN_TABS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>

      <label style={{ display:"block", fontSize:12, color:COLORS.textSub, fontWeight:600, marginBottom:4 }}>起動時の日付</label>
      <select value={draft.startDateMode} onChange={e => set("startDateMode", e.target.value)}
        style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:`1px solid ${COLORS.border}`, fontSize:13, background:COLORS.white, marginBottom:12 }}>
        <option value="today">常に今日</option>
        <option value="last">最後に開いた日</option>
      </select>

      {numField("保存トーストの表示秒数", "toastSeconds", 1, 30, "秒")}

      <div style={{ height:1, background:COLORS.border, margin:"6px 0 12px" }} />

      <p style={{ margin:"0 0 8px", fontSize:12, color:COLORS.textSub, fontWeight:700 }}>表示するジャーナル項目</p>
      {JOURNAL_FIELDS.map(f => {
        const visible = !draft.hiddenFields.includes(f.key);
        return (
          <button key={f.key} onClick={() => set("hiddenFields",
            visible ? [...draft.hiddenFields, f.key] : draft.hiddenFields.filter(k => k !== f.key))}
            style={{
              display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%",
              padding:"10px 12px", borderRadius:8, border:`1px solid ${COLORS.border}`, background:COLORS.white,
              cursor:"pointer", marginBottom:8,
            }}>
            <span style={{ fontSize:13, color:COLORS.text }}>{f.label}</span>
            <span style={{
              width:42, height:24, borderRadius:12, flexShrink:0, position:"relative", display:"inline-block",
              background: visible ? COLORS.success : "#ccc",
            }}>
              <span style={{ position:"absolute", top:2, left: visible ? 20 : 2, width:20, height:20, borderRadius:"50%", background:"#fff" }} />
            </span>
          </button>
        );
      })}

      <div style={{ height:1, background:COLORS.border, margin:"6px 0 12px" }} />

      <Toggle label="ダンプモードを表示" k="showDumpMode" />
      <Toggle label="ダンプ整理後にToDoを自動抽出" k="autoExtractOnDump" />
      <Toggle label="日記保存時にToDoを自動抽出" k="autoExtractOnSave" />

      <div style={{ height:1, background:COLORS.border, margin:"6px 0 12px" }} />

      <p style={{ margin:"0 0 8px", fontSize:12, color:COLORS.textSub, fontWeight:700 }}>ルーチン・達成率</p>
      {numField("ルーチン1タブの上限", "limitRoutinePerTab", 5, 100, "個")}
      {numField("達成率グラフ・短期", "statsShortDays", 3, 60, "日")}
      {numField("達成率グラフ・長期", "statsLongDays", 7, 365, "日")}

      <div style={{ height:1, background:COLORS.border, margin:"6px 0 12px" }} />

      <p style={{ margin:"0 0 8px", fontSize:12, color:COLORS.textSub, fontWeight:700 }}>データ保持の上限</p>
      {numField("日記の保持日数", "limitEntriesDays", 30, 3650, "日")}
      {numField("完了ToDoの保持件数", "limitDoneTodos", 10, 1000, "件")}
      {numField("ルーチンチェックの保持日数", "limitRoutineCheckDays", 30, 3650, "日")}

      <Btn variant={savedFlag ? "success" : "primary"} onClick={save} style={{ width:"100%", marginTop:6, padding:"11px" }}>
        {savedFlag ? "✓ 保存しました" : "💾 設定を保存"}
      </Btn>
    </div>
  );
}

export function AiSettings({ cfg, onSave }) {
  const [draft, setDraft] = useState(cfg);
  const [savedFlag, setSavedFlag] = useState(false);
  useEffect(() => { setDraft(cfg); }, [cfg]);

  const set = (k, v) => setDraft({ ...draft, [k]: v });
  const save = async () => {
    await onSave(draft);
    setSavedFlag(true);
    setTimeout(() => setSavedFlag(false), 2000);
  };

  const modeBtn = (mode, label) => (
    <button onClick={() => set("mode", mode)} style={{
      flex:1, padding:"10px", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:700,
      border: draft.mode === mode ? `2px solid ${COLORS.primary}` : `1px solid ${COLORS.border}`,
      background: draft.mode === mode ? COLORS.primaryBg : COLORS.white,
      color: draft.mode === mode ? COLORS.primary : COLORS.textSub,
    }}>{label}</button>
  );

  const personaBtn = (p, label) => (
    <button onClick={() => set("persona", p)} style={{
      flex:1, padding:"9px 4px", borderRadius:8, cursor:"pointer", fontSize:12, fontWeight:700,
      border: (draft.persona || "spartan") === p ? `2px solid ${COLORS.primary}` : `1px solid ${COLORS.border}`,
      background: (draft.persona || "spartan") === p ? COLORS.primaryBg : COLORS.white,
      color: (draft.persona || "spartan") === p ? COLORS.primary : COLORS.textSub,
    }}>{label}</button>
  );

  const field = (label, key, placeholder, type = "text") => (
    <div style={{ marginBottom:10 }}>
      <label style={{ display:"block", fontSize:12, color:COLORS.textSub, fontWeight:600, marginBottom:4 }}>{label}</label>
      <input value={draft[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder}
        type={type} autoComplete="off" spellCheck={false}
        style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:`1px solid ${COLORS.border}`, fontSize:13, boxSizing:"border-box" }} />
    </div>
  );

  return (
    <div style={{ background:COLORS.bg, borderRadius:12, padding:"14px 16px", marginBottom:24 }}>
      <div style={{ display:"flex", gap:8, marginBottom:12 }}>
        {modeBtn("local", "🖥 ローカル")}
        {modeBtn("cloud", "🔑 BYOK")}
      </div>

      <label style={{ display:"block", fontSize:12, color:COLORS.textSub, fontWeight:600, marginBottom:4 }}>チャットの人格</label>
      <div style={{ display:"flex", gap:6, marginBottom:6 }}>
        {personaBtn("spartan", "🔥 スパルタ")}
        {personaBtn("normal", "🙂 ノーマル")}
        {personaBtn("lover", "💕 恋人")}
      </div>
      <p style={{ margin:"0 0 12px", fontSize:11, color:COLORS.textSub, lineHeight:1.6 }}>
        AIチャットの口調のみ変わります（傾向・目標の分析はフラットなまま）。
      </p>

      {draft.mode === "local" ? (
        <>
          {field("エンドポイント (OpenAI互換)", "localEndpoint", "http://localhost:11434/v1")}
          {field("モデル名", "localModel", "qwen2.5")}
          <div style={{ marginBottom:10 }}>
            <label style={{ display:"block", fontSize:12, color:COLORS.textSub, fontWeight:600, marginBottom:4 }}>
              temperature（生成のランダム性）: {Number(draft.temperature).toFixed(1)}
            </label>
            <input type="range" min="0" max="1.5" step="0.1" value={draft.temperature}
              onChange={e => set("temperature", parseFloat(e.target.value))}
              style={{ width:"100%" }} />
          </div>
          <p style={{ margin:"0 0 6px", fontSize:11, color:COLORS.textSub, lineHeight:1.6 }}>
            Ollama / LM Studio / llama.cpp 等。アプリと別オリジンの場合はサーバ側でCORS許可が必要です。
          </p>
        </>
      ) : (
        <>
          {field("APIキー", "apiKey", "sk-ant-...", "password")}
          {field("モデル名", "cloudModel", "claude-sonnet-5")}
          <p style={{ margin:"0 0 6px", fontSize:11, color:COLORS.textSub, lineHeight:1.6 }}>
            BYOK（自分のAPIキーで利用）。キーは端末内にのみ保存されます。
          </p>
          <p style={{ margin:"0 0 6px", fontSize:11, color:COLORS.warn, lineHeight:1.6 }}>
            ⚠️ クラウドは日記内容が外部APIに送信されます。
          </p>
        </>
      )}

      <Btn variant={savedFlag ? "success" : "primary"} onClick={save} style={{ width:"100%", marginTop:6, padding:"11px" }}>
        {savedFlag ? "✓ 保存しました" : "💾 AI設定を保存"}
      </Btn>
    </div>
  );
}
