/* ================================================================
   상담 답변의 서류작성 액션 마커 파싱 (클라이언트 표시 경계)

   ⚠️ 페르소나(api/advisor/route.ts)는 사용자가 실제 서류 작성을 원할 때
      LLM 답변 맨 끝줄에 내부 프로토콜 마커(<<doc:collateral|joint|fund>>)
      하나만 출력하도록 지시한다. 클라이언트는 이 마커를 ①본문에서 제거하고
      ②서류작성 버튼(docId)으로 변환해 보여준다(마커 자체는 사용자에게
      노출되지 않는 게 계약).

      그런데 마커는 답변 *맨 끝*에 오고 응답은 토큰 단위로 스트리밍되므로,
      닫는 ">>" 가 도착하기 전 본문 끝에 부분 마커(<<doc:, <<doc:collat …)가
      잠시 남는다. 완성 마커만 제거하면 이 부분 마커가 마크다운 본문에
      그대로 렌더돼 사용자에게 내부 프로토콜 문자열이 깜빡인다.

      → parseAction 은 (a) 완성 마커를 제거해 docId 를 추출하고,
         (b) 본문 끝의 *진행 중(부분)* 마커 조각도 제거해 스트리밍 도중에도
         내부 마커가 노출되지 않게 한다. 순수 함수라 회귀 가드로 고정한다.
   ================================================================ */

/** 서류 작성 액션 식별자 — 단일 출처(페르소나·클라이언트·가드 공유). */
export const DOC_IDS = ["collateral", "joint", "fund"] as const;
export type DocId = (typeof DOC_IDS)[number];

/** 액션 버튼 라벨. */
export const DOC_LABEL: Record<DocId, string> = {
  collateral: "담보신탁",
  joint: "공동사업표준협약서",
  fund: "자금관리대리사무",
};

const ID_ALT = DOC_IDS.join("|");
/** 완성 마커(docId 추출용). */
const MARKER_RE = new RegExp(`<<doc:(${ID_ALT})>>`);
/** 완성 마커 전역 제거용. */
const MARKER_RE_G = new RegExp(`<<doc:(?:${ID_ALT})>>`, "g");
/** 완성 마커 전체 문자열 집합(부분 마커 판별 기준). */
const FULL_MARKERS = DOC_IDS.map((id) => `<<doc:${id}>>`);

/**
 * 본문 끝의 진행 중(부분) 마커 조각 제거 — 스트리밍 도중 노출 방지.
 * 마지막 "<<" 부터의 꼬리가 어떤 완성 마커의 *불완전한 접두사*면(즉 아직
 * 마커가 완성되지 않았으면) 잘라낸다. 단, 단독 "<<"(길이 2)는 마커 시작과
 * 리터럴 "<<"(예: 비트 시프트 `a << b`)를 구분할 수 없으므로 보존한다
 * — "doc" 이 시작되는 "<<d" 이상부터만 마커로 간주(오탐 0). 스트리밍 시
 * "<<" 단독 프레임은 다음 토큰에서 곧 "<<d…" 가 되어 제거되므로 무해하다.
 * 일반 산문의 단일 "<" 역시 lastIndexOf("<<") 미매칭이라 보존된다.
 */
function stripTrailingPartialMarker(s: string): string {
  const lt = s.lastIndexOf("<<");
  if (lt === -1) return s;
  const tail = s.slice(lt);
  if (tail.length < 3) return s; // 단독 "<<" 는 모호 → 보존
  // 완성 마커는 이미 제거됐으므로, 마커의 '진짜 접두사'(길이가 더 짧은)만 매칭.
  if (FULL_MARKERS.some((mk) => mk.startsWith(tail) && mk.length > tail.length)) {
    return s.slice(0, lt).trimEnd();
  }
  return s;
}

/**
 * 답변 본문에서 서류작성 액션 마커를 분리.
 * - body: 완성 마커 + 진행 중 부분 마커를 제거한 표시용 본문
 * - docId: 완성 마커가 있으면 해당 서류 id, 없으면 null
 */
export function parseAction(content: string): { body: string; docId: DocId | null } {
  const m = content.match(MARKER_RE);
  let body = content.replace(MARKER_RE_G, "").trimEnd();
  body = stripTrailingPartialMarker(body);
  return { body, docId: m ? (m[1] as DocId) : null };
}

/** 대화 이력 메시지(요청 경계 정제 대상). */
export interface HistoryMsg {
  role: "user" | "assistant";
  content: string;
}

/**
 * 대화 이력을 /api/advisor 요청으로 보내기 전 정제(요청 경계).
 *
 * assistant 메시지의 content 에는 내부 액션 마커(<<doc:…>>)가 *원시 상태*로
 * 남는다 — 클라이언트는 표시·복사 시 parseAction 으로 제거하지만 상태/이력엔
 * raw 그대로 보관한다. 멀티턴에서 이 이력을 그대로 다시 전송하면, 사용자에게
 * 절대 노출하지 않기로 한 내부 프로토콜 마커가 *모델 컨텍스트로 되돌아간다*
 * (마커 비노출 계약의 송신측 누락 = 표시 경계 제거와 대칭되는 갭). 본 함수는
 * 사용자가 실제로 본 본문(parseAction.body)만 이력으로 전송하고, 마커뿐이라
 * 본문이 빈 assistant 턴은 제외한다(빈 content 전송으로 인한 API 거부 방지).
 * user 메시지는 무변형이며 role·content 외 부가 필드(sources 등)는 떨군다
 * (서버가 어차피 role·content 만 소비). 순수 함수라 회귀 가드로 고정한다.
 */
export function sanitizeHistory(msgs: HistoryMsg[]): HistoryMsg[] {
  const out: HistoryMsg[] = [];
  for (const m of msgs) {
    if (m.role !== "assistant") {
      out.push({ role: m.role, content: m.content });
      continue;
    }
    const body = parseAction(m.content).body;
    if (body.length === 0) continue; // 마커만 있던 턴 → 이력에서 제외
    out.push({ role: "assistant", content: body });
  }
  return out;
}
