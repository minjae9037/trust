/* ============================================================
   회귀 가드 — 모바일(<980px) 진행단계 가로 스크롤 레일 계약

   배경(반응형 UX·비-산출물·표시 경계만):
   데스크톱 stepper(좌측 세로 사이드바)는 12단계 전체 위치·단계별 준비도(✓/⚠)·
   임의 단계 점프를 한눈에 보여주나, 종전 globals.css 는 <980px 에서 `.stepper
   { display: none }` 으로 **사이드바를 통째로 숨겨** 모바일 사용자는 12단계 전체
   진행 위치·단계별 준비도·임의 단계 점프 수단이 없었다(헤더 doc-progress 는 서류
   N/7 준비도만, 탭·pagenav 는 위치 일부만 보완). 모바일에선 세로 사이드바를
   숨기는 대신 **가로 스크롤 진행 레일**로 전환해 데스크톱 패리티를 회복한다.

   해결(Wizard.tsx + globals.css, 조문·엔진·검증 판정 무접촉 — 표시/반응형만):
     · 기존 stepper 마크업·goStep·readiness 마커(✓/⚠) 재사용. 항목 래퍼 div 에
       .stepper-list 클래스, 제목 span 에 .stepper-label 클래스 부여(가로 레일에서
       라벨은 활성 단계만 노출=컴팩트).
     · globals.css <980px: .stepper-list 가로 스크롤 레일(flex-row·overflow-x:auto·
       scroll-snap) + .stepper-item 알약형(flex 0 0 auto·border-radius 999px) +
       .stepper-title/.stepper-label 비활성 숨김. ★`.stepper{display:none}` 제거.
     · 단계 변경 시 활성 항목을 레일 중앙으로 가로 스크롤(scrollIntoView inline:
       "center", block:"nearest"=세로 가로채기 없음). 데스크톱 부작용 회피 위해
       matchMedia("(max-width: 980px)") 일치 시에만 — CSS 중단점과 동일 980px.

   핵심 불변식:
     (A) Wizard.tsx — activeStepRef·가로 스크롤 effect(matchMedia 980·scrollIntoView·
         [step]) + .stepper-list/.stepper-label 클래스 + 활성 항목 ref 배선.
     (B) globals.css <980px 블록 — 가로 레일 전환(.stepper-list flex/overflow-x),
         라벨/제목 숨김, 알약형 항목, ★`.stepper{display:none}` 부재.
     (C) 중단점 일관성 — JS matchMedia 980 == CSS @media 980.
     (D) 무회귀 — stepper <button>·aria-current·goStep·readiness 마커·헤딩 포커스
         effect([step]) 보존(가로 레일은 표시만 추가, 동작 무변경).

   실행:
     cd trust-saas
     node scripts/verify-stepper-mobile.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const wiz = readFileSync(join(root, "src/components/trust/Wizard.tsx"), "utf8");
const css = readFileSync(join(root, "src/app/globals.css"), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

// 균형 잡힌 중괄호로, 주어진 query 의 모든 @media 블록 본문을 연결해 반환
// (반응형 규칙이 .wizard-layout 블록과 stepper 레일 블록 둘로 나뉘어 있어도 포괄).
function allMediaBlocks(src, query) {
  let out = "";
  let from = 0;
  for (;;) {
    const start = src.indexOf(query, from);
    if (start < 0) break;
    const braceStart = src.indexOf("{", start);
    if (braceStart < 0) break;
    let depth = 0;
    let i = braceStart;
    for (; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") { depth--; if (depth === 0) break; }
    }
    out += "\n" + src.slice(braceStart + 1, i);
    from = i + 1;
  }
  return out;
}
const MQ = "@media (max-width: 980px)";
const mobile = allMediaBlocks(css, MQ);
// 특정 선택자의 규칙 본문 추출(미디어 블록 안에서).
function ruleBody(block, selector) {
  const re = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{([^}]*)\\}");
  const m = block.match(re);
  return m ? m[1] : "";
}

console.log("\n[A] Wizard.tsx — activeStepRef·가로 스크롤 effect·레일 클래스 배선");
ok(/const\s+activeStepRef\s*=\s*useRef<HTMLButtonElement>\(null\)/.test(wiz),
  "activeStepRef = useRef<HTMLButtonElement>(null)");
// 가로 스크롤 effect: matchMedia 980 가드 → scrollIntoView(inline center) → [step]
{
  const m = wiz.match(/useEffect\(\(\)\s*=>\s*\{[\s\S]*?matchMedia\([^)]*max-width:\s*980px[\s\S]*?scrollIntoView\([\s\S]*?\},\s*\[step\]\)/);
  ok(!!m, "가로 스크롤 useEffect(matchMedia 980 → scrollIntoView, 의존성 [step]) 존재");
  const blk = m ? m[0] : "";
  ok(/inline:\s*"center"/.test(blk), 'scrollIntoView inline:"center"(활성 항목 가로 중앙)');
  ok(/block:\s*"nearest"/.test(blk), 'scrollIntoView block:"nearest"(페이지 세로 스크롤 가로채기 없음)');
  // 데스크톱 부작용 차단: matchMedia 불일치 시 early return(스크롤 안 함)
  ok(/!window\.matchMedia\([^;]*980px[^;]*\.matches\)\s*return/.test(blk),
    "matchMedia 불일치(데스크톱) 시 early return(부작용 차단)");
}
ok(/<div className="stepper-list">/.test(wiz), "항목 래퍼 div 에 .stepper-list 클래스");
ok(/ref=\{s\.idx === step \? activeStepRef : undefined\}/.test(wiz),
  "활성 stepper 항목에만 ref={activeStepRef}(단계별 1개)");
ok(/<span className="stepper-label">\{s\.title\}<\/span>/.test(wiz),
  "stepper 제목 span 에 .stepper-label 클래스(가로 레일 라벨 토글용)");

console.log("\n[B] globals.css <980px — 가로 레일 전환(.stepper{display:none} 제거)");
ok(mobile.length > 0, "@media (max-width: 980px) 블록 추출 성공");
// ★핵심 회귀 차단: 모바일에서 .stepper 를 통째로 숨기지 않는다.
ok(!/\.stepper\s*\{[^}]*display:\s*none/.test(mobile),
  "★`.stepper { display: none }` 제거(모바일에서 사이드바 통째 숨김 회귀 차단)");
{
  const list = ruleBody(mobile, ".stepper-list");
  ok(list.length > 0, ".stepper-list 규칙 존재(모바일)");
  ok(/display:\s*flex/.test(list), ".stepper-list display:flex(가로 레일)");
  ok(/flex-direction:\s*row/.test(list), ".stepper-list flex-direction:row");
  ok(/overflow-x:\s*auto/.test(list), ".stepper-list overflow-x:auto(가로 스크롤)");
  ok(/scroll-snap-type/.test(list), ".stepper-list scroll-snap-type(스냅)");
  // ★페이지 가로 오버플로 회귀 차단: grid 안 flex 스크롤 컨테이너의 스크롤
  //   오버플로가 문서 스크롤 폭으로 누수돼 페이지가 통째로 가로 스크롤되던
  //   Chromium 케이스를 paint 컨테인먼트로 차단(레일 내부 스크롤은 유지).
  ok(/contain:\s*paint/.test(list), ".stepper-list contain:paint(페이지 가로 오버플로 누수 차단)");
}
// grid 항목 .stepper 가 min-width:0(레일을 컬럼에 가둬 자체 스크롤되게)
ok(/min-width:\s*0/.test(ruleBody(mobile, ".stepper")), ".stepper min-width:0(grid 항목 폭 가둠)");
{
  const item = ruleBody(mobile, ".stepper-item");
  ok(/flex:\s*0\s*0\s*auto/.test(item), ".stepper-item flex:0 0 auto(가로 폭 고정·미수축)");
  ok(/border-radius:\s*999px/.test(item), ".stepper-item border-radius:999px(알약형)");
  ok(/scroll-snap-align/.test(item), ".stepper-item scroll-snap-align(스냅 정렬)");
}
ok(/\.stepper-title\s*\{\s*display:\s*none/.test(mobile), '.stepper-title 숨김(모바일 "진행 단계" 라벨 생략)');
ok(/\.stepper-label\s*\{\s*display:\s*none/.test(mobile), ".stepper-label 비활성 숨김(컴팩트)");
ok(/\.stepper-item\.active\s+\.stepper-label\s*\{\s*display:\s*inline/.test(mobile),
  ".stepper-item.active .stepper-label display:inline(활성 단계만 라벨 노출)");

console.log("\n[C] 중단점 일관성 — JS matchMedia 980 == CSS @media 980");
ok(/matchMedia\("\(max-width:\s*980px\)"\)/.test(wiz), "JS matchMedia 980px");
ok(css.includes(MQ), "CSS @media (max-width: 980px) 동일 중단점");

console.log("\n[D] 무회귀 — stepper 버튼·aria-current·goStep·마커·헤딩 포커스 보존");
const stepperBlock = (() => {
  const start = wiz.indexOf('className="stepper"');
  const end = wiz.indexOf("</aside>", start);
  return start >= 0 && end >= 0 ? wiz.slice(start, end) : "";
})();
ok(/type="button"/.test(stepperBlock), "stepper 항목 <button type=\"button\"> 보존");
ok(/aria-current=\{s\.idx === step \? "step" : undefined\}/.test(stepperBlock),
  "활성 항목 aria-current=\"step\" 보존");
ok(/onClick=\{\(\)\s*=>\s*goStep\(s\.idx\)\}/.test(stepperBlock), "goStep(s.idx) 점프 배선 보존");
ok(/className=\{"stepper-flag " \+ \(ready \? "ok" : "warn"\)\}/.test(stepperBlock),
  "readiness 마커(✓/⚠ .stepper-flag) 보존");
// 헤딩 포커스 effect([step]) 가 가로 스크롤 effect 추가 후에도 보존(별도 effect)
ok(/headingRef\.current\?\.focus\(\)/.test(wiz), "단계 제목 헤딩 포커스 effect 보존(무회귀)");
// 데스크톱 base .stepper 규칙(sticky 사이드바)은 그대로 — 미디어 밖 정의 존재
ok(/\.stepper\s*\{\s*position:\s*sticky/.test(css), "데스크톱 base .stepper(sticky 사이드바) 보존");

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
process.exit(fail === 0 ? 0 : 1);
