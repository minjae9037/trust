/* ============================================================
   회귀 가드 — 실제소유자확인서(ubo) 지분율(%) 입력 확인용 readback

   배경: 실제소유자확인서(ubo)의 지분율(uboShare)은 특정금융정보법(특금법)상 실제소유자
   (25% 이상 지분 보유 자연인)를 식별하는 법적 정량값으로, 산출물 고유정보 표에 raw 그대로
   박힌다(builders.js docRows: kvRow("지분율 (%)", raw)). 그러나 위저드의 다른 모든 정량 입력은
   확인 수단을 갖췄지만(금액=한글 readback·면적=평 환산·날짜=달력 해석·비율=범위 게이트) 지분율만
   확인·검증 수단이 전무해, "5"↔"50" 한 자리 오입력이나 "1000"·"-5" 같은 범위 밖 값이 특금법
   서류에 그대로 들어갈 수 있었다. 이제 숫자꼴 지분율이면 0~100 범위·25% 기준 충족 여부를 에코하고
   범위 밖이면 비차단 주의를 띄운다(면적·날짜 readback 과 같은 표시 전용·비차단 계열).

   핵심 불변식:
     - ★표시 전용·비차단 — 게이트(validateDoc)·빌더·조문 무접촉(자유 텍스트라 형식 강제·차단 없음).
     - 숫자꼴(%·콤마·소수·공백)일 때만 해석, free-form(메모 등)은 null = 무간섭(추정 형식 강제 금지).
     - 0 < pct ≤ 100 = inRange(readback) / 그 외 = 비차단 주의 / 25% 이상 = 실제소유자 기준 충족.
     - loan-hangul 기존 클래스 재사용(새 CSS 0)·role=status(readback=aria-live=polite, 주의=비차단).

   단언:
     (A) interpretSharePct 순수 거동 — 해석·범위·25% 기준·free-form 무간섭
     (B) schema 배선 — DocField.pct 플래그 + uboShare 에 pct:true
     (C) DocStep 배선 — import·pct 일 때만 pctInfo·readback(inRange)·비차단 주의(범위 밖)
     (D) 무접촉/무회귀 — 게이트(validate) 무관·빌더 무혼입·새 CSS 0·기존 money/date 에코 보존

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-ubo-share-readback.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { interpretSharePct } from "../src/lib/engine/calc.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const __dir = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(join(__dir, "..", ...p), "utf8");
const docStep = read("src", "components", "trust", "steps", "DocStep.tsx");
const schema = read("src", "lib", "engine", "schema.ts");
const validate = read("src", "lib", "engine", "validate.ts");
const globals = read("src", "app", "globals.css");
const builders = read("src", "lib", "engine", "docx", "builders.js");

console.log("\n[A] interpretSharePct 순수 거동 — 해석·범위·25% 기준·free-form 무간섭");
{
  // 유효 범위(0 < pct ≤ 100) + 25% 기준 충족
  ok(JSON.stringify(interpretSharePct("25")) === JSON.stringify({ pct: 25, inRange: true, meetsUbo: true }),
     "25 → {pct:25, inRange:true, meetsUbo:true}(실제소유자 기준 충족)");
  ok(JSON.stringify(interpretSharePct("100")) === JSON.stringify({ pct: 100, inRange: true, meetsUbo: true }),
     "100 → inRange·meetsUbo true");
  // 25% 미만 = 유효 범위지만 실제소유자 기준 미만
  ok(interpretSharePct("20")?.inRange === true && interpretSharePct("20")?.meetsUbo === false,
     "20 → inRange true·meetsUbo false(25% 미만)");
  // ★자릿수 오입력 구별 — "5" ↔ "50" 은 25% 기준 판정이 갈린다
  ok(interpretSharePct("5")?.meetsUbo === false && interpretSharePct("50")?.meetsUbo === true,
     "5 ↔ 50(자릿수 차이) → 25% 기준 판정 상이(오입력 구별)");
  // % 기호·소수·콤마·공백 허용(parseAmount 단일 출처)
  ok(interpretSharePct("33.3")?.pct === 33.3, "33.3(소수) → pct 33.3");
  ok(interpretSharePct("25%")?.pct === 25 && interpretSharePct(" 25 %")?.pct === 25,
     "'25%'·' 25 %' → pct 25(% 제거·공백 허용)");
  // 범위 밖 = inRange false(비차단 주의 대상)
  ok(interpretSharePct("0")?.inRange === false, "0 → inRange false(0 이하)");
  ok(interpretSharePct("1000")?.inRange === false && interpretSharePct("1000")?.meetsUbo === true,
     "1000 → inRange false(100 초과·비차단 주의)");
  // free-form / 빈 값 → null(무간섭 = 자유 텍스트 형식 강제 금지)
  ok(interpretSharePct("해당 없음") === null && interpretSharePct("미정") === null,
     "free-form 텍스트('해당 없음'·'미정') → null(무간섭)");
  ok(interpretSharePct("-5") === null, "'-5'(음수 부호=숫자꼴 아님) → null(무간섭·오탐 차단)");
  ok(interpretSharePct("") === null && interpretSharePct(null) === null && interpretSharePct(undefined) === null,
     "빈 값·null·undefined → null");
}

console.log("\n[B] schema 배선 — DocField.pct 플래그 + uboShare 에 pct:true");
{
  ok(/pct\?\: boolean/.test(schema), "DocField 에 pct?: boolean 플래그 정의");
  // uboShare 항목에 pct:true (지분율 필드)
  ok(/key:\s*"uboShare"[^}]*pct:\s*true/.test(schema), "uboShare 에 pct:true");
  // 라벨·placeholder 보존(무회귀)
  ok(/key:\s*"uboShare"[^}]*label:\s*"지분율 \(%\)"/.test(schema), "uboShare 라벨 '지분율 (%)' 보존");
}

console.log("\n[C] DocStep 배선 — import·pct 일 때만 pctInfo·readback(inRange)·비차단 주의(범위 밖)");
{
  ok(/interpretSharePct/.test(docStep) && /from "@\/lib\/engine\/calc"/.test(docStep),
     "calc 에서 interpretSharePct import");
  // pct 필드일 때만 해석(다른 필드 무영향)
  ok(/const pctInfo = f\.pct \? interpretSharePct\(val as string\) : null;/.test(docStep),
     "f.pct 일 때만 pctInfo = interpretSharePct(val)");
  // inRange → readback(loan-hangul·role=status·aria-live=polite·25% 기준 충족/미만)
  ok(/pctInfo && pctInfo\.inRange &&/.test(docStep)
     && /className="loan-hangul" role="status" aria-live="polite"/.test(docStep),
     "inRange → loan-hangul·role=status·aria-live=polite readback");
  ok(/실제소유자 기준\(25% 이상\)/.test(docStep) && /pctInfo\.meetsUbo \? "충족" : "미만"/.test(docStep),
     "readback 에 25% 실제소유자 기준 충족/미만 표기");
  // 범위 밖 → 비차단 주의(role=status·alert/aria-invalid 아님 = 게이트 차단 아님)
  ok(/pctInfo && !pctInfo\.inRange &&/.test(docStep)
     && /지분율은 0 초과 100 이하의 숫자로 확인해 주세요/.test(docStep),
     "범위 밖 → 비차단 주의 문구");
  // ★비차단 보장 — 지분율 안내는 role="alert"/aria-invalid 를 쓰지 않는다(date 주의와 동형 role=status)
  const pctIdx = docStep.indexOf("지분율은 0 초과 100 이하");
  const seg = docStep.slice(docStep.indexOf("{pctInfo && !pctInfo.inRange"), pctIdx + 40);
  ok(pctIdx > 0 && /role="status"/.test(seg) && !/role="alert"|aria-invalid/.test(seg),
     "★지분율 주의 = role=status(비차단) — role=alert/aria-invalid 미사용(게이트 차단 아님)");
}

console.log("\n[D] 무접촉/무회귀 — 게이트(validate) 무관·빌더 무혼입·새 CSS 0·기존 money/date 에코 보존");
{
  // 게이트(validate.ts)는 지분율 readback 과 무관 — 비차단(생성 차단 무영향)
  ok(!/interpretSharePct|uboShare|지분율|meetsUbo/.test(validate),
     "validate.ts(게이트)는 지분율 readback 과 무관 — 차단/검증 대상 아님(표시 전용)");
  // 산출물 빌더에 25% 기준·readback 미혼입(빌더는 raw 지분율만 표기)
  ok(!/interpretSharePct|meetsUbo|실제소유자 기준\(25%/.test(builders),
     "builders.js(산출물)는 지분율 readback 미혼입 — 표시/출력 경계 분리");
  // loan-hangul·field-hint 기존 CSS 재사용 — 새 CSS 0
  ok(/\.loan-hangul\s*\{/.test(globals), "loan-hangul CSS 기존 재사용(새 CSS 0)");
  // 기존 money(한글 금액)·date(달력 해석) 에코 보존(무회귀)
  ok(/className="amount-echo"/.test(docStep) && /interpretDate/.test(docStep),
     "기존 money(amount-echo)·date(interpretDate) 에코 보존(무회귀)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
