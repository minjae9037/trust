/* ============================================================
   상담(advisor) 오류 메시지 — 사용자 노출 친화적 한국어 단일 출처.

   배경(UX·가드레일 갭, 비-산출물): 상담(Pillar 2)은 100% 한국어 대상
   제품인데 두 오류 경로가 원문을 그대로 노출했다.
     · route.ts mid-stream catch — `[오류] overloaded_error …` (영문 SDK 메시지)
     · AdvisorChat fetch catch  — `오류: {"error":"잘못된 요청"}` (원시 JSON 본문)
   전자는 영문 내부 메시지가, 후자는 서버가 보낸 JSON 직렬화 문자열이 그대로
   사용자에게 보였다(공개·무인증 엔드포인트라 내부 오류 노출은 정보 누출이기도
   하다). 계약 측 storageWriteErrorMessage(친화적 한국어 단일 출처)와 동형으로,
   알려진 오류 유형을 친화적 한국어로 분류한다.

   설계:
     - 서버가 이미 친화적 한국어로 내보낸 {error} 본문(클라이언트 !res.ok 경로)은
       그대로 통과시킨다(이중 일반화 방지 — 400 "잘못된 요청" 등).
     - 그 외(영문 SDK·네트워크 오류)는 상태코드·키워드로 분류해 한국어로 치환한다.
     - 어떤 입력이든 원문 영문/원시 JSON 을 절대 그대로 반환하지 않는다(누출 0).

   조문·엔진·검증 게이트·상담 답변/전송·검색·로깅 경로 전부 무접촉(표시 경계만).
   ============================================================ */

/** 분류별 사용자 노출 메시지(단일 출처). */
export const ADVISOR_ERROR = {
  busy: "지금 요청이 많아 답변을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  server: "상담 서버가 일시적으로 응답하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  timeout: "답변 생성이 지연되어 중단되었습니다. 잠시 후 다시 시도해 주세요.",
  network: "네트워크 연결을 확인한 뒤 다시 시도해 주세요.",
  invalid: "요청을 처리하지 못했습니다. 입력을 확인한 뒤 다시 시도해 주세요.",
  generic: "답변을 생성하는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
} as const;

/** 객체에서 HTTP 상태코드 후보를 추출(없으면 0). */
function statusOf(raw: unknown): number {
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    for (const k of ["status", "statusCode"]) {
      const v = o[k];
      if (typeof v === "number" && Number.isFinite(v)) return v;
    }
  }
  return 0;
}

/** 원시 입력에서 분류용 텍스트 추출(Error.message 우선, 아니면 String). */
function textOf(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "string") return raw;
  if (raw instanceof Error) return raw.message || "";
  if (typeof raw === "object") {
    const m = (raw as Record<string, unknown>).message;
    if (typeof m === "string") return m;
  }
  return String(raw);
}

/** 서버가 보낸 JSON 본문(`{"error":"한국어"}`)이면 그 error 문자열을 반환(이미 친화적). */
function passthroughServerError(text: string): string | null {
  const t = text.trim();
  if (!t.startsWith("{")) return null;
  try {
    const o = JSON.parse(t);
    if (o && typeof o === "object" && typeof o.error === "string" && o.error.trim()) {
      return o.error.trim();
    }
  } catch {
    /* JSON 아님 — 분류로 넘어감 */
  }
  return null;
}

/**
 * 상담 오류를 사용자 노출용 친화적 한국어 메시지로 변환한다.
 * 원문 영문/원시 JSON 을 그대로 노출하지 않는 단일 출처.
 */
export function advisorErrorMessage(raw: unknown): string {
  const text = textOf(raw);

  // 1) 서버가 이미 친화적 한국어로 보낸 {error} 본문은 그대로(이중 일반화 방지).
  const passthrough = passthroughServerError(text);
  if (passthrough) return passthrough;

  const status = statusOf(raw);
  const low = text.toLowerCase();

  // 2) 상태코드 우선 분류.
  if (status === 429) return ADVISOR_ERROR.busy;
  if (status === 408) return ADVISOR_ERROR.timeout;
  if (status === 529 || status === 503 || status === 502 || status === 500) {
    return ADVISOR_ERROR.server;
  }
  if (status === 400 || status === 422) return ADVISOR_ERROR.invalid;

  // 3) 키워드 분류(상태코드 없는 SDK/네트워크 오류).
  if (/overload/.test(low)) return ADVISOR_ERROR.server;
  if (/rate|too many|429/.test(low)) return ADVISOR_ERROR.busy;
  if (/timeout|timed out|etimedout/.test(low)) return ADVISOR_ERROR.timeout;
  if (/connection|connect error|fetch|network|enotfound|econnrefused|econnreset|socket|dns/.test(low)) {
    return ADVISOR_ERROR.network;
  }

  // 4) 기타 — 절대 원문을 노출하지 않고 일반 메시지.
  return ADVISOR_ERROR.generic;
}
