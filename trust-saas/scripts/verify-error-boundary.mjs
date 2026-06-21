/* ============================================================
   회귀 가드 — 렌더 크래시 에러 경계(error.tsx · global-error.tsx)

   배경: 로컬 우선(localStorage) 구조라 사용자는 "내 계약"에 상당한 시간을
   들여 법적 서류 데이터를 입력한다. 그런데 앱에 에러 경계가 전혀 없어, 어느
   한 컴포넌트라도 렌더 중 throw 하면 Next 기본 에러 화면으로 떨어져 복구
   동선도 안내도 없이 작업이 끊겼다(유실 방지 계열의 마지막 갭 = 렌더 신뢰성).

   App Router 규약:
     - src/app/error.tsx        : 같은 세그먼트 + 모든 하위(/app·/advisor·/login)
                                  의 렌더 에러를 잡는다(루트 layout 자체는 제외).
     - src/app/global-error.tsx : 루트 레이아웃을 대체하는 최후 폴백 →
                                  자체 <html>/<body> 렌더 + globals.css import 필수.
   복구 UI 는 ErrorRecovery 단일 출처를 양쪽이 재사용한다.

   이 가드는 그 경계/복구 동선이 사라지는 회귀를 정적 차단한다.
     (A) error.tsx        — use client·default export·reset 호출·복구 UI 재사용
     (B) global-error.tsx — use client·<html>/<body>·globals.css·복구 UI 재사용
     (C) ErrorRecovery    — 안심 문구(내 계약 보관)·다시시도(reset)·처음으로(/)
     (D) 단일 출처/표시 전용 불변식 — 양쪽이 동일 컴포넌트 사용·조문/엔진 무접촉

   실행:
     cd trust-saas
     node scripts/verify-error-boundary.mjs
   ============================================================ */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "");

const errorTsx = read("src/app/error.tsx");
const globalErr = read("src/app/global-error.tsx");
const recovery = read("src/components/ErrorRecovery.tsx");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

console.log("\n[A] src/app/error.tsx — 세그먼트 에러 경계");
ok(errorTsx.length > 0, "error.tsx 파일 존재(/, /app, /advisor, /login 경계)");
ok(/^["']use client["']/m.test(errorTsx), "use client 선언(에러 경계는 클라이언트 컴포넌트)");
ok(/export\s+default\s+function/.test(errorTsx), "default export 함수(App Router 규약)");
ok(/reset\b/.test(errorTsx) && /reset=\{\s*reset\s*\}/.test(errorTsx), "reset 복구 동선을 ErrorRecovery 로 전달(reset={reset})");
ok(/ErrorRecovery/.test(errorTsx), "복구 UI(ErrorRecovery) 단일 출처 재사용");
ok(/console\.error/.test(errorTsx), "원인 파악용 console.error(외부 전송 없음)");

console.log("\n[B] src/app/global-error.tsx — 루트 레이아웃 최후 폴백");
ok(globalErr.length > 0, "global-error.tsx 파일 존재(루트 layout 경계)");
ok(/^["']use client["']/m.test(globalErr), "use client 선언");
ok(/export\s+default\s+function/.test(globalErr), "default export 함수");
ok(/<html[\s>]/.test(globalErr) && /<body[\s>]/.test(globalErr), "<html>/<body> 자체 렌더(루트 레이아웃 대체 규약)");
ok(/lang=["']ko["']/.test(globalErr), "lang=ko(한국어 제품)");
ok(/globals\.css/.test(globalErr), "globals.css 직접 import(레이아웃 대체 시 스타일 보존)");
ok(/ErrorRecovery/.test(globalErr), "복구 UI(ErrorRecovery) 단일 출처 재사용");

console.log("\n[C] ErrorRecovery — 복구 화면 단일 출처(안심·재시도·이탈)");
ok(recovery.length > 0, "ErrorRecovery.tsx 파일 존재");
ok(/export\s+function\s+ErrorRecovery/.test(recovery), "ErrorRecovery 컴포넌트 export");
ok(/내\s*계약/.test(recovery) && /(안전|보관|유실)/.test(recovery), "안심 문구(내 계약 데이터 보관·유실 없음)");
ok(/onClick=\{\s*\(\)\s*=>\s*reset\(\)\s*\}/.test(recovery), "‘다시 시도’ 버튼이 reset() 호출");
ok(/다시\s*시도/.test(recovery), "‘다시 시도’ 라벨(일시적 오류 복구)");
ok(/href=["']\/["']/.test(recovery), "‘처음으로’ 전체 이동 링크(href=\"/\" = 깨진 상태 탈출)");
ok(/role=["']alert["']/.test(recovery), "role=alert(스크린리더 즉시 안내)");
ok(/digest/.test(recovery), "error.digest 지원 참조 코드 노출(선택적)");

console.log("\n[D] 단일 출처/표시 전용 불변식");
ok(
  /ErrorRecovery/.test(errorTsx) && /ErrorRecovery/.test(globalErr),
  "양 경계(error·global-error)가 동일 복구 UI 단일 출처 사용(문구 drift 차단)",
);
ok(
  !/validate|builders|clauses|generateCollateral|engine\/(model|schema|annex)/.test(recovery + errorTsx + globalErr),
  "조문·엔진·검증·산출물 무접촉(표시 전용 — import 0)",
);

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
