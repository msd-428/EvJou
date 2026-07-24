import { useState } from "react";
import { GROUP_META, SOURCE_META } from "../constants.js";
import { getTodoGroup } from "../lib/domain.js";
import { todayStr, getOffsetDate, fmtShort } from "../lib/date.js";
import { Btn } from "./common.jsx";

export function TodoDueDatePicker({ dueDate, onSelect }) {
  const [open, setOpen] = useState(false);
  const [customDate, setCustomDate] = useState(dueDate || todayStr());
  const t = todayStr();
  const meta = GROUP_META[getTodoGroup(dueDate)];

  const choose = (date) => { onSelect(date); setOpen(false); };
  const quickBtn = (onClick, color, label) => (
    <button onClick={onClick}
      style={{ display:"block", width:"100%", textAlign:"left", padding:"8px 10px", border:"none", background:"none", cursor:"pointer", fontSize:13, color, fontWeight:600, borderRadius:6 }}>{label}</button>
  );

  return (
    <div style={{ position:"relative" }}>
      <button onClick={() => setOpen(!open)} style={{
        background: meta.bg, color: meta.color, border:"none",
        padding:"3px 9px", borderRadius:10, fontSize:10, fontWeight:700, cursor:"pointer",
      }}>{dueDate ? fmtShort(dueDate) : "期限なし"}</button>

      {open && (
        <div style={{
          position:"absolute", top:"calc(100% + 4px)", right:0, zIndex:50,
          background:"#fff", borderRadius:12, boxShadow:"0 4px 16px rgba(0,0,0,.15)",
          padding:10, minWidth:180,
        }}>
          {quickBtn(() => choose(t), "#d97706", "🔥 今日")}
          {quickBtn(() => choose(getOffsetDate(t, 1)), "#3182ce", "📅 明日")}
          {quickBtn(() => choose(getOffsetDate(t, 3)), "#6c63ff", "📆 3日後")}
          {quickBtn(() => choose(getOffsetDate(t, 7)), "#805ad5", "🔮 1週間後")}
          <div style={{ borderTop:"1px solid #eee", margin:"6px 0" }} />
          <div style={{ padding:"4px 10px" }}>
            <label style={{ fontSize:10, color:"#888", fontWeight:600 }}>日付指定</label>
            <div style={{ display:"flex", gap:4, marginTop:4 }}>
              <input type="date" value={customDate} onChange={e => setCustomDate(e.target.value)}
                style={{ flex:1, padding:"6px 8px", borderRadius:6, border:"1px solid #ddd", fontSize:12 }} />
              <button onClick={() => choose(customDate)}
                style={{ background:"#6c63ff", color:"#fff", border:"none", borderRadius:6, padding:"6px 10px", fontSize:12, cursor:"pointer", fontWeight:600 }}>OK</button>
            </div>
          </div>
          {dueDate && (
            <button onClick={() => choose(null)}
              style={{ display:"block", width:"100%", textAlign:"left", padding:"8px 10px", border:"none", background:"none", cursor:"pointer", fontSize:13, color:"#888", borderRadius:6, marginTop:4, borderTop:"1px solid #eee" }}>
              🗑 期限クリア
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function TodoItem({ todo, onToggle, onRemove, onUpdateDueDate, onUpdateText }) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(todo.text);
  const src = SOURCE_META[todo.source] || { label: "AI", color: "#888" };

  const commitEdit = () => {
    const t = editText.trim();
    if (t && t !== todo.text) onUpdateText(todo.id, t);
    setEditing(false);
  };

  const startEdit = () => {
    setEditText(todo.text);
    setEditing(true);
  };

  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, background:"#fff", borderRadius:12, padding:"12px 14px", boxShadow:"0 1px 4px rgba(0,0,0,.07)" }}>
      <button onClick={() => onToggle(todo.id)}
        style={{ width:24, height:24, borderRadius:"50%", border:"2px solid #ddd", background:"#fff", cursor:"pointer", flexShrink:0, padding:0 }} />
      <div style={{ flex:1, minWidth:0 }}>
        {editing ? (
          <input autoFocus value={editText}
            onChange={e => setEditText(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => {
              if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
              if (e.key === "Escape") { setEditing(false); }
            }}
            style={{ width:"100%", padding:"4px 8px", fontSize:14, border:"1px solid #6c63ff", borderRadius:6, color:"#3a3a3a", boxSizing:"border-box" }} />
        ) : (
          <p onClick={startEdit}
            style={{ margin:0, fontSize:14, color:"#3a3a3a", lineHeight:1.4, cursor:"text" }}
            title="タップで編集">{todo.text}</p>
        )}
        <div style={{ marginTop:3 }}>
          <span style={{ fontSize:10, color: src.color, fontWeight:600 }}>{src.label}</span>
        </div>
      </div>
      <TodoDueDatePicker dueDate={todo.dueDate} onSelect={d => onUpdateDueDate(todo.id, d)} />
      <button onClick={() => onRemove(todo.id)}
        style={{ background:"none", border:"none", cursor:"pointer", fontSize:16, color:"#ccc", flexShrink:0, padding:"4px" }}>✕</button>
    </div>
  );
}

export function TodoListGrouped({ todos, onToggle, onRemove, onUpdateDueDate, onUpdateText, onClearDone }) {
  const undone = todos.filter(t => !t.done);
  const done = todos.filter(t => t.done);

  const grouped = { overdue: [], today: [], tomorrow: [], thisWeek: [], future: [], none: [] };
  undone.forEach(t => grouped[getTodoGroup(t.dueDate)].push(t));
  Object.keys(grouped).forEach(g => {
    grouped[g].sort((a, b) => {
      if (g === "none") return (a.createdAt || "").localeCompare(b.createdAt || "");
      return (a.dueDate || "").localeCompare(b.dueDate || "");
    });
  });

  const groupOrder = ["overdue", "today", "tomorrow", "thisWeek", "future", "none"];

  return (
    <div>
      {groupOrder.map(g => {
        if (grouped[g].length === 0) return null;
        const meta = GROUP_META[g];
        return (
          <div key={g} style={{ marginBottom:18 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
              <span style={{ background: meta.bg, color: meta.color, padding:"3px 10px", borderRadius:12, fontSize:11, fontWeight:700 }}>{meta.label}</span>
              <span style={{ fontSize:11, color:"#bbb" }}>{grouped[g].length}件</span>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {grouped[g].map(t => (
                <TodoItem key={t.id} todo={t}
                  onToggle={onToggle} onRemove={onRemove}
                  onUpdateDueDate={onUpdateDueDate} onUpdateText={onUpdateText} />
              ))}
            </div>
          </div>
        );
      })}

      {done.length > 0 && (
        <div style={{ marginTop:20 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <span style={{ fontSize:12, color:"#aaa", fontWeight:600 }}>✅ 完了済み（{done.length}）</span>
            <Btn variant="ghost" small onClick={onClearDone}>すべて削除</Btn>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {done.map(t => (
              <div key={t.id} style={{ display:"flex", alignItems:"center", gap:10, background:"#fafafa", borderRadius:12, padding:"10px 14px" }}>
                <button onClick={() => onToggle(t.id)}
                  style={{ width:24, height:24, borderRadius:"50%", background:"#38a169", border:"2px solid #38a169", cursor:"pointer", flexShrink:0, color:"#fff", fontSize:13, padding:0 }}>✓</button>
                <p style={{ flex:1, margin:0, fontSize:13, color:"#aaa", textDecoration:"line-through" }}>{t.text}</p>
                <button onClick={() => onRemove(t.id)}
                  style={{ background:"none", border:"none", cursor:"pointer", fontSize:14, color:"#ccc", flexShrink:0, padding:"4px" }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
