/* ============================================================
   회귀 가드 — 위저드 헤더 "남은 필수 입력 통합 체크리스트"(중복 제거 + 단계별 점프)

   배경: 위저드 헤더는 "서류 N/7 생성 가능" 카운트와 firstBlocked(첫 막힌
   서류 1종으로 이동)만 제공했고, 각 DocStep 검증박스는 그 서류 한정이라
   "계약 전체에서 아직 채워야 할 입력 전부"를 한 곳에서 보는 수단이 없었다.
   사용자는 막힌 서류를 하나씩 들어가 누락을 확인해야 했다.
   → Wizard 가 7종 서류(COLLATERAL_OUTPUT_DOCS)의 validateDoc(form).missing 을
     label 기준 중복 제거(공통 누락은 7종 모두에 반복 등장 → 1회만)해 한 목록으로
     모으고, 각 항목을 goStep(stepIdx) 점프 버튼으로 렌더한다.

   본 가드는 Wizard 의 산출 로직(아래 dedupedMissing)을 그대로 재현해 정적 단언:
     (A) 중복 제거 — 공통 누락이 1회만(7× 중복 없음), label 유일
     (B) 빈 양식: 공통 5종 + 서류별 2종(가격·원본가액) = 7건이 모두 포함
     (C) 완성 폼: 목록이 빈다(남은 입력 0 → 체크리스트 미노출)
     (D) 모든 항목의 stepIdx 가 실재 STEP 을 가리킴(고아 점프 없음)·where 파생
     (E) 부분 완성: 채운 입력은 목록에서 빠지고 남은 입력만(증분 정확)
     (F) 통합 목록은 각 서류 검증박스 누락의 합집합과 정확히 일치(누락·과잉 없음)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-missing-checklist.mjs
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

// Wizard.tsx 의 missingList 산출 로직과 동일(단일 패스·label 중복 제거).
// STEPS 순서로 서류 step 의 validateDoc(form).missing 을 모으되 label 처음 등장 시만 담는다.
function dedupedMissing(form) {
  const seen = new Set();
  const list = [];
  for (const s of STEPS) {
    if (!s.docId) continue;
    for (const mi of validateDoc(form, s.docId).missing) {
      if (seen.has(mi.label)) continue;
      seen.add(mi.label);
      list.push(mi);
    }
  }
  return list;
}

// 빈 양식 = 최대 누락(단, blankContractForm 은 체결일 기본값을 가지므로 날짜를 비워 공통 5종을 모두 누락).
function emptyForm() {
  const f = blankContractForm();
  f.common.year = ""; f.common.month = ""; f.common.day = "";
  return f;
}

console.log("\n[A] 중복 제거 — 공통 누락은 1회만(7× 중복 없음), label 유일");
{
  const list = dedupedMissing(emptyForm());
  const labels = list.map((m) => m.label);
  ok(new Set(labels).size === labels.length, `label 중복 없음 (${labels.length}건 전부 유일)`);
  // 공통 누락 "위탁자 (성명/상호)" 는 7종 서류 모두의 missing 에 등장하지만 통합 목록엔 1회만.
  const trustorCount = labels.filter((l) => l === "위탁자 (성명/상호)").length;
  ok(trustorCount === 1, `공통 누락(위탁자)은 통합 목록에 1회만 (실제 ${trustorCount})`);
  // 중복 제거 전 원시 합계는 같은 label 을 7번 담아 더 많아야 한다(중복 제거가 실제로 작동).
  let raw = 0;
  const f = emptyForm();
  for (const s of STEPS) if (s.docId) raw += validateDoc(f, s.docId).missing.length;
  ok(raw > list.length, `중복 제거 전(${raw}) > 후(${list.length}) — 중복 제거 실효`);
}

console.log("\n[B] 빈 양식: 공통 5종 + 서류별 2종(가격·원본가액) = 7건 모두 포함");
{
  const labels = dedupedMissing(emptyForm()).map((m) => m.label);
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
  ok(labels.length === expect.length, `통합 목록 = 정확히 ${expect.length}건 (실제 ${labels.length})`);
}

console.log("\n[C] 완성 폼: 남은 입력 0 → 체크리스트 미노출(빈 목록)");
{
  const f = blankContractForm();
  f.trustors[0].name = "주식회사 갑";
  f.priorities[0].name = "을은행";
  f.priorities[0].loanAmount = "5000000000";
  f.properties[0].address = "서울특별시 강남구 테헤란로 1";
  f.docContents.appform.valuationPrice = "12000000000";
  f.docContents.valReport.principalValue = "8000000000";
  const list = dedupedMissing(f);
  ok(list.length === 0, `완성 폼 통합 목록 0건 (실제 ${list.length})`);
  // 동시에 7종 전부 생성 가능해야 일관(체크리스트 미노출 ↔ readyCount===total)
  const ready = COLLATERAL_OUTPUT_DOCS.filter((d) => validateDoc(f, d.id).ok).length;
  ok(ready === COLLATERAL_OUTPUT_DOCS.length, `7종 전부 생성 가능 (실제 ${ready}/${COLLATERAL_OUTPUT_DOCS.length})`);
}

console.log("\n[D] 모든 항목 stepIdx 는 실재 STEP·where 는 STEPS 파생(고아 점프 없음)");
{
  const list = dedupedMissing(emptyForm());
  ok(list.every((m) => typeof m.stepIdx === "number" && !!stepByIdx(m.stepIdx)),
    "모든 항목 stepIdx 가 STEPS 에 존재");
  ok(list.every((m) => m.where === whereOf(m.stepIdx) && m.where.length > 0),
    "where === STEP.label + ' ' + STEP.title (drift 자동 동기)");
}

console.log("\n[E] 부분 완성: 채운 입력은 목록에서 빠지고 남은 입력만(증분 정확)");
{
  const f = emptyForm();
  // 위탁자·우선수익자명만 채운다 → 그 2건은 빠지고 나머지는 남아야.
  f.trustors[0].name = "주식회사 갑";
  f.priorities[0].name = "을은행";
  const labels = dedupedMissing(f).map((m) => m.label);
  ok(!labels.includes("위탁자 (성명/상호)"), "채운 위탁자명 → 목록에서 제거");
  ok(!labels.includes("우선수익자 (성명/상호)"), "채운 우선수익자명 → 목록에서 제거");
  ok(labels.includes("우선수익자 대출금액"), "미입력 대출금액 → 목록 잔존");
  ok(labels.includes("신탁부동산 가격"), "미입력 가격 → 목록 잔존");
  ok(labels.includes("계약 체결일 (연·월·일)"), "미입력 체결일 → 목록 잔존");
}

console.log("\n[F] 통합 목록 = 각 서류 검증박스 누락의 합집합과 정확히 일치(누락·과잉 없음)");
{
  const f = emptyForm();
  const union = new Set();
  for (const d of COLLATERAL_OUTPUT_DOCS) {
    for (const m of validateDoc(f, d.id).missing) union.add(m.label);
  }
  const listLabels = new Set(dedupedMissing(f).map((m) => m.label));
  ok(union.size === listLabels.size, `합집합 크기 일치 (서류별 합집합 ${union.size} = 통합 ${listLabels.size})`);
  ok([...union].every((l) => listLabels.has(l)), "서류별 누락 전부가 통합 목록에 존재(누락 없음)");
  ok([...listLabels].every((l) => union.has(l)), "통합 목록에 서류별에 없는 항목 없음(과잉 없음)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
