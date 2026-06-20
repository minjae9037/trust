"use client";

import Link from "next/link";
import { AdvisorChat } from "./AdvisorChat";

export function AdvisorApp() {
  return (
    <>
      <header className="topbar">
        <Link href="/" className="brand" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="brand-glyph">信託</div>
          <div>
            <div className="brand-name">TrustForm</div>
            <div className="brand-sub">트러스트폼 · 대체투자 상담 코파일럿</div>
          </div>
        </Link>
        <nav className="breadcrumb">
          <span className="crumb active">상담</span>
          <span className="sep">›</span>
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
