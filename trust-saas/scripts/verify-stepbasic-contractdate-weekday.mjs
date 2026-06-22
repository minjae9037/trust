/* ============================================================
   회귀 가드 — 계약 체결일자(StepBasic 드롭다운) 한글 요일 readback

   배경: 계약 체결일자(년·월·일 드롭다운)는 5종 서류 전체에 자동 반영되는 핵심 법적 날짜다.
   년·월·일 select 는 daysInMonth 클램프로 실재하지 않는 날짜를 애초에 못 만들지만(월·일 전치
   무관), 평가기준일·이사회 회의일자·협약일(DocStep·JointForm)처럼 **체결일이 주말(토·일)에
   잡히는 것은 신탁 실무에서 점검이 필요한 신호**다. 종전엔 체결일에 요일 확인 수단이 없어
   주말 체결을 입력 지점에서 짚을 수 없었다(자유텍스트 날짜 요일 readback 의 마지막 동선 =
   체결일 드롭다운). 일(日)이 선택됐을 때만 한글 요일을 함께 되읽어 눈으로 교차검증하게 한다.

   핵심 불변식:
     - ★표시 전용 — 빌더·조문·게이트(validate) 무접촉(요일은 산출물에 박히지 않음).
     - 단일 출처 — weekdayKo(calc.ts)·실재 날짜만 "월"~"일"·비실재 ""(StepBasic 은 그 값을 표기).
     - 일(日) "미정"(c.day === "")이면 미표시 — readback 조건이 typeof c.day === "number".
     - loan-hangul 기존 클래스 재사용(새 CSS 0)·기존 체결일 select 배선/검증/요약 무회귀.

   단언:
     (A) weekdayKo 순수 거동 — 독립 검증 앵커 요일·실재 도메인(여타 가드와 중복이나 단일 출처 재확인)
     (B) StepBasic 배선 — weekdayKo import·typeof number 가드·c.year/month/day 표기·loan-hangul role=status
     (C) 무회귀 — 기존 체결일 select(년/월/일·미정)·daysInMonth 클램프·검증/요약 보존
     (D) 무접촉 — 빌더·게이트에 요일 미혼입(표시/출력 경계 분리)·새 CSS 0

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-stepbasic-contractdate-weekday.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { weekdayKo } from "../src/lib/engine/calc.ts";

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

console.log("\n[A] weekdayKo 순수 거동 — 독립 검증 앵커 요일·실재 도메인");
{
  // 독립적으로 잘 알려진 앵커(구현과 무관하게 참) — 단일 출처 재확인
  ok(weekdayKo(1970, 1, 1) === "목", "1970-01-01 → 목(Unix epoch=Thursday)");
  ok(weekdayKo(2026, 6, 20) === "토" && weekdayKo(2026, 6, 21) === "일",
     "2026-06-20 → 토·2026-06-21 → 일(주말 체결 점검 신호)");
  ok(weekdayKo(2026, 6, 22) === "월", "2026-06-22 → 월(평일)");
  // 비실재/범위 밖 → "" (체결일은 클램프로 도달 불가하나 단일 출처 안전망 확인)
  ok(weekdayKo(2025, 2, 30) === "", "2025-02-30(비실재) → ''(무표시)");
  ok(["일","월","화","수","목","금","토"].includes(weekdayKo(2026, 6, 22)),
     "임의 실재 날짜 → 일~토 중 하나");
}

console.log("\n[B] StepBasic 배선 — weekdayKo import·typeof number 가드·표기·loan-hangul role=status");
{
  ok(/import \{[^}]*\bweekdayKo\b[^}]*\} from "@\/lib\/engine\/calc";/.test(stepBasic),
     "calc 에서 weekdayKo import");
  // 일(日) 선택(숫자) 일 때만 — c.day 가 "미정"("")이면 typeof number 가 false 라 미표시
  ok(/const contractWeekday = typeof c\.day === "number" \? weekdayKo\(c\.year, c\.month, c\.day\) : "";/.test(stepBasic),
     "contractWeekday = (일 선택 시) weekdayKo(c.year,c.month,c.day)·미정이면 ''(단일 출처)");
  // 비어 있지 않을 때만 readback 블록 렌더 + 기존 YYYY년 M월 D일 (요일) 표기
  ok(/\{contractWeekday && \(/.test(stepBasic),
     "contractWeekday 가 비어 있지 않을 때만 readback 렌더(주말/평일 모두 요일 표시)");
  ok(/\{c\.year\}년 \{c\.month\}월 \{c\.day\}일 \(\{contractWeekday\}\)/.test(stepBasic),
     "readback 본문 = {c.year}년 {c.month}월 {c.day}일 ({contractWeekday})");
  // loan-hangul·role=status·aria-live=polite (다른 정량 readback 과 동형·새 CSS 0)
  ok(/<div className="loan-hangul" role="status" aria-live="polite">\s*\n\s*\{c\.year\}년/.test(stepBasic),
     "loan-hangul role=status aria-live=polite (표시/접근성 동형)");
}

console.log("\n[C] 무회귀 — 기존 체결일 select·클램프·검증/요약 보존");
{
  ok(/aria-label="년"/.test(stepBasic) && /aria-label="월"/.test(stepBasic) && /aria-label="일"/.test(stepBasic),
     "년·월·일 3 select 접근명 보존");
  ok(/<option value="">미정<\/option>/.test(stepBasic),
     "일(日) '미정' 옵션 보존(일 미정 시 readback 미표시 경로)");
  ok(/const maxDay = daysInMonth\(c\.year, c\.month\);/.test(stepBasic),
     "maxDay = daysInMonth 클램프 보존(실재하지 않는 체결일 차단)");
  ok(/role="group" aria-labelledby="basic-contractDate"/.test(stepBasic),
     "체결일 select 묶음 role=group aria-labelledby 보존");
  ok(/신탁보수/.test(stepBasic) && /요약/.test(stepBasic),
     "신탁보수·요약 등 기존 필드 보존(무회귀)");
}

console.log("\n[D] 무접촉 — 빌더·게이트에 요일 미혼입·새 CSS 0");
{
  ok(/export function weekdayKo\(/.test(calc), "calc.ts 에 weekdayKo export(단일 출처)");
  ok(!/weekdayKo|요일/.test(builders),
     "builders.js(산출물)에 요일 미혼입 — 표시/출력 경계 분리");
  ok(!/weekdayKo|요일/.test(validate),
     "validate.ts(게이트)는 요일과 무관 — 차단/검증 대상 아님(표시 전용)");
  ok(/\.loan-hangul\s*\{/.test(globals), "loan-hangul CSS 기존 재사용(새 CSS 0)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
