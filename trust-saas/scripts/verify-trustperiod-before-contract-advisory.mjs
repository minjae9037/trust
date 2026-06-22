/* ============================================================
   회귀 가드 — 신탁기간 시작일 < 계약 체결일(선후 역전) 입력 지점 교차검증 advisory

   배경: 담보신탁계약서 본문 제3조(verbatim)는 신탁기간을 "[시작일]부터 [종료일]까지"로
   정의하고, 계약 체결일자(common.year/month/day)는 STEP 05(StepBasic) 같은 화면 위쪽에서
   따로 입력된다. 신탁은 통상 계약 체결일 당일 또는 그 이후 효력이 개시되므로 신탁기간
   시작일이 체결일보다 앞서면(선후 역전) 두 날짜 중 하나가 오입력일 가능성이 높다. 그러나
   두 값이 같은 단계의 서로 다른 입력칸이라 그 역전이 조용히 성립할 수 있었다
   (formatPeriodReadback 의 "종료일<시작일" 역전 점검은 신탁기간 한 칸 안의 두 날짜만
   비교 → 체결일과의 교차는 사각). StepLoanCalc 한도합계 vs 평가가격 등 단계/필드 교차
   산술 정합 advisory 와 동형의 "막지 않는 되짚음" — 순수 날짜 비교(두 사용자 입력)일 뿐
   차단·조문·산출물 무관.

   핵심 불변식:
     - ★표시 전용 — 게이트(validate)·빌더(builders.js)·조문 무접촉(차단 아님).
       periodStartsBeforeContract 는 기존 입력(common 체결일 + interpretPeriod 시작일)의
       파생 표시일 뿐 어느 산출물·게이트에도 영향을 주지 않는다. 새 상태/모델/엔진 무접촉.
     - 조건 = c.day 가 number(체결일 일(日) 확정) && interpretPeriod 가 날짜 범위꼴 인식
       && start.real(시작일 실재) && Date.UTC(시작일) < Date.UTC(체결일). 일 미정·조건부
       기간("…변제시까지")·비실재 시작일이면 미표출(나그·오탐 방지).
     - UTC 자정 기준 비교(TZ·자정 시각 성분 무영향) — interpretPeriod 의 days 산정과 동형.
     - role=status·aria-live=polite(동적 출현 SR 고지) + 선두 ⚠ 글리프 aria-hidden
       (장식 글리프 접근명 오염 0 — 기존 컨벤션).
     - 기존 클래스(field-hint) 재사용 + 인라인 style 만 — 새 CSS 0.
     - 색 = var(--c-brown) 토큰(차단 적색 var(--c-danger) 아님 — 검토 신호·기존 advisory 동형).
     - 근거 = "신탁은 체결일 당일/이후 개시"라는 통상 실무의 산술 정합(추정 조문 아님).

   단언:
     (A) StepBasic 배선 — 조건·문구·role=status·aria-hidden 글리프·field-hint·brown
     (B) 단일 출처 — interpretPeriod import + Date.UTC 선후 비교(체결일 common.year/month/day)
     (C) 무회귀 — 신탁기간 readback·체결일 요일 readback·신탁보수 인라인·요약 보존
     (D) 무접촉 — validate/builders 에 advisory 문구 미혼입·새 CSS 0·차단 적색 미사용

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-trustperiod-before-contract-advisory.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const __dir = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(join(__dir, "..", ...p), "utf8");
const basic = read("src", "components", "trust", "steps", "StepBasic.tsx");
const calc = read("src", "lib", "engine", "calc.ts");
const validate = read("src", "lib", "engine", "validate.ts");
const builders = read("src", "lib", "engine", "docx", "builders.js");
const globals = read("src", "app", "globals.css");

console.log("\n[A] StepBasic 배선 — 조건·문구·role=status·aria-hidden 글리프·field-hint·brown");
{
  ok(/const periodStartsBeforeContract =/.test(basic), "periodStartsBeforeContract 파생 상수 선언");
  ok(/typeof c\.day === "number" &&/.test(basic), "조건 1 = c.day 가 number(체결일 일(日) 확정 시에만)");
  ok(/!!period &&/.test(basic), "조건 2 = interpretPeriod 결과 존재(날짜 범위꼴 인식 — 조건부 기간 미표출)");
  ok(/period\.start\.real &&/.test(basic), "조건 3 = period.start.real(시작일 실재 — 비실재 미표출)");
  ok(/Date\.UTC\(period\.start\.year, period\.start\.month - 1, period\.start\.day\) <\s*Date\.UTC\(c\.year, c\.month - 1, c\.day\)/.test(basic),
     "조건 4 = Date.UTC(시작일) < Date.UTC(체결일)(선후 역전일 때만·UTC 자정 기준)");
  // advisory 본문 — 시작일이 체결일보다 앞선다는 사실 되짚음 + 확인 권유(차단 아님)
  ok(/신탁기간 시작일\(.*\)이 계약 체결일\(.*\)보다 앞섭니다/.test(basic),
     "advisory 본문 = 신탁기간 시작일이 체결일보다 앞선 사실 되짚음(두 날짜 동시 표기)");
  ok(/통상 신탁기간은 체결일 당일 또는 그 이후에 시작합니다\. 확인하세요\./.test(basic),
     "막지 않고(차단 아님) 통상 실무를 안내하며 확인을 권유(사용자 선택 보존)");
  // 동적 출현 SR 고지 + 선두 ⚠ aria-hidden (advisory 블록 구간)
  const adv = basic.slice(basic.indexOf("{periodStartsBeforeContract && ("));
  ok(/role="status" aria-live="polite"/.test(adv.slice(0, 600))
     && /<span aria-hidden="true">⚠ <\/span>/.test(adv.slice(0, 600)),
     "role=status·aria-live=polite + 선두 ⚠ 글리프 aria-hidden(접근명 오염 0)");
  ok(/\{periodStartsBeforeContract && \(\s*<div className="field-hint" role="status" aria-live="polite"/.test(basic),
     "field-hint 기존 클래스 재사용(새 클래스 0)");
  ok(adv.slice(0, 600).includes("var(--c-brown)"),
     "advisory 색 = var(--c-brown) 토큰(차단 적색 아님·기존 advisory 와 동형)");
  ok(!adv.slice(0, 600).includes("var(--c-danger)"),
     "advisory 는 차단 적색(var(--c-danger)) 미사용 — 검토 신호일 뿐 차단 아님");
}

console.log("\n[B] 단일 출처 — interpretPeriod import + Date.UTC 선후 비교(체결일 common.year/month/day)");
{
  ok(/import \{[^}]*\binterpretPeriod\b[^}]*\} from "@\/lib\/engine\/calc"/.test(basic),
     "calc 에서 interpretPeriod import(신탁기간 해석 단일 출처 재사용·추정 파싱 아님)");
  ok(/const period = interpretPeriod\(c\.trustPeriod\);/.test(basic),
     "period = interpretPeriod(c.trustPeriod)(formatPeriodReadback 와 동일 단일 출처)");
  // calc 의 interpretPeriod 가 start.real 을 제공함을 확인(가드가 의존하는 계약)
  ok(/export function interpretPeriod\(/.test(calc)
     && /start: \{ year: number; month: number; day: number; real: boolean; weekday: string \}/.test(calc),
     "interpretPeriod 가 start{year,month,day,real,...} 반환(가드 의존 계약 보존)");
}

console.log("\n[C] 무회귀 — 신탁기간 readback·체결일 요일 readback·신탁보수 인라인·요약 보존");
{
  ok(/const periodReadback = formatPeriodReadback\(c\.trustPeriod\);/.test(basic),
     "신탁기간 날짜 범위 readback(formatPeriodReadback) 보존");
  ok(/const contractWeekday = typeof c\.day === "number" \? weekdayKo\(/.test(basic),
     "체결일 요일 readback(contractWeekday) 보존");
  ok(/유효하지 않은 신탁보수입니다/.test(basic),
     "신탁보수 무효 인라인 오류(게이트 패리티) 보존");
  ok(/<strong>요약<\/strong> 우선수익한도금액/.test(basic),
     "요약 footnote 보존");
}

console.log("\n[D] 무접촉 — validate/builders 에 advisory 문구 미혼입·새 CSS 0·차단 적색 미사용");
{
  ok(!/보다 앞섭니다 — 통상 신탁기간은 체결일|체결일 당일 또는 그 이후에 시작합니다/.test(validate),
     "validate.ts(게이트)에 advisory 문구 미혼입 — 차단/검증 대상 아님(표시 전용)");
  ok(!/보다 앞섭니다 — 통상 신탁기간은 체결일|체결일 당일 또는 그 이후에 시작합니다/.test(builders),
     "builders.js(산출물)에 advisory 문구 미혼입 — 조문·표 미변경(표시 전용)");
  ok(!/trustperiod-before-contract|period-before-contract|startsBeforeContract/.test(globals),
     "globals.css 에 advisory 전용 새 클래스 0(field-hint 재사용)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
