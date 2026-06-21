/* ============================================================
   회귀 가드 — 상담 답변 생성 "중지(Stop)" 버튼 (사용자 동선·비-산출물)

   배경(UX 갭, 비-산출물): 상담(Pillar 2) 답변은 토큰 스트리밍이라 길거나
   방향이 빗나간 답변을 사용자가 끝까지 기다려야 했다. 생성 중에는 "전송"
   버튼이 disabled 로만 비활성화돼 진행 중 스트림을 끊을 표준 수단(B2B 챗 UI
   기본 기능)이 전무했다. AdvisorChat 에 AbortController 기반 "중지" 버튼을
   추가해 진행 중 생성을 끊는다.

   핵심 불변식:
     - ask() 는 AbortController 를 만들어 abortRef 에 저장하고 fetch 에
       signal 을 전달한다(중지 시 reader.read()/fetch 가 AbortError 로 종료).
     - 중지 버튼은 생성 중(busy)에만 노출되고, 그 외에는 "전송" 버튼이 노출된다
       (busy ? 중지 : 전송 — disabled 만 걸던 기존 동작 대체).
     - ★중지는 오류가 아니다: controller.signal.aborted 분기에서 부분 답변을
       보존하고(오류 메시지 미표시), 받은 내용이 없으면 빈 assistant 자리표시자를
       제거한다(멈춘 커서 ▍ 잔류 방지).
     - finally 에서 abortRef 를 비운다(다음 요청과 분리).
     - 표시/전송 경계만 — 조문·엔진·산출물·검색·로깅·페르소나 무접촉.

   단언:
     (A) abortRef + stopGenerating + AbortController 생성·signal 전달
     (B) ★중지 버튼은 busy 일 때만(전송 버튼과 상호배타) — busy ? 중지 : 전송
     (C) ★abort 분기 = 오류 아님(부분 보존·빈 자리표시자 제거·error 미표시)
     (D) 접근성 — btn-stop aria-label/title "답변 생성 중지"
     (E) globals.css .btn-stop 정의 + hover + :focus-visible
     (F) 무회귀 — 기존 전송·복사·피드백·출처·액션·IME Enter 경로 보존

   실행:
     cd trust-saas
     node scripts/verify-advisor-stop.mjs
   ============================================================ */
import { readFileSync } from "fs";
import path from "path";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};
const read = (rel) => readFileSync(path.join(process.cwd(), rel), "utf8");

const chat = read("src/components/advisor/AdvisorChat.tsx");
const css = read("src/app/globals.css");

console.log("\n[A] AbortController 배선 — abortRef·stopGenerating·signal");
{
  ok(/const\s+abortRef\s*=\s*useRef<AbortController\s*\|\s*null>\(null\)/.test(chat), "abortRef = useRef<AbortController|null>(null)");
  ok(/function\s+stopGenerating\s*\(\)/.test(chat), "stopGenerating 함수 존재");
  ok(/abortRef\.current\?\.abort\(\)/.test(chat), "stopGenerating 이 abortRef.current.abort() 호출");
  ok(/new\s+AbortController\(\)/.test(chat), "ask() 가 AbortController 생성");
  ok(/abortRef\.current\s*=\s*controller/.test(chat), "생성한 controller 를 abortRef 에 저장");
  ok(/signal:\s*controller\.signal/.test(chat), "fetch 에 signal: controller.signal 전달");
  ok(/abortRef\.current\s*=\s*null/.test(chat), "finally 에서 abortRef 비움");
}

