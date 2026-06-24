/* ============================================================
   회귀 가드 — 실제소유자(ubo) = 위탁자 동일인데 위탁자가 모두 법인 입력 지점 교차검증 advisory

   배경: 실제소유자확인서(docId="ubo")의 "위탁자와 동일 여부"(sameAsTrustor) 라디오를
   "동일"(yes)로 표기했는데 위탁자(STEP 02 PartyCard)가 모두 법인이면, 특정금융정보법
   §5의2·시행령상 "법인 고객의 실제소유자 = 그 법인 지분 25% 이상 자연인(법인 자신은
   자신의 실제소유자가 될 수 없음)"과 어긋난다. 그러나 실제소유자 정보(ubo 블록)와 위탁자
   유형(법인/개인)이 서로 다른 화면에서 입력돼 그 어긋남이 조용히 성립할 수 있었다(개인
   위탁자 폼을 법인으로 바꾸고 ubo 를 손대지 않은 경우 등). 날짜·금액·당사자 동일주체
   advisory 패밀리와 동형의 "막지 않는 되짚음" — 기존 입력(form.trustors[].type · ubo
   sameAsTrustor)의 파생 표시일 뿐 차단·조문·산출물 무관.

   핵심 불변식:
     - ★표시 전용 — 게이트(validate)·빌더(builders.js)·조문 무접촉(차단 아님).
       uboSameAsCorpTrustor 는 기존 입력 파생일 뿐 어느 산출물·게이트에도 영향 0.
       새 상태/모델/엔진 무접촉.
     - 조건 = docId==="ubo" && f.key==="sameAsTrustor" && val==="yes" &&
       form.trustors.length>0 && form.trustors.every(t=>t.type==="법인").
       ★false-positive 방지: 위탁자 중 한 명이라도 개인이면 "동일"이 그 개인을 가리킬 수
       있어 미표출 — every(법인)일 때만 "동일"이 반드시 법인을 가리키므로 표출.
     - role=status·aria-live=polite(동적 출현 SR 고지) + 선두 ⚠ 글리프 aria-hidden
       (장식 글리프 접근명 오염 0 — 기존 컨벤션).
     - 기존 클래스(field-hint) 재사용 + 인라인 style 만 — 새 CSS 0.
     - 색 = var(--c-brown) 토큰(차단 적색 var(--c-danger) 아님 — 검토 신호).

   단언:
     (A) DocStep 배선 — 조건·문구·role=status·aria-hidden 글리프·field-hint·brown
     (B) 단일 출처/모델 계약 — form.trustors[].type 파생 + ubo.sameAsTrustor(model·schema)
     (C) 무회귀 — 라디오 그룹 렌더(radiogroup·setField)·기타 docId advisory 패밀리 보존
     (D) 무접촉 — validate/builders 에 advisory 문구 미혼입·globals 새 클래스 0·차단 적색 미사용

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-ubo-sameastrustor-corp-advisory.mjs
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
const validate = read("src", "lib", "engine", "validate.ts");
const builders = read("src", "lib", "engine", "docx", "builders.js");
const globals = read("src", "app", "globals.css");

console.log("\n[A] DocStep 배선 — 조건·문구·role=status·aria-hidden 글리프·field-hint·brown");
{
  ok(/const uboSameAsCorpTrustor =/.test(doc), "uboSameAsCorpTrustor 파생 상수 선언");
  const cond = doc.slice(doc.indexOf("const uboSameAsCorpTrustor ="),
                         doc.indexOf("const uboSameAsCorpTrustor =") + 360);
  ok(/docId === "ubo" &&/.test(cond), "조건 1 = docId === \"ubo\"(실제소유자확인서 화면 한정)");
  ok(/f\.key === "sameAsTrustor" &&/.test(cond), "조건 2 = f.key === \"sameAsTrustor\"(해당 라디오 한정)");
  ok(/\(val as string\) === "yes" &&/.test(cond), "조건 3 = val === \"yes\"(동일로 표기했을 때만)");
  ok(/form\.trustors\.length > 0 &&/.test(cond), "조건 4 = trustors.length > 0(위탁자 입력 있을 때만)");
  ok(/form\.trustors\.every\(\(t\) => t\.type === "법인"\)/.test(cond),
     "조건 5 = every(t.type===\"법인\")(★개인 1명이라도 있으면 미표출 — false-positive 방지)");
  // advisory 본문 — 동일 표기 사실 + 위탁자 법인 + 25% 자연인 기준 + 확인 권유(차단 아님)
  ok(/실제소유자가 위탁자와 동일로 표기됐으나 위탁자가 법인입니다/.test(doc),
     "advisory 본문 = 실제소유자=위탁자 동일인데 위탁자가 법인인 사실 되짚음");
  ok(/지분을 25% 이상 보유한 자연인이어야 합니다\(법인 자신은 실제소유자가 될 수 없음\)\. 확인하세요\./.test(doc),
     "막지 않고(차단 아님) 법인 실제소유자 기준(25% 자연인)을 안내하며 확인 권유(사용자 선택 보존)");
  const adv = doc.slice(doc.indexOf("{uboSameAsCorpTrustor && ("));
  ok(/role="status" aria-live="polite"/.test(adv.slice(0, 600))
     && /<span aria-hidden="true">⚠ <\/span>/.test(adv.slice(0, 600)),
     "role=status·aria-live=polite + 선두 ⚠ 글리프 aria-hidden(접근명 오염 0)");
  ok(/\{uboSameAsCorpTrustor && \(\s*<div className="field-hint" role="status" aria-live="polite"/.test(doc),
     "field-hint 기존 클래스 재사용(새 클래스 0)");
  ok(adv.slice(0, 600).includes("var(--c-brown)"),
     "advisory 색 = var(--c-brown) 토큰(차단 적색 아님·기존 advisory 와 동형)");
  ok(!adv.slice(0, 600).includes("var(--c-danger)"),
     "advisory 는 차단 적색(var(--c-danger)) 미사용 — 검토 신호일 뿐 차단 아님");
}

console.log("\n[B] 단일 출처/모델 계약 — form.trustors[].type 파생 + ubo.sameAsTrustor(model·schema)");
{
  ok(/export type PartyType = "법인" \| "개인";/.test(model),
     "PartyType = \"법인\"|\"개인\"(every(법인) 비교의 모델 계약 보존)");
  ok(/ubo: \{[^}]*sameAsTrustor\?: string;[^}]*\}/.test(model),
     "model 의 ubo 블록에 sameAsTrustor 필드 존재(파생 입력 계약 보존)");
  ok(/key: "sameAsTrustor", type: "radio"[^}]*options: \[\{ v: "yes", l: "동일" \}, \{ v: "no", l: "다름" \}\]/.test(schema),
     "schema 의 ubo sameAsTrustor 라디오 = yes(동일)/no(다름) 옵션 보존(val===\"yes\" 계약)");
}

console.log("\n[C] 무회귀 — 라디오 그룹 렌더(radiogroup·setField) + 기타 docId advisory 패밀리 보존");
{
  ok(/role="radiogroup" aria-labelledby=\{fid\}/.test(doc),
     "라디오 그룹 role=radiogroup + aria-labelledby 보존(advisory 가 그룹 렌더 손상 안 함)");
  ok(/onChange=\{\(\) => setField\(f\.key, o\.v\)\}/.test(doc),
     "라디오 선택 배선 onChange→setField(f.key,o.v) 보존");
  // DocStep 의 다른 입력 지점 교차검증 advisory 패밀리(평가기준일·이사회 회의일 등) 공존 확인
  ok(/advisory|교차검증/.test(doc), "DocStep 교차검증 advisory 패밀리 주석/배선 공존");
}

console.log("\n[D] 무접촉 — validate/builders 에 advisory 문구 미혼입·globals 새 클래스 0·차단 적색 미사용");
{
  ok(!/위탁자가 법인입니다|법인 자신은 실제소유자가 될 수 없음/.test(validate),
     "validate.ts(게이트)에 advisory 문구 미혼입 — 차단/검증 대상 아님(표시 전용)");
  ok(!/위탁자가 법인입니다|법인 자신은 실제소유자가 될 수 없음/.test(builders),
     "builders.js(산출물)에 advisory 문구 미혼입 — 조문·표 미변경(표시 전용)");
  ok(!/ubo-?same-?as|uboSameAsCorpTrustor/.test(globals),
     "globals.css 에 advisory 전용 새 클래스 0(field-hint 재사용)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
