/* ============================================================
   회귀 가드 — 상담 자가고도화 루프 [분석] 단계(advisor-improve.mjs)의
   "현재 엔진 재채점(re-score)" 정직성.

   배경(정직성 갭): advisor-improve.mjs 는 advisor-logs/*.jsonl 의 질문을
   집계해 gap-report.md(지식 공백 리포트)를 만든다. 종전엔 로그에 **기록
   시점에 박제된** topScore/hit 으로 미적중을 분류했다 — 그 사이 retrieve 가
   개선돼도(josa-stem 보강·정체성 grounding) 이미 해소된 질문이 리포트에
   계속 "미적중"으로 남아, 자가고도화 루프가 닫은 공백을 거짓 부채로
   재보고했다(예: gap-report 2026-06-22 최다 미적중 "담보신탁이 무엇인가요?"
   는 10:34 identity-grounding fix 로 strong 전환됐는데도 frozen score 로는
   계속 공백). 이제 각 질문을 **현재 retrieve()** 로 다시 채점하고, 라우트
   (api/advisor/route.ts)와 **동일한** 판정으로 현재도 약한 grounding 인
   질문만 공백으로 본다.

   본 가드는 ①advisor-improve.mjs 가 재채점 배선을 갖췄는지(static) +
   ②그 재채점이 의존하는 엔진 계약(retrieve+groundingStrength)이 라우트와
   동형으로 동작하는지(behavioral) + ③분석 전용(산출물·knowledge.ts 무기록)
   인지를 고정한다.

   단언:
     (A) 스크립트 배선 — retrieve/groundingStrength import·rescore 헬퍼·
         라우트 동형 판정(strength==="weak")·resolved 델타·재채점 코퍼스 주석
     (B) 엔진 계약(behavioral) — 라우트 동형 predicate 가 정체성 정의 질문은
         strong(=공백 아님), 코퍼스 밖 질의는 weak(=공백)
     (C) 해소 델타 정직성 — frozen<임계인데 현재 strong = "해소"로 분류되는
         predicate 성립(정체성 정의 질문)
     (D) 무접촉 — gap-report.md 만 기록, knowledge.ts/src 무기록·분석 전용

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-advisor-improve-rescore.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { retrieve } from "../src/lib/advisor/retrieve.ts";
import { groundingStrength, STRONG_GROUNDING_SCORE } from "../src/lib/advisor/system.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const dir = path.dirname(fileURLToPath(import.meta.url));
const script = readFileSync(path.join(dir, "advisor-improve.mjs"), "utf8");

/** 라우트(route.ts)와 동형 — advisor-improve.rescore 가 의존하는 판정. */
const liveStrength = (q) => {
  const top = retrieve(q || "")[0];
  return groundingStrength(top?.score ?? 0, top?.identity ?? false);
};

