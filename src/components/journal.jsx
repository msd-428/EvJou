import { Checkbox } from "./common.jsx";

export function SequenceChecklist({ sequence, checks, onToggle }) {
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
