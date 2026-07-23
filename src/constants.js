// アプリ全体で共有する定数・デフォルト値。

export const JOURNAL_FIELDS = [
  { key: "grateful",     label: "🙏 今日ありがたいこと", placeholder: "今日感謝していることは？",         rows: 3 },
  { key: "todayGoal",    label: "✅ 今日の目標",        placeholder: "今日やること・達成したいことは？", rows: 3 },
  { key: "tomorrowGoal", label: "🔜 明日の目標",        placeholder: "明日やること・達成したいことは？", rows: 3 },
  { key: "memo",         label: "💬 ひとこと",          placeholder: "その他メモ・気持ち・雑多な情報",   rows: 2 },
];

export const BLOCK_COLORS = ["#6c63ff","#38a169","#d97706","#e53e3e","#3182ce","#805ad5","#dd6b20","#2b6cb0","#276749"];

// 仕様書のパレットを集約（DRY＋将来のテーマ対応）
export const COLORS = {
  primary:    "#6c63ff",  // 紫
  primaryBg:  "#f0eeff",
  success:    "#38a169",  // 緑（成功・大目標）
  successBg:  "#f0fff4",
  warn:       "#d97706",  // オレンジ（警告・固定・中目標）
  warnBg:     "#fff7e6",
  danger:     "#e53e3e",  // 赤（削除・期限切れ）
  dangerBg:   "#fff0f0",
  text:       "#3a3a3a",
  textSub:    "#888",
  border:     "#e0dcd5",
  bg:         "#f8f5f0",  // 暖色系ベース
  white:      "#fff",
};

export const MAIN_TABS     = [["write","✏️ 記録"], ["schedule","📅 予定"], ["todo","✅ ToDo"], ["routine","🔁 ルーチン"], ["ai","🤖 AI"]];
export const ROUTINE_TABS  = [["check","📝 チェック"], ["stats","📊 達成率"], ["active","🔄 導入中"], ["done","✅ 導入済"]];
export const AI_SUB_TABS   = [["chat","💬 チャット"], ["trend","📈 傾向"], ["goals","🎯 目標"], ["history","🗂 履歴"]];

export const GROUP_META = {
  overdue:  { label: "⚠️ 期限切れ", color: "#e53e3e", bg: "#fff0f0" },
  today:    { label: "🔥 今日",     color: "#d97706", bg: "#fff7e6" },
  tomorrow: { label: "📅 明日",     color: "#3182ce", bg: "#ebf8ff" },
  thisWeek: { label: "📆 今週",     color: "#6c63ff", bg: "#f0eeff" },
  future:   { label: "🔮 未来",     color: "#805ad5", bg: "#faf5ff" },
  none:     { label: "📋 期限未設定", color: "#888",  bg: "#fafafa" },
};

export const SOURCE_META = {
  "manual":       { label: "手動",       color: "#888" },
  "ai-today":     { label: "今日の目標", color: "#38a169" },
  "ai-tomorrow":  { label: "明日の目標", color: "#6c63ff" },
};

export const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export const LIMITS = {
  ENTRIES_DAYS: 730,
  DONE_TODOS: 100,
  ROUTINE_CHECK_DAYS: 365,
};

// アプリ動作設定のデフォルト（設定画面で変更可）
export const DEFAULT_SETTINGS = {
  appTitle: "毎日のジャーナル",   // ヘッダーのタイトル
  appSubtitle: "目標・感謝・振り返りを毎日記録しよう",
  defaultTab: "write",          // 起動時に開くタブ
  startDateMode: "today",       // "today" | "last" 起動時の日付
  showDumpMode: true,           // ダンプモードを表示するか
  toastSeconds: 5,              // 保存トーストの表示秒数
  hiddenFields: [],             // 非表示にするジャーナルフィールドのkey配列
  autoExtractOnDump: true,      // ダンプ整理後にToDo自動抽出
  autoExtractOnSave: true,      // 日記保存時にToDo自動抽出
  limitEntriesDays: 730,        // 日記保持日数
  limitDoneTodos: 100,          // 完了ToDo上限
  limitRoutineCheckDays: 365,   // ルーチンチェック保持日数
  limitRoutinePerTab: 25,       // ルーチン1タブの上限
  statsShortDays: 7,            // 達成率グラフ短期集計日数
  statsLongDays: 30,            // 達成率グラフ長期集計日数
};

export const DEFAULT_BASE_BLOCKS = [
  { time:"06:00", label:"起床・朝の準備", fixed: true  },
  { time:"07:00", label:"朝食",           fixed: true  },
  { time:"08:00", label:"作業・仕事開始", fixed: false },
  { time:"12:00", label:"昼食・休憩",     fixed: true  },
  { time:"13:00", label:"午後の作業",     fixed: false },
  { time:"18:00", label:"夕食・休憩",     fixed: true  },
  { time:"19:00", label:"自由時間・趣味", fixed: false },
  { time:"22:00", label:"就寝準備",       fixed: true  },
  { time:"23:00", label:"就寝",           fixed: true  },
];
