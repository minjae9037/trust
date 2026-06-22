/* ============================================================
   회귀 가드 — 우선수익한도 산정표(StepLoanCalc) 데이터 표 헤더 의미구조(scope)

   배경(a11y·WCAG 1.3.1 Info and Relationships, 비-산출물): 위저드에서 HTML
   <table> 로 렌더되는 유일한 데이터 표가 StepLoanCalc 의 우선수익한도 산정표다.
   각 행은 회사별 대출금액·우선수익한도금액(= 대출금액 × 비율)이라는 법적 금액을
   보여 준다. 그러나 종전엔 어떤 셀에도 scope 속성이 없어, 스크린리더로 임의 금액
   셀(예: 한도금액 "12,000,000,000 원")을 읽을 때 그것이 ① 어느 열(대출금액 ↔
   한도금액)에 ② 어느 회사(행)에 속하는지 안정적으로 고지되지 않았다. 정확성 최우선
   원칙상 "어느 회사의 얼마"가 분명해야 하므로, 열 헤더에 scope="col", 행 식별자
   (회사명)·합계 라벨에 <th scope="row"> 를 부여해 모든 금액 셀을 열·행 헤더에 명시
   연결한다(값·산식·게이트·산출물 무접촉 — 표 의미구조만, 시각 무변경).

   핵심 불변식:
     (A) 열 헤더 — thead 의 <th> 4종(NO·회사명·대출금액·우선수익한도금액)이 모두
         scope="col". (열 헤더 누락/오부착 회귀 차단)
     (B) ★행 식별자 — 회사명 셀이 <th scope="row">(plain <td> 로의 회귀 차단).
         같은 행의 대출금액·한도금액 셀이 회사에 연결됨.
     (C) 합계 라벨 — tfoot 합계 셀이 <th scope="row" colSpan={2}>(합계 행 식별).
     (D) ★시각 무변경 — 회사명 행 헤더는 th 기본(가운데·굵게)이 아니라 기존 td 외형
         (textAlign:left·fontWeight:400)을 명시 유지. th/td 스타일 상수 보존.
     (E) 무회귀 — thead/tbody/tfoot 구조, 금액 readback(amountToHangul)·한도 계산
         (priorityLimitFor·isPositiveAmount)·인라인 검증 배선 보존.

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-loancalc-table-headers.mjs
     (정적 소스 단언만 — 러너 일관성 위해 동일 실행)
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(
  path.join(root, "src", "components", "trust", "steps", "StepLoanCalc.tsx"),
  "utf8"
);
// 구조 단언은 JSX 주석({/* ... */})을 제거한 마크업에 대해서만 — 주석 안의 예시
// 텍스트(<th scope="row"> 등)가 셀 개수 단언을 오염시키지 않게 한다.
const code = src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const flat = code.replace(/\s+/g, " ");

console.log("\n[A] 열 헤더 — thead <th> 4종 모두 scope=\"col\"");
{
  const theadIdx = code.indexOf("<thead>");
  const theadEnd = code.indexOf("</thead>");
  const thead = theadIdx >= 0 && theadEnd > theadIdx ? code.slice(theadIdx, theadEnd) : "";
  ok(thead.length > 0, "thead 구간 추출");
  const allTh = (thead.match(/<th\b/g) || []).length;
  const colTh = (thead.match(/<th scope="col"/g) || []).length;
  ok(colTh === 4, `thead 에 scope="col" <th> 4개 (실제 ${colTh})`);
  // thead 의 모든 <th> 가 scope="col" — scope 미부착 <th> 잔존 0(회귀 차단)
  ok(allTh === colTh, `thead 의 모든 <th>(${allTh}) 가 scope="col"(${colTh}) — 미부착 잔존 0`);
  // 헤더 라벨 보존
  ok(/>NO<\/th>/.test(thead), "열 헤더 NO 보존");
  ok(/>회사명<\/th>/.test(thead), "열 헤더 회사명 보존");
  ok(/대출금액 \(원\)/.test(thead), "열 헤더 대출금액 보존");
  ok(/우선수익한도금액 \(원\)/.test(thead), "열 헤더 우선수익한도금액 보존");
}

