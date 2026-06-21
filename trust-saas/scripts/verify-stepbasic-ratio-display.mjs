/* ============================================================
   회귀 가드 — 무효 우선수익한도 비율(priorityRatio)의 cross-screen 표시 억제 (StepBasic)

   배경(정확성·표시 정합, 비-산출물): 우선수익한도금액·신탁보수율은 STEP 02-1 의 비율
   (priorityRatio)·대출금액으로 recalcDerived 가 자동 산정해 STEP 05(StepBasic)에 그대로
   미러링한다(common.priorityLimit·common.trustFeeRate readonly 필드 + 요약 footer).
   그런데 recalcDerived(totalPriorityLimit)는 범위 밖(100~150%) 비율도 `parseAmount(ratio)||120`
   로 곱해 한도를 산정하므로(예: 200% → 대출금액×2), 무효 비율을 입력하면:
     · StepLoanCalc 는 한도 셀·합계·산식을 "—"/보류로 억제(직전 iteration, verify-loan-ratio-inline [F])
     · 그러나 StepBasic 의 한도금액 readonly·신탁보수율·요약은 그 잘못된 큰 값(예: 100억)을
       자신 있게 표시 — 비율 인라인 오류는 StepLoanCalc 에만 있어 이 화면엔 무효 신호가 전무했다.
   = 인라인 무효 판정 ↔ 다른 화면(StepBasic) 표시의 cross-screen 모순(WCAG 3.3.1 정확성).

   해결(표시/접근성 전용 — 빌더·조문·생성 로직·검증 게이트 판정·데이터 모델 무접촉):
   게이트(validateDoc)와 **같은 단일 출처** isValidRatio 를 StepBasic 에 재사용해
     ratioInvalid = !isValidRatio(c.priorityRatio)
     limitShowable = !ratioInvalid && isPositiveAmount(c.priorityLimit)
   로 한도금액 readonly·신탁보수율·요약(한도+보수율)을 일괄 억제하고, 한도금액 필드에는 왜
   비었는지 알리는 role="note"(aria-describedby 연결)를 단다. recalcDerived 가 저장한 값 자체는
   무변경(데이터 모델·게이트·산출물 무접촉) — "표시"만 가린다(StepLoanCalc 무효 비율 표시 억제와
   동형 패리티).

   본 가드:
     (A) 단일 출처 — StepBasic 이 게이트와 같은 isValidRatio 를 calc 에서 import
     (B) 억제 플래그 정의 — ratioInvalid=!isValidRatio(c.priorityRatio),
         limitShowable=!ratioInvalid && isPositiveAmount(c.priorityLimit)
     (C) 한도금액 필드 — value 가 limitShowable 분기, placeholder 가 ratioInvalid 분기,
         role="note" 안내 div(id="basic-priorityLimit-note") + aria-describedby 연결
     (D) 고아 참조 0 — aria-describedby 가 가리키는 id 가 동명 note div 로 실재
     (E) 신탁보수율 필드·요약 — 모두 limitShowable 단일 출처로 한도·보수율 분기,
         무방비 원시 에코(가드 없는 fmtKRW(c.priorityLimit)·c.trustFeeRate 표시) 잔존 0
     (F) ★게이트/산정 정합(거동) — recalcDerived 가 무효 비율로도 양(+)의 한도·보수율을
         실제로 산정함(=억제가 가리는 잘못된 값이 실재)을 증명하고, 그 무효 비율은 게이트
         (validateDoc)가 반드시 차단하며 limitShowable 은 false; 유효 비율은 게이트 통과 +
         limitShowable true (표시/게이트 모순 0).

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-stepbasic-ratio-display.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { blankContractForm } from "../src/lib/engine/model.ts";
import { validateDoc } from "../src/lib/engine/validate.ts";
import { isValidRatio, isPositiveAmount, recalcDerived } from "../src/lib/engine/calc.ts";

const __dir = dirname(fileURLToPath(import.meta.url));
const src = (rel) => readFileSync(join(__dir, "..", rel), "utf8");
const step = src("src/components/trust/steps/StepBasic.tsx");
const flat = step.replace(/\s+/g, " ");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const RATIO_LABEL = "우선수익한도 비율 (100~150% 범위)";

console.log("=== 무효 비율 cross-screen 표시 억제 (StepBasic) ===\n");

console.log("[A] 단일 출처 — 게이트와 같은 isValidRatio 를 calc 에서 import");
ok(/import\s*\{[^}]*\bisValidRatio\b[^}]*\}\s*from\s*["']@\/lib\/engine\/calc["']/.test(step),
  "StepBasic: isValidRatio 를 calc 에서 import");

console.log("\n[B] 억제 플래그 정의 — ratioInvalid / limitShowable");
ok(/const\s+ratioInvalid\s*=\s*!isValidRatio\(\s*c\.priorityRatio\s*\)/.test(step),
  "ratioInvalid = !isValidRatio(c.priorityRatio) — 게이트와 같은 판정");
ok(/const\s+limitShowable\s*=\s*!ratioInvalid\s*&&\s*isPositiveAmount\(\s*c\.priorityLimit\s*\)/.test(step),
  "limitShowable = !ratioInvalid && isPositiveAmount(c.priorityLimit)");

console.log("\n[C] 한도금액 필드 — limitShowable 분기 + ratioInvalid note 안내");
ok(/value=\{limitShowable \? Number\(c\.priorityLimit\)\.toLocaleString\(\) \+ " 원" : ""\}/.test(flat),
  "한도금액 readonly value 가 limitShowable 분기(무효 시 빈 값)");
ok(/placeholder=\{ratioInvalid \? "[^"]*" : "[^"]*"\}/.test(flat),
  "한도금액 placeholder 가 ratioInvalid 분기(비율 확인 안내)");
ok(/aria-describedby=\{ratioInvalid \? "basic-priorityLimit-note" : undefined\}/.test(flat),
  'aria-describedby={ratioInvalid ? "basic-priorityLimit-note" : undefined}');
ok(/id="basic-priorityLimit-note"[^>]*role="note"/.test(flat),
  '안내 div id="basic-priorityLimit-note" role="note"');
ok(/\{ratioInvalid\s*&&\s*\(/.test(step),
  "안내 div 는 ratioInvalid 일 때만 렌더(나그 방지)");

console.log("\n[D] 고아 참조 0 — describedby id 가 동명 note div 로 실재");
{
  const referenced = [...flat.matchAll(/aria-describedby=\{ratioInvalid \? "([^"]+)"/g)].map((m) => m[1]);
  const defined = new Set([...flat.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  ok(referenced.length > 0 && referenced.every((id) => defined.has(id)),
    `describedby 참조(${referenced.join(",")}) 전부 실재 id`);
}

console.log("\n[E] 신탁보수율 필드·요약 — limitShowable 단일 출처 분기 + 무방비 에코 0");
ok(/value=\{limitShowable && c\.trustFeeRate \? c\.trustFeeRate \+ " %" : ""\}/.test(flat),
  "신탁보수율 readonly value 가 limitShowable && c.trustFeeRate 분기");
ok(/우선수익한도금액 \{limitShowable \? fmtKRW\(c\.priorityLimit\) : "—"\}/.test(flat),
  '요약 한도금액 {limitShowable ? fmtKRW(c.priorityLimit) : "—"}');
ok(/보수율 \{limitShowable && c\.trustFeeRate \? c\.trustFeeRate \+ " %" : "\(대기\)"\}/.test(flat),
  '요약 보수율 {limitShowable && c.trustFeeRate ? … : "(대기)"}');
// 무방비 원시 에코(limitShowable 가드 없이 한도금액/보수율을 그대로 표시)가 잔존하지 않음
ok(!/우선수익한도금액 \{fmtKRW\(c\.priorityLimit\)\}/.test(flat),
  "요약: 무방비 한도금액 {fmtKRW(c.priorityLimit)} 에코(가드 없음) 잔존 0");
ok(!/readOnly value=\{c\.priorityLimit \? Number\(c\.priorityLimit\)/.test(flat),
  "한도금액 필드: 무방비 c.priorityLimit 원시 에코(가드 없음) 잔존 0");
ok(!/readOnly value=\{c\.trustFeeRate \? c\.trustFeeRate \+ " %"/.test(flat),
  "보수율 필드: 무방비 c.trustFeeRate 원시 에코(가드 없음) 잔존 0");

console.log("\n[F] ★게이트/산정 정합(거동) — 무효 비율은 양(+)의 한도를 산정하나 억제+게이트 차단");
{
  const base = () => {
    const f = blankContractForm();
    f.trustors[0].name = "주식회사 갑";
    f.priorities[0].name = "을은행";
    f.priorities[0].loanAmount = "5000000000";
    f.properties[0].address = "서울특별시 강남구 테헤란로 1";
    f.common.year = 2026;
    f.common.month = 6;
    f.common.day = 21;
    f.common.trustFee = "50000000";
    f.common.trustPeriod = "담보신탁 등기일로부터";
    f.docContents.appform.valuationPrice = "10000000000";
    f.docContents.valReport.principalValue = "8000000000";
    return f;
  };
  const withRatio = (r) => { const f = base(); f.common.priorityRatio = r; return recalcDerived(f); };
  const ratioMiss = (f) => validateDoc(f, "contract").missing.some((m) => m.label === RATIO_LABEL);
  // 컴포넌트가 신뢰하는 단일 출처를 그대로 재현
  const showable = (f) => isValidRatio(f.common.priorityRatio) && isPositiveAmount(f.common.priorityLimit);

  // 무효 비율(범위 밖) — recalcDerived 는 실제로 양(+)의 잘못된 한도·보수율을 산정하지만(억제가
  // 가리는 값이 실재함을 증명), 표시는 억제(showable=false)하고 게이트는 차단(모순 0)
  for (const r of [200, 1200, 50, 99, 151]) {
    const f = withRatio(r);
    ok(isPositiveAmount(f.common.priorityLimit) === true,
      `무효 비율 ${r}%: recalcDerived 가 양(+)의 한도 산정(=억제가 가리는 잘못된 값 실재, priorityLimit=${f.common.priorityLimit})`);
    ok(showable(f) === false, `→ 표시 억제(limitShowable=false)`);
    ok(ratioMiss(f) === true, `→ 게이트도 비율 차단(표시/게이트 모순 0)`);
  }
  // 음수 비율 — parseAmount(-50)||120 = -50 → 범위 밖. 한도는 음수가 되어 isPositiveAmount=false
  {
    const f = withRatio(-50);
    ok(showable(f) === false, "음수 비율 -50%: 표시 억제(limitShowable=false)");
    ok(ratioMiss(f) === true, "→ 게이트도 비율 차단");
  }
  // 유효 비율 — 표시 노출(showable=true) + 게이트 통과(비율 차단 없음)
  for (const r of [100, 120, 150]) {
    const f = withRatio(r);
    ok(showable(f) === true, `유효 비율 ${r}%: 표시 노출(limitShowable=true, priorityLimit=${f.common.priorityLimit})`);
    ok(f.common.trustFeeRate !== "", `→ 보수율도 산정됨(${f.common.trustFeeRate}%)`);
    ok(ratioMiss(f) === false, `→ 게이트도 비율 차단 없음(오탐 0)`);
  }
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
