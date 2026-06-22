/* ============================================================
   회귀 가드 — 비-인터랙티브 정보 텍스트의 장식 이모지 글리프 aria-hidden
   (WCAG 1.3.1 / 4.1.2 — 장식 글리프가 접근명·선형 낭독을 오염시키지 않게)

   배경(a11y·표시 전용, 비-산출물):
   `verify-action-button-glyph-a11y`(정적 액션 컨트롤 선두 이모지 aria-hidden)는
   버튼·링크의 ⬆⬇📄🖨🔍💾⏳→ 를 장식 처리했으나, 그 가드는 스코프를 **컨트롤**로
   한정하고 주석에 "placeholder(🔍 검색)·label span(📚 참고한 자료)…는 무접촉"이라
   명시해 **비-인터랙티브 정보 텍스트(섹션 헤딩·라벨·배지·검증 안내 타이틀)의 장식
   이모지**는 갈래 밖으로 남겨 뒀다. 이 글리프들은 SR 에서 "books/clipboard/bar
   chart/lock/warning" 처럼 의미 텍스트로 낭독돼, 바로 뒤 본문 라벨("참고한 자료"·
   "계약 프로파일 요약" 등)이 충분히 의미를 전달하는데도 장식이 먼저 섞여 읽혔다.
   동적 상태 메시지의 선두 글리프(splitStatusGlyph 의 ✓/●/⚠)·정적 컨트롤 이모지가
   이미 장식 처리된 것과 같은 컨벤션으로, 정보 텍스트의 장식 글리프도 aria-hidden
   span 으로 감싸 가시 표시는 그대로 두고 접근명/낭독에서만 제외한다.

   ★추가로, `verify-action-button-glyph-a11y` 가 "정적 액션 버튼/링크 선두 이모지
   전 갈래 마감"을 선언했으나 **TrustApp 의 nav 크럼 링크(💬 상담 →)·플로팅 액션
   버튼(💬 AI 어시스턴트)** 두 컨트롤을 누락했음을 전수 점검으로 발굴 — 같은 컨트롤
   갈래의 잔여라 본 스윕에서 함께 마감한다(💬 선두·→ 후미 장식 → aria-hidden).

   ★시각 무변경: 글리프는 aria-hidden span '안'에 그대로 남아 화면 표시는 동일.
   배선(onClick·ref·href·title)·role="alert"·클래스는 전부 보존(표시/접근성 경계만).
   ★조문·엔진·검증 게이트(validate)·산출물(builders)·생성/저장 무접촉.

   핵심 불변식:
     (A) 비-인터랙티브 정보 글리프가 aria-hidden span 으로 감싸짐 + 본문 라벨 보존
         (📚 참고한 자료 / 📝 양식 안내 / 📋 계약 프로파일 요약 / 📊 산식 /
          🔒 자동 ×2 / ⚠ 생성 전 필수… ×2).
     (B) #24 가 놓친 TrustApp 컨트롤(💬 상담 → 크럼·💬 AI 어시스턴트 FAB) 장식 처리.
     (C) ★맨몸 잔존 0 — 옛 형태(글리프+공백+텍스트 인접)가 aria-hidden 밖에 없음.
     (D) 무회귀 — 배선·role=alert·클래스·title 보존(표시/접근성 경계만 변경).

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-decorative-text-glyph-a11y.mjs
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
const advisor = read("src", "components", "advisor", "AdvisorChat.tsx");
const docstep = read("src", "components", "trust", "steps", "DocStep.tsx");
const joint = read("src", "components", "trust", "JointForm.tsx");
const cond = read("src", "components", "trust", "steps", "StepConditions.tsx");
const loan = read("src", "components", "trust", "steps", "StepLoanCalc.tsx");
const basic = read("src", "components", "trust", "steps", "StepBasic.tsx");
const app = read("src", "components", "trust", "TrustApp.tsx");

console.log("\n[A] 비-인터랙티브 정보 글리프 aria-hidden span + 본문 라벨 보존");
{
  ok(/<span className="advisor-sources-label"><span aria-hidden="true">📚 <\/span>참고한 자료<\/span>/.test(advisor),
    "AdvisorChat 출처 라벨: 📚 aria-hidden span + \"참고한 자료\"");
  ok(/<strong><span aria-hidden="true">📝 <\/span>양식 안내<\/strong>/.test(docstep),
    "DocStep 양식 안내 헤딩: 📝 aria-hidden span + \"양식 안내\"");
  ok(/<strong><span aria-hidden="true">📋 <\/span>계약 프로파일 요약<\/strong>/.test(cond),
    "StepConditions 프로파일 요약 헤딩: 📋 aria-hidden span");
  ok(/<strong><span aria-hidden="true">📊 <\/span>산식<\/strong>/.test(loan),
    "StepLoanCalc 산식 헤딩: 📊 aria-hidden span");
  ok((basic.match(/<span className="badge ready" style=\{\{ marginLeft: 6 \}\}><span aria-hidden="true">🔒 <\/span>자동<\/span>/g) || []).length === 2,
    "StepBasic 🔒 자동 배지 2곳 모두 aria-hidden span + \"자동\"");
  ok(/<div className="validate-title"><span aria-hidden="true">⚠ <\/span>생성 전 필수 입력이 누락되었습니다<\/div>/.test(docstep),
    "DocStep 검증 타이틀: ⚠ aria-hidden span + 본문");
  ok(/<div className="validate-title"><span aria-hidden="true">⚠ <\/span>생성 전 필수 입력이 누락되었습니다<\/div>/.test(joint),
    "JointForm 검증 타이틀: ⚠ aria-hidden span + 본문");
}

console.log("\n[B] #24 가 놓친 TrustApp 컨트롤(💬 크럼·FAB) 장식 처리");
{
  ok(/<span aria-hidden="true">💬 <\/span>상담<span aria-hidden="true"> →<\/span>/.test(app),
    "TrustApp 상담 크럼: 💬 선두·→ 후미 모두 aria-hidden span (접근명 = \"상담\")");
  ok(/<span aria-hidden="true">💬 <\/span>AI 어시스턴트/.test(app),
    "TrustApp AI 어시스턴트 FAB: 💬 aria-hidden span (접근명 = \"AI 어시스턴트\")");
}

console.log("\n[C] ★맨몸 잔존 0 — 옛 형태(글리프+공백+텍스트 인접)가 aria-hidden 밖에 없음");
{
  ok(!/📚 참고한 자료/.test(advisor), "옛 \"📚 참고한 자료\" 맨몸 잔존 0");
  ok(!/📝 양식 안내/.test(docstep), "옛 \"📝 양식 안내\" 맨몸 잔존 0");
  ok(!/📋 계약 프로파일 요약/.test(cond), "옛 \"📋 계약 프로파일 요약\" 맨몸 잔존 0");
  ok(!/📊 산식/.test(loan), "옛 \"📊 산식\" 맨몸 잔존 0");
  ok(!/>🔒 자동</.test(basic), "옛 \"🔒 자동\"(배지 본문 인접) 맨몸 잔존 0");
  ok(!/>⚠ 생성 전 필수/.test(docstep), "옛 \"⚠ 생성 전 필수\"(DocStep) 맨몸 잔존 0");
  ok(!/>⚠ 생성 전 필수/.test(joint), "옛 \"⚠ 생성 전 필수\"(JointForm) 맨몸 잔존 0");
  ok(!/💬 상담/.test(app), "옛 \"💬 상담\" 맨몸 잔존 0");
  ok(!/💬 AI 어시스턴트/.test(app), "옛 \"💬 AI 어시스턴트\" 맨몸 잔존 0");
  ok(!/상담 →/.test(app), "옛 후미 \"상담 →\" 맨몸 잔존 0");
}

console.log("\n[D] 무회귀 — 배선·role=alert·클래스·title 보존(표시/접근성 경계만)");
{
  // 가시 글리프는 aria-hidden span '안'에 보존(시각 무변경) — [A]/[B] 가 글리프 포함을 이미 확인
  ok(/className="advisor-sources-label"/.test(advisor), "advisor-sources-label 클래스 보존");
  ok(/className="badge ready"/.test(basic), "StepBasic badge ready 클래스 보존");
  // 검증 게이트 박스 role=alert 보존(실제 누락 즉시 낭독)
  ok((docstep.match(/<div className="validate-box" role="alert">/g) || []).length >= 1,
    "DocStep validate-box role=alert 보존");
  ok(/<div className="validate-box" role="alert" style=\{\{ marginTop: 24 \}\}>/.test(joint),
    "JointForm validate-box role=alert 보존");
  // TrustApp 크럼 링크·FAB 배선 보존
  ok(/<Link href="\/advisor" className="crumb"/.test(app), "상담 크럼 href=/advisor·class=crumb 보존");
  ok(/className="chat-fab"/.test(app) && /ref=\{fabRef\}/.test(app) &&
     /onClick=\{\(\) => setChatOpen\(true\)\}/.test(app) && /title="AI 어시스턴트"/.test(app),
    "AI 어시스턴트 FAB className·ref·onClick·title 보존");
  // 가시 글리프 보존(시각 무변경) — 각 장식 글리프가 파일에 여전히 존재(aria-hidden span 안)
  ok(/📚/.test(advisor) && /📝/.test(docstep) && /📋/.test(cond) && /📊/.test(loan) &&
     /🔒/.test(basic) && /⚠/.test(docstep) && /⚠/.test(joint) && /💬/.test(app),
    "가시 글리프(📚📝📋📊🔒⚠💬) 전부 보존 — 화면 표시 무변경");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
process.exit(fail === 0 ? 0 : 1);
