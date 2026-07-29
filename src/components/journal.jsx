import { Checkbox } from "./common.jsx";
import { fmtShort } from "../lib/date.js";

// 今日の稼働シーケンス。独自データは持たず ToDo をそのまま映すビュー。
// チェックすると実体の ToDo が done になる（onToggle は ToDo の id を受け取る）。
function SequenceRow({ todo, onToggle, carried }) {
  const checked = !!todo.done;
  return (
    <div onClick={() => onToggle(todo.id)} style={{
      display:"flex", alignItems:"center", gap:10,
      background: checked ? "rgba(56,161,105,.1)" : "rgba(255,255,255,.6)",
      borderRadius:8, padding:"8px 10px", cursor:"pointer",
    }}>
      <Checkbox checked={checked} onClick={() => onToggle(todo.id)} />
      <span style={{
        fontSize:13, lineHeight:1.5, flex:1, wordBreak:"break-word",
        color: checked ? "#276749" : (carried ? "#9b2c2c" : "#78350f"),
        textDecoration: checked ? "line-through" : "none",
      }}>{todo.text}</span>
      {carried && !checked && (
        <span style={{ flexShrink:0, background:"#fff0f0", color:"#e53e3e", borderRadius:8, padding:"1px 7px", fontSize:10, fontWeight:700 }}>
          {fmtShort(todo.dueDate)}
        </span>
      )}
    </div>
  );
}

export function TodaySequence({ sequence, onToggle }) {
  const { carried, today, total, doneCount } = sequence;

  if (total === 0) {
    return (
      <p style={{ margin:0, fontSize:12, color:"#b45309", lineHeight:1.7 }}>
        今日の稼働はまだありません。ダンプモードで思考を吐き出すか、ToDoに期限「今日」を付けるとここに並びます。
      </p>
    );
  }

  return (
    <div>
      {carried.length > 0 && (
        <div style={{ marginBottom:12 }}>
          <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:700, color:"#e53e3e" }}>⏮ 昨日までの未完了（{carried.length}）</p>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {carried.map(t => <SequenceRow key={t.id} todo={t} onToggle={onToggle} carried />)}
          </div>
        </div>
      )}

      {today.length > 0 && (
        <div>
          {carried.length > 0 && <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:700, color:"#b45309" }}>🔥 今日（{today.length}）</p>}
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {today.map(t => <SequenceRow key={t.id} todo={t} onToggle={onToggle} />)}
          </div>
        </div>
      )}

      <p style={{ margin:"10px 0 0", fontSize:11, color:"#b45309", textAlign:"right" }}>
        {doneCount} / {total} 完了
      </p>
    </div>
  );
}

export function GoalEditor({ goals, onChange }) {
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
