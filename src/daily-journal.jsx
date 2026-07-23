import { useState, useEffect, useRef } from "react";

// 定数・ロジック・ストレージは各モジュールへ分離済み。
// このファイルは UI コンポーネントとアプリ全体の組み立て（App）を担う。
import {
  JOURNAL_FIELDS, BLOCK_COLORS, COLORS, MAIN_TABS, ROUTINE_TABS, AI_SUB_TABS,
  GROUP_META, SOURCE_META, WEEKDAYS, DEFAULT_SETTINGS, DEFAULT_BASE_BLOCKS,
} from "./constants.js";
import {
  todayStr, fmtDate, fmtShort, getOffsetDate, getRecentDates,
} from "./lib/date.js";
import { uid } from "./lib/id.js";
import { extractJson } from "./lib/json.js";
import {
  emptyForm, emptyGoals, getTodoGroup, normalizeSequence, normalizeRoutines,
  isRoutineDue, scheduleSummary, pruneByDateKey, pruneTodos,
} from "./lib/domain.js";
import { PERSONAS, DEFAULT_AI_CONFIG, applyAiConfig, callClaude } from "./api/client.js";
import { dumpProcess, extractTodos } from "./api/prompts.js";
import {
  storageGet, storageSet, storageRemove, storageSetSync, exportData, importDataFile,
} from "./storage/index.js";

// ═══════════════ 共通UI ═══════════════

function Btn({ children, onClick, disabled, variant = "primary", small, style }) {
  const base = {
    border: "none", borderRadius: small ? 20 : 10, cursor: disabled ? "default" : "pointer",
    fontWeight: 600, fontSize: small ? 11 : 14, opacity: disabled ? 0.55 : 1,
    padding: small ? "3px 10px" : "11px 16px",
  };
  const variants = {
    primary: { background: COLORS.primary, color: COLORS.white },
    outline: { background: COLORS.white, color: COLORS.primary, border: `2px solid ${COLORS.primary}` },
    warm:    { background: COLORS.warnBg, color: COLORS.warn, border: "1px solid #fcd34d" },
    ghost:   { background: COLORS.primaryBg, color: COLORS.primary },
    danger:  { background: COLORS.dangerBg, color: COLORS.danger },
    success: { background: "#48bb78", color: COLORS.white },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }}>{children}</button>;
}

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display:"flex", gap:6, marginBottom:20, flexWrap:"wrap" }}>
      {tabs.map(([key, label]) => {
        const isActive = active === key;
        return (
          <button key={key} onClick={() => onChange(key)} style={{
            flex:1, minWidth:0, padding:"10px 4px", border:"none", borderRadius:10, cursor:"pointer",
            fontSize:12, fontWeight:600,
            background: isActive ? "#6c63ff" : "#fff",
            color: isActive ? "#fff" : "#555",
            boxShadow: isActive ? "0 2px 8px rgba(108,99,255,.3)" : "0 1px 3px rgba(0,0,0,.08)",
          }}>{label}</button>
        );
      })}
    </div>
  );
}

function SaveToast({ visible, onClose }) {
  if (!visible) return null;
  return (
    <div onClick={onClose} style={{
      position:"fixed", bottom:32, left:"50%", transform:"translateX(-50%)", zIndex:300,
      background:"#276749", color:"#fff", borderRadius:14, padding:"14px 24px",
      fontSize:14, fontWeight:700, boxShadow:"0 4px 20px rgba(0,0,0,.25)", cursor:"pointer",
      display:"flex", alignItems:"center", gap:10, whiteSpace:"nowrap", userSelect:"none",
    }}>
      <span style={{ fontSize:20 }}>✅</span>
      しっかり保存されました
      <span style={{ fontSize:11, opacity:0.75, fontWeight:400, marginLeft:4 }}>タップで閉じる</span>
    </div>
  );
}

