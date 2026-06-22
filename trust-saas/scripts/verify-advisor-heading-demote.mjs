/* ============================================================
   회귀 가드 — 상담(advisor·Pillar 2) 답변 본문 마크다운 헤딩 강등 렌더

   배경(a11y·WCAG 1.3.1/2.4.6/2.4.10, 비-산출물·표시 경계만):
   페르소나가 "마크다운(제목/리스트/표/굵게)을 적극 사용"하라 지시하므로 LLM 은
   #/##/### 헤딩을 자주 출력하고 react-markdown 은 이를 h1/h2/h3 로 렌더한다.
   그런데 /advisor 페이지엔 h1 이 전혀 없고(브랜드·breadcrumb 은 헤딩 아님) 빈 상태의
   h2 도 대화가 시작되면 사라지므로, 답변 헤딩이 페이지 헤딩 아웃라인을 '문서 레벨'
   에서 오염시킨다(다중 h1·레벨 건너뜀·답변 귀속 불명). 해결: 모든 답변 헤딩을
   h3 이하로 강등(offset +2, h6 클램프)하되 상대 계층은 보존, 시각 크기/색은 원본
   레벨 클래스(.md-h-N)로 유지(표시 무변경).

   핵심 불변식:
     (A) demotedHeadingLevel/Tag 순수 함수: h1→h3 h2→h4 h3→h5 h4→h6 h5→h6 h6→h6,
         하한 3·상한 6 클램프, 범위 밖 입력 안전, 단조 비감소(상대 계층 보존).
     (B) AdvisorChat 배선: markdown 헬퍼 import + MD_COMPONENTS 가 h1~h6 6키 매핑 +
         ReactMarkdown 에 components={MD_COMPONENTS} 전달(빈 본문 분기엔 미적용).
     (C) CSS: .md-h 베이스 + .md-h-1(19px)·.md-h-2(17px)·.md-h-3(brown) 클래스 규칙 +
         h4~h6 폴백 — 강등 후에도 원본 h1/h2/h3 시각 보존.
     (D) ★아웃라인 오염 차단 — 태그 기반 .md h1/.md h2 규칙 제거(강등 h3 가 옛 .md h3
         15px 로 오인 스타일되지 않음) + 본문에 h1/h2 직접 렌더 잔존 0.
     (E) 무회귀 — remarkGfm 보존·발화자 .sr-only 라벨("상담 답변.") 보존·md 컨테이너.

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-advisor-heading-demote.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { demotedHeadingLevel, demotedHeadingTag } from "../src/lib/advisor/markdown.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const chat = readFileSync(path.join(root, "src", "components", "advisor", "AdvisorChat.tsx"), "utf8");
const css = readFileSync(path.join(root, "src", "app", "globals.css"), "utf8");

console.log("\n[A] 순수 함수 demotedHeadingLevel/Tag — 강등 매핑·클램프·단조성");
{
  ok(demotedHeadingLevel(1) === 3, "h1 → 강등 레벨 3");
  ok(demotedHeadingLevel(2) === 4, "h2 → 강등 레벨 4");
  ok(demotedHeadingLevel(3) === 5, "h3 → 강등 레벨 5");
  ok(demotedHeadingLevel(4) === 6, "h4 → 강등 레벨 6");
  ok(demotedHeadingLevel(5) === 6, "h5 → 강등 레벨 6(클램프)");
  ok(demotedHeadingLevel(6) === 6, "h6 → 강등 레벨 6(클램프)");
  ok(demotedHeadingTag(1) === "h3", "demotedHeadingTag(1) === 'h3'");
  ok(demotedHeadingTag(2) === "h4", "demotedHeadingTag(2) === 'h4'");
  ok(demotedHeadingTag(3) === "h5", "demotedHeadingTag(3) === 'h5'");
  ok(demotedHeadingTag(6) === "h6", "demotedHeadingTag(6) === 'h6'");
  // ★강등 결과가 절대 h1/h2 가 되지 않음 — 문서 레벨 헤딩 오염 차단의 핵심
  let allBelowH3 = true;
  let monotone = true;
  let prev = 0;
  for (let l = 1; l <= 6; l++) {
    const d = demotedHeadingLevel(l);
    if (d < 3) allBelowH3 = false;
    if (d < prev) monotone = false; // 상대 계층 보존(비감소)
    prev = d;
  }
  ok(allBelowH3, "★모든 강등 레벨 ≥ 3 (h1/h2 로 절대 렌더되지 않음)");
  ok(monotone, "강등이 단조 비감소(원본 상대 계층 보존: h1<h2<h3 유지)");
  // 범위 밖·비정상 입력 안전(소수·0·음수·초과)
  ok(demotedHeadingLevel(0) === 3, "level 0 → 하한 3 클램프");
  ok(demotedHeadingLevel(-5) === 3, "level 음수 → 하한 3 클램프");
  ok(demotedHeadingLevel(9) === 6, "level 9 → 상한 6 클램프");
  ok(demotedHeadingLevel(2.7) === 4, "level 2.7 → floor 2 → 4");
}

console.log("\n[B] AdvisorChat 배선 — import·MD_COMPONENTS 6키·ReactMarkdown 전달");
{
  ok(/import\s*\{\s*demotedHeadingTag\s*\}\s*from\s*["']@\/lib\/advisor\/markdown["']/.test(chat),
    "demotedHeadingTag 를 @/lib/advisor/markdown 에서 import");
  ok(/type\s+Components\s*\}\s*from\s*["']react-markdown["']/.test(chat) || /import\s+ReactMarkdown,\s*\{\s*type\s+Components\s*\}/.test(chat),
    "react-markdown 의 Components 타입 import");
  // MD_COMPONENTS 정의 블록 격리
  const ci = chat.indexOf("MD_COMPONENTS");
  const cseg = ci >= 0 ? chat.slice(ci, ci + 400) : "";
  ok(/const\s+MD_COMPONENTS\s*:\s*Components\s*=/.test(chat), "MD_COMPONENTS: Components 상수 정의");
  for (const h of ["h1", "h2", "h3", "h4", "h5", "h6"]) {
    ok(new RegExp("\\b" + h + ":\\s*makeHeading\\(" + h.slice(1) + "\\)").test(cseg),
      "MD_COMPONENTS." + h + " = makeHeading(" + h.slice(1) + ")");
  }
  ok(/function\s+makeHeading\s*\(\s*level\s*:\s*number\s*\)/.test(chat), "makeHeading(level) 헬퍼 정의");
  ok(/const\s+Tag\s*=\s*demotedHeadingTag\(level\)/.test(chat), "makeHeading 이 demotedHeadingTag(level) 로 태그 산출");
  ok(/className\s*=\s*\{cls\}/.test(chat) && /const\s+cls\s*=\s*["']md-h md-h-["']\s*\+\s*level/.test(chat),
    "강등 태그에 .md-h + 원본 레벨 클래스(.md-h-N) 부여");
  ok(/<ReactMarkdown\s+remarkPlugins=\{\[remarkGfm\]\}\s+components=\{MD_COMPONENTS\}>/.test(chat),
    "ReactMarkdown 에 components={MD_COMPONENTS} 전달");
}

console.log("\n[C] CSS — 원본 레벨 클래스로 시각 보존(.md-h / .md-h-1..3 / 폴백)");
{
  ok(/\.md-h\s*\{[^}]*font-weight:\s*700/.test(css), ".md-h 베이스(font-weight 700·margin)");
  ok(/\.md-h-1\s*\{[^}]*font-size:\s*19px/.test(css), ".md-h-1 19px (옛 h1 보존)");
  ok(/\.md-h-2\s*\{[^}]*font-size:\s*17px/.test(css), ".md-h-2 17px (옛 h2 보존)");
  ok(/\.md-h-3\s*\{[^}]*font-size:\s*15px[^}]*var\(--c-brown-deep\)/.test(css), ".md-h-3 15px·brown (옛 h3 보존)");
  ok(/\.md-h-4,\s*\.md-h-5,\s*\.md-h-6\s*\{[^}]*font-size/.test(css), ".md-h-4~6 폴백 규칙 존재");
}

console.log("\n[D] ★아웃라인 오염 차단 — 태그 기반 .md h1/.md h2 규칙·직접 h1/h2 렌더 제거");
{
  // 옛 태그 기반 헤딩 규칙이 남아 있으면 강등 h3(원본 h1) 가 .md h3(15px) 로 오인 스타일됨
  ok(!/\.md\s+h1\b/.test(css), ".md h1 태그 규칙 제거됨");
  ok(!/\.md\s+h2\b/.test(css), ".md h2 태그 규칙 제거됨");
  ok(!/\.md\s+h3\b/.test(css), ".md h3 태그 규칙 제거됨");
  // 답변 본문이 h1 을 직접 렌더하지 않음(makeHeading 만 태그 산출). 페이지엔 h1 부재 유지.
  ok(!/<h1[\s>]/.test(chat), "AdvisorChat 에 리터럴 <h1> 없음(페이지 h1 부재 유지)");
  // 단, 빈 상태 헤딩(<h2>무엇을 도와드릴까요?</h2>)은 대화 시작 전 페이지를 라벨링하는
  // 의도적 헤딩이며 답변 본문과 무관 — 강등 대상 아님(보존 확인).
  ok(/<h2>무엇을 도와드릴까요\?<\/h2>/.test(chat), "빈 상태 라벨 헤딩(h2) 보존(답변 본문과 무관)");
}

console.log("\n[E] 무회귀 — remarkGfm·발화자 라벨·md 컨테이너 보존");
{
  ok(/remarkPlugins=\{\[remarkGfm\]\}/.test(chat), "remarkGfm 보존");
  ok(/className="sr-only">상담 답변 \{turn\}\./.test(chat), "발화자 .sr-only '상담 답변 {turn}.' 라벨 보존(turnlabels 무회귀)");
  ok(/className="md"/.test(chat), ".md 렌더 컨테이너 보존");
  ok(/parseAction\(m\.content\)/.test(chat), "parseAction(액션 마커) 보존");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (총 ${pass + fail} 단언)`);
if (fail > 0) process.exit(1);
