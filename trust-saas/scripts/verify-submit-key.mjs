/* ============================================================
   회귀 가드 — 입력창 Enter 전송 단축키(IME 조합 안전) 단일 출처

   배경(입력 결함, 비-산출물): 채팅 입력(AdvisorChat·ChatPanel)과 로그인
   입력의 Enter 전송 핸들러가 `e.key === "Enter"` 만 보고 **IME 조합 상태를
   확인하지 않았다**. 한국어·일본어 등은 입력기로 글자를 "조합"하다가 Enter 로
   조합을 확정하는데(예: "신탁ㅎ" → Enter → "신탁회"), 이 확정 Enter 도
   keydown 으로 잡혀 사용자가 마지막 글자를 조합하는 도중 **미완성 문장이
   조기 전송**되던 결함(한국어 대상 제품에서 흔함). 순수 헬퍼
   isSubmitEnter(src/lib/ui/keys.ts)가 nativeEvent.isComposing 을 확인해
   조합 확정 Enter 를 전송에서 제외한다 — 본 가드로 불변식을 고정한다.

   핵심 불변식:
     - 조합 확정 Enter(isComposing=true) → 전송 아님(조기 전송 차단).
     - 일반 Enter(조합 아님) → 전송. Shift+Enter → 줄바꿈(전송 아님).
     - allowShift=true(단일 라인 즉시 제출) → Shift 무관 전송, 단 조합 중엔 아님.
     - 배선: 세 Enter 핸들러가 모두 isSubmitEnter 를 사용(raw key==="Enter" 잔존 0).

   단언:
     (A) 일반 Enter → 전송(true)
     (B) ★IME 조합 중 Enter → 전송 아님(nativeEvent·합성 양쪽 경로)
     (C) Shift+Enter → 줄바꿈(전송 아님), allowShift 면 전송
     (D) Enter 외 키 → 전송 아님
     (E) isComposing 헬퍼 — nativeEvent 우선·false 보존·미정의 안전
     (F) 배선: AdvisorChat·ChatPanel·login 이 isSubmitEnter 사용 + raw Enter 핸들러 잔존 0

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-submit-key.mjs
   ============================================================ */
import { readFileSync } from "fs";
import path from "path";
import { isSubmitEnter, isComposing } from "../src/lib/ui/keys.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const read = (rel) => readFileSync(path.join(process.cwd(), rel), "utf8");

console.log("\n[A] 일반 Enter → 전송");
{
  ok(isSubmitEnter({ key: "Enter" }) === true, "Enter(조합 아님) → 전송");
  ok(isSubmitEnter({ key: "Enter", shiftKey: false }) === true, "Enter shiftKey:false → 전송");
  ok(isSubmitEnter({ key: "Enter", nativeEvent: { isComposing: false } }) === true, "Enter + isComposing:false → 전송");
}

console.log("\n[B] ★IME 조합 중 Enter → 전송 아님(조기 전송 차단)");
{
  ok(isSubmitEnter({ key: "Enter", nativeEvent: { isComposing: true } }) === false, "nativeEvent.isComposing=true → 전송 아님");
  ok(isSubmitEnter({ key: "Enter", isComposing: true }) === false, "합성 isComposing=true(폴백) → 전송 아님");
  ok(isSubmitEnter({ key: "Enter", nativeEvent: { isComposing: true }, isComposing: false }) === false, "nativeEvent 우선(true) → 전송 아님");
  // allowShift 라도 조합 중이면 전송 아님(미완성 즉시 제출 차단)
  ok(isSubmitEnter({ key: "Enter", nativeEvent: { isComposing: true } }, { allowShift: true }) === false, "allowShift 라도 조합 중 → 전송 아님");
}

console.log("\n[C] Shift+Enter 줄바꿈 / allowShift 분기");
{
  ok(isSubmitEnter({ key: "Enter", shiftKey: true }) === false, "Shift+Enter → 줄바꿈(전송 아님)");
  ok(isSubmitEnter({ key: "Enter", shiftKey: true }, { allowShift: true }) === true, "allowShift → Shift+Enter 도 전송");
  ok(isSubmitEnter({ key: "Enter", shiftKey: false }, { allowShift: true }) === true, "allowShift + Shift 없음 → 전송");
}

console.log("\n[D] Enter 외 키 → 전송 아님");
{
  for (const k of ["a", "Escape", "Tab", "Shift", "Backspace", " ", "ArrowDown"]) {
    ok(isSubmitEnter({ key: k }) === false, `key="${k}" → 전송 아님`);
  }
}

console.log("\n[E] isComposing 헬퍼 — nativeEvent 우선·false 보존·미정의 안전");
{
  ok(isComposing({ key: "Enter" }) === false, "isComposing 신호 부재 → false");
  ok(isComposing({ key: "Enter", nativeEvent: {} }) === false, "nativeEvent 있으나 isComposing 미정의 → false");
  ok(isComposing({ key: "Enter", nativeEvent: { isComposing: true } }) === true, "nativeEvent.isComposing=true → true");
  ok(isComposing({ key: "Enter", nativeEvent: { isComposing: false }, isComposing: true }) === false, "nativeEvent.false 가 합성 true 보다 우선");
  ok(isComposing({ key: "Enter", isComposing: true }) === true, "nativeEvent 없으면 합성 isComposing 폴백");
}

console.log("\n[F] 배선 — 세 Enter 핸들러가 isSubmitEnter 사용 + raw Enter 잔존 0");
{
  const advisor = read("src/components/advisor/AdvisorChat.tsx");
  const chat = read("src/components/trust/ChatPanel.tsx");
  const login = read("src/app/login/page.tsx");

  ok(/from\s+["']@\/lib\/ui\/keys["']/.test(advisor), "AdvisorChat import @/lib/ui/keys");
  ok(advisor.includes("isSubmitEnter(e)"), "AdvisorChat isSubmitEnter(e) 사용");
  ok(/from\s+["']@\/lib\/ui\/keys["']/.test(chat), "ChatPanel import @/lib/ui/keys");
  ok(chat.includes("isSubmitEnter(e)"), "ChatPanel isSubmitEnter(e) 사용");
  ok(/from\s+["']@\/lib\/ui\/keys["']/.test(login), "login import @/lib/ui/keys");
  ok(login.includes("isSubmitEnter(e, { allowShift: true })"), "login allowShift 전송");

  // ★raw `e.key === "Enter"` 직접 핸들러가 세 파일에 재등장하면 회귀(IME 미확인)
  for (const [name, src] of [["AdvisorChat", advisor], ["ChatPanel", chat], ["login", login]]) {
    ok(!/e\.key\s*===\s*["']Enter["']/.test(src), `${name}: raw e.key==="Enter" 직접 비교 잔존 0`);
  }
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
if (fail > 0) process.exit(1);
