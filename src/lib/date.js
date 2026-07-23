// 日付ユーティリティ。
// 日付キーは必ずローカルタイムゾーン基準の YYYY-MM-DD で扱う。
// new Date().toISOString() は UTC 基準で JST 00〜09時に前日へずれるため使わない。

// ローカルタイムゾーン基準で YYYY-MM-DD を返す（UTCずれ防止）
export const toLocalDateStr = (d) => {
  const dt = d ? new Date(d) : new Date();
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const todayStr = () => toLocalDateStr();

export const fmtDate = (d) =>
  new Date(d).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" });

export const fmtShort = (d) => { const dt = new Date(d); return (dt.getMonth() + 1) + "/" + dt.getDate(); };

export function getOffsetDate(base, offset) {
  const d = new Date(base);
  d.setDate(d.getDate() + offset);
  return toLocalDateStr(d);
}

export function getEndOfWeek(base) {
  const d = new Date(base);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  return toLocalDateStr(d);
}

// 今日を末尾に、直近 n 日分の日付配列（古い順）を返す
export function getRecentDates(n) {
  const out = [];
  const base = new Date(todayStr());
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    out.push(toLocalDateStr(d));
  }
  return out;
}
