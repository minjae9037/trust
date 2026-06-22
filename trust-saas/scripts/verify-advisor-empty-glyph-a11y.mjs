/* ============================================================
   회귀 가드 — 상담(advisor) 빈 상태 브랜드 아바타 글리프(信託) aria-hidden
   (WCAG 1.3.1 / 4.1.2 — 장식 글리프가 빈 상태 선형 낭독을 오염시키지 않게)

   배경(a11y·표시 전용, 비-산출물):
   AdvisorChat 빈 상태(`advisor-empty`)는 원형 그라데이션 아바타 안에 `信託`(신탁)
   한자 글리프를 큼직하게 표시한다(globals.css `.advisor-empty-glyph` = 56px 원형·
   gradient·white). 이는 순수 **브랜드 장식**으로, 바로 아래 헤딩("무엇을
   도와드릴까요?")·안내 문단이 목적을 충분히 전달한다. 그런데 종전엔 글리프에
   aria 처리가 없어 SR 이 빈 상태에 진입할 때 한자 "信託"(한글 SR=신탁 / 일부
   SR=중국어 독음·낱자명)를 **헤딩보다 먼저** 낭독해 선형 낭독을 오염시켰다.

   동적 상태 글리프(splitStatusGlyph)·정적 컨트롤 이모지(#24)·비-인터랙티브 정보
   텍스트 글리프(verify-decorative-text-glyph-a11y)·피드백 컨트롤(👍/👎)이 모두
   같은 컨벤션으로 장식 처리된 것과 동형으로, 이 빈 상태 아바타도 aria-hidden 으로
   가시 표시는 그대로 두고 접근명/낭독에서만 제외한다.

   ★단독 장식 요소(내부에 동반 의미 텍스트 없음 = 글리프 자체가 요소 전체)이므로
   inline `<span aria-hidden>` 래핑이 아니라 **요소(div)에 직접 aria-hidden="true"**
   를 부여하는 관용 형태를 쓴다. 가시 글리프(信託)·클래스(advisor-empty-glyph)는 보존.

   ★시각 무변경: 글리프는 div 안에 그대로 남아 화면 표시 동일.
   ★조문·엔진·검증 게이트(validate)·산출물(builders)·검색/로깅·캐시 무접촉.

   핵심 불변식:
     (A) 빈 상태 아바타 글리프가 aria-hidden="true" 요소로 감싸짐 + 信託 보존.
     (B) ★맨몸 잔존 0 — aria 없는 옛 형태(`<div className="advisor-empty-glyph">信託`)
         가 존재하지 않음.
     (C) 무회귀 — 빈 상태 헤딩·안내 문단·제안 칩·클래스 보존(표시/접근성 경계만).

   실행:
     cd trust-saas
     node scripts/verify-advisor-empty-glyph-a11y.mjs
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
const advisor = read("src", "components", "advisor", "AdvisorChat.tsx");

console.log("\n[A] 빈 상태 아바타 글리프 aria-hidden 요소 + 信託 보존");
{
  ok(/<div className="advisor-empty-glyph" aria-hidden="true">信託<\/div>/.test(advisor),
    "advisor-empty-glyph div 에 aria-hidden=\"true\" + 가시 글리프 信託 보존");
  ok(/信託/.test(advisor), "가시 글리프 信託 존재(화면 표시 무변경)");
}

console.log("\n[B] ★맨몸 잔존 0 — aria 없는 옛 형태 부재");
{
  // 옛 형태: aria-hidden 없이 글리프만 박힌 div. 부정 단언으로 회귀 차단.
  ok(!/<div className="advisor-empty-glyph">信託/.test(advisor),
    "옛 \"<div className=advisor-empty-glyph>信託\"(aria 없음) 맨몸 잔존 0");
  // JSX 렌더 위치(`>信託<`)는 모두 aria-hidden 동반이어야 함(주석 내 참조는 제외).
  ok((advisor.match(/>信託</g) || []).length ===
     (advisor.match(/aria-hidden="true">信託</g) || []).length &&
     (advisor.match(/aria-hidden="true">信託</g) || []).length === 1,
    "信託 JSX 렌더 위치(1곳) 전부 aria-hidden 동반");
}

console.log("\n[C] 무회귀 — 빈 상태 헤딩·안내·제안 칩·클래스 보존(표시/접근성 경계만)");
{
  ok(/className="advisor-empty-glyph"/.test(advisor), "advisor-empty-glyph 클래스 보존");
  ok(/<div className="advisor-empty">/.test(advisor), "advisor-empty 컨테이너 보존");
  ok(/<h2>무엇을 도와드릴까요\?<\/h2>/.test(advisor), "빈 상태 헤딩(h2) 보존 — 실제 의미 전달 요소");
  ok(/className="advisor-suggest"/.test(advisor) && /className="suggest-chip"/.test(advisor),
    "제안 칩(advisor-suggest / suggest-chip) 보존");
  // 다른 장식 글리프 가드 영역 무회귀(피드백 버튼 aria-label·sources 라벨 글리프)
  ok(/aria-label="도움됨"/.test(advisor) && /aria-label="개선 필요"/.test(advisor),
    "피드백 버튼 aria-label(도움됨/개선 필요) 무회귀");
  ok(/<span className="advisor-sources-label"><span aria-hidden="true">📚 <\/span>참고한 자료<\/span>/.test(advisor),
    "출처 라벨 📚 aria-hidden span 무회귀");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
process.exit(fail === 0 ? 0 : 1);
