/* ============================================================
   회귀 가드 — 상담(advisor·Pillar 2) 회수 0건 범위 주의 가드레일

   배경(가드레일 공백): RAG-lite 라우트는 질문으로 지식코퍼스를 검색해
   회수된 참고자료(grounding)를 시스템 프롬프트에 주입한다. 종전엔 회수가
   **0건(grounding 없음)** 이면 참고자료 블록을 빼고 페르소나만 넘겨, LLM 이
   일반 학습지식만으로 **단정적으로** 답할 수 있었다 — 신탁·부동산금융·
   대체투자 코퍼스 **밖**의 질문(gap-report "베트남 부동산 외국인 취득" 류
   👎 미적중)에도 수치·법조항·절차를 지어낼 수 있던 결함(CLAUDE.md 운영원칙
   #1 사실 기반·추정 금지 / #3 가드레일).

   수정: 시스템 블록 조립을 순수 buildAdvisorSystem(system.ts)으로 분리하고,
   회수 0건(contextText 빈 문자열)일 때 범위 주의 지침(OUT_OF_SCOPE_NOTE)을
   주입한다. ★답을 막지 않는다 — 일반 원칙으로 분명하면 간결히 답하도록
   허용하되, 코퍼스 밖 주제는 그 사실을 먼저 밝히고 전문가 확인을 권고하며
   고유 수치·조항을 지어내지 않게 한다.

   본 가드는 buildAdvisorSystem() 을 실제 호출해(behavioral) 분기 불변식을
   고정하고, route.ts 가 인라인 조립 대신 이 순수 함수를 쓰는지 정적 확인한다.

   단언:
     (A) grounding 있음 → 2블록·둘째 블록 = GROUNDING_PREFIX + contextText
     (B) grounding 없음(빈 문자열) → 2블록·둘째 블록 = OUT_OF_SCOPE_NOTE
     (C) 페르소나 = 첫 블록·ephemeral 캐시 보존(프롬프트 캐시 적중)
     (D) 분기 상호배타 — grounding 블록엔 scope note 미혼입, 그 역도 성립
     (E) OUT_OF_SCOPE_NOTE 내용 불변식 — 추정 금지·전문가 확인 권고·범위 명시
     (F) route.ts 가 buildAdvisorSystem 사용·인라인 systemBlocks 조립 잔존 0

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-advisor-scope-note.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  buildAdvisorSystem,
  GROUNDING_PREFIX,
  OUT_OF_SCOPE_NOTE,
} from "../src/lib/advisor/system.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => readFileSync(path.join(root, ...p), "utf8");

const PERSONA = "당신은 한국 대체투자 전문 어드바이저입니다."; // 대표 더미(실 페르소나 무관)
const CTX = "[참고자료 1] 담보신탁: 위탁자가 부동산을 신탁하고 우선수익권을 발급…";

console.log("\n[A] grounding 있음 → GROUNDING_PREFIX + contextText 블록");
{
  const b = buildAdvisorSystem(PERSONA, CTX);
  ok(b.length === 2, "블록 2개(페르소나 + 참고자료)");
  ok(b[1].text === GROUNDING_PREFIX + CTX, "둘째 블록 = 활용지침 + 회수 본문");
  ok(b[1].text.includes("담보신탁: 위탁자"), "회수 본문 보존");
}

console.log("\n[B] grounding 없음(빈 문자열) → OUT_OF_SCOPE_NOTE 블록");
{
  const b = buildAdvisorSystem(PERSONA, "");
  ok(b.length === 2, "블록 2개(페르소나 + 범위주의)");
  ok(b[1].text === OUT_OF_SCOPE_NOTE, "둘째 블록 = 범위 주의 지침");
  ok(!b[1].text.includes(GROUNDING_PREFIX), "활용지침(grounding) 문구 미혼입");
}

console.log("\n[C] 페르소나 = 첫 블록·ephemeral 캐시 보존");
{
  const b = buildAdvisorSystem(PERSONA, CTX);
  ok(b[0].text === PERSONA, "첫 블록 = 페르소나 원문");
  ok(b[0].cache_control && b[0].cache_control.type === "ephemeral", "페르소나 ephemeral 캐시 유지");
  // grounding/scope 블록엔 캐시 제어를 걸지 않는다(질의마다 달라 캐시 부적격) — 종전 동작 보존.
  const b0 = buildAdvisorSystem(PERSONA, "");
  ok(!b[1].cache_control && !b0[1].cache_control, "참고자료·범위주의 블록 무캐시");
}

console.log("\n[D] 분기 상호배타 — 한쪽 블록에 다른쪽 지침 미혼입");
{
  const g = buildAdvisorSystem(PERSONA, CTX);
  const s = buildAdvisorSystem(PERSONA, "");
  ok(!g[1].text.includes(OUT_OF_SCOPE_NOTE), "grounding 블록에 범위주의 미혼입");
  ok(!s[1].text.includes(CTX), "범위주의 블록에 회수 본문 미혼입");
  // 공백/널/whitespace 만 있는 contextText 도 회수 없음으로 간주되는지(빈 문자열만 falsy).
  ok(buildAdvisorSystem(PERSONA, "")[1].text === OUT_OF_SCOPE_NOTE, "빈 문자열 → 범위주의(falsy 분기)");
}

console.log("\n[E] OUT_OF_SCOPE_NOTE 내용 불변식 — 추정 금지·전문가 확인·범위 명시");
{
  ok(OUT_OF_SCOPE_NOTE.includes("검색되지 않았습니다"), "회수 0건 사실 명시");
  ok(/지어내지 말|지어내지 않|단정/.test(OUT_OF_SCOPE_NOTE), "단정·날조 금지(추정 금지)");
  ok(OUT_OF_SCOPE_NOTE.includes("전문가") && OUT_OF_SCOPE_NOTE.includes("확인"), "전문가 확인 권고");
  ok(/간결히 답|답할 수 있으면/.test(OUT_OF_SCOPE_NOTE), "답을 막지 않음(분명하면 답 허용)");
  ok(OUT_OF_SCOPE_NOTE.includes("신탁") || OUT_OF_SCOPE_NOTE.includes("부동산금융"), "전문 영역 범위 명시");
}

console.log("\n[F] route.ts 가 순수 buildAdvisorSystem 사용·인라인 조립 잔존 0");
{
  const route = read("src", "app", "api", "advisor", "route.ts");
  ok(/import\s*\{[^}]*\bbuildAdvisorSystem\b[^}]*\}\s*from\s*["']@\/lib\/advisor\/system["']/.test(route), "buildAdvisorSystem import");
  ok(/buildAdvisorSystem\(ADVISOR_PERSONA,\s*contextText\b/.test(route), "조립을 순수 함수에 위임(strength 인자 동반 허용)");
  ok(!/systemBlocks\s*:\s*Anthropic\.TextBlockParam\[\]\s*=\s*\[/.test(route), "인라인 systemBlocks 배열 조립 잔존 0");
  ok(!route.includes("관련 있으면 근거로 활용하되"), "활용지침 인라인 문구 잔존 0(system.ts로 이전)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
if (fail > 0) process.exit(1);
