import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "트러스트폼 TrustForm — 신탁 서류 자동화",
  description:
    "TrustForm(트러스트폼) — 신탁 업무 자동화. 토글 또는 자연어 대화로 조건을 정리하고 회사 양식 서류를 자동 생성합니다.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
