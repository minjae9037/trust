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

/* ----------------------------------------------------------------
   다중 서류 통합 검수 — 준비된 N종을 한 새 창에 모아 정독
   "준비된 N종 일괄 생성(.docx)"(헤더 일괄 다운로드)의 검수 짝. 내려받기
   전에 준비된 서류 전부를 한 창에서 차례로 정독하게 한다(서류마다 따로
   "크게 보기"를 열 필요 없음). 각 서류의 완성 미리보기(previewDocHTML 출력)는
   ★변형 없이(verbatim) 개별 <iframe srcdoc> 에 격리 기록한다 — 단일 미리보기
   "크게 보기"와 동일하게 sandbox="" 로 스크립트 실행·부모 origin 접근을 차단하고
   (입력 PII 가 박힌 법적 서류 방어심층화), 셸은 서류 HTML 을 가공·치환하지 않는다.
   ⚠️ 조문·엔진·빌더·검증 게이트·산출물 무접촉 — 전달받은 서류 HTML 그대로.
   ---------------------------------------------------------------- */

/** 한 서류의 통합 검수 항목(표시 이름 + 완성 미리보기 HTML). */
export interface PreviewDoc {
  name: string;
  html: string;
}

/** <iframe srcdoc> 속성 임베드용 최소 이스케이프. 큰따옴표 속성 안에서 의미를
 *  갖는 `&`·`"` 만 엔티티로 바꾼다 — 브라우저가 srcdoc 을 파싱할 때 원래 문자로
 *  되돌리므로(무손실), 격리 문서 안의 조문·표·HTML 은 verbatim 으로 렌더된다.
 *  ★`&` 를 먼저 치환(이후 도입되는 `&` 재이스케이프 방지). */
export function escapeForSrcdoc(html: string): string {
  return String(html).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/** 가시 텍스트(서류 이름·머리말)용 HTML 텍스트 이스케이프. */
function escText(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** 준비된 서류들을 한 창에 모으는 셸 HTML 을 만든다 — 각 서류 = 격리 iframe(verbatim),
 *  서류 사이 page-break(인쇄 시 분리), 읽기 전용(자동 인쇄 스크립트 없음).
 *  순수 함수(부수효과 없음)라 가드가 출력 문자열을 직접 단언한다. */
export function buildMultiDocShell(docs: PreviewDoc[]): string {
  const count = docs.length;
  const sections = docs
    .map((d, i) => {
      const label = `${i + 1}. ${d.name}`;
      const sep = i > 0 ? ' style="page-break-before:always"' : "";
      // ★서류마다 고정 id(doc-N) — 목차(TOC) 앵커 점프 대상. scroll-margin-top 으로
      //   sticky 머리말+목차가 제목을 가리지 않게 한다(CSS).
      return (
        `<section class="doc" id="doc-${i + 1}"${sep}>` +
        `<h2 class="doc-title">${escText(label)}</h2>` +
        `<iframe class="doc-frame" sandbox="" title="${escapeForSrcdoc(d.name)} 미리보기" srcdoc="${escapeForSrcdoc(d.html)}"></iframe>` +
        `</section>`
      );
    })
    .join("\n");
  // 목차(TOC) — 서류 2종 이상일 때만 표출(단건은 점프 불필요). 순수 HTML 앵커(#doc-N)
  // 로 서류 간 이동 — 스크립트 0(읽기 전용 불변식 유지). 브라우저 기본 동작이라
  // sandbox 격리(iframe)·셸 script 0 을 깨지 않는다.
  const toc =
    count > 1
      ? `<nav class="toc" aria-label="서류 바로가기"><span class="toc-label">바로가기</span>` +
        docs
          .map(
            (d, i) =>
              `<a class="toc-link" href="#doc-${i + 1}">${escText(`${i + 1}. ${d.name}`)}</a>`,
          )
          .join("") +
        `</nav>`
      : "";
  return (
    `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">` +
    `<title>준비된 ${count}종 서류 통합 검수 미리보기</title>` +
    `<style>` +
    `*{box-sizing:border-box}` +
    `body{margin:0;background:#f4f1ea;color:#2b2620;` +
    `font-family:system-ui,-apple-system,"Segoe UI","Apple SD Gothic Neo","Malgun Gothic",sans-serif}` +
    `header.bar{position:sticky;top:0;z-index:3;background:#2b2620;color:#f4f1ea;padding:12px 20px;font-size:14px;font-weight:700}` +
    `header.bar .sub{margin-left:8px;font-weight:400;font-size:12px;opacity:.82}` +
    `nav.toc{position:sticky;top:41px;z-index:2;display:flex;flex-wrap:wrap;gap:6px;align-items:center;` +
    `background:#efe9dc;border-bottom:1px solid #cdbf9e;padding:8px 20px}` +
    `nav.toc .toc-label{font-size:12px;font-weight:700;color:#6b5d45;margin-right:2px}` +
    `nav.toc .toc-link{font-size:12px;color:#2b2620;text-decoration:none;background:#fff;` +
    `border:1px solid #d8d2c4;border-radius:999px;padding:3px 10px}` +
    `nav.toc .toc-link:hover{border-color:#cdbf9e;background:#f4f1ea}` +
    `.doc{max-width:900px;margin:22px auto;padding:0 16px;scroll-margin-top:96px}` +
    `.doc-title{margin:0 0 8px;padding-bottom:6px;font-size:15px;font-weight:700;border-bottom:2px solid #cdbf9e}` +
    `.doc-frame{width:100%;height:78vh;border:1px solid #d8d2c4;border-radius:8px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.06)}` +
    `</style></head><body>` +
    `<header class="bar">준비된 서류 통합 검수 미리보기` +
    `<span class="sub">${count}종 · 읽기 전용(인쇄 대화상자 없음) · 내려받기 전 정독용</span></header>` +
    toc +
    sections +
    `</body></html>`
  );
}

/** 준비된 서류 여러 종을 한 새 창에 모아 띄운다(읽기 전용·자동 인쇄 없음).
 *  openDocPreviewWindow(단일)의 다중 짝 — 동일한 open→write→close · 차단/빈
 *  결과 신호 패턴. html 이 빈/공백인 항목은 건너뛰고, 유효 서류가 0이면 창을
 *  열지 않는다.
 *  @param docs   [{name, html}] — html 빈/공백 항목 제외
 *  @param openFn () => window.open(...) 주입(null=차단)
 *  @returns opened·empty(유효 서류 0)·blocked */
export function openMultiDocPreviewWindow(
  docs: PreviewDoc[],
  openFn: () => PreviewWindow | null,
): PreviewOpenResult {
  const valid = docs.filter((d) => d.html && d.html.trim());
  if (!valid.length) return "empty";
  const w = openFn();
  if (!w) return "blocked";
  w.document.open();
  w.document.write(buildMultiDocShell(valid));
  w.document.close();
  return "opened";
}
