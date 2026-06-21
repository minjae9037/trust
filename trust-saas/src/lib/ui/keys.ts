/* ================================================================
   키보드 단축키 판정 — 입력창 Enter 전송 단일 출처

   ★한글(IME) 조합 중 Enter 조기 전송 버그:
   한국어·일본어 등은 입력기(IME)로 글자를 "조합"하다가 Enter 로 조합을
   확정한다(예: "신탁ㅎ" → Enter → "신탁회"). 이 조합 확정 Enter 도
   keydown(key==="Enter") 으로 잡히므로, isComposing 을 확인하지 않으면
   사용자가 마지막 글자를 조합하는 도중 **미완성 문장이 그대로 전송**된다
   (한국어 대상 제품에서 흔한 입력 결함). 채팅/검색 입력의 Enter 전송은
   전부 이 헬퍼를 거쳐 조합 확정 Enter 를 전송에서 제외한다.

   ※React 합성 KeyboardEvent 는 isComposing 을 nativeEvent 로 노출하므로
     그쪽을 우선 확인한다(타입상 합성 이벤트 본체엔 isComposing 부재).
   ================================================================ */
export interface KeyLike {
  key: string;
  shiftKey?: boolean;
  nativeEvent?: { isComposing?: boolean };
  isComposing?: boolean;
}

/** IME 조합(미확정) 중 입력인가 — nativeEvent.isComposing 우선, 없으면 false. */
export function isComposing(e: KeyLike): boolean {
  return e.nativeEvent?.isComposing ?? e.isComposing ?? false;
}

/**
 * Enter 전송 단축키인가.
 * - ★IME 조합 확정 Enter 는 전송 아님(미완성 문장 조기 전송 차단).
 * - 기본은 Shift+Enter = 줄바꿈(전송 아님). allowShift=true 면 Shift 무관 전송
 *   (단일 라인 입력의 즉시 제출용 — 로그인 등).
 */
export function isSubmitEnter(e: KeyLike, opts?: { allowShift?: boolean }): boolean {
  if (e.key !== "Enter") return false;
  if (isComposing(e)) return false;
  if (!opts?.allowShift && e.shiftKey) return false;
  return true;
}
