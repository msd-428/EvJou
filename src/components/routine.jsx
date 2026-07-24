import { useState } from "react";
import { COLORS, WEEKDAYS } from "../constants.js";
import { isRoutineDue, scheduleSummary } from "../lib/domain.js";
import { todayStr, fmtDate, fmtShort } from "../lib/date.js";
import { Btn, Checkbox, EmptyState, StatCard, BottomSheet, Label } from "./common.jsx";

export function RoutineCheckView({ selDate, setSelDate, routines, routineChecks, onToggle }) {
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

export function RoutineStats({ routines, routineChecks, getRecentDates, shortDays = 7, longDays = 30 }) {
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

export function RoutineScheduleEditor({ routine, onSave, onClose }) {
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
