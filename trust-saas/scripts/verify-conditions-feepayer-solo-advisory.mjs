/* ============================================================
   회귀 가드 — 담보보수 납부 주체 "우선수익자(안분)" 단독 입력 지점 교차검증 advisory

   배경: STEP 05 계약 조건의 「보수·자금관리」 담보보수 납부 주체는 위탁자 / 우선수익자
   중 선택하는데, 우선수익자 선택지의 라벨이 "우선수익자(안분)"이다. '안분'(按分)은
   통상 복수 우선수익자 사이에서 보수를 비율대로 나눠 부담할 때 의미를 가지는 개념인데,
   STEP 02 우선수익자가 단독(!isMulti)이면 나눌 대상이 없어 '안분' 전제가 성립하지 않는다.
   대리금융기관(제20조) 단독 advisory(verify-conditions-agentbank-solo-advisory) 와 동형의
   구조-의존 정합 갭으로, 막지 않고(사용자 선택 보존) 입력 지점에서 부드럽게 되짚는다.

   핵심 불변식:
     - ★표시 전용 — 게이트(validate)·빌더(builders.js)·조문 무접촉(차단 아님).
       feePayer 는 "프로파일 기록" 항목이라 애초에 조문·산출물에 자동반영되지 않는다.
     - 조건 = c.feePayer === "priority" && !isMulti (안분 선택 + 단독). isMulti 는
       priorityCount(이름 있는 우선수익자 ≥ 2) 파생이라 새 상태/모델/엔진 무접촉.
     - role=status·aria-live=polite (동적 출현 SR 고지) + 선두 ⚠ 글리프 aria-hidden
       (장식 글리프 접근명 오염 0 — 기존 컨벤션).
     - 기존 클래스(field-hint) 재사용 + 인라인 style 만 — 새 CSS 0.
     - 무회귀 — 기존 feePayer radiogroup·자금관리계좌 체크박스·프로파일 요약 보존.

   단언:
     (A) StepConditions 배선 — 조건·문구·role=status·aria-hidden 글리프·field-hint 재사용
     (B) 무회귀 — feePayer radiogroup(truster/priority)·자금관리계좌·isMulti 파생 보존
     (C) 무접촉 — validate/builders 에 advisory 문구·조건 미혼입·새 CSS 0

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-conditions-feepayer-solo-advisory.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const __dir = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(join(__dir, "..", ...p), "utf8");
const cond = read("src", "components", "trust", "steps", "StepConditions.tsx");
const validate = read("src", "lib", "engine", "validate.ts");
const builders = read("src", "lib", "engine", "docx", "builders.js");
const globals = read("src", "app", "globals.css");

console.log("\n[A] StepConditions 배선 — 조건·문구·role=status·aria-hidden 글리프·field-hint 재사용");
{
  // advisory 는 안분 선택(feePayer==="priority") + 단독(!isMulti) 일 때만 렌더
  ok(/\{c\.feePayer === "priority" && !isMulti && \(/.test(cond),
     "조건 = c.feePayer === \"priority\" && !isMulti (안분 선택 + 단독일 때만)");
  // 되짚는 advisory 문구(안분·단독·확인 권유)
  ok(/단독 우선수익자인데 담보보수 납부 주체가 .*우선수익자\(안분\).*로 설정되어 있습니다/.test(cond),
     "advisory 본문 = 단독+우선수익자(안분) 설정 사실 되짚음");
  ok(/단독이면 안분 대상이 없으니 설정을 확인하세요/.test(cond),
     "막지 않고(차단 아님) 설정 확인을 권유(사용자 선택 보존)");
  // 안분 개념 근거 명시(추정 아님 — 복수 사이 비율 분담)
  ok(/통상 복수 우선수익자 사이에서 보수를 나눌 때 의미를 가집니다/.test(cond),
     "advisory 근거 = '안분'은 복수 우선수익자 사이에서 의미(사실 기반)");
  // 동적 출현 SR 고지 + 선두 ⚠ aria-hidden
  ok(/c\.feePayer === "priority" && !isMulti/.test(cond)
     && /role="status" aria-live="polite"/.test(cond)
     && /<span aria-hidden="true">⚠ <\/span>/.test(cond),
     "role=status·aria-live=polite + 선두 ⚠ 글리프 aria-hidden(접근명 오염 0)");
  // 기존 클래스 재사용 (field-hint) — 새 클래스 도입 아님
  ok((cond.match(/className="field-hint" role="status"/g) || []).length >= 2,
     "field-hint 기존 클래스 재사용(agentBank advisory 와 동일 컨벤션·새 클래스 0)");
  // 색은 토큰 재사용(danger 적색 아님 — 차단 오인 방지·검토 신호)
  ok((cond.match(/var\(--c-brown\)/g) || []).length >= 2,
     "advisory 색 = var(--c-brown) 토큰 재사용(차단 적색 아님·agentBank 와 동형)");
}

console.log("\n[B] 무회귀 — feePayer radiogroup·자금관리계좌·isMulti 파생 보존");
{
  // 보수 납부 주체 radiogroup(위탁자/우선수익자 안분) 보존
  ok(/aria-labelledby="cond-feePayer"/.test(cond),
     "담보보수 납부 주체 radiogroup(접근명 cond-feePayer) 보존");
  ok(/name="feePayer" checked=\{\(c\.feePayer \|\| "truster"\) === v\}/.test(cond),
     "feePayer radio 배선(기본 truster) 보존");
  ok(/v === "truster" \? "위탁자" : "우선수익자\(안분\)"/.test(cond),
     "feePayer 선택지 라벨(위탁자 / 우선수익자(안분)) 보존");
  // 자금관리계좌 특약 체크박스 보존(같은 섹션 다른 항목)
  ok(/checked=\{!!c\.fundMgmtAccount\}/.test(cond),
     "자금관리계좌(별첨5) 특약 병행 체크박스 보존");
  // isMulti 는 priorityCount(이름 있는 우선수익자 수) 파생 — 새 상태/모델 아님
  ok(/const priorityCount = form\.priorities\.filter/.test(cond)
     && /const isMulti = priorityCount >= 2;/.test(cond),
     "isMulti = priorityCount(이름 있는 우선수익자 ≥ 2) 파생 보존(새 상태/모델 0)");
  // 기존 대리금융기관 advisory 와 공존(상호 독립 경로)
  ok(/\{c\.agentBankEnabled && !isMulti && \(/.test(cond),
     "기존 대리금융기관 단독 advisory 와 공존(독립 경로·무회귀)");
}

console.log("\n[C] 무접촉 — validate/builders 에 advisory 문구·조건 미혼입·새 CSS 0");
{
  ok(!/안분 대상이 없으니 설정을 확인하세요|담보보수 납부 주체가/.test(validate),
     "validate.ts(게이트)에 advisory 문구 미혼입 — 차단/검증 대상 아님(표시 전용)");
  ok(!/안분 대상이 없으니 설정을 확인하세요|담보보수 납부 주체가/.test(builders),
     "builders.js(산출물)에 advisory 문구 미혼입 — 조문 미변경(feePayer=프로파일 기록)");
  ok(!/feepayer-advisory|feepayer-solo|fee-advisory/.test(globals),
     "globals.css 에 advisory 전용 새 클래스 0(field-hint 재사용)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
