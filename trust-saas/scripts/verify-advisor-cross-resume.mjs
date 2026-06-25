/* ============================================================
   회귀 가드 — 서류↔상담 왕복 복귀(cross-pillar resume, ?resume=1)

   배경: 상담(/advisor)은 답변에 doc-action(<<doc:…>>)이 있으면 "📄 …서류 작성하기"
   링크로 서류(/app?doc=…)로 보낸다(선도 동선). 상담 세션은 sessionRepo 로 영속되고
   빈 상태에 "이어서 대화하기" 진입점이 있으나(d72fe65), 서류 화면에서 상담으로
   *되돌아오는* 동선(브레드크럼 "💬 상담 →")은 단순 href="/advisor" 라 빈 상태를 거쳐
   한 번 더 클릭해야 직전 대화가 복원됐다 — 상담↔서류 왕복(작업 재개)의 마지막 끊김.

   변경(표시·내비게이션·재개 전용 — 조문·엔진·검증(validate)·산출물(docx) 무접촉):
     ① TrustApp.tsx — 브레드크럼 "💬 상담 →" 크럼을 href="/advisor?resume=1" 딥링크로.
        가시 문구("상담")·장식 글리프(💬/→ aria-hidden)는 보존(접근명 무변경).
     ② AdvisorChat.tsx — 마운트 useEffect 가 ?resume=1 이면 저장 세션을 빈 상태 추가 클릭
        없이 즉시 복원(setMsgs)하고, 파라미터는 세션 유무와 무관하게 replaceState 로 정리.
        파라미터 없는 직접 방문은 종전대로 setSavedSession(빈 상태 "이어서 대화하기" 진입점).

   핵심 불변식:
     - 후방호환: 저장본 없으면 ?resume=1 이어도 무동작(빈 상태)·직접 방문 동선 무변경.
     - 즉시 복원은 resumeSession 과 동일 효과(이력 적재·피드백/복사 초기화) + URL 정리.
     - HomeResumeEntry(?view=contracts) 딥링크 자동복원 패턴의 상담 측 대칭.

   단언:
     (A) TrustApp 크럼 딥링크 — href="/advisor?resume=1"·가시 문구/글리프 보존·상담 링크 단일
     (B) AdvisorChat 즉시 복원 — resume 파라미터 읽기·URL 정리·세션 없으면 무동작·setMsgs 복원·else 직접 방문
     (C) 무회귀 — resumeSession 빈상태 복원·빈 상태 진입점·자동 저장 effect·newConversation clear 보존
     (D) 무접촉 — AdvisorChat/TrustApp 에 검색/페르소나/산출물 import 부재·globals 새 클래스 0

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-advisor-cross-resume.mjs
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
const chat = read("src", "components", "advisor", "AdvisorChat.tsx");
const trustApp = read("src", "components", "trust", "TrustApp.tsx");
const globals = read("src", "app", "globals.css");

console.log("\n[A] TrustApp 브레드크럼 '상담' 크럼 — /advisor?resume=1 딥링크");
{
  ok(/href="\/advisor\?resume=1"/.test(trustApp),
     "'상담' 크럼이 /advisor?resume=1 딥링크(왕복 복귀 신호)");
  ok(/<span aria-hidden="true">💬 <\/span>상담<span aria-hidden="true"> →<\/span>/.test(trustApp),
     "가시 문구('상담')·장식 글리프(💬/→ aria-hidden) 보존 — 접근명 무변경");
  ok((trustApp.match(/href="\/advisor/g) || []).length === 1,
     "상담으로 가는 링크는 단일(브레드크럼 크럼 하나) — 중복/우회 경로 없음");
}

console.log("\n[B] AdvisorChat 마운트 — ?resume=1 즉시 복원 + URL 정리 + 직접 방문 분기");
{
  ok(/const wantResume = new URLSearchParams\(window\.location\.search\)\.get\("resume"\) === "1";/.test(chat),
     "마운트 effect 가 ?resume=1 파라미터를 읽음");
  ok(/if \(wantResume\) window\.history\.replaceState\(\{\}, "", "\/advisor"\);/.test(chat),
     "?resume=1 이면 파라미터 정리(replaceState '/advisor' — 세션 유무 무관)");
  ok(/if \(saved\.length === 0\) return;/.test(chat),
     "저장본 없으면 무동작(후방호환 — ?resume=1 이어도 빈 상태)");
  // 즉시 복원 분기(두 번째 wantResume 블록)
  const firstAt = chat.indexOf("if (wantResume) window.history.replaceState");
  const resumeBlockAt = chat.indexOf("if (wantResume) {", firstAt);
  const resumeBlock = resumeBlockAt >= 0 ? chat.slice(resumeBlockAt, resumeBlockAt + 280) : "";
  ok(/setMsgs\(saved\);/.test(resumeBlock) && /setFeedbackSent\(\{\}\);/.test(resumeBlock) &&
     /setCopied\(null\);/.test(resumeBlock) && /scrollDown\(\);/.test(resumeBlock),
     "즉시 복원 = setMsgs(saved)+피드백/복사 초기화+scrollDown(빈 상태 추가 클릭 생략)");
  ok(/else \{\s*\n\s*setSavedSession\(saved\);/.test(chat),
     "직접 방문(파라미터 없음)은 setSavedSession — 빈 상태 '이어서 대화하기' 진입점");
}

console.log("\n[C] 무회귀 — 빈 상태 복원·진입점·자동 저장·새 대화 비움 보존");
{
  const resAt = chat.indexOf("function resumeSession");
  const resBlock = chat.slice(resAt, resAt + 320);
  ok(/if \(!savedSession \|\| busy\) return;/.test(resBlock) && /setMsgs\(savedSession\);/.test(resBlock),
     "resumeSession(빈 상태 버튼 경로) 복원 로직 보존");
  ok(/\{savedSession && savedSession\.length > 0 && \(/.test(chat) && /이어서 대화하기/.test(chat),
     "빈 상태 '이어서 대화하기' 진입점 보존(직접 방문 동선)");
  ok(/if \(!busy && msgs\.length > 0\) saveSession\(msgs\);/.test(chat),
     "완료 대화 자동 저장 effect 보존(복원본 재저장 무손실)");
  const newAt = chat.indexOf("function newConversation");
  ok(/clearSession\(\);/.test(chat.slice(newAt, newAt + 420)),
     "newConversation 의 clearSession 보존(저장본 비움 단일 경로)");
}

console.log("\n[D] 무접촉 — 검색/페르소나/산출물 무관·새 CSS 0");
{
  ok(!/from "@\/lib\/advisor\/retrieve"/.test(chat) && !/from "@\/lib\/advisor\/system"/.test(chat) &&
     !/from "@\/lib\/engine\/docx"/.test(chat),
     "AdvisorChat 에 검색(retrieve)·페르소나(system)·산출물(docx) import 없음(표시/재개 경계만)");
  ok(!/from "@\/lib\/engine\/docx"/.test(trustApp) && !/validateDoc|validateJoint/.test(trustApp),
     "TrustApp 에 산출물(docx)·검증(validateDoc/Joint) import 없음(내비게이션 경계만)");
  ok(!/advisor-cross/.test(globals),
     "globals 에 왕복 복귀 전용 클래스 미추가(새 CSS 0 — 기존 크럼/링크 재사용)");
}

console.log(`\n${fail === 0 ? "OK" : "FAIL"} — ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
