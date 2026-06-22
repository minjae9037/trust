/* ============================================================
   회귀 가드 — 내 계약 카드 본문 클릭(열기)의 키보드 동등성

   배경(a11y·WCAG 2.1.1 Keyboard / 4.1.2 Name·Role·Value, 비-산출물·표시 경계만):
   ContractsView 의 계약 카드는 본문 영역(<div>) 클릭 = 계약 열기(onOpen)인데,
   종전엔 <div onClick> 뿐이라 role/tabIndex/키 핸들러가 없어 **마우스로만** 활성화됐다.
   키보드·스크린리더 사용자는 큰 클릭 영역을 쓰지 못하고 우측 "열기" 버튼만 가능 —
   동일 동작에 마우스↔키보드 불일치가 있었고, 카드가 버튼 역할/접근명도 갖지 않았다.
   해결: 본문 div(`.contract-card-open`)에 role="button" + tabIndex=0 + aria-label +
   Enter/Space 키 핸들러를 부여(시각 UI 무변경, 포커스 링만 신규).

   ★이름변경(인라인 입력) 중에는 role/tabIndex 를 빼 ① 입력의 Space 가 버블돼 카드를
     열지 않게 하고 ② 입력 자체가 포커스 대상이 되게 한다(role=button 안에 textbox 금지).
   ★키 핸들러는 e.target===e.currentTarget 가드로 내부 요소에서 버블된 키를 무시한다.

   핵심 불변식:
     (A) 본문 열기 영역 `.contract-card-open` + onClick onOpen(r) 존재.
     (B) 비-편집 시 role="button"·tabIndex 0·aria-label·onKeyDown 부여
         (isEditing ? {} : {...} 스프레드).
     (C) onKeyDown: e.target===e.currentTarget 가드 + Enter/Space → preventDefault + onOpen.
     (D) ★편집 중 게이팅 — role/tabIndex 가 isEditing=false 분기에만(편집 중 미부여).
     (E) CSS `.contract-card-open:focus-visible` 포커스 링.
     (F) openLabel 구성 = 제목 + 상태(완료/작성중) + 준비도(서류 N/N · 협약서).
     (G) 무회귀 — "열기" 버튼·이름변경 stopPropagation·onOpen 배선 보존.

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-contracts-card-keyboard.mjs
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
const view = readFileSync(path.join(root, "src", "components", "trust", "ContractsView.tsx"), "utf8");
const css = readFileSync(path.join(root, "src", "app", "globals.css"), "utf8");

// 열기 영역 블록을 className 마커로 격리(여는 <div ...> 부터 닫는 '>' 까지).
const openIdx = view.indexOf('className="contract-card-open"');
const seg = openIdx >= 0 ? view.slice(openIdx - 40, openIdx + 900) : "";

console.log("\n[A] 본문 열기 영역 + onClick onOpen");
{
  ok(openIdx >= 0, "`.contract-card-open` 열기 영역 존재");
  ok(/onClick=\{\(\) => onOpen\(r\)\}/.test(seg), "본문 클릭 = onOpen(r)(마우스 경로 보존)");
}

console.log("\n[B] 비-편집 시 role/tabIndex/aria-label/onKeyDown 부여(스프레드)");
{
  ok(/\{\.\.\.\(isEditing\s*\?\s*\{\}\s*:\s*\{/.test(seg), "isEditing ? {} : {…} 조건부 스프레드");
  ok(/role:\s*"button"/.test(seg), 'role: "button"(버튼 역할)');
  ok(/tabIndex:\s*0/.test(seg), "tabIndex: 0(키보드 포커스 진입)");
  ok(/"aria-label":\s*openLabel/.test(seg), "aria-label: openLabel(접근명)");
  ok(/onKeyDown:\s*\(e/.test(seg), "onKeyDown 핸들러 부여");
}

console.log("\n[C] onKeyDown — currentTarget 가드 + Enter/Space → preventDefault + onOpen");
{
  ok(/if\s*\(e\.target\s*!==\s*e\.currentTarget\)\s*return/.test(seg),
    "e.target!==e.currentTarget 시 무시(버블 키 차단)");
  ok(/e\.key\s*===\s*"Enter"\s*\|\|\s*e\.key\s*===\s*" "/.test(seg), "Enter 또는 Space 키 인식");
  // preventDefault 가 onOpen 호출보다 앞(스페이스 스크롤·기본동작 억제)
  const pdAt = seg.indexOf("e.preventDefault()");
  const openAt = seg.indexOf("onOpen(r)", pdAt > 0 ? pdAt : 0);
  ok(pdAt >= 0, "e.preventDefault() 존재(Space 스크롤 방지)");
  ok(pdAt >= 0 && openAt > pdAt, "preventDefault 가 onOpen 호출보다 앞");
}

console.log("\n[D] ★편집 중 게이팅 — role/tabIndex 가 비-편집 분기에만");
{
  // isEditing 정의가 카드 매핑 안에서 editId 기준으로 존재
  ok(/const isEditing = editId === r\.id;/.test(view), "isEditing = editId===r.id 정의");
  // role="button" 리터럴이 파일 전체에서 정확히 1곳(이 카드)·스프레드 분기 내부
  const roleCount = (view.match(/role:\s*"button"/g) || []).length;
  ok(roleCount === 1, 'role:"button" 정확히 1곳(편집 중 미부여 — 중복/상시부여 아님)');
  // 편집 중 분기는 빈 객체({})여야 함(role/tabIndex 미포함)
  ok(/isEditing\s*\?\s*\{\}\s*:/.test(seg), "편집 중 분기 = 빈 객체(role/tabIndex 미부여)");
}

console.log("\n[E] CSS 포커스 링");
{
  ok(/\.contract-card-open:focus-visible\s*\{[^}]*outline:/.test(css),
    ".contract-card-open:focus-visible outline 정의");
  const m = css.match(/\.contract-card-open:focus-visible\s*\{([^}]*)\}/);
  ok(!!m && /var\(--c-brown\)/.test(m[1]), "포커스 링 색 = var(--c-brown)(기존 토큰 재사용)");
}

console.log("\n[F] openLabel 구성 — 제목 + 상태 + 준비도");
{
  ok(/const statusLabel = r\.status === "completed" \? "완료" : "작성중";/.test(view),
    "statusLabel 완료/작성중");
  ok(/서류 \$\{readiness\.ready\}\/\$\{readiness\.total\} 생성 가능/.test(view),
    "readyLabel collateral 준비도(N/N)");
  ok(/jointReady \? "협약서 생성 가능" : "필수 입력 누락"/.test(view), "readyLabel joint 준비도");
  ok(/const openLabel = `\$\{r\.title\}, \$\{statusLabel\}\$\{readyLabel\} — 열기`;/.test(view),
    "openLabel = 제목+상태+준비도 — 열기");
}

console.log("\n[G] 무회귀 — 열기 버튼·이름변경 분리·onOpen 배선 보존");
{
  // 우측 "열기" 버튼(대체 동선) 보존 — onClick onOpen + aria-label(계약 제목) + 가시 텍스트 "열기".
  // (verify-contracts-action-labels 가 카드 액션 버튼 접근명에 제목을 부여하며 멀티라인화 — 동작 보존만 확인)
  ok(/onClick=\{\(\) => onOpen\(r\)\}\s*\n\s*aria-label=\{`\$\{r\.title\} 열기`\}[\s\S]{0,60}?>\s*열기/.test(view),
    '우측 "열기" 버튼(대체 동선) 보존');
  // 이름변경 인라인 영역 stopPropagation(클릭이 카드 열기로 새지 않게) 보존
  ok(/className="contract-rename" onClick=\{\(e\) => e\.stopPropagation\(\)\}/.test(view),
    "이름변경 영역 stopPropagation 보존");
  // onOpen prop 시그니처 보존
  ok(/onOpen: \(row: ContractRow\) => void/.test(view), "onOpen prop 시그니처 보존");
  // 카드 본문이 여전히 식별줄/날짜/칩 등 콘텐츠를 감쌈(빈 버튼화 아님)
  ok(/contract-card-head/.test(seg), "열기 영역이 카드 헤드 콘텐츠를 감쌈");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
process.exit(fail === 0 ? 0 : 1);
