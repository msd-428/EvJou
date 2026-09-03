// LP素材・ストア用スクショのためのデモデータ生成スクリプト。
//
// 使い方:
//   node docs/gen-demo-data.mjs                 → 今日を基準に docs/demo-data.json を作り直す
//   node docs/gen-demo-data.mjs 2026-09-10      → 指定日を「今日」として作る
//
// できたJSONは、アプリの【設定 → インポート】から読み込む。
// ★ 撮影する日に合わせて作り直すこと。日付がずれると ToDo が「期限切れ」に見える。
// ★ 実在の人名・組織名は入れないこと（画像は公開LPに載る）。
// LP素材・QA用のデモデータを生成する。アプリの「設定 → インポート」で読み込める形式。
// 実在の人名・組織名は使わない。
import { writeFileSync } from "node:fs";
const argDate = process.argv[2] && /^\d{4}-\d{2}-\d{2}$/.test(process.argv[2]) ? process.argv[2] : null;
const now = new Date();
const TODAY = argDate || `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
const d = (s) => new Date(s + "T00:00:00");
const fmt = (dt) => `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
const shift = (s, n) => { const t = d(s); t.setDate(t.getDate()+n); return fmt(t); };
let seq = 0; const uid = () => `demo-${(++seq).toString().padStart(3,"0")}`;

const days = [
  ["朝いちで頭の中を全部出せた", "週次の議題を3つに絞る／見積りの確認／夕方に振り返り", "朝会の進め方を決める", "考えすぎる前に手を動かせた日。夜は早めに切り上げた"],
  ["差し込みが少なく集中できた", "提案資料の骨子をつくる／請求まわりの確認", "資料のレビューを依頼する", "午前に難しいものを置くと後が楽になる"],
  ["相談に来てくれた人がいた", "採用面談の準備／来期の数字をざっと出す", "面談のフィードバックをまとめる", "人の話を聞く日は自分の作業を詰め込みすぎない"],
  ["雨で予定が空いて助かった", "溜まっていた承認をまとめて片づける", "月次のまとめを書き始める", "承認待ちが減ると気持ちが軽い"],
  ["昼に散歩へ出られた", "月次のまとめを書く／来週の予定を組む", "まとめを共有する", "歩くと考えがほどける"],
  ["朝の時間を守れた", "共有会の資料をつくる／問い合わせの返信", "共有会を回す", "資料は完璧を狙わず、話す順番だけ決めた"],
  ["共有会がうまく回った", "議事のまとめ／宿題の割り振り", "宿題の進み具合を確認する", "決まったことより、決め方が整った感じがある"],
  ["体調が戻ってきた", "見積りの見直し／来月の段取り", "段取りを共有する", "無理をしなかったのが効いた"],
  ["朝の30分が定着してきた", "来月の段取りを詰める／棚卸し", "棚卸しの結果を整理する", "続けていると、書く量が自然に減ってきた"],
  ["手が空いた時間に本を読めた", "読んだ内容を要点にする／請求の締め", "要点を共有する", "インプットの時間を予定に置くとちゃんと取れる"],
  ["気温が下がって過ごしやすい", "四半期の振り返りを書く", "振り返りをもとに来期の柱を決める", "振り返りは朝にやると素直に書ける"],
  ["振り返りが思ったより進んだ", "来期の柱を3つに絞る／面談の日程調整", "柱について意見をもらう", "3つに絞ると迷いが減る"],
  ["意見をもらえて視点が増えた", "もらった意見を反映する／請求の確認", "反映した案をまとめる", "自分だけで決めきらないほうが早い"],
  ["朝から頭が軽い", "案をまとめる／午後は詰まっている件をほどく", "詰まっている件の次の一手を決める", "散らかっていた頭を先に出したのが良かった"],
];
const entries = {};
days.forEach((row, i) => {
  const date = shift(TODAY, i - (days.length - 1));
  entries[date] = { grateful: row[0], todayGoal: row[1], tomorrowGoal: row[2], memo: row[3] };
});

