/* ============================================================
   회귀 가드 — 당사자 식별번호 입력 라벨 ↔ 산출물 라벨 정합성

   배경(입력↔출력 정합성 갭, UX/정확성):
     빌더(builders.js)는 당사자 식별번호 칸을 type 에 따라 다르게 렌더한다 —
     `type==="개인" ? "생년월일" : "법인등록번호"` (계약서 본문/별첨 표: builders.js
     962·976·1075·2095). 그런데 입력 UI(PartyCard.tsx)는 type 과 무관하게 항상
     "법인등록번호"로 라벨을 보여줬다. 그 결과 **개인 당사자는 "법인등록번호"라는
     이름의 칸에 생년월일을 입력**하게 되고, 정작 산출되는 계약서에는 같은 값이
     "생년월일"로 박히는 입력↔출력 라벨 불일치가 있었다(법적 서류 도구에서 혼동·오기
     유발). 데이터 형식·저장 구조는 그대로 두고 라벨만 산출물 분기에 맞췄다.

   ★영향 점검 — 무회귀:
     데이터 모델(corpRegFront/corpRegBack)·빌더·검증 게이트·조문 전부 무변경.
     순수 라벨 헬퍼 partyIdLabel(calc.ts)를 신설해 입력 UI 가 사용할 뿐이며,
     빌더의 기존 분기를 단일 출처로 미러링한다(라벨 표시만 — 산출물 byte 무변경).

   본 가드(조문·엔진·생성/DOCX 로직 무접촉 — 입력 라벨 정합성만):
     (A) partyIdLabel 단일 출처 — 개인→"생년월일" / 법인→"법인등록번호" / 기본(법인)
     (B) 빌더 정합성: builders.js 가 동일 분기(개인 ? 생년월일 : 법인등록번호)를 보유
         → 입력 UI 가 미러링하는 "산출물 라벨"이 실재함을 단언(분기 drift 차단)
     (C) PartyCard 가 partyIdLabel 을 import·사용하고, 해당 칸 라벨을 하드코딩하지
         않음(개인일 때도 "법인등록번호"로만 보이던 회귀 재발 정적 차단)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-party-id-label.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { partyIdLabel } from "../src/lib/engine/calc.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const builders = readFileSync(join(root, "src/lib/engine/docx/builders.js"), "utf8");
const card = readFileSync(join(root, "src/components/trust/steps/PartyCard.tsx"), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

console.log("\n[A] partyIdLabel 단일 출처 — type 별 라벨");
ok(partyIdLabel("개인") === "생년월일", '개인 → "생년월일"');
ok(partyIdLabel("법인") === "법인등록번호", '법인 → "법인등록번호"');
ok(partyIdLabel(undefined) === "법인등록번호", "기본(undefined) → 법인등록번호(법인 취급)");

console.log("\n[B] 빌더 정합성 — 산출물이 동일 분기(개인=생년월일)를 실제로 렌더");
// 공백 변형을 허용해 "개인" ? "생년월일" : "법인등록번호" 분기 존재를 단언
const branch = /"개인"\s*\?\s*"생년월일"\s*:\s*"법인등록번호"/;
ok(branch.test(builders), 'builders.js 에 (개인 ? 생년월일 : 법인등록번호) 분기 존재');
ok(builders.includes("생년월일"), "builders.js 가 '생년월일' 라벨을 산출(개인 칸)");

console.log("\n[C] PartyCard 입력 UI ↔ partyIdLabel 사용(하드코딩 라벨 회귀 차단)");
ok(/import\s*\{[^}]*partyIdLabel[^}]*\}\s*from\s*["']@\/lib\/engine\/calc["']/.test(card),
  "PartyCard 가 calc 에서 partyIdLabel 을 import");
// a11y 정비로 라벨 div 가 그룹 id(aria-labelledby 연결)를 가질 수 있어 속성 허용.
ok(/field-label["'][^>]*>\{partyIdLabel\(party\.type\)\}</.test(card),
  "식별번호 칸 라벨 = {partyIdLabel(party.type)} (type 분기)");
ok(!/field-label["']>법인등록번호</.test(card),
  "하드코딩 라벨 '법인등록번호' 잔존 없음(개인일 때도 고정 노출되던 회귀 차단)");

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
