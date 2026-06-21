/* ============================================================
   회귀 가드 — 저장된 계약 "이어서 작성" 시 미완 서류 단계로 진입

   배경: store.loadContract 는 저장본을 다시 열 때 항상 tab:1, step:1(STEP 01)로
   진입했다. 작성중(draft) 계약을 "이어서 작성"하려 다시 열어도 매번 맨 처음
   단계로 떨어져, 어디까지 했는지·무엇이 미완인지 직접 다시 찾아야 하는 마찰.
   → 순수 함수 firstIncompleteDocStep(form) 신설: 아직 필수 입력이 누락돼
     생성 불가한 첫 서류(Doc) step 을 반환(없으면 null=처음부터 검토).
     loadContract 가 이 결과로 진입 단계(tab/step)를 정한다.

   본 가드는 진입 단계 선택 로직을 정적 단언(조문·엔진·검증 판정 무접촉):
     (A) 빈 양식(필수 누락) → 첫 서류 step(appform, idx 7) 반환·docId 보유
     (B) 일부만 채움 → 이미 생성 가능한 앞 서류는 건너뛰고 첫 미완 서류로
     (C) 전부 충족 → null(처음부터 검토)
     (D) 불변식: 반환 step 은 항상 docId 보유 + 최소 idx 미완 서류(수동 스캔 일치)
     (E) validateDoc 정합성: 반환 step.docId 는 ok=false / null 이면 전 서류 ok=true

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-resume-step.mjs
   ============================================================ */
import { blankContractForm } from "../src/lib/engine/model.ts";
import { validateDoc, firstIncompleteDocStep } from "../src/lib/engine/validate.ts";
import { STEPS } from "../src/lib/engine/schema.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const docSteps = STEPS.filter((s) => s.docId);
// 진입 단계 선택과 독립적으로 "첫 미완 서류"를 수동 스캔(불변식 대조용)
const manualFirstIncomplete = (form) =>
  docSteps.find((s) => !validateDoc(form, s.docId).ok) ?? null;

// 공통 필수를 모두 채운 양식(서류별 추가 입력은 비움)
function commonFilled() {
  const form = blankContractForm();
  form.trustors[0].name = "주식회사 갑";
  form.priorities[0].name = "을은행";
  form.priorities[0].loanAmount = "5000000000";
  form.properties[0].address = "서울특별시 강남구 테헤란로 1";
  // blankContractForm 은 체결일 기본값을 가지므로 공통 5종 충족
  return form;
}

console.log("\n[A] 빈 양식(필수 누락) → 첫 서류 step(appform) 으로 진입");
{
  const form = blankContractForm();
  const r = firstIncompleteDocStep(form);
  ok(r !== null, "빈 양식은 진입 대상(미완 서류) 존재");
  ok(r && r.docId === "appform", `첫 미완 서류 = appform (실제 ${r && r.docId})`);
  ok(r && r.idx === docSteps[0].idx, "= 서류 중 최소 idx step");
  ok(r && r.tab === 3, "서류 step 이므로 tab 3 으로 진입");
}

console.log("\n[B] 일부만 충족 → 생성 가능한 앞 서류는 건너뛰고 첫 미완 서류로");
{
  // 공통 + appform 가격 채움 → appform/contract/poa 는 생성 가능, valReport 만 미완
  const form = commonFilled();
  form.docContents.appform.valuationPrice = "10000000000";
  const r = firstIncompleteDocStep(form);
  ok(r && r.docId === "valReport", `첫 미완 = valReport (실제 ${r && r.docId})`);
  // 반환 step 앞의 모든 서류 step 은 생성 가능해야 한다(건너뛴 게 정말 ok)
  const before = docSteps.filter((s) => s.idx < r.idx);
  ok(before.length > 0 && before.every((s) => validateDoc(form, s.docId).ok),
    `반환 앞 서류 ${before.length}종 전부 생성 가능(정당한 스킵)`);
}

console.log("\n[C] 전부 충족 → null(처음부터 검토)");
{
  const form = commonFilled();
  form.docContents.appform.valuationPrice = "10000000000";
  form.docContents.valReport.principalValue = "8000000000";
  const r = firstIncompleteDocStep(form);
  ok(r === null, "모든 서류 생성 가능 시 null");
  ok(docSteps.every((s) => validateDoc(form, s.docId).ok), "실제로 7종 전부 ok");
}

console.log("\n[D] 불변식 — 반환 step 은 docId 보유 + 최소 idx 미완 서류(수동 스캔 일치)");
{
  const cases = [
    blankContractForm(),
    commonFilled(),
    (() => { const f = commonFilled(); f.docContents.appform.valuationPrice = "1"; return f; })(),
    (() => {
      const f = commonFilled();
      f.docContents.appform.valuationPrice = "1";
      f.docContents.valReport.principalValue = "1";
      return f;
    })(),
  ];
  let allMatch = true;
  let allDocId = true;
  for (const f of cases) {
    const r = firstIncompleteDocStep(f);
    const m = manualFirstIncomplete(f);
    if ((r?.idx ?? null) !== (m?.idx ?? null)) allMatch = false;
    if (r && !r.docId) allDocId = false;
  }
  ok(allMatch, "전 케이스에서 수동 스캔(첫 미완 서류)과 동일 step 반환");
  ok(allDocId, "반환 step 은 항상 docId 보유(비서류 입력 step 으로 빠지지 않음)");
}

console.log("\n[E] validateDoc 정합성 — 반환 step.docId 는 ok=false / null 은 전 서류 ok");
{
  const blank = blankContractForm();
  const rBlank = firstIncompleteDocStep(blank);
  ok(rBlank && validateDoc(blank, rBlank.docId).ok === false,
    "반환된 미완 서류는 실제 validateDoc.ok === false");

  const full = commonFilled();
  full.docContents.appform.valuationPrice = "1";
  full.docContents.valReport.principalValue = "1";
  const rFull = firstIncompleteDocStep(full);
  ok(rFull === null && docSteps.every((s) => validateDoc(full, s.docId).ok),
    "null 반환 시 전 서류가 정말 생성 가능");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
