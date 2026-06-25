/* ================================================================
   상담 세션 저장소 — localStorage (무계정·로컬 우선)

   배경(상담 측 휘발 갭): 서류 측은 contractRepo(localStorage)로 입력을 영속하고
   홈·첫화면·브레드크럼에 재개 동선이 완비됐는데, 상담(/advisor)은 대화 상태가
   메모리(useState)에만 있어 새로고침·이탈 시 진행 중 상담이 통째로 사라졌다
   (재방문 흐름의 "남은 한 축"). 완료된 대화 턴을 localStorage 에 보관해, 돌아온
   사용자가 빈 상태에서 "이어서 대화하기"로 지난 상담을 복원할 수 있게 한다.

   ※ 표시·재개 전용 — 페르소나(system)·검색(retrieve)·로깅(log)·산출물 무접촉.
     저장 대상 = 사용자가 본 완료 대화 본문(role/content/sources/grounding)만.
     실패 자리표시자(error)·진행 중 빈 답변·답 없는 마지막 질문은 제외(완료 라운드만).
   ※ 자동 저장은 best-effort — 용량 초과·시크릿 모드 등 쓰기 실패는 조용히 무시한다
     (상담 휘발 방지는 편의 기능이라, 실패해도 현재 대화·전송 경로엔 영향 0). 또한
     저장본은 명시적 "새 대화"(clearSession)로만 비운다 — 빈 상태가 직전 세션을
     덮어쓰지 않게 saveSession 은 남길 라운드가 없으면 기존 저장본을 보존한다.
   ================================================================ */

const KEY = "trust_advisor_session";

export interface AdvisorSource {
  topic: string;
  kind: "backdata" | "core";
}

/** 저장되는 대화 한 줄 — AdvisorChat 의 Msg 에서 영속 대상 필드만 추린 형태(error 미보존). */
export interface AdvisorMsg {
  role: "user" | "assistant";
  content: string;
  sources?: AdvisorSource[];
  grounding?: "weak";
}

/**
 * 영속 대상 정규화(순수) — 완료된 대화 라운드만 남긴다.
 *  ① 실패 자리표시자(error) · 빈/공백 본문(진행 중 빈 답변) 제외
 *  ② 마지막이 답 없는 사용자 질문(미완료 라운드)이면 제거 — 복원 시 매달린 질문 방지
 *  ③ 영속 필드(role/content/sources/grounding)만 추려 직렬화(내부 액션 마커·error 미보존)
 * (입력 배열 무변형 · 회귀 가드에서 직접 단언)
 */
export function sanitizeForStorage(
  msgs: ReadonlyArray<AdvisorMsg & { error?: boolean }>,
): AdvisorMsg[] {
  const kept = msgs.filter((m) => !m.error && m.content.trim().length > 0);
  while (kept.length > 0 && kept[kept.length - 1].role === "user") kept.pop();
  return kept.map((m) => ({
    role: m.role,
    content: m.content,
    ...(m.sources && m.sources.length > 0 ? { sources: m.sources } : {}),
    ...(m.grounding ? { grounding: m.grounding } : {}),
  }));
}

/** 저장본 한 줄이 복원 가능한 최소 형태인지(순수) — 손상·이질 데이터 격리(목록 크래시 방지). */
export function isValidMsg(x: unknown): x is AdvisorMsg {
  if (!x || typeof x !== "object") return false;
  const m = x as Record<string, unknown>;
  return (m.role === "user" || m.role === "assistant") && typeof m.content === "string";
}

/** 저장된 상담 세션을 읽어 유효한 대화 본문만 반환(없거나 손상 시 빈 배열). SSR 안전. */
export function loadSession(): AdvisorMsg[] {
  if (typeof window === "undefined") return [];
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(arr)) return [];
    return arr.filter(isValidMsg);
  } catch {
    return [];
  }
}

/**
 * 완료 대화를 저장(자동 영속, best-effort). 남길 완료 라운드가 없으면 **아무 것도 하지
 * 않는다**(기존 저장본 보존) — 비움은 명시적 clearSession 만 담당. 쓰기 실패는 무시.
 */
export function saveSession(msgs: ReadonlyArray<AdvisorMsg & { error?: boolean }>): void {
  if (typeof window === "undefined") return;
  const clean = sanitizeForStorage(msgs);
  if (clean.length === 0) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(clean));
  } catch {
    /* 용량 초과(QuotaExceeded)·시크릿 모드(SecurityError) 등 — 조용히 무시(현재 대화 무영향) */
    return; // 쓰기 실패=무손상이므로 구독자에게 통지하지 않는다(상태 불변).
  }
  emitSessionChanged(); // 쓰기 성공 후에만 통지(홈 "이어서 대화하기" 진입점이 저장소와 일치).
}

/** 저장된 상담 세션을 비운다("새 대화" 전용 — 저장본 삭제의 단일 경로). SSR 안전. */
export function clearSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* 접근 불가 시 무시 */
    return;
  }
  emitSessionChanged(); // 삭제도 동일 단일 경로로 통지(진입점 라이브 소거).
}

/* ----------------------------------------------------------------
   저장 세션 존재 구독(표시 전용) — 홈 랜딩(/) "진행 중이던 상담 — 이어서 대화하기"
   진입점이 저장소 변경에 따라 살아 있게 한다. 같은 탭의 변형은 saveSession/clearSession
   통지로, 다른 탭의 변형은 window "storage" 이벤트로 반영한다(useSyncExternalStore
   표준 패턴 — contractRepo 의 subscribeContracts 와 동형). 페르소나·검색·로깅·산출물
   무접촉 — 저장본 유무를 읽어 표시에 쓸 뿐이다(순수 boolean, 회귀 가드에서 직접 단언).
   ---------------------------------------------------------------- */
const sessionListeners = new Set<() => void>();
function emitSessionChanged() {
  for (const l of sessionListeners) l();
}

/** 저장된 상담 세션 존재 여부(localStorage). getSnapshot=원시 boolean 이라 참조 안정성 불요. */
export function hasSavedSession(): boolean {
  return loadSession().length > 0;
}

/**
 * 저장 세션 변경 구독(useSyncExternalStore subscribe 계약) — 콜백 등록 + 다른 탭의
 * 저장소 변경(storage 이벤트, 우리 KEY 한정) 연결. 정리 함수에서 둘 다 해제한다.
 */
export function subscribeSession(cb: () => void): () => void {
  sessionListeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    // 다른 탭의 localStorage 변경만 전달된다. 우리 키(또는 전체 clear=key null)일 때만 통지.
    if (e.key === null || e.key === KEY) cb();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    sessionListeners.delete(cb);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}
