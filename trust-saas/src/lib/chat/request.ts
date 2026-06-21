/* ================================================================
   계약 대화(chat·Pillar 1) 요청 본문 검증 (서버 입력 경계)

   ⚠️ /api/chat 는 무계정·무인증 공개 POST 엔드포인트다(로컬 우선 구조).
      라우트는 req.json() 만 try/catch 로 감싸고, 그 뒤 body.messages 를
      body.messages.map() (Claude 전송) 으로 **검증 없이** 소비했다.
      messages 소비가 Claude 호출 try 블록 *안*이라 잡히지 않은 500 으로
      죽지는 않았으나, 형태가 어긋난 본문({}, {messages:"x"}, {messages:[]},
      content 비문자열)이 오면 try 블록에서 TypeError 가 터져 **502 "Claude
      호출 실패: <영문 TypeError>"** 로 잘못 분류되었다. 즉 클라이언트 입력
      오류(400 마땅)가 업스트림 Claude 장애(502)로 둔갑하고, 무인증 공개
      엔드포인트가 영문 SDK/런타임 메시지를 그대로 노출(원칙 3 정보누출)했다.
      형제 경로 /api/advisor 는 parseAdvisorBody 로, /api/advisor/feedback 은
      인라인으로 본문을 검증해 깔끔한 400 을 주는데, /api/chat 만 무방비였다
      (마지막 무검증 AI POST — 일관성·견고성 갭).

      → parseChatBody 로 입력 경계를 단일 지점에서 검증한다. parseAdvisorBody
        와 동일한 messages 규약을 쓰되, 계약 대화는 시스템 프롬프트에 폼 요약
        (formSummary)도 주입하므로 함께 정규화한다. 형태가 맞으면 messages 를
        그대로(무변형) 돌려주고(동작 보존), 어긋나면 400 사유를 준다. 순수
        함수라 회귀 가드로 고정한다. 전송·페르소나·도구 정의 무접촉.
   ================================================================ */

/** Claude 전송 메시지 — 라우트가 그대로 messages.map 에 쓰는 형태. */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type ParsedChatBody =
  | { ok: true; messages: ChatMessage[]; formSummary: string }
  | { ok: false; error: string };

function isValidMessage(m: unknown): m is ChatMessage {
  if (typeof m !== "object" || m === null) return false;
  const { role, content } = m as { role?: unknown; content?: unknown };
  return (role === "user" || role === "assistant") && typeof content === "string";
}

/**
 * 계약 대화 요청 본문 검증.
 * - messages 가 비어있지 않은 배열이고
 * - 모든 원소가 {role:"user"|"assistant", content:string} 이며
 * - 사용자 발화가 최소 1개 있어야(대화 없이 유료 호출 무의미·낭비 방지) 통과.
 * 유효하면 messages 를 무변형으로 반환(라우트 동작 보존)하고, formSummary 는
 * 문자열로 정규화한다(누락·비문자열 → "" : 프롬프트에 "undefined" 주입 방지).
 *   ※ 크래시/오분류 벡터는 messages 뿐이라 messages 만 엄격 검증하고, formSummary
 *     누락은 빈 폼과 동치이므로 거절 사유가 아니라 정규화로 흡수한다.
 */
export function parseChatBody(raw: unknown): ParsedChatBody {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "messages 배열이 필요합니다." };
  }
  const messages = (raw as { messages?: unknown }).messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, error: "messages 배열이 필요합니다." };
  }
  if (!messages.every(isValidMessage)) {
    return { ok: false, error: "messages 형식이 올바르지 않습니다." };
  }
  if (!messages.some((m) => m.role === "user")) {
    return { ok: false, error: "사용자 메시지가 필요합니다." };
  }
  const rawSummary = (raw as { formSummary?: unknown }).formSummary;
  const formSummary = typeof rawSummary === "string" ? rawSummary : "";
  return { ok: true, messages: messages as ChatMessage[], formSummary };
}
