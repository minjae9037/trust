/* ============================================================
   회귀 가드 — PDF 인쇄창 팝업 차단 시 거짓 성공·거짓 신선도 차단

   배경(정확성/trust 갭, 비-산출물): DocStep 의 "🖨 PDF 생성"은
   generateCollateralPDF → generateDocPDF 에서 window.open(_blank) 으로
   인쇄창을 띄운다. 브라우저 팝업 차단으로 window.open 이 null 을 반환하면
   generateDocPDF 는 alert 만 띄우고 (기존엔) void 로 정상 반환했다. 그런데
   호출부 onPdf 는 그 결과를 모른 채 무조건 "PDF 인쇄창을 열었습니다" 성공
   메시지 + setGenSnap(formSnap)(생성 신선도 스냅샷) 을 기록했다.
   → 만든 적 없는 PDF 가 "생성됨(fresh)"으로 오인되어(17:07/17:21 생성
     신선도 작업이 막으려던 바로 그 "구버전/미생성 오인"이 PDF 팝업 차단
     경로에 잔존), 잘못된/없는 버전을 제출할 위험이 있었다(법적 효력 문서
     =운영원칙 2 정확성 최우선).

   수정(조문·엔진·빌더 본문·표·CSS 무접촉 — 반환 신호 + 호출부 분기만):
     · generateDocPDF/generateJointPDF: 인쇄창이 실제로 열렸으면 true,
       팝업 차단·문서정의 부재면 false 를 반환(단일 신호).
     · index.ts 파사드 generateCollateralPDF/generateJointPDFDoc: boolean 전파.
     · DocStep.onPdf: opened===true 일 때만 "생성 완료" 표시 + genSnap 기록,
       false 면 차단 안내 + genSnap 미기록(거짓 신선도 방지).

   본 가드의 단언:
     (A) 행동: 팝업 차단(window.open=null) → false 반환(=호출부가 생성으로
         오인하지 않을 신호)
     (B) 행동: 팝업 열림 → true 반환 + 열린 창에 실제 서류 HTML 기록(write)
     (C) 7종 docId 전부 일관(차단=false / 열림=true)
     (D) 문서정의 부재(알 수 없는 docId) → false(빈/오류 생성 차단)
     (E) joint PDF 도 동일 신호(차단=false / 열림=true)
     (F) 배선: index.ts boolean 전파 + DocStep onPdf 가 opened 분기로만
         genSnap 기록(차단 시 미기록) + 빌더 반환 신호 잔존 정적 단언
     (G) joint 배선: JointForm onPdf 가 generateJointPDFDoc 반환값(opened)으로
         분기 — 무조건 "열었습니다" 성공표시 제거(joint 컴포넌트 거짓 성공 차단)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-pdf-popup-guard.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { blankContractForm, blankJointForm } from "../src/lib/engine/model.ts";
import { COLLATERAL_OUTPUT_DOCS } from "../src/lib/engine/schema.ts";

const __dir = dirname(fileURLToPath(import.meta.url));
const src = (rel) => readFileSync(join(__dir, "..", rel), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

// 빌더는 window/document 를 함수 내부에서만 참조한다(미리보기 가드와 동일).
// alert 는 차단 경로에서 호출되므로 no-op 으로 막아 ReferenceError 를 방지한다.
let alertCalls = 0;
globalThis.alert = () => { alertCalls++; };

// 인쇄창이 열렸을 때를 흉내내는 가짜 window — document.write 로 HTML 을 모은다.
function makeOpenWindow(sink) {
  return {
    document: {
      open() {},
      write(h) { sink.html += String(h); },
      close() {},
    },
  };
}

const B = await import("../src/lib/engine/docx/builders.js");
const form = blankContractForm();

console.log("\n[A] 팝업 차단(window.open=null) → false (호출부가 '생성됨'으로 오인하지 않을 신호)");
{
  alertCalls = 0;
  globalThis.window = { open: () => null };
  const blocked = B.generateCollateralPDF(form, "contract");
  ok(blocked === false, "차단 시 generateCollateralPDF → false");
  ok(alertCalls === 1, "차단 시 사용자 안내(alert) 1회");
}

console.log("\n[B] 팝업 열림 → true + 열린 창에 실제 서류 HTML 기록");
{
  const sink = { html: "" };
  let openArgs = null;
  globalThis.window = { open: (...a) => { openArgs = a; return makeOpenWindow(sink); } };
  const opened = B.generateCollateralPDF(form, "contract");
  ok(opened === true, "열림 시 generateCollateralPDF → true");
  ok(/부동산담보신탁계약서/.test(sink.html), "열린 창에 실제 계약서 HTML 기록(write 호출)");
  ok(Array.isArray(openArgs) && openArgs[1] === "_blank", "window.open(_blank) 으로 새 창 요청");
}

console.log("\n[C] 7종 서류 docId 전부 일관 — 차단=false / 열림=true");
{
  for (const d of COLLATERAL_OUTPUT_DOCS) {
    globalThis.window = { open: () => null };
    ok(B.generateCollateralPDF(form, d.id) === false, `${d.id}: 차단 → false`);
    const sink = { html: "" };
    globalThis.window = { open: () => makeOpenWindow(sink) };
    const r = B.generateCollateralPDF(form, d.id);
    ok(r === true && sink.html.length > 0, `${d.id}: 열림 → true + HTML 기록`);
  }
}

console.log("\n[D] 문서정의 부재(알 수 없는 docId) → false(빈/오류 생성 차단)");
{
  alertCalls = 0;
  const sink = { html: "" };
  globalThis.window = { open: () => makeOpenWindow(sink) };
  const r = B.generateCollateralPDF(form, "___no_such_doc___");
  ok(r === false, "알 수 없는 docId → false");
  ok(sink.html === "", "문서정의 부재 시 인쇄창에 아무것도 쓰지 않음");
  ok(alertCalls === 1, "문서정의 부재 안내(alert) 1회");
}

console.log("\n[E] joint PDF 도 동일 신호(차단=false / 열림=true)");
{
  const jf = blankJointForm();
  globalThis.window = { open: () => null };
  ok(B.generateJointPDFDoc(jf) === false, "joint: 차단 → false");
  const sink = { html: "" };
  globalThis.window = { open: () => makeOpenWindow(sink) };
  ok(B.generateJointPDFDoc(jf) === true && sink.html.length > 0, "joint: 열림 → true + HTML 기록");
}

console.log("\n[F] 배선 — boolean 전파 + onPdf 가 opened 분기로만 genSnap 기록");
{
  const index = src("src/lib/engine/docx/index.ts");
  const docStep = src("src/components/trust/steps/DocStep.tsx");
  const builders = src("src/lib/engine/docx/builders.js");

  // 파사드가 boolean 으로 선언하고 빌더 결과를 그대로 전파.
  ok(/generateCollateralPDF\([^)]*\):\s*boolean/.test(index), "index.ts: generateCollateralPDF 반환형 boolean");
  ok(/return B\.generateCollateralPDF\(/.test(index), "index.ts: 빌더 결과 return 전파");
  ok(/generateJointPDFDoc\([^)]*\):\s*boolean/.test(index), "index.ts: generateJointPDFDoc 반환형 boolean");

  // 호출부가 반환값을 받아 분기한다.
  ok(/const opened = generateCollateralPDF\(form, docId\)/.test(docStep),
    "DocStep: onPdf 가 generateCollateralPDF 반환값(opened) 수신");
  // genSnap 기록이 opened===true 분기 안(else 이전)에만 있다(차단 시 미기록).
  ok(/if \(opened\) \{[\s\S]*?setGenSnap\(formSnap\)[\s\S]*?\} else \{/.test(docStep),
    "DocStep: setGenSnap 은 opened 분기 안에서만(차단 시 거짓 신선도 미기록)");
  ok(/PDF 창을 열지 못했습니다/.test(docStep), "DocStep: 차단 시 친화적 실패 안내");
  // 무조건 성공 표시(과거 패턴: 반환값 무시 후 바로 성공 메시지)가 사라졌는지.
  ok(!/generateCollateralPDF\(form, docId\);\s*\n\s*setMsg\("PDF 인쇄창을 열었습니다\(팝업 허용 필요\)/.test(docStep),
    "DocStep: 과거 무조건 '열었습니다' 성공표시 제거");

  // 빌더 반환 신호 잔존(차단 false · 성공 true) — 회귀 정적 차단.
  ok(/if \(!w\) \{[\s\S]*?return false;/.test(builders), "builders: window.open 실패(!w) → return false");
  ok(/w\.document\.close\(\);\s*\n[\s\S]*?return true;/.test(builders), "builders: 정상 기록 후 return true");
}

console.log("\n[G] joint 배선 — JointForm.onPdf 가 generateJointPDFDoc 반환값으로 분기(거짓 성공 차단)");
{
  // 빌더([E])·파사드([F])는 joint 도 boolean 을 올바로 반환하지만, JointForm 컴포넌트가
  // 그 반환값을 무시하고 무조건 "열었습니다"로 표시하면 팝업 차단 시 거짓 성공이 잔존한다
  // (DocStep 은 [F]에서 검증되나 joint 컴포넌트 배선은 미검증이던 갭). 호출부 분기를 정적 단언.
  const jointForm = src("src/components/trust/JointForm.tsx");

  // onPdf 가 반환값(opened)을 수신한다.
  ok(/const opened = generateJointPDFDoc\(jointForm\)/.test(jointForm),
    "JointForm: onPdf 가 generateJointPDFDoc 반환값(opened) 수신");
  // 성공 메시지가 opened 분기(삼항/조건) 안에만 있다 — 무조건 성공표시가 아니다.
  ok(/opened\s*\?[\s\S]*?인쇄창을 열었습니다/.test(jointForm),
    "JointForm: 성공 메시지는 opened 분기(조건부)에서만");
  // 차단 시 친화적 실패 안내가 존재.
  ok(/PDF 창을 열지 못했습니다/.test(jointForm), "JointForm: 차단 시 친화적 실패 안내");
  // 과거 패턴(반환값 무시 후 무조건 성공) 제거 — 정적 회귀 차단.
  ok(!/generateJointPDFDoc\(jointForm\);\s*\n\s*setMsg\("PDF 인쇄창을 열었습니다\."\)/.test(jointForm),
    "JointForm: 과거 무조건 '열었습니다' 성공표시 제거");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
