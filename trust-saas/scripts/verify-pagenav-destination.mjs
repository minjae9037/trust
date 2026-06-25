/* ============================================================
   회귀 가드 — 서류 위저드 하단 이전/다음 단계 목적지 안내(pagenav destination)

   배경(표시·내비 wayfinding, 비-산출물):
   담보신탁 위저드(CollateralWizard)의 하단 pagenav 는 ‹/› 글리프 + "이전 단계"/
   "다음 단계" 일반 라벨뿐이라, 누르기 전엔 어느 단계로 가는지 알 수 없었다(전체
   13단계·서류 7종 흐름에서 방향 상실). 상단 stepper/sub-step pill 은 모든 단계를
   한눈에 보이나, 가장 자주 쓰는 순차 이동(‹/›)은 목적지 신호가 0이었다.

   해결: 인접 단계(prevStep/nextStep = STEPS idx step∓1)를 찾아
     ① 버튼 아래 시각 캡션으로 목적지 단계 라벨(STEP 02·Doc 01)을 보이고(aria-hidden
        =장식, 의미는 aria-label 이 전담 → 중복 낭독 0),
     ② aria-label·title 로 목적지 전체 이름("다음 단계: STEP 02 우선수익자")을 SR·
        툴팁에 고지한다(WCAG 2.4.x 예측 가능 내비).
   경계(첫 단계 step≤1 = prevStep 없음 / 마지막 step≥13 = nextStep 없음)에선 캡션
   없이 일반 라벨("이전 단계"/"다음 단계")을 유지한다(死캡션 0).

   ★표시·내비 전용 — 조문/엔진/검증 판정(validateDoc)/산출물(docx) 무접촉. prevStep/
     nextStep 은 기존 STEPS·step 파생일 뿐 새 상태/모델 없음. 새 CSS 클래스 0(기존
     nav-circle·field-hint + 인라인 style). goStep(step∓1) 이동 동작은 무변경.

   핵심 불변식:
     (A) prevStep/nextStep 인접 단계 파생(STEPS idx step∓1).
     (B) 이전 버튼 aria-label·title = 목적지 있으면 "이전 단계: {label} {title}",
         없으면 "이전 단계"(경계). 다음 버튼 동형.
     (C) 시각 캡션 = prevStep/nextStep 있을 때만·aria-hidden·field-hint.
     (D) 무회귀 — ‹/› 글리프·goStep(step∓1)·disabled 경계(step≤1 / step≥totalSteps)·
         중앙 nav-label({step}/{totalSteps}+nav-name) 보존.
     (E) STEPS 가 idx 1..N 연속(step∓1 = 실제 인접 단계라는 전제) + label/title 보유.
     (F) 무접촉 — Wizard 에 validate import 없음, 새 CSS 클래스(.pagenav-*) 미도입.

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-pagenav-destination.mjs
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
const { STEPS } = await import("../src/lib/engine/schema.ts");

// 하단 pagenav 블록 격리(검증을 그 블록 안으로 한정해 오탐 방지)
const pgAt = wiz.indexOf('<div className="pagenav">');
const pgEnd = pgAt >= 0 ? wiz.indexOf("</div>\n        </section>", pgAt) : -1;
const pagenav = pgAt >= 0 ? wiz.slice(pgAt, pgEnd >= 0 ? pgEnd : pgAt + 2000) : "";

console.log("\n[A] prevStep/nextStep 인접 단계 파생(STEPS idx step∓1)");
{
  ok(/const prevStep = STEPS\.find\(\(s\) => s\.idx === step - 1\);/.test(wiz),
    "prevStep = STEPS.find(idx === step - 1)");
  ok(/const nextStep = STEPS\.find\(\(s\) => s\.idx === step \+ 1\);/.test(wiz),
    "nextStep = STEPS.find(idx === step + 1)");
}

console.log("\n[B] 이전/다음 버튼 aria-label·title = 목적지 안내(경계 폴백 포함)");
{
  ok(/aria-label=\{prevStep \? `이전 단계: \$\{prevStep\.label\} \$\{prevStep\.title\}` : "이전 단계"\}/.test(pagenav),
    '이전 버튼 aria-label = "이전 단계: {label} {title}" (없으면 "이전 단계")');
  ok(/title=\{prevStep \? `이전 단계: \$\{prevStep\.label\} \$\{prevStep\.title\}` : "이전 단계"\}/.test(pagenav),
    "이전 버튼 title 동일 목적지 안내");
  ok(/aria-label=\{nextStep \? `다음 단계: \$\{nextStep\.label\} \$\{nextStep\.title\}` : "다음 단계"\}/.test(pagenav),
    '다음 버튼 aria-label = "다음 단계: {label} {title}" (없으면 "다음 단계")');
  ok(/title=\{nextStep \? `다음 단계: \$\{nextStep\.label\} \$\{nextStep\.title\}` : "다음 단계"\}/.test(pagenav),
    "다음 버튼 title 동일 목적지 안내");
}

console.log("\n[C] 시각 캡션 = 목적지 있을 때만·aria-hidden·field-hint(장식·중복 낭독 0)");
{
  ok(/\{prevStep && \(\s*<span className="field-hint" aria-hidden="true"[^>]*>\s*\{prevStep\.label\}/.test(pagenav),
    "이전 캡션: prevStep 있을 때만·field-hint·aria-hidden·{prevStep.label}");
  ok(/\{nextStep && \(\s*<span className="field-hint" aria-hidden="true"[^>]*>\s*\{nextStep\.label\}/.test(pagenav),
    "다음 캡션: nextStep 있을 때만·field-hint·aria-hidden·{nextStep.label}");
  // 캡션이 aria-hidden 이라 SR 은 목적지를 aria-label 로만 듣는다(이중 낭독 없음)
  const caps = pagenav.match(/aria-hidden="true"[^>]*>\s*\{(prev|next)Step\.label\}/g) || [];
  ok(caps.length === 2, "목적지 캡션 정확히 2개(prev·next)·둘 다 aria-hidden");
}

console.log("\n[D] 무회귀 — 글리프·이동 동작·경계 disabled·중앙 라벨 보존");
{
  ok(/<span aria-hidden="true">‹<\/span>/.test(pagenav), "이전 ‹ 글리프 보존(aria-hidden)");
  ok(/<span aria-hidden="true">›<\/span>/.test(pagenav), "다음 › 글리프 보존(aria-hidden)");
  ok(/onClick=\{\(\) => goStep\(step - 1\)\}/.test(pagenav), "이전 = goStep(step - 1) 무변경");
  ok(/onClick=\{\(\) => goStep\(step \+ 1\)\}/.test(pagenav), "다음 = goStep(step + 1) 무변경");
  ok(/disabled=\{step <= 1\}/.test(pagenav), "이전 disabled={step <= 1}(첫 단계 경계)");
  ok(/disabled=\{step >= totalSteps\}/.test(pagenav), "다음 disabled={step >= totalSteps}(마지막 경계)");
  ok(/<div className="nav-label">/.test(pagenav), "중앙 nav-label 보존");
  ok(/<strong>\{step\}<\/strong> \/ \{totalSteps\}/.test(pagenav), "중앙 {step} / {totalSteps} 보존");
  ok(/<span className="nav-name">\{current\.title\}<\/span>/.test(pagenav), "중앙 nav-name(현재 단계 제목) 보존");
  // 버튼은 여전히 정확히 2개(이전·다음) — 캡션 추가가 버튼을 늘리지 않음
  ok((pagenav.match(/className="nav-circle"/g) || []).length === 2, "nav-circle 버튼 정확히 2개");
}

console.log("\n[E] STEPS 전제 — idx 1..N 연속·label/title 보유(step∓1 = 실제 인접 단계)");
{
  const idxs = STEPS.map((s) => s.idx);
  const sorted = [...idxs].sort((a, b) => a - b);
  let contiguous = sorted.length > 0 && sorted[0] === 1;
  for (let i = 1; i < sorted.length; i++) if (sorted[i] !== sorted[i - 1] + 1) contiguous = false;
  ok(contiguous, `STEPS idx 가 1..${sorted[sorted.length - 1]} 연속(인접 = step∓1)`);
  ok(STEPS.every((s) => typeof s.label === "string" && s.label.length > 0), "모든 STEP 이 label 보유");
  ok(STEPS.every((s) => typeof s.title === "string" && s.title.length > 0), "모든 STEP 이 title 보유");
  // 대표 인접쌍 동작 검증(가드가 산식과 실제 데이터를 함께 잠금)
  const s5 = STEPS.find((s) => s.idx === 5);
  const s4 = STEPS.find((s) => s.idx === 4);
  const s6 = STEPS.find((s) => s.idx === 6);
  ok(s5 && s4 && s6 && s4.idx === s5.idx - 1 && s6.idx === s5.idx + 1,
    "step=5 의 prev=STEP idx4·next=STEP idx6 (목적지 산식 정합)");
}

console.log("\n[F] 무접촉 — Wizard validate import 무관·새 CSS 클래스 미도입");
{
  // pagenav 변경은 표시·내비 전용 — 검증 판정/산출물 빌더에 손대지 않음.
  // (Wizard 는 validateDoc 을 docReady 집계에 이미 쓰므로 import 자체는 정상 —
  //  pagenav 블록 안에 validate/generate 호출이 새로 끼어들지 않았는지만 확인)
  ok(!/validateDoc\(/.test(pagenav), "pagenav 블록에 validateDoc 호출 없음(검증 판정 무접촉)");
  ok(!/generateCollateral|previewDocHTML/.test(pagenav), "pagenav 블록에 산출물/미리보기 빌더 호출 없음");
  ok(!/\.pagenav-/.test(css), "새 CSS 클래스(.pagenav-*) 미도입(기존 nav-circle/field-hint 재사용)");
  ok(!/\.nav-dest/.test(css), "새 캡션 전용 CSS 클래스(.nav-dest) 미도입(인라인 style 사용)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
process.exit(fail === 0 ? 0 : 1);
