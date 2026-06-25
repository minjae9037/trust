"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { subscribeContracts, contractCount } from "@/lib/contractRepo";

// 홈 랜딩(/) 재개 진입점 — 돌아온 사용자(저장된 계약 보유)가 제품에서 가장 먼저 보는 화면은
// 홈인데, 종전엔 이 첫 화면에 저장된 작업 신호가 전혀 없어 매번 "서류 자동화" PILLAR(신탁사
// 선택)부터 다시 들어가 작업을 찾아야 했다(재방문 흐름이 정작 진입점인 홈에서 끊김). 직전
// iteration 들이 /app 내부에서 마감한 재개 흐름 — 브레드크럼 "내 계약 (N)" 배지·CompanyPage
// 재개 배너 — 을 제품의 실제 진입점(홈)으로 끌어올려, 저장된 계약이 있으면 한 번에 내 계약으로
// 보낸다(/app?view=contracts 딥링크 → TrustApp 가 contracts 뷰로 직행).
//
// ★표시·내비게이션 전용 — 조문·엔진·검증(validate)·산출물(docx) 무접촉(순수 카운트 + Link).
// ★저장 0건이면 null 렌더 — 신규 사용자(첫 방문) 홈 화면 무변경·후방호환. getSnapshot 의 SSR
//   스냅샷 0(서버엔 localStorage 부재)이라 서버 HTML 에도 없고, 하이드레이션 후 저장이 있을 때만
//   나타난다(첫 방문엔 클라이언트에서도 0 → 계속 미표출).
// ★브레드크럼 배지·CompanyPage 재개 배너와 동일 단일 출처(useSyncExternalStore(subscribeContracts,
//   contractCount)) — 모든 변형(저장·삭제·가져오기)이 writeAll 단일 경로를 지나 어디서도 어긋나지
//   않는다(staleness 0). 다른 탭의 저장 변경도 subscribeContracts 의 storage 이벤트로 반영된다.
export function HomeResumeEntry() {
  const savedCount = useSyncExternalStore(subscribeContracts, contractCount, () => 0);
  if (savedCount === 0) return null;
  return (
    <Link
      href="/app?view=contracts"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 9,
        padding: "11px 16px",
        textDecoration: "none",
        background: "var(--c-paper)",
        border: "1px solid var(--c-line)",
        borderRadius: "var(--r-lg)",
        boxShadow: "var(--shadow-sm)",
        color: "var(--c-ink)",
        fontSize: 14,
        fontWeight: 600,
      }}
    >
      {/* ↩ = 재개 장식 글리프(순수 시각) — 접근명은 이어지는 텍스트가 전달하므로 aria-hidden. */}
      <span aria-hidden="true" style={{ color: "var(--c-brown)", fontSize: 15 }}>
        ↩
      </span>
      <span>
        {/* 가시 구분선(—)은 장식이라 aria-hidden 이지만, 그 앞 실제 공백({" "})은 노출돼
            접근명이 "저장된 계약 N건 이어서 작업하기"로 자연스럽게 띄어 읽힌다(N건↔이어서 붙음 방지). */}
        저장된 계약 <strong>{savedCount}건</strong>{" "}
        <span aria-hidden="true">— </span>이어서 작업하기
        <span aria-hidden="true" style={{ color: "var(--c-blue-deep)" }}> →</span>
      </span>
    </Link>
  );
}
