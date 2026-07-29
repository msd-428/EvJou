// Firebase SDK の初期化と匿名認証。React に依存しない純粋ロジック。
// AI通信（callProxy）からのみ利用される。アプリ起動時には初期化しない（遅延実行）。

import { initializeApp, getApps } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase Web App の設定
// Firebaseコンソール → プロジェクトの設定 → 全般 → マイアプリ → ウェブアプリ
// ⚠️ apiKey は「Firebase の公開用 Web API キー」であり、秘密鍵ではない。
//    クライアント側コードに含めて問題ない（Firebase公式ドキュメント準拠）。
// TODO: Firebaseコンソールでウェブアプリを追加し、以下の値を差し替えてください。
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD83mTDDqYcvYg3YU3xIitJnTcBlnS7ukY",
authDomain: "evjou-efd9b.firebaseapp.com",
projectId: "evjou-efd9b",
storageBucket: "evjou-efd9b.firebasestorage.app",
messagingSenderId: "106710414710",
appId: "1:106710414710:web:63470d16d90d68c1337657"
};

let auth = null;
let db = null;

/** Firebase App の初期化（複数回呼んでも安全） */
function initFirebase() {
  if (getApps().length === 0) {
    const app = initializeApp(FIREBASE_CONFIG);
    auth = getAuth(app);
    db = getFirestore(app);
  } else if (!auth || !db) {
    auth = getAuth();
    db = getFirestore();
  }
  return { auth, db };
}

/**
 * 匿名ログインを保証する。未ログインなら signInAnonymously を実行。
 * 既にログイン済みならキャッシュされた currentUser を返す。
 * @returns {Promise<import("firebase/auth").User>}
 */
export async function ensureAuth() {
  const { auth: a } = initFirebase();
  if (!a.currentUser) {
    await signInAnonymously(a);
  }
  return a.currentUser;
}

export function getDb() {
  const { db } = initFirebase();
  return db;
}

/**
 * Firebase ID トークンを取得する。
 * getIdToken(false) はキャッシュ済みトークンが有効ならそのまま返し、
 * 期限切れ（1時間）の場合のみ自動リフレッシュする。
 * @returns {Promise<string>}
 */
export async function getAuthToken() {
  const user = await ensureAuth();
  return user.getIdToken(false);
}
