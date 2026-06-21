/* ============================================================
   회귀 가드 — 위저드 헤더 "서류 생성 준비 현황" 요약(✓ N/7)

   배경: 서류별 readiness 마커(✓/⚠)는 sub-step pill·stepper에만 있었고,
   stepper 는 <980px 에서 숨겨져(모바일) "7종 중 몇 종 생성 가능한가"를
   한눈에 볼 수단이 없었다. Wizard 헤더에 항상 노출되는 요약 배지를 추가:
     - readyCount / totalDocs (= 생성 가능 서류 수 / 7)
     - 막힌 서류가 있으면 firstBlocked 로 "한 클릭 이동" 버튼
   요약은 docReady 맵(= validateDoc(form,docId).ok)을 재집계할 뿐
   조문·엔진·검증 판정에 무손상.

   본 가드는 그 집계가 입력 단계에 따라 정확히 전이되는지 단언:
     (A) 빈 양식 → readyCount=0 / firstBlocked = 첫 서류 step
     (B) 공통 필수만 → readyCount=5 (appform·valReport ⚠) / firstBlocked=appform
     (C) 가격·원본가액까지 → readyCount=7=totalDocs / firstBlocked 없음
     (D) totalDocs = 출력서류 정의 수(7)·firstBlocked 는 항상 미충족 서류

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-doc-progress-summary.mjs
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

// Wizard.tsx 의 요약 집계를 그대로 재현 (docReady → readyCount/totalDocs/firstBlocked)
const summarize = (form) => {
  const docReady = {};
  for (const s of STEPS) if (s.docId) docReady[s.idx] = validateDoc(form, s.docId).ok;
  const docSteps = STEPS.filter((s) => s.docId);
  const readyCount = docSteps.reduce((n, s) => n + (docReady[s.idx] ? 1 : 0), 0);
  const totalDocs = docSteps.length;
  const firstBlocked = docSteps.find((s) => !docReady[s.idx]);
  return { docSteps, readyCount, totalDocs, firstBlocked };
};

console.log("\n[A] 빈 양식 → readyCount=0 / firstBlocked = 첫 서류 step");
{
  const { docSteps, readyCount, totalDocs, firstBlocked } = summarize(blankContractForm());
  ok(totalDocs === 7, `totalDocs=7 (실제 ${totalDocs})`);
  ok(readyCount === 0, `readyCount=0 (실제 ${readyCount})`);
  ok(firstBlocked && firstBlocked.idx === docSteps[0].idx, "firstBlocked = 첫 서류 step(Doc 01)");
}

console.log("\n[B] 공통 필수만 → readyCount=5 / firstBlocked = appform");
{
  const form = blankContractForm();
  form.trustors[0].name = "주식회사 갑";
  form.priorities[0].name = "을은행";
  form.priorities[0].loanAmount = "5000000000";
  form.properties[0].address = "서울특별시 강남구 테헤란로 1";
  const { readyCount, totalDocs, firstBlocked } = summarize(form);
  ok(readyCount === 5, `readyCount=5 (appform·valReport ⚠) (실제 ${readyCount})`);
  ok(totalDocs - readyCount === 2, "입력 필요 = 2종");
  ok(firstBlocked && firstBlocked.docId === "appform", "firstBlocked = appform(Doc 01)");
}

console.log("\n[C] 가격·원본가액까지 → readyCount=totalDocs / firstBlocked 없음");
{
  const form = blankContractForm();
  form.trustors[0].name = "주식회사 갑";
  form.priorities[0].name = "을은행";
  form.priorities[0].loanAmount = "5000000000";
  form.properties[0].address = "서울특별시 강남구 테헤란로 1";
  form.docContents.appform.valuationPrice = "10000000000";
  form.docContents.valReport.principalValue = "10000000000";
  const { readyCount, totalDocs, firstBlocked } = summarize(form);
  ok(readyCount === totalDocs, `readyCount=totalDocs=${totalDocs} (전부 생성 가능)`);
  ok(firstBlocked === undefined, "firstBlocked 없음 → '모든 서류 생성 준비 완료'");
}

console.log("\n[D] 집계 불변식 — totalDocs=출력서류 정의 수, firstBlocked 는 미충족 서류");
{
  const form = blankContractForm();
  form.trustors[0].name = "주식회사 갑";
  form.priorities[0].name = "을은행";
  form.priorities[0].loanAmount = "5000000000";
  form.properties[0].address = "서울특별시 강남구 테헤란로 1";
  const { docSteps, readyCount, totalDocs, firstBlocked } = summarize(form);
  ok(totalDocs === COLLATERAL_OUTPUT_DOCS.length, "totalDocs = 출력서류 정의 수(스키마 동기)");
  ok(readyCount >= 0 && readyCount <= totalDocs, "0 ≤ readyCount ≤ totalDocs");
  ok(firstBlocked && validateDoc(form, firstBlocked.docId).ok === false, "firstBlocked 는 실제 미충족(ok=false) 서류");
  ok(docSteps.every((s) => typeof s.docId === "string"), "요약 대상은 docId 보유 서류 step만");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
