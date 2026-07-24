// IndexedDB を正とするストレージアダプタ（localStorage ハイブリッド）。
// 契約は localStorageAdapter と同一（name/get/set/remove/setSync）。UI・ロジックは無改修で差替可能。
//
// なぜハイブリッドか：
//   IndexedDB は本質的に非同期で、beforeunload の「確実な同期書き込み」ができない。
//   そこで消失対策の生命線だけ localStorage を保険に併用する。localStorage は
//   このアダプタ内部にのみ現れ、外（UI・ロジック）からは一切見えない。
//
// localStorage の3用途（すべて内部専用）：
//   ①ミラー   MIRROR_PREFIX + key  … beforeunload の同期保存先（setSync）。
//                                     起動時 get が突合し、IndexedDB へ昇格して削除。
//   ②レガシー LEGACY_PREFIX + key  … 旧 localStorageAdapter が書いた既存データ。
//                                     IndexedDB が空なら get で読み出し IndexedDB へ取込む。
//   ③本体は IndexedDB（DB_NAME / STORE）。
//
// get の優先順位＝ ミラー（今セッションの保険）＞ IndexedDB（通常の正）＞ レガシー（移行前）。

const DB_NAME = "journal_v1";
const STORE = "kv";
const MIRROR_PREFIX = "journal_v1_mirror_"; // beforeunload 同期保険（①）
const LEGACY_PREFIX = "journal_v1_";        // 旧 localStorageAdapter の PREFIX（②）

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function idbGet(key) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result === undefined ? null : req.result);
    req.onerror = () => reject(req.error);
  }));
}

function idbSet(key, value) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}

function idbRemove(key) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}

// localStorage 補助（①ミラー／②レガシー）。localStorage 非対応環境でも落ちないよう握り潰す。
function lsRead(fullKey) {
  try { const raw = localStorage.getItem(fullKey); return raw == null ? null : JSON.parse(raw); }
  catch { return null; }
}
function lsRemove(fullKey) { try { localStorage.removeItem(fullKey); } catch {} }

export const indexedDbAdapter = {
  name: "indexedDB",

  async get(key) {
    // ①ミラー最優先：beforeunload 保険は IndexedDB より必ず新しい（unload 後に書込は無い）。
    //   IndexedDB へ昇格できたらミラーを消し、以後は IndexedDB を正とする。失敗時はミラーを残す。
    const mirror = lsRead(MIRROR_PREFIX + key);
    if (mirror != null) {
      try { await idbSet(key, mirror); lsRemove(MIRROR_PREFIX + key); } catch {}
      return mirror;
    }
    // ②通常：IndexedDB を読む。IDB 自体が使えない環境（プライベートモード等）でも
    //   ③レガシー救済へ退避できるよう、読取失敗は握り潰して null 扱いにする。
    let current = null;
    try { current = await idbGet(key); } catch { current = null; }
    if (current != null) return current;
    // ③レガシー移行：IndexedDB が空なら旧 localStorage データを取込む（既存ユーザの消失防止）。
    const legacy = lsRead(LEGACY_PREFIX + key);
    if (legacy != null) { try { await idbSet(key, legacy); } catch {} return legacy; }
    return null;
  },

  async set(key, value) {
    await idbSet(key, value);
    lsRemove(MIRROR_PREFIX + key); // IndexedDB が正になったので古いミラーは破棄
  },

  async remove(key) {
    await idbRemove(key);
    lsRemove(MIRROR_PREFIX + key);
  },

  // beforeunload 等 await 不可の局面の同期保険。IndexedDB は同期書込不可のため localStorage に
  // ミラーする。次回起動時に get が突合して復元する（生命線＝消失対策）。
  setSync(key, value) {
    try { localStorage.setItem(MIRROR_PREFIX + key, JSON.stringify(value)); } catch {}
  },
};
