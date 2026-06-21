/**
 * ErrorRecovery — 렌더 크래시 복구 UI(표시 전용·단일 출처)
 *
 * 배경: 로컬 우선(localStorage) 구조라 사용자는 "내 계약"에 상당한 시간을 들여
 * 법적 서류 데이터를 입력한다. 그런데 앱에 에러 경계가 전혀 없어, 어느 한
 * 컴포넌트라도 렌더 중 throw 하면 Next 기본 에러 화면으로 떨어져 **복구 동선도
 * 안내도 없이** 작업이 끊겼다(유실 방지 계열의 마지막 갭 = 렌더 신뢰성).
 *
 * 이 컴포넌트는 그 복구 화면의 단일 출처다. error.tsx(세그먼트 경계)·
 * global-error.tsx(루트 레이아웃 경계) 양쪽이 이걸 재사용한다.
 * - 저장 데이터(내 계약 = 브라우저 보관)는 크래시와 무관하게 안전함을 명시(안심)
 * - "다시 시도"(reset) = 일시적 오류 복구 / "처음으로"(전체 이동) = 깨진 상태 탈출
 * - error.digest 는 지원 문의용 참조로만 작게 노출(누출 아님 = Next 가 부여한 해시)
 *
 * 조문·엔진·검증·산출물 무접촉(표시 전용).
 */
export function ErrorRecovery({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="error-recovery" role="alert">
      <div className="error-recovery-card">
        <div className="error-recovery-icon" aria-hidden="true">
          ⚠
        </div>
        <h1 className="error-recovery-title">일시적인 문제가 발생했습니다</h1>
        <p className="error-recovery-desc">
          화면을 표시하는 중 예기치 못한 오류가 발생했습니다. 입력하신{" "}
          <strong>“내 계약”</strong> 데이터는 브라우저에 안전하게 보관되어 있으니
          유실 걱정 없이 아래 버튼으로 다시 시도해 주세요.
        </p>
        <div className="error-recovery-actions">
          <button type="button" className="btn btn-primary" onClick={() => reset()}>
            다시 시도
          </button>
          <a className="btn btn-ghost" href="/">
            처음으로
          </a>
        </div>
        {error?.digest ? (
          <p className="error-recovery-digest">
            오류 참조 코드: <code>{error.digest}</code>
          </p>
        ) : null}
      </div>
    </div>
  );
}