const goals = {
  bigGoal: "一年後、自分がいなくてもチームが回る状態をつくる",
  midGoal: "今期中に、週次の意思決定を仕組みに落とす",
  nearGoal: "今週は、朝の30分を思考の整理に固定する",
};

const mk = (text, dueDate, done, source = "ai-today") =>
  ({ id: uid(), text, done, source, createdAt: dueDate, dueDate });
const todos = [
  mk("週次の議題を3つに絞る", TODAY, true),
  mk("見積りの数字を確認する", TODAY, true),
  mk("提案資料の骨子をつくる", TODAY, false),
  mk("詰まっている件の次の一手を決める", TODAY, false),
  mk("夕方に今日の振り返りを書く", TODAY, false),
  mk("面談の日程を調整する", shift(TODAY, 1), false, "ai-tomorrow"),
  mk("反映した案をまとめる", shift(TODAY, 1), false, "ai-tomorrow"),
  { id: uid(), text: "読んだ本の要点をメモに残す", done: false, source: "manual", createdAt: TODAY, dueDate: null },
];

const routineDefs = [
  ["7時に起きる", { type: "daily" }],
  ["朝の30分で頭の中を書き出す", { type: "daily" }],
  ["寝る前に明日の3つを決める", { type: "daily" }],
  ["週に3回は歩く", { type: "weekly", days: [1, 3, 5] }],
];
const routines = { active: routineDefs.map(([text, schedule]) => ({ id: uid(), text, schedule })), done: [] };
// 直近14日のチェック。だいたい8割こなしている状態にする（達成率が自然に見える）
const routineChecks = {};
for (let i = 13; i >= 0; i--) {
  const date = shift(TODAY, -i);
  const marks = {};
  routines.active.forEach((r, idx) => { if ((i + idx) % 5 !== 0) marks[r.id] = true; });
  routineChecks[date] = marks;
}

const baseId = uid();
const baseList = [{
  id: baseId, name: "平日の型", note: "午前は考える仕事、午後は人と話す",
  blocks: [
    { time: "07:00", label: "起床・ストレッチ", note: "", fixed: true },
    { time: "07:30", label: "ダンプ（頭の整理）", note: "今日の3つを決める", fixed: true },
    { time: "09:00", label: "集中作業", note: "いちばん重いものから", fixed: false },
    { time: "12:00", label: "昼休み", note: "", fixed: true },
    { time: "13:00", label: "打ち合わせ・相談", note: "", fixed: false },
    { time: "17:00", label: "振り返り", note: "できたことを先に書く", fixed: true },
  ],
}];
const generatedScheds = {
  [TODAY]: [
    { time: "07:00", label: "起床・ストレッチ", note: "", fixed: true },
    { time: "07:30", label: "ダンプ（頭の整理）", note: "散らかった順に出す", fixed: true },
    { time: "09:00", label: "提案資料の骨子をつくる", note: "朝のうちに形にする", fixed: false },
    { time: "11:00", label: "見積りの数字を確認する", note: "", fixed: false },
    { time: "12:00", label: "昼休み", note: "", fixed: true },
    { time: "13:30", label: "詰まっている件をほどく", note: "人に聞く前提で", fixed: false },
    { time: "17:00", label: "夕方に今日の振り返りを書く", note: "", fixed: true },
  ],
};

const data = {
  version: 1,
  exportedAt: new Date(TODAY + "T08:00:00+09:00").toISOString(),
  entries, goals, todos, routines, routineChecks, baseList, activeBaseId: baseId, generatedScheds,
};
const out = new URL("./demo-data.json", import.meta.url);
writeFileSync(out, JSON.stringify(data, null, 2), "utf8");
console.log(`書き出しました: ${out.pathname}（今日 = ${TODAY}）`);
console.log(`  日記 ${Object.keys(entries).length}日分 / ToDo ${todos.length}件（完了${todos.filter(t=>t.done).length}） / ルーチン ${routines.active.length}件 / チェック ${Object.keys(routineChecks).length}日分`);
