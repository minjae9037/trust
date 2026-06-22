/* ============================================================
   회귀 가드 — 신탁보수 > 우선수익한도금액(보수율 100% 초과) 입력 지점 교차검증 advisory

   배경: STEP 05(StepBasic)의 "신탁보수율 (우선수익한도금액 대비 %)" 자동 필드는
   recalcDerived 가 "신탁보수 ÷ 우선수익한도금액 × 100"으로 산정한다. 담보신탁에서 신탁보수는
   통상 한도금액의 소수 %(수수료) 수준이므로, 신탁보수가 한도금액 자체를 넘으면(보수율 100%
   초과) 두 금액 중 하나의 자릿수(0 개수) 오입력일 가능성이 높다(예: 보수칸에 한도금액을 잘못
   입력). 그러나 신탁보수(직접 입력)와 우선수익한도금액(STEP 02-1 자동)은 같은 화면의 서로 다른
   입력칸이라 그 초과가 조용히 성립할 수 있었다 — 보수율 자동 필드는 "250 %" 같은 큰 값을
   자신 있게 표시할 뿐 무엇이 이상한지 짚지 않았다. StepLoanCalc 한도합계 vs 평가가격·신탁기간
   시작일 vs 체결일 advisory 와 동형의 "막지 않는 되짚음" — 순수 금액 비교(두 사용자 입력)일 뿐
   차단·조문·산출물 무관.

   핵심 불변식:
     - ★표시 전용 — 게이트(validate)·빌더(builders.js)·조문 무접촉(차단 아님).
       feeExceedsLimit 은 기존 입력(c.trustFee + c.priorityLimit)의 파생 표시일 뿐 어느
       산출물·게이트에도 영향을 주지 않는다. 새 상태/모델/엔진 무접촉.
     - 조건 = limitShowable(비율 유효 + 한도금액 양수) && !feeInvalid && parseAmount(보수)>0
       && parseAmount(보수) > parseAmount(한도금액). 무효 비율·한도 보류·무효 보수면 미표출
       (나그·오탐 방지 — 각 무효는 해당 인라인이 이미 안내).
     - 순수 산술(parseAmount 단일 출처) 비교 — 추정 조문 아님(통상 실무 = 보수는 한도의 소수 %).
     - role=status·aria-live=polite(동적 출현 SR 고지) + 선두 ⚠ 글리프 aria-hidden
       (장식 글리프 접근명 오염 0 — 기존 컨벤션).
     - 기존 클래스(field-hint) 재사용 + 인라인 style 만 — 새 CSS 0.
     - 색 = var(--c-brown) 토큰(차단 적색 var(--c-danger) 아님 — 검토 신호·기존 advisory 동형).

   단언:
     (A) StepBasic 배선 — 조건·문구·role=status·aria-hidden 글리프·field-hint·brown
     (B) 단일 출처 — parseAmount 비교(보수 c.trustFee vs 한도 c.priorityLimit) + 기존
         limitShowable/feeInvalid 게이트 패리티 재사용
     (C) 무회귀 — 신탁보수율 자동 필드·신탁보수 한글 readback·신탁기간 advisory·요약 보존
     (D) 무접촉 — validate/builders 에 advisory 문구 미혼입·새 CSS 0·차단 적색 미사용

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-stepbasic-fee-exceeds-limit-advisory.mjs
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
const basic = read("src", "components", "trust", "steps", "StepBasic.tsx");
const calc = read("src", "lib", "engine", "calc.ts");
const validate = read("src", "lib", "engine", "validate.ts");
const builders = read("src", "lib", "engine", "docx", "builders.js");
const globals = read("src", "app", "globals.css");

console.log("\n[A] StepBasic 배선 — 조건·문구·role=status·aria-hidden 글리프·field-hint·brown");
{
  ok(/const feeExceedsLimit =/.test(basic), "feeExceedsLimit 파생 상수 선언");
  ok(/limitShowable &&/.test(basic.slice(basic.indexOf("const feeExceedsLimit ="))),
     "조건 1 = limitShowable(비율 유효 + 한도금액 양수일 때만 비교)");
  const cond = basic.slice(basic.indexOf("const feeExceedsLimit ="), basic.indexOf("const feeExceedsLimit =") + 320);
  ok(/!feeInvalid &&/.test(cond), "조건 2 = !feeInvalid(무효 보수면 미표출 — 게이트 패리티)");
  ok(/parseAmount\(c\.trustFee\) > 0 &&/.test(cond), "조건 3 = parseAmount(보수) > 0(보수 입력·양수)");
  ok(/parseAmount\(c\.trustFee\) > parseAmount\(c\.priorityLimit\)/.test(cond),
     "조건 4 = parseAmount(보수) > parseAmount(한도금액)(초과일 때만)");
  // advisory 본문 — 두 금액 동시 표기 + 보수율 100% 초과 사실 되짚음 + 확인 권유(차단 아님)
  ok(/신탁보수\(.*\)가 우선수익한도금액\(.*\)을 초과합니다/.test(basic),
     "advisory 본문 = 신탁보수가 한도금액을 초과한 사실 되짚음(두 금액 동시 표기)");
  ok(/보수율이 100%를 넘어 자릿수\(0 개수\) 오입력일 수 있습니다\. 확인하세요\./.test(basic),
     "막지 않고(차단 아님) 자릿수 오입력 가능성을 안내하며 확인을 권유(사용자 선택 보존)");
  // 동적 출현 SR 고지 + 선두 ⚠ aria-hidden (advisory 블록 구간)
  const adv = basic.slice(basic.indexOf("{feeExceedsLimit && ("));
  ok(/role="status" aria-live="polite"/.test(adv.slice(0, 600))
     && /<span aria-hidden="true">⚠ <\/span>/.test(adv.slice(0, 600)),
     "role=status·aria-live=polite + 선두 ⚠ 글리프 aria-hidden(접근명 오염 0)");
  ok(/\{feeExceedsLimit && \(\s*<div className="field-hint" role="status" aria-live="polite"/.test(basic),
     "field-hint 기존 클래스 재사용(새 클래스 0)");
  ok(adv.slice(0, 600).includes("var(--c-brown)"),
     "advisory 색 = var(--c-brown) 토큰(차단 적색 아님·기존 advisory 와 동형)");
  ok(!adv.slice(0, 600).includes("var(--c-danger)"),
     "advisory 는 차단 적색(var(--c-danger)) 미사용 — 검토 신호일 뿐 차단 아님");
}

console.log("\n[B] 단일 출처 — parseAmount 비교 + limitShowable/feeInvalid 게이트 패리티 재사용");
{
  ok(/import \{[^}]*\bparseAmount\b[^}]*\} from "@\/lib\/engine\/calc"/.test(basic),
     "calc 에서 parseAmount import(금액 파싱 단일 출처 재사용)");
  ok(/const limitShowable = !ratioInvalid && isPositiveAmount\(c\.priorityLimit\);/.test(basic),
     "limitShowable = !ratioInvalid && isPositiveAmount(priorityLimit)(기존 게이트 패리티 단일 출처)");
  ok(/const feeInvalid = feeFilled && !isPositiveAmount\(c\.trustFee\);/.test(basic),
     "feeInvalid = feeFilled && !isPositiveAmount(trustFee)(기존 게이트 패리티 단일 출처)");
  // calc 의 parseAmount 가 문자 금액을 숫자로 환원함을 확인(가드 의존 계약)
  ok(/export function parseAmount\(/.test(calc),
     "parseAmount 가 calc 에 존재(가드 의존 계약 보존)");
}

console.log("\n[C] 무회귀 — 신탁보수율 자동 필드·신탁보수 한글 readback·신탁기간 advisory·요약 보존");
{
  ok(/신탁보수 ÷ 우선수익한도금액 × 100 자동 산정\./.test(basic),
     "신탁보수율 자동 산정 필드(보수율 = 보수÷한도×100) 보존");
  ok(/\{parseAmount\(c\.trustFee\) > 0 && \(\s*<div className="loan-hangul"/.test(basic),
     "신탁보수 한글 금액 readback(amountToHangul) 보존");
  ok(/const periodStartsBeforeContract =/.test(basic),
     "신탁기간 시작일 < 체결일 advisory(periodStartsBeforeContract) 보존");
  ok(/<strong>요약<\/strong> 우선수익한도금액/.test(basic),
     "요약 footnote 보존");
}

console.log("\n[D] 무접촉 — validate/builders 에 advisory 문구 미혼입·새 CSS 0·차단 적색 미사용");
{
  ok(!/을 초과합니다 — 보수율이 100%를 넘어|자릿수\(0 개수\) 오입력일 수 있습니다/.test(validate),
     "validate.ts(게이트)에 advisory 문구 미혼입 — 차단/검증 대상 아님(표시 전용)");
  ok(!/을 초과합니다 — 보수율이 100%를 넘어|자릿수\(0 개수\) 오입력일 수 있습니다/.test(builders),
     "builders.js(산출물)에 advisory 문구 미혼입 — 조문·표 미변경(표시 전용)");
  ok(!/fee-exceeds-limit|feeExceedsLimit|fee-exceeds/.test(globals),
     "globals.css 에 advisory 전용 새 클래스 0(field-hint 재사용)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
