/* ============================================================
   회귀 가드 — 정적 액션 컨트롤 선두 장식 이모지(⬆⬇📄🖨🔍💾⏳→) aria-hidden 일관화

   배경(a11y·WCAG 2.4.4 Link/Button Purpose / 4.1.2 Name·Role·Value, 비-산출물·표시 전용):
   동적 상태 메시지의 글리프(✓/●/⚠)는 splitStatusGlyph / StatusGlyphText 로,
   준비도 칩 글리프(✓/⚠)는 verify-readychip-glyph-a11y 로, 🗑(삭제됨)·●(미저장)은
   각 위치에서 aria-hidden 으로 이미 장식 처리됐다. 그러나 ★정적 액션 컨트롤
   (버튼·Link)의 선두 장식 이모지는 텍스트 노드에 그대로 박혀 컨트롤의
   **접근명(accessible name)** 을 오염시켰다 — 예: "📄 Word(.docx) 생성" 의 접근명은
   "document Word(.docx) 생성" 처럼 모호한 이모지 음성이 먼저 낭독되고, 스크린리더
   버튼 목록(rotor)에서 이모지가 컨트롤 목적 앞에 섞인다.

   해결: 선두(및 advisor 링크의 후미 →) 장식 이모지를 `<span aria-hidden="true">📄 </span>`
   로 감싸 접근명을 순수 텍스트("Word(.docx) 생성")로 정리한다. ★가시 텍스트·이모지·
   공백·onClick/disabled/title 배선 전부 보존(시각 무변경·CSS 신규 0) — 🗑(ContractsView
   line 414)·●(TrustApp) 와 동일 컨벤션의 마지막 잔여를 마감.

   ★범위: aria-label 이 이미 접근명을 정의한 컨트롤(내 계약 카드 액션 버튼 — 열기·
   복제·서류/협약서 생성 등, verify-contracts-action-labels)은 이모지가 접근명에
   누설되지 않으므로 무접촉. placeholder(🔍 검색)·label span(📚 참고한 자료)·
   산출물 빌더(builders.js)는 액션 컨트롤이 아니므로 범위 밖.

   핵심 불변식:
     (A) ContractsView 백업 버튼 2종(⬆ 내보내기 / ⬇ 가져오기) — 이모지 aria-hidden span.
     (B) JointForm 생성/미리보기 3종(📄 Word / 🖨 PDF / 🔍 크게 보기) — 이모지 aria-hidden span.
     (C) DocStep 생성/미리보기 3종(📄 Word / 🖨 PDF / 🔍 크게 보기) — 이모지 aria-hidden span.
     (D) AdvisorChat doc-action 링크(📄 … 서류 작성하기 →) — 선두 📄·후미 → 둘 다 aria-hidden span.
     (E) Wizard 일괄 생성 버튼(⏳ 생성 중… / ⬇ 준비된 N종 …) — 양 분기 이모지 aria-hidden span.
     (F) TrustApp 저장 버튼(💾 저장) — 이모지 aria-hidden span.
     (G) ★맨몸 이모지 잔존 0 — 옛 형태(이모지+공백+텍스트 인접)가 aria-hidden 밖에 남지 않음.
     (H) 무회귀 — onClick/disabled/title 배선·가시 텍스트·이미 라벨된 카드 액션 버튼(⬇ 서류 N종
         생성 — aria-label) 보존.

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-action-button-glyph-a11y.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => readFileSync(path.join(root, ...p), "utf8");
const cv = read("src", "components", "trust", "ContractsView.tsx");
const joint = read("src", "components", "trust", "JointForm.tsx");
const doc = read("src", "components", "trust", "steps", "DocStep.tsx");
const advisor = read("src", "components", "advisor", "AdvisorChat.tsx");
const wiz = read("src", "components", "trust", "Wizard.tsx");
const app = read("src", "components", "trust", "TrustApp.tsx");

console.log("\n[A] ContractsView 백업 버튼 — 이모지 aria-hidden + 가시 텍스트");
{
  ok(/<span aria-hidden="true">⬆ <\/span>백업 내보내기/.test(cv), "⬆ 내보내기 이모지 aria-hidden span + 텍스트");
  ok(/<span aria-hidden="true">⬇ <\/span>백업 가져오기/.test(cv), "⬇ 가져오기 이모지 aria-hidden span + 텍스트");
}

console.log("\n[B] JointForm 생성/미리보기 버튼 — 이모지 aria-hidden + 가시 텍스트");
{
  ok(/<span aria-hidden="true">📄 <\/span>Word\(\.docx\) 생성/.test(joint), "📄 Word 생성 aria-hidden span + 텍스트");
  ok(/<span aria-hidden="true">🖨 <\/span>PDF 생성/.test(joint), "🖨 PDF 생성 aria-hidden span + 텍스트");
  ok(/<span aria-hidden="true">🔍 <\/span>크게 보기/.test(joint), "🔍 크게 보기 aria-hidden span + 텍스트");
}

console.log("\n[C] DocStep 생성/미리보기 버튼 — 이모지 aria-hidden + 가시 텍스트");
{
  ok(/<span aria-hidden="true">📄 <\/span>Word\(\.docx\) 생성/.test(doc), "📄 Word 생성 aria-hidden span + 텍스트");
  ok(/<span aria-hidden="true">🖨 <\/span>PDF 생성/.test(doc), "🖨 PDF 생성 aria-hidden span + 텍스트");
  ok(/<span aria-hidden="true">🔍 <\/span>크게 보기/.test(doc), "🔍 크게 보기 aria-hidden span + 텍스트");
}

console.log("\n[D] AdvisorChat doc-action 링크 — 선두 📄·후미 → 둘 다 aria-hidden");
{
  ok(/<span aria-hidden="true">📄 <\/span>\{DOC_LABEL\[docId\]\} 서류 작성하기<span aria-hidden="true"> →<\/span>/.test(advisor),
    "📄 + 텍스트 + → 모두 aria-hidden span(접근명=서류 작성하기)");
}

console.log("\n[E] Wizard 일괄 생성 버튼 — 양 분기 이모지 aria-hidden");
{
  ok(/<span aria-hidden="true">⏳ <\/span>생성 중…/.test(wiz), "⏳ 생성 중 분기 aria-hidden span + 텍스트");
  ok(/<span aria-hidden="true">⬇ <\/span>\{`준비된 \$\{readyCount\}종 일괄 생성\(\.docx\)`\}/.test(wiz),
    "⬇ 준비된 N종 분기 aria-hidden span + 텍스트");
}

console.log("\n[F] TrustApp 저장 버튼 — 이모지 aria-hidden + 가시 텍스트");
{
  ok(/<span aria-hidden="true">💾 <\/span>저장/.test(app), "💾 저장 aria-hidden span + 텍스트");
}

console.log("\n[G] ★맨몸 이모지 잔존 0 — 옛 형태(이모지+텍스트 인접)가 aria-hidden 밖에 없음");
{
  ok(!/⬆ 백업 내보내기/.test(cv), "옛 ⬆ 백업 내보내기 맨몸 잔존 0");
  ok(!/⬇ 백업 가져오기/.test(cv), "옛 ⬇ 백업 가져오기 맨몸 잔존 0");
  ok(!/📄 Word\(\.docx\) 생성/.test(joint), "옛 📄 Word 생성(joint) 맨몸 잔존 0");
  ok(!/🖨 PDF 생성/.test(joint), "옛 🖨 PDF 생성(joint) 맨몸 잔존 0");
  ok(!/🔍 크게 보기/.test(joint), "옛 🔍 크게 보기(joint) 맨몸 잔존 0");
  ok(!/📄 Word\(\.docx\) 생성/.test(doc), "옛 📄 Word 생성(doc) 맨몸 잔존 0");
  ok(!/🖨 PDF 생성/.test(doc), "옛 🖨 PDF 생성(doc) 맨몸 잔존 0");
  ok(!/🔍 크게 보기/.test(doc), "옛 🔍 크게 보기(doc) 맨몸 잔존 0");
  ok(!/서류 작성하기 →/.test(advisor), "옛 후미 맨몸 → (서류 작성하기 →) 잔존 0");
  ok(!/"⏳ 생성 중…"/.test(wiz), "옛 ⏳ 생성 중 맨몸 문자열 잔존 0");
  ok(!/⬇ 준비된 \$\{readyCount\}/.test(wiz), "옛 ⬇ 준비된 N종 맨몸 잔존 0");
  ok(!/💾 저장/.test(app), "옛 💾 저장 맨몸 잔존 0");
}

console.log("\n[H] 무회귀 — 배선·이미 라벨된 카드 액션 버튼 보존");
{
  ok(/onClick=\{onExport\}/.test(cv) && /onChange=\{onImportFile\}/.test(cv), "백업 내보내기/가져오기 배선 보존(export onClick·import onChange)");
  ok(/onClick=\{onDocx\}/.test(joint) && /onClick=\{onPdf\}/.test(joint), "joint 생성 배선 보존");
  ok(/onClick=\{onDocx\}/.test(doc) && /onClick=\{onPdf\}/.test(doc), "doc 생성 배선 보존");
  ok(/onClick=\{onExpandPreview\}/.test(joint) && /onClick=\{onExpandPreview\}/.test(doc), "크게 보기 배선 보존");
  ok(/onClick=\{generateAllReady\}/.test(wiz), "Wizard 일괄 생성 배선 보존");
  ok(/onClick=\{save\}/.test(app), "TrustApp 저장 배선 보존");
  // 이미 aria-label 로 접근명을 가진 카드 액션 버튼(⬇ 서류 N종 생성)은 이모지가 접근명에
  // 누설되지 않으므로 무접촉 — 가시 텍스트(이모지 포함) 그대로 유지(범위 밖 확인).
  ok(/`⬇ 서류 \$\{readiness\.ready\}종 생성`/.test(cv), "카드 액션 '서류 N종 생성' 가시 텍스트(aria-label 보유) 무접촉");
  ok(/aria-label=\{`\$\{r\.title\} — 준비된 서류 \$\{readiness\.ready\}종 생성`\}/.test(cv), "카드 액션 aria-label 보존(범위 밖)");
  // 🗑(삭제됨)·●(미저장 변경) 기존 aria-hidden 컨벤션 보존
  ok(/<span aria-hidden="true">🗑 <\/span>/.test(cv), "기존 🗑(삭제됨) aria-hidden 컨벤션 보존");
  ok(/<span aria-hidden="true">● <\/span>저장되지 않은 변경/.test(app), "기존 ●(미저장) aria-hidden 컨벤션 보존");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
process.exit(fail === 0 ? 0 : 1);
