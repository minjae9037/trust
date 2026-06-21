/* ============================================================
   회귀 가드 — 금액 입력 유효성(가격·원본가액 "유효한 양의 금액" 강제)

   배경(정확성 갭): validateDoc 게이트가 신탁부동산 가격(appform.valuationPrice)·
   신탁재산 원본가액(valReport.principalValue)을 `hasText`(비어있지 않은 문자열)로만
   검사해, "미정"·"0"·"-5000" 같은 값으로도 서류를 생성할 수 있었다. 그런데
     · 빌더는 가격을 `parseFloat(...)||0`로 받아 0/무효면 가격칸을 **빈칸**으로,
       음수는 부호를 떼어 **잘못된 금액**으로 렌더(builders.js valDisplay),
     · 원본가액은 generic 빌더가 **raw text 그대로**(escHTML) 박는다.
   신탁 서류는 법적 효력 문서 — 무효 금액이 산출물에 들어가는 건 명백한 결함.
   → ① calc.isPositiveAmount 신설(parseAmount>0, 모든 금액의 단일 유효성 출처)
     ② validateDoc 가 누락(빈 값)에 더해 0·음수·비숫자도 차단(import·구버전·AI머지 방어)
        — 누락은 '가격/원본가액', 채웠지만 무효는 '… (유효하지 않은 금액)'으로 분류.

   본 가드(조문·엔진·생성 로직 무접촉 — 입력 완결성/유효성만):
     (A) isPositiveAmount: 양수·쉼표허용 참 / 0·음수·비숫자·빈값 거짓
     (B) appform 게이트: 빈값→'신탁부동산 가격'(누락) / 0·음수·"미정"→'(유효하지 않은 금액)'
     (C) valReport 게이트: 빈값→'신탁재산 원본가액'(누락) / 0·음수·"미정"→'(유효하지 않은 금액)'
     (D) 유효 양수(쉼표 포함)는 오탐 없음(ok=true)
     (E) 점프 타깃 = 해당 Doc step 자신(누락·무효 둘 다)
     (F) 회귀: 다른 서류(contract·poa 등)는 금액 무효 항목 영향 없음

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-amount-validity.mjs
   ============================================================ */
import { blankContractForm } from "../src/lib/engine/model.ts";
import { isPositiveAmount } from "../src/lib/engine/calc.ts";
import { validateDoc } from "../src/lib/engine/validate.ts";
import { STEPS } from "../src/lib/engine/schema.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

// 공통 필수 + 체결일까지 모두 채운 양식(가격·원본가액만 케이스별로 바꿔 검사).
function baseFilled() {
  const form = blankContractForm();
  form.trustors[0].name = "주식회사 갑";
  form.priorities[0].name = "을은행";
  form.priorities[0].loanAmount = "5000000000";
  form.properties[0].address = "서울특별시 강남구 테헤란로 1";
  form.common.year = 2026;
  form.common.month = 6;
  form.common.day = 21;
  form.docContents.appform.valuationPrice = "10000000000";
  form.docContents.valReport.principalValue = "8000000000";
  return form;
}
const labelsOf = (form, docId) => validateDoc(form, docId).missing.map((m) => m.label);
const hasInvalidAmount = (form, docId) =>
  labelsOf(form, docId).some((l) => l.includes("유효하지 않은 금액"));

console.log("\n[A] isPositiveAmount — 양의 금액만 참");
{
  ok(isPositiveAmount("10000000000") === true, "양수 = true");
  ok(isPositiveAmount("5,000,000,000") === true, "쉼표 포함 양수 = true(parseAmount 정합)");
  ok(isPositiveAmount(7000000000) === true, "number 양수 = true");
  ok(isPositiveAmount("0") === false, "0 = false");
  ok(isPositiveAmount("-5000") === false, "음수 = false");
  ok(isPositiveAmount("미정") === false, "비숫자('미정') = false");
  ok(isPositiveAmount("") === false, "빈 문자열 = false");
  ok(isPositiveAmount(null) === false, "null = false");
  ok(isPositiveAmount(undefined) === false, "undefined = false");
}

