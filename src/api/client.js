// AI通信クライアント。ローカルLLM（OpenAI互換）とクラウド（Anthropic）をモードで分岐。
//
// ⚠️ 配布時の注意：callCloud は Anthropic API をブラウザから直叩きしている。
// アーティファクト環境ではキーが自動注入されていたが、通常環境では認証が通らない。
// 配布向けのAI推論経路（BYOK / オンデバイス小型LLM）は未決着の最大論点。

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

// AI接続設定（ローカルLLM or クラウド）。App側でロード時に applyAiConfig で上書きする。
export const DEFAULT_AI_CONFIG = {
  mode: "local",                              // "local" | "cloud"(=BYOK)
  localEndpoint: "http://localhost:11434/v1", // Ollama/LM Studio/llama.cpp 等のOpenAI互換
  localModel: "qwen2.5",
  cloudModel: "claude-sonnet-5",
  apiKey: "",                                 // BYOK: ユーザ自身のAPIキー（端末内保存）
  temperature: 0.7,                           // ローカル生成の温度
  persona: "spartan",                         // チャットの人格（既定スパルタ）
};

let aiConfig = { ...DEFAULT_AI_CONFIG };
export const applyAiConfig = (cfg) => { aiConfig = { ...DEFAULT_AI_CONFIG, ...cfg }; };
export const getAiConfig = () => aiConfig;

// ローカル：OpenAI互換 /chat/completions
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

// クラウド：Anthropic Messages
// NOTE(BYOK): aiConfig.apiKey は設定画面で保存済み。実機で認証検証できる環境が整ったら
// ここで x-api-key ヘッダへ配線する（現段階では通信ロジックには手を入れない）。
async function callCloud(messages, system, maxTokens) {
  const body = { model: aiConfig.cloudModel, max_tokens: maxTokens, messages };
  if (system) body.system = system;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`クラウドAPIエラー (${res.status})。${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.content || []).map(b => b.text || "").join("");
}

export async function callClaude(messages, system, maxTokens = 1200) {
  return aiConfig.mode === "local"
    ? callLocal(messages, system, maxTokens)
    : callCloud(messages, system, maxTokens);
}
