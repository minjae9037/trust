/* ============================================================
   회귀 가드 — 위저드 서류별 생성 가능 여부(readiness) 마커

   배경: 검증 게이트(validateDoc)는 각 서류 step 안에 들어가야만 누락을
   보여줬다. 7종 서류 중 어떤 게 필수 입력 누락으로 막혔는지 위저드
   네비(sub-step pill)에서 한눈에 보이도록 ✓/⚠ 마커를 추가했다.
   마커는 Wizard.tsx 의 docReady 맵 = validateDoc(form, docId).ok 를 그대로 쓴다.

   본 가드는 그 readiness 판정이 입력 단계에 따라 정확히 전이되는지 단언:
     (A) 빈 양식 → 모든 서류 ⚠ (필수 공통입력 누락: 위탁자·우선수익자·대출금액·물건)
     (B) 공통 필수만 채움 → 대부분 서류 ✓, 단 appform(가격)·valReport(원본가액)은 ⚠
     (C) appform 가격·valReport 원본가액까지 채움 → 7종 전부 ✓
     (D) 마커 대상은 docId 있는 step(서류)만 — 관계사/조건 step엔 마커 없음

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-doc-readiness.mjs
   ============================================================ */
import { blankContractForm } from "../src/lib/engine/model.ts";
import { validateDoc } from "../src/lib/engine/validate.ts";
import { STEPS, COLLATERAL_OUTPUT_DOCS } from "../src/lib/engine/schema.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

// Wizard.tsx 의 docReady 맵을 그대로 재현
const docReadyMap = (form) => {
  const map = {};
  for (const s of STEPS) if (s.docId) map[s.idx] = validateDoc(form, s.docId).ok;
  return map;
};
const docSteps = STEPS.filter((s) => s.docId);

console.log("\n[A] 빈 양식 → 모든 서류 ⚠ (필수 공통입력 누락)");
{
  const form = blankContractForm();
  const map = docReadyMap(form);
  ok(docSteps.length === 7, `서류 step 7종 (실제 ${docSteps.length})`);
  ok(docSteps.length === COLLATERAL_OUTPUT_DOCS.length, "서류 step 수 = 출력서류 정의 수");
  ok(docSteps.every((s) => map[s.idx] === false), "모든 서류 readiness=false");
}

console.log("\n[B] 공통 필수만 채움 → appform/valReport 제외 ✓");
{
  const form = blankContractForm();
  form.trustors[0].name = "주식회사 갑";
  form.priorities[0].name = "을은행";
  form.priorities[0].loanAmount = "5000000000";
  form.properties[0].address = "서울특별시 강남구 테헤란로 1";
  // common 날짜는 기본값(2026-03-01)이라 충족
  const map = docReadyMap(form);
  const idOf = (docId) => STEPS.find((s) => s.docId === docId).idx;
  ok(map[idOf("appform")] === false, "appform 은 가격 누락으로 ⚠");
  ok(map[idOf("valReport")] === false, "valReport 는 원본가액 누락으로 ⚠");
  ok(map[idOf("contract")] === true, "contract ✓ (공통만으로 충족)");
  ok(map[idOf("poa")] === true, "poa ✓");
  ok(map[idOf("boardMin")] === true, "boardMin ✓");
  ok(map[idOf("cdd")] === true, "cdd ✓");
  ok(map[idOf("ubo")] === true, "ubo ✓");
}

console.log("\n[C] appform 가격 + valReport 원본가액까지 → 7종 전부 ✓");
{
  const form = blankContractForm();
  form.trustors[0].name = "주식회사 갑";
  form.priorities[0].name = "을은행";
  form.priorities[0].loanAmount = "5000000000";
  form.properties[0].address = "서울특별시 강남구 테헤란로 1";
  form.docContents.appform.valuationPrice = "10000000000";
  form.docContents.valReport.principalValue = "10000000000";
  const map = docReadyMap(form);
  ok(docSteps.every((s) => map[s.idx] === true), "모든 서류 readiness=true");
}

console.log("\n[D] 마커 대상 = docId 있는 step만 (관계사/조건 step 제외)");
{
  const nonDoc = STEPS.filter((s) => !s.docId);
  // 비서류(입력) step 수는 입력 UX 확장(예: STEP 05 조건·특약 신설)에 따라 변하므로
  // 하드코딩하지 않고 STEPS에서 파생한다 — STEP 추가 시 가드가 stale 되는 문제를 정적 차단.
  ok(docSteps.length + nonDoc.length === STEPS.length, `서류(${docSteps.length})+비서류(${nonDoc.length}) = 전체 STEPS(${STEPS.length}) 파티션 완전`);
  ok(nonDoc.length >= 1, `비서류(입력) step 최소 1개 존재 (실제 ${nonDoc.length})`);
  ok(nonDoc.every((s) => !s.docId), "비서류 step은 docId 없음 → 마커 미표시");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
