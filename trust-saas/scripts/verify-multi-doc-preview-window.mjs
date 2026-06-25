/* ============================================================
   회귀 가드 — 준비된 N종 "통합 검수 미리보기"(한 새 창) 안전·verbatim 격리

   배경(완성도 UX·정확성, 비-산출물): 위저드 헤더의 "준비된 N종 일괄 생성(.docx)"은
   필수 입력을 충족한 서류를 한 번에 내려받게 한다. 그런데 내려받기 전 정독 검수는
   각 DocStep "🔍 크게 보기"를 서류마다 따로 열어야 했다(법적 서류=정확성인데 검수
   동선이 단건). "🔍 준비된 N종 검수용 미리보기"는 같은 ready 집합을 한 새 창에 모아
   읽기 전용으로 정독하게 한다 — 일괄 다운로드의 검수 짝.

   불변식(openMultiDocPreviewWindow / buildMultiDocShell, src/lib/ui/preview-window.ts):
     (A) 유효 서류 0(빈/공백 html 뿐·빈 배열) → "empty" + openFn 미호출(새 창 안 띄움)
     (B) openFn=null(팝업 차단) → "blocked"(단건 openDocPreviewWindow 와 동형 신호)
     (C) 정상 → "opened" + open→write→close 순서 + 셸 1회 기록
     (D) ★verbatim 격리 — 각 서류 html 은 변형 없이 <iframe srcdoc> 에 임베드
         (escapeForSrcdoc 의 &·" 엔티티화는 브라우저 srcdoc 파싱 시 원복 = 무손실)
     (E) escapeForSrcdoc — `&`·`"` 만 바꾸고 왕복 복원(가공 아님)
     (F) 빈/공백 html 항목은 건너뛰고 유효 서류만 임베드(부분 준비 내성)
     (G) 셸 구조 — sandbox="" 격리·서류 사이 page-break(N-1)·읽기전용(자동 인쇄
         스크립트 0)·doc 섹션 N개·실제 previewDocHTML 조문 보존
     (H) 배선 — Wizard 가 previewDocHTML·openMultiDocPreviewWindow 사용,
         previewAllReady 가 ready 집합 map·window.open(_blank) 주입·차단 안내,
         일괄 생성(generateAllReady) 보존(회귀)·새 CSS 0(.doc-progress-batch 재사용)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-multi-doc-preview-window.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  openMultiDocPreviewWindow,
  buildMultiDocShell,
  escapeForSrcdoc,
} from "../src/lib/ui/preview-window.ts";
import { previewDocHTML } from "../src/lib/engine/docx/index.ts";
import { blankContractForm } from "../src/lib/engine/model.ts";

const __dir = dirname(fileURLToPath(import.meta.url));
const src = (rel) => readFileSync(join(__dir, "..", rel), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

// 열린 새 창을 흉내내는 가짜 window — open/write/close 호출을 기록한다.
function makeSink() {
  const sink = { html: "", calls: [] };
  const win = {
    document: {
      open() { sink.calls.push("open"); },
      write(h) { sink.calls.push("write"); sink.html += String(h); },
      close() { sink.calls.push("close"); },
    },
  };
  return { sink, win };
}

// escapeForSrcdoc 의 역연산(왕복 검증용) — &quot; 먼저, &amp; 나중(인코딩 역순).
function decodeSrcdoc(s) {
  return String(s).replace(/&quot;/g, '"').replace(/&amp;/g, "&");
}

console.log("\n[A] 유효 서류 0 → 'empty' + openFn 미호출");
{
  for (const docs of [
    [],
    [{ name: "빈", html: "" }, { name: "공백", html: "  \n\t" }],
  ]) {
    let opened = 0;
    const r = openMultiDocPreviewWindow(docs, () => { opened++; return makeSink().win; });
    ok(r === "empty", `${docs.length}개(유효 0) → 'empty'`);
    ok(opened === 0, `${docs.length}개(유효 0) → openFn 미호출(새 창 안 띄움)`);
  }
}

console.log("\n[B] 팝업 차단(openFn=null) → 'blocked'");
{
  const r = openMultiDocPreviewWindow([{ name: "서류", html: "<body>문서</body>" }], () => null);
  ok(r === "blocked", "openFn=null → 'blocked'(차단을 성공으로 오인하지 않을 신호)");
}

console.log("\n[C] 정상 → 'opened' + open→write→close 순서 + 셸 1회 기록");
{
  const { sink, win } = makeSink();
  const r = openMultiDocPreviewWindow(
    [{ name: "계약서", html: "<body><h1>담보신탁계약서</h1></body>" }],
    () => win,
  );
  ok(r === "opened", "정상 → 'opened'");
  ok(sink.calls.join(",") === "open,write,close", "document.open→write→close 순서");
  ok(sink.calls.filter((c) => c === "write").length === 1, "write 1회(셸 한 번에 기록)");
  ok(sink.html === buildMultiDocShell([{ name: "계약서", html: "<body><h1>담보신탁계약서</h1></body>" }]),
    "열린 창에 buildMultiDocShell 출력 기록");
}

console.log("\n[D] verbatim 격리 — 각 서류 html 을 변형 없이 srcdoc 에 임베드");
{
  const docs = [
    { name: "별첨", html: '<table><tr><td>제1조 "목적" & 특약</td></tr></table>' },
    { name: "계약서", html: "<body>＄ 1,200,000,000.- 우선수익한도</body>" },
  ];
  const shell = buildMultiDocShell(docs);
  for (const d of docs) {
    const embedded = escapeForSrcdoc(d.html);
    ok(shell.includes(embedded), `srcdoc 에 이스케이프된 서류 임베드: ${d.html.slice(0, 18)}…`);
    ok(decodeSrcdoc(embedded) === d.html, `srcdoc 디코딩 왕복 = 원본 byte 동일: ${d.html.slice(0, 18)}…`);
  }
  // 셸이 서류 html 을 가공·치환하지 않는다(이스케이프 외 변형 없음).
  ok(!shell.includes('제1조 "목적"'), "원본 큰따옴표가 셸에 raw 로 새지 않음(&quot; 격리)");
}

console.log("\n[E] escapeForSrcdoc — &·\" 만 바꾸고 왕복 복원");
{
  ok(escapeForSrcdoc('a & b "c"') === "a &amp; b &quot;c&quot;", "& → &amp;, \" → &quot;");
  ok(escapeForSrcdoc("<table>제1조</table>") === "<table>제1조</table>", "< > 등은 그대로(속성 안 무의미)");
  for (const s of ['<b>"인용" & 표</b>', "제1조(목적)", "＄1,200,000,000", "&already;"]) {
    ok(decodeSrcdoc(escapeForSrcdoc(s)) === s, "왕복 복원(무손실): " + s.slice(0, 16));
  }
}

console.log("\n[F] 빈/공백 항목은 건너뛰고 유효 서류만 임베드(부분 준비 내성)");
{
  const { sink, win } = makeSink();
  const r = openMultiDocPreviewWindow(
    [
      { name: "유효1", html: "<body>가</body>" },
      { name: "빈", html: "" },
      { name: "공백", html: "   " },
      { name: "유효2", html: "<body>나</body>" },
    ],
    () => win,
  );
  ok(r === "opened", "유효 2 + 빈 2 → 'opened'");
  // doc 섹션은 유효 2개만(빈 항목 미임베드).
  ok((sink.html.match(/<section class="doc"/g) || []).length === 2, "doc 섹션 정확히 2개(유효만)");
  ok(sink.html.includes("<body>가</body>") && sink.html.includes("<body>나</body>"), "유효 서류 2종 임베드");
  ok(!/title="빈 미리보기"/.test(sink.html), "빈 서류 항목은 임베드되지 않음");
}

console.log("\n[G] 셸 구조 — sandbox 격리·page-break·읽기전용·실 조문 보존");
{
  const form = blankContractForm();
  const contractHtml = previewDocHTML(form, "contract");
  ok(contractHtml.length > 0, "previewDocHTML(contract) 비어있지 않음");
  const docs = [
    { name: "계약서", html: contractHtml },
    { name: "테스트", html: "<body>두번째</body>" },
  ];
  const shell = buildMultiDocShell(docs);
  // 각 서류 = 격리 iframe(sandbox="" — 스크립트 실행·부모 origin 접근 차단).
  ok((shell.match(/<iframe class="doc-frame" sandbox=""/g) || []).length === 2, "iframe sandbox=\"\" 격리 정확히 2개");
  // 서류 사이 page-break(N-1=1) — 인쇄 시 분리, 첫 서류엔 없음.
  ok((shell.match(/page-break-before:always/g) || []).length === 1, "서류 사이 page-break N-1개(첫 서류 제외)");
  // 읽기 전용 — 셸 자체에 스크립트 없음(자동 인쇄/동작 없음). previewDocHTML 도 stripAutoPrint 됨.
  ok(!/<script\b/i.test(shell), "셸·임베드 서류에 <script> 0(읽기 전용·자동 인쇄 없음)");
  // 실제 계약서 핵심 조문 문자열 보존(이스케이프된 형태로 — 실 산출물과 동일 내용).
  ok(shell.includes(escapeForSrcdoc(contractHtml)), "실 미리보기(contract) verbatim 임베드");
  // 머리말 — 읽기 전용·정독용 안내.
  ok(/읽기 전용/.test(shell) && /통합 검수/.test(shell), "머리말: 통합 검수·읽기 전용 안내");
}

console.log("\n[I] 목차(TOC) — 2종 이상일 때 순수 HTML 앵커 점프(스크립트 0 유지)");
{
  // 2종 이상 → nav.toc + 서류 수만큼 앵커 링크(#doc-N) + 섹션 id(doc-N).
  const docs3 = [
    { name: "담보신탁계약서", html: "<body>가</body>" },
    { name: '위임장 "을"', html: "<body>나</body>" },
    { name: "이사회 의사록", html: "<body>다</body>" },
  ];
  const shell3 = buildMultiDocShell(docs3);
  ok(/<nav class="toc" aria-label="서류 바로가기">/.test(shell3), "2종↑: nav.toc(aria-label) 표출");
  ok((shell3.match(/class="toc-link" href="#doc-\d+"/g) || []).length === 3, "TOC 앵커 링크 = 서류 수(3)");
  for (let i = 1; i <= 3; i++) {
    ok(shell3.includes(`<section class="doc" id="doc-${i}"`), `섹션 id=doc-${i}(앵커 대상)`);
    ok(shell3.includes(`href="#doc-${i}"`), `TOC 링크 href=#doc-${i}`);
  }
  // TOC 라벨 = 번호+서류명(escText: &·<·> 만 이스케이프, 큰따옴표는 텍스트라 그대로).
  ok(shell3.includes('2. 위임장 "을"'), "TOC 링크 라벨: 번호+서류명(큰따옴표 verbatim)");
  // TOC 도 스크립트 0(순수 앵커 — 읽기 전용 불변식 유지).
  ok(!/<script\b/i.test(shell3), "TOC 포함 셸에도 <script> 0(순수 HTML 앵커)");
  // 앵커 점프 시 sticky 머리말·목차가 제목을 가리지 않도록 scroll-margin-top.
  ok(/\.doc\{[^}]*scroll-margin-top/.test(shell3), ".doc scroll-margin-top(sticky 가림 방지)");
  // 단건(1종) → 목차 미표출(점프 불필요).
  const shell1 = buildMultiDocShell([{ name: "계약서", html: "<body>가</body>" }]);
  ok(!/<nav class="toc"/.test(shell1), "1종: 목차(nav.toc) 미표출(점프 불필요)");
  ok(shell1.includes('<section class="doc" id="doc-1"'), "1종도 섹션 id=doc-1 부여(일관)");
}

console.log("\n[H] 배선 — Wizard previewAllReady + 일괄 생성 보존 + 새 CSS 0");
{
  const wiz = src("src/components/trust/Wizard.tsx");
  const globals = src("src/app/globals.css");

  ok(/import \{ generateCollateralDoc, previewDocHTML \} from "@\/lib\/engine\/docx"/.test(wiz),
    "Wizard: previewDocHTML import(docx 파사드)");
  ok(/import \{ openMultiDocPreviewWindow \} from "@\/lib\/ui\/preview-window"/.test(wiz),
    "Wizard: openMultiDocPreviewWindow import");
  // previewAllReady 본문만 추출해 검사.
  const m = wiz.match(/function previewAllReady\(\)\s*\{[\s\S]*?\n  \}/);
  ok(!!m, "previewAllReady 함수 추출");
  const body = m ? m[0] : "";
  ok(/docSteps\.filter\(\(s\) => docReady\[s\.idx\]\)/.test(body), "previewAllReady: ready 집합(docReady) 대상");
  ok(/previewDocHTML\(form,\s*s\.docId as DocId\)/.test(body), "previewAllReady: 라이브 form 으로 각 서류 미리보기 생성");
  ok(/openMultiDocPreviewWindow\(docs,/.test(body), "previewAllReady: 통합 창에 docs 전달");
  ok(/window\.open\(""\s*,\s*"_blank"/.test(body), "previewAllReady: window.open(_blank) 주입");
  ok(/r === "blocked"[\s\S]*?팝업 차단/.test(body), "previewAllReady: 차단 시 친화적 안내(성공 오인 방지)");
  // 버튼 배선 — 일괄 생성 버튼과 같은 ready>0 게이트·동일 .doc-progress-batch 스타일.
  ok(/onClick=\{previewAllReady\}/.test(wiz), "검수 미리보기 버튼 onClick=previewAllReady");
  ok(/준비된 \$\{readyCount\}종 검수용 미리보기/.test(wiz), "버튼 라벨: 준비된 N종 검수용 미리보기");
  // 회귀 — 일괄 생성(다운로드) 경로 보존.
  ok(/function generateAllReady\(\)/.test(wiz) && /generateCollateralDoc\(form, id\)/.test(wiz),
    "회귀: 일괄 생성(generateAllReady→generateCollateralDoc) 보존");
  ok(/준비된 \$\{readyCount\}종 일괄 생성\(\.docx\)/.test(wiz), "회귀: 일괄 생성 버튼 라벨 보존");
  // 새 CSS 0 — 기존 .doc-progress-batch 재사용, 새 클래스 미도입.
  ok(/className="doc-progress-batch"\s*\n\s*onClick=\{previewAllReady\}/.test(wiz),
    "검수 미리보기 버튼: 기존 .doc-progress-batch 재사용(새 CSS 0)");
  ok(!/doc-progress-preview/.test(globals) && !/doc-progress-preview/.test(wiz),
    "새 전용 CSS 클래스 미도입(globals·Wizard 무신설)");
  // previewMsg 안내는 role=status(동적 출현 낭독).
  ok(/\{previewMsg && \(/.test(wiz) && /className="doc-progress-msg" role="status"/.test(wiz),
    "통합 검수 안내 previewMsg: role=status 라이브 영역");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
