/* ================================================================
   상담 자가고도화 루프 — [분석] 단계
   advisor-logs/*.jsonl 을 읽어 지식 공백(RAG 미적중 질문)·부정 피드백을 집계,
   advisor-logs/gap-report.md 로 "보강이 필요한 주제" 리포트를 생성한다.
   ▶ 이후 [보강]은 사람/에이전트가 리포트를 보고 검증된 청크를 knowledge.ts에 추가
     (신탁·법률 정확성 가드레일 → 자동 병합 금지, 사업팀 검수 게이트 권장).

   ★현재 엔진 재채점(re-score) — 정직성 핵심:
     종전엔 로그에 **기록 시점에 박제된** topScore/hit 으로 미적중을 분류해, 그 사이
     retrieve 가 개선돼도(josa-stem 보강·정체성 grounding 등) 이미 해소된 질문이
     리포트에 계속 미적중으로 남았다(자가고도화 루프의 거짓 부채). 이제 각 로그
     질문을 **현재 retrieve()** 로 다시 채점하고, 라우트(api/advisor/route.ts)와
     동일한 판정 `groundingStrength(top?.score ?? 0, top?.identity ?? false)` 로
     현재도 약한 grounding 인 질문만 공백으로 본다. 코드 수정으로 해소된 미적중은
     자동으로 빠지고, "기록 시점 미적중 중 현재 해소된 수"를 함께 보고한다.

     ※재채점 코퍼스 = KNOWLEDGE 단독(retrieve 의 extra 미주입) = **공개/정적 출하
       구성과 동일**. 백데이터(bd-)는 라우트에서 extra 로만 주입되므로, 이 분석은
       backdata 부재 출하 구성의 실제 회수 품질을 정직하게 반영한다.
     ※멀티턴 맥락 패리티: 라우트는 buildRetrievalQuery 로 직전 사용자 발화를 합친 맥락
       질의로 회수한다. 로그의 rquery(=그 실제 회수 질의, 단발이면 미기록)가 있으면 그것으로,
       없으면 q(단발·레거시 로그)로 재채점한다 — 맥락 의존 후속질문("그럼 절차는?")이 단발
       q 만으로는 회수 0건이 돼 거짓 공백으로 오집계되던 것을 라우트와 동일 질의로 바로잡는다.

   실행(TS 엔진 import — verify-* 가드와 동일 로더):
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/advisor-improve.mjs
   ================================================================ */
import { promises as fs } from "fs";
import path from "path";
import { retrieve } from "../src/lib/advisor/retrieve.ts";
import { groundingStrength, STRONG_GROUNDING_SCORE } from "../src/lib/advisor/system.ts";

const LOG_DIR = path.join(process.cwd(), "advisor-logs");

/**
 * 한 질문을 현재 엔진으로 재채점 — 라우트(route.ts) 산출 grounding 판정과 동형.
 * 반환: { score, identity, strength } (회수 0건이면 score 0·identity false·weak).
 * strength==="weak" 이면 사용자에게 "관련도 낮음" 칩이 붙는, 현재도 실재하는 공백.
 */
