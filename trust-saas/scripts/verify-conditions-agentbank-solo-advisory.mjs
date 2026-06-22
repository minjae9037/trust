/* ============================================================
   회귀 가드 — 대리금융기관(제20조) 단독 우선수익자 입력 지점 교차검증 advisory

   배경: STEP 05 계약 조건의 대리금융기관(제20조)은 "조문 자동반영"(별첨4)되는 항목으로,
   섹션 hint 가 "다수 우선수익자(대주단)가 권한을 위임하는 대리금융기관. 단독이면 보통
   미지정입니다."라 명시하듯 통상 복수(대주단) 구조에서 둔다. 같은 구조-의존 항목인
   정족수(제3조3항)는 단독일 때 select 를 disabled 로 막지만(`disabled={!isMulti}`),
   대리금융기관 체크박스에는 그런 가드가 없어 **단독 우선수익자인데도 지정이 켜져 있으면**
   그 회사명이 별첨4 제20조에 조용히 기재되는 흔한 오설정 갭이 있었다. 막지 않고(사용자
   선택 보존) 입력 지점에서 부드럽게 되짚는 advisory 를 추가한다(금액·날짜 readback 과
   동형의 입력 지점 교차검증 철학).

   핵심 불변식:
     - ★표시 전용 — 게이트(validate)·빌더(builders.js)·조문 무접촉(차단 아님·조문 미변경).
     - 조건 = agentBankEnabled && !isMulti (지정 켜짐 + 단독). isMulti 는 priorityCount
       (이름 있는 우선수익자 수 ≥ 2) 파생이라 새 상태/모델/엔진 무접촉.
     - role=status·aria-live=polite (동적 출현 SR 고지) + 선두 ⚠ 글리프 aria-hidden
       (장식 글리프 접근명 오염 0 — 기존 컨벤션).
     - 기존 클래스(field-hint) 재사용 + 인라인 style 만 — 새 CSS 0.
     - 무회귀 — 정족수 disabled 가드·기존 대리금융기관 배선·프로파일 요약 보존.

   단언:
     (A) StepConditions 배선 — 조건·문구·role=status·aria-hidden 글리프·field-hint 재사용
     (B) 무회귀 — 정족수 disabled={!isMulti}·기존 agentBank 입력/배지·isMulti 파생 보존
     (C) 무접촉 — validate/builders 에 advisory 문구·조건 미혼입·새 CSS 클래스 0

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-conditions-agentbank-solo-advisory.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const __dir = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(join(__dir, "..", ...p), "utf8");
const cond = read("src", "components", "trust", "steps", "StepConditions.tsx");
const validate = read("src", "lib", "engine", "validate.ts");
const builders = read("src", "lib", "engine", "docx", "builders.js");
const globals = read("src", "app", "globals.css");

console.log("\n[A] StepConditions 배선 — 조건·문구·role=status·aria-hidden 글리프·field-hint 재사용");
{
  // advisory 는 지정 켜짐(agentBankEnabled) + 단독(!isMulti) 일 때만 렌더
  ok(/\{c\.agentBankEnabled && !isMulti && \(/.test(cond),
     "조건 = c.agentBankEnabled && !isMulti (지정 켜짐 + 단독일 때만)");
  // 되짚는 advisory 문구(제20조·대리금융기관·검토 권유)
  ok(/단독 우선수익자인데 대리금융기관\(제20조\)이 지정되어 있습니다/.test(cond),
     "advisory 본문 = 단독+대리금융기관(제20조) 지정 사실 되짚음");
  ok(/단독이면 지정 해제를 검토하세요/.test(cond),
     "막지 않고(차단 아님) 지정 해제 검토를 권유(사용자 선택 보존)");
  // 동적 출현 SR 고지
  ok(/role="status" aria-live="polite"[^>]*\}\}>\s*\n\s*<span aria-hidden="true">⚠ <\/span>/.test(cond)
     || (/c\.agentBankEnabled && !isMulti/.test(cond) && /role="status" aria-live="polite"/.test(cond) && /<span aria-hidden="true">⚠ <\/span>/.test(cond)),
     "role=status·aria-live=polite + 선두 ⚠ 글리프 aria-hidden(접근명 오염 0)");
  // 기존 클래스 재사용 (field-hint) — 새 클래스 도입 아님
  ok(/className="field-hint" role="status"/.test(cond),
     "field-hint 기존 클래스 재사용(advisory 전용 새 클래스 0)");
  // 색은 토큰 재사용(danger 적색 아님 — 차단 오인 방지·검토 신호)
  ok(/var\(--c-brown\)/.test(cond),
     "advisory 색 = var(--c-brown) 토큰 재사용(차단 적색 아님)");
}

console.log("\n[B] 무회귀 — 정족수 disabled·기존 agentBank 배선·isMulti 파생 보존");
{
  // 정족수(제3조3항)의 단독 disabled 가드는 그대로 (advisory 와 별개 경로)
  ok(/disabled=\{!isMulti\}/.test(cond),
     "정족수 select disabled={!isMulti} 보존(단독에서 비활성)");
  // 기존 대리금융기관 체크박스/회사명 입력/별첨4 배지 보존
  ok(/checked=\{!!c\.agentBankEnabled\}/.test(cond),
     "대리금융기관 지정 체크박스(c.agentBankEnabled) 보존");
  ok(/aria-label="대리금융기관 회사명"/.test(cond),
     "대리금융기관 회사명 입력 접근명 보존");
  ok(/입력한 회사명이 별첨4 제20조에 자동 기재됩니다/.test(cond),
     "별첨4 제20조 자동 기재 안내(기존 field-hint) 보존");
  // isMulti 는 priorityCount(이름 있는 우선수익자 수) 파생 — 새 상태/모델 아님
  ok(/const priorityCount = form\.priorities\.filter/.test(cond)
     && /const isMulti = priorityCount >= 2;/.test(cond),
     "isMulti = priorityCount(이름 있는 우선수익자 ≥ 2) 파생 보존(새 상태/모델 0)");
}

console.log("\n[C] 무접촉 — validate/builders 에 advisory 문구·조건 미혼입·새 CSS 0");
{
  ok(!/지정 해제를 검토하세요|단독 우선수익자인데 대리금융기관/.test(validate),
     "validate.ts(게이트)에 advisory 문구 미혼입 — 차단/검증 대상 아님(표시 전용)");
  ok(!/지정 해제를 검토하세요|단독 우선수익자인데 대리금융기관/.test(builders),
     "builders.js(산출물)에 advisory 문구 미혼입 — 조문 미변경(표시/출력 경계 분리)");
  ok(!/cond-advisory|agentbank-advisory|solo-advisory/.test(globals),
     "globals.css 에 advisory 전용 새 클래스 0(field-hint 재사용)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
