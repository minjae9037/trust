/* ================================================================
   상담(advisor·Pillar 2) 요청 본문 검증 (서버 입력 경계)

   ⚠️ /api/advisor 는 무계정·무인증 공개 POST 엔드포인트다(로컬 우선 구조).
      라우트는 req.json() 만 try/catch 로 감싸고, 그 뒤 body.messages 를
      [...body.messages].reverse() (최근 사용자 발화 탐색) · body.messages.map()
      (Claude 전송) 으로 **검증 없이** 소비했다. 그래서 JSON 으로는 유효하나
      형태가 어긋난 본문({}, {messages:"x"}, {messages:[]}, content 가 문자열이
      아닌 경우)이 오면 try/catch 밖에서 TypeError 가 터져 라우트가 **잡히지
      않은 500** 으로 죽었다(형제 라우트인 feedback/route.ts 는 body 를 검증해
      깔끔한 400 을 주는데, 메인 라우트만 무방비였다 — 일관성·견고성 갭).

      → parseAdvisorBody 로 입력 경계를 단일 지점에서 검증한다. 형태가 맞으면
        messages 를 그대로(무변형) 돌려주고(동작 보존), 어긋나면 400 사유를
        준다. 순수 함수라 회귀 가드로 고정한다. 전송·검색·페르소나 무접촉.
   ================================================================ */

/** Claude 전송 메시지 — 라우트가 그대로 messages.map 에 쓰는 형태. */
export interface AdvisorMessage {
  role: "user" | "assistant";
  content: string;
}

export type ParsedAdvisorBody =
  | { ok: true; messages: AdvisorMessage[] }
  | { ok: false; error: string };

function isValidMessage(m: unknown): m is AdvisorMessage {
  if (typeof m !== "object" || m === null) return false;
  const { role, content } = m as { role?: unknown; content?: unknown };
  return (role === "user" || role === "assistant") && typeof content === "string";
}

/**
 * 상담 요청 본문 검증.
 * - messages 가 비어있지 않은 배열이고
 * - 모든 원소가 {role:"user"|"assistant", content:string} 이며
 * - 사용자 발화가 최소 1개 있어야(상담은 user 턴 없이 의미 없음·유료 호출 낭비 방지) 통과.
 * 유효하면 messages 를 무변형으로 반환(라우트 동작 보존), 아니면 사유 반환.
 */
export function parseAdvisorBody(raw: unknown): ParsedAdvisorBody {
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
  return { ok: true, messages: messages as AdvisorMessage[] };
}
