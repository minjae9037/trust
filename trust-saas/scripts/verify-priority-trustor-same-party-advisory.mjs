/* ============================================================
   회귀 가드 — 우선수익자 = 위탁자(동일 당사자) 입력 지점 구조 정합 교차검증 advisory

   배경: 담보신탁에서 위탁자(담보제공자·부동산 소유자/채무자측)와 우선수익자(채권자·대주)는
   구조적으로 반대편 당사자라 동일 법적 주체일 수 없다(자기 부동산을 자기에게 담보로 잡는 구조는
   성립 불가). 그런데 위탁자는 STEP 02(관계사)에서, 우선수익자는 STEP 02-1 에서 서로 다른 단계에
   입력돼, 같은 회사를 양쪽에 잘못 넣어도(예: 우선수익자 칸에 위탁자를 복사) 그 충돌을 짚어 줄
   신호가 전무했다 — 관계사 표·별첨 표는 입력한 대로 양쪽에 박힐 뿐이다. StepLoanCalc 한도합계 vs
   평가가격·StepBasic 보수율 100% 초과 advisory 와 동형의 "막지 않는 되짚음"으로, 두 당사자의
   이미 입력된 식별자(사업자번호·법인등록번호, 없으면 이름)를 순수 비교해 부드럽게 확인을 권한다.

   핵심 불변식:
     - ★표시 전용 — 게이트(validate)·빌더(builders.js)·조문 무접촉(차단 아님). 같은 회사를 양쪽에
       넣는 것이 정당한 드문 경우의 사용자 선택을 보존한다(등치 강제·차단 아님).
     - samePartyReason(a,b) 는 새 상태/모델/엔진/조문 무접촉인 순수 함수 — 두 Party 의 이미 입력된
       식별자만 비교한다. 오탐 방지를 위해 공통으로 완비된 가장 강한 식별자 한 가지만 본다:
         ① 둘 다 사업자번호(10자리) 완비 → 일치/불일치로 단정(다르면 이름 우연 일치 무시).
         ② 아니고 둘 다 법인등록번호(13자리) 완비 → 그 번호로 단정.
         ③ 어느 식별자도 양쪽 완비 아님 → 이름(trim·비어있지 않음) 일치로만 판단(약한 신호).
     - role=status·aria-live=polite(동적 출현 SR 고지) + 선두 ⚠ 글리프 aria-hidden(접근명 오염 0).
     - 기존 클래스(field-hint) 재사용 + 인라인 style 만 — 새 CSS 0.
     - 색 = var(--c-brown) 토큰(차단 적색 var(--c-danger) 아님 — 검토 신호·기존 advisory 동형).

   단언:
     (A) samePartyReason 순수 동작 — 사업자번호 우선·일치/불일치, 법인등록번호 차선, 이름 폴백,
         식별자 양쪽 완비 후 불일치면 이름 같아도 null, 빈/부분 입력 안전
     (B) StepParties(StepPriority) 배선 — import·Fragment·trustors 순회·advisory 문구·role=status·
         aria-hidden 글리프·field-hint·brown·차단 적색 미사용
     (C) 무회귀 — 기존 우선수익자 카드 배선(orderable/count/rankNote/최선순위·addParty) 보존
     (D) 무접촉 — validate/builders 에 advisory 문구 미혼입·새 CSS 0

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-priority-trustor-same-party-advisory.mjs
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

// 테스트용 Party 빌더 — blankParty 기반으로 식별자만 덮어쓴다(다른 필드는 기본값 보존).
const mk = (over) => ({ ...blankParty(), ...over });
const withBiz = (name, b1, b2, b3) => mk({ name, bizP1: b1, bizP2: b2, bizP3: b3 });
const withCorp = (name, f, b) => mk({ name, corpRegFront: f, corpRegBack: b });

console.log("\n[A] samePartyReason 순수 동작 — 식별자 우선순위·일치/불일치·이름 폴백·안전");
{
  // 사업자번호 우선(둘 다 10자리 완비)
  ok(samePartyReason(withBiz("갑", "123", "45", "67890"), withBiz("을", "123", "45", "67890")) === "사업자번호",
     "사업자번호 둘 다 완비·일치 → '사업자번호'(이름 달라도 동일 주체)");
  ok(samePartyReason(withBiz("갑", "123", "45", "67890"), withBiz("갑", "999", "88", "77777")) === null,
     "★사업자번호 둘 다 완비·불일치 → null(이름이 같아도 다른 주체로 확정)");
  // 법인등록번호 차선(사업자번호가 양쪽 완비 아닐 때)
  ok(samePartyReason(withCorp("갑", "110111", "1234567"), withCorp("을", "110111", "1234567")) === "법인등록번호",
     "사업자번호 미완비 + 법인등록번호 둘 다 완비·일치 → '법인등록번호'");
  ok(samePartyReason(withCorp("갑", "110111", "1234567"), withCorp("갑", "220222", "7654321")) === null,
     "★법인등록번호 둘 다 완비·불일치 → null(이름 같아도 다른 주체)");
  // 이름 폴백(어느 식별자도 양쪽 완비 아님)
  ok(samePartyReason(mk({ name: "행복개발" }), mk({ name: "행복개발" })) === "이름",
     "식별자 미완비 + 이름 일치 → '이름'(약한 신호)");
  ok(samePartyReason(mk({ name: " 행복개발 " }), mk({ name: "행복개발" })) === "이름",
     "이름 비교는 trim(앞뒤 공백 무시)");
  ok(samePartyReason(mk({ name: "행복개발" }), mk({ name: "튼튼건설" })) === null,
     "식별자 미완비 + 이름 불일치 → null");
  // 한쪽만 식별자 완비 → 그 식별자 쌍 비교 불가 → 이름 폴백
  ok(samePartyReason(withBiz("갑", "123", "45", "67890"), mk({ name: "갑" })) === "이름",
     "한쪽만 사업자번호 완비(쌍 비교 불가) → 이름 폴백으로 일치 판단");
  // 빈/부분 입력 안전(무크래시·미일치)
  ok(samePartyReason(blankParty(), blankParty()) === null,
     "빈 당사자 둘(이름·식별자 전부 공백) → null(나그·오탐 방지)");
  ok(samePartyReason(withBiz("갑", "12", "45", "67890"), withBiz("갑", "12", "45", "67890")) === "이름",
     "사업자번호 부분 입력(10자리 미만)은 미완비로 보고 이름 폴백");
  ok((() => { try { samePartyReason(mk({ name: null }), mk({ name: undefined })); return true; } catch { return false; } })(),
     "name 이 null/undefined 여도 무크래시");
}

console.log("\n[B] StepPriority 배선 — import·Fragment·trustors 순회·문구·role=status·글리프·brown");
{
  ok(/import\s*{[^}]*\bsamePartyReason\b[^}]*}\s*from\s*"@\/lib\/engine\/calc"/.test(parties),
     "samePartyReason 를 calc 에서 import");
  ok(/import\s*{\s*Fragment\s*}\s*from\s*"react"/.test(parties),
     "Fragment 를 react 에서 import(래퍼 DOM 노드 없이 카드+advisory 형제 렌더)");
  ok(/form\.trustors\s*\n?\s*\.map\(\(t\)\s*=>\s*\(\{\s*t,\s*reason:\s*samePartyReason\(p,\s*t\)\s*\}\)\)/.test(parties)
     || /\.map\(\(t\)\s*=>\s*\(\{\s*t,\s*reason:\s*samePartyReason\(p,\s*t\)/.test(parties),
     "각 우선수익자 p 를 모든 위탁자 t 와 samePartyReason 으로 비교");
  ok(/\.find\(\(m\)\s*=>\s*m\.reason\s*!==\s*null\)/.test(parties),
     "첫 일치 위탁자(reason !== null)만 골라 advisory 표출(나그 방지)");
  ok(/<Fragment key=\{i\}>/.test(parties),
     "key 를 Fragment 로 이동(카드 래핑으로 인한 레이아웃 변화 0 — DOM 노드 미추가)");
  // advisory 본문 — 동일 근거 + 구조 설명 + 확인 권유(차단 아님)
  ok(/이 우선수익자가 위탁자/.test(parties),
     "advisory 본문 = 이 우선수익자가 위탁자와 동일 식별자임을 되짚음");
  ok(/담보신탁에서 위탁자\(담보제공자\)와 우선수익자\(채권자\)는 통상 다른 당사자입니다\. 확인하세요\./.test(parties),
     "막지 않고(차단 아님) 구조적 반대 당사자임을 안내하며 확인 권유(사용자 선택 보존)");
  ok(/같은 \{trustorMatch\.reason\}입니다/.test(parties),
     "일치 근거(사업자번호·법인등록번호·이름)를 '같은 {근거}입니다'로 표기(조사 분기 없이 문법 정합)");
  const adv = parties.slice(parties.indexOf("{trustorMatch && ("));
  ok(/role="status"\s+aria-live="polite"/.test(adv.slice(0, 700)),
     "role=status·aria-live=polite(동적 출현 SR 고지)");
  ok(/<span aria-hidden="true">⚠ <\/span>/.test(adv.slice(0, 700)),
     "선두 ⚠ 글리프 aria-hidden(장식 글리프 접근명 오염 0)");
  ok(/className="field-hint"/.test(adv.slice(0, 700)),
     "field-hint 기존 클래스 재사용(새 클래스 0)");
  ok(adv.slice(0, 700).includes("var(--c-brown)"),
     "advisory 색 = var(--c-brown) 토큰(차단 적색 아님·기존 advisory 동형)");
  ok(!adv.slice(0, 700).includes("var(--c-danger)"),
     "advisory 는 차단 적색(var(--c-danger)) 미사용 — 검토 신호일 뿐 차단 아님");
}

console.log("\n[C] 무회귀 — 기존 우선수익자 카드 배선 보존");
{
  ok(/role="priorities"/.test(parties) && /showLoanFields/.test(parties),
     "우선수익자 PartyCard(role=priorities·showLoanFields) 보존");
  ok(/orderable\s*\n?\s*count=\{form\.priorities\.length\}/.test(parties) || /count=\{form\.priorities\.length\}/.test(parties),
     "우선수익자 순서 변경(orderable·count) 보존");
  ok(/rankNote=\{i === 0 \? `\$\{priorityRankLabel\(i\)\} · 최선순위` : priorityRankLabel\(i\)\}/.test(parties),
     "우선수익자 순위 라벨(최선순위·priorityRankLabel) 보존");
  ok(/addParty\("priorities"\)/.test(parties),
     "우선수익자 추가 버튼(addParty) 보존");
  ok(/export function samePartyReason\(/.test(calc),
     "samePartyReason 가 calc 에 존재(가드 의존 계약 보존)");
}

console.log("\n[D] 무접촉 — validate/builders 에 advisory 문구 미혼입·새 CSS 0");
{
  const phrase = /위탁자\(담보제공자\)와 우선수익자\(채권자\)는 통상 다른 당사자입니다/;
  ok(!phrase.test(validate),
     "validate.ts(게이트)에 advisory 문구 미혼입 — 차단/검증 대상 아님(표시 전용)");
  ok(!phrase.test(builders),
     "builders.js(산출물)에 advisory 문구 미혼입 — 조문·표 미변경(표시 전용)");
  ok(!/same-party|samePartyReason|same-trustor/.test(globals),
     "globals.css 에 advisory 전용 새 클래스 0(field-hint 재사용)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
