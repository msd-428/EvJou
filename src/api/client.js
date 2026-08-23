// AI通信クライアント。3モード分岐: proxy（EvJou AI） / local（ローカルLLM） / cloud（BYOK）。
//
// ver 1.1: callClaude → callAI に改名。callProxy 追加（Firebase匿名認証 + プロキシ経由）。
// 戻り値を { text, usageCount?, dailyLimit? } オブジェクトに統一。

import { ensureAuth, getDb } from "../lib/firebase.js";
import { collection, addDoc, onSnapshot, serverTimestamp, updateDoc, doc } from "firebase/firestore";

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

// 分析系（傾向・目標）のシステムプロンプト。
//
// この2つは PERSONAS を渡さない（上のコメントのとおり、分析はフラットに保つのが仕様。
// 設定画面にも「AIチャットの口調のみ変わります（傾向・目標の分析はフラットなまま）」と出る）。
// その結果システムプロンプトが丸ごと空になっており、既定モデル qwen2.5 が
// 中国語で返してくる事故が実機で起きた（2026-08-23 / OPPO Reno A・docs/DEVICE_QA.md §5-3）。
// チャットだけ無事だったのは PERSONAS の tone が日本語で、言語が結果的に固定されていたため。
//
// **ここに口調や分析方針を足さないこと。** 足すと上の仕様に反する。言語指定だけを持たせる。
export const ANALYSIS_SYSTEM = "出力は必ず日本語で記述してください。";

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

// 同意ダイアログの出し方と同意の永続化はUI層の責務なので、ここでは「同意を取る手段」だけを預かる。
// 未登録なら同意なしとして扱う（＝黙って送信することはない）。
// handler は Promise<boolean> または boolean を返す。
let proxyConsentHandler = null;
export const setProxyConsentHandler = (fn) => { proxyConsentHandler = fn; };

// ── エラーヘルパー ──
// type: "rate_limit" | "server_down" | "auth" | "network" | "generic"
function aiError(message, type = "generic") {
  const err = new Error(message);
  err.type = type;
  return err;
}

// ── proxy: EvJou AI（Firestore経由のバケツリレー） ──
//
// 締切は「経過時間」ではなく「進捗が途絶えた時間」で測る。
// ワーカーは受理直後に status を pending → queued へ書き換え、以後もジョブが1件片づくたびに
// queuePosition を更新するので、生きている限り文書は必ず動く。
// よって「pending のまま無応答＝ワーカー不在」が確定でき、
// 単純に制限時間を延ばした場合の副作用（PC停止時に長時間待たされる）を避けられる。
const PROXY_ACK_MS = 60000;       // 受理されない＝ワーカー不在とみなす
const PROXY_PROGRESS_MS = 180000; // 受理後、文書の更新が途絶えたとみなす
const PROXY_MAX_MS = 600000;      // 何があっても待ち続けない絶対上限

// 日記本文が開発者のサーバーへ出ていく入口はこの callProxy 1箇所だけなので、
// 同意の確認もここへ集約する。UI各所（チャット・傾向・ダンプ整理・ToDo抽出・予定生成）に
// 撒く方式では、呼び出し経路が増えるたびに必ず抜けが出る。
async function ensureProxyConsent() {
  if (aiConfig.proxyConsent) return;
  const granted = proxyConsentHandler ? await proxyConsentHandler() : false;
  if (!granted) throw aiError("EvJou AIの利用には同意が必要です。", "consent");
  // 同意直後の連続呼び出しで二重に聞かないよう、ここでも即座に反映する
  // （UI側の保存 → applyAiConfig は非同期なので間に合わないことがある）。
  aiConfig = { ...aiConfig, proxyConsent: true };
}

async function callProxy(messages, system, maxTokens, onStatusChange) {
  await ensureProxyConsent();
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
    const startedAt = Date.now();
    let acked = false;   // ワーカーが受理を書き戻したか
    let settled = false;
    let timer = null;
    let unsubscribe = null;

    const stop = () => { settled = true; clearTimeout(timer); unsubscribe?.(); };

    const finish = (err, value) => {
      if (settled) return;
      stop();
      if (err) reject(err); else resolve(value);
    };

    // 打ち切り時は文書に cancelled を書く。放置すると順番が来た時に
    // 誰も待っていない結果のためにGPUを回すことになり、渋滞を悪化させる。
    const abandon = () => {
      if (settled) return;
      stop();
      // 失敗しても待機の打ち切り自体は成立するので握り潰す（ワーカーが無駄に1件処理するだけ）。
      // ただし原因はほぼ Firestore ルールの update 不許可なので、切り分けのために警告は残す。
      updateDoc(doc(db, "ai_requests", reqRef.id), {
        status: "cancelled",
        processedAt: serverTimestamp(),
      }).catch((e) => console.warn("[EvJou] リクエストのキャンセル書き込みに失敗:", e?.code || e));
      reject(aiError(
        acked
          ? "AIサーバーの応答が途絶えました。時間をおいて試してください。"
          : "AIサーバーが応答しません。自宅PCが起動しているか確認してください。",
        "server_down"
      ));
    };

    const arm = (ms) => {
      clearTimeout(timer);
      const left = PROXY_MAX_MS - (Date.now() - startedAt);
      timer = setTimeout(abandon, Math.max(0, Math.min(ms, left)));
    };
    arm(PROXY_ACK_MS);

    unsubscribe = onSnapshot(doc(db, "ai_requests", reqRef.id), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();

      if (data.status === "completed") {
        finish(null, {
          text: data.response || "",
          usageCount: data.usageCount != null ? data.usageCount : null,
          dailyLimit: data.dailyLimit != null ? data.dailyLimit : null,
        });
      } else if (data.status === "error") {
        finish(aiError(data.error || "AIサーバーエラーが発生しました。", data.errorType || "generic"));
      } else if (data.status !== "cancelled") {
        // pending / queued / processing / waiting_for_server
        // pending のうちは受理待ちなので締切を延ばさない（延ばすとワーカー不在を検知できない）
        if (data.status !== "pending") {
          acked = true;
          arm(PROXY_PROGRESS_MS);
        }
        onStatusChange?.(data.status, data.queuePosition || 0);
      }
    }, () => {
      finish(aiError("データベースの監視に失敗しました。", "network"));
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
// 戻り値: { text: string, usageCount?: number, dailyLimit?: number }
// onStatusChange(status, queuePosition) は proxy モードのみ呼ばれる。
export async function callAI(messages, system, maxTokens = 1200, onStatusChange = null) {
  if (aiConfig.mode === "proxy") return callProxy(messages, system, maxTokens, onStatusChange);
  const text = aiConfig.mode === "local"
    ? await callLocal(messages, system, maxTokens)
    : await callCloud(messages, system, maxTokens);
  return { text };
}
