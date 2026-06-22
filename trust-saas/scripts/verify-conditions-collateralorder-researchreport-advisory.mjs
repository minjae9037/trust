/* ============================================================
   회귀 가드 — 담보 차수 "추가(2·3차)" + 조사분석서 "포함" 입력 지점 교차검증 advisory

   배경: STEP 05 계약 조건의 「담보 차수」 섹션 hint 는 "추가담보(2·3차)는 선순위 잔존
   전제·조사분석서 생략 등 차이가 있습니다"라고 제품 스스로 도메인 사실을 단언한다(추정
   아님). 그런데 조사분석서 포함 여부(appform.researchReport)는 신청서(Doc 01) 단계에서
   따로 설정되므로, 차수를 추가(2·3차)로 두고도 조사분석서가 "포함"으로 남으면 신청서 표1
   체크박스에 "■ 포함"이 박히는 구조적 모순이 조용히 성립한다(builders.js:1512/1752
   researchReport==="include" → "■ 포함    □ 생략"). 대리금융기관(제20조)·담보보수 안분·
   제21조 인허가 유형(none) advisory 와 동형의 조건-의존 정합 갭으로, 막지 않고(사용자 선택
   보존) 입력 지점에서 부드럽게 되짚는다.

   핵심 불변식:
     - ★표시 전용 — 게이트(validate)·빌더(builders.js)·조문 무접촉(차단 아님).
       collateralOrder 는 "프로파일 기록", researchReport 는 신청서 출력 키지만 본 advisory
       는 두 기존 필드의 파생 표시일 뿐 어느 산출물·게이트에도 영향을 주지 않는다.
     - 조건 = c.collateralOrder === "additional" && form.docContents.appform?.researchReport
       === "include" (추가 차수 + 조사분석서 포함). 새 상태/모델/엔진 무접촉.
     - role=status·aria-live=polite (동적 출현 SR 고지) + 선두 ⚠ 글리프 aria-hidden
       (장식 글리프 접근명 오염 0 — 기존 컨벤션).
     - 기존 클래스(field-hint) 재사용 + 인라인 style 만 — 새 CSS 0.
     - 색 = var(--c-brown) 토큰(차단 적색 아님 — 검토 신호·기존 advisory 와 동형).
     - 근거가 제품 hint("추가담보…조사분석서 생략")와 일치(사실 기반·CLAUDE.md #1).
     - 기본 상태(collateralOrder "new" / researchReport "omit")에선 미표출(무회귀).

   단언:
     (A) StepConditions 배선 — 조건·문구·role=status·aria-hidden 글리프·field-hint·brown
     (B) 사실 기반 — 제품 hint(추가담보 조사분석서 생략) 보존 + advisory 근거 일치
     (C) 무회귀 — 담보 차수 radiogroup(new/additional)·기존 advisory 3종 공존
     (D) 무접촉 — validate/builders 에 advisory 문구 미혼입·새 CSS 0

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-conditions-collateralorder-researchreport-advisory.mjs
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

console.log("\n[A] StepConditions 배선 — 조건·문구·role=status·aria-hidden 글리프·field-hint·brown");
{
  // advisory 는 추가 차수(additional) + 조사분석서 포함(include) 일 때만 렌더
  ok(/\{c\.collateralOrder === "additional" && form\.docContents\.appform\?\.researchReport === "include" && \(/.test(cond),
     "조건 = collateralOrder === \"additional\" && appform?.researchReport === \"include\" (추가+포함일 때만)");
  // 되짚는 advisory 문구(추가담보·조사분석서 포함·확인 권유)
  ok(/추가\(2·3차\) 담보인데 신청서\(Doc 01\) 조사분석서가 .*포함.*로 설정되어 있습니다/.test(cond),
     "advisory 본문 = 추가담보+조사분석서 포함 설정 사실 되짚음");
  ok(/새 조사분석서가 필요한지 확인하세요/.test(cond),
     "막지 않고(차단 아님) 새 조사분석서 필요 여부 확인을 권유(사용자 선택 보존)");
  // 근거 명시(추정 아님 — 추가담보=선순위 잔존 전제·조사분석서 생략)
  ok(/추가담보는 통상 선순위 담보 잔존을 전제로 조사분석서를 생략합니다/.test(cond),
     "advisory 근거 = 추가담보는 선순위 잔존 전제로 조사분석서 생략(제품 hint 일치·사실 기반)");
  // 동적 출현 SR 고지 + 선두 ⚠ aria-hidden (advisory 블록 직전)
  const adv = cond.slice(cond.indexOf('collateralOrder === "additional" && form.docContents.appform'));
  ok(/role="status" aria-live="polite"/.test(adv.slice(0, 600))
     && /<span aria-hidden="true">⚠ <\/span>/.test(adv.slice(0, 600)),
     "role=status·aria-live=polite + 선두 ⚠ 글리프 aria-hidden(접근명 오염 0)");
  // 기존 클래스 재사용 (field-hint role=status) — advisory 4종이 동일 컨벤션
  ok((cond.match(/className="field-hint" role="status"/g) || []).length >= 4,
     "field-hint 기존 클래스 재사용(advisory 4종 동일 컨벤션·새 클래스 0)");
  // 색은 토큰 재사용(brown — 차단 적색 아님·검토 신호)
  ok((cond.match(/var\(--c-brown\)/g) || []).length >= 4,
     "advisory 색 = var(--c-brown) 토큰 재사용(차단 적색 아님·기존 advisory 와 동형)");
}

console.log("\n[B] 사실 기반 — 제품 hint(추가담보 조사분석서 생략) 보존 + advisory 근거 일치");
{
  // 담보 차수 섹션 hint 가 단언하는 도메인 사실(advisory 근거의 출처)
  ok(/추가담보\(2·3차\)는 선순위 잔존 전제·조사분석서 생략 등 차이가 있습니다/.test(cond),
     "담보 차수 섹션 hint = '추가담보…조사분석서 생략' 도메인 사실 보존(advisory 근거 출처)");
  // builders.js 가 researchReport==="include" 일 때 신청서 표1 에 "■ 포함" 을 박는다(모순의 실체)
  ok(/researchReport === "include"/.test(builders)
     && /■ 포함/.test(builders),
     "builders.js: researchReport==='include' → 신청서 표1 '■ 포함' 렌더(advisory 가 가리키는 실 산출물 모순)");
}

console.log("\n[C] 무회귀 — 담보 차수 radiogroup·기존 advisory 3종 공존");
{
  // 담보 차수 radiogroup(신규/추가) 보존
  ok(/aria-labelledby="cond-collateralOrder"/.test(cond),
     "담보 차수 radiogroup(접근명 cond-collateralOrder) 보존");
  ok(/name="collateralOrder" checked=\{\(c\.collateralOrder \|\| "new"\) === v\}/.test(cond),
     "collateralOrder radio 배선(기본 new) 보존");
  ok(/v === "new" \? "신규\(1차\) 담보" : "추가\(2·3차\) 담보"/.test(cond),
     "collateralOrder 선택지 라벨(신규(1차) / 추가(2·3차)) 보존");
  // 기존 advisory 3종(대리금융기관·담보보수 안분·제21조 인허가 유형) 공존
  ok(/\{c\.agentBankEnabled && !isMulti && \(/.test(cond),
     "기존 대리금융기관 단독 advisory 공존(독립 경로·무회귀)");
  ok(/\{c\.feePayer === "priority" && !isMulti && \(/.test(cond),
     "기존 담보보수 안분 단독 advisory 공존(독립 경로·무회귀)");
  ok(/\{c\.includeArt21 !== false && c\.licenseType === "none" && \(/.test(cond),
     "기존 제21조 인허가 유형(none) advisory 공존(독립 경로·무회귀)");
}

console.log("\n[D] 무접촉 — validate/builders 에 advisory 문구 미혼입·새 CSS 0");
{
  ok(!/새 조사분석서가 필요한지 확인하세요|추가\(2·3차\) 담보인데 신청서/.test(validate),
     "validate.ts(게이트)에 advisory 문구 미혼입 — 차단/검증 대상 아님(표시 전용)");
  ok(!/새 조사분석서가 필요한지 확인하세요|추가\(2·3차\) 담보인데 신청서/.test(builders),
     "builders.js(산출물)에 advisory 문구 미혼입 — 조문·표1 미변경(표시 전용)");
  ok(!/collateralorder-advisory|researchreport-advisory|collateral-order-advisory/.test(globals),
     "globals.css 에 advisory 전용 새 클래스 0(field-hint 재사용)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
