/* ============================================================
   회귀 가드 — 대출금액·우선수익한도금액 표 한글 금액 라이브 에코

   배경(입력 UX/정확성 갭): 12:43 iteration 이 DocStep 의 두 대형 금액(신탁부동산
   가격·신탁재산 원본가액)에 한글 금액 에코(0 개수 오입력 방지)를 붙였으나, 세 번째이자
   가장 consequential 한 대형 금액 계열인 **대출금액 → 우선수익한도금액**(StepLoanCalc)은
   인접 열에 toLocaleString 숫자만 보여 한글 금액(0 개수 육안 검증 수단)이 없었다.
   우선수익한도금액(=대출금액×비율)은 별첨2/3·appform 한도표·valReport priorityLimit 등
   4종 이상 법적 서류에 그대로 박히는 핵심 파생 금액이라, 입력 단계에서 한글로 0 개수를
   검증할 가치가 가장 크다.
   → StepLoanCalc 표의 (1)대출금액 입력 (2)행별 우선수익한도금액 (3)합계 두 칸에
     parseAmount>0 일 때 amountToHangul 한글 에코(.loan-hangul) 추가.
     기존 순수 헬퍼(amountToHangul·priorityLimitFor·totalLoan·totalPriorityLimit) 재사용 —
     조문·엔진·생성/DOCX·검증 판정·입력 onChange·산정 로직 전부 무접촉(표시만).

   본 가드(표시 전용 — 산출물·검증·산정 무접촉):
     (A) 한글 헬퍼 정합: amountToHangul 가 대형 금액을 정확히 표기(억/만 단위)
     (B) 산정 헬퍼 정합: priorityLimitFor·totalLoan·totalPriorityLimit 산정값 = 에코 한글의 입력값
     (C) StepLoanCalc 렌더: amountToHangul import + 대출금액/한도금액/합계 2칸 모두 parseAmount>0 조건 에코
     (D) 무회귀: 입력 onChange·산정 헬퍼는 그대로(표시 전용 — 저장·생성 구조 불변)
     (E) 입력↔출력 정합: 에코 한글 = 산출물(빌더)이 쓰는 amountToHangul 동일 출처

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-loan-hangul-echo.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  amountToHangul,
  parseAmount,
  priorityLimitFor,
  totalLoan,
  totalPriorityLimit,
} from "../src/lib/engine/calc.ts";

const __dir = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(__dir, "..", rel), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

// 최소 폼 픽스처 — 우선수익자 2인(120억·50억), 비율 120%
const form = {
  priorities: [{ loanAmount: "12000000000" }, { loanAmount: "5000000000" }],
  common: { priorityRatio: 120 },
};

console.log("\n[A] 한글 헬퍼 — 대형 금액을 정확히 표기(억/만 단위)");
{
  ok(amountToHangul("12000000000") === "일백이십억원정", "120억 → '일백이십억원정'");
  ok(amountToHangul("5000000000") === "오십억원정", "50억 → '오십억원정'");
  ok(amountToHangul("17000000000") === "일백칠십억원정", "170억(합계) → '일백칠십억원정'");
  // 에코 표시 조건과 동일: parseAmount>0 일 때만 표시
  ok(parseAmount("0") === 0 && parseAmount("") === 0, "0·빈값은 parseAmount 로 미표시 분기됨");
}

console.log("\n[B] 산정 헬퍼 정합 — 에코 한글이 받는 입력값(산정값)이 정확");
{
  const ratio = parseAmount(form.common.priorityRatio) || 120;
  const limit1 = priorityLimitFor(form.priorities[0], ratio); // 120억 × 120% = 144억
  ok(limit1 === 14400000000, "priorityLimitFor(120억,120%) = 144억");
  ok(amountToHangul(limit1) === "일백사십사억원정", "행별 한도금액 한글 = '일백사십사억원정'");
  ok(totalLoan(form) === 17000000000, "totalLoan = 170억(120+50)");
  ok(totalPriorityLimit(form) === 20400000000, "totalPriorityLimit = 204억(170억×120%)");
  ok(amountToHangul(totalPriorityLimit(form)) === "이백사억원정", "합계 한도금액 한글 = '이백사억원정'");
}

console.log("\n[C] StepLoanCalc 렌더 — amountToHangul 에코(대출금액·행별 한도·합계 2칸, parseAmount>0 조건)");
{
  const src = read("src/components/trust/steps/StepLoanCalc.tsx");
  ok(/from "@\/lib\/engine\/calc"/.test(src) && /amountToHangul/.test(src),
    "StepLoanCalc 이 calc 에서 amountToHangul import");
  ok(/loan-hangul/.test(src), "한글 에코 className=loan-hangul 사용");
  ok(/parseAmount\(p\.loanAmount\)\s*>\s*0[\s\S]*?amountToHangul\(p\.loanAmount\)/.test(src),
    "대출금액 입력 에코: parseAmount(p.loanAmount)>0 일 때 amountToHangul(p.loanAmount)");
  ok(/amountToHangul\(limit\)/.test(src), "행별 우선수익한도금액 에코: amountToHangul(limit)");
  ok(/amountToHangul\(totalLoan\(form\)\)/.test(src), "합계 대출금액 에코: amountToHangul(totalLoan(form))");
  ok(/amountToHangul\(totalPriorityLimit\(form\)\)/.test(src),
    "합계 우선수익한도금액 에코: amountToHangul(totalPriorityLimit(form))");
  // 에코 4종 모두 0/빈값 가드(parseAmount>0 또는 total>0) — 0·음수 미표시
  ok(/totalLoan\(form\)\s*>\s*0/.test(src) && /totalPriorityLimit\(form\)\s*>\s*0/.test(src),
    "합계 에코는 total>0 조건(0·빈 표 미표시)");
}

console.log("\n[D] 무회귀 — 입력 onChange·산정 헬퍼는 그대로(표시 전용)");
{
  const src = read("src/components/trust/steps/StepLoanCalc.tsx");
  ok(/updateParty\("priorities",\s*i,\s*\{\s*loanAmount:\s*e\.target\.value\s*\}\)/.test(src),
    "대출금액 입력 onChange 무변경(저장 경로 불변)");
  ok(/priorityLimitFor\(p,\s*ratio\)/.test(src), "행별 한도금액 산정(priorityLimitFor) 그대로 — 숫자값 무변경");
  ok(/totalLoan\(form\)\.toLocaleString\(\)/.test(src) && /totalPriorityLimit\(form\)\.toLocaleString\(\)/.test(src),
    "합계 숫자(toLocaleString)는 그대로 — 한글은 그 아래 추가일 뿐");
}

console.log("\n[E] 입력↔출력 정합 — 에코 한글 = 산출물 빌더가 쓰는 amountToHangul 동일 출처");
{
  const builders = read("src/lib/engine/docx/builders.js");
  ok(/amountToHangul/.test(builders), "빌더(builders.js)도 amountToHangul 사용 — 입력 에코와 동일 한글 출처");
  ok(amountToHangul("17000000000") === amountToHangul("17,000,000,000"),
    "콤마 유무와 무관하게 동일 한글(입력 표기 흔들림 없음)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
