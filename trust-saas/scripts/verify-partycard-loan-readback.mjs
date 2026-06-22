/* ============================================================
   회귀 가드 — PartyCard 대출금액 입력 한글 금액 readback + 무효 안내(StepLoanCalc 패리티)

   배경: 우선수익자 대출금액(`loanAmount`)은 STEP 02(StepParties→PartyCard, showLoanFields)와
   STEP 03(StepLoanCalc 한도표) **두 지점에서 같은 값**을 입력한다. 그런데 종전엔 StepLoanCalc
   에만 ① 한글 금액 readback(`amountToHangul`)과 ② 무효 금액 인라인 안내(`isPositiveAmount`)가
   있고, PartyCard 의 대출금액 입력엔 둘 다 없어 두 입력 지점의 피드백이 갈렸다. 담보신탁은
   법적 효력 문서라 수십억 단위 대출금액의 **자릿수 오입력**(0 하나 누락 등)을 입력 지점에서
   바로 짚지 못하면 STEP 03 에 가서야 인지하게 된다. 이제 PartyCard 도 게이트(validateDoc)·
   StepLoanCalc 와 동일한 단일 출처(isPositiveAmount/parseAmount/amountToHangul)로 readback·
   무효 안내를 띄워 두 입력 지점을 일치시킨다(표시/접근성 경계만 — 조문·엔진·산출물 무접촉).

   핵심 불변식:
     - 양(+)의 금액이면 한글 금액 readback 노출(자릿수 확인 → 오입력 방지).
     - 채웠는데 0·음수·비숫자면 무효 인라인 안내(게이트와 동일 판정).
     - 무효 안내 문구·readback 메커니즘이 StepLoanCalc 와 verbatim 동형(패리티).
     - 단일 출처 재사용 — 새 금액 포맷/판정 로직·새 CSS 없음.

   단언:
     (A) 단일 출처 거동 — 자릿수 구별(오십억≠오억)·0/빈/음수 무효·양수 유효
     (B) PartyCard 배선 — 단일 출처 import·loanFilled/loanInvalid·readback·무효 안내·aria 연결
     (C) StepLoanCalc 패리티 — 무효 문구 verbatim 일치·동일 클래스/단일 출처
     (D) 무접촉/무회귀 — readback 은 showLoanFields 블록 내부·loanAmount onChange 보존·
         새 CSS 클래스 0(loan-hangul 재사용=globals.css 기존)·조문/빌더 import 0

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-partycard-loan-readback.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { isPositiveAmount, parseAmount, amountToHangul } from "../src/lib/engine/calc.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const __dir = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(join(__dir, "..", ...p), "utf8");
const partyCard = read("src", "components", "trust", "steps", "PartyCard.tsx");
const stepLoan = read("src", "components", "trust", "steps", "StepLoanCalc.tsx");
const globals = read("src", "app", "globals.css");

console.log("\n[A] 단일 출처 거동 — 자릿수 구별·무효 판정(readback 의미 보장)");
{
  // 자릿수 오입력(0 하나 차이)이 readback 에서 또렷이 구별돼야 자릿수 확인 가치가 있다
  ok(amountToHangul("5000000000") === "오십억원정", "5,000,000,000 → 오십억원정");
  ok(amountToHangul("500000000") === "오억원정", "500,000,000 → 오억원정(0 하나 차이가 readback 에서 구별)");
  ok(amountToHangul("5000000000") !== amountToHangul("500000000"), "자릿수 다르면 readback 도 다름");
  // 무효 금액 — 게이트와 동일 판정(채웠지만 0·음수·비숫자)
  ok(isPositiveAmount("5000000000") === true, "양수=유효");
  ok(isPositiveAmount("0") === false, "0=무효");
  ok(isPositiveAmount("-5000") === false, "음수=무효");
  ok(isPositiveAmount("abc") === false, "비숫자=무효");
  // readback 노출 조건(parseAmount>0)
  ok(parseAmount("5000000000") > 0, "양수는 readback 노출 조건(parseAmount>0) 충족");
  ok(parseAmount("0") === 0 && parseAmount("") === 0, "0·빈 값은 readback 미노출");
}

console.log("\n[B] PartyCard 배선 — 단일 출처·loanInvalid·readback·무효 안내·aria 연결");
{
  ok(/import\s*\{[^}]*\bisPositiveAmount\b[^}]*\bparseAmount\b[^}]*\bamountToHangul\b[^}]*\}\s*from\s*"@\/lib\/engine\/calc"/.test(partyCard)
     || (/isPositiveAmount/.test(partyCard) && /parseAmount/.test(partyCard) && /amountToHangul/.test(partyCard) && /from "@\/lib\/engine\/calc"/.test(partyCard)),
     "calc 에서 isPositiveAmount·parseAmount·amountToHangul import");
  ok(/const loanFilled = String\(party\.loanAmount \?\? ""\)\.trim\(\)\.length > 0;/.test(partyCard), "loanFilled 계산");
  ok(/const loanInvalid = loanFilled && !isPositiveAmount\(party\.loanAmount\);/.test(partyCard),
     "loanInvalid = loanFilled && !isPositiveAmount(파티 대출금액) — 게이트와 동일 단일 출처");
  ok(/parseAmount\(party\.loanAmount\) > 0 &&/.test(partyCard), "readback 노출 조건 parseAmount(party.loanAmount)>0");
  ok(/className="loan-hangul" role="status" aria-live="polite">\{amountToHangul\(party\.loanAmount\)\}/.test(partyCard),
     "한글 금액 readback(loan-hangul·role=status·aria-live=polite·amountToHangul)");
  ok(/aria-invalid=\{loanInvalid \|\| undefined\}/.test(partyCard), "loanAmount 입력 aria-invalid=loanInvalid");
  ok(/aria-describedby=\{loanInvalid \? fid\("loanErr"\) : undefined\}/.test(partyCard), "loanAmount 입력 aria-describedby→loanErr");
  ok(/id=\{fid\("loanErr"\)\}[\s\S]{0,80}role="alert"/.test(partyCard), "무효 안내 div(id=loanErr·role=alert)");
}

console.log("\n[C] StepLoanCalc 패리티 — 무효 문구 verbatim·동일 클래스/단일 출처");
{
  const HINT = "유효하지 않은 금액입니다 — 이 값으로는 서류를 생성할 수 없습니다.";
  ok(partyCard.includes(HINT), "PartyCard 무효 안내 문구 존재");
  ok(stepLoan.includes(HINT), "StepLoanCalc 무효 안내 문구 존재(패리티 기준)");
  // 두 파일이 같은 readback 메커니즘(loan-hangul + amountToHangul)을 쓴다
  ok(/className="loan-hangul"[\s\S]{0,60}amountToHangul/.test(stepLoan), "StepLoanCalc 도 loan-hangul + amountToHangul readback");
  ok(/!isPositiveAmount\(/.test(stepLoan) && /!isPositiveAmount\(party\.loanAmount\)/.test(partyCard),
     "두 지점 모두 isPositiveAmount 단일 출처로 무효 판정");
}

console.log("\n[D] 무접촉/무회귀 — showLoanFields 내부·onChange 보존·새 CSS 0·조문 import 0");
{
  // readback·무효 안내가 showLoanFields 블록(우선수익자 전용) 안에 있어야 한다(타 역할 카드 무영향)
  const sl = partyCard.indexOf("{showLoanFields && (");
  ok(sl >= 0, "showLoanFields 블록 존재");
  const rb = partyCard.indexOf('className="loan-hangul"');
  ok(rb > sl, "readback 이 showLoanFields 블록 이후(우선수익자 전용 — 위탁자/채무자 카드 무영향)");
  ok(/onChange=\{\(e\) => set\(\{ loanAmount: e\.target\.value \}\)\}/.test(partyCard), "loanAmount onChange 보존(저장 값 무변형)");
  // loan-hangul 은 기존 CSS(globals.css)라 새 CSS 불필요
  ok(/\.loan-hangul\s*\{/.test(globals), "loan-hangul CSS 기존 재사용(새 CSS 0)");
  // PartyCard 는 조문/빌더/산출물 무접촉 — engine 에서 calc·model·ocr 만 import
  ok(!/from "@\/lib\/engine\/(clauses|docx|annex)/.test(partyCard), "조문(clauses)·빌더(docx)·별지(annex) import 0(산출물 무접촉)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
