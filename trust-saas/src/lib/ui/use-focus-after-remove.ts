import { useEffect, useRef } from "react";

/**
 * 목록 항목 삭제 후 포커스 관리 훅 (WCAG 2.4.3 Focus Order).
 *
 * 배경: 위저드의 당사자(PartyCard)·신탁 부동산(StepProperty) 카드는 삭제 버튼(✕)을
 * 누르면 그 카드가 언마운트되며 포커스가 사라진 버튼과 함께 document.body 로 복귀한다
 * → 키보드/스크린리더 사용자가 목록 안에서 위치를 잃고 처음부터 다시 탐색해야 한다
 * (Wizard 단계 이동 bf2eef0·advisor 피드백 b84eff7 에서 마감해 온 포커스 유실 갭의
 * 목록 삭제 버전).
 *
 * 해결: 삭제 직후 같은 그룹의 **항상 존재하는 "+ 추가" 버튼**으로 포커스를 옮긴다.
 * ★삭제로 카드가 2→1 이 되면 남은 단일 카드는 removable=false 라 삭제 버튼 자체가
 * 사라지므로(PartyCard·StepProperty 공통), "이전 카드의 삭제 버튼"으로 옮기는 방식은
 * 그 경계에서 타깃이 없어진다. 반면 "+ 추가" 버튼은 카드 수와 무관하게 그룹에 늘 present
 * 하고 같은 그룹·예측 가능한 위치라 보편 타깃으로 적합하다(삭제로 목록이 줄었으니
 * 다음 동작이 "추가"인 것도 자연스럽다).
 *
 * 사용:
 *   const { addBtnRef, markRemoved } = useFocusAfterRemove(list.length);
 *   <button onClick={() => { remove(i); markRemoved(); }}>✕</button>  // 삭제
 *   <button ref={addBtnRef} type="button">+ 추가</button>            // 추가
 *
 * markRemoved() 는 삭제 클릭에서 동기적으로 '대기' 표식만 세우고, 길이 변화로 리렌더된
 * 뒤 effect 가 한 번 addBtnRef 로 포커스를 옮기고 표식을 비운다(1회성). 길이가 늘어나는
 * 추가/마운트 시엔 표식이 false 라 무동작 = 포커스 가로채기 0. 포커스가 마우스 클릭으로
 * 발동돼도 :focus-visible 은 키보드 모달리티에서만 링을 보이므로 시각 회귀 없음.
 */
export function useFocusAfterRemove(length: number) {
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const pending = useRef(false);

  useEffect(() => {
    if (pending.current) {
      pending.current = false;
      addBtnRef.current?.focus();
    }
  }, [length]);

  const markRemoved = () => {
    pending.current = true;
  };

  return { addBtnRef, markRemoved };
}
