"use client";

/**
 * 루트 레이아웃 에러 경계 — layout.tsx 자체가 깨졌을 때의 최후 폴백.
 * (App Router 규약: global-error.tsx 는 루트 레이아웃을 대체하므로 자체
 *  <html>/<body> 를 렌더해야 하고, globals.css 도 직접 import 해야 한다.)
 *
 * 세그먼트 경계(error.tsx)가 대부분을 잡으므로 거의 도달하지 않지만,
 * 도달 시에도 동일한 복구 UI(ErrorRecovery 단일 출처)를 보여 일관성을 유지한다.
 */
import { ErrorRecovery } from "@/components/ErrorRecovery";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body>
        <ErrorRecovery error={error} reset={reset} />
      </body>
    </html>
  );
}
