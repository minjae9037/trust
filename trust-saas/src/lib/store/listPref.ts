/* ================================================================
   내 계약 목록 정렬 선호 — localStorage (표시 전용)

   배경: 내 계약(ContractsView) 목록은 정렬(최근 수정순·제목순·위탁자순·
   생성 준비도순)을 고를 수 있지만 그 선택이 컴포넌트 in-memory 상태(useState)라,
   목록을 떠났다(언마운트) 다시 오거나 새로고침하면 매번 기본 "최근 수정순"으로
   돌아갔다. 위탁자순으로 정리해 두고 작업하던 사용자가 돌아올 때마다 다시
   골라야 했다(previewPref 의 미리보기 접힘 선호와 동형의 표시 선호 휘발).

   → 마지막 정렬 선택을 한 곳에 보관해 새로고침·재진입 후에도 유지한다.
     previewPref·sessionRepo·draftRepo 와 동형의 best-effort·SSR 안전. 미저장·
     손상(알 수 없는 키)·SSR 시 기본 "recent"(최근 수정순)로 후방호환.

   ※ 순수 표시 상태 — 조문/엔진/검증(validate)/산출물(docx) 무접촉. 저장 대상은
     정렬 키 하나뿐. 검색어(q)·상태 필터(status)는 의도적으로 영속하지 않는다
     (검색어=일시적 탐색, 상태 필터=일부만 보여 "계약이 사라진" 오인 위험).
     정렬은 전 계약을 항상 보여주고 순서만 바꾸므로 그 위험이 없다.
   ================================================================ */

const KEY = "trust_contracts_sort";

/** 영속·검증 대상 정렬 키의 단일 출처(저장 경계). 순서=드롭다운 표기 순서. */
export const SORT_KEYS = ["recent", "title", "trustor", "readiness"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

const DEFAULT_SORT: SortKey = "recent";

const isSortKey = (v: string | null): v is SortKey =>
  v !== null && (SORT_KEYS as readonly string[]).includes(v);

/** 저장된 정렬 선호를 읽는다. 미저장·손상(알 수 없는 키)·SSR 시 기본 "recent". */
export function loadSortKey(): SortKey {
  if (typeof window === "undefined") return DEFAULT_SORT;
  try {
    const raw = localStorage.getItem(KEY);
    return isSortKey(raw) ? raw : DEFAULT_SORT; // 알 수 없는 값(구버전·손상)은 기본으로 폴백
  } catch {
    return DEFAULT_SORT;
  }
}

/** 정렬 선호를 저장(best-effort). 쓰기 실패는 무시(목록 동작 무영향). */
export function saveSortKey(key: SortKey): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, key);
  } catch {
    /* 용량 초과(QuotaExceeded)·시크릿 모드(SecurityError) 등 — 조용히 무시 */
  }
}
