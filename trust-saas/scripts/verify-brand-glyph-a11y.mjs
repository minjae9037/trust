/* ============================================================
   회귀 가드 — 헤더(banner) 브랜드 로고 글리프(信託) aria-hidden
   (WCAG 1.3.1 / 4.1.2 — 장식 글리프가 링크/셸 접근명·선형 낭독을 오염시키지 않게)

   배경(a11y·표시 전용, 비-산출물):
   앱 상단 헤더의 브랜드 로고는 원형/사각 글리프 안에 `信託`(신탁) 한자를 표시한다
   (globals.css `.brand-glyph`). 이는 순수 **브랜드 장식**으로 바로 옆 brand-name
   (TrustForm)이 의미를 전달한다. 그런데 종전엔 글리프에 aria 처리가 없어:
     ① AdvisorApp 헤더 — 브랜드가 <Link href="/"> 이고 aria-label 이 없어 접근명이
        콘텐츠에서 계산된다. 글리프가 첫 텍스트라 SR 이 링크 이름을 "信託 TrustForm…"
        (한자=신탁/일부 SR=중국어 독음)으로 낭독해 **링크 접근명을 직접 오염**.
     ② TrustApp 셸 — 브랜드 div 는 aria-label="홈으로 — 신탁사 선택" 이라 접근명
        자체는 깨끗하나, browse/읽기 모드에서 한자 글리프가 독립 콘텐츠로 낭독됐다.

   동적 상태 글리프(splitStatusGlyph)·정적 컨트롤 이모지(#24)·비-인터랙티브 정보
   텍스트 글리프·피드백 컨트롤(👍/👎)·상담 빈 상태 아바타(advisor-empty-glyph)가
   모두 같은 컨벤션으로 장식 처리된 것과 동형으로, 두 헤더 브랜드 글리프도
   요소(div)에 직접 aria-hidden="true" 를 부여해 가시 표시는 그대로 두고
   접근명/낭독에서만 제외한다(★단독 장식 요소 = 글리프 자체가 요소 전체).

   ★시각 무변경: 글리프는 div 안에 그대로 남아 화면 표시 동일.
   ★조문·엔진·검증 게이트(validate)·산출물(builders)·배선·검색/로깅·캐시 무접촉.
   ★브랜드 홈 단축 키보드 동등성(verify-brand-home-keyboard)은 별 갈래로 무회귀.

   핵심 불변식:
     (A) AdvisorApp 헤더 brand-glyph 가 aria-hidden="true" + 信託 보존.
     (B) TrustApp 셸 brand-glyph 가 aria-hidden="true" + 信託 보존.
     (C) ★맨몸 잔존 0 — aria 없는 옛 형태(`<div className="brand-glyph">信託`)가
         두 파일 어디에도 없음(JSX 렌더 위치 전부 aria-hidden 동반).
     (D) 무회귀 — 브랜드명(TrustForm)·Link href·셸 홈 단축 접근명·breadcrumb 보존.

   실행:
     cd trust-saas
     node scripts/verify-brand-glyph-a11y.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const __dir = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(join(__dir, "..", ...p), "utf8");
const advisorApp = read("src", "components", "advisor", "AdvisorApp.tsx");
const trustApp = read("src", "components", "trust", "TrustApp.tsx");

console.log("\n[A] AdvisorApp 헤더 brand-glyph aria-hidden + 信託 보존");
{
  ok(/<div className="brand-glyph" aria-hidden="true">信託<\/div>/.test(advisorApp),
    "AdvisorApp brand-glyph div 에 aria-hidden=\"true\" + 가시 글리프 信託 보존");
  ok(/<Link href="\/" className="brand"/.test(advisorApp),
    "브랜드 Link(href=\"/\") 보존 — 접근명이 콘텐츠 계산 경로(aria-label 없음)");
}

console.log("\n[B] TrustApp 셸 brand-glyph aria-hidden + 信託 보존");
{
  ok(/<div className="brand-glyph" aria-hidden="true">信託<\/div>/.test(trustApp),
    "TrustApp brand-glyph div 에 aria-hidden=\"true\" + 가시 글리프 信託 보존");
  ok(/aria-label="홈으로 — 신탁사 선택"/.test(trustApp),
    "셸 브랜드 홈 단축 접근명(aria-label) 보존 — 별 갈래 무회귀");
}

console.log("\n[C] ★맨몸 잔존 0 — aria 없는 옛 형태 부재(두 파일)");
{
  // 옛 형태: aria-hidden 없이 글리프만 박힌 div. 부정 단언으로 회귀 차단.
  ok(!/<div className="brand-glyph">信託/.test(advisorApp),
    "AdvisorApp 옛 \"<div className=brand-glyph>信託\"(aria 없음) 맨몸 잔존 0");
  ok(!/<div className="brand-glyph">信託/.test(trustApp),
    "TrustApp 옛 \"<div className=brand-glyph>信託\"(aria 없음) 맨몸 잔존 0");
  // JSX 렌더 위치(`>信託<`)는 모두 aria-hidden 동반이어야 함(주석 내 참조는 제외).
  for (const [name, src] of [["AdvisorApp", advisorApp], ["TrustApp", trustApp]]) {
    const all = (src.match(/>信託</g) || []).length;
    const guarded = (src.match(/aria-hidden="true">信託</g) || []).length;
    ok(all === guarded && guarded === 1,
      `${name} 信託 JSX 렌더 위치(1곳) 전부 aria-hidden 동반(맨몸 0)`);
  }
}

console.log("\n[D] 무회귀 — 브랜드명·breadcrumb·홈 단축 보존(표시/접근성 경계만)");
{
  ok(/<div className="brand-name">TrustForm<\/div>/.test(advisorApp) &&
     /<div className="brand-name">TrustForm<\/div>/.test(trustApp),
    "브랜드명(TrustForm) 양 헤더 보존 — 실제 의미 전달 요소");
  ok(/className="breadcrumb"/.test(advisorApp) && /className="breadcrumb"/.test(trustApp),
    "breadcrumb 내비 양 헤더 보존");
  ok(/onClick=\{goHome\}/.test(trustApp) && /title="홈으로"/.test(trustApp),
    "TrustApp 홈 단축(onClick goHome·title) 무회귀");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
process.exit(fail === 0 ? 0 : 1);
