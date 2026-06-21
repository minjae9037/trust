/* ============================================================
   회귀 가드 — 계약 체결일 달력 유효성(실재하지 않는 날짜 차단)

   배경(정확성 갭): 계약 체결일 "일(日)" 드롭다운이 월과 무관하게 항상 1~31을
   노출하고, validateDoc 게이트는 연·월·일의 "존재"만 검사해 **2026-02-31·
   2026-04-31 같은 실재하지 않는 날짜로도 담보신탁계약서를 생성**할 수 있었다.
   신탁 서류는 법적 효력 문서 — 존재하지 않는 체결일은 명백한 결함.
   → ① calc.daysInMonth/isRealDate 신설(월별 유효일·윤년 단일 출처)
     ② StepBasic 일 드롭다운을 월별 유효일만 노출 + 연·월 변경 시 말일 보정
     ③ validateDoc 가 누락에 더해 달력 무효 날짜도 차단(import·구버전·AI머지 방어)

   본 가드(조문·엔진·생성 로직 무접촉 — 입력 완결성/유효성만):
     (A) daysInMonth: 대월 31·소월 30·2월 평년 28/윤년 29(4·100·400 규칙)
     (B) isRealDate: 2/31·4/31·2월 29(평년) 거짓 / 말일·윤년 2/29 참 / 범위 밖 거짓
     (C) validateDoc 게이트: 무효 날짜 → ok=false + "실재하지 않는 날짜" 안내(STEP 05)
     (D) 유효 날짜·미정(day="")은 "실재하지 않는 날짜" 오탐 없음(미정은 누락으로 분류)
     (E) StepBasic 클램프 규칙: 1/31 → 2월 전환 시 일을 말일로 보정(드롭다운 무효 생성 0)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-date-validity.mjs
   ============================================================ */
import { blankContractForm } from "../src/lib/engine/model.ts";
import { daysInMonth, isRealDate } from "../src/lib/engine/calc.ts";
import { validateDoc } from "../src/lib/engine/validate.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

// 공통 필수를 모두 채운 양식(체결일만 케이스별로 바꿔 검사). day 기본 1.
function commonFilled() {
  const form = blankContractForm();
  form.trustors[0].name = "주식회사 갑";
  form.priorities[0].name = "을은행";
  form.priorities[0].loanAmount = "5000000000";
  form.properties[0].address = "서울특별시 강남구 테헤란로 1";
  form.docContents.appform.valuationPrice = "10000000000";
  form.docContents.valReport.principalValue = "8000000000";
  return form;
}
const setDate = (form, year, month, day) => {
  form.common.year = year;
  form.common.month = month;
  form.common.day = day;
  return form;
};
// "실재하지 않는 날짜" 안내가 있는지
const hasInvalidDate = (form, docId = "contract") =>
  validateDoc(form, docId).missing.some((m) => m.label.includes("실재하지 않는"));

console.log("\n[A] daysInMonth — 대월/소월/2월(평년·윤년)");
{
  ok(daysInMonth(2026, 1) === 31, "1월 = 31");
  ok(daysInMonth(2026, 3) === 31, "3월 = 31");
  ok(daysInMonth(2026, 12) === 31, "12월 = 31");
  ok(daysInMonth(2026, 4) === 30, "4월 = 30");
  ok(daysInMonth(2026, 6) === 30, "6월 = 30");
  ok(daysInMonth(2026, 9) === 30 && daysInMonth(2026, 11) === 30, "9·11월 = 30");
  ok(daysInMonth(2026, 2) === 28, "2026-02 평년 = 28");
  ok(daysInMonth(2028, 2) === 29, "2028-02 윤년(4의 배수) = 29");
  ok(daysInMonth(2024, 2) === 29, "2024-02 윤년 = 29");
  ok(daysInMonth(2000, 2) === 29, "2000-02 윤년(400의 배수) = 29");
  ok(daysInMonth(2100, 2) === 28, "2100-02 평년(100의 배수·400 아님) = 28");
}

