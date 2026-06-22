/* ============================================================
   회귀 가드 — 대리금융기관(제20조·별첨4) 검증 게이트

   배경: StepConditions(STEP 05)의 「대리금융기관 지정」 체크박스(agentBankEnabled)를
   켜면 입력한 회사명(agentBank)이 별첨4 제20조 "대리금융기관의 선임" 조항에 자동
   기재된다(EngineBadge "조문 자동반영"). 그러나 종전 검증 게이트(validateDoc)는
   agentBank 를 전혀 검사하지 않아, 사용자가 "지정"을 켰는데 회사명을 비우면 별첨4
   제20조에 빈칸 `[              ]`이 박힌 담보신탁계약서가 생성됐다(builders.js
   resolveAnnex4LineText: {{AGENT_BANK}} → agentBank || "[ ]"). "빈 칸이 박힌 법적
   서류"를 막는 검증 게이트의 본래 취지에 정면 배치되던 정합성 갭.

   본 가드의 정적 단언(조문·엔진·빌더 무접촉 — "입력값 완결성"만):
     [A] 미지정(기본/해제)의 빈 agentBank 는 차단하지 않는다(무회귀 — 표준 양식 빈칸)
     [B] 지정 ON + 회사명 미입력(빈/공백) → contract 서류에서만 차단
     [C] contract 외 6종 서류는 별첨4 미포함 → agentBank 무관(과잉 차단 없음)
     [D] 지정 ON + 회사명 입력 → 통과(정상 기재)
     [E] 점프 타깃 = 조건·특약 단계(STEP 05) 자신 + where 안내가 STEPS 에서 파생
     [F] 기존 검증(공통 5종·가격·원본가액) 무회귀 — agentBank 검사가 다른 항목에 영향 없음

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-agentbank-validate.mjs
   ============================================================ */
import { blankContractForm } from "../src/lib/engine/model.ts";
import { validateDoc } from "../src/lib/engine/validate.ts";
import { STEPS, COLLATERAL_OUTPUT_DOCS } from "../src/lib/engine/schema.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const AGENT_LABEL = "대리금융기관 회사명 (제20조 — 지정했으나 미입력)";
const CONDS_IDX = STEPS.find((s) => s.key === "conditions").idx; // STEP 05
const hasAgentMiss = (form, docId) =>
  validateDoc(form, docId).missing.some((m) => m.label === AGENT_LABEL);

// 공통 필수 입력을 모두 채운 "생성 가능 직전" 폼 — agentBank 만 변수로 둔다.
function readyForm() {
  const form = blankContractForm();
  form.trustors[0].name = "갑개발 주식회사";
  form.priorities[0].name = "을은행";
  form.priorities[0].loanAmount = "5000000000";
  form.properties[0].address = "서울특별시 강남구 테헤란로 1";
  // 계약 체결일·신탁기간은 blankContractForm 기본값이 채워져 있다(공통 게이트 통과).
  return form;
}

console.log("\n[A] 미지정(기본/해제)의 빈 agentBank 는 차단하지 않는다 (무회귀)");
{
  const form = readyForm();
  // 기본값: agentBankEnabled=false, agentBank=""
  ok(form.docContents.contract.agentBankEnabled === false, "기본 agentBankEnabled=false");
  ok(form.docContents.contract.agentBank === "", "기본 agentBank=''(빈칸 표준 양식)");
  ok(!hasAgentMiss(form, "contract"), "미지정+빈 회사명 → contract 누락 아님(표준 빈칸 출력)");
  ok(validateDoc(form, "contract").ok, "미지정 상태 contract 생성 가능(전체 ok)");
  // 명시적으로 false 로 둔 채 회사명만 있어도(비정상 조합) 차단하지 않는다 — enabled 기준.
  form.docContents.contract.agentBankEnabled = false;
  form.docContents.contract.agentBank = "어떤은행";
  ok(!hasAgentMiss(form, "contract"), "지정 OFF 면 회사명 유무와 무관하게 미차단(enabled 기준)");
}

