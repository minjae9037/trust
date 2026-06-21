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
     - /app·/advisor 는 라우트별 openGraph/twitter(제목·설명)도 선언한다 — 종전엔
       og 객체를 루트 layout(브랜드 기본)에서 그대로 상속해 두 라우트의 공유 카드가
       동일했다. 라우트가 자기 openGraph 를 선언하면 상속 객체를 대체하므로
       type·locale·siteName 까지 함께 명시(카드 완결성 보존)하고, og:title 엔
       title.template 이 적용되지 않으므로(Next.js 규약) 브랜드 접미사를 직접 포함한다
       (그 접미사는 루트 template "%s — …" 의 접미사와 verbatim 일치).

   단언:
     (A) /app: type Metadata import + metadata export·title "서류 자동화"·description
     (B) /advisor: 동일·title "대체투자 상담 코파일럿"·description
     (C) /login/layout.tsx: 서버 컴포넌트(use client 부재)·metadata·title "로그인"
     (D) /login/page.tsx: "use client" 보존(클라이언트 컴포넌트 무회귀)
     (E) 루트 layout: title.template "%s — 트러스트폼 TrustForm" 보존
     (F) 라우트 제목/설명 ↔ 랜딩(page.tsx) 문구 verbatim 일치
     (G) /app·/advisor: openGraph/twitter 제목(브랜드 접미사 포함)·설명·완결 필드
     (H) og:title 브랜드 접미사 ↔ 루트 title.template 접미사 verbatim 일치(추정 금지)

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

// 루트 title.template 의 접미사("%s" 뒤 부분) 추출 — og:title 의 브랜드 접미사가
// 이 접미사와 verbatim 일치하는지 검증하기 위함(추정 문구 금지).
function templateSuffix(src) {
  const m = src.match(/template:\s*"%s([^"]*)"/);
  return m ? m[1] : null; // 예: " — 트러스트폼 TrustForm"
}
const SUFFIX = templateSuffix(rootLayout);
const APP_OG_TITLE = APP_TITLE + SUFFIX;
const ADV_OG_TITLE = ADV_TITLE + SUFFIX;
const SITE_NAME = "트러스트폼 TrustForm";

// openGraph/twitter 블록을 거칠게 떼어 내 그 안에서만 단언(상호 오염 방지).
function block(src, key) {
  const i = src.indexOf(key + ":");
  if (i < 0) return "";
  const brace = src.indexOf("{", i);
  if (brace < 0) return "";
  let depth = 0;
  for (let j = brace; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") {
      depth--;
      if (depth === 0) return src.slice(brace, j + 1);
    }
  }
  return "";
}
// 모듈 상수(`const NAME = "리터럴"`) 값 조회 — 페이지가 DRY 로 og/twitter 에서
// 같은 제목/설명을 const 로 재사용하므로 그 값을 풀어 verbatim 단언한다.
function constVal(src, name) {
  const m = src.match(new RegExp("const\\s+" + name + '\\s*=\\s*\\n?\\s*"([^"]+)"'));
  return m ? m[1] : null;
}
// 블록 내 필드값 해석 — 리터럴("...") 또는 const 식별자 모두 실제 문자열로 환원.
function fieldVal(pageSrc, blockKey, field) {
  const b = block(pageSrc, blockKey);
  const m = b.match(new RegExp(field + ':\\s*(?:"([^"]+)"|(\\w+))'));
  if (!m) return null;
  return m[1] != null ? m[1] : constVal(pageSrc, m[2]);
}
function hasLiterals(pageSrc, blockKey, ...needles) {
  const b = block(pageSrc, blockKey);
  return needles.every((n) => b.includes(n));
}

console.log("\n[G] /app·/advisor — 라우트별 openGraph/twitter(제목·설명·완결 필드)");
{
  ok(fieldVal(appPage, "openGraph", "title") === APP_OG_TITLE, `/app og:title === "${APP_OG_TITLE}"`);
  ok(fieldVal(appPage, "openGraph", "description") === APP_DESC, "/app og:description verbatim");
  ok(hasLiterals(appPage, "openGraph", `siteName: "${SITE_NAME}"`, 'type: "website"', 'locale: "ko_KR"'), "/app og 완결 필드(type·locale·siteName)");
  ok(fieldVal(appPage, "twitter", "title") === APP_OG_TITLE && fieldVal(appPage, "twitter", "description") === APP_DESC && hasLiterals(appPage, "twitter", 'card: "summary"'), "/app twitter(card·title·description)");

  ok(fieldVal(advisorPage, "openGraph", "title") === ADV_OG_TITLE, `/advisor og:title === "${ADV_OG_TITLE}"`);
  ok(fieldVal(advisorPage, "openGraph", "description") === ADV_DESC, "/advisor og:description verbatim");
  ok(hasLiterals(advisorPage, "openGraph", `siteName: "${SITE_NAME}"`, 'type: "website"', 'locale: "ko_KR"'), "/advisor og 완결 필드(type·locale·siteName)");
  ok(fieldVal(advisorPage, "twitter", "title") === ADV_OG_TITLE && fieldVal(advisorPage, "twitter", "description") === ADV_DESC && hasLiterals(advisorPage, "twitter", 'card: "summary"'), "/advisor twitter(card·title·description)");

  // ★두 라우트의 og:title 이 서로 다름(공유 카드 식별 — 종전 갭의 핵심)
  ok(APP_OG_TITLE !== ADV_OG_TITLE && fieldVal(appPage, "openGraph", "title") !== fieldVal(advisorPage, "openGraph", "title"), "두 라우트 og:title 상이(공유 카드 라우트 식별)");
}

console.log("\n[H] og:title 브랜드 접미사 ↔ 루트 title.template 접미사 verbatim 일치");
{
  ok(SUFFIX === " — 트러스트폼 TrustForm", `template 접미사 === " — 트러스트폼 TrustForm"(추출: "${SUFFIX}")`);
  // og:title 은 "<라우트 title><template 접미사>" 형태여야 한다(브랜드 접미사 verbatim).
  ok(APP_OG_TITLE.startsWith(APP_TITLE) && APP_OG_TITLE.endsWith(SUFFIX), "/app og:title = 라우트 title + template 접미사");
  ok(ADV_OG_TITLE.startsWith(ADV_TITLE) && ADV_OG_TITLE.endsWith(SUFFIX), "/advisor og:title = 라우트 title + template 접미사");
  // 라우트가 박은 og:title 실제 값이 template 합성 결과와 동일해야 한다(불일치 0).
  ok(fieldVal(appPage, "openGraph", "title") === APP_TITLE + SUFFIX, "/app og:title 값 == template 합성 결과");
  ok(fieldVal(advisorPage, "openGraph", "title") === ADV_TITLE + SUFFIX, "/advisor og:title 값 == template 합성 결과");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
