/* ============================================================
   회귀 가드 — 계약 대화(chat·Pillar 1) 요청 본문 검증(서버 입력 경계)

   배경(견고성·일관성·정보누출 갭): /api/chat 는 무계정·무인증 공개 POST 다.
   라우트는 req.json() 만 try/catch 로 감싸고, 그 뒤 body.messages 를
   body.messages.map() 으로 **검증 없이** 소비했다. 그 소비가 Claude 호출
   try 블록 *안*이라 잡히지 않은 500 으로 죽지는 않았으나, 형태가 어긋난
   본문({}, {messages:"x"}, {messages:[]}, content 비문자열)이 오면 try 에서
   TypeError 가 터져 **502 "Claude 호출 실패: <영문 TypeError>"** 로 잘못
   분류되었다(클라이언트 400 오류가 업스트림 502 로 둔갑 + 영문 메시지
   노출, 원칙 3). 형제 라우트 /api/advisor(parseAdvisorBody)·/api/advisor/
   feedback 은 본문을 검증해 400 을 주는데 /api/chat 만 무방비였다(마지막
   무검증 AI POST — 일관성·견고성 갭).

   수정: parseChatBody(src/lib/chat/request.ts)가 입력 경계를 단일 지점에서
   검증한다. parseAdvisorBody 와 동일한 messages 규약 + 계약 대화 전용
   formSummary 정규화(문자열 아니면 "" — 프롬프트 "undefined" 주입 방지).
   형태가 맞으면 messages 무변형 반환(동작 보존), 아니면 ok:false + 사유
   (라우트가 400 으로 변환). 순수 함수라 본 가드로 불변식을 고정한다.

   핵심 불변식:
     - 어긋난 본문(비객체·null·messages 없음/비배열/빈 배열/잘못된 원소)
       → ok:false(라우트가 400 으로 변환 = 502 오분류 대신 명시적 거절).
     - 정상 본문 → ok:true + messages **무변형**(라우트 동작 보존).
     - 사용자 발화 0개 → ok:false(유료 호출 낭비·무의미 차단).
     - formSummary 누락·비문자열 → 거절 아님, "" 로 정규화(빈 폼과 동치).

   단언:
     (A) 정상 본문 → ok·messages 무변형(참조/내용 동일)·formSummary 보존
     (B) ★크래시/오분류 유발 본문 → ok:false(비객체·null·messages 누락/
         비배열/빈)
     (C) 원소 형식 오류 → ok:false(role 오류·content 비문자열·null 원소)
     (D) 사용자 발화 없음(assistant 만) → ok:false
     (E) 멀티턴 대화(user+assistant 혼합) 정상 통과·무변형
     (F) ★formSummary 정규화 — 누락·비문자열 → "" / 문자열 → 보존, 거절 아님
     (G) 모든 거절은 error 문자열 동반(라우트 400 메시지 단일 출처)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-chat-request.mjs
   ============================================================ */
import { parseChatBody } from "../src/lib/chat/request.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

console.log("\n[A] 정상 본문 → ok·messages 무변형·formSummary 보존");
{
  const msgs = [{ role: "user", content: "위탁자는 ABC개발 주식회사" }];
  const r = parseChatBody({ messages: msgs, formSummary: "위탁자: 미입력" });
  ok(r.ok === true, "단일 user 본문 통과");
  ok(r.ok && r.messages === msgs, "messages 참조 무변형(복사·변형 없음)");
  ok(r.ok && r.messages.length === 1 && r.messages[0].content === "위탁자는 ABC개발 주식회사", "내용 보존");
  ok(r.ok && r.formSummary === "위탁자: 미입력", "formSummary 보존");
  // 빈 문자열 content 는 형태상 유효(문자열) → 통과(Anthropic 측 처리, 크래시 아님)
  ok(parseChatBody({ messages: [{ role: "user", content: "" }], formSummary: "" }).ok === true, "빈 문자열 content 도 형태 유효");
}