console.log("\n[B] isRealDate — 실재 여부");
{
  ok(isRealDate(2026, 2, 31) === false, "2026-02-31 = false");
  ok(isRealDate(2026, 4, 31) === false, "2026-04-31 = false");
  ok(isRealDate(2026, 2, 29) === false, "2026-02-29(평년) = false");
  ok(isRealDate(2028, 2, 29) === true, "2028-02-29(윤년) = true");
  ok(isRealDate(2026, 2, 28) === true, "2026-02-28 = true");
  ok(isRealDate(2026, 1, 31) === true, "2026-01-31 = true");
  ok(isRealDate(2026, 4, 30) === true, "2026-04-30 = true");
  ok(isRealDate(2026, 1, 0) === false, "일 0 = false");
  ok(isRealDate(2026, 13, 1) === false, "월 13 = false");
  ok(isRealDate(2026, 2, "") === false, "미정(day='') = false(숫자 아님)");
}

console.log("\n[C] validateDoc 게이트 — 실재하지 않는 날짜는 생성 차단");
{
  const bad = setDate(commonFilled(), 2026, 2, 31);
  const r = validateDoc(bad, "contract");
  ok(r.ok === false, "2026-02-31 → ok=false(생성 차단)");
  const dm = r.missing.find((m) => m.label.includes("실재하지 않는"));
  ok(!!dm, "안내에 '실재하지 않는 날짜' 항목 존재");
  ok(dm && dm.stepIdx === 5, "점프 타깃 = STEP 05(계약 체결일)");
  ok(hasInvalidDate(setDate(commonFilled(), 2026, 4, 31)), "2026-04-31 도 차단");
  ok(hasInvalidDate(setDate(commonFilled(), 2026, 2, 29)), "2026-02-29(평년) 도 차단");
}

console.log("\n[D] 유효 날짜·미정은 '실재하지 않는 날짜' 오탐 없음");
{
  const good = setDate(commonFilled(), 2026, 2, 28);
  ok(validateDoc(good, "contract").ok === true, "2026-02-28(전 입력 충족) → ok=true");
  ok(!hasInvalidDate(good), "유효 날짜에 무효 안내 없음");
  ok(!hasInvalidDate(setDate(commonFilled(), 2028, 2, 29)), "2028-02-29(윤년) 무효 안내 없음");

  // 미정(day="")은 '누락'으로 분류돼야지 '실재하지 않는 날짜' 오탐이면 안 된다.
  const undecided = setDate(commonFilled(), 2026, 5, "");
  const um = validateDoc(undecided, "contract").missing;
  ok(um.some((m) => m.label.includes("계약 체결일 (연·월·일)")), "미정 → '연·월·일' 누락으로 분류");
  ok(!um.some((m) => m.label.includes("실재하지 않는")), "미정에 '실재하지 않는' 오탐 없음");
}

console.log("\n[E] StepBasic 클램프 규칙 — 드롭다운으로는 무효 날짜를 만들 수 없다");
{
  // StepBasic.setMonth/setYear 와 동일 규칙 재현: 현재 일이 새 달에 없으면 말일로 보정.
  const clampDay = (day, y, mo) =>
    typeof day === "number" && day > daysInMonth(y, mo) ? daysInMonth(y, mo) : day;
  ok(clampDay(31, 2026, 2) === 28, "1/31 → 2월 전환 시 일=28 보정");
  ok(clampDay(31, 2028, 2) === 29, "1/31 → 2028-02 전환 시 일=29 보정");
  ok(clampDay(31, 2026, 4) === 30, "1/31 → 4월 전환 시 일=30 보정");
  ok(clampDay(15, 2026, 2) === 15, "15일은 2월에도 유효 → 보정 없음");
  ok(clampDay("", 2026, 2) === "", "미정은 보정 대상 아님");
  // 보정 후 날짜는 반드시 실재한다(무효 생성 0 불변식).
  let allReal = true;
  for (let mo = 1; mo <= 12; mo++) {
    for (const y of [2024, 2026, 2028, 2100]) {
      const d = clampDay(31, y, mo);
      if (!isRealDate(y, mo, d)) allReal = false;
    }
  }
  ok(allReal, "모든 연·월에서 31일 입력을 보정하면 항상 실재 날짜");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
