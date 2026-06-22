/* ============================================================
   회귀 가드 — 제21조 인허가 조항 포함 + 인허가 유형 "해당 없음(순수 담보)"
                입력 지점 교차검증 advisory

   배경: STEP 05 계약 조건의 「인허가 / 건축주 권한 (제21조)」 섹션은 hint 가
   "인허가 진행 사업이면 포함, 순수 단순담보이면 제외합니다."라 명시하듯, 제21조
   인허가 조항 포함(includeArt21!==false)은 곧 "인허가 진행 사업"을 의미한다.
   그런데 그 블록 안 인허가 유형(licenseType) 선택지에는 "none"=「해당 없음(순수
   담보)」가 있어, 조항은 포함했는데 유형은 "해당 없음(순수 담보)"으로 두면
   "인허가 진행 사업인데 인허가가 해당 없음"이라는 구조적 모순이 된다(섹션 hint 와
   어긋남). 대리금융기관(제20조)·담보보수(안분) 단독 advisory 와 동형의 조건-의존
   정합 갭으로, 막지 않고(사용자 선택 보존) 입력 지점에서 부드럽게 되짚는다.

   핵심 불변식:
     - ★표시 전용 — 게이트(validate)·빌더(builders.js)·조문 무접촉(차단 아님).
     - 조건 = c.includeArt21 !== false && c.licenseType === "none" (포함 + 해당없음).
       이미 includeArt21!==false 블록 안에 위치하므로 기존 필드 파생일 뿐
       새 상태/모델/엔진 무접촉.
     - role=status·aria-live=polite (동적 출현 SR 고지) + 선두 ⚠ 글리프 aria-hidden
       (장식 글리프 접근명 오염 0 — 기존 컨벤션).
     - 기존 클래스(field-hint) 재사용 + 인라인 style 만 — 새 CSS 0.
     - 무회귀 — 인허가 조항 포함 체크박스·건축주 명의·인허가 유형 select 보존.

   단언:
     (A) StepConditions 배선 — 조건·문구·role=status·aria-hidden 글리프·field-hint 재사용
     (B) 무회귀 — includeArt21 체크박스·builderName·licenseType select·LICENSE_TYPES none 보존
     (C) 무접촉 — validate/builders 에 advisory 문구·조건 미혼입·새 CSS 0
     (D) 공존 — 기존 대리금융기관·담보보수 단독 advisory 와 독립 경로 보존

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-conditions-art21-license-none-advisory.mjs
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
  // advisory 는 제21조 포함(includeArt21!==false) + 인허가 유형 "해당 없음(none)" 일 때만 렌더
  ok(/\{c\.includeArt21 !== false && c\.licenseType === "none" && \(/.test(cond),
     "조건 = c.includeArt21 !== false && c.licenseType === \"none\" (포함 + 해당없음일 때만)");
  // 되짚는 advisory 본문(제21조 포함 + 해당 없음(순수 담보) 모순 되짚음)
  ok(/제21조 인허가 조항을 포함했는데 인허가 유형이 .*해당 없음\(순수 담보\).*으로 설정되어 있습니다/.test(cond),
     "advisory 본문 = 제21조 포함 + 인허가 유형 '해당 없음(순수 담보)' 모순 되짚음");
  ok(/순수 단순담보면 위 제21조 포함을 해제하는 것을 검토하세요/.test(cond),
     "막지 않고(차단 아님) 설정 확인을 권유(사용자 선택 보존)");
  // 모순 근거 명시(추정 아님 — 제21조는 인허가 진행 사업일 때 둔다 = 섹션 hint 와 동일 취지)
  ok(/제21조는 통상 인허가 진행 사업일 때 둡니다/.test(cond),
     "advisory 근거 = 제21조는 인허가 진행 사업일 때(사실 기반·섹션 hint 동일 취지)");
  // 동적 출현 SR 고지 + 선두 ⚠ aria-hidden
  ok(/c\.includeArt21 !== false && c\.licenseType === "none"/.test(cond)
     && /role="status" aria-live="polite"/.test(cond)
     && /<span aria-hidden="true">⚠ <\/span>/.test(cond),
     "role=status·aria-live=polite + 선두 ⚠ 글리프 aria-hidden(접근명 오염 0)");
  // 기존 클래스 재사용 (field-hint role=status) — agentBank·feePayer advisory 와 동일 컨벤션
  ok((cond.match(/className="field-hint" role="status"/g) || []).length >= 3,
     "field-hint 기존 클래스 재사용(agentBank·feePayer advisory 와 동일 컨벤션·새 클래스 0)");
  // 색은 토큰 재사용(danger 적색 아님 — 차단 오인 방지·검토 신호)
  ok((cond.match(/var\(--c-brown\)/g) || []).length >= 3,
     "advisory 색 = var(--c-brown) 토큰 재사용(차단 적색 아님·기존 advisory 와 동형)");
}

console.log("\n[B] 무회귀 — includeArt21 체크박스·builderName·licenseType select·LICENSE_TYPES none 보존");
{
  // 제21조 인허가 조항 포함 체크박스 보존
  ok(/checked=\{c\.includeArt21 !== false\}/.test(cond),
     "제21조 인허가 조항 포함 체크박스(includeArt21) 보존");
  // 건축주(인허가) 명의 select(조문 자동반영) 보존
  ok(/id="cond-builderName"/.test(cond)
     && /value=\{c\.builderName \|\| "truster"\}/.test(cond),
     "건축주 명의 select(builderName) 보존");
  // 인허가 유형 select 보존 + LICENSE_TYPES 에 none(해당 없음) 항목 존재
  ok(/id="cond-licenseType"/.test(cond)
     && /value=\{c\.licenseType \|\| "building"\}/.test(cond),
     "인허가 유형 select(licenseType) 보존");
  ok(/\{ v: "none", l: "해당 없음\(순수 담보\)" \}/.test(cond),
     "LICENSE_TYPES 에 none = 「해당 없음(순수 담보)」 선택지 보존(advisory 트리거 대상)");
  // 이 advisory 는 includeArt21!==false 블록 '뒤'에 위치(블록 밖) — 포함 해제 시 자동 미렌더
  ok(cond.indexOf('{c.includeArt21 !== false && c.licenseType === "none" && (')
     > cond.indexOf("계약서별로 「건축허가」"),
     "advisory 는 인허가 유형 필드(블록 내부) 뒤에 위치(포함 해제 시 조건으로 미렌더)");
}

console.log("\n[C] 무접촉 — validate/builders 에 advisory 문구·조건 미혼입·새 CSS 0");
{
  ok(!/해당 없음\(순수 담보\).*으로 설정되어 있습니다|제21조 인허가 조항을 포함했는데/.test(validate),
     "validate.ts(게이트)에 advisory 문구 미혼입 — 차단/검증 대상 아님(표시 전용)");
  ok(!/제21조 인허가 조항을 포함했는데|제21조는 통상 인허가 진행 사업일 때 둡니다/.test(builders),
     "builders.js(산출물)에 advisory 문구 미혼입 — 조문 미변경");
  ok(!/art21-advisory|license-none|art21-license/.test(globals),
     "globals.css 에 advisory 전용 새 클래스 0(field-hint 재사용)");
}

console.log("\n[D] 공존 — 기존 대리금융기관·담보보수 단독 advisory 와 독립 경로 보존");
{
  ok(/\{c\.agentBankEnabled && !isMulti && \(/.test(cond),
     "기존 대리금융기관(제20조) 단독 advisory 공존(독립 경로·무회귀)");
  ok(/\{c\.feePayer === "priority" && !isMulti && \(/.test(cond),
     "기존 담보보수(안분) 단독 advisory 공존(독립 경로·무회귀)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
