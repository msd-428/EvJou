// Capacitor環境用のストレージアダプタ（IndexedDB + Preferences ハイブリッド）
//
// Capacitor (Android/iOS) の WebView はOSの都合でクリアされるリスクがあるため、
// IndexedDBへの保存に加えて、Capacitor Preferences プラグインへの非同期デュアルライトを行う。
// 読み出し時は IndexedDB -> Preferences -> localStorage(Legacy/Mirror) の順でフォールバック。

import { Preferences } from '@capacitor/preferences';
import { indexedDbAdapter } from './indexedDbAdapter.js';

export const capacitorAdapter = {
  name: "capacitor",

  async get(key) {
    // 1. IndexedDBのアダプタから取得を試みる（ミラーの昇格処理等もここに含まれる）
    const idbResult = await indexedDbAdapter.get(key);
    if (idbResult != null) return idbResult;

    // 2. IndexedDBに無ければ、Preferencesから復元を試みる（WebView消去対策）
    try {
      const { value } = await Preferences.get({ key: `evjou_${key}` });
      if (value != null) {
        const parsed = JSON.parse(value);
        // IndexedDB側にも復元しておく
        await indexedDbAdapter.set(key, parsed);
        return parsed;
      }
    } catch (e) {
      console.warn("Preferences get error", e);
    }
    
    return null;
  },

  async set(key, value) {
    // IndexedDBへ書き込み
    await indexedDbAdapter.set(key, value);
    
    // Preferencesへのバックグラウンド書き込み（デュアルライト）
    try {
      await Preferences.set({ key: `evjou_${key}`, value: JSON.stringify(value) });
    } catch (e) {
      console.warn("Preferences set error", e);
    }
  },

  async remove(key) {
    await indexedDbAdapter.remove(key);
    try {
      await Preferences.remove({ key: `evjou_${key}` });
    } catch (e) {
      console.warn("Preferences remove error", e);
    }
  },

  setSync(key, value) {
    // 同期処理はベースのindexedDbAdapter（中身はlocalStorageへのミラー）に委譲
    indexedDbAdapter.setSync(key, value);
    // Preferencesへの非同期保存も走らせておく（ベストエフォート）
    Preferences.set({ key: `evjou_${key}`, value: JSON.stringify(value) }).catch(() => {});
  }
};
