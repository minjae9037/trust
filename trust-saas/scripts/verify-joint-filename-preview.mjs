/* ============================================================
   회귀 가드 — 공동사업표준협약서(JointForm) "받게 될 파일명" 다운로드 직전 미리보기

   배경: 담보신탁 위저드(DocStep)는 18:33(ca8fc80)에 "받게 될 파일명" 미리보기를
   받았으나, 공동사업표준협약서 폼(JointForm)에는 동선 끝(Word/PDF 생성 버튼)에
   "지금 받게 될 파일이 무슨 이름인지"가 전무했다. joint 산출 .docx 다운로드명은
   `공동사업표준협약서_${갑 상호}.docx`(builders.js generateJointDocx)로만 정해진다.
   같은 갑 상호의 다른 사업 협약서는 파일명이 같아 섞일 수 있어, 생성 전에 실제 이름을
   보여 식별·검수를 돕는다(담보신탁 collateralDocFileName 미리보기의 joint 패리티).

   변경:
     ① builders.js — jointDocFileName(jointForm) export + jointFileBase(jointForm)
        단일 출처. generateJointDocx 의 fname 도 jointDocFileName(state.jointForm) 으로
        교체 → 미리보기와 실제 다운로드명이 같은 식(드리프트 0).
     ② docx/index.ts — 타입드 파사드 jointDocFileName(jointForm): string.
     ③ JointForm.tsx — jointDocFileName 으로 docxFileName 산출 + 생성 버튼 행 아래
        "저장 파일명: {docxFileName}" 미리보기 렌더(필수 입력 충족 ok 일 때만).

   핵심 불변식:
     - ★표시 전용 — 조문·엔진·검증 게이트(validateJoint)·산출물(docx) 생성 동작 무접촉.
       미리보기는 실제 다운로드명(jointFileBase)과 단일 출처라 드리프트 0.
     - 필수 입력 충족(ok)일 때만 표출 — 미완 입력의 임시 파일명 미표시.
     - 낭독은 가시 텍스트가 전달, 글리프(💾)는 aria-hidden(장식). role=status 미부착
       (생성 상태 낭독은 상단 영속 라이브 영역 genLiveStatus 전담 → 중복 낭독 0).
     - 새 CSS 0 — 기존 field-hint + 인라인 style 만.

   단언:
     (A) builders.js 단일 출처 — jointDocFileName/jointFileBase export·`.docx` 합성·
         갑 상호 기준·generateJointDocx fname 이 jointDocFileName 재사용
     (B) docx/index.ts 파사드 — jointDocFileName(jointForm): string 위임
     (C) JointForm 배선 — import·docxFileName 산출(jointDocFileName)·ok 게이트
         미리보기·strong 으로 파일명·💾 aria-hidden
     (D) 무접촉 — 미리보기 role=status 미부착·새 CSS 0·jointDocFileName 산출(Packer/
         Blob/download) 미호출

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-joint-filename-preview.mjs
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
const jointform = read("src", "components", "trust", "JointForm.tsx");
const globals = read("src", "app", "globals.css");

console.log("\n[A] builders.js 단일 출처 — jointDocFileName/jointFileBase·갑 상호·generateJointDocx 재사용");
{
  ok(/export function jointDocFileName\(jointForm\) \{/.test(builders),
     "jointDocFileName(jointForm) export");
  ok(/return `\$\{jointFileBase\(jointForm\)\}\.docx`;/.test(builders),
     "jointFileBase(jointForm) + \".docx\" 반환(generateJointDocx fname 과 단일 출처)");
  ok(/function jointFileBase\(jointForm\) \{/.test(builders),
     "jointFileBase(jointForm) 단일 출처 helper");
  // 파일명 식별은 갑(시행사) 상호 기준 — 미입력이면 "갑".
  ok(/return `공동사업표준협약서_\$\{gName\}`;/.test(builders) &&
     /\(\(jointForm && jointForm\.gap && jointForm\.gap\.name\) \|\| "갑"\)\.trim\(\)/.test(builders),
     "base = 공동사업표준협약서_{갑 상호}(미입력 시 \"갑\")");
  // generateJointDocx 의 실제 다운로드 fname 이 같은 jointDocFileName 을 쓰는지(드리프트 0 계약).
  ok(/const fname = jointDocFileName\(state\.jointForm\);/.test(builders),
     "generateJointDocx fname 도 jointDocFileName 재사용 — 미리보기와 동일 식(드리프트 0)");
  // 옛 인라인 합성(드리프트 위험)이 부활하지 않음 — 음성 회귀 잠금.
  ok(!/const fname = `공동사업표준협약서_\$\{gName\}\.docx`;/.test(builders),
     "옛 인라인 fname 합성 부재(단일 출처 회귀 잠금)");
}

console.log("\n[B] docx/index.ts 파사드 — 타입드 위임");
{
  ok(/export function jointDocFileName\(jointForm: JointForm\): string \{/.test(facade),
     "jointDocFileName(jointForm): string 파사드");
  ok(/return B\.jointDocFileName\(jointForm\);/.test(facade),
     "builders.jointDocFileName 으로 위임");
}

console.log("\n[C] JointForm 배선 — import·docxFileName 산출·ok 게이트 미리보기·파일명 strong·글리프 장식");
{
  ok(/jointDocFileName \}? from "@\/lib\/engine\/docx"|jointDocFileName,? \} from "@\/lib\/engine\/docx"|, jointDocFileName \} from "@\/lib\/engine\/docx"/.test(jointform) ||
     /jointDocFileName/.test(jointform.slice(0, jointform.indexOf("export function JointForm"))),
     "JointForm 이 jointDocFileName import");
  ok(/const docxFileName = useMemo\(\(\) => jointDocFileName\(jointForm\), \[jointForm\]\);/.test(jointform),
     "docxFileName = jointDocFileName(jointForm) 산출");
  ok(/\{ok && docxFileName && \(/.test(jointform),
     "필수 입력 충족(ok)일 때만 미리보기 표출(미완 임시 파일명 미표시)");
  ok(/저장 파일명: <strong style=\{\{ wordBreak: "break-all" \}\}>\{docxFileName\}<\/strong>/.test(jointform),
     "\"저장 파일명: {docxFileName}\" 을 strong 으로 표시");
  // 💾 글리프는 장식(aria-hidden) — 의미는 가시 텍스트("저장 파일명")가 전달.
  const fnIdx = jointform.indexOf("저장 파일명: <strong");
  const hiddenBefore = jointform.lastIndexOf('aria-hidden="true"', fnIdx);
  ok(fnIdx >= 0 && hiddenBefore >= 0 && fnIdx - hiddenBefore < 120,
     "💾 글리프는 aria-hidden(장식 — 의미는 가시 텍스트가 전달)");
}

console.log("\n[D] 무접촉 — 미리보기 role=status 미부착·새 CSS 0·jointDocFileName 산출 동작 무변경");
{
  // 미리보기 <p> 가 role=status 를 갖지 않아야 한다(생성 상태 낭독은 상단 영속 라이브
  // 영역 genLiveStatus 전담 → 중복 낭독 0). "저장 파일명" 직전 ~200자 내 role=status 부재.
  const fnIdx = jointform.indexOf("저장 파일명: <strong");
  const slice = jointform.slice(Math.max(0, fnIdx - 200), fnIdx);
  ok(!/role="status"/.test(slice),
     "미리보기 블록에 role=status 미부착(중복 낭독 0 — 상단 라이브 영역 전담)");
  ok(!/\.joint-filename-preview\b/.test(globals) && !/\.doc-filename-preview\b/.test(globals),
     "globals 에 미리보기 전용 클래스 미추가(새 CSS 0 — 기존 field-hint + 인라인 style)");
  // jointDocFileName/jointFileBase 는 문자열만 합성 — Packer/Document(.docx 생성) 무접촉.
  const fnDef = builders.slice(builders.indexOf("export function jointDocFileName"));
  const fnBody = fnDef.slice(0, fnDef.indexOf("\n}") + 2);
  ok(!/Packer|new Document|a\.download|Blob/.test(fnBody),
     "jointDocFileName 본문은 산출(Packer/Blob/download) 미호출 — 이름 계산 전용");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
