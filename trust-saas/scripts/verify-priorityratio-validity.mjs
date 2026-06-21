/* ============================================================
   회귀 가드 — 우선수익한도 비율(priorityRatio) 유효성 게이트(범위 밖 차단)

   배경(정확성 갭): priorityRatio(우선수익한도 비율, %)는 STEP 02-1 공통 항목으로,
   우선수익한도금액(= 대출금액 × 비율)을 좌우하는 **법적 서류상 핵심 수치**다
   (builders.js: 별첨2/3 한도표·appform 한도표·valReport priorityLimit kvRow). 그러나
   검증 게이트(validateDoc)에 포함되지 않아, 금액 5종(가격·원본가액·개별 대출금액·신탁보수)·
   신탁기간을 게이트화한 뒤에도 **비율만 무방비**였다.
     · UI(StepLoanCalc)는 type=number min=100 max=150 이지만 min/max 는 "타이핑"을 막지 못해
       음수(-50)·범위 밖(200·1200) 값이 그대로 저장될 수 있다(onChange `Number(v) || 120` 은
       0/빈 값만 120 으로 막고 음수·과대값은 통과).
     · import·구버전 저장본·AI 머지로도 범위 밖 비율이 들어올 수 있다.
   → 잘못된 비율이 우선수익한도금액을 음수/과대로 산출해 법적 서류 표에 박힌다
     (가격·대출금액과 동일한 "데이터 정합성" 결함 유형).

   ★영향 점검 — 무회귀:
     빌더는 비율을 `parseFloat(ratio) || 120` 로 사용한다. isValidRatio 도 동일하게
     `parseAmount(v) || 120` 의 결과를 [100,150] 으로 검사하므로:
       · 0·빈 값·비숫자 → 120(기본) → 통과 (빌더와 동일 처리 = 무회귀)
       · model.ts blankContractForm 기본값 120 → 통과
       · 음수·범위 밖 양수(50·200·1200)만 차단
     정상 계약(스피너 100~150)·기본값은 무회귀, 범위 밖 값만 새로 차단한다.

   본 가드(조문·엔진·생성/DOCX 로직 무접촉 — 입력 완결성만):
     (A) 핵심 갭: 음수·범위 밖 비율 → ok=false + '우선수익한도 비율' 안내(생성 차단)
     (B) 무회귀: 기본값(120)·범위 내(100·130·150)·0/빈 값(→120 처리) 은 통과(오탐 없음)
     (C) isValidRatio 단일 출처 — 빌더 `|| 120` 와 정합(경계 100/150 포함, 99/151 차단)
     (D) 점프 타깃 = STEP 02-1(loanCalc)·where 제목 파생
     (E) 필수 공통 검사 — 전 7종 서류 차단(체결일·신탁보수·신탁기간과 동일 일관성)
     (F) 회귀: 다른 게이트(가격·대출금액 등)와 독립 누적·무영향

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-priorityratio-validity.mjs
   ============================================================ */
import { blankContractForm } from "../src/lib/engine/model.ts";
import { validateDoc } from "../src/lib/engine/validate.ts";
import { isValidRatio } from "../src/lib/engine/calc.ts";
import { STEPS } from "../src/lib/engine/schema.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const ALL_DOCS = ["appform", "contract", "poa", "valReport", "boardMin", "cdd", "ubo"];
const RATIO_LABEL = "우선수익한도 비율 (100~150% 범위)";

// 공통 필수(당사자·물건·체결일·금액·기간)를 모두 유효하게 채운 양식 → priorityRatio 단일 변인 격리.
function baseFilled() {
  const form = blankContractForm();
  form.trustors[0].name = "주식회사 갑";
  form.priorities[0].name = "을은행";
  form.priorities[0].loanAmount = "5000000000";
  form.properties[0].address = "서울특별시 강남구 테헤란로 1";
  form.common.year = 2026;
  form.common.month = 6;
  form.common.day = 21;
  form.common.trustFee = "30000000";
  form.docContents.appform.valuationPrice = "10000000000";
  form.docContents.valReport.principalValue = "8000000000";
  return form; // priorityRatio 는 blankContractForm 기본값(120)
}
function withRatio(ratio) {
  const form = baseFilled();
  form.common.priorityRatio = ratio;
  return form;
}
const labelsOf = (form, docId) => validateDoc(form, docId).missing.map((m) => m.label);
const hasRatioMiss = (form, docId) => labelsOf(form, docId).some((l) => l === RATIO_LABEL);

