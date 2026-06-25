/* ============================================================
   회귀 가드 — 홈 랜딩(/) 재개 진입점(HomeResumeEntry)

   배경: 돌아온 사용자(저장된 계약 보유)가 제품에서 가장 먼저 보는 화면은 홈(/)인데,
   종전엔 이 첫 화면에 저장된 작업 신호가 전혀 없어 매번 "서류 자동화" PILLAR(→ /app
   신탁사 선택)부터 다시 들어가 작업을 찾아야 했다(재방문 흐름이 진입점인 홈에서 끊김).
   직전 iteration 들이 /app 내부에서 마감한 재개 흐름 — 브레드크럼 "내 계약 (N)" 배지
   (e4d5a69)·CompanyPage 재개 배너(854caad) — 을 제품의 실제 진입점(홈)으로 끌어올려,
   저장된 계약이 있으면 한 번에 내 계약으로 보낸다(/app?view=contracts 딥링크).

   변경:
     ① src/components/home/HomeResumeEntry.tsx (신규 클라이언트 island) — savedCount =
        useSyncExternalStore(subscribeContracts, contractCount, ()=>0). savedCount===0 →
        null 렌더(첫 방문 무변경). >0 이면 /app?view=contracts 로 가는 Link("저장된 계약
        N건 — 이어서 작업하기 →") 렌더. 브레드크럼 배지·CompanyPage 배너와 동일 단일 출처.
     ② src/app/page.tsx — 히어로 문단과 PILLAR 그리드 사이에 <HomeResumeEntry /> 렌더.
        page.tsx 는 서버 컴포넌트 유지(island 만 클라이언트).
     ③ src/components/trust/TrustApp.tsx — 진입 useEffect 가 ?view=contracts 를 받으면
        setView("contracts") + 주소창 /app 정리. 기존 ?doc 딥링크 보존(early return).

   핵심 불변식:
     - ★표시·내비게이션 전용 — 조문·엔진·검증(validate)·산출물(docx) 무접촉(순수 카운트 + Link).
     - 저장 0건이면 null 렌더(신규 사용자 홈 무변경·후방호환). SSR 스냅샷 0.
     - 시각 글리프(↩·—·→)는 aria-hidden(장식 — 접근명 오염 0). 접근명은 가시 텍스트가 전달.
     - 새 CSS 0 — 기존 토큰(var(--c-paper)/--c-line/--r-lg/--shadow-sm 등) + 인라인 style 만.

   단언:
     (A) HomeResumeEntry island 배선 — "use client"·useSyncExternalStore 단일 출처·
         savedCount===0 → null·/app?view=contracts Link·문구·글리프 aria-hidden
     (B) page.tsx 배선 — import + <HomeResumeEntry /> 렌더·서버 컴포넌트 유지(no "use client")
     (C) TrustApp 딥링크 — ?view=contracts → setView("contracts")·replaceState·기존 ?doc 보존
     (D) 무접촉 — island 에 validate/docx import 없음·globals 새 클래스 0·PILLAR 보존

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-home-resume-entry.mjs
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
const island = read("src", "components", "home", "HomeResumeEntry.tsx");
const page = read("src", "app", "page.tsx");
const group = read("src", "components", "home", "HomeResumeGroup.tsx");
const app = read("src", "components", "trust", "TrustApp.tsx");
const globals = read("src", "app", "globals.css");

console.log("\n[A] HomeResumeEntry island 배선 — 단일출처·null 렌더·딥링크·문구·글리프");
{
  ok(/^"use client";/.test(island),
     "HomeResumeEntry 는 클라이언트 island(\"use client\")");
  ok(/import \{ subscribeContracts, contractCount \} from "@\/lib\/contractRepo";/.test(island),
     "contractRepo 의 subscribeContracts·contractCount import(저장소 단일 출처)");
  ok(/const savedCount = useSyncExternalStore\(subscribeContracts, contractCount, \(\) => 0\);/.test(island),
     "savedCount = useSyncExternalStore(subscribeContracts, contractCount, ()=>0) — 브레드크럼 배지·재개 배너와 동일 출처·SSR 0");
  ok(/if \(savedCount === 0\) return null;/.test(island),
     "저장 0건이면 null 렌더(신규 사용자 홈 무변경·후방호환)");
  ok(/href="\/app\?view=contracts"/.test(island),
     "재개 Link = /app?view=contracts(TrustApp 가 contracts 뷰로 직행하는 딥링크)");
  ok(/저장된 계약 <strong>\{savedCount\}건<\/strong>/.test(island),
     "저장 건수 문구(저장된 계약 N건) — strong 강조");
  ok(/이어서 작업하기/.test(island),
     "행동 유도 문구(이어서 작업하기)");
  // 장식 글리프(↩·—·→)는 전부 aria-hidden — 접근명은 가시 텍스트가 전달
  ok(/<span aria-hidden="true"[^>]*>\s*↩/.test(island),
     "재개 글리프 ↩ 는 aria-hidden(장식 — 접근명 오염 0)");
  ok(/<span aria-hidden="true">— <\/span>/.test(island),
     "구분선 — 은 aria-hidden(앞 실제 공백으로 접근명 띄어 읽힘)");
  ok(/<span aria-hidden="true"[^>]*> →<\/span>/.test(island),
     "후미 → 는 aria-hidden(장식)");
}

console.log("\n[B] 배선 — 묶음(HomeResumeGroup)이 HomeResumeEntry 렌더·page.tsx 가 묶음 렌더(서버 컴포넌트 유지)");
{
  // 계약 축 진입점은 이제 page.tsx 가 아니라 재개 진입점 묶음(HomeResumeGroup)이 렌더한다.
  ok(/import \{ HomeResumeEntry \} from "\.\/HomeResumeEntry";/.test(group),
     "HomeResumeGroup 이 HomeResumeEntry import");
  ok(/<HomeResumeEntry \/>/.test(group),
     "HomeResumeGroup 이 <HomeResumeEntry /> 렌더(계약 축 진입점)");
  // page.tsx 는 묶음만 렌더(서버 컴포넌트 유지) — 묶음이 PILLAR 그리드보다 위에 노출
  ok(/import \{ HomeResumeGroup \} from "@\/components\/home\/HomeResumeGroup";/.test(page),
     "page.tsx 가 HomeResumeGroup import");
  ok(/<HomeResumeGroup \/>/.test(page),
     "page.tsx 가 <HomeResumeGroup /> 렌더(히어로~PILLAR 사이)");
  ok(!/^"use client";/.test(page),
     "page.tsx 는 서버 컴포넌트 유지(island 만 클라이언트 — RSC 경계 보존)");
  const entryAt = page.indexOf("<HomeResumeGroup />");
  const gridAt = page.indexOf('gridTemplateColumns: "1fr 1fr"');
  ok(entryAt >= 0 && gridAt > entryAt,
     "<HomeResumeGroup /> 가 PILLAR 그리드보다 위에 렌더(진입점 상단 노출)");
}

console.log("\n[C] TrustApp 딥링크 — ?view=contracts → contracts 뷰·기존 ?doc 보존");
{
  ok(/params\.get\("view"\) === "contracts"/.test(app),
     "TrustApp 진입 useEffect 가 ?view=contracts 파라미터를 읽음");
  // ?view=contracts 분기가 setView("contracts") + replaceState 로 정리하는지(블록 추출)
  const vAt = app.indexOf('params.get("view") === "contracts"');
  const block = app.slice(vAt, vAt + 200);
  ok(/setView\("contracts"\)/.test(block),
     "?view=contracts → setView(\"contracts\")(내 계약 뷰 직행)");
  ok(/window\.history\.replaceState\(\{\}, "", "\/app"\)/.test(block),
     "딥링크 처리 후 주소창을 깨끗한 /app 으로 정리(replaceState)");
  // 기존 ?doc 딥링크 보존(early return 으로 두 분기 공존)
  ok(/const doc = params\.get\("doc"\);/.test(app),
     "기존 ?doc 딥링크(상담 코파일럿 → 서류) 보존");
  ok(/setView\("category"\);\s*\n\s*window\.history\.replaceState\(\{\}, "", "\/app"\);\s*\n\s*return;/.test(app),
     "?doc 분기는 early return 으로 종료(?view 분기와 공존·간섭 0)");
}

console.log("\n[D] 무접촉 — island 엔진/검증/산출물 무관·globals 새 클래스 0·PILLAR 보존");
{
  ok(!/from "@\/lib\/engine\/validate"/.test(island),
     "HomeResumeEntry 에 검증(validate) import 없음(게이트 무접촉)");
  ok(!/from "@\/lib\/engine\/docx"/.test(island),
     "HomeResumeEntry 에 산출물(docx) 생성기 import 없음(빌더 무접촉)");
  ok(!/\.home-resume\b/.test(globals),
     "globals 에 재개 진입점 전용 클래스 미추가 — 기존 토큰 + 인라인 style 만(새 CSS 0)");
  ok(/eyebrow="PILLAR 1"/.test(page) && /eyebrow="PILLAR 2"/.test(page),
     "홈 PILLAR 1(서류 자동화)·PILLAR 2(상담) 카드 보존(회귀 0)");
  ok(/href="\/app"/.test(page) && /href="\/advisor"/.test(page),
     "PILLAR 링크(/app·/advisor) 보존");
}

console.log(`\n${fail === 0 ? "OK" : "FAIL"} — ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
