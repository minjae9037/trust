/* ================================================================
   위저드 단계 전환 후 "포커스할 입력 필드" 핸드오프 (검증 게이트 누락 항목 점프)

   배경: DocStep 검증 게이트의 누락 항목을 클릭하면 그 입력 단계로 점프(setStep)
   하는데, 단계 전환 시 Wizard 는 새 단계 "제목(heading)"으로 포커스를 옮긴다
   (WCAG 2.4.3 — 키보드/스크린리더가 새 단계를 처음부터 다시 찾지 않게). 누락 항목
   점프는 제목이 아니라 "그 누락 입력 필드"로 데려가야 하므로, 둘이 같은 step 전환에
   동시에 포커스를 노려 레이스가 난다(setTimeout vs React passive effect — 순서 비보장).

   해결: 단계 전환 후 포커스의 단일 권한을 Wizard 의 step useEffect 로 둔다. DocStep
   은 점프 직전 여기 "예약(requestFieldFocus)"만 남기고, Wizard 가 제목 포커스 전에
   그 예약을 소비(consumeFieldFocus)한다 — 예약이 있으면 필드를, 없으면 제목을. 모듈
   싱글턴(단일 트리거·동기 소비, 한 step 전환에 1건)이라 store 를 늘리지 않으며, 한
   곳에서만 포커스가 결정돼 레이스가 사라진다.

   ⚠️ 조문·엔진·검증 판정(validateDoc)·산출물(docx) 무접촉 — 포커스/스크롤 표시 경계만.
   ================================================================ */

/** 다음 단계 전환 후 포커스할 입력 필드(또는 그룹 라벨)의 DOM id. 소비되면 비운다. */
let pendingFieldId: string | null = null;

/** 단계 점프 직전 호출 — 전환 후 이 id 의 필드로 포커스하도록 예약한다. */
export function requestFieldFocus(id: string): void {
  pendingFieldId = id;
}

/**
 * 예약된 필드가 있으면 스크롤·포커스하고 true(= Wizard 는 제목 포커스를 양보).
 * 없거나 DOM 에서 못 찾으면 false(= Wizard 가 평소대로 제목 포커스). 한 번 읽으면
 * 비운다(소비). DocStep focusMissing(JointForm) 과 동일한 스크롤·포커스 규약:
 * reduce-motion 존중·중앙 정렬·폼 컨트롤이면 직접, 그룹 라벨 div 면 인접 입력.
 */
export function consumeFieldFocus(): boolean {
  const id = pendingFieldId;
  pendingFieldId = null; // 1회성 — 다음 일반 단계 전환에 잔존하지 않게 항상 비운다
  if (!id || typeof document === "undefined") return false;
  const el = document.getElementById(id);
  if (!el) return false; // 死점프 0 — 매칭 실패는 무동작(제목 포커스로 폴백)
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  // 포커스 가능한 입력(이름/주소/금액/물건/보수/기간/비율/문서 금액/대리금융기관)이면
  // 그 자체를, 그룹 라벨 div(체결일·사업자/법인등록·생년월일 묶음)면 인접 입력을 포커스.
  const ctrl =
    el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement
      ? el
      : el.parentElement?.querySelector<HTMLElement>("input, select, textarea");
  ctrl?.focus({ preventScroll: true });
  return true;
}
