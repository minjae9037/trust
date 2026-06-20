/* ================================================================
   검증 게이트 — DOCX 생성 전 필수항목 충족 여부 점검
   완료기준: 필수항목(당사자·물건·금액 등) 누락 시 DOCX 차단 + 누락 필드 안내.
   ⚠️ verbatim 조문 자체는 건드리지 않는다. "입력값 완결성"만 검사.
   ================================================================ */
import type { ContractForm, DocId } from "./model";
import { parseAmount } from "./calc";

export interface Missing {
  /** 누락 항목 사용자 안내 라벨 */
  label: string;
  /** 어느 단계(STEP)에서 입력하는지 — 안내용 */
  where: string;
}

const hasText = (v: unknown) => typeof v === "string" && v.trim().length > 0;

/** 공통(모든 담보신탁 서류) 필수 입력 — 당사자·물건·금액 */
function commonMissing(form: ContractForm): Missing[] {
  const m: Missing[] = [];

  // 위탁자: 최소 1인 + 이름
  if (!form.trustors.some((p) => hasText(p.name))) {
    m.push({ label: "위탁자 (성명/상호)", where: "STEP 01 위탁자·채무자·수익자" });
  }
  // 우선수익자: 최소 1인 + 이름
  if (!form.priorities.some((p) => hasText(p.name))) {
    m.push({ label: "우선수익자 (성명/상호)", where: "STEP 02 우선수익자" });
  }
  // 대출금액(우선수익한도 산정 근거): 합계 > 0
  if (!form.priorities.some((p) => parseAmount(p.loanAmount) > 0)) {
    m.push({ label: "우선수익자 대출금액", where: "STEP 02-1 우선수익한도금액 산정" });
  }
  // 신탁 부동산: 최소 1건 + 주소
  if (!form.properties.some((p) => hasText(p.address))) {
    m.push({ label: "신탁 부동산 (소재지)", where: "STEP 03 신탁 부동산 목록" });
  }
  // 계약 체결일
  const { year, month, day } = form.common;
  if (!year || !month || day === "" || day == null) {
    m.push({ label: "계약 체결일 (연·월·일)", where: "STEP 04 계약 기본 정보" });
  }
  return m;
}

/** 서류별 추가 필수 입력 */
function docMissing(form: ContractForm, docId: DocId): Missing[] {
  const m: Missing[] = [];
  const c = form.docContents;
  if (docId === "appform") {
    if (!hasText(c.appform.valuationPrice)) {
      m.push({ label: "신탁부동산 가격", where: "Doc 01 신청서" });
    }
  }
  if (docId === "valReport") {
    if (!hasText(c.valReport.principalValue)) {
      m.push({ label: "신탁재산 원본가액", where: "Doc 04 원본가액 신고서" });
    }
  }
  return m;
}

/**
 * 특정 서류(docId) 생성 가능 여부 + 누락 항목.
 * ok=true 면 DOCX/PDF 생성 버튼 활성화.
 */
export function validateDoc(form: ContractForm, docId: DocId): { ok: boolean; missing: Missing[] } {
  const missing = [...commonMissing(form), ...docMissing(form, docId)];
  return { ok: missing.length === 0, missing };
}