console.log("\n[B] appform 게이트 — 신탁부동산 가격 누락 vs 유효하지 않은 금액");
{
  // 빈값 → '누락'으로 분류(유효하지 않은 금액 아님)
  const empty = baseFilled();
  empty.docContents.appform.valuationPrice = "";
  const el = labelsOf(empty, "appform");
  ok(el.some((l) => l === "신탁부동산 가격"), "빈값 → '신탁부동산 가격'(누락)");
  ok(!el.some((l) => l.includes("유효하지 않은")), "빈값에 '유효하지 않은 금액' 오탐 없음");

  // 0·음수·비숫자 → '유효하지 않은 금액'으로 차단(누락 아님)
  for (const bad of ["0", "-5000", "미정"]) {
    const f = baseFilled();
    f.docContents.appform.valuationPrice = bad;
    const r = validateDoc(f, "appform");
    ok(r.ok === false, `가격="${bad}" → ok=false(생성 차단)`);
    ok(hasInvalidAmount(f, "appform"), `가격="${bad}" → '유효하지 않은 금액' 안내`);
    ok(!labelsOf(f, "appform").some((l) => l === "신탁부동산 가격"), `가격="${bad}" → 누락 오탐 없음`);
  }
}

console.log("\n[C] valReport 게이트 — 신탁재산 원본가액 누락 vs 유효하지 않은 금액");
{
  const empty = baseFilled();
  empty.docContents.valReport.principalValue = "";
  const el = labelsOf(empty, "valReport");
  ok(el.some((l) => l === "신탁재산 원본가액"), "빈값 → '신탁재산 원본가액'(누락)");
  ok(!el.some((l) => l.includes("유효하지 않은")), "빈값에 '유효하지 않은 금액' 오탐 없음");

  for (const bad of ["0", "-1", "미정"]) {
    const f = baseFilled();
    f.docContents.valReport.principalValue = bad;
    const r = validateDoc(f, "valReport");
    ok(r.ok === false, `원본가액="${bad}" → ok=false(생성 차단)`);
    ok(hasInvalidAmount(f, "valReport"), `원본가액="${bad}" → '유효하지 않은 금액' 안내`);
  }
}

console.log("\n[D] 유효한 양수는 오탐 없음(ok=true)");
{
  ok(validateDoc(baseFilled(), "appform").ok === true, "가격 양수 → appform ok=true");
  ok(validateDoc(baseFilled(), "valReport").ok === true, "원본가액 양수 → valReport ok=true");
  // 쉼표 포함 입력도 통과(parseAmount 가 쉼표 제거)
  const comma = baseFilled();
  comma.docContents.appform.valuationPrice = "10,000,000,000";
  comma.docContents.valReport.principalValue = "8,000,000,000";
  ok(validateDoc(comma, "appform").ok === true, "가격 '10,000,000,000'(쉼표) → ok=true");
  ok(validateDoc(comma, "valReport").ok === true, "원본가액 '8,000,000,000'(쉼표) → ok=true");
  ok(!hasInvalidAmount(comma, "appform") && !hasInvalidAmount(comma, "valReport"), "쉼표 금액에 무효 오탐 없음");
}

console.log("\n[E] 점프 타깃 — 무효 금액 안내는 해당 Doc step 자신을 가리킨다");
{
  const appStep = STEPS.find((s) => s.docId === "appform");
  const valStep = STEPS.find((s) => s.docId === "valReport");
  const fa = baseFilled(); fa.docContents.appform.valuationPrice = "0";
  const ma = validateDoc(fa, "appform").missing.find((m) => m.label.includes("유효하지 않은"));
  ok(!!ma && ma.stepIdx === appStep.idx, "appform 무효 금액 점프 타깃 = appform step");
  const fv = baseFilled(); fv.docContents.valReport.principalValue = "0";
  const mv = validateDoc(fv, "valReport").missing.find((m) => m.label.includes("유효하지 않은"));
  ok(!!mv && mv.stepIdx === valStep.idx, "valReport 무효 금액 점프 타깃 = valReport step");
}

console.log("\n[F] 회귀 — 금액 무효는 해당 서류에만 영향(다른 서류 무영향)");
{
  // appform 가격이 무효여도 contract·poa 등 금액 비요구 서류는 영향 없음
  const f = baseFilled();
  f.docContents.appform.valuationPrice = "0";
  ok(validateDoc(f, "contract").ok === true, "appform 가격 무효 → contract ok=true(무영향)");
  ok(validateDoc(f, "poa").ok === true, "appform 가격 무효 → poa ok=true(무영향)");
  ok(validateDoc(f, "appform").ok === false, "appform 자신만 차단");
  // 전부 양수면 7종 전부 ok (기존 readiness 가드와 정합)
  ok(validateDoc(baseFilled(), "contract").ok === true, "전 입력 양수 → contract ok=true");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
