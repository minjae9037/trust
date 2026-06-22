/* ============================================================
   회귀 가드 — 브랜드 로고 "홈으로" 키보드 동등성 (TrustApp 앱 셸)

   배경(a11y·WCAG 2.1.1 Keyboard / 4.1.2 Name·Role·Value, 비-산출물·표시 경계만):
   앱 상단 브랜드 로고(<div className="brand">)는 clicking 시 goHome() 으로 신탁사
   선택 화면으로 돌아가는 단축이다. 그러나 종전엔 순수 <div onClick> 이라
   ① cursor:pointer·title="홈으로" 로 마우스에는 affordance 를 주면서
   ② role·tabIndex·키 핸들러가 없어 키보드/스크린리더에는 '비-상호작용 div' 로만
   노출됐다 — 마우스 전용 단축(키보드로 활성화 불가)·AT 에 액션 가능성 미고지.
   내 계약 카드 본문(ContractsView `.contract-card-open`)은 이미 role="button"·
   tabIndex=0·aria-label·Enter/Space 핸들러로 키보드 동등성을 갖췄는데, 앱 셸의
   브랜드 로고만 그 패리티가 빠져 있던 마지막 마우스 전용 클릭 타깃이었다.

   해결: 브랜드 div 에 role="button"·tabIndex={0}·aria-label·onKeyDown(Enter/Space,
   e.currentTarget 가드 + preventDefault → goHome) 부여(카드 패턴과 동형). onClick·
   title·cursor·내부 마크업 보존(시각 무변경, 포커스 시 기본 포커스 링만).

   핵심 불변식:
     (A) 브랜드 div 에 role="button"·tabIndex={0}·aria-label 부여.
     (B) onKeyDown 이 Enter/Space 처리 + preventDefault + e.currentTarget 가드 + goHome 호출.
     (C) 무회귀 — onClick={goHome}·title="홈으로"·cursor pointer·내부 마크업(信託·TrustForm) 보존.
     (D) ★패리티 — ContractsView 카드 본문이 동형 키보드 패턴(role=button·tabIndex·onKeyDown) 유지.

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-brand-home-keyboard.mjs
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
const app = readFileSync(path.join(root, "src", "components", "trust", "TrustApp.tsx"), "utf8");
const cv = readFileSync(path.join(root, "src", "components", "trust", "ContractsView.tsx"), "utf8");

// 브랜드 블록을 className="brand" 마커로 격리(여는 div 부터 닫는 > 까지 충분히 포함).
const brandIdx = app.indexOf('className="brand"');
const brandSeg = brandIdx >= 0 ? app.slice(brandIdx - 40, brandIdx + 900) : "";

console.log("\n[A] 브랜드 div role/tabIndex/aria-label 부여");
{
  ok(brandIdx >= 0, 'className="brand" 블록 존재');
  ok(/role="button"/.test(brandSeg), 'role="button"(AT 에 액션 가능 고지)');
  ok(/tabIndex=\{0\}/.test(brandSeg), "tabIndex={0}(키보드 포커스 가능)");
  ok(/aria-label="홈으로 — 신탁사 선택"/.test(brandSeg), "aria-label(접근명 = 홈으로 단축)");
}

console.log("\n[B] onKeyDown — Enter/Space + preventDefault + currentTarget 가드 + goHome");
{
  ok(/onKeyDown=\{\(e\)\s*=>/.test(brandSeg), "onKeyDown 핸들러 존재");
  ok(/e\.target\s*!==\s*e\.currentTarget/.test(brandSeg), "e.currentTarget 가드(자체 키만 처리)");
  ok(/e\.key === "Enter" \|\| e\.key === " "/.test(brandSeg), "Enter/Space 키 처리");
  ok(/e\.preventDefault\(\)/.test(brandSeg), "preventDefault(Space 페이지 스크롤 차단)");
  // 가드는 핸들러 본문에서 goHome 을 직접 호출(onClick 과 같은 단일 함수 공유).
  const kd = brandSeg.indexOf("onKeyDown");
  const kdSeg = kd >= 0 ? brandSeg.slice(kd, kd + 600) : "";
  ok(/goHome\(\)/.test(kdSeg), "키 핸들러가 goHome() 호출(클릭·키보드 동일 동작)");
}

console.log("\n[C] 무회귀 — onClick·title·cursor·내부 마크업 보존(시각 무변경)");
{
  ok(/onClick=\{goHome\}/.test(brandSeg), "onClick={goHome} 보존(마우스 동선)");
  ok(/title="홈으로"/.test(brandSeg), 'title="홈으로" 보존');
  ok(/cursor:\s*"pointer"/.test(brandSeg), "cursor:pointer 보존(마우스 affordance)");
  ok(/<div className="brand-glyph">信託<\/div>/.test(brandSeg), "내부 마크업(信託 글리프) 보존");
  ok(/<div className="brand-name">TrustForm<\/div>/.test(app), "브랜드명(TrustForm) 보존");
  // goHome 정의 자체(미저장 변경 확인 가드 포함)는 불변 — 키보드 경로도 같은 가드 공유.
  ok(/function goHome\(\)/.test(app), "goHome 정의 보존(클릭·키보드 공용 단일 출처)");
  ok(/저장되지 않은 변경이 있습니다\. 저장하지 않고 처음으로/.test(app), "goHome 미저장 변경 확인 가드 보존");
}

console.log("\n[D] ★패리티 — ContractsView 카드 본문 동형 키보드 패턴 유지");
{
  const openIdx = cv.indexOf('className="contract-card-open"');
  const openSeg = openIdx >= 0 ? cv.slice(openIdx - 40, openIdx + 700) : "";
  ok(openIdx >= 0, "contract-card-open 블록 존재");
  ok(/role:\s*"button"/.test(openSeg), "카드 role=\"button\" 유지(패리티 기준)");
  ok(/tabIndex:\s*0/.test(openSeg), "카드 tabIndex=0 유지");
  ok(/onKeyDown:/.test(openSeg), "카드 onKeyDown 핸들러 유지");
  ok(/e\.key === "Enter" \|\| e\.key === " "/.test(openSeg), "카드 Enter/Space 처리 유지(동형 키 패턴)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
process.exit(fail === 0 ? 0 : 1);
