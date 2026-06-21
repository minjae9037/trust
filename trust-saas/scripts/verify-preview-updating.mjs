/* ============================================================
   회귀 가드 — DocStep 미리보기 "갱신 중…" 인디케이터

   배경: 우측 실시간 미리보기는 form 을 250ms 디바운스(useDebounced)해
   재생성한다(타이핑 끊김 방지). 그 대기 구간 동안은 미리보기가 직전
   상태에 머물러, 사용자에겐 "왜 안 바뀌지?"로 보일 수 있다. 그래서
   디바운스 대기 중(form !== debouncedForm)에만 "갱신 중…" 인디케이터를
   띄워 멈춘 게 아니라 반영 중임을 알린다.

   이 가드는 다음을 정적으로 단언한다:
     (A) 대기 신호 = 참조 불일치(form !== debouncedForm) — store 가 매
         수정마다 새 form 참조를 만들므로 신뢰 가능. debouncedForm 등 다른
         값과 비교하지 않음(회귀 차단).
     (B) 인디케이터는 그 신호로만 조건부 렌더 + a11y(role=status/aria-live).
     (C) 디바운스 자체는 무변경 — 미리보기는 여전히 debouncedForm 사용,
         검증 게이트는 raw form 직결(인디케이터가 즉시성/정확성을 깨지 않음).
     (D) CSS(.preview-updating) 정의 존재 + 모션 민감 사용자 배려.

   실행:
     cd trust-saas
     node scripts/verify-preview-updating.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "src/components/trust/steps/DocStep.tsx"), "utf8");
const css = readFileSync(join(root, "src/app/globals.css"), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

console.log("\n[A] 대기 신호 = form !== debouncedForm (참조 불일치)");
ok(/const\s+previewPending\s*=\s*form\s*!==\s*debouncedForm/.test(src),
  "previewPending = form !== debouncedForm");
ok(!/previewPending\s*=\s*debouncedForm\s*!==/.test(src),
  "신호를 거꾸로(debouncedForm 기준) 계산하지 않음");

console.log("\n[B] 인디케이터는 대기 신호로만 조건부 렌더 + a11y");
ok(/previewPending\s*&&\s*\(/.test(src), "previewPending 일 때만 조건부 렌더");
ok(/className="preview-updating"/.test(src), "preview-updating 인디케이터 마크업 존재");
ok(/role="status"/.test(src) && /aria-live="polite"/.test(src),
  "role=status + aria-live=polite (스크린리더 알림)");
ok(/갱신 중/.test(src), "사용자 카피 '갱신 중…' 표기");

console.log("\n[C] 디바운스 계약 무변경 — 즉시성/정확성 보존");
ok(/previewDocHTML\(\s*debouncedForm\s*,\s*docId\s*\)/.test(src),
  "미리보기는 여전히 debouncedForm 사용(디바운스 유지)");
ok(/validateDoc\(\s*form\s*,\s*docId\s*\)/.test(src),
  "검증 게이트는 raw form 직결(인디케이터가 즉시성 안 깸)");
ok(!/previewPending[\s\S]{0,40}previewDocHTML/.test(src) &&
   !/previewDocHTML[\s\S]{0,40}previewPending/.test(src),
  "인디케이터가 미리보기 HTML 생성 경로에 끼어들지 않음");

console.log("\n[D] CSS 정의 + 모션 민감 배려");
ok(/\.preview-updating\s*\{/.test(css), ".preview-updating 정의 존재");
ok(/\.preview-updating-dot\s*\{/.test(css) && /@keyframes preview-pulse/.test(css),
  "펄스 점(dot) + keyframes 정의");
ok(/prefers-reduced-motion[\s\S]{0,120}\.preview-updating-dot[\s\S]{0,40}animation:\s*none/.test(css),
  "prefers-reduced-motion 시 애니메이션 off");

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
