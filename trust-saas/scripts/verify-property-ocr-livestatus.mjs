/* ============================================================
   회귀 가드 — 부동산(물건) 등기부 OCR 자동추출 상태 스크린리더 고지(aria-live)

   배경(a11y·WCAG 4.1.3 Status Messages, 비-산출물): StepProperty 의 "등기부 PDF"
   자동추출은 담보물(소재지·지목·면적·등기 고유번호) 정량 데이터를 사용자 입력 없이
   채우는 핵심·정확성 직결 동선이다. 그러나 진행("부동산 등기부 분석 중…")·완료("자동
   추출 완료 … 검수하세요")·실패("추출 실패: …") 메시지(ocrMsg)가 일반 div 로 렌더돼
   스크린리더가 전혀 고지받지 못했다. OCR 은 오인식 가능 → 완료 시 "검수하세요" 안내가
   SR 사용자에게 닿지 않으면 잘못 추출된 법적 데이터를 검수 없이 확정할 위험이 있다
   (회사 "정확성 최우선·검수" 원칙 직결).

   핵심 불변식:
     (A) ocrMsg 상태 존재(useState).
     (B) ★영속 라이브 영역 — role="status"·aria-live="polite"·aria-atomic="true" 컨테이너가
         ocrMsg 유무와 무관하게 항상 렌더된다(컨테이너 자체가 `{ocrMsg && (` 로 게이트되지
         않음). 라이브 영역은 콘텐츠 변경 '전'에 DOM 에 있어야 첫 메시지부터 안정 낭독되므로
         (advisor `.advisor-live` 와 동일 철학), 메시지 div 만 컨테이너 '안'에서 조건부 렌더.
     (C) 컨테이너가 {ocrMsg} 를 렌더(메시지 본문 고지).
     (D) 상태 배선 — onPdf 가 진행·완료·실패 setOcrMsg 를 호출(고지될 문구가 실제로 세팅됨).
     (E) ★시각 무변경 — 메시지 div 는 기존 field-hint 클래스·blue-deep 색 보존(별도 CSS 0).
     (F) 무회귀 — OCR.recognizePDF / parsePropertyRegistry / updateProperty 추출 배선 보존.

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-property-ocr-livestatus.mjs
     (정적 소스 단언만 — 타입 로더 불요하나 러너 일관성 위해 동일 실행)
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(path.join(root, "src", "components", "trust", "steps", "StepProperty.tsx"), "utf8");

console.log("\n[A] ocrMsg 상태 존재");
{
  ok(/const \[ocrMsg, setOcrMsg\] = useState\(""\);/.test(src), "ocrMsg 상태(useState 빈 문자열) 존재");
}

console.log("\n[B] ★영속 라이브 영역 — role=status·aria-live=polite·aria-atomic, ocrMsg 게이트 밖");
{
  const regionIdx = src.indexOf('role="status"');
  ok(regionIdx > 0, "role=\"status\" 라이브 영역 존재");
  // 컨테이너 여는 태그 범위(작은 윈도)만 잘라 속성 단언
  const open = regionIdx > 0 ? src.slice(regionIdx, regionIdx + 80) : "";
  ok(/aria-live="polite"/.test(open), "라이브 영역 aria-live=\"polite\"");
  ok(/aria-atomic="true"/.test(open), "라이브 영역 aria-atomic=\"true\"(전체 낭독)");
  // role=status 컨테이너는 1곳만(과다 영역 회귀 감지)
  ok((src.match(/role="status"/g) || []).length === 1, "role=\"status\" 라이브 영역 정확히 1곳");
  // ★핵심: `{ocrMsg && (` 조건부가 role=status '뒤'에 위치 = 컨테이너는 무조건 렌더, 메시지만 조건부
  const condIdx = src.indexOf("{ocrMsg && (");
  ok(condIdx > regionIdx, "{ocrMsg && ( 조건부가 role=status 컨테이너 '안'(뒤)에 위치 = 컨테이너 영속");
  // 컨테이너가 ocrMsg 로 게이트되지 않음 — role=status 바로 앞이 `{ocrMsg && (` 가 아님
  const before = regionIdx > 0 ? src.slice(Math.max(0, regionIdx - 40), regionIdx) : "";
  ok(!/\{ocrMsg && \(\s*<div\s+role="status"/.test(before + 'role="status"') && !before.trimEnd().endsWith("{ocrMsg && ("),
    "라이브 영역 컨테이너 자체는 ocrMsg 로 게이트되지 않음(첫 메시지 안정 낭독)");
}

console.log("\n[C] 컨테이너가 {ocrMsg} 본문을 렌더");
{
  // role=status 컨테이너 닫힘까지의 구간에 {ocrMsg} 가 있어야 함
  const regionIdx = src.indexOf('role="status"');
  const seg = regionIdx > 0 ? src.slice(regionIdx, regionIdx + 400) : "";
  ok(/\{ocrMsg\}/.test(seg), "라이브 영역 컨테이너 내부에서 {ocrMsg} 렌더");
}

console.log("\n[D] 상태 배선 — onPdf 가 진행·완료·실패 setOcrMsg 호출");
{
  const fnStart = src.indexOf("async function onPdf");
  const fnBody = fnStart >= 0 ? src.slice(fnStart, src.indexOf("\n  }", fnStart) + 4) : "";
  ok(fnStart >= 0, "onPdf 함수 존재");
  ok(/setOcrMsg\("부동산 등기부 분석 중…"\)/.test(fnBody), "진행 고지(분석 중…) setOcrMsg 호출");
  ok(/setOcrMsg\(`처리 중:/.test(fnBody), "진행 콜백(처리 중: 페이지) setOcrMsg 호출");
  ok(/setOcrMsg\(`자동 추출 완료/.test(fnBody), "완료 고지(자동 추출 완료 … 검수하세요) setOcrMsg 호출");
  ok(/setOcrMsg\("추출 실패: "/.test(fnBody), "실패 고지(추출 실패) setOcrMsg 호출(catch)");
}

console.log("\n[E] ★시각 무변경 — 메시지 div 는 기존 field-hint·blue-deep 보존(별도 CSS 0)");
{
  ok(/className="field-hint"[^>]*color: "var\(--c-blue-deep\)"/.test(src.replace(/\n/g, " ")),
    "메시지 div = field-hint 클래스 + blue-deep 색 보존(시각 무변경)");
}

console.log("\n[F] 무회귀 — OCR 추출 배선 보존");
{
  ok(/OCR\.recognizePDF\(/.test(src), "OCR.recognizePDF 호출 보존");
  ok(/OCR\.parsePropertyRegistry\(/.test(src), "OCR.parsePropertyRegistry 호출 보존");
  ok(/updateProperty\(idx, r\)/.test(src), "updateProperty(idx, r) 추출 반영 보존");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
process.exit(fail === 0 ? 0 : 1);
