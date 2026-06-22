/* ============================================================
   회귀 가드 — 내 계약 목록 "수정 시각" 상대 표기

   배경: 내 계약 목록(ContractsView)은 기본 정렬이 "최근 수정순"인데, 카드 하단 수정 시각을
   절대 시각("2026. 6. 22. 오후 3:14:05")으로만 보여줘 "방금 손댄 계약"을 한눈에 식별하기
   어려웠다. 절대 시각을 "방금·N분 전·N시간 전·어제·N일 전"의 상대 표기로 바꿔 목록 훑기
   효율을 높이되, 정확한 전체 시각은 title(hover)·sr-only 로 보존한다(잃는 정밀도 보강).
   순수 함수 formatRelativeTime(iso, nowMs) — Date.now() 부수효과를 nowMs 인자로 분리해
   고정 now 로 경계를 단언한다.

   핵심 불변식:
     - ★표시 전용 — 정렬 키(updated_at 원본)·빌더·조문·게이트(validate) 무접촉.
     - 분/시 구간 = 경과 시간, "어제"/"N일 전" = 로컬 자정 기준 캘린더 일수 차
       (자정 갓 넘긴 어제 작업이 "1일 전"으로 어색해지지 않게).
     - 시계 오차로 미래(updated_at > now) → "방금"(빈칸 방지), 해석 불가 → ""
       (호출부가 절대 시각으로 폴백).
     - 7일 초과 → 절대 날짜("YYYY. M. D.")로 강등(상대 표기 식별력 저하 구간).

   단언:
     (A) formatRelativeTime 값 — 방금/분/시간/어제/일/절대날짜 경계
     (B) 캘린더 인식 — 자정 넘긴 어제(경과 2h)도 "어제", 같은 날 3h 는 "N시간 전"
     (C) 견고성 — 미래(시계오차) → "방금", 비실재/빈 값 → ""
     (D) ContractsView 배선 — import·nowMs 1회 계산·<time> 상대표기+title 전체시각+sr-only
     (E) 무접촉/무회귀 — 빌더·게이트에 미혼입·calc export·toLocaleString 전체시각 보존

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-contracts-relative-time.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { formatRelativeTime } from "../src/lib/engine/calc.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const __dir = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(join(__dir, "..", ...p), "utf8");
const contractsView = read("src", "components", "trust", "ContractsView.tsx");
const calc = read("src", "lib", "engine", "calc.ts");
const validate = read("src", "lib", "engine", "validate.ts");
const builders = read("src", "lib", "engine", "docx", "builders.js");

// 고정 기준 시각 = 2026-06-22(월) 15:00 로컬. 모든 케이스를 이 now 로 단언(결정적).
const now = new Date(2026, 5, 22, 15, 0, 0).getTime();
const MIN = 60_000, HOUR = 60 * MIN;
const at = (...args) => new Date(...args).getTime();

console.log("\n[A] formatRelativeTime 값 — 방금/분/시간/일/절대날짜 경계");
{
  ok(formatRelativeTime(now - 30_000, now) === "방금", "30초 전 → '방금'");
  ok(formatRelativeTime(now - 59_000, now) === "방금", "59초 전 → '방금'(1분 경계 직전)");
  ok(formatRelativeTime(now - 5 * MIN, now) === "5분 전", "5분 전 → '5분 전'");
  ok(formatRelativeTime(now - 59 * MIN, now) === "59분 전", "59분 전 → '59분 전'(1시간 경계 직전)");
  ok(formatRelativeTime(at(2026, 5, 22, 12, 0, 0), now) === "3시간 전", "같은 날 3시간 전 → '3시간 전'");
  ok(formatRelativeTime(at(2026, 5, 19, 15, 0, 0), now) === "3일 전", "3일 전(달력) → '3일 전'");
  ok(formatRelativeTime(at(2026, 5, 16, 15, 0, 0), now) === "6일 전", "6일 전(달력) → '6일 전'(7일 경계 직전)");
  ok(formatRelativeTime(at(2026, 5, 12, 9, 0, 0), now) === "2026. 6. 12.", "10일 전 → 절대 날짜 'YYYY. M. D.'");
}

console.log("\n[B] 캘린더 인식 — '어제'/'N일 전'은 로컬 자정 기준(경과시간 아님)");
{
  // 자정을 갓 넘긴 어제 작업: 경과 2h 이지만 달력상 어제 → '어제'
  const lateNight = new Date(2026, 5, 22, 1, 0, 0).getTime();
  ok(formatRelativeTime(at(2026, 5, 21, 23, 0, 0), lateNight) === "어제",
     "now 01:00, 어제 23:00(경과 2h) → '어제'(캘린더 인식)");
  // 같은 날 한참 전이라도 '어제' 아님 → '시간 전'
  ok(formatRelativeTime(at(2026, 5, 22, 3, 0, 0), now) === "12시간 전",
     "같은 달력 날짜 12h 전 → '12시간 전'(어제 아님)");
  ok(formatRelativeTime(at(2026, 5, 21, 20, 0, 0), now) === "어제",
     "어제 20:00(경과 19h) → '어제'");
  // 어제↔그제 경계
  ok(formatRelativeTime(at(2026, 5, 20, 23, 0, 0), now) === "2일 전",
     "그저께 23:00 → '2일 전'(어제 아님)");
}

console.log("\n[C] 견고성 — 미래(시계오차) → '방금', 비실재/빈 값 → ''");
{
  ok(formatRelativeTime(now + 5 * MIN, now) === "방금", "미래 5분(시계 오차) → '방금'(빈칸 방지)");
  ok(formatRelativeTime("not-a-date", now) === "", "해석 불가 문자열 → ''(호출부 절대시각 폴백)");
  ok(formatRelativeTime(null, now) === "" && formatRelativeTime(undefined, now) === "",
     "null·undefined → ''");
  // ISO 문자열·Date 객체 입력도 동일 처리(호출부는 ISO 문자열을 넘김)
  ok(formatRelativeTime(new Date(now - 5 * MIN).toISOString(), now) === "5분 전",
     "ISO 문자열 입력 → 동일 해석(호출부 r.updated_at 경로)");
  ok(formatRelativeTime(new Date(now - HOUR), now) === "1시간 전", "Date 객체 입력 → 동일 해석");
}

console.log("\n[D] ContractsView 배선 — import·nowMs 1회·<time> 상대+title 전체+sr-only");
{
  ok(/import \{ formatRelativeTime \} from "@\/lib\/engine\/calc";/.test(contractsView),
     "calc 에서 formatRelativeTime import");
  ok(/const nowMs = Date\.now\(\);/.test(contractsView),
     "렌더 최상단 nowMs 1회 계산(카드 공통 기준)");
  ok(/formatRelativeTime\(r\.updated_at, nowMs\)/.test(contractsView),
     "수정 시각을 formatRelativeTime(r.updated_at, nowMs)로 렌더");
  ok(/<time\s+dateTime=\{valid \? ts\.toISOString\(\) : undefined\}\s+title=\{full\}>/.test(contractsView),
     "<time> 에 유효할 때만 dateTime·전체 시각 title(hover) 보존");
  ok(/Number\.isFinite\(ts\.getTime\(\)\)/.test(contractsView),
     "비실재 시각 가드(toISOString throw 방지 — 렌더 크래시 차단)");
  ok(/<span className="sr-only"> \(\{full\}\)<\/span>/.test(contractsView),
     "sr-only 로 전체 시각 병기(SR 정밀도 보존)");
  ok(/formatRelativeTime\(r\.updated_at, nowMs\) \|\| full/.test(contractsView),
     "상대 표기 빈 값(비실재)일 때 절대 시각으로 폴백");
}

console.log("\n[E] 무접촉/무회귀 — 빌더·게이트 미혼입·calc export·전체시각 보존");
{
  ok(/export function formatRelativeTime\(\s*[\s\S]*?nowMs: number,?\s*\): string/.test(calc),
     "calc.ts 에 formatRelativeTime(iso, nowMs) 순수 함수 export");
  ok(!/formatRelativeTime/.test(builders),
     "builders.js(산출물)에 formatRelativeTime 미혼입 — 표시/출력 경계 분리");
  ok(!/formatRelativeTime/.test(validate),
     "validate.ts(게이트)는 무관 — 차단/검증 대상 아님(표시 전용)");
  // 전체 시각(toLocaleString) 은 title·sr-only·폴백으로 보존(정밀도 손실 0)
  ok(/toLocaleString\("ko-KR"\)/.test(contractsView),
     "절대 전체 시각(toLocaleString ko-KR) 보존 — title/sr-only/폴백");
  // 정렬 키는 원본 updated_at 문자열 비교 그대로(상대 표기와 무관)
  ok(/a\.updated_at < b\.updated_at/.test(contractsView),
     "정렬 키 = 원본 updated_at(상대 표기는 정렬에 영향 0)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
