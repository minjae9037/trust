/* ============================================================
   회귀 가드 — 상담(advisor) 오류 메시지 친화적 한국어 치환

   배경(UX·가드레일 갭, 비-산출물): 상담(Pillar 2)은 100% 한국어 제품인데
   두 오류 경로가 원문을 그대로 노출했다.
     · route.ts mid-stream catch — `[오류] overloaded_error …`(영문 SDK 메시지)
     · AdvisorChat fetch catch  — `오류: {"error":"잘못된 요청"}`(원시 JSON 본문)
   공개·무인증 엔드포인트라 영문 내부 메시지·원시 JSON 노출은 정보 누출이기도
   하다. 이제 단일 출처 advisorErrorMessage 가 상태코드·키워드로 분류해 친화적
   한국어로 치환하고, 서버가 이미 한국어로 보낸 {error} 본문은 그대로 통과시킨다.

   핵심 불변식:
     - 영문 SDK 메시지/원시 JSON 을 절대 그대로 반환하지 않는다(누출 0).
     - 서버 친화 한국어 {error} 본문은 통과(이중 일반화 방지).
     - 상태코드/키워드별 분류가 안정적이다(429=요청과다·5xx=서버·연결=네트워크 등).
     - route.ts·AdvisorChat 양쪽이 advisorErrorMessage 를 사용한다(raw 노출 회귀 차단).

   단언:
     (A) 영문 SDK 오류 유형별 분류 — 원문 영문 미노출
     (B) 서버 {error} 본문 통과(이중 일반화 없음)
     (C) 상태코드(status/statusCode) 우선 분류
     (D) ★누출 0 — 어떤 입력이든 출력에 영문 원문/원시 JSON 미등장
     (E) 안전 입력(null·숫자·빈 문자열) 무크래시 + 일반 메시지
     (F) 배선 — route.ts·AdvisorChat 가 advisorErrorMessage 사용·raw 직출 잔존 0

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-advisor-error-message.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { advisorErrorMessage, ADVISOR_ERROR } from "../src/lib/advisor/error-message.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const isKorean = (s) => /[가-힣]/.test(s);
const ALL_MESSAGES = Object.values(ADVISOR_ERROR);

console.log("\n[A] 영문 SDK 오류 유형별 분류 — 원문 영문 미노출");
{
  const cases = [
    { raw: new Error("overloaded_error: Overloaded"), want: ADVISOR_ERROR.server, kind: "overloaded" },
    { raw: new Error("rate_limit_error: too many requests"), want: ADVISOR_ERROR.busy, kind: "rate limit" },
    { raw: new Error("Request timed out."), want: ADVISOR_ERROR.timeout, kind: "timeout" },
    { raw: new Error("Connection error."), want: ADVISOR_ERROR.network, kind: "connection" },
    { raw: new TypeError("Failed to fetch"), want: ADVISOR_ERROR.network, kind: "fetch(network)" },
    { raw: new Error("getaddrinfo ENOTFOUND api.anthropic.com"), want: ADVISOR_ERROR.network, kind: "ENOTFOUND" },
  ];
  for (const { raw, want, kind } of cases) {
    const out = advisorErrorMessage(raw);
    ok(out === want, `${kind} → 분류 메시지 정확`);
    ok(isKorean(out) && !/[a-z]{4,}/i.test(out), `${kind} → 한국어·영문 원문 미노출`);
  }
}

console.log("\n[B] 서버 {error} 본문 통과 — 이중 일반화 없음");
{
  // 클라이언트 !res.ok 경로: 서버가 NextResponse.json({error}) 로 보낸 본문 문자열
  ok(advisorErrorMessage('{"error":"잘못된 요청"}') === "잘못된 요청",
    "400 서버 한국어 {error} 그대로 통과");
  ok(advisorErrorMessage('{"error":"ANTHROPIC_API_KEY 가 설정되지 않았습니다."}')
    === "ANTHROPIC_API_KEY 가 설정되지 않았습니다.",
    "500 서버 한국어 {error} 그대로 통과");
  // error 필드 없는/빈 JSON 은 통과 아님 → 일반 분류
  ok(ALL_MESSAGES.includes(advisorErrorMessage('{"foo":"bar"}')),
    "error 필드 없는 JSON → 일반 메시지(통과 아님)");
  ok(ALL_MESSAGES.includes(advisorErrorMessage('{"error":""}')),
    "빈 error JSON → 일반 메시지");
}

console.log("\n[C] 상태코드 우선 분류(status/statusCode)");
{
  ok(advisorErrorMessage({ status: 429, message: "x" }) === ADVISOR_ERROR.busy, "status 429 → 요청과다");
  ok(advisorErrorMessage({ status: 529, message: "x" }) === ADVISOR_ERROR.server, "status 529 → 서버");
  ok(advisorErrorMessage({ status: 503 }) === ADVISOR_ERROR.server, "status 503 → 서버");
  ok(advisorErrorMessage({ statusCode: 408 }) === ADVISOR_ERROR.timeout, "statusCode 408 → 타임아웃");
  ok(advisorErrorMessage({ status: 400 }) === ADVISOR_ERROR.invalid, "status 400 → 입력 오류");
}

console.log("\n[D] ★누출 0 — 출력에 영문 원문/원시 JSON 미등장");
{
  const leaky = [
    new Error("overloaded_error: the upstream model is Overloaded right now"),
    "Failed to execute 'fetch' on Window: NetworkError",
    '{"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}',
    new Error("AnthropicError: 500 internal_server_error"),
  ];
  for (const raw of leaky) {
    const out = advisorErrorMessage(raw);
    ok(ALL_MESSAGES.includes(out), `누출원(${String(raw).slice(0, 24)}…) → 사전 정의 한국어 메시지만`);
    ok(!/overloaded|NetworkError|internal_server|\{|\}/.test(out),
      "영문 토큰·중괄호(JSON) 출력 미등장");
  }
}

console.log("\n[E] 안전 입력 무크래시 + 일반 메시지");
{
  for (const raw of [null, undefined, 0, 123, "", "   ", {}, []]) {
    const out = advisorErrorMessage(raw);
    ok(typeof out === "string" && isKorean(out), `안전 입력(${JSON.stringify(raw)}) → 한국어 문자열`);
  }
  ok(advisorErrorMessage("요청 실패") === ADVISOR_ERROR.generic, "분류 불가 평문 → 일반 메시지");
}

console.log("\n[F] 배선 — route.ts·AdvisorChat 가 advisorErrorMessage 사용");
{
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const route = readFileSync(path.join(root, "src", "app", "api", "advisor", "route.ts"), "utf8");
  const chat = readFileSync(path.join(root, "src", "components", "advisor", "AdvisorChat.tsx"), "utf8");

  ok(/advisorErrorMessage\(e\)/.test(route), "route.ts mid-stream catch 가 advisorErrorMessage(e) 사용");
  ok(!/e\s+instanceof\s+Error\s*\?\s*e\.message\s*:\s*String\(e\)/.test(route),
    "route.ts 에 raw e.message 직출 잔존 0");
  ok(/import\s*\{\s*advisorErrorMessage\s*\}\s*from\s*["']@\/lib\/advisor\/error-message["']/.test(route),
    "route.ts 가 단일 출처 모듈 import");

  ok(/advisorErrorMessage\(e\)/.test(chat), "AdvisorChat catch 가 advisorErrorMessage(e) 사용");
  ok(!/const\s+msg\s*=\s*e\s+instanceof\s+Error\s*\?\s*e\.message\s*:\s*String\(e\)/.test(chat),
    "AdvisorChat 에 raw e.message 직출 잔존 0");
  ok(/import\s*\{\s*advisorErrorMessage\s*\}\s*from\s*["']@\/lib\/advisor\/error-message["']/.test(chat),
    "AdvisorChat 가 단일 출처 모듈 import");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
