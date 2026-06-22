/* ============================================================
   회귀 가드 — 우선수익자 = 채무자(동일 당사자) 입력 지점 구조 정합 교차검증 advisory

   배경: 담보신탁에서 우선수익자(채권자)는 피담보채권을 가진 자, 채무자는 그 채무를 지는 자라
   동일 법적 주체일 수 없다(같은 당사자면 피담보채권이 혼동으로 소멸해 담보 구조 자체가 불성립).
   그런데 채무자를 위탁자와 다르게 별도 입력(debtorSameAsTrustor=false)하면 채무자는 STEP 01에서,
   우선수익자는 STEP 02-1 에서 서로 다른 단계에 입력돼, 같은 회사를 양쪽에 잘못 넣어도(예: 우선수익자
   칸에 채무자를 복사) 그 충돌을 짚어 줄 신호가 전무했다 — 별첨2 채무자 표·우선수익자 표는 입력한
   대로 양쪽에 박힐 뿐이다. 위탁자=우선수익자(497bfda)·신탁기간 vs 체결일(2eddf65) advisory 와
   동형의 "막지 않는 되짚음"으로, 두 당사자의 이미 입력된 식별자(사업자번호·법인등록번호, 없으면
   이름)를 samePartyReason 으로 순수 비교해 부드럽게 확인을 권한다.

   ★채무자=위탁자(동일·debtorSameAsTrustor=true)인 경우는 기존 trustorMatch advisory 가 같은 충돌을
   이미 덮으므로(채무자가 곧 위탁자) 별도 입력(false)일 때만 본다 — 중복 표출 회피.

   핵심 불변식:
     - ★표시 전용 — 게이트(validate)·빌더(builders.js)·조문 무접촉(차단 아님). 같은 회사를 양쪽에
       넣는 것이 정당한 드문 경우의 사용자 선택을 보존한다(등치 강제·차단 아님).
     - samePartyReason(a,b) 재사용 — 새 상태/모델/엔진/조문 무접촉인 순수 함수(공통 완비된 가장 강한
       식별자 한 가지만 비교).
     - debtorSameAsTrustor=true 면 미표출(trustorMatch 가 덮음·중복 회피).
     - role=status·aria-live=polite(동적 출현 SR 고지) + 선두 ⚠ 글리프 aria-hidden(접근명 오염 0).
     - 기존 클래스(field-hint) 재사용 + 인라인 style 만 — 새 CSS 0.
     - 색 = var(--c-brown) 토큰(차단 적색 var(--c-danger) 아님 — 검토 신호·기존 advisory 동형).

   단언:
     (A) 표출 조건 로직 — debtorSameAsTrustor=true 면 미표출, false 면 채무자 순회로 일치 시 표출
         (samePartyReason 순수 동작 재사용·식별자 우선순위)
     (B) StepPriority 배선 — debtorMatch 계산·debtorSameAsTrustor 게이트·debtors 순회·문구·role=status·
         aria-hidden 글리프·field-hint·brown·차단 적색 미사용
     (C) 무회귀 — 기존 trustorMatch advisory·우선수익자 카드 배선 보존
     (D) 무접촉 — validate/builders 에 advisory 문구 미혼입·새 CSS 0

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-priority-debtor-same-party-advisory.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { samePartyReason } from "../src/lib/engine/calc.ts";
import { blankParty } from "../src/lib/engine/model.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const __dir = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(join(__dir, "..", ...p), "utf8");
const parties = read("src", "components", "trust", "steps", "StepParties.tsx");
const calc = read("src", "lib", "engine", "calc.ts");
const validate = read("src", "lib", "engine", "validate.ts");
const builders = read("src", "lib", "engine", "docx", "builders.js");
const globals = read("src", "app", "globals.css");

const mk = (over) => ({ ...blankParty(), ...over });
const withBiz = (name, b1, b2, b3) => mk({ name, bizP1: b1, bizP2: b2, bizP3: b3 });

// 컴포넌트의 발화 로직을 동형으로 재현 — debtorSameAsTrustor 게이트 + debtors 순회 첫 일치.
const debtorMatch = (priority, debtorSameAsTrustor, debtors) =>
  debtorSameAsTrustor
    ? undefined
    : debtors.map((d) => ({ d, reason: samePartyReason(priority, d) })).find((m) => m.reason !== null);

console.log("\n[A] 표출 조건 로직 — debtorSameAsTrustor 게이트 + 채무자 순회 일치(samePartyReason 재사용)");
{
  const prio = withBiz("행복은행", "123", "45", "67890");
  const dupDebtor = withBiz("행복개발", "123", "45", "67890"); // 이름 달라도 같은 사업자번호
  // ★게이트: 채무자=위탁자(동일)면 별도 채무자 목록을 보지 않음(trustorMatch 가 덮음·중복 회피)
  ok(debtorMatch(prio, true, [dupDebtor]) === undefined,
     "debtorSameAsTrustor=true → 미표출(채무자=위탁자라 trustorMatch 가 이미 덮음·중복 회피)");
  // 별도 입력(false): 우선수익자와 같은 식별자의 채무자가 있으면 표출
  ok(debtorMatch(prio, false, [dupDebtor])?.reason === "사업자번호",
     "별도 입력 + 채무자 사업자번호 일치 → '사업자번호'(이름 달라도 동일 주체 확정)");
  ok(debtorMatch(prio, false, [withBiz("행복개발", "999", "88", "77777")]) === undefined,
     "★별도 입력 + 채무자 사업자번호 불일치 → 미표출(다른 주체 확정·이름 우연 일치 무시)");
  ok(debtorMatch(mk({ name: "행복은행" }), false, [mk({ name: "행복은행" })])?.reason === "이름",
     "식별자 미완비 + 이름 일치 → '이름' 폴백(약한 신호)");
  ok(debtorMatch(prio, false, [withBiz("튼튼건설", "111", "22", "33333"), dupDebtor])?.reason === "사업자번호",
     "여러 채무자 중 첫 일치(reason!==null)만 표출(나그 방지)");
  ok(debtorMatch(prio, false, [blankParty()]) === undefined,
     "빈 채무자(기본 debtors=[blankParty()]) → 미표출(나그·오탐 방지)");
  ok(debtorMatch(prio, false, []) === undefined,
     "채무자 목록 비어도 무크래시·미표출");
}

console.log("\n[B] StepPriority 배선 — debtorMatch 계산·게이트·debtors 순회·문구·role=status·글리프·brown");
{
  ok(/const debtorMatch = form\.debtorSameAsTrustor\s*\n?\s*\?\s*undefined/.test(parties),
     "debtorSameAsTrustor=true 면 debtorMatch=undefined(게이트=중복 회피)");
  ok(/form\.debtors\s*\n?\s*\.map\(\(d\)\s*=>\s*\(\{\s*d,\s*reason:\s*samePartyReason\(p,\s*d\)\s*\}\)\)/.test(parties)
     || /\.map\(\(d\)\s*=>\s*\(\{\s*d,\s*reason:\s*samePartyReason\(p,\s*d\)/.test(parties),
     "별도 입력 시 각 우선수익자 p 를 모든 채무자 d 와 samePartyReason 으로 비교");
  ok(/\.find\(\(m\)\s*=>\s*m\.reason\s*!==\s*null\)/.test(parties),
     "첫 일치 채무자(reason !== null)만 골라 advisory 표출(나그 방지)");
  ok(/이 우선수익자가 채무자/.test(parties),
     "advisory 본문 = 이 우선수익자가 채무자와 동일 식별자임을 되짚음");
  ok(/채무자\(피담보채무를 지는 자\)와 우선수익자\(채권자\)는 통상 다른 당사자입니다\. 확인하세요\./.test(parties),
     "막지 않고(차단 아님) 구조적 반대 당사자임을 안내하며 확인 권유(사용자 선택 보존)");
  ok(/같은 \{debtorMatch\.reason\}입니다/.test(parties),
     "일치 근거(사업자번호·법인등록번호·이름)를 '같은 {근거}입니다'로 표기(조사 분기 없이 문법 정합)");
  // debtorMatch advisory 블록 단독 검사(trustorMatch 블록과 구분)
  const idx = parties.indexOf("{debtorMatch && (");
  ok(idx !== -1, "debtorMatch advisory 블록 존재");
  const adv = parties.slice(idx, idx + 700);
  ok(/role="status"\s+aria-live="polite"/.test(adv),
     "role=status·aria-live=polite(동적 출현 SR 고지)");
  ok(/<span aria-hidden="true">⚠ <\/span>/.test(adv),
     "선두 ⚠ 글리프 aria-hidden(장식 글리프 접근명 오염 0)");
  ok(/className="field-hint"/.test(adv),
     "field-hint 기존 클래스 재사용(새 클래스 0)");
  ok(adv.includes("var(--c-brown)"),
     "advisory 색 = var(--c-brown) 토큰(차단 적색 아님·기존 advisory 동형)");
  ok(!adv.includes("var(--c-danger)"),
     "advisory 는 차단 적색(var(--c-danger)) 미사용 — 검토 신호일 뿐 차단 아님");
}

console.log("\n[C] 무회귀 — 기존 trustorMatch advisory·우선수익자 카드 배선 보존");
{
  ok(/const trustorMatch = form\.trustors/.test(parties),
     "위탁자=우선수익자 advisory(trustorMatch) 보존");
  ok(/담보신탁에서 위탁자\(담보제공자\)와 우선수익자\(채권자\)는 통상 다른 당사자입니다/.test(parties),
     "위탁자 advisory 본문 보존(공존·중복 아님 — debtorSameAsTrustor 게이트로 분리)");
  ok(/role="priorities"/.test(parties) && /showLoanFields/.test(parties),
     "우선수익자 PartyCard(role=priorities·showLoanFields) 보존");
  ok(/rankNote=\{i === 0 \? `\$\{priorityRankLabel\(i\)\} · 최선순위` : priorityRankLabel\(i\)\}/.test(parties),
     "우선수익자 순위 라벨(최선순위·priorityRankLabel) 보존");
  ok(/addParty\("priorities"\)/.test(parties),
     "우선수익자 추가 버튼(addParty) 보존");
  ok(/export function samePartyReason\(/.test(calc),
     "samePartyReason 가 calc 에 존재(가드 의존 계약 보존)");
}

console.log("\n[D] 무접촉 — validate/builders 에 advisory 문구 미혼입·새 CSS 0");
{
  const phrase = /채무자\(피담보채무를 지는 자\)와 우선수익자\(채권자\)는 통상 다른 당사자입니다/;
  ok(!phrase.test(validate),
     "validate.ts(게이트)에 advisory 문구 미혼입 — 차단/검증 대상 아님(표시 전용)");
  ok(!phrase.test(builders),
     "builders.js(산출물)에 advisory 문구 미혼입 — 조문·표 미변경(표시 전용)");
  ok(!/debtor-same-party|priority-debtor/.test(globals),
     "globals.css 에 advisory 전용 새 클래스 0(field-hint 재사용)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
