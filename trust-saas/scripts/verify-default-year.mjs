/* ============================================================
   회귀 가드 — 신규 계약/협약 기본 연도 = 시스템 현재 연도 (백데이팅 방지)

   배경(정확성·법적 효력 문서): 신탁 서류는 법적 효력 문서라 날짜 정확성이 최우선이다.
   그런데 폼 기본값의 연도가 하드코딩돼 있어, 해가 바뀌면 신규 작성 서류가 입력 즉시
   "과거 연도로 백데이팅"되는 정확성 결함이 있었다.
     - blankJointForm 의 협약 연도가 "2025" 로 하드코딩 → 2026 기준 신규 협약서가 곧장
       작년(2025) 날짜로 만들어졌다(사용자가 알아채고 고치지 않으면 백데이팅된 협약서).
     - blankContractForm 의 계약 체결일 연도가 2026 으로 하드코딩 → 2027 이 되면 동일 결함.
     - StepBasic 연도 드롭다운이 2020~2030 으로 하드코딩 → 2031+ 면 현재/기본 연도가
       옵션 목록에서 빠져 select value 가 옵션과 불일치(빈 선택)된다.

   본 가드의 정적/거동 단언(조문·엔진·산출물·게이트 판정 무접촉 — 기본값/표시 범위만):
     [A] blankContractForm 계약 체결일 연도 = 시스템 현재 연도(number)
     [B] blankJointForm 협약 연도 = 시스템 현재 연도(string) — 과거 "2025" 하드코딩 아님
     [C] 기본 날짜가 백데이팅 아님(연도 < 현재 연도 아님) + 기본 체결일이 실재하는 날짜
     [D] StepBasic 연도 범위가 현재 연도 기준 동적(하드코딩 2020/2030 리터럴 범위 제거)·
         현재 연도 -6~+4 창·저장 연도(c.year) 항상 선택 가능하도록 합집합(min/max)
     [E] 무회귀: 2026 기준에서 종전 범위(2020~2030)와 동일 산출(창 폭·경계 보존)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-default-year.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { blankContractForm, blankJointForm } from "../src/lib/engine/model.ts";
import { isRealDate } from "../src/lib/engine/calc.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const NOW_YEAR = new Date().getFullYear();
const __dir = dirname(fileURLToPath(import.meta.url));
const stepBasicSrc = readFileSync(join(__dir, "../src/components/trust/steps/StepBasic.tsx"), "utf8");
const modelSrc = readFileSync(join(__dir, "../src/lib/engine/model.ts"), "utf8");

console.log("\n[A] blankContractForm 계약 체결일 연도 = 현재 연도(number)");
{
  const cf = blankContractForm();
  ok(typeof cf.common.year === "number", "common.year 는 number");
  ok(cf.common.year === NOW_YEAR, `common.year === 현재 연도(${NOW_YEAR})`);
  ok(/year:\s*new Date\(\)\.getFullYear\(\)/.test(modelSrc),
    "model.ts: common.year = new Date().getFullYear() (하드코딩 연도 리터럴 아님)");
}

console.log("\n[B] blankJointForm 협약 연도 = 현재 연도(string) — '2025' 하드코딩 아님");
{
  const jf = blankJointForm();
  ok(typeof jf.project.agreementYear === "string", "project.agreementYear 는 string");
  ok(jf.project.agreementYear === String(NOW_YEAR), `agreementYear === '${NOW_YEAR}'`);
  ok(jf.project.agreementYear !== "2025", "agreementYear 가 과거 하드코딩 '2025' 아님(백데이팅 제거)");
  ok(/agreementYear:\s*String\(new Date\(\)\.getFullYear\(\)\)/.test(modelSrc),
    "model.ts: agreementYear = String(new Date().getFullYear())");
}

console.log("\n[C] 기본 날짜가 백데이팅 아님 + 실재하는 날짜");
{
  const cf = blankContractForm();
  const jf = blankJointForm();
  ok(cf.common.year >= NOW_YEAR, "계약 기본 연도 < 현재 연도 아님(과거 백데이팅 0)");
  ok(Number(jf.project.agreementYear) >= NOW_YEAR, "협약 기본 연도 < 현재 연도 아님(과거 백데이팅 0)");
  // 기본 month/day(3/1)는 어느 연도에서나 실재하는 날짜여야 게이트 날짜 검사를 통과한다(무회귀).
  ok(isRealDate(cf.common.year, cf.common.month, cf.common.day),
    `기본 체결일(${cf.common.year}-${cf.common.month}-${cf.common.day})이 실재하는 날짜`);
}

console.log("\n[D] StepBasic 연도 드롭다운 범위가 현재 연도 기준 동적·저장 연도 합집합");
{
  // 하드코딩 리터럴 범위(for y=2020; y<=2030)가 제거됐는지(소스 단언).
  ok(!/for\s*\(\s*let\s+y\s*=\s*2020\s*;\s*y\s*<=\s*2030/.test(stepBasicSrc),
    "하드코딩 2020~2030 리터럴 루프 제거");
  ok(/new Date\(\)\.getFullYear\(\)/.test(stepBasicSrc),
    "연도 범위가 new Date().getFullYear() 기반(현재 연도 앵커)");
  ok(/Math\.min\(\s*thisYear\s*-\s*6\s*,\s*curY\s*\)/.test(stepBasicSrc),
    "하한 = min(현재-6, 저장 연도) — 오래된 저장 계약 연도도 선택 가능");
  ok(/Math\.max\(\s*thisYear\s*\+\s*4\s*,\s*curY\s*\)/.test(stepBasicSrc),
    "상한 = max(현재+4, 저장 연도) — 미래/저장 연도 항상 포함");

  // 거동 재현: 동적 범위 산식이 현재 연도/저장 연도를 항상 포함하는지(가드 자체 재현).
  const rangeFor = (thisYear, curY) => {
    const loY = Math.min(thisYear - 6, curY);
    const hiY = Math.max(thisYear + 4, curY);
    const ys = [];
    for (let y = loY; y <= hiY; y++) ys.push(y);
    return ys;
  };
  const r2031 = rangeFor(2031, 2031);
  ok(r2031.includes(2031), "2031 기준: 현재 연도 2031 이 범위에 포함(미래 연도 누락 0)");
  const rOld = rangeFor(NOW_YEAR, 2012); // 2012년 저장 계약을 현재 연도에 다시 열기
  ok(rOld.includes(2012) && rOld.includes(NOW_YEAR),
    "오래된 저장 연도(2012)+현재 연도 모두 선택 가능(합집합)");
}

console.log("\n[E] 무회귀 — 2026 기준에서 종전 범위(2020~2030)와 동일 산출");
{
  const rangeFor = (thisYear, curY) => {
    const loY = Math.min(thisYear - 6, curY);
    const hiY = Math.max(thisYear + 4, curY);
    const ys = [];
    for (let y = loY; y <= hiY; y++) ys.push(y);
    return ys;
  };
  const r2026 = rangeFor(2026, 2026);
  ok(r2026[0] === 2020 && r2026[r2026.length - 1] === 2030,
    "2026 기준 범위 = 2020~2030 (종전 하드코딩 창 폭·경계 보존)");
  ok(r2026.length === 11, "2026 기준 11개 연도(종전과 동일 개수)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
