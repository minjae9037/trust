/* ============================================================
   회귀 가드 — 이사회 회의 일자(Doc 05)가 계약 체결일보다 미래(뒤) 입력 지점 교차검증 advisory

   배경: Doc 05(이사회 의사록·boardMin)의 회의 일자(meetingDate)와 계약 체결일
   (common.year/month/day)은 서로 다른 화면(Doc 05 자유 텍스트 ↔ STEP 05 드롭다운)에서
   입력된다. 담보신탁에서 위탁자(법인) 이사회의 담보신탁 결의는 통상 계약 체결을 위한
   선행 절차(결의 → 체결)라 회의 일자는 체결일 당일 또는 그 이전인데, 두 날짜가 서로 다른
   단계에서 입력돼 회의 일자가 체결일보다 뒤인 선후 역전(한쪽 날짜의 연도·월·일 오기
   가능성)이 조용히 성립할 수 있었다. 평가기준일 vs 체결일 advisory(d2a6f23)와 동형의
   "막지 않는 되짚음" — 이미 해석된 dateInfo(interpretDate 단일 출처)와 체결일의 순수 날짜
   비교일 뿐 차단·조문·산출물 무관(드물게 추인 결의 등 정당한 경우의 사용자 선택 보존).

   핵심 불변식:
     - ★표시 전용 — 게이트(validate)·빌더(builders.js)·조문 무접촉(차단 아님).
       boardMeetingAfterContract 는 기존 입력(boardMin.meetingDate·common 체결일)의 파생
       표시일 뿐 어느 산출물·게이트에도 영향을 주지 않는다. 새 상태/모델/엔진 무접촉.
     - 조건 = docId==="boardMin" && f.key==="meetingDate" && dateInfo!==null &&
       dateInfo.real && typeof common.day==="number" && Date.UTC(회의 일자) > Date.UTC(체결일).
       날짜꼴 아님·비실재 날짜·체결일 일(日) 미정·체결일과 같거나 이전이면 미표출(나그·오탐 방지).
     - 비교는 Date.UTC 자정 기준(TZ·시각 성분 무영향 — 평가기준일 vs 체결일과 동형).
     - role=status·aria-live=polite(동적 출현 SR 고지) + 선두 ⚠ 글리프 aria-hidden
       (장식 글리프 접근명 오염 0 — 기존 컨벤션).
     - 기존 클래스(field-hint) 재사용 + 인라인 style 만 — 새 CSS 0.
     - 색 = var(--c-brown) 토큰(차단 적색 var(--c-danger) 아님 — 검토 신호·기존 advisory 동형).

   단언:
     (A) DocStep 배선 — boardMeetingAfterContract 조건·문구·role=status·aria-hidden 글리프·field-hint·brown
     (B) 순수 날짜 비교 — dateInfo(interpretDate)·form.common 체결일·Date.UTC 사용·docId/f.key 게이트
     (C) 무회귀 — 평가기준일 advisory·날짜 readback·money 인라인·검증 게이트 보존
     (D) 무접촉 — validate/builders 에 advisory 문구 미혼입·새 CSS 0·차단 적색 미사용

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-boardmin-date-after-contract-advisory.mjs
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
const doc = read("src", "components", "trust", "steps", "DocStep.tsx");
const validate = read("src", "lib", "engine", "validate.ts");
const builders = read("src", "lib", "engine", "docx", "builders.js");
const globals = read("src", "app", "globals.css");
const schema = read("src", "lib", "engine", "schema.ts");

console.log("\n[A] DocStep 배선 — boardMeetingAfterContract 조건·문구·role=status·aria-hidden 글리프·field-hint·brown");
{
  ok(/const boardMeetingAfterContract =/.test(doc), "boardMeetingAfterContract 파생 상수 선언");
  ok(/docId === "boardMin" &&/.test(doc), "조건 1 = docId === 'boardMin'(이사회 의사록 단계에서만)");
  ok(/f\.key === "meetingDate" &&/.test(doc), "조건 2 = f.key === 'meetingDate'(회의 일자 필드에서만)");
  // 조건 3~6 은 boardMeetingAfterContract 블록 안에서 확인(평가기준일과 같은 구조 — 블록 한정)
  const cond = doc.slice(doc.indexOf("const boardMeetingAfterContract ="));
  const condBlock = cond.slice(0, cond.indexOf(";") + 1);
  ok(/dateInfo !== null &&/.test(condBlock), "조건 3 = dateInfo !== null(날짜꼴일 때만 — free-form 무간섭)");
  ok(/dateInfo\.real &&/.test(condBlock), "조건 4 = dateInfo.real(실재 달력 날짜일 때만 — 비실재 미표출)");
  ok(/typeof form\.common\.day === "number" &&/.test(condBlock),
     "조건 5 = typeof form.common.day === 'number'(체결일 일(日) 확정일 때만)");
  ok(/Date\.UTC\(dateInfo\.year, dateInfo\.month - 1, dateInfo\.day\) >\s*Date\.UTC\(form\.common\.year, form\.common\.month - 1, form\.common\.day\)/.test(condBlock),
     "조건 6 = Date.UTC(회의 일자) > Date.UTC(체결일)(뒤일 때만 — 같거나 이전 미표출)");
  // advisory 본문 — 선후 역전 사실 되짚음 + 확인 권유(차단 아님)
  ok(/이사회 회의 일자\(.*\)가 계약 체결일\(.*\)보다 뒤입니다/.test(doc),
     "advisory 본문 = 회의 일자 > 체결일 사실 되짚음(두 날짜 동시 표기)");
  ok(/통상 위탁자 이사회의 담보신탁 결의는 계약 체결 이전 또는 당일에 이뤄집니다/.test(doc),
     "막지 않고(차단 아님) 결의 선행 통상을 안내하고 확인 권유(사용자 선택 보존)");
  // 동적 출현 SR 고지 + 선두 ⚠ aria-hidden (advisory 블록 직전 구간)
  const adv = doc.slice(doc.indexOf("{boardMeetingAfterContract && ("));
  ok(/role="status" aria-live="polite"/.test(adv.slice(0, 600))
     && /<span aria-hidden="true">⚠ <\/span>/.test(adv.slice(0, 600)),
     "role=status·aria-live=polite + 선두 ⚠ 글리프 aria-hidden(접근명 오염 0)");
  ok(/\{boardMeetingAfterContract && \(\s*<div className="field-hint" role="status" aria-live="polite"/.test(doc),
     "field-hint 기존 클래스 재사용(새 클래스 0)");
  ok(adv.slice(0, 600).includes("var(--c-brown)"),
     "advisory 색 = var(--c-brown) 토큰(차단 적색 아님·기존 advisory 와 동형)");
  ok(!adv.slice(0, 600).includes("var(--c-danger)"),
     "advisory 는 차단 적색(var(--c-danger)) 미사용 — 검토 신호일 뿐 차단 아님");
}

console.log("\n[B] 순수 날짜 비교 — dateInfo(interpretDate)·form.common 체결일·Date.UTC 사용·docId/f.key 게이트");
{
  ok(/const dateInfo = f\.date \? interpretDate\(val as string\) : null;/.test(doc),
     "dateInfo = interpretDate(자유 텍스트 날짜 단일 출처) — 추정 형식 아님");
  ok(/import \{[^}]*\binterpretDate\b[^}]*\} from "@\/lib\/engine\/calc"/.test(doc),
     "calc 에서 interpretDate import(단일 출처)");
  ok(/Date\.UTC\(/.test(doc), "Date.UTC 자정 기준 비교(TZ·시각 성분 무영향 — 평가기준일과 동형)");
  // 스키마 사실 — boardMin.meetingDate 가 실제 date 필드(회의 일자)인지(추정 아님)
  ok(/key: "meetingDate".*date: true.*회의 일자/.test(schema)
     || /meetingDate.*date: true/.test(schema),
     "스키마: boardMin.meetingDate 가 date 필드(회의 일자)(사실 기반)");
  // 체결일 모델 사실 — common.year/month/day 가 실제 체결일 필드인지
  ok(/year: number;/.test(read("src", "lib", "engine", "model.ts"))
     && /day: number \| "";/.test(read("src", "lib", "engine", "model.ts")),
     "모델: common.year(number)·day(number|'')(체결일·사실 기반)");
}

console.log("\n[C] 무회귀 — 평가기준일 advisory·날짜 readback·money 인라인·검증 게이트 보존");
{
  ok(/평가기준일\(.*\)이 계약 체결일\(.*\)보다 뒤입니다/.test(doc),
     "평가기준일 > 체결일 advisory(valuationAfterContract) 보존");
  ok(/달력에 없는 날짜일 수 있습니다/.test(doc), "날짜(회의 일자·평가기준일) 비실재 readback 보존");
  ok(/같은 부동산 평가액이 문서마다 다른지 확인하세요/.test(doc),
     "원본가액 ≠ 신탁부동산 가격 advisory(valuationMismatch) 보존");
  ok(/유효하지 않은 금액입니다 — 0보다 큰 숫자만 입력할 수 있습니다/.test(doc),
     "money 무효 인라인 오류(moneyInvalid) 보존");
  ok(/className="amount-echo"/.test(doc), "amount-echo(천단위·한글 금액 에코) 보존");
  ok(/className="validate-box" role="alert"/.test(doc), "검증 게이트(validate-box) 보존");
}

console.log("\n[D] 무접촉 — validate/builders 에 advisory 문구 미혼입·새 CSS 0·차단 적색 미사용");
{
  ok(!/회의 일자.*계약 체결일.*보다 뒤입니다/.test(validate),
     "validate.ts(게이트)에 advisory 문구 미혼입 — 차단/검증 대상 아님(표시 전용)");
  ok(!/회의 일자.*계약 체결일.*보다 뒤입니다/.test(builders),
     "builders.js(산출물)에 advisory 문구 미혼입 — 조문·표 미변경(표시 전용)");
  ok(!/boardmin-date-after|meeting-date-after|board-meeting-after/.test(globals),
     "globals.css 에 advisory 전용 새 클래스 0(field-hint 재사용)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
