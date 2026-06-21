/* ============================================================
   회귀 가드 — 상담(advisor·Pillar 2) 피드백(👍/👎) 전송 후 포커스 이동(WCAG 2.4.3 Focus Order)

   배경(a11y·상담 동선, 비-산출물·표시/포커스 경계만): AdvisorChat 답변 푸터의
   피드백 버튼(👍/👎)은 클릭하면 즉시 언마운트되며 정적 텍스트("의견 감사합니다"/
   "더 개선하겠습니다")로 교체된다. 09:15(feedback-announce)이 결과를 폴라이트
   라이브 영역으로 SR 고지하게 했으나, ★포커스는 여전히 사라진 버튼과 함께 body 로
   복귀했다 — 키보드/SR 사용자가 답변 맥락을 잃고 페이지 처음부터 다시 탐색해야 했다
   (09:15·09:45 다음스텝으로 반복 명시된 "피드백 클릭 시 포커스 상실 보완").

   → 위저드 단계 포커스 이동(form-panel-title, tabIndex=-1·outline:none)과 동형으로,
   교체된 done 텍스트에 포커스를 옮긴다. 방금 피드백을 보낸 답변 인덱스를 1회성
   표식(justFedRef)으로 들고, done span 의 콜백 ref 가 그 인덱스일 때만 focus()
   하고 표식을 비운다(재렌더 시 재포커스·다른 답변 오포커스 방지).

   핵심 불변식:
     (A) 1회성 표식 ref(justFedRef) 정의(useRef<number|null>).
     (B) sendFeedback 이 setFeedbackSent 와 동행해 justFedRef.current=i 설정,
         그리고 ★중복 가드(feedbackSent[i]) '뒤'(이미 보낸 답변엔 포커스 안 옮김).
     (C) done span 이 tabIndex={-1}(프로그램적 포커스만·탭 순서 제외) + 콜백 ref.
     (D) ★콜백 ref 가 el && justFedRef.current===i 일 때만 focus() 하고 즉시
         justFedRef 를 비운다(1회성 — 재렌더·복사 토글 시 재포커스 0).
     (E) .advisor-feedback-done:focus { outline:none } (포커스 링 억제=시각 무변경,
         form-panel-title 와 동일 패턴).
     (F) 무회귀 — 09:15 announce 고지·시각 done 텍스트·feedbackSent 가드·👍/👎 배선 보존.

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-advisor-feedback-focus.mjs
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
const chat = readFileSync(path.join(root, "src", "components", "advisor", "AdvisorChat.tsx"), "utf8");
const css = readFileSync(path.join(root, "src", "app", "globals.css"), "utf8");

// sendFeedback 함수 본문만 잘라 위치 기반 단언에 사용(다른 함수와 격리).
const fStart = chat.indexOf("async function sendFeedback");
const fBody = fStart >= 0 ? chat.slice(fStart, chat.indexOf("\n  }", fStart) + 4) : "";

console.log("\n[A] 1회성 표식 ref(justFedRef) 정의");
{
  ok(/const\s+justFedRef\s*=\s*useRef<\s*number\s*\|\s*null\s*>\(\s*null\s*\)/.test(chat),
     "justFedRef = useRef<number|null>(null) 정의");
  ok((chat.match(/justFedRef/g) || []).length >= 3, "justFedRef 가 정의·설정·소비 3지점 이상 사용");
}

console.log("\n[B] sendFeedback 이 표식 설정 — setFeedbackSent 동행 + 중복 가드 뒤");
{
  ok(fStart >= 0, "sendFeedback 함수 존재");
  ok(/justFedRef\.current\s*=\s*i/.test(fBody), "sendFeedback 이 justFedRef.current = i 설정");
  const guardIdx = fBody.indexOf("if (feedbackSent[i]) return;");
  const markIdx = fBody.indexOf("justFedRef.current = i");
  const setIdx = fBody.indexOf("setFeedbackSent(");
  ok(guardIdx >= 0, "feedbackSent[i] 중복 전송 가드 존재");
  ok(guardIdx >= 0 && markIdx > guardIdx, "★표식 설정이 중복 가드 '뒤'(이미 보낸 답변엔 포커스 안 옮김)");
  ok(setIdx >= 0 && markIdx < setIdx, "표식 설정이 setFeedbackSent '앞'(렌더 전에 표식 준비)");
}

console.log("\n[C] done span — tabIndex={-1} + 콜백 ref");
{
  // done 텍스트 span 영역(feedbackSent[i] ? ... : ) 추출
  const doneIdx = chat.indexOf("advisor-feedback-done");
  const seg = doneIdx > 0 ? chat.slice(doneIdx - 40, doneIdx + 360) : "";
  ok(/className="advisor-feedback-done"/.test(seg), "done span 존재");
  ok(/tabIndex=\{-1\}/.test(seg), "done span tabIndex={-1}(탭 순서 제외·프로그램적 포커스만)");
  ok(/ref=\{\s*\(el\)\s*=>/.test(seg), "done span 콜백 ref 존재");
}

console.log("\n[D] ★콜백 ref — 표식 일치 시에만 focus() + 즉시 표식 비움(1회성)");
{
  const doneIdx = chat.indexOf("advisor-feedback-done");
  const seg = doneIdx > 0 ? chat.slice(doneIdx, doneIdx + 400) : "";
  ok(/if\s*\(\s*el\s*&&\s*justFedRef\.current\s*===\s*i\s*\)/.test(seg),
     "el && justFedRef.current===i 가드(방금 보낸 답변만)");
  ok(/\.focus\(\)/.test(seg), "조건 충족 시 el.focus() 호출");
  ok(/justFedRef\.current\s*=\s*null/.test(seg), "★focus 후 justFedRef 비움(재렌더 재포커스 방지)");
  const focusIdx = seg.indexOf(".focus()");
  const clearIdx = seg.indexOf("justFedRef.current = null");
  ok(focusIdx >= 0 && clearIdx > focusIdx, "비움이 focus() '뒤'(1회성 보장)");
  // 표식을 비우는 곳은 콜백 ref 1곳 — sendFeedback 은 설정만(= i)
  ok((chat.match(/justFedRef\.current\s*=\s*null/g) || []).length === 1, "justFedRef 비움 정확히 1곳(콜백 ref)");
}

console.log("\n[E] 포커스 링 억제 — 시각 무변경(form-panel-title 패턴)");
{
  ok(/\.advisor-feedback-done:focus\s*\{[^}]*outline:\s*none/.test(css),
     ".advisor-feedback-done:focus { outline: none }(비-상호작용 텍스트 포커스 링 억제)");
  ok(/\.form-panel-title:focus\s*\{[^}]*outline:\s*none/.test(css), "form-panel-title:focus outline none 선례 보존(동일 패턴)");
}

console.log("\n[F] 무회귀 — announce 고지·시각 done 텍스트·가드·배선 보존");
{
  ok(/announce\(rating === "up"/.test(chat), "09:15 피드백 결과 SR 고지(announce) 보존");
  ok(/의견 감사합니다/.test(chat) && /더 개선하겠습니다/.test(chat), "시각 done 텍스트 보존");
  ok(/if \(feedbackSent\[i\]\) return;/.test(chat), "feedbackSent 중복 가드 보존");
  ok(/sendFeedback\(i,\s*"up"\)/.test(chat) && /sendFeedback\(i,\s*"down"\)/.test(chat), "👍/👎 버튼 onClick 배선 보존");
  ok(/fetch\("\/api\/advisor\/feedback"/.test(chat), "피드백 전송 라우트 보존");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
process.exit(fail === 0 ? 0 : 1);
