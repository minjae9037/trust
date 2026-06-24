/* ============================================================
   회귀 가드 — 실제소유자(ubo) "위탁자와 다름"인데 지분율(%) 미입력 입력 지점 교차검증 advisory

   배경: 실제소유자확인서(docId="ubo")의 "위탁자와 동일 여부"(sameAsTrustor)를 "다름"(no)으로
   표기하면, 실제소유자는 위탁자 본인이 아닌 별도 자연인이므로 그 보유 지분(uboShare)도 함께
   식별해 기재해야 한다 — 지분율은 특정금융정보법 §5의2상 실제소유자(그 법인 지분 25% 이상 보유
   자연인)를 식별하는 법적 정량값이고, 산출물(실제소유자확인서) 고유정보 표에 raw 그대로 박힌다
   (builders.js docRows: kvRow("지분율 (%)", raw)). 그러나 "다름" 라디오와 지분율 텍스트가 같은
   서류 안의 서로 다른 입력이라, "다름"을 고른 뒤 지분율을 비워 둔 채 조용히 진행될 수 있었다 →
   산출물 지분율 칸이 빈칸으로 박힌다. 이는 같은 ubo "다름" 경로의 성명 빈칸 advisory(verify-ubo-
   distinct-name-missing-advisory)의 동형 보완 갈래로, 거기는 성명(uboName) 빈칸일 때 표출하고
   여기는 지분율(uboShare) 빈칸일 때 표출한다. 지분율이 채워지면 같은 필드의 pctInfo readback
   (interpretSharePct — 빈 문자열이면 null)이 대신 떠 25% 충족/미만을 알리므로 둘은 상호배타다.
   두 기존 입력(ubo.sameAsTrustor·uboShare) 파생일 뿐 차단·조문·산출물 무관(막지 않는 되짚음).

   핵심 불변식:
     - ★표시 전용 — 게이트(validate)·빌더(builders.js)·조문 무접촉(차단 아님).
       uboShareDistinctMissing 는 기존 입력 파생일 뿐 어느 산출물·게이트에도 영향 0.
       새 상태/모델/엔진 무접촉.
     - 조건 = docId==="ubo" && f.key==="uboShare" &&
       form.docContents.ubo?.sameAsTrustor==="no" && (val 비어 있음/공백).
       ★false-positive 방지: "다름"(no)을 명시적으로 고른 경우에만 표출(미선택·"동일"이면
       미표출), 지분율이 한 글자라도 있으면 미표출(작성 완료로 간주 → pctInfo readback 으로 인계).
     - role=status·aria-live=polite(동적 출현 SR 고지) + 선두 ⚠ 글리프 aria-hidden
       (장식 글리프 접근명 오염 0 — 기존 컨벤션).
     - 기존 클래스(field-hint) 재사용 + 인라인 style 만 — 새 CSS 0.
     - 색 = var(--c-brown) 토큰(차단 적색 var(--c-danger) 아님 — 검토 신호).

   단언:
     (A) DocStep 배선 — 조건·문구·role=status·aria-hidden 글리프·field-hint·brown
     (B) 단일 출처/모델 계약 — ubo.sameAsTrustor·uboShare(model·schema)
     (C) 무회귀 — uboShare pct 필드 렌더·보완 갈래(성명) 및 기타 docId advisory 패밀리 보존
     (D) 무접촉 — validate/builders 에 advisory 문구 미혼입·globals 새 클래스 0·차단 적색 미사용

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-ubo-share-distinct-missing-advisory.mjs
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
const model = read("src", "lib", "engine", "model.ts");
const schema = read("src", "lib", "engine", "schema.ts");
const calc = read("src", "lib", "engine", "calc.ts");
const validate = read("src", "lib", "engine", "validate.ts");
const builders = read("src", "lib", "engine", "docx", "builders.js");
const globals = read("src", "app", "globals.css");

console.log("\n[A] DocStep 배선 — 조건·문구·role=status·aria-hidden 글리프·field-hint·brown");
{
  ok(/const uboShareDistinctMissing =/.test(doc), "uboShareDistinctMissing 파생 상수 선언");
  const at = doc.indexOf("const uboShareDistinctMissing =");
  const cond = doc.slice(at, at + 320);
  ok(/docId === "ubo" &&/.test(cond), "조건 1 = docId === \"ubo\"(실제소유자확인서 화면 한정)");
  ok(/f\.key === "uboShare" &&/.test(cond), "조건 2 = f.key === \"uboShare\"(지분율 칸 한정)");
  ok(/form\.docContents\.ubo\?\.sameAsTrustor === "no" &&/.test(cond),
     "조건 3 = ubo.sameAsTrustor === \"no\"(★\"다름\"을 명시적으로 고른 경우에만 — false-positive 방지)");
  ok(/\(typeof val !== "string" \|\| val\.trim\(\)\.length === 0\)/.test(cond),
     "조건 4 = 지분율 비어 있음/공백일 때만(한 글자라도 있으면 미표출 — pctInfo readback 으로 인계)");
  // advisory 본문 — "다름" 표기 사실 + 지분율 빈칸 + 산출물 빈칸 경고 + 25% 자연인 기준 + 입력 권유(차단 아님)
  ok(/실제소유자가 위탁자와 다르다고 표기했으나 지분율\(%\)이 비어 있습니다/.test(doc),
     "advisory 본문 = \"다름\"인데 지분율 빈칸 사실 되짚음");
  ok(/산출물 실제소유자확인서의 지분율 칸이 빈칸으로 출력됩니다/.test(doc),
     "산출물 지분율 칸 빈칸 출력 사실 명시(builders.js docRows 와 일치)");
  ok(/특정금융정보법상 실제소유자\(그 법인 지분 25% 이상 보유 자연인\)의 지분율을 입력하세요\./.test(doc),
     "막지 않고(차단 아님) 특금법 실제소유자 기준(25% 자연인)을 안내하며 지분율 입력 권유");
  const adv = doc.slice(doc.indexOf("{uboShareDistinctMissing && ("));
  ok(/role="status" aria-live="polite"/.test(adv.slice(0, 600))
     && /<span aria-hidden="true">⚠ <\/span>/.test(adv.slice(0, 600)),
     "role=status·aria-live=polite + 선두 ⚠ 글리프 aria-hidden(접근명 오염 0)");
  ok(/\{uboShareDistinctMissing && \(\s*<div className="field-hint" role="status" aria-live="polite"/.test(doc),
     "field-hint 기존 클래스 재사용(새 클래스 0)");
  ok(adv.slice(0, 600).includes("var(--c-brown)"),
     "advisory 색 = var(--c-brown) 토큰(차단 적색 아님·기존 advisory 와 동형)");
  ok(!adv.slice(0, 600).includes("var(--c-danger)"),
     "advisory 는 차단 적색(var(--c-danger)) 미사용 — 검토 신호일 뿐 차단 아님");
}

console.log("\n[B] 단일 출처/모델 계약 — ubo.sameAsTrustor·uboShare(model·schema·calc)");
{
  ok(/ubo: \{[^}]*uboShare\?: string;[^}]*\}/.test(model),
     "model 의 ubo 블록에 uboShare 필드 존재(파생 입력 계약 보존)");
  ok(/ubo: \{[^}]*sameAsTrustor\?: string;[^}]*\}/.test(model),
     "model 의 ubo 블록에 sameAsTrustor 필드 존재(파생 입력 계약 보존)");
  ok(/key: "uboShare", type: "text", pct: true/.test(schema),
     "schema 의 ubo uboShare = pct text 필드 보존(지분율 입력 칸 계약)");
  ok(/key: "sameAsTrustor", type: "radio"[^}]*options: \[\{ v: "yes", l: "동일" \}, \{ v: "no", l: "다름" \}\]/.test(schema),
     "schema 의 ubo sameAsTrustor 라디오 = yes(동일)/no(다름) 옵션 보존(=== \"no\" 계약)");
  // 빈 문자열이면 interpretSharePct 가 null → pctInfo readback 미표출 → advisory 와 상호배타 보장
  ok(/export function interpretSharePct\(/.test(calc) && /if \(s === ""\) return null;/.test(calc),
     "interpretSharePct: 빈 입력이면 null(지분율 빈칸엔 pctInfo readback 0 → advisory 와 상호배타)");
}

console.log("\n[C] 무회귀 — uboShare pct 필드 렌더 + 보완 갈래(성명) 및 기타 docId advisory 패밀리 보존");
{
  // uboShare 는 pct text → pctInfo 해석·readback 경로 보존
  ok(/const pctInfo = f\.pct \? interpretSharePct\(val as string\) : null;/.test(doc),
     "pctInfo = f.pct ? interpretSharePct(...) : null 보존(지분율 readback 경로)");
  ok(/\{pctInfo && pctInfo\.inRange && \(/.test(doc),
     "지분율 채움 시 pctInfo readback(충족/미만) 보존 — advisory 와 상호배타 인계 대상");
  ok(/onChange=\{\(e\) => setField\(f\.key, e\.target\.value\)\}/.test(doc),
     "텍스트 입력 배선 onChange→setField(f.key,e.target.value) 보존(uboShare 렌더 경로)");
  // 같은 ubo "다름" 경로의 보완 갈래(성명 빈칸) advisory 가 함께 살아 있어야 한다(양쪽 공존)
  ok(/const uboDistinctNameMissing =/.test(doc),
     "보완 갈래 uboDistinctNameMissing(다름·성명 빈칸) advisory 공존");
  ok(/const uboSameAsCorpTrustor =/.test(doc),
     "기타 ubo advisory(uboSameAsCorpTrustor 동일·전원 법인) 패밀리 공존");
  ok(/const boardMinIndividualTrustor =/.test(doc),
     "기타 입력 지점 교차검증 advisory(boardMinIndividualTrustor) 패밀리 공존");
}

console.log("\n[D] 무접촉 — validate/builders 에 advisory 문구 미혼입·globals 새 클래스 0·차단 적색 미사용");
{
  ok(!/지분율\(%\)이 비어 있습니다|실제소유자가 위탁자와 다르다고 표기했으나 지분율/.test(validate),
     "validate.ts(게이트)에 advisory 문구 미혼입 — 차단/검증 대상 아님(표시 전용)");
  ok(!/지분율\(%\)이 비어 있습니다|실제소유자가 위탁자와 다르다고 표기했으나 지분율/.test(builders),
     "builders.js(산출물)에 advisory 문구 미혼입 — 조문·표 미변경(표시 전용)");
  ok(!/ubo-?share-?distinct|uboShareDistinctMissing/.test(globals),
     "globals.css 에 advisory 전용 새 클래스 0(field-hint 재사용)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
