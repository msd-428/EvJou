import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function run() {
  const docRef = await db.collection('ai_requests').add({
    uid: 'test-user',
    messages: [{role: 'user', content: 'こんにちは！AIサーバーテストです。10文字以内で返事して！'}],
    maxTokens: 50,
    temperature: 0.7,
    status: 'pending',
    createdAt: new Date()
  });
  console.log('✅ Sent request ' + docRef.id);
  process.exit(0);
}
run();
