/* ============================================================
   회귀 가드 — 상담 자가고도화 [분석] 재채점의 **멀티턴 라우트 패리티**(rquery).

   배경(정직성 갭): 라우트(api/advisor/route.ts)는 멀티턴 후속 질문을
   buildRetrievalQuery 로 직전 사용자 발화를 합친 **맥락 질의**로 회수한다
   (verify-advisor-context-query). 그런데 자가고도화 로깅은 단발 질문(q=마지막
   발화)만 남겼고, gap-report 재채점(advisor-improve.mjs)은 그 단발 q 로만
   retrieve() 를 다시 돌렸다. 그래서 "그럼 절차는?" 같은 맥락 의존 후속질문은
   라우트에선 실제로 grounding 됐는데도(직전 "담보신탁…" 합쳐 trust-collateral
   회수) 분석에선 회수 0~약함으로 **거짓 공백**으로 집계됐다(자가고도화 루프가
   닫은 것을 다시 부채로 보고 — verify-advisor-improve-rescore 가 막은 "박제
   score 거짓 부채"의 쌍둥이 = "맥락 소실 거짓 부채").

   수정: 라우트가 실제 회수에 쓴 질의를 logQuery 에 함께 넘겨 로그에 rquery 로
   남기고(단발이면 q 와 같아 미기록), advisor-improve 가 rquery 있으면 그것으로
   재채점(라우트 패리티)·없으면 q 로(레거시·후방호환) 채점한다.

   본 가드는 ①log.ts/route.ts/advisor-improve.mjs 배선(static) + ②라우트 패리티가
   거짓 공백을 실제로 제거함(behavioral: 단발 weak ↔ 맥락 strong) + ③rquery 의
   "차이 날 때만 기록" 규약(PII 치환 후 값 비교) + ④무접촉(점수식·groundingStrength·
   knowledge.ts 무변형, rquery PII 치환)을 고정한다.

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-advisor-rescore-multiturn-parity.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { retrieve, buildRetrievalQuery } from "../src/lib/advisor/retrieve.ts";
import { groundingStrength } from "../src/lib/advisor/system.ts";
import { redactForLog } from "../src/lib/advisor/log.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const dir = path.dirname(fileURLToPath(import.meta.url));
const logSrc = readFileSync(path.join(dir, "../src/lib/advisor/log.ts"), "utf8");
const routeSrc = readFileSync(path.join(dir, "../src/app/api/advisor/route.ts"), "utf8");
const improveSrc = readFileSync(path.join(dir, "advisor-improve.mjs"), "utf8");

const liveStrength = (q) => {
  const top = retrieve(q || "")[0];
  return groundingStrength(top?.score ?? 0, top?.identity ?? false);
};
const U = (content) => ({ role: "user", content });
const A = (content) => ({ role: "assistant", content });

console.log("[A] log.ts 배선 — rquery 필드·logQuery 파라미터·치환/캡/차이날때만");
{
  ok(/rquery\?\s*:\s*string/.test(logSrc), "QaLogEntry 에 rquery?: string 필드");
  ok(/export function logQuery\([\s\S]*retrievalQuery\?\s*:\s*string[\s\S]*\)\s*:\s*Promise<void>/.test(logSrc),
    "logQuery 에 retrievalQuery?: string 파라미터");
  // rquery 는 redactForLog(PII 치환) + slice 캡을 거친다(q 와 동일 규약, cap 은 넓게).
  ok(/redactForLog\(\s*retrievalQuery\s*\)\.slice\(\s*0\s*,\s*600\s*\)/.test(logSrc),
    "retrievalQuery 도 redactForLog + slice(0,600) (PII 치환·길이 제한)");
  // 단발(redacted 동일)이면 미기록 — q 와 다를 때만 rquery 로 남긴다.
  ok(/redR\s*!==\s*undefined\s*&&\s*redR\s*!==\s*redQ/.test(logSrc),
    "rquery = redacted 값이 q 와 다를 때만(단발 미기록·로그 비부풀림)");
  // appendLog 객체에 rquery 전달(undefined 면 JSON.stringify 가 키 자체를 누락 = 단발 byte-동일).
  ok(/appendLog\(\{\s*type:\s*["']query["'],\s*q:\s*redQ,\s*rquery\b/.test(logSrc),
    "appendLog 에 rquery 전달(undefined 시 JSON 키 누락 = 단발 로그 무변경)");
}

console.log("\n[B] route.ts 배선 — 실제 회수 질의(buildRetrievalQuery)를 logQuery 에 전달");
{
  ok(/const\s+retrievalQuery\s*=\s*buildRetrievalQuery\(\s*messages\s*\)/.test(routeSrc),
    "retrievalQuery = buildRetrievalQuery(messages) (실제 회수 질의)");
  // logQuery 의 [수집] 호출이 retrievalQuery 를 마지막 인자로 넘긴다.
  ok(/logQuery\(\s*lastUser\.content,[\s\S]*retrieved\.map\(\(r\)\s*=>\s*r\.chunk\.id\),\s*retrievalQuery\s*\)/.test(routeSrc),
    "logQuery(lastUser.content, …, retrievalQuery) — 회수 질의 동반 로깅");
  // 회수는 retrievalQuery 로 수행(단발 회귀 가드 — 종전 버그 = lastUser 한 줄만 회수).
  ok(/retrieve\(\s*retrievalQuery\s*,/.test(routeSrc),
    "retrieve(retrievalQuery, …) — 회수 질의로 검색(로깅 rquery 와 동일 출처)");
}

console.log("\n[C] advisor-improve.mjs 배선 — rquery 우선 재채점·q 폴백(후방호환)");
{
  ok(/typeof\s+r\.rquery\s*===\s*["']string["']\s*&&\s*r\.rquery\.length\s*>\s*0/.test(improveSrc),
    "usedContext = rquery 가 비지 않은 문자열일 때");
  ok(/rescore\(\s*usedContext\s*\?\s*r\.rquery\s*:\s*r\.q\s*\)/.test(improveSrc),
    "rescore(usedContext ? r.rquery : r.q) — 멀티턴 패리티·단발/레거시 폴백");
  ok(/usedContext/.test(improveSrc) && /맥락 반영/.test(improveSrc),
    "맥락 반영 행을 리포트에 정직 표기");
}

console.log("\n[D] 라우트 패리티가 거짓 공백을 제거(behavioral)");
{
  const conv = [U("담보신탁이 무엇인가요?"), A("담보신탁은 …"), U("그럼 절차는?")];
  // 단발 q 로만 재채점 = 종전 동작 = 거짓 공백(맥락 소실로 weak).
  ok(liveStrength("그럼 절차는?") === "weak",
    "단발 '그럼 절차는?' 재채점 → weak(맥락 소실 = 거짓 공백)");
  // rquery(=라우트 실제 회수 질의)로 재채점 = 라우트 패리티 = strong(공백 아님).
  const rq = buildRetrievalQuery(conv);
  ok(liveStrength(rq) === "strong",
    "맥락 질의(rquery) 재채점 → strong(라우트 패리티·거짓 공백 제거)");
  // 그 strong 의 근거 = 직전 주제(담보신탁) 청크 회수.
  ok(retrieve(rq, 4).some((r) => r.chunk.id === "trust-collateral"),
    "rquery 가 직전 주제 trust-collateral 회수(맥락 반영 근거)");
}

console.log("\n[E] rquery 기록 규약(behavioral) — 차이 날 때만·PII 치환 통과");
{
  const conv = [U("담보신탁이 무엇인가요?"), A("…"), U("그럼 절차는?")];
  const qMulti = "그럼 절차는?";
  const rqMulti = buildRetrievalQuery(conv);
  // 멀티턴: redacted rquery ≠ redacted q → 기록된다.
  ok(redactForLog(rqMulti).slice(0, 600) !== redactForLog(qMulti).slice(0, 300),
    "멀티턴: redacted rquery ≠ redacted q → 기록(맥락 보존)");
  // 단발: rquery===q → redacted 동일 → 미기록(로그 byte-동일).
  const qSingle = "담보신탁이 무엇인가요?";
  ok(redactForLog(qSingle).slice(0, 600) === redactForLog(qSingle).slice(0, 300),
    "단발: rquery===q → redacted 동일 → 미기록(로그 무변경)");
}

console.log("\n[F] 무접촉 — 점수식·grounding·knowledge.ts 무변형, 분석 전용");
{
  // 점수 채점식(태그 +3·본문 +1)은 retrieve.ts 그대로 — 이 변경은 로깅/분석만 손댄다.
  const r = retrieve("담보신탁이 무엇인가요?")[0];
  ok(r && typeof r.score === "number" && r.score > 0,
    "retrieve 점수 채점 정상 동작(점수식 무변형)");
  ok(groundingStrength(6, false) === "strong" && groundingStrength(5, false) === "weak",
    "groundingStrength 임계(6) 무변형");
  // advisor-improve 는 gap-report.md 만 기록 — knowledge.ts/src 무기록(보강은 사업팀 검수).
  ok(!/writeFile\([^)]*knowledge\.ts/.test(improveSrc) && !/writeFile\([^)]*src[\\/]/.test(improveSrc),
    "advisor-improve: knowledge.ts/src 무기록(분석 전용)");
  // route 의 회수/로깅만 변경 — 산출물(docx)·검증(validate) import 부재.
  ok(!/from\s+["']@\/lib\/engine\/(docx|validate)/.test(routeSrc),
    "route: 산출물(docx)/검증(validate) 무접촉");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
if (fail > 0) process.exit(1);
