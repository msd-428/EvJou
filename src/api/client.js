// AI通信クライアント。3モード分岐: proxy（EvJou AI） / local（ローカルLLM） / cloud（BYOK）。
//
// ver 1.1: callClaude → callAI に改名。callProxy 追加（Firebase匿名認証 + プロキシ経由）。
// 戻り値を { text, remaining? } オブジェクトに統一。

import { ensureAuth, getDb } from "../lib/firebase.js";
import { collection, addDoc, onSnapshot, serverTimestamp, doc } from "firebase/firestore";

// AIチャットの人格（チャットのみに適用。分析系はフラットに保つ）
export const PERSONAS = {
  spartan: {
    label: "🔥 スパルタ",
    tone: "あなたは容赦のないスパルタコーチだ。慰め・お世辞・過度な共感はしない。甘えを許さず、失敗や不調は生理学的・物理学的な原因まで踏み込んで指摘し、翌日の対策は摩擦ゼロの物理動線で命じる。精神論は禁止。ただし人格否定や罵倒はせず、事実と機序で厳しく詰める。",
  },
  normal: {
    label: "🙂 ノーマル",
    tone: "あなたは温かく建設的なアシスタントだ。フラットな距離感で寄り添いつつ、現実的な助言を簡潔に返す。",
  },
  lover: {
    label: "💕 恋人",
    tone: "あなたは相手を大切に思う恋人だ。親密で甘い口調で寄り添い、優しく励ます。必要な助言はさりげなく織り込む。",
  },
};

// AI接続設定。App側でロード時に applyAiConfig で上書きする。
export const DEFAULT_AI_CONFIG = {
  mode: "proxy",                                // "proxy"(=EvJou AI) | "local" | "cloud"(=BYOK)
  localEndpoint: "http://localhost:11434/v1",   // Ollama/LM Studio/llama.cpp 等のOpenAI互換
  localModel: "qwen2.5",
  cloudModel: "claude-sonnet-5",
  apiKey: "",                                   // BYOK: ユーザ自身のAPIキー（端末内保存）
  temperature: 0.7,                             // 生成の温度
  persona: "spartan",                           // チャットの人格（既定スパルタ）
  proxyConsent: false,                          // EvJou AI 初回同意フラグ
};

let aiConfig = { ...DEFAULT_AI_CONFIG };
export const applyAiConfig = (cfg) => { aiConfig = { ...DEFAULT_AI_CONFIG, ...cfg }; };
export const getAiConfig = () => aiConfig;

// ── エラーヘルパー ──
// type: "rate_limit" | "server_down" | "auth" | "network" | "generic"
function aiError(message, type = "generic") {
  const err = new Error(message);
  err.type = type;
  return err;
}

// ── proxy: EvJou AI（Firestore経由のバケツリレー） ──
async function callProxy(messages, system, maxTokens, onStatusChange) {
  const user = await ensureAuth();
  const db = getDb();
  const msgs = system ? [{ role: "system", content: system }, ...messages] : messages;

  let reqRef;
  try {
    reqRef = await addDoc(collection(db, "ai_requests"), {
      uid: user.uid,
      messages: msgs,
      maxTokens,
      temperature: aiConfig.temperature,
      status: "pending",
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    throw aiError("通信エラー。インターネット接続を確認してください。", "network");
  }

  return new Promise((resolve, reject) => {
    // タイムアウト設定（2分）: ワーカー(PC)が起動していない場合などのフェイルセーフ
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(aiError("AIサーバーからの応答がタイムアウトしました。自宅PCが起動しているか確認してください。", "server_down"));
    }, 120000);

    const unsubscribe = onSnapshot(doc(db, "ai_requests", reqRef.id), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      
      if (data.status === "pending" || data.status === "processing" || data.status === "waiting_for_server") {
        onStatusChange?.(data.status);
      } else if (data.status === "completed") {
        clearTimeout(timeout);
        unsubscribe();
        resolve({
          text: data.response || "",
          remaining: data.remaining != null ? data.remaining : null,
        });
      } else if (data.status === "error") {
        clearTimeout(timeout);
        unsubscribe();
        reject(aiError(data.error || "AIサーバーエラーが発生しました。", data.errorType || "generic"));
      }
    }, (error) => {
      clearTimeout(timeout);
      unsubscribe();
      reject(aiError("データベースの監視に失敗しました。", "network"));
    });
  });
}

// ── local: OpenAI互換 /chat/completions ──
async function callLocal(messages, system, maxTokens) {
  const msgs = system ? [{ role: "system", content: system }, ...messages] : messages;
  const url = aiConfig.localEndpoint.replace(/\/$/, "") + "/chat/completions";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: aiConfig.localModel, messages: msgs, max_tokens: maxTokens, temperature: aiConfig.temperature, stream: false }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ローカルLLM接続エラー (${res.status})。エンドポイント/モデル名/CORS設定を確認してください。${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

// ── cloud: Anthropic Messages（BYOK） ──
async function callCloud(messages, system, maxTokens) {
  const body = { model: aiConfig.cloudModel, max_tokens: maxTokens, messages };
  if (system) body.system = system;
  const headers = { "Content-Type": "application/json", "anthropic-version": "2023-06-01" };
  if (aiConfig.apiKey) headers["x-api-key"] = aiConfig.apiKey;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`クラウドAPIエラー (${res.status})。${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.content || []).map(b => b.text || "").join("");
}

// ── 統一エントリポイント ──
// 戻り値: { text: string, remaining?: number }
export async function callAI(messages, system, maxTokens = 1200, onStatusChange = null) {
  if (aiConfig.mode === "proxy") return callProxy(messages, system, maxTokens, onStatusChange);
  const text = aiConfig.mode === "local"
    ? await callLocal(messages, system, maxTokens)
    : await callCloud(messages, system, maxTokens);
  return { text };
}
