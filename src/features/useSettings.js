import { useEffect } from "react";
import { useStorage } from "../storage/useStorage.js";
import { DEFAULT_SETTINGS } from "../constants.js";
import { normalizeJournalFields } from "../lib/domain.js";
import { DEFAULT_AI_CONFIG, applyAiConfig } from "../api/client.js";

// 設定ドメイン：アプリ動作設定(app-settings)とAI接続設定(ai-config)。
// 保存済みの部分設定は各デフォルトへマージして欠損キーを補う。
// journalFields は常に正規化して配る（利用側は不正な定義を考えなくてよい）。
const mergeSettings = (st) => {
  const merged = { ...DEFAULT_SETTINGS, ...st };
  merged.journalFields = normalizeJournalFields(st?.journalFields, st?.hiddenFields);
  delete merged.hiddenFields;  // 旧形式。normalizeJournalFields が移行済み
  return merged;
};

const INITIAL_SETTINGS = mergeSettings(null);

export function useSettings() {
  const [settings, setSettings] = useStorage("app-settings", INITIAL_SETTINGS, mergeSettings);
  const [aiCfg, setAiCfg] = useStorage("ai-config", DEFAULT_AI_CONFIG, cfg => ({ ...DEFAULT_AI_CONFIG, ...cfg }));

  // aiCfg が変わるたびにAIクライアントへ反映（ロード時・保存時の両方をカバー）
  useEffect(() => { applyAiConfig(aiCfg); }, [aiCfg]);

  const saveAiCfg = (next) => setAiCfg({ ...DEFAULT_AI_CONFIG, ...next });
  const saveSettings = (next) => setSettings(mergeSettings(next));

  return { settings, setSettings, aiCfg, setAiCfg, saveAiCfg, saveSettings };
}
