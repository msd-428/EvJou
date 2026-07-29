import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fetch from 'node-fetch';
import PQueue from 'p-queue';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// ==========================================
// 1. 初期設定 (Firebase Admin)
// ==========================================
const serviceAccountPath = './serviceAccountKey.json';
if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ serviceAccountKey.json が見つかりません。ワーカーを起動できません。');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
initializeApp({
  credential: cert(serviceAccount)
});
console.log('✅ Firebase Admin SDK initialized.');

const db = getFirestore();

// ==========================================
// 2. キューイング設定 (PCのパンク防止)
// ==========================================
// 同時実行数を1に設定（GPU 12GBのOOM防止のため直列処理）
const queue = new PQueue({ concurrency: 1 });

// ==========================================
// 3. レートリミット管理関数
// ==========================================
async function checkAndIncrementUsage(uid) {
  // JST日付を取得 (YYYY-MM-DD)
  const jstDate = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const today = jstDate.toISOString().split('T')[0];
  const userRef = db.collection('users').doc(uid);
  const limit = 50; // 1日の上限
  
  return await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(userRef);
    let data = doc.exists ? doc.data() : { plan: 'free', usageCount: 0, lastUsageDate: today };

    if (data.lastUsageDate !== today) {
      data.usageCount = 0;
      data.lastUsageDate = today;
    }

    const newCount = data.usageCount + 1;
    if (newCount > limit) {
      throw new Error(`無料利用枠の上限（1日${limit}回）に達しました。`);
    }

    transaction.set(userRef, { ...data, usageCount: newCount }, { merge: true });
    
    return limit - newCount;
  });
}

// ==========================================
// 4. 起動時のクリーンアップ・孤児リクエスト救済
// ==========================================
async function rescueOrphanedRequests() {
  const orphaned = await db.collection('ai_requests').where('status', 'in', ['processing', 'waiting_for_server']).get();
  if (!orphaned.empty) {
    const batch = db.batch();
    orphaned.forEach(doc => {
      console.log(`♻️ 孤児リクエストを救済: ${doc.id}`);
      batch.update(doc.ref, { status: 'pending' });
    });
    await batch.commit();
  }
}

async function cleanupOldRequests() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const oldDocs = await db.collection('ai_requests')
    .where('status', 'in', ['completed', 'error'])
    .where('createdAt', '<', oneHourAgo)
    .get();
  if (!oldDocs.empty) {
    const batch = db.batch();
    oldDocs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    console.log(`🧹 古いリクエスト ${oldDocs.size}件を削除しました`);
  }
}

await rescueOrphanedRequests();
await cleanupOldRequests();

// ==========================================
// 5. Firestore 監視 (ワーカーロジック)
// ==========================================
console.log('👀 Firestore `ai_requests` コレクションの監視を開始します...');

db.collection('ai_requests')
  .where('status', '==', 'pending')
  .onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      // 新規追加された pending リクエストのみ処理する
      if (change.type === 'added') {
        const doc = change.doc;
        const reqData = doc.data();
        
        // キューの滞留をチェックして直ちにリジェクト
        if (queue.size + queue.pending > 3) {
          console.log(`⚠️ キュー満杯のため拒否: ReqID=${doc.id}`);
          doc.ref.update({
            status: 'error',
            error: '現在サーバーが混み合っています。少し待ってから再度お試しください。',
            errorType: 'rate_limit',
            processedAt: FieldValue.serverTimestamp()
          }).catch(console.error);
          return;
        }

        // キューに追加
        queue.add(async () => {
          console.log(`[${new Date().toISOString()}] 処理開始: ReqID=${doc.id}, User=${reqData.uid}`);
          
          // 処理開始マークをつける
          await doc.ref.update({ status: 'processing' }).catch(console.error);

          try {
            // 1. レートリミット確認＆消費
            const usageCount = await checkAndIncrementUsage(reqData.uid);

            // 2. Ollama 呼び出し（最大5回リトライ）
            const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/v1/chat/completions';
            let response = null;
            let lastError = null;

            for (let attempt = 1; attempt <= 5; attempt++) {
              try {
                if (attempt > 1) {
                  await doc.ref.update({ status: 'waiting_for_server' }).catch(console.error);
                  console.log(`⏳ Ollamaリトライ待機中... (${attempt - 1}/5): ReqID=${doc.id}`);
                  await new Promise(resolve => setTimeout(resolve, 5000));
                }

                response = await fetch(OLLAMA_URL, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    model: 'qwen2.5:7b',
                    messages: reqData.messages,
                    max_tokens: reqData.maxTokens,
                    temperature: reqData.temperature,
                    stream: false,
                  })
                });

                if (response.ok) {
                  lastError = null;
                  break;
                } else {
                  lastError = new Error(`Ollama Error: ${response.statusText}`);
                }
              } catch (e) {
                lastError = e;
              }
            }

            if (lastError) {
              throw lastError;
            }

            const data = await response.json();
            const text = data?.choices?.[0]?.message?.content || "";

            // 3. 結果を Firestore に書き戻す
            await doc.ref.update({
              status: 'completed',
              response: text,
              remaining: usageCount,
              processedAt: FieldValue.serverTimestamp()
            });

            console.log(`✅ 処理完了: ReqID=${doc.id} (累計: ${usageCount}回)`);

          } catch (error) {
            console.error(`❌ 処理エラー: ReqID=${doc.id}`, error);
            
            let errorType = "generic";
            if (error.message.includes("無料利用枠")) {
              errorType = "rate_limit";
            } else if (error.message.includes("Ollama") || error.message.includes("fetch")) {
              errorType = "server_down";
            }

            await doc.ref.update({
              status: 'error',
              error: error.message,
              errorType: errorType,
              processedAt: FieldValue.serverTimestamp()
            }).catch(console.error);
          }
        });
      }
    });
  }, (err) => {
    console.error(`監視エラー: ${err}`);
  });

// 強制終了時のクリーンアップ処理
process.on('SIGINT', () => {
  console.log('ワーカーを停止します...');
  process.exit(0);
});