console.log("\n[B] ★중지/전송 상호배타 — busy 일 때만 중지 버튼");
{
  ok(/className="btn btn-stop"/.test(chat), "btn-stop 버튼 렌더");
  ok(/onClick=\{stopGenerating\}/.test(chat), "중지 버튼 onClick → stopGenerating");
  // busy ? (중지) : (전송) — 삼항으로 전환, 기존 disabled 만 걸던 패턴 제거
  ok(/busy\s*\?\s*\(/.test(chat), "busy ? … 삼항으로 버튼 전환");
  ok(/btn-stop[\s\S]*onClick=\{\(\)\s*=>\s*ask\(input\)\}/.test(chat), "전송 버튼(ask(input)) 은 비-busy 분기에 보존");
  // 전송 버튼에 disabled={busy} 가 더는 필요 없음(중지로 대체) — 잔재 0
  ok(!/onClick=\{\(\)\s*=>\s*ask\(input\)\}\s*disabled=\{busy\}/.test(chat), "전송 버튼 disabled={busy} 잔재 0(중지 버튼이 대체)");
}

console.log("\n[C] ★abort = 오류 아님 — 부분 보존·빈 자리표시자 제거·error 미표시");
{
  ok(/controller\.signal\.aborted/.test(chat), "catch 가 controller.signal.aborted 분기");
  // abort 분기에서 빈 assistant 자리표시자 제거(멈춘 커서 방지)
  const catchSeg = chat.slice(chat.indexOf("catch (e)"));
  ok(/aborted\)\s*\{[\s\S]*role\s*===\s*"assistant"[\s\S]*!last\.content[\s\S]*copy\.pop\(\)/.test(catchSeg), "abort+빈 내용 → 빈 assistant 자리표시자 pop");
  // abort 분기에서는 advisorErrorMessage 로 "오류:" 를 쓰지 않음(else 에서만)
  ok(/\}\s*else\s*\{[\s\S]*advisorErrorMessage\(e\)[\s\S]*"오류:\s*"/.test(catchSeg), "오류 메시지(advisorErrorMessage)는 else(비-abort) 분기에서만");
  // abort 분기가 error 분기보다 먼저(중지를 오류로 오인하지 않음)
  const abIdx = catchSeg.indexOf("signal.aborted");
  const errIdx = catchSeg.indexOf("advisorErrorMessage");
  ok(abIdx > 0 && errIdx > abIdx, "abort 분기가 error 분기보다 먼저 판정");
}

console.log("\n[D] 접근성 — btn-stop 접근명");
{
  const at = chat.indexOf('className="btn btn-stop"');
  const seg = chat.slice(at, at + 280);
  ok(/aria-label="답변 생성 중지"/.test(seg), "btn-stop aria-label='답변 생성 중지'");
  ok(/title="답변 생성 중지"/.test(seg), "btn-stop title='답변 생성 중지'");
}

console.log("\n[E] globals.css .btn-stop 스타일");
{
  ok(/\.btn-stop\s*\{[^}]*\}/.test(css), ".btn-stop 정의 존재");
  ok(/\.btn-stop:hover[^{]*\{/.test(css), ".btn-stop:hover 정의");
  ok(/\.btn-stop:focus-visible\s*\{/.test(css), ".btn-stop:focus-visible 아웃라인(키보드 접근)");
  ok(/\.btn-stop\s*\{[^}]*var\(--c-danger\)/.test(css), ".btn-stop danger 토큰 사용(차분한 중지 톤)");
}

console.log("\n[F] 무회귀 — 기존 전송·복사·피드백·출처·액션·IME Enter 경로 보존");
{
  ok(/className="btn btn-primary"/.test(chat) && /onClick=\{\(\)\s*=>\s*ask\(input\)\}/.test(chat), "전송 버튼(btn-primary→ask) 보존");
  ok(/className="copy-btn"/.test(chat), "복사 버튼 경로 보존");
  ok(/sendFeedback\(i,\s*"up"\)/.test(chat) && /sendFeedback\(i,\s*"down"\)/.test(chat), "피드백 👍/👎 경로 보존");
  ok(/className="advisor-sources"/.test(chat), "출처 칩 경로 보존");
  ok(/className="doc-action-btn"/.test(chat), "서류 작성 액션 버튼 경로 보존");
  ok(/sanitizeHistory\(base\)/.test(chat), "요청 이력 마커 정제(sanitizeHistory) 보존");
  ok(/isSubmitEnter\(e\)/.test(chat), "IME 안전 Enter 전송 경로 보존");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
if (fail > 0) process.exit(1);
