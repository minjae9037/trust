import type { Metadata } from "next";
import { TrustApp } from "@/components/trust/TrustApp";

// 라우트별 제목/설명 — 루트 layout 의 title.template("%s — 트러스트폼 TrustForm")이
// "서류 자동화 — 트러스트폼 TrustForm"으로 적용된다(탭·북마크·검색 스니펫 라우트 식별).
// 제목/설명은 랜딩(page.tsx) PILLAR 1·brand-sub 문구와 verbatim 일치.
//
// openGraph/twitter — 라우트별 공유 카드 식별. 종전엔 라우트가 top-level title/description
// 만 덮어써 og 객체는 루트 layout(브랜드 기본)을 그대로 상속 → /app·/advisor 공유 카드가
// 동일(같은 og:title·og:description)했다. 라우트가 자기 openGraph 를 선언하면 상속 객체를
// 통째로 대체하므로 type·locale·siteName 까지 함께 명시(카드 완결성 보존).
// ★og:title 엔 title.template 이 적용되지 않고(Next.js metadata 규약, 문서 <title> 전용),
//   공유 카드는 탭 맥락이 없으므로 브랜드 접미사를 직접 포함한다(템플릿 접미사 verbatim 일치).
const DESC =
  "담보신탁·공동사업협약 등 표준 서류를 입력 한 번으로 Word·PDF 일괄 생성. OCR 등기부 추출 + 대화형 입력.";
const OG_TITLE = "서류 자동화 — 트러스트폼 TrustForm";

export const metadata: Metadata = {
  title: "서류 자동화",
  description: DESC,
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "트러스트폼 TrustForm",
    title: OG_TITLE,
    description: DESC,
  },
  twitter: {
    card: "summary",
    title: OG_TITLE,
    description: DESC,
  },
};

export default function AppPage() {
  return <TrustApp />;
}
