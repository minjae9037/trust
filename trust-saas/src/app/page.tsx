import Link from "next/link";
import { HomeResumeGroup } from "@/components/home/HomeResumeGroup";

export default function Home() {
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "72px 24px" }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.14em",
          color: "var(--c-brown)",
          textTransform: "uppercase",
        }}
      >
        TrustForm · 트러스트폼 — 신탁 업무 자동화 플랫폼
      </div>
      <h1 style={{ fontSize: 36, fontWeight: 800, margin: "12px 0 14px", letterSpacing: "-0.02em", lineHeight: 1.25 }}>
        대체투자 실무를 위한
        <br />
        AI 서류 자동화 · 상담 플랫폼
      </h1>
      <p style={{ color: "var(--c-ink-soft)", fontSize: 16, maxWidth: 640 }}>
        신탁사·시행사·시공사·증권사 실무자를 위한 도구. 토글 또는 자연어 대화로 표준 서류를
        자동 생성하고, 대체투자 전문 AI에게 PF·신탁·딜 구조화를 상담하세요.
      </p>

      {/* 재방문 재개 진입점 묶음(서류·상담 두 축) — HomeResumeGroup island 이 저장된 작업이
          하나라도 있는 사용자에게만 "이어서 하기" 라벨 region 아래 두 진입점을 렌더한다(첫
          방문엔 묶음 전체가 null → 화면 무변경·빈 컨테이너 없음). 표시·내비게이션 전용. */}
      <HomeResumeGroup />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 40 }}>
        <Pillar
          href="/app"
          eyebrow="PILLAR 1"
          title="서류 자동화"
          desc="담보신탁·공동사업협약 등 표준 서류를 입력 한 번으로 Word·PDF 일괄 생성. OCR 등기부 추출 + 대화형 입력."
          cta="서류 만들기 →"
        />
        <Pillar
          href="/advisor"
          eyebrow="PILLAR 2"
          title="대체투자 상담 코파일럿"
          desc="PF·부동산신탁·자산유동화·자본시장법·세무·딜 구조화에 특화된 AI 어드바이저. 대체투자 실무 질문에 즉답."
          cta="상담 시작 →"
        />
      </div>
    </main>
  );
}

function Pillar({
  href,
  eyebrow,
  title,
  desc,
  cta,
}: {
  href: string;
  eyebrow: string;
  title: string;
  desc: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "block",
        textDecoration: "none",
        color: "inherit",
        background: "var(--c-paper)",
        border: "1px solid var(--c-line)",
        borderRadius: "var(--r-lg)",
        padding: "26px 24px",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", color: "var(--c-brown)" }}>
        {eyebrow}
      </div>
      <div style={{ fontSize: 21, fontWeight: 700, margin: "8px 0 10px", color: "var(--c-ink)" }}>{title}</div>
      <p style={{ fontSize: 13.5, color: "var(--c-ink-soft)", lineHeight: 1.55, minHeight: 60 }}>{desc}</p>
      <div style={{ marginTop: 12, fontWeight: 700, color: "var(--c-blue-deep)", fontSize: 14 }}>{cta}</div>
    </Link>
  );
}
