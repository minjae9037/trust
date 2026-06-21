/* ============================================================
   회귀 가드 통합 러너 — verify-all

   배경(그린 유지 원칙의 재현 가능성 갭): trust-saas 는 입력 유효성·정합성·UX
   회귀 가드를 `scripts/verify-*.mjs` 로 35종 이상 누적해 왔고, 운영 원칙은
   "매 iteration 회귀가드 전종 PASS"(trust-corp today-plan 그린 유지 기준)다.
   그러나 이를 한 번에 실행하는 단일 명령이 없어, 각 iteration 이 worklog 에
   가드 목록을 손으로 나열하고 일부만 골라 돌려왔다(전종 동시 PASS 미확인).

   본 러너는 scripts/ 의 모든 verify-*.mjs(자기 자신 제외)를 발견해 각 가드가
   쓰는 것과 동일한 플래그(--experimental-strip-types + ts-ext-loader)로 순차
   실행하고, 가드별 PASS/FAIL + 단언(assertion) 총계를 집계한다. 하나라도
   실패하면 비정상 종료(exit 1)해 그린 게이트를 단일 명령으로 강제한다.

   - 가드 통과/실패 판정 = 자식 프로세스 종료코드(각 가드는 process.exit(fail?1:0)).
   - 단언 총계 = 각 가드가 출력하는 "결과: N PASS / M FAIL" 마지막 줄 파싱.
   - 통과 가드의 출력은 숨기고, 실패 가드만 전체 출력을 그대로 보여준다.

   조문·엔진·산출물·앱 소스 무접촉 — 테스트 실행 도구일 뿐.

   실행:
     cd trust-saas
     node scripts/verify-all.mjs              # 또는  npm run verify
   ============================================================ */
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");
const SELF = "verify-all.mjs";

const guards = readdirSync(__dir)
  .filter((f) => /^verify-.*\.mjs$/.test(f) && f !== SELF)
  .sort();

if (guards.length === 0) {
  console.error("실행할 verify-*.mjs 가드를 찾지 못했습니다.");
  process.exit(1);
}

// 가드마다 요약 문구가 달라("결과: N PASS / M FAIL" 또는 "=== … : N PASS / M FAIL ===")
// 접두사에 의존하지 않고 "N PASS / M FAIL" 패턴만 잡아 마지막 줄을 채택한다.
const RESULT_RE = /(\d+)\s*PASS\s*\/\s*(\d+)\s*FAIL/g;

let guardsPass = 0;
let guardsFail = 0;
let totalPass = 0;
let totalFail = 0;
const failed = [];

console.log(`\n회귀 가드 통합 실행 — ${guards.length}종 (${SELF} 제외)\n`);

for (const name of guards) {
  const res = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--loader", "./scripts/ts-ext-loader.mjs", "scripts/" + name],
    { cwd: root, encoding: "utf8" }
  );
  const out = (res.stdout || "") + (res.stderr || "");

  // 단언 총계: 마지막 "결과: N PASS / M FAIL" 줄을 채택
  let last = null;
  for (const m of out.matchAll(RESULT_RE)) last = m;
  const p = last ? Number(last[1]) : 0;
  const f = last ? Number(last[2]) : 0;
  totalPass += p;
  totalFail += f;

  // 가드 통과 판정 = 자식 종료코드(0)가 권위 — 각 가드가 process.exit(fail?1:0).
  // 파싱한 단언 FAIL(f>0)은 방어적 이중 확인(요약과 종료코드 불일치 시 실패 처리).
  const okGuard = res.status === 0 && f === 0;
  if (okGuard) {
    guardsPass++;
    console.log(`  ✓ PASS  ${name}  (${p})`);
  } else {
    guardsFail++;
    failed.push(name);
    console.log(`  ✗ FAIL  ${name}  (exit=${res.status}, ${p} PASS / ${f} FAIL)`);
  }
}

// 실패 가드는 전체 출력을 재실행해 보여준다(원인 즉시 확인)
if (failed.length > 0) {
  console.log("\n────── 실패 가드 상세 ──────");
  for (const name of failed) {
    console.log(`\n### ${name}`);
    const res = spawnSync(
      process.execPath,
      ["--experimental-strip-types", "--loader", "./scripts/ts-ext-loader.mjs", "scripts/" + name],
      { cwd: root, encoding: "utf8" }
    );
    process.stdout.write((res.stdout || "") + (res.stderr || ""));
  }
}

console.log("\n──────────────────────────────");
console.log(`가드: ${guardsPass}/${guards.length} PASS` + (guardsFail ? ` (${guardsFail} FAIL: ${failed.join(", ")})` : ""));
console.log(`단언: ${totalPass} PASS / ${totalFail} FAIL`);
console.log("──────────────────────────────\n");

process.exit(guardsFail === 0 ? 0 : 1);