console.log("\n[A] 핵심 갭 — 음수·범위 밖 비율은 차단");
{
  // 음수, 100 미만, 150 초과(과대 포함) — 빌더가 우선수익한도금액을 음수/과대로 산출하는 값들.
  for (const bad of [-50, -1, 50, 99, 151, 200, 1200]) {
    const f = withRatio(bad);
    ok(validateDoc(f, "contract").ok === false, `priorityRatio=${bad} → ok=false(생성 차단)`);
    ok(hasRatioMiss(f, "contract"), `priorityRatio=${bad} → '${RATIO_LABEL}' 안내`);
  }
  // 문자열로 들어온 범위 밖 값(import/AI 머지 방어) — parseAmount 가 쉼표/공백 정규화 후 검사.
  for (const bad of ["-50", "200", "1,200"]) {
    const f = withRatio(bad);
    ok(validateDoc(f, "contract").ok === false, `priorityRatio="${bad}"(문자열) → ok=false`);
  }
}

console.log("\n[B] 무회귀 — 기본값·범위 내·0/빈 값(→120 처리)은 통과(오탐 없음)");
{
  const base = baseFilled();
  ok(base.common.priorityRatio === 120, "blankContractForm 기본 priorityRatio=120(무회귀 전제)");
  ok(validateDoc(base, "contract").ok === true, "baseFilled(기본 120) → ok=true(무회귀 기준선)");
  ok(!hasRatioMiss(base, "contract"), "baseFilled → 비율 오탐 없음");
  // 범위 내 정상값(경계 포함)
  for (const good of [100, 110, 130, 150]) {
    const f = withRatio(good);
    ok(validateDoc(f, "contract").ok === true, `priorityRatio=${good}(범위 내) → ok=true`);
    ok(!hasRatioMiss(f, "contract"), `priorityRatio=${good} → 비율 오탐 없음`);
  }
  // 0·빈 값·비숫자: 빌더가 || 120 으로 기본 처리 → 게이트도 동일하게 통과(무회귀)
  for (const z of [0, "", "abc", null, undefined]) {
    const f = withRatio(z);
    ok(validateDoc(f, "contract").ok === true, `priorityRatio=${JSON.stringify(z)}(→120 처리) → ok=true`);
  }
}

console.log("\n[C] isValidRatio 단일 출처 — 빌더 `|| 120` 정합(경계 100/150 포함, 99/151 차단)");
{
  ok(isValidRatio(100) === true && isValidRatio(150) === true, "경계 100·150 → 유효(포함)");
  ok(isValidRatio(99) === false && isValidRatio(151) === false, "99·151 → 무효(범위 밖)");
  ok(isValidRatio(-50) === false, "음수 → 무효");
  ok(isValidRatio(0) === true && isValidRatio("") === true, "0·빈 값 → 120 처리(유효)");
  ok(isValidRatio(120) === true, "기본 120 → 유효");
}

console.log("\n[D] 점프 타깃 — 비율 누락 안내는 STEP 02-1(우선수익한도금액 산정)을 가리킨다");
{
  const loanStep = STEPS.find((s) => s.key === "loanCalc"); // STEP 02-1
  const f = withRatio(200);
  const m = validateDoc(f, "contract").missing.find((x) => x.label === RATIO_LABEL);
  ok(!!m && m.stepIdx === loanStep.idx, "비율 점프 타깃 = STEP 02-1(loanCalc)");
  ok(!!m && m.where.includes(loanStep.title), "안내 where = STEP 02-1 제목 파생");
}

console.log("\n[E] 필수 공통 검사 — 전 7종 서류 차단(체결일·신탁보수·신탁기간과 동일 일관성)");
{
  const f = withRatio(200);
  for (const docId of ALL_DOCS) {
    ok(validateDoc(f, docId).ok === false, `범위 밖 비율 → ${docId} 차단(공통)`);
    ok(hasRatioMiss(f, docId), `범위 밖 비율 → ${docId} 비율 안내`);
  }
}

console.log("\n[F] 회귀 — 다른 게이트와 독립 누적·무영향");
{
  // 유효 비율이면 7종 전부 ok (다른 게이트 무회귀)
  const fGood = withRatio(130);
  for (const docId of ALL_DOCS) {
    ok(validateDoc(fGood, docId).ok === true, `유효 비율 130 → ${docId} ok=true`);
  }
  // 비율·가격 동시 무효 → 두 안내가 독립적으로 누적(상호 간섭 없음)
  const fBoth = withRatio(200);
  fBoth.docContents.appform.valuationPrice = "-1"; // 가격도 무효
  ok(hasRatioMiss(fBoth, "appform"), "비율·가격 동시 무효 → 비율 안내 존재(appform)");
  ok(labelsOf(fBoth, "appform").some((l) => l.includes("신탁부동산 가격") && l.includes("유효하지 않은 금액")),
    "비율·가격 동시 무효 → 가격 안내도 존재(독립)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
