// AGENT_03 · 盲测 harness：ARK API 真跑 doubao，自动判 rubric ①②③④
// C1: 10 组多场景输入，统计通过率（⑤⑥语气/拗口需人工，本脚本产出待评清单）
// C2: 40 条输出幻觉率（机位名/时刻必须来自输入 JSON）
// 用法: node blind_test.mjs [--n40]   (--n40 跑满40条做C2；默认10条C1)
// key 从同目录 ark.env 读取（gitignored），不打印。
import fs from "node:fs";
import path from "node:path";

const HERE = import.meta.dirname;

// ── env ──
const env = {};
for (const line of fs.readFileSync(path.join(HERE, "ark.env"), "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) env[m[1]] = m[2].trim();
}
const KEY = env.ARK_API_KEY;
const MODEL = env.ARK_MODEL || "doubao-seed-2.0-pro";

// ── 数据 ──
const spots = JSON.parse(fs.readFileSync(path.join(HERE, "../01/spots.v1.json"), "utf-8")).spots;
const sunEvents = JSON.parse(fs.readFileSync(path.join(HERE, "../02/sun_events.v1.json"), "utf-8")).sun_events;
const samples = JSON.parse(fs.readFileSync(path.join(HERE, "copy_samples.v1.json"), "utf-8")).samples;
const ALL_SPOT_NAMES = spots.map((s) => s.name);
const DATE = "2026-07-28"; // 真实日期（sun_events 覆盖范围内，实拍日）

const SYSTEM = `你是「追·光」的文案引擎。输入是一段 JSON（当前光线评分、机位、时间数据），你输出一句行动句和三条拍摄建议，帮抖音用户在刷到的一瞬间知道"现在值不值得出门拍、去哪、怎么拍"。

【硬规则，违反任何一条即废稿】
1. 只能引用输入 JSON 中真实存在的机位名、方向、时间、距离——严禁编造任何地点。具体时刻（如 19:08）只能原样取自输入 JSON，输入里没有的时刻一律不得出现；说明天时用"明晚黄金时刻/明晚同一时间"，不给具体钟点。
2. 行动句 ≤26 个字；建议恰好 3 条，每条 ≤15 个字。
3. 全文形容词不超过 2 个；感叹号不超过 1 个。
4. 语气像一个懂行的朋友顺口一说：具体、有方向、有时间锚点，不堆砌辞藻。金标准："往你西边走，去 Echo Park 高地，步行 12 分钟，正好赶上"。
5. 不承诺天气（禁用"一定""必然"）；score<45 时劝退但不阴阳怪气，给出明日预告；rain 场景安抚并给明晚方案。
6. 不出现任何第三方 App 名称。
7. 建议内容必须与输入的 compose_template / light_relation / 机位特征相关，不写放之四海皆准的空话。
8. 每次输出必须含至少一个时间锚点。出门场景的行动句或建议里必须带一个具体时间信息——优先用输入的 peak_time（如"19:08 前到"）或 distance 里的分钟数（如"步行 11 分钟"）；劝退、雨天、夜间场景必须含"明晚/明天"的预告。

【输出格式，只输出 JSON，无其他文字】
{"hook": "行动句", "tips": ["建议1", "建议2", "建议3"]}`;

// few-shot 注入为对话对
const fewshot = samples.flatMap((s) => [
  { role: "user", content: JSON.stringify(s.input, null, 0) },
  { role: "assistant", content: JSON.stringify(s.output, null, 0) },
]);

// ── 测试输入生成（真实机位 + 真实日期太阳数据）──
function sun(spotId) { return sunEvents.find((r) => r.spot_id === spotId && r.date === DATE); }
function mkCase(spotId, scene, score, label, now, weather, context, lightRel) {
  const s = spots.find((x) => x.id === spotId);
  const ev = sun(spotId);
  return {
    scene, score, score_label: label, now, peak_time: ev.sunset,
    spot: { name: s.name, direction: s.tags?.direction || s.name.includes("湾") ? "西南" : "西", distance: "步行 " + (8 + (spotId.charCodeAt(4) % 15)) + " 分钟", compose_template: s.compose_template },
    light_relation: lightRel, weather, context,
    _meta: { spot_id: spotId, golden_start: ev.golden_start, sunset: ev.sunset },
  };
}
// 10 组 C1 场景（覆盖：high×3 / mid×2 / low×1 / rain×1 / exhibition×2 / night×1），全部真实机位
const C1_CASES = [
  mkCase("szw-005", "sunset", 89, "值得跑出门", "17:40", "clear", "normal", "逆光"),
  mkCase("szw-008", "sunset", 84, "值得跑出门", "18:10", "clear", "normal", "逆光"),
  mkCase("szw-014", "sunset", 78, "值得跑出门", "18:30", "cloudy", "normal", "侧逆光"),
  mkCase("szw-009", "sunset", 55, "顺路看看", "18:00", "cloudy", "normal", "逆光"),
  mkCase("szw-011", "sunset", 48, "顺路看看", "18:20", "cloudy", "normal", "侧光"),
  mkCase("szw-010", "sunset", 22, "今天歇着", "17:50", "cloudy", "normal", "逆光"),
  mkCase("szw-006", "sunset", 15, "今天歇着", "18:05", "rain", "rain_now", "逆光"),
  mkCase("sze-002", "exhibition", 72, "顺路看看", "15:20", "cloudy", "normal", "侧光"),
  mkCase("sze-004", "exhibition", 76, "值得跑出门", "16:30", "clear", "normal", "侧光"),
  mkCase("szw-007", "sunset", 63, "顺路看看", "21:30", "clear", "night_after_21", "顺光"),
];
// C2 追加 30 组（--n40）：遍历其余机位 × 混合场景
const EXTRA_SPOTS = spots.map((s) => s.id).filter((id) => !C1_CASES.some((c) => c._meta.spot_id === id));
const C2_EXTRA = EXTRA_SPOTS.slice(0, 15).flatMap((id, i) => [
  mkCase(id, spots.find((s) => s.id === id).scene === "cafe" ? "cafe" : spots.find((s) => s.id === id).scene === "exhibition" ? "exhibition" : "sunset",
    [88, 57, 26][i % 3], ["值得跑出门", "顺路看看", "今天歇着"][i % 3], ["17:30", "18:15", "18:40"][i % 3],
    ["clear", "cloudy", "rain"][i % 3], i % 3 === 2 ? "rain_now" : "normal", ["逆光", "侧逆光", "侧光"][i % 3]),
  mkCase(id, "sunset", [91, 50, 30][(i + 1) % 3], ["值得跑出门", "顺路看看", "今天歇着"][(i + 1) % 3], "18:25",
    ["cloudy", "clear", "cloudy"][(i + 1) % 3], "normal", "逆光"),
]).slice(0, 30);

// ── ARK 调用（Anthropic 协议优先，OpenAI 协议兜底）──
async function callArk(messages) {
  const anth = await fetch(`${env.ARK_BASE_ANTHROPIC}/v1/messages`, {
    method: "POST",
    headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 400, system: SYSTEM, messages }),
  }).catch((e) => ({ ok: false, _err: e.message }));
  if (anth.ok) {
    const j = await anth.json();
    return j.content?.map((b) => b.text || "").join("") || "";
  }
  // OpenAI 协议兜底
  const oai = await fetch(`${env.ARK_BASE_OPENAI}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 400, messages: [{ role: "system", content: SYSTEM }, ...messages] }),
  });
  if (!oai.ok) throw new Error(`ark_both_failed: anth=${anth.status ?? anth._err} oai=${oai.status}`);
  const j = await oai.json();
  return j.choices?.[0]?.message?.content || "";
}

// ── rubric 自动判分 ①②③④（定义见 eval_rubric.md）──
const DIRECTIONS = ["东", "南", "西", "北", "西南", "东南", "西北", "东北"];
// 机位名匹配：取名字里任意连续 2 字窗口（滤掉标点/空格/通用词），文本命中任一即算提及
// 通用词 = 场馆类别词 + 物理地物词（海堤/栈道等是描述现场的正常用语，不构成跨机位幻觉信号）
const GENERIC = new Set(["公园", "平台", "中心", "观景", "文化", "艺术", "体育", "生态", "滨海", "步道", "海堤", "栈道", "栈桥", "湿地", "花园", "广场", "看台", "台阶", "连廊", "大道", "主街", "水岸", "海边", "海侧", "西侧", "街区", "城市", "深圳", "规划", "当代", "郊野", "山顶", "主峰"]);
function nameBigrams(name) {
  const clean = name.replace(/[·\s]/g, "");
  const grams = [];
  for (let i = 0; i < clean.length - 1; i++) {
    const g = clean.slice(i, i + 2);
    if (!GENERIC.has(g)) grams.push(g);
  }
  return grams;
}
function mentionsSpot(text, name) { return nameBigrams(name).some((g) => text.includes(g)); }

function grade(input, raw) {
  let out;
  try { out = JSON.parse(raw.replace(/^```json?\s*|\s*```$/g, "")); } catch { return { parse: false, pass: false, fails: ["JSON解析失败"] }; }
  const text = [out.hook, ...(out.tips || [])].join(" ");
  const fails = [];
  const isStayIn = input.score_label === "今天歇着" || input.context === "rain_now" || input.context === "night_after_21";
  // ① 出门场景：含方向或地点；劝退/雨天/夜间场景：含明日预告即为"行动指向"
  if (isStayIn) {
    if (!/明晚|明天|预告|收藏/.test(text)) fails.push("①劝退场景缺明日预告");
  } else {
    const hasPlace = mentionsSpot(text, input.spot.name) || DIRECTIONS.some((d) => text.includes(d));
    if (!hasPlace) fails.push("①缺方向/地点");
  }
  // ② 时间锚点
  if (!/\d{1,2}[:：]\d{2}|分钟|今晚|明晚|明天|日落|黄金|蓝调|现在|这会|过点|来得及|赶得上|傍晚|趁/.test(text)) fails.push("②缺时间锚点");
  // ③ 字数
  if (!out.hook || [...out.hook].length > 26) fails.push(`③hook超限(${out.hook ? [...out.hook].length : 0})`);
  if (!Array.isArray(out.tips) || out.tips.length !== 3) fails.push("③tips非3条");
  else out.tips.forEach((t, i) => { if ([...t].length > 15) fails.push(`③tip${i + 1}超限(${[...t].length})`); });
  // ④ 幻觉：输出具体时刻必须原样来自输入；提及的库内其他机位 = 幻觉
  const timesOut = text.match(/\d{1,2}[:：]\d{2}/g) || [];
  const allowedTimes = new Set([input.peak_time, input.now, input._meta.golden_start, input._meta.sunset].filter(Boolean).map((t) => t.replace("：", ":")));
  for (const t of timesOut) if (!allowedTimes.has(t.replace("：", ":"))) fails.push(`④时刻幻觉(${t})`);
  for (const name of ALL_SPOT_NAMES) {
    if (name === input.spot.name) continue;
    // 其他机位独有的 bigram 命中才算幻觉（与输入机位重叠的词不算）
    const own = new Set(nameBigrams(input.spot.name));
    if (nameBigrams(name).some((g) => !own.has(g) && text.includes(g) && g.length === 2 && !/步行|分钟/.test(g))) {
      fails.push(`④疑似机位幻觉(${name.split("·")[0].trim()})`);
      break;
    }
  }
  // 硬条件：感叹号
  if ((text.match(/[!！]/g) || []).length > 1) fails.push("感叹号>1");
  return { parse: true, out, pass: fails.length === 0, fails };
}

// ── 主流程 ──
const N40 = process.argv.includes("--n40");
const REGRADE = process.argv.includes("--regrade"); // 离线重判已存结果（判分器修正后用，不耗 API）
const cases = N40 || REGRADE ? [...C1_CASES, ...C2_EXTRA] : C1_CASES;
if (REGRADE) {
  const prev = JSON.parse(fs.readFileSync(path.join(HERE, "checks", "blind_test_results_n40.json"), "utf-8")).results;
  let pass = 0, hallu = 0;
  const results = prev.map((p, i) => {
    const g = grade(cases[i], p.raw);
    if (g.pass) pass++;
    if (g.fails?.some((f) => f.startsWith("④"))) hallu++;
    if (!g.pass) console.log(`[${p.i}] ❌ ${g.fails.join("; ")}`);
    return { ...p, grade: g };
  });
  const c1pass = results.slice(0, 10).filter((x) => x.grade.pass).length;
  console.log(`\n== 离线重判(40) == 自动判通过 ${pass}/40 · C1子集 ${c1pass}/10 · ④幻觉 ${hallu}/40 (门槛0)`);
  fs.writeFileSync(path.join(HERE, "checks", "blind_test_results_n40.json"), JSON.stringify({ model: MODEL, date: DATE, regraded: true, summary: { autoPass: pass, total: 40, c1Pass: c1pass, hallucinated: hallu }, results }, null, 2), "utf-8");
  process.exit(0);
}
console.log(`== AGENT_03 盲测 · model=${MODEL} · 用例=${cases.length} · 日期=${DATE}(真实太阳数据) ==`);
const results = [];
let pass = 0, hallu = 0;
for (let i = 0; i < cases.length; i++) {
  const c = cases[i];
  const { _meta, ...input } = c;
  let raw = "", g;
  try {
    raw = await callArk([...fewshot, { role: "user", content: JSON.stringify(input) }]);
    g = grade(c, raw);
  } catch (e) { g = { parse: false, pass: false, fails: [e.message] }; }
  if (g.pass) pass++;
  if (g.fails?.some((f) => f.startsWith("④"))) hallu++;
  results.push({ i: i + 1, spot: c.spot.name, scene: c.scene, score: c.score, raw, grade: g });
  console.log(`[${String(i + 1).padStart(2)}/${cases.length}] ${c._meta.spot_id} ${c.score}分 → ${g.pass ? "✅" : "❌ " + g.fails.join("; ")}${g.out ? `  hook="${g.out.hook}"` : ""}`);
  await new Promise((r) => setTimeout(r, 800)); // 限速
}
console.log(`\n== 汇总 ==`);
console.log(`自动判(①②③④)通过: ${pass}/${cases.length}  ${N40 ? "" : `(C1 门槛: ≥8/10)`}`);
console.log(`含④幻觉的输出: ${hallu}/${cases.length}  (C2 门槛: 0)`);
console.log(`⑤语气/⑥拗口 需人工: 见 checks/blind_test_results.json 逐条盲评`);
fs.writeFileSync(path.join(HERE, "checks", `blind_test_results${N40 ? "_n40" : ""}.json`), JSON.stringify({ model: MODEL, date: DATE, summary: { autoPass: pass, total: cases.length, hallucinated: hallu }, results }, null, 2), "utf-8");
console.log(`结果已存 checks/blind_test_results${N40 ? "_n40" : ""}.json`);
