/* ============================================================
   회귀 가드 — 위저드 단계 이동 시 새 단계 제목 포커스 이동(WCAG 2.4.3 Focus Order)

   배경(a11y·비-산출물·포커스/표시 경계만):
   담보신탁 위저드(CollateralWizard)는 sub-step pill·stepper·이전/다음·진행요약
   점프, 그리고 DocStep 검증박스의 누락항목 점프 등 여러 경로로 단계를 바꾼다.
   종전엔 단계만 바뀌고 포커스는 클릭한 내비 컨트롤(이전/다음·pill)에 남거나,
   DocStep 점프 후엔 그 버튼이 언마운트되며 포커스가 사라져(document.body 로 복귀)
   키보드/스크린리더 사용자가 새 단계 콘텐츠를 처음부터 다시 찾아야 했다. 단일 폼
   JointForm 은 이미 누락항목 점프 시 focusMissing(scrollIntoView+focus)으로 포커스를
   옮기는데, 멀티스텝 위저드엔 그 패리티가 없던 갭.

   해결: 모든 단계 이동이 결국 store 의 step 을 갱신하므로, step 변화 한 곳에서
   새 단계 제목(form-panel 의 h2, tabIndex={-1})으로 포커스를 옮긴다(최초 렌더는
   건너뜀 — 마운트·계약 열기 시 포커스 가로채기 방지). 제목은 비-상호작용 요소라
   포커스 아웃라인을 억제(시각 무변경).

   핵심 불변식:
     (A) useRef import + headingRef/mountedRef 정의.
     (B) form-panel 제목 h2 에 ref={headingRef}·tabIndex={-1}·className 부여,
         제목 텍스트는 {current.title} 유지.
     (C) step 변화 useEffect — 최초 렌더 스킵(mountedRef) 후 headingRef.focus(),
         의존성 배열 [step].
     (D) CSS: .form-panel-title:focus 아웃라인 억제(시각 무변경).
     (E) 무회귀 — goStep(setStep+setTab) 배선·StepContent·pagenav·DocStep
         goToStep(setStep+setTab) 점프 배선 보존.

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-wizard-step-focus.mjs
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
const wiz = readFileSync(path.join(root, "src", "components", "trust", "Wizard.tsx"), "utf8");
const docStep = readFileSync(path.join(root, "src", "components", "trust", "steps", "DocStep.tsx"), "utf8");
const css = readFileSync(path.join(root, "src", "app", "globals.css"), "utf8");

console.log("\n[A] useRef import + 포커스/마운트 ref 정의");
{
  ok(/import\s*\{[^}]*\buseRef\b[^}]*\}\s*from\s*"react"/.test(wiz), "react 에서 useRef import");
  ok(/const\s+headingRef\s*=\s*useRef<HTMLHeadingElement>\(null\)/.test(wiz), "headingRef = useRef<HTMLHeadingElement>(null)");
  ok(/const\s+mountedRef\s*=\s*useRef\(false\)/.test(wiz), "mountedRef = useRef(false)(최초 렌더 스킵용)");
}

console.log("\n[B] form-panel 제목 h2 — ref·tabIndex·className·제목 텍스트");
{
  const h2Idx = wiz.indexOf('className="form-panel-title"');
  ok(h2Idx >= 0, 'h2 className="form-panel-title" 존재');
  const seg = h2Idx >= 0 ? wiz.slice(h2Idx - 120, h2Idx + 200) : "";
  ok(/<h2/.test(seg), "form-panel-title 는 h2 요소");
  ok(/ref=\{headingRef\}/.test(seg), "h2 ref={headingRef} 연결");
  ok(/tabIndex=\{-1\}/.test(seg), "h2 tabIndex={-1}(탭 순서 제외·프로그램적 포커스만)");
  ok(/\{current\.title\}/.test(seg), "제목 텍스트 {current.title} 유지(무회귀)");
}

console.log("\n[C] step 변화 useEffect — 최초 렌더 스킵 후 포커스, 의존성 [step]");
{
  // useEffect 블록을 격리(헤딩 포커스 effect): mountedRef 가드 → headingRef.focus → [step]
  const m = wiz.match(/useEffect\(\(\)\s*=>\s*\{[\s\S]*?mountedRef\.current[\s\S]*?headingRef\.current\?\.focus\(\)[\s\S]*?\},\s*\[step\]\)/);
  ok(!!m, "useEffect(()=>{… mountedRef … headingRef.focus() …},[step]) 존재");
  const blk = m ? m[0] : "";
  // 최초 렌더 스킵 가드: !mountedRef.current 면 true 로 세팅하고 return(포커스 안 함)
  ok(/if\s*\(!mountedRef\.current\)\s*\{[\s\S]*?mountedRef\.current\s*=\s*true;[\s\S]*?return;[\s\S]*?\}/.test(blk),
    "최초 렌더 스킵(!mountedRef → true 세팅 후 return)");
  // 스킵 가드가 focus 호출보다 앞(가드 통과 후에만 포커스)
  const guardAt = blk.indexOf("return;");
  const focusAt = blk.indexOf("headingRef.current?.focus()");
  ok(guardAt >= 0 && focusAt > guardAt, "스킵 가드(return)가 focus 호출보다 앞");
  // 의존성 배열이 정확히 [step]
  ok(/\},\s*\[step\]\)\s*;/.test(blk + ";") || /\},\s*\[step\]\)/.test(blk), "의존성 배열 = [step]");
}

console.log("\n[D] CSS — 제목 포커스 아웃라인 억제(시각 무변경)");
{
  ok(/\.form-panel-title:focus\s*\{[^}]*outline:\s*none[^}]*\}/.test(css),
    ".form-panel-title:focus { outline: none } 규칙 존재");
}

console.log("\n[E] 무회귀 — 단계 이동·내용·점프 배선 보존");
{
  // goStep 은 setStep + setTab 둘 다 (모든 이동 경로의 단일 출처).
  // (fieldId? 인자 추가 — "남은 필수 입력" 요약 점프가 입력 필드까지 포커스. setStep+setTab
  //  단일 출처는 보존. 상세 불변식은 verify-docstep-validate-focus.mjs.)
  ok(/function goStep\(idx: number(?:, fieldId\?: string)?\)\s*\{[\s\S]*?setStep\(idx\);[\s\S]*?setTab\(s\.tab\);[\s\S]*?\}/.test(wiz),
    "goStep = setStep(idx) + setTab(s.tab) 보존");
  ok(/onClick=\{\(\) => goStep\(s\.idx\)\}/.test(wiz), "pill/stepper goStep 배선 보존");
  ok(/<StepContent stepKey=\{current\.key\} docId=\{current\.docId\} \/>/.test(wiz), "StepContent 렌더 보존");
  ok(/className="pagenav"/.test(wiz), "이전/다음 pagenav 보존");
  // DocStep 의 누락항목 점프(goToStep)도 store step 을 갱신 → 같은 effect 가 포커스 이동 처리.
  // (fieldId? 인자 추가 — 단계 점프 후 그 입력 필드까지 포커스. setStep+setTab 단일 출처는 보존.
  //  상세 불변식은 verify-docstep-validate-focus.mjs.)
  ok(/function goToStep\(idx: number(?:, fieldId\?: string)?\)\s*\{[\s\S]*?setStep\(s\.idx\);[\s\S]*?setTab\(s\.tab\);[\s\S]*?\}/.test(docStep),
    "DocStep goToStep = setStep + setTab 보존(같은 step 갱신 → 포커스 이동 공유)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
process.exit(fail === 0 ? 0 : 1);
