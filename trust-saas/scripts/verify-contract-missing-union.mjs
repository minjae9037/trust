/* ============================================================
   회귀 가드 — 담보신탁 "남은 필수 입력" 단일 출처(collateralMissingUnion)

   배경(정확성 가드레일·비-산출물): 위저드 헤더의 통합 체크리스트(Wizard `missingList`)와
   내 계약 카드의 "남은 필수 입력" 요약(ContractsView `rowMissing`)은 둘 다 "7종 산출
   서류(COLLATERAL_OUTPUT_DOCS)의 validateDoc(form).missing 을 label 기준 중복 제거한
   합집합"을 보여 준다. 그런데 그 dedup-합집합 로직을 두 화면이 **각자 인라인으로 재현**
   하고 있어, 한쪽 판정/순서가 바뀌면 다른 쪽이 말없이 어긋날 수 있었다(같은 계약을 보는
   두 화면이 "무엇이 남았나"에 대해 다르게 답할 위험 — 정확성 최우선 제품에서 결함).
   → 그 로직을 `src/lib/ui/contract-missing.ts` 의 collateralMissingUnion 한 곳으로
     단일화하고, 두 화면이 모두 이 헬퍼를 호출하게 했다. 본 가드는 헬퍼의 불변식과
     두 호출부가 실제로 이 단일 출처를 쓰는지(import + 호출)를 잠근다.

   단언:
     (A) dedup — 공통 누락은 1회만(label 유일)·중복 제거 전 원시 합계 > 후(실효)
     (B) 빈 양식 → 공통 5종 + 서류별 2종(가격·원본가액) = 정확히 7건, 각 STEPS 순서 보존
     (C) 완성 폼 → 빈 목록(0건) ⟺ 7종 전부 생성 가능(칩과 모순 0)
     (D) 각 항목 형태(label·where·stepIdx) 보존 + 합집합 = 서류별 missing 합집합과 정확히 일치
     (E) 단일 출처 배선 — Wizard.tsx·ContractsView.tsx 가 모두 collateralMissingUnion 을
         import 하고 호출(인라인 dedup 재현이 src 에서 사라졌는지 = drift 차단)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-contract-missing-union.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { blankContractForm } from "../src/lib/engine/model.ts";
import { validateDoc } from "../src/lib/engine/validate.ts";
import { COLLATERAL_OUTPUT_DOCS } from "../src/lib/engine/schema.ts";
import { collateralMissingUnion } from "../src/lib/ui/contract-missing.ts";

const __dir = dirname(fileURLToPath(import.meta.url));
const src = (rel) => readFileSync(join(__dir, "..", rel), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

// 빈 양식 = 최대 누락(blankContractForm 은 체결일 기본값을 가지므로 날짜를 비워 공통 5종 누락).
function emptyForm() {
  const f = blankContractForm();
  f.common.year = ""; f.common.month = ""; f.common.day = "";
  return f;
}
function fullForm() {
  const f = blankContractForm();
  f.trustors[0].name = "주식회사 갑";
  f.priorities[0].name = "을은행";
  f.priorities[0].loanAmount = "5000000000";
  f.properties[0].address = "서울특별시 강남구 테헤란로 1";
  f.docContents.appform.valuationPrice = "12000000000";
  f.docContents.valReport.principalValue = "8000000000";
  return f;
}

console.log("\n[A] dedup — 공통 누락 1회만(label 유일)·중복 제거 실효");
{
  const list = collateralMissingUnion(emptyForm());
  const labels = list.map((m) => m.label);
  ok(new Set(labels).size === labels.length, `label 중복 없음 (${labels.length}건 전부 유일)`);
  const trustor = labels.filter((l) => l === "위탁자 (성명/상호)").length;
  ok(trustor === 1, `공통 누락(위탁자)은 합집합에 1회만 (실제 ${trustor})`);
  let raw = 0;
  for (const d of COLLATERAL_OUTPUT_DOCS) raw += validateDoc(emptyForm(), d.id).missing.length;
  ok(raw > list.length, `중복 제거 전(${raw}) > 후(${list.length}) — dedup 실효`);
}

console.log("\n[B] 빈 양식 — 공통 5종 + 서류별 2종 = 정확히 7건(STEPS 등장 순서 보존)");
{
  const labels = collateralMissingUnion(emptyForm()).map((m) => m.label);
  const expect = [
    "위탁자 (성명/상호)",
    "우선수익자 (성명/상호)",
    "우선수익자 대출금액",
    "신탁 부동산 (소재지)",
    "계약 체결일 (연·월·일)",
    "신탁부동산 가격",
    "신탁재산 원본가액",
  ];
  for (const e of expect) ok(labels.includes(e), `포함: ${e}`);
  ok(labels.length === expect.length, `합집합 = 정확히 ${expect.length}건 (실제 ${labels.length})`);
  // 등장 순서 = 7종 서류 순회 순서(공통 누락은 첫 서류 appform 에서, 서류별 고유는 그 서류에서).
  ok(JSON.stringify(labels) === JSON.stringify(expect), "라벨 순서 = STEPS 서류 순회 첫 등장 순서 보존");
}

console.log("\n[C] 완성 폼 — 0건 ⟺ 7종 전부 생성 가능");
{
  const list = collateralMissingUnion(fullForm());
  ok(list.length === 0, `완성 폼 → 합집합 0건 (실제 ${list.length})`);
  const ready = COLLATERAL_OUTPUT_DOCS.filter((d) => validateDoc(fullForm(), d.id).ok).length;
  ok(ready === COLLATERAL_OUTPUT_DOCS.length, `7종 전부 생성 가능 (실제 ${ready}/${COLLATERAL_OUTPUT_DOCS.length})`);
  ok((list.length === 0) === (ready === COLLATERAL_OUTPUT_DOCS.length), "불변식: 합집합 빈 ⟺ ready 전부");
}

console.log("\n[D] 항목 형태 보존 + 서류별 missing 합집합과 정확히 일치");
{
  const list = collateralMissingUnion(emptyForm());
  ok(list.every((m) => typeof m.label === "string" && typeof m.stepIdx === "number" && typeof m.where === "string"),
    "각 항목 label·stepIdx·where 형태 보존(Missing 형태 유지)");
  const union = new Set();
  for (const d of COLLATERAL_OUTPUT_DOCS) for (const m of validateDoc(emptyForm(), d.id).missing) union.add(m.label);
  const got = new Set(list.map((m) => m.label));
  ok(union.size === got.size, `합집합 크기 일치 (서류별 ${union.size} = 헬퍼 ${got.size})`);
  ok([...union].every((l) => got.has(l)), "서류별 누락 전부가 헬퍼 합집합에 존재(누락 없음)");
  ok([...got].every((l) => union.has(l)), "헬퍼 합집합에 서류별에 없는 항목 없음(과잉 없음)");
}

console.log("\n[E] 단일 출처 배선 — 두 화면 모두 collateralMissingUnion 호출(인라인 재현 제거)");
{
  const HELPER = '"@/lib/ui/contract-missing"';
  const importRe = /import\s*\{[^}]*\bcollateralMissingUnion\b[^}]*\}\s*from\s*"@\/lib\/ui\/contract-missing"/;

  const wz = src("src/components/trust/Wizard.tsx");
  ok(importRe.test(wz), `Wizard: collateralMissingUnion import(${HELPER})`);
  ok(/missingList: collateralMissingUnion\(form\)/.test(wz), "Wizard: missingList = collateralMissingUnion(form) 단일 출처");
  // 인라인 dedup 재현이 Wizard 에서 사라졌는지(헬퍼로 단일화 — drift 차단).
  ok(!/seen\.add\(mi\.label\)/.test(wz), "Wizard: 인라인 label dedup 재현 제거(헬퍼로 단일화)");

  const cv = src("src/components/trust/ContractsView.tsx");
  ok(importRe.test(cv), `ContractsView: collateralMissingUnion import(${HELPER})`);
  ok(/return collateralMissingUnion\(form\);/.test(cv), "ContractsView: rowMissing → collateralMissingUnion(form) 위임");
  // rowMissing 본문에서 인라인 7종 순회 dedup 가 사라졌는지.
  const m = cv.match(/function rowMissing\(row: ContractRow\): Missing\[\]\s*\{[\s\S]*?\n\}/);
  ok(m && !/for \(const d of COLLATERAL_OUTPUT_DOCS\)/.test(m[0]), "ContractsView: rowMissing 인라인 7종 순회 제거(헬퍼로 단일화)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
