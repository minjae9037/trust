/* ============================================================
   회귀 가드 — 홈 랜딩(/) 재개 진입점 묶음(HomeResumeGroup)

   배경: 직전 iteration 들이 서류(계약) 축(HomeResumeEntry → /app?view=contracts)·
   상담 축(HomeAdvisorResumeEntry → /advisor?resume=1) 두 재개 진입점을 홈에 모두
   올렸으나, page.tsx 의 라벨 없는 맨 flex 컬럼에 두 pill 만 쌓여 (a) 무슨 묶음인지
   안내가 없고 (b) 두 island 을 감싸던 컨테이너 <div>(marginTop:28)가 서버 컴포넌트
   page.tsx 에 항상 렌더돼 첫 방문자(두 island 모두 null)에게도 빈 컨테이너가 남았다.

   변경:
     ① src/components/home/HomeResumeGroup.tsx (신규 클라이언트 island) — 두 저장소
        (contractRepo·sessionRepo)를 함께 구독. savedCount===0 && !hasSession → null
        (묶음 전체 미렌더 = 첫 방문 홈 무변경·빈 컨테이너 제거). 하나라도 있으면
        "이어서 하기" 라벨 region(role=region·aria-labelledby) 아래 두 진입점 렌더.
     ② src/app/page.tsx — 종전 맨 <div> + 두 island 직접 렌더를 <HomeResumeGroup /> 로
        교체(서버 컴포넌트 유지·PILLAR 그리드 위).

   핵심 불변식:
     - ★표시·내비게이션 전용 — 조문·엔진·검증(validate)·산출물(docx) 무접촉.
     - 저장된 작업이 하나도 없으면 묶음 전체 null(첫 방문 무변경·라벨만 뜨는 빈 묶음 방지).
     - 두 자식은 각자 자기 저장소를 구독해 독립 null 게이트 — 묶음은 라벨 + "최소 하나
       존재" 게이트만 더한다(각 island 과 동일 단일 출처 contractRepo·sessionRepo).
     - 라벨은 h2(접근명은 region 의 aria-labelledby 가 가리키는 가시 텍스트가 전달).
     - 새 CSS 0 — 기존 토큰 + 인라인 style 만.

   단언:
     (A) 묶음 island 배선 — "use client"·두 저장소 구독(단일 출처)·복합 null 게이트·
         region+aria-labelledby 라벨 h2·두 자식 렌더
     (B) page.tsx 배선 — import + <HomeResumeGroup /> 렌더·서버 컴포넌트 유지·그리드 위·
         종전 맨 <div> 직접 렌더 제거(빈 컨테이너 회귀 방지)
     (C) 무접촉 — 묶음에 validate/docx/엔진 import 없음·globals 새 클래스 0·PILLAR 보존

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-home-resume-group.mjs
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
const group = read("src", "components", "home", "HomeResumeGroup.tsx");
const page = read("src", "app", "page.tsx");
const globals = read("src", "app", "globals.css");

console.log("\n[A] HomeResumeGroup island 배선 — 두 저장소 구독·복합 게이트·라벨 region·두 자식");
{
  ok(/^"use client";/.test(group),
     "HomeResumeGroup 은 클라이언트 island(\"use client\")");
  ok(/import \{ subscribeContracts, contractCount \} from "@\/lib\/contractRepo";/.test(group),
     "contractRepo 구독 import(계약 축 단일 출처)");
  ok(/import \{ subscribeSession, hasSavedSession \} from "@\/lib\/advisor\/sessionRepo";/.test(group),
     "sessionRepo 구독 import(상담 축 단일 출처)");
  ok(/const savedCount = useSyncExternalStore\(subscribeContracts, contractCount, \(\) => 0\);/.test(group),
     "savedCount = useSyncExternalStore(subscribeContracts, contractCount, ()=>0) — 계약 축 동일 출처·SSR 0");
  ok(/const hasSession = useSyncExternalStore\(subscribeSession, hasSavedSession, \(\) => false\);/.test(group),
     "hasSession = useSyncExternalStore(subscribeSession, hasSavedSession, ()=>false) — 상담 축 동일 출처·SSR false");
  ok(/if \(savedCount === 0 && !hasSession\) return null;/.test(group),
     "복합 null 게이트 — 저장된 작업이 하나도 없으면 묶음 전체 미렌더(첫 방문 무변경·빈 묶음 방지)");
  ok(/role="region"/.test(group) && /aria-labelledby="home-resume-heading"/.test(group),
     "묶음은 role=region + aria-labelledby(라벨 h2 가 region 접근명 제공)");
  ok(/<h2\s+id="home-resume-heading"/.test(group) && /이어서 하기/.test(group),
     "라벨 h2(id=home-resume-heading) \"이어서 하기\"(가시 텍스트가 접근명 전달)");
  ok(/<HomeResumeEntry \/>/.test(group),
     "묶음이 계약 축 진입점(<HomeResumeEntry />) 렌더");
  ok(/<HomeAdvisorResumeEntry \/>/.test(group),
     "묶음이 상담 축 진입점(<HomeAdvisorResumeEntry />) 렌더");
  ok(/import \{ HomeResumeEntry \} from "\.\/HomeResumeEntry";/.test(group) &&
     /import \{ HomeAdvisorResumeEntry \} from "\.\/HomeAdvisorResumeEntry";/.test(group),
     "두 자식 island import(묶음이 두 진입점을 한데 모음)");
}

console.log("\n[B] page.tsx 배선 — <HomeResumeGroup /> 렌더·서버 컴포넌트 유지·그리드 위·맨 div 제거");
{
  ok(/import \{ HomeResumeGroup \} from "@\/components\/home\/HomeResumeGroup";/.test(page),
     "page.tsx 가 HomeResumeGroup import");
  ok(/<HomeResumeGroup \/>/.test(page),
     "page.tsx 가 <HomeResumeGroup /> 렌더");
  ok(!/^"use client";/.test(page),
     "page.tsx 는 서버 컴포넌트 유지(island 만 클라이언트 — RSC 경계 보존)");
  // 종전 두 island 을 직접 렌더하던 맨 컨테이너는 제거 — page.tsx 에는 더 이상 두 진입점이
  // 직접 등장하지 않아야 한다(빈 컨테이너가 첫 방문자에게 항상 렌더되던 회귀 방지).
  ok(!/<HomeResumeEntry \/>/.test(page) && !/<HomeAdvisorResumeEntry \/>/.test(page),
     "page.tsx 가 두 진입점을 직접 렌더하지 않음(묶음으로 이관 — 빈 컨테이너 회귀 방지)");
  const groupAt = page.indexOf("<HomeResumeGroup />");
  const gridAt = page.indexOf('gridTemplateColumns: "1fr 1fr"');
  ok(groupAt >= 0 && gridAt > groupAt,
     "<HomeResumeGroup /> 가 PILLAR 그리드보다 위에 렌더(진입점 상단 노출)");
}

console.log("\n[C] 무접촉 — 묶음 엔진/검증/산출물 무관·globals 새 클래스 0·PILLAR 보존");
{
  ok(!/from "@\/lib\/engine\//.test(group),
     "HomeResumeGroup 에 엔진(조문/검증/산출물) import 없음(표시·내비게이션 전용)");
  ok(!/\.home-resume-group\b/.test(globals),
     "globals 에 묶음 전용 클래스 미추가 — 기존 토큰 + 인라인 style 만(새 CSS 0)");
  ok(/eyebrow="PILLAR 1"/.test(page) && /eyebrow="PILLAR 2"/.test(page),
     "홈 PILLAR 1(서류 자동화)·PILLAR 2(상담) 카드 보존(회귀 0)");
}

console.log(`\n${fail === 0 ? "OK" : "FAIL"} — ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
