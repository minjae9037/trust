/* ============================================================
   회귀 가드 — AI 어시스턴트(ChatPanel) 다이얼로그 접근성
   (WCAG 4.1.2 Name·Role·Value / 2.4.3 Focus Order / 2.1.2 No Keyboard Trap)

   배경(a11y·표시/포커스 경계만, 비-산출물): AI 어시스턴트는 화면 우측 전체 높이
   드로어(.chat-panel)로 떠 있으나 종전엔 ① role/aria-modal 이 없어 보조기술에
   다이얼로그로 고지되지 않았고 ② 열어도 포커스가 트리거(chat-fab)에 남는데 그
   트리거는 열림과 동시에 언마운트돼 포커스가 document.body 로 사라졌으며 ③ Tab 이
   드로어 밖(뒤 페이지)으로 새고 ④ Esc 로 닫을 수단이 없었다 — 키보드/스크린리더
   사용자가 드로어에 갇히거나 길을 잃던 갭(13:40 다음스텝 "포커스 트랩 점검").

   해결: 공용 useDialog 훅으로 드로어를 다이얼로그화 —
     - 마운트 시 입력란(data-autofocus)으로 초기 포커스 이동.
     - Tab/Shift+Tab 이 경계에서 순환 = 포커스 트랩.
     - Esc 로 onClose().
     - role="dialog"·aria-modal="true"·aria-labelledby(제목 id).
   트리거(chat-fab)로의 포커스 복귀는 TrustApp 이 fab ref + 닫힘 effect 로 담당
   (fab 이 드로어 열림 시 언마운트되므로 다이얼로그 밖에서 복귀해야 함).

   핵심 불변식:
     (A) useDialog 훅 = Esc→onClose·Tab 경계 순환·초기 포커스(data-autofocus→
         첫 포커서블→컨테이너)·onClose 를 ref 로 받아 effect 의존성 비움.
     (B) ChatPanel = useDialog import + 루트 div(ref·role=dialog·aria-modal·
         aria-labelledby·tabIndex=-1) + 제목 id + textarea data-autofocus.
     (C) TrustApp = fabRef + 닫힘 시 복귀 effect(chatWasOpen 가드) + fab ref/onClose 배선.
     (D) 무회귀 — onClose/닫기 버튼/textarea send 배선·조문·엔진·산출물 무접촉.

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-chat-dialog-a11y.mjs
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
const rd = (...p) => readFileSync(path.join(root, ...p), "utf8");
const hook = rd("src", "lib", "ui", "use-dialog.ts");
const chat = rd("src", "components", "trust", "ChatPanel.tsx");
const app = rd("src", "components", "trust", "TrustApp.tsx");

console.log("\n[A] useDialog 훅 — Esc·포커스 트랩·초기 포커스·안정 의존성");
{
  ok(/export function useDialog<T extends HTMLElement>\(onClose: \(\) => void\)/.test(hook), "useDialog(onClose) 시그니처");
  ok(/const ref = useRef<T>\(null\)/.test(hook), "컨테이너 ref 반환");
  // onClose 를 ref 로 받아 effect 의존성([])에서 빼 둠 = 매 렌더 트랩 재설치 0.
  ok(/onCloseRef\.current = onClose/.test(hook), "onClose 를 ref 로 보관(매 렌더 갱신)");
  ok(/useEffect\([\s\S]*\}, \[\]\)/.test(hook), "트랩 effect 의존성 []=1회 설치");
  // 초기 포커스 우선순위: data-autofocus → 첫 포커서블 → 컨테이너.
  ok(/querySelector<HTMLElement>\("\[data-autofocus\]"\) \?\? focusables\(\)\[0\] \?\? node/.test(hook), "초기 포커스 우선순위(data-autofocus→첫 포커서블→컨테이너)");
  ok(/initial\.focus\(\)/.test(hook), "마운트 시 초기 포커스 호출");
  // Esc → onClose.
  ok(/e\.key === "Escape"[\s\S]*onCloseRef\.current\(\)/.test(hook), "Esc 키 → onClose()");
  // Tab 트랩: shift 시 first→last, 아니면 last→first 순환 + 컨테이너 밖이면 되감기.
  ok(/e\.key !== "Tab"/.test(hook), "Tab 외 키는 무시");
  ok(/if \(e\.shiftKey\)[\s\S]*active === first \|\| !node\.contains\(active\)[\s\S]*last\.focus\(\)/.test(hook), "Shift+Tab 경계(첫/밖)→마지막 순환");
  ok(/active === last \|\| !node\.contains\(active\)[\s\S]*first\.focus\(\)/.test(hook), "Tab 경계(마지막/밖)→첫 순환");
  ok(/items\.length === 0[\s\S]*e\.preventDefault\(\)/.test(hook), "포커서블 0이면 컨테이너에 묶음(밖으로 탈출 방지)");
  ok(/el\.offsetParent !== null/.test(hook), "보이는 포커서블만(숨김 제외)");
  ok(/removeEventListener\("keydown", onKeyDown\)/.test(hook), "언마운트 시 리스너 정리");
}

console.log("\n[B] ChatPanel — 드로어를 다이얼로그로 (role/aria/포커스)");
{
  ok(/import \{ useDialog \} from "@\/lib\/ui\/use-dialog"/.test(chat), "useDialog import");
  ok(/const dialogRef = useDialog<HTMLDivElement>\(onClose\)/.test(chat), "dialogRef = useDialog(onClose)");
  // 루트 .chat-panel div 블록 격리 후 다이얼로그 속성 일괄 확인.
  const i = chat.indexOf('className="chat-panel"');
  const seg = i >= 0 ? chat.slice(i, i + 280) : "";
  ok(seg.length > 0, "루트 .chat-panel 블록 존재");
  ok(/ref=\{dialogRef\}/.test(seg), "루트 div ref={dialogRef}");
  ok(/role="dialog"/.test(seg), 'role="dialog"');
  ok(/aria-modal="true"/.test(seg), 'aria-modal="true"');
  ok(/aria-labelledby="chat-panel-title"/.test(seg), "aria-labelledby=제목 id");
  ok(/tabIndex=\{-1\}/.test(seg), "tabIndex={-1}(컨테이너 포커스 폴백)");
  ok(/<strong id="chat-panel-title">AI 어시스턴트<\/strong>/.test(chat), "제목 strong id=chat-panel-title");
  // textarea 가 data-autofocus → 열면 입력란으로 포커스(닫기 버튼 아님).
  const t = chat.indexOf('aria-label="AI 어시스턴트 질문 입력"');
  const tseg = t >= 0 ? chat.slice(t, t + 120) : "";
  ok(/data-autofocus/.test(tseg), "질문 textarea data-autofocus(초기 포커스 대상)");
}

console.log("\n[C] TrustApp — 닫힘 시 트리거(chat-fab)로 포커스 복귀");
{
  ok(/import \{ useEffect, useRef, useState \} from "react"/.test(app), "useRef import 추가");
  ok(/const fabRef = useRef<HTMLButtonElement>\(null\)/.test(app), "fabRef 정의");
  ok(/const chatWasOpen = useRef\(false\)/.test(app), "chatWasOpen 표식(초기 마운트 가로채기 방지)");
  // 닫힘(true→false) 전이일 때만 fab 로 복귀 — 초기 false 마운트는 무동작.
  ok(/if \(chatWasOpen\.current && !chatOpen\) fabRef\.current\?\.focus\(\)/.test(app), "닫힘 전이 시 fab 포커스 복귀");
  ok(/chatWasOpen\.current = chatOpen/.test(app), "전이 추적값 갱신");
  ok(/\}, \[chatOpen\]\)/.test(app), "effect 의존성 [chatOpen]");
  // fab 에 ref 배선 + 열기 onClick 보존.
  const f = app.indexOf('className="chat-fab"');
  const fseg = f >= 0 ? app.slice(Math.max(0, f - 80), f + 120) : "";
  ok(/ref=\{fabRef\}/.test(fseg), "chat-fab ref={fabRef}");
  ok(/onClick=\{\(\) => setChatOpen\(true\)\}/.test(fseg), "chat-fab 열기 onClick 보존");
}

console.log("\n[D] 무회귀 — 배선/onClose 보존 · 조문·엔진·산출물 무접촉");
{
  // onClose 배선(닫기 버튼·다이얼로그 닫힘)은 그대로.
  ok(/onClose=\{\(\) => setChatOpen\(false\)\}/.test(app), "ChatPanel onClose 배선 보존");
  ok(/onClick=\{onClose\}[\s\S]*aria-label="AI 어시스턴트 닫기"/.test(chat), "닫기(✕) 버튼 onClose·접근명 보존");
  ok(/onClick=\{send\}/.test(chat), "전송 버튼 send 배선 보존");
  ok(/onKeyDown=\{\(e\) => \{[\s\S]*isSubmitEnter\(e\)[\s\S]*send\(\)/.test(chat), "textarea Enter 전송 보존");
  // 표시/포커스 경계만 — 조문·엔진·빌더·산출물 import 없음(채팅 폼 패치 로직은 무접촉).
  ok(!/builders|clauses\/body|clauses\/annex|engine\/annex/.test(hook), "useDialog 훅 조문/빌더 import 0");
  ok(/mergeFormPatch/.test(chat), "기존 폼 패치 배선(mergeFormPatch) 보존(무접촉)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
process.exit(fail === 0 ? 0 : 1);