console.log("\n[B] 지정 ON + 회사명 미입력 → contract 서류에서 차단");
{
  const form = readyForm();
  form.docContents.contract.agentBankEnabled = true;
  form.docContents.contract.agentBank = "";
  ok(hasAgentMiss(form, "contract"), "지정 ON + 빈 회사명 → contract 누락에 포함");
  ok(!validateDoc(form, "contract").ok, "지정 ON + 빈 회사명 → contract 생성 차단(ok=false)");
  // 공백만 입력도 차단(hasText=trim>0)
  form.docContents.contract.agentBank = "   ";
  ok(hasAgentMiss(form, "contract"), "지정 ON + 공백만 → 차단(trim 후 빈 값)");
}

console.log("\n[C] contract 외 6종 서류는 별첨4 미포함 → agentBank 무관(과잉 차단 없음)");
{
  const form = readyForm();
  form.docContents.contract.agentBankEnabled = true;
  form.docContents.contract.agentBank = ""; // contract 였다면 차단되는 상태
  const others = COLLATERAL_OUTPUT_DOCS.filter((d) => d.id !== "contract").map((d) => d.id);
  ok(others.length === 6, `contract 외 출력 서류 6종 (실제 ${others.length})`);
  ok(others.every((id) => !hasAgentMiss(form, id)),
    "appform·poa·valReport·boardMin·cdd·ubo 어디에도 agentBank 누락 없음");
}

console.log("\n[D] 지정 ON + 회사명 입력 → 통과(정상 기재)");
{
  const form = readyForm();
  form.docContents.contract.agentBankEnabled = true;
  form.docContents.contract.agentBank = "한국투자증권 주식회사";
  ok(!hasAgentMiss(form, "contract"), "지정 ON + 회사명 입력 → 누락 아님");
  ok(validateDoc(form, "contract").ok, "지정 ON + 회사명 입력 → contract 생성 가능");
}

console.log("\n[E] 점프 타깃 = 조건·특약 단계(STEP 05) + where 가 STEPS 에서 파생");
{
  const form = readyForm();
  form.docContents.contract.agentBankEnabled = true;
  form.docContents.contract.agentBank = "";
  const mi = validateDoc(form, "contract").missing.find((m) => m.label === AGENT_LABEL);
  ok(!!mi, "누락 항목 객체 존재");
  ok(mi.stepIdx === CONDS_IDX, `stepIdx === 조건·특약 단계 idx(${CONDS_IDX}) — 입력 위치로 점프`);
  const cond = STEPS.find((s) => s.idx === CONDS_IDX);
  ok(mi.where === `${cond.label} ${cond.title}`, "where === STEP.label + ' ' + STEP.title (단일 출처)");
}

console.log("\n[F] 기존 검증(공통 5종·가격·원본가액) 무회귀");
{
  // 날짜를 비운 빈 양식의 contract 공통 누락은 여전히 [1,2,3,4,5] (agentBank 미오염)
  const form = blankContractForm();
  form.common.year = ""; form.common.month = ""; form.common.day = "";
  const idxs = validateDoc(form, "contract").missing.map((m) => m.stepIdx).sort((a, b) => a - b);
  ok(JSON.stringify(idxs) === JSON.stringify([1, 2, 3, 4, 5]),
    `빈 양식 contract 공통 누락 점프 = [1,2,3,4,5] (실제 [${idxs}]) — agentBank 미오염`);
  ok(!form.docContents.contract.agentBankEnabled,
    "빈 양식 기본 agentBankEnabled=false → 공통 누락에 STEP 05 미추가");
  // appform 가격·valReport 원본가액 게이트 무회귀(지정 ON 이어도 별첨4 무관 서류엔 영향 0)
  const f2 = readyForm();
  f2.docContents.contract.agentBankEnabled = true;
  f2.docContents.contract.agentBank = "";
  ok(validateDoc(f2, "appform").missing.some((m) => m.label.startsWith("신탁부동산 가격")),
    "appform 가격 누락 검증 유지(agentBank 영향 없음)");
  ok(validateDoc(f2, "valReport").missing.some((m) => m.label.startsWith("신탁재산 원본가액")),
    "valReport 원본가액 누락 검증 유지(agentBank 영향 없음)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
