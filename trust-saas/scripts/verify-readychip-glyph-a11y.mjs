/* ============================================================
   회귀 가드 — 준비도 칩/요약 글리프(✓/⚠) aria-hidden 일관화

   배경(a11y·WCAG 1.3.1 Info and Relationships, 비-산출물·표시 전용):
   서류 생성 준비도 마커(✓ 생성 가능 / ⚠ 필수 입력 누락)는 위저드 stepper·
   sub-step pill 두 곳에서는 이미 글리프 span 을 aria-hidden="true"(장식)로
   두고 의미는 가시/`.sr-only` 텍스트로 전달하도록 정리됐다(verify-stepflag-srlabel).
   그러나 ① ContractsView 카드의 준비도 칩(담보신탁 "서류 N/N 생성 가능" / joint
   "협약서 생성 가능") ② Wizard 헤더 doc-progress 요약(✓ 서류 N/N 생성 가능 /
   ⚠ N종 입력 필요)은 글리프(✓/⚠)가 **가시 텍스트 노드에 그대로 박혀** SR 이
   의미 텍스트 앞에 모호한 "check mark"/"warning sign" 을 먼저 낭독하던 잔여 갭.

   해결: 글리프를 `<span aria-hidden="true">` 로 감싸 장식 처리한다. 이들 칩/요약은
   ★가시 텍스트 자체가 이미 상태를 전달("서류 5/7 생성 가능"·"협약서 생성 가능"·
   "필수 입력 누락"·"N종 입력 필요")하므로 stepper 와 달리 별도 `.sr-only` 텍스트가
   불필요하다(글리프는 순수 시각 중복). 색 클래스·title·문구·배선 전부 보존
   (시각 UI 무변경·CSS 신규 0).

   핵심 불변식:
     (A) ContractsView 담보신탁 칩: 글리프(✓/⚠) aria-hidden span·가시 비율 텍스트
         보존·ready-chip 색 클래스(ok/warn) 보존.
     (B) ContractsView joint 칩: 글리프 aria-hidden span·가시 상태 텍스트(협약서
         생성 가능/필수 입력 누락) 보존.
     (C) Wizard 헤더 요약 카운트: ✓ 글리프 aria-hidden span(전종 충족 시만)·
         "서류 N/N 생성 가능" 텍스트 보존.
     (D) Wizard 헤더 점프 버튼: ⚠ 글리프 aria-hidden span·"N종 입력 필요" 텍스트 보존.
     (E) ★맨몸 글리프 잔존 0 — 옛 형태(`{allReady ? "✓" : "⚠"} 서류`·줄머리 `⚠ `)가
         aria-hidden 밖에 남지 않음. doc-progress 그룹 aria-label·미터 aria-hidden 보존.
     (F) 무회귀 — readiness/jointReady 분기·title 안내·goStep/generateAllReady 배선 보존.

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-readychip-glyph-a11y.mjs
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
const cv = readFileSync(path.join(root, "src", "components", "trust", "ContractsView.tsx"), "utf8");
const wiz = readFileSync(path.join(root, "src", "components", "trust", "Wizard.tsx"), "utf8");

console.log("\n[A] ContractsView 담보신탁 준비도 칩 — 글리프 aria-hidden + 가시 텍스트");
{
  // 칩 블록 격리: ready-chip + allReady 분기
  const idx = cv.indexOf('"ready-chip " + (allReady');
  const seg = idx >= 0 ? cv.slice(idx - 40, idx + 700) : "";
  ok(idx >= 0, "담보신탁 ready-chip 블록 존재");
  ok(/className=\{"ready-chip " \+ \(allReady \? "ok" : "warn"\)\}/.test(seg), "ready-chip 색 클래스(ok/warn) 보존");
  ok(/<span aria-hidden="true">\{allReady \? "✓" : "⚠"\}<\/span>/.test(seg), "글리프(✓/⚠) aria-hidden span 으로 감쌈");
  ok(/서류 \{readiness\.ready\}\/\{readiness\.total\} 생성 가능/.test(seg), "가시 비율 텍스트(서류 N/N 생성 가능) 보존");
}

console.log("\n[B] ContractsView joint 준비도 칩 — 글리프 aria-hidden + 가시 텍스트");
{
  const idx = cv.indexOf('"ready-chip " + (jointReady');
  const seg = idx >= 0 ? cv.slice(idx - 40, idx + 700) : "";
  ok(idx >= 0, "joint ready-chip 블록 존재");
  ok(/className=\{"ready-chip " \+ \(jointReady \? "ok" : "warn"\)\}/.test(seg), "joint ready-chip 색 클래스(ok/warn) 보존");
  ok(/<span aria-hidden="true">\{jointReady \? "✓" : "⚠"\}<\/span>/.test(seg), "글리프(✓/⚠) aria-hidden span 으로 감쌈");
  ok(/\{jointReady \? "협약서 생성 가능" : "필수 입력 누락"\}/.test(seg), "가시 상태 텍스트(협약서 생성 가능/필수 입력 누락) 보존");
}

console.log("\n[C] Wizard 헤더 요약 카운트 — ✓ 글리프 aria-hidden + 가시 텍스트");
{
  const idx = wiz.indexOf("doc-progress-count");
  const seg = idx >= 0 ? wiz.slice(idx, idx + 320) : "";
  ok(idx >= 0, "doc-progress-count 블록 존재");
  ok(/readyCount === totalDocs \? <span aria-hidden="true">✓ <\/span> : null/.test(seg),
    "전종 충족 시 ✓ 글리프 aria-hidden span(아니면 null)");
  ok(/서류 <strong>\{readyCount\}\/\{totalDocs\}<\/strong> 생성 가능/.test(seg), "가시 카운트 텍스트(서류 N/N 생성 가능) 보존");
}

console.log("\n[D] Wizard 헤더 점프 버튼 — ⚠ 글리프 aria-hidden + 가시 텍스트");
{
  const idx = wiz.indexOf("doc-progress-jump");
  const seg = idx >= 0 ? wiz.slice(idx, idx + 360) : "";
  ok(idx >= 0, "doc-progress-jump 버튼 존재");
  ok(/<span aria-hidden="true">⚠ <\/span>\{totalDocs - readyCount\}종 입력 필요/.test(seg),
    "⚠ 글리프 aria-hidden span + 가시 텍스트(N종 입력 필요)");
  ok(/\{firstBlocked\.label\}로 이동/.test(seg), "점프 안내 텍스트 보존");
}

console.log("\n[E] ★맨몸 글리프 잔존 0 + 컨테이너 a11y 보존");
{
  // 옛 형태가 남지 않아야 한다: aria-hidden 밖의 준비도 글리프.
  ok(!/\{allReady \? "✓" : "⚠"\} 서류/.test(cv), "옛 담보신탁 칩 맨몸 글리프 잔존 0");
  ok(!/"✓ 협약서 생성 가능" : "⚠ 필수 입력 누락"/.test(cv), "옛 joint 칩 맨몸 글리프 잔존 0");
  ok(!/\{readyCount === totalDocs \? "✓ " : ""\}/.test(wiz), "옛 헤더 카운트 맨몸 ✓ 잔존 0");
  ok(!/^\s*⚠ \{totalDocs - readyCount\}/m.test(wiz), "옛 헤더 점프 줄머리 맨몸 ⚠ 잔존 0");
  // doc-progress 그룹 라벨·미터 장식 처리 보존(요약 맥락 SR 전달)
  ok(/role="group" aria-label=\{`서류 생성 준비 현황:/.test(wiz), "doc-progress 그룹 aria-label 보존");
  ok(/className="doc-progress-meter" aria-hidden="true"/.test(wiz), "진행 미터 aria-hidden 보존(시각 전용)");
}

console.log("\n[F] 무회귀 — 준비도 배선·title·점프 보존");
{
  ok(/필수 입력이 모두 채워져 7종 서류 전부 생성 가능합니다/.test(cv), "담보신탁 칩 title(전종 생성 가능) 보존");
  ok(/필수 입력이 모두 채워져 공동사업표준협약서를 생성할 수 있습니다/.test(cv), "joint 칩 title 보존");
  ok(/onClick=\{\(\) => goStep\(firstBlocked\.idx\)\}/.test(wiz), "헤더 점프 goStep 배선 보존");
  ok(/onClick=\{generateAllReady\}/.test(wiz), "헤더 일괄 생성 배선 보존");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
process.exit(fail === 0 ? 0 : 1);
