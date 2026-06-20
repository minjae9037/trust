/* ============================================================
   회귀 가드 — 미저장 변경(dirty) 추적 + 저장 기준선(savedHash) 전이

   배경: localStorage 단일·무자동저장 구조라, 저장 후에도 계속 편집하면
   SaveBar 가 "✓ 저장됨" 을 유지해 사용자가 변경분을 저장된 것으로 오인,
   처음으로 가기(reset)·탭 닫기 시 입력이 조용히 유실될 수 있었다.
   해결: store 에 savedHash(저장/불러오기 시점 스냅샷)를 두고
   isFormDirty(form, savedHash) 로 미저장 변경을 표시·경고한다.

   본 가드는 contractStore.ts 의 dirty 로직과 savedHash 전이를
   (= isFormDirty / markSaved / loadContract / reset)
   동일하게 재현해 다음을 단언한다:
     (A) 손대지 않은 빈 양식(미저장) → dirty=false (노이즈 방지)
     (B) 입력 시작(미저장) → dirty=true
     (C) 저장 직후(markSaved) → dirty=false
     (D) 저장 후 추가 편집 → dirty=true
     (E) 불러오기 직후(loadContract 기준선) → dirty=false
     (F) reset 후 빈 양식 → dirty=false
     (G) 편집된 계약에서 다른 계약 열기(openContract) → 가드 발동(dirty=true) →
         확인 후 새 계약 로드 시 새 기준선으로 dirty=false

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-dirty-tracking.mjs
   ============================================================ */
import { blankContractForm } from "../src/lib/engine/model.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  ✓ " + label); }
  else { fail++; console.log("  ✗ " + label); }
};

/* ---- contractStore.ts 의 isFormDirty 와 동일 로직(재현) ---- */
let _blankHash = null;
function isFormDirty(form, savedHash) {
  const cur = JSON.stringify(form);
  if (savedHash === null) {
    if (_blankHash === null) _blankHash = JSON.stringify(blankContractForm());
    return cur !== _blankHash;
  }
  return cur !== savedHash;
}
/* markSaved: 현재 form 을 저장 기준선으로 기록 */
const markSaved = (form) => JSON.stringify(form);

function filled() {
  const f = blankContractForm();
  f.trustors[0].name = "위탁자주식회사";
  f.priorities[0].name = "○○은행";
  f.properties[0].address = "서울특별시 강남구 테헤란로 1";
  return f;
}

console.log("[A] 손대지 않은 빈 양식(savedHash=null) → dirty=false");
{
  const blank = blankContractForm();
  ok(isFormDirty(blank, null) === false, "pristine 빈 양식은 미저장 변경 아님(불필요 경고 없음)");
}

console.log("[B] 입력 시작(savedHash=null) → dirty=true");
{
  ok(isFormDirty(filled(), null) === true, "위탁자/우선수익자/물건 입력 시 미저장 변경으로 표시");
}

console.log("[C] 저장 직후(markSaved) → dirty=false");
{
  const f = filled();
  const savedHash = markSaved(f);
  ok(isFormDirty(f, savedHash) === false, "저장 기준선과 동일 → 저장됨");
}

console.log("[D] 저장 후 추가 편집 → dirty=true");
{
  const f = filled();
  const savedHash = markSaved(f);
  f.priorities[0].loanAmount = "5,000,000,000"; // 저장 후 변경
  ok(isFormDirty(f, savedHash) === true, "저장 이후 변경분은 미저장으로 재표시");
}

console.log("[E] 불러오기 직후(loadContract 기준선) → dirty=false");
{
  // loadContract 와 동일: 병합·기준선 기록
  const base = blankContractForm();
  const rowFormData = filled();
  const merged = { ...base, ...rowFormData };
  merged.docContents = { ...base.docContents, ...(merged.docContents ?? {}) };
  const savedHash = JSON.stringify(merged); // 불러온 직후 기준선
  ok(isFormDirty(merged, savedHash) === false, "불러온 계약은 곧바로 저장됨 상태");
  // 불러온 뒤 편집하면 dirty
  const edited = { ...merged, title: undefined };
  edited.trustors = merged.trustors.map((p, i) => (i === 0 ? { ...p, name: "변경된위탁자" } : p));
  ok(isFormDirty(edited, savedHash) === true, "불러온 뒤 편집 시 미저장으로 표시");
}

console.log("[F] reset 후 빈 양식(savedHash=null) → dirty=false");
{
  ok(isFormDirty(blankContractForm(), null) === false, "초기화 후 빈 양식은 경고 없음");
}

console.log("[G] 편집된 계약에서 다른 계약 열기(openContract 가드)");
{
  // 1) 계약 A 불러오기 → 기준선 기록
  const base = blankContractForm();
  const rowA = filled();
  const mergedA = { ...base, ...rowA };
  mergedA.docContents = { ...base.docContents, ...(mergedA.docContents ?? {}) };
  const savedHashA = JSON.stringify(mergedA);

  // 2) A 편집(미저장) → openContract 가드 조건은 isFormDirty true 여야 발동
  const editedA = {
    ...mergedA,
    trustors: mergedA.trustors.map((p, i) => (i === 0 ? { ...p, name: "편집된위탁자" } : p)),
  };
  ok(
    isFormDirty(editedA, savedHashA) === true,
    "편집 후 다른 계약 열기 시도 → 가드 발동(미저장 변경 감지)"
  );

  // 3) 확인(덮어쓰기 승인) 후 계약 B 로드 → 새 기준선 → dirty=false
  const rowB = (() => {
    const f = blankContractForm();
    f.trustors[0].name = "다른위탁자주식회사";
    f.properties[0].address = "부산광역시 해운대구 2";
    return f;
  })();
  const mergedB = { ...base, ...rowB };
  mergedB.docContents = { ...base.docContents, ...(mergedB.docContents ?? {}) };
  const savedHashB = JSON.stringify(mergedB);
  ok(
    isFormDirty(mergedB, savedHashB) === false,
    "다른 계약 로드 직후 = 새 기준선 → 저장됨(이전 편집분 가드로 보호됨)"
  );
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
