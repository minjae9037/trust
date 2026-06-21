/* ============================================================
   회귀 가드 — 내 계약 목록의 공동사업표준협약서(joint) 준비도 칩 + 목록-생성

   배경(목록 준비도 패리티 갭): 계약 목록(ContractsView)은 담보신탁(collateral)
   계약에 "서류 N/7 생성 가능" 칩 + "서류 N종 생성" 버튼을 보여 주지만(docReadiness/
   readyDocIds = validateDoc 집계), joint 계약은 readyDocIds 가 null 을 반환해
   **준비 신호도 목록-생성 수단도 전무**했다(열어 봐야만 생성 가능 여부 확인). joint 는
   단일 산출물(협약서)이라 "N/7" 대신 검증 게이트 validateJoint(form).ok 한 boolean
   으로 "협약서 생성 가능 / 필수 입력 누락"을 칩으로 보여 주고, 통과 시 목록에서 바로
   generateJointDoc 로 협약서를 생성한다(collateral 칩·일괄생성의 joint 패리티).
   조문·엔진·검증 판정 무접촉 — 기존 validateJoint 결과를 목록 수준에서 표시할 뿐.

   본 가드는 jointReadiness 집계의 정확성 + 안전 가드 + ★게이트 정합을 단언:
     (A) 빈 joint 폼 → false (필수 입력 누락 → ⚠ 칩)
     (B) 필수 전부 채운 joint → true (✓ 협약서 생성 가능 칩 + 생성 버튼)
     (C) 필수 1개 누락 joint → false (부분 입력은 미통과)
     (D) joint 외 서류종(collateral/fund) → null (칩 미표시)
     (E) 손상/구버전 저장본(form_data 빈/null) → null (목록 렌더 크래시 방지)
     (F) ★게이트 정합 — jointReadiness===true ⟺ validateJoint(form).ok===true
         (칩/생성 버튼 활성 ⟺ 게이트 통과, 모순 0 = 단일 출처 일치)

   ContractsView.tsx 의 jointReadiness(row) 와 동일 로직을 재현(컴포넌트 내부
   함수라 import 불가 — docReadiness 가드와 동일한 재현 패턴).

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-joint-readiness.mjs
   ============================================================ */
import { blankJointForm } from "../src/lib/engine/model.ts";
import { validateJoint } from "../src/lib/engine/validate.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

// ContractsView.tsx 의 jointReadiness(row) 재현
function jointReadiness(row) {
  if (row.doc_type !== "joint") return null;
  try {
    return validateJoint(row.form_data).ok;
  } catch {
    return null;
  }
}
const rowOf = (form, doc_type = "joint") => ({ doc_type, form_data: form });

// 모든 필수 입력을 채운 joint 폼(검증 통과 기준).
function filledJoint() {
  const f = blankJointForm();
  f.gap.name = "주식회사 갑개발";
  f.gap.repDir = "홍길동";
  f.gap.address = "서울특별시 강남구 테헤란로 1";
  f.project.name = "판교 오피스 신축사업";
  f.project.site = "경기도 성남시 분당구 대왕판교로 100";
  f.project.scaleUse = "지하 3층 ~ 지상 10층 업무시설";
  f.project.agreementYear = "2026";
  f.project.agreementMonth = "6";
  f.project.agreementDay = "21";
  return f;
}

console.log("\n[A] 빈 joint 폼 → false (필수 입력 누락 ⚠)");
{
  const r = jointReadiness(rowOf(blankJointForm()));
  ok(r === false, `빈 폼 → false (실제 ${r})`);
}

console.log("\n[B] 필수 전부 채운 joint → true (✓ 협약서 생성 가능)");
{
  const r = jointReadiness(rowOf(filledJoint()));
  ok(r === true, `완전 입력 → true (실제 ${r})`);
}

console.log("\n[C] 필수 1개 누락(사업부지) joint → false");
{
  const f = filledJoint();
  f.project.site = "";
  const r = jointReadiness(rowOf(f));
  ok(r === false, `사업부지 누락 → false (실제 ${r})`);
  // 협약일 실재하지 않는 날짜(2월 31일)도 false(게이트와 동일 isRealDate)
  const f2 = filledJoint();
  f2.project.agreementMonth = "2";
  f2.project.agreementDay = "31";
  ok(jointReadiness(rowOf(f2)) === false, "협약일 2/31(실재 안 함) → false");
}

console.log("\n[D] joint 외 서류종 → null (칩 미표시)");
{
  ok(jointReadiness(rowOf(filledJoint(), "collateral")) === null, "collateral → null");
  ok(jointReadiness(rowOf(filledJoint(), "fund")) === null, "fund → null");
}

console.log("\n[E] 손상/구버전 저장본 → null (렌더 크래시 방지)");
{
  ok(jointReadiness({ doc_type: "joint", form_data: {} }) === null || jointReadiness({ doc_type: "joint", form_data: {} }) === false,
    "빈 객체 form_data → null 또는 false (크래시 없음)");
  ok(jointReadiness({ doc_type: "joint", form_data: null }) === null || jointReadiness({ doc_type: "joint", form_data: null }) === false,
    "null form_data → null 또는 false (크래시 없음)");
  // 핵심: 어떤 손상 입력에도 throw 하지 않는다(목록 렌더가 끊기지 않음).
  let threw = false;
  try { jointReadiness({ doc_type: "joint", form_data: undefined }); } catch { threw = true; }
  ok(!threw, "undefined form_data → throw 없음");
}

console.log("\n[F] ★게이트 정합 — jointReadiness===true ⟺ validateJoint.ok===true (모순 0)");
{
  const cases = [
    ["빈 폼", blankJointForm()],
    ["완전 입력", filledJoint()],
    ["사업명 누락", (() => { const f = filledJoint(); f.project.name = ""; return f; })()],
    ["대표이사 누락", (() => { const f = filledJoint(); f.gap.repDir = ""; return f; })()],
    ["법인등록번호 무효(채움)", (() => { const f = filledJoint(); f.gap.corpRegFront = "123456"; f.gap.corpRegBack = "1234561"; return f; })()],
    ["협약일 무효", (() => { const f = filledJoint(); f.project.agreementMonth = "13"; return f; })()],
  ];
  let mismatch = 0;
  for (const [name, form] of cases) {
    const chip = jointReadiness(rowOf(form));      // 칩/생성 버튼 활성 여부
    const gate = validateJoint(form).ok;           // 검증 게이트(단일 출처)
    const agree = chip === gate;
    if (!agree) mismatch++;
    ok(agree, `정합: ${name} — 칩 ${chip} ⟺ 게이트 ${gate}`);
  }
  ok(mismatch === 0, `★모순 0건 (실제 ${mismatch})`);
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