console.log("[A] 스크립트 배선 — 현재 엔진 재채점");
{
  ok(/import\s*\{\s*retrieve\s*\}\s*from\s*["']\.\.\/src\/lib\/advisor\/retrieve\.ts["']/.test(script),
    "retrieve 를 retrieve.ts 에서 import");
  ok(/import\s*\{[^}]*groundingStrength[^}]*\}\s*from\s*["']\.\.\/src\/lib\/advisor\/system\.ts["']/.test(script),
    "groundingStrength 를 system.ts 에서 import");
  ok(/import\s*\{[^}]*STRONG_GROUNDING_SCORE[^}]*\}\s*from\s*["']\.\.\/src\/lib\/advisor\/system\.ts["']/.test(script),
    "STRONG_GROUNDING_SCORE 를 system.ts 에서 import");
  ok(/function\s+rescore\s*\(/.test(script), "rescore 헬퍼 정의");
  // 라우트 동형 판정 — top?.score ?? 0, top?.identity ?? false 를 groundingStrength 에 전달
  ok(/groundingStrength\(\s*score\s*,\s*identity\s*\)/.test(script)
    && /retrieve\(\s*q\s*\|\|\s*""\s*\)\[0\]/.test(script)
    && /top\?\.score\s*\?\?\s*0/.test(script) && /top\?\.identity\s*\?\?\s*false/.test(script),
    "rescore = groundingStrength(top.score??0, top.identity??false) (라우트 동형)");
  // 공백 분류는 현재 강도(weak) 기준 — frozen topScore 단독 분류 폐기
  ok(/strength\s*===\s*["']weak["']/.test(script), "공백 분류 = 현재 grounding weak (isGap)");
  ok(/frozenMiss\s*&&\s*!\s*\w*\.?isGap/.test(script) || /r\.frozenMiss\s*&&\s*!r\.isGap/.test(script),
    "해소(resolvedSinceLog) = frozenMiss && !isGap 델타");
  ok(/resolvedSinceLog/.test(script), "resolvedSinceLog 집계");
  ok(/재채점|현재 엔진|현재 retrieve/.test(script), "리포트에 재채점 기준 명시");
  // 실행 헤더가 TS 로더 경유(엔진 import 가능) 임을 명시
  ok(/experimental-strip-types[\s\S]*ts-ext-loader\.mjs[\s\S]*advisor-improve\.mjs/.test(script),
    "실행 커맨드 = TS 로더 경유");
}

console.log("\n[B] 엔진 계약(behavioral) — 라우트 동형 판정");
{
  // 정체성 정의 질문 = 제품 1차 범위 담보신탁의 핵심 정의 → strong(공백 아님).
  ok(liveStrength("담보신탁이 무엇인가요?") === "strong",
    "정체성 정의 질문 → strong(공백 아님)");
  // 코퍼스에 절대 없는 합성 토큰 → 회수 0 → weak(공백). isolation.
  ok(liveStrength("zorpaa zbeta") === "weak", "코퍼스 밖 질의 → weak(공백)");
  ok(liveStrength("") === "weak", "빈 질의 → weak(회수 0)");
  // 정체성 신호의 실재 확인 — retrieve top 의 identity 가 strong 의 근거.
  const t = retrieve("담보신탁이 무엇인가요?")[0];
  ok(t && t.identity === true, "정체성 정의 질문 top.identity=true (strong 근거)");
}

console.log("\n[C] 해소 델타 정직성 — frozen<임계인데 현재 strong = 해소");
{
  // 자가고도화 해소 predicate: 기록 시점 박제 score 가 임계 미만(frozenMiss)이어도
  // 현재 엔진이 strong 이면 공백 아님(resolved). 정체성 정의 질문이 정확히 이 케이스
  // (gap-report 2026-06-22 최다 미적중 → 10:34 fix 후 strong, score<6 인데 identity).
  const q = "담보신탁이 무엇인가요?";
  const top = retrieve(q)[0];
  const frozenLowScore = (top?.score ?? 0) < STRONG_GROUNDING_SCORE; // 박제 score 가정과 동형
  const liveStrong = liveStrength(q) === "strong";
  ok(frozenLowScore && liveStrong,
    "정체성 정의 질문: 점수<임계인데 현재 strong → resolvedSinceLog 로 분류(false-debt 제거)");
}

console.log("\n[D] 무접촉 — 분석 전용(산출물·knowledge.ts 무기록)");
{
  // 기록 대상은 gap-report.md 한 경로뿐 — knowledge.ts/src 로의 writeFile 금지.
  ok(/writeFile\([^)]*gap-report\.md/.test(script) || /"gap-report\.md"/.test(script),
    "기록 = advisor-logs/gap-report.md");
  ok(!/writeFile\([^)]*knowledge\.ts/.test(script) && !/writeFile\([^)]*src[\\/]/.test(script),
    "knowledge.ts/src 무기록 (보강은 사업팀 검수 게이트)");
  // 엔진(retrieve/groundingStrength)은 호출만 — 점수/조문/산출물 무변경(읽기 전용 분석).
  ok(!/KNOWLEDGE\s*\.\s*push|KNOWLEDGE\s*=/.test(script), "KNOWLEDGE 코퍼스 무변형");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
if (fail > 0) process.exit(1);
