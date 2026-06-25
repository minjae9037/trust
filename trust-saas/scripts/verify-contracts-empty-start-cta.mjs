/* ============================================================
   회귀 가드 — 내 계약 0건 빈 화면 "새 계약 작성하기" 1차 CTA

   배경: 내 계약(ContractsView)의 계약 0건 빈 화면은 종전엔 안내 문구 한 줄
   ("아직 저장된 계약이 없습니다…")뿐인 막다른 화면이었다. 첫 진입·캐시 삭제 등
   계약이 하나도 없을 때(=신규 사용자가 처음 보는 화면)가 정작 "작성을 시작"해야 할
   순간인데, 그 자리에서 바로 새 계약 작성으로 갈 길이 없어 상단 breadcrumb 로
   되돌아가야 했다(첫 사용 흐름 단절). 안내 문구에 더해 btn-primary "새 계약 작성하기"
   CTA 를 둬, ContractsView 가 받은 onStart 내비게이션 콜백으로 서류/신탁사 선택 화면으로
   보낸다(TrustApp: 신탁사가 정해졌으면 home=서류 선택, 아니면 company=신탁사 선택 —
   goBack 의 contracts 분기 `setView(company ? "home" : "company")` 와 동일 의미).

   핵심 불변식:
     - ★표시·내비게이션 전용 — 조문·엔진·검증(validate)·산출물(docx) 무접촉.
       onStart 는 뷰 전환 콜백일 뿐 어떤 폼 데이터/게이트/빌더에도 영향 0.
     - CTA 는 계약 0건(rows.length === 0) 빈 화면에만 렌더한다(목록이 있으면 미표출).
     - onStart 미전달 시 버튼 미렌더(후방호환) — 옵셔널 prop.
     - 선두 "+" 글리프는 aria-hidden(장식 글리프 접근명 오염 0 — 기존 컨벤션).
     - 새 CSS 0 — 기존 클래스(btn-primary/btn-sm/field-hint) + 인라인 style 만.

   단언:
     (A) ContractsView 빈 화면 CTA 배선 — onStart 옵셔널 prop·rows===0 분기 내 버튼·
         onClick=onStart·btn-primary·문구·+ 글리프 aria-hidden·안내 문구 유지
     (B) TrustApp 배선 — ContractsView 에 onStart 전달 + company?home:company 내비게이션
     (C) 무회귀 — onOpen prop·toolbar(rows>0 게이트)·필터 빈 결과 안내·카드 목록 보존
     (D) 무접촉 — onStart 는 내비게이션 전용(validate/docx import 무변경)·globals 새 클래스 0

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-contracts-empty-start-cta.mjs
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
const view = read("src", "components", "trust", "ContractsView.tsx");
const app = read("src", "components", "trust", "TrustApp.tsx");
const globals = read("src", "app", "globals.css");

console.log("\n[A] ContractsView 빈 화면 CTA 배선 — onStart 옵셔널 prop·rows===0 분기·버튼·문구");
{
  ok(/onStart\?: \(\) => void;/.test(view),
     "onStart 옵셔널 내비게이션 prop 선언(미전달 시 CTA 미렌더 — 후방호환)");
  // 계약 0건 빈 화면 블록 추출
  const at = view.indexOf("!loading && !err && rows.length === 0");
  ok(at >= 0, "rows.length === 0 빈 화면 분기 존재");
  const block = view.slice(at, at + 700);
  ok(/\{onStart && \(/.test(block),
     "CTA 는 onStart 전달 시에만 렌더(옵셔널 가드)");
  ok(/<button className="btn btn-primary btn-sm" onClick=\{onStart\}>/.test(block),
     "CTA 버튼 = btn-primary btn-sm·onClick=onStart(뷰 전환 콜백 직결)");
  ok(/<span aria-hidden="true">\+ <\/span>새 계약 작성하기/.test(block),
     "버튼 문구 \"새 계약 작성하기\" + 선두 \"+\" 글리프 aria-hidden(접근명 오염 0)");
  ok(/아직 저장된 계약이 없습니다\./.test(block),
     "기존 안내 문구 유지(빈 화면 설명 보존)");
  // CTA 버튼은 0건 분기 안에 정확히 1개만 — 목록(visible 카드)·다른 곳엔 없어야 한다.
  // (라벨 문구는 상단 설명 주석에도 등장하므로, 버튼 마크업 고유 패턴으로 셈해 오탐 차단.)
  const btnHits = view.split('<span aria-hidden="true">+ </span>새 계약 작성하기').length - 1;
  ok(btnHits === 1, "\"새 계약 작성하기\" CTA 버튼 마크업은 파일 전체에 정확히 1개(rows===0 빈 화면 한정·목록 시 미표출)");
  const btnAt = view.indexOf('<span aria-hidden="true">+ </span>새 계약 작성하기');
  ok(btnAt > at && btnAt < at + 700, "그 CTA 버튼이 rows===0 빈 화면 분기 블록 안에 위치");
}

console.log("\n[B] TrustApp 배선 — ContractsView 에 onStart 전달 + company?home:company 내비게이션");
{
  ok(/<ContractsView\s+onOpen=\{openContract\}/.test(app),
     "ContractsView 에 기존 onOpen=openContract 전달 보존");
  ok(/onStart=\{\(\) => setView\(company \? "home" : "company"\)\}/.test(app),
     "onStart = 신탁사 정해졌으면 home(서류 선택)·아니면 company(신탁사 선택) — goBack contracts 분기와 동일 의미");
  // goBack 의 contracts 분기가 동일 내비게이션 의미의 단일 출처임을 확인(일관성)
  ok(/view === "contracts"\) setView\(company \? "home" : "company"\)/.test(app),
     "goBack contracts 분기도 company?home:company — CTA 와 동일 내비게이션 의미(일관)");
}

console.log("\n[C] 무회귀 — onOpen·toolbar(rows>0 게이트)·필터 빈 결과 안내·카드 목록 보존");
{
  ok(/onOpen: \(row: ContractRow\) => void;/.test(view),
     "onOpen prop 계약 보존(카드 열기 경로 무변경)");
  ok(/!loading && !err && rows\.length > 0 && \(\s*<div className="contracts-toolbar">/.test(view),
     "검색·필터 toolbar 는 rows>0 일 때만(0건 빈 화면과 분리) 보존");
  ok(/rows\.length > 0 && visible\.length === 0 && \(/.test(view),
     "검색·필터 결과 0건(목록은 있으나 매칭 0) 안내 분기 보존 — 0건 빈 화면과 별개");
  ok(/조건에 맞는 계약이 없습니다 — 검색어나 상태 필터를 바꿔 보세요\./.test(view),
     "필터 빈 결과 안내 문구 보존");
  ok(/\{visible\.map\(\(r\) => \{/.test(view),
     "계약 카드 목록 렌더 경로 보존(visible.map)");
}

console.log("\n[D] 무접촉 — onStart 내비게이션 전용·globals 새 클래스 0");
{
  // onStart 는 setView 콜백일 뿐 — CTA 의 무접촉 의도 = 검증 '게이트' 함수가 그대로라는 것
  // (import 줄 바이트 동일성이 아님). 무관 기능이 같은 validate 모듈에서 타입(type Missing
  // 등)을 추가 import 해도 내성 있게 — 두 게이트 함수 동시 존재만 단언한다(docx 완화와 동형).
  ok(/import \{[^}]*\bvalidateDoc\b[^}]*\bvalidateJoint\b[^}]*\} from "@\/lib\/engine\/validate";/.test(view),
     "validate 게이트(validateDoc·validateJoint) import 보존 — CTA 는 검증 판정 무접촉");
  // CTA 의 무접촉 의도 = 산출물 '생성기' 가 그대로라는 것(import 줄 바이트 동일성이 아님).
  // 무관 기능이 같은 docx 모듈에서 표시용 함수(previewDocHTML 등)를 추가 import 해도
  // 내성 있게 — 두 생성기 동시 존재만 단언한다(09:09 react import 완화와 동형).
  ok(/import \{[^}]*\bgenerateCollateralDoc\b[^}]*\bgenerateJointDoc\b[^}]*\} from "@\/lib\/engine\/docx";/.test(view),
     "docx 생성기(generateCollateralDoc·generateJointDoc) import 보존 — CTA 는 산출물 빌더 무접촉");
  // 새 CSS 클래스 0 — 빈 화면 CTA 는 기존 btn-primary/btn-sm + 인라인 style 만 사용
  ok(!/\.contracts-empty\b/.test(globals),
     "globals 에 신규 빈 화면 전용 클래스(.contracts-empty 등) 미추가 — 기존 클래스+인라인만");
  ok(/\.btn-primary \{/.test(globals),
     "CTA 가 쓰는 기존 .btn-primary 클래스 존재(재사용)");
}

console.log(`\n${fail === 0 ? "OK" : "FAIL"} — ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
