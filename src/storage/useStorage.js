import { useState, useEffect, useRef } from "react";
import { storageGet, storageSet } from "./index.js";

// 単一キーを永続化する状態フック。保存先の実体（localStorage / 将来のIndexedDB・クラウド）は
// storage 層に隠蔽され、このフックの利用側は一切意識しない。
//
// 段階移行用の土台：現在 App が useEffect で手動ロード＆各所で storageSet している状態を、
// キー単位でこのフックへ置き換えていける（次のリファクタで useJournal / useTodos 等に集約予定）。
//
// 使い方:
//   const [todos, setTodos, ready] = useStorage("todos", []);
//   setTodos(next);                 // 更新すると自動保存
//   setTodos(prev => [...prev]);    // 関数アップデータも可
//
// transform: ロード直後に一度だけ正規化したいとき（例: normalizeRoutines）に渡す。
export function useStorage(key, initialValue, transform) {
  const [value, setValue] = useState(initialValue);
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);

  // 初回ロード（マウント時のみ。transform は読み込み値に一度だけ適用）
  useEffect(() => {
    let alive = true;
    (async () => {
      const stored = await storageGet(key);
      if (alive && stored != null) setValue(transform ? transform(stored) : stored);
      if (alive) { readyRef.current = true; setReady(true); }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // 値変更時に保存。初回ロード完了前は走らせない（初期値での上書き保存を防ぐ）
  useEffect(() => {
    if (!readyRef.current) return;
    storageSet(key, value);
  }, [key, value]);

  return [value, setValue, ready];
}
