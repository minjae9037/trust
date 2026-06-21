/* ============================================================
   회귀 가드 — 라우트별 페이지 메타데이터(제목/설명) 적용

   배경(브랜드·SEO·탭 식별 갭): 루트 layout(app/layout.tsx)은
   title.template = "%s — 트러스트폼 TrustForm" 을 선언하지만, 종전엔
   어떤 하위 라우트도 자기 title 을 내보내지 않아 **template 이 한 번도
   적용되지 않았다**. 결과로 /, /app, /advisor, /login 모두 동일한
   기본 제목("트러스트폼 TrustForm — 신탁 서류 자동화")과 동일한 meta
   description 을 렌더 → ① 브라우저 탭/북마크가 전부 같은 이름이라 구분
   불가 ② 검색 스니펫이 라우트별로 동일했다.

   이제 서버 컴포넌트 라우트(/app·/advisor)는 자기 metadata(title·
   description)를 내보내고, 클라이언트 컴포넌트인 /login 은 세그먼트
   layout(login/layout.tsx, 서버 컴포넌트)에서 metadata 를 선언한다.
   각 title 은 문자열이라 루트 template 이 "<제목> — 트러스트폼 TrustForm"
   으로 합성한다. 제목/설명은 랜딩(app/page.tsx) PILLAR·brand-sub 문구와
   verbatim 일치(추정 문구 금지·정확성 원칙).

   핵심 불변식:
     - /app·/advisor 페이지가 metadata(title·description)를 export 한다.
     - /login 은 page 가 아니라 layout(서버 컴포넌트)에서 metadata 를 export.
     - /login page 는 여전히 클라이언트 컴포넌트("use client")다(분리 정합).
     - 루트 layout 의 title.template 은 보존된다(라우트 제목에 브랜드 접미사).
     - 라우트 제목/설명이 랜딩 문구와 일치한다.

   단언:
     (A) /app: type Metadata import + metadata export·title "서류 자동화"·description
     (B) /advisor: 동일·title "대체투자 상담 코파일럿"·description
     (C) /login/layout.tsx: 서버 컴포넌트(use client 부재)·metadata·title "로그인"
     (D) /login/page.tsx: "use client" 보존(클라이언트 컴포넌트 무회귀)
     (E) 루트 layout: title.template "%s — 트러스트폼 TrustForm" 보존
     (F) 라우트 제목/설명 ↔ 랜딩(page.tsx) 문구 verbatim 일치

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-route-metadata.mjs
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
const appDir = join(__dir, "..", "src", "app");
const read = (rel) => readFileSync(join(appDir, rel), "utf8");

const appPage = read("app/page.tsx");
const advisorPage = read("advisor/page.tsx");
const loginLayout = read("login/layout.tsx");
const loginPage = read("login/page.tsx");
const rootLayout = read("layout.tsx");
const landing = read("page.tsx");

const APP_TITLE = "서류 자동화";
const APP_DESC =
  "담보신탁·공동사업협약 등 표준 서류를 입력 한 번으로 Word·PDF 일괄 생성. OCR 등기부 추출 + 대화형 입력.";
const ADV_TITLE = "대체투자 상담 코파일럿";
const ADV_DESC =
  "PF·부동산신탁·자산유동화·자본시장법·세무·딜 구조화에 특화된 AI 어드바이저. 대체투자 실무 질문에 즉답.";
const LOGIN_TITLE = "로그인";

// metadata.title 추출(문자열 리터럴): `title: "..."`
function metaTitle(src) {
  const m = src.match(/title:\s*"([^"]+)"/);
  return m ? m[1] : null;
}
function hasMetadataExport(src) {
  return /export\s+const\s+metadata\s*:\s*Metadata\s*=/.test(src);
}
function importsMetadataType(src) {
  return /import\s+type\s+\{\s*Metadata\s*\}\s+from\s+"next"/.test(src);
}

console.log("\n[A] /app 페이지 — metadata(title 서류 자동화·description)");
{
  ok(importsMetadataType(appPage), "type { Metadata } from 'next' import");
  ok(hasMetadataExport(appPage), "export const metadata: Metadata");
  ok(metaTitle(appPage) === APP_TITLE, `title === "${APP_TITLE}"`);
  ok(appPage.includes(APP_DESC), "description 문구 포함");
  ok(/return <TrustApp \/>;/.test(appPage), "TrustApp 렌더 보존(무회귀)");
}

console.log("\n[B] /advisor 페이지 — metadata(title 대체투자 상담 코파일럿·description)");
{
  ok(importsMetadataType(advisorPage), "type { Metadata } import");
  ok(hasMetadataExport(advisorPage), "export const metadata: Metadata");
  ok(metaTitle(advisorPage) === ADV_TITLE, `title === "${ADV_TITLE}"`);
  ok(advisorPage.includes(ADV_DESC), "description 문구 포함");
  ok(/return <AdvisorApp \/>;/.test(advisorPage), "AdvisorApp 렌더 보존(무회귀)");
}

console.log("\n[C] /login/layout.tsx — 서버 컴포넌트 세그먼트 layout 에서 metadata");
{
  ok(importsMetadataType(loginLayout), "type { Metadata } import");
  ok(hasMetadataExport(loginLayout), "export const metadata: Metadata");
  ok(metaTitle(loginLayout) === LOGIN_TITLE, `title === "${LOGIN_TITLE}"`);
  // 주석 안 "use client" 언급이 아니라 실제 디렉티브 라인(줄머리·세미콜론)만 검사
  ok(!/^\s*["']use client["'];/m.test(loginLayout), "layout 은 'use client' 디렉티브 부재(서버 컴포넌트라야 metadata export 유효)");
  ok(/return children;/.test(loginLayout), "children 그대로 통과(시각·구조 무변경)");
}

console.log("\n[D] /login/page.tsx — 클라이언트 컴포넌트 무회귀");
{
  ok(/^["']use client["'];/m.test(loginPage), "page 는 'use client' 보존(metadata 는 layout 으로 분리)");
  ok(!hasMetadataExport(loginPage), "page 는 metadata 미export(클라이언트 컴포넌트라 무효 — layout 이 담당)");
}

console.log("\n[E] 루트 layout — title.template 보존(라우트 제목에 브랜드 접미사)");
{
  ok(/template:\s*"%s — 트러스트폼 TrustForm"/.test(rootLayout), "title.template '%s — 트러스트폼 TrustForm' 보존");
  ok(/default:\s*APP_TITLE/.test(rootLayout) || /default:/.test(rootLayout), "title.default 보존(홈 기본 제목)");
}

console.log("\n[F] 라우트 제목/설명 ↔ 랜딩(page.tsx) 문구 verbatim 일치(추정 문구 금지)");
{
  // 랜딩 PILLAR 1/2 title 과 라우트 title 일치
  ok(landing.includes(`title="${APP_TITLE}"`), `랜딩 PILLAR 1 title 과 /app title 일치("${APP_TITLE}")`);
  ok(landing.includes(`title="${ADV_TITLE}"`), `랜딩 PILLAR 2 title 과 /advisor title 일치("${ADV_TITLE}")`);
  // 랜딩 PILLAR desc 과 라우트 description 일치
  ok(landing.includes(APP_DESC), "랜딩 PILLAR 1 desc 과 /app description verbatim 일치");
  ok(landing.includes(ADV_DESC), "랜딩 PILLAR 2 desc 과 /advisor description verbatim 일치");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
