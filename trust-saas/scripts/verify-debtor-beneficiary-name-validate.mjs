/* ============================================================
   회귀 가드 — 채무자·수익자(별도 입력) 성명/상호 검증 게이트

   배경: 담보신탁 검증 게이트(validateDoc/commonMissing)는 위탁자·우선수익자의
   이름(성명/상호)은 검사하나, 채무자·수익자는 「위탁자와 동일」(sameAsTrustor)이
   기본이라 별도 검사하지 않았다. 그런데 「채무자(수익자)가 위탁자와 다름」을 켜면
   (sameAsTrustor=false) 별도 당사자 배열을 입력하고, 그 이름이 별첨2(나.수익자·
   다.채무자 표 valCell(name))·관계사 표(partyGroup)·날인면에 그대로 박힌다.
   종전 게이트는 분리 입력 시에도 이 이름을 검사하지 않아, "동일 해제 + 이름 미입력"
   이면 별첨2에 빈 성명칸이 박힌 계약서가 생성됐다(모델 기본 debtors=[blankParty()]
   라 토글만 해제하면 곧장 도달). 위탁자·우선수익자 이름 검사와 대칭으로 닫는다.

   본 가드의 정적 단언(조문·엔진·빌더 무접촉 — "입력값 완결성"만):
     [A] sameAsTrustor=true(기본) → 채무자·수익자 이름 미검사(무회귀)
     [B] 동일 해제 + 이름 미입력(빈/공백 카드) → 차단 + 점프 STEP 01
     [C] 동일 해제 + 이름 입력 → 통과
     [D] 동일 해제 + 배열 비움(카드 0개) → 차단(분리 선언했으면 최소 1인 named 필요)
     [E] 채무자·수익자 독립적으로 동작(한쪽만 해제해도 정확히 그쪽만 검사)
     [F] 모든 출력 서류 7종에 공통 적용(commonMissing — debtor biz 검사와 동일 정책)
     [G] 기존 검증(위탁자·우선수익자 이름·공통 점프 [1,2,3,4,5]) 무회귀

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-debtor-beneficiary-name-validate.mjs
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

const DEBTOR_LABEL = "채무자 (성명/상호)";
const BENEF_LABEL = "수익자 (성명/상호)";
const REL_IDX = 1; // 관계사 단계(STEP 01)
const has = (form, docId, label) =>
  validateDoc(form, docId).missing.some((m) => m.label === label);

// 공통 필수 입력을 모두 채운 "생성 가능 직전" 폼 — 채무자·수익자만 변수로 둔다.
function readyForm() {
  const form = blankContractForm();
  form.trustors[0].name = "갑개발 주식회사";
  form.priorities[0].name = "을은행";
  form.priorities[0].loanAmount = "5000000000";
  form.properties[0].address = "서울특별시 강남구 테헤란로 1";
  // 계약 체결일·신탁기간은 blankContractForm 기본값이 채워져 있다(공통 게이트 통과).
  return form;
}

console.log("\n[A] sameAsTrustor=true(기본) → 채무자·수익자 이름 미검사 (무회귀)");
{
  const form = readyForm();
  ok(form.debtorSameAsTrustor === true, "기본 debtorSameAsTrustor=true");
  ok(form.beneficiarySameAsTrustor === true, "기본 beneficiarySameAsTrustor=true");
  // 기본 debtors/beneficiaries 카드는 빈 이름이지만 sameAsTrustor=true 라 미검사여야 한다.
  ok(form.debtors[0].name === "", "기본 채무자 카드 이름 빈 값(동일 모드라 미검사 대상)");
  ok(!has(form, "contract", DEBTOR_LABEL), "동일 모드 → 채무자 이름 누락 아님");
  ok(!has(form, "contract", BENEF_LABEL), "동일 모드 → 수익자 이름 누락 아님");
  ok(validateDoc(form, "contract").ok, "동일 모드 + 공통 충족 → contract 생성 가능");
}

console.log("\n[B] 동일 해제 + 이름 미입력 → 차단 + 점프 STEP 01");
{
  const form = readyForm();
  form.debtorSameAsTrustor = false;
  form.debtors = [{ ...form.debtors[0], name: "" }]; // 분리 선언했으나 빈 이름 카드
  ok(has(form, "contract", DEBTOR_LABEL), "동일 해제 + 빈 이름 → 채무자 이름 누락 포함");
  ok(!validateDoc(form, "contract").ok, "동일 해제 + 빈 이름 → contract 생성 차단(ok=false)");
  // 공백만 입력도 차단(hasText=trim>0)
  form.debtors = [{ ...form.debtors[0], name: "   " }];
  ok(has(form, "contract", DEBTOR_LABEL), "공백만 → 차단(trim 후 빈 값)");
  // 점프 타깃 = 관계사 단계(STEP 01), where 는 STEPS 에서 파생
  const mi = validateDoc(form, "contract").missing.find((m) => m.label === DEBTOR_LABEL);
  ok(!!mi && mi.stepIdx === REL_IDX, `stepIdx === 관계사 단계 idx(${REL_IDX})`);
  const s = STEPS.find((x) => x.idx === REL_IDX);
  ok(mi.where === `${s.label} ${s.title}`, "where === STEP.label + ' ' + STEP.title (단일 출처)");
  // 수익자도 동형
  const f2 = readyForm();
  f2.beneficiarySameAsTrustor = false;
  f2.beneficiaries = [{ ...f2.beneficiaries[0], name: "" }];
  ok(has(f2, "contract", BENEF_LABEL), "동일 해제 + 빈 이름 → 수익자 이름 누락 포함");
}

console.log("\n[C] 동일 해제 + 이름 입력 → 통과");
{
  const form = readyForm();
  form.debtorSameAsTrustor = false;
  form.debtors = [{ ...form.debtors[0], name: "병차주 주식회사" }];
  form.beneficiarySameAsTrustor = false;
  form.beneficiaries = [{ ...form.beneficiaries[0], name: "정수익 주식회사" }];
  ok(!has(form, "contract", DEBTOR_LABEL), "채무자 이름 입력 → 누락 아님");
  ok(!has(form, "contract", BENEF_LABEL), "수익자 이름 입력 → 누락 아님");
  ok(validateDoc(form, "contract").ok, "분리 + 이름 입력 + 공통 충족 → contract 생성 가능");
}

console.log("\n[D] 동일 해제 + 배열 비움(카드 0개) → 차단(최소 1인 named)");
{
  const form = readyForm();
  form.debtorSameAsTrustor = false;
  form.debtors = []; // 분리 선언했으나 당사자 0인
  ok(has(form, "contract", DEBTOR_LABEL), "동일 해제 + 빈 배열 → 채무자 이름 누락(some=false)");
  ok(!validateDoc(form, "contract").ok, "동일 해제 + 빈 배열 → 생성 차단");
}

console.log("\n[E] 채무자·수익자 독립 — 한쪽만 해제하면 그쪽만 검사");
{
  const form = readyForm();
  form.debtorSameAsTrustor = false; // 채무자만 분리(빈 이름)
  form.debtors = [{ ...form.debtors[0], name: "" }];
  // 수익자는 기본(동일 모드) 유지
  ok(has(form, "contract", DEBTOR_LABEL), "채무자만 해제 → 채무자 누락");
  ok(!has(form, "contract", BENEF_LABEL), "수익자는 동일 모드 → 누락 아님(독립)");
}

console.log("\n[F] 모든 출력 서류 7종에 공통 적용 (commonMissing)");
{
  const form = readyForm();
  form.debtorSameAsTrustor = false;
  form.debtors = [{ ...form.debtors[0], name: "" }];
  const ids = COLLATERAL_OUTPUT_DOCS.map((d) => d.id);
  ok(ids.length === 7, `출력 서류 7종 (실제 ${ids.length})`);
  ok(ids.every((id) => has(form, id, DEBTOR_LABEL)),
    "7종 전부에서 채무자 이름 누락 검사(공통 — debtor biz 검사와 동일 정책)");
}

console.log("\n[G] 기존 검증(위탁자·우선수익자 이름·공통 점프) 무회귀");
{
  // 빈 양식 contract 공통 누락 점프는 여전히 [1,2,3,4,5] (채무자/수익자 동일 모드라 미추가)
  const form = blankContractForm();
  form.common.year = ""; form.common.month = ""; form.common.day = "";
  const idxs = validateDoc(form, "contract").missing.map((m) => m.stepIdx).sort((a, b) => a - b);
  ok(JSON.stringify(idxs) === JSON.stringify([1, 2, 3, 4, 5]),
    `빈 양식 contract 공통 누락 점프 = [1,2,3,4,5] (실제 [${idxs}]) — 동일 모드 미오염`);
  // 위탁자·우선수익자 이름 검사 유지
  const f2 = readyForm();
  f2.trustors[0].name = "";
  ok(validateDoc(f2, "contract").missing.some((m) => m.label === "위탁자 (성명/상호)"),
    "위탁자 이름 누락 검증 유지");
  const f3 = readyForm();
  f3.priorities[0].name = "";
  ok(validateDoc(f3, "contract").missing.some((m) => m.label === "우선수익자 (성명/상호)"),
    "우선수익자 이름 누락 검증 유지");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
