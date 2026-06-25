"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { subscribeSession, hasSavedSession } from "@/lib/advisor/sessionRepo";

// 홈 랜딩(/) 상담 재개 진입점 — 돌아온 사용자가 제품에서 가장 먼저 보는 화면은 홈인데,
// 직전 iteration 들이 마감한 재개 흐름은 모두 "서류(계약)" 축이었다(HomeResumeEntry =
// 저장된 계약 → /app?view=contracts). 상담(/advisor)도 진행 중 대화를 sessionRepo
// (localStorage)에 영속하고 /advisor?resume=1 로 즉시 복원하는데, 정작 홈에는 그 신호가
// 전혀 없어 상담을 이어가려는 사용자도 PILLAR 2(상담)부터 다시 들어가 빈 상태에서 "이어서
// 대화하기"를 눌러야 했다(재방문 묶음의 "남은 한 축" = 상담). 저장된 상담이 있으면 홈에서
// 한 번에 직전 대화로 보낸다(/advisor?resume=1 → AdvisorChat 가 즉시 복원).
//
// ★표시·내비게이션 전용 — 페르소나(system)·검색(retrieve)·로깅(log)·산출물 무접촉
//   (순수 boolean + Link). HomeResumeEntry(계약 축)와 동형의 상담 축 진입점.
// ★저장본 없으면 null 렌더 — 신규 사용자(첫 방문) 홈 화면 무변경·후방호환. getSnapshot 의
//   SSR 스냅샷 false(서버엔 localStorage 부재)라 서버 HTML 에도 없고, 하이드레이션 후
//   저장된 상담이 있을 때만 나타난다(첫 방문엔 클라이언트에서도 false → 계속 미표출).
// ★AdvisorChat 의 빈 상태 "이어서 대화하기" 진입점과 동일 단일 출처(sessionRepo) — 저장·
//   비움(clearSession)이 모두 sessionRepo 단일 경로를 지나 어디서도 어긋나지 않는다
//   (staleness 0). 다른 탭의 변경도 subscribeSession 의 storage 이벤트로 반영된다.
export function HomeAdvisorResumeEntry() {
  const hasSession = useSyncExternalStore(subscribeSession, hasSavedSession, () => false);
  if (!hasSession) return null;
  return (
    <Link
      href="/advisor?resume=1"
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
      {/* 💬 = 상담 장식 글리프(순수 시각) — 접근명은 이어지는 텍스트가 전달하므로 aria-hidden. */}
      <span aria-hidden="true" style={{ fontSize: 15 }}>
        💬
      </span>
      <span>
        {/* 가시 구분선(—)은 장식이라 aria-hidden 이지만, 그 앞 실제 공백({" "})은 노출돼
            접근명이 "진행 중이던 상담 이어서 대화하기"로 자연스럽게 띄어 읽힌다. */}
        진행 중이던 상담{" "}
        <span aria-hidden="true">— </span>이어서 대화하기
        <span aria-hidden="true" style={{ color: "var(--c-blue-deep)" }}> →</span>
      </span>
    </Link>
  );
}
