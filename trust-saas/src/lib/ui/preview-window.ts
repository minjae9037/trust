/* ================================================================
   미리보기 새 창(크게 보기) — 읽기 전용 전체 크기 보기
   선택한 서류의 완성 미리보기(previewDocHTML 출력: 자동 인쇄 스크립트가
   이미 제거된 완성 문서 HTML)를 별도 창에 그대로 띄워, 좁은 2분할 미리보기
   패널(sticky·뷰포트 높이 제한·~12px)로는 정독이 어려운 다중 페이지 법적
   서류를 전체 크기로 검수하게 돕는다. PDF 생성(window.print)과 달리 인쇄
   대화상자를 띄우지 않는 순수 보기.

   ⚠️ 조문·엔진·빌더·검증 게이트·산출물 무접촉 — 전달받은 html 을 변형 없이
   새 창에 기록만 한다(verbatim). window.open 의존부는 openFn 으로 주입한다.
   ================================================================ */

/** openDocPreviewWindow 가 기록에 사용하는 최소 창 형태(window.open 반환 호환). */
export interface PreviewWindow {
  document: { open(): void; write(html: string): void; close(): void };
}

/** 미리보기 새 창 열기 결과:
 *  - "opened":  새 창이 열려 HTML 을 기록함
 *  - "empty":   미리보기 HTML 이 비어 열지 않음(입력 전)
 *  - "blocked": 팝업 차단 등으로 창을 열지 못함 */
export type PreviewOpenResult = "opened" | "empty" | "blocked";

/** previewDocHTML 출력(html)을 새 창에 전체 크기로 띄운다(읽기 전용·자동 인쇄 없음).
 *  PDF 생성기(generateDocPDF)의 boolean 신호 패턴과 동형 — 호출부가 결과로
 *  성공/차단 안내를 분기해, 차단(팝업)을 성공으로 오인하지 않는다.
 *  @param html   미리보기 완성 문서 HTML(빈/공백이면 열지 않음)
 *  @param openFn () => window.open(...) 주입(null=차단)
 *  @returns opened·empty·blocked */
export function openDocPreviewWindow(
  html: string,
  openFn: () => PreviewWindow | null,
): PreviewOpenResult {
  if (!html || !html.trim()) return "empty";
  const w = openFn();
  if (!w) return "blocked";
  w.document.open();
  w.document.write(html);
  w.document.close();
  return "opened";
}
