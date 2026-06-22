/* ============================================================
   회귀 가드 — 부동산 등기 고유번호 확인용 readback

   배경: 부동산 등기 고유번호는 신탁부동산 표(신청서 partyTable·계약서 별지)에 그대로
   박히는 14자리 법적 식별자다(builders.js tc(p.regNo)). 한 자리 전치·누락이 치명적인데,
   StepProperty 는 종전 "14자리 아님" 인라인 오류만 띄울 뿐 **유효한 14자리를 입력했을 때
   그 번호를 되읽어 등기부등본과 대조하게 하는 readback 이 없었다**(금액 한글·면적 평환산·
   생년월일·날짜 요일·신탁기간 범위까지 누적된 입력 확인 readback 의 마지막 식별자 동선).
   정확히 14자리일 때 등기사항증명서 표기와 동일한 4-4-6 묶음("NNNN-NNNN-NNNNNN")으로
   되읽어 준다(표시 전용·비차단, formatRegNoReadback 단일 출처).

   핵심 불변식:
     - ★표시 전용 — 빌더·조문·게이트(validate) 무접촉(readback 은 산출물에 박히지 않음).
     - readback ⟺ isValidRegNo(true) 상호배타 — 정확히 14자리일 때만 묶음, 그 외 "".
       즉 인라인 오류(14자리 아님)와 readback 은 동시에 뜨지 않는다.
     - 4-4-6 묶음은 OCR 정규식 \d{4}-\d{4}-\d{6}·isValidRegNo(14자리)와 동일 출처
       (추정 형식 아님 — 각 묶음의 의미는 주장하지 않고 표기 형식만 재현).
     - 하이픈 섞인 입력도 숫자만 추출해 표준 묶음으로 정규화.
     - loan-hangul 기존 클래스 재사용(새 CSS 0)·선두 장식 글리프 미사용(접근명 오염 0).

   단언:
     (A) formatRegNoReadback 값 — 14자리 → 4-4-6 묶음·하이픈 입력 정규화
     (B) 경계 — 13/15자리·빈 값·null → ""(미표시)
     (C) isValidRegNo 와 상호배타 — readback 비어있음 ⟺ !isValidRegNo
     (D) StepProperty 배선 — import·readback 조건부 렌더(loan-hangul role=status)
     (E) 무접촉/무회귀 — 빌더·게이트에 regno readback 미혼입·새 CSS 0·면적 readback 무회귀

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-property-regno-readback.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { formatRegNoReadback, isValidRegNo, formatAreaReadback } from "../src/lib/engine/calc.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const __dir = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(join(__dir, "..", ...p), "utf8");
const stepProperty = read("src", "components", "trust", "steps", "StepProperty.tsx");
const calc = read("src", "lib", "engine", "calc.ts");
const validate = read("src", "lib", "engine", "validate.ts");
const builders = read("src", "lib", "engine", "docx", "builders.js");
const globals = read("src", "app", "globals.css");

console.log("\n[A] formatRegNoReadback 값 — 14자리 → 4-4-6 묶음·하이픈 입력 정규화");
{
  ok(formatRegNoReadback("11011234567890") === "1101-1234-567890",
     "순수 14자리 → '1101-1234-567890'(4-4-6 묶음)");
  ok(formatRegNoReadback("1101-1234-567890") === "1101-1234-567890",
     "표준 하이픈 입력 → 동일 묶음(정규화)");
  ok(formatRegNoReadback("1101 1234 567890") === "1101-1234-567890",
     "공백 섞인 입력 → 숫자만 추출해 표준 묶음");
  ok(formatRegNoReadback(11011234567890) === "1101-1234-567890",
     "number 타입 14자리 → 묶음(타입 무관)");
  // 전치 구별 — 한 자리만 달라도 묶음 문자열이 달라져 눈으로 잡힌다
  ok(formatRegNoReadback("11011234567809") !== formatRegNoReadback("11011234567890"),
     "끝 2자리 전치(…7890↔…7809) → 묶음 상이(전치 가시화)");
}

console.log("\n[B] 경계 — 13/15자리·빈 값·null → ''(미표시)");
{
  ok(formatRegNoReadback("1101123456789") === "", "13자리(1자리 부족) → '' (미표시)");
  ok(formatRegNoReadback("110112345678901") === "", "15자리(1자리 초과) → '' (미표시)");
  ok(formatRegNoReadback("") === "" && formatRegNoReadback(null) === "" && formatRegNoReadback(undefined) === "",
     "빈 값·null·undefined → '' (미표시)");
  ok(formatRegNoReadback("일이삼사오육칠팔구십일이삼사") === "",
     "숫자 아닌 14글자(한글) → '' (숫자만 추출 후 0자리)");
}

console.log("\n[C] isValidRegNo 와 상호배타 — readback 있음 ⟺ isValidRegNo true");
{
  const cases = ["11011234567890", "1101-1234-567890", "1101123456789", "110112345678901", "", "abc"];
  let consistent = true;
  for (const c of cases) {
    const hasReadback = formatRegNoReadback(c) !== "";
    if (hasReadback !== isValidRegNo(c)) consistent = false;
  }
  ok(consistent, "모든 케이스에서 (readback 비어있지 않음) ⟺ isValidRegNo(true) — 인라인 오류와 상호배타");
}

console.log("\n[D] StepProperty 배선 — import·readback 조건부 렌더(loan-hangul role=status)");
{
  ok(/import \{[^}]*formatRegNoReadback[^}]*\} from "@\/lib\/engine\/calc";/.test(stepProperty),
     "calc 에서 formatRegNoReadback import");
  ok(/\{formatRegNoReadback\(p\.regNo\) && \(/.test(stepProperty),
     "formatRegNoReadback(p.regNo) 있을 때만 렌더");
  ok(/<div className="loan-hangul" role="status" aria-live="polite">\{formatRegNoReadback\(p\.regNo\)\}<\/div>/.test(stepProperty),
     "loan-hangul role=status polite 로 묶음 렌더");
  // 기존 14자리 인라인 오류는 보존(무회귀)
  ok(/등기 고유번호는 숫자 14자리입니다/.test(stepProperty),
     "기존 '14자리' 인라인 오류 안내 보존(무회귀)");
}

console.log("\n[E] 무접촉/무회귀 — 빌더·게이트에 regno readback 미혼입·새 CSS 0·면적 readback 무회귀");
{
  ok(/export function formatRegNoReadback\(/.test(calc),
     "calc.ts 에 formatRegNoReadback export");
  // 단일 출처 — 14자리 판정이 isValidRegNo 와 동일(replace(/\D/g,"").length===14)
  ok(/digits\.length !== 14/.test(calc) && /String\(v == null \? "" : v\)\.replace\(\/\\D\/g, ""\)/.test(calc),
     "14자리 판정 = isValidRegNo 와 동일 추출/길이 규칙(단일 출처)");
  // 산출물 빌더에 readback 미혼입(표시 전용)
  ok(!/formatRegNoReadback/.test(builders),
     "builders.js(산출물)에 regno readback 미혼입 — 표시/출력 경계 분리");
  // 게이트(validate)는 readback 과 무관(비차단)
  ok(!/formatRegNoReadback/.test(validate),
     "validate.ts(게이트)는 regno readback 과 무관 — 차단/검증 대상 아님(표시 전용)");
  // 면적 readback 무회귀(같은 StepProperty 동거 함수)
  ok(formatAreaReadback("100") !== "" && formatAreaReadback("0") === "" && formatAreaReadback("해당 없음") === "",
     "formatAreaReadback 무회귀(양수만 문구·0/free-form '')");
  // loan-hangul 기존 CSS 재사용 — 새 CSS 0
  ok(/\.loan-hangul\s*\{/.test(globals), "loan-hangul CSS 기존 재사용(새 CSS 0)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
