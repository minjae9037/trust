/* ============================================================
   회귀 가드 — 신탁보수(trustFee) 유효성("채웠지만 0·음수·비숫자" 차단, 빈 값 허용)

   배경(정확성 갭 + 영향 점검): trustFee(신탁보수)는 STEP 04 공통 항목으로 UI에 `*` 필수
   표기지만 검증 게이트에는 포함되지 않았다. 빌더(builders.js)는 trustFee 값을 그대로 받아:
     · 별첨3 보수액: a3.feeAmount = c.trustFee || "" → 채워졌으면 fmtAmountKRW(feeAmount)
       → "-5000" 이면 "₩-5,000.-" 같은 잘못된 금액을 법적 서류에 렌더
     · valReport kvRow: fmtKRW(c.trustFee) → "-5,000 원"
   즉 "0·음수·비숫자"를 넣어도 게이트를 통과해 산출물이 오염됐다(가격·원본가액·개별 대출금액과
   동일한 "존재만 검사·유효성 미검사" 결함 유형).

   ★영향 점검 — 빈 값은 일부러 차단하지 않는다:
     빌더는 빈 trustFee를 "[ ] — 신탁보수 미입력 (STEP 04)"로 **명시 렌더**(잘못된 금액 아님).
     빈 trustFee로 생성되던 기존 계약을 새로 막으면 회귀이므로, 빈 값은 허용하고
     **채웠지만 유효하지 않은(0·음수·비숫자) 금액만** 차단한다(무회귀로 정확성 결함만 마감).

   본 가드(조문·엔진·생성 로직 무접촉 — 입력 유효성만):
     (A) isPositiveAmount 단일 출처 정합(양수·쉼표양수 true / 0·음수·비숫자 false)
     (B) 핵심 갭: 채웠지만 무효(0·음수·"미정"·-0.01) → '신탁보수 (유효하지 않은 금액)' 차단
     (C) 빈 값(미입력)은 무효로 오탐하지 않음 — 빈 trustFee 계약 무회귀(영향 점검 핵심)
     (D) 유효 양수(쉼표 포함)는 오탐 없이 ok=true
     (E) 무효 안내의 점프 타깃 = STEP 04(계약 기본 정보)
     (F) 무효는 공통 검사 — 전 7종 서류 차단(체결일·개별 대출금액과 동일 일관성)
     (G) 회귀: 가격·원본가액·체결일 정합(trustFee 외 다른 금액 게이트 무영향)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-trustfee-validity.mjs
   ============================================================ */
import { blankContractForm } from "../src/lib/engine/model.ts";
import { validateDoc } from "../src/lib/engine/validate.ts";
import { isPositiveAmount } from "../src/lib/engine/calc.ts";
import { STEPS } from "../src/lib/engine/schema.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

// 공통 필수 + 체결일·가격·원본가액·대출금액까지 모두 유효하게 채운 양식
// (trustFee 만 케이스별로 변경 → trustFee 단일 변인 격리).
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
function withFee(fee) {
  const form = baseFilled();
  form.common.trustFee = fee;
  return form;
}
const labelsOf = (form, docId) => validateDoc(form, docId).missing.map((m) => m.label);
const hasInvalidFee = (form, docId) =>
  labelsOf(form, docId).some((l) => l.includes("신탁보수") && l.includes("유효하지 않은 금액"));

console.log("\n[A] isPositiveAmount 단일 출처 정합");
{
  for (const v of ["10000000", "10,000,000", " 5000 "]) ok(isPositiveAmount(v) === true, `isPositiveAmount("${v}")=true`);
  for (const v of ["0", "-5000", "미정", "", "-0.01", null, undefined]) ok(isPositiveAmount(v) === false, `isPositiveAmount(${JSON.stringify(v)})=false`);
}

