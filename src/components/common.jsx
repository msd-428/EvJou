import { useEffect, useRef } from "react";
import { COLORS } from "../constants.js";
import { fmtDate } from "../lib/date.js";
import { pushBackHandler } from "../lib/backButton.js";

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

  // Androidの戻るボタンで閉じる。開いている間だけスタックへ積む。
  // onClose は毎描画で新しい関数になるので、ref 経由で最新を呼ぶ
  // （依存配列を空にして、積む順＝表示の重なり順を保つため）。
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => pushBackHandler(() => { if (closeRef.current) closeRef.current(); }), []);

  // ヘッダーは固定し、スクロールするのは中身だけ。下までスクロールすると ✕ が
  // 画面外へ消えていたのを直したもの。縦Flex＋中身の minHeight:0 で実現しており、
  // Flexbox も min-height:0 も Chrome 74 で動く（position:sticky を使わないのは、
  // 旧WebViewでスクロール中に描画が取り残されることがあるため）。
  return (
    <div style={{ position:"fixed", top:0, right:0, bottom:0, left:0, background:"rgba(0,0,0,.45)", zIndex:200, display:"flex", alignItems:"flex-end" }}>
      <div style={{
        background:"#fff", width:"100%", maxWidth:680, margin:"0 auto",
        borderRadius:"20px 20px 0 0", maxHeight:"90vh", boxSizing:"border-box",
        display:"flex", flexDirection:"column", overflow:"hidden",
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"20px 20px 18px", flexShrink:0 }}>
          <h2 style={{ margin:0, fontSize:17, color:"#3a3a3a" }}>{title}</h2>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:"#888" }}>✕</button>
        </div>
        <div style={{ padding:"0 20px 20px", overflowY:"auto", minHeight:0 }}>
          {children}
        </div>
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

// AIの返答に混ざる最小限のMarkdownだけを描画する。ライブラリは足さない。
// 対応するのは **太字** / `コード` / 行頭の見出し(#) の3つだけで、
// 表・リンク・引用は素のテキストのまま出す（誤変換で本文を壊す方が損なので、
// 解釈できない書式は触らない）。
//
// HTML文字列を組み立てず React要素として返すので、dangerouslySetInnerHTML は不要。
// AIの出力がそのままDOMへ流れ込むことはない。
// 改行は親の whiteSpace:"pre-wrap" に任せる（行を \n で繋いだまま返す）。
const MD_INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/;
const codeStyle = {
  background:"rgba(0,0,0,.06)", borderRadius:4, padding:"1px 5px",
  fontFamily:"monospace", fontSize:"0.92em",
};

function mdInline(line, row) {
  return line.split(MD_INLINE).map((part, i) => {
    if (!part) return null;
    if (part.length > 4 && part.slice(0, 2) === "**" && part.slice(-2) === "**") {
      return <strong key={`${row}-${i}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.length > 2 && part[0] === "`" && part[part.length - 1] === "`") {
      return <code key={`${row}-${i}`} style={codeStyle}>{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

export function Markdown({ text }) {
  const lines = String(text == null ? "" : text).split("\n");
  return (
    <>
      {lines.map((line, i) => {
        const h = /^(#{1,6})\s+(.*)$/.exec(line);
        const nodes = mdInline(h ? h[2] : line, i);
        return (
          <span key={i}>
            {h ? <strong style={{ fontSize:"1.08em" }}>{nodes}</strong> : nodes}
            {i < lines.length - 1 ? "\n" : null}
          </span>
        );
      })}
    </>
  );
}

export function AIResult({ loading, text, loadingText, onRegenerate, regenerateLabel = "🔄 もう一度分析する" }) {
  return (
    <div style={{ background:"#fff", borderRadius:12, padding:20, minHeight:200, boxShadow:"0 1px 4px rgba(0,0,0,.08)" }}>
      {loading
        ? <p style={{ color:"#888", textAlign:"center", paddingTop:40 }}>{loadingText || "分析中..."}</p>
        : <div style={{ fontSize:14, lineHeight:1.8, color:"#333", whiteSpace:"pre-wrap" }}><Markdown text={text} /></div>}
      {!loading && text && onRegenerate && (
        <div style={{ marginTop:18, paddingTop:14, borderTop:`1px solid ${COLORS.border}`, textAlign:"center" }}>
          <Btn variant="ghost" onClick={onRegenerate} style={{ padding:"9px 18px", fontSize:13 }}>{regenerateLabel}</Btn>
        </div>
      )}
    </div>
  );
}

// AI生成を「明示的に押した時だけ」走らせるための誘導パネル。
// サブタブを開いた瞬間の自動発火を廃止した代わりに、各AI画面の初期状態へ置く。
// plain=true でカードの装飾を外し、既に白背景のコンテナ（チャット欄）へ埋め込める。
export function AiActionPanel({ icon, title, desc, actionLabel, onAction, disabled, disabledHint, plain }) {
  const card = plain ? {} : {
    background: COLORS.white, borderRadius: 14,
    border: `1px dashed #d8d3f5`, boxShadow: "0 1px 4px rgba(0,0,0,.06)",
  };
  return (
    <div style={{ textAlign:"center", padding: plain ? "34px 16px" : "40px 22px", ...card }}>
      <div style={{ fontSize:40, marginBottom:12, opacity:.9 }}>{icon}</div>
      <p style={{ margin:"0 0 8px", fontWeight:700, fontSize:15, color:COLORS.text }}>{title}</p>
      <p style={{ margin:"0 auto 20px", maxWidth:340, fontSize:12.5, color:COLORS.textSub, lineHeight:1.8 }}>{desc}</p>
      <button onClick={onAction} disabled={disabled} style={{
        border:"none", borderRadius:999, padding:"13px 28px", fontSize:14.5, fontWeight:700,
        color: COLORS.white, background: "linear-gradient(135deg, #8079ff 0%, #6c63ff 55%, #5a51e0 100%)",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
        boxShadow: disabled ? "none" : "0 6px 16px rgba(108,99,255,.32)",
      }}>{actionLabel}</button>
      {disabled && disabledHint && (
        <p style={{ margin:"14px 0 0", fontSize:11.5, color:"#bbb" }}>{disabledHint}</p>
      )}
    </div>
  );
}
