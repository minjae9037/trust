/* ============================================================
   회귀 가드 — 서류 금액(money) 인라인 검증 피드백 (DocStep)

   배경(접근성·UX·정확성 패리티, 비-산출물): DocStep 의 money 필드 — 신탁부동산 가격
   (appform.valuationPrice)·신탁재산 원본가액(valReport.principalValue) — 은 신청서/별첨
   가격칸에 한글 금액으로 그대로 박히는 법적 금액이다. "채웠지만 0·음수·비숫자"인 값은
   게이트(validateDoc→docMissing)가 이미 생성을 차단한다("신탁부동산 가격 (유효하지 않은
   금액)"·"신탁재산 원본가액 (유효하지 않은 금액)"). 그러나 입력 옆에서는 amt>0 이 아니어서
   한글 에코만 조용히 사라질 뿐, 무엇이 왜 막혔는지는 하단 검증 박스까지 봐야 알 수 있었다
   (StepBasic 신탁보수·StepLoanCalc 개별 대출금액과 동일한 인라인 부재 갭, WCAG 3.3.1/4.1.2).
   → DocStep money 필드 input 옆에 인라인 오류(aria-invalid + aria-describedby + role="alert")를
     추가. 게이트와 **같은 단일 출처**(isPositiveAmount)와 같은 "채움" 조건(hasText = typeof
     string && trim().length>0)을 재사용해 판정 불일치(인라인은 무효라는데 게이트는 통과 같은
     모순)를 원천 차단(StepBasic·StepLoanCalc·PartyCard·JointForm 인라인 패리티).

   본 가드(빌더·조문·생성 로직·검증 게이트 판정 무접촉 — 표시/접근성만):
     (A) 단일 출처 — DocStep 이 게이트와 같은 isPositiveAmount 를 calc 에서 import
     (B) 인라인 플래그 정의 — moneyFilled(money && 채움) && !isPositiveAmount(val)
     (C) input — aria-invalid + aria-describedby=`${fid}-err`,
         오류 div id=`${fid}-err` role="alert", moneyInvalid 일 때만 렌더(나그 방지)
     (D) 고아 참조 0 — describedby 와 오류 div 가 같은 `${fid}-err` 템플릿(단일 출처)
     (E) ★게이트 정합 — 인라인이 무효로 보는 값은 그 서류 게이트(validateDoc)도 반드시 차단하고
         (인라인 오류인데 생성 허용되는 모순 0), 인라인이 안 켜는 값(빈 값·공백·유효 금액)은
         게이트도 해당 금액 차단을 하지 않음(오탐/나그 0). 두 money 서류(appform·valReport) 각각.

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-docamount-inline.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { blankContractForm } from "../src/lib/engine/model.ts";
import { validateDoc } from "../src/lib/engine/validate.ts";
import { isPositiveAmount } from "../src/lib/engine/calc.ts";

const __dir = dirname(fileURLToPath(import.meta.url));
const src = (rel) => readFileSync(join(__dir, "..", rel), "utf8");
const step = src("src/components/trust/steps/DocStep.tsx");
const flat = step.replace(/\s+/g, " ");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

console.log("=== 서류 금액(money) 인라인 검증 피드백 (DocStep) ===\n");

console.log("[A] 단일 출처 — 게이트와 같은 isPositiveAmount 를 calc 에서 import");
ok(/import\s*\{[^}]*\bisPositiveAmount\b[^}]*\}\s*from\s*["']@\/lib\/engine\/calc["']/.test(step),
  "DocStep: isPositiveAmount 를 calc 에서 import");

console.log("\n[B] 인라인 플래그 정의 — money && 채움 && !isPositiveAmount(val)");
ok(/const\s+moneyFilled\s*=\s*f\.money\s*&&\s*typeof\s+val\s*===\s*"string"\s*&&\s*val\.trim\(\)\.length\s*>\s*0/.test(step),
  "moneyFilled = f.money && 게이트 hasText 와 동일(typeof string && trim().length>0)");
ok(/const\s+moneyInvalid\s*=\s*moneyFilled\s*&&\s*!isPositiveAmount\(\s*val\s+as\s+string\s*\)/.test(step),
  "moneyInvalid = moneyFilled && !isPositiveAmount(val) — 게이트와 같은 판정");

console.log("\n[C] 배선 — input aria-invalid/describedby + 오류 div role=alert");
ok(/aria-invalid=\{moneyInvalid \|\| undefined\}/.test(step),
  "input: aria-invalid={moneyInvalid || undefined}");
ok(/aria-describedby=\{moneyInvalid \? `\$\{fid\}-err` : undefined\}/.test(step),
  "input: aria-describedby={moneyInvalid ? `${fid}-err` : undefined}");
ok(/id=\{`\$\{fid\}-err`\}[^>]*role="alert"/.test(flat),
  "오류 div id={`${fid}-err`} role=\"alert\"");
ok(/\{moneyInvalid\s*&&\s*\(/.test(step),
  "오류 div 는 moneyInvalid 일 때만 렌더(나그 방지)");

console.log("\n[D] 고아 참조 0 — describedby 와 오류 div 가 같은 `${fid}-err` 단일 출처");
{
  // fid 는 `doc-${docId}-${f.key}` 동적 id 라 정적 문자열 대조 대신, describedby 가 가리키는
  // 템플릿(`${fid}-err`)과 오류 div 의 id 템플릿이 문자 그대로 동일한지를 확인한다.
  const describedTmpl = /aria-describedby=\{moneyInvalid \? `(\$\{fid\}-err)` : undefined\}/.exec(step);
  const divTmpl = /id=\{`(\$\{fid\}-err)`\}/.exec(step);
  ok(!!describedTmpl && !!divTmpl && describedTmpl[1] === divTmpl[1],
    `describedby(${describedTmpl?.[1]}) === 오류 div id(${divTmpl?.[1]}) — 고아 참조 0`);
}

console.log("\n[E] ★게이트 정합 — 인라인 무효 ⟺ 그 서류 게이트 차단 / 인라인 OFF ⟺ 게이트 무차단");
{
  // 각 money 필드만 단일 변인으로 격리하기 위해 그 외 공통 필수를 모두 유효하게 채운다.
  const baseFilled = () => {
    const f = blankContractForm();
    f.trustors[0].name = "주식회사 갑";
    f.priorities[0].name = "을은행";
    f.priorities[0].loanAmount = "5000000000";
    f.properties[0].address = "서울특별시 강남구 테헤란로 1";
    f.common.year = 2026;
    f.common.month = 6;
    f.common.day = 21;
    f.common.priorityRatio = 120;
    f.common.trustFee = "50000000";
    f.common.trustPeriod = "담보신탁 등기일로부터";
    f.docContents.appform.valuationPrice = "10000000000";
    f.docContents.valReport.principalValue = "8000000000";
    return f;
  };
  // 인라인의 "채움"·무효 조건 — 컴포넌트가 신뢰하는 단일 출처를 그대로 재현
  const filled = (v) => typeof v === "string" && v.trim().length > 0;
  const invalidInline = (v) => filled(v) && !isPositiveAmount(v);

  // (docId, 필드 경로 setter, 게이트 누락 라벨) 쌍 — money 필드를 가진 두 서류
  const cases = [
    {
      docId: "appform",
      label: "신탁부동산 가격 (유효하지 않은 금액)",
      set: (f, v) => { f.docContents.appform.valuationPrice = v; },
    },
    {
      docId: "valReport",
      label: "신탁재산 원본가액 (유효하지 않은 금액)",
      set: (f, v) => { f.docContents.valReport.principalValue = v; },
    },
  ];

  for (const c of cases) {
    const hasMiss = (v) => {
      const f = baseFilled();
      c.set(f, v);
      return validateDoc(f, c.docId).missing.some((m) => m.label === c.label);
    };
    console.log(`  · ${c.docId} (${c.label})`);
    // 인라인이 무효로 보는 값(채웠지만 0·음수·비숫자) → 게이트도 반드시 그 금액 차단(모순 0)
    for (const bad of ["0", "-1", "-5000000", "abc", "0원", "-50,000"]) {
      ok(invalidInline(bad) === true, `    인라인 ON: invalid(${JSON.stringify(bad)})=true`);
      ok(hasMiss(bad) === true, `    → ${c.docId} 게이트도 차단(정합)`);
    }
    // 인라인이 안 켜는 값(빈 값·공백 = 미채움, 유효 금액) → 게이트도 그 금액 차단 없음(오탐/나그 0)
    for (const good of ["", "   ", "10000000000", "8,000,000,000", "1"]) {
      ok(invalidInline(good) === false, `    인라인 OFF: invalid(${JSON.stringify(good)})=false`);
      ok(hasMiss(good) === false, `    → ${c.docId} 게이트도 차단 없음(오탐/나그 0)`);
    }
  }
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
