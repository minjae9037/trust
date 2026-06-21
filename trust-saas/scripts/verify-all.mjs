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

   - 가드 통과/실패 판정 = 단언 마커(N PASS / M FAIL) 존재 + 종료코드 0 + FAIL 0.
   - 단언 총계 = 각 가드가 출력하는 "결과: N PASS / M FAIL" 마지막 줄 파싱.
   - 통과 가드의 출력은 숨기고, 실패 가드만 전체 출력을 그대로 보여준다.

   ★Windows spawn 타이밍 내성(2026-06-21 보강): 36종을 순차 spawn 하면 드물게
   자식이 단언까지 실행되지 못한 채(spawn 전이/loader 전이로 res.error·status=null
   또는 마커 미출력) 끝나 — 종료코드만 보던 기존 러너가 이를 "실제 회귀 FAIL"로
   오보고했다(deterministic 가드 verify-dirty-tracking 이 단독 9/9 PASS 인데 통합
   실행에서 간헐 FAIL). 해결: "단언 마커 부재 = 실행 미완료"로 보고 해당 가드만
   재시도한다(최대 MAX_ATTEMPTS). 마커가 있으면(통과든 fail>0 이든) 실제 결과이므로
   재시도하지 않는다 → 실제 회귀는 절대 마스킹하지 않는다(_verify-all-helpers.mjs).

   조문·엔진·산출물·앱 소스 무접촉 — 테스트 실행 도구일 뿐.

   실행:
     cd trust-saas
     node scripts/verify-all.mjs              # 또는  npm run verify
   ============================================================ */
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseMarker, shouldRetry, isGuardPass } from "./_verify-all-helpers.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");
const SELF = "verify-all.mjs";
const MAX_ATTEMPTS = 3; // 실행 미완료(spawn 전이) 시 재시도 총 횟수

const guards = readdirSync(__dir)
  .filter((f) => /^verify-.*\.mjs$/.test(f) && f !== SELF)
  .sort();

if (guards.length === 0) {
  console.error("실행할 verify-*.mjs 가드를 찾지 못했습니다.");
  process.exit(1);
}

let guardsPass = 0;
let guardsFail = 0;
let totalPass = 0;
let totalFail = 0;
const failed = [];

function runOnce(name) {
  return spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--loader", "./scripts/ts-ext-loader.mjs", "scripts/" + name],
    { cwd: root, encoding: "utf8" }
  );
}

// 가드 1종 실행 — 단언 마커가 없으면(=실행 자체 실패: Windows spawn 타이밍/loader 전이)
// 일시적 실패로 보고 재시도. 마커가 나오면(통과/실패 무관) 결과 확정 → 실제 회귀 미마스킹.
function runGuard(name) {
  let res, out, marker;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    res = runOnce(name);
    out = (res.stdout || "") + (res.stderr || "");
    marker = parseMarker(out);
    if (!shouldRetry(marker)) return { res, out, marker, attempts: attempt };
    if (attempt < MAX_ATTEMPTS) {
      const why = res.error ? res.error.code || res.error.message : "단언 미출력";
      console.log(`  … 재시도 ${name} (실행 미완료: exit=${res.status}, ${why}) [${attempt}/${MAX_ATTEMPTS - 1}]`);
    }
  }
  return { res, out, marker, attempts: MAX_ATTEMPTS };
}

console.log(`\n회귀 가드 통합 실행 — ${guards.length}종 (${SELF} 제외)\n`);

for (const name of guards) {
  const { res, out, marker, attempts } = runGuard(name);
  const p = marker ? marker.pass : 0;
  const f = marker ? marker.fail : 0;
  totalPass += p;
  totalFail += f;

  if (isGuardPass(marker, res.status)) {
    guardsPass++;
    console.log(`  ✓ PASS  ${name}  (${p})` + (attempts > 1 ? ` [재시도 ${attempts - 1}회 후]` : ""));
  } else {
    guardsFail++;
    failed.push({ name, res, out, marker });
    const reason = marker
      ? `exit=${res.status}, ${p} PASS / ${f} FAIL`
      : `실행 미완료 — ${MAX_ATTEMPTS}회 시도 모두 단언 미출력 (exit=${res.status}${res.error ? ", " + (res.error.code || res.error.message) : ""})`;
    console.log(`  ✗ FAIL  ${name}  (${reason})`);
  }
}

// 실패 가드는 마지막 시도의 출력을 그대로 보여준다(재실행하지 않아 일관성 유지)
if (failed.length > 0) {
  console.log("\n────── 실패 가드 상세 ──────");
  for (const { name, res, out, marker } of failed) {
    console.log(`\n### ${name}` + (marker ? "" : "  (실행 미완료 — 단언 마커 미출력)"));
    if (res.error) console.log(`spawn error: ${res.error.stack || res.error.message}`);
    process.stdout.write(out || "(출력 없음)\n");
  }
}

console.log("\n──────────────────────────────");
console.log(`가드: ${guardsPass}/${guards.length} PASS` + (guardsFail ? ` (${guardsFail} FAIL: ${failed.join(", ")})` : ""));
console.log(`단언: ${totalPass} PASS / ${totalFail} FAIL`);
console.log("──────────────────────────────\n");

process.exit(guardsFail === 0 ? 0 : 1);
