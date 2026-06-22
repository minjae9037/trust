/* ============================================================
   회귀 가드 — 인라인 검증 오류 ↔ 입력 컨트롤 접근성 연결 계약
   (PartyCard 식별번호·법인번호·사업자번호 · StepProperty 등기번호)

   배경(접근성 결함, 비-산출물): 15:08·15:24 에 입력 라벨↔컨트롤(htmlFor/id·
   aria-labelledby) a11y 는 정비됐으나, 정작 **인라인 검증 오류**(사업자번호·
   법인번호·생년월일·등기 고유번호 체크섬/형식 오류)는 `role="alert"` div 로
   **표시만** 될 뿐, 오류가 난 입력 컨트롤 자체에는 aria-invalid 도
   aria-describedby 도 없었다. 그 결과 스크린리더 사용자가 그 필드에 포커스해도
   ①오류 상태(invalid)임을 알 수 없고 ②오류 내용이 컨트롤과 연결되지 않아
   포커스 시 안내되지 않았다(WCAG 3.3.1 오류 식별 / 4.1.2 Name·Role·Value).
   라벨 연결에 이은 a11y thread 의 마지막 갭 = **오류 상태의 프로그래밍적 연결**.

   수정 패턴(가산적·비파괴):
     · 오류 div 에 id 부여(fid("corpErr")/("birthErr")/("bizErr") · prop-${i}-regNo-err)
     · 오류가 난 입력에 aria-invalid={flag || undefined}
       + aria-describedby={flag ? errId : undefined}
     · corpInvalid·birthInvalid 는 type(법인/개인) 상호배타 → 활성 1개 id 만 참조

   ★범위: 산출물(DOCX/PDF)·조문·엔진·검증 게이트(validate.ts)·데이터 모델·
     onChange·금액 에코 전부 무접촉 — 오류 표시의 접근성 시맨틱만 추가.
     기존 role="alert" 는 보존(오류 발생 순간 announce + 포커스 시 describedby
     이중 안내).

   실행:
     cd trust-saas
     node scripts/verify-inline-error-a11y.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");
const party = read("src/components/trust/steps/PartyCard.tsx");
const prop = read("src/components/trust/steps/StepProperty.tsx");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

console.log("=== 인라인 검증 오류 ↔ 입력 컨트롤 접근성 연결 검증 ===\n");

// ──────────────────────────────────────────────
// PartyCard
// ──────────────────────────────────────────────
console.log("[PartyCard]");

// (A) 식별번호(앞/뒤) input 2칸 모두 aria-invalid + aria-describedby(corp/birth 상호배타)
const regInvalidAttr = /aria-invalid=\{corpInvalid \|\| birthInvalid \|\| undefined\}/g;
const regDescAttr = /aria-describedby=\{corpInvalid \? fid\("corpErr"\) : birthInvalid \? fid\("birthErr"\) : undefined\}/g;
ok((party.match(regInvalidAttr) || []).length === 2,
  `(A1) 식별번호 앞/뒤 input 2칸 aria-invalid (corp||birth) (실제 ${(party.match(regInvalidAttr) || []).length})`);
ok((party.match(regDescAttr) || []).length === 2,
  `(A2) 식별번호 앞/뒤 input 2칸 aria-describedby (corpErr/birthErr 상호배타) (실제 ${(party.match(regDescAttr) || []).length})`);

// (B) corp/birth 오류 div 에 매칭 id 부여
ok(/<div id=\{fid\("corpErr"\)\} className="field-hint" role="alert"/.test(party),
  "(B1) 법인등록번호 오류 div id={fid(\"corpErr\")} + role=alert 보존");
ok(/<div id=\{fid\("birthErr"\)\} className="field-hint" role="alert"/.test(party),
  "(B2) 생년월일 오류 div id={fid(\"birthErr\")} + role=alert 보존");

// (C) 사업자번호 3칸 모두 aria-invalid + aria-describedby(bizErr)
const bizInvalidAttr = /aria-invalid=\{bizInvalid \|\| undefined\}/g;
const bizDescAttr = /aria-describedby=\{bizInvalid \? fid\("bizErr"\) : undefined\}/g;
ok((party.match(bizInvalidAttr) || []).length === 3,
  `(C1) 사업자번호 3칸 aria-invalid={bizInvalid} (실제 ${(party.match(bizInvalidAttr) || []).length})`);
ok((party.match(bizDescAttr) || []).length === 3,
  `(C2) 사업자번호 3칸 aria-describedby={bizErr} (실제 ${(party.match(bizDescAttr) || []).length})`);
ok(/<div id=\{fid\("bizErr"\)\} className="field-hint" role="alert"/.test(party),
  "(C3) 사업자번호 오류 div id={fid(\"bizErr\")} + role=alert 보존");

// (D) ★고아 참조 0 — describedby 가 참조하는 모든 errKey 가 동명 오류 div id 로 실재
//     (한 describedby 안에 corpErr/birthErr 2개가 함께 올 수 있어 속성별 전수 추출)
const partyDescAttrs = party.match(/aria-describedby=\{[^}]*\}/g) || [];
const partyErrKeys = partyDescAttrs.flatMap((a) =>
  [...a.matchAll(/fid\("(\w+Err)"\)/g)].map((m) => m[1]));
const uniqPartyErrKeys = [...new Set(partyErrKeys)];
// corpErr·birthErr·bizErr + loanErr(대출금액 무효 안내·우선수익자 showLoanFields, StepLoanCalc 패리티)=4
ok(uniqPartyErrKeys.length === 4 && uniqPartyErrKeys.every((k) =>
    new RegExp(`<div id=\\{fid\\("${k}"\\)\\}`).test(party)),
  `(D) PartyCard describedby 참조 errKey 전부 동명 오류 div id 로 실재=고아 0 (${uniqPartyErrKeys.join(",")})`);

// ──────────────────────────────────────────────
// StepProperty
// ──────────────────────────────────────────────
console.log("\n[StepProperty]");
const regNoCond = "p.regNo.trim().length > 0 && !isValidRegNo(p.regNo)";
ok(party != null && prop.includes("aria-invalid={(p.regNo.trim().length > 0 && !isValidRegNo(p.regNo)) || undefined}"),
  "(E1) 등기번호 input aria-invalid (조건=오류 표시 조건과 동일)");
ok(prop.includes("aria-describedby={p.regNo.trim().length > 0 && !isValidRegNo(p.regNo) ? `prop-${i}-regNo-err` : undefined}"),
  "(E2) 등기번호 input aria-describedby={prop-${i}-regNo-err}");
ok(/<div id=\{`prop-\$\{i\}-regNo-err`\} className="field-hint" role="alert"/.test(prop),
  "(E3) 등기번호 오류 div id={`prop-${i}-regNo-err`} + role=alert 보존");
// (F) 무회귀 — 오류 조건이 aria 와 표시에서 동일(중복 분기 없이 같은 식)
ok((prop.match(new RegExp(regNoCond.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length >= 3,
  "(F) 등기번호 오류 조건식이 aria-invalid·aria-describedby·표시 div 에 일관 적용(≥3회)");

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