function rescore(q) {
  const top = retrieve(q || "")[0];
  const score = top?.score ?? 0;
  const identity = top?.identity ?? false;
  return { score, identity, strength: groundingStrength(score, identity) };
}

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
  const queries = rows.filter((r) => r.type === "query");
  const feedback = rows.filter((r) => r.type === "feedback");
  const downs = feedback.filter((r) => r.rating === "down" && r.q);

  // 현재 엔진 재채점 — 각 질문을 retrieve()로 다시 채점해 라우트와 동일한 grounding
  // 판정을 얻는다. 공백 = 현재도 약한 grounding(weak). 기록 시점 박제값(topScore/hit)은
  // 투명성 대조용으로만 본다(코드 개선으로 해소된 미적중을 가시화).
  const scoredQueries = queries
    .filter((r) => r.q)
    .map((r) => {
      // 라우트 패리티 — 멀티턴이면 rquery(실제 회수 질의)로, 단발·레거시면 q 로 재채점.
      const usedContext = typeof r.rquery === "string" && r.rquery.length > 0;
      const cur = rescore(usedContext ? r.rquery : r.q);
      const frozenMiss = r.hit === false || (r.topScore ?? 0) < STRONG_GROUNDING_SCORE;
      return { q: r.q, usedContext, cur, frozenMiss, isGap: cur.strength === "weak" };
    });
  const misses = scoredQueries.filter((r) => r.isGap);
  // 투명성: 기록 시점엔 미적중이었으나 현재 엔진으로는 strong = 코드 개선으로 해소된 건.
  const resolvedSinceLog = scoredQueries.filter((r) => r.frozenMiss && !r.isGap);

  const total = queries.length;
  const missRate = total ? ((misses.length / total) * 100).toFixed(1) : "0.0";
  const upCount = feedback.filter((r) => r.rating === "up").length;

  const lines = [];
  lines.push(`# 상담 지식 공백 리포트 (자가고도화 루프)`);
  lines.push("");
  lines.push(`> 생성 시각: ${new Date().toISOString()}`);
  lines.push(`> 분류 기준: **현재 retrieve() 재채점** — 라우트와 동일 \`groundingStrength(top.score, top.identity)\`. 공백 = 현재도 weak grounding(임계 ${STRONG_GROUNDING_SCORE}·정체성 매칭 시 strong). 코퍼스 = KNOWLEDGE 단독(공개/정적 출하 구성). 멀티턴 질문은 로그의 rquery(라우트 실제 회수 질의)로 재채점(맥락 반영).`);
  lines.push("");
  lines.push(`## 요약`);
  lines.push(`- 총 질문: **${total}** / 지식공백(현재 엔진 weak grounding): **${misses.length}** (${missRate}%)`);
  lines.push(`- 자가고도화 해소: 기록 시점 미적중이었으나 **현재 코드로 해소(strong 전환): ${resolvedSinceLog.length}건** — 재채점이 없었다면 공백으로 오집계됐을 건.`);
  lines.push(`- 피드백: 👍 ${upCount} · 👎 ${downs.length}`);
  lines.push("");
  lines.push(`## 보강 우선순위 — 미적중 질문에 자주 등장한 키워드`);
  lines.push(`(이 키워드 주제의 검증된 지식 청크를 knowledge.ts에 추가하면 적중률이 오릅니다)`);
  lines.push("");
  const tt = topTokens(misses.map((m) => m.q));
  if (tt.length === 0) lines.push("- (해당 없음)");
  else for (const [t, c] of tt) lines.push(`- \`${t}\` — ${c}회`);
  lines.push("");
  lines.push(`## RAG 미적중 질문 (현재 엔진 재채점 기준 지식 공백, 최근 50건)`);
  const recentMiss = misses.slice(-50).reverse();
  if (recentMiss.length === 0) lines.push("- (없음)");
  else for (const m of recentMiss) lines.push(`- ${m.q} _(현재 top score ${m.cur.score}${m.cur.identity ? "·정체성✓" : ""}${m.usedContext ? "·맥락 반영" : ""})_`);
  lines.push("");
  if (resolvedSinceLog.length > 0) {
    lines.push(`## ✅ 코드 개선으로 해소된 과거 미적중 (재채점 strong 전환, 최근 30건)`);
    lines.push(`(기록 시점 박제 topScore 로는 공백이었으나 현재 retrieve 로는 strong — knowledge.ts 추가 불필요)`);
    const recentResolved = resolvedSinceLog.slice(-30).reverse();
    for (const m of recentResolved) lines.push(`- ${m.q} _(현재 top score ${m.cur.score}${m.cur.identity ? "·정체성✓" : ""}${m.usedContext ? "·맥락 반영" : ""})_`);
    lines.push("");
  }
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
  console.log(`총 질문 ${total}, 미적중(현재 엔진) ${misses.length}(${missRate}%), 해소 ${resolvedSinceLog.length}, 👎 ${downs.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
