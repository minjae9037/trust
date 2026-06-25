"use client";

import { useSyncExternalStore } from "react";
import { subscribeContracts, contractCount } from "@/lib/contractRepo";
import { subscribeSession, hasSavedSession } from "@/lib/advisor/sessionRepo";
import { HomeResumeEntry } from "./HomeResumeEntry";
import { HomeAdvisorResumeEntry } from "./HomeAdvisorResumeEntry";

// 홈 랜딩(/) 재개 진입점 묶음 — 직전 iteration 들이 서류(계약) 축(HomeResumeEntry)·상담 축
// (HomeAdvisorResumeEntry) 두 재개 진입점을 홈에 모두 올렸으나, 라벨 없는 맨 flex 컬럼에 두
// pill 만 쌓여 있어 (a) 두 진입점이 무슨 묶음인지 안내가 없고 (b) 두 진입점을 감싸던 컨테이너
// <div>(marginTop:28)는 서버 컴포넌트 page.tsx 에 항상 렌더돼, 첫 방문자(두 island 모두 null)
// 에게도 빈 컨테이너가 남았다. 이 island 가 두 저장소를 함께 구독해 — 저장된 작업이 하나도
// 없으면 묶음 전체(라벨 포함)를 렌더하지 않고(첫 방문 홈 무변경), 하나라도 있으면 "이어서 하기"
// 라벨 region 아래 두 진입점을 함께 보여준다.
//
// ★표시·내비게이션 전용 — 조문·엔진·검증(validate)·산출물(docx) 무접촉(순수 카운트/boolean).
// ★두 자식(HomeResumeEntry·HomeAdvisorResumeEntry)은 각자 자기 저장소를 구독해 독립적으로
//   null 게이트한다 — 묶음은 라벨과 "최소 하나 존재" 게이트만 더한다(저장된 계약만 있으면
//   계약 pill 만, 상담만 있으면 상담 pill 만, 둘 다면 둘 다). 각 island 과 동일 단일 출처
//   (contractRepo·sessionRepo)라 어디서도 어긋나지 않는다(staleness 0).
// ★새 CSS 0 — 기존 토큰(var(--c-brown) 등) + 인라인 style 만. 라벨은 h2(접근명은 region
//   의 aria-labelledby 가 가리키는 가시 텍스트가 전달).
export function HomeResumeGroup() {
  const savedCount = useSyncExternalStore(subscribeContracts, contractCount, () => 0);
  const hasSession = useSyncExternalStore(subscribeSession, hasSavedSession, () => false);
  // 저장된 작업이 하나도 없으면 묶음 전체를 렌더하지 않는다(첫 방문 홈 무변경·라벨만 뜨는 빈
  // 묶음 방지). 두 자식도 각자 null 이지만, 라벨/컨테이너는 이 게이트가 책임진다.
  if (savedCount === 0 && !hasSession) return null;
  return (
    <section
      role="region"
      aria-labelledby="home-resume-heading"
      style={{ marginTop: 28 }}
    >
      <h2
        id="home-resume-heading"
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.08em",
          color: "var(--c-brown)",
          margin: "0 0 10px",
        }}
      >
        이어서 하기
      </h2>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
        <HomeResumeEntry />
        <HomeAdvisorResumeEntry />
      </div>
    </section>
  );
}
