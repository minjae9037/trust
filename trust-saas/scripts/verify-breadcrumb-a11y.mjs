/* ============================================================
   회귀 가드 — breadcrumb crumb <span onClick> → <button> 키보드 접근 전환

   배경(접근성 결함, 비-산출물): 16:18 pagenav 접근명·구분자 SR 숨김 작업에서
   breadcrumb 의 상호작용 crumb(신탁사 선택·회사·서류종·내 계약)이 stepper 와
   동일하게 `<span className="crumb" onClick>` 으로 남아 ①Tab 포커스 불가
   ②Enter/Space 활성화 불가 ③스크린리더가 상호작용 요소로 미인식(role 없음)의
   결함이 있었다. stepper 와 동일 패턴(div/span→button + globals.css 리셋)으로
   키보드 접근 가능한 네이티브 버튼으로 전환(시각 위험 클래스라 16:18 에서
   의도적으로 분리·별도 iteration 으로 마감).

   수정 패턴(전부 시맨틱 교체·외관 무변):
     · 상호작용 crumb 4종: <span onClick> → <button type="button" onClick>
       (현재 뷰면 aria-current="page")
     · 현재 위치 라벨(CATEGORY_LABEL): 비상호작용 → <span> 유지 + aria-current="page"
     · <Link> crumb(상담→·서류 자동화→): 이미 키보드 접근 가능 → 무접촉
     · globals.css `button.crumb` 리셋(무배경·무테두리·무패딩·폰트/색 상속)
       + `:focus-visible` 아웃라인 — <span>·<Link> 는 무접촉(button 한정 셀렉터)

   ★범위: 산출물(DOCX/PDF)·조문·엔진·검증 게이트·데이터 모델 전부 무접촉
     — breadcrumb 네비게이션 마크업의 시맨틱만 교체. onClick(goHome/setView)
       경로 무변경. AdvisorApp crumb 은 이미 <Link>/active 라벨이라 정비 대상 아님.

   실행:
     cd trust-saas
     node scripts/verify-breadcrumb-a11y.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");
const trustApp = read("src/components/trust/TrustApp.tsx");
const advisorApp = read("src/components/advisor/AdvisorApp.tsx");
const css = read("src/app/globals.css");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

console.log("=== breadcrumb crumb <span onClick>→<button> 키보드 접근 검증 ===\n");

// breadcrumb <nav> 블록 추출(검사 범위 한정)
const navMatch = trustApp.match(/<nav className="breadcrumb">[\s\S]*?<\/nav>/);
const nav = navMatch ? navMatch[0] : "";

// ──────────────────────────────────────────────
// (A) 상호작용 crumb = 네이티브 <button> (키보드/SR 접근)
// ──────────────────────────────────────────────
console.log("[상호작용 crumb 버튼 전환]");
ok(nav.length > 0, "(A0) breadcrumb <nav> 블록 추출");

// 상호작용 crumb 4종(신탁사 선택·회사·서류종·내 계약)의 onClick 핸들러가
// 전부 <button> 으로 렌더 — 각 핸들러가 button 태그 블록 안에 존재하는지 검사
const buttonBlocks = nav.match(/<button[\s\S]*?<\/button>/g) || [];
ok(buttonBlocks.length === 4, `(A1) crumb <button> 4종 (실제 ${buttonBlocks.length})`);
ok(
  buttonBlocks.every((b) => /type="button"/.test(b) && /className=("crumb"|\{"crumb")/.test(b)),
  "(A2) 모든 crumb 버튼 type=\"button\" + className crumb",
);
ok(
  buttonBlocks.every((b) => /onClick=/.test(b)),
  "(A3) 모든 crumb 버튼 onClick 보유",
);
// 4종 onClick 핸들러가 각각 button 안에 존재(동작 경로 보존)
const handlers = [
  ["goHome", /onClick=\{goHome\}/],
  ['setView("home")', /onClick=\{\(\) => setView\("home"\)\}/],
  ['setView("category")', /onClick=\{\(\) => setView\("category"\)\}/],
  ['setView("contracts")', /onClick=\{\(\) => setView\("contracts"\)\}/],
];
for (const [name, re] of handlers) {
  ok(
    buttonBlocks.some((b) => re.test(b)),
    `(A4) ${name} 핸들러가 <button> 안에 존재(동작 경로 보존)`,
  );
}

// ──────────────────────────────────────────────
// (B) ★회귀 차단 — crumb <span onClick> 잔존 0
// ──────────────────────────────────────────────
console.log("\n[★회귀 차단: span onClick crumb 잔존 0]");
// <span> 태그 중 onClick 을 가진 것(crumb 이든 아니든) — breadcrumb 안에 0이어야
const spanWithClick = (nav.match(/<span\b[^>]*>/g) || []).filter((s) => /onClick/.test(s));
ok(spanWithClick.length === 0, `(B1) ★breadcrumb 내 <span onClick> 잔존 0 (실제 ${spanWithClick.length})`);
// crumb className 을 가진 <span> 은 비상호작용(active 라벨)만 허용 → 자기 태그에 onClick 0
const crumbSpanWithClick = (nav.match(/<span\b[^>]*>/g) || []).filter(
  (s) => /crumb/.test(s) && /onClick/.test(s),
);
ok(crumbSpanWithClick.length === 0, "(B2) ★crumb <span> 은 onClick 없음(라벨 전용)");

// ──────────────────────────────────────────────
// (C) aria-current — 현재 뷰 crumb / 현재 위치 라벨
// ──────────────────────────────────────────────
console.log("\n[aria-current 현재 위치 표기]");
ok(
  /aria-current=\{view === "company" \? "page" : undefined\}/.test(nav),
  '(C1) 신탁사 선택 버튼 aria-current(view==="company")',
);
ok(
  /aria-current=\{view === "home" \? "page" : undefined\}/.test(nav) &&
    /aria-current=\{view === "category" \? "page" : undefined\}/.test(nav),
  "(C2) 회사·서류종 버튼 aria-current(현재 뷰)",
);
ok(
  /<span className="crumb active" aria-current="page">/.test(nav),
  "(C3) 현재 위치 라벨(span.crumb.active) aria-current=\"page\"",
);

// ──────────────────────────────────────────────
// (D) <Link> crumb 무접촉(이미 키보드 접근) — 버튼 전환 대상 아님
// ──────────────────────────────────────────────
console.log("\n[<Link> crumb 보존(전환 대상 아님)]");
ok(
  /<Link href="\/advisor\?resume=1" className="crumb"/.test(nav),
  "(D1) 상담 <Link> crumb 보존(버튼 미전환·?resume=1 왕복 복귀 딥링크)",
);

// ──────────────────────────────────────────────
// (E) globals.css — button.crumb 리셋 + :focus-visible (span/Link 무접촉)
// ──────────────────────────────────────────────
console.log("\n[globals.css button.crumb 리셋 + focus-visible]");
const resetMatch = css.match(/\.breadcrumb button\.crumb\s*\{[^}]*\}/);
const reset = resetMatch ? resetMatch[0] : "";
ok(reset.length > 0, "(E0) .breadcrumb button.crumb 리셋 블록 존재");
ok(
  /background:\s*none/.test(reset) &&
    /border:\s*none/.test(reset) &&
    /padding:\s*0/.test(reset) &&
    /font:\s*inherit/.test(reset) &&
    /appearance:\s*none/.test(reset),
  "(E1) 리셋=무배경·무테두리·무패딩·폰트 상속·appearance none(외관 유지)",
);
ok(
  /\.breadcrumb button\.crumb:focus-visible\s*\{[^}]*outline:[^}]*var\(--c-brown\)/.test(css),
  "(E2) button.crumb:focus-visible 아웃라인(브랜드 토큰)",
);
// 리셋 셀렉터가 button 한정 — <span>/<Link> 무접촉 보증
ok(
  !/\.breadcrumb \.crumb\s*\{[^}]*appearance:\s*none/.test(css),
  "(E3) ★일반 .crumb(span/Link)엔 button 리셋 미적용(셀렉터 button 한정)",
);

// ──────────────────────────────────────────────
// (F) AdvisorApp 무접촉 — 이미 <Link>/active 라벨(span onClick crumb 0)
// ──────────────────────────────────────────────
console.log("\n[AdvisorApp 무접촉 검증]");
const advSpanClick = (advisorApp.match(/<span\b[^>]*>/g) || []).filter((s) => /onClick/.test(s));
ok(advSpanClick.length === 0, "(F1) AdvisorApp <span onClick> 0(정비 대상 아님)");
ok(
  /<Link href="\/app" className="crumb"/.test(advisorApp) &&
    /<span className="crumb active">/.test(advisorApp),
  "(F2) AdvisorApp <Link> + active 라벨 보존",
);

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
