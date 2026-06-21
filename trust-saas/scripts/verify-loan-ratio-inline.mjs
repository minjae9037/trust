/* ============================================================
   회귀 가드 — 우선수익한도 비율(priorityRatio) 인라인 검증 피드백 (StepLoanCalc)

   배경(접근성·UX·정확성 패리티, 비-산출물): priorityRatio(우선수익한도 비율, %)는
   우선수익한도금액(= 대출금액 × 비율)을 좌우하는 법적 서류상 핵심 수치다. 범위 밖
   (100~150%) 비율은 게이트(validateDoc)가 이미 생성을 차단한다(verify-priorityratio-validity).
   그러나 그 차단을 **입력 지점(StepLoanCalc)에서 즉시 알리지 않으면**, 같은 화면의
   우선수익한도금액 표가 `대출금액 × 비율`로 산출한 잘못된 금액을 굵게 표시해(예: 200%로
   2배 과대) 사용자가 그 값을 신뢰할 위험이 있다 — 무엇이 왜 막혔는지는 Doc 단계 게이트까지
   가야 알 수 있었다(WCAG 3.3.1 오류 식별 / 4.1.2 Name·Role·Value).
   → StepLoanCalc 의 비율 input 옆에 인라인 오류(aria-invalid + aria-describedby +
     role="alert")를 추가. 게이트와 **같은 단일 출처**(isValidRatio)를 재사용해 판정 불일치
     (인라인은 무효라는데 게이트는 통과 같은 모순)를 원천 차단(PartyCard·JointForm 인라인 패리티).

   본 가드(빌더·조문·생성 로직·검증 게이트 판정 무접촉 — 표시/접근성만):
     (A) 단일 출처 — StepLoanCalc 이 게이트와 같은 isValidRatio 를 calc 에서 import
     (B) 인라인 플래그 정의 — ratioInvalid = !isValidRatio(form.common.priorityRatio)
     (C) input — aria-invalid + aria-describedby="loan-priorityRatio-err",
         오류 div id="loan-priorityRatio-err" role="alert"
     (D) 고아 참조 0 — describedby 가 가리키는 id 가 동명 오류 div 로 실재
     (E) ★게이트 정합 — 인라인이 무효로 보는 비율은 게이트(validateDoc)도 반드시 차단하고
         (인라인 오류인데 생성 허용되는 모순 0), 인라인이 안 켜는 값(기본 120·범위 내·
         0/빈 값→120 처리)은 게이트도 통과(오탐/나그 0).

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-loan-ratio-inline.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { blankContractForm } from "../src/lib/engine/model.ts";
import { validateDoc } from "../src/lib/engine/validate.ts";
import { isValidRatio } from "../src/lib/engine/calc.ts";

const __dir = dirname(fileURLToPath(import.meta.url));
const src = (rel) => readFileSync(join(__dir, "..", rel), "utf8");
const step = src("src/components/trust/steps/StepLoanCalc.tsx");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const RATIO_LABEL = "우선수익한도 비율 (100~150% 범위)";

console.log("=== 우선수익한도 비율 인라인 검증 피드백 (StepLoanCalc) ===\n");

console.log("[A] 단일 출처 — 게이트와 같은 isValidRatio 를 calc 에서 import");
ok(/import\s*\{[^}]*\bisValidRatio\b[^}]*\}\s*from\s*["']@\/lib\/engine\/calc["']/.test(step),
  "StepLoanCalc: isValidRatio 를 calc 에서 import");

console.log("\n[B] 인라인 플래그 정의 — ratioInvalid = !isValidRatio(form.common.priorityRatio)");
ok(/const\s+ratioInvalid\s*=\s*!isValidRatio\(\s*form\.common\.priorityRatio\s*\)/.test(step),
  "ratioInvalid = !isValidRatio(form.common.priorityRatio) — 게이트와 같은 판정");

console.log("\n[C] 배선 — input aria-invalid/describedby + 오류 div role=alert");
ok(/aria-invalid=\{ratioInvalid \|\| undefined\}/.test(step),
  "input: aria-invalid={ratioInvalid || undefined}");
ok(/aria-describedby=\{ratioInvalid \? "loan-priorityRatio-err" : undefined\}/.test(step),
  'input: aria-describedby={ratioInvalid ? "loan-priorityRatio-err" : undefined}');
ok(/id="loan-priorityRatio-err"[^>]*role="alert"/.test(step.replace(/\s+/g, " ")),
  '오류 div id="loan-priorityRatio-err" role="alert"');
ok(/\{ratioInvalid\s*&&\s*\(/.test(step),
  "오류 div 는 ratioInvalid 일 때만 렌더(나그 방지)");

console.log("\n[D] 고아 참조 0 — describedby id 가 동명 오류 div 로 실재");
{
  const flat = step.replace(/\s+/g, " ");
  const referenced = [...flat.matchAll(/aria-describedby=\{ratioInvalid \? "([^"]+)"/g)].map((m) => m[1]);
  const defined = new Set([...flat.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  ok(referenced.length > 0 && referenced.every((id) => defined.has(id)),
    `describedby 참조(${referenced.join(",")}) 전부 실재 id`);
}

console.log("\n[E] ★게이트 정합 — 인라인 무효 ⟺ 게이트 차단 / 인라인 OFF ⟺ 게이트 통과");
{
  // 공통 필수를 모두 채워 priorityRatio 만 단일 변인으로 격리(verify-priorityratio-validity 와 동형).
  const baseFilled = () => {
    const f = blankContractForm();
    f.trustors[0].name = "주식회사 갑";
    f.priorities[0].name = "을은행";
    f.priorities[0].loanAmount = "5000000000";
    f.properties[0].address = "서울특별시 강남구 테헤란로 1";
    f.common.year = 2026;
    f.common.month = 6;
    f.common.day = 21;
    f.common.trustFee = "30000000";
    f.docContents.appform.valuationPrice = "10000000000";
    f.docContents.valReport.principalValue = "8000000000";
    return f;
  };
  const withRatio = (r) => { const f = baseFilled(); f.common.priorityRatio = r; return f; };
  const hasRatioMiss = (f) => validateDoc(f, "contract").missing.some((m) => m.label === RATIO_LABEL);

  // 인라인이 무효로 보는 값(범위 밖) → isValidRatio false AND 게이트 차단 + 비율 안내(모순 0)
  for (const bad of [-50, -1, 50, 99, 151, 200, 1200, "-50", "200", "1,200"]) {
    const f = withRatio(bad);
    ok(isValidRatio(bad) === false, `인라인 ON: isValidRatio(${JSON.stringify(bad)})=false`);
    ok(validateDoc(f, "contract").ok === false && hasRatioMiss(f), `→ 게이트도 차단·비율 안내(정합)`);
  }
  // 인라인이 안 켜는 값(범위 내·기본·0/빈→120) → isValidRatio true AND 게이트 통과(오탐 0)
  for (const good of [100, 110, 120, 130, 150, 0, "", "abc", null, undefined]) {
    const f = withRatio(good);
    ok(isValidRatio(good) === true, `인라인 OFF: isValidRatio(${JSON.stringify(good)})=true`);
    ok(validateDoc(f, "contract").ok === true && !hasRatioMiss(f), `→ 게이트도 통과·비율 오탐 없음`);
  }
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
