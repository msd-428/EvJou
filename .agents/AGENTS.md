# EvJou Project Rules & Context

This file contains the core context and architectural decisions for the EvJou project.
All agents working on this workspace must adhere to these rules and understand this context.

## 1. Architecture (Local LLM Proxy via Firestore)
- **Frontend App**: Built with React, Vite, and Capacitor (`@capacitor/preferences` for local storage).
- **Backend (Proxy Worker)**: A Node.js worker (`proxy/index.js`) running locally on the developer's PC.
- **Communication Flow**: 
  1. The app writes an AI request document to the `ai_requests` collection in Firestore with `status: 'pending'`.
  2. The local Node.js proxy worker listens for new pending documents using `onSnapshot`.
  3. The proxy calls the local Ollama instance (`qwen2.5:7b`).
  4. The proxy updates the Firestore document with the result and `status: 'completed'`.
- **Why this architecture?**: To securely expose the local LLM to the mobile app without opening ports (NAT traversal via Firestore), ensuring zero API costs and maximum privacy.

## 2. Rate Limiting / Queueing Strategy
- Do NOT merge multiple AI tasks (e.g., text summarization and ToDo extraction) into a single prompt just to save requests. Splitting tasks yields higher quality results.
- Because the LLM runs locally (zero API cost), we do not need strict hard limits (like 3/day).
- Instead, implement a "Queueing / Waiting" mechanism in the proxy worker to handle high load or server downtime gracefully without dropping requests.

## 3. Frontend Build Targets & Devices
- **Testing Devices**:
  - **Mi 10 Pro**: Newer Android device, supports modern WebViews.
  - **OPPO Reno A (ColorOS)**: Older Android device (approx. Android 9, Chrome 74 WebView).
- **Vite Configuration**: Always ensure `vite.config.js` has `build: { target: ['es2015', 'chrome74'] }` to automatically transpile modern JavaScript (like Optional Chaining `?.` and Nullish Coalescing `??`) so it doesn't crash on older WebViews.

> **Note**: `HANDOFF.md` §12 previously described an HTTP + Cloudflare Tunnel proxy. That was an
> earlier design sketch and is **not** what ships. This section (Firestore `ai_requests`) is correct;
> `HANDOFF.md` has been annotated accordingly.

## 4. Current Backlog / Next Steps
- **[Completed] Dump Mode ToDo Approval**: Instead of automatically adding extracted ToDos, present them to the user for selection/approval.
- **[Completed] Routine Option**: Allow saving extracted tasks as "Routines" rather than just one-off "ToDos".
- **[Completed] Dynamic Journal Fields**: Journal sections are now user-editable (add / rename / reorder / remove) via `settings.journalFields`.
  - `todayGoal` / `tomorrowGoal` are **core fields** (`CORE_FIELD_KEYS`): renameable and reorderable but not removable, because ToDo extraction, schedule generation and AI chat context read them by key.
  - Removing a field never deletes stored entry data — restoring the field brings past records back into view.
  - The legacy `settings.hiddenFields` shape is migrated automatically in `normalizeJournalFields()`.
- **Proxy Worker Queueing System** — ⚠️ **the queue already exists; do NOT rewrite it from scratch.**
  `proxy/index.js` already uses `p-queue` (`concurrency: 1`, serial execution to avoid GPU OOM),
  marks `status: 'processing'` when a slot frees, and retries Ollama up to 5 times with a
  `waiting_for_server` status between attempts. The remaining work is **closing the gaps**, notably:
  - **Client timeout vs. queue depth**: `callProxy` in `src/api/client.js` rejects after **120s**.
    Serial processing plus retries (up to ~20s of sleeps alone) blows past that with only a few
    queued requests. The queue and the timeout must be reconciled — this is the top issue.
  - **Orphaned `processing` docs**: the listener queries `status == 'pending'`, so a request left in
    `processing` by a worker crash is never retried and just hangs until the client times out.
  - **UTC date bug**: `checkAndIncrementUsage()` uses `new Date().toISOString().split('T')[0]`,
    which violates the project's timezone rule (local date only) — the daily counter rolls over at
    09:00 JST, not midnight.
  - **No limit is actually enforced**: `checkAndIncrementUsage` only counts up and never rejects, so
    the `"無料利用枠"` branch in the error handler is dead code. `remaining` is a count-up, not a
    remaining count, despite the field name.
  - **`ai_requests` is never cleaned up** — completed documents accumulate indefinitely.
