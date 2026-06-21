/* ============================================================
   회귀 가드 — verify-all 러너의 Windows spawn 내성 판정 로직

   배경: 36종 가드를 순차 spawn 하면 드물게 자식이 단언까지 실행되지 못한 채
   끝나(spawn/loader 전이) — 종료코드만 보던 기존 러너가 이를 "실제 회귀 FAIL"로
   오보고했다(verify-dirty-tracking 단독 9/9 PASS 인데 통합 실행 간헐 FAIL).
   보강: 단언 마커(N PASS / M FAIL) 부재 = 실행 미완료로 보고 재시도하되,
   마커가 있으면(통과/실패 무관) 재시도하지 않아 실제 회귀를 마스킹하지 않는다.

   본 가드는 그 판정 헬퍼(_verify-all-helpers.mjs)의 불변식을 behaviorally 단언한다:
     (A) parseMarker — 접두사 비의존·마지막 마커 채택·부재 시 null
     (B) shouldRetry — 마커 부재(실행 미완료)만 재시도, 실제 FAIL 은 재시도 금지
     (C) isGuardPass — 마커 + exit 0 + FAIL 0 일 때만 통과
     (D) ★불변식 — 실제 회귀(fail>0)는 재시도·통과로 둔갑 불가(마스킹 차단)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-all-resilience.mjs
   ============================================================ */
import { parseMarker, shouldRetry, isGuardPass } from "./_verify-all-helpers.mjs";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  ✓ " + label); }
  else { fail++; console.log("  ✗ " + label); }
};

console.log("[A] parseMarker — 접두사 비의존·마지막 마커 채택·부재 시 null");
{
  const a = parseMarker("결과: 9 PASS / 0 FAIL");
  ok(a !== null && a.pass === 9 && a.fail === 0, "'결과:' 접두사 마커 파싱");
  const b = parseMarker("=== verify-x 검증: 12 PASS / 3 FAIL ===");
  ok(b !== null && b.pass === 12 && b.fail === 3, "'===' 접두사 마커 파싱(접두사 비의존)");
  const c = parseMarker("중간\n1 PASS / 0 FAIL\n끝\n2 PASS / 5 FAIL");
  ok(c !== null && c.fail === 5, "여러 마커 중 마지막 줄 채택");
  ok(parseMarker("크래시 스택만 있고 단언 요약 없음\n  at foo (x.ts:1)") === null, "마커 부재 → null(실행 미완료 신호)");
  ok(parseMarker("") === null && parseMarker(null) === null && parseMarker(undefined) === null, "빈/없는 출력 → null(예외 없음)");
}

console.log("[B] shouldRetry — 실행 미완료(마커 부재)만 재시도");
{
  ok(shouldRetry(null) === true, "마커 부재(spawn/loader 전이) → 재시도");
  ok(shouldRetry({ pass: 9, fail: 0 }) === false, "통과 마커 → 재시도 안 함(불필요한 재실행 방지)");
  ok(shouldRetry({ pass: 5, fail: 2 }) === false, "★실제 FAIL 마커 → 재시도 안 함(회귀 마스킹 차단)");
}

console.log("[C] isGuardPass — 마커 + exit 0 + 단언 FAIL 0");
{
  ok(isGuardPass({ pass: 9, fail: 0 }, 0) === true, "마커·exit0·fail0 → 통과");
  ok(isGuardPass({ pass: 9, fail: 1 }, 0) === false, "단언 FAIL>0 → 실패(종료코드 무관)");
  ok(isGuardPass({ pass: 9, fail: 0 }, 1) === false, "exit≠0 → 실패(요약과 종료코드 불일치 방어)");
  ok(isGuardPass(null, 0) === false, "마커 부재 → 실패(실행 미완료, exit0 이어도)");
  ok(isGuardPass(null, null) === false, "exit=null(spawn 실패) → 실패");
}

console.log("[D] ★불변식 — 실제 회귀(fail>0)는 재시도·통과로 둔갑 불가");
{
  const real = { pass: 5, fail: 2 };
  ok(
    shouldRetry(real) === false && isGuardPass(real, 0) === false && isGuardPass(real, 1) === false,
    "fail>0 마커는 어떤 종료코드에서도 재시도·통과 모두 불가"
  );
  // 반대로, 실행 미완료(마커 부재)는 재시도 대상이되 끝내 마커가 없으면 실패로 귀결
  ok(shouldRetry(null) === true && isGuardPass(null, 0) === false, "실행 미완료는 재시도하되 마커 없으면 최종 실패");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
