// localStorage によるストレージアダプタ実装。
//
// すべてのアダプタは以下の契約（StorageAdapter）を満たす：
//   name              : string                       … 識別用の名前
//   get(key)          : Promise<any | null>          … 値を取得（無ければ null）
//   set(key, value)   : Promise<void>                … 値を保存
//   remove(key)       : Promise<void>                … 値を削除
//   setSync(key, val) : void                         … 同期保存（beforeunload等の保険用・任意）
//
// get/set/remove を Promise で返すのは、将来の IndexedDB / クラウドDB（本質的に非同期）へ
// 同じインターフェースのまま差し替えられるようにするため。
// setSync は localStorage が同期APIである点を活かした「最後の保険」で、
// 非同期アダプタでは best-effort（未実装可）とする。

const PREFIX = "journal_v1_";

export const localStorageAdapter = {
  name: "localStorage",

  async get(key) {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? null : JSON.parse(raw);
  },

  async set(key, value) {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  },

  async remove(key) {
    localStorage.removeItem(PREFIX + key);
  },

  setSync(key, value) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch {}
  },
};
