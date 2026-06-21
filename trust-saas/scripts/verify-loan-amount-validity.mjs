/* ============================================================
   회귀 가드 — 우선수익자 개별 대출금액 유효성("0·음수·비숫자" 차단)

   배경(정확성 갭): validateDoc 게이트는 우선수익자 대출금액을 **합계 some(>0)** 로만
   검사해, 우선수익자가 여러 명일 때 한 명이라도 양수면 통과했다. 그런데 빌더는
   **개별** 대출금액으로 그 사람의 우선수익한도금액을 산출한다:
     · builders.js: limit = (parseFloat(loanAmount)||0) × ratio / 100  (별첨2/3·appform 한도표)
   따라서 [A="100억"(유효), B="-5000"(음수)] 처럼 합계는 양수여도, B의 우선수익한도금액이
   **음수/잘못된 금액**으로 법적 서류 표에 박혔다(가격·원본가액과 동일한 결함 유형).
   → validateDoc 가 합계 검사에 더해, **채웠지만 유효하지 않은(0·음수·비숫자) 개별 대출금액**을
     차단(import·구버전·AI머지 방어). 빈 값은 합계 검사로 충분(미입력 우선수익자는 0 한도 의도 가능).

   본 가드(조문·엔진·생성 로직 무접촉 — 입력 완결성/유효성만):
     (A) 단일 우선수익자: 양수 통과 / 0·음수·비숫자는 합계 검사로 차단(기존 유지)
     (B) 핵심 갭: 합계는 양수지만 개별 무효 → '우선수익자 N 대출금액 (유효하지 않은 금액)' 차단
     (C) 빈 개별 대출금액(미입력)은 무효로 오탐하지 않음(합계 양수면 통과)
     (D) 무효 안내의 점프 타깃 = STEP 02-1(우선수익한도금액 산정)
     (E) 무효 라벨은 1-based 우선수익자 번호로 어느 명인지 식별
     (F) 회귀: 모든 개별 양수면 7종 전부 ok(기존 readiness 가드와 정합)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-loan-amount-validity.mjs
   ============================================================ */
import { blankContractForm, blankParty } from "../src/lib/engine/model.ts";
import { validateDoc } from "../src/lib/engine/validate.ts";
import { STEPS } from "../src/lib/engine/schema.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

// 공통 필수 + 체결일·가격·원본가액까지 모두 채운 양식(우선수익자 대출금액만 케이스별로 변경).
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
// 우선수익자 N명짜리 양식(이름·대출금액 배열로 주입)
function withPriorities(specs) {
  const form = baseFilled();
  form.priorities = specs.map((s, i) => {
    const p = blankParty();
    p.name = s.name ?? `우선수익자${i + 1}`;
    p.loanAmount = s.loan;
    return p;
  });
  return form;
}
const labelsOf = (form, docId) => validateDoc(form, docId).missing.map((m) => m.label);
const hasInvalidLoan = (form, docId) =>
  labelsOf(form, docId).some((l) => l.includes("대출금액") && l.includes("유효하지 않은 금액"));
const hasLoanMissing = (form, docId) =>
  labelsOf(form, docId).some((l) => l === "우선수익자 대출금액");

console.log("\n[A] 단일 우선수익자 — 합계 검사(기존) 유지");
{
  ok(validateDoc(withPriorities([{ loan: "5000000000" }]), "contract").ok === true, "양수 → ok=true");
  // 단일 음수/0: 합계 some(>0) 실패 → 기존 '우선수익자 대출금액'(누락성) 안내로 차단
  for (const bad of ["0", "-5000", "미정", ""]) {
    const f = withPriorities([{ loan: bad }]);
    ok(validateDoc(f, "contract").ok === false, `단일 대출금액="${bad}" → ok=false(차단)`);
    ok(hasLoanMissing(f, "contract"), `단일 대출금액="${bad}" → '우선수익자 대출금액' 안내`);
  }
}

