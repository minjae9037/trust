/* ============================================================
   회귀 가드 — 진행단계(stepper) 사이드바 키보드/스크린리더 접근성 계약

   배경(접근성 결함, 비-산출물): Wizard.tsx 좌측 `진행 단계` 사이드바 항목은
   `<div onClick>` 으로 렌더돼 ①키보드(Tab/Enter/Space)로 접근·활성화 불가
   ②스크린리더가 상호작용 요소로 인식 못함 ③포커스 표시 없음 의 결함이 있었다.
   같은 위저드의 다른 네비게이션(탭·서브스텝 pill)은 모두 네이티브 `<button>` 인데
   stepper 만 div 라 일관성도 깨졌다(B2B 법률서류 SaaS = 웹접근성 요구).

   수정: stepper 항목을 `<button type="button">` 로 교체(네이티브 키보드 처리
   Enter/Space 자동, aria-current="step" 로 현재 단계 표기) + globals.css 에
   <button> 리셋(전폭·좌측정렬·무배경·무테두리·폰트 상속)으로 기존 외관 유지 +
   :focus-visible 아웃라인 추가.

   본 가드는 그 접근성 계약을 정적으로 단언해 div 회귀를 막는다.
     (A) stepper 항목 = 네이티브 <button type="button"> (div onClick 아님)
     (B) aria-current="step" 로 현재 단계 표기
     (C) globals.css .stepper-item 에 <button> 리셋 + :focus-visible 아웃라인
     (D) 일관성 앵커 — 탭·서브스텝 네비도 <button> (stepper 와 동일 패턴)

   실행:
     cd trust-saas
     node scripts/verify-stepper-a11y.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const wizard = readFileSync(join(root, "src/components/trust/Wizard.tsx"), "utf8");
const css = readFileSync(join(root, "src/app/globals.css"), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

// stepper 항목 렌더 블록(STEPS.map 내부 stepper-item) 추출 — 단언을 그 범위로 한정.
const stepperBlock = (() => {
  const start = wizard.indexOf('className="stepper"');
  const end = wizard.indexOf("</aside>", start);
  return start >= 0 && end >= 0 ? wizard.slice(start, end) : "";
})();
ok(stepperBlock.length > 0, "stepper <aside> 블록 추출 성공");

console.log("\n[A] stepper 항목 = 네이티브 <button> (div onClick 회귀 차단)");
// stepper-item 을 가진 엘리먼트가 button 으로 열린다(키보드 접근 가능).
ok(/<button\b[^>]*className=\{?["']?stepper-item/.test(stepperBlock) ||
   /<button[\s\S]{0,200}?className=\{[^}]*stepper-item/.test(stepperBlock),
   "stepper-item 엘리먼트가 <button> 으로 렌더");
ok(/type="button"/.test(stepperBlock), 'stepper <button> 에 type="button"(폼 submit 방지)');
// ★회귀 차단: stepper-item 을 가진 <div onClick> 이 남아있지 않음.
ok(!/<div\b[^>]*className=\{[^}]*stepper-item[\s\S]{0,160}?onClick/.test(stepperBlock),
   "stepper-item 을 가진 <div onClick> 잔존 없음(div→button 회귀 차단)");
// onClick=goStep 이 button 으로 보존(활성화 동작 유지).
ok(/onClick=\{\(\)\s*=>\s*goStep\(s\.idx\)\}/.test(stepperBlock),
   "stepper 항목 클릭 시 goStep(s.idx) 보존");

console.log("\n[B] 현재 단계 표기 — aria-current=\"step\"");
ok(/aria-current=\{s\.idx === step \? "step" : undefined\}/.test(stepperBlock),
   "활성 stepper 항목에 aria-current=\"step\"");

console.log("\n[C] globals.css .stepper-item <button> 리셋 + :focus-visible 아웃라인");
// .stepper-item 규칙 블록 추출.
const itemRule = (() => {
  const m = css.match(/\.stepper-item\s*\{[\s\S]*?\}/);
  return m ? m[0] : "";
})();
ok(itemRule.length > 0, ".stepper-item 규칙 존재");
ok(/background:\s*none/.test(itemRule), ".stepper-item background:none(버튼 기본 배경 제거)");
ok(/border:\s*none/.test(itemRule), ".stepper-item border:none(버튼 기본 테두리 제거)");
ok(/width:\s*100%/.test(itemRule), ".stepper-item width:100%(전폭 — div 외관 유지)");
ok(/text-align:\s*left/.test(itemRule), ".stepper-item text-align:left(좌측정렬 — div 외관 유지)");
ok(/font-family:\s*inherit/.test(itemRule), ".stepper-item font-family:inherit(폰트 상속)");
ok(/\.stepper-item:focus-visible\s*\{[\s\S]*?outline:/.test(css),
   ".stepper-item:focus-visible 아웃라인(키보드 포커스 표시)");

console.log("\n[D] 일관성 앵커 — 탭·서브스텝 네비도 <button>(stepper 와 동일 패턴)");
ok(/<button[\s\S]{0,120}?className=\{"tab"/.test(wizard), "탭이 <button>");
ok(/<button[\s\S]{0,160}?className=\{"sub-step"/.test(wizard), "서브스텝 pill 이 <button>");

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
