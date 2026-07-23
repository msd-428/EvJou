import { useEffect } from "react";
import { useStorage } from "../storage/useStorage.js";
import { DEFAULT_SETTINGS } from "../constants.js";
import { DEFAULT_AI_CONFIG, applyAiConfig } from "../api/client.js";

// 設定ドメイン：アプリ動作設定(app-settings)とAI接続設定(ai-config)。
// 保存済みの部分設定は各デフォルトへマージして欠損キーを補う。
export function useSettings() {
  const [settings, setSettings] = useStorage("app-settings", DEFAULT_SETTINGS, st => ({ ...DEFAULT_SETTINGS, ...st }));
  const [aiCfg, setAiCfg] = useStorage("ai-config", DEFAULT_AI_CONFIG, cfg => ({ ...DEFAULT_AI_CONFIG, ...cfg }));

  // aiCfg が変わるたびにAIクライアントへ反映（ロード時・保存時の両方をカバー）
  useEffect(() => { applyAiConfig(aiCfg); }, [aiCfg]);

  const saveAiCfg = (next) => setAiCfg({ ...DEFAULT_AI_CONFIG, ...next });
  const saveSettings = (next) => setSettings({ ...DEFAULT_SETTINGS, ...next });

  return { settings, setSettings, aiCfg, setAiCfg, saveAiCfg, saveSettings };
}
