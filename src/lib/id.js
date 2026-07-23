// 一意なID生成。crypto.randomUUID が使えればそれを、無ければ簡易フォールバック。
export const uid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);
