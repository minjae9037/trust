import type { Metadata } from "next";
import "./globals.css";

const APP_NAME = "트러스트폼 TrustForm";
const APP_TITLE = "트러스트폼 TrustForm — 신탁 서류 자동화";
const APP_DESC =
  "TrustForm(트러스트폼) — 신탁 업무 자동화. 토글 또는 자연어 대화로 조건을 정리하고 회사 양식 서류를 자동 생성합니다.";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: { default: APP_TITLE, template: "%s — 트러스트폼 TrustForm" },
  description: APP_DESC,
  // App Router 규약 아이콘(app/icon.svg)을 명시 선언 — 브라우저가 /favicon.ico를
  // 임의 요청(404)하지 않고 선언된 브랜드 아이콘을 사용한다.
  icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: APP_NAME,
    title: APP_TITLE,
    description: APP_DESC,
  },
  twitter: {
    card: "summary",
    title: APP_TITLE,
    description: APP_DESC,
  },
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
