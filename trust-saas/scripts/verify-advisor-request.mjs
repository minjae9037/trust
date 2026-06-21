/* ============================================================
   회귀 가드 — 상담(advisor·Pillar 2) 요청 본문 검증(서버 입력 경계)

   배경(견고성·일관성 갭): /api/advisor 는 무계정·무인증 공개 POST 다.
   라우트는 req.json() 만 try/catch 로 감싸고, 그 뒤 body.messages 를
   [...body.messages].reverse() · body.messages.map() 으로 **검증 없이**
   소비했다. JSON 으로는 유효하나 형태가 어긋난 본문({}, {messages:"x"},
   {messages:[]}, content 가 문자열 아님)이 오면 try/catch *밖*에서
   TypeError 가 터져 라우트가 잡히지 않은 500 으로 죽었다. 형제 라우트
   feedback/route.ts 는 body 를 검증해 깔끔한 400 을 주는데 메인 라우트만
   무방비였다(일관성·견고성 갭).

   수정: parseAdvisorBody(src/lib/advisor/request.ts)가 입력 경계를 단일
   지점에서 검증한다. 형태가 맞으면 messages 를 무변형 반환(동작 보존),
   아니면 ok:false + 사유(라우트가 400 으로 변환). 순수 함수라 본 가드로
   불변식을 고정한다.

   핵심 불변식:
     - 어긋난 본문(비객체·null·messages 없음/비배열/빈 배열/잘못된 원소)
       → ok:false(라우트가 400 으로 변환 = 크래시 대신 명시적 거절).
     - 정상 본문 → ok:true + messages **무변형**(라우트 동작 보존).
     - 사용자 발화 0개 → ok:false(유료 호출 낭비·무의미 차단).

   단언:
     (A) 정상 본문 → ok·messages 무변형(참조/내용 동일)
     (B) ★크래시 유발 본문 → ok:false(비객체·null·messages 누락/비배열/빈)
     (C) 원소 형식 오류 → ok:false(role 오류·content 비문자열·null 원소)
     (D) 사용자 발화 없음(assistant 만) → ok:false
     (E) 멀티턴 대화(user+assistant 혼합) 정상 통과
     (F) 모든 거절은 error 문자열 동반(라우트 400 메시지 단일 출처)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-advisor-request.mjs
   ============================================================ */
import { parseAdvisorBody } from "../src/lib/advisor/request.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

console.log("\n[A] 정상 본문 → ok·messages 무변형");
{
  const msgs = [{ role: "user", content: "담보신탁 구조 설명해줘" }];
  const r = parseAdvisorBody({ messages: msgs });
  ok(r.ok === true, "단일 user 본문 통과");
  ok(r.ok && r.messages === msgs, "messages 참조 무변형(복사·변형 없음)");
  ok(r.ok && r.messages.length === 1 && r.messages[0].content === "담보신탁 구조 설명해줘", "내용 보존");
  // 빈 문자열 content 는 형태상 유효(문자열) → 통과(Anthropic 측 처리, 크래시 아님)
  ok(parseAdvisorBody({ messages: [{ role: "user", content: "" }] }).ok === true, "빈 문자열 content 도 형태 유효");
}

console.log("\n[B] ★크래시 유발 본문 → ok:false(500 대신 명시적 거절)");
{
  const bad = [
    undefined, null, 42, "문자열", true,
    {},                         // messages 누락
    { messages: undefined },
    { messages: null },
    { messages: "x" },          // 비배열
    { messages: 123 },
    { messages: {} },
    { messages: [] },           // 빈 배열(reverse().find → undefined 는 ok지만 API 호출 무의미·계약상 거절)
  ];
  for (const b of bad) {
    const r = parseAdvisorBody(b);
    ok(r.ok === false, `거절: ${JSON.stringify(b)}`);
  }
}

console.log("\n[C] 원소 형식 오류 → ok:false");
{
  const bad = [
    { messages: [null] },
    { messages: [42] },
    { messages: ["문자열"] },
    { messages: [{ role: "system", content: "x" }] },   // 허용되지 않은 role
    { messages: [{ role: "user" }] },                    // content 누락
    { messages: [{ role: "user", content: 123 }] },      // content 비문자열
    { messages: [{ role: "user", content: null }] },
    { messages: [{ content: "x" }] },                    // role 누락
    { messages: [{ role: "user", content: "ok" }, { role: "user", content: 5 }] }, // 일부만 오류
  ];
  for (const b of bad) {
    const r = parseAdvisorBody(b);
    ok(r.ok === false, `거절(원소 오류): ${JSON.stringify(b)}`);
  }
}

console.log("\n[D] 사용자 발화 없음(assistant 만) → ok:false");
{
  ok(parseAdvisorBody({ messages: [{ role: "assistant", content: "안녕하세요" }] }).ok === false, "assistant 단독 거절");
  ok(parseAdvisorBody({ messages: [{ role: "assistant", content: "a" }, { role: "assistant", content: "b" }] }).ok === false, "assistant 연속 거절");
}

console.log("\n[E] 멀티턴 대화(user+assistant) 정상 통과");
{
  const msgs = [
    { role: "user", content: "담보신탁이 뭐야?" },
    { role: "assistant", content: "담보신탁은 …" },
    { role: "user", content: "관리형토지신탁과 차이는?" },
  ];
  const r = parseAdvisorBody({ messages: msgs });
  ok(r.ok === true, "3턴 대화 통과");
  ok(r.ok && r.messages.length === 3, "전 메시지 보존");
  ok(r.ok && r.messages === msgs, "멀티턴도 무변형");
}

console.log("\n[F] 모든 거절은 error 문자열 동반(라우트 400 메시지 단일 출처)");
{
  const rejects = [
    parseAdvisorBody({}),
    parseAdvisorBody({ messages: [] }),
    parseAdvisorBody({ messages: [{ role: "x", content: "y" }] }),
    parseAdvisorBody({ messages: [{ role: "assistant", content: "y" }] }),
  ];
  ok(rejects.every((r) => r.ok === false && typeof r.error === "string" && r.error.length > 0), "전 거절 사유 문자열 존재");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
if (fail > 0) process.exit(1);
