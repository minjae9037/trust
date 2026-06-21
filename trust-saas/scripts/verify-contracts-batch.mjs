/* ============================================================
   회귀 가드 — 내 계약 목록에서 "서류 N종 생성"(목록 일괄 생성)

   배경: 계약 목록(ContractsView)의 준비도 칩("✓ 7/7 생성 가능")은 보여주기만 했고,
   그 서류를 받으려면 계약을 열어 위저드 헤더의 일괄 생성으로 가야 했다. 목록 카드에
   바로 "⬇ 서류 N종 생성" 버튼을 추가해 열지 않고도 준비된 서류를 한 번에 내려받게 했다.

   핵심 불변식(정확성 가드레일): 일괄 생성 대상 = 검증 게이트 통과 서류와 **정확히 일치**.
   → 누락(검증 미통과) 서류는 절대 생성하지 않는다(추정/미완 서류 산출 차단). 또한 목록의
     준비도 칩 수(docReadiness.ready)와 일괄 생성 대상 수가 **단일 출처(readyDocIds)** 라
     항상 일치한다.

   단언:
     (A) 빈 담보신탁 → 대상 0종(버튼 미노출 조건 ready>0=false)
     (B) 공통 필수만 → 대상 5종(appform·valReport 제외)
     (C) appform·valReport까지 → 대상 7종 = 출력서류 전체
     (D) 담보신탁 외(joint/fund) → null(버튼 미노출)
     (E) 손상/구버전 저장본 → null(렌더·생성 크래시 방지)
     (F) 불변식: 대상 전부 validateDoc.ok=true · 비대상 전부 ok=false ·
                 readyDocIds.length === docReadiness.ready (칩=일괄 단일 출처)

   ContractsView.tsx 의 readyDocIds()/docReadiness() 와 동일 로직 재현
   (컴포넌트 내부 함수라 import 불가 — 기존 readiness 가드와 동일 재현 패턴).

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-contracts-batch.mjs
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

// ContractsView.tsx 의 readyDocIds(row) / docReadiness(row) 재현
function readyDocIds(row) {
  if (row.doc_type !== "collateral") return null;
  try {
    return COLLATERAL_OUTPUT_DOCS.filter((d) => validateDoc(row.form_data, d.id).ok).map((d) => d.id);
  } catch {
    return null;
  }
}
function docReadiness(row) {
  const ids = readyDocIds(row);
  if (ids === null) return null;
  return { ready: ids.length, total: COLLATERAL_OUTPUT_DOCS.length };
}
const rowOf = (form, doc_type = "collateral") => ({ doc_type, form_data: form });

const commonFilled = () => {
  const form = blankContractForm();
  form.trustors[0].name = "주식회사 갑";
  form.priorities[0].name = "을은행";
  form.priorities[0].loanAmount = "5000000000";
  form.properties[0].address = "서울특별시 강남구 테헤란로 1";
  return form;
};

console.log("\n[A] 빈 담보신탁 → 대상 0종(버튼 미노출)");
{
  const ids = readyDocIds(rowOf(blankContractForm()));
  ok(Array.isArray(ids) && ids.length === 0, `대상 0종 (실제 ${ids?.length})`);
}

console.log("\n[B] 공통 필수만 → 대상 5종(appform·valReport 제외)");
{
  const ids = readyDocIds(rowOf(commonFilled()));
  ok(ids.length === 5, `대상 5종 (실제 ${ids.length})`);
  ok(!ids.includes("appform"), "appform 제외(가격 미입력)");
  ok(!ids.includes("valReport"), "valReport 제외(원본가액 미입력)");
}

console.log("\n[C] appform 가격 + valReport 원본가액까지 → 대상 7종(전체)");
{
  const form = commonFilled();
  form.docContents.appform.valuationPrice = "10000000000";
  form.docContents.valReport.principalValue = "10000000000";
  const ids = readyDocIds(rowOf(form));
  ok(ids.length === 7, `대상 7종 (실제 ${ids.length})`);
  ok(ids.length === COLLATERAL_OUTPUT_DOCS.length, "대상 = 출력서류 정의 전체");
}

console.log("\n[D] 담보신탁 외 → null(버튼 미노출)");
{
  ok(readyDocIds(rowOf(blankContractForm(), "joint")) === null, "joint → null");
  ok(readyDocIds(rowOf(blankContractForm(), "fund")) === null, "fund → null");
}

console.log("\n[E] 손상/구버전 저장본 → null(크래시 방지)");
{
  ok(readyDocIds({ doc_type: "collateral", form_data: {} }) === null, "빈 객체 form_data → null");
  ok(readyDocIds({ doc_type: "collateral", form_data: null }) === null, "null form_data → null");
}

console.log("\n[F] 핵심 불변식: 일괄 대상 = 검증 통과 서류, 칩=일괄 단일 출처");
{
  for (const [name, form] of [["공통필수", commonFilled()], ["전체충족", (() => {
    const f = commonFilled();
    f.docContents.appform.valuationPrice = "10000000000";
    f.docContents.valReport.principalValue = "10000000000";
    return f;
  })()]]) {
    const row = rowOf(form);
    const ids = readyDocIds(row);
    const idSet = new Set(ids);
    const everyTargetOk = ids.every((id) => validateDoc(form, id).ok === true);
    const everyNonTargetBlocked = COLLATERAL_OUTPUT_DOCS
      .filter((d) => !idSet.has(d.id))
      .every((d) => validateDoc(form, d.id).ok === false);
    ok(everyTargetOk, `[${name}] 대상 전부 ok=true`);
    ok(everyNonTargetBlocked, `[${name}] 비대상 전부 ok=false(누락 서류 미생성)`);
    ok(ids.length === docReadiness(row).ready, `[${name}] 칩 수=일괄 대상 수(단일 출처)`);
  }
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
