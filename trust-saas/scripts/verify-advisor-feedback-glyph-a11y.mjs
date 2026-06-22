/* ============================================================
   회귀 가드 — 상담 답변 피드백 컨트롤(👍/👎) 장식 이모지 글리프 a11y
   (WCAG 2.4.4 Link/Button Purpose · 4.1.2 Name, Role, Value)

   배경(a11y·표시 전용, 비-산출물):
   `verify-action-button-glyph-a11y`(정적 액션 컨트롤 선두 이모지)·
   `verify-decorative-text-glyph-a11y`(비-인터랙티브 정보 텍스트 글리프)가
   장식 글리프 갈래를 마감하며 **잔여 후보**로 명시한 것이 AdvisorChat 의
   👍/👎 피드백 버튼이다. 이 두 버튼은 **본문이 이모지 단독**(`>👍<`/`>👎<`)이고
   `title` 만 있었다 — 접근명(accessible name) 계산상 텍스트 콘텐츠(이모지)가
   존재하면 title 은 무시되므로, SR 은 버튼 이름을 "thumbs up sign, button"/
   "thumbs down sign, button" 처럼 **이모지 글리프 그대로** 낭독했다(목적이
   "도움됨/개선 필요"임을 알 수 없음). 카드 액션 버튼(`88489f8`)이 aria-label +
   장식 이모지 aria-hidden 으로 마감한 것과 **같은 컨벤션**으로,
   ① 버튼에 명시적 `aria-label`(접근명 = "도움됨"/"개선 필요")을 주고
   ② 이모지를 `<span aria-hidden="true">` 로 감싸 접근명에서 제외한다.

   ★더해, 피드백 전송 후 교체되는 "👍 의견 감사합니다 / 👎 더 개선하겠습니다"
   완료 텍스트(focus 가 이동하는 status 텍스트)도 선두 이모지가 콘텐츠로 낭독돼
   "thumbs up sign 의견 감사합니다"가 되던 갈래 — 정보 텍스트 글리프 컨벤션
   (`verify-decorative-text-glyph-a11y`)과 동일하게 선두 글리프를 aria-hidden
   span 으로 감싼다(가시 표시 동일·접근명/낭독에서만 제외).

   ★시각 무변경: 글리프는 aria-hidden span '안'에 그대로 남아 화면 표시는 동일.
   배선(onClick·title·className)·sendFeedback 호출·done 텍스트 보존(표시/접근성
   경계만). ★조문·엔진·검증 게이트(validate)·산출물(builders)·검색/로깅 무접촉.

   핵심 불변식:
     (A) 👍/👎 버튼이 명시 aria-label(도움됨/개선 필요) + 이모지 aria-hidden span.
     (B) 피드백 완료 텍스트의 선두 이모지가 aria-hidden span 으로 감싸짐 + 본문 보존.
     (C) ★맨몸 잔존 0 — 옛 형태(>이모지<·"이모지 본문" 인접)가 aria-hidden 밖에 없음.
     (D) 무회귀 — 배선(onClick sendFeedback·title)·done 본문·복사 버튼 보존.

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-advisor-feedback-glyph-a11y.mjs
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

console.log("\n[A] 👍/👎 버튼 — 명시 aria-label + 이모지 aria-hidden span");
{
  ok(/<button className="fb-btn" onClick=\{\(\) => sendFeedback\(i, "up"\)\} title="도움됨" aria-label="도움됨"><span aria-hidden="true">👍<\/span><\/button>/.test(advisor),
    "👍 버튼: aria-label=\"도움됨\" + <span aria-hidden>👍</span> (접근명 = \"도움됨\")");
  ok(/<button className="fb-btn" onClick=\{\(\) => sendFeedback\(i, "down"\)\} title="개선 필요" aria-label="개선 필요"><span aria-hidden="true">👎<\/span><\/button>/.test(advisor),
    "👎 버튼: aria-label=\"개선 필요\" + <span aria-hidden>👎</span> (접근명 = \"개선 필요\")");
}

console.log("\n[B] 피드백 완료 텍스트 — 선두 이모지 aria-hidden span + 본문 보존");
{
  ok(/<span aria-hidden="true">👍 <\/span>의견 감사합니다/.test(advisor),
    "완료(up): 👍 aria-hidden span + \"의견 감사합니다\"");
  ok(/<span aria-hidden="true">👎 <\/span>더 개선하겠습니다/.test(advisor),
    "완료(down): 👎 aria-hidden span + \"더 개선하겠습니다\"");
}

console.log("\n[C] ★맨몸 잔존 0 — 옛 형태가 aria-hidden 밖에 없음");
{
  ok(!/>👍<\/button>/.test(advisor), "옛 \">👍</button>\"(이모지 단독 버튼) 맨몸 잔존 0");
  ok(!/>👎<\/button>/.test(advisor), "옛 \">👎</button>\"(이모지 단독 버튼) 맨몸 잔존 0");
  ok(!/"👍 의견 감사합니다"/.test(advisor), "옛 \"👍 의견 감사합니다\" 문자열 리터럴 맨몸 잔존 0");
  ok(!/"👎 더 개선하겠습니다"/.test(advisor), "옛 \"👎 더 개선하겠습니다\" 문자열 리터럴 맨몸 잔존 0");
}

console.log("\n[D] 무회귀 — 배선·title·done 본문·복사 버튼 보존(표시/접근성 경계만)");
{
  ok(/onClick=\{\(\) => sendFeedback\(i, "up"\)\}/.test(advisor) &&
     /onClick=\{\(\) => sendFeedback\(i, "down"\)\}/.test(advisor),
    "sendFeedback(up/down) onClick 배선 보존");
  ok(/title="도움됨"/.test(advisor) && /title="개선 필요"/.test(advisor),
    "title(도움됨/개선 필요) 시각 툴팁 보존");
  ok(/className="advisor-feedback-done"/.test(advisor) && /className="fb-btn"/.test(advisor),
    "advisor-feedback-done·fb-btn 클래스 보존");
  ok(/className="advisor-feedback-label">이 답변이 도움이 됐나요\?/.test(advisor),
    "피드백 라벨 \"이 답변이 도움이 됐나요?\" 보존");
  ok(/aria-label="답변 복사"/.test(advisor),
    "복사 버튼 aria-label(답변 복사) 무접촉(기존 마감 보존)");
  // 가시 글리프 보존(시각 무변경) — 각 이모지가 파일에 여전히 존재(aria-hidden span 안)
  ok(/👍/.test(advisor) && /👎/.test(advisor),
    "가시 글리프(👍👎) 보존 — 화면 표시 무변경");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
process.exit(fail === 0 ? 0 : 1);
