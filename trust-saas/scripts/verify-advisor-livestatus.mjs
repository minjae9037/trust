/* ============================================================
   회귀 가드 — 상담(advisor·Pillar 2) 스트리밍 답변 상태 스크린리더 고지(aria-live)

   배경(a11y·WCAG 4.1.3 Status Messages, 비-산출물): AdvisorChat 의 답변은 토큰
   단위로 스트리밍돼 `.advisor-msgs` 본문이 매 청크마다 갱신된다. 그러나 본문에는
   aria-live 가 없어 스크린리더 사용자는 ① 전송이 등록돼 생성이 시작됐는지 ② 답변이
   완료됐는지 알 수 없었다(오류만 role="alert" 로 고지됨). 본문에 직접 aria-live 를
   걸면 토큰마다 과다 낭독되므로, 본문 대신 화면에 보이지 않는 폴라이트 라이브 영역
   (`.advisor-live`)에 "생성 중/도착/중지" 같은 간결한 상태 변화만 고지한다.

   핵심 불변식:
     (A) liveMsg 상태 + SR 전용 라이브 영역 렌더(role=status·aria-live=polite·atomic).
     (B) 생성 시작 고지 — deliver 가 setBusy(true) 직후 "생성하고 있습니다" 고지.
     (C) 정상 완료 고지 — 스트림 read 루프 종료 직후(catch 이전) "도착했습니다" 고지.
     (D) 중지 고지 — abort 분기에서만 "중지했습니다" 고지(오류 아님).
     (E) ★이중 낭독 방지 — 오류 분기는 고지 문구가 아니라 setLiveMsg("")(빈 문자열).
         실제 오류는 기존 role="alert" 자리표시자가 낭독한다(고지 영역과 분리).
     (F) ★시작↔도착 교대 — 두 문구가 서로 달라(라이브 영역 내용 변화) 매 답변마다
         재낭독된다. 또한 완료 고지는 스트림 루프 '뒤'라 토큰마다 호출되지 않는다.
     (G) CSS — .advisor-live 가 시각적으로 숨겨짐(clip rect·overflow hidden).
     (H) aria-busy — 메시지 로그(.advisor-msgs)에 aria-busy={busy} 배선.
     (I) 무회귀 — newConversation 이 liveMsg 도 비움 + 기존 배선(deliver/ask/retry/
         stopGenerating·error role="alert") 보존.

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-advisor-livestatus.mjs
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

// deliver 함수 본문만 잘라 위치 기반 단언에 사용(정밀도 — 다른 함수와 격리).
const dStart = chat.indexOf("async function deliver(base: Msg[])");
const dBody = dStart >= 0 ? chat.slice(dStart, chat.indexOf("\n  }", dStart) + 4) : "";

const START_MSG = "답변을 생성하고 있습니다.";
const DONE_MSG = "답변이 도착했습니다.";
const STOP_MSG = "답변 생성을 중지했습니다.";

console.log("\n[A] liveMsg 상태 + SR 전용 라이브 영역 렌더");
{
  ok(/const \[liveMsg, setLiveMsg\] = useState\(""\);/.test(chat), "liveMsg 상태(useState 빈 문자열) 존재");
  const regionIdx = chat.indexOf('className="advisor-live"');
  ok(regionIdx > 0, "advisor-live 라이브 영역 존재");
  const seg = regionIdx > 0 ? chat.slice(regionIdx, regionIdx + 160) : "";
  ok(/role="status"/.test(seg), "라이브 영역 role=\"status\"");
  ok(/aria-live="polite"/.test(seg), "라이브 영역 aria-live=\"polite\"");
  ok(/aria-atomic="true"/.test(seg), "라이브 영역 aria-atomic=\"true\"(전체 낭독)");
  ok(/\{liveMsg\}/.test(seg), "라이브 영역이 {liveMsg} 를 렌더");
}

console.log("\n[B] 생성 시작 고지 — setBusy(true) 직후");
{
  ok(dStart >= 0, "deliver(base) 함수 존재");
  ok(dBody.includes(`setLiveMsg("${START_MSG}")`), "deliver 가 시작 고지 setLiveMsg 호출");
  const busyIdx = dBody.indexOf("setBusy(true)");
  const startIdx = dBody.indexOf(`setLiveMsg("${START_MSG}")`);
  ok(busyIdx >= 0 && startIdx > busyIdx, "시작 고지가 setBusy(true) 뒤에 위치");
}

console.log("\n[C] 정상 완료 고지 — 스트림 루프 종료 직후, catch 이전");
{
  ok(dBody.includes(`setLiveMsg("${DONE_MSG}")`), "deliver 가 완료 고지 setLiveMsg 호출");
  const loopEnd = dBody.indexOf("for (;;)");
  const doneIdx = dBody.indexOf(`setLiveMsg("${DONE_MSG}")`);
  const catchIdx = dBody.indexOf("} catch (e)");
  ok(loopEnd >= 0 && doneIdx > loopEnd, "완료 고지가 for 루프 '뒤'(토큰마다 호출 아님)");
  ok(catchIdx >= 0 && doneIdx < catchIdx, "완료 고지가 catch 이전(try 정상 경로)");
}

console.log("\n[D] 중지 고지 — abort 분기에서만");
{
  ok(dBody.includes(`setLiveMsg("${STOP_MSG}")`), "deliver 가 중지 고지 setLiveMsg 호출");
  const abortIdx = dBody.indexOf("controller.signal.aborted");
  const stopIdx = dBody.indexOf(`setLiveMsg("${STOP_MSG}")`);
  const elseIdx = dBody.indexOf("} else {", abortIdx >= 0 ? abortIdx : 0);
  ok(abortIdx >= 0 && stopIdx > abortIdx, "중지 고지가 aborted 분기 내부");
  ok(elseIdx >= 0 && stopIdx < elseIdx, "중지 고지가 else(오류) 분기 이전 = abort 전용");
}

console.log("\n[E] ★이중 낭독 방지 — 오류 분기는 빈 문자열(고지 문구 아님)");
{
  // else(오류) 분기 구간만 잘라 검사
  const elseIdx = dBody.indexOf("} else {");
  const elseSeg = elseIdx >= 0 ? dBody.slice(elseIdx) : "";
  ok(/setLiveMsg\(""\)/.test(elseSeg), "오류 분기는 setLiveMsg(\"\")(빈 문자열로 비움)");
  ok(!elseSeg.includes(`setLiveMsg("${START_MSG}")`)
    && !elseSeg.includes(`setLiveMsg("${DONE_MSG}")`)
    && !elseSeg.includes(`setLiveMsg("${STOP_MSG}")`), "오류 분기에 고지 문구 setLiveMsg 없음(role=alert 가 낭독)");
  ok(/role="alert"/.test(chat), "기존 오류 자리표시자 role=\"alert\" 보존(실제 오류 낭독)");
}

console.log("\n[F] ★시작↔도착 교대 + 완료 고지가 루프 밖");
{
  ok(START_MSG !== DONE_MSG && DONE_MSG !== STOP_MSG, "세 상태 문구가 서로 달라 내용 변화로 재낭독");
  // 스트림 read 루프 본문(setMsgs 갱신 구간)에는 setLiveMsg 가 없어야 한다(토큰마다 고지 금지).
  const loopStart = dBody.indexOf("for (;;)");
  const loopBodyEnd = dBody.indexOf(`setLiveMsg("${DONE_MSG}")`);
  const loopBody = loopStart >= 0 && loopBodyEnd > loopStart ? dBody.slice(loopStart, loopBodyEnd) : "";
  ok(loopBody.length > 0 && !/setLiveMsg\(/.test(loopBody), "스트림 루프 본문에 setLiveMsg 없음(과다 낭독 회피)");
}

console.log("\n[G] CSS — .advisor-live 시각적 숨김");
{
  const m = css.match(/\.advisor-live\s*\{([^}]*)\}/);
  ok(!!m, ".advisor-live 정의 존재");
  const decl = m ? m[1] : "";
  ok(/clip:\s*rect\(/.test(decl), ".advisor-live clip: rect(...)(시각적 클립)");
  ok(/overflow:\s*hidden/.test(decl), ".advisor-live overflow: hidden");
  ok(/position:\s*absolute/.test(decl), ".advisor-live position: absolute(레이아웃 무영향)");
}

console.log("\n[H] aria-busy — 메시지 로그 배선");
{
  const idx = chat.indexOf('className="advisor-msgs"');
  ok(idx > 0, "advisor-msgs 컨테이너 존재");
  const seg = idx > 0 ? chat.slice(idx, idx + 120) : "";
  ok(/aria-busy=\{busy\}/.test(seg), "advisor-msgs aria-busy={busy} 배선");
}

console.log("\n[I] 무회귀 — newConversation 리셋 + 기존 배선 보존");
{
  const fnStart = chat.indexOf("function newConversation()");
  const fnBody = fnStart >= 0 ? chat.slice(fnStart, chat.indexOf("\n  }", fnStart) + 4) : "";
  ok(/setLiveMsg\(""\)/.test(fnBody), "newConversation 이 liveMsg 도 비움");
  ok(/async function deliver\(base: Msg\[\]\)/.test(chat), "deliver(base) 보존");
  ok(/function ask\(text: string\)/.test(chat), "ask(text) 보존");
  ok(/function retry\(\)/.test(chat), "retry() 보존");
  ok(/function stopGenerating\(\)/.test(chat), "stopGenerating() 보존");
  // setLiveMsg 총 호출 수 = 스트리밍 5(시작·완료·중지·오류비움·새대화비움)
  //   + 복사 결과 고지 2(copyAnswer announce 헬퍼의 비움·세팅) = 7회(과다 배선 회귀 감지)
  ok((chat.match(/setLiveMsg\(/g) || []).length === 7, "setLiveMsg 호출 총 7회(스트리밍 5 + 복사 고지 announce 2)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
process.exit(fail === 0 ? 0 : 1);