console.log("\n[B] 핵심 갭 — 채웠지만 유효하지 않은 신탁보수는 차단");
{
  for (const bad of ["0", "-5000", "미정", "-0.01"]) {
    const f = withFee(bad);
    ok(validateDoc(f, "contract").ok === false, `trustFee="${bad}" → ok=false(생성 차단)`);
    ok(hasInvalidFee(f, "contract"), `trustFee="${bad}" → '신탁보수 (유효하지 않은 금액)' 안내`);
  }
}

console.log("\n[C] 빈 값(미입력)은 무효로 오탐하지 않음 — 빈 trustFee 계약 무회귀(영향 점검 핵심)");
{
  const f = withFee("");
  ok(validateDoc(f, "contract").ok === true, 'trustFee="" → ok=true(빈 값 허용)');
  ok(!hasInvalidFee(f, "contract"), 'trustFee="" → 무효 오탐 없음');
  // blankContractForm 기본 trustFee 도 "" 이므로 baseFilled 자체가 빈 trustFee 로 ok 여야 함
  ok(validateDoc(baseFilled(), "contract").ok === true, "baseFilled(기본 빈 trustFee) → ok=true(무회귀 기준선)");
}

console.log("\n[D] 유효 양수(쉼표 포함)는 오탐 없이 ok=true");
{
  for (const good of ["10000000", "10,000,000", "1"]) {
    const f = withFee(good);
    ok(validateDoc(f, "contract").ok === true, `trustFee="${good}" → ok=true`);
    ok(!hasInvalidFee(f, "contract"), `trustFee="${good}" → 무효 오탐 없음`);
  }
}

console.log("\n[E] 점프 타깃 — 무효 신탁보수 안내는 STEP 04(계약 기본 정보)를 가리킨다");
{
  const basicStep = STEPS.find((s) => s.key === "basic"); // STEP 04
  const f = withFee("-5000");
  const m = validateDoc(f, "contract").missing.find((x) => x.label.includes("신탁보수"));
  ok(!!m && m.stepIdx === basicStep.idx, "무효 신탁보수 점프 타깃 = STEP 04(basic)");
  ok(!!m && m.where.includes(basicStep.title), "안내 where = STEP 04 제목 파생");
}

console.log("\n[F] 무효는 공통 검사 — 전 7종 서류 차단(체결일·개별 대출금액과 동일 일관성)");
{
  // trustFee 는 form.common 항목으로 별첨3(contract)·valReport 에 렌더되나, 핵심 공통 데이터이므로
  // 무효면 전체 데이터셋이 무효 — commonMissing 으로 전 서류를 차단한다(체결일·loanAmount 와 동일).
  const f = withFee("-5000");
  for (const docId of ["appform", "contract", "poa", "valReport", "boardMin", "cdd", "ubo"]) {
    ok(validateDoc(f, docId).ok === false, `무효 신탁보수 → ${docId} 차단(공통)`);
  }
}

console.log("\n[G] 회귀 — 다른 금액 게이트(가격·원본가액·체결일) 무영향");
{
  // 유효 trustFee 면 7종 전부 ok (다른 게이트 무회귀)
  const fGood = withFee("10000000");
  for (const docId of ["appform", "contract", "poa", "valReport", "boardMin", "cdd", "ubo"]) {
    ok(validateDoc(fGood, docId).ok === true, `유효 신탁보수 → ${docId} ok=true`);
  }
  // trustFee 무효라도 다른 무효(가격) 게이트는 독립적으로 동작(중복 안내 누적, contract 본문은 가격 무관)
  const fBoth = withFee("-5000");
  fBoth.docContents.appform.valuationPrice = "-1"; // 가격도 무효
  ok(hasInvalidFee(fBoth, "appform"), "trustFee·가격 동시 무효 → 신탁보수 안내 존재(appform)");
  ok(labelsOf(fBoth, "appform").some((l) => l.includes("신탁부동산 가격") && l.includes("유효하지 않은 금액")), "trustFee·가격 동시 무효 → 가격 안내도 존재(독립)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
