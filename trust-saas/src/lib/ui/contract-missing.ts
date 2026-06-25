import { validateDoc, type Missing } from "../engine/validate";
import { COLLATERAL_OUTPUT_DOCS } from "../engine/schema";
import type { ContractForm } from "../engine/model";

/**
 * 담보신탁(collateral) 계약 전체의 "남은 필수 입력" — 7종 산출 서류
 * (COLLATERAL_OUTPUT_DOCS)에 걸쳐 검증 게이트(validateDoc)가 보고한 누락 항목을
 * label 기준 중복 제거해 모은 **단일 출처**.
 *
 * 위저드 헤더의 통합 체크리스트(Wizard `missingList`)와 내 계약 카드의 "남은 필수
 * 입력" 요약(ContractsView `rowMissing`)이 같은 결과를 쓰도록 한 곳에서 산출한다.
 * 그간 두 화면이 같은 dedup-합집합 로직을 **각자 재현**해, 한쪽 판정이 바뀌면 다른
 * 쪽이 말없이 어긋날 수 있었다(정확성 최우선 제품에서 "무엇이 남았나"의 화면 간
 * 불일치). 이 헬퍼로 그 로직을 단일화해 drift 를 차단한다.
 *
 * 공통 누락(위탁자·우선수익자·대출금액·물건·체결일 등)은 7종 모두의 missing 에
 * 반복 등장하므로 label 처음 등장 시 1회만 담는다(STEPS 서류 순서 = 등장 순서 보존).
 *
 * ※ 조문·엔진·검증 판정 무접촉 — 이미 산출된 validateDoc.missing 을 모을 뿐이다.
 *   (손상 저장본 격리 try/catch 는 호출부에서 — 호출부마다 fallback 의미가 다르므로.)
 */
export function collateralMissingUnion(form: ContractForm): Missing[] {
  const seen = new Set<string>();
  const list: Missing[] = [];
  for (const d of COLLATERAL_OUTPUT_DOCS) {
    const { missing } = validateDoc(form, d.id);
    for (const mi of missing) {
      if (seen.has(mi.label)) continue;
      seen.add(mi.label);
      list.push(mi);
    }
  }
  return list;
}
