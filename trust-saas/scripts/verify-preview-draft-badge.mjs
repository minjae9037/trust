/* ============================================================
   회귀 가드 — 실시간 미리보기 "초안(미완)" 표시 (정확성·미리보기 UX)

   배경(표시 전용, 비-산출물·정확성 최우선):
   담보신탁 DocStep·공동사업 JointForm 의 우측 실시간 미리보기는 부분 입력도
   빈칸으로 렌더한다(previewDocHTML / previewJointHTML 은 누락 필드를 빈칸으로 둠).
   필수 입력 충족 여부({ok, missing})는 **좌측 입력 옆 검증 게이트(validate-box,
   role=alert)** 로만 안내돼, 넓은 우측 미리보기만 보는 사용자는 빈칸이 섞인 초안을
   완성본으로 오인할 수 있었다(법적 서류=정확성 최우선 — 미완 미리보기를 캡처·신뢰
   하는 위험). 본 변경은 필수 입력이 아직 누락(!ok)인 동안 미리보기 패널 머리(.preview-
   head)에 "초안 · 필수 입력 N개 남음" 배지를 직접 띄워, 미리보기 쪽에서 미완을 알린다.

   ★시각·산출물·게이트 무접촉: 배지는 기존 {ok, missing}(검증 게이트 단일 출처)만
   재사용해 파생 표시할 뿐 validateDoc/validateJoint·빌더·조문에 무접촉. 낭독은 좌측
   게이트(role=alert)가 전담하므로 이 배지는 시각 표시 전용(role/aria-live 미부착=중복
   낭독 0), 선두 ✎ 글리프는 aria-hidden(접근명 오염 0).

   핵심 불변식:
     (A) DocStep: previewHtml && !ok 조건부 .preview-badge-draft 배지 +
         ✎ aria-hidden 글리프 + missing.length 카운트.
     (B) JointForm: 동형(동일 배지·조건·카운트).
     (C) CSS .preview-badge-draft 정의 존재(danger-soft 토큰).
     (D) ★낭독 중복 0 — 배지에 role=status/aria-live 미부착(좌측 게이트 전담).
     (E) 무회귀 — preview-frame sandbox=""·validate-box role=alert·실시간 미리보기
         배지·미리보기 격리 보존(표시 경계만 추가).

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-preview-draft-badge.mjs
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
const docstep = read("src", "components", "trust", "steps", "DocStep.tsx");
const joint = read("src", "components", "trust", "JointForm.tsx");
const css = read("src", "app", "globals.css");

// 미리보기 머리(.preview-head) 안에서만 매칭하도록 잘라 검사(다른 곳 우연 매칭 차단).
const docHead = docstep.slice(docstep.indexOf('className="preview-head"'));
const jointHead = joint.slice(joint.indexOf('className="preview-head"'));

console.log("\n[A] DocStep — previewHtml && !ok 조건부 초안 배지 + ✎ aria-hidden + 카운트");
{
  ok(/previewHtml && !ok &&\s*\(\s*<span className="preview-badge-draft">/.test(docHead),
    "DocStep: 초안 배지가 previewHtml && !ok 조건부 렌더");
  ok(/<span aria-hidden="true">✎ <\/span>초안 · 필수 입력 \{missing\.length\}개 남음/.test(docHead),
    "DocStep: ✎ aria-hidden 글리프 + missing.length 카운트 문구");
}

console.log("\n[B] JointForm — 동형(동일 배지·조건·카운트)");
{
  ok(/previewHtml && !ok &&\s*\(\s*<span className="preview-badge-draft">/.test(jointHead),
    "JointForm: 초안 배지가 previewHtml && !ok 조건부 렌더");
  ok(/<span aria-hidden="true">✎ <\/span>초안 · 필수 입력 \{missing\.length\}개 남음/.test(jointHead),
    "JointForm: ✎ aria-hidden 글리프 + missing.length 카운트 문구");
}

console.log("\n[C] CSS .preview-badge-draft 정의(danger-soft 토큰)");
{
  ok(/\.preview-badge-draft\s*\{[^}]*var\(--c-danger\)[^}]*\}/.test(css),
    ".preview-badge-draft 글자색 = var(--c-danger)");
  ok(/\.preview-badge-draft\s*\{[^}]*var\(--c-danger-soft\)[^}]*\}/.test(css),
    ".preview-badge-draft 배경 = var(--c-danger-soft)");
}

console.log("\n[D] ★낭독 중복 0 — 초안 배지에 role/aria-live 미부착(좌측 게이트 전담)");
{
  // 초안 배지 한 줄(개행 없는 단일 span)에 role=/aria-live= 가 붙지 않았는지 확인.
  const draftLine = (s) => {
    const i = s.indexOf('className="preview-badge-draft"');
    return i < 0 ? "" : s.slice(i, i + 60);
  };
  ok(!/role=|aria-live=/.test(draftLine(docHead)), "DocStep 초안 배지 span: role/aria-live 미부착");
  ok(!/role=|aria-live=/.test(draftLine(jointHead)), "JointForm 초안 배지 span: role/aria-live 미부착");
  // 맨몸 글리프(✎ + 본문 인접)가 aria-hidden 밖에 없음 — 옛/잘못된 형태 잔존 0.
  ok(!/✎ 초안/.test(docstep), "DocStep: 맨몸 \"✎ 초안\"(aria-hidden 밖) 잔존 0");
  ok(!/✎ 초안/.test(joint), "JointForm: 맨몸 \"✎ 초안\"(aria-hidden 밖) 잔존 0");
}

console.log("\n[E] 무회귀 — 미리보기 격리·검증 게이트·실시간 배지 보존(표시 경계만 추가)");
{
  ok(/className="preview-frame"/.test(docstep) && /sandbox=""/.test(docstep),
    "DocStep: preview-frame sandbox=\"\" 격리 보존");
  ok(/className="preview-frame"/.test(joint) && /sandbox=""/.test(joint),
    "JointForm: preview-frame sandbox=\"\" 격리 보존");
  ok(/<div className="validate-box" role="alert">/.test(docstep),
    "DocStep: 좌측 검증 게이트 validate-box role=alert 보존(낭독 전담)");
  ok(/<div className="validate-box" role="alert" style=\{\{ marginTop: 24 \}\}>/.test(joint),
    "JointForm: 좌측 검증 게이트 validate-box role=alert 보존(낭독 전담)");
  ok(/<span className="preview-badge">실시간 미리보기<\/span>/.test(docstep) &&
     /<span className="preview-badge">실시간 미리보기<\/span>/.test(joint),
    "두 폼: 기존 \"실시간 미리보기\" 배지 보존");
  // 생성 버튼은 여전히 !ok 시 비활성(초안 배지는 표시일 뿐, 차단은 기존 게이트가 담당)
  ok(/disabled=\{busy \|\| !ok\}/.test(docstep) && /disabled=\{busy \|\| !ok\}/.test(joint),
    "두 폼: 생성 버튼 disabled={busy || !ok} 보존(게이트가 차단 담당)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
process.exit(fail === 0 ? 0 : 1);
