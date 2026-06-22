/* ============================================================
   회귀 가드 — 신탁재산 원본가액(Doc 04) ≠ 신탁부동산 가격(Doc 01) 입력 지점 교차검증 advisory

   배경: Doc 04(신탁재산 원본가액 신고서·valReport)의 원본가액(principalValue)과
   Doc 01(신청서·appform)의 신탁부동산 가격(valuationPrice)은 같은 신탁 부동산의 평가액을
   서로 다른 서류에서 각각 입력받는다. 통상 동일 평가액이므로 둘이 다르면 한쪽 오기(0 개수
   오입력·구버전 평가) 가능성이 있어 입력 지점에서 확인하는 것이 자연스럽다. 그러나 두 값이
   서로 다른 서류 단계에서 입력돼 그 불일치가 조용히 성립하던 갭이 있었다. StepLoanCalc
   한도합계 vs 평가가격 advisory 와 동형의 "막지 않는 되짚음" — 순수 산술 비교(두 사용자
   입력)일 뿐 차단·조문·산출물 무관(원본가액=장부가·가격=감정가처럼 정당하게 다를 수 있어
   사용자 선택 보존).

   핵심 불변식:
     - ★표시 전용 — 게이트(validate)·빌더(builders.js)·조문 무접촉(차단 아님). valuationMismatch
       는 기존 입력(valReport.principalValue·appform.valuationPrice)의 파생 표시일 뿐 어느
       산출물·게이트에도 영향을 주지 않는다. 새 상태/모델/엔진 무접촉.
     - 조건 = docId==="valReport" && f.key==="principalValue" && isPositiveAmount(원본가액)
       && isPositiveAmount(가격) && parseAmount(원본가액) !== parseAmount(가격).
       한쪽 미입력·무효(양수 아님)·동일 금액이면 미표출(나그·오탐 방지).
     - role=status·aria-live=polite(동적 출현 SR 고지) + 선두 ⚠ 글리프 aria-hidden
       (장식 글리프 접근명 오염 0 — 기존 컨벤션).
     - 기존 클래스(field-hint) 재사용 + 인라인 style 만 — 새 CSS 0.
     - 색 = var(--c-brown) 토큰(차단 적색 var(--c-danger) 아님 — 검토 신호·기존 advisory 동형).
     - 근거 = "같은 부동산 평가액이 문서마다 다른지 확인"이라는 정합 되짚음(추정 조문 아님·등치 강제 아님).

   단언:
     (A) DocStep 배선 — valuationMismatch 조건·문구·role=status·aria-hidden 글리프·field-hint·brown
     (B) 순수 산술 — appform.valuationPrice / isPositiveAmount / parseAmount 사용·docId/f.key 게이트
     (C) 무회귀 — money 인라인 검증·amount-echo·날짜/지분율 readback·검증 게이트 보존
     (D) 무접촉 — validate/builders 에 advisory 문구 미혼입·새 CSS 0·차단 적색 미사용

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-valreport-price-mismatch-advisory.mjs
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
const doc = read("src", "components", "trust", "steps", "DocStep.tsx");
const validate = read("src", "lib", "engine", "validate.ts");
const builders = read("src", "lib", "engine", "docx", "builders.js");
const globals = read("src", "app", "globals.css");
const schema = read("src", "lib", "engine", "schema.ts");

console.log("\n[A] DocStep 배선 — valuationMismatch 조건·문구·role=status·aria-hidden 글리프·field-hint·brown");
{
  ok(/const valuationMismatch =/.test(doc), "valuationMismatch 파생 상수 선언");
  ok(/docId === "valReport" &&/.test(doc), "조건 1 = docId === 'valReport'(원본가액 신고서 단계에서만)");
  ok(/f\.key === "principalValue" &&/.test(doc), "조건 2 = f.key === 'principalValue'(원본가액 필드에서만)");
  ok(/isPositiveAmount\(val as string\) &&/.test(doc), "조건 3 = isPositiveAmount(원본가액)(미입력·무효 시 미표출)");
  ok(/isPositiveAmount\(crossPrice\) &&/.test(doc), "조건 4 = isPositiveAmount(가격)(미입력·무효 시 미표출)");
  ok(/parseAmount\(val as string\) !== parseAmount\(crossPrice\)/.test(doc),
     "조건 5 = parseAmount(원본가액) !== parseAmount(가격)(다를 때만 — 동일 금액 미표출)");
  // advisory 본문 — 불일치 사실 되짚음 + 확인 권유(차단 아님)
  ok(/신탁재산 원본가액\(.*\)이 신청서\(Doc 01\)에 입력한 신탁부동산 가격\(.*\)과 다릅니다/.test(doc),
     "advisory 본문 = 원본가액 ≠ 신탁부동산 가격 사실 되짚음(두 값 동시 표기)");
  ok(/같은 부동산 평가액이 문서마다 다른지 확인하세요/.test(doc),
     "막지 않고(차단 아님) 같은 부동산 평가액 확인을 권유(사용자 선택 보존·등치 강제 아님)");
  // 동적 출현 SR 고지 + 선두 ⚠ aria-hidden (advisory 블록 직전 구간)
  const adv = doc.slice(doc.indexOf("{valuationMismatch && ("));
  ok(/role="status" aria-live="polite"/.test(adv.slice(0, 600))
     && /<span aria-hidden="true">⚠ <\/span>/.test(adv.slice(0, 600)),
     "role=status·aria-live=polite + 선두 ⚠ 글리프 aria-hidden(접근명 오염 0)");
  ok(/\{valuationMismatch && \(\s*<div className="field-hint" role="status" aria-live="polite"/.test(doc),
     "field-hint 기존 클래스 재사용(새 클래스 0)");
  ok(adv.slice(0, 600).includes("var(--c-brown)"),
     "advisory 색 = var(--c-brown) 토큰(차단 적색 아님·기존 advisory 와 동형)");
  ok(!adv.slice(0, 600).includes("var(--c-danger)"),
     "advisory 는 차단 적색(var(--c-danger)) 미사용 — 검토 신호일 뿐 차단 아님");
}

console.log("\n[B] 순수 산술 — appform.valuationPrice / isPositiveAmount / parseAmount 사용·docId/f.key 게이트");
{
  ok(/const crossPrice = form\.docContents\.appform\?\.valuationPrice;/.test(doc),
     "crossPrice = form.docContents.appform?.valuationPrice(구버전 저장본 옵셔널 체이닝)");
  ok(/import \{[^}]*\bparseAmount\b[^}]*\} from "@\/lib\/engine\/calc"/.test(doc)
     && /import \{[^}]*\bisPositiveAmount\b[^}]*\} from "@\/lib\/engine\/calc"/.test(doc),
     "calc 에서 parseAmount·isPositiveAmount import(추정 산식 아님·단일 출처)");
  // 스키마 사실 — valReport.principalValue / appform.valuationPrice 가 실제 money 필드인지(추정 아님)
  ok(/key: "principalValue".*money: true.*신탁재산 원본가액/.test(schema)
     || /principalValue.*money: true/.test(schema),
     "스키마: valReport.principalValue 가 money 필드(사실 기반)");
  ok(/key: "valuationPrice".*money: true.*신탁부동산 가격/.test(schema)
     || /valuationPrice.*money: true/.test(schema),
     "스키마: appform.valuationPrice 가 money 필드(사실 기반)");
}

console.log("\n[C] 무회귀 — money 인라인 검증·amount-echo·날짜/지분율 readback·검증 게이트 보존");
{
  ok(/유효하지 않은 금액입니다 — 0보다 큰 숫자만 입력할 수 있습니다/.test(doc),
     "money 무효 인라인 오류(moneyInvalid) 보존");
  ok(/className="amount-echo"/.test(doc), "amount-echo(천단위·한글 금액 에코) 보존");
  ok(/달력에 없는 날짜일 수 있습니다/.test(doc), "날짜(평가기준일) readback 보존");
  ok(/실제소유자 기준\(25% 이상\)/.test(doc), "지분율 readback 보존");
  ok(/className="validate-box" role="alert"/.test(doc), "검증 게이트(validate-box) 보존");
  ok(/초안 · 필수 입력/.test(doc), "미리보기 초안 배지 보존");
}

console.log("\n[D] 무접촉 — validate/builders 에 advisory 문구 미혼입·새 CSS 0·차단 적색 미사용");
{
  ok(!/같은 부동산 평가액이 문서마다 다른지 확인하세요/.test(validate),
     "validate.ts(게이트)에 advisory 문구 미혼입 — 차단/검증 대상 아님(표시 전용)");
  ok(!/같은 부동산 평가액이 문서마다 다른지 확인하세요/.test(builders),
     "builders.js(산출물)에 advisory 문구 미혼입 — 조문·표 미변경(표시 전용)");
  ok(!/valuation-mismatch|valreport-mismatch|price-mismatch/.test(globals),
     "globals.css 에 advisory 전용 새 클래스 0(field-hint 재사용)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
