/* ============================================================
   회귀 가드 — 모션 감축 설정(prefers-reduced-motion: reduce) 전역 존중

   배경(a11y·표시/모션 경계만, 비-산출물):
   globals.css 에는 keyframe 애니메이션 5종(fadeUp 진입·spin 스피너 무한 회전·
   slideIn 토스트 translateX 40px·blink 캐럿 점멸·preview-pulse)과 54개 transition
   이 있으나, 종전 `@media (prefers-reduced-motion: reduce)` 블록은 .preview-updating-dot
   한 애니메이션만 껐다 → 모션 감축을 요청한 전정장애·광과민 사용자에게 의미 있는 모션
   (특히 slideIn 의 큰 가로 이동·blink 점멸·spin 무한 회전)이 그대로 남던 부분 커버리지
   갭(WCAG 2.3.3 Animation from Interactions). 또 JointForm 누락 항목 점프는
   scrollIntoView({behavior:"smooth"}) 라 CSS scroll-behavior 로 꺼지지 않아 별도 존중 필요.

   해결(globals.css + JointForm.tsx, 조문·엔진·검증 판정·산출물 무접촉):
     · globals.css reduce 블록을 전역 무력화로 확장 — `*,*::before,*::after` 에
       animation-duration 0.01ms·animation-iteration-count 1(무한 반복 정지)·
       transition-duration 0.01ms·scroll-behavior auto 를 !important 로. 최종 상태
       (opacity/transform 종료값)는 보존되므로 레이아웃·가시성 무변경, 모션만 제거.
       transitionend/animationend 의존 JS 0건(이벤트 로직 무영향).
     · .preview-updating-dot 은 시작 프레임에 흐릿·축소되지 않도록 안정 가시값 명시 유지.
     · JointForm.focusMissing 의 scrollIntoView 가 matchMedia(reduce) 시 behavior:"auto".

   핵심 불변식:
     (A) reduce 블록의 전역 셀렉터(*,*::before,*::after)에 4속성 !important.
     (B) animation-iteration-count:1(무한 spin/blink/pulse 정지) 포함.
     (C) .preview-updating-dot 안정 가시값 유지(종전 동작 무회귀).
     (D) JointForm scrollIntoView 가 reduce 시 auto(부드러운 스크롤 즉시화).
     (E) 무회귀 — keyframe 정의(fadeUp/spin/slideIn/blink) 자체는 보존(reduce 미설정
         사용자에겐 모션 그대로), reduce 블록이 정확히 1개.

   실행:
     cd trust-saas
     node scripts/verify-reduced-motion.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "src/app/globals.css"), "utf8");
const joint = readFileSync(join(root, "src/components/trust/JointForm.tsx"), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

// 균형 잡힌 중괄호로 첫 @media (prefers-reduced-motion: reduce) 블록 본문 추출.
function mediaBlock(src, query) {
  const start = src.indexOf(query);
  if (start < 0) return "";
  const braceStart = src.indexOf("{", start);
  if (braceStart < 0) return "";
  let depth = 0;
  for (let i = braceStart; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) return src.slice(braceStart + 1, i); }
  }
  return "";
}
const MQ = "@media (prefers-reduced-motion: reduce)";
const reduce = mediaBlock(css, MQ);
// 전역 셀렉터(*,*::before,*::after) 규칙 본문 추출.
function universalBody(block) {
  const m = block.match(/\*\s*,\s*\*::before\s*,\s*\*::after\s*\{([\s\S]*?)\}/);
  return m ? m[1] : "";
}
const uni = universalBody(reduce);

console.log("\n[A] reduce 블록 전역 셀렉터 — 4속성 !important");
ok(reduce.length > 0, "@media (prefers-reduced-motion: reduce) 블록 추출 성공");
ok(uni.length > 0, "*,*::before,*::after 전역 규칙 존재");
ok(/animation-duration:\s*0\.01ms\s*!important/.test(uni), "animation-duration 0.01ms !important");
ok(/transition-duration:\s*0\.01ms\s*!important/.test(uni), "transition-duration 0.01ms !important");
ok(/scroll-behavior:\s*auto\s*!important/.test(uni), "scroll-behavior auto !important(CSS 스크롤 즉시화)");

console.log("\n[B] 무한 반복 애니메이션 정지");
ok(/animation-iteration-count:\s*1\s*!important/.test(uni),
  "animation-iteration-count 1 !important(spin·blink·preview-pulse 무한 반복 정지)");

console.log("\n[C] preview-updating-dot 안정 가시값(무회귀)");
{
  const m = reduce.match(/\.preview-updating-dot\s*\{([^}]*)\}/);
  const dot = m ? m[1] : "";
  ok(dot.length > 0, ".preview-updating-dot 규칙 존재(reduce 블록 내)");
  ok(/animation:\s*none/.test(dot), ".preview-updating-dot animation:none");
  ok(/opacity:\s*0\.8/.test(dot), ".preview-updating-dot opacity:0.8(시작 프레임 흐림 방지)");
}

console.log("\n[D] JointForm scrollIntoView — reduce 시 즉시(auto)");
ok(/matchMedia\?\.\(\s*["']\(prefers-reduced-motion:\s*reduce\)["']\s*\)\.matches/.test(joint),
  "matchMedia('(prefers-reduced-motion: reduce)').matches 판정");
ok(/behavior:\s*reduceMotion\s*\?\s*["']auto["']\s*:\s*["']smooth["']/.test(joint),
  "scrollIntoView behavior = reduce ? 'auto' : 'smooth'");

console.log("\n[E] 무회귀 — keyframe 정의 보존 + reduce 블록 단일");
ok(/@keyframes\s+fadeUp/.test(css), "@keyframes fadeUp 보존(reduce 미설정 사용자 모션 유지)");
ok(/@keyframes\s+spin/.test(css), "@keyframes spin 보존");
ok(/@keyframes\s+slideIn/.test(css), "@keyframes slideIn 보존");
ok(/@keyframes\s+blink/.test(css), "@keyframes blink 보존");
ok((css.match(/@media \(prefers-reduced-motion: reduce\)/g) || []).length === 1,
  "reduce @media 블록 정확히 1개(중복 없음)");

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
process.exit(fail === 0 ? 0 : 1);
