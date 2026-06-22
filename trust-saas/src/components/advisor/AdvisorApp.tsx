"use client";

import Link from "next/link";
import { AdvisorChat } from "./AdvisorChat";

export function AdvisorApp() {
  return (
    <>
      <header className="topbar">
        <Link href="/" className="brand" style={{ textDecoration: "none", color: "inherit" }}>
          {/* 信託 = 브랜드 장식 글리프(순수 시각). 이 Link 는 aria-label 이 없어
              접근명이 콘텐츠에서 계산되는데, 글리프가 첫 텍스트라 SR 이 링크 이름을
              "信託 TrustForm…"(한자=신탁/중국어 독음)으로 낭독해 접근명을 오염시킨다.
              바로 옆 brand-name(TrustForm)이 의미를 전달하므로 글리프는 aria-hidden 으로
              가시 표시는 유지하고 접근명/낭독에서만 제외(advisor-empty-glyph 동형). */}
          <div className="brand-glyph" aria-hidden="true">信託</div>
          <div>
            <div className="brand-name">TrustForm</div>
            <div className="brand-sub">트러스트폼 · 대체투자 상담 코파일럿</div>
          </div>
        </Link>
        <nav className="breadcrumb">
          <span className="crumb active">상담</span>
          <span className="sep" aria-hidden="true">›</span>
          <Link href="/app" className="crumb" style={{ textDecoration: "none" }}>
            서류 자동화 →
          </Link>
        </nav>
      </header>
      <div className="back-bar">
        <Link href="/" className="back-btn" style={{ textDecoration: "none" }}>
          ‹ 이전 (홈)
        </Link>
      </div>
      <main className="advisor-page">
        <AdvisorChat />
      </main>
    </>
  );
}
