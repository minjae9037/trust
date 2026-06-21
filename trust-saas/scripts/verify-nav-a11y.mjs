/* ============================================================
   회귀 가드 — 위저드 pagenav 접근명 + breadcrumb 장식 구분자 SR 숨김

   배경(접근성 결함, 비-산출물): 15:08~16:00 a11y thread 가 위저드 입력
   라벨↔컨트롤·인라인 오류 상태를 "완전 마감"했다고 선언했으나, 실제로는
   ①위저드 pagenav 이전/다음 버튼이 아이콘 글리프(‹ ›)만 담은 <button>
   으로 접근명이 전무(스크린리더가 "‹"/"›" 문장부호로만 읽음, WCAG 4.1.2
   Name·Role·Value 위반)였고, ②breadcrumb 의 장식용 구분자(›··)가
   aria-hidden 없이 노출돼 crumb 사이마다 "›"/"·" 문장부호가 읽히던
   결함(WCAG 1.3.1)이 남아 있었다. 위저드 주 네비게이션(매 step 전환마다
   사용)의 가장 흔한 a11y 갭을 순수 가산(속성만) 으로 마감.

   수정 패턴(전부 가산·외관 무변):
     · 아이콘 전용 버튼(nav-circle): aria-label="이전/다음 단계" + title,
       글리프는 <span aria-hidden="true"> 로 SR 중복 차단
     · 장식 구분자(span.sep): aria-hidden="true" 로 SR 미announce

   ★범위: 산출물(DOCX/PDF)·조문·엔진·검증 게이트·데이터 모델 전부 무접촉
     — 네비게이션 마크업에 접근성 속성만 가산. onClick/goStep 경로 무변경.
     (crumb 자체의 <span onClick>→<button> 키보드 접근 전환은 stepper 와
      동일 시각·레이아웃 위험 클래스라 별도 iteration 으로 분리.)

   실행:
     cd trust-saas
     node scripts/verify-nav-a11y.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");
const wizard = read("src/components/trust/Wizard.tsx");
const trustApp = read("src/components/trust/TrustApp.tsx");
const advisorApp = read("src/components/advisor/AdvisorApp.tsx");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

console.log("=== 위저드 pagenav 접근명 + breadcrumb 구분자 SR 숨김 검증 ===\n");

// ──────────────────────────────────────────────
// (A) 위저드 pagenav 이전/다음 버튼 — 아이콘 전용 <button> 접근명
// ──────────────────────────────────────────────
console.log("[위저드 pagenav 접근명]");
// 각 nav-circle 버튼 블록을 추출해 aria-label 동반 여부 검사
const navCircleBlocks = wizard.match(/<button\s+className="nav-circle"[\s\S]*?<\/button>/g) || [];
ok(navCircleBlocks.length === 2, `(A0) nav-circle 버튼 2개 존재 (실제 ${navCircleBlocks.length})`);
ok(
  navCircleBlocks.every((b) => /aria-label="[^"]+"/.test(b)),
  "(A1) ★모든 nav-circle 버튼에 aria-label (아이콘 전용 무명 버튼 0)",
);
ok(
  /aria-label="이전 단계"/.test(wizard) && /aria-label="다음 단계"/.test(wizard),
  "(A2) 이전 단계 / 다음 단계 접근명 명시",
);
// 글리프(‹ ›)는 aria-hidden span 으로 감싸 SR 중복(접근명+글리프) 차단
ok(
  /<span aria-hidden="true">‹<\/span>/.test(wizard) &&
    /<span aria-hidden="true">›<\/span>/.test(wizard),
  "(A3) 글리프 ‹ › 를 aria-hidden span 으로 감쌈(SR 중복 차단)",
);

// ──────────────────────────────────────────────
// (B) breadcrumb 장식 구분자(span.sep) — aria-hidden 으로 SR 미announce
// ──────────────────────────────────────────────
console.log("\n[breadcrumb 장식 구분자 SR 숨김]");
const sepSpans = (src) => src.match(/<span className="sep"[^>]*>/g) || [];
const orphanSep = (src) => sepSpans(src).filter((s) => !/aria-hidden="true"/.test(s));

for (const [name, src] of [
  ["TrustApp", trustApp],
  ["AdvisorApp", advisorApp],
]) {
  const total = sepSpans(src).length;
  const orphans = orphanSep(src).length;
  ok(total > 0, `(B) ${name} span.sep 존재 (${total}개)`);
  ok(
    orphans === 0,
    `(B) ★${name} aria-hidden 없는 구분자 0 (실제 ${orphans}/${total})`,
  );
}

// ──────────────────────────────────────────────
// (C) 무회귀 — 네비게이션 동작(onClick/goStep) 경로 보존(시맨틱만 가산)
// ──────────────────────────────────────────────
console.log("\n[무회귀: 네비게이션 동작 경로 보존]");
ok(
  /onClick=\{\(\) => goStep\(step - 1\)\}/.test(wizard) &&
    /onClick=\{\(\) => goStep\(step \+ 1\)\}/.test(wizard),
  "(C1) pagenav 이전/다음 goStep onClick 경로 보존",
);
ok(
  /disabled=\{step <= 1\}/.test(wizard) && /disabled=\{step >= totalSteps\}/.test(wizard),
  "(C2) pagenav disabled(경계 step) 가드 보존",
);

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
