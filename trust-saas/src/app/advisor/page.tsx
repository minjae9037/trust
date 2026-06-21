import type { Metadata } from "next";
import { AdvisorApp } from "@/components/advisor/AdvisorApp";

// 라우트별 제목/설명 — 루트 layout 의 title.template 이
// "대체투자 상담 코파일럿 — 트러스트폼 TrustForm"으로 적용된다.
// 제목/설명은 랜딩(page.tsx) PILLAR 2·brand-sub 문구와 verbatim 일치.
//
// openGraph/twitter — /app 과 동일 근거(라우트별 공유 카드 식별). 라우트가 자기 openGraph 를
// 선언하면 루트 layout OG(브랜드 기본) 상속 객체를 대체하므로 type·locale·siteName 까지 명시.
// ★og:title 엔 title.template 미적용 → 브랜드 접미사 직접 포함(템플릿 접미사 verbatim 일치).
const DESC =
  "PF·부동산신탁·자산유동화·자본시장법·세무·딜 구조화에 특화된 AI 어드바이저. 대체투자 실무 질문에 즉답.";
const OG_TITLE = "대체투자 상담 코파일럿 — 트러스트폼 TrustForm";

export const metadata: Metadata = {
  title: "대체투자 상담 코파일럿",
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

export default function AdvisorPage() {
  return <AdvisorApp />;
}
