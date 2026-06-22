/* ============================================================
   회귀 가드 — 카드 삭제(✕) 후 포커스 이동 (WCAG 2.4.3 Focus Order)

   배경(a11y, 비-산출물·표시/포커스 경계만): 위저드의 당사자(PartyCard)·신탁
   부동산(StepProperty) 카드는 삭제 버튼(✕)을 누르면 그 카드가 언마운트되며
   포커스가 사라진 버튼과 함께 document.body 로 복귀했다 → 키보드/스크린리더
   사용자가 목록 안 위치를 잃고 처음부터 다시 탐색. Wizard 단계 이동(bf2eef0)·
   advisor 피드백(b84eff7)에서 마감해 온 포커스 유실 갭의 "목록 삭제" 버전으로,
   13:00 워크로그가 다음스텝으로 명시한 항목.

   해결: 공용 훅 useFocusAfterRemove(length) 가 삭제 직후 같은 그룹의 항상
   존재하는 "+ 추가" 버튼(party-add-btn)으로 포커스를 옮긴다. ★삭제로 카드가
   2→1 이 되면 남은 단일 카드는 removable=false 라 삭제 버튼이 사라지므로(카드 간
   인덱싱 타깃 소멸), 카드 수와 무관하게 늘 present 한 추가 버튼이 보편 타깃이다.
   markRemoved() 가 삭제 클릭에서 '대기' 표식만 세우고, 길이 변화 리렌더 뒤 effect
   가 1회 포커스를 옮긴다(추가/마운트 시 무동작=가로채기 0). 키보드 삭제일 때만
   :focus-visible 로 링 표시(마우스 시 무표시=시각 무변경).

   핵심 불변식:
     (A) 훅 = addBtnRef(useRef) + markRemoved + useEffect 의존성 [length] +
         pending 가드(추가/마운트 가로채기 0)·1회성(focus 후 false).
     (B) PartyCard = afterRemove prop·삭제 onClick 이 removeParty 후 afterRemove?.().
     (C) StepParties = 훅 3개(trustor/debtor/bene)·각 그룹 afterRemove 전달·
         추가 버튼 ref+type=button+party-add-btn.
     (D) StepPriority = 훅 prioFocus·afterRemove·추가 버튼 배선.
     (E) StepProperty = 훅 propFocus(properties.length)·삭제 onClick removeProperty
         후 markRemoved·추가 버튼 배선.
     (F) globals.css = .party-add-btn:focus-visible 포커스 링.
     (G) 무회귀 = removeParty/removeProperty 호출 보존·party-add-btn 총 5곳·
         삭제/추가 로직(store) 무접촉.

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-card-delete-focus.mjs
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
const rd = (...p) => readFileSync(path.join(root, ...p), "utf8");
const hook = rd("src", "lib", "ui", "use-focus-after-remove.ts");
const party = rd("src", "components", "trust", "steps", "PartyCard.tsx");
const parties = rd("src", "components", "trust", "steps", "StepParties.tsx");
const prop = rd("src", "components", "trust", "steps", "StepProperty.tsx");
const css = rd("src", "app", "globals.css");

const count = (src, re) => (src.match(re) || []).length;

console.log("\n[A] useFocusAfterRemove 훅 — 1회성 포커스 이동·가로채기 0");
{
  ok(/export function useFocusAfterRemove\(length: number\)/.test(hook), "useFocusAfterRemove(length) export");
  ok(/const addBtnRef = useRef<HTMLButtonElement>\(null\)/.test(hook), "addBtnRef = useRef<HTMLButtonElement>");
  ok(/const pending = useRef\(false\)/.test(hook), "pending = useRef(false) (대기 표식)");
  ok(/useEffect\(\(\) => \{[\s\S]*?\}, \[length\]\)/.test(hook), "useEffect 의존성 [length] (길이 변화 시 동작)");
  // effect 내부: pending 가드가 focus 보다 앞 + 1회성(false) + addBtnRef focus
  const eff = hook.slice(hook.indexOf("useEffect"), hook.indexOf("}, [length]"));
  ok(/if \(pending\.current\)/.test(eff), "effect 가 pending.current 로 가드(추가/마운트 가로채기 0)");
  ok(eff.indexOf("pending.current = false") < eff.indexOf("addBtnRef.current?.focus()") &&
     /pending\.current = false/.test(eff), "1회성=focus 전 pending false 로 비움");
  ok(/addBtnRef\.current\?\.focus\(\)/.test(eff), "addBtnRef.current?.focus() 로 추가 버튼 포커스");
  ok(/const markRemoved = \(\) => \{\s*pending\.current = true/.test(hook), "markRemoved() 가 pending true 만 세움(삭제 클릭 동기)");
  ok(/return \{ addBtnRef, markRemoved \}/.test(hook), "{ addBtnRef, markRemoved } 반환");
}

console.log("\n[B] PartyCard — afterRemove prop·삭제 직후 호출");
{
  ok(/afterRemove\?: \(\) => void;/.test(party), "afterRemove?: () => void prop 선언");
  ok(/\n  afterRemove,\n\}: Props\)/.test(party), "afterRemove 구조분해(props)");
  ok(/onClick=\{\(\) => \{ removeParty\(role, idx\); afterRemove\?\.\(\); \}\}/.test(party),
    "삭제 onClick = removeParty 후 afterRemove?.() (순서·옵셔널)");
  ok(/removeParty\(role, idx\)/.test(party), "removeParty 호출 보존(무회귀)");
}

console.log("\n[C] StepParties — 그룹별 훅·afterRemove·추가 버튼 배선");
{
  ok(/import \{ useFocusAfterRemove \} from "@\/lib\/ui\/use-focus-after-remove"/.test(parties), "훅 import");
  ok(/const trustorFocus = useFocusAfterRemove\(form\.trustors\.length\)/.test(parties), "trustorFocus(trustors.length)");
  ok(/const debtorFocus = useFocusAfterRemove\(form\.debtors\.length\)/.test(parties), "debtorFocus(debtors.length)");
  ok(/const beneFocus = useFocusAfterRemove\(form\.beneficiaries\.length\)/.test(parties), "beneFocus(beneficiaries.length)");
  ok(/afterRemove=\{trustorFocus\.markRemoved\}/.test(parties), "위탁자 PartyCard afterRemove=trustorFocus.markRemoved");
  ok(/afterRemove=\{debtorFocus\.markRemoved\}/.test(parties), "채무자 PartyCard afterRemove=debtorFocus.markRemoved");
  ok(/afterRemove=\{beneFocus\.markRemoved\}/.test(parties), "수익자 PartyCard afterRemove=beneFocus.markRemoved");
  ok(/<button ref=\{trustorFocus\.addBtnRef\} type="button" className="btn btn-ghost btn-sm party-add-btn"/.test(parties),
    "위탁자 추가 버튼 = ref+type=button+party-add-btn");
  ok(/<button ref=\{debtorFocus\.addBtnRef\} type="button" className="btn btn-ghost btn-sm party-add-btn"/.test(parties),
    "채무자 추가 버튼 배선");
  ok(/<button ref=\{beneFocus\.addBtnRef\} type="button" className="btn btn-ghost btn-sm party-add-btn"/.test(parties),
    "수익자 추가 버튼 배선");
}

console.log("\n[D] StepPriority — 우선수익자 훅·배선");
{
  ok(/const prioFocus = useFocusAfterRemove\(form\.priorities\.length\)/.test(parties), "prioFocus(priorities.length)");
  ok(/afterRemove=\{prioFocus\.markRemoved\}/.test(parties), "우선수익자 PartyCard afterRemove=prioFocus.markRemoved");
  ok(/<button ref=\{prioFocus\.addBtnRef\} type="button" className="btn btn-ghost btn-sm party-add-btn"/.test(parties),
    "우선수익자 추가 버튼 배선");
}

console.log("\n[E] StepProperty — 부동산 훅·삭제·추가 배선");
{
  ok(/import \{ useFocusAfterRemove \} from "@\/lib\/ui\/use-focus-after-remove"/.test(prop), "훅 import");
  ok(/const propFocus = useFocusAfterRemove\(form\.properties\.length\)/.test(prop), "propFocus(properties.length)");
  ok(/onClick=\{\(\) => \{ removeProperty\(i\); propFocus\.markRemoved\(\); \}\}/.test(prop),
    "삭제 onClick = removeProperty 후 propFocus.markRemoved()");
  ok(/<button ref=\{propFocus\.addBtnRef\} type="button" className="btn btn-ghost btn-sm party-add-btn"/.test(prop),
    "부동산 추가 버튼 = ref+type=button+party-add-btn");
  ok(/removeProperty\(i\)/.test(prop), "removeProperty 호출 보존(무회귀)");
}

console.log("\n[F] globals.css — 가시 포커스 링(키보드 한정)");
{
  ok(/\.party-add-btn:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--c-brown\)/.test(css),
    ".party-add-btn:focus-visible 포커스 링(file-upload-btn 등 동형 톤)");
  ok(/\.party-add-btn:focus-visible/.test(css) && !/\.party-add-btn:focus\s*\{/.test(css),
    ":focus 가 아니라 :focus-visible (마우스 삭제 시 미표시=시각 무변경)");
}

console.log("\n[G] 무회귀 — party-add-btn 총수·삭제/추가 로직 보존");
{
  // StepParties.tsx 안에 trustor/debtor/bene/prio 4곳 + StepProperty 1곳 = 5
  ok(count(parties, /party-add-btn/g) === 4, "StepParties party-add-btn 4곳(위탁자·채무자·수익자·우선수익자)");
  ok(count(prop, /party-add-btn/g) === 1, "StepProperty party-add-btn 1곳(부동산)");
  ok(count(parties, /afterRemove=\{/g) === 4, "StepParties afterRemove 전달 4곳");
  // 추가 버튼이 onClick(addParty/addProperty) 을 그대로 유지하는지(추가 로직 무접촉)
  ok(/onClick=\{\(\) => addParty\("trustors"\)\}/.test(parties) &&
     /onClick=\{\(\) => addParty\("priorities"\)\}/.test(parties), "addParty onClick 배선 보존");
  ok(/onClick=\{addProperty\}/.test(prop), "addProperty onClick 배선 보존");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
process.exit(fail === 0 ? 0 : 1);
