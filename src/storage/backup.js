// データのエクスポート／インポート（JSONファイル）。
// KVストア本体（index.js）とは別の「バックアップ入出力」責務。

import { todayStr } from "../lib/date.js";

export function exportData(payload) {
  const data = { version: 1, exportedAt: new Date().toISOString(), ...payload };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "journal-backup-" + todayStr() + ".json";
  a.click();
  // 旧WebView（Android 9世代のChrome 74等）では click() 直後に revoke すると
  // ダウンロードが始まる前にURLが無効化され、保存が失敗することがある。解放は遅延させる。
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function importDataFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = (e) => { try { resolve(JSON.parse(e.target.result)); } catch { reject(new Error("JSONの解析に失敗しました")); } };
    r.onerror = () => reject(new Error("ファイルの読み込みに失敗しました"));
    r.readAsText(file);
  });
}
