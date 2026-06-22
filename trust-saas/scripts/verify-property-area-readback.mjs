/* ============================================================
   회귀 가드 — StepProperty 면적(㎡) 입력 확인용 readback (천단위 콤마 + 평 환산)

   배경: 신탁 부동산 면적(`property.area`)은 별첨1·신청서·계약서 별지 부동산표에
   `area + "㎡"`로 그대로 박히는 정량 입력값이다(builders.js: tc(p.area)·`area+"㎡"`).
   게이트(validateDoc)·인라인 무효 안내(isPositiveAmount)는 "채웠지만 0·음수·비숫자"를
   짚지만, 금액 입력처럼 **자릿수·규모를 입력 지점에서 눈으로 교차검증**할 readback 은
   없었다(대출금액·가격·원본가액·신탁보수는 모두 한글 금액 readback 보유). 이제 면적이
   양(+)의 숫자일 때 "1,234.56㎡ · 약 373.4평"(천단위 콤마 + 평 환산)을 에코해 규모
   오입력(자릿수 한 자리 차이·㎡↔평 혼동)을 입력 지점에서 짚게 한다.

   핵심 불변식:
     - ★표시 전용 — 산출물은 ㎡ 만 표기, 평 환산은 입력 확인용(빌더·조문·게이트 무접촉).
     - 양(+)의 숫자만 readback(빈 값·0·음수·비숫자는 "" = 인라인 무효 안내와 상호배타).
     - 평 환산 상수 = 400/121 ㎡(대한민국 부동산 표준·추정 아님)·parseAmount 단일 출처(콤마·소수 허용).
     - loan-hangul 기존 클래스 재사용(새 CSS 0)·role=status·aria-live=polite(금액 readback 패턴 동형).

   단언:
     (A) interpretArea/formatAreaReadback 순수 거동 — 환산·콤마·반올림·무효 무간섭
     (B) StepProperty 배선 — import·양수일 때만 readback·loan-hangul·role=status
     (C) 무접촉/무회귀 — 무효 안내·등기번호 인라인 보존·게이트(validate) 무접촉·새 CSS 0·조문/빌더 import 0

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-property-area-readback.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { interpretArea, formatAreaReadback, SQM_PER_PYEONG } from "../src/lib/engine/calc.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const __dir = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(join(__dir, "..", ...p), "utf8");
const stepProp = read("src", "components", "trust", "steps", "StepProperty.tsx");
const validate = read("src", "lib", "engine", "validate.ts");
const globals = read("src", "app", "globals.css");
const builders = read("src", "lib", "engine", "docx", "builders.js");

console.log("\n[A] interpretArea/formatAreaReadback 순수 거동 — 환산·콤마·반올림·무효 무간섭");
{
  // 환산 상수 = 400/121(대한민국 부동산 표준) — 400㎡ = 정확히 121평
  ok(SQM_PER_PYEONG === 400 / 121, "SQM_PER_PYEONG = 400/121 (척관법 표준 상수)");
  ok(JSON.stringify(interpretArea("400")) === JSON.stringify({ sqm: 400, pyeong: 121 }),
     "400㎡ → {sqm:400, pyeong:121}(정확 환산)");
  // 콤마·소수점 입력 허용(parseAmount 단일 출처) — 금액 검증과 정합
  ok(interpretArea("1,234.5")?.sqm === 1234.5, "1,234.5(콤마·소수) → sqm 1234.5(parseAmount 허용)");
  // 양수 아닌 값 → null(인라인 무효 안내와 상호배타·무간섭)
  ok(interpretArea("0") === null && interpretArea("-5") === null,
     "0·음수 → null(무효 안내가 담당·readback 무간섭)");
  ok(interpretArea("abc") === null && interpretArea("") === null
     && interpretArea(null) === null && interpretArea(undefined) === null,
     "비숫자·빈 값·null·undefined → null");
  // 문구: 천단위 콤마 + 평 환산(소수 첫째 반올림 근사)
  ok(formatAreaReadback("400") === "400㎡ · 약 121평", "400 → '400㎡ · 약 121평'");
  ok(formatAreaReadback("3306") === "3,306㎡ · 약 1,000.1평", "3306 → 천단위 콤마 + 평 환산 반올림");
  ok(formatAreaReadback("100") === "100㎡ · 약 30.3평", "100㎡ → 약 30.3평(30.25 반올림)");
  // ★규모 오입력 교차검증 — 자릿수 한 자리 차이가 readback 에서 또렷이 구별
  ok(formatAreaReadback("3306") !== formatAreaReadback("330.6"),
     "3306 ↔ 330.6(자릿수 차이) → readback 상이(규모 오입력 구별)");
  // 양수 아니면 "" (미표시)
  ok(formatAreaReadback("0") === "" && formatAreaReadback("-5") === "" && formatAreaReadback("") === "",
     "0·음수·빈 값 → ''(미표시)");
}

console.log("\n[B] StepProperty 배선 — import·양수일 때만 readback·loan-hangul·role=status");
{
  ok(/formatAreaReadback/.test(stepProp) && /from "@\/lib\/engine\/calc"/.test(stepProp),
     "calc 에서 formatAreaReadback import");
  // 양수일 때만(빈 문자열은 falsy → 미렌더) readback 노출
  ok(/\{formatAreaReadback\(p\.area\) && \(/.test(stepProp),
     "formatAreaReadback(p.area) 가 truthy(양수)일 때만 readback 렌더");
  // 금액 readback 과 동일 표시 패턴(loan-hangul·role=status·aria-live=polite)
  ok(/className="loan-hangul" role="status" aria-live="polite">\{formatAreaReadback\(p\.area\)\}/.test(stepProp),
     "readback = loan-hangul·role=status·aria-live=polite(금액 readback 패턴 동형)");
  // 무효 안내와 상호배타 위치(area-err 무효 div 뒤에 readback) — 둘 다 area 필드 div 안
  const errIdx = stepProp.indexOf("면적은 0보다 큰 숫자만");
  const rbIdx = stepProp.indexOf("{formatAreaReadback(p.area) && (");
  ok(errIdx > 0 && rbIdx > errIdx, "readback 은 무효 안내(area-err) 뒤 — 같은 면적 필드 내(상호배타)");
}

console.log("\n[C] 무접촉/무회귀 — 무효 안내·등기번호 인라인 보존·게이트 무접촉·새 CSS 0·조문/빌더 import 0");
{
  // 기존 면적 무효 안내(role=alert)·등기 고유번호 인라인 보존
  ok(/면적은 0보다 큰 숫자만 입력하세요/.test(stepProp), "면적 무효 안내(role=alert) 보존(무회귀)");
  ok(/등기 고유번호는 숫자 14자리입니다/.test(stepProp), "등기 고유번호 인라인 검증 보존(무회귀)");
  // 게이트(validate.ts)는 면적 평 환산·readback 과 무관 — 비차단(생성 차단 무영향)
  ok(!/formatAreaReadback|interpretArea|평|SQM_PER_PYEONG/.test(validate),
     "validate.ts(게이트)는 면적 readback 과 무관 — 차단/검증 대상 아님(표시 전용)");
  // loan-hangul 은 기존 CSS — 새 CSS 0
  ok(/\.loan-hangul\s*\{/.test(globals), "loan-hangul CSS 기존 재사용(새 CSS 0)");
  // StepProperty 는 조문/별지 직접 import 0(calc 만 추가)
  ok(!/from "@\/lib\/engine\/(clauses|annex)"/.test(stepProp),
     "조문(clauses)·별지(annex) import 0(산출물·조문 무접촉)");
  // ★산출물 빌더는 면적을 ㎡로만 표기 — 평 미혼입(readback 은 입력 확인 전용)
  ok(!/약 [^]{0,20}평|formatAreaReadback|SQM_PER_PYEONG/.test(builders),
     "builders.js(산출물)는 평 환산 미혼입 — 산출물은 ㎡만 표기(표시/출력 경계 분리)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
