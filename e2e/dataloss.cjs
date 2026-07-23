// 手入力の消失防止（アプリの生命線）の実機ブラウザ回帰テスト。
//   1) 800ms debounce 自動保存 → リロード復元
//   2) 日付切替時のフラッシュ保存 → 戻ると復元
//   3) 自動保存前(<800ms)のリロード → beforeunload 同期保存で復元
//
// 実行:  npm run test:dataloss   （ビルド済み dist を preview で配信して検証）
//
// ブラウザ解決について：
//   通常環境では `npx playwright install chromium` 後、そのまま動く。
//   ブラウザが別管理の環境では、環境変数 PLAYWRIGHT_CHROMIUM に
//   Chromium 実行ファイルのパスを渡すと executablePath として使う。
const { spawn } = require("node:child_process");
const { chromium } = require("playwright");

const PORT = 4173;
const URL = `http://localhost:${PORT}`;
const FIELD = 'textarea[placeholder="今日感謝していることは？"]';
const DATE = 'input[type="date"]';
const EXEC = process.env.PLAYWRIGHT_CHROMIUM || undefined;

function startPreview() {
  const p = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { stdio: "ignore" });
  return p;
}

async function waitForServer(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(URL);
      if (res.ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error("preview server did not start in time");
}

async function fresh(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  return { ctx, page };
}

async function run() {
  const browser = await chromium.launch({ executablePath: EXEC });
  const results = [];

  // 1) 自動保存(800ms) → リロード復元
  {
    const { ctx, page } = await fresh(browser);
    const text = "感謝_autosave_" + Date.now();
    await page.fill(FIELD, text);
    await page.waitForTimeout(1100);
    await page.reload({ waitUntil: "networkidle" });
    results.push(["autosave→reload", (await page.inputValue(FIELD)) === text]);
    await ctx.close();
  }

  // 2) 日付切替フラッシュ → 戻ると復元
  {
    const { ctx, page } = await fresh(browser);
    const text = "感謝_dateflush_" + Date.now();
    const today = await page.inputValue(DATE);
    await page.fill(FIELD, text);
    await page.fill(DATE, "2020-01-01");
    await page.waitForTimeout(100);
    await page.fill(DATE, today);
    await page.waitForTimeout(200);
    results.push(["dateswitch flush", (await page.inputValue(FIELD)) === text]);
    await ctx.close();
  }

  // 3) 自動保存前のリロード → beforeunload 同期保存で復元
  {
    const { ctx, page } = await fresh(browser);
    const text = "感謝_beforeunload_" + Date.now();
    await page.fill(FIELD, text);
    await page.reload({ waitUntil: "networkidle" });
    results.push(["beforeunload save", (await page.inputValue(FIELD)) === text]);
    await ctx.close();
  }

  await browser.close();
  let ok = true;
  for (const [name, pass] of results) {
    console.log(`${pass ? "PASS" : "FAIL"}  ${name}`);
    if (!pass) ok = false;
  }
  return ok;
}

(async () => {
  const server = startPreview();
  let ok = false;
  try {
    await waitForServer();
    ok = await run();
  } finally {
    server.kill();
  }
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
