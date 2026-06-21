/* ============================================================
   회귀 가드 — 신탁보수(trustFee) 인라인 검증 피드백 (StepBasic)

   배경(접근성·UX·정확성 패리티, 비-산출물): 신탁보수는 별첨3 보수액·신탁보수율 자동산정에
   쓰이는 법적 서류상 금액이다. "채웠지만 0·음수·비숫자"인 신탁보수는 게이트(validateDoc)가
   이미 생성을 차단한다(verify-trustfee-validity: 빌더가 ₩-5,000.- 같은 잘못된 금액을 박는 것 방지).
   그러나 그 차단을 **입력 지점(StepBasic)에서 즉시 알리지 않으면**, 같은 화면의 요약·보수율이
   잘못된 값으로 보이고 무엇이 왜 막혔는지는 Doc 단계 게이트까지 가야 알 수 있었다
   (WCAG 3.3.1 오류 식별 / 4.1.2 Name·Role·Value).
   → StepBasic 의 신탁보수 input 옆에 인라인 오류(aria-invalid + aria-describedby +
     role="alert")를 추가. 게이트와 **같은 단일 출처**(isPositiveAmount)와 같은 "채움" 조건
     (hasText = typeof string && trim().length>0)을 재사용해 판정 불일치(인라인은 무효라는데
     게이트는 통과 같은 모순)를 원천 차단(StepLoanCalc 비율·PartyCard·JointForm 인라인 패리티).

   본 가드(빌더·조문·생성 로직·검증 게이트 판정 무접촉 — 표시/접근성만):
     (A) 단일 출처 — StepBasic 이 게이트와 같은 isPositiveAmount 를 calc 에서 import
     (B) 인라인 플래그 정의 — feeFilled(채움) && !isPositiveAmount(c.trustFee)
     (C) input — aria-invalid + aria-describedby="basic-trustFee-err",
         오류 div id="basic-trustFee-err" role="alert"
     (D) 고아 참조 0 — describedby 가 가리키는 id 가 동명 오류 div 로 실재
     (E) ★게이트 정합 — 인라인이 무효로 보는 값은 게이트(validateDoc)도 반드시 차단하고
         (인라인 오류인데 생성 허용되는 모순 0), 인라인이 안 켜는 값(빈 값·공백·유효 금액)은
         게이트도 신탁보수 차단을 하지 않음(오탐/나그 0).
     (F) ★표시 정합 — 같은 화면 요약의 신탁보수 에코가 feeInvalid 일 때 억제("—")된다.
         fmtKRW 은 음수를 "-5,000,000 원"으로 그대로 렌더하므로, 인라인 오류와 모순되는
         "확신 있어 보이는 잘못된 값"이 남지 않도록 feeInvalid 단일 출처로 가린다
         (StepLoanCalc 무효 비율 시 한도금액 표시 억제와 동형).

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-trustfee-inline.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { blankContractForm } from "../src/lib/engine/model.ts";
import { validateDoc } from "../src/lib/engine/validate.ts";
import { isPositiveAmount } from "../src/lib/engine/calc.ts";

const __dir = dirname(fileURLToPath(import.meta.url));
const src = (rel) => readFileSync(join(__dir, "..", rel), "utf8");
const step = src("src/components/trust/steps/StepBasic.tsx");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const FEE_LABEL = "신탁보수 (유효하지 않은 금액)";

console.log("=== 신탁보수 인라인 검증 피드백 (StepBasic) ===\n");

console.log("[A] 단일 출처 — 게이트와 같은 isPositiveAmount 를 calc 에서 import");
ok(/import\s*\{[^}]*\bisPositiveAmount\b[^}]*\}\s*from\s*["']@\/lib\/engine\/calc["']/.test(step),
  "StepBasic: isPositiveAmount 를 calc 에서 import");

console.log("\n[B] 인라인 플래그 정의 — 채움 && !isPositiveAmount(c.trustFee)");
ok(/const\s+feeFilled\s*=\s*typeof\s+c\.trustFee\s*===\s*"string"\s*&&\s*c\.trustFee\.trim\(\)\.length\s*>\s*0/.test(step),
  "feeFilled = 게이트 hasText 와 동일(typeof string && trim().length>0)");
ok(/const\s+feeInvalid\s*=\s*feeFilled\s*&&\s*!isPositiveAmount\(\s*c\.trustFee\s*\)/.test(step),
  "feeInvalid = feeFilled && !isPositiveAmount(c.trustFee) — 게이트와 같은 판정");

console.log("\n[C] 배선 — input aria-invalid/describedby + 오류 div role=alert");
ok(/aria-invalid=\{feeInvalid \|\| undefined\}/.test(step),
  "input: aria-invalid={feeInvalid || undefined}");
ok(/aria-describedby=\{feeInvalid \? "basic-trustFee-err" : undefined\}/.test(step),
  'input: aria-describedby={feeInvalid ? "basic-trustFee-err" : undefined}');
ok(/id="basic-trustFee-err"[^>]*role="alert"/.test(step.replace(/\s+/g, " ")),
  '오류 div id="basic-trustFee-err" role="alert"');
ok(/\{feeInvalid\s*&&\s*\(/.test(step),
  "오류 div 는 feeInvalid 일 때만 렌더(나그 방지)");

console.log("\n[D] 고아 참조 0 — describedby id 가 동명 오류 div 로 실재");
{
  const flat = step.replace(/\s+/g, " ");
  const referenced = [...flat.matchAll(/aria-describedby=\{feeInvalid \? "([^"]+)"/g)].map((m) => m[1]);
  const defined = new Set([...flat.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  ok(referenced.length > 0 && referenced.every((id) => defined.has(id)),
    `describedby 참조(${referenced.join(",")}) 전부 실재 id`);
}

console.log("\n[E] ★게이트 정합 — 인라인 무효 ⟺ 게이트 차단 / 인라인 OFF ⟺ 게이트 무차단");
{
  // 신탁보수만 단일 변인으로 격리하기 위해 그 외 공통 필수를 모두 채운다
  // (verify-trustfee-validity / verify-loan-ratio-inline 과 동형).
  const baseFilled = () => {
    const f = blankContractForm();
    f.trustors[0].name = "주식회사 갑";
    f.priorities[0].name = "을은행";
    f.priorities[0].loanAmount = "5000000000";
    f.properties[0].address = "서울특별시 강남구 테헤란로 1";
    f.common.year = 2026;
    f.common.month = 6;
    f.common.day = 21;
    f.common.priorityRatio = 120;
    f.common.trustPeriod = "담보신탁 등기일로부터";
    f.docContents.appform.valuationPrice = "10000000000";
    f.docContents.valReport.principalValue = "8000000000";
    return f;
  };
  const withFee = (v) => { const f = baseFilled(); f.common.trustFee = v; return f; };
  // 인라인의 "채움" 조건과 동일 — 컴포넌트가 신뢰하는 단일 출처를 그대로 재현
  const feeFilled = (v) => typeof v === "string" && v.trim().length > 0;
  const feeInvalidInline = (v) => feeFilled(v) && !isPositiveAmount(v);
  const hasFeeMiss = (f) => validateDoc(f, "contract").missing.some((m) => m.label === FEE_LABEL);

  // 인라인이 무효로 보는 값(채웠지만 0·음수·비숫자) → 게이트도 반드시 신탁보수 차단(모순 0)
  for (const bad of ["0", "-1", "-5000000", "abc", "0원", "-50,000"]) {
    ok(feeInvalidInline(bad) === true, `인라인 ON: feeInvalid(${JSON.stringify(bad)})=true`);
    ok(hasFeeMiss(withFee(bad)) === true, `→ 게이트도 신탁보수 차단(정합)`);
  }
  // 인라인이 안 켜는 값(빈 값·공백 = 미채움, 유효 금액) → 게이트도 신탁보수 차단 없음(오탐/나그 0)
  for (const good of ["", "   ", "50000000", "30,000,000", "1"]) {
    ok(feeInvalidInline(good) === false, `인라인 OFF: feeInvalid(${JSON.stringify(good)})=false`);
    ok(hasFeeMiss(withFee(good)) === false, `→ 게이트도 신탁보수 차단 없음(오탐/나그 0)`);
  }
}

console.log("\n[F] ★표시 정합 — 요약의 신탁보수 에코가 feeInvalid 일 때 억제(\"—\")");
{
  const flat = step.replace(/\s+/g, " ");
  // 요약 footer 가 신탁보수를 feeInvalid 단일 출처로 분기 — 무효면 "—", 아니면 fmtKRW(c.trustFee)
  ok(/신탁보수 \{feeInvalid \? "—" : fmtKRW\(c\.trustFee\)\}/.test(flat),
    '요약: 신탁보수 {feeInvalid ? "—" : fmtKRW(c.trustFee)} (무효 시 음수 금액 미표시)');
  // 무방비 원시 에코(feeInvalid 가드 없는 `신탁보수 {fmtKRW(c.trustFee)}`)가 잔존하지 않음
  ok(!/신탁보수 \{fmtKRW\(c\.trustFee\)\}/.test(flat),
    "요약: 무방비 신탁보수 {fmtKRW(c.trustFee)} 에코(가드 없음) 잔존 0");
  // 표시 억제 판정이 인라인 오류와 동일 단일 출처(feeInvalid)임을 재확인 — 표시/인라인 모순 0
  ok(/const feeInvalid =/.test(flat),
    "요약 억제와 인라인 오류가 같은 feeInvalid 단일 출처 사용(판정 불일치 0)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
