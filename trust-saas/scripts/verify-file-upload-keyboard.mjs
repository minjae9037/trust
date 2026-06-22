/* ============================================================
   회귀 가드 — 파일 업로드 라벨(법인등기부/등기부 PDF) 키보드 접근성

   배경(a11y·WCAG 2.1.1 Keyboard / 4.1.2 Name·Role·Value, 비-산출물·표시 경계만):
   위저드의 PDF 업로드 컨트롤 두 곳 — ① PartyCard 「법인등기부 PDF」(법인 당사자)
   ② StepProperty 「등기부 PDF」(신탁 부동산) — 은 버튼처럼 보이는 styled
   <label className="btn …"> 가 숨겨진 <input type="file"> 를 감싸는 구조다.
   종전엔 그 input 이 style={{display:"none"}} 이라 ★접근성 트리에서도, 탭
   순서에서도 제거 → 라벨이 마우스 클릭으론 파일 대화상자를 열지만 키보드/AT
   사용자는 이 업로드 버튼에 도달·활성화할 수단이 전무했다(마우스 전용 클릭 타깃).
   이는 브랜드 로고(680b3aa)·내 계약 카드 본문 등에서 마감해 온 "마우스 전용
   클릭 타깃" 갭의 마지막 잔여 — 12:25 워크로그가 다음스텝으로 명시한 항목.

   해결: input 의 display:none → className="sr-only"(시각 숨김이되 ★포커스 가능·
   탭 순서·a11y 트리 유지=globals.css .sr-only 는 clip/1px 기법으로 display:none
   과 달리 포커스를 보존). 래핑 <label> 텍스트("법인등기부 PDF"/"등기부 PDF")가
   곧 input 의 접근명. 포커스는 시각상 안 보이는 input 에 들어가므로, 보이는
   라벨(.file-upload-btn)에 :focus-within 포커스 링을 부여(WCAG 2.4.7).
   네이티브 file input 이라 포커스 후 Enter/Space 로 파일 대화상자가 열린다.

   ★시각·동작 무변경: 라벨 외형(btn btn-ghost btn-sm)·"PDF" 텍스트·onCorpPdf/
   onPdf 배선·accept="application/pdf" 보존. 추가만(포커스 가능화 + 포커스 링).
   ContractsView 백업 가져오기 input(hidden + 별도 <button> 트리거)은 이미 키보드
   접근 가능 → 무접촉(이 갭 대상 아님).

   핵심 불변식:
     (A) PartyCard 법인등기부 라벨 = .file-upload-btn·input className="sr-only"·
         display:none 제거·onCorpPdf 배선·accept 보존.
     (B) StepProperty 등기부 라벨 = 동일 패턴·onPdf 배선·accept 보존.
     (C) globals.css = .file-upload-btn:focus-within 포커스 링 +
         .sr-only 가 display:none 아님(=포커스 보존 기법).
     (D) 무회귀 = 두 file input 에 display:none 잔존 0 · ContractsView 백업
         input 은 종전대로 hidden + 버튼 트리거(무접촉).

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-file-upload-keyboard.mjs
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
const party = rd("src", "components", "trust", "steps", "PartyCard.tsx");
const prop = rd("src", "components", "trust", "steps", "StepProperty.tsx");
const contracts = rd("src", "components", "trust", "ContractsView.tsx");
const css = rd("src", "app", "globals.css");

// 업로드 라벨 블록을 라벨 텍스트 마커로 격리한다.
const seg = (src, marker, before = 120, span = 360) => {
  const i = src.indexOf(marker);
  return i >= 0 ? src.slice(i - before, i + span) : "";
};

console.log("\n[A] PartyCard 법인등기부 PDF — 키보드 포커스 가능화");
{
  // ★라벨 텍스트 "법인등기부 PDF" 는 주석에도 등장하므로, JSX 에만 있는 onChange
  //   핸들러 호출을 앵커로 잡고 뒤로 충분히 슬라이스해 라벨까지 포함한다.
  const s = seg(party, "onCorpPdf(e.target.files[0])", 380, 60);
  ok(/법인등기부 PDF/.test(s), "법인등기부 PDF 업로드 라벨 블록 존재");
  ok(/className="btn btn-ghost btn-sm file-upload-btn"/.test(s), "라벨에 file-upload-btn 클래스(포커스 링 타깃)");
  ok(/type="file"/.test(s) && /className="sr-only"/.test(s), 'input 이 className="sr-only"(포커스 가능 시각 숨김)');
  ok(!/style=\{\{\s*display:\s*"none"\s*\}\}/.test(s), "display:none 제거(탭 순서·a11y 트리 복원)");
  ok(/accept="application\/pdf"/.test(s), 'accept="application/pdf" 보존');
  ok(/onChange=\{\(e\) => e\.target\.files\?\.\[0\] && onCorpPdf\(e\.target\.files\[0\]\)\}/.test(s), "onCorpPdf 배선 보존");
}

console.log("\n[B] StepProperty 등기부 PDF — 키보드 포커스 가능화");
{
  const s = seg(prop, "onPdf(e.target.files[0], i)", 380, 60);
  ok(/등기부 PDF/.test(s), "등기부 PDF 업로드 라벨 블록 존재");
  ok(/className="btn btn-ghost btn-sm file-upload-btn"/.test(s), "라벨에 file-upload-btn 클래스(포커스 링 타깃)");
  ok(/type="file"/.test(s) && /className="sr-only"/.test(s), 'input 이 className="sr-only"(포커스 가능 시각 숨김)');
  ok(!/style=\{\{\s*display:\s*"none"\s*\}\}/.test(s), "display:none 제거(탭 순서·a11y 트리 복원)");
  ok(/accept="application\/pdf"/.test(s), 'accept="application/pdf" 보존');
  ok(/onChange=\{\(e\) => e\.target\.files\?\.\[0\] && onPdf\(e\.target\.files\[0\], i\)\}/.test(s), "onPdf 배선 보존");
}

console.log("\n[C] globals.css — 가시 포커스 링 + .sr-only 포커스 보존 기법");
{
  ok(/\.file-upload-btn:focus-within\s*\{[^}]*outline:\s*2px solid var\(--c-brown\)/.test(css),
    ".file-upload-btn:focus-within 포커스 링(btn-stop 등 동형 톤)");
  ok(/outline-offset:\s*2px/.test(css.slice(css.indexOf(".file-upload-btn:focus-within"), css.indexOf(".file-upload-btn:focus-within") + 120)),
    "outline-offset:2px(코드베이스 포커스 링 규약)");
  // .sr-only 는 display:none 이 아니라 clip/1px 기법이어야 포커스가 보존된다(이 fix의 전제).
  const sr = css.slice(css.indexOf(".sr-only {"), css.indexOf(".sr-only {") + 200);
  ok(sr.length > 10, ".sr-only 규칙 존재");
  ok(/position:\s*absolute/.test(sr) && !/display:\s*none/.test(sr),
    "★.sr-only 가 display:none 아님=포커스 보존(이 fix의 전제)");
}

console.log("\n[D] 무회귀 — file input display:none 잔존 0 · ContractsView 백업 input 무접촉");
{
  // 두 컴포넌트의 모든 type="file" 은 더 이상 display:none 을 쓰지 않아야 한다.
  const noHiddenFileInput = (src) => {
    let idx = 0;
    while ((idx = src.indexOf('type="file"', idx)) >= 0) {
      const win = src.slice(idx, idx + 200);
      if (/style=\{\{\s*display:\s*"none"\s*\}\}/.test(win)) return false;
      idx += 11;
    }
    return true;
  };
  ok(noHiddenFileInput(party), "PartyCard file input 에 display:none 잔존 0");
  ok(noHiddenFileInput(prop), "StepProperty file input 에 display:none 잔존 0");
  // ContractsView 백업 가져오기 input 은 별도 <button>(키보드 접근) 트리거라 이 갭 대상 아님 → 무접촉 확인.
  ok(/ref=\{fileRef\}/.test(contracts) && /type="file"/.test(contracts) && /hidden/.test(contracts),
    "ContractsView 백업 input = ref+hidden(별도 버튼 트리거) 무접촉");
  ok(/onClick=\{\(\) => fileRef\.current\?\.click\(\)\}/.test(contracts) || /fileRef\.current/.test(contracts),
    "ContractsView 백업 버튼이 input 을 click 트리거(키보드 접근 동선 보존)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
process.exit(fail === 0 ? 0 : 1);
