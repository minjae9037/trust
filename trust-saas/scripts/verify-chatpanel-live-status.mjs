/* ============================================================
   회귀 가드 — 앱 내 AI 어시스턴트(ChatPanel): SR 상태 라이브 고지(WCAG 4.1.3)

   배경: ChatPanel 은 비스트리밍 응답(/api/chat) 기반으로, 시각 사용자에겐 "…작성 중"
   버블과 AI 폼 자동채움 "✓ … 반영됨" 노트를 보여 준다. 그러나 이 둘은 모두 **라이브
   영역이 아니라** 스크린리더 사용자는 ① 답변이 작성 중인지 ② AI 가 법적 폼 항목을
   조용히 채웠는지를 전혀 듣지 못했다(상담 AdvisorChat 의 .advisor-live 패리티 갭).
   작성 시작·답변 도착·자동채움 결과를 polite 라이브 영역으로 고지하되, 오류는 err 의
   role="alert" 가 전담하므로 catch 에서 live 를 비워 이중 낭독을 피한다.

   핵심 불변식:
     - 표시/접근성 경계만 — 페르소나·검색·PII 토큰화·폼 패치(mergeFormPatch) 무접촉.
     - 작성 시작 → "답변을 작성하고 있습니다." / 정상 완료 → "답변이 도착했습니다."
       (AI 자동채움 시 무엇이 반영됐는지 함께 고지 — 시각 노트의 SR 패리티·값 미노출).
     - 오류 경로 → setLive("") (role=alert 가 실제 오류 낭독 → 이중 낭독 회피).
     - 시각 "…작성 중" 버블·"✓ 반영됨" 노트는 라이브 책임 없음(role 미부착=중복 낭독 0).

   단언:
     (A) 상태 — live state(초기 빈 문자열)
     (B) 작성 시작 고지 — deliver 가 setLive("답변을 작성하고 있습니다.")
     (C) 완료 고지 — "답변이 도착했습니다." 기본 + 자동채움 시 applied 포함·"반영됨" + setLive(liveDone)
     (D) 오류 침묵 — catch 에서 setLive("")(err role=alert 와 이중 낭독 회피)
     (E) 라이브 영역 — sr-only role=status aria-live=polite aria-atomic + {live}
     (F) 무회귀/무접촉 — PII 토큰화·폼 패치·isJoint 가드·재전송(retry)·시각 노트 보존, 엔진 내부 import 미도입

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-chatpanel-live-status.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");
const src = readFileSync(join(root, "src/components/trust/ChatPanel.tsx"), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

console.log("\n[A] 상태 — live state(초기 빈 문자열)");
{
  ok(/const\s*\[\s*live\s*,\s*setLive\s*\]\s*=\s*useState\(\s*""\s*\)/.test(src),
    "live state(초기 빈 문자열)");
}

console.log("\n[B] 작성 시작 고지 — deliver setLive(작성 중)");
{
  ok(src.includes('setLive("답변을 작성하고 있습니다.")'),
    'deliver 시작 시 setLive("답변을 작성하고 있습니다.")');
  // setBusy(true) 직후에 위치해 작성 시작 시점에 고지되는지(배선)
  const d = src.slice(src.indexOf("async function deliver"));
  ok(/setBusy\(true\);\s*\n\s*setLive\("답변을 작성하고 있습니다\."\)/.test(d),
    "setBusy(true) 직후 작성 고지(작성 시작 시점)");
}

console.log("\n[C] 완료 고지 — 도착 기본 + 자동채움 결과 포함");
{
  ok(/let\s+liveDone\s*=\s*"답변이 도착했습니다\.";/.test(src),
    'liveDone 기본값 "답변이 도착했습니다."');
  ok(src.includes("liveDone = `답변 도착 · ${applied.join(\" · \")} 반영됨`"),
    "자동채움(applied>0) 시 반영 항목 포함 고지(시각 노트 SR 패리티·값 미노출)");
  ok(/setLive\(liveDone\);/.test(src),
    "정상 완료 후 setLive(liveDone) — 작성 중↔도착 내용 변화로 재낭독");
  // applied 고지는 시각 노트와 동일 출처(summarizePatch 결과)인지 — 별도 산출 금지
  ok(src.includes("`✓ ${applied.join(\" · \")} 반영됨`") && src.includes("const applied = summarizePatch(patch);"),
    "시각 노트와 동일 출처(summarizePatch applied) — 별도 산출 없음");
}

console.log("\n[D] 오류 침묵 — catch setLive('')");
{
  // catch 블록 내에서 setErr 직후 setLive("") 로 stale 고지 제거(이중 낭독 회피)
  ok(/setErr\(friendlyErrorMessage\(e\)\);\s*[\s\S]{0,200}?setLive\(""\);/.test(src),
    'catch 에서 setErr 후 setLive("") (err role=alert 와 이중 낭독 회피)');
}

console.log("\n[E] 라이브 영역 — sr-only role=status polite aria-atomic + {live}");
{
  ok(/\{live\}/.test(src), "{live} 를 렌더하는 라이브 영역 존재");
  const idx = src.indexOf("{live}");
  const before = src.slice(Math.max(0, idx - 400), idx);
  const region = before.slice(before.lastIndexOf("<div"));
  ok(/className="sr-only"/.test(region), "라이브 영역 className=sr-only(시각 비표시)");
  ok(/role="status"/.test(region), "role=status");
  ok(/aria-live="polite"/.test(region), "aria-live=polite");
  ok(/aria-atomic="true"/.test(region), "aria-atomic=true(전체 메시지 낭독)");
  // 다이얼로그 내부 첫 자식 — chat-head 보다 앞서 렌더(콘텐츠 변경 전 DOM 존재)
  ok(src.indexOf("{live}") < src.indexOf('<div className="chat-head">'),
    "라이브 영역이 chat-head 보다 앞(항상 렌더·콘텐츠 변경 전 DOM 존재)");
}

console.log("\n[F] 무회귀/무접촉 — 토큰화·폼 패치·가드·재전송·시각 노트 보존");
{
  ok(src.includes("tokenizePII(raw, piiMap.current)") && src.includes("restorePII("),
    "PII 토큰화/복원 보존(전송 경계 무접촉)");
  ok(src.includes("mergeFormPatch(patch)"), "폼 패치 적용(mergeFormPatch) 보존");
  ok(src.includes("buildChatApiMessages(history)"), "API 페이로드 단일 출처(buildChatApiMessages) 보존");
  ok(src.includes('const isJoint = docTypeId === "joint"') && src.includes("if (data.patch && isJoint)"),
    "joint 교차오염 차단 가드 보존(자동채움 비활성 경로)");
  ok(src.includes("function retry()") && src.includes("void deliver(msgs)"),
    "무손실 재전송(retry → deliver) 보존");
  ok(src.includes('display: `✓ ${applied.join(" · ")} 반영됨`'),
    "시각 자동채움 노트(✓ … 반영됨) 보존(라이브 영역과 공존)");
  ok(src.includes("…작성 중"), "시각 작성 중 버블 보존(라이브 영역과 공존·role 미부착)");
  ok(!/engine\/docx-internal/.test(src) && !/lib\/engine\//.test(src.replace(/\/\/[^\n]*/g, "")),
    "엔진 내부 import 미도입(표시/접근성 경계만)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
