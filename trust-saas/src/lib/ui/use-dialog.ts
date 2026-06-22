import { useEffect, useRef } from "react";

/**
 * 모달 다이얼로그 공용 동작 훅 (WCAG 2.1.2 No Keyboard Trap / 2.4.3 Focus Order /
 * 4.1.2 Name·Role·Value) — 마운트 시 내부로 초기 포커스 이동, Tab/Shift+Tab
 * 포커스 트랩, Esc 닫기.
 *
 * 배경: AI 어시스턴트(ChatPanel)는 화면 우측 전체 높이 드로어(role 없는 <div>)로
 * 떠 있으나 ① role/aria-modal 이 없어 AT 에 다이얼로그로 고지되지 않고 ② 열어도
 * 포커스가 트리거(chat-fab)에 남는데 그 트리거는 열림과 동시에 언마운트돼 포커스가
 * document.body 로 사라지며 ③ Tab 이 드로어 밖(뒤 페이지)으로 새고 ④ Esc 로 닫을
 * 수단이 없었다 — 키보드/스크린리더 사용자가 드로어에 갇히거나 길을 잃던 갭.
 *
 * 해결: 다이얼로그 컨테이너에 이 훅의 ref 를 걸면
 *   - 마운트 시 [data-autofocus] 요소(없으면 첫 포커서블, 그도 없으면 컨테이너)로 포커스.
 *   - Tab/Shift+Tab 이 경계(첫/마지막 포커서블)에서 순환 = 포커스 트랩.
 *   - Esc 키로 onClose() 호출.
 * 트리거로의 포커스 복귀는 호출부가 담당한다 — 트리거(chat-fab)가 다이얼로그 열림 시
 * 언마운트되는 구조라, 다이얼로그 내부에서는 복귀 대상을 알 수 없기 때문이다
 * (TrustApp 이 fab ref + 닫힘 effect 로 복귀시킨다).
 *
 * 사용:
 *   const dialogRef = useDialog<HTMLDivElement>(onClose);
 *   <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="x" tabIndex={-1}>
 *     …
 *     <textarea data-autofocus />
 *   </div>
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useDialog<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  // onClose 를 ref 로 받아 effect 의존성에서 빼 둔다(매 렌더 새 함수여도 트랩 재설치 0).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // 화면에 실제 보이는(레이아웃 점유) 포커서블만 — 숨겨진 sr-only 등 제외.
    const focusables = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );

    // 초기 포커스: data-autofocus → 첫 포커서블 → 컨테이너(tabIndex=-1 전제).
    const initial =
      node.querySelector<HTMLElement>("[data-autofocus]") ?? focusables()[0] ?? node;
    initial.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        // 포커서블이 없으면 컨테이너 안에 포커스를 묶어 둔다(밖으로 탈출 방지).
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !node.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !node.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    node.addEventListener("keydown", onKeyDown);
    return () => node.removeEventListener("keydown", onKeyDown);
  }, []);

  return ref;
}
