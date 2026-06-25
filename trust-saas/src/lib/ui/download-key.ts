/* ================================================================
   다운로드 파일명 식별 키 — 단일 출처(SSOT)
   내 계약 목록의 사후 충돌 경고(ContractsView, collidingDownloadIds)와 서류 위저드의
   사전 충돌 점검(DocStep, downloadKeyCollidesWithSaved)이 **같은 함수**를 써 두 표면의
   판정이 절대 어긋나지 않게 한다(드리프트 0).

   ※ 이 모듈은 엔진(@/lib/engine/docx)을 import 한다. contractRepo.ts 는 회귀 가드가
   런타임에 그대로 import 하므로(@/ 별칭 미해석 로더) 엔진 의존을 두지 않는다 — 그래서
   키 산출은 contractRepo 가 아닌 이 UI 보조 모듈에 둔다(contractRepo → contractIdentity
   재사용, 엔진 → contractFileKey 재사용).
   ================================================================ */
import { contractIdentity, type StoredForm } from "@/lib/contractRepo";
import { contractFileKey } from "@/lib/engine/docx";
import type { ContractForm } from "@/lib/engine/model";

/**
 * 행(또는 작성 중 입력)의 "다운로드 파일명 식별 키"(순수) — 두 계약의 산출 .docx 가
 * 섞이는지 판정용. 실제 다운로드명과 **동일 출처**를 쓴다: collateral 등은 엔진
 * `contractFileKey`(위탁자·체결일·소재지 = docFileBase 의 식별부), joint 는
 * `공동사업표준협약서_{갑}` 의 식별부(gap.name). 두 종류는 서류종류명 접두가 달라 서로
 * 충돌하지 않으므로 키에 종류 접두("coll:"/"joint:")를 붙여 분리한다. 위탁자(갑) 미입력으로
 * 식별 불가한 빈 초안은 null → 충돌 경고에서 제외(노이즈 방지). 행 전체가 아니라
 * `{ doc_type, form_data }` 최소 형태만 읽어, 아직 저장 전인 위저드 입력값에도 그대로 쓴다.
 * ※ 표시 전용 — 산출/검증/조문 무접촉(식별 키 추출일 뿐 산출 파일명 문자열은 동일).
 */
export function downloadKeyOf(r: { doc_type: string; form_data: StoredForm }): string | null {
  const id = contractIdentity(r);
  if (!id.trustor) return null;
  if (r.doc_type === "joint") return `joint:${id.trustor}`;
  try {
    return `coll:${contractFileKey(r.form_data as ContractForm)}`;
  } catch {
    return null;
  }
}
