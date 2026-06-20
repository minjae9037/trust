/* ============================================================
   회귀 가드 — DocStep 실시간 미리보기 입력 디바운스

   배경: 우측 "실시간 미리보기"는 form 변경마다 previewDocHTML()로 완성
   문서 HTML(계약서 본문 37KB+)을 재생성하고 iframe srcDoc 을 다시 파싱한다.
   매 키 입력마다 이걸 돌리면 타이핑이 끊긴다. 그래서 미리보기 한정으로
   form 을 디바운스(useDebounced 250ms)해 재생성 횟수를 줄였다.

   단, 입력 필드와 검증 게이트(validateDoc)는 디바운스되면 안 된다
   (입력 즉시 반영 / 누락 안내 즉시 갱신 — UX·정확성). 이 가드는 그 계약을
   정적으로 단언해 "미리보기에 raw form 직결" 회귀를 차단한다.
     (A) useDebounced 훅 존재 + 미리보기는 debouncedForm 사용(raw form 아님)
     (B) 검증 게이트(validateDoc)는 raw form 직결 — 디바운스 미적용
     (C) 디바운스는 미리보기 전용 — debouncedForm 의 유일 소비자가 previewDocHTML

   실행:
     cd trust-saas
     node scripts/verify-preview-debounce.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "src/components/trust/steps/DocStep.tsx"), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

console.log("\n[A] 디바운스 훅 존재 + 미리보기는 debouncedForm 사용");
ok(/function useDebounced\b/.test(src), "useDebounced 훅 정의 존재");
ok(/useDebounced\(form,\s*\d+\)/.test(src), "form 을 디바운스해 debouncedForm 산출");
ok(/previewDocHTML\(\s*debouncedForm\s*,\s*docId\s*\)/.test(src), "previewDocHTML 은 debouncedForm 사용");
ok(!/previewDocHTML\(\s*form\s*,/.test(src), "previewDocHTML 에 raw form 직결 없음(회귀 차단)");

console.log("\n[B] 검증 게이트는 즉시(raw form) — 디바운스 미적용");
ok(/validateDoc\(\s*form\s*,\s*docId\s*\)/.test(src), "validateDoc 은 raw form 사용(누락 안내 즉시)");
ok(!/validateDoc\(\s*debouncedForm/.test(src), "validateDoc 에 debouncedForm 미사용");

console.log("\n[C] 디바운스는 미리보기 전용 — 입력/저장 경로 미오염");
// 미리보기 memo 의존성이 debouncedForm 을 추적(디바운스 값으로 재생성)
ok(/\}\s*,\s*\[debouncedForm,\s*docId\]\s*\)/.test(src), "미리보기 memo 의존성 = [debouncedForm, docId]");
// 입력 반영(updateDocContent)·검증은 debouncedForm 을 쓰지 않음(즉시성 보존)
ok(!/updateDocContent\([^)]*debouncedForm/.test(src), "updateDocContent 에 debouncedForm 미오염");

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
