/* ============================================================
   회귀 가드 — 상담(advisor) 로그 PII 치환

   배경(가드레일 갭, CLAUDE.md 원칙 3 = PII 토큰화): 계약 측은 Claude 전송
   경계를 tokenizePII 로 보호하지만, 상담(Pillar 2)의 자가고도화 로그는
   사용자 질문(lastUser.content)·피드백 메모를 advisor-logs/qa-*.jsonl 에
   평문 그대로 적재했다. "우리 회사(123-45-67890) 담보신탁…" 같은 질문이면
   사업자등록번호 등 고민감 식별자가 디스크 로그에 평문으로 남는 결함.

   이제 log.ts 의 logQuery/logFeedback 가 저장 직전 redactForLog(=tokenizePII)
   로 식별자를 1방향 치환한다. 분석에 필요한 주변 텍스트(RAG 적중/공백 판별)는
   보존되고, 식별번호만 토큰으로 남아 평문 PII 가 디스크에 남지 않는다.
   상담 답변·외부 전송 경로는 무변경(로그 저장 경로에만 적용).

   핵심 불변식:
     - 주민·사업자·법인·등기 식별번호는 저장 전 토큰으로 치환된다(평문 0).
     - 분석용 주변 텍스트(한글 질의어)는 보존된다.
     - PII 없는 질문은 변형되지 않는다(오탐 0).
     - logQuery·logFeedback 둘 다 redactForLog 를 거친다(경로 누락 0).

   단언:
     (A) 식별번호 4종 전부 치환 — 원문 평문 잔존 0
     (B) 분석용 주변 텍스트 보존 — RAG 공백 분석 가능
     (C) 복수 PII 동시 치환 + 동일 값 동일 토큰(tokenizePII 재사용)
     (D) PII 없는 질문 무변형(오탐 0)
     (E) 배선 — logQuery/logFeedback 가 redactForLog 사용(평문 로깅 회귀 차단)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-advisor-log-redact.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { redactForLog } from "../src/lib/advisor/log.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

console.log("\n[A] 식별번호 4종 전부 치환 — 원문 평문 잔존 0");
{
  const cases = [
    { pii: "900101-1234567", kind: "주민등록번호" },
    { pii: "123-45-67890", kind: "사업자등록번호" },
    { pii: "110111-7125720", kind: "법인등록번호" },
    { pii: "1234-5678-901234", kind: "등기고유번호" },
  ];
  for (const { pii, kind } of cases) {
    const out = redactForLog(`담보신탁 문의 ${pii} 관련 상담드립니다`);
    ok(!out.includes(pii), `${kind}(${pii}) 평문 제거`);
    ok(out.includes("["), `${kind} → 토큰([…]) 치환`);
  }
}

console.log("\n[B] 분석용 주변 텍스트 보존 — RAG 공백 분석 가능");
{
  const out = redactForLog("관리형토지신탁 책임준공 구조 질문 사업자 123-45-67890");
  ok(out.includes("관리형토지신탁") && out.includes("책임준공") && out.includes("구조"),
    "주변 한글 질의어 보존(적중/공백 판별 가능)");
  ok(!out.includes("123-45-67890"), "식별번호만 치환");
}

console.log("\n[C] 복수 PII 동시 치환 + 동일 값 동일 토큰");
{
  const out = redactForLog("법인 110111-7125720 과 동일 110111-7125720, 그리고 123-45-67890");
  ok(!out.includes("110111-7125720") && !out.includes("123-45-67890"), "복수 PII 전부 치환");
  // 동일 값은 tokenizePII 가 같은 토큰 재사용 → 토큰이 2회 등장
  const tokens = out.match(/\[[^\]]+\]/g) || [];
  const uniq = new Set(tokens);
  ok(tokens.length >= 3 && uniq.size === 2, "동일 값=동일 토큰(재사용), 상이 값=상이 토큰");
}

console.log("\n[D] PII 없는 질문 무변형 — 오탐 0");
{
  const q = "차입형토지신탁과 관리형토지신탁의 수수료 구조 차이가 궁금합니다";
  ok(redactForLog(q) === q, "식별번호 없는 평문 질의 무변형");
}

console.log("\n[E] 배선 — logQuery/logFeedback 가 redactForLog 사용");
{
  const src = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "advisor", "log.ts"),
    "utf8"
  );
  // logQuery 본문
  const logQ = src.slice(src.indexOf("export function logQuery"), src.indexOf("export function logFeedback"));
  ok(/redactForLog\(\s*q\s*\)/.test(logQ), "logQuery 가 redactForLog(q) 사용");
  ok(!/\bq\.slice\(/.test(logQ), "logQuery 에 q.slice 직접(raw) 호출 없음");
  // logFeedback 본문
  const logF = src.slice(src.indexOf("export function logFeedback"));
  ok(/redactForLog\(\s*q\s*\)/.test(logF), "logFeedback 가 redactForLog(q) 사용");
  ok(/redactForLog\(\s*note\s*\)/.test(logF), "logFeedback 가 note 도 redactForLog 사용");
  ok(!/\bq\.slice\(/.test(logF) && !/note\?\.slice\(/.test(logF), "logFeedback 에 raw q/note slice 없음");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
