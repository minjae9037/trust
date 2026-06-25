/* ============================================================
   회귀 가드 — 서류 위저드(DocStep) "받게 될 파일명" 다운로드 직전 미리보기

   배경: 산출 .docx 다운로드명은 `${서류종류명}_${위탁자}_${체결일}_${첫소재지[ 외N]}`
   (builders.js docFileBase/contractFileKey)로만 정해지고 계약 제목은 들어가지 않는다.
   내 계약 목록은 "다운로드 파일명 충돌" 경고로 사후 고지하지만, 정작 서류를 생성·
   다운로드하는 위저드(DocStep)에서는 "지금 받게 될 파일이 무슨 이름인지"를 보여 주지
   않아, 사용자가 같은 위탁자·체결일·소재지의 다른 계약과 섞일지 생성 전에 알 수 없었다.

   변경:
     ① builders.js — collateralDocFileName(f, docId) export. generateDoc 의
        fname(`${docFileBase}.docx`)과 동일 단일 출처(docFileBase 재사용). 알 수 없는
        docId 면 "" 반환.
     ② docx/index.ts — 타입드 파사드 collateralDocFileName(form, docId): string.
     ③ DocStep.tsx — collateralDocFileName 으로 docxFileName 산출 + 다운로드 버튼 행
        아래 "저장 파일명: {docxFileName}" 미리보기 렌더(필수 입력 충족 ok 일 때만).

   핵심 불변식:
     - ★표시 전용 — 조문·엔진·검증 게이트(validateDoc)·산출물(docx) 생성 동작 무접촉.
       미리보기는 실제 다운로드명(docFileBase)과 단일 출처라 드리프트 0.
     - 필수 입력 충족(ok)일 때만 표출 — 미완 입력의 임시(부정형) 파일명 미표시.
     - 낭독은 가시 텍스트가 전달, 글리프(💾)는 aria-hidden(장식). role=status 미부착
       (생성 상태 낭독은 상단 영속 라이브 영역 전담 → 중복 낭독 0).
     - 새 CSS 0 — 기존 field-hint + 인라인 style 만.

   단언:
     (A) builders.js 단일 출처 — collateralDocFileName export·docFileBase 재사용·
         미지 docId "" 반환
     (B) docx/index.ts 파사드 — collateralDocFileName(form, docId): string 위임
     (C) DocStep 배선 — import·docxFileName 산출(collateralDocFileName)·ok 게이트
         미리보기·strong 으로 파일명·💾 aria-hidden
     (D) 무접촉 — DocStep 미리보기 role=status 미부착·새 CSS 0·생성기/검증 동작 무변경

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-doc-filename-preview.mjs
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
const globals = read("src", "app", "globals.css");

console.log("\n[A] builders.js 단일 출처 — collateralDocFileName(docFileBase 재사용·미지 docId \"\")");
{
  ok(/export function collateralDocFileName\(f, docId\) \{/.test(builders),
     "collateralDocFileName(f, docId) export");
  // 실제 다운로드명(docFileBase)과 단일 출처 — 같은 합성 경로를 재사용.
  ok(/return `\$\{docFileBase\(meta\.name, f\)\}\.docx`;/.test(builders),
     "docFileBase(meta.name, f) + \".docx\" 반환(generateDoc fname 과 단일 출처)");
  ok(/const meta = COLLATERAL_OUTPUT_DOCS\.find\(\(d\) => d\.id === docId\);\s*\n\s*if \(!meta\) return "";/.test(builders),
     "알 수 없는 docId → \"\" 반환(표시 생략·산출 동작 무변경)");
  // generateDoc 의 실제 다운로드 fname 합성이 같은 docFileBase 를 쓰는지(드리프트 0 계약).
  ok(/const fname = `\$\{docFileBase\(meta\.name, f\)\}\.docx`;/.test(builders),
     "generateDoc fname 도 docFileBase 합성 — 미리보기와 동일 식");
}

console.log("\n[B] docx/index.ts 파사드 — 타입드 위임");
{
  ok(/export function collateralDocFileName\(form: ContractForm, docId: DocId\): string \{/.test(facade),
     "collateralDocFileName(form, docId): string 파사드");
  ok(/return B\.collateralDocFileName\(form, docId\);/.test(facade),
     "builders.collateralDocFileName 으로 위임");
}

console.log("\n[C] DocStep 배선 — import·docxFileName 산출·ok 게이트 미리보기·파일명 strong·글리프 장식");
{
  ok(/collateralDocFileName,/.test(docstep),
     "DocStep 이 collateralDocFileName import");
  ok(/const docxFileName = useMemo\(\(\) => collateralDocFileName\(form, docId\), \[form, docId\]\);/.test(docstep),
     "docxFileName = collateralDocFileName(form, docId) 산출");
  ok(/\{ok && docxFileName && \(/.test(docstep),
     "필수 입력 충족(ok)일 때만 미리보기 표출(미완 임시 파일명 미표시)");
  ok(/저장 파일명: <strong style=\{\{ wordBreak: "break-all" \}\}>\{docxFileName\}<\/strong>/.test(docstep),
     "\"저장 파일명: {docxFileName}\" 을 strong 으로 표시");
  // 💾 글리프는 장식(aria-hidden) — 의미는 가시 텍스트("저장 파일명")가 전달.
  const fnIdx = docstep.indexOf("저장 파일명: <strong");
  const hiddenBefore = docstep.lastIndexOf('aria-hidden="true"', fnIdx);
  ok(fnIdx >= 0 && hiddenBefore >= 0 && fnIdx - hiddenBefore < 120,
     "💾 글리프는 aria-hidden(장식 — 의미는 가시 텍스트가 전달)");
}

console.log("\n[D] 무접촉 — 미리보기 role=status 미부착·새 CSS 0·생성/검증 동작 무변경");
{
  // 미리보기 <p> 가 role=status 를 갖지 않아야 한다(생성 상태 낭독은 상단 영속 라이브
  // 영역 전담 → 중복 낭독 0). "저장 파일명" 직전 ~200자 내에 role=status 가 없어야 함.
  const fnIdx = docstep.indexOf("저장 파일명: <strong");
  const slice = docstep.slice(Math.max(0, fnIdx - 200), fnIdx);
  ok(!/role="status"/.test(slice),
     "미리보기 블록에 role=status 미부착(중복 낭독 0 — 상단 라이브 영역 전담)");
  ok(!/\.doc-filename-preview\b/.test(globals),
     "globals 에 미리보기 전용 클래스 미추가(새 CSS 0 — 기존 field-hint + 인라인 style)");
  // collateralDocFileName 은 docFileBase 만 호출 — Packer/Document(.docx 생성) 무접촉.
  const fnDef = builders.slice(builders.indexOf("export function collateralDocFileName"));
  const fnBody = fnDef.slice(0, fnDef.indexOf("\n}") + 2);
  ok(!/Packer|new Document|a\.download|Blob/.test(fnBody),
     "collateralDocFileName 본문은 산출(Packer/Blob/download) 미호출 — 이름 계산 전용");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
