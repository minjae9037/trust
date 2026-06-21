import type { Metadata } from "next";

// /login 페이지(page.tsx)는 클라이언트 컴포넌트("use client")라 metadata 를 직접
// 내보낼 수 없다(서버 전용 export). 세그먼트 layout(서버 컴포넌트)에서 라우트 제목/설명을
// 선언하면 루트 layout 의 title.template("%s — 트러스트폼 TrustForm")이
// "로그인 — 트러스트폼 TrustForm"으로 적용된다(탭·북마크·검색 스니펫 라우트 식별).
// layout 은 children 을 그대로 통과시킨다(시각·구조 무변경).
export const metadata: Metadata = {
  title: "로그인",
  description: "트러스트폼 TrustForm 로그인 — 신탁 서류 자동화·상담 플랫폼.",
};

export default function LoginLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
