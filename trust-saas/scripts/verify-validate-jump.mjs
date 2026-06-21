/* ============================================================
   회귀 가드 — 검증 게이트 누락 항목 → 입력 단계 점프

   배경: 검증 게이트(validateDoc)는 누락 항목마다 "STEP 01 …"처럼 어느
   단계에서 입력하는지 텍스트(where)로만 안내했고, 그 단계로 이동할 수단이
   없었다. 사용자가 직접 탭·서브스텝을 찾아 클릭해야 하는 갭.
   → Missing 에 stepIdx(입력 단계 STEP.idx)를 추가하고, DocStep 의 검증
     박스에서 누락 항목 클릭 시 그 단계로 goToStep(setStep+setTab) 점프.

   본 가드는 점프 타깃의 정합성을 정적 단언:
     (A) 모든 Missing 의 stepIdx 는 실재하는 STEP 을 가리킨다(고아 없음)
     (B) where 안내문구는 STEPS 에서 파생된다(라벨/제목 drift 시 자동 동기)
     (C) 공통 누락(위탁자·우선수익자·대출금액·물건·체결일)은 관계사/조건
         step(비서류) 으로 점프 — 사용자를 입력 위치로 정확히 데려간다
     (D) 서류별 누락(appform 가격·valReport 원본가액)은 해당 Doc step 자신으로
     (E) 빈 양식 5종 공통 누락이 모두 stepIdx 1~5 로 매핑(서로 다른 단계)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-validate-jump.mjs
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

const stepByIdx = (idx) => STEPS.find((s) => s.idx === idx);
const whereOf = (idx) => { const s = stepByIdx(idx); return s ? `${s.label} ${s.title}` : ""; };

// 전 서류에 대해 누락 항목을 모두 수집(빈 양식 = 최대 누락)
const allMissing = () => {
  const out = [];
  const form = blankContractForm();
  for (const d of COLLATERAL_OUTPUT_DOCS) {
    for (const m of validateDoc(form, d.id).missing) out.push({ docId: d.id, ...m });
  }
  return out;
};

console.log("\n[A] 모든 Missing.stepIdx 는 실재 STEP 을 가리킨다 (고아 점프 없음)");
{
  const ms = allMissing();
  ok(ms.length > 0, `누락 항목 수집됨 (${ms.length}건)`);
  ok(ms.every((m) => typeof m.stepIdx === "number" && !!stepByIdx(m.stepIdx)),
    "모든 누락 항목의 stepIdx 가 STEPS 에 존재");
}

console.log("\n[B] where 안내문구는 STEPS 에서 파생(라벨/제목 단일 출처)");
{
  const ms = allMissing();
  ok(ms.every((m) => m.where === whereOf(m.stepIdx)),
    "where === STEP.label + ' ' + STEP.title (drift 시 자동 동기)");
  ok(ms.every((m) => m.where.length > 0), "where 비어있지 않음");
}

console.log("\n[C] 공통 누락 → 관계사/조건(비서류) step 으로 점프");
{
  const form = blankContractForm();
  // blankContractForm 은 체결일 기본값(2026-03-01)을 가지므로 5종 전부를 누락시키려면 날짜를 비운다.
  form.common.year = ""; form.common.month = ""; form.common.day = "";
  // contract 는 서류별 추가 필수 없음 → 공통 누락만 남는다
  const common = validateDoc(form, "contract").missing;
  ok(common.length === 5, `공통 누락 5종 (실제 ${common.length})`);
  ok(common.every((m) => { const s = stepByIdx(m.stepIdx); return s && !s.docId; }),
    "공통 누락 점프 타깃은 전부 비서류(docId 없는 입력) step");
  // 라벨↔단계 정확 매핑
  const byLabel = Object.fromEntries(common.map((m) => [m.label, m.stepIdx]));
  ok(byLabel["위탁자 (성명/상호)"] === 1, "위탁자 → STEP idx 1");
  ok(byLabel["우선수익자 (성명/상호)"] === 2, "우선수익자 → STEP idx 2");
  ok(byLabel["우선수익자 대출금액"] === 3, "대출금액 → STEP idx 3");
  ok(byLabel["신탁 부동산 (소재지)"] === 4, "신탁 부동산 → STEP idx 4");
  ok(byLabel["계약 체결일 (연·월·일)"] === 5, "계약 체결일 → STEP idx 5");
}

console.log("\n[D] 서류별 누락 → 해당 Doc step 자신으로 점프");
{
  const idxOf = (docId) => STEPS.find((s) => s.docId === docId).idx;
  const form = blankContractForm();
  // 공통은 다 채우고 서류별만 누락 상태로
  form.trustors[0].name = "주식회사 갑";
  form.priorities[0].name = "을은행";
  form.priorities[0].loanAmount = "5000000000";
  form.properties[0].address = "서울특별시 강남구 테헤란로 1";

  const appform = validateDoc(form, "appform").missing;
  ok(appform.length === 1 && appform[0].stepIdx === idxOf("appform"),
    "appform 가격 누락 → Doc 01(appform) step 자신");
  const valReport = validateDoc(form, "valReport").missing;
  ok(valReport.length === 1 && valReport[0].stepIdx === idxOf("valReport"),
    "valReport 원본가액 누락 → Doc 04(valReport) step 자신");
}

console.log("\n[E] 공통 누락 5종은 서로 다른 단계(1~5)로 분산");
{
  const form = blankContractForm();
  form.common.year = ""; form.common.month = ""; form.common.day = "";
  const common = validateDoc(form, "contract").missing;
  const idxs = common.map((m) => m.stepIdx).sort((a, b) => a - b);
  ok(JSON.stringify(idxs) === JSON.stringify([1, 2, 3, 4, 5]),
    `공통 누락 점프 타깃 = [1,2,3,4,5] (실제 [${idxs}])`);
  ok(new Set(idxs).size === idxs.length, "중복 없는 단계 매핑");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
