/* ================================================================
   생성 확인 신선도(genFreshness) — "✓ 생성 완료" 확인이 그 시점의
   입력 상태에 대해서만 유효함을 판정하는 순수 함수.

   신탁 서류는 법적 효력 문서다(운영원칙 2: 정확성 최우선). 사용자가
   Word/PDF 를 생성한 뒤 입력을 고치면(예: 금액 오타 정정·당사자 수정)
   버튼 옆 "✓ 생성 완료" 확인이 그대로 남아, 이미 내려받은 구버전이
   최신인 것처럼 오해할 수 있다 — 잘못된 버전을 그대로 제출하는 위험.
   → 생성 시점의 입력 스냅샷과 현재 입력을 비교해, 바뀌었으면(stale)
     확인 메시지를 "다시 생성하세요" 로 전환하기 위한 단일 출처 판정.

   값 기반(JSON.stringify(form) 등 직렬화)으로 비교하므로 참조 동일성에
   기대지 않는다(테스트 가능·결정적). UI 상태만 — 조문·엔진·검증 무관.
   ================================================================ */

export type GenFreshness = "none" | "fresh" | "stale";

/**
 * @param current  현재 입력 스냅샷(JSON.stringify(form) 등 값 기반 직렬화)
 * @param snapshot 마지막 생성 시점의 입력 스냅샷(아직 생성 전이면 null)
 * @returns
 *  - "none"  : snapshot===null — 아직 생성한 적 없음(확인 메시지 없음)
 *  - "fresh" : current===snapshot — 생성 후 입력 무변경(확인 유효)
 *  - "stale" : current!==snapshot — 생성 후 입력 변경(재생성 안내 필요)
 */
export function genFreshness(current: string, snapshot: string | null): GenFreshness {
  if (snapshot === null) return "none";
  return current === snapshot ? "fresh" : "stale";
}
