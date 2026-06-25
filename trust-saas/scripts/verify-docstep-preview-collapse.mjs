/* ============================================================
   회귀 가드 — 서류 위저드(DocStep) 실시간 미리보기 접기/펼치기 토글

   배경(미리보기 UX 갭): DocStep 2분할(좌 입력 / 우 실시간 미리보기)은 넓은 화면에선
   sticky 2열이지만, 좁은 화면(≤1080px)에선 미디어쿼리가 미리보기를 단일 열 맨 위로
   올리고(order:-1) 60vh 로 고정한다 — 그 결과 사용자는 입력란에 닿으려면 미리보기를
   지나쳐 아래로 스크롤하고, 입력 반영을 보려면 다시 위로 스크롤해야 했다(2분할 WYSIWYG
   이점 상실). 또 넓은 화면에서도 입력에 집중할 때 미리보기 열을 접을 방법이 없었다.

   해결: 미리보기 머리말에 접기/펼치기 토글을 둬, 접으면 ① 그리드를 단일 열로 전환해
   입력란을 전체 폭으로 쓰고 ② 미리보기는 슬림 머리말 바(본문 hidden)만 항상 위(order:-1)
   에 남겨 다시 펼치기 쉽게 한다. iframe 은 언마운트하지 않고 hidden 만 토글(펼칠 때 재로딩
   없음). 머리말의 초안 배지·갱신 표시·"크게 보기"는 접어도 유지돼 검수 동선이 끊기지 않는다.

   핵심 불변식:
     - ★표시 전용 — 조문·엔진·검증(validate)·산출물(docx) 무접촉. previewOpen 은 순수
       레이아웃 상태일 뿐 previewDocHTML 생성 입력(debouncedForm·docId)·검증 게이트에 무영향.
     - 기본 펼침(useState(true)) — 첫 진입 동작 무변경(후방호환).
     - 토글은 previewHtml 유무와 무관하게 항상 렌더(빈 상태에서도 폭 확보 가능).
     - 접기 대상 본문(iframe/빈 상태)만 hidden — previewNote(팝업 차단 안내)는 래퍼 밖이라 유지.
     - iframe sandbox="" 보안 격리 보존(접기는 srcDoc 생성·격리에 무접촉).
     - 의미는 가시 텍스트(접기/펼치기)·aria-expanded·aria-controls 가 전달, 선두 글리프는
       장식이라 aria-hidden(접근명 오염 0 — 기존 컨벤션).
     - JointForm 등 다른 .doc-split 사용처는 doc-split--preview-collapsed 클래스를 받지
       않으므로 신규 CSS 가 전부 무효(무회귀) — 토글은 DocStep 한정.

   단언:
     (A) DocStep 상태/외곽 배선 — previewOpen useState(true)·외곽 div 조건부 클래스
     (B) 토글 버튼 배선 — preview-toggle·setPreviewOpen 토글·aria-expanded/controls·
         글리프 aria-hidden·라벨·파일 전체 정확히 1개
     (C) 접기 대상 본문 래퍼 — id=doc-preview-body·hidden={!previewOpen}·previewNote 는 밖
     (D) 무회귀 — "크게 보기"(preview-expand)·iframe sandbox=""·초안 배지·갱신 표시 보존
     (E) CSS — doc-split--preview-collapsed 단일 열·order:-1·doc-preview-body flex·preview-toggle
     (F) 무접촉 — previewDocHTML 생성 입력 무변경([debouncedForm, docId])·previewOpen 비의존

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-docstep-preview-collapse.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const __dir = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(join(__dir, "..", ...p), "utf8");
const doc = read("src", "components", "trust", "steps", "DocStep.tsx");
const globals = read("src", "app", "globals.css");

console.log("\n[A] DocStep 상태/외곽 배선 — previewOpen useState(true)·외곽 div 조건부 클래스");
{
  ok(/const \[previewOpen, setPreviewOpen\] = useState\(true\);/.test(doc),
     "previewOpen 상태 = useState(true) — 기본 펼침(첫 진입 무변경·후방호환)");
  ok(/className=\{previewOpen \? "doc-split" : "doc-split doc-split--preview-collapsed"\}/.test(doc),
     "외곽 div 클래스 = 펼침이면 doc-split·접힘이면 doc-split--preview-collapsed 부가");
}

console.log("\n[B] 토글 버튼 배선 — preview-toggle·토글 onClick·aria·글리프·라벨·정확히 1개");
{
  const at = doc.indexOf('className="preview-toggle"');
  ok(at >= 0, "preview-toggle 버튼 존재");
  const block = doc.slice(at - 60, at + 520);
  ok(/onClick=\{\(\) => setPreviewOpen\(\(v\) => !v\)\}/.test(block),
     "onClick = setPreviewOpen((v) => !v) — 상태 토글");
  ok(/aria-expanded=\{previewOpen\}/.test(block),
     "aria-expanded={previewOpen} — 펼침/접힘 상태 SR 고지");
  ok(/aria-controls="doc-preview-body"/.test(block),
     "aria-controls=doc-preview-body — 토글 대상 본문 연결");
  ok(/<span aria-hidden="true">\{previewOpen \? "▾ " : "▸ "\}<\/span>/.test(block),
     "선두 방향 글리프(▾/▸)는 aria-hidden(장식·접근명 오염 0)");
  ok(/\{previewOpen \? "접기" : "펼치기"\}/.test(block),
     "가시 라벨 = 접기/펼치기(의미 전달 주체)");
  ok(/type="button"/.test(block),
     "type=button(폼 제출 방지)");
  const toggleHits = doc.split('className="preview-toggle"').length - 1;
  ok(toggleHits === 1, `preview-toggle 버튼은 파일 전체에 정확히 1개 — 실제 ${toggleHits}`);
}

console.log("\n[C] 접기 대상 본문 래퍼 — id=doc-preview-body·hidden={!previewOpen}·previewNote 는 밖");
{
  ok(/<div id="doc-preview-body" className="doc-preview-body" hidden=\{!previewOpen\}>/.test(doc),
     "본문 래퍼 = id=doc-preview-body·hidden={!previewOpen}(접으면 display:none 로 레이아웃 제거)");
  // previewNote(팝업 차단 안내)는 래퍼 '밖'(앞)에 있어 접어도 보인다 — 위치 순서로 검증
  const noteAt = doc.indexOf('className="preview-note"');
  const bodyAt = doc.indexOf('id="doc-preview-body"');
  ok(noteAt >= 0 && bodyAt >= 0 && noteAt < bodyAt,
     "previewNote 블록이 접기 본문 래퍼보다 앞(밖)에 위치 — 접어도 팝업 차단 안내 유지");
  // iframe(미리보기 본문)은 래퍼 안에 위치
  const ifAt = doc.indexOf("srcDoc={previewHtml}");
  ok(ifAt > bodyAt, "iframe(srcDoc=previewHtml)은 접기 본문 래퍼 안에 위치(접힘 대상)");
}

console.log('\n[D] 무회귀 — "크게 보기"·iframe sandbox=""·초안 배지·갱신 표시 보존');
{
  ok(/className="preview-expand"/.test(doc) && /onClick=\{onExpandPreview\}/.test(doc),
     '"크게 보기"(preview-expand·onExpandPreview) 보존 — 접어도 새 창 정독 가능');
  ok(/srcDoc=\{previewHtml\}\s*\n\s*sandbox=""/.test(doc),
     'iframe sandbox="" 완전 격리 보존(접기는 srcDoc 생성·격리 무접촉)');
  ok(/className="preview-badge-draft"/.test(doc),
     "초안 배지(preview-badge-draft) 보존 — 머리말에 남아 접어도 보임");
  ok(/className="preview-updating"/.test(doc),
     "갱신 중 표시(preview-updating) 보존 — 머리말에 남아 접어도 보임");
  ok(/<span className="preview-badge">실시간 미리보기<\/span>/.test(doc),
     "실시간 미리보기 배지 보존");
}

console.log("\n[E] CSS — doc-split--preview-collapsed 단일 열·order:-1·doc-preview-body flex·preview-toggle");
{
  ok(/\.doc-split--preview-collapsed \{ grid-template-columns: 1fr; \}/.test(globals),
     ".doc-split--preview-collapsed = 단일 열(입력란 전체 폭)");
  ok(/\.doc-split--preview-collapsed \.doc-split-preview \{[^}]*order: -1;/.test(globals),
     "접힘 시 미리보기(슬림 바) order:-1 로 항상 위(다시 펼치기 쉽게)");
  ok(/\.doc-preview-body \{ flex: 1; display: flex; flex-direction: column; min-height: 0; \}/.test(globals),
     ".doc-preview-body flex:1 — 펼침 시 iframe 이 남은 높이를 채움");
  ok(/\.preview-toggle \{/.test(globals) && /\.preview-toggle:hover \{/.test(globals),
     ".preview-toggle 스타일 + hover 존재(크게 보기와 동일 알약형)");
  ok(/\.preview-toggle \{[^}]*margin-left: auto;/.test(globals),
     ".preview-toggle margin-left:auto(빈 상태 단독 시 우측 정렬)");
}

console.log("\n[F] 무접촉 — previewDocHTML 생성 입력 무변경·previewOpen 비의존(표시 전용)");
{
  ok(/return previewDocHTML\(debouncedForm, docId\);/.test(doc),
     "미리보기 생성 = previewDocHTML(debouncedForm, docId) 무변경(previewOpen 무주입)");
  ok(/\}, \[debouncedForm, docId\]\);/.test(doc),
     "미리보기 useMemo 의존성 = [debouncedForm, docId] — previewOpen 비의존(접기는 재생성 안 함)");
  // validate 게이트 호출도 previewOpen 과 무관
  ok(/const \{ ok, missing \} = useMemo\(\(\) => validateDoc\(form, docId\), \[form, docId\]\);/.test(doc),
     "검증 게이트(validateDoc) 의존성 무변경 — previewOpen 비의존(접기는 게이트 무접촉)");
}

console.log(`\n${fail === 0 ? "OK" : "FAIL"} — ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
