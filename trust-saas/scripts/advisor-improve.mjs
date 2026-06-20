/* ================================================================
   상담 자가고도화 루프 — [분석] 단계
   advisor-logs/*.jsonl 을 읽어 지식 공백(RAG 미적중 질문)·부정 피드백을 집계,
   advisor-logs/gap-report.md 로 "보강이 필요한 주제" 리포트를 생성한다.
   ▶ 이후 [보강]은 사람/에이전트가 리포트를 보고 검증된 청크를 knowledge.ts에 추가
     (신탁·법률 정확성 가드레일 → 자동 병합 금지, 사업팀 검수 게이트 권장).
   실행: node scripts/advisor-improve.mjs
   ================================================================ */
import { promises as fs } from "fs";
import path from "path";

const LOG_DIR = path.join(process.cwd(), "advisor-logs");

function tokenize(s) {
  return Array.from(new Set((s.toLowerCase().match(/[가-힣]{2,}|[a-z0-9]{2,}/g) || [])));
}

async function readLogs() {
  let files = [];
  try {
    files = (await fs.readdir(LOG_DIR)).filter((f) => f.startsWith("qa-") && f.endsWith(".jsonl"));
  } catch {
    return [];
  }
  const rows = [];
  for (const f of files) {
    const raw = await fs.readFile(path.join(LOG_DIR, f), "utf8");
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        rows.push(JSON.parse(line));
      } catch {
        /* skip bad line */
      }
    }
  }
  return rows;
}

function topTokens(questions, limit = 25) {
  const freq = new Map();
  for (const q of questions) {
    for (const t of tokenize(q)) freq.set(t, (freq.get(t) || 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

async function main() {
  const rows = await readLogs();
  // 신뢰도 임계: topScore 가 이 값 미만이면 "약한 적중"=지식 공백 후보로 본다.
  // (흔한 토큰만 걸려 점수가 낮은 경우 = 실질적으로 근거 빈약)
  // ⚠️ 데이터 누적되면 분포 보고 조정. 리포트는 사람 검토용이라 다소 민감해도 무방.
  const CONF = 8;
  const queries = rows.filter((r) => r.type === "query");
  const feedback = rows.filter((r) => r.type === "feedback");
  // 공백 = 미적중(hit=false) 또는 약한 적중(topScore<CONF)
  const misses = queries.filter((r) => r.q && (r.hit === false || (r.topScore ?? 0) < CONF));
  const downs = feedback.filter((r) => r.rating === "down" && r.q);

  const total = queries.length;
  const missRate = total ? ((misses.length / total) * 100).toFixed(1) : "0.0";
  const upCount = feedback.filter((r) => r.rating === "up").length;

  const lines = [];
  lines.push(`# 상담 지식 공백 리포트 (자가고도화 루프)`);
  lines.push("");
  lines.push(`> 생성 시각: ${new Date().toISOString()}`);
  lines.push("");
  lines.push(`## 요약`);
  lines.push(`- 총 질문: **${total}** / 지식공백(미적중 또는 약한적중 topScore<${CONF}): **${misses.length}** (${missRate}%)`);
  lines.push(`- 피드백: 👍 ${upCount} · 👎 ${downs.length}`);
  lines.push("");
  lines.push(`## 보강 우선순위 — 미적중 질문에 자주 등장한 키워드`);
  lines.push(`(이 키워드 주제의 검증된 지식 청크를 knowledge.ts에 추가하면 적중률이 오릅니다)`);
  lines.push("");
  const tt = topTokens(misses.map((m) => m.q));
  if (tt.length === 0) lines.push("- (해당 없음)");
  else for (const [t, c] of tt) lines.push(`- \`${t}\` — ${c}회`);
  lines.push("");
  lines.push(`## RAG 미적중 질문 (지식 공백 후보, 최근 50건)`);
  const recentMiss = misses.slice(-50).reverse();
  if (recentMiss.length === 0) lines.push("- (없음)");
  else for (const m of recentMiss) lines.push(`- ${m.q}`);
  lines.push("");
  lines.push(`## 👎 부정 피드백 질문 (답변 품질 개선 후보, 최근 50건)`);
  const recentDown = downs.slice(-50).reverse();
  if (recentDown.length === 0) lines.push("- (없음)");
  else for (const d of recentDown) lines.push(`- ${d.q}`);
  lines.push("");
  lines.push(`---`);
  lines.push(`### 다음 단계 [보강]`);
  lines.push(`1. 위 공백/부정 주제 중 신탁·대체투자 일반지식으로 답할 수 있는 것을 선별`);
  lines.push(`2. 검증된(원문·법령 근거) 일반지식 청크 초안 작성 → **사업팀(신탁) 검수**`);
  lines.push(`3. 통과분만 \`src/lib/advisor/knowledge.ts\`에 추가 (대외비·추정 금지)`);

  const out = path.join(LOG_DIR, "gap-report.md");
  await fs.mkdir(LOG_DIR, { recursive: true });
  await fs.writeFile(out, lines.join("\n"), "utf8");
  console.log(`gap-report 생성: ${out}`);
  console.log(`총 질문 ${total}, 미적중 ${misses.length}(${missRate}%), 👎 ${downs.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