function ScheduleBlock({ item, idx, isLast }) {
  const color = BLOCK_COLORS[idx % BLOCK_COLORS.length];
  return (
    <div style={{ display:"flex", gap:12, alignItems:"flex-start", marginBottom: isLast ? 0 : 16 }}>
      <div style={{ minWidth:50, textAlign:"right", paddingTop:4 }}>
        <span style={{ fontSize:13, fontWeight:700, color }}>{item.time}</span>
      </div>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", paddingTop:6 }}>
        <div style={{ width:11, height:11, borderRadius:"50%", background:color, flexShrink:0 }} />
        {!isLast && <div style={{ width:2, flex:1, background:"#e8e4ff", minHeight:24, marginTop:4 }} />}
      </div>
      <div style={{ flex:1, background:"#fff", borderRadius:10, padding:"10px 14px", boxShadow:"0 1px 4px rgba(0,0,0,.07)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <p style={{ margin:0, fontWeight:700, fontSize:14, color:"#3a3a3a" }}>{item.label}</p>
          {item.fixed && <span style={{ fontSize:10, background:"#f0eeff", color:"#6c63ff", borderRadius:10, padding:"1px 7px", fontWeight:600 }}>固定</span>}
        </div>
        {item.note && <p style={{ margin:"5px 0 0", fontSize:12, color:"#666", lineHeight:1.6 }}>{item.note}</p>}
      </div>
    </div>
  );
}

function Checkbox({ checked, onClick, size = 22, activeColor = "#38a169", idleColor = "#d97706" }) {
  return (
    <div onClick={onClick} style={{
      width:size, height:size, borderRadius:"50%", flexShrink:0,
      background: checked ? activeColor : "#fff",
      border: checked ? `2px solid ${activeColor}` : `2px solid ${idleColor}`,
      display:"flex", alignItems:"center", justifyContent:"center",
      color:"#fff", fontSize: size - 10, fontWeight:700, cursor:"pointer",
    }}>{checked && "✓"}</div>
  );
}

// ═══════════════ 稼働シーケンス表示 ═══════════════

function SequenceChecklist({ sequence, checks, onToggle }) {
  if (!sequence || sequence.length === 0) return null;
  const doneCount = sequence.filter((_, i) => checks && checks[i]).length;

  return (
    <div style={{ marginTop:16, background:"#fff7e6", border:"1px solid #fcd34d", borderRadius:12, padding:"14px 16px" }}>
      <p style={{ margin:"0 0 10px", fontSize:13, fontWeight:700, color:"#92400e" }}>🎯 今日の稼働シーケンス</p>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {sequence.map((item, idx) => {
          const checked = !!(checks && checks[idx]);
          return (
            <div key={idx} onClick={() => onToggle(idx)} style={{
              display:"flex", alignItems:"center", gap:10,
              background: checked ? "rgba(56,161,105,.1)" : "rgba(255,255,255,.6)",
              border:"none", borderRadius:8, padding:"8px 10px", cursor:"pointer",
            }}>
              <Checkbox checked={checked} onClick={() => onToggle(idx)} />
              <span style={{
                fontSize:13, lineHeight:1.5, flex:1,
                color: checked ? "#276749" : "#78350f",
                textDecoration: checked ? "line-through" : "none",
              }}>{item}</span>
            </div>
          );
        })}
      </div>
      <p style={{ margin:"10px 0 0", fontSize:11, color:"#b45309", textAlign:"right" }}>
        {doneCount} / {sequence.length} 完了
      </p>
    </div>
  );
}

// ═══════════════ ルーチン系 ═══════════════

function RoutineCheckView({ selDate, setSelDate, routines, routineChecks, onToggle }) {
  const dueToday = routines.active.filter(r => isRoutineDue(r, selDate));
  const dayChecks = routineChecks[selDate] || {};
  const doneCount = dueToday.filter(r => dayChecks[r.id]).length;
  const rate = dueToday.length ? Math.round((doneCount / dueToday.length) * 100) : 0;
  const barColor = rate >= 70 ? "#38a169" : rate >= 40 ? "#d97706" : "#6c63ff";

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
        <input type="date" value={selDate} onChange={e => setSelDate(e.target.value)}
          style={{ padding:"8px 12px", borderRadius:8, border:"1px solid #ddd", fontSize:14, background:"#fff" }} />
        <span style={{ color:"#888", fontSize:13, flex:1 }}>{fmtDate(selDate)}</span>
      </div>

      {routines.active.length === 0 ? (
        <EmptyState icon="📝" text="「導入中」タブからルーチンを追加しよう" />
      ) : dueToday.length === 0 ? (
        <EmptyState icon="🌙" text="この日に予定されたルーチンはありません" />
      ) : (
        <>
          <div style={{ background:"#fff", borderRadius:12, padding:"14px 16px", marginBottom:16, boxShadow:"0 1px 4px rgba(0,0,0,.07)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:8 }}>
              <span style={{ fontSize:13, fontWeight:700, color:"#3a3a3a" }}>今日の達成</span>
              <span style={{ fontSize:18, fontWeight:700, color: barColor }}>{doneCount} / {dueToday.length}</span>
            </div>
            <div style={{ height:8, background:"#f0eeff", borderRadius:4, overflow:"hidden" }}>
              <div style={{ width: rate + "%", height:"100%", background: barColor }} />
            </div>
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {dueToday.map(r => {
              const checked = !!dayChecks[r.id];
              const isDaily = (r.schedule?.type || "daily") === "daily";
              return (
                <button key={r.id} onClick={() => onToggle(selDate, r.id)} style={{
                  display:"flex", alignItems:"center", gap:12, padding:"14px 16px", borderRadius:12, border:"none", cursor:"pointer",
                  background: checked ? "#f0fff4" : "#fff",
                  boxShadow: checked ? "0 1px 4px rgba(56,161,105,.15)" : "0 1px 4px rgba(0,0,0,.07)",
                  textAlign:"left",
                }}>
                  <Checkbox checked={checked} size={26} idleColor="#ddd" />
                  <p style={{
                    margin:0, flex:1, fontSize:14, lineHeight:1.5,
                    color: checked ? "#276749" : "#3a3a3a",
                    textDecoration: checked ? "line-through" : "none",
                  }}>{r.text}</p>
                  {!isDaily && <span style={{ fontSize:10, color:"#6c63ff", background:"#f0eeff", borderRadius:8, padding:"2px 7px", fontWeight:600, flexShrink:0 }}>{scheduleSummary(r.schedule)}</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function RoutineStats({ routines, routineChecks, getRecentDates, shortDays = 7, longDays = 30 }) {
  const active = routines.active;
  if (active.length === 0) {
    return <EmptyState icon="📊" text="導入中のルーチンを追加すると達成率が表示されます" />;
  }

  const datesLong = getRecentDates(longDays);

  // ルーチン別：対象日のうち達成した割合（対象日のみ分母）
  const routineStats = active.map(r => {
    const dueDates = datesLong.filter(d => isRoutineDue(r, d));
    const done = dueDates.filter(d => routineChecks[d] && routineChecks[d][r.id]).length;
    const denom = dueDates.length;
    return {
      text: r.text,
      rate30: denom ? Math.round((done / denom) * 100) : 0,
      done30: done,
      denom,
    };
  });

  // 日別：その日に対象のルーチンの達成率（対象0の日はnull＝集計から除外）
  const dailyRates = datesLong.map(d => {
    const due = active.filter(r => isRoutineDue(r, d));
    if (due.length === 0) return { date: d, rate: null };
    const count = due.filter(r => routineChecks[d] && routineChecks[d][r.id]).length;
    return { date: d, rate: Math.round((count / due.length) * 100) };
  });

  const valid = dailyRates.filter(x => x.rate !== null);
  const validShort = valid.slice(-shortDays);
  const avg30 = valid.length ? Math.round(valid.reduce((s, x) => s + x.rate, 0) / valid.length) : 0;
  const avg7 = validShort.length ? Math.round(validShort.reduce((s, x) => s + x.rate, 0) / validShort.length) : 0;

  return (
    <div>
      <div style={{ display:"flex", gap:10, marginBottom:18 }}>
        <StatCard label={`直近${shortDays}日`} value={avg7} color="#6c63ff" />
        <StatCard label={`直近${longDays}日`} value={avg30} color="#38a169" />
      </div>

      <div style={{ background:"#fff", borderRadius:12, padding:"16px 14px", marginBottom:18, boxShadow:"0 1px 4px rgba(0,0,0,.07)" }}>
        <p style={{ margin:"0 0 12px", fontSize:13, fontWeight:700, color:"#3a3a3a" }}>📈 日別達成率（直近{longDays}日）</p>
        <div style={{ display:"flex", alignItems:"flex-end", gap:2, height:100, borderBottom:"1px solid #eee", paddingBottom:4 }}>
          {dailyRates.map(({ date, rate }) => {
            const isToday = date === todayStr();
            const r = rate === null ? 0 : rate;
            const bg = rate === null ? "#f0f0f0" : isToday ? "#6c63ff" : r >= 70 ? "#38a169" : r >= 40 ? "#d97706" : r > 0 ? "#feb2b2" : "#eee";
            return (
              <div key={date} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center" }} title={fmtShort(date) + ": " + (rate === null ? "対象なし" : rate + "%")}>
                <div style={{ width:"100%", height: r + "%", minHeight: r > 0 ? 2 : 0, background: bg, borderRadius:"3px 3px 0 0" }} />
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ background:"#fff", borderRadius:12, padding:"16px 14px", boxShadow:"0 1px 4px rgba(0,0,0,.07)" }}>
        <p style={{ margin:"0 0 12px", fontSize:13, fontWeight:700, color:"#3a3a3a" }}>🎯 ルーチン別達成率（{longDays}日）</p>
        {routineStats.map((s, i) => {
          const isLast = i === routineStats.length - 1;
          const c = s.rate30 >= 70 ? "#38a169" : s.rate30 >= 40 ? "#d97706" : "#e53e3e";
          const bc = s.rate30 >= 70 ? "#38a169" : s.rate30 >= 40 ? "#d97706" : "#feb2b2";
          return (
            <div key={i} style={{ marginBottom: isLast ? 0 : 14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:5 }}>
                <p style={{ margin:0, fontSize:13, color:"#3a3a3a", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", paddingRight:8 }}>{s.text}</p>
                <span style={{ fontSize:12, fontWeight:700, color: c }}>{s.rate30}% <span style={{ color:"#aaa", fontWeight:400, fontSize:11 }}>({s.done30}/{s.denom})</span></span>
              </div>
              <div style={{ height:6, background:"#f0eeff", borderRadius:3, overflow:"hidden" }}>
                <div style={{ width: s.rate30 + "%", height:"100%", background: bc }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ flex:1, background:"#fff", borderRadius:12, padding:"14px", boxShadow:"0 1px 4px rgba(0,0,0,.07)" }}>
      <p style={{ margin:0, fontSize:11, color:"#888", fontWeight:600 }}>{label}</p>
      <p style={{ margin:"4px 0 0", fontSize:26, fontWeight:700, color }}>{value}<span style={{ fontSize:14, color:"#aaa" }}>%</span></p>
    </div>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div style={{ textAlign:"center", color:"#ccc", padding:"50px 0" }}>
      <div style={{ fontSize:40, marginBottom:10 }}>{icon}</div>
      <p style={{ fontSize:14, color:"#aaa" }}>{text}</p>
    </div>
  );
}

// ═══════════════ ToDo系 ═══════════════

function TodoDueDatePicker({ dueDate, onSelect }) {
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

function TodoItem({ todo, onToggle, onRemove, onUpdateDueDate, onUpdateText }) {
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

function TodoListGrouped({ todos, onToggle, onRemove, onUpdateDueDate, onUpdateText, onClearDone }) {
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

// ═══════════════ ベーススケジュールエディタ ═══════════════

function BaseScheduleEditor({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial?.name || "");
  const [note, setNote] = useState(initial?.note || "");
  const [blocks, setBlocks] = useState(
    initial?.blocks?.length
      ? initial.blocks
      : DEFAULT_BASE_BLOCKS.map(b => ({ ...b, id: uid() }))
  );

  const updateBlock = (id, key, val) => setBlocks(blocks.map(b => b.id === id ? { ...b, [key]: val } : b));
  const addBlock = () => setBlocks([...blocks, { id: uid(), time: "00:00", label: "", fixed: false }]);
  const removeBlock = (id) => setBlocks(blocks.filter(b => b.id !== id));

  const handleSave = () => {
    if (!name.trim()) { alert("スケジュール名を入力してください"); return; }
    const sorted = [...blocks].sort((a, b) => a.time.localeCompare(b.time));
    onSave({ id: initial?.id || uid(), name: name.trim(), note: note.trim(), blocks: sorted });
    onClose();
  };

  return (
    <BottomSheet title={initial ? "✏️ スケジュール編集" : "➕ 新しいベーススケジュール"} onClose={onClose}>
      <Label>スケジュール名 *</Label>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="例: 平日ルーティン"
        style={inputStyle} />

      <Label>説明・備考</Label>
      <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
        placeholder="目的や使い方のメモ" style={{ ...inputStyle, resize:"vertical", lineHeight:1.6 }} />

      <label style={{ fontWeight:700, fontSize:13, color:"#555", display:"block", marginBottom:10 }}>時間ブロック</label>

      {blocks.map(b => (
        <div key={b.id} style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
          <input type="time" value={b.time} onChange={e => updateBlock(b.id, "time", e.target.value)}
            style={{ padding:"8px", borderRadius:8, border:"1px solid #ddd", fontSize:14, width:90, flexShrink:0 }} />
          <input value={b.label} onChange={e => updateBlock(b.id, "label", e.target.value)} placeholder="内容"
            style={{ flex:1, padding:"8px 10px", borderRadius:8, border:"1px solid #ddd", fontSize:14 }} />
          <button onClick={() => updateBlock(b.id, "fixed", !b.fixed)} style={{
            padding:"6px 10px", borderRadius:8, border:"none", cursor:"pointer", fontSize:12, fontWeight:600, flexShrink:0,
            background: b.fixed ? "#f0eeff" : "#f5f5f5",
            color: b.fixed ? "#6c63ff" : "#aaa",
          }}>{b.fixed ? "🔒" : "🔓"}</button>
          <button onClick={() => removeBlock(b.id)}
            style={{ background:"#fff0f0", border:"none", borderRadius:8, padding:"7px 10px", cursor:"pointer", color:"#e53e3e", fontSize:13, flexShrink:0 }}>✕</button>
        </div>
      ))}

      <Btn variant="ghost" onClick={addBlock} style={{ width:"100%", marginTop:4, padding:"10px" }}>＋ ブロック追加</Btn>
      <Btn variant="primary" onClick={handleSave} style={{ width:"100%", marginTop:12, padding:"13px", fontSize:15 }}>💾 保存する</Btn>
    </BottomSheet>
  );
}

function RoutineScheduleEditor({ routine, onSave, onClose }) {
  const init = routine.schedule || { type: "daily" };
  const [type, setType] = useState(init.type || "daily");
  const [days, setDays] = useState(init.days || []);
  const [interval, setInterval] = useState(init.interval || 2);
  const [anchor, setAnchor] = useState(init.anchor || todayStr());

  const toggleDay = (d) => setDays(days.includes(d) ? days.filter(x => x !== d) : [...days, d]);

  const handleSave = () => {
    let schedule;
    if (type === "weekly") {
      if (days.length === 0) { alert("曜日を1つ以上選んでください"); return; }
      schedule = { type: "weekly", days };
    } else if (type === "interval") {
      const n = parseInt(interval, 10);
      if (!n || n < 1) { alert("間隔は1以上にしてください"); return; }
      schedule = { type: "interval", interval: n, anchor };
    } else {
      schedule = { type: "daily" };
    }
    onSave(schedule);
  };

  const typeBtn = (t, label) => (
    <button onClick={() => setType(t)} style={{
      flex:1, padding:"10px", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:700,
      border: type === t ? `2px solid ${COLORS.primary}` : `1px solid ${COLORS.border}`,
      background: type === t ? COLORS.primaryBg : COLORS.white,
      color: type === t ? COLORS.primary : COLORS.textSub,
    }}>{label}</button>
  );

  return (
    <BottomSheet title={`🗓 ${routine.text}`} onClose={onClose}>
      <Label>頻度</Label>
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        {typeBtn("daily", "毎日")}
        {typeBtn("weekly", "曜日指定")}
        {typeBtn("interval", "間隔指定")}
      </div>

      {type === "weekly" && (
        <div style={{ marginBottom:16 }}>
          <Label>実施する曜日</Label>
          <div style={{ display:"flex", gap:6 }}>
            {WEEKDAYS.map((w, d) => {
              const on = days.includes(d);
              return (
                <button key={d} onClick={() => toggleDay(d)} style={{
                  flex:1, padding:"10px 0", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:700,
                  border: on ? `2px solid ${COLORS.success}` : `1px solid ${COLORS.border}`,
                  background: on ? COLORS.successBg : COLORS.white,
                  color: on ? COLORS.success : COLORS.textSub,
                }}>{w}</button>
              );
            })}
          </div>
        </div>
      )}

      {type === "interval" && (
        <div style={{ marginBottom:16 }}>
          <Label>間隔（日）</Label>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
            <input type="number" min="1" max="365" value={interval}
              onChange={e => setInterval(e.target.value)}
              style={{ width:100, padding:"9px 12px", borderRadius:8, border:`1px solid ${COLORS.border}`, fontSize:14 }} />
            <span style={{ fontSize:13, color:COLORS.textSub }}>日ごと</span>
          </div>
          <Label>起点の日</Label>
          <input type="date" value={anchor} onChange={e => setAnchor(e.target.value)}
            style={{ padding:"9px 12px", borderRadius:8, border:`1px solid ${COLORS.border}`, fontSize:14 }} />
          <p style={{ margin:"6px 0 0", fontSize:11, color:COLORS.textSub }}>起点の日から数えて{interval || "?"}日ごとに対象になります。</p>
        </div>
      )}

      <Btn variant="primary" onClick={handleSave} style={{ width:"100%", padding:"13px", fontSize:15 }}>💾 保存する</Btn>
    </BottomSheet>
  );
}

function BottomSheet({ title, onClose, children }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:200, display:"flex", alignItems:"flex-end" }}>
      <div style={{ background:"#fff", width:"100%", maxWidth:680, margin:"0 auto", borderRadius:"20px 20px 0 0", padding:20, maxHeight:"90vh", overflowY:"auto", boxSizing:"border-box" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <h2 style={{ margin:0, fontSize:17, color:"#3a3a3a" }}>{title}</h2>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:"#888" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const Label = ({ children }) => (
  <label style={{ display:"block", fontWeight:700, fontSize:13, color:"#555", marginBottom:6 }}>{children}</label>
);

const inputStyle = {
  width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid #ddd", fontSize:14,
  boxSizing:"border-box", marginBottom:14,
};

// ═══════════════ メインApp ═══════════════

export default function App() {
  const [tab, setTab] = useState("write");
  const [entries, setEntries] = useState({});
  const [form, setForm] = useState(emptyForm());
  const [selDate, setSelDate] = useState(todayStr());
  const [saved, setSaved] = useState(false);

  const [goals, setGoals] = useState(emptyGoals());
  const [goalsEditing, setGoalsEditing] = useState(emptyGoals());
  const [showGoals, setShowGoals] = useState(false);

  const [dumpText, setDumpText] = useState("");
  const [dumpLoading, setDumpLoading] = useState(false);
  const [showDump, setShowDump] = useState(false);

  const [showSaveToast, setShowSaveToast] = useState(false);
  const saveToastTimer = useRef(null);

  const [baseList, setBaseList] = useState([]);
  const [activeBaseId, setActiveBaseId] = useState(null);
  const [generatedScheds, setGeneratedScheds] = useState({});
  const [schedLoading, setSchedLoading] = useState(false);
  const [editorState, setEditorState] = useState(null);
  const [showBaseList, setShowBaseList] = useState(false);
  const [todos, setTodos] = useState([]);
  const [todoInput, setTodoInput] = useState("");

  const [routineSubTab, setRoutineSubTab] = useState("check");
  const [routines, setRoutines] = useState({ active: [], done: [] });
  const [routineInput, setRoutineInput] = useState("");
  const [routineSchedEdit, setRoutineSchedEdit] = useState(null);
  const [routineChecks, setRoutineChecks] = useState({});

  const [aiSubTab, setAiSubTab] = useState("chat");
  const [chatMsgs, setChatMsgs] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [trendText, setTrendText] = useState("");
  const [trendLoading, setTrendLoading] = useState(false);
  const [goalsText, setGoalsText] = useState("");
  const [goalsLoading, setGoalsLoading] = useState(false);
  const chatEndRef = useRef(null);

  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [aiCfg, setAiCfg] = useState(DEFAULT_AI_CONFIG);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const fileInputRef = useRef(null);

  // 初期ロード
  useEffect(() => {
    (async () => {
      const e = await storageGet("journal-entries"); if (e) setEntries(e);
      const bl = await storageGet("base-schedule-list"); if (bl) setBaseList(bl);
      const ai = await storageGet("active-base-id"); if (ai) setActiveBaseId(ai);
      const gs = await storageGet("generated-schedules"); if (gs) setGeneratedScheds(gs);
      const rt = await storageGet("routines"); if (rt) setRoutines(normalizeRoutines(rt));
      const rc = await storageGet("routine-checks"); if (rc) setRoutineChecks(rc);
      const td = await storageGet("todos"); if (td) setTodos(td);
      const gl = await storageGet("goals"); if (gl) { setGoals(gl); setGoalsEditing(gl); }
      const cfg = await storageGet("ai-config"); if (cfg) { setAiCfg({ ...DEFAULT_AI_CONFIG, ...cfg }); applyAiConfig(cfg); }
      const st = await storageGet("app-settings");
      if (st) {
        const merged = { ...DEFAULT_SETTINGS, ...st };
        setSettings(merged);
        if (merged.defaultTab) setTab(merged.defaultTab);
        if (merged.startDateMode === "last") {
          const last = await storageGet("last-date");
          if (last && typeof last === "string") setSelDate(last);
        }
      }
    })();
  }, []);

  // 手入力の消失防止：最新値の参照と編集フラグ
  const dirtyRef = useRef(false);
  const formRef = useRef(form);   formRef.current = form;
  const entriesRef = useRef(entries); entriesRef.current = entries;
  const selDateRef = useRef(selDate); selDateRef.current = selDate;

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

  // リロード/閉じる時の保険（localStorageへ同期保存）
  useEffect(() => {
    const h = () => {
      if (!dirtyRef.current) return;
      const updated = { ...entriesRef.current, [selDateRef.current]: formRef.current };
      storageSetSync("journal-entries", updated);
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMsgs, chatLoading]);

  // 「最後に開いた日」モード時、選択日を記憶
  useEffect(() => {
    if (settings.startDateMode === "last") storageSet("last-date", selDate);
  }, [selDate, settings.startDateMode]);

  const activeBase = baseList.find(b => b.id === activeBaseId) || null;
  const todaySched = generatedScheds[selDate] || null;
  const sortedDates = Object.keys(entries).sort().reverse();

  // ─── トースト ───
  const showToast = () => {
    clearTimeout(saveToastTimer.current);
    setShowSaveToast(true);
    saveToastTimer.current = setTimeout(() => setShowSaveToast(false), (settings.toastSeconds || 5) * 1000);
  };
  const hideToast = () => {
    clearTimeout(saveToastTimer.current);
    setShowSaveToast(false);
  };

  // ─── エントリ保存ヘルパー ───
  const saveEntryState = async (newForm) => {
    const updated = pruneByDateKey({ ...entries, [selDate]: newForm }, settings.limitEntriesDays);
    setEntries(updated);
    await storageSet("journal-entries", updated);
  };

  // ─── 目標 ───
  const saveGoals = async () => {
    setGoals(goalsEditing);
    await storageSet("goals", goalsEditing);
    setShowGoals(false);
  };

  // ─── ToDo ───
  const saveTodos = async (next) => {
    const pruned = pruneTodos(next, settings.limitDoneTodos);
    setTodos(pruned);
    await storageSet("todos", pruned);
  };

  const addTodoManual = async () => {
    const text = todoInput.trim();
    if (!text) return;
    await saveTodos([...todos, {
      id: uid(), text, done: false, source: "manual",
      createdAt: todayStr(), dueDate: null,
    }]);
    setTodoInput("");
  };

  const toggleTodo = async (id) => {
    await saveTodos(todos.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const removeTodo = async (id) => {
    await saveTodos(todos.filter(t => t.id !== id));
  };

  const updateTodoDueDate = async (id, dueDate) => {
    await saveTodos(todos.map(t => t.id === id ? { ...t, dueDate } : t));
  };

  const updateTodoText = async (id, text) => {
    await saveTodos(todos.map(t => t.id === id ? { ...t, text } : t));
  };

  const clearDoneTodos = async () => {
    if (!window.confirm("完了済みのToDoをすべて削除しますか？")) return;
    await saveTodos(todos.filter(t => !t.done));
  };

  // ─── 日記保存 ───
  const saveEntry = async () => {
    await saveEntryState(form);
    dirtyRef.current = false;
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);

    if (!settings.autoExtractOnSave) return;
    try {
      const extracted = await extractTodos(form.todayGoal, form.tomorrowGoal);
      if (extracted?.length > 0) {
        const existing = new Set(todos.map(t => t.text));
        const newTodos = extracted
          .filter(e => e.text && !existing.has(e.text))
          .map(e => ({
            id: uid(), text: e.text, done: false,
            source: "ai-" + (e.when || "today"),
            createdAt: selDate,
            dueDate: e.when === "tomorrow" ? getOffsetDate(selDate, 1) : selDate,
          }));
        if (newTodos.length > 0) await saveTodos([...todos, ...newTodos]);
      }
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
      await saveEntryState(newForm);
      showToast();

      if (settings.autoExtractOnDump) try {
        const extracted = await extractTodos(newForm.todayGoal, newForm.tomorrowGoal);
        if (extracted?.length > 0) {
          const existing = new Set(todos.map(t => t.text));
          const newTodos = extracted
            .filter(e => e.text && !existing.has(e.text))
            .map(e => ({
              id: uid(), text: e.text, done: false,
              source: "ai-" + (e.when || "today"),
              createdAt: selDate,
              dueDate: e.when === "tomorrow" ? getOffsetDate(selDate, 1) : selDate,
            }));
          if (newTodos.length > 0) await saveTodos([...todos, ...newTodos]);
        }
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

  // ─── 稼働シーケンス個別チェック ───
  const toggleSequenceCheck = async (idx) => {
    const checks = { ...(form.sequenceChecks || {}) };
    checks[idx] = !checks[idx];
    const newForm = { ...form, sequenceChecks: checks };
    setForm(newForm);
    await saveEntryState(newForm);
  };

  // ─── スケジュール ───
  const saveBaseSchedule = async (newBase) => {
    const exists = baseList.some(b => b.id === newBase.id);
    const updated = exists
      ? baseList.map(b => b.id === newBase.id ? newBase : b)
      : [...baseList, newBase];
    setBaseList(updated);
    await storageSet("base-schedule-list", updated);
    if (!activeBaseId) {
      setActiveBaseId(newBase.id);
      await storageSet("active-base-id", newBase.id);
    }
  };

  const switchActiveBase = async (id) => {
    setActiveBaseId(id);
    await storageSet("active-base-id", id);
  };

  const deleteBase = async (id) => {
    if (!window.confirm("このスケジュールを削除しますか？")) return;
    const updated = baseList.filter(b => b.id !== id);
    setBaseList(updated);
    await storageSet("base-schedule-list", updated);
    if (activeBaseId === id) {
      const next = updated[0]?.id || null;
      setActiveBaseId(next);
      await storageSet("active-base-id", next);
    }
  };

  const generateSchedule = async () => {
    if (!activeBase) { alert("先にベーススケジュールを設定してください"); return; }
    setSchedLoading(true);
    const base = activeBase;
    const e = entries[selDate] || form;
    const fmt = (arr) => arr.map(b => b.time + " " + b.label).join("\n");
    const prompt =
`あなたは日次スケジュール作成AIです。以下の情報をもとに、今日の最適なスケジュールをJSON配列で返してください。コードブロック記号不要、JSONのみ。

## ベーススケジュール名
${base.name}

## 備考
${base.note || "（なし）"}

## 固定ブロック（変えない）
${fmt(base.blocks.filter(b => b.fixed)) || "なし"}

## 可変ブロック（調整OK）
${fmt(base.blocks.filter(b => !b.fixed)) || "なし"}

## 今日のジャーナル
- 大目標: ${goals.bigGoal || "未設定"}
- 中目標: ${goals.midGoal || "未設定"}
- 近目標: ${goals.nearGoal || "未設定"}
- 今日の目標: ${e.todayGoal || "未記入"}
- 明日の目標: ${e.tomorrowGoal || "未記入"}
- ひとこと: ${e.memo || "未記入"}

## 出力形式
[{"time":"HH:MM","label":"タスク名","note":"コメント","fixed":true}]`;

    try {
      const raw = await callClaude([{ role: "user", content: prompt }], "", 1500);
      const parsed = JSON.parse(extractJson(raw));
      const updated = { ...generatedScheds, [selDate]: parsed };
      setGeneratedScheds(updated);
      await storageSet("generated-schedules", updated);
    } catch (err) {
      alert("スケジュール生成に失敗しました: " + err.message);
    }
    setSchedLoading(false);
  };

  // ─── ルーチン ───
  const saveRoutines = async (next) => {
    setRoutines(next);
    await storageSet("routines", next);
  };

  const addRoutine = async () => {
    const text = routineInput.trim();
    if (!text) return;
    const targetTab = routineSubTab === "done" ? "done" : "active";
    const list = routines[targetTab];
    if (list.length >= settings.limitRoutinePerTab) { alert(`1タブ最大${settings.limitRoutinePerTab}個までです`); return; }
    if (list.some(r => r.text === text)) { alert("同じ内容がすでにあります"); return; }
    const newRoutine = { id: uid(), text, schedule: { type: "daily" } };
    await saveRoutines({ ...routines, [targetTab]: [...list, newRoutine] });
    setRoutineInput("");
  };

  const removeRoutine = async (tabName, id) => {
    await saveRoutines({ ...routines, [tabName]: routines[tabName].filter(r => r.id !== id) });
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
      if (changed) {
        setRoutineChecks(cleaned);
        await storageSet("routine-checks", cleaned);
      }
    }
  };

  const moveRoutine = async (from, id) => {
    const to = from === "active" ? "done" : "active";
    const item = routines[from].find(r => r.id === id);
    if (!item) return;
    await saveRoutines({
      ...routines,
      [from]: routines[from].filter(r => r.id !== id),
      [to]: [...routines[to], item],
    });
  };

  const updateRoutineSchedule = async (tabName, id, schedule) => {
    await saveRoutines({
      ...routines,
      [tabName]: routines[tabName].map(r => r.id === id ? { ...r, schedule } : r),
    });
  };

  const toggleRoutineCheck = async (date, routineId) => {
    const dc = routineChecks[date] || {};
    const next = pruneByDateKey({
      ...routineChecks,
      [date]: { ...dc, [routineId]: !dc[routineId] },
    }, settings.limitRoutineCheckDays);
    setRoutineChecks(next);
    await storageSet("routine-checks", next);
  };

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
    return `${persona.tone}
以下は${fmtDate(date)}のジャーナルエントリだ。この人格を最後まで崩さず会話すること。
【大目標】${goals.bigGoal || "未設定"}
【中目標】${goals.midGoal || "未設定"}
【近目標】${goals.nearGoal || "未設定"}
【今日ありがたいこと】${e.grateful || "未記入"}
【今日の目標】${e.todayGoal || "未記入"}
【明日の目標】${e.tomorrowGoal || "未記入"}
【ひとこと】${e.memo || "未記入"}
【未完了ToDo】
${openTodos}
【本日のルーチン】${routineLine}
【本日のスケジュール】${sched}
最初のメッセージでは内容を簡潔にまとめてコメントし「何か話したいことはありますか？」と聞いてください。`;
  };

  const startChat = async (date) => {
    setAiSubTab("chat"); setTab("ai"); setChatMsgs([]); setChatLoading(true);
    try {
      const reply = await callClaude(
        [{ role: "user", content: "今日のエントリをまとめてコメントしてください。" }],
        buildChatSystem(date)
      );
      setChatMsgs([{ role: "assistant", content: reply }]);
    } catch {
      setChatMsgs([{ role: "assistant", content: "エラーが発生しました。" }]);
    }
    setChatLoading(false);
  };

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const next = [...chatMsgs, { role: "user", content: chatInput.trim() }];
    setChatMsgs(next); setChatInput(""); setChatLoading(true);
    try {
      const reply = await callClaude(next, buildChatSystem(selDate));
      setChatMsgs([...next, { role: "assistant", content: reply }]);
    } catch {
      setChatMsgs([...next, { role: "assistant", content: "エラーが発生しました。" }]);
    }
    setChatLoading(false);
  };

  const runTrend = async () => {
    setAiSubTab("trend"); setTrendLoading(true);
    const recent = Object.keys(entries).sort().slice(-7).map(d => {
      const e = entries[d];
      return `=== ${fmtDate(d)} ===\n目標: ${e.todayGoal}\n感謝: ${e.grateful}\nひとこと: ${e.memo || ""}`;
    }).join("\n\n");
    try {
      setTrendText(await callClaude([{ role: "user", content: "以下の直近の日記を分析し、傾向・成長・アドバイスをください。\n\n" + recent }]));
    } catch { setTrendText("エラーが発生しました。"); }
    setTrendLoading(false);
  };

  const runGoals = async () => {
    setAiSubTab("goals"); setGoalsLoading(true);
    const recent = Object.keys(entries).sort().slice(-14).map(d => {
      const e = entries[d];
      return `${fmtDate(d)}: 今日の目標=「${e.todayGoal || ""}」 感謝=「${e.grateful || ""}」`;
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
    try { setGoalsText(await callClaude([{ role: "user", content: prompt }])); }
    catch { setGoalsText("エラーが発生しました。"); }
    setGoalsLoading(false);
  };

  // ─── 設定 ───
  const saveAiCfg = async (next) => {
    const merged = { ...DEFAULT_AI_CONFIG, ...next };
    setAiCfg(merged);
    applyAiConfig(merged);
    await storageSet("ai-config", merged);
  };

  const saveSettings = async (next) => {
    const merged = { ...DEFAULT_SETTINGS, ...next };
    setSettings(merged);
    await storageSet("app-settings", merged);
  };

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
    setSettings(DEFAULT_SETTINGS);
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
          <AiSettings cfg={aiCfg} onSave={saveAiCfg} />

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

          {JOURNAL_FIELDS.filter(f => !settings.hiddenFields.includes(f.key)).map(f => (
            <div key={f.key} style={{ marginBottom:16 }}>
              <label style={{ display:"block", fontWeight:700, color:"#3a3a3a", fontSize:14, marginBottom:6 }}>{f.label}</label>
              <textarea value={form[f.key]} onChange={e => { dirtyRef.current = true; setForm({ ...form, [f.key]: e.target.value }); }}
                placeholder={f.placeholder} rows={f.rows}
                style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:"1px solid #e0dcd5", fontSize:14, resize:"vertical", background:"#fff", boxSizing:"border-box", lineHeight:1.6, color:"#333" }} />
            </div>
          ))}

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

              <Btn variant="primary" disabled={schedLoading || !activeBase} onClick={generateSchedule}
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
                    <div style={{ padding:"10px 16px", borderRadius:"18px 18px 18px 4px", background:"#f0eeff", color:"#888", fontSize:14 }}>考え中...</div>
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
                    {JOURNAL_FIELDS.filter(f => !settings.hiddenFields.includes(f.key)).map(f => e[f.key] && (
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

// ─── 補助コンポーネント ───

function DateSelector({ value, onChange }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
      <input type="date" value={value} onChange={e => onChange(e.target.value)}
        style={{ padding:"8px 12px", borderRadius:8, border:"1px solid #ddd", fontSize:14, background:"#fff" }} />
      <span style={{ color:"#888", fontSize:13 }}>{fmtDate(value)}</span>
    </div>
  );
}

function CollapseSection({ open, onToggle, title, titleColor, openBorder, closedBg, closedBorder, summary, closedHint, compact, children }) {
  const padding = open ? "16px" : (compact ? "12px 14px" : "14px");
  return (
    <div style={{
      background: open ? "#fff" : closedBg,
      border: open ? openBorder : closedBorder,
      borderRadius: 14, padding, marginBottom: 20,
    }}>
      <button onClick={onToggle} style={{
        width:"100%", background:"none", border:"none", cursor:"pointer",
        display:"flex", alignItems:"center", justifyContent:"space-between", padding:0,
      }}>
        <span style={{ fontWeight:700, fontSize: compact ? 14 : 15, color: titleColor }}>
          {title}
          {!open && closedHint && <span style={{ fontSize:11, color:"#888", fontWeight:400, marginLeft:8 }}>{closedHint}</span>}
        </span>
        <span style={{ fontSize: compact ? 16 : 18, color: titleColor }}>{open ? "▲" : "▼"}</span>
      </button>
      {!open && summary}
      {open && <div style={{ marginTop:14 }}>{children}</div>}
    </div>
  );
}

function GoalEditor({ goals, onChange }) {
  const fields = [
    { key: "bigGoal", label: "🌟 大目標", color: "#38a169", placeholder: "長期的な人生のビジョン" },
    { key: "midGoal", label: "🎯 中目標", color: "#d97706", placeholder: "半年〜1年で達成したい目標" },
    { key: "nearGoal", label: "📍 近目標", color: "#6c63ff", placeholder: "1〜3ヶ月で達成したい目標" },
  ];
  return (
    <>
      {fields.map(f => (
        <div key={f.key}>
          <label style={{ display:"block", fontWeight:700, fontSize:13, color: f.color, marginBottom:4 }}>{f.label}</label>
          <textarea value={goals[f.key]} onChange={e => onChange({ ...goals, [f.key]: e.target.value })}
            placeholder={f.placeholder} rows={2}
            style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid #e0dcd5", fontSize:13, resize:"vertical", background:"#fff", boxSizing:"border-box", lineHeight:1.6, marginBottom:10 }} />
        </div>
      ))}
    </>
  );
}

function SettingButton({ icon, title, desc, onClick, variant = "default" }) {
  const styles = {
    default: { background: "#f8f7ff", border: "1px solid #e0dcd5", titleColor: "#3a3a3a", descColor: "#888" },
    warm: { background: "#fff7e6", border: "1px solid #fcd34d", titleColor: "#92400e", descColor: "#b45309" },
  };
  const s = styles[variant];
  return (
    <button onClick={onClick}
      style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px", background: s.background, border: s.border, borderRadius:12, cursor:"pointer", textAlign:"left", width:"100%" }}>
      <span style={{ fontSize:22 }}>{icon}</span>
      <div>
        <p style={{ margin:0, fontWeight:700, fontSize:14, color: s.titleColor }}>{title}</p>
        <p style={{ margin:"2px 0 0", fontSize:12, color: s.descColor }}>{desc}</p>
      </div>
    </button>
  );
}

function Banner({ type, children }) {
  const styles = {
    success: { bg: "#f0fff4", border: "1px solid #9ae6b4", color: "#276749", weight: 600 },
    error: { bg: "#fff0f0", border: "1px solid #feb2b2", color: "#c53030", weight: 400 },
  };
  const s = styles[type];
  return (
    <div style={{ background: s.bg, border: s.border, borderRadius:10, padding:"10px 14px", marginBottom:12, fontSize:13, color: s.color, fontWeight: s.weight }}>
      {children}
    </div>
  );
}

function AIResult({ loading, text, placeholder }) {
  return (
    <div style={{ background:"#fff", borderRadius:12, padding:20, minHeight:200, boxShadow:"0 1px 4px rgba(0,0,0,.08)" }}>
      {loading ? <p style={{ color:"#888", textAlign:"center", paddingTop:40 }}>分析中...</p>
        : text ? <div style={{ fontSize:14, lineHeight:1.8, color:"#333", whiteSpace:"pre-wrap" }}>{text}</div>
        : <p style={{ color:"#bbb", textAlign:"center", paddingTop:40, fontSize:14 }}>{placeholder}</p>}
    </div>
  );
}

function GeneralSettings({ settings, onSave }) {
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

function AiSettings({ cfg, onSave }) {
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

  const field = (label, key, placeholder) => (
    <div style={{ marginBottom:10 }}>
      <label style={{ display:"block", fontSize:12, color:COLORS.textSub, fontWeight:600, marginBottom:4 }}>{label}</label>
      <input value={draft[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder}
        style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:`1px solid ${COLORS.border}`, fontSize:13, boxSizing:"border-box" }} />
    </div>
  );

  return (
    <div style={{ background:COLORS.bg, borderRadius:12, padding:"14px 16px", marginBottom:24 }}>
      <div style={{ display:"flex", gap:8, marginBottom:12 }}>
        {modeBtn("local", "🖥 ローカル")}
        {modeBtn("cloud", "☁️ クラウド")}
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
          {field("モデル名", "cloudModel", "claude-sonnet-4-20250514")}
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
