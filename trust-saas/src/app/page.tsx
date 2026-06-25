import Link from "next/link";
import { HomeResumeGroup } from "@/components/home/HomeResumeGroup";
import { COLLATERAL_OUTPUT_DOCS } from "@/lib/engine/schema";

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

      {/* 생성되는 서류 — PILLAR 1(서류 자동화)의 산출물을 구체적으로 제시.
          종전 랜딩은 "담보신탁·공동사업협약 등 표준 서류"라고만 안내해, 처음 온
          실무자가 "입력하면 실제로 무엇을 받는지"를 알 수 없었다(첫 사용 가치 제안
          공백). 1차 출시 범위(담보신탁 신규)의 산출 N종을 엔진 단일 출처
          (COLLATERAL_OUTPUT_DOCS)에서 그대로 읽어 이름으로 보여 준다 — 서류가
          추가/변경되면 랜딩이 자동 반영(드리프트 0·개수도 .length 파생). 표시 전용 —
          조문·엔진·검증(validate)·산출물(docx) 생성 로직 무접촉(상수 라벨만 읽음)·새 CSS 0. */}
      <section
        aria-labelledby="home-output-docs-heading"
        style={{
          marginTop: 28,
          padding: "22px 24px",
          border: "1px solid var(--c-line)",
          borderRadius: "var(--r-lg)",
          background: "var(--c-paper)",
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", color: "var(--c-brown)" }}>
          담보신탁 신규 · 1차 출시 범위
        </div>
        <h2
          id="home-output-docs-heading"
          style={{ fontSize: 18, fontWeight: 700, margin: "8px 0 4px", color: "var(--c-ink)", letterSpacing: "-0.01em" }}
        >
          입력 한 번으로 <span style={{ color: "var(--c-blue-deep)" }}>{COLLATERAL_OUTPUT_DOCS.length}종</span> 서류를 한 번에 생성
        </h2>
        <p style={{ fontSize: 13, color: "var(--c-ink-soft)", margin: "0 0 16px", maxWidth: 640 }}>
          관계사·담보물·계약 조건을 한 번 입력하면 아래 표준 서류가 Word(.docx)로 일괄 생성됩니다.
        </p>
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 8,
          }}
        >
          {COLLATERAL_OUTPUT_DOCS.map((d, i) => (
            <li
              key={d.id}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 8,
                fontSize: 13.5,
                color: "var(--c-ink)",
                padding: "6px 0",
              }}
            >
              {/* 번호는 장식(순서 식별 보조) — 의미는 서류명이 전달하므로 aria-hidden. */}
              <span
                aria-hidden="true"
                style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: "var(--c-brown)", minWidth: 20 }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>{d.name}</span>
            </li>
          ))}
        </ul>
      </section>
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
