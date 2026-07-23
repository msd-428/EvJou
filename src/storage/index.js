// ストレージ層のファサード。
//
// アプリ（UI・ロジック）はこのモジュール経由でのみ永続化にアクセスし、
// 「どこに保存しているか（localStorage / IndexedDB / クラウド）」を一切知らない。
// 保存先を変えるときは setStorageAdapter() でアダプタを差し替えるだけでよい。

import { localStorageAdapter } from "./localStorageAdapter.js";

// 現在有効なアダプタ。将来 IndexedDB / クラウド実装へ差し替える単一ポイント。
let adapter = localStorageAdapter;

export function setStorageAdapter(next) { adapter = next; }
export function getStorageAdapter() { return adapter; }

// 値の取得。失敗（未保存・パース不能）時は null を返し、呼び出し側を落とさない。
export async function storageGet(key) {
  try { return await adapter.get(key); }
  catch { return null; }
}

// 値の保存。失敗しても例外を投げない（保存は best-effort）。
export async function storageSet(key, value) {
  try { await adapter.set(key, value); } catch {}
}

// 値の削除。
export async function storageRemove(key) {
  try { await adapter.remove?.(key); } catch {}
}

// beforeunload 等、await できない場面での同期保存の保険。
// 対応していないアダプタでは何もしない。
export function storageSetSync(key, value) {
  adapter.setSync?.(key, value);
}

export { exportData, importDataFile } from "./backup.js";
