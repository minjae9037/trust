/* ============================================================
   회귀 가드 — 상담(advisor·Pillar 2) 답변 피드백(👍/👎) 전송 결과 스크린리더 고지(WCAG 4.1.3)

   배경(a11y·상담 동선, 비-산출물·표시 경계만): AdvisorChat 답변 푸터의 피드백
   버튼(👍 도움됨 / 👎 개선 필요)은 클릭하면 즉시 언마운트되며 정적 텍스트
   ("👍 의견 감사합니다" / "👎 더 개선하겠습니다")로 교체된다. 그러나 이 교체는
   라이브 영역이 아니어서 스크린리더 사용자는 ① 의견이 접수됐는지 알 수 없고
   ② 버튼이 사라지며 포커스도 잃는다(body 로 복귀). 시각 사용자는 교체 텍스트로
   결과를 알지만 SR 사용자에겐 신호가 0이던 갭 마감.

   → 스트리밍 상태(00:55)·복사 결과(08:45)와 같은 폴라이트 라이브 영역
   (`.advisor-live`)을 재사용해, 피드백 전송 결과를 SR 로 고지한다. announce 헬퍼는
   복사·피드백 공용으로 컴포넌트 스코프로 승격(중복 정의 없음). 이로써 advisor 의
   인터랙티브 결과 SR 고지 3종(스트리밍·복사·피드백)이 완결된다.

   핵심 불변식:
     (A) 공용 announce(text) 헬퍼 — setLiveMsg("")→setTimeout(setLiveMsg(text))
         (라이브 영역 재고지 기법) + 컴포넌트 스코프 정의 정확히 1곳.
     (B) sendFeedback 가 announce 로 결과 고지 — up/down 분기 문구.
     (C) ★낙관적 고지 — 고지는 setFeedbackSent 뒤(시각 swap 과 동행)이고
         feedbackSent[i] 중복 가드 '뒤'(이미 보낸 답변 재고지 안 함). fetch 성공
         여부와 무관(시각 swap 도 낙관적, fetch 실패는 무시).
     (D) up/down 문구가 서로 다르고(재낭독) 복사 고지 문구와도 다름(채널 혼동 없음).
     (E) `.advisor-live` 폴라이트 영역 재사용(신규 라이브 영역 0) — role=status·aria-live=polite.
     (F) 무회귀 — 시각 done 텍스트·feedback 라우트·feedbackSent 가드·복사 announce 보존.

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-advisor-feedback-announce.mjs
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

const UP_MSG = "도움이 됐다는 의견을 보냈습니다.";
const DOWN_MSG = "개선이 필요하다는 의견을 보냈습니다.";

// sendFeedback 함수 본문만 잘라 위치 기반 단언에 사용(다른 함수와 격리).
const fStart = chat.indexOf("async function sendFeedback");
const fBody = fStart >= 0 ? chat.slice(fStart, chat.indexOf("\n  }", fStart) + 4) : "";

console.log("\n[A] 공용 announce 헬퍼 — 라이브 영역 재고지 기법, 컴포넌트 스코프 1곳");
{
  ok(/const\s+announce\s*=\s*\(text[^)]*\)\s*=>\s*\{/.test(chat), "announce(text) 헬퍼 존재");
  ok(/const\s+announce\s*=\s*\([\s\S]*?setLiveMsg\(""\)[\s\S]*?setTimeout\([\s\S]*?setLiveMsg\(text\)/.test(chat),
     "★announce 가 setLiveMsg(\"\")→setTimeout(setLiveMsg(text)) (재고지 기법)");
  ok((chat.match(/const\s+announce\s*=/g) || []).length === 1, "announce 정의 정확히 1곳(복사·피드백 공용·중복 0)");
}

console.log("\n[B] sendFeedback 가 announce 로 결과 고지 — up/down 분기");
{
  ok(fStart >= 0, "sendFeedback 함수 존재");
  ok(/announce\(/.test(fBody), "sendFeedback 가 announce 호출");
  ok(fBody.includes(UP_MSG), `up 고지 문구("${UP_MSG}")`);
  ok(fBody.includes(DOWN_MSG), `down 고지 문구("${DOWN_MSG}")`);
  // rating 으로 분기(삼항 또는 동등) — up 이면 UP_MSG, 아니면 DOWN_MSG
  ok(/rating\s*===\s*"up"\s*\?\s*"[^"]*보냈습니다\.?"\s*:\s*"[^"]*보냈습니다\.?"/.test(fBody),
     "rating==='up' 분기로 up/down 문구 선택");
}

console.log("\n[C] ★낙관적 고지 — setFeedbackSent 뒤 + feedbackSent 중복 가드 뒤");
{
  const guardIdx = fBody.indexOf("if (feedbackSent[i]) return;");
  const setIdx = fBody.indexOf("setFeedbackSent(");
  const annIdx = fBody.indexOf("announce(");
  ok(guardIdx >= 0, "feedbackSent[i] 중복 전송 가드 존재");
  ok(guardIdx >= 0 && annIdx > guardIdx, "고지가 중복 가드 '뒤'(이미 보낸 답변 재고지 안 함)");
  ok(setIdx >= 0 && annIdx > setIdx, "고지가 setFeedbackSent 뒤(시각 swap 과 동행=낙관적)");
  // fetch 성공 여부와 무관 — announce 가 try(fetch) '앞'(낙관적, 실패해도 시각 swap 과 정합)
  const tryIdx = fBody.indexOf("try {");
  ok(tryIdx >= 0 && annIdx < tryIdx, "고지가 fetch try '앞'(전송 성공 여부 무관·시각 swap 과 동일하게 낙관적)");
}

console.log("\n[D] up/down 문구 상이 + 복사 고지 문구와 구분");
{
  ok(UP_MSG !== DOWN_MSG, "up≠down(내용 변화로 재낭독)");
  ok(!UP_MSG.includes("복사") && !DOWN_MSG.includes("복사"), "피드백 고지가 복사 고지와 다른 문구(채널 혼동 없음)");
  // 복사 고지 문구는 그대로 보존(공용 영역 공유하되 문구는 동작별 구분)
  ok(chat.includes("답변을 복사했습니다."), "복사 성공 고지 문구 보존");
}

console.log("\n[E] .advisor-live 폴라이트 영역 재사용 — 신규 라이브 영역 0");
{
  ok((chat.match(/className="advisor-live"/g) || []).length === 1, ".advisor-live 라이브 영역 정확히 1곳(신규 영역 0=재사용)");
  const liveIdx = chat.indexOf('className="advisor-live"');
  const seg = liveIdx > 0 ? chat.slice(liveIdx, liveIdx + 160) : "";
  ok(/role="status"/.test(seg) && /aria-live="polite"/.test(seg), ".advisor-live role=status·aria-live=polite 보존");
}

console.log("\n[F] 무회귀 — 시각 done 텍스트·feedback 라우트·가드·복사 announce 보존");
{
  ok(/의견 감사합니다/.test(chat) && /더 개선하겠습니다/.test(chat), "시각 done 텍스트(의견 감사합니다/더 개선하겠습니다) 보존");
  ok(/fetch\("\/api\/advisor\/feedback"/.test(chat), "피드백 전송 라우트(/api/advisor/feedback) 보존");
  ok(/sendFeedback\(i,\s*"up"\)/.test(chat) && /sendFeedback\(i,\s*"down"\)/.test(chat), "👍/👎 버튼 onClick 배선 보존");
  ok(/announce\("답변을 복사했습니다\."\)/.test(chat), "복사 성공 고지(공용 announce 사용) 보존");
  // setLiveMsg 총 호출 = 공용 announce 2(비움·세팅) + 스트리밍 5 = 7(과다 배선 회귀 감지)
  ok((chat.match(/setLiveMsg\(/g) || []).length === 7, "setLiveMsg 총 7회(공용 announce 2 + 스트리밍 5)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
process.exit(fail === 0 ? 0 : 1);
