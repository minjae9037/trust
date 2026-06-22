/* ============================================================
   회귀 가드 — 우선수익한도금액 합계 > 신탁부동산 가격(담보 평가가격) 입력 지점 교차검증 advisory

   배경: STEP 03(StepLoanCalc) 한도표는 우선수익한도금액(= 대출금액 × 비율)을 산정해
   합계를 보여 준다. 한편 신탁부동산 가격(담보 평가가격)은 신청서(Doc 01·appform)의
   valuationPrice 로 따로 입력된다. 담보신탁에서 우선수익한도금액은 통상 담보가치(평가가격)
   범위 안에서 설정되므로, 합계 한도가 평가가격을 초과하면 담보가치 대비 한도 과다 가능성을
   입력 지점에서 확인하는 것이 자연스럽다. 그러나 두 값이 서로 다른 단계에서 입력돼 그 초과가
   조용히 성립하던 갭이 있었다. StepConditions 조건 정합 advisory 4종(대리금융기관·담보보수
   안분·제21조 인허가 유형·담보 차수 조사분석서)과 동형의 "막지 않는 되짚음" — 순수 산술
   비교(두 사용자 입력)일 뿐 차단·조문·산출물 무관.

   핵심 불변식:
     - ★표시 전용 — 게이트(validate)·빌더(builders.js)·조문 무접촉(차단 아님). overLimit 은
       기존 입력(totalPriorityLimit·appform.valuationPrice)의 파생 표시일 뿐 어느 산출물·
       게이트에도 영향을 주지 않는다. 새 상태/모델/엔진 무접촉.
     - 조건 = !ratioInvalid(한도 산정됨) && totalLimit>0 && isPositiveAmount(valPrice)
       && totalLimit > parseAmount(valPrice). 가격 미입력·비율 무효 시 미표출(나그·오탐 방지).
     - role=status·aria-live=polite(동적 출현 SR 고지) + 선두 ⚠ 글리프 aria-hidden
       (장식 글리프 접근명 오염 0 — 기존 컨벤션).
     - 기존 클래스(field-hint) 재사용 + 인라인 style 만 — 새 CSS 0.
     - 색 = var(--c-brown) 토큰(차단 적색 var(--c-danger) 아님 — 검토 신호·기존 advisory 동형).
     - 근거 = "담보가치(평가가격) 범위 안에서 한도 설정"이라는 산술 정합(추정 조문 아님).

   단언:
     (A) StepLoanCalc 배선 — overLimit 조건·문구·role=status·aria-hidden 글리프·field-hint·brown
     (B) 순수 산술 — totalPriorityLimit / appform.valuationPrice / parseAmount / isPositiveAmount 사용
     (C) 무회귀 — 한도표·비율 인라인·개별 대출 인라인·합계 tfoot 보존
     (D) 무접촉 — validate/builders 에 advisory 문구 미혼입·새 CSS 0·차단 적색 미사용

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-loancalc-overlimit-advisory.mjs
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
const loan = read("src", "components", "trust", "steps", "StepLoanCalc.tsx");
const validate = read("src", "lib", "engine", "validate.ts");
const builders = read("src", "lib", "engine", "docx", "builders.js");
const globals = read("src", "app", "globals.css");

console.log("\n[A] StepLoanCalc 배선 — overLimit 조건·문구·role=status·aria-hidden 글리프·field-hint·brown");
{
  // overLimit 조건 — 비율 유효 + 합계>0 + 가격 양수 + 합계>가격 (4중 가드)
  ok(/const overLimit =/.test(loan), "overLimit 파생 상수 선언");
  ok(/!ratioInvalid &&/.test(loan), "조건 1 = !ratioInvalid(한도 산정됨일 때만 — 무효 비율 보류 시 미표출)");
  ok(/totalLimit > 0 &&/.test(loan), "조건 2 = totalLimit > 0(합계 한도 존재)");
  ok(/isPositiveAmount\(valPrice\) &&/.test(loan), "조건 3 = isPositiveAmount(valPrice)(가격 미입력·무효 시 미표출)");
  ok(/totalLimit > parseAmount\(valPrice\)/.test(loan), "조건 4 = totalLimit > parseAmount(valPrice)(합계가 가격 초과일 때만)");
  // advisory 본문 — 합계 초과 사실 되짚음 + 확인 권유(차단 아님)
  ok(/우선수익한도금액 합계\(.*\)가 신청서\(Doc 01\)에 입력한 신탁부동산 가격\(.*\)을 초과합니다/.test(loan),
     "advisory 본문 = 한도 합계가 신탁부동산 가격 초과 사실 되짚음(두 값 동시 표기)");
  ok(/담보가치 대비 한도가 큰지 확인하세요/.test(loan),
     "막지 않고(차단 아님) 담보가치 대비 한도 확인을 권유(사용자 선택 보존)");
  // 동적 출현 SR 고지 + 선두 ⚠ aria-hidden (advisory 블록 직전 구간)
  const adv = loan.slice(loan.indexOf("{overLimit && ("));
  ok(/role="status" aria-live="polite"/.test(adv.slice(0, 500))
     && /<span aria-hidden="true">⚠ <\/span>/.test(adv.slice(0, 500)),
     "role=status·aria-live=polite + 선두 ⚠ 글리프 aria-hidden(접근명 오염 0)");
  // 기존 클래스 재사용 (field-hint)
  ok(/\{overLimit && \(\s*<div className="field-hint" role="status" aria-live="polite"/.test(loan),
     "field-hint 기존 클래스 재사용(새 클래스 0)");
  // 색은 토큰 재사용(brown — 차단 적색 아님·검토 신호)
  ok(adv.slice(0, 500).includes("var(--c-brown)"),
     "advisory 색 = var(--c-brown) 토큰(차단 적색 아님·기존 advisory 와 동형)");
  ok(!adv.slice(0, 500).includes("var(--c-danger)"),
     "advisory 는 차단 적색(var(--c-danger)) 미사용 — 검토 신호일 뿐 차단 아님");
}

console.log("\n[B] 순수 산술 — totalPriorityLimit / appform.valuationPrice / parseAmount / isPositiveAmount 사용");
{
  ok(/const valPrice = form\.docContents\.appform\?\.valuationPrice;/.test(loan),
     "valPrice = form.docContents.appform?.valuationPrice(구버전 저장본 옵셔널 체이닝)");
  ok(/const totalLimit = totalPriorityLimit\(form\);/.test(loan),
     "totalLimit = totalPriorityLimit(form)(기존 calc 단일 출처 재사용)");
  ok(/import \{[^}]*\bparseAmount\b[^}]*\} from "@\/lib\/engine\/calc"/.test(loan)
     && /import \{[^}]*\bisPositiveAmount\b[^}]*\} from "@\/lib\/engine\/calc"/.test(loan)
     && /import \{[^}]*\btotalPriorityLimit\b[^}]*\} from "@\/lib\/engine\/calc"/.test(loan),
     "calc 에서 parseAmount·isPositiveAmount·totalPriorityLimit import(추정 산식 아님·단일 출처)");
}

console.log("\n[C] 무회귀 — 한도표·비율 인라인·개별 대출 인라인·합계 tfoot 보존");
{
  ok(/우선수익한도 비율/.test(loan) && /id="loan-priorityRatio"/.test(loan),
     "우선수익한도 비율 입력 보존");
  ok(/100~150% 범위를 벗어난 비율입니다/.test(loan),
     "비율 범위 밖 인라인 오류(게이트 패리티) 보존");
  ok(/유효하지 않은 금액입니다 — 이 값으로는 서류를 생성할 수 없습니다/.test(loan),
     "개별 대출금액 무효 인라인 오류 보존");
  ok(/totalPriorityLimit\(form\)\.toLocaleString\(\)/.test(loan),
     "합계 tfoot 의 totalPriorityLimit 표기 보존");
  ok(/우선수익한도금액 = 대출금액 ×/.test(loan),
     "산식 footnote 보존");
}

console.log("\n[D] 무접촉 — validate/builders 에 advisory 문구 미혼입·새 CSS 0·차단 적색 미사용");
{
  ok(!/담보가치 대비 한도가 큰지 확인하세요|을 초과합니다 — 담보가치/.test(validate),
     "validate.ts(게이트)에 advisory 문구 미혼입 — 차단/검증 대상 아님(표시 전용)");
  ok(!/담보가치 대비 한도가 큰지 확인하세요|을 초과합니다 — 담보가치/.test(builders),
     "builders.js(산출물)에 advisory 문구 미혼입 — 조문·표 미변경(표시 전용)");
  ok(!/overlimit-advisory|over-limit-advisory|loancalc-overlimit/.test(globals),
     "globals.css 에 advisory 전용 새 클래스 0(field-hint 재사용)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
