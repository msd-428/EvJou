import { useState } from "react";
import { BLOCK_COLORS, DEFAULT_BASE_BLOCKS } from "../constants.js";
import { uid } from "../lib/id.js";
import { Btn, BottomSheet, Label, inputStyle } from "./common.jsx";

export function ScheduleBlock({ item, idx, isLast }) {
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

export function BaseScheduleEditor({ initial, onSave, onClose }) {
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
