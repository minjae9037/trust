/* ============================================================
   회귀 가드 — 개인 당사자 생년월일(주민등록번호 앞 6자리) 입력 확인용 readback

   배경: 개인 당사자의 식별번호 칸은 산출물에 "생년월일"로 렌더되고(builders.js:
   type==="개인"→"생년월일", partyIdLabel 단일 출처), 앞 6자리(YYMMDD)가 계약서 본문·
   별첨 표에 그대로 박힌다. 위저드의 다른 모든 정량 입력은 입력 지점 확인 수단을 갖췄지만
   (금액=한글 readback·면적=평 환산·날짜=달력 해석·지분율=25% 기준) 생년월일만 "실재하지 않는
   날짜"(birthInvalid) 차단 안내는 있어도 valid 일 때의 확인 readback 이 없어, 두 valid 한
   날짜 사이의 월·일 전치 오입력(예: 030915 vs 090315)을 입력 지점에서 짚을 수 없었다.
   이제 개인이고 앞 6자리가 실재하는 날짜이면 세기 코드(뒷자리 첫 자리) 유무에 따라
   "YYYY년 M월 D일생" 또는 "M월 D일생"으로 에코한다(금액·면적·날짜·지분율 readback 과 같은
   표시 전용 계열, birthInvalid 와 상호배타).

   핵심 불변식:
     - ★표시 전용 — 게이트(validateDoc)·빌더·조문 무접촉(gate 는 이미 isValidBirthDate 로 차단).
     - 세기 해석은 birthCentury 단일 출처 — isValidBirthDate(윤년 판정)와 동일(기존 동작 보존).
     - valid(실재 날짜)일 때만 readback / 그 외(빈·부분·실재 불가)는 "" = 무표시(나그 0).
     - loan-hangul 기존 클래스 재사용(새 CSS 0)·role=status·aria-live=polite(금액 readback 동형).
     - PII(주민번호)는 로컬 입력값 해석일 뿐 전송 없음(기존 원칙 유지).

   단언:
     (A) interpretBirthDate/formatBirthReadback 순수 거동 — 세기·전치 구별·무표시 경계
     (B) isValidBirthDate 무회귀 — birthCentury 단일 출처로 기존 판정 보존(윤년 2/29 포함)
     (C) PartyCard 배선 — import·개인일 때만 birthReadback·readback(loan-hangul/role=status)·상호배타
     (D) 무접촉/무회귀 — 게이트(validate) 차단 로직 보존·빌더 무혼입·새 CSS 0·기존 안내/금액 readback 보존

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-party-birthdate-readback.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { interpretBirthDate, formatBirthReadback, isValidBirthDate } from "../src/lib/engine/calc.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const __dir = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(join(__dir, "..", ...p), "utf8");
const partyCard = read("src", "components", "trust", "steps", "PartyCard.tsx");
const calc = read("src", "lib", "engine", "calc.ts");
const validate = read("src", "lib", "engine", "validate.ts");
const globals = read("src", "app", "globals.css");
const builders = read("src", "lib", "engine", "docx", "builders.js");

console.log("\n[A] interpretBirthDate/formatBirthReadback 순수 거동 — 세기·전치 구별·무표시 경계");
{
  // 세기 코드(뒷자리 첫 자리) 있음 → full year. 1900s(1) / 2000s(3)
  ok(JSON.stringify(interpretBirthDate("900315", "1234567")) === JSON.stringify({ year: 1990, month: 3, day: 15 }),
     "900315 + 뒷자리 1… → {year:1990, month:3, day:15}(1900년대)");
  ok(JSON.stringify(interpretBirthDate("030915", "3234567")) === JSON.stringify({ year: 2003, month: 9, day: 15 }),
     "030915 + 뒷자리 3… → {year:2003, month:9, day:15}(2000년대)");
  ok(formatBirthReadback("900315", "1234567") === "1990년 3월 15일생", "formatBirthReadback → '1990년 3월 15일생'");
  // ★전치 오입력 구별 — 030915(9월 15일) vs 090315(3월 15일) 둘 다 valid 한데 readback 이 다르다
  ok(formatBirthReadback("030915", "3234567") === "2003년 9월 15일생"
     && formatBirthReadback("090315", "3234567") === "2009년 3월 15일생"
     && formatBirthReadback("030915", "3234567") !== formatBirthReadback("090315", "3234567"),
     "★030915 ↔ 090315(월·일 전치) → readback 상이(전치 오입력 구별)");
  // 세기 코드 없음(미입력/불명) → 월·일만(연도 미확정)
  ok(JSON.stringify(interpretBirthDate("900315", "")) === JSON.stringify({ year: null, month: 3, day: 15 }),
     "900315 + 뒷자리 없음 → {year:null, month:3, day:15}(세기 미확정)");
  ok(formatBirthReadback("900315", "") === "3월 15일생", "세기 미확정 → 'M월 D일생'(연도 생략)");
  // 실재하지 않는 날짜 → null/"" (birthInvalid 안내가 담당, readback 무표시)
  ok(interpretBirthDate("901332", "1234567") === null && formatBirthReadback("901332", "1234567") === "",
     "901332(13월 32일=실재 불가) → null/'' (무표시·birthInvalid 담당)");
  // 부분 입력(6자리 미만) → 무표시(나그 0)
  ok(interpretBirthDate("9003", "1") === null && formatBirthReadback("9003", "1") === "",
     "9003(부분 입력) → null/'' (나그 0)");
  // 빈 값/null/undefined → 무표시
  ok(formatBirthReadback("", "") === "" && formatBirthReadback(null, null) === "" && formatBirthReadback(undefined) === "",
     "빈 값·null·undefined → ''(무표시)");
}

console.log("\n[B] isValidBirthDate 무회귀 — birthCentury 단일 출처로 기존 판정 보존(윤년 2/29 포함)");
{
  // birthCentury 단일 출처 함수 도입(calc.ts) + isValidBirthDate 가 사용
  ok(/function birthCentury\(/.test(calc) && /const base = birthCentury\(back\)/.test(calc),
     "calc.ts 에 birthCentury 단일 출처 + isValidBirthDate 가 사용");
  // 기존 판정 보존: 정상 날짜 true / 실재 불가 false
  ok(isValidBirthDate("900315", "1234567") === true, "isValidBirthDate 900315 → true(무회귀)");
  ok(isValidBirthDate("901332", "1234567") === false, "isValidBirthDate 901332 → false(무회귀)");
  // ★윤년 2/29 — 세기 코드로 갈리는 경계 보존: 1900(평년)→false / 2000(윤년)→true / 코드 없음→2000(윤년)→true
  ok(isValidBirthDate("000229", "1234567") === false, "000229 + 1…(1900 평년) → false(윤년 판정 보존)");
  ok(isValidBirthDate("000229", "3234567") === true, "000229 + 3…(2000 윤년) → true(윤년 판정 보존)");
  ok(isValidBirthDate("000229", "") === true, "000229 + 세기 코드 없음 → true(2000 윤년 폴백 보존·오탐 방지)");
}

console.log("\n[C] PartyCard 배선 — import·개인일 때만 birthReadback·readback(loan-hangul/role=status)·상호배타");
{
  ok(/formatBirthReadback/.test(partyCard) && /from "@\/lib\/engine\/calc"/.test(partyCard),
     "calc 에서 formatBirthReadback import");
  // 개인일 때만 해석(법인=법인등록번호 칸이라 무관)
  ok(/const birthReadback = party\.type === "개인" \? formatBirthReadback\(party\.corpRegFront, party\.corpRegBack\) : "";/.test(partyCard),
     "개인일 때만 birthReadback = formatBirthReadback(앞/뒤자리)");
  // readback 렌더 = loan-hangul·role=status·aria-live=polite(금액 readback 동형)
  ok(/\{birthReadback && \(/.test(partyCard)
     && /<div className="loan-hangul" role="status" aria-live="polite">\{birthReadback\}<\/div>/.test(partyCard),
     "birthReadback → loan-hangul·role=status·aria-live=polite readback");
  // ★birthInvalid(role=alert) 안내와 상호배타 — readback 은 valid 일 때만 truthy(formatBirthReadback 보장)
  //   + readback 블록이 birthInvalid 블록 '뒤'에 위치(같은 식별번호 field 안)
  const invIdx = partyCard.indexOf("실재하지 않는 생년월일입니다");
  const rbIdx = partyCard.indexOf("{birthReadback && (");
  ok(invIdx > 0 && rbIdx > invIdx, "★readback 블록이 birthInvalid 안내 뒤(같은 field, 상호배타)");
}

console.log("\n[D] 무접촉/무회귀 — 게이트(validate) 차단 로직 보존·빌더 무혼입·새 CSS 0·기존 안내/금액 readback 보존");
{
  // 게이트(validate.ts)는 readback 과 무관 — 기존 isValidBirthDate 차단(생년월일 검증)은 그대로
  ok(!/formatBirthReadback|interpretBirthDate|birthReadback/.test(validate),
     "validate.ts(게이트)는 readback 미사용 — 표시/검증 경계 분리");
  ok(/isValidBirthDate/.test(validate), "validate.ts 의 생년월일 차단(isValidBirthDate)은 보존(무회귀)");
  // 산출물 빌더에 readback 미혼입(빌더는 생년월일 raw 만 표기)
  ok(!/formatBirthReadback|interpretBirthDate|일생/.test(builders),
     "builders.js(산출물)는 readback 미혼입 — 표시/출력 경계 분리");
  // loan-hangul 기존 CSS 재사용 — 새 CSS 0
  ok(/\.loan-hangul\s*\{/.test(globals), "loan-hangul CSS 기존 재사용(새 CSS 0)");
  // 기존 birthInvalid 안내·corpInvalid 안내·대출금액 한글 readback 보존(무회귀)
  ok(/실재하지 않는 생년월일입니다/.test(partyCard) && /유효하지 않은 법인등록번호입니다/.test(partyCard),
     "기존 birthInvalid·corpInvalid 인라인 안내 보존(무회귀)");
  ok(/amountToHangul\(party\.loanAmount\)/.test(partyCard),
     "기존 대출금액 한글 readback(amountToHangul) 보존(무회귀)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
