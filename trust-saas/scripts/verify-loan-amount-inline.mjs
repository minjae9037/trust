/* ============================================================
   회귀 가드 — 우선수익자 개별 대출금액(loanAmount) 인라인 검증 피드백 (StepLoanCalc)

   배경(접근성·UX·정확성 패리티, 비-산출물): 개별 우선수익자의 대출금액은
   우선수익한도금액(= 대출금액 × 비율)을 좌우하는 법적 서류상 핵심 수치다.
   "채웠지만 0·음수·비숫자"인 개별 금액은 게이트(validateDoc)가 이미 생성을 차단한다
   (verify-loan-amount-validity — "우선수익자 N 대출금액 (유효하지 않은 금액)").
   그러나 그 차단을 **입력 지점(StepLoanCalc)에서 즉시 알리지 않으면**, 같은 행의
   우선수익한도금액이 `대출금액 × 비율`로 산출한 음수/잘못된 금액을 굵게 표시해 사용자가
   그 값을 신뢰할 위험이 있다 — 무엇이 왜 막혔는지는 Doc 단계 게이트까지 가야 알 수 있었다
   (WCAG 3.3.1 오류 식별 / 4.1.2 Name·Role·Value). priorityRatio 인라인 피드백과 동일 유형.
   → StepLoanCalc 의 각 행 대출금액 input 옆에 인라인 오류(aria-invalid + aria-describedby +
     role="alert")를 추가. 게이트와 **같은 단일 출처**(hasText && !isPositiveAmount)를 재사용해
     판정 불일치(인라인은 무효라는데 게이트는 통과 같은 모순)를 원천 차단. 추가로 무효 행의
     우선수익한도금액 셀을 `isPositiveAmount` 로 가드해 음수 한도를 굵게 표시하지 않고 "—" 처리.

   본 가드(빌더·조문·생성 로직·검증 게이트 판정 무접촉 — 표시/접근성만):
     (A) 단일 출처 — StepLoanCalc 이 게이트와 같은 isPositiveAmount 를 calc 에서 import
     (B) 인라인 플래그 — loanInvalid = loanFilled && !isPositiveAmount(p.loanAmount),
         빈 값(미채움)은 미표시(나그 방지 — 게이트 합계검사가 커버)
     (C) input — aria-invalid + aria-describedby=`loan-amount-err-${i}`(행별 유니크),
         오류 div id=`loan-amount-err-${i}` role="alert", loanInvalid 일 때만 렌더
     (D) 한도 셀 가드 — 무효 금액은 isPositiveAmount 가드로 "—"(음수 한도 굵게 표시 차단)
     (E) ★게이트 정합 — 인라인이 무효로 보는 개별 대출금액은 게이트(validateDoc)도 반드시
         차단하고(인라인 오류인데 생성 허용되는 모순 0), 인라인이 안 켜는 값(양수·빈 값)은
         게이트도 그 라벨로 차단하지 않는다(오탐/나그 0).

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-loan-amount-inline.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { blankContractForm } from "../src/lib/engine/model.ts";
import { validateDoc } from "../src/lib/engine/validate.ts";
import { isPositiveAmount } from "../src/lib/engine/calc.ts";

const __dir = dirname(fileURLToPath(import.meta.url));
const src = (rel) => readFileSync(join(__dir, "..", rel), "utf8");
const step = src("src/components/trust/steps/StepLoanCalc.tsx");
const flat = step.replace(/\s+/g, " ");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

console.log("=== 우선수익자 개별 대출금액 인라인 검증 피드백 (StepLoanCalc) ===\n");

console.log("[A] 단일 출처 — 게이트와 같은 isPositiveAmount 를 calc 에서 import");
ok(/import\s*\{[^}]*\bisPositiveAmount\b[^}]*\}\s*from\s*["']@\/lib\/engine\/calc["']/.test(step),
  "StepLoanCalc: isPositiveAmount 를 calc 에서 import");

console.log("\n[B] 인라인 플래그 — loanInvalid = loanFilled && !isPositiveAmount(p.loanAmount)");
ok(/const\s+loanFilled\s*=\s*String\(p\.loanAmount[^)]*\)\.trim\(\)\.length\s*>\s*0/.test(step),
  "loanFilled = 채움 여부(trim>0) — 빈 값 미표시(나그 방지)");
ok(/const\s+loanInvalid\s*=\s*loanFilled\s*&&\s*!isPositiveAmount\(\s*p\.loanAmount\s*\)/.test(step),
  "loanInvalid = loanFilled && !isPositiveAmount(p.loanAmount) — 게이트와 같은 판정");

console.log("\n[C] 배선 — input aria-invalid/describedby(행별 유니크) + 오류 div role=alert");
ok(/aria-invalid=\{loanInvalid \|\| undefined\}/.test(step),
  "input: aria-invalid={loanInvalid || undefined}");
ok(/aria-describedby=\{loanInvalid \? `loan-amount-err-\$\{i\}` : undefined\}/.test(step),
  "input: aria-describedby={loanInvalid ? `loan-amount-err-${i}` : undefined} (행별 유니크)");
ok(/id=\{`loan-amount-err-\$\{i\}`\}[^]*?role="alert"/.test(step),
  "오류 div id=`loan-amount-err-${i}` role=alert");
ok(/\{loanInvalid\s*&&\s*\(/.test(step),
  "오류 div 는 loanInvalid 일 때만 렌더(나그 방지)");

console.log("\n[D] 한도 셀 가드 — 무효 금액은 isPositiveAmount 로 '—'(음수 한도 굵게 표시 차단)");
ok(/\{isPositiveAmount\(p\.loanAmount\) \?/.test(step),
  "우선수익한도금액 셀이 isPositiveAmount(p.loanAmount) 로 가드(음수→'—')");
ok(!/\{parseAmount\(p\.loanAmount\) \?/.test(step),
  "과거 parseAmount(p.loanAmount) ? 가드(음수=truthy→굵게 표시) 제거됨");

console.log("\n[E] 고아 참조 0 — describedby 템플릿 id 와 오류 div 템플릿 id 가 동형");
ok(/aria-describedby=\{loanInvalid \? `loan-amount-err-\$\{i\}`/.test(step) &&
   /id=\{`loan-amount-err-\$\{i\}`\}/.test(step),
  "describedby 가 가리키는 `loan-amount-err-${i}` 가 동명 오류 div 로 실재");

console.log("\n[F] ★게이트 정합 — 인라인 무효 ⟺ 게이트 차단 / 인라인 OFF ⟺ 게이트 미차단");
{
  // 공통 필수를 모두 채우고 우선수익자 2인(1번은 항상 유효, 2번을 단일 변인으로 격리)을 둔다.
  // → 합계는 항상 양수라 "우선수익자 대출금액"(합계) 누락은 안 뜨고, 2번 개별 금액만 검사된다.
  const baseFilled = () => {
    const f = blankContractForm();
    f.trustors[0].name = "주식회사 갑";
    f.priorities[0].name = "을은행";
    f.priorities[0].loanAmount = "5000000000";
    // 2번 우선수익자 추가
    f.priorities.push({ ...f.priorities[0], name: "병은행", loanAmount: "" });
    f.properties[0].address = "서울특별시 강남구 테헤란로 1";
    f.common.year = 2026;
    f.common.month = 6;
    f.common.day = 21;
    f.common.priorityRatio = 120;
    f.common.trustFee = "30000000";
    f.docContents.appform.valuationPrice = "10000000000";
    f.docContents.valReport.principalValue = "8000000000";
    return f;
  };
  const SECOND_LABEL = "우선수익자 2 대출금액 (유효하지 않은 금액)";
  const withSecond = (v) => { const f = baseFilled(); f.priorities[1].loanAmount = v; return f; };
  const hasSecondMiss = (f) => validateDoc(f, "contract").missing.some((m) => m.label === SECOND_LABEL);

  const loanFilled = (v) => String(v ?? "").trim().length > 0;
  const inlineInvalid = (v) => loanFilled(v) && !isPositiveAmount(v);

  // 인라인이 무효로 보는 값(채웠지만 0·음수·비숫자) → 게이트도 그 라벨로 차단(모순 0)
  for (const bad of ["0", "-5000", "-1", "abc", "0.0", "-0.5"]) {
    const f = withSecond(bad);
    ok(inlineInvalid(bad) === true, `인라인 ON: ${JSON.stringify(bad)} → loanInvalid=true`);
    ok(validateDoc(f, "contract").ok === false && hasSecondMiss(f),
      `→ 게이트도 차단·개별 대출금액 안내(정합)`);
  }
  // 인라인이 안 켜는 값(양수·빈 값) → 게이트도 그 라벨로 차단 안 함(오탐/나그 0)
  for (const good of ["5000000000", "1", "100", "1,000,000"]) {
    const f = withSecond(good);
    ok(inlineInvalid(good) === false, `인라인 OFF(양수): ${JSON.stringify(good)} → loanInvalid=false`);
    ok(!hasSecondMiss(f), `→ 게이트도 개별 대출금액 오탐 없음`);
  }
  // 빈 값: 인라인 미표시 + 게이트도 개별 라벨로는 미차단(합계는 1번이 커버)
  {
    const f = withSecond("");
    ok(inlineInvalid("") === false, "인라인 OFF(빈 값): loanInvalid=false (나그 방지)");
    ok(!hasSecondMiss(f), "→ 게이트도 빈 개별 대출금액을 그 라벨로 차단하지 않음(무회귀)");
  }
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
