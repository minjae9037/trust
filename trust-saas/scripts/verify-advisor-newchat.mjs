/* ============================================================
   회귀 가드 — 상담(advisor·Pillar 2) "새 대화" 시작(대화 이력 리셋)

   배경(주제 전환 동선·정확성, 비-산출물): AdvisorChat 은 한 번 대화가 시작되면
   빈 상태(제안 칩)로 되돌아갈 수단이 전혀 없어, 무관한 새 주제를 물어도 이전 턴이
   계속 누적됐다. 이는 두 가지를 악화시킨다 — ① 시맨틱 Q&A 캐시는 fresh single-turn
   에만 적용되므로(verify-advisor-cache [H] 멀티턴 미적용) 누적 이력은 캐시 적격을
   잃는다 ② 누적된 직전 턴이 새 질문의 맥락을 오염시킨다. "새 대화"(newConversation)
   는 msgs/피드백/복사 상태를 비워 컨텍스트를 리셋한다 → 캐시 적격 회복 + 주제 오염 제거.

   핵심 불변식:
     (A) newConversation 이 대화 상태를 리셋 — setMsgs([]) + 피드백/복사 초기화.
     (B) ★입력란 무영향 — newConversation 안에 setInput 없음 + 파일 전체 setInput 호출은
         여전히 2회뿐(onChange·전송 시 비우기). 막 타이핑한 새 질문을 보존한다
         (verify-advisor-resend [E] 무손실 원칙과 동일 — 리셋으로 인한 새 유실 0).
     (C) ★busy 게이트 — 생성 중에는 무동작(`if (busy) return`) + 버튼 `disabled={busy}`.
         진행 중 스트림(deliver 의 setMsgs)과의 race 를 피한다(먼저 '중지').
     (D) 조건부 노출 — 버튼은 `msgs.length > 0` 일 때만 렌더(빈 상태엔 미노출).
     (E) abort 방어 — newConversation 이 abortRef.current?.abort() 를 호출(잔류 스트림 차단).
     (F) CSS — .advisor-bar / .advisor-newchat(+:disabled) 정의 존재.
     (G) 무회귀 — 기존 배선(deliver/ask/retry/canRetry/stopGenerating) 보존.

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-advisor-newchat.mjs
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

// newConversation 함수 본문만 잘라 내부 단언에 사용(정밀도 — 다른 함수의 setMsgs 와 격리).
const fnStart = chat.indexOf("function newConversation()");
const fnBody = fnStart >= 0 ? chat.slice(fnStart, chat.indexOf("\n  }", fnStart) + 4) : "";

console.log("\n[A] newConversation 이 대화 상태를 리셋");
{
  ok(fnStart >= 0, "newConversation() 함수 존재");
  ok(/setMsgs\(\[\]\)/.test(fnBody), "setMsgs([]) — 대화 이력 비움");
  ok(/setFeedbackSent\(\{\}\)/.test(fnBody), "setFeedbackSent({}) — 피드백 상태 초기화");
  ok(/setCopied\(null\)/.test(fnBody), "setCopied(null) — 복사 상태 초기화");
}

console.log("\n[B] ★입력란 무영향 — 초안 보존(setInput 무호출·전체 2회 유지)");
{
  ok(!/setInput\(/.test(fnBody), "newConversation 내부에 setInput 호출 없음(초안 보존)");
  ok((chat.match(/setInput\(/g) || []).length === 2,
    "파일 전체 setInput 호출은 2회뿐(onChange·전송 비우기 — 리셋이 새 setInput 추가 안 함)");
}

console.log("\n[C] ★busy 게이트 — 생성 중 무동작 + 버튼 disabled(스트림 race 방지)");
{
  ok(/if \(busy\) return;/.test(fnBody), "newConversation 첫 줄 `if (busy) return;`(생성 중 무동작)");
  // 새 대화 버튼 마크업 — className·onClick·disabled 가 한 버튼에 모여 있는지 확인
  const btnIdx = chat.indexOf('className="advisor-newchat"');
  ok(btnIdx > 0, "advisor-newchat 버튼 존재");
  const btnSeg = chat.slice(btnIdx, btnIdx + 240);
  ok(/onClick=\{newConversation\}/.test(btnSeg), "버튼 onClick → newConversation");
  ok(/disabled=\{busy\}/.test(btnSeg), "버튼 disabled={busy}(생성 중 비활성)");
}

console.log("\n[D] 조건부 노출 — msgs 가 있을 때만 렌더(빈 상태엔 미노출)");
{
  // 새 대화 바는 `{msgs.length > 0 && (` 블록 안에서 advisor-newchat 을 렌더해야 한다.
  const guardIdx = chat.indexOf("{msgs.length > 0 && (");
  const btnIdx = chat.indexOf('className="advisor-newchat"');
  ok(guardIdx > 0, "`{msgs.length > 0 && (` 조건부 블록 존재");
  ok(guardIdx > 0 && btnIdx > guardIdx, "advisor-newchat 버튼이 msgs.length>0 블록 내부에 위치(빈 상태 미노출)");
  // 빈 상태 분기(advisor-empty)는 그대로 보존 — 리셋이 빈 상태 UI 를 깨지 않음
  ok(/className="advisor-empty"/.test(chat), "빈 상태(advisor-empty) UI 보존");
}

console.log("\n[E] abort 방어 — 잔류 스트림 차단");
{
  ok(/abortRef\.current\?\.abort\(\)/.test(fnBody), "newConversation 이 abortRef.current?.abort() 호출(방어)");
}

console.log("\n[F] CSS — .advisor-bar / .advisor-newchat 정의");
{
  ok(/\.advisor-bar\s*\{/.test(css), ".advisor-bar 정의 존재");
  ok(/\.advisor-newchat\s*\{/.test(css), ".advisor-newchat 정의 존재");
  ok(/\.advisor-newchat:disabled\s*\{/.test(css), ".advisor-newchat:disabled 정의(비활성 시각 피드백)");
}

console.log("\n[G] 무회귀 — 기존 배선 보존");
{
  ok(/async function deliver\(base: Msg\[\]\)/.test(chat), "deliver(base) 딜리버리 코어 보존");
  ok(/function ask\(text: string\)/.test(chat), "ask(text) 보존");
  ok(/function retry\(\)/.test(chat), "retry() 보존");
  ok(/const canRetry =/.test(chat), "canRetry 게이트 보존");
  ok(/function stopGenerating\(\)/.test(chat), "stopGenerating() 보존");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
process.exit(fail === 0 ? 0 : 1);
