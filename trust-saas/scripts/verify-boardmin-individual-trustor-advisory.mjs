/* ============================================================
   회귀 가드 — 이사회 의사록(boardMin) 작성인데 위탁자가 모두 개인 입력 지점 교차검증 advisory

   배경: 이사회 의사록(docId="boardMin")은 스키마상 "위탁자(법인) 이사회의 담보신탁 결의"
   서류다(이사회 = 법인의 의사결정 기관). 그런데 위탁자(STEP 02 PartyCard)가 모두 개인
   (자연인)이면 이사회 자체가 존재하지 않아 이 서류의 작성 전제가 성립하지 않는다. 그러나
   위탁자 유형(법인/개인)과 이사회 의사록 입력(Doc 05)이 서로 다른 화면에서 입력돼 그
   부정합이 조용히 성립할 수 있었다(법인 위탁자 폼을 개인으로 바꾸고 Doc 05 를 손대지 않은
   경우, 또는 개인 위탁자인데 서류를 잘못 고른 경우). ubo=위탁자 동일·전원 법인 advisory
   (c75053c)의 대칭(역) 형태 — 거기는 every(법인)일 때, 여기는 every(개인)일 때 표출한다.
   날짜·금액·당사자 동일주체 advisory 패밀리와 동형의 "막지 않는 되짚음" — 기존 입력
   (form.trustors[].type · boardMin.meetingDate)의 파생 표시일 뿐 차단·조문·산출물 무관.

   핵심 불변식:
     - ★표시 전용 — 게이트(validate)·빌더(builders.js)·조문 무접촉(차단 아님).
       boardMinIndividualTrustor 는 기존 입력 파생일 뿐 어느 산출물·게이트에도 영향 0.
       새 상태/모델/엔진 무접촉.
     - 조건 = docId==="boardMin" && f.key==="meetingDate" && val 채움(trim>0) &&
       form.trustors.length>0 && form.trustors.every(t=>t.type==="개인").
       ★false-positive 방지: 위탁자 중 한 명이라도 법인이면 그 법인의 이사회 결의로 정당해
       미표출 — every(개인)일 때만 이사회 부재가 확실해 표출. 날짜 실재 여부와 무관(구조
       부정합은 날짜 유효성과 별개)이라 dateInfo 게이팅 없이 "채움" 신호만 본다.
     - role=status·aria-live=polite(동적 출현 SR 고지) + 선두 ⚠ 글리프 aria-hidden
       (장식 글리프 접근명 오염 0 — 기존 컨벤션).
     - 기존 클래스(field-hint) 재사용 + 인라인 style 만 — 새 CSS 0.
     - 색 = var(--c-brown) 토큰(차단 적색 var(--c-danger) 아님 — 검토 신호).

   단언:
     (A) DocStep 배선 — 조건·문구·role=status·aria-hidden 글리프·field-hint·brown
     (B) 단일 출처/모델 계약 — form.trustors[].type 파생 + boardMin.meetingDate(model·schema)
     (C) 무회귀 — 이사회 날짜 선후 advisory(boardMeetingAfterContract)·기타 advisory 패밀리 보존
     (D) 무접촉 — validate/builders 에 advisory 문구 미혼입·globals 새 클래스 0·차단 적색 미사용

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-boardmin-individual-trustor-advisory.mjs
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
  ok(/const boardMinIndividualTrustor =/.test(doc), "boardMinIndividualTrustor 파생 상수 선언");
  const cond = doc.slice(doc.indexOf("const boardMinIndividualTrustor ="),
                         doc.indexOf("const boardMinIndividualTrustor =") + 340);
  ok(/docId === "boardMin" &&/.test(cond), "조건 1 = docId === \"boardMin\"(이사회 의사록 화면 한정)");
  ok(/f\.key === "meetingDate" &&/.test(cond), "조건 2 = f.key === \"meetingDate\"(해당 필드 한정)");
  ok(/typeof val === "string" &&\s*val\.trim\(\)\.length > 0 &&/.test(cond),
     "조건 3 = val 채움(trim>0)(이 서류를 실제 작성 중일 때만 — 날짜 실재 여부 무관)");
  ok(/form\.trustors\.length > 0 &&/.test(cond), "조건 4 = trustors.length > 0(위탁자 입력 있을 때만)");
  ok(/form\.trustors\.every\(\(t\) => t\.type === "개인"\)/.test(cond),
     "조건 5 = every(t.type===\"개인\")(★법인 1명이라도 있으면 미표출 — false-positive 방지)");
  // advisory 본문 — 이사회=법인 서류 + 위탁자 전원 개인 + 이사회 부재 + 확인 권유(차단 아님)
  ok(/이사회 의사록은 위탁자\(법인\) 이사회의 담보신탁 결의 서류인데 현재 위탁자가 모두 개인입니다/.test(doc),
     "advisory 본문 = 이사회 의사록(법인 서류)인데 위탁자가 모두 개인인 사실 되짚음");
  ok(/개인\(자연인\) 위탁자는 이사회가 없습니다\. 위탁자 유형 또는 이 서류 작성 여부를 확인하세요\./.test(doc),
     "막지 않고(차단 아님) 이사회 부재 사실을 안내하며 위탁자 유형·서류 작성 여부 확인 권유(사용자 선택 보존)");
  const adv = doc.slice(doc.indexOf("{boardMinIndividualTrustor && ("));
  ok(/role="status" aria-live="polite"/.test(adv.slice(0, 600))
     && /<span aria-hidden="true">⚠ <\/span>/.test(adv.slice(0, 600)),
     "role=status·aria-live=polite + 선두 ⚠ 글리프 aria-hidden(접근명 오염 0)");
  ok(/\{boardMinIndividualTrustor && \(\s*<div className="field-hint" role="status" aria-live="polite"/.test(doc),
     "field-hint 기존 클래스 재사용(새 클래스 0)");
  ok(adv.slice(0, 600).includes("var(--c-brown)"),
     "advisory 색 = var(--c-brown) 토큰(차단 적색 아님·기존 advisory 와 동형)");
  ok(!adv.slice(0, 600).includes("var(--c-danger)"),
     "advisory 는 차단 적색(var(--c-danger)) 미사용 — 검토 신호일 뿐 차단 아님");
}

console.log("\n[B] 단일 출처/모델 계약 — form.trustors[].type 파생 + boardMin.meetingDate(model·schema)");
{
  ok(/export type PartyType = "법인" \| "개인";/.test(model),
     "PartyType = \"법인\"|\"개인\"(every(개인) 비교의 모델 계약 보존)");
  ok(/boardMin: \{[^}]*meetingDate\?: string;[^}]*\}/.test(model),
     "model 의 boardMin 블록에 meetingDate 필드 존재(파생 입력 계약 보존)");
  ok(/key: "meetingDate", type: "text", date: true, label: "회의 일자"/.test(schema),
     "schema 의 boardMin meetingDate = text·date 필드(val 채움 판정 계약 보존)");
  ok(/id: "boardMin", name: "이사회 의사록\(위탁자\)"[^}]*위탁자\(법인\) 이사회의 담보신탁 결의/.test(schema),
     "schema 의 boardMin = \"위탁자(법인) 이사회의 담보신탁 결의\" 서류 정의 보존(advisory 전제)");
}

console.log("\n[C] 무회귀 — 이사회 날짜 선후 advisory + 기타 advisory 패밀리 보존");
{
  ok(/const boardMeetingAfterContract =/.test(doc),
     "이사회 회의 일자 > 체결일 advisory(boardMeetingAfterContract) 공존(같은 필드 다른 갈래)");
  ok(/const uboSameAsCorpTrustor =/.test(doc),
     "ubo=위탁자 동일·전원 법인 advisory(대칭 형태) 공존 — 본 advisory 가 패밀리 손상 안 함");
  ok(/advisory|교차검증/.test(doc), "DocStep 교차검증 advisory 패밀리 주석/배선 공존");
}

console.log("\n[D] 무접촉 — validate/builders 에 advisory 문구 미혼입·globals 새 클래스 0·차단 적색 미사용");
{
  ok(!/위탁자가 모두 개인입니다|개인\(자연인\) 위탁자는 이사회가 없습니다/.test(validate),
     "validate.ts(게이트)에 advisory 문구 미혼입 — 차단/검증 대상 아님(표시 전용)");
  ok(!/위탁자가 모두 개인입니다|개인\(자연인\) 위탁자는 이사회가 없습니다/.test(builders),
     "builders.js(산출물)에 advisory 문구 미혼입 — 조문·표 미변경(표시 전용)");
  ok(!/boardmin-?individual|boardMinIndividualTrustor/.test(globals),
     "globals.css 에 advisory 전용 새 클래스 0(field-hint 재사용)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
