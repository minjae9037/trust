/* ============================================================
   회귀 가드 — 상담 세션 영속·재개(advisor sessionRepo + AdvisorChat)

   배경: 서류 측은 contractRepo(localStorage)로 입력을 영속하고 홈·첫화면·브레드크럼에
   재개 동선이 완비됐는데, 상담(/advisor)은 대화 상태가 메모리(useState)에만 있어
   새로고침·이탈 시 진행 중 상담이 통째로 사라졌다(재방문 흐름의 "남은 한 축").
   완료된 대화 턴을 localStorage 에 보관하고, 빈 상태에 "이어서 대화하기" 복원 진입점을
   노출해 돌아온 사용자가 지난 상담을 이어가게 한다.

   변경:
     ① src/lib/advisor/sessionRepo.ts (신규) — KEY="trust_advisor_session". 순수
        sanitizeForStorage(완료 라운드만·error/빈 답변/답없는 질문 제외) + isValidMsg +
        loadSession/saveSession(best-effort·빈이면 저장본 보존)/clearSession(비움 단일 경로).
     ② src/components/advisor/AdvisorChat.tsx — 마운트 적재(savedSession)·msgs 변경 시
        자동 저장(!busy && msgs>0)·resumeSession 복원·newConversation 가 clearSession·
        빈 상태 복원 진입점(저장본 있을 때만).

   핵심 불변식:
     - ★표시·재개 전용 — 페르소나(system)·검색(retrieve)·로깅(log)·산출물(docx) 무접촉.
     - 저장 대상 = 완료된 대화 본문만(error 자리표시자·진행 중 빈 답변·답 없는 질문 제외).
     - 저장본 비움은 명시적 "새 대화"(clearSession)만 — saveSession 은 빈이면 기존 보존.
     - 저장본 없는 첫 방문 빈 상태 무변경(savedSession null·SSR 안전)·새 CSS 0.

   단언:
     (A) sessionRepo 순수·계약 — KEY·sanitize(완료 라운드만)·load 검증·save best-effort·clear
     (B) sanitizeForStorage 런타임 — error/빈/답없는질문 제외·필드 추림·입력 무변형(실행)
     (C) AdvisorChat 배선 — import·savedSession·마운트 적재·자동 저장·resume·newConversation clear
     (D) 빈 상태 진입점 — 저장본 있을 때만·role=region·문구·글리프 aria-hidden·btn-primary
     (E) 무접촉 — sessionRepo 에 retrieve/system/docx import 없음·globals 새 클래스 0

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-advisor-session-persistence.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { sanitizeForStorage, isValidMsg } from "../src/lib/advisor/sessionRepo.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const __dir = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(join(__dir, "..", ...p), "utf8");
const repo = read("src", "lib", "advisor", "sessionRepo.ts");
const chat = read("src", "components", "advisor", "AdvisorChat.tsx");
const globals = read("src", "app", "globals.css");

console.log("\n[A] sessionRepo 계약 — KEY·정규화·검증·best-effort·비움 단일 경로");
{
  ok(/const KEY = "trust_advisor_session";/.test(repo),
     "저장 KEY = trust_advisor_session(계약 측 전용 키)");
  ok(/export function sanitizeForStorage\(/.test(repo) &&
     /export function isValidMsg\(/.test(repo) &&
     /export function loadSession\(/.test(repo) &&
     /export function saveSession\(/.test(repo) &&
     /export function clearSession\(/.test(repo),
     "공개 API 5종(sanitizeForStorage·isValidMsg·loadSession·saveSession·clearSession)");
  ok(/if \(typeof window === "undefined"\) return \[\];/.test(repo),
     "loadSession SSR 안전(window 부재 시 빈 배열)");
  // saveSession 은 빈이면 기존 저장본 보존(비움은 clearSession 만)
  const saveAt = repo.indexOf("export function saveSession");
  const saveBlock = repo.slice(saveAt, saveAt + 420);
  ok(/if \(clean\.length === 0\) return;/.test(saveBlock),
     "saveSession 은 남길 완료 라운드 없으면 무동작(기존 저장본 보존 — 빈 상태가 안 덮어씀)");
  ok(/localStorage\.setItem\(KEY, JSON\.stringify\(clean\)\)/.test(saveBlock) &&
     /catch \{[\s\S]*?\}/.test(saveBlock),
     "saveSession 은 best-effort(setItem + 실패 swallow — 용량/시크릿 모드 무영향)");
  const clearAt = repo.indexOf("export function clearSession");
  ok(/localStorage\.removeItem\(KEY\)/.test(repo.slice(clearAt, clearAt + 220)),
     "clearSession 이 KEY removeItem(저장본 삭제의 단일 경로)");
}

console.log("\n[B] sanitizeForStorage 런타임 — 완료 라운드만·필드 추림·입력 무변형");
{
  const input = [
    { role: "user", content: "담보신탁이 무엇인가요?" },
    { role: "assistant", content: "담보신탁은 …", sources: [{ topic: "trust-collateral", kind: "core" }], grounding: "weak" },
    { role: "user", content: "그럼 우선수익권은?" },
    { role: "assistant", content: "오류: 생성 실패", error: true }, // 실패 자리표시자 — 제외
    { role: "user", content: "끝에 답 없는 질문" },                 // 답 없는 마지막 라운드 — 제외
  ];
  const snapshot = JSON.stringify(input);
  const out = sanitizeForStorage(input);
  ok(JSON.stringify(input) === snapshot, "입력 배열 무변형(순수 함수)");
  ok(out.length === 2, "완료된 1라운드(질문+답)만 남김 — 실패/빈/답없는질문 제외");
  ok(out[1].role === "assistant" && out[1].sources?.[0]?.topic === "trust-collateral" && out[1].grounding === "weak",
     "영속 필드(content·sources·grounding) 보존");
  ok(!("error" in out[1]), "error 필드는 저장본에 미보존(표시 전용 신호)");
  // 진행 중 빈 답변(content "")·공백 제외
  const out2 = sanitizeForStorage([
    { role: "user", content: "질문" },
    { role: "assistant", content: "답" },
    { role: "assistant", content: "   " }, // 빈/공백 — 제외
  ]);
  ok(out2.length === 2, "빈/공백 본문(진행 중 빈 답변) 제외");
  // isValidMsg 손상 격리
  ok(isValidMsg({ role: "user", content: "x" }) === true, "isValidMsg: 정상 통과");
  ok(isValidMsg({ role: "bot", content: "x" }) === false && isValidMsg({ role: "user" }) === false && isValidMsg(null) === false,
     "isValidMsg: 이질 role·content 부재·null 격리");
}

console.log("\n[C] AdvisorChat 배선 — 적재·자동 저장·복원·새 대화 비움");
{
  ok(/import \{ clearSession, loadSession, saveSession \} from "@\/lib\/advisor\/sessionRepo";/.test(chat),
     "AdvisorChat 가 sessionRepo 의 clearSession·loadSession·saveSession import");
  ok(/const \[savedSession, setSavedSession\] = useState<Msg\[\] \| null>\(null\);/.test(chat),
     "savedSession 상태(SSR 스냅샷 null — 하이드레이션 일치)");
  // 마운트 적재
  ok(/const saved = loadSession\(\);\s*\n\s*if \(saved\.length > 0\) setSavedSession\(saved\);/.test(chat),
     "마운트 useEffect 가 loadSession → 저장본 있으면 savedSession 세팅");
  // 자동 저장(busy 아님 + 대화 있음)
  ok(/if \(!busy && msgs\.length > 0\) saveSession\(msgs\);/.test(chat),
     "msgs/busy 변경 useEffect 가 생성 중 아니고 대화 있을 때만 saveSession");
  ok(/\}, \[msgs, busy\]\);/.test(chat),
     "자동 저장 effect 의존성 = [msgs, busy]");
  // 복원
  const resAt = chat.indexOf("function resumeSession");
  const resBlock = chat.slice(resAt, resAt + 320);
  ok(/if \(!savedSession \|\| busy\) return;/.test(resBlock) && /setMsgs\(savedSession\);/.test(resBlock) && /setSavedSession\(null\);/.test(resBlock),
     "resumeSession: 저장본을 현재 대화로 복원 + 진입점 숨김(savedSession null)");
  // 새 대화가 저장본도 비움
  const newAt = chat.indexOf("function newConversation");
  const newBlock = chat.slice(newAt, newAt + 420);
  ok(/clearSession\(\);/.test(newBlock) && /setSavedSession\(null\);/.test(newBlock),
     "newConversation 이 clearSession + savedSession null(저장본·진입점 동시 비움)");
}

console.log("\n[D] 빈 상태 복원 진입점 — 저장본 있을 때만·접근성·기존 토큰");
{
  ok(/\{savedSession && savedSession\.length > 0 && \(/.test(chat),
     "진입점은 savedSession 있을 때만 렌더(첫 방문 빈 상태 무변경)");
  ok(/role="region"/.test(chat) && /aria-label="지난 상담 이어서 하기"/.test(chat),
     "복원 영역 role=region + aria-label(랜드마크)");
  ok(/지난 상담 <strong>\{savedSession\.filter\(\(m\) => m\.role === "user"\)\.length\}개 질문<\/strong>/.test(chat),
     "저장된 질문 수 문구(지난 상담 N개 질문) — 사용자 메시지 수 기준");
  ok(/이어서 대화하기/.test(chat),
     "행동 유도 문구(이어서 대화하기)");
  ok(/<span aria-hidden="true">↩ <\/span>/.test(chat) && /<span aria-hidden="true"> →<\/span>/.test(chat),
     "장식 글리프(↩·→) aria-hidden(접근명은 가시 텍스트가 전달)");
  ok(/onClick=\{resumeSession\}/.test(chat) && /className="btn btn-primary btn-sm"/.test(chat),
     "복원 버튼 onClick=resumeSession + 기존 btn-primary/btn-sm");
  // 진입점은 빈 상태(.advisor-empty) 안, 제안 칩(.advisor-suggest) 위
  const regionAt = chat.indexOf('aria-label="지난 상담 이어서 하기"');
  const suggestAt = chat.indexOf('className="advisor-suggest"');
  ok(regionAt >= 0 && suggestAt > regionAt, "복원 진입점이 제안 칩보다 위(빈 상태 상단 노출)");
}

console.log("\n[E] 무접촉 — sessionRepo 엔진/검색/산출물 무관·새 CSS 0");
{
  ok(!/from "@\/lib\/advisor\/retrieve"/.test(repo) && !/from "@\/lib\/advisor\/system"/.test(repo),
     "sessionRepo 에 검색(retrieve)·페르소나(system) import 없음(상담 코어 무접촉)");
  ok(!/from "@\/lib\/engine\/docx"/.test(repo) && !/from "@\/lib\/advisor\/log"/.test(repo),
     "sessionRepo 에 산출물(docx)·로깅(log) import 없음");
  ok(!/\.advisor-resume\b/.test(globals) && !/trust_advisor_session/.test(globals),
     "globals 에 재개 진입점 전용 클래스 미추가(새 CSS 0 — 기존 토큰 + 인라인 style)");
}

console.log(`\n${fail === 0 ? "OK" : "FAIL"} — ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
