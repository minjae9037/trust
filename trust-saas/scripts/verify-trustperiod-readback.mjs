/* ============================================================
   회귀 가드 — 신탁기간(날짜 범위) 확인용 readback

   배경: 담보신탁계약서 본문 제3조(verbatim 정본)는 신탁기간을 "…[년][월][일]부터
   [년][월][일]까지 로 한다"는 **날짜 범위**로 정의하고, 그 입력값(common.trustPeriod)은
   계약서·신청서 표에 raw 그대로 박힌다. 자유 텍스트라 종료일 역전·주말 시작/종료·월·일
   전치(둘 다 실재라 안 걸림)·비실재 날짜(2026-02-30)를 입력 지점에서 짚을 수단이 없었다.
   금액 한글·면적 평환산·사건 날짜 요일 readback 과 같은 표시 전용·비차단 확인 계열의
   날짜 범위 확장(formatPeriodReadback 단일 출처).

   핵심 불변식:
     - ★표시 전용 — 빌더·조문·게이트(validate) 무접촉(기간 해석은 산출물에 박히지 않음).
     - interpretPeriod 는 **명확한 날짜 범위꼴**(숫자 그룹 6개·첫·넷째 4자리 연도)만 해석,
       조건부 기간 텍스트("…변제시까지")처럼 한글이 섞이면 null(무간섭 = 추정 형식 강제 금지).
     - 단일 출처 — start/end 의 real·weekday 는 isRealDate/weekdayKo(기존 함수) 재사용.
     - 기간은 총 일수(UTC 기준 정확값)만 — 년·개월 분해는 월경계 모호성으로 배제(오산 0).
     - loan-hangul 기존 클래스 재사용(새 CSS 0)·선두 장식 글리프 미사용(접근명 오염 0).

   단언:
     (A) interpretPeriod 인식 — 날짜 범위꼴만 해석·3그룹/조건부/free-form/빈 값 null
     (B) interpretPeriod 값 — start/end real·weekday·bothReal·endAfterStart·총 일수(정확)
     (C) formatPeriodReadback 문구 — 정상·역전·동일·비실재·조건부("")
     (D) StepBasic 배선 — import·periodReadback const·hint·readback 조건부 렌더
     (E) 무접촉/무회귀 — 빌더·게이트·생년월일 readback 무혼입·새 CSS 0·interpretDate 무회귀

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-trustperiod-readback.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { interpretPeriod, formatPeriodReadback, interpretDate, weekdayKo } from "../src/lib/engine/calc.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const __dir = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(join(__dir, "..", ...p), "utf8");
const stepBasic = read("src", "components", "trust", "steps", "StepBasic.tsx");
const calc = read("src", "lib", "engine", "calc.ts");
const validate = read("src", "lib", "engine", "validate.ts");
const builders = read("src", "lib", "engine", "docx", "builders.js");
const globals = read("src", "app", "globals.css");
const model = read("src", "lib", "engine", "model.ts");

console.log("\n[A] interpretPeriod 인식 — 날짜 범위꼴만 해석·3그룹/조건부/free-form 무간섭");
{
  ok(interpretPeriod("2026년 6월 20일부터 2028년 6월 19일까지") !== null,
     "한글 날짜 범위(부터/까지) → 해석");
  ok(interpretPeriod("2026.6.20 ~ 2028.6.19") !== null,
     "구분자/연결어 변형(. ~) → 해석");
  ok(interpretPeriod("2026-06-20 부터 2028-06-19 까지") !== null,
     "ISO 하이픈 + 부터/까지 → 해석");
  // ★조건부 기간 텍스트(한글 섞임) = 무간섭
  ok(interpretPeriod("담보신탁 등기일로부터 우선수익자 채권 변제시까지") === null,
     "조건부 기간 텍스트(한글 섞임) → null(무간섭)");
  ok(interpretPeriod(model.match(/trustPeriod:\s*"([^"]*)"/)?.[1] ?? "x") === null,
     "model.ts 기본 trustPeriod(조건부) → null(기본값 오탐 0)");
  // 숫자 그룹 수 경계
  ok(interpretPeriod("2026-06-20") === null, "단일 날짜(3그룹) → null(범위 아님)");
  ok(interpretPeriod("2026년 6월 20일부터 2년") === null, "날짜+기간숫자(4그룹) → null");
  ok(interpretPeriod("2026 6 20 28 6 19") === null, "넷째 그룹 2자리(연도 아님) → null");
  // free-form / 빈 값
  ok(interpretPeriod("해당 없음") === null && interpretPeriod("") === null && interpretPeriod(null) === null,
     "free-form·빈 값·null → null(무간섭)");
}

console.log("\n[B] interpretPeriod 값 — real·weekday·bothReal·endAfterStart·총 일수(정확)");
{
  const p = interpretPeriod("2026년 6월 20일부터 2028년 6월 19일까지");
  ok(p && p.start.year === 2026 && p.start.month === 6 && p.start.day === 20,
     "start = 2026-06-20 파싱");
  ok(p && p.end.year === 2028 && p.end.month === 6 && p.end.day === 19,
     "end = 2028-06-19 파싱");
  // 요일은 weekdayKo 단일 출처
  ok(p && p.start.weekday === weekdayKo(2026, 6, 20) && p.start.weekday === "토",
     "start.weekday = weekdayKo(2026,6,20) = '토'(주말 신호)");
  ok(p && p.end.weekday === weekdayKo(2028, 6, 19) && p.end.weekday === "월",
     "end.weekday = weekdayKo(2028,6,19) = '월'");
  ok(p && p.bothReal === true && p.endAfterStart === true, "bothReal·endAfterStart true");
  // 총 일수 = (2028-06-19) - (2026-06-20) = 730일(2028 윤년 2/29 포함 독립 검증)
  ok(p && p.days === 730, "총 일수 730일(UTC 기준 정확값·2028 윤일 포함)");
  // 단순 1일
  const one = interpretPeriod("2026년 6월 20일부터 2026년 6월 21일까지");
  ok(one && one.days === 1, "2026-06-20 → 06-21 = 총 1일");
  // 역전 — 종료가 시작보다 빠름
  const rev = interpretPeriod("2028년 6월 19일부터 2026년 6월 20일까지");
  ok(rev && rev.bothReal === true && rev.endAfterStart === false && rev.days === null,
     "역전 범위 → endAfterStart false·days null");
  // 동일 — 0길이
  const same = interpretPeriod("2026년 6월 20일부터 2026년 6월 20일까지");
  ok(same && same.endAfterStart === false && same.days === null,
     "동일 날짜 → endAfterStart false(0길이)·days null");
  // 비실재 시작일
  const bad = interpretPeriod("2026년 2월 30일부터 2028년 6월 19일까지");
  ok(bad && bad.start.real === false && bad.start.weekday === "" && bad.bothReal === false && bad.days === null,
     "비실재 시작일(2026-02-30) → real false·weekday ''·bothReal false·days null");
}

console.log("\n[C] formatPeriodReadback 문구 — 정상·역전·동일·비실재·조건부('')");
{
  const fwd = formatPeriodReadback("2026년 6월 20일부터 2028년 6월 19일까지");
  ok(fwd === "2026년 6월 20일 (토) → 2028년 6월 19일 (월) · 총 730일",
     "정상 범위 → 요일+총 일수 문구");
  const rev = formatPeriodReadback("2028년 6월 19일부터 2026년 6월 20일까지");
  ok(/종료일이 시작일보다 빠르거나 같습니다/.test(rev) && !/총 /.test(rev),
     "역전 → 점검 안내·총 일수 미표기");
  const same = formatPeriodReadback("2026년 6월 20일부터 2026년 6월 20일까지");
  ok(/종료일이 시작일보다 빠르거나 같습니다/.test(same),
     "동일(0길이) → 점검 안내");
  const bad = formatPeriodReadback("2026년 2월 30일부터 2028년 6월 19일까지");
  ok(/실재하지 않는 날짜/.test(bad) && !/총 /.test(bad),
     "비실재 → '실재하지 않는 날짜' 표기·총 일수 미표기");
  ok(formatPeriodReadback("담보신탁 등기일로부터 우선수익자 채권 변제시까지") === "" &&
     formatPeriodReadback("") === "",
     "조건부 기간·빈 값 → ''(미표시 = 무간섭)");
  // ★장식 이모지 글리프(⚠✓●…) 미사용 — 접근명/낭독 오염 0(→ 는 ASCII U+2192 화살표=텍스트)
  ok(!/[⚠✓●📄🖨🔍💾⏳]/u.test(fwd) && !/[⚠✓●📄🖨🔍💾⏳]/u.test(rev),
     "readback 문구에 장식 이모지 글리프 미혼입");
}

console.log("\n[D] StepBasic 배선 — import·periodReadback const·hint·readback 조건부 렌더");
{
  ok(/import \{[^}]*formatPeriodReadback[^}]*\} from "@\/lib\/engine\/calc";/.test(stepBasic),
     "calc 에서 formatPeriodReadback import");
  ok(/const periodReadback = formatPeriodReadback\(c\.trustPeriod\);/.test(stepBasic),
     "periodReadback = formatPeriodReadback(c.trustPeriod) 파생(단일 호출)");
  ok(/날짜 범위\(예: 2026년 6월 20일부터 2028년 6월 19일까지\)/.test(stepBasic),
     "신탁기간 필드 hint(날짜 범위 예시) 추가");
  ok(/\{periodReadback && \(/.test(stepBasic) &&
     /<div className="loan-hangul" role="status" aria-live="polite">\{periodReadback\}<\/div>/.test(stepBasic),
     "periodReadback 있을 때만 loan-hangul role=status 로 렌더");
}

console.log("\n[E] 무접촉/무회귀 — 빌더·게이트·생년월일 무혼입·새 CSS 0·interpretDate 무회귀");
{
  ok(/export function interpretPeriod\(/.test(calc) && /export function formatPeriodReadback\(/.test(calc),
     "calc.ts 에 interpretPeriod·formatPeriodReadback export");
  // 단일 출처 — interpretPeriod 가 isRealDate/weekdayKo 재사용
  ok(/real: isRealDate\(year, month, day\), weekday: weekdayKo\(year, month, day\)/.test(calc),
     "start/end real·weekday = isRealDate/weekdayKo 단일 출처");
  // 산출물 빌더에 기간 해석 미혼입(표시 전용)
  ok(!/interpretPeriod|formatPeriodReadback/.test(builders),
     "builders.js(산출물)에 기간 해석 미혼입 — 표시/출력 경계 분리");
  // 게이트(validate)는 기간 해석과 무관(비차단)
  ok(!/interpretPeriod|formatPeriodReadback/.test(validate),
     "validate.ts(게이트)는 기간 해석과 무관 — 차단/검증 대상 아님(표시 전용)");
  // interpretDate(기존 단일 날짜 해석) 무회귀
  ok(interpretDate("2000.01.01")?.weekday === "토" && interpretDate("해당 없음") === null,
     "interpretDate 무회귀(단일 날짜 해석·free-form null 보존)");
  // loan-hangul 기존 CSS 재사용 — 새 CSS 0
  ok(/\.loan-hangul\s*\{/.test(globals), "loan-hangul CSS 기존 재사용(새 CSS 0)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
