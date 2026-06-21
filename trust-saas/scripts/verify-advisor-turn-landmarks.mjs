/* ============================================================
   회귀 가드 — 상담(advisor·Pillar 2) 대화 턴 <article> 랜드마크(답변 단위 탐색)

   배경(a11y·표시 전용, 비-산출물):
   AdvisorChat 의 대화 턴은 02:35 에 .sr-only 발화자 라벨("내 질문."/"상담 답변.")로
   선형 읽기 시 발화자를 고지하도록 했다(verify-advisor-turnlabels 담당). 그러나
   긴 상담 이력을 스크린리더로 볼 때 질문/답변 "단위로 건너뛰며 탐색"할 수단은 없었다
   — 각 턴이 평범한 <div> 라 NVDA·JAWS 의 article quicknav 대상이 아니었다.
   해결: 세 턴(user / 정상 답변 / 오류 답변)을 <article> 요소로 감싸 답변 단위
   탐색을 제공하고, aria-label 로 턴 이름을 준다.

   ★왜 <article> 인가(landmark 아님): article 은 "문서구조 role" 이라 NVDA/JAWS 의
   article quicknav('a' 등)로 턴 사이를 건너뛸 수 있게 하되, 랜드마크 목록(banner/
   nav/main/complementary…)에는 끼지 않는다 → 턴이 많아도 랜드마크 목록을 어지럽히지
   않는다(role="region"/feed 를 매 턴에 거는 것보다 과다 신호가 적다).

   ★turnlabels(02:35) 무회귀 공존: aria-label 을 className '앞'에 두어 turnlabels
   가드의 블록 앵커(className="advisor-msg …" 부분문자열)를 그대로 보존한다. .sr-only
   라벨도 손대지 않는다 — 선형 읽기 라벨(.sr-only)과 탐색 이름(article aria-label)은
   별개 메커니즘으로 공존한다.

   ★시각·레이아웃 무변경: <article> 도 block 표시이고 globals.css 의 .advisor-msg
   규칙은 요소-비한정(div.advisor-msg 같은 요소 한정 규칙 없음)이라 div→article 로
   스타일이 바뀌지 않는다.

   핵심 불변식:
     (A) 세 턴이 모두 <article> 요소로 렌더(div 아님)·각 advisor-msg 클래스 유지.
     (B) 각 article 이 발화자 aria-label(내 질문 / 상담 답변)을 가짐(탐색 이름).
     (C) aria-label 이 className '앞' → turnlabels 블록 앵커 보존(무회귀).
     (D) 02:35 .sr-only 발화자 라벨 보존(선형 읽기 라벨과 탐색 article 공존).
     (E) ★과다 낭독 회피 무회귀 — 컨테이너 .advisor-msgs 는 role=log/aria-live
         미부착(feed/log 화하지 않음)·aria-busy 보존.
     (F) 시각 무변경 — globals.css 에 요소 한정 div.advisor-msg 규칙 부재.

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-advisor-turn-landmarks.mjs
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
const chat = readFileSync(path.join(root, "src", "components", "advisor", "AdvisorChat.tsx"), "utf8");
const css = readFileSync(path.join(root, "src", "app", "globals.css"), "utf8");

// 클래스 문자열을 가진 여는 태그를 격리해 "어떤 요소"인지·aria-label 위치를 검사.
function openTagFor(classStr) {
  const at = chat.indexOf('className="' + classStr + '"');
  if (at < 0) return "";
  const lt = chat.lastIndexOf("<", at);
  return lt < 0 ? "" : chat.slice(lt, at + ('className="' + classStr + '"').length);
}
const userTag = openTagFor("advisor-msg user");
const normTag = openTagFor("advisor-msg assistant");
// 오류 턴은 className 뒤에 role="alert" 가 붙어 별도 격리
const errAt = chat.indexOf('className="advisor-msg assistant" role="alert"');
const errLt = errAt >= 0 ? chat.lastIndexOf("<", errAt) : -1;
const errTag = errLt >= 0 ? chat.slice(errLt, errAt) : "";

console.log("\n[A] 세 턴이 <article> 요소로 렌더(div 아님)");
{
  ok(/^<article\b/.test(userTag), "user 턴이 <article>");
  ok(/^<article\b/.test(normTag), "정상 답변 턴이 <article>");
  ok(/^<article\b/.test(errTag), "오류 답변 턴이 <article>");
  // 턴이 더 이상 <div ...className="advisor-msg user|assistant"> 로 렌더되지 않음
  ok(!/<div\b[^>]*className="advisor-msg (?:user|assistant)"/.test(chat),
    "어떤 advisor-msg 턴도 <div> 로 렌더되지 않음(전부 article)");
  // 닫는 </article> 가 최소 3개(세 턴)
  ok((chat.match(/<\/article>/g) || []).length >= 3, "</article> 닫는 태그 ≥ 3(세 턴)");
}

console.log("\n[B] 각 article 이 발화자 aria-label(탐색 이름)을 가짐");
{
  ok(/aria-label="내 질문"/.test(userTag), "user article aria-label=\"내 질문\"");
  ok(/aria-label="상담 답변"/.test(normTag), "정상 답변 article aria-label=\"상담 답변\"");
  ok(/aria-label="상담 답변"/.test(errTag), "오류 답변 article aria-label=\"상담 답변\"");
}

console.log("\n[C] aria-label 이 className '앞' — turnlabels 블록 앵커 보존(무회귀)");
{
  // turnlabels 가드가 부분문자열로 격리하는 앵커가 그대로 살아 있는지 직접 확인
  ok(chat.includes('aria-label="내 질문" className="advisor-msg user"'),
    "user: aria-label → className 순서(앵커 className=\"advisor-msg user\" 보존)");
  ok(chat.includes('aria-label="상담 답변" className="advisor-msg assistant">'),
    "정상: 앵커 className=\"advisor-msg assistant\"> 보존");
  ok(chat.includes('aria-label="상담 답변" className="advisor-msg assistant" role="alert"'),
    "오류: 앵커 className=\"advisor-msg assistant\" role=\"alert\" 보존");
}

console.log("\n[D] 02:35 .sr-only 발화자 라벨 보존(선형 읽기 라벨과 공존)");
{
  ok(/<span className="sr-only">내 질문\. <\/span>/.test(chat), ".sr-only \"내 질문.\" 라벨 보존");
  ok((chat.match(/<span className="sr-only">상담 답변\. <\/span>/g) || []).length === 2,
    ".sr-only \"상담 답변.\" 라벨 2회(정상·오류) 보존");
}

console.log("\n[E] ★과다 낭독 회피 무회귀 — 컨테이너 role=log/aria-live 미부착");
{
  const idx = chat.indexOf('className="advisor-msgs"');
  ok(idx >= 0, ".advisor-msgs 컨테이너 존재");
  const seg = idx >= 0 ? chat.slice(idx, idx + 140) : "";
  ok(!/role="log"/.test(seg), ".advisor-msgs role=\"log\" 미부착(스트리밍 본문 과다 낭독 방지)");
  ok(!/role="feed"/.test(seg), ".advisor-msgs role=\"feed\" 미부착(article 만으로 탐색·feed 과신호 회피)");
  ok(!/aria-live=/.test(seg), ".advisor-msgs aria-live 미부착");
  ok(/aria-busy=\{busy\}/.test(seg), ".advisor-msgs aria-busy={busy} 보존");
}

console.log("\n[F] 시각 무변경 — 요소 한정 div.advisor-msg 규칙 부재");
{
  ok(/\.advisor-msg\s*\{/.test(css), ".advisor-msg 클래스 규칙 존재");
  ok(!/\bdiv\.advisor-msg\b/.test(css), "div.advisor-msg(요소 한정) 규칙 없음 → article 로 바뀌어도 스타일 유지");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
process.exit(fail === 0 ? 0 : 1);