console.log("\n[B] 핵심 갭 — 합계는 양수지만 개별 우선수익자 대출금액이 무효");
{
  for (const bad of ["0", "-5000", "미정", "-0.01"]) {
    // [유효 100억, 무효 bad] → 합계 양수(some>0) 통과하나 2번 우선수익자 무효
    const f = withPriorities([{ loan: "10000000000" }, { loan: bad }]);
    ok(validateDoc(f, "contract").ok === false, `[유효, "${bad}"] → ok=false(생성 차단)`);
    ok(hasInvalidLoan(f, "contract"), `[유효, "${bad}"] → '유효하지 않은 금액' 안내`);
    ok(!hasLoanMissing(f, "contract"), `[유효, "${bad}"] → 합계 누락 오탐 없음`);
    // 무효 라벨은 2번 우선수익자를 가리킨다(1-based)
    ok(labelsOf(f, "contract").some((l) => l.includes("우선수익자 2 대출금액")), `[유효, "${bad}"] → '우선수익자 2' 식별`);
  }
  // 다수 무효 → 각 우선수익자별 안내(무효 2건)
  const multi = withPriorities([{ loan: "10000000000" }, { loan: "-1" }, { loan: "0" }]);
  const invalids = labelsOf(multi, "contract").filter((l) => l.includes("유효하지 않은 금액"));
  ok(invalids.length === 2, "무효 2명 → 무효 안내 2건(각 우선수익자별)");
  ok(invalids.some((l) => l.includes("우선수익자 2")) && invalids.some((l) => l.includes("우선수익자 3")), "무효 안내가 2·3번 우선수익자 식별");
}

console.log("\n[C] 빈 개별 대출금액(미입력)은 무효로 오탐하지 않음");
{
  // [유효 100억, 빈값] → 합계 양수 + 빈값은 무효 아님(미입력 우선수익자는 0 한도 의도 가능)
  const f = withPriorities([{ loan: "10000000000" }, { loan: "" }]);
  ok(validateDoc(f, "contract").ok === true, "[유효, 빈값] → ok=true(빈 개별 금액 허용)");
  ok(!hasInvalidLoan(f, "contract"), "[유효, 빈값] → '유효하지 않은 금액' 오탐 없음");
  // 쉼표 포함 양수도 무효 오탐 없음
  const comma = withPriorities([{ loan: "10,000,000,000" }, { loan: "5,000,000,000" }]);
  ok(validateDoc(comma, "contract").ok === true, "[쉼표양수, 쉼표양수] → ok=true");
  ok(!hasInvalidLoan(comma, "contract"), "쉼표 금액에 무효 오탐 없음");
}

console.log("\n[D] 점프 타깃 — 무효 개별 대출금액 안내는 STEP 02-1을 가리킨다");
{
  const loanStep = STEPS.find((s) => s.key === "loanCalc"); // STEP 02-1
  const f = withPriorities([{ loan: "10000000000" }, { loan: "-5000" }]);
  const m = validateDoc(f, "contract").missing.find((x) => x.label.includes("유효하지 않은 금액"));
  ok(!!m && m.stepIdx === loanStep.idx, "무효 대출금액 점프 타깃 = STEP 02-1(loanCalc)");
  ok(!!m && m.where.includes(loanStep.title), "안내 where = STEP 02-1 제목 파생");
}

console.log("\n[E] 무효는 공통 검사 — 우선수익한도금액 비표시 서류에도 차단(합계 규칙과 동일 일관성)");
{
  // 기존 합계 '우선수익자 대출금액'도 commonMissing(전 서류 공통)이므로, 개별 무효도 공통으로
  // 전 서류를 차단해 데이터 일관성을 지킨다(우선수익한도표는 contract·appform에만 있으나
  // loanAmount 는 핵심 당사자 데이터 — 무효면 전체 데이터셋이 무효).
  const f = withPriorities([{ loan: "10000000000" }, { loan: "-5000" }]);
  for (const docId of ["appform", "contract", "poa", "valReport", "boardMin", "cdd", "ubo"]) {
    ok(validateDoc(f, docId).ok === false, `개별 무효 → ${docId} 차단(공통)`);
  }
}

console.log("\n[F] 회귀 — 모든 개별 양수면 7종 전부 ok");
{
  const f = withPriorities([{ loan: "10000000000" }, { loan: "5000000000" }]);
  for (const docId of ["appform", "contract", "poa", "valReport", "boardMin", "cdd", "ubo"]) {
    ok(validateDoc(f, docId).ok === true, `전 개별 양수 → ${docId} ok=true`);
  }
  // 기존 baseFilled(단일 우선수익자 양수)도 무회귀
  ok(validateDoc(baseFilled(), "contract").ok === true, "baseFilled(단일 양수) → contract ok=true(무회귀)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
