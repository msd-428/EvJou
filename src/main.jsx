import React from "react";
import { createRoot } from "react-dom/client";
import App from "./daily-journal.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { setStorageAdapter } from "./storage/index.js";
import { indexedDbAdapter } from "./storage/indexedDbAdapter.js";

// 保存先を IndexedDB へ差し替える単一ポイント（UI・ロジックは無改修）。
// beforeunload の同期保険と旧 localStorage データの取込みはアダプタ内部で処理する。
setStorageAdapter(indexedDbAdapter);

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
