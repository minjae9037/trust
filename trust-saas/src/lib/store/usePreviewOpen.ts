"use client";

import { useCallback, useEffect, useState } from "react";
import { loadPreviewOpen, savePreviewOpen } from "@/lib/store/previewPref";

/**
 * 미리보기 접기/펼치기 상태 + 영속 토글. DocStep·JointForm 공용 단일 출처.
 *
 * SSR/하이드레이션 안전: 초기값은 항상 기본 펼침(true)으로 렌더해 서버 마크업과
 * 일치시키고(localStorage 는 서버에 없음), 마운트 후 effect 에서 저장된 선호를
 * 읽어 반영한다(HomeResumeEntry·draft 복원과 동형 패턴).
 *
 * 영속은 **사용자 토글에서만** 일어난다 — 마운트 적재 경로에선 저장하지 않아
 * effect 순서/클로버 문제가 원천적으로 없다(저장된 값을 자기 자신으로 덮어쓰지
 * 않음). 표시 전용 — 조문/엔진/검증/산출물 무접촉.
 */
export function usePreviewOpen(): [boolean, () => void] {
  const [previewOpen, setPreviewOpen] = useState(true); // SSR 기본 펼침
  useEffect(() => {
    setPreviewOpen(loadPreviewOpen()); // 마운트 후 저장 선호 반영
  }, []);
  const toggle = useCallback(() => {
    setPreviewOpen((v) => {
      const next = !v;
      savePreviewOpen(next); // 명시 토글에서만 영속(idempotent — StrictMode 이중호출 무해)
      return next;
    });
  }, []);
  return [previewOpen, toggle];
}
