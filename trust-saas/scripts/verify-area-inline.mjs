/* ============================================================
   회귀 가드 — 신탁부동산 면적(area) 게이트 + StepProperty 인라인 검증 피드백

   배경(정확성·접근성 패리티, 비-산출물): 신탁부동산 표(별첨1·신청서 partyTable·계약서 별지·
   미리보기)의 면적칸에는 각 부동산의 면적이 `p.area + "㎡"`로 그대로 박힌다(builders.js:
   tc(p.area)·`r.area + "㎡"`). 면적은 가격·원본가액·개별 대출금액과 동일한 "정량 출력 필드"이나,
   금액 5종·체결일·비율·식별번호·등기 고유번호까지 게이트(validateDoc)·인라인을 갖춘 뒤에도
   **면적만 게이트도 인라인도 전무**해, "0·음수·비숫자"인 면적(예: -50·abc·0)이 법적 표에
   "-50㎡"·"NaN㎡"·"0㎡"로 들어갈 수 있던 마지막 정량 입력 갭(WCAG 3.3.1/4.1.2).
     · StepProperty 입력은 자유 텍스트(숫자 검사 없음). import·구버전 저장본·OCR 오추출·AI 머지로도
       잘못된 값이 들어올 수 있다.

   ★영향 점검 — 무회귀:
     면적은 게이트가 한 번도 요구한 적 없는 "선택 입력"이다(빌더가 빈 면적을 빈칸으로 렌더,
     미입력 계약도 정상). 따라서 **빈 값은 차단하지 않는다**. "채웠지만 0·음수·비숫자"만 차단한다
     (가격·원본가액·개별 대출금액·등기 고유번호와 동일 논리 — 잘못된 값은 애초에 "올바른" 적 없는 데이터).
     단위(㎡)는 빌더가 자동 표기하므로 숫자만 입력한다 — parseAmount 가 쉼표·공백을 허용하고
     소수점 면적(1234.56)도 양수로 통과하므로 정상 면적은 오탐하지 않는다(isPositiveAmount 정합).

   본 가드(빌더·조문·생성/DOCX 로직 무접촉 — 입력 완결성·표시/접근성만):
     (A) 단일 출처 — isPositiveAmount 가 소수·쉼표 면적은 통과, 0·음수·비숫자·단위혼입은 무효
     (B) StepProperty 컴포넌트 배선 — calc import + input aria-invalid/describedby + 오류 div role=alert,
         무효일 때만 렌더(나그 방지)
     (C) 고아 참조 0 — describedby 템플릿 === 오류 div id 템플릿(`prop-${i}-area-err` 단일 출처)
     (D) ★게이트 정합 — 인라인이 무효로 보는 값 ⟺ validateDoc 도 그 면적 차단(모순 0),
         인라인 OFF(빈 값·유효 면적) ⟺ 게이트도 차단 없음(오탐/나그 0)
     (E) 무회귀 — 빈 면적(기준선)·유효 면적은 통과
     (F) 다수 부동산 — 어느 부동산 면적이 무효인지 1-based 번호로 식별·각각 누적
     (G) 점프 타깃 = STEP 03(property)·where 제목 파생
     (H) 필수 공통 검사 — 전 7종 서류 차단(다른 정합성 게이트와 동일 일관성)
     (I) 회귀 — 등기 고유번호·가격 등 다른 게이트와 독립 누적·무영향

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-area-inline.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { blankContractForm, blankProperty } from "../src/lib/engine/model.ts";
import { validateDoc } from "../src/lib/engine/validate.ts";
import { isPositiveAmount } from "../src/lib/engine/calc.ts";
import { STEPS } from "../src/lib/engine/schema.ts";

const __dir = dirname(fileURLToPath(import.meta.url));
const src = (rel) => readFileSync(join(__dir, "..", rel), "utf8");
const step = src("src/components/trust/steps/StepProperty.tsx");
const flat = step.replace(/\s+/g, " ");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const ALL_DOCS = ["appform", "contract", "poa", "valReport", "boardMin", "cdd", "ubo"];

console.log("=== 신탁부동산 면적(area) 게이트 + 인라인 검증 피드백 ===\n");

console.log("[A] 단일 출처 — isPositiveAmount: 소수·쉼표 통과 / 0·음수·비숫자·단위혼입 무효");
{
  // 정상 면적(오탐 없어야 함)
  for (const good of ["1234.56", "1,234.56", "84", "1234", "0.5"]) {
    ok(isPositiveAmount(good) === true, `유효 면적 ${JSON.stringify(good)} → true(오탐 없음)`);
  }
  // 무효 면적(차단 대상)
  for (const bad of ["0", "-50", "-1234.5", "abc", "1234㎡", "", "  "]) {
    ok(isPositiveAmount(bad) === false, `무효 면적 ${JSON.stringify(bad)} → false`);
  }
}

console.log("\n[B] StepProperty 배선 — calc import + aria-invalid/describedby + 오류 div role=alert");
ok(/import\s*\{[^}]*\bisPositiveAmount\b[^}]*\}\s*from\s*["']@\/lib\/engine\/calc["']/.test(step),
  "StepProperty: isPositiveAmount 를 calc 에서 import");
ok(/aria-invalid=\{\(p\.area\.trim\(\)\.length\s*>\s*0\s*&&\s*!isPositiveAmount\(p\.area\)\)\s*\|\|\s*undefined\}/.test(step),
  "면적 input: aria-invalid={(채움 && !isPositiveAmount) || undefined}");
ok(/aria-describedby=\{p\.area\.trim\(\)\.length\s*>\s*0\s*&&\s*!isPositiveAmount\(p\.area\)\s*\?\s*`prop-\$\{i\}-area-err`\s*:\s*undefined\}/.test(step),
  "면적 input: aria-describedby={무효 ? `prop-${i}-area-err` : undefined}");
ok(/id=\{`prop-\$\{i\}-area-err`\}[^>]*role="alert"/.test(flat),
  "오류 div id={`prop-${i}-area-err`} role=\"alert\"");
ok(/\{p\.area\.trim\(\)\.length\s*>\s*0\s*&&\s*!isPositiveAmount\(p\.area\)\s*&&\s*\(/.test(step),
  "오류 div 는 무효(채움 && !isPositiveAmount)일 때만 렌더(나그 방지)");

console.log("\n[C] 고아 참조 0 — describedby 템플릿 === 오류 div id 템플릿(prop-${i}-area-err)");
{
  const describedTmpl = /aria-describedby=\{[^?]*\?\s*`(prop-\$\{i\}-area-err)`\s*:\s*undefined\}/.exec(step);
  const divTmpl = /id=\{`(prop-\$\{i\}-area-err)`\}/.exec(step);
  ok(!!describedTmpl && !!divTmpl && describedTmpl[1] === divTmpl[1],
    `describedby(${describedTmpl?.[1]}) === 오류 div id(${divTmpl?.[1]}) — 고아 참조 0`);
}

// 면적만 단일 변인으로 격리 — 그 외 공통 필수를 모두 유효하게 채운다.
function baseFilled() {
  const f = blankContractForm();
  f.trustors[0].name = "주식회사 갑";
  f.priorities[0].name = "을은행";
  f.priorities[0].loanAmount = "5000000000";
  f.properties[0].address = "서울특별시 강남구 테헤란로 1";
  f.common.year = 2026;
  f.common.month = 6;
  f.common.day = 21;
  f.common.priorityRatio = 120;
  f.common.trustFee = "50000000";
  f.common.trustPeriod = "담보신탁 등기일로부터";
  f.docContents.appform.valuationPrice = "10000000000";
  f.docContents.valReport.principalValue = "8000000000";
  return f; // 면적은 비어 있음(선택 입력)
}
const labelsOf = (form, docId) => validateDoc(form, docId).missing.map((m) => m.label);
const hasAreaMiss = (form, docId, idx = 1) =>
  labelsOf(form, docId).some((l) => l === `부동산 ${idx} 면적 (유효하지 않은 값)`);

console.log("\n[D] ★게이트 정합 — 인라인 무효 ⟺ validateDoc 차단 / 인라인 OFF ⟺ 무차단");
{
  // 인라인 컴포넌트가 신뢰하는 단일 출처를 그대로 재현
  const filled = (v) => typeof v === "string" && v.trim().length > 0;
  const invalidInline = (v) => filled(v) && !isPositiveAmount(v);
  const blocks = (v) => {
    const f = baseFilled(); f.properties[0].area = v;
    return validateDoc(f, "contract").ok === false && hasAreaMiss(f, "contract");
  };
  // 인라인이 무효로 보는 값 → 게이트도 반드시 차단(모순 0)
  for (const bad of ["0", "-50", "-1234.5", "abc", "1234㎡", "0㎡"]) {
    ok(invalidInline(bad) === true, `  인라인 ON: invalid(${JSON.stringify(bad)})=true`);
    ok(blocks(bad) === true, `  → 게이트도 차단(정합)`);
  }
  // 인라인이 안 켜는 값(빈 값·공백 = 미채움, 유효 면적) → 게이트도 차단 없음(오탐/나그 0)
  for (const good of ["", "   ", "1234.56", "1,234.56", "84"]) {
    ok(invalidInline(good) === false, `  인라인 OFF: invalid(${JSON.stringify(good)})=false`);
    const f = baseFilled(); f.properties[0].area = good;
    ok(validateDoc(f, "contract").ok === true && !hasAreaMiss(f, "contract"),
      `  → 게이트도 차단 없음(오탐/나그 0)`);
  }
}

console.log("\n[E] 무회귀 — 빈 면적(기준선)·유효 면적은 통과");
{
  const base = baseFilled();
  ok(base.properties[0].area === "", "blankContractForm 면적 빈 값(무회귀 전제)");
  ok(validateDoc(base, "contract").ok === true, "면적 빈 값 → ok=true(선택 입력 무회귀 기준선)");
  ok(!hasAreaMiss(base, "contract"), "빈 값 → 면적 오탐 없음");
  const fOk = baseFilled(); fOk.properties[0].area = "1234.56";
  ok(validateDoc(fOk, "contract").ok === true && !hasAreaMiss(fOk, "contract"),
    "유효 소수 면적 1234.56 → ok=true·오탐 없음");
}

console.log("\n[F] 다수 부동산 — 1-based 번호로 식별·각각 누적");
{
  const f = baseFilled();
  f.properties.push(blankProperty()); // 부동산 2
  f.properties[1].address = "서울특별시 서초구 반포대로 2";
  f.properties[1].area = "-50"; // 부동산 2 면적만 무효
  ok(hasAreaMiss(f, "contract", 2), "부동산 2 무효 면적 → '부동산 2 면적' 식별");
  ok(!hasAreaMiss(f, "contract", 1), "부동산 1(빈 값) → 안내 없음(독립)");
  // 부동산 1·2 동시 무효 → 각각 누적
  const f2 = baseFilled();
  f2.properties[0].area = "abc";
  f2.properties.push(blankProperty());
  f2.properties[1].address = "부동산2";
  f2.properties[1].area = "0";
  ok(hasAreaMiss(f2, "contract", 1) && hasAreaMiss(f2, "contract", 2),
    "부동산 1·2 동시 무효 → 각각 안내 누적");
}

console.log("\n[G] 점프 타깃 — STEP 03(property)·where 제목 파생");
{
  const propertyStep = STEPS.find((s) => s.key === "property");
  const f = baseFilled(); f.properties[0].area = "-50";
  const mm = validateDoc(f, "contract").missing.find((x) => x.label === "부동산 1 면적 (유효하지 않은 값)");
  ok(!!mm && mm.stepIdx === propertyStep.idx, "점프 타깃 = STEP 03(property)");
  ok(!!mm && mm.where.includes(propertyStep.title), "안내 where = STEP 03 제목 파생");
}

console.log("\n[H] 필수 공통 검사 — 전 7종 서류 차단(정합성 게이트 일관성)");
{
  const f = baseFilled(); f.properties[0].area = "-50";
  for (const docId of ALL_DOCS) {
    ok(validateDoc(f, docId).ok === false, `무효 면적 → ${docId} 차단(공통)`);
    ok(hasAreaMiss(f, docId), `무효 면적 → ${docId} 안내`);
  }
}

console.log("\n[I] 회귀 — 등기 고유번호·가격 등 다른 게이트와 독립 누적·무영향");
{
  const fGood = baseFilled();
  for (const docId of ALL_DOCS) ok(validateDoc(fGood, docId).ok === true, `면적 무관(빈 값) → ${docId} ok=true`);
  // 면적·등기 고유번호 동시 무효 → 두 안내 독립 누적
  const fBoth = baseFilled();
  fBoth.properties[0].area = "-50";
  fBoth.properties[0].regNo = "1234-5678-9012"; // 12자리(형식 오류)
  ok(hasAreaMiss(fBoth, "contract"), "면적·등기번호 동시 무효 → 면적 안내 존재");
  ok(labelsOf(fBoth, "contract").some((l) => l.startsWith("부동산 1 등기 고유번호")),
    "면적·등기번호 동시 무효 → 등기 고유번호 안내도 존재(독립)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
