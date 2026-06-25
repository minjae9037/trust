/* ============================================================
   회귀 가드 — 첫 화면(신탁사 선택) "이어서 작업하기" 재개 진입점

   배경: 돌아온 사용자(저장된 계약 보유)가 앱에 들어오면 가장 먼저 보는 화면은
   CompanyPage(view="company", "신탁사를 선택해 주세요")다. 종전엔 이 첫 화면에서
   저장된 작업이 있다는 신호가 상단 브레드크럼 "내 계약 (N)" 배지뿐이라, 작업을
   재개하려는 사용자도 매번 신탁사부터 다시 고르거나 작은 배지를 찾아야 했다
   (재방문 흐름 단절). 직전 iteration 들이 마감한 ①내 계약 0건 빈 화면 "새 계약
   작성하기" 1차 CTA(99611b6, start)·②브레드크럼 "내 계약 (N)" 배지(e4d5a69)의
   대칭(resume) — 첫 화면에 "이어서 작업하기" 진입점을 둬 한 번에 내 계약으로 보낸다.

   변경: CompanyPage 에 savedCount·onResume 옵셔널 prop 추가. 저장된 계약이 있고
   (savedCount>0) onResume 가 전달되면 page-header 아래 재개 배너(저장 N건 안내 +
   btn-primary "이어서 작업하기 →")를 렌더. TrustApp 은 onResume={()=>setView("contracts")}
   로 내 계약 뷰에 직결(브레드크럼 "내 계약" 클릭과 동일 내비게이션 의미).

   핵심 불변식:
     - ★표시·내비게이션 전용 — 조문·엔진·검증(validate)·산출물(docx) 무접촉.
       onResume 는 뷰 전환 콜백일 뿐 어떤 폼 데이터/게이트/빌더에도 영향 0.
     - 배너는 저장된 계약이 있을 때만(savedCount>0) + onResume 전달 시에만 렌더
       (저장 0건·콜백 미전달이면 미표출 — 후방호환·신규 사용자 화면 무변경).
     - 시각 "→" 글리프는 aria-hidden(장식 글리프 접근명 오염 0 — 기존 컨벤션).
     - 새 CSS 0 — 기존 클래스(field-hint/btn-primary/btn-sm) + 인라인 style 만.

   단언:
     (A) CompanyPage 배너 배선 — savedCount/onResume prop·(onResume && savedCount>0)
         가드·btn-primary "이어서 작업하기"·→ 글리프 aria-hidden·저장 N건 안내
     (B) TrustApp 배선 — CompanyPage 에 savedCount={savedCount}·onResume=setView contracts
     (C) 무회귀 — company-grid·page-header·기존 onPick·빈 화면 CTA·브레드크럼 배지 보존
     (D) 무접촉 — TrustApp 엔진/검증/산출물 import 무관·globals 새 클래스 0

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-company-resume-banner.mjs
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

console.log("\n[A] CompanyPage 재개 배너 배선 — savedCount/onResume prop·가드·버튼·문구");
{
  ok(/savedCount: number;/.test(app),
     "CompanyPage 가 savedCount: number prop 수신(저장 건수)");
  ok(/onResume\?: \(\) => void;/.test(app),
     "onResume 옵셔널 내비게이션 prop 선언(미전달 시 배너 미렌더 — 후방호환)");
  // CompanyPage 본문 추출 — 함수 정의부터 company-grid 직전까지
  const fnAt = app.indexOf("function CompanyPage(");
  ok(fnAt >= 0, "CompanyPage 함수 정의 존재");
  const gridAt = app.indexOf('<div className="company-grid">', fnAt);
  ok(gridAt > fnAt, "company-grid 렌더 존재(배너는 그 위 page-header 아래)");
  const body = app.slice(fnAt, gridAt);
  ok(/\{onResume && savedCount > 0 && \(/.test(body),
     "배너는 onResume 전달 + savedCount>0 일 때만 렌더(저장 0건·콜백 미전달 미표출)");
  ok(/role="region"/.test(body) && /aria-label="저장된 작업 이어서 하기"/.test(body),
     "배너 컨테이너 role=region + aria-label(저장된 작업 영역 식별)");
  ok(/저장된 계약 <strong>\{savedCount\}건<\/strong>이 있습니다\./.test(body),
     "저장 건수 안내 문구(저장된 계약 N건이 있습니다)");
  ok(/<button className="btn btn-primary btn-sm" onClick=\{onResume\}>/.test(body),
     "재개 버튼 = btn-primary btn-sm·onClick=onResume(뷰 전환 콜백 직결)");
  ok(/이어서 작업하기<span aria-hidden="true"> →<\/span>/.test(body),
     "버튼 문구 \"이어서 작업하기\" + 후미 \"→\" 글리프 aria-hidden(접근명 오염 0)");
  // 배너 버튼 마크업은 파일 전체에 정확히 1개(CompanyPage 한정)
  const btnHits = app.split('이어서 작업하기<span aria-hidden="true"> →</span>').length - 1;
  ok(btnHits === 1, "\"이어서 작업하기\" 버튼 마크업은 파일 전체에 정확히 1개(CompanyPage 한정)");
}

console.log("\n[B] TrustApp 배선 — CompanyPage 에 savedCount·onResume(setView contracts) 전달");
{
  ok(/<CompanyPage[\s\S]{0,200}onPick=\{pickCompany\}/.test(app),
     "CompanyPage 에 기존 onPick=pickCompany 전달 보존");
  ok(/savedCount=\{savedCount\}/.test(app),
     "CompanyPage 에 savedCount={savedCount} 전달(브레드크럼 배지와 동일 단일 출처)");
  ok(/onResume=\{\(\) => setView\("contracts"\)\}/.test(app),
     "onResume = setView(\"contracts\") — 내 계약 뷰 직결(브레드크럼 내 계약 클릭과 동일 의미)");
  // 브레드크럼 내 계약 crumb 도 동일 내비게이션 단일 출처임을 확인(일관성)
  ok(/onClick=\{\(\) => setView\("contracts"\)\}/.test(app),
     "브레드크럼 내 계약 crumb 도 setView(\"contracts\") — 재개 배너와 동일 내비게이션 의미(일관)");
}

console.log("\n[C] 무회귀 — company-grid·page-header·onPick·빈 화면 CTA·브레드크럼 배지 보존");
{
  ok(/<div className="company-grid">/.test(app),
     "신탁사 카드 그리드(company-grid) 렌더 보존");
  ok(/onClick=\{\(\) => c\.ready && onPick\(c\.name\)\}/.test(app),
     "신탁사 카드 onPick(선택) 경로 보존");
  ok(/신탁사를 선택해 주세요/.test(app),
     "CompanyPage 제목(신탁사를 선택해 주세요) 보존");
  ok(/onStart=\{\(\) => setView\(company \? "home" : "company"\)\}/.test(app),
     "내 계약 0건 빈 화면 CTA(onStart, start) 배선 보존");
  ok(/const savedCount = useSyncExternalStore\(subscribeContracts, contractCount, \(\) => 0\);/.test(app),
     "savedCount useSyncExternalStore 단일 출처 보존(브레드크럼 배지와 공유)");
  ok(/<span aria-hidden="true"> \(\{savedCount\}\)<\/span>/.test(app),
     "브레드크럼 \"내 계약 (N)\" 배지 보존(직전 iteration 산출)");
}

console.log("\n[D] 무접촉 — TrustApp 엔진/검증/산출물 무관·globals 새 클래스 0");
{
  ok(!/from "@\/lib\/engine\/validate"/.test(app),
     "TrustApp 에 검증(validate) import 없음(재개 배너는 게이트 무접촉)");
  ok(!/from "@\/lib\/engine\/docx"/.test(app),
     "TrustApp 에 산출물(docx) 생성기 import 없음(재개 배너는 빌더 무접촉)");
  ok(!/\.resume-banner\b/.test(globals),
     "globals 에 재개 배너 전용 클래스(.resume-banner 등) 미추가 — 기존 클래스+인라인만");
  ok(/\.btn-primary \{/.test(globals),
     "재개 버튼이 쓰는 기존 .btn-primary 클래스 존재(재사용)");
  ok(/\.field-hint\b/.test(globals),
     "안내 문구가 쓰는 기존 .field-hint 클래스 존재(재사용)");
}

console.log(`\n${fail === 0 ? "OK" : "FAIL"} — ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
