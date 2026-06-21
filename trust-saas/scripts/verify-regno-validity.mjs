/* ============================================================
   회귀 가드 — 부동산 등기 고유번호(regNo) 형식 유효성 게이트(14자리)

   배경(정확성 갭): 신청서 관계사/부동산 표·계약서 별지(builders.js: tc(p.regNo))에는 각 신탁
   부동산의 등기 고유번호가 그대로 박힌다. 그러나 검증 게이트(validateDoc)는 — 금액 5종·체결일·
   비율·사업자등록번호·법인등록번호까지 게이트화한 뒤에도 — 부동산 등기 고유번호를 전혀 검사하지
   않아, 자릿수가 맞지 않는 오타·부분 입력이 법적 서류에 그대로 들어갈 수 있었다("정형 식별번호"
   정합성 결함 유형의 마지막 입력).
     · StepProperty 입력은 자유 텍스트(숫자만 허용·자릿수 검사 없음).
     · import·구버전 저장본·AI 머지로도 잘못된 번호가 들어올 수 있다.

   ★영향 점검 — 무회귀:
     등기 고유번호는 게이트가 한 번도 요구한 적 없는 "선택 입력"이다(미입력 계약도 정상).
     따라서 **빈 값은 차단하지 않는다**. "입력됐으나 정확히 14자리가 아닌" 경우만 차단한다
     (사업자번호·법인번호·금액 패턴과 동일 논리 — 잘못된 자릿수는 애초에 "올바른" 적 없는 데이터).

   ★추정 체크섬 금지(사업자번호·법인번호와의 핵심 차이):
     부동산 등기 고유번호는 사업자번호(국세청)·법인번호(표준)와 달리 **공개 표준 체크섬 알고리즘이
     존재하지 않는다.** 체크섬을 임의로 만들면 유효한 실제 번호를 오탐 차단할 위험이 있으므로
     (추정 금지 원칙), 4-4-6 = "정확히 14자리"라는 형식 완결성만 검사한다(앱 OCR/추출 정규식
     `\d{4}-\d{4}-\d{6}` 와 동일 출처).

   본 가드(조문·엔진·생성/DOCX 로직 무접촉 — 입력 완결성만):
     (A) isValidRegNo 단일 출처 — 형식(14자리·대시 처리·자릿수 불일치)
     (B) 핵심 갭: 채웠지만 무효(13/15자리·부분 입력) → ok=false + '등기 고유번호' 안내
     (C) 무회귀: 빈 값·유효한 14자리는 통과(오탐 없음)
     (D) 다수 부동산 — 어느 부동산이 무효인지 1-based 번호로 식별·각각 누적
     (E) 점프 타깃 = STEP 03(property)·where 제목 파생
     (F) 필수 공통 검사 — 전 7종 서류 차단(다른 정합성 게이트와 동일 일관성)
     (G) ★추정 체크섬 금지 — 14자리면 통과(체크섬 미검사), 임의 체크섬으로 유효 번호 오탐 없음
     (H) 회귀: 다른 게이트(가격)와 독립 누적·무영향

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-regno-validity.mjs
   ============================================================ */
import { blankContractForm, blankProperty } from "../src/lib/engine/model.ts";
import { validateDoc } from "../src/lib/engine/validate.ts";
import { isValidRegNo } from "../src/lib/engine/calc.ts";
import { STEPS } from "../src/lib/engine/schema.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const ALL_DOCS = ["appform", "contract", "poa", "valReport", "boardMin", "cdd", "ubo"];
const VALID = "1234-5678-901234";   // 4-4-6 = 14자리(형식 유효)
const VALID_RAW = "12345678901234"; // 대시 없는 14자리
const SHORT = "1234-5678-9012";     // 12자리(부분 입력)
const LONG = "1234-5678-9012345";   // 15자리(초과)

// 공통 필수(당사자·물건·체결일·금액·기간·비율)를 모두 유효하게 채운 양식 → regNo 단일 변인 격리.
function baseFilled() {
  const form = blankContractForm();
  form.trustors[0].name = "주식회사 갑";
  form.priorities[0].name = "을은행";
  form.priorities[0].loanAmount = "5000000000";
  form.properties[0].address = "서울특별시 강남구 테헤란로 1";
  form.common.year = 2026;
  form.common.month = 6;
  form.common.day = 21;
  form.common.trustFee = "30000000";
  form.common.priorityRatio = 120;
  form.docContents.appform.valuationPrice = "10000000000";
  form.docContents.valReport.principalValue = "8000000000";
  return form; // 등기 고유번호는 비어 있음(선택 입력)
}
const labelsOf = (form, docId) => validateDoc(form, docId).missing.map((m) => m.label);
const hasRegMiss = (form, docId) => labelsOf(form, docId).some((l) => l.includes("등기 고유번호"));

console.log("\n[A] isValidRegNo 단일 출처 — 형식(14자리)");
{
  ok(isValidRegNo(VALID) === true, "1234-5678-901234 → 유효(대시 제거 14자리)");
  ok(isValidRegNo(VALID_RAW) === true, "12345678901234 → 유효(대시 없는 14자리)");
  ok(isValidRegNo(SHORT) === false, "12자리 → 무효(자릿수)");
  ok(isValidRegNo(LONG) === false, "15자리 → 무효(자릿수)");
  ok(isValidRegNo("") === false && isValidRegNo(null) === false && isValidRegNo(undefined) === false,
    "빈 값·null·undefined → 무효(게이트가 빈 값을 별도 제외)");
  ok(isValidRegNo("abcd-efgh-ijklmn") === false, "비숫자(자릿수 0) → 무효");
}

