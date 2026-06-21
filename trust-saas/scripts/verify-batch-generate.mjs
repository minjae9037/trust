/* ============================================================
   회귀 가드 — 위저드 "준비된 서류 일괄 생성(.docx)"

   배경: 랜딩 카피는 "입력 한 번으로 Word·PDF 일괄 생성"을 약속하지만,
   앱은 7종 서류를 각 step에 들어가 7번 생성 클릭해야 했다. Wizard 헤더
   진행 현황 옆에 "준비된 N종 일괄 생성(.docx)" 버튼을 추가 — 검증 게이트
   (docReady = validateDoc(form,docId).ok)를 통과한 서류만 순차 생성한다.

   핵심 정확성 불변식: **일괄 생성 대상 = 검증 통과 서류와 정확히 일치**.
   누락 서류(⚠)는 절대 생성하지 않고(추정·미완 서류 산출 차단),
   readyCount(진행 요약)와 batchTargets(일괄 대상)는 항상 같은 집합이다.

   본 가드는 Wizard.tsx 의 ready 집합 선정 로직을 그대로 재현해 단언:
     (A) 빈 양식 → 대상 0종(버튼 미노출 조건)
     (B) 공통 필수만 → 대상 5종(appform·valReport 제외)·전부 ok
     (C) 가격·원본가액까지 → 대상 7종 = 전체 출력서류
     (D) 불변식: batchTargets ⊆ 출력서류, 전부 validateDoc.ok, readyCount 일치

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-batch-generate.mjs
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

// Wizard.tsx 의 일괄 생성 대상 선정 그대로 재현:
//   docReady = validateDoc(form,docId).ok → docSteps.filter(ready)
const batch = (form) => {
  const docReady = {};
  for (const s of STEPS) if (s.docId) docReady[s.idx] = validateDoc(form, s.docId).ok;
  const docSteps = STEPS.filter((s) => s.docId);
  const targets = docSteps.filter((s) => docReady[s.idx]); // 일괄 생성 대상
  const readyCount = docSteps.reduce((n, s) => n + (docReady[s.idx] ? 1 : 0), 0);
  return { docSteps, targets, readyCount };
};

const seed = () => {
  const form = blankContractForm();
  form.trustors[0].name = "주식회사 갑";
  form.priorities[0].name = "을은행";
  form.priorities[0].loanAmount = "5000000000";
  form.properties[0].address = "서울특별시 강남구 테헤란로 1";
  return form;
};

console.log("\n[A] 빈 양식 → 일괄 대상 0종 (버튼 미노출 조건)");
{
  const { targets, readyCount } = batch(blankContractForm());
  ok(targets.length === 0, `대상 0종 (실제 ${targets.length})`);
  ok(readyCount === 0, "readyCount=0 → readyCount>0 버튼 노출 조건 불충족");
}

console.log("\n[B] 공통 필수만 → 대상 5종 (appform·valReport 제외)");
{
  const { targets, readyCount } = batch(seed());
  ok(targets.length === 5, `대상 5종 (실제 ${targets.length})`);
  ok(readyCount === targets.length, "readyCount 과 일괄 대상 수 일치");
  const ids = targets.map((s) => s.docId);
  ok(!ids.includes("appform") && !ids.includes("valReport"), "누락 서류(appform·valReport) 일괄 대상 제외");
}

console.log("\n[C] 가격·원본가액까지 → 대상 7종 = 전체 출력서류");
{
  const form = seed();
  form.docContents.appform.valuationPrice = "10000000000";
  form.docContents.valReport.principalValue = "10000000000";
  const { targets } = batch(form);
  ok(targets.length === COLLATERAL_OUTPUT_DOCS.length, `대상 7종 = 출력서류 정의 수 (실제 ${targets.length})`);
  const ids = new Set(targets.map((s) => s.docId));
  ok(COLLATERAL_OUTPUT_DOCS.every((d) => ids.has(d.id)), "7종 출력서류 전부 포함");
}

console.log("\n[D] 핵심 불변식 — 일괄 대상은 항상 '검증 통과 서류와 정확히 일치'");
{
  // 부분 입력(공통 필수만)으로 ⚠ 서류가 섞인 상태에서 검사
  const form = seed();
  const { docSteps, targets, readyCount } = batch(form);
  // ① 대상은 전부 출력서류(docId 보유 step)
  ok(targets.every((s) => typeof s.docId === "string"), "일괄 대상은 전부 docId 보유 서류 step");
  // ② 대상은 전부 validateDoc.ok = true (누락 서류 산출 차단)
  ok(targets.every((s) => validateDoc(form, s.docId).ok === true), "대상 전부 validateDoc.ok=true (누락 서류 생성 안 함)");
  // ③ 비대상은 전부 validateDoc.ok = false (생성 가능한데 빠뜨리는 일 없음)
  const nonTargets = docSteps.filter((s) => !targets.includes(s));
  ok(nonTargets.every((s) => validateDoc(form, s.docId).ok === false), "비대상은 전부 ok=false (누락 없음)");
  // ④ 대상 수 = readyCount(진행 요약과 동일 집계 — UI 카운트와 실제 생성 수 불일치 차단)
  ok(targets.length === readyCount, "일괄 대상 수 = readyCount(요약 배지와 일치)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
