/* ============================================================
   회귀 가드 — 공동사업표준협약서 "크게 보기"(새 창) 미리보기

   배경(완성도 UX, 비-산출물): 담보신탁 DocStep 은 우측 실시간 미리보기 +
   "🔍 크게 보기"(새 창 전체 크기)로 다중 페이지 법적 서류를 정독 검수할 수
   있으나, 공동사업표준협약서(JointForm)는 미리보기가 전무해 생성(Word/PDF)
   전 본문을 육안 확인할 동선이 없었다. 이를 담보신탁과 동형으로 마감 —
   previewJointHTML(jointForm) 출력(자동 인쇄 <script> 제거된 완성 문서 HTML)을
   openDocPreviewWindow 로 새 창에 변형 없이 띄우는 읽기 전용 보기.

   불변식:
     (A) previewJointHTML — buildJointFullHTML 본문 보존 + 자동 인쇄
         <script> 제거(읽기 전용, window.print 미발동)
     (B) 핵심 조문·구조 문자열 보존(제목·제1조·특약사항·"을"=신탁사 고정)
     (C) 입력 값(사업명·갑 상호 등)이 미리보기에 반영(WYSIWYG)
     (D) openDocPreviewWindow 연동 — "opened" + verbatim 기록(byte 동일)
     (E) 빈 폼도 무크래시(미리보기 생성·새 창 기록)
     (F) 배선 — JointForm 가 previewJointHTML + openDocPreviewWindow 사용·
         차단 분기 안내, index 파사드가 previewJointHTML 노출

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-joint-preview-window.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { openDocPreviewWindow } from "../src/lib/ui/preview-window.ts";
import { previewJointHTML } from "../src/lib/engine/docx/index.ts";
import { blankJointForm } from "../src/lib/engine/model.ts";

const __dir = dirname(fileURLToPath(import.meta.url));
const src = (rel) => readFileSync(join(__dir, "..", rel), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

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

// 샘플 입력(갑·사업 정보) — WYSIWYG 반영 확인용.
function sampleJoint() {
  const jf = blankJointForm();
  jf.gap.name = "주식회사 가나개발";
  jf.gap.repDir = "홍길동";
  jf.gap.address = "서울특별시 강남구 테헤란로 1";
  jf.gap.corpRegFront = "110111";
  jf.gap.corpRegBack = "1234567";
  jf.project.name = "역삼동 공동주택 신축사업";
  jf.project.site = "서울특별시 강남구 역삼동 100-1";
  jf.project.scaleUse = "지하2층/지상15층 공동주택";
  jf.project.agreementMonth = "6";
  jf.project.agreementDay = "21";
  return jf;
}

console.log("\n[A] previewJointHTML — 본문 + 자동 인쇄 스크립트 제거(읽기 전용)");
{
  const html = previewJointHTML(sampleJoint());
  ok(typeof html === "string" && html.length > 0, "previewJointHTML → 비어있지 않은 문자열");
  ok(!/<script\b/i.test(html), "자동 인쇄 <script> 제거됨(window.print 미발동)");
  ok(!/window\.print\(\)/.test(html), "window.print() 미등장");
  ok(/<!DOCTYPE html>/i.test(html), "완성 문서 HTML(DOCTYPE 보존)");
}

console.log("\n[B] 핵심 조문·구조 보존");
{
  const html = previewJointHTML(sampleJoint());
  ok(/공동사업표준협약서/.test(html), "제목 '공동사업표준협약서' 보존");
  ok(/제1조 \[목적\]/.test(html), "제1조 [목적] 보존");
  ok(/제2조 \[공동사업주체 대표자\]/.test(html), "제2조 보존");
  ok(/특\s*약\s*사\s*항/.test(html), "특약사항 페이지 보존");
  ok(/한국투자부동산신탁/.test(html), "'을' = 신탁사(고정) 보존");
  ok(/제7조 \[합의관할\]/.test(html), "특약 마지막 조항(합의관할) 보존");
}

console.log("\n[C] 입력 값 WYSIWYG 반영");
{
  const html = previewJointHTML(sampleJoint());
  ok(/주식회사 가나개발/.test(html), "갑 상호 반영");
  ok(/홍길동/.test(html), "갑 대표이사 반영");
  ok(/역삼동 공동주택 신축사업/.test(html), "사업명 반영");
  ok(/역삼동 100-1/.test(html), "사업부지 반영");
  ok(/110111-1234567/.test(html), "갑 법인등록번호(앞-뒤 결합) 반영");
}

console.log("\n[D] openDocPreviewWindow 연동 — opened + verbatim 기록");
{
  const html = previewJointHTML(sampleJoint());
  const { sink, win } = makeSink();
  const r = openDocPreviewWindow(html, () => win);
  ok(r === "opened", "정상 → 'opened'");
  ok(sink.calls.join(",") === "open,write,close", "document.open→write→close 순서");
  ok(sink.html === html, "미리보기 html 변형 없이 그대로 기록(verbatim byte 동일)");
  // 팝업 차단 분기(PDF 가드와 동형).
  ok(openDocPreviewWindow(html, () => null) === "blocked", "팝업 차단 → 'blocked'");
}

console.log("\n[E] 빈 폼 무크래시");
{
  const html = previewJointHTML(blankJointForm());
  ok(typeof html === "string" && html.length > 0, "빈 폼 → 미리보기 생성(무크래시)");
  ok(/공동사업표준협약서/.test(html), "빈 폼도 제목·골격 보존");
  ok(!/<script\b/i.test(html), "빈 폼도 자동 인쇄 스크립트 제거");
  const { sink, win } = makeSink();
  ok(openDocPreviewWindow(html, () => win) === "opened" && sink.html === html,
    "빈 폼 미리보기도 새 창 기록(verbatim)");
}

console.log("\n[F] 배선 — JointForm 사용·차단 분기 + 파사드 노출");
{
  const joint = src("src/components/trust/JointForm.tsx");
  const facade = src("src/lib/engine/docx/index.ts");

  ok(/import \{[^}]*previewJointHTML[^}]*\} from "@\/lib\/engine\/docx"/.test(joint),
    "JointForm: previewJointHTML import");
  ok(/import \{ openDocPreviewWindow \} from "@\/lib\/ui\/preview-window"/.test(joint),
    "JointForm: openDocPreviewWindow import");
  // 라이브 previewJointHTML(jointForm) 로 생성하되 throw 시 디바운스 previewHtml 로
  // 폴백(담보신탁 DocStep onExpandPreview 패리티) → openDocPreviewWindow 엔 폴백
  // 가능한 live 를 전달한다(상세 방어 검증은 verify-preview-sandbox [E]).
  ok(/live\s*=\s*previewJointHTML\(jointForm\)/.test(joint) && /openDocPreviewWindow\(\s*live\s*,/.test(joint),
    "JointForm: previewJointHTML(jointForm)→live 로 호출(throw 폴백 방어)");
  ok(/window\.open\(""\s*,\s*"_blank"/.test(joint),
    "JointForm: window.open(_blank) 주입");
  ok(/r === "blocked"[\s\S]*?팝업 차단/.test(joint),
    "JointForm: 차단 시 친화적 안내(성공 오인 방지)");
  ok(/<span aria-hidden="true">🔍 <\/span>크게 보기/.test(joint),
    "JointForm: '🔍 크게 보기' 버튼 렌더(이모지 aria-hidden·verify-action-button-glyph-a11y)");
  ok(/export function previewJointHTML\(jointForm: JointForm\): string/.test(facade),
    "index 파사드: previewJointHTML 노출");
}

console.log("\n[G] 배선 — JointForm 우측 실시간 2분할 미리보기(담보신탁 DocStep 동형)");
{
  const joint = src("src/components/trust/JointForm.tsx");

  ok(/className="doc-split"/.test(joint),
    "JointForm: 2분할 레이아웃(.doc-split) 도입");
  ok(/className="doc-split-input"/.test(joint) && /className="doc-split-preview"/.test(joint),
    "JointForm: 좌(입력)/우(미리보기) 컬럼 존재");
  ok(/function useDebounced</.test(joint) && /useDebounced\(jointForm,\s*250\)/.test(joint),
    "JointForm: 미리보기 250ms 디바운스(입력 끊김 방지)");
  ok(/const previewPending = jointForm !== debouncedForm/.test(joint),
    "JointForm: previewPending = 참조 불일치(갱신 대기 신호)");
  ok(/previewJointHTML\(debouncedForm\)/.test(joint),
    "JointForm: 인라인 미리보기는 디바운스 폼으로 생성");
  ok(/srcDoc=\{previewHtml\}/.test(joint),
    "JointForm: iframe srcDoc 로 완성 협약서 격리 렌더(WYSIWYG)");
  ok(/className="preview-frame"/.test(joint),
    "JointForm: .preview-frame(실 산출물과 동일 본문) 렌더");
  ok(/previewPending && \(/.test(joint) && /갱신 중…/.test(joint),
    "JointForm: 디바운스 대기 중 '갱신 중…' 인디케이터");
  ok(/setPreviewNote\(/.test(joint) && /className="preview-note"/.test(joint),
    "JointForm: 팝업 차단 안내를 preview-note 로 표시(성공 오인 방지)");
  // 회귀 방지: 미리보기는 표시 전용 — 생성(Word/PDF) 로직 무접촉.
  ok(/generateJointDoc\(jointForm\)/.test(joint) && /generateJointPDFDoc\(jointForm\)/.test(joint),
    "JointForm: Word/PDF 생성 경로 무변경(미리보기는 표시 전용)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
