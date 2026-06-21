import type { Metadata } from "next";
import { TrustApp } from "@/components/trust/TrustApp";

// 라우트별 제목/설명 — 루트 layout 의 title.template("%s — 트러스트폼 TrustForm")이
// "서류 자동화 — 트러스트폼 TrustForm"으로 적용된다(탭·북마크·검색 스니펫 라우트 식별).
// 제목/설명은 랜딩(page.tsx) PILLAR 1·brand-sub 문구와 verbatim 일치.
export const metadata: Metadata = {
  title: "서류 자동화",
  description:
    "담보신탁·공동사업협약 등 표준 서류를 입력 한 번으로 Word·PDF 일괄 생성. OCR 등기부 추출 + 대화형 입력.",
};

export default function AppPage() {
  return <TrustApp />;
}
