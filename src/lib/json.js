// LLM出力から最初のJSON値（オブジェクト/配列）だけを抜き出す。
// ローカル小型モデルが前後に地の文やコードフェンスを付けても壊れにくくする。
export function extractJson(raw) {
  let s = (raw || "").replace(/```json|```/g, "").trim();
  const start = s.search(/[\[{]/);
  if (start === -1) return s;
  const open = s[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) { end = i; break; } }
  }
  return end === -1 ? s.slice(start) : s.slice(start, end + 1);
}
