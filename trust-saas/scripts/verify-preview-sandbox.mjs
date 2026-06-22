/* ============================================================
   회귀 가드 — 읽기 전용 미리보기 iframe sandbox 격리(방어심층화)

   배경/갭: DocStep·JointForm 우측 "실시간 미리보기"는 빌더 완성 HTML을
   <iframe srcDoc> 로 격리 렌더한다. srcdoc 은 기본적으로 부모와 동일 origin
   이라, 렌더된 HTML 안에서 스크립트가 실행되면 부모 origin(=저장 계약이 담긴
   localStorage)에 접근할 수 있다. 빌더는 이미 escHTML/escAttr 로 입력을
   이스케이프하고 previewDocHTML/previewJointHTML 은 stripAutoPrint 로 <script>
   를 제거하지만, 이 미리보기는 입력한 PII(주민번호·사업자번호 등)가 박힌 법적
   서류이므로 그 두 방어가 회귀해도(이벤트 핸들러 주입 등 stripAutoPrint 가
   못 잡는 벡터 포함) 코드가 실행되거나 부모 origin 에 닿지 못하도록 iframe 자체를
   완전 격리 sandbox(빈 값=allow-* 전무)로 가둔다. 정적 HTML+CSS 렌더라
   allow-scripts/allow-same-origin 불요 — 표·조문·인라인 스타일은 그대로 표시.

   함께 검증: JointForm.onExpandPreview 의 라이브 렌더 방어 패리티(담보신탁
   DocStep 과 동형 — 라이브 previewJointHTML 이 throw 하면 디바운스 previewHtml
   로 폴백해 빈 창/미처리 예외 방지).

   본 가드의 단언:
     (A) DocStep preview-frame iframe 에 sandbox 격리(빈 값) 부여
     (B) JointForm preview-frame iframe 에 sandbox 격리(빈 값) 부여
     (C) ★격리 잠금 회귀 차단 — 두 컴포넌트에 allow-scripts/allow-same-origin 토큰 부재
     (D) 방어 1차 실증 — 악성 입력(이벤트 핸들러/스크립트)을 넣어도 렌더 HTML에
         실행 가능한 <script>/onerror= 가 없고(stripAutoPrint+이스케이프),
         입력은 이스케이프(&lt;img…)되어 본문에 표시됨
     (E) JointForm.onExpandPreview 라이브 렌더 방어 패리티(try/catch→previewHtml 폴백)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-preview-sandbox.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { blankContractForm, blankJointForm } from "../src/lib/engine/model.ts";

const B = await import("../src/lib/engine/docx/builders.js");

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const docStep = read("src/components/trust/steps/DocStep.tsx");
const jointForm = read("src/components/trust/JointForm.tsx");

// preview-frame iframe(읽기 전용 미리보기) 블록에서 sandbox 속성을 확인한다.
// className="preview-frame" 직후(~160자 내)에 sandbox="" 가 와야 한다.
const hasSandboxedPreviewFrame = (src) =>
  /className="preview-frame"[\s\S]{0,200}?\bsandbox=""/.test(src);

console.log("\n[A] DocStep preview-frame iframe sandbox 격리(빈 값)");
ok(/<iframe/.test(docStep) && /className="preview-frame"/.test(docStep), "DocStep preview-frame iframe 존재");
ok(hasSandboxedPreviewFrame(docStep), 'DocStep preview-frame 에 sandbox="" 부여');

console.log("\n[B] JointForm preview-frame iframe sandbox 격리(빈 값)");
ok(/<iframe/.test(jointForm) && /className="preview-frame"/.test(jointForm), "JointForm preview-frame iframe 존재");
ok(hasSandboxedPreviewFrame(jointForm), 'JointForm preview-frame 에 sandbox="" 부여');

console.log("\n[C] ★격리 잠금 회귀 차단 — sandbox 속성값에 allow-scripts/allow-same-origin 부재");
// 산문(주석)이 아니라 실제 sandbox="…" 속성값만 검사한다 — 누군가 격리를
// 느슨하게(sandbox="allow-scripts" 등) 바꾸면 회귀로 잡는다.
for (const [name, src] of [["DocStep", docStep], ["JointForm", jointForm]]) {
  const sandboxAttrs = [...src.matchAll(/\bsandbox="([^"]*)"/g)].map((m) => m[1]);
  ok(sandboxAttrs.length > 0, `${name}: sandbox 속성 존재(${sandboxAttrs.length}개)`);
  ok(sandboxAttrs.every((v) => !/allow-scripts/.test(v)), `${name}: sandbox 값에 allow-scripts 없음(스크립트 실행 불능 유지)`);
  ok(sandboxAttrs.every((v) => !/allow-same-origin/.test(v)), `${name}: sandbox 값에 allow-same-origin 없음(부모 origin 차단 유지)`);
}

console.log("\n[D] 방어 1차 실증 — 악성 입력에도 실행 핸들러 없음 + 이스케이프 표시");
{
  const PAYLOAD = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
  const ESCAPED = "&lt;img"; // escHTML 결과 — 입력이 본문에 이스케이프되어 표시됨을 확인
  // ── 담보신탁: 7종 서류 모두 악성 입력을 박아 렌더 ──
  const cf = blankContractForm();
  cf.trustors[0].name = PAYLOAD;
  if (cf.properties && cf.properties[0]) cf.properties[0].address = PAYLOAD;
  const ids = ["contract", "appform", "poa", "valReport", "boardMin", "cdd", "ubo"];
  let renderedEscapedSomewhere = false;
  for (const id of ids) {
    let html = "";
    try { html = B.previewDocHTML(cf, id); } catch { html = ""; }
    ok(typeof html === "string" && html.length > 0, `담보신탁 ${id}: 렌더됨`);
    ok(!/<script/i.test(html), `담보신탁 ${id}: 실행 가능한 <script> 없음`);
    // stripAutoPrint 가 못 잡는 이벤트 핸들러 주입 — 이스케이프로 무력화되어야 함
    ok(!/<img[^>]*onerror=/i.test(html), `담보신탁 ${id}: 실행 가능한 onerror 핸들러 없음`);
    if (html.includes(ESCAPED)) renderedEscapedSomewhere = true;
  }
  ok(renderedEscapedSomewhere, "담보신탁: 악성 입력이 본문에 이스케이프(&lt;img…)되어 표시됨(렌더+이스케이프 실증)");

  // ── 공동사업표준협약서(joint) ──
  const jf = blankJointForm();
  jf.gap.name = PAYLOAD;
  let jhtml = "";
  try { jhtml = B.previewJointHTML(jf); } catch { jhtml = ""; }
  ok(typeof jhtml === "string" && jhtml.length > 0, "joint: 렌더됨");
  ok(!/<script/i.test(jhtml), "joint: 실행 가능한 <script> 없음");
  ok(!/<img[^>]*onerror=/i.test(jhtml), "joint: 실행 가능한 onerror 핸들러 없음");
  ok(jhtml.includes(ESCAPED), "joint: 악성 입력이 본문에 이스케이프되어 표시됨");
}

console.log("\n[E] JointForm.onExpandPreview 라이브 렌더 방어 패리티(try/catch→previewHtml 폴백)");
{
  // 라이브 previewJointHTML 을 try 로 감싸 throw 시 디바운스 previewHtml 로 폴백.
  ok(/try\s*\{[\s\S]*?live\s*=\s*previewJointHTML\(jointForm\)/.test(jointForm),
    "라이브 previewJointHTML(jointForm) 를 try 안에서 호출");
  ok(/catch[\s\S]*?live\s*=\s*previewHtml/.test(jointForm),
    "throw 시 catch 에서 previewHtml 로 폴백");
  ok(/openDocPreviewWindow\(\s*live\s*,/.test(jointForm),
    "openDocPreviewWindow 에 폴백 가능한 live 전달");
  ok(!/openDocPreviewWindow\(\s*previewJointHTML\(jointForm\)/.test(jointForm),
    "★맨몸 previewJointHTML(jointForm) 직접 전달 잔존 없음(미처리 throw 차단)");
  // DocStep 의 기존 방어(무회귀)도 함께 확인
  ok(/try\s*\{[\s\S]*?live\s*=\s*previewDocHTML\(form,\s*docId\)/.test(docStep),
    "무회귀: DocStep onExpandPreview 도 동일 try/catch 방어 유지");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
