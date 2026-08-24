import { useState, useEffect } from "react";
import { COLORS, MAIN_TABS, MAX_JOURNAL_FIELDS } from "../constants.js";
import { uid } from "../lib/id.js";
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

  // ─── ジャーナル項目の編集 ───
  // key は保存済みエントリとの対応そのものなので、既存項目では絶対に変更しない
  // （変更すると過去の記録が読めなくなる）。編集できるのは表示名だけ。
  const setFields = (next) => set("journalFields", next);
  const editField = (i, k, v) => setFields(draft.journalFields.map((f, n) => n === i ? { ...f, [k]: v } : f));
  const removeField = (i) => {
    const f = draft.journalFields[i];
    if (f.core) return;
    if (!window.confirm(`「${f.label}」を項目から外しますか？\n過去の記録は消えません。`)) return;
    setFields(draft.journalFields.filter((_, n) => n !== i));
  };
  const moveField = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= draft.journalFields.length) return;
    const next = draft.journalFields.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setFields(next);
  };
  const addField = () => {
    if (draft.journalFields.length >= MAX_JOURNAL_FIELDS) return;
    setFields([...draft.journalFields, { key: "f_" + uid(), label: "新しい項目", placeholder: "", rows: 3 }]);
  };
  const iconBtn = (disabled) => ({
    width: 30, height: 30, flexShrink: 0, padding: 0, fontSize: 13,
    borderRadius: 6, border: `1px solid ${COLORS.border}`, background: COLORS.white,
    cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.35 : 1,
  });

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

      <p style={{ margin:"0 0 4px", fontSize:12, color:COLORS.textSub, fontWeight:700 }}>ジャーナル項目</p>
      <p style={{ margin:"0 0 8px", fontSize:11, color:COLORS.textSub, lineHeight:1.6 }}>
        名前の変更・並べ替え・追加・削除ができます。🔒 の項目はToDo抽出や予定生成に使うため削除できません。<br/>
        削除しても過去の記録は消えません（項目を戻せば再び表示されます）。
      </p>
      {draft.journalFields.map((f, i) => (
        <div key={f.key} style={{
          display:"flex", alignItems:"center", gap:6, marginBottom:8,
          padding:"8px 10px", borderRadius:8, border:`1px solid ${COLORS.border}`, background:COLORS.white,
        }}>
          <input value={f.label} onChange={e => editField(i, "label", e.target.value)}
            style={{ flex:1, minWidth:0, padding:"7px 9px", borderRadius:6, border:`1px solid ${COLORS.border}`, fontSize:13 }} />
          <button onClick={() => moveField(i, -1)} disabled={i === 0}
            style={iconBtn(i === 0)}>↑</button>
          <button onClick={() => moveField(i, 1)} disabled={i === draft.journalFields.length - 1}
            style={iconBtn(i === draft.journalFields.length - 1)}>↓</button>
          {f.core
            ? <span style={{ width:30, textAlign:"center", fontSize:13 }} title="削除できません">🔒</span>
            : <button onClick={() => removeField(i)} style={{ ...iconBtn(false), color:COLORS.danger }}>🗑</button>}
        </div>
      ))}
      <Btn variant="outline" onClick={addField}
        disabled={draft.journalFields.length >= MAX_JOURNAL_FIELDS}
        style={{ width:"100%", marginBottom:12, padding:"9px" }}>
        ＋ 項目を追加（{draft.journalFields.length}/{MAX_JOURNAL_FIELDS}）
      </Btn>

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

export function AiSettings({ cfg, onSave, aiUsage }) {
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
      flex:1, padding:"10px 4px", borderRadius:8, cursor:"pointer", fontSize:12, fontWeight:700,
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
      <div style={{ display:"flex", gap:6, marginBottom:12 }}>
        {modeBtn("proxy", "🤖 EvJou AI")}
        {modeBtn("local", "🖥 ローカル")}
        {modeBtn("cloud", "🔑 APIキー")}
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

      {draft.mode === "proxy" && (
        <>
          <p style={{ margin:"0 0 6px", fontSize:12, color:COLORS.text, lineHeight:1.7 }}>
            開発者のAIサーバーを利用します。設定は不要です。<br/>
            <span style={{ color: COLORS.primary, fontWeight: 600 }}>※ローカルLLMのため、通常の使い方で上限に届くことはありません。</span>
          </p>

          <p style={{ margin:"0 0 6px", fontSize:11, color:COLORS.textSub, lineHeight:1.6 }}>
            利用時に日記の内容が開発者のサーバーへ送信されます。
            AIの処理は開発者の自宅PCで行うため、外部のAI事業者には渡りません。
          </p>

          {/* 上と同じ理由でここも実態に合わせてある。約束（閲覧しない）と能力（見られる）を分けて書くこと。 */}
          <p style={{ margin:"0 0 6px", fontSize:11, color:COLORS.textSub, lineHeight:1.6 }}>
            送信内容は中継サーバー（Google Firestore）に一時保存され、処理後24時間以内に自動削除されます。
            ただし削除はサーバーの稼働中にのみ実行されるため、失敗した記録が残る場合があります。
            開発者は技術的には送信内容を見られますが、日記の内容は閲覧しません。
          </p>
        </>
      )}

      {draft.mode === "local" && (
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
      )}

      {draft.mode === "cloud" && (
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
