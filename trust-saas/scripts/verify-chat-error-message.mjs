/* ============================================================
   회귀 가드 — 계약 대화(chat·Pillar 1) 오류 메시지 친화적 한국어 치환

   배경(UX·정보누출 갭, 비-산출물): 계약(Pillar 1)은 100% 한국어 제품인데 두
   오류 경로가 원문을 그대로 노출했다(상담 측과 동형의 잔여 갭).
     · /api/chat catch — `Claude 호출 실패: <영문 SDK 메시지>` (502, 공개·무인증)
     · ChatPanel catch — `오류: Failed to fetch` (네트워크 영문) / 원시 JSON 본문
   상담(Pillar 2)에서 도입한 분류기를 두 Pillar 공용 단일 출처
   lib/ui/error-message.ts(friendlyErrorMessage)로 승격하고, 계약 측 두 경로를
   여기에 배선했다. 상담 측은 lib/advisor/error-message.ts 가 동일 모듈을
   advisorErrorMessage 로 재노출(하위호환·기존 가드 무변경).

   핵심 불변식:
     - 영문 SDK 메시지/원시 JSON 을 절대 그대로 반환하지 않는다(누출 0).
     - 서버 친화 한국어 {error} 본문은 통과(이중 일반화 방지).
     - 상태코드/키워드별 분류가 안정적이다.
     - /api/chat·ChatPanel 양쪽이 friendlyErrorMessage 를 사용한다(raw 노출 회귀 차단).
     - ChatPanel !res.ok 경로는 서버 원시 JSON 을 raw throw 한다(passthrough 성립).
     - 상담 재노출(advisorErrorMessage)이 friendlyErrorMessage 와 동일 동작(단일 출처).

   단언:
     (A) 영문 SDK 오류 유형별 분류 — 원문 영문 미노출
     (B) 서버 {error} 본문 통과(이중 일반화 없음)
     (C) 상태코드(status/statusCode) 우선 분류
     (D) ★누출 0 — 어떤 입력이든 출력에 영문 원문/원시 JSON 미등장
     (E) 안전 입력(null·숫자·빈 문자열) 무크래시 + 일반 메시지
     (F) 배선 — /api/chat·ChatPanel 가 friendlyErrorMessage 사용·raw 직출 잔존 0
     (G) ★상담 하위호환 — advisorErrorMessage 재노출이 friendlyErrorMessage 동일

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-chat-error-message.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { friendlyErrorMessage, FRIENDLY_ERROR } from "../src/lib/ui/error-message.ts";
import { advisorErrorMessage, ADVISOR_ERROR } from "../src/lib/advisor/error-message.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const isKorean = (s) => /[가-힣]/.test(s);
const ALL_MESSAGES = Object.values(FRIENDLY_ERROR);

console.log("\n[A] 영문 SDK 오류 유형별 분류 — 원문 영문 미노출");
{
  const cases = [
    { raw: new Error("overloaded_error: Overloaded"), want: FRIENDLY_ERROR.server, kind: "overloaded" },
    { raw: new Error("rate_limit_error: too many requests"), want: FRIENDLY_ERROR.busy, kind: "rate limit" },
    { raw: new Error("Request timed out."), want: FRIENDLY_ERROR.timeout, kind: "timeout" },
    { raw: new Error("Connection error."), want: FRIENDLY_ERROR.network, kind: "connection" },
    { raw: new TypeError("Failed to fetch"), want: FRIENDLY_ERROR.network, kind: "fetch(network)" },
    { raw: new Error("getaddrinfo ENOTFOUND api.anthropic.com"), want: FRIENDLY_ERROR.network, kind: "ENOTFOUND" },
  ];
  for (const { raw, want, kind } of cases) {
    const out = friendlyErrorMessage(raw);
    ok(out === want, `${kind} → 분류 메시지 정확`);
    ok(isKorean(out) && !/[a-z]{4,}/i.test(out), `${kind} → 한국어·영문 원문 미노출`);
  }
}

console.log("\n[B] 서버 {error} 본문 통과 — 이중 일반화 없음");
{
  // ChatPanel !res.ok 경로: 서버 NextResponse.json({error}) 를 res.text() 로 받아 raw throw
  ok(friendlyErrorMessage('{"error":"잘못된 요청"}') === "잘못된 요청",
    "400 서버 한국어 {error} 그대로 통과");
  ok(friendlyErrorMessage('{"error":"ANTHROPIC_API_KEY 가 설정되지 않았습니다."}')
    === "ANTHROPIC_API_KEY 가 설정되지 않았습니다.",
    "500 서버 한국어 {error} 그대로 통과");
  // ★/api/chat 502 catch 가 친화 한국어 {error} 를 보내므로, 클라이언트가 그걸
  //   raw JSON 으로 받아도 passthrough 로 원래 친화 메시지를 그대로 보존한다.
  ok(friendlyErrorMessage('{"error":"' + FRIENDLY_ERROR.server + '"}') === FRIENDLY_ERROR.server,
    "502 서버 친화 메시지({error}) 통과 — 재일반화 없음");
  ok(ALL_MESSAGES.includes(friendlyErrorMessage('{"foo":"bar"}')),
    "error 필드 없는 JSON → 일반 메시지(통과 아님)");
  ok(ALL_MESSAGES.includes(friendlyErrorMessage('{"error":""}')),
    "빈 error JSON → 일반 메시지");
}

console.log("\n[C] 상태코드 우선 분류(status/statusCode)");
{
  ok(friendlyErrorMessage({ status: 429, message: "x" }) === FRIENDLY_ERROR.busy, "status 429 → 요청과다");
  ok(friendlyErrorMessage({ status: 529, message: "x" }) === FRIENDLY_ERROR.server, "status 529 → 서버");
  ok(friendlyErrorMessage({ status: 502 }) === FRIENDLY_ERROR.server, "status 502 → 서버(업스트림 Claude)");
  ok(friendlyErrorMessage({ statusCode: 408 }) === FRIENDLY_ERROR.timeout, "statusCode 408 → 타임아웃");
  ok(friendlyErrorMessage({ status: 400 }) === FRIENDLY_ERROR.invalid, "status 400 → 입력 오류");
}

console.log("\n[D] ★누출 0 — 출력에 영문 원문/원시 JSON 미등장");
{
  const leaky = [
    new Error("overloaded_error: the upstream model is Overloaded right now"),
    "Claude 호출 실패: Connection error.",
    "Failed to execute 'fetch' on Window: NetworkError",
    '{"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}',
    new Error("AnthropicError: 500 internal_server_error"),
  ];
  for (const raw of leaky) {
    const out = friendlyErrorMessage(raw);
    ok(ALL_MESSAGES.includes(out), `누출원(${String(raw).slice(0, 24)}…) → 사전 정의 한국어 메시지만`);
    ok(!/overloaded|NetworkError|internal_server|Connection error|\{|\}/.test(out),
      "영문 토큰·중괄호(JSON) 출력 미등장");
  }
}

console.log("\n[E] 안전 입력 무크래시 + 일반 메시지");
{
  for (const raw of [null, undefined, 0, 123, "", "   ", {}, []]) {
    const out = friendlyErrorMessage(raw);
    ok(typeof out === "string" && isKorean(out), `안전 입력(${JSON.stringify(raw)}) → 한국어 문자열`);
  }
  ok(friendlyErrorMessage("요청 실패") === FRIENDLY_ERROR.generic, "분류 불가 평문 → 일반 메시지");
}

console.log("\n[F] 배선 — /api/chat·ChatPanel 가 friendlyErrorMessage 사용");
{
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const route = readFileSync(path.join(root, "src", "app", "api", "chat", "route.ts"), "utf8");
  const panel = readFileSync(path.join(root, "src", "components", "trust", "ChatPanel.tsx"), "utf8");

  // 서버 route — 502 catch 가 friendlyErrorMessage(e) 로 친화 한국어 {error} 반환
  ok(/error:\s*friendlyErrorMessage\(e\)/.test(route), "/api/chat catch 가 friendlyErrorMessage(e) 사용");
  ok(!/Claude 호출 실패/.test(route), "/api/chat 에 'Claude 호출 실패: '+영문 직출 잔존 0");
  ok(!/const\s+msg\s*=\s*e\s+instanceof\s+Error\s*\?\s*e\.message\s*:\s*String\(e\)/.test(route),
    "/api/chat 에 raw e.message 직출 잔존 0");
  ok(/import\s*\{\s*friendlyErrorMessage\s*\}\s*from\s*["']@\/lib\/ui\/error-message["']/.test(route),
    "/api/chat 가 단일 출처 모듈 import");

  // 클라이언트 ChatPanel — catch 가 friendlyErrorMessage(e), !res.ok 는 raw text throw
  ok(/setErr\(friendlyErrorMessage\(e\)\)/.test(panel), "ChatPanel catch 가 friendlyErrorMessage(e) 사용");
  ok(!/setErr\(\s*e\s+instanceof\s+Error\s*\?\s*e\.message\s*:\s*String\(e\)\s*\)/.test(panel),
    "ChatPanel 에 raw e.message 직출 잔존 0");
  ok(/import\s*\{\s*friendlyErrorMessage\s*\}\s*from\s*["']@\/lib\/ui\/error-message["']/.test(panel),
    "ChatPanel 가 단일 출처 모듈 import");
  // ★!res.ok 가 res.text() 원시 본문을 throw 해야 passthrough(이중 일반화 방지) 성립
  ok(/if\s*\(!res\.ok\)\s*\{[\s\S]*?res\.text\(\)[\s\S]*?throw new Error/.test(panel),
    "ChatPanel !res.ok → res.text() 원시 JSON raw throw(passthrough 성립)");
  ok(!/const\s+data\s*=\s*await\s+res\.json\(\);\s*\n\s*if\s*\(!res\.ok\)/.test(panel),
    "ChatPanel 가 res.json() 후 !res.ok throw(추출 문자열 재일반화) 패턴 미사용");
}

console.log("\n[G] ★상담 하위호환 — advisorErrorMessage 재노출이 friendlyErrorMessage 동일");
{
  ok(advisorErrorMessage === friendlyErrorMessage, "advisorErrorMessage === friendlyErrorMessage(동일 함수 재노출)");
  ok(ADVISOR_ERROR === FRIENDLY_ERROR, "ADVISOR_ERROR === FRIENDLY_ERROR(동일 상수 재노출)");
  // 분류 결과 동등(가드 무대상이지만 단일 출처 정합 spot check)
  ok(advisorErrorMessage(new TypeError("Failed to fetch")) === FRIENDLY_ERROR.network,
    "재노출 경유 분류 결과 동일(network)");
  ok(advisorErrorMessage('{"error":"잘못된 요청"}') === "잘못된 요청",
    "재노출 경유 passthrough 동일");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
