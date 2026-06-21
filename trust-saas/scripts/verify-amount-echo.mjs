/* ============================================================
   회귀 가드 — 대형 금액 입력 라이브 에코(천단위 콤마 + 한글 금액)

   배경(입력 UX/정확성 갭): 신탁 서류에 박히는 대형 법적 금액(신탁부동산 가격
   appform.valuationPrice·신탁재산 원본가액 valReport.principalValue)은 수십~수백억
   단위라 raw 입력(가격=type number·원본가액=type text)만으로는 0 개수를 눈으로
   검증할 수단이 없었다(우측 미리보기는 250ms 디바운스·iframe). 대출금액은
   StepLoanCalc 가 인접 열에 toLocaleString 산정값을 보여 검증되지만, DocStep 의
   두 핵심 금액은 인접 에코가 없었다. 게다가 valuationPrice 의 hint 는 "한글 금액과
   함께 자동 기재됩니다"라고 약속하면서 입력 단계에서 그 한글 금액을 미리 보여주지 않았다.
   → DocField 에 money 플래그 추가, DocStep 이 money 필드에 한해 입력값(parseAmount>0)을
     fmtKRW(천단위 콤마 + " 원") + amountToHangul(한글 금액)로 라이브 에코.
     기존 순수 헬퍼 재사용 — 조문·엔진·생성/DOCX·검증 판정·입력 type 전부 무접촉(표시만).
     principalValue 는 기존 저장본 콤마 호환을 위해 type="text" 유지하고 money 로만 에코를 켠다.

   본 가드(표시 전용 — 산출물·검증 무접촉):
     (A) 포맷 헬퍼 정합: fmtKRW/amountToHangul 가 대형 금액을 정확히 표기(콤마·억/만 단위)
     (B) money 플래그 = 산출물에 한글 금액으로 박히는 핵심 금액 두 필드(가격·원본가액)만
     (C) DocStep 이 money 필드에 한해 fmtKRW·amountToHangul 에코를 parseAmount>0 조건으로 렌더
     (D) 무회귀: money 는 입력 type·검증 게이트·저장 구조를 바꾸지 않는다(가격=amount·원본가액=text 유지)
     (E) 한글 금액 = 산출물(빌더)이 쓰는 amountToHangul 과 동일 출처(입력↔출력 정합)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-amount-echo.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fmtKRW, amountToHangul, parseAmount } from "../src/lib/engine/calc.ts";
import { DOC_FIELDS } from "../src/lib/engine/schema.ts";

const __dir = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(__dir, "..", rel), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

console.log("\n[A] 포맷 헬퍼 — 대형 금액을 정확히 표기(콤마·한글 단위)");
{
  ok(fmtKRW("12000000000") === "12,000,000,000 원", "120억 → '12,000,000,000 원'");
  ok(fmtKRW("5,000,000,000") === "5,000,000,000 원", "쉼표 입력도 동일(parseAmount 정합)");
  ok(amountToHangul("12000000000") === "일백이십억원정", "120억 → '일백이십억원정'");
  ok(amountToHangul("5000000000") === "오십억원정", "50억 → '오십억원정'");
  ok(amountToHangul("123456789") === "일억이천삼백사십오만육천칠백팔십구원정", "1억2345만… 한글 정확");
  // 에코 표시 조건과 동일: parseAmount>0 일 때만 의미 있는 금액
  ok(parseAmount("0") === 0 && parseAmount("-5000") < 0, "0·음수는 parseAmount 로 비표시 분기됨");
}

console.log("\n[B] money 플래그 — 산출물에 한글 금액으로 박히는 핵심 금액 필드만");
{
  const money = [];
  for (const [docId, fields] of Object.entries(DOC_FIELDS)) {
    for (const f of fields) if (f.money) money.push(`${docId}.${f.key}`);
  }
  ok(money.includes("appform.valuationPrice"), "appform.valuationPrice = money(신탁부동산 가격)");
  ok(money.includes("valReport.principalValue"), "valReport.principalValue = money(신탁재산 원본가액)");
  ok(money.length === 2, "money 필드는 정확히 두 핵심 금액만(과도 확산 차단): " + money.join(", "));
  // 금액 의미가 아닌 텍스트 필드엔 money 미부여(텍스트 산정방법·평가기준일 등)
  const valMethod = DOC_FIELDS.appform.find((f) => f.key === "valuationMethod");
  ok(!valMethod.money, "valuationMethod(산정방법 텍스트)엔 money 미부여");
}

console.log("\n[C] DocStep 렌더 — money 필드에 한해 fmtKRW·amountToHangul 에코(parseAmount>0 조건)");
{
  const src = read("src/components/trust/steps/DocStep.tsx");
  ok(/from "@\/lib\/engine\/calc"/.test(src) && /fmtKRW/.test(src) && /amountToHangul/.test(src),
    "DocStep 이 calc 에서 fmtKRW·amountToHangul import");
  ok(/f\.money/.test(src), "에코 렌더가 f.money 조건에 의존");
  ok(/parseAmount\(val[^)]*\)\s*>\s*0|amt\s*>\s*0/.test(src), "parseAmount>0(amt>0)일 때만 에코 표시(빈값·0·음수 미표시)");
  ok(/amount-echo/.test(src), "에코 컨테이너 className=amount-echo");
  ok(/fmtKRW\(val/.test(src) && /amountToHangul\(val/.test(src), "에코가 입력값(val)을 fmtKRW·amountToHangul 로 표기");
}

console.log("\n[D] 무회귀 — money 는 입력 type·검증·저장 구조를 바꾸지 않는다(표시 전용)");
{
  const price = DOC_FIELDS.appform.find((f) => f.key === "valuationPrice");
  const principal = DOC_FIELDS.valReport.find((f) => f.key === "principalValue");
  ok(price.type === "amount", "가격 type=amount 유지(number 입력 그대로)");
  ok(principal.type === "text", "원본가액 type=text 유지(기존 저장본 콤마 호환 — number 전환 회귀 방지)");
  // money 는 선택 필드라 미표기 필드의 동작 불변(undefined)
  const notes = DOC_FIELDS.contract.find((f) => f.key === "notes");
  ok(notes.money === undefined, "money 미표기 필드는 undefined(기존 동작 불변)");
}

console.log("\n[E] 입력↔출력 정합 — 에코 한글 금액 = 산출물 빌더가 쓰는 amountToHangul 동일 출처");
{
  const builders = read("src/lib/engine/docx/builders.js");
  ok(/amountToHangul/.test(builders), "빌더(builders.js)도 amountToHangul 사용 — 입력 에코와 동일 한글 표기 출처");
  // 동일 함수이므로 입력 단계에서 본 한글 금액이 산출물에 그대로 박힌다(별도 단언은 [A]가 값 일치를 보장)
  ok(amountToHangul("12000000000") === amountToHangul("12,000,000,000"),
    "콤마 유무와 무관하게 동일 한글(입력 표기 흔들림 없음)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
