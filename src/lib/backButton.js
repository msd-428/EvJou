import { App as CapApp } from "@capacitor/app";

// Androidの戻るボタンで「今いちばん上に開いているもの」を閉じるための小さなスタック。
// React に依存しない。UI側は useEffect から pushBackHandler() を呼び、戻り値で外す。
//
// ★ ネイティブ既定の再現について
// Capacitor の backButton は、JS側にリスナーが1つでも登録されていると
// ネイティブ側の既定処理が丸ごと止まる（@capacitor/app の AppPlugin.java が
// hasListeners("backButton") で分岐しているため）。
// したがって「何も開いていないとき」の挙動は、こちら側で書き戻す必要がある。
//
// Capacitor 8 の既定は「WebViewの履歴を戻れるなら戻る／戻れないなら何もしない」であって
// アプリ終了ではない。OnBackPressedCallback は有効なままなので、戻る操作はそこで
// 握り潰されて終わる。よく見かける exitApp() の呼び出しは既定より強い挙動になり、
// 日記を書いている最中にアプリが落ちる事故になりうるので、ここでは呼ばない。
const handlers = [];
let attached = false;

function onBackButton(ev) {
  const top = handlers[handlers.length - 1];
  if (top) { top(); return; }
  if (ev && ev.canGoBack) window.history.back();   // 何も開いていない＝既定どおり
}

// 最初に必要になった時だけ登録する。以後は外さない
// （空スタック時も上の関数が既定を再現するので、外す必要がない）。
function attach() {
  if (attached) return;
  attached = true;
  // Web（開発サーバ・E2E）では backButton は発火しないが、登録自体は成功する。
  CapApp.addListener("backButton", onBackButton).catch(() => { attached = false; });
}

// 閉じる処理を積む。戻り値を呼ぶと外れる。
// 後から積まれたものほど手前に表示されているとみなし、先に閉じる。
export function pushBackHandler(fn) {
  handlers.push(fn);
  attach();
  return () => {
    const i = handlers.indexOf(fn);
    if (i >= 0) handlers.splice(i, 1);
  };
}
