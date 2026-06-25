/* ================================================================
   서류 초안 저장소 — localStorage (무계정·로컬 우선)

   배경(서류 측 휘발 갭): 명시적으로 "저장"한 계약은 contractRepo(localStorage)로
   영속되고, 상담(/advisor)도 최근 세션이 sessionRepo 로 영속돼 재개 동선이 완비됐다.
   그러나 위저드에서 *작성 중이던(아직 저장 안 한) 서류 입력*은 contractStore(zustand)
   메모리에만 있어, 새로고침·탭 닫기·실수 이탈 시 통째로 사라졌다(beforeunload 경고는
   "막아만 줄 뿐" 복구는 못 함). 서류 입력은 사용자가 가장 많은 노력을 들이는 핵심
   자산(당사자·금액·물건·조건)이라, 이 휘발이 재방문 흐름 묶음의 마지막 실질 갭이었다.

   → 진행 중(미저장·dirty) 서류 초안을 localStorage 에 자동 보관하고, 첫 화면(신탁사
     선택)에 "이어서 작성하기" 복원 진입점을 노출해 돌아온 사용자가 끊긴 작성을
     이어가게 한다. sessionRepo(상담)와 동형의 best-effort·SSR 안전·단일 비움 경로.

   ※ 표시·재개 전용 — 검증(validate)·조문·산출물(docx) 무접촉. 저장 대상 = 위저드를
     다시 띄우는 데 필요한 store 상태 스냅샷(docTypeId/category/title/form/jointForm/
     tab/step)뿐. 복원된 초안은 **미저장(savedHash=null)** 상태로 들어와 여전히 dirty
     이고 beforeunload 가 계속 경고한다(저장본으로 둔갑하지 않음 — 정확성).
   ※ 자동 저장은 best-effort — 용량 초과·시크릿 모드 등 쓰기 실패는 조용히 무시한다
     (현재 위저드·전송 경로 무영향). 비움은 명시적 경로(저장 완료·이탈 확정·복원)만.
   ================================================================ */

import type { ContractForm, JointForm, Category } from "@/lib/engine/model";

const KEY = "trust_draft";

/** 저장되는 초안 — 위저드를 다시 띄우는 데 필요한 store 상태 스냅샷. */
export interface ContractDraft {
  docTypeId: string;
  category: Category | null;
  title: string;
  form: ContractForm;
  jointForm: JointForm;
  tab: number;
  step: number;
}

/**
 * 저장본이 복원 가능한 최소 형태인지(순수) — 손상·이질 데이터 격리(복원 크래시 방지).
 * docTypeId(어떤 서류인지)와 두 폼 객체가 있어야 위저드를 복원할 수 있다.
 */
export function isValidDraft(x: unknown): x is ContractDraft {
  if (!x || typeof x !== "object") return false;
  const d = x as Record<string, unknown>;
  return (
    typeof d.docTypeId === "string" &&
    d.docTypeId.length > 0 &&
    typeof d.form === "object" &&
    d.form !== null &&
    typeof d.jointForm === "object" &&
    d.jointForm !== null
  );
}

/** 저장된 초안을 읽어 유효하면 반환(없거나 손상 시 null). SSR 안전. */
export function loadDraft(): ContractDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return isValidDraft(obj) ? obj : null;
  } catch {
    return null;
  }
}

/** 진행 중 초안을 저장(자동 영속, best-effort). 쓰기 실패는 무시(현재 위저드 무영향). */
export function saveDraft(draft: ContractDraft): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    /* 용량 초과(QuotaExceeded)·시크릿 모드(SecurityError) 등 — 조용히 무시 */
  }
}

/** 저장된 초안을 비운다(저장 완료·이탈 확정·복원 시 — 비움의 단일 경로). SSR 안전. */
export function clearDraft(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* 접근 불가 시 무시 */
  }
}
