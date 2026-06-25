/* ================================================================
   docx/PDF 빌더 타입드 파사드
   verbatim 포트(builders.js)를 타입 안전하게 감싼다.
   ⚠️ window/document 의존 — 클라이언트 컴포넌트의 이벤트 핸들러에서만 호출.
   ================================================================ */
import type { ContractForm, JointForm, DocId } from "../model";
import * as B from "./builders.js";

/** 담보신탁 등 7종 서류 1건을 .docx 로 생성·다운로드 */
export function generateCollateralDoc(form: ContractForm, docId: DocId): Promise<void> {
  return B.generateCollateralDoc(form, docId);
}

/** 담보신탁 서류 1건을 PDF(인쇄창)로 생성.
 *  @returns 인쇄창이 실제로 열렸으면 true, 팝업 차단 등으로 열지 못했으면 false
 *  (호출부가 "생성 완료" 표시·생성 신선도 스냅샷 기록 여부를 결정). */
export function generateCollateralPDF(form: ContractForm, docId: DocId): boolean {
  return B.generateCollateralPDF(form, docId);
}

/** 처분신탁 계약서 PDF(인쇄창) 생성 — C-2 MVP(계약서만, .docx 후속). */
export function generateDisposalPDF(form: ContractForm, docId: DocId): boolean {
  return B.generateDisposalPDF(form, docId);
}

/** 공동사업표준협약서 .docx 생성·다운로드 */
export function generateJointDoc(jointForm: JointForm): Promise<void> {
  return B.generateJointDoc(jointForm);
}

/** 공동사업표준협약서 PDF(인쇄창) 생성.
 *  @returns 인쇄창이 실제로 열렸으면 true, 팝업 차단 등으로 열지 못했으면 false */
export function generateJointPDFDoc(jointForm: JointForm): boolean {
  return B.generateJointPDFDoc(jointForm);
}

/* ---- 미리보기 HTML (React dangerouslySetInnerHTML 용) ---- */
export function previewBodyHTML(form: ContractForm): string {
  return B.previewBodyHTML(form);
}
export function previewAnnexHTML(form: ContractForm): string {
  return B.previewAnnexHTML(form);
}
export function previewAnnex4HTML(form: ContractForm): string {
  return B.previewAnnex4HTML(form);
}

/** 서류별 완성 미리보기 HTML(iframe srcdoc 용) — 실제 생성물(PDF/DOCX)과 동일한 WYSIWYG */
export function previewDocHTML(form: ContractForm, docId: DocId): string {
  return B.previewDocHTML(form, docId);
}

/** 처분신탁 계약서 미리보기 HTML(iframe srcdoc 용) — C-2 MVP. */
export function previewDisposalHTML(form: ContractForm, docId: DocId): string {
  return B.previewDisposalDocHTML(form, docId);
}

/** 공동사업표준협약서 완성 미리보기 HTML(새 창 "크게 보기"용·읽기 전용) */
export function previewJointHTML(jointForm: JointForm): string {
  return B.previewJointHTML(jointForm);
}

/** 산출 .docx 다운로드명의 "계약 식별" 키(서류종류명 제외) — 위탁자·체결일·첫 담보물건 소재지.
 *  실제 다운로드명(docFileBase)과 단일 출처. 내 계약 목록에서 두 계약의 다운로드 파일이 섞이는지
 *  (같은 키) 판정에 재사용한다(표시 전용 — 파일명 산출 무변경). */
export function contractFileKey(form: ContractForm): string {
  return B.contractFileKey(form);
}
