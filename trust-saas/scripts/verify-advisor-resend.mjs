/* ============================================================
   회귀 가드 — 상담 답변(advisor·Pillar 2) 생성 실패 시 무손실 재시도("다시 시도")

   배경(유실 마찰, 비-산출물): AdvisorChat.ask 는 전송 직전 setInput("") 로 입력을
   비운 뒤, 실패 시 마지막 assistant 자리표시자를 "오류: …" 로 바꾸기만 했다 →
   사용자는 질문을 다시 타이핑해야 했다(계약 작성 ChatPanel 은 verify-chat-resend
   로 무손실 재전송을 이미 갖췄으나 상담측엔 부재하던 패리티 갭). 입력란을 원문으로
   복원하는 방식은 "실패 중 새로 타이핑한 내용을 덮어쓰는" 새 유실을 만든다. 그래서
   입력란은 건드리지 않고, 실패한 사용자 질문이 이력에 버블로 보존된 점을 이용해
   동일 이력을 그대로 재전송하는 retry() 를 도입했다(딜리버리 코어 deliver(base) 를
   최초 질문·재시도가 공용, 송신 페이로드 단일 출처 = sanitizeHistory).

   ※ sanitizeHistory 의 마커 정제·빈 턴 제외 계약 자체는 verify-advisor-history-sanitize
      가, 중지(abort) 분기는 verify-advisor-stop 이 고정한다. 본 가드는 **재시도 불변식**
      (실패 후 동일 이력 재전송 = 원문 재타이핑 0 · 오류 자리표시자 미전송 · 질문 무손실)에
      집중한다.

   핵심 불변식:
     (B) ★재전송 동일성 — retry 의 base(= msgs.slice(0,-1))로 만든 송신 페이로드가
         최초 전송 base 의 페이로드와 **완전히 동일**(멱등·무손실·질문 무중복).
     (C) ★오류 자리표시자 미전송 — "오류: …"(error:true) 메시지는 재전송 페이로드에
         절대 포함되지 않는다(슬라이스로 제거). 슬라이스 없이 보내면 모델이 "오류:"를
         컨텍스트로 받게 됨을 대조로 증명.
     (E) 배선 — AdvisorChat 에 deliver/ask/retry · canRetry 게이트 · "다시 시도" 버튼 ·
         error:true 플래그 · 입력란 무복원(setInput 은 비우기/onChange 2회뿐).

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-advisor-resend.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { sanitizeHistory, parseAction } from "../src/lib/advisor/action-marker.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 대표 이력: 이전 성공 턴(완성 액션 마커 포함) + 이번 질문(아직 미응답).
// ※ AdvisorChat 의 assistant content 에는 내부 마커 <<doc:…>> 가 raw 로 남고,
//   sanitizeHistory 가 송신 시 본문만 남긴다(마커 비노출 계약). 재시도도 이 단일
//   출처를 그대로 거치므로 마커 정제가 재전송에서도 유지돼야 한다.
const PREV = [
  { role: "assistant", content: "무엇을 도와드릴까요?" },
  { role: "user", content: "담보신탁이 뭐야?" },
  { role: "assistant", content: "담보신탁은 …입니다.<<doc:collateral>>" },
];
const QUESTION = { role: "user", content: "우선수익권 구조를 설명해줘" };

// ask() 의 최초 전송 base = [...msgs, 질문]
const firstBase = [...PREV, QUESTION];
// 전송 실패 후 화면 이력 = [...firstBase, 오류 자리표시자(error:true)]
const errorPlaceholder = { role: "assistant", content: "오류: 일시적인 오류가 발생했습니다.", error: true };
const afterError = [...firstBase, errorPlaceholder];
// retry() 의 base = msgs.slice(0,-1) → 오류 자리표시자 한 개만 제거(= 질문으로 끝남)
const retryBase = afterError.slice(0, -1);

console.log("\n[A] 재시도 base 도출 — 오류 자리표시자만 떼고 질문으로 끝남");
{
  ok(retryBase.length === firstBase.length, "slice(0,-1) 후 길이 = 최초 base 와 동일");
  ok(eq(retryBase, firstBase), "retry base 가 최초 전송 base 와 동일(이전 턴·질문 보존)");
  const last = retryBase[retryBase.length - 1];
  ok(last.role === "user" && last.content === QUESTION.content,
    "재전송 이력 말미 = 미응답 사용자 질문(원문 재타이핑 0)");
}

console.log("\n[B] ★재전송 동일성 — 송신 페이로드 멱등·무손실·질문 무중복");
{
  const firstPayload = sanitizeHistory(firstBase);
  const retryPayload = sanitizeHistory(retryBase);
  ok(eq(firstPayload, retryPayload), "최초 전송 ↔ 재시도 송신 페이로드 완전 동일(멱등)");
  ok(eq(sanitizeHistory(firstBase), sanitizeHistory(firstBase)), "동일 이력 2회 정제 → 동일(순수·멱등)");

  const last = retryPayload[retryPayload.length - 1];
  ok(last.role === "user" && last.content === QUESTION.content,
    "질문이 재전송 페이로드 말미에 손실·변형 없이 포함");
  ok(retryPayload.filter((m) => m.role === "user").length === 2,
    "사용자 메시지 중복 추가 0(질문 2개 그대로 — 이전 1 + 이번 1)");

  // 마커 정제도 재전송에서 유지 — 이전 성공 턴의 <<doc:collateral>> 가 송신 본문에 미등장
  ok(!retryPayload.some((m) => /<<doc:/.test(m.content)),
    "내부 액션 마커가 재전송 페이로드에 미등장(마커 비노출 계약 유지)");
}

console.log("\n[C] ★오류 자리표시자 미전송 — 슬라이스 없이 보내면 모델이 오류를 컨텍스트로 받음(대조)");
{
  // retry 가 슬라이스한 base: "오류:" 미포함
  ok(!retryBase.some((m) => /^오류:/.test(m.content)), "retry base 에 오류 자리표시자 미포함");
  ok(!sanitizeHistory(retryBase).some((m) => /^오류:/.test(m.content)),
    "재전송 송신 페이로드에 '오류:' 미등장(실패 신호가 모델로 새지 않음)");

  // ★대조: 만약 슬라이스를 빼고 afterError 를 그대로 보냈다면 "오류:" 가 컨텍스트로 들어갔을 것
  const wrongPayload = sanitizeHistory(afterError);
  ok(wrongPayload.some((m) => /^오류:/.test(m.content)),
    "대조: 오류 자리표시자를 안 떼면 '오류:'가 송신됨 → slice(0,-1) 의 필요성 입증");
  ok(sanitizeHistory(retryBase).length === wrongPayload.length - 1,
    "slice 가 정확히 오류 자리표시자 1개만 제거(다른 턴 손실 0)");
}

console.log("\n[D] 안전 — 빈 이력·마커뿐 assistant 턴 제외(기존 정제 계약 무회귀)");
{
  ok(eq(sanitizeHistory([]), []), "빈 이력 → 빈 배열");
  // 마커만 있던 assistant 턴은 본문이 비어 제외(빈 content 전송 방지)
  const markerOnly = [{ role: "user", content: "서류 만들어줘" }, { role: "assistant", content: "<<doc:collateral>>" }];
  const out = sanitizeHistory(markerOnly);
  ok(out.length === 1 && out[0].role === "user", "마커뿐 assistant 턴 제외(본문 빈 턴 미전송)");
  // parseAction 으로 본문/마커 분리가 유지됨(재전송도 이 경로 사용)
  ok(parseAction("답변<<doc:joint>>").docId === "joint", "parseAction 마커 추출 계약 보존");
}

console.log("\n[E] 배선 — AdvisorChat deliver/ask/retry · canRetry · '다시 시도' · 입력 무복원");
{
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const chat = readFileSync(path.join(root, "src", "components", "advisor", "AdvisorChat.tsx"), "utf8");

  ok(/async function deliver\(base: Msg\[\]\)/.test(chat), "deliver(base) 딜리버리 코어 존재");
  ok(/function ask\(text: string\)/.test(chat), "ask(text) 존재");
  ok(/function retry\(\)/.test(chat), "retry() 존재");
  ok(/void deliver\(\[\.\.\.msgs,/.test(chat), "ask() 가 [...msgs, 질문] 으로 deliver 위임");
  ok(/void deliver\(msgs\.slice\(0, -1\)\)/.test(chat), "retry() 가 오류 자리표시자만 떼고 재전송(msgs.slice(0,-1))");
  ok(/sanitizeHistory\(base\)/.test(chat), "deliver 가 sanitizeHistory(base) 단일 출처로 송신");

  // 오류 자리표시자에 error:true 플래그
  ok(/content: "오류: " \+ msg, error: true/.test(chat), "실패 시 자리표시자에 error:true 플래그");
  // 재시도 버튼 + canRetry 게이트
  ok(/canRetry/.test(chat) && /다시 시도/.test(chat), "'다시 시도' 버튼 + canRetry 게이트 존재");
  ok(/const canRetry = !busy && lastMsg\?\.role === "assistant" && !!lastMsg\.error/.test(chat),
    "canRetry = 비-busy + 마지막이 오류 자리표시자(error:true)");
  ok(/onClick=\{retry\}/.test(chat), "재시도 버튼 onClick → retry");

  // 오류 메시지에는 피드백/복사 footer 미노출 — error 분기가 parseAction footer 보다 먼저 return
  const mapSeg = chat.slice(chat.indexOf("msgs.map"));
  const errIdx = mapSeg.indexOf("if (m.error)");
  const footerIdx = mapSeg.indexOf("advisor-feedback");
  ok(errIdx > 0 && footerIdx > errIdx, "error 분기가 피드백 footer 렌더보다 먼저 return(오류엔 피드백/복사 미노출)");

  // ★입력란 무복원 — 질문 원문(q/text)으로 setInput 복원 잔존 0
  ok(!/setInput\(\s*q\s*\)/.test(chat) && !/setInput\(\s*text\s*\)/.test(chat),
    "setInput(q)/setInput(text) 입력 복원 잔존 0(실패 중 타이핑 무손실)");
  ok((chat.match(/setInput\(/g) || []).length === 2,
    "setInput 호출은 onChange·전송 시 비우기 2회뿐(복원 추가 없음)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
process.exit(fail === 0 ? 0 : 1);
