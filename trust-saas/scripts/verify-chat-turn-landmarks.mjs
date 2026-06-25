/* ============================================================
   회귀 가드 — 인앱 AI 어시스턴트(ChatPanel) 대화 턴 <article> 랜드마크 + 발화자 라벨

   배경(a11y·표시 전용, 비-산출물):
   공개 상담 AdvisorChat 의 대화 턴은 .sr-only 발화자 라벨 + <article aria-label>
   (verify-advisor-turn-landmarks)로 ① 선형 읽기 시 발화자 고지 ② NVDA/JAWS article
   quicknav 로 답변 단위 탐색을 제공한다. 그러나 **인앱 AI 어시스턴트 드로어(ChatPanel)**
   의 대화 턴은 평범한 <div className="chat-msg …">{m.display}</div> 라, SR 사용자는
   ① 발화자(나/AI)를 알 수 없고(시각은 좌/우 정렬·색으로 구분) ② 턴 단위로 건너뛸
   수단이 없었다(div=article quicknav 비대상). 같은 a11y 패리티를 인앱 챗에도 적용한다.

   해결: 각 대화 턴(user / assistant / note=반영 알림)을 <article> 로 감싸 답변 단위
   탐색을 제공하고, aria-label 로 발화자+턴 이름을, .sr-only 로 선형 읽기 발화자 라벨을
   준다. turn = 그 메시지까지의 사용자 발화 수(질문·답변·반영 알림이 같은 번호, 첫
   인사는 turn 0 → 번호 없는 "AI 어시스턴트").

   ★왜 <article> 인가(landmark 아님): article 은 "문서구조 role" 이라 quicknav 대상이
   되되 랜드마크 목록(banner/nav/main…)을 어지럽히지 않는다(role="region"/feed 를 매
   턴에 거는 것보다 과다 신호가 적다 — AdvisorChat 와 동일 근거).

   ★시각·레이아웃 무변경: <article> 도 block 표시이고 globals.css 의 .chat-msg 규칙은
   요소-비한정(div.chat-msg 같은 요소 한정 규칙 없음)이라 div→article 로 스타일 불변.

   ★과다 낭독 회피: 컨테이너 .chat-body 에 role=log/feed/aria-live 를 걸지 않는다 —
   드로어에는 이미 전용 .sr-only role=status 라이브 영역(live)이 작성중/도착/반영을
   고지하므로, 컨테이너까지 라이브화하면 이중 낭독이 된다.

   핵심 불변식:
     (A) 대화 턴 map 이 <article>(div 아님)·className="chat-msg "+(kind??role) 유지.
     (B) 각 article 이 발화자 aria-label(speaker)·.sr-only 발화자 라벨을 가짐.
     (C) speaker 라벨 분기 — user="내 질문 N" / note="AI 어시스턴트 반영 알림" /
         assistant turn>0="AI 어시스턴트 N" / 첫 인사 turn 0="AI 어시스턴트".
     (D) aria-label 이 className '앞'(변형 없이 탐색 이름만 부여).
     (E) ★과다 낭독 회피 — 컨테이너 .chat-body 는 role=log/feed/aria-live 미부착.
     (F) 시각 무변경 — globals.css 에 요소 한정 div.chat-msg 규칙 부재.

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-chat-turn-landmarks.mjs
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
const chat = readFileSync(path.join(root, "src", "components", "trust", "ChatPanel.tsx"), "utf8");
const css = readFileSync(path.join(root, "src", "app", "globals.css"), "utf8");

// 대화 턴 map 의 여는 태그를 격리(className 식 기준)
const classExpr = 'className={"chat-msg " + (m.kind ?? m.role)}';
const at = chat.indexOf(classExpr);
const lt = at >= 0 ? chat.lastIndexOf("<", at) : -1;
const turnTag = lt >= 0 ? chat.slice(lt, at + classExpr.length) : "";

console.log("\n[A] 대화 턴이 <article> 요소로 렌더(div 아님)·className 유지");
{
  ok(at >= 0, '대화 턴 className={"chat-msg " + (m.kind ?? m.role)} 존재');
  ok(/^<article\b/.test(turnTag), "대화 턴 여는 태그가 <article>");
  // 동적 턴 map 이 더 이상 <div ...className={"chat-msg " + (m.kind ?? m.role)}> 로 렌더되지 않음
  ok(!/<div\b[^>]*className=\{"chat-msg " \+ \(m\.kind \?\? m\.role\)\}/.test(chat),
    "대화 턴 map 이 <div> 로 렌더되지 않음(article 로 전환)");
  ok((chat.match(/<\/article>/g) || []).length >= 1, "</article> 닫는 태그 ≥ 1");
}

console.log("\n[B] 각 article 이 발화자 aria-label + .sr-only 발화자 라벨을 가짐");
{
  ok(/aria-label=\{speaker\}/.test(turnTag), "턴 article aria-label={speaker}");
  ok(/<span className="sr-only">\{speaker\}\. <\/span>/.test(chat),
    '.sr-only 발화자 라벨 <span className="sr-only">{speaker}. </span> 존재');
}

console.log("\n[C] speaker 라벨 분기 — 발화자별 정확한 이름");
{
  ok(/`내 질문 \$\{turn\}`/.test(chat), 'user → "내 질문 ${turn}"');
  ok(/"AI 어시스턴트 반영 알림"/.test(chat), 'note(kind) → "AI 어시스턴트 반영 알림"');
  ok(/`AI 어시스턴트 \$\{turn\}`/.test(chat), 'assistant(turn>0) → "AI 어시스턴트 ${turn}"');
  ok(/turn > 0\s*\?\s*`AI 어시스턴트 \$\{turn\}`\s*:\s*"AI 어시스턴트"/.test(chat),
    "첫 인사(turn 0) → 번호 없는 \"AI 어시스턴트\"");
  // turn = 그 메시지까지의 사용자 발화 수(질문·답변·반영 알림이 같은 번호)
  ok(/const turn = msgs\.slice\(0, i \+ 1\)\.filter\(\(x\) => x\.role === "user"\)\.length;/.test(chat),
    "turn = 메시지까지의 사용자 발화 수(단일 산식)");
}

console.log("\n[D] aria-label 이 className '앞' — 변형 없이 탐색 이름만 부여");
{
  ok(chat.includes('aria-label={speaker} className={"chat-msg " + (m.kind ?? m.role)}'),
    "aria-label → className 순서(턴 article 구성 보존)");
}

console.log("\n[E] ★과다 낭독 회피 무회귀 — 컨테이너 .chat-body 는 role=log/feed/aria-live 미부착");
{
  const idx = chat.indexOf('className="chat-body"');
  ok(idx >= 0, ".chat-body 컨테이너 존재");
  const seg = idx >= 0 ? chat.slice(idx, idx + 120) : "";
  ok(!/role="log"/.test(seg), '.chat-body role="log" 미부착(이중 낭독 방지)');
  ok(!/role="feed"/.test(seg), '.chat-body role="feed" 미부착(article 만으로 탐색)');
  ok(!/aria-live=/.test(seg), ".chat-body aria-live 미부착(전용 sr-only live 영역이 고지 전담)");
  // 전용 라이브 영역(live)은 그대로 존재해야 한다(작성중/도착/반영 고지 단일 출처)
  ok(/role="status" aria-live="polite" aria-atomic="true">\s*\{live\}/.test(chat),
    "전용 sr-only role=status 라이브 영역(live) 보존");
}

console.log("\n[F] 시각 무변경 — 요소 한정 div.chat-msg 규칙 부재");
{
  ok(/\.chat-msg\s*\{/.test(css), ".chat-msg 클래스 규칙 존재");
  ok(!/\bdiv\.chat-msg\b/.test(css), "div.chat-msg(요소 한정) 규칙 없음 → article 로 바뀌어도 스타일 유지");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
process.exit(fail === 0 ? 0 : 1);
