import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import fetch from 'node-fetch';
import PQueue from 'p-queue';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// ==========================================
// 0. 設定値
// ==========================================
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/v1/chat/completions';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 120000); // 1回の推論の上限（ハング対策）
const RETRY_MAX = 5;         // Ollama へのリトライ回数
const RETRY_WAIT_MS = 5000;  // リトライ間隔
const DAILY_LIMIT = Number(process.env.DAILY_LIMIT || 200); // 1日の利用上限（暴走対策の安全弁）
const KEEP_HOURS = Number(process.env.KEEP_HOURS || 24);    // 終了した文書の保持時間
const SWEEP_INTERVAL_MS = 30 * 60 * 1000;

// 非終端ステータス。ワーカー再起動時はこれらを pending に戻す。
const ACTIVE_STATUSES = ['queued', 'processing', 'waiting_for_server'];

// ==========================================
// 1. 初期設定 (Firebase Admin)
// ==========================================
const serviceAccountPath = './serviceAccountKey.json';
if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ serviceAccountKey.json が見つかりません。ワーカーを起動できません。');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
console.log('✅ Firebase Admin SDK initialized.');

const db = getFirestore();
const requests = db.collection('ai_requests');

// ==========================================
// 2. ユーティリティ
// ==========================================
// ローカルタイムゾーン基準の YYYY-MM-DD。
// toISOString() は UTC 基準のため使わない（プロジェクト規約）。JST 決め打ちのオフセット加算も
// ワーカーを別TZで動かした瞬間に壊れるので使わない。src/lib/date.js の toLocalDateStr と同一仕様
// （ワーカーは別プロセス・別依存ツリーなので実装は共有せず複製する）。
function toLocalDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function rateLimitError(limit) {
  const err = new Error(`本日の利用上限（${limit}回）に達しました。`);
  err.errorType = 'rate_limit';
  return err;
}

// ==========================================
// 3. 利用回数の計上
// ==========================================
// ローカルLLMでコストは掛からないので、上限は課金制限ではなく暴走・無限ループ対策の安全弁。
async function checkAndIncrementUsage(uid) {
  const today = toLocalDateStr();
  const userRef = db.collection('users').doc(uid);

  return await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(userRef);
    const data = doc.exists ? doc.data() : {};
    // 日付が変わっていれば 0 から数え直す
    const count = data.lastUsageDate === today ? (data.usageCount || 0) : 0;

    if (count >= DAILY_LIMIT) throw rateLimitError(DAILY_LIMIT);

    const newCount = count + 1;
    transaction.set(userRef, { usageCount: newCount, lastUsageDate: today }, { merge: true });
    return newCount;
  });
}

// ==========================================
// 4. キュー（GPU OOM 防止のため直列）
// ==========================================
const queue = new PQueue({ concurrency: 1 });

// 待機中の文書参照（投入順）。待ち順の表示と進捗ハートビートに使う。
const waiting = [];

// 待機中の全文書に現在の待ち順を書き戻す。
// クライアントはこの更新を「ワーカー生存」の合図として扱う。
// 滞留中に文書が無音にならないことがこの処理の主目的で、待ち順表示はその副産物。
// pending → queued への書き換えをトランザクションで行い、取れた場合だけ処理する。
// 単一ワーカー運用が前提だが、旧プロセスが残ったまま新プロセスを起動すると
// 両方が同じ文書を処理して推論と利用回数が二重に走るため、その一点だけを防ぐ。
async function claimRequest(docRef, position) {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (!snap.exists || snap.data().status !== 'pending') return false;
    tx.update(docRef, { status: 'queued', queuePosition: position });
    return true;
  });
}

async function refreshQueuePositions() {
  await Promise.all(
    waiting.map((ref, i) => ref.update({ status: 'queued', queuePosition: i + 1 }).catch(() => {}))
  );
}

// ==========================================
// 5. Ollama 呼び出し
// ==========================================
async function callOllama(docRef, reqData) {
  let lastError = null;

  for (let attempt = 1; attempt <= RETRY_MAX; attempt++) {
    if (attempt > 1) {
      // リトライ中も文書を更新し続ける＝クライアントへの生存通知を兼ねる
      await docRef.update({ status: 'waiting_for_server', attempt }).catch(() => {});
      console.log(`⏳ Ollamaリトライ待機中... (${attempt - 1}/${RETRY_MAX}): ReqID=${docRef.id}`);
      await sleep(RETRY_WAIT_MS);
    }

    try {
      // タイムアウト無しの fetch は Ollama がハングするとキュー全体を止めるため必須
      const res = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: reqData.messages,
          max_tokens: reqData.maxTokens,
          temperature: reqData.temperature,
          stream: false,
        }),
        signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
      });

      if (!res.ok) {
        lastError = new Error(`Ollama Error: ${res.status} ${res.statusText}`);
        continue;
      }
      const data = await res.json();
      return data?.choices?.[0]?.message?.content || '';
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError || new Error('Ollama 呼び出しに失敗しました。');
}

