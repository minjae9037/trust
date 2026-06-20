/* ============================================================
   회귀 가드 — 내 계약 목록의 "서류 N/7 생성 가능" 준비도 칩

   배경: 계약 목록(ContractsView)에서 각 계약을 열어보지 않고도 7종 서류 중
   몇 종이 필수 입력 충족으로 생성 가능한지 한눈에 보이도록 준비도 칩을 추가했다.
   칩은 검증 게이트와 동일한 validateDoc(form, docId).ok 를 7종(COLLATERAL_OUTPUT_DOCS)
   에 대해 집계한다 — 조문·엔진 무접촉, 기존 검증 결과의 목록 수준 표시일 뿐.

   본 가드는 그 집계가 정확한지 + 안전 가드(타 서류종·손상 저장본)를 단언:
     (A) 빈 담보신탁 폼 → 0/7 (필수 공통입력 누락)
     (B) 공통 필수만 채움 → 5/7 (appform 가격·valReport 원본가액만 누락)
     (C) appform·valReport까지 채움 → 7/7 (전부 생성 가능)
     (D) 담보신탁 외 서류종 → 집계 대상 아님(null → 칩 미표시)
     (E) 손상/구버전 저장본(form_data 일부 누락) → null(목록 렌더 크래시 방지)

   ContractsView.tsx 의 docReadiness() 와 동일 로직을 재현(컴포넌트 내부 함수라
   import 불가 — Wizard docReady 가드와 동일한 재현 패턴).

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-contracts-readiness.mjs
   ============================================================ */
import { blankContractForm } from "../src/lib/engine/model.ts";
import { validateDoc } from "../src/lib/engine/validate.ts";
import { COLLATERAL_OUTPUT_DOCS } from "../src/lib/engine/schema.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

// ContractsView.tsx 의 docReadiness(row) 재현
function docReadiness(row) {
  if (row.doc_type !== "collateral") return null;
  try {
    const total = COLLATERAL_OUTPUT_DOCS.length;
    const ready = COLLATERAL_OUTPUT_DOCS.filter((d) => validateDoc(row.form_data, d.id).ok).length;
    return { ready, total };
  } catch {
    return null;
  }
}
const rowOf = (form, doc_type = "collateral") => ({ doc_type, form_data: form });

console.log("\n[A] 빈 담보신탁 폼 → 0/7");
{
  const r = docReadiness(rowOf(blankContractForm()));
  ok(r !== null, "담보신탁 → 집계 반환");
  ok(r && r.total === 7, `총 7종 (실제 ${r?.total})`);
  ok(r && r.total === COLLATERAL_OUTPUT_DOCS.length, "total = 출력서류 정의 수");
  ok(r && r.ready === 0, `0종 생성 가능 (실제 ${r?.ready})`);
}

console.log("\n[B] 공통 필수만 채움 → 5/7 (appform·valReport 제외)");
{
  const form = blankContractForm();
  form.trustors[0].name = "주식회사 갑";
  form.priorities[0].name = "을은행";
  form.priorities[0].loanAmount = "5000000000";
  form.properties[0].address = "서울특별시 강남구 테헤란로 1";
  const r = docReadiness(rowOf(form));
  ok(r && r.ready === 5, `5종 생성 가능 (실제 ${r?.ready})`);
  ok(r && r.ready < r.total, "전부 충족은 아님(allReady=false → ⚠ 칩)");
}

console.log("\n[C] appform 가격 + valReport 원본가액까지 → 7/7");
{
  const form = blankContractForm();
  form.trustors[0].name = "주식회사 갑";
  form.priorities[0].name = "을은행";
  form.priorities[0].loanAmount = "5000000000";
  form.properties[0].address = "서울특별시 강남구 테헤란로 1";
  form.docContents.appform.valuationPrice = "10000000000";
  form.docContents.valReport.principalValue = "10000000000";
  const r = docReadiness(rowOf(form));
  ok(r && r.ready === 7, `7종 전부 생성 가능 (실제 ${r?.ready})`);
  ok(r && r.ready === r.total, "allReady=true → ✓ 칩");
}

console.log("\n[D] 담보신탁 외 서류종 → 집계 대상 아님(칩 미표시)");
{
  ok(docReadiness(rowOf(blankContractForm(), "joint")) === null, "joint → null");
  ok(docReadiness(rowOf(blankContractForm(), "fund")) === null, "fund → null");
}

console.log("\n[E] 손상/구버전 저장본 → null(렌더 크래시 방지)");
{
  // trustors 배열 자체가 없는 손상 데이터 → validateDoc 내부 .some 접근 시 throw
  ok(docReadiness({ doc_type: "collateral", form_data: {} }) === null, "빈 객체 form_data → null");
  ok(docReadiness({ doc_type: "collateral", form_data: null }) === null, "null form_data → null");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
