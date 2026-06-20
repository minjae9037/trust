/* ============================================================
   회귀 가드 — 구버전 저장본 로드 시 검증 크래시 방지

   배경: loadContract 는 `{ ...blankContractForm(), ...row.form_data }` 얕은
   스프레드라, 구버전 저장본의 docContents 가 일부 서류 키(appform/valReport 등)를
   누락하면 그대로 빈 채로 들어온다. validate.ts 가 `c.appform.valuationPrice`
   처럼 직접 접근하면 TypeError 로 DocStep 렌더가 통째로 크래시한다.

   본 가드는:
     (A) docContents 에 appform/valReport 키가 없는 폼에서도 validateDoc 가
         throw 하지 않고 정상적으로 "누락" 으로 보고하는지 (옵셔널 체이닝)
     (B) loadContract 의 한 단계 docContents 병합이 모든 서류 키의 기본 구조를
         복원하는지 (구조 완결성)
   를 단언한다.

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-loadcontract-merge.mjs
   ============================================================ */
import { blankContractForm } from "../src/lib/engine/model.ts";
import { validateDoc } from "../src/lib/engine/validate.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  ✓ " + label); }
  else { fail++; console.log("  ✗ " + label); }
};

/* 공통 필수입력은 채워, commonMissing 은 통과시키고 서류별 분기만 검사하도록 한다 */
function filledBase() {
  const f = blankContractForm();
  f.trustors[0].name = "위탁자주식회사";
  f.priorities[0].name = "○○은행";
  f.priorities[0].loanAmount = "5,000,000,000";
  f.properties[0].address = "서울특별시 강남구 테헤란로 1";
  f.common.year = 2026; f.common.month = 6; f.common.day = 20;
  return f;
}

console.log("[A] 구버전 저장본(docContents 일부 키 누락) → validateDoc 크래시 방지");
{
  const f = filledBase();
  // 구버전 시뮬레이션: contract 키만 있고 appform/valReport 등은 통째로 없음
  f.docContents = { contract: blankContractForm().docContents.contract };
  for (const docId of ["appform", "valReport", "contract", "poa"]) {
    let res, threw = false;
    try { res = validateDoc(f, docId); } catch { threw = true; }
    ok(!threw, `validateDoc("${docId}") 가 throw 하지 않음 (누락 키 안전 접근)`);
    if (docId === "appform" && res) {
      ok(res.ok === false && res.missing.some((m) => m.label.includes("신탁부동산 가격")),
        `appform: 누락 필드 "신탁부동산 가격" 정상 보고`);
    }
    if (docId === "valReport" && res) {
      ok(res.ok === false && res.missing.some((m) => m.label.includes("원본가액")),
        `valReport: 누락 필드 "신탁재산 원본가액" 정상 보고`);
    }
  }
  // docContents 자체가 통째로 없는 극단 케이스도 크래시 없어야 함
  const f2 = filledBase();
  delete f2.docContents;
  let threw2 = false;
  try { validateDoc(f2, "appform"); } catch { threw2 = true; }
  ok(!threw2, `docContents 자체가 undefined 여도 throw 하지 않음`);
}

console.log("[B] loadContract 의 docContents 한 단계 병합 → 모든 서류 키 복원");
{
  // loadContract 가 수행하는 것과 동일한 병합 로직
  const base = blankContractForm();
  const rowFormData = { ...filledBase(), docContents: { contract: { notes: "구버전" } } };
  const merged = { ...base, ...rowFormData };
  merged.docContents = { ...base.docContents, ...(merged.docContents ?? {}) };

  const required = ["appform", "contract", "poa", "valReport", "boardMin", "cdd", "ubo"];
  for (const k of required) {
    ok(merged.docContents[k] !== undefined, `병합 후 docContents.${k} 존재`);
  }
  ok(merged.docContents.contract.notes === "구버전", `저장본 값(contract.notes)은 보존됨`);
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
