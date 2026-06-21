/* ============================================================
   상담(advisor) 오류 메시지 — 친화적 한국어 단일 출처 재노출.

   분류 로직은 두 Pillar(상담·계약) 공용 단일 출처 lib/ui/error-message.ts 로
   승격됐다(계약 측 /api/chat·ChatPanel 도 동일 규약 사용). 이 모듈은 기존
   상담 import 경로(@/lib/advisor/error-message)와 회귀 가드를 보존하기 위해
   advisorErrorMessage·ADVISOR_ERROR 이름으로 그대로 재노출한다.

   ※ 재노출 경로는 상대경로(../ui/error-message)로 둔다 — 회귀 가드의 ESM
     로더(ts-ext-loader)가 @/ 별칭은 해석하지 않고 상대경로만 해석하기 때문.
   ============================================================ */
export {
  friendlyErrorMessage as advisorErrorMessage,
  FRIENDLY_ERROR as ADVISOR_ERROR,
} from "../ui/error-message";
