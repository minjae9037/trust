/* ============================================================
   verify-all 순수 판정 헬퍼 (단일 출처)

   verify-all.mjs(러너)와 verify-all-resilience.mjs(가드)가 공유하는
   순수 함수 모음. 부수효과·spawn 없음 — 입력만으로 판정한다.

   ※ 파일명이 `_`로 시작해 러너의 가드 글롭(`^verify-.*\.mjs$`)에
     걸리지 않는다(가드로 오실행 방지). 헬퍼 전용 모듈.

   핵심 불변식:
   - 가드가 단언까지 실행되면 항상 "N PASS / M FAIL" 마커를 출력한다
     (각 verify-*.mjs 의 마지막 줄 + process.exit).
   - 따라서 "마커 부재" = 가드가 단언까지 실행되지 못함
     (Windows spawn 타이밍/loader 전이 등 실행 자체 실패).
   - 실제 회귀(마커 있고 fail>0)는 절대 재시도·통과로 둔갑시키지 않는다.
   ============================================================ */

// "결과: N PASS / M FAIL" 또는 "=== … : N PASS / M FAIL ===" 등 접두사 비의존.
const MARKER_RE = /(\d+)\s*PASS\s*\/\s*(\d+)\s*FAIL/g;

/** 가드 출력에서 마지막 단언 마커를 파싱. 부재 시 null(=실행 미완료 신호). */
export function parseMarker(out) {
  let last = null;
  for (const m of String(out ?? "").matchAll(MARKER_RE)) last = m;
  return last ? { pass: Number(last[1]), fail: Number(last[2]) } : null;
}

/**
 * 재시도 여부 — 마커가 없을 때(=가드가 단언까지 실행되지 못함)만 true.
 * 마커가 있으면(통과든 실패든) 실제 결과이므로 재시도하지 않는다
 * → 실제 회귀(fail>0) 마스킹을 원천 차단.
 */
export function shouldRetry(marker) {
  return marker == null;
}

/** 가드 통과 판정 — 마커 존재 + 종료코드 0 + 단언 FAIL 0 모두 충족 시에만. */
export function isGuardPass(marker, status) {
  return marker != null && status === 0 && marker.fail === 0;
}