console.log("\n[B] 핵심 갭 — 채웠지만 무효(부분/초과 입력)는 차단");
{
  const f1 = baseFilled();
  f1.properties[0].regNo = SHORT;
  ok(validateDoc(f1, "contract").ok === false, "부동산 등기 고유번호 12자리 → ok=false(생성 차단)");
  ok(hasRegMiss(f1, "contract"), "12자리 → '등기 고유번호' 안내");
  const f2 = baseFilled();
  f2.properties[0].regNo = LONG;
  ok(validateDoc(f2, "contract").ok === false, "15자리 → ok=false(차단)");
  ok(hasRegMiss(f2, "contract"), "15자리 → '등기 고유번호' 안내");
}

console.log("\n[C] 무회귀 — 빈 값·유효한 14자리는 통과(오탐 없음)");
{
  const base = baseFilled();
  ok(base.properties[0].regNo === "", "blankContractForm 부동산 등기 고유번호 빈 값(무회귀 전제)");
  ok(validateDoc(base, "contract").ok === true, "등기 고유번호 빈 값 → ok=true(선택 입력 무회귀 기준선)");
  ok(!hasRegMiss(base, "contract"), "빈 값 → 등기 고유번호 오탐 없음");
  const fOk = baseFilled();
  fOk.properties[0].regNo = VALID;
  ok(validateDoc(fOk, "contract").ok === true, "유효한 14자리 → ok=true");
  ok(!hasRegMiss(fOk, "contract"), "유효 번호 → 오탐 없음");
}

console.log("\n[D] 다수 부동산 — 1-based 번호로 식별·각각 누적");
{
  const f = baseFilled();
  f.properties.push(blankProperty()); // 부동산 2
  f.properties[1].address = "서울특별시 서초구 반포대로 2";
  f.properties[1].regNo = SHORT; // 부동산 2 만 무효
  const labels = labelsOf(f, "contract");
  ok(labels.some((l) => l === "부동산 2 등기 고유번호 (형식 오류 — 14자리)"),
    "부동산 2 무효 → '부동산 2 등기 고유번호' 식별");
  ok(!labels.some((l) => l === "부동산 1 등기 고유번호 (형식 오류 — 14자리)"),
    "부동산 1(빈 값) → 안내 없음(독립)");
  // 부동산 1·2 동시 무효 → 각각 누적
  const f2 = baseFilled();
  f2.properties[0].regNo = SHORT;
  f2.properties.push(blankProperty());
  f2.properties[1].address = "부동산2";
  f2.properties[1].regNo = LONG;
  const l2 = labelsOf(f2, "contract");
  ok(l2.some((l) => l.startsWith("부동산 1 등기 고유번호")) && l2.some((l) => l.startsWith("부동산 2 등기 고유번호")),
    "부동산 1·2 동시 무효 → 각각 안내 누적");
}

console.log("\n[E] 점프 타깃 — STEP 03(property)·where 제목 파생");
{
  const propertyStep = STEPS.find((s) => s.key === "property"); // STEP 03
  const f = baseFilled(); f.properties[0].regNo = SHORT;
  const mm = validateDoc(f, "contract").missing.find((x) => x.label.startsWith("부동산 1 등기 고유번호"));
  ok(!!mm && mm.stepIdx === propertyStep.idx, "점프 타깃 = STEP 03(property)");
  ok(!!mm && mm.where.includes(propertyStep.title), "안내 where = STEP 03 제목 파생");
}

console.log("\n[F] 필수 공통 검사 — 전 7종 서류 차단(정합성 게이트 일관성)");
{
  const f = baseFilled(); f.properties[0].regNo = SHORT;
  for (const docId of ALL_DOCS) {
    ok(validateDoc(f, docId).ok === false, `무효 등기 고유번호 → ${docId} 차단(공통)`);
    ok(hasRegMiss(f, docId), `무효 등기 고유번호 → ${docId} 안내`);
  }
}

console.log("\n[G] ★추정 체크섬 금지 — 14자리면 통과(체크섬 미검사·임의 체크섬 오탐 없음)");
{
  // 부동산 등기 고유번호는 공개 표준 체크섬이 없으므로, "임의 체크섬"으로 유효한 실제 번호를
  // 오탐 차단하지 않는다. 자릿수만 14면(어떤 14자리 조합이든) 통과해야 한다.
  for (const raw of ["00000000000000", "99999999999999", "11112222333344", VALID_RAW]) {
    const f = baseFilled(); f.properties[0].regNo = raw;
    ok(validateDoc(f, "contract").ok === true, `14자리 ${raw} → ok=true(형식만 검사·체크섬 미적용)`);
    ok(!hasRegMiss(f, "contract"), `14자리 ${raw} → 오탐 없음`);
  }
}

console.log("\n[H] 회귀 — 다른 게이트(가격)와 독립 누적·무영향");
{
  const fGood = baseFilled();
  for (const docId of ALL_DOCS) ok(validateDoc(fGood, docId).ok === true, `등기 고유번호 무관(빈 값) → ${docId} ok=true`);
  // 등기 고유번호·가격 동시 무효 → 두 안내 독립 누적
  const fBoth = baseFilled();
  fBoth.properties[0].regNo = SHORT;
  fBoth.docContents.appform.valuationPrice = "-1";
  ok(hasRegMiss(fBoth, "appform"), "등기 고유번호·가격 동시 무효 → 등기 고유번호 안내 존재(appform)");
  ok(labelsOf(fBoth, "appform").some((l) => l.includes("신탁부동산 가격") && l.includes("유효하지 않은 금액")),
    "등기 고유번호·가격 동시 무효 → 가격 안내도 존재(독립)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
