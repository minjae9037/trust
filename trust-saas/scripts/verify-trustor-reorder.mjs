/* ============================================================
   회귀 가드 — 위탁자 순서 변경(▲▼) + "대표위탁자" 라벨

   배경: 담보신탁에서 위탁자(trustors) 배열의 "첫 번째"(idx 0)는 곧 대표위탁자다.
   산출물에서 별첨4 신탁특약은 첫 위탁자를 "대표위탁자"로 선임해 위탁자 전원을 대리하여
   신탁해지를 포함한 일체의 권한을 행사하게 하고(builders.js representativeTrustor =
   trustors[0]·annex.ts getAnnex4Options 동일), 관계사 표·날인·파일명도 배열 순서를
   따른다. 즉 위탁자 배열 순서 = 대표위탁자 결정이라는 큰 법적 효력을 가진다.
   그런데 입력 UI(StepParties)는 위탁자 카드를 "위탁자 1/2" 순번으로만 보여줄 뿐
   ① 첫 카드가 대표위탁자임을 알리지 않고 ② 순서를 바꿀 수단이 전무해(삭제 후 재입력만),
   대표위탁자를 잘못 넣으면 통째로 다시 입력해야 했다. 이 갭을 마감한다.
   (우선수익자 순서 변경 verify-priority-reorder 의 위탁자 평행 — 같은 인프라 재사용.)

   핵심 불변식:
     - 위탁자 배열 순서가 곧 대표위탁자를 결정한다(빌더·별첨4 조문이 trustors[0]).
       → moveInArray 로 첫 위탁자를 바꾸면 대표위탁자가 바뀐다(behavioral).
     - trustorRankLabel 은 idx 0 에만 "대표위탁자", 그 외는 빈 문자열(배지 미표시).
     - 순서 변경은 순서가 법적 의미를 갖는 역할(위탁자·우선수익자)에만 노출,
       채무자/수익자엔 미적용. 위탁자 ▲▼ 문구는 선·후순위가 아니라 대표위탁자 기준.

   단언:
     (A) 법적 근거(불변식) — 빌더/별첨이 trustors[0] 를 대표위탁자로 사용·조문 verbatim 근거
     (B) trustorRankLabel — idx 0 = 대표위탁자·그 외 빈 문자열
     (C) behavioral — moveInArray 로 첫 위탁자 교체 시 대표위탁자(=arr[0].name) 변경·순수 불변
     (D) StepParties 배선(정적) — import·위탁자 orderable/count/rankNote·대표위탁자 안내문·역할별 문구
     (E) PartyCard 배선(정적) — orderNoun/moveUpHint/moveDownHint props·기본값·문구 사용
     (F) 무회귀 — 우선수익자 순서 변경·party 액션 보존

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-trustor-reorder.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { moveInArray } from "../src/lib/engine/model.ts";
import { trustorRankLabel } from "../src/lib/engine/calc.ts";

const __dir = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(__dir, "..", p), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

console.log("\n[A] 법적 근거(불변식) — 빌더/별첨이 trustors[0] 를 대표위탁자로 사용");
{
  const builders = src("src/lib/engine/docx/builders.js");
  const annex = src("src/lib/engine/annex.ts");
  // 첫 위탁자가 대표위탁자로 치환됨 — 배열 순서가 법적 효력을 갖는 근거.
  ok(/representativeTrustor:\s*\(state\.form\.trustors\[0\]\s*&&\s*state\.form\.trustors\[0\]\.name\)/.test(builders),
    "builders.js: representativeTrustor = trustors[0].name (첫 위탁자)");
  ok(/representativeTrustor:\s*form\.trustors\[0\]\?\.name/.test(annex),
    "annex.ts: representativeTrustor = trustors[0].name (첫 위탁자)");
  ok(/\{\{REPRESENTATIVE_TRUSTOR\}\}/.test(builders),
    "builders.js: 별첨4 치환자 {{REPRESENTATIVE_TRUSTOR}} 존재");
  // 별첨4 조문 verbatim 근거 — 대표위탁자가 위탁자 전원을 대리.
  ok(/대표위탁자[\s\S]{0,30}위탁자 전원을 대리/.test(builders),
    "builders.js: 별첨4 조문 — 대표위탁자가 위탁자 전원을 대리(verbatim 근거)");
  // 파일명도 trustors[0] 순서를 따른다(표시 순서 정합).
  ok(/f\.trustors\[0\]\s*&&\s*f\.trustors\[0\]\.name/.test(builders),
    "builders.js: 파일명도 trustors[0] 순서 사용");
}

console.log("\n[B] trustorRankLabel — idx 0 = 대표위탁자·그 외 빈 문자열");
{
  ok(trustorRankLabel(0) === "대표위탁자", "idx 0 → 대표위탁자");
  ok(trustorRankLabel(1) === "", "idx 1 → 빈 문자열(배지 미표시)");
  ok(trustorRankLabel(3) === "", "idx 3 → 빈 문자열(배지 미표시)");
}

console.log("\n[C] behavioral — 순서 교체 시 대표위탁자(arr[0]) 변경·순수 불변");
{
  // 빌더의 대표위탁자 산정과 동일한 규칙: 배열 첫 요소의 이름.
  const repOf = (arr) => (arr[0] && arr[0].name) || "[대표위탁자]";
  const trustors = [{ name: "갑개발" }, { name: "을산업" }, { name: "병건설" }];
  ok(repOf(trustors) === "갑개발", "초기 대표위탁자 = 첫 위탁자(갑개발)");
  // 첫 위탁자를 아래로 내리면 대표위탁자가 바뀐다.
  const moved = moveInArray(trustors, 0, 1);
  ok(repOf(moved) === "을산업", "첫 위탁자 ▼ 이동 시 대표위탁자 = 을산업(순서가 대표 결정)");
  ok(moved !== trustors, "변경 시 새 배열 반환(복제)");
  ok(repOf(trustors) === "갑개발", "입력 배열 무변형(순수) — 원본 대표위탁자 보존");
  // 둘째를 위로 올려도 동일 결과(대칭).
  const moved2 = moveInArray(trustors, 1, -1);
  ok(repOf(moved2) === "을산업", "둘째 위탁자 ▲ 이동도 대표위탁자 = 을산업");
  // 경계: 맨 위에서 ▲ = no-op → 대표 불변.
  ok(moveInArray(trustors, 0, -1) === trustors, "맨 위 위탁자 ▲ → no-op(동일 참조)");
}

console.log("\n[D] StepParties 배선(정적) — 위탁자 orderable·대표위탁자 라벨·안내문·역할별 문구");
{
  const sp = src("src/components/trust/steps/StepParties.tsx");
  ok(/import\s*{[^}]*\btrustorRankLabel\b[^}]*}\s*from\s*"@\/lib\/engine\/calc"/.test(sp),
    "trustorRankLabel 를 calc 에서 import");
  // 위탁자 카드 블록에 orderable·count·rankNote 전달.
  ok(/role="trustors"[\s\S]*?orderable[\s\S]*?count=\{form\.trustors\.length\}/.test(sp),
    "위탁자 카드에 orderable·count 전달");
  ok(/rankNote=\{form\.trustors\.length\s*>\s*1\s*\?\s*trustorRankLabel\(i\)/.test(sp),
    "rankNote 가 trustorRankLabel(i) 기반(복수일 때만)");
  // 위탁자는 선·후순위가 아니라 대표위탁자 기준 문구.
  ok(/role="trustors"[\s\S]*?orderNoun="순서"/.test(sp), "위탁자 orderNoun=\"순서\"(순위 아님)");
  ok(/role="trustors"[\s\S]*?moveUpHint="대표위탁자 쪽으로"/.test(sp), "위탁자 moveUpHint=대표위탁자 쪽으로");
  // 대표위탁자 안내문(복수 위탁자일 때만).
  ok(/form\.trustors\.length\s*>\s*1\s*&&[\s\S]*?대표위탁자/.test(sp), "복수 위탁자일 때 대표위탁자 안내문 노출");
  ok(/별첨4/.test(sp), "안내문에 별첨4 근거 명시");
}

console.log("\n[E] PartyCard 배선(정적) — 역할별 순서 문구 props·기본값·사용");
{
  const pc = src("src/components/trust/steps/PartyCard.tsx");
  ok(/orderNoun\?:\s*string/.test(pc) && /moveUpHint\?:\s*string/.test(pc) && /moveDownHint\?:\s*string/.test(pc),
    "orderNoun/moveUpHint/moveDownHint props 선언");
  // 우선수익자 무변경 보장: 기본값이 선·후순위.
  ok(/orderNoun\s*=\s*"순위"/.test(pc) && /moveUpHint\s*=\s*"선순위로"/.test(pc) && /moveDownHint\s*=\s*"후순위로"/.test(pc),
    "기본값 = 순위/선순위로/후순위로(우선수익자 무변경)");
  // 그룹·버튼 문구가 props 를 사용.
  ok(/aria-label=\{`\$\{label\} \$\{idx \+ 1\} \$\{orderNoun\} 변경`\}/.test(pc), "그룹 aria-label 이 orderNoun 사용");
  ok(/aria-label=\{`[^`]*위로 이동\(\$\{moveUpHint\}\)`\}/.test(pc), "▲ aria-label 이 moveUpHint 사용");
  ok(/aria-label=\{`[^`]*아래로 이동\(\$\{moveDownHint\}\)`\}/.test(pc), "▼ aria-label 이 moveDownHint 사용");
  ok(/title=\{`위로 이동 — \$\{moveUpHint\}`\}/.test(pc), "▲ title 이 moveUpHint 사용");
}

console.log("\n[F] 무회귀 — 우선수익자 순서 변경·party 액션 보존");
{
  const sp = src("src/components/trust/steps/StepParties.tsx");
  // 우선수익자 측 배선 보존(verify-priority-reorder 와 정합).
  ok(/role="priorities"[\s\S]*?orderable[\s\S]*?count=\{form\.priorities\.length\}/.test(sp), "우선수익자 orderable·count 보존");
  ok(/priorityRankLabel\(i\)/.test(sp), "우선수익자 priorityRankLabel 보존");
  // orderable 은 정확히 2회(위탁자+우선수익자)만 — 채무자/수익자 미적용.
  ok((sp.match(/orderable/g) || []).length === 2, "orderable 2회(위탁자·우선수익자) — 채무자/수익자 미적용");
  const store = src("src/lib/store/contractStore.ts");
  ok(/moveParty:\s*\(role,\s*idx,\s*dir\)\s*=>/.test(store), "store moveParty 보존(role 제네릭)");
  ok(/role\s*===\s*"priorities"\s*\?\s*withRecalc\(next\)\s*:\s*next/.test(store),
    "위탁자 이동은 재계산 없이 순서만(priorities 만 withRecalc)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