// ==========================================
// 6. 1リクエストの処理
// ==========================================
async function processRequest(docRef) {
  // 自分を待機列から外し、残りの待ち順を詰める
  const idx = waiting.indexOf(docRef);
  if (idx >= 0) waiting.splice(idx, 1);
  await refreshQueuePositions();

  // 順番が来るまでにクライアントが諦めている場合があるので読み直す
  const snap = await docRef.get();
  if (!snap.exists) return;
  const reqData = snap.data();
  if (reqData.status === 'cancelled') {
    console.log(`⏭ キャンセル済みのためスキップ: ReqID=${docRef.id}`);
    return;
  }

  console.log(`処理開始: ReqID=${docRef.id}, User=${reqData.uid}`);
  await docRef.update({ status: 'processing', queuePosition: 0 }).catch(console.error);

  try {
    const usageCount = await checkAndIncrementUsage(reqData.uid);
    const text = await callOllama(docRef, reqData);

    await docRef.update({
      status: 'completed',
      response: text,
      usageCount,
      dailyLimit: DAILY_LIMIT,
      processedAt: FieldValue.serverTimestamp(),
    });
    console.log(`✅ 処理完了: ReqID=${docRef.id} (本日 ${usageCount}/${DAILY_LIMIT} 回)`);
  } catch (error) {
    console.error(`❌ 処理エラー: ReqID=${docRef.id}`, error);
    const message = error?.message || String(error);
    // errorType は例外に持たせる。メッセージ文字列との照合は文言を変えた瞬間に壊れるため使わない。
    const errorType = error?.errorType
      || (/Ollama|fetch|abort|timed out|ECONNREFUSED/i.test(message) ? 'server_down' : 'generic');

    await docRef.update({
      status: 'error',
      error: message,
      errorType,
      processedAt: FieldValue.serverTimestamp(),
    }).catch(console.error);
  }
}

// ==========================================
// 7. 起動時の孤児復帰
// ==========================================
// ワーカーがクラッシュすると処理中の文書は非終端ステータスのまま取り残される。
// 監視クエリは status == 'pending' しか拾わないので、リスナー登録より前に戻しておく
// （後に実行するとリスナーが同じ文書を二重に投入する）。
async function recoverOrphans() {
  const snap = await requests.where('status', 'in', ACTIVE_STATUSES).get();
  if (snap.empty) return;

  const batch = db.batch();
  snap.docs.forEach((d) => batch.update(d.ref, { status: 'pending', queuePosition: 0 }));
  await batch.commit();
  console.log(`♻️ 孤児リクエストを復帰: ${snap.size}件`);
}

// ==========================================
// 8. 古い文書の掃除
// ==========================================
// 終端ステータス（completed / error / cancelled）の文書だけが processedAt を持つ。
// Firestore は該当フィールドを持たない文書を範囲クエリの対象外にするので、
// この1条件だけで未処理の文書を巻き込まずに済む（複合インデックスも不要）。
async function sweepOldRequests() {
  const cutoff = Timestamp.fromMillis(Date.now() - KEEP_HOURS * 60 * 60 * 1000);
  const snap = await requests.where('processedAt', '<', cutoff).limit(500).get();
  if (snap.empty) return;

  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  console.log(`🧹 古いリクエストを削除: ${snap.size}件`);
}

// ==========================================
// 9. 起動
// ==========================================
async function main() {
  await recoverOrphans();
  await sweepOldRequests().catch((e) => console.error('掃除エラー:', e));
  setInterval(() => sweepOldRequests().catch((e) => console.error('掃除エラー:', e)), SWEEP_INTERVAL_MS);

  console.log('👀 Firestore `ai_requests` コレクションの監視を開始します...');

  requests.where('status', '==', 'pending').onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type !== 'added') return;

      const docRef = change.doc.ref;
      // 受理をすぐ書き戻す。これが無いと滞留中の文書が無音になり、
      // クライアントから「PCが落ちている」と「順番待ち」の区別がつかない。
      waiting.push(docRef);
      claimRequest(docRef, waiting.length).then((claimed) => {
        if (claimed) {
          queue.add(() => processRequest(docRef));
          return;
        }
        console.log(`⏭ 他のワーカーが取得済み: ReqID=${docRef.id}`);
        const i = waiting.indexOf(docRef);
        if (i >= 0) waiting.splice(i, 1);
      }).catch(console.error);
    });
  }, (err) => {
    console.error(`監視エラー: ${err}`);
  });
}

main().catch((e) => {
  console.error('❌ ワーカーの起動に失敗しました:', e);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('ワーカーを停止します...');
  process.exit(0);
});
