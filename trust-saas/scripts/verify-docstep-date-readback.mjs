/* ============================================================
   회귀 가드 — DocStep 자유 텍스트 날짜 필드(평가기준일·회의 일자) 달력 해석 readback

   배경: valReport「평가기준일」·boardMin「회의 일자」는 type="text" 자유 텍스트라
   사용자가 입력한 문자열이 산출물(키-값 표 val=raw)에 **그대로** 박힌다(builders.js
   docRows: val = raw). 계약 체결일(StepBasic 년·월·일 드롭다운)은 daysInMonth 클램프로
   실재하지 않는 날짜를 애초에 못 만들지만, 이 자유 텍스트 날짜만은 "2025-02-30"(달력에
   없음)·"07-03↔03-07"(월·일 전치) 같은 오입력을 입력 지점에서 짚을 수단이 전무했다.
   이제 입력이 **명확한 숫자 날짜꼴**일 때만 interpretDate 가 연·월·일을 해석해
   "YYYY년 M월 D일" readback(실재 날짜) 또는 비차단 주의(달력에 없는 날짜)를 띄운다 —
   금액 readback(amountToHangul)과 같은 표시/접근성 경계, isRealDate 단일 출처 재사용.

   핵심 불변식:
     - free-form(날짜꼴 아님)·빈 값은 무간섭(null) — 자유 텍스트 형식 강제 금지.
     - 날짜꼴 + 실재 날짜 → "YYYY년 M월 D일" 해석 에코(월·일 전치 확인).
     - 날짜꼴 + 달력에 없는 날짜 → 비차단 주의(role=status — alert/aria-invalid/게이트 차단 아님).
     - 계약 체결일과 같은 isRealDate 단일 출처(추정 형식 아닌 달력 규칙)·새 CSS 0.

   단언:
     (A) interpretDate 순수 거동 — 인식 조건·실재 판정·free-form 무간섭·월일 전치 구별
     (B) schema 배선 — valuationDate·meetingDate 에 date:true, DocField 에 date 플래그
     (C) DocStep 배선 — import·dateInfo·실재 에코·비차단 주의·차단/오류 아님
     (D) 무접촉/무회귀 — money 에코 보존·게이트(docMissing) 무접촉·새 CSS 0·조문/빌더 import 0

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-docstep-date-readback.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { interpretDate } from "../src/lib/engine/calc.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const __dir = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(join(__dir, "..", ...p), "utf8");
const docStep = read("src", "components", "trust", "steps", "DocStep.tsx");
const schema = read("src", "lib", "engine", "schema.ts");
const validate = read("src", "lib", "engine", "validate.ts");
const globals = read("src", "app", "globals.css");

console.log("\n[A] interpretDate 순수 거동 — 인식 조건·실재 판정·free-form 무간섭");
{
  // 명확한 숫자 날짜꼴 + 실재 날짜
  ok(JSON.stringify(interpretDate("2025-07-03")) === JSON.stringify({ year: 2025, month: 7, day: 3, real: true }),
     "2025-07-03 → {2025,7,3, real:true}");
  ok(interpretDate("2025.10.12.")?.real === true && interpretDate("2025.10.12.")?.month === 10,
     "2025.10.12.(점·후행점) → 실재 날짜 해석");
  ok(interpretDate("2025년 7월 1일")?.real === true && interpretDate("2025년 7월 1일")?.day === 1,
     "2025년 7월 1일(한글 구분자) → 실재 날짜 해석");
  ok(interpretDate("2024-02-29")?.real === true, "2024-02-29(윤년) → 실재(daysInMonth 단일 출처)");
  // 날짜꼴이지만 달력에 없는 날짜 → real:false(비차단 주의 대상)
  ok(interpretDate("2025-02-30")?.real === false, "2025-02-30 → real:false(달력에 없음)");
  ok(interpretDate("2025-13-01")?.real === false, "2025-13-01(13월) → real:false");
  ok(interpretDate("2023-02-29")?.real === false, "2023-02-29(평년) → real:false");
  // ★월·일 전치 구별 — 같은 숫자라도 해석이 달라 확인 가치
  ok(interpretDate("2025-07-03")?.day === 3 && interpretDate("2025-03-07")?.day === 7,
     "07-03 ↔ 03-07 월·일 전치가 readback 에서 구별됨");
  // free-form / 미인식 → null(무간섭, 형식 강제 금지)
  ok(interpretDate("해당사항 없음") === null, "free-form 텍스트 → null(무간섭)");
  ok(interpretDate("5,000,000,000") === null, "금액(콤마) → null(날짜 아님)");
  ok(interpretDate("010-1234-5678") === null, "전화번호(첫 그룹 4자리 아님) → null");
  ok(interpretDate("") === null && interpretDate(null) === null && interpretDate(undefined) === null,
     "빈 값·null·undefined → null");
  ok(interpretDate("2025-07") === null, "그룹 2개(불완전) → null(보수적 미인식)");
  ok(interpretDate("감정평가서 2025-07-03 호") === null, "날짜+잡텍스트 혼합 → null(숫자+구분자만 인식)");
}

console.log("\n[B] schema 배선 — date 플래그 + 두 날짜 필드");
{
  ok(/date\?: boolean;/.test(schema), "DocField 에 date?: boolean 플래그 선언");
  ok(/key: "valuationDate", type: "text", date: true/.test(schema), "valuationDate(평가기준일) date:true");
  ok(/key: "meetingDate", type: "text", date: true/.test(schema), "meetingDate(회의 일자) date:true");
}

console.log("\n[C] DocStep 배선 — import·dateInfo·실재 에코·비차단 주의");
{
  ok(/interpretDate/.test(docStep) && /from "@\/lib\/engine\/calc"/.test(docStep),
     "calc 에서 interpretDate import");
  ok(/const dateInfo = f\.date \? interpretDate\(val as string\) : null;/.test(docStep),
     "date 필드일 때만 interpretDate(val) 계산(아니면 null=무간섭)");
  // 실재 날짜 에코 — loan-hangul(금액 readback과 동일 표시 클래스) + 해석 표시
  ok(/dateInfo && dateInfo\.real &&/.test(docStep) &&
     /\{dateInfo\.year\}년 \{dateInfo\.month\}월 \{dateInfo\.day\}일/.test(docStep),
     "실재 날짜 → 'YYYY년 M월 D일' 해석 에코");
  ok(/dateInfo\.real[\s\S]{0,120}className="loan-hangul" role="status" aria-live="polite"/.test(docStep),
     "에코는 loan-hangul·role=status·aria-live=polite(기존 readback 패턴 재사용)");
  // 달력에 없는 날짜 → 비차단 주의(role=status, NOT alert, NOT aria-invalid)
  ok(/dateInfo && !dateInfo\.real &&/.test(docStep) &&
     /달력에 없는 날짜일 수 있습니다/.test(docStep),
     "날짜꼴인데 실재 아님 → 비차단 주의 문구");
  const warnIdx = docStep.indexOf("달력에 없는 날짜일 수 있습니다");
  const warnDiv = docStep.slice(docStep.lastIndexOf("<div", warnIdx), warnIdx);
  ok(/role="status"/.test(warnDiv) && !/role="alert"/.test(warnDiv) && !/aria-invalid/.test(warnDiv),
     "★주의는 role=status(비차단) — role=alert/aria-invalid 아님(자유 텍스트 형식 강제 금지)");
}

console.log("\n[D] 무접촉/무회귀 — money 에코·게이트·새 CSS 0·조문/빌더 import 0");
{
  // 기존 money 에코(amount-echo + amountToHangul)·무효 안내 보존
  ok(/className="amount-echo" role="status" aria-live="polite"/.test(docStep),
     "money 에코(amount-echo) 보존(무회귀)");
  ok(/유효하지 않은 금액입니다/.test(docStep), "money 무효 안내(role=alert) 보존(무회귀)");
  // 게이트(docMissing/validate)는 날짜 자유 텍스트를 검사하지 않음 — 비차단(생성 차단 무관)
  ok(!/valuationDate|meetingDate|interpretDate|달력에 없는/.test(validate),
     "validate.ts(게이트)는 날짜 readback 과 무관 — 차단/검증 대상 아님(비차단 보장)");
  // loan-hangul 은 기존 CSS — 새 CSS 0
  ok(/\.loan-hangul\s*\{/.test(globals), "loan-hangul CSS 기존 재사용(새 CSS 0)");
  // DocStep 은 조문/별지 직접 import 0(빌더 호출은 미리보기용 기존 배선, 본 변경은 calc 만 추가)
  ok(!/from "@\/lib\/engine\/(clauses|annex)"/.test(docStep),
     "조문(clauses)·별지(annex) import 0(산출물·조문 무접촉)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
