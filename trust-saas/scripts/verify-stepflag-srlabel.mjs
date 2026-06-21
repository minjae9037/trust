/* ============================================================
   회귀 가드 — 위저드 readiness 마커(✓/⚠) 스크린리더 라벨

   배경(a11y·WCAG 1.3.1 Info and Relationships, 비-산출물·표시 전용):
   위저드의 서류 생성 준비도 마커(✓ 생성 가능 / ⚠ 필수 입력 누락)는 sub-step
   pill 과 stepper(진행단계) 두 곳에서 ① 글리프(✓/⚠) ② 색(.ok 초록/.warn 빨강)
   으로만 의미를 전달한다 — 색은 순수 시각 신호이고, 글리프는 SR 이 모호하게
   ("check mark" 등) 낭독한다. 종전 구현은 글리프를 담은 <span> 에 aria-label 을
   걸었으나, generic role(<span>) 의 aria-label 은 스크린리더가 신뢰성 있게 읽지
   않는다(ARIA in HTML — aria-label 은 유효 role 이 없는 요소에서 무효/불안정).
   해결: 글리프 span 은 aria-hidden="true"(장식)로 두고, 동일 의미 문구를 별도
   `.sr-only` 텍스트로 분리해 버튼 접근명에 확실히 포함시킨다(시각 UI 무변경).

   ★02:35 상담 턴 라벨(verify-advisor-turnlabels)이 신설한 `.sr-only` 유틸을
   위저드 상태 아이콘에 재사용 — 다음스텝 후보로 명시됐던 갭 마감.

   핵심 불변식:
     (A) `.sr-only` 시각적 숨김 유틸 CSS 존재(clip·position absolute·1px).
     (B) sub-step pill 마커: 글리프 span 이 aria-hidden, aria-label 미사용,
         동일 의미 .sr-only 텍스트("생성 가능"/"필수 입력 누락") 동반.
     (C) stepper 마커: 동일(글리프 aria-hidden + .sr-only 의미 텍스트).
     (D) 두 마커 모두 색(.ok/.warn) 클래스 보존(시각 신호 무회귀)·글리프 보존.
     (E) ★글리프 span 에 aria-label 잔존 0(불안정 메커니즘 완전 제거).
     (F) 무회귀 — docReady 분기·readiness title·goStep 배선 보존.

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-stepflag-srlabel.mjs
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
const css = readFileSync(path.join(root, "src", "app", "globals.css"), "utf8");

// 두 마커 블록을 className 마커로 격리해 위치 기반 단언에 사용.
const subIdx = wiz.indexOf('"sub-step-flag "');
const subSeg = subIdx >= 0 ? wiz.slice(subIdx - 40, subIdx + 340) : "";
const stepIdx = wiz.indexOf('"stepper-flag "');
const stepSeg = stepIdx >= 0 ? wiz.slice(stepIdx - 40, stepIdx + 340) : "";

console.log("\n[A] .sr-only 시각적 숨김 유틸 CSS");
{
  const m = css.match(/\.sr-only\s*\{([^}]*)\}/);
  ok(!!m, ".sr-only 정의 존재");
  const decl = m ? m[1] : "";
  ok(/clip:\s*rect\(/.test(decl), ".sr-only clip: rect(...)(시각적 클립)");
  ok(/overflow:\s*hidden/.test(decl), ".sr-only overflow: hidden");
  ok(/position:\s*absolute/.test(decl), ".sr-only position: absolute(레이아웃 무영향)");
  ok(/width:\s*1px/.test(decl), ".sr-only width: 1px");
}

console.log("\n[B] sub-step pill 마커 — 글리프 aria-hidden + .sr-only 의미 텍스트");
{
  ok(subIdx >= 0, "sub-step-flag 마커 블록 존재");
  ok(/className=\{"sub-step-flag " \+ \(ready \? "ok" : "warn"\)\}/.test(subSeg), "sub-step-flag 색 클래스(ok/warn) 보존");
  ok(/aria-hidden="true"/.test(subSeg), "글리프 span aria-hidden=\"true\"(장식 처리)");
  ok(/\{ready \? "✓" : "⚠"\}/.test(subSeg), "글리프(✓/⚠) 보존");
  ok(/<span className="sr-only">\{ready \? " 생성 가능" : " 필수 입력 누락"\}<\/span>/.test(subSeg),
    ".sr-only 의미 텍스트(생성 가능/필수 입력 누락) 동반");
  // .sr-only 텍스트가 글리프 '뒤'(접근명에 라벨로 이어짐)
  const glyphAt = subSeg.indexOf('"✓" : "⚠"');
  const srAt = subSeg.indexOf('className="sr-only"');
  ok(glyphAt >= 0 && srAt > glyphAt, ".sr-only 라벨이 글리프 뒤 위치(접근명 연결)");
}

console.log("\n[C] stepper 마커 — 동일 패턴");
{
  ok(stepIdx >= 0, "stepper-flag 마커 블록 존재");
  ok(/className=\{"stepper-flag " \+ \(ready \? "ok" : "warn"\)\}/.test(stepSeg), "stepper-flag 색 클래스(ok/warn) 보존");
  ok(/aria-hidden="true"/.test(stepSeg), "글리프 span aria-hidden=\"true\"(장식 처리)");
  ok(/\{ready \? "✓" : "⚠"\}/.test(stepSeg), "글리프(✓/⚠) 보존");
  ok(/<span className="sr-only">\{ready \? " 생성 가능" : " 필수 입력 누락"\}<\/span>/.test(stepSeg),
    ".sr-only 의미 텍스트 동반");
}

console.log("\n[D] 색 클래스(.ok/.warn) CSS 보존 — 시각 신호 무회귀");
{
  ok(/\.sub-step-flag\.ok\b/.test(css), ".sub-step-flag.ok 색 규칙 보존");
  ok(/\.sub-step-flag\.warn\b/.test(css), ".sub-step-flag.warn 색 규칙 보존");
  ok(/\.stepper-flag\.ok\b/.test(css), ".stepper-flag.ok 색 규칙 보존");
  ok(/\.stepper-flag\.warn\b/.test(css), ".stepper-flag.warn 색 규칙 보존");
}

console.log("\n[E] ★불안정 메커니즘 제거 — 글리프 span aria-label 잔존 0");
{
  // 종전 결함: <span ...flag... aria-label={ready ? "생성 가능"...}> 가 generic role 에서
  // 불안정하게 낭독됨. 두 flag span 어디에도 aria-label 이 남지 않아야 한다.
  const flagAriaLabel = /(sub-step-flag|stepper-flag)[\s\S]{0,80}?aria-label=/.test(wiz);
  ok(!flagAriaLabel, "flag span 에 aria-label 잔존 0(불안정 메커니즘 완전 제거)");
  // .sr-only 라벨은 정확히 2곳(sub-step + stepper)에서만
  const srLabels = (wiz.match(/<span className="sr-only">\{ready \? " 생성 가능" : " 필수 입력 누락"\}<\/span>/g) || []).length;
  ok(srLabels === 2, ".sr-only readiness 라벨이 정확히 2곳(pill+stepper)");
}

console.log("\n[F] 무회귀 — readiness 배선 보존");
{
  ok(/const ready = s\.docId \? docReady\[s\.idx\] : undefined/.test(wiz), "docReady 분기(ready) 보존");
  ok(/필수 입력 충족 — 생성 가능/.test(wiz), "title 안내(생성 가능) 보존");
  ok(/필수 입력 누락 — 입력 후 생성 가능/.test(wiz), "title 안내(누락) 보존");
  ok(/onClick=\{\(\) => goStep\(s\.idx\)\}/.test(wiz), "마커 버튼 goStep 배선 보존");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
process.exit(fail === 0 ? 0 : 1);