console.log("\n[B] ★행 식별자 — 회사명 셀이 <th scope=\"row\">");
{
  // 회사명 셀 = p.name 폴백을 담은 셀이 <th scope="row"> 여야 함(td 회귀 차단)
  ok(/<th scope="row"[^>]*>\s*\{p\.name \|\| "\(STEP 02 에서 이름 입력\)"\}\s*<\/th>/.test(flat
       .replace(/<th scope="row"([^>]*)>/g, '<th scope="row"$1>')),
     "회사명 셀 = <th scope=\"row\">(p.name 폴백 포함)");
  // plain <td> 로 회사명을 렌더하던 회귀가 없어야 함
  ok(!/<td[^>]*>\s*\{p\.name \|\| "\(STEP 02 에서 이름 입력\)"\}/.test(flat),
     "회사명을 plain <td> 로 렌더하는 회귀 잔존 0");
}

console.log("\n[C] 합계 라벨 — tfoot 합계 셀이 <th scope=\"row\" colSpan>");
{
  const tfootIdx = code.indexOf("<tfoot>");
  const tfootEnd = code.indexOf("</tfoot>");
  const tfoot = tfootIdx >= 0 && tfootEnd > tfootIdx ? code.slice(tfootIdx, tfootEnd) : "";
  ok(tfoot.length > 0, "tfoot 구간 추출");
  ok(/<th scope="row" colSpan=\{2\}[^>]*>\s*합계\s*<\/th>/.test(tfoot.replace(/\s+/g, " ")),
     "합계 셀 = <th scope=\"row\" colSpan={2}>");
  // 합계를 plain <td colSpan={2}>합계 로 렌더하던 회귀 차단
  ok(!/<td colSpan=\{2\}[^>]*>\s*합계/.test(tfoot.replace(/\s+/g, " ")),
     "합계를 plain <td colSpan={2}> 로 렌더하는 회귀 잔존 0");
}

console.log("\n[D] ★시각 무변경 — 회사명 행 헤더는 td 외형(좌측·보통 굵기) 유지");
{
  // 회사명 th scope=row 는 textAlign:left + fontWeight:400 을 명시(th 기본 가운데·굵게 회피)
  const rowThIdx = flat.indexOf('<th scope="row" style={{ ...td, textAlign: "left", fontWeight: 400 }}>');
  ok(rowThIdx > 0, "회사명 행 헤더 style = {...td, textAlign:left, fontWeight:400}(시각 무변경)");
  // th/td 스타일 상수 보존(셀 padding·border 일관)
  ok(/const th: React\.CSSProperties = \{/.test(src), "th 스타일 상수 보존");
  ok(/const td: React\.CSSProperties = \{/.test(src), "td 스타일 상수 보존");
}

console.log("\n[E] 무회귀 — 표 구조·금액 readback·한도 계산 배선 보존");
{
  ok(/<thead>/.test(src) && /<tbody>/.test(src) && /<tfoot>/.test(src),
     "thead/tbody/tfoot 구조 보존");
  ok(/priorityLimitFor\(p, ratio\)/.test(src), "한도 계산 priorityLimitFor 배선 보존");
  ok(/isPositiveAmount\(p\.loanAmount\)/.test(src), "개별 대출금액 isPositiveAmount 검증 보존");
  ok(/amountToHangul\(limit\)/.test(src), "한도금액 한글 readback(amountToHangul) 보존");
  ok(/className="loan-hangul"/.test(src), "loan-hangul readback 클래스 보존");
  ok(/<div\s+className="loan-hangul"[^>]*>\{amountToHangul\(p\.loanAmount\)\}/.test(flat),
     "대출금액 한글 readback 보존");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
process.exit(fail === 0 ? 0 : 1);
