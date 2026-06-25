/* ============================================================
   회귀 가드 — 단계 선택(CategoryPage) 진행 중 초안 복원 진입점(딥링크 도착 표면화)

   배경: 진행 중(미저장) 서류 초안은 draftRepo 로 영속되고 첫 화면(CompanyPage)에
   "이어서 작성하기" 복원 진입점이 있다(11:02 `e8912f3`). 그런데 상담 답변의
   doc-action(`<<doc:…>>`)으로 도착하는 `/app?doc=…` 딥링크는 단계 선택(category)
   뷰로 직행하는데, 이 화면엔 복원 진입점이 없어 사용자는 진행 중 초안을 보지 못한 채
   빈 양식에서 다시 시작하다 첫 입력 순간 단일 초안이 덮어써졌다(11:40 `95f6707` 가
   "입력 전 무손실"은 막았으나 "초안을 보여 주는" 표면화는 미해결로 남겨 둠 — 다음스텝
   "비파괴 안내/충돌 표면화 보강"). CategoryPage 에도 CompanyPage 와 동일한 복원 진입점을
   더해, 딥링크로 단계 선택에 직행한 사용자도 진행 중 초안을 그 자리에서 되살릴 수 있게 한다.

   ※ 다중 초안 보관(여러 서류 동시 진행)은 별개 정책 사안(기획 합의 후) — 본 변경은
     기존 단일 초안을 비파괴로 "표면화"할 뿐(새 상태/모델/엔진/조문/검증/산출물 무접촉).

   핵심 불변식:
     - ★표시·재개 전용 — 조문·엔진·검증(validate)·산출물(docx) 무접촉. 새 CSS 0.
     - 진입점은 onResumeDraft + draft 있을 때만 렌더(미전달·초안 부재 시 미표출=후방호환).
     - CompanyPage 와 동일 마크업·동작(role=region·문구·글리프 aria-hidden·btn-primary·
       onClick=onResumeDraft) — 두 진입점이 동일 resumeDraft 콜백을 호출.
     - ★CompanyPage 기존 진입점 보존(회귀) — 동일 aria-label region 이 정확히 2곳
       (CompanyPage·CategoryPage)에 존재(한 번에 한 뷰만 렌더돼 중복 랜드마크 동시 노출 없음).

   단언:
     (A) CategoryPage 시그니처 — draft·onResumeDraft 옵셔널 prop 수용(후방호환)
     (B) CategoryPage 진입점 — 조건·role=region·aria-label·문구·글리프 aria-hidden·btn-primary
     (C) TrustApp 배선 — CategoryPage 렌더에 draft={restorableDraft}·onResumeDraft={resumeDraft} 전달
     (D) 무접촉·회귀 — 새 CSS 0·CompanyPage 진입점 보존(동일 region 정확히 2곳)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-category-draft-resume.mjs
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
const app = read("src", "components", "trust", "TrustApp.tsx");
const globals = read("src", "app", "globals.css");

// CategoryPage 정의 슬라이스 — CompanyPage(파일에서 앞)의 동일 마크업과 섞이지 않게
// CategoryPage 함수 시작부터 파일 끝까지만 떼어 단언한다(CategoryPage 가 파일 마지막 함수).
const catAt = app.indexOf("function CategoryPage(");
const catBlock = catAt >= 0 ? app.slice(catAt) : "";

console.log("\n[A] CategoryPage 시그니처 — draft·onResumeDraft 옵셔널 prop 수용(후방호환)");
{
  ok(catAt >= 0, "CategoryPage 함수 정의 존재");
  ok(/draft\?: ContractDraft \| null;/.test(catBlock) && /onResumeDraft\?: \(\) => void;/.test(catBlock),
     "draft·onResumeDraft 옵셔널 prop(미전달 시 미표출 — 후방호환)");
  ok(/const draftDocName = draft\s*\n?\s*\? DOCUMENT_TYPES\.find\(\(d\) => d\.id === draft\.docTypeId\)\?\.name \|\| "서류"/.test(catBlock),
     "draftDocName = 초안 docTypeId → 서류명(미발견 시 \"서류\" 폴백·CompanyPage 동일 출처)");
}

console.log("\n[B] CategoryPage 진입점 — 조건·role=region·문구·글리프 aria-hidden·btn-primary");
{
  ok(/\{onResumeDraft && draft && \(/.test(catBlock),
     "진입점은 onResumeDraft + draft 있을 때만 렌더(딥링크 아닌 일반 진입·초안 부재 시 미표출)");
  ok(/role="region"/.test(catBlock) && /aria-label="작성 중이던 서류 이어서 작성하기"/.test(catBlock),
     "복원 영역 role=region + aria-label(랜드마크 — CompanyPage 동일 의미)");
  ok(/작성 중이던 <strong>\{draftDocName\}<\/strong> 서류가 있습니다\./.test(catBlock),
     "작성 중이던 서류 이름 문구(docTypeId → 서류명)");
  ok(/이어서 작성하기<span aria-hidden="true"> →<\/span>/.test(catBlock),
     "행동 유도 문구 + 장식 글리프(→) aria-hidden(접근명 오염 0)");
  ok(/className="btn btn-primary btn-sm" onClick=\{onResumeDraft\}/.test(catBlock),
     "복원 버튼 onClick=onResumeDraft + 기존 btn-primary/btn-sm(CompanyPage 와 동일 콜백)");
}

console.log("\n[C] TrustApp 배선 — CategoryPage 렌더에 복원 진입점 prop 전달");
{
  const renderAt = app.indexOf('view === "category" && docType &&');
  const renderBlock = renderAt >= 0 ? app.slice(renderAt, renderAt + 420) : "";
  ok(renderAt >= 0 && /<CategoryPage/.test(renderBlock),
     "category 뷰가 <CategoryPage> 렌더");
  ok(/draft=\{restorableDraft\}/.test(renderBlock) && /onResumeDraft=\{resumeDraft\}/.test(renderBlock),
     "CategoryPage 에 draft={restorableDraft}·onResumeDraft={resumeDraft} 전달(첫 화면과 동일 단일 출처)");
}

console.log("\n[D] 무접촉·회귀 — 새 CSS 0·CompanyPage 진입점 보존");
{
  ok(!/\.draft-resume\b/.test(globals) && !/category-draft/.test(globals),
     "globals 에 초안 진입점 전용 클래스 미추가(새 CSS 0 — 기존 토큰 + 인라인 style)");
  // 동일 복원 region 이 정확히 2곳(CompanyPage + CategoryPage) — CompanyPage 기존 진입점 보존 회귀.
  const regionCount = app.split('aria-label="작성 중이던 서류 이어서 작성하기"').length - 1;
  ok(regionCount === 2,
     `초안 복원 region 이 정확히 2곳(CompanyPage·CategoryPage) — 실제 ${regionCount}(CompanyPage 보존 회귀)`);
  // CompanyPage 의 저장된 계약 재개 진입점도 그대로(무관 영역 무접촉).
  ok(/aria-label="저장된 작업 이어서 하기"/.test(app),
     "CompanyPage 저장된 계약 재개 진입점 보존(무접촉)");
}

console.log(`\n${fail === 0 ? "OK" : "FAIL"} — ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
