"use client";

/**
 * 세그먼트 에러 경계 — /, /app, /advisor, /login 의 렌더 크래시를 잡는다.
 * (App Router 규약: error.tsx 는 같은 세그먼트와 모든 하위 세그먼트의 에러를
 *  잡되, 같은 레벨의 layout.tsx 에러는 못 잡는다 → 그건 global-error.tsx 담당.)
 *
 * 복구 UI 는 ErrorRecovery 단일 출처 재사용. 조문·엔진 무접촉(표시 전용).
 */
import { useEffect } from "react";
import { ErrorRecovery } from "@/components/ErrorRecovery";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 개발 중 원인 파악용(프로덕션에선 Next 가 메시지를 마스킹). 외부 전송 없음.
    console.error(error);
  }, [error]);

  return <ErrorRecovery error={error} reset={reset} />;
}