console.log("\n[B] ★크래시/오분류 유발 본문 → ok:false(502 오분류 대신 명시적 거절)");
{
  const bad = [
    undefined, null, 42, "문자열", true,
    {},                         // messages 누락
    { messages: undefined },
    { messages: null },
    { messages: "x" },          // 비배열
    { messages: 123 },
    { messages: {} },
    { messages: [] },           // 빈 배열(map → [] 이지만 대화 없는 유료 호출 무의미·계약상 거절)
  ];
  for (const b of bad) {
    const r = parseChatBody(b);
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
    { messages: [{ role: "user", content: "ok" }, { role: "assistant", content: 5 }] }, // 일부만 오류
  ];
  for (const b of bad) {
    const r = parseChatBody(b);
    ok(r.ok === false, `거절(원소 오류): ${JSON.stringify(b)}`);
  }
}

console.log("\n[D] 사용자 발화 없음(assistant 만) → ok:false");
{
  ok(parseChatBody({ messages: [{ role: "assistant", content: "안녕하세요" }] }).ok === false, "assistant 단독 거절");
  ok(parseChatBody({ messages: [{ role: "assistant", content: "a" }, { role: "assistant", content: "b" }] }).ok === false, "assistant 연속 거절");
}

console.log("\n[E] 멀티턴 대화(user+assistant) 정상 통과·무변형");
{
  const msgs = [
    { role: "assistant", content: "위탁자 상호부터 알려주세요" },
    { role: "user", content: "ABC개발 주식회사" },
    { role: "assistant", content: "확인했습니다. 우선수익자는?" },
    { role: "user", content: "○○은행 50억, 비율 120%" },
  ];
  const r = parseChatBody({ messages: msgs, formSummary: "위탁자: ABC개발" });
  ok(r.ok === true, "4턴 대화 통과");
  ok(r.ok && r.messages.length === 4, "전 메시지 보존");
  ok(r.ok && r.messages === msgs, "멀티턴도 무변형");
}

console.log("\n[F] ★formSummary 정규화 — 누락·비문자열 → '' / 문자열 → 보존(거절 아님)");
{
  const msgs = [{ role: "user", content: "ABC개발" }];
  // 누락 → "" (프롬프트 'undefined' 주입 방지), 거절 아님
  const noSummary = parseChatBody({ messages: msgs });
  ok(noSummary.ok === true && noSummary.formSummary === "", "formSummary 누락 → '' 정규화·통과");
  // 비문자열 5종 → "" 정규화·통과
  for (const v of [null, 123, true, {}, []]) {
    const r = parseChatBody({ messages: msgs, formSummary: v });
    ok(r.ok === true && r.formSummary === "", `비문자열 formSummary(${JSON.stringify(v)}) → '' 정규화·통과`);
  }
  // 빈 문자열은 그대로 보존
  ok(parseChatBody({ messages: msgs, formSummary: "" }).formSummary === "", "빈 문자열 formSummary 보존");
  // 정상 폼 요약 보존
  const kept = parseChatBody({ messages: msgs, formSummary: "위탁자: 미입력\n우선수익자: 1명" });
  ok(kept.ok === true && kept.formSummary === "위탁자: 미입력\n우선수익자: 1명", "정상 formSummary 보존");
  // ★어떤 입력에도 formSummary 는 항상 string(프롬프트 안전)
  ok(typeof noSummary.formSummary === "string" && noSummary.ok, "정규화 결과 항상 string");
}

console.log("\n[G] 모든 거절은 error 문자열 동반(라우트 400 메시지 단일 출처)");
{
  const rejects = [
    parseChatBody({}),
    parseChatBody({ messages: [] }),
    parseChatBody({ messages: [{ role: "x", content: "y" }] }),
    parseChatBody({ messages: [{ role: "assistant", content: "y" }] }),
    parseChatBody(null),
  ];
  ok(rejects.every((r) => r.ok === false && typeof r.error === "string" && r.error.length > 0), "전 거절 사유 문자열 존재");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
if (fail > 0) process.exit(1);
