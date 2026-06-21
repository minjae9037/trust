import type { Metadata } from "next";
import { AdvisorApp } from "@/components/advisor/AdvisorApp";

// 라우트별 제목/설명 — 루트 layout 의 title.template 이
// "대체투자 상담 코파일럿 — 트러스트폼 TrustForm"으로 적용된다.
// 제목/설명은 랜딩(page.tsx) PILLAR 2·brand-sub 문구와 verbatim 일치.
export const metadata: Metadata = {
  title: "대체투자 상담 코파일럿",
  description:
    "PF·부동산신탁·자산유동화·자본시장법·세무·딜 구조화에 특화된 AI 어드바이저. 대체투자 실무 질문에 즉답.",
};

export default function AdvisorPage() {
  return <AdvisorApp />;
}
