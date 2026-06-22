/* ============================================================
   회귀 가드 — 사건(event) 날짜 readback 한글 요일 교차검증

   배경: 평가기준일·이사회 회의일자(DocStep 자유 텍스트 날짜)·협약일(JointForm)은 산출물에
   그대로 박히는 사건 날짜다. 종전 readback 은 "YYYY년 M월 D일"만 에코해, 월·일 전치(03-07↔
   07-03)는 둘 다 실재해 isRealDate 로 안 걸리고 요일도 알 수 없었다. 신탁 실무에서 평가기준일·
   회의일자·협약 체결일이 주말(토·일)에 잡히면 점검이 필요한 신호이므로, 한글 요일을 함께 되읽어
   입력 지점에서 타당성을 눈으로 교차검증하게 한다(금액 한글·면적 평환산·지분율 25%·생년월일
   readback 과 같은 표시 전용·비차단 확인 계열의 날짜 요일 확장).

   핵심 불변식:
     - ★표시 전용 — 빌더·조문·게이트(validate) 무접촉(요일은 산출물에 박히지 않음).
     - weekdayKo 는 실재 날짜만 요일("월"~"일") 반환·비실재/범위 밖이면 ""(무표시).
     - 단일 출처 — interpretDate.weekday = weekdayKo(동일 함수)·DocStep·JointForm 이 그 값을 표기.
     - 생년월일 readback 은 요일이 무의미하므로 대상 아님(formatBirthReadback 무접촉).
     - loan-hangul 기존 클래스 재사용(새 CSS 0).

   단언:
     (A) weekdayKo 순수 거동 — 독립 검증된 앵커 날짜 요일·비실재/범위 밖 ""
     (B) interpretDate.weekday — 실재 시 요일·비실재 시 ""·free-form null·기존 필드 보존
     (C) DocStep 배선 — 실재 날짜 readback 에 weekday 조건부 표기
     (D) JointForm 배선 — weekdayKo import·협약일 실재 readback 에 weekday 조건부 표기
     (E) 무접촉/무회귀 — 빌더·게이트·생년월일 readback 무혼입·새 CSS 0·기존 날짜 에코 보존

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-date-readback-weekday.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { weekdayKo, interpretDate } from "../src/lib/engine/calc.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const __dir = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(join(__dir, "..", ...p), "utf8");
const docStep = read("src", "components", "trust", "steps", "DocStep.tsx");
const jointForm = read("src", "components", "trust", "JointForm.tsx");
const calc = read("src", "lib", "engine", "calc.ts");
const validate = read("src", "lib", "engine", "validate.ts");
const builders = read("src", "lib", "engine", "docx", "builders.js");
const globals = read("src", "app", "globals.css");

console.log("\n[A] weekdayKo 순수 거동 — 독립 검증된 앵커 날짜 요일·비실재/범위 밖 ''");
{
  // 독립적으로 잘 알려진 앵커(구현과 무관하게 참)
  ok(weekdayKo(1970, 1, 1) === "목", "1970-01-01 → 목(Unix epoch=Thursday)");
  ok(weekdayKo(2000, 1, 1) === "토", "2000-01-01 → 토(Y2K=Saturday)");
  ok(weekdayKo(2024, 1, 1) === "월", "2024-01-01 → 월(Monday)");
  ok(weekdayKo(2024, 2, 29) === "목", "2024-02-29(윤일) → 목(Thursday)");
  ok(weekdayKo(2025, 12, 25) === "목", "2025-12-25 → 목(Thursday)");
  // ★월·일 전치는 둘 다 실재하나 요일이 갈려 교차검증 가치가 생긴다
  ok(weekdayKo(2026, 3, 7) !== "" && weekdayKo(2026, 7, 3) !== ""
     && weekdayKo(2026, 3, 7) !== weekdayKo(2026, 7, 3),
     "2026-03-07 ↔ 2026-07-03(월·일 전치) → 요일 상이(전치 확인 가치)");
  // 비실재/범위 밖 → ""(무표시)
  ok(weekdayKo(2025, 2, 30) === "", "2025-02-30(비실재) → ''(무표시)");
  ok(weekdayKo(2026, 13, 1) === "" && weekdayKo(2026, 4, 31) === "",
     "범위 밖 월(13)·실재하지 않는 일(4/31) → ''");
  // 요일 값 도메인 — 항상 "일~토" 중 하나 또는 ""
  ok(["일","월","화","수","목","금","토"].includes(weekdayKo(2026, 6, 22)),
     "임의 실재 날짜 → 일~토 중 하나");
}

console.log("\n[B] interpretDate.weekday — 실재 시 요일·비실재 시 ''·free-form null·기존 필드 보존");
{
  const d = interpretDate("2000.01.01");
  ok(d && d.year === 2000 && d.month === 1 && d.day === 1 && d.real === true,
     "interpretDate('2000.01.01') → year/month/day/real 보존(무회귀)");
  ok(d && d.weekday === "토", "interpretDate('2000.01.01').weekday === '토'(단일 출처=weekdayKo)");
  ok(interpretDate("2000년 1월 1일")?.weekday === "토",
     "interpretDate('2000년 1월 1일') 도 동일 요일(구분자 무관)");
  const bad = interpretDate("2025-02-30");
  ok(bad && bad.real === false && bad.weekday === "",
     "interpretDate('2025-02-30')(비실재) → real false·weekday ''");
  ok(interpretDate("해당 없음") === null && interpretDate("") === null,
     "free-form·빈 값 → null(무간섭 — 형식 강제 금지)");
}

console.log("\n[C] DocStep 배선 — 실재 날짜 readback 에 weekday 조건부 표기");
{
  // 실재 날짜 readback 블록에 weekday 조건부 표기가 붙음
  ok(/\{dateInfo\.year\}년 \{dateInfo\.month\}월 \{dateInfo\.day\}일\{dateInfo\.weekday && ` \(\$\{dateInfo\.weekday\}\)`\}/.test(docStep),
     "실재 날짜 readback 에 {dateInfo.weekday && ` (…)`} 조건부 표기");
  // 비실재 주의는 그대로(무회귀)
  ok(/달력에 없는 날짜일 수 있습니다/.test(docStep),
     "비실재 주의 문구 보존(무회귀)");
  // interpretDate 사용 보존
  ok(/const dateInfo = f\.date \? interpretDate\(val as string\) : null;/.test(docStep),
     "interpretDate 배선 보존(무회귀)");
}

console.log("\n[D] JointForm 배선 — weekdayKo import·협약일 실재 readback 에 weekday 조건부 표기");
{
  ok(/import \{[^}]*weekdayKo[^}]*\} from "@\/lib\/engine\/calc";/.test(jointForm),
     "calc 에서 weekdayKo import");
  // 협약일 실재 readback 에 요일 조건부 표기(Number(agY/agM/agD) 인자)
  ok(/weekdayKo\(Number\(agY\), Number\(agM\), Number\(agD\)\)/.test(jointForm),
     "협약일 readback 이 weekdayKo(Number(agY),Number(agM),Number(agD)) 사용");
  ok(/agreementDateReal &&/.test(jointForm) && /\{Number\(agY\)\}년 \{Number\(agM\)\}월 \{Number\(agD\)\}일/.test(jointForm),
     "실재 협약일(agreementDateReal)일 때만 표기·기존 YYYY년 M월 D일 보존(무회귀)");
}

console.log("\n[E] 무접촉/무회귀 — 빌더·게이트·생년월일 readback 무혼입·새 CSS 0·기존 날짜 에코 보존");
{
  // weekdayKo 정의 + 단일 출처(interpretDate 가 weekdayKo 호출)
  ok(/export function weekdayKo\(/.test(calc), "calc.ts 에 weekdayKo export");
  ok(/weekday: weekdayKo\(year, month, day\)/.test(calc),
     "interpretDate 가 weekday: weekdayKo(…) 로 단일 출처 사용");
  // 산출물 빌더에 요일 미혼입(요일은 산출물에 박히지 않음 = 표시 전용)
  ok(!/weekdayKo|요일/.test(builders),
     "builders.js(산출물)에 요일 미혼입 — 표시/출력 경계 분리");
  // 게이트(validate.ts)는 요일과 무관(비차단)
  ok(!/weekdayKo|요일/.test(validate),
     "validate.ts(게이트)는 요일과 무관 — 차단/검증 대상 아님(표시 전용)");
  // 생년월일 readback(formatBirthReadback)은 요일 대상 아님 — 그 함수 본문에 요일 미혼입
  const birthIdx = calc.indexOf("export function formatBirthReadback");
  const birthSeg = birthIdx >= 0 ? calc.slice(birthIdx, birthIdx + 600) : "";
  ok(birthIdx >= 0 && !/weekdayKo|요일/.test(birthSeg),
     "생년월일 readback(formatBirthReadback)은 요일 미적용(요일 무의미)");
  // loan-hangul 기존 CSS 재사용 — 새 CSS 0
  ok(/\.loan-hangul\s*\{/.test(globals), "loan-hangul CSS 기존 재사용(새 CSS 0)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
