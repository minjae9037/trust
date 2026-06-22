/* ============================================================
   회귀 가드 — StepBasic 신탁보수(trustFee) 입력 한글 금액 readback(전 금액 입력 readback 패리티 마감)

   배경: 신탁보수(`trustFee`)는 별첨3 보수액·신탁보수율(신탁보수÷우선수익한도금액×100)
   자동산정에 쓰이는 법적 금액이다. 그런데 위저드의 다른 모든 금액 입력은 amountToHangul
   로 한글 금액을 에코해 자릿수 오입력(0 하나 누락 등)을 입력 지점에서 짚어 준다 —
   대출금액(StepLoanCalc 한도표·PartyCard STEP 02), 부동산 가격·신탁재산 원본가액(DocStep).
   유독 StepBasic 신탁보수만 ① 무효 인라인 안내(feeInvalid)와 ② 요약 표시 억제는 있으면서
   **한글 금액 readback 이 없어** "오천만원정↔오백만원정"(자릿수 1개 차이)을 입력 지점에서
   구별할 수 없던 마지막 금액 입력 readback 갭. 이제 StepLoanCalc·PartyCard 와 동일한 단일
   출처(parseAmount>0 일 때 amountToHangul)·동일 loan-hangul 클래스로 readback 을 띄운다
   (표시/접근성 경계만 — 빌더·조문·게이트 무접촉).

   핵심 불변식:
     - 양(+)의 신탁보수면 한글 금액 readback 노출(자릿수 확인 → 오입력 방지).
     - readback 노출 조건이 feeInvalid(0·음수·비숫자)와 상호배타 — 무효면 미노출.
     - readback 메커니즘이 StepLoanCalc·PartyCard 와 verbatim 동형(loan-hangul + amountToHangul).
     - 단일 출처 재사용 — 새 금액 포맷/판정 로직·새 CSS 없음(loan-hangul 기존 재사용).

   단언:
     (A) 단일 출처 거동 — 자릿수 구별(오천만≠오백만)·0/빈/음수 미노출·양수 노출
     (B) StepBasic 배선 — parseAmount/amountToHangul import·readback 노출 조건·loan-hangul readback
     (C) 형제 입력 패리티 — StepLoanCalc·PartyCard 와 동일 readback 메커니즘
     (D) 무접촉/무회귀 — feeInvalid/요약 억제·trustFee onChange 보존·새 CSS 0·조문/빌더 import 0

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-stepbasic-trustfee-readback.mjs
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
const stepBasic = read("src", "components", "trust", "steps", "StepBasic.tsx");
const stepLoan = read("src", "components", "trust", "steps", "StepLoanCalc.tsx");
const partyCard = read("src", "components", "trust", "steps", "PartyCard.tsx");
const globals = read("src", "app", "globals.css");

console.log("\n[A] 단일 출처 거동 — 자릿수 구별·노출 조건(readback 의미 보장)");
{
  // 자릿수 오입력(0 하나 차이)이 readback 에서 또렷이 구별돼야 자릿수 확인 가치가 있다
  ok(amountToHangul("50000000") === "오천만원정", "50,000,000 → 오천만원정");
  ok(amountToHangul("5000000") === "오백만원정", "5,000,000 → 오백만원정(0 하나 차이가 readback 에서 구별)");
  ok(amountToHangul("50000000") !== amountToHangul("5000000"), "자릿수 다르면 readback 도 다름");
  // readback 노출 조건(parseAmount>0)과 무효(feeInvalid)의 상호배타성
  ok(parseAmount("50000000") > 0, "양수는 readback 노출 조건(parseAmount>0) 충족");
  ok(parseAmount("0") === 0 && parseAmount("") === 0, "0·빈 값은 readback 미노출");
  ok(parseAmount("-5000") <= 0, "음수는 readback 미노출(parseAmount>0 불충족)");
  ok(isPositiveAmount("-5000") === false && parseAmount("-5000") <= 0,
     "무효(음수)면 readback 미노출 AND feeInvalid 대상 — 상호배타");
}

console.log("\n[B] StepBasic 배선 — import·노출 조건·loan-hangul readback");
{
  ok(/parseAmount/.test(stepBasic) && /amountToHangul/.test(stepBasic) && /from "@\/lib\/engine\/calc"/.test(stepBasic),
     "calc 에서 parseAmount·amountToHangul import");
  ok(/parseAmount\(c\.trustFee\) > 0 &&/.test(stepBasic), "readback 노출 조건 parseAmount(c.trustFee)>0");
  ok(/className="loan-hangul" role="status" aria-live="polite">\{amountToHangul\(c\.trustFee\)\}/.test(stepBasic),
     "한글 금액 readback(loan-hangul·role=status·aria-live=polite·amountToHangul(c.trustFee))");
  // readback 이 신탁보수 input 바로 뒤·feeInvalid 안내보다 앞(형제 입력과 동일 배치)
  const inputIdx = stepBasic.indexOf('id="basic-trustFee"');
  const rbIdx = stepBasic.indexOf('amountToHangul(c.trustFee)');
  // 오류 div 의 id= 로 앵커(input 의 aria-describedby="basic-trustFee-err" 는 readback 보다 앞이라 제외)
  const errIdx = stepBasic.indexOf('id="basic-trustFee-err"');
  ok(inputIdx >= 0 && rbIdx > inputIdx, "readback 이 신탁보수 input 뒤에 위치");
  ok(rbIdx >= 0 && errIdx > rbIdx, "readback 이 feeInvalid 무효 안내 div(id=basic-trustFee-err)보다 앞(노출 vs 무효 상호배타 순서)");
}

console.log("\n[C] 형제 입력 패리티 — StepLoanCalc·PartyCard 와 동일 readback 메커니즘");
{
  ok(/className="loan-hangul"[\s\S]{0,60}amountToHangul/.test(stepLoan), "StepLoanCalc 도 loan-hangul + amountToHangul readback(패리티 기준)");
  ok(/className="loan-hangul"[\s\S]{0,60}amountToHangul/.test(partyCard), "PartyCard 도 loan-hangul + amountToHangul readback(패리티 기준)");
  ok(/className="loan-hangul"[\s\S]{0,60}amountToHangul/.test(stepBasic), "StepBasic 신탁보수도 동일 메커니즘 — 세 금액 입력 readback 일치");
}

console.log("\n[D] 무접촉/무회귀 — 무효 안내·요약 억제·onChange 보존·새 CSS 0·조문 import 0");
{
  // 기존 무효 인라인 안내(feeInvalid)·요약 표시 억제는 무회귀로 보존
  ok(/const feeInvalid = feeFilled && !isPositiveAmount\(c\.trustFee\);/.test(stepBasic), "feeInvalid 단일 출처 보존(무회귀)");
  ok(/id="basic-trustFee-err"[\s\S]{0,80}role="alert"/.test(stepBasic), "무효 안내 div(basic-trustFee-err·role=alert) 보존");
  ok(/신탁보수 \{feeInvalid \? "—" : fmtKRW\(c\.trustFee\)\}/.test(stepBasic), "요약의 신탁보수 표시 억제(feeInvalid→'—') 보존");
  ok(/onChange=\{\(e\) => updateCommon\(\{ trustFee: e\.target\.value \}\)\}/.test(stepBasic), "trustFee onChange 보존(저장 값 무변형)");
  // loan-hangul 은 기존 CSS(globals.css)라 새 CSS 불필요
  ok(/\.loan-hangul\s*\{/.test(globals), "loan-hangul CSS 기존 재사용(새 CSS 0)");
  // StepBasic 은 조문/빌더/산출물 무접촉 — engine 에서 calc 만 import
  ok(!/from "@\/lib\/engine\/(clauses|docx|annex)/.test(stepBasic), "조문(clauses)·빌더(docx)·별지(annex) import 0(산출물 무접촉)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
