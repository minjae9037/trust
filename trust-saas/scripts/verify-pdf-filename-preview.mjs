/* ============================================================
   회귀 가드 — 서류/공동사업 위저드 "PDF로 저장 시 받게 될 파일명" 미리보기

   배경: 두 위저드(DocStep·JointForm)는 Word(.docx)와 PDF 두 버튼을 모두 제공한다.
   직전(ca8fc80·0427cd1)이 .docx "저장 파일명" 미리보기를 신설했으나 PDF 경로는 비어
   있었다 — "PDF 생성"은 인쇄창을 띄우고 "PDF로 저장" 시 브라우저가 인쇄 HTML <title>을
   파일명으로 제안하는데, 그 이름은 .docx 와 달라(끝에 " (PDF)") 생성 전에 알 수 없었다.

   변경:
     ① builders.js — collateralPdfTitle(f, docId) export(pdfDocTitle 재사용·미지 docId "")
        + jointPdfTitle(jointForm) export(jointFileBase 재사용). buildJointFullHTML 의
        인쇄 <title> 합성을 jointPdfTitle(jf) 로 단일출처화(옛 인라인 합성 제거).
     ② docx/index.ts — 타입드 파사드 collateralPdfTitle / jointPdfTitle.
     ③ DocStep.tsx·JointForm.tsx — pdfFileName 산출 + .docx 미리보기 아래 "PDF로 저장
        시(브라우저 제안): {pdfFileName}" 렌더(필수 입력 충족 ok 일 때만).

   핵심 불변식:
     - ★표시 전용 — 조문·엔진·검증 게이트(validateDoc/validateJoint)·산출물 동작 무접촉.
       미리보기는 실제 인쇄 <title>(pdfDocTitle/jointPdfTitle)과 단일 출처라 드리프트 0.
     - 필수 입력 충족(ok)일 때만 표출 — 미완 입력의 임시 파일명 미표시.
     - 낭독은 가시 텍스트가 전달, 글리프(🖨)는 aria-hidden(장식). role=status 미부착.
     - 새 CSS 0 — 기존 field-hint + 인라인 style 만.

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-pdf-filename-preview.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const __dir = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(join(__dir, "..", ...p), "utf8");
const builders = read("src", "lib", "engine", "docx", "builders.js");
const facade = read("src", "lib", "engine", "docx", "index.ts");
const docstep = read("src", "components", "trust", "steps", "DocStep.tsx");
const jointform = read("src", "components", "trust", "JointForm.tsx");
const globals = read("src", "app", "globals.css");

console.log("\n[A] builders.js 단일 출처 — collateralPdfTitle / jointPdfTitle(인쇄 <title> 재사용)");
{
  ok(/export function collateralPdfTitle\(f, docId\) \{/.test(builders),
     "collateralPdfTitle(f, docId) export");
  // 인쇄 HTML <title>(pdfDocTitle)과 동일 단일 출처 — 같은 합성 경로를 재사용.
  ok(/return pdfDocTitle\(meta\.name, f\);/.test(builders),
     "pdfDocTitle(meta.name, f) 반환(인쇄 <title> 과 단일 출처)");
  ok(/const meta = COLLATERAL_OUTPUT_DOCS\.find\(\(d\) => d\.id === docId\);\s*\n\s*if \(!meta\) return "";\s*\n\s*return pdfDocTitle/.test(builders),
     "알 수 없는 docId → \"\" 반환(표시 생략·산출 동작 무변경)");
  ok(/export function jointPdfTitle\(jointForm\) \{/.test(builders),
     "jointPdfTitle(jointForm) export");
  ok(/return `\$\{jointFileBase\(jointForm\)\} \(PDF\)`;/.test(builders),
     "jointFileBase(jointForm) + \" (PDF)\" 반환(인쇄 <title> 과 단일 출처)");
  // buildJointFullHTML 의 인쇄 <title> 도 같은 jointPdfTitle 을 쓰는지(드리프트 0 계약).
  ok(/const pdfTitle = jointPdfTitle\(jf\);/.test(builders),
     "buildJointFullHTML pdfTitle = jointPdfTitle(jf) — 미리보기와 동일 식");
  // ★옛 인라인 합성(`공동사업표준협약서_${gName} (PDF)`)이 제거됐는지(음성 회귀 잠금).
  ok(!/공동사업표준협약서_\$\{gName\} \(PDF\)/.test(builders),
     "옛 인라인 PDF 제목 합성 제거(단일출처 회귀 잠금)");
}

console.log("\n[B] docx/index.ts 파사드 — 타입드 위임");
{
  ok(/export function collateralPdfTitle\(form: ContractForm, docId: DocId\): string \{/.test(facade),
     "collateralPdfTitle(form, docId): string 파사드");
  ok(/return B\.collateralPdfTitle\(form, docId\);/.test(facade),
     "builders.collateralPdfTitle 으로 위임");
  ok(/export function jointPdfTitle\(jointForm: JointForm\): string \{/.test(facade),
     "jointPdfTitle(jointForm): string 파사드");
  ok(/return B\.jointPdfTitle\(jointForm\);/.test(facade),
     "builders.jointPdfTitle 으로 위임");
}

console.log("\n[C] DocStep 배선 — import·pdfFileName 산출·ok 게이트 미리보기·🖨 장식");
{
  ok(/collateralPdfTitle,/.test(docstep),
     "DocStep 이 collateralPdfTitle import");
  ok(/const pdfFileName = useMemo\(\(\) => collateralPdfTitle\(form, docId\), \[form, docId\]\);/.test(docstep),
     "pdfFileName = collateralPdfTitle(form, docId) 산출");
  ok(/\{ok && pdfFileName && \(/.test(docstep),
     "필수 입력 충족(ok)일 때만 PDF 미리보기 표출");
  ok(/PDF로 저장 시\(브라우저 제안\): <strong style=\{\{ wordBreak: "break-all" \}\}>\{pdfFileName\}<\/strong>/.test(docstep),
     "\"PDF로 저장 시(브라우저 제안): {pdfFileName}\" 을 strong 으로 표시");
  const i = docstep.indexOf("PDF로 저장 시(브라우저 제안): <strong");
  const h = docstep.lastIndexOf('aria-hidden="true"', i);
  ok(i >= 0 && h >= 0 && i - h < 120,
     "🖨 글리프는 aria-hidden(장식 — 의미는 가시 텍스트가 전달)");
}

console.log("\n[C2] JointForm 배선 — import·pdfFileName 산출·ok 게이트 미리보기·🖨 장식");
{
  ok(/jointPdfTitle \}/.test(jointform) || /jointPdfTitle,/.test(jointform) || /, jointPdfTitle/.test(jointform),
     "JointForm 이 jointPdfTitle import");
  ok(/const pdfFileName = useMemo\(\(\) => jointPdfTitle\(jointForm\), \[jointForm\]\);/.test(jointform),
     "pdfFileName = jointPdfTitle(jointForm) 산출");
  ok(/\{ok && pdfFileName && \(/.test(jointform),
     "필수 입력 충족(ok)일 때만 PDF 미리보기 표출");
  ok(/PDF로 저장 시\(브라우저 제안\): <strong style=\{\{ wordBreak: "break-all" \}\}>\{pdfFileName\}<\/strong>/.test(jointform),
     "\"PDF로 저장 시(브라우저 제안): {pdfFileName}\" 을 strong 으로 표시");
  const i = jointform.indexOf("PDF로 저장 시(브라우저 제안): <strong");
  const h = jointform.lastIndexOf('aria-hidden="true"', i);
  ok(i >= 0 && h >= 0 && i - h < 120,
     "🖨 글리프는 aria-hidden(장식 — 의미는 가시 텍스트가 전달)");
}

console.log("\n[D] 무접촉 — 미리보기 role=status 미부착·새 CSS 0·이름 계산 함수 산출 미호출");
{
  for (const [name, src] of [["DocStep", docstep], ["JointForm", jointform]]) {
    const i = src.indexOf("PDF로 저장 시(브라우저 제안): <strong");
    const slice = src.slice(Math.max(0, i - 200), i);
    ok(!/role="status"/.test(slice),
       `${name} PDF 미리보기 블록에 role=status 미부착(중복 낭독 0)`);
  }
  ok(!/\.pdf-filename-preview\b/.test(globals),
     "globals 에 PDF 미리보기 전용 클래스 미추가(새 CSS 0)");
  // collateralPdfTitle/jointPdfTitle 본문은 이름 계산 전용 — 인쇄창/산출 미호출.
  for (const fn of ["collateralPdfTitle", "jointPdfTitle"]) {
    const def = builders.slice(builders.indexOf("export function " + fn));
    const body = def.slice(0, def.indexOf("\n}") + 2);
    ok(!/window\.print|Packer|new Document|a\.download|Blob|\.open\(/.test(body),
       `${fn} 본문은 인쇄창/산출(print/Packer/Blob/open) 미호출 — 이름 계산 전용`);
  }
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
