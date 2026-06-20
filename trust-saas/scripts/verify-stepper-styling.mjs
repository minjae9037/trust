/* ============================================================
   회귀 가드 — 진행단계(stepper) 사이드바 스타일 계약

   배경: Wizard.tsx 는 좌측 사이드바 항목에 .stepper-item / .stepper-num
   클래스를 쓰는데, globals.css 에는 죽은 .step / .step-num 만 정의돼 있어
   무스타일로 렌더됐다(클래스명 drift 버그). 정의명을 실제 사용명으로
   맞추고, sub-step pill 과 동일한 readiness 배지(.stepper-flag ok/warn)를
   추가했다.

   본 가드는 그 "JSX가 쓰는 클래스 = CSS가 정의한 클래스" 계약을 정적으로
   단언해 동일 유형의 drift 재발을 막는다.
     (A) Wizard.tsx 가 참조하는 stepper 클래스 전부 globals.css 에 정의 존재
     (B) 죽은 .step / .step-num 선택자가 남아있지 않음(정의명 정리 확인)
     (C) readiness 배지(.stepper-flag.ok/.warn) 정의 존재 — sub-step 과 대응

   실행:
     cd trust-saas
     node scripts/verify-stepper-styling.mjs
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
// CSS 에 ".name" 선택자 정의가 있는지(단어경계로 .step 과 .stepper 구분)
const cssDefines = (name) => new RegExp("\\." + name + "(?![\\w-])").test(css);

console.log("\n[A] Wizard.tsx stepper 클래스 → globals.css 정의 존재");
for (const cls of ["stepper", "stepper-title", "stepper-item", "stepper-num", "stepper-flag"]) {
  ok(wizard.includes('"' + cls) || wizard.includes(cls + " ") , `Wizard.tsx 가 .${cls} 사용`);
  ok(cssDefines(cls), `globals.css 에 .${cls} 정의`);
}

console.log("\n[B] 죽은 .step / .step-num 선택자 정리(stepper-item/num 으로 대체)");
ok(!/\.step(?![\w-])/.test(css), ".step 선택자 잔존 없음");
ok(!/\.step-num(?![\w-])/.test(css), ".step-num 선택자 잔존 없음");

console.log("\n[C] readiness 배지(.stepper-flag.ok/.warn) 정의 — sub-step 과 대응");
ok(/\.stepper-flag\.ok/.test(css), ".stepper-flag.ok 정의");
ok(/\.stepper-flag\.warn/.test(css), ".stepper-flag.warn 정의");
ok(/\.sub-step-flag\.ok/.test(css), "(대조) .sub-step-flag.ok 정의 유지");

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
