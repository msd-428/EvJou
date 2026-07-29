import { COLORS } from "../constants.js";
import { fmtDate } from "../lib/date.js";

export function Btn({ children, onClick, disabled, variant = "primary", small, style }) {
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

export function TabBar({ tabs, active, onChange }) {
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

export function SaveToast({ visible, onClose }) {
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

export function Checkbox({ checked, onClick, size = 22, activeColor = "#38a169", idleColor = "#d97706" }) {
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

export function StatCard({ label, value, color }) {
  return (
    <div style={{ flex:1, background:"#fff", borderRadius:12, padding:"14px", boxShadow:"0 1px 4px rgba(0,0,0,.07)" }}>
      <p style={{ margin:0, fontSize:11, color:"#888", fontWeight:600 }}>{label}</p>
      <p style={{ margin:"4px 0 0", fontSize:26, fontWeight:700, color }}>{value}<span style={{ fontSize:14, color:"#aaa" }}>%</span></p>
    </div>
  );
}

export function EmptyState({ icon, text }) {
  return (
    <div style={{ textAlign:"center", color:"#ccc", padding:"50px 0" }}>
      <div style={{ fontSize:40, marginBottom:10 }}>{icon}</div>
      <p style={{ fontSize:14, color:"#aaa" }}>{text}</p>
    </div>
  );
}

export function BottomSheet({ title, onClose, children }) {
  // inset ショートハンドは Chrome 87+。旧WebView(Chrome 74)は無視して offset が
  // auto のままになり、オーバーレイが画面全体に広がらない。必ず longhand で書く。
  return (
    <div style={{ position:"fixed", top:0, right:0, bottom:0, left:0, background:"rgba(0,0,0,.45)", zIndex:200, display:"flex", alignItems:"flex-end" }}>
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

export const Label = ({ children }) => (
  <label style={{ display:"block", fontWeight:700, fontSize:13, color:"#555", marginBottom:6 }}>{children}</label>
);

export const inputStyle = {
  width:"100%", padding:"9px 12px", borderRadius:8, border:"1px solid #ddd", fontSize:14,
  boxSizing:"border-box", marginBottom:14,
};

export function SettingButton({ icon, title, desc, onClick, variant = "default" }) {
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

export function CollapseSection({ open, onToggle, title, titleColor, openBorder, closedBg, closedBorder, summary, closedHint, compact, children }) {
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

export function DateSelector({ value, onChange }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
      <input type="date" value={value} onChange={e => onChange(e.target.value)}
        style={{ padding:"8px 12px", borderRadius:8, border:"1px solid #ddd", fontSize:14, background:"#fff" }} />
      <span style={{ color:"#888", fontSize:13 }}>{fmtDate(value)}</span>
    </div>
  );
}

export function Banner({ type, children }) {
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

export function AIResult({ loading, text, placeholder, loadingText }) {
  return (
    <div style={{ background:"#fff", borderRadius:12, padding:20, minHeight:200, boxShadow:"0 1px 4px rgba(0,0,0,.08)" }}>
      {loading ? <p style={{ color:"#888", textAlign:"center", paddingTop:40 }}>{loadingText || "分析中..."}</p>
        : text ? <div style={{ fontSize:14, lineHeight:1.8, color:"#333", whiteSpace:"pre-wrap" }}>{text}</div>
        : <p style={{ color:"#bbb", textAlign:"center", paddingTop:40, fontSize:14 }}>{placeholder}</p>}
    </div>
  );
}
