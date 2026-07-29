import React from "react";
import { createRoot } from "react-dom/client";
import App from "./daily-journal.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { setStorageAdapter } from "./storage/index.js";
import { indexedDbAdapter } from "./storage/indexedDbAdapter.js";
import { Capacitor } from '@capacitor/core';
import { capacitorAdapter } from "./storage/capacitorAdapter.js";

// Capacitor環境（ネイティブアプリ）なら capacitorAdapter（Preferencesデュアルライト）、
// そうでなければ通常の indexedDbAdapter を使用する。
if (Capacitor.isNativePlatform()) {
  setStorageAdapter(capacitorAdapter);
} else {
  setStorageAdapter(indexedDbAdapter);
}
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
