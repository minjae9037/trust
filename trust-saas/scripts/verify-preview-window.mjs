/* ============================================================
   회귀 가드 — 미리보기 "크게 보기"(새 창) 안전·verbatim 기록

   배경(완성도 UX·정확성, 비-산출물): DocStep 우측 실시간 미리보기는 sticky·
   뷰포트 높이 제한·~12px 의 좁은 2분할 패널이라 다중 페이지 법적 서류(담보신탁
   계약서 등)를 정독 검수하기 어렵다. "🔍 크게 보기"는 현재 미리보기
   (previewDocHTML 출력 — 자동 인쇄 스크립트가 이미 제거된 완성 문서 HTML)를
   별도 창에 전체 크기로 띄우는 읽기 전용 보기다. PDF 생성(window.print)과 달리
   인쇄 대화상자를 띄우지 않으며, 전달받은 html 을 변형 없이 그대로 기록한다.

   불변식(openDocPreviewWindow, src/lib/ui/preview-window.ts):
     (A) 빈/공백 html → "empty" 반환 + openFn 미호출(입력 전 새 창 안 띄움)
     (B) openFn=null(팝업 차단) → "blocked"(PDF 팝업 가드와 동형 — 차단을
         성공으로 오인하지 않을 신호)
     (C) 정상 → "opened" + 열린 창에 html 기록(open→write→close 순서)
     (D) ★verbatim — write 된 내용이 입력 html 과 byte 동일(조문·빌더 무변형)
     (E) 다양한 html 형태(스크립트 잔재·유니코드·대용량) 무크래시·무변형
     (F) ★실제 미리보기 연동 — previewDocHTML(계약서) 출력을 그대로 띄워도
         "opened" + 핵심 조문 문자열 보존(실 산출물과 동일)
     (G) 배선 — DocStep 가 openDocPreviewWindow 사용·차단 분기 안내,
         preview-window.ts 가 html 무변형(write(html) 직접 전달)
     (H) ★라이브 폼 정독(JointForm 패리티) — "크게 보기" 새 창은 디바운스된
         previewHtml 이 아니라 최신(라이브) form 으로 생성한다(타이핑 직후에도
         구버전 정독 방지, 법적 서류=정확성). 인라인 미리보기는 여전히 디바운스.

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-preview-window.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { openDocPreviewWindow } from "../src/lib/ui/preview-window.ts";
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

console.log("\n[A] 빈/공백 html → 'empty' + openFn 미호출");
{
  for (const empty of ["", "   ", "\n\t ", null, undefined]) {
    let opened = 0;
    const r = openDocPreviewWindow(empty, () => { opened++; return makeSink().win; });
    ok(r === "empty", `${JSON.stringify(empty)} → 'empty'`);
    ok(opened === 0, `${JSON.stringify(empty)} → openFn 미호출(새 창 안 띄움)`);
  }
}

console.log("\n[B] 팝업 차단(openFn=null) → 'blocked'");
{
  const r = openDocPreviewWindow("<html><body>문서</body></html>", () => null);
  ok(r === "blocked", "openFn=null → 'blocked'(차단을 성공으로 오인하지 않을 신호)");
}

console.log("\n[C] 정상 → 'opened' + open→write→close 순서");
{
  const { sink, win } = makeSink();
  const html = "<html><body><h1>담보신탁계약서</h1></body></html>";
  const r = openDocPreviewWindow(html, () => win);
  ok(r === "opened", "정상 → 'opened'");
  ok(sink.calls.join(",") === "open,write,close", "document.open→write→close 순서");
  ok(sink.html === html, "열린 창에 html 기록(write)");
}

console.log("\n[D] verbatim — write 내용이 입력 html 과 byte 동일(무변형)");
{
  const samples = [
    "<html><body>제1조(목적) 본 계약은…</body></html>",
    "<!DOCTYPE html><meta charset=\"utf-8\"><body>＄ 1,200,000,000.- 우선수익한도</body>",
    "위탁자 ○○ · 소재지 서울특별시 강남구  &lt;특약&gt; <table><tr><td>가</td></tr></table>",
  ];
  for (const html of samples) {
    const { sink, win } = makeSink();
    openDocPreviewWindow(html, () => win);
    ok(sink.html === html, "입력 html 과 기록 내용 byte 동일: " + html.slice(0, 24) + "…");
  }
}

console.log("\n[E] 다양한 형태(스크립트 잔재·유니코드·대용량) 무크래시·무변형");
{
  const big = "<body>" + "법".repeat(50000) + "</body>";
  const withScript = "<body>본문<script>alert(1)</script></body>";
  for (const html of [big, withScript, "<단일 태그", "텍스트만"]) {
    const { sink, win } = makeSink();
    const r = openDocPreviewWindow(html, () => win);
    ok(r === "opened" && sink.html === html, "무크래시·무변형: " + html.slice(0, 16) + "…");
  }
}

console.log("\n[F] 실제 미리보기(previewDocHTML 계약서) 연동 — opened + 조문 보존");
{
  const form = blankContractForm();
  const previewHtml = previewDocHTML(form, "contract");
  ok(previewHtml.length > 0, "previewDocHTML(contract) 비어있지 않음");
  ok(!/<script\b/i.test(previewHtml), "미리보기는 자동 인쇄 스크립트 제거됨(읽기 전용)");
  const { sink, win } = makeSink();
  const r = openDocPreviewWindow(previewHtml, () => win);
  ok(r === "opened", "실 미리보기 → 'opened'");
  ok(sink.html === previewHtml, "실 미리보기 html 변형 없이 그대로 기록(verbatim)");
  ok(/부동산담보신탁계약서/.test(sink.html), "핵심 조문 문자열 보존(실 산출물과 동일)");
}

console.log("\n[G] 배선 — DocStep 사용·차단 분기 + preview-window 무변형 기록");
{
  const docStep = src("src/components/trust/steps/DocStep.tsx");
  const helper = src("src/lib/ui/preview-window.ts");

  ok(/import \{ openDocPreviewWindow \} from "@\/lib\/ui\/preview-window"/.test(docStep),
    "DocStep: openDocPreviewWindow import");
  ok(/openDocPreviewWindow\(live,/.test(docStep),
    "DocStep: 라이브 생성본(live) 으로 호출");
  ok(/window\.open\(""\s*,\s*"_blank"/.test(docStep),
    "DocStep: window.open(_blank) 주입");
  ok(/r === "blocked"[\s\S]*?팝업 차단/.test(docStep),
    "DocStep: 차단 시 친화적 안내(성공 오인 방지)");
  // 헬퍼가 html 을 변형 없이 그대로 write 에 전달(가공·치환 금지).
  ok(/w\.document\.write\(html\)/.test(helper),
    "preview-window: write(html) 무변형 직접 전달");
  ok(/if \(!html \|\| !html\.trim\(\)\) return "empty"/.test(helper),
    "preview-window: 빈/공백 → empty(새 창 안 띄움)");
  ok(/if \(!w\) return "blocked"/.test(helper),
    "preview-window: openFn=null → blocked");
}

console.log("\n[H] ★라이브 폼 정독 — '크게 보기'는 디바운스 아닌 최신 form 으로 생성(JointForm 패리티)");
{
  const docStep = src("src/components/trust/steps/DocStep.tsx");
  // onExpandPreview 본문만 떼어 검사(인라인 미리보기 memo 와 혼동 방지).
  const m = docStep.match(/function onExpandPreview\(\)\s*\{[\s\S]*?\n  \}/);
  ok(!!m, "onExpandPreview 함수 추출");
  const body = m ? m[0] : "";
  // 새 창은 라이브 form 으로 생성(debouncedForm/previewHtml 디바운스본을 직접 띄우지 않음).
  ok(/previewDocHTML\(form,\s*docId\)/.test(body),
    "onExpandPreview: 라이브 previewDocHTML(form, docId) 로 새 창 생성");
  ok(/openDocPreviewWindow\(live,/.test(body),
    "onExpandPreview: 라이브 생성본(live) 을 새 창에 전달");
  ok(!/openDocPreviewWindow\(previewHtml,/.test(body),
    "onExpandPreview: 디바운스 previewHtml 을 직접 띄우지 않음(구버전 정독 방지)");
  // 드문 throw 시 디바운스 previewHtml 폴백(빈 창 방지) — try/catch 로 안전.
  ok(/try\s*\{[\s\S]*previewDocHTML\(form,\s*docId\)[\s\S]*\}\s*catch\s*\{[\s\S]*live\s*=\s*previewHtml/.test(body),
    "onExpandPreview: 라이브 생성 실패 시 previewHtml 폴백(빈 창 방지)");
  // 인라인(2분할) 미리보기는 여전히 디바운스(타이핑 끊김 방지) — 회귀 방지.
  ok(/previewDocHTML\(debouncedForm,\s*docId\)/.test(docStep),
    "인라인 미리보기는 여전히 debouncedForm(250ms 디바운스 보존)");
  ok(/const previewPending = form !== debouncedForm/.test(docStep),
    "previewPending = 참조 불일치(갱신 대기 신호) 보존");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
