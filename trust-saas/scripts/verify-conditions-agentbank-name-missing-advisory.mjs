/* ============================================================
   회귀 가드 — 대리금융기관(제20조) 지정 ON·회사명 빈칸 입력 지점 교차검증 advisory

   배경: STEP 05 계약 조건의 대리금융기관(제20조)은 "조문 자동반영"(EngineBadge) 항목으로,
   입력한 회사명(agentBank)이 별첨4 제20조 "대리금융기관의 선임" 조문의 {{AGENT_BANK}} 자리에
   그대로 흘러든다. 그런데 builders.js·annex.ts 는 agentBank 가 비면 그 자리를
   "[              ]"(빈 괄호)로 치환하므로(섹션 hint 도 "빈 값이면 빈칸 출력" 명시), 지정만
   켜고 회사명을 비운 채 진행하면 산출물 제20조에 빈칸 회사명이 박힌다. 제20조는 대리금융기관에게
   "우선수익자로서의 일체의 권한"을 위임하는 조항이라 권한을 위임받는 주체가 공란이면 조문 자체가
   결함이 된다. 게이트(validateDoc)는 지정 여부만 보고 회사명 채움은 검사하지 않아 이 빈칸이 조용히
   성립할 수 있었다. ubo "다름"인데 성명 빈칸(verify-ubo-distinct-name-missing-advisory)·우선수익자
   대출 있는데 채무자 빈칸(verify-priority-securedclaim-missing-advisory) 과 동형의
   "활성 항목인데 식별 필드 빈칸 → 산출물 빈칸" 완결성 갈래로, 기존 단독+지정(구조 불일치,
   verify-conditions-agentbank-solo-advisory) advisory 와는 직교한다. 막지 않고(사용자 선택 보존)
   입력 직하에서 부드럽게 되짚는다.

   핵심 불변식:
     - ★표시 전용 — 게이트(validate)·빌더(builders.js)·조문 무접촉(차단 아님·조문 미변경).
     - 조건 = agentBankNameMissing = !!c.agentBankEnabled && (c.agentBank||"").trim().length===0
       (지정 켜짐 + 회사명 공백/빈칸). agentBankEnabled·agentBank 파생이라 새 상태/모델/엔진 무접촉.
     - 한 글자라도 채우면(작성 완료 간주) 미표출 — false-positive 방지(trim 비교).
     - role=status·aria-live=polite (동적 출현 SR 고지) + 선두 ⚠ 글리프 aria-hidden(접근명 오염 0).
     - 기존 클래스(field-hint) 재사용 + 인라인 style 만 — 새 CSS 0.
     - 무회귀 — 단독+지정(solo) advisory·정족수 disabled·기존 대리금융기관 배선·프로파일 요약 보존.

   단언:
     (A) StepConditions 배선 — 파생 상수·조건·문구·role=status·aria-hidden 글리프·field-hint·brown
     (B) 무회귀 — solo advisory(!isMulti)·정족수 disabled·기존 agentBank 입력/배지/안내·isMulti 파생 보존
     (C) 무접촉 — validate/builders 에 advisory 문구 미혼입·새 CSS 클래스 0
     (D) 산출물 빈칸 근거 — builders.js·annex.ts 가 빈 agentBank 를 "[              ]"로 치환(advisory 전제 사실)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-conditions-agentbank-name-missing-advisory.mjs
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
const annex = read("src", "lib", "engine", "annex.ts");
const globals = read("src", "app", "globals.css");

console.log("\n[A] StepConditions 배선 — 파생 상수·조건·문구·role=status·aria-hidden 글리프·field-hint·brown");
{
  // 파생 상수: agentBankNameMissing = 지정 켜짐 + 회사명 trim 빈칸 (자기완결 조건)
  ok(/const agentBankNameMissing =\s*!!c\.agentBankEnabled && \(c\.agentBank \|\| ""\)\.trim\(\)\.length === 0;/.test(cond),
     "파생 상수 agentBankNameMissing = !!c.agentBankEnabled && (c.agentBank||'').trim().length===0");
  // advisory 는 그 파생 상수로만 게이팅 + 회사명 입력 블록 안(agentBankEnabled 렌더 영역)에 위치
  ok(/\{agentBankNameMissing && \(/.test(cond),
     "조건 = agentBankNameMissing 일 때만 렌더");
  // 되짚는 advisory 문구(지정 켰는데 회사명 빈칸·제20조 빈칸 출력·입력/해제 권유)
  ok(/대리금융기관 지정을 켰는데 회사명이 비어 있습니다/.test(cond),
     "advisory 본문 = 지정 ON·회사명 빈칸 사실 되짚음");
  ok(/별첨4 제20조\(대리금융기관의 선임\)에 회사명이 빈칸으로 출력됩니다/.test(cond),
     "advisory 본문 = 별첨4 제20조 빈칸 출력 결과 명시(산출물 영향 안내)");
  ok(/대리금융기관명을 입력하거나 지정을 해제하세요/.test(cond),
     "막지 않고(차단 아님) 회사명 입력 또는 지정 해제를 권유(사용자 선택 보존)");
  // 동적 출현 SR 고지 + 선두 ⚠ 글리프 aria-hidden
  ok(/\{agentBankNameMissing && \(/.test(cond)
     && /role="status" aria-live="polite"/.test(cond)
     && /<span aria-hidden="true">⚠ <\/span>/.test(cond),
     "role=status·aria-live=polite + 선두 ⚠ 글리프 aria-hidden(접근명 오염 0)");
  // 기존 클래스 재사용(field-hint) + brown 토큰(차단 적색 아님)
  ok(/className="field-hint" role="status"/.test(cond),
     "field-hint 기존 클래스 재사용(advisory 전용 새 클래스 0)");
  ok(/var\(--c-brown\)/.test(cond),
     "advisory 색 = var(--c-brown) 토큰 재사용(차단 적색 아님)");
}

console.log("\n[B] 무회귀 — solo advisory·정족수 disabled·기존 agentBank 배선·isMulti 파생 보존");
{
  // 직교하는 단독+지정(solo) advisory 는 그대로 공존
  ok(/\{c\.agentBankEnabled && !isMulti && \(/.test(cond),
     "단독+지정(solo) advisory 조건 c.agentBankEnabled && !isMulti 공존(직교 갈래 보존)");
  ok(/단독 우선수익자인데 대리금융기관\(제20조\)이 지정되어 있습니다/.test(cond),
     "solo advisory 본문 보존");
  // 정족수(제3조3항)의 단독 disabled 가드 보존
  ok(/disabled=\{!isMulti\}/.test(cond),
     "정족수 select disabled={!isMulti} 보존(단독에서 비활성)");
  // 기존 대리금융기관 체크박스/회사명 입력/별첨4 안내 보존
  ok(/checked=\{!!c\.agentBankEnabled\}/.test(cond),
     "대리금융기관 지정 체크박스(c.agentBankEnabled) 보존");
  ok(/aria-label="대리금융기관 회사명"/.test(cond),
     "대리금융기관 회사명 입력 접근명 보존");
  ok(/입력한 회사명이 별첨4 제20조에 자동 기재됩니다/.test(cond),
     "별첨4 제20조 자동 기재 안내(기존 field-hint) 보존");
  // isMulti 는 priorityCount 파생 — 새 상태/모델 아님
  ok(/const priorityCount = form\.priorities\.filter/.test(cond)
     && /const isMulti = priorityCount >= 2;/.test(cond),
     "isMulti = priorityCount(이름 있는 우선수익자 ≥ 2) 파생 보존(새 상태/모델 0)");
}

console.log("\n[C] 무접촉 — validate/builders 에 advisory 문구 미혼입·새 CSS 0");
{
  ok(!/회사명이 비어 있습니다|회사명이 빈칸으로 출력됩니다|대리금융기관명을 입력하거나 지정을 해제/.test(validate),
     "validate.ts(게이트)에 advisory 문구 미혼입 — 차단/검증 대상 아님(표시 전용)");
  ok(!/회사명이 비어 있습니다|회사명이 빈칸으로 출력됩니다|대리금융기관명을 입력하거나 지정을 해제/.test(builders),
     "builders.js(산출물)에 advisory 문구 미혼입 — 조문 미변경(표시/출력 경계 분리)");
  ok(!/agentbank-name-missing|name-missing-advisory/.test(globals),
     "globals.css 에 advisory 전용 새 클래스 0(field-hint 재사용)");
}

console.log("\n[D] 산출물 빈칸 근거 — builders.js·annex.ts 가 빈 agentBank 를 빈 괄호로 치환(advisory 전제)");
{
  // {{AGENT_BANK}} 가 빈 값이면 "[              ]"(빈 괄호)로 치환 = advisory 가 경고하는 실제 산출물 결과
  ok(/\{\{AGENT_BANK\}\}/.test(builders) && /opts\.agentBank \|\| "\[\s+\]"/.test(builders),
     "builders.js: 빈 agentBank → {{AGENT_BANK}} 자리 '[      ]' 빈 괄호 치환(빈칸 출력 사실)");
  ok(/opts\.agentBank \|\| "\[\s+\]"/.test(annex),
     "annex.ts: 빈 agentBank → '[      ]' 빈 괄호 치환(동일 산출물 사실)");
  // 제20조가 "일체의 권한" 위임 조항임을 근거로 명시(법적 결함 조문 방지의 핵심)
  ok(/대리금융기관의 선임/.test(builders) && /우선수익자로서의 일체의 권한/.test(builders),
     "builders.js 제20조 = 대리금융기관에 '우선수익자로서의 일체의 권한' 위임(빈칸=결함 조문 근거)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
