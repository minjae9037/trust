/* ================================================================
   실시간 미리보기 접기/펼치기 선호 — localStorage (표시 전용)

   배경: 서류 위저드(DocStep)·공동사업협약서(JointForm)의 실시간 미리보기는
   접기/펼치기 토글을 갖지만 그 선택이 컴포넌트 in-memory 상태(useState)라,
   문서를 바꾸거나(언마운트→재마운트) 새로고침하면 매번 기본 펼침으로 돌아갔다.
   좁은 화면에서 미리보기를 접어 입력에 집중하던 사용자가 단계를 옮길 때마다
   다시 접어야 했다.

   → 마지막 토글 선택을 한 곳에 보관해 두 위저드 사이·새로고침 후에도 유지한다.
     sessionRepo·draftRepo 와 동형의 best-effort·SSR 안전. 미저장·손상·SSR 시
     기본 펼침(true)으로 후방호환.

   ※ 순수 표시 상태 — 조문/엔진/검증(validate)/산출물(docx) 무접촉. 저장 대상은
     불리언 선호 하나뿐.
   ================================================================ */

const KEY = "trust_preview_open";

/** 저장된 미리보기 펼침 선호를 읽는다. 미저장·손상·SSR 시 기본 펼침(true). */
export function loadPreviewOpen(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return true; // 미저장 = 기본 펼침
    return raw !== "0"; // "0"만 접힘, 그 외("1" 포함)는 펼침
  } catch {
    return true;
  }
}

/** 미리보기 펼침 선호를 저장(best-effort). 쓰기 실패는 무시(미리보기 동작 무영향). */
export function savePreviewOpen(open: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, open ? "1" : "0");
  } catch {
    /* 용량 초과(QuotaExceeded)·시크릿 모드(SecurityError) 등 — 조용히 무시 */
  }
}
