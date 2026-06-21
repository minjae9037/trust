/* ============================================================
   회귀 가드 — 신탁기간(trustPeriod) 필수 입력 게이트(빈 값 차단)

   배경(정확성 갭): trustPeriod(신탁기간)는 STEP 04 공통 항목으로 UI(StepBasic)에 `*` 필수
   표기지만, 검증 게이트(validateDoc)에 포함되지 않은 **마지막 필수 공통 항목**이었다.
   빌더(builders.js)는 빈 trustPeriod를:
     · valReport kvRow: `c.trustPeriod || ""` → 법적 서류(원본가액신고서)에 신탁기간을 **빈칸**으로
       (placeholder/미입력 표기 없이 무표시 공백) 렌더
     · appform: `f.common.trustPeriod || "신탁등기일로부터 우선수익자채권변제시까지"` → 사용자가
       입력하지 않은 **하드코딩 기간 문구로 대체** 렌더(사용자가 선택하지 않은 조문이 들어감)
   즉 신탁기간을 비워도 게이트를 통과해 "사용자가 선택하지 않은/빈" 신탁기간이 산출물에 들어갔다
   (가격·원본가액·체결일·신탁보수와 동일한 "존재 검사 누락" 결함 유형).

   ★영향 점검 — 빈 값을 차단해도 무회귀:
     trustFee는 빌더가 "[ ] — 신탁보수 미입력 (STEP 04)"로 명시 렌더해 빈 값을 허용했으나,
     trustPeriod는 valReport에 명시 placeholder 없이 빈칸으로만 렌더된다. 또한 model.ts
     blankContractForm 의 기본 trustPeriod 가 비어있지 않으므로(신규·기존 정상 계약은 채워짐),
     "빈 신탁기간"은 애초에 올바른 적이 없는 상태다 → 빈 값을 차단해도 정상 계약 무회귀.

   본 가드(조문·엔진·생성 로직 무접촉 — 입력 완결성만):
     (A) 핵심 갭: 빈/공백 신탁기간 → ok=false + '신탁기간' 누락 안내(생성 차단)
     (B) 무회귀 기준선: 기본값(blankContractForm)·임의 채운 값은 ok=true(오탐 없음)
     (C) 자유 텍스트 — "존재"만 검사(형식 강제 없음): 임의 비표준 문자열도 통과
     (D) 점프 타깃 = STEP 04(계약 기본 정보)·where 제목 파생
     (E) 필수 공통 검사 — 전 7종 서류 차단(체결일·신탁보수와 동일 일관성)
     (F) 회귀: 다른 게이트(가격·원본가액·신탁보수) 정합(trustPeriod 외 무영향)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-trustperiod-validity.mjs
   ============================================================ */
import { blankContractForm } from "../src/lib/engine/model.ts";
import { validateDoc } from "../src/lib/engine/validate.ts";
import { STEPS } from "../src/lib/engine/schema.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const ALL_DOCS = ["appform", "contract", "poa", "valReport", "boardMin", "cdd", "ubo"];

// 공통 필수(당사자·물건·체결일)를 모두 유효하게 채운 양식 → trustPeriod 단일 변인 격리.
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
  return form; // trustPeriod 는 blankContractForm 기본값(비어있지 않음)
}
function withPeriod(period) {
  const form = baseFilled();
  form.common.trustPeriod = period;
  return form;
}
const labelsOf = (form, docId) => validateDoc(form, docId).missing.map((m) => m.label);
const hasPeriodMiss = (form, docId) => labelsOf(form, docId).some((l) => l === "신탁기간");

console.log("\n[A] 핵심 갭 — 빈/공백 신탁기간은 차단");
{
  for (const bad of ["", "   ", "\t"]) {
    const f = withPeriod(bad);
    ok(validateDoc(f, "contract").ok === false, `trustPeriod=${JSON.stringify(bad)} → ok=false(생성 차단)`);
    ok(hasPeriodMiss(f, "contract"), `trustPeriod=${JSON.stringify(bad)} → '신탁기간' 누락 안내`);
  }
}

console.log("\n[B] 무회귀 기준선 — 기본값·임의 채운 값은 ok=true(오탐 없음)");
{
  // blankContractForm 기본 trustPeriod 가 비어있지 않아 baseFilled 자체가 통과해야 함
  const base = baseFilled();
  ok(typeof base.common.trustPeriod === "string" && base.common.trustPeriod.trim().length > 0,
    "blankContractForm 기본 trustPeriod 가 비어있지 않음(무회귀 전제)");
  ok(validateDoc(base, "contract").ok === true, "baseFilled(기본 신탁기간) → ok=true(무회귀 기준선)");
  ok(!hasPeriodMiss(base, "contract"), "baseFilled → 신탁기간 오탐 없음");
  const f = withPeriod("담보신탁 등기일로부터 우선수익자 채권 변제시까지");
  ok(validateDoc(f, "contract").ok === true, "표준 신탁기간 문구 → ok=true");
}

console.log("\n[C] 자유 텍스트 — '존재'만 검사(형식 강제 없음)");
{
  // 신탁기간은 자유 텍스트(예: 'X년', '등기일로부터 Y까지')이므로 비표준 문자열도 통과해야 한다.
  for (const free of ["3년", "2026-06-21 ~ 2031-06-20", "임의문구"]) {
    const f = withPeriod(free);
    ok(validateDoc(f, "contract").ok === true, `trustPeriod="${free}"(비표준) → ok=true(형식 강제 없음)`);
    ok(!hasPeriodMiss(f, "contract"), `trustPeriod="${free}" → 신탁기간 오탐 없음`);
  }
}

console.log("\n[D] 점프 타깃 — 신탁기간 누락 안내는 STEP 04(계약 기본 정보)를 가리킨다");
{
  const basicStep = STEPS.find((s) => s.key === "basic"); // STEP 04
  const f = withPeriod("");
  const m = validateDoc(f, "contract").missing.find((x) => x.label === "신탁기간");
  ok(!!m && m.stepIdx === basicStep.idx, "신탁기간 점프 타깃 = STEP 04(basic)");
  ok(!!m && m.where.includes(basicStep.title), "안내 where = STEP 04 제목 파생");
}

console.log("\n[E] 필수 공통 검사 — 전 7종 서류 차단(체결일·신탁보수와 동일 일관성)");
{
  const f = withPeriod("");
  for (const docId of ALL_DOCS) {
    ok(validateDoc(f, docId).ok === false, `빈 신탁기간 → ${docId} 차단(공통)`);
  }
}

console.log("\n[F] 회귀 — 다른 게이트(가격·원본가액·신탁보수) 무영향");
{
  // 유효 신탁기간이면 7종 전부 ok (다른 게이트 무회귀)
  const fGood = withPeriod("3년");
  for (const docId of ALL_DOCS) {
    ok(validateDoc(fGood, docId).ok === true, `유효 신탁기간 → ${docId} ok=true`);
  }
  // 신탁기간·가격 동시 무효 → 두 안내가 독립적으로 누적(상호 간섭 없음)
  const fBoth = withPeriod("");
  fBoth.docContents.appform.valuationPrice = "-1"; // 가격도 무효
  ok(hasPeriodMiss(fBoth, "appform"), "신탁기간·가격 동시 무효 → 신탁기간 안내 존재(appform)");
  ok(labelsOf(fBoth, "appform").some((l) => l.includes("신탁부동산 가격") && l.includes("유효하지 않은 금액")),
    "신탁기간·가격 동시 무효 → 가격 안내도 존재(독립)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
