/* ============================================================
   회귀 가드 — 홈 랜딩(/) 상담 재개 진입점(HomeAdvisorResumeEntry)

   배경: 직전 iteration 들이 마감한 홈 재개 흐름(HomeResumeEntry)은 모두 "서류(계약)"
   축이었다(저장된 계약 → /app?view=contracts). 상담(/advisor)도 진행 중 대화를
   sessionRepo(localStorage)에 영속하고 /advisor?resume=1 로 즉시 복원하는데, 정작
   홈에는 그 신호가 전혀 없어 상담을 이어가려는 사용자도 PILLAR 2(상담)부터 다시 들어가
   빈 상태에서 "이어서 대화하기"를 눌러야 했다(재방문 묶음의 "남은 한 축" = 상담). 저장된
   상담이 있으면 홈에서 한 번에 직전 대화로 보낸다(/advisor?resume=1).

   변경:
     ① src/lib/advisor/sessionRepo.ts — 저장 세션 존재 구독 인프라(hasSavedSession·
        subscribeSession·emitSessionChanged). saveSession/clearSession 이 쓰기 성공
        후에만 통지(실패=무손상 미통지). contractRepo 의 subscribeContracts 와 동형.
     ② src/components/home/HomeAdvisorResumeEntry.tsx (신규 클라이언트 island) —
        hasSession = useSyncExternalStore(subscribeSession, hasSavedSession, ()=>false).
        false → null(첫 방문 무변경). true 면 /advisor?resume=1 로 가는 Link 렌더.
        AdvisorChat 의 빈 상태 "이어서 대화하기"와 동일 단일 출처(sessionRepo).
     ③ src/app/page.tsx — HomeResumeEntry 와 같은 재개 진입점 컨테이너에 함께 렌더
        (서버 컴포넌트 유지·PILLAR 그리드 위).

   핵심 불변식:
     - ★표시·내비게이션 전용 — 페르소나(system)·검색(retrieve)·로깅(log)·산출물 무접촉
       (순수 boolean + Link). HomeResumeEntry(계약 축)와 동형의 상담 축 진입점.
     - 저장본 없으면 null 렌더(신규 사용자 홈 무변경·후방호환). SSR 스냅샷 false.
     - 시각 글리프(💬·—·→)는 aria-hidden(장식). 접근명은 가시 텍스트가 전달.
     - 통지는 쓰기 성공 후에만(saveSession/clearSession 단일 경로) — 진입점이 저장소와
       절대 어긋나지 않는다(staleness 0). 다른 탭은 storage 이벤트(우리 KEY 한정)로 반영.

   단언:
     (A) HomeAdvisorResumeEntry island 배선 — "use client"·useSyncExternalStore 단일 출처·
         false → null·/advisor?resume=1 Link·문구·글리프 aria-hidden
     (B) sessionRepo 구독 인프라 런타임 — hasSavedSession false→true·subscribeSession 가
         saveSession/clearSession·cross-tab storage 에 통지·SSR 안전·기존 정규화 보존
     (C) page.tsx 배선 — import + <HomeAdvisorResumeEntry /> 렌더·서버 컴포넌트 유지·그리드 위
     (D) 무접촉 — island 에 persona/retrieve/log/엔진 import 없음·globals 새 클래스 0

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-home-advisor-resume.mjs
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
const island = read("src", "components", "home", "HomeAdvisorResumeEntry.tsx");
const page = read("src", "app", "page.tsx");
const repo = read("src", "lib", "advisor", "sessionRepo.ts");
const globals = read("src", "app", "globals.css");

console.log("\n[A] HomeAdvisorResumeEntry island 배선 — 단일출처·null 렌더·딥링크·문구·글리프");
{
  ok(/^"use client";/.test(island),
     "HomeAdvisorResumeEntry 는 클라이언트 island(\"use client\")");
  ok(/import \{ subscribeSession, hasSavedSession \} from "@\/lib\/advisor\/sessionRepo";/.test(island),
     "sessionRepo 의 subscribeSession·hasSavedSession import(저장소 단일 출처)");
  ok(/const hasSession = useSyncExternalStore\(subscribeSession, hasSavedSession, \(\) => false\);/.test(island),
     "hasSession = useSyncExternalStore(subscribeSession, hasSavedSession, ()=>false) — AdvisorChat 빈 상태와 동일 출처·SSR false");
  ok(/if \(!hasSession\) return null;/.test(island),
     "저장본 없으면 null 렌더(신규 사용자 홈 무변경·후방호환)");
  ok(/href="\/advisor\?resume=1"/.test(island),
     "재개 Link = /advisor?resume=1(AdvisorChat 가 직전 대화로 즉시 복원하는 딥링크)");
  ok(/이어서 대화하기/.test(island),
     "행동 유도 문구(이어서 대화하기)");
  ok(/진행 중이던 상담/.test(island),
     "맥락 문구(진행 중이던 상담)");
  // 장식 글리프(💬·—·→)는 전부 aria-hidden — 접근명은 가시 텍스트가 전달
  ok(/<span aria-hidden="true"[^>]*>\s*💬/.test(island),
     "상담 글리프 💬 는 aria-hidden(장식 — 접근명 오염 0)");
  ok(/<span aria-hidden="true">— <\/span>/.test(island),
     "구분선 — 은 aria-hidden(앞 실제 공백으로 접근명 띄어 읽힘)");
  ok(/<span aria-hidden="true"[^>]*> →<\/span>/.test(island),
     "후미 → 는 aria-hidden(장식)");
}

console.log("\n[B] sessionRepo 구독 인프라 런타임 — hasSavedSession·subscribeSession 통지·SSR·정규화 보존");
{
  // 정적 계약 — 공개 API + 쓰기 성공 후에만 통지
  ok(/export function hasSavedSession\(\): boolean \{/.test(repo) &&
     /return loadSession\(\)\.length > 0;/.test(repo),
     "hasSavedSession(): boolean — 저장본 유무(loadSession().length>0)");
  ok(/export function subscribeSession\(cb: \(\) => void\): \(\) => void \{/.test(repo),
     "subscribeSession(cb) 공개 — useSyncExternalStore subscribe 계약");
  ok(/const sessionListeners = new Set<\(\) => void>\(\);/.test(repo) &&
     /function emitSessionChanged\(\) \{/.test(repo),
     "리스너 Set + emitSessionChanged(단일 통지 경로)");
  const saveAt = repo.indexOf("export function saveSession");
  const saveBlock = repo.slice(saveAt, repo.indexOf("export function clearSession", saveAt));
  ok(/return; \/\/ 쓰기 실패/.test(saveBlock) && saveBlock.lastIndexOf("emitSessionChanged()") > saveBlock.indexOf("setItem"),
     "saveSession — 쓰기 실패 시 early return(미통지)·성공 후에만 emit(무손상 정합)");
  const clearAt = repo.indexOf("export function clearSession");
  const clearBlock = repo.slice(clearAt, clearAt + 320);
  ok(/emitSessionChanged\(\);/.test(clearBlock),
     "clearSession — 삭제(removeItem) 성공 후 emit(진입점 라이브 소거)");
  ok(/if \(e\.key === null \|\| e\.key === KEY\) cb\(\);/.test(repo),
     "subscribeSession — 다른 탭 storage 이벤트(우리 KEY/전체 clear 한정) 통지");

  // window/localStorage 스텁으로 모듈을 실제 실행
  const storeMap = new Map();
  const evHandlers = {};
  const origWindow = globalThis.window;
  const origLS = globalThis.localStorage;
  globalThis.window = {
    addEventListener: (t, h) => { evHandlers[t] = h; },
    removeEventListener: (t) => { delete evHandlers[t]; },
  };
  globalThis.localStorage = {
    getItem: (k) => (storeMap.has(k) ? storeMap.get(k) : null),
    setItem: (k, v) => storeMap.set(k, String(v)),
    removeItem: (k) => storeMap.delete(k),
  };
  const m = await import("../src/lib/advisor/sessionRepo.ts");

  ok(m.hasSavedSession() === false, "미저장 상태 → hasSavedSession false");
  let notifyCount = 0;
  const unsub = m.subscribeSession(() => { notifyCount++; });
  // 완료 라운드 저장 → 존재 true + 구독 통지
  m.saveSession([{ role: "user", content: "PF 질문" }, { role: "assistant", content: "답변" }]);
  ok(m.hasSavedSession() === true, "완료 대화 saveSession 후 → hasSavedSession true");
  ok(notifyCount === 1, `saveSession 성공이 구독자에게 통지(notify ${notifyCount} === 1)`);
  // cross-tab storage 이벤트(우리 KEY) → 통지
  evHandlers.storage?.({ key: "trust_advisor_session" });
  ok(notifyCount === 2, `다른 탭 storage(우리 KEY) 통지 반영(notify ${notifyCount} === 2)`);
  // 무관 키 storage → 무통지
  evHandlers.storage?.({ key: "other_key" });
  ok(notifyCount === 2, "무관 키 storage 이벤트는 미통지(우리 KEY 한정)");
  // 비움 → 존재 false + 통지
  m.clearSession();
  ok(m.hasSavedSession() === false, "clearSession 후 → hasSavedSession false");
  ok(notifyCount === 3, `clearSession 이 구독자에게 통지(notify ${notifyCount} === 3)`);
  unsub();
  // 정규화 보존(기존 계약) — 답 없는 마지막 사용자 질문은 제외(매달린 질문 방지)
  const cleaned = m.sanitizeForStorage([{ role: "user", content: "q" }]);
  ok(Array.isArray(cleaned) && cleaned.length === 0,
     "sanitizeForStorage — 답 없는 마지막 사용자 질문 제거(기존 정규화 보존)");
  // SSR — window 부재
  delete globalThis.window;
  ok(m.hasSavedSession() === false, "SSR(window 부재) → hasSavedSession false(안전 기본)");

  if (origWindow === undefined) delete globalThis.window; else globalThis.window = origWindow;
  if (origLS === undefined) delete globalThis.localStorage; else globalThis.localStorage = origLS;
}

console.log("\n[C] page.tsx 배선 — import + <HomeAdvisorResumeEntry /> 렌더·서버 컴포넌트 유지·그리드 위");
{
  ok(/import \{ HomeAdvisorResumeEntry \} from "@\/components\/home\/HomeAdvisorResumeEntry";/.test(page),
     "page.tsx 가 HomeAdvisorResumeEntry import");
  ok(/<HomeAdvisorResumeEntry \/>/.test(page),
     "page.tsx 가 <HomeAdvisorResumeEntry /> 렌더");
  ok(/<HomeResumeEntry \/>/.test(page),
     "계약 축 진입점(HomeResumeEntry)도 보존(두 축 공존)");
  ok(!/^"use client";/.test(page),
     "page.tsx 는 서버 컴포넌트 유지(island 만 클라이언트 — RSC 경계 보존)");
  const entryAt = page.indexOf("<HomeAdvisorResumeEntry />");
  const gridAt = page.indexOf('gridTemplateColumns: "1fr 1fr"');
  ok(entryAt >= 0 && gridAt > entryAt,
     "<HomeAdvisorResumeEntry /> 가 PILLAR 그리드보다 위에 렌더(진입점 상단 노출)");
}

console.log("\n[D] 무접촉 — island 페르소나/검색/로깅/엔진 무관·globals 새 클래스 0");
{
  ok(!/@\/lib\/advisor\/(persona|retrieve|log)|@\/lib\/engine\//.test(island),
     "HomeAdvisorResumeEntry 에 페르소나/검색/로깅/엔진 import 없음(표시·내비게이션 전용)");
  ok(!/from "@\/lib\/engine\/docx"/.test(island),
     "island 에 산출물(docx) 생성기 import 없음");
  ok(!/\.home-advisor-resume\b/.test(globals),
     "globals 에 상담 재개 진입점 전용 클래스 미추가 — 기존 토큰 + 인라인 style 만(새 CSS 0)");
}

console.log(`\n${fail === 0 ? "OK" : "FAIL"} — ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
