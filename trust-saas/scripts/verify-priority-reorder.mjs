/* ============================================================
   회귀 가드 — 우선수익자 순위(선·후순위) 순서 변경(▲▼) + 순위 라벨

   배경: 담보신탁에서 우선수익자(priorities) 배열의 순서는 곧 법적 우선순위다.
   산출물은 배열 순서대로 "제N순위 우선수익자"로 표·날인을 박고(builders.js 별첨2·날인),
   본문 제3조(최선순위 우선수익자의 의사가 의사결정을 좌우)·제22조(환가·정산 순위)도
   이 순서를 따른다. 그런데 입력 UI는 카드를 "우선수익자 1/2" 순번으로만 보여줄 뿐
   ① 순서가 법적 선·후순위임을 알리지 않고 ② 순서를 바꿀 수단이 전무해(삭제 후 재입력만 가능),
   순위를 잘못 넣으면 통째로 다시 입력해야 했다. 이 갭을 마감한다.

   핵심 불변식:
     - moveInArray 는 인접 요소만 맞바꾼다(순수·불변, 입력 무변형).
     - 범위를 벗어나면 입력 배열을 동일 참조로 반환 = no-op(상태 변경 없음).
     - 순위 라벨(priorityRankLabel)은 idx 기반 "제N순위" — 산출물 표기 의미와 일치.
     - 순서 변경은 우선수익자에서만 노출(orderable), 경계에서 ▲/▼ 비활성.

   단언:
     (A) moveInArray — 위/아래 교환·경계 no-op·불변(입력 무변형)·복제 반환
     (B) priorityRankLabel — 제1·제2·제N순위(idx 기반)
     (C) store 배선(정적) — moveParty 인터페이스/구현·moveInArray 사용·priorities 재계산·no-op 분기
     (D) PartyCard 배선(정적) — orderable/count/rankNote props·moveParty·▲▼·경계 disabled·aria·배지
     (E) StepPriority 배선(정적) — priorityRankLabel import·orderable/count/rankNote 전달·최선순위·안내문
     (F) 무회귀 — addParty/removeParty/updateParty·removable 보존

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-priority-reorder.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { moveInArray } from "../src/lib/engine/model.ts";
import { priorityRankLabel } from "../src/lib/engine/calc.ts";

const __dir = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(__dir, "..", p), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

console.log("\n[A] moveInArray — 위/아래 교환·경계 no-op·불변");
{
  const a = ["a", "b", "c", "d"];
  // 아래로(+1): idx 1 ↔ 2
  ok(JSON.stringify(moveInArray(a, 1, 1)) === JSON.stringify(["a", "c", "b", "d"]), "아래로(+1) 인접 교환");
  // 위로(-1): idx 2 ↔ 1
  ok(JSON.stringify(moveInArray(a, 2, -1)) === JSON.stringify(["a", "c", "b", "d"]), "위로(-1) 인접 교환");
  // 맨 위에서 위로 = no-op(동일 참조)
  ok(moveInArray(a, 0, -1) === a, "맨 위에서 위로 → 동일 참조(no-op)");
  // 맨 아래에서 아래로 = no-op
  ok(moveInArray(a, 3, 1) === a, "맨 아래에서 아래로 → 동일 참조(no-op)");
  // 잘못된 idx/dir
  ok(moveInArray(a, -1, 1) === a, "음수 idx → no-op");
  ok(moveInArray(a, 5, -1) === a, "범위 초과 idx → no-op");
  ok(moveInArray(a, 1, 2) === a, "잘못된 dir(인접 아님) → no-op");
  ok(moveInArray(a, 1, 0) === a, "dir 0 → no-op");
  // 불변: 입력 배열 무변형
  const before = JSON.stringify(a);
  const out = moveInArray(a, 0, 1);
  ok(JSON.stringify(a) === before, "입력 배열 무변형(순수)");
  ok(out !== a, "변경 시 새 배열 반환(복제)");
  // 요소 동일성 보존(교환만)
  ok(out[0] === a[1] && out[1] === a[0], "교환된 요소 동일성(참조) 보존");
  // 단일 요소 배열 = 항상 no-op(동일 참조)
  const single = ["x"];
  ok(moveInArray(single, 0, 1) === single && moveInArray(single, 0, -1) === single, "단일 요소는 이동 불가(no-op)");
}

console.log("\n[B] priorityRankLabel — idx 기반 제N순위");
{
  ok(priorityRankLabel(0) === "제1순위", "idx 0 → 제1순위(최선순위)");
  ok(priorityRankLabel(1) === "제2순위", "idx 1 → 제2순위");
  ok(priorityRankLabel(4) === "제5순위", "idx 4 → 제5순위");
}

console.log("\n[C] store 배선(정적) — moveParty·moveInArray·priorities 재계산·no-op");
{
  const store = src("src/lib/store/contractStore.ts");
  ok(/import\s*{[^}]*\bmoveInArray\b/s.test(store), "moveInArray 를 model 에서 import");
  ok(/moveParty:\s*\(role:\s*PartyRole,\s*idx:\s*number,\s*dir:\s*number\)\s*=>\s*void/.test(store), "moveParty 인터페이스 선언(role,idx,dir)");
  ok(/moveParty:\s*\(role,\s*idx,\s*dir\)\s*=>/.test(store), "moveParty 구현 정의");
  ok(/moveInArray\(\s*st\.form\[role\],\s*idx,\s*dir\s*\)/.test(store), "moveInArray(st.form[role], idx, dir) 호출");
  ok(/if\s*\(arr\s*===\s*st\.form\[role\]\)\s*return\s*\{\}/.test(store), "범위 밖(동일 참조) → no-op 분기");
  ok(/role\s*===\s*"priorities"\s*\?\s*withRecalc\(next\)\s*:\s*next/.test(store), "priorities 만 재계산(updateParty 와 동일 정책)");
}

console.log("\n[D] PartyCard 배선(정적) — props·moveParty·▲▼·경계 disabled·aria·배지");
{
  const pc = src("src/components/trust/steps/PartyCard.tsx");
  ok(/orderable\?:\s*boolean/.test(pc) && /count\?:\s*number/.test(pc) && /rankNote\?:\s*string/.test(pc), "orderable/count/rankNote props 선언");
  ok(/const\s*{[^}]*\bmoveParty\b[^}]*}\s*=\s*useContractStore\(\)/.test(pc), "moveParty 를 store 에서 구독");
  ok(/const\s+isFirst\s*=\s*idx\s*===\s*0/.test(pc) && /const\s+isLast\s*=\s*idx\s*===\s*total\s*-\s*1/.test(pc), "isFirst/isLast 경계 판정");
  ok(/orderable\s*&&\s*total\s*>\s*1/.test(pc), "orderable && total>1 일 때만 ▲▼ 노출(단일 카드 미노출)");
  ok(/moveParty\(role,\s*idx,\s*-1\)/.test(pc) && /moveParty\(role,\s*idx,\s*1\)/.test(pc), "▲=moveParty(-1)·▼=moveParty(+1)");
  ok(/disabled=\{isFirst\}/.test(pc) && /disabled=\{isLast\}/.test(pc), "경계에서 ▲(첫)·▼(끝) 비활성");
  ok(/aria-label=\{`[^`]*위로 이동[^`]*`\}/.test(pc) && /aria-label=\{`[^`]*아래로 이동[^`]*`\}/.test(pc), "▲▼ aria-label(위/아래 이동)");
  ok(/className="party-rank">\{rankNote\}/.test(pc), "rankNote 순위 배지 렌더");
  ok(/party-move-btn/.test(pc), "party-move-btn 클래스 사용");
}

console.log("\n[E] StepPriority 배선(정적) — import·props 전달·최선순위·안내문");
{
  const sp = src("src/components/trust/steps/StepParties.tsx");
  ok(/import\s*{[^}]*\bpriorityRankLabel\b[^}]*}\s*from\s*"@\/lib\/engine\/calc"/.test(sp), "priorityRankLabel 를 calc 에서 import");
  ok(/role="priorities"[\s\S]*?orderable[\s\S]*?count=\{form\.priorities\.length\}/.test(sp), "우선수익자 카드에 orderable·count 전달");
  ok(/rankNote=\{i\s*===\s*0\s*\?[\s\S]*?priorityRankLabel\(i\)/.test(sp), "rankNote 가 priorityRankLabel(i) 기반");
  ok(/최선순위/.test(sp), "idx 0 = 최선순위 표기");
  ok(/표시 순서가 곧[\s\S]*?법적 우선순위/.test(sp), "순서=법적 우선순위 안내문");
  // 우선수익자에만 적용 — 위탁자/채무자/수익자 카드엔 orderable 미전달(순위 무의미).
  // 파일 전체에서 orderable 은 정확히 1회(우선수익자 PartyCard)만 등장해야 한다.
  ok((sp.match(/orderable/g) || []).length === 1, "orderable 은 우선수익자에만(파일 내 1회) — 위탁자/채무자/수익자 미적용");
}

console.log("\n[F] 무회귀 — 기존 party 액션·removable 보존");
{
  const store = src("src/lib/store/contractStore.ts");
  ok(/addParty:\s*\(role\)\s*=>/.test(store), "addParty 보존");
  ok(/removeParty:\s*\(role,\s*idx\)\s*=>/.test(store), "removeParty 보존");
  ok(/updateParty:\s*\(role,\s*idx,\s*patch\)\s*=>/.test(store), "updateParty 보존");
  const pc = src("src/components/trust/steps/PartyCard.tsx");
  ok(/removeParty\(role,\s*idx\)/.test(pc), "PartyCard 삭제(removeParty) 보존");
  ok(/removable\s*&&/.test(pc), "removable 분기 보존");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
