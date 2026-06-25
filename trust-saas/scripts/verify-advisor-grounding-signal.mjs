/* ============================================================
   회귀 가드 — 상담(advisor·Pillar 2) 약한 grounding 사용자 투명 신호

   배경(투명성 갭): 라우트는 회수 최고점수로 grounding 강도(strong/weak)를
   판정해 LLM 시스템 프롬프트에 약한 grounding 주의(WEAK_GROUNDING_NOTE)를
   주입하지만(system.ts groundingStrength), 이 신호는 **사용자에게 전혀
   노출되지 않았다**. 즉 답변이 질문과 약하게만 매칭된 빈약한 참고자료에
   기댔는지를 사용자가 알 길이 없어, 약한 grounding 답을 확정 근거로 오인할
   수 있었다(CLAUDE.md 운영원칙 #2 정확성 최우선 / #3 가드레일).

   수정(표시 전용·회수 로직/조문/빌더/엔진 무접촉):
     - route.ts: 이미 계산되는 strength 를 라이브 응답 헤더 X-Advisor-Grounding
       으로 노출(Access-Control-Expose-Headers 동반). ★캐시 적중 경로는 strength
       를 계산하지 않으므로 헤더를 의도적으로 미부착(없는 신호 날조 금지).
     - AdvisorChat.tsx: 헤더를 디코드해 msg.grounding("weak")에 싣고, 참고자료
       패널 안에서 grounding==="weak" 일 때만 "관련도 낮음" 칩을 렌더(선두 ⚠
       글리프 aria-hidden·"관련도 낮음"이 의미 라벨·상세는 title). 칩은 sources
       블록 내부라 회수 0건(참고자료 미노출)엔 안 뜬다.
     - globals.css: .advisor-grounding-weak(danger 색계).

   본 가드는 strength 를 만들어내는 순수 groundingStrength() 를 실제 호출해
   강·약 경계를 고정(behavioral)하고, route.ts·AdvisorChat.tsx·globals.css 의
   배선을 정적 확인한다.

   단언:
     (A) groundingStrength 경계 — ≥6 strong, 3~5·0 weak(헤더 값의 출처)
     (B) route.ts 라이브 경로 — X-Advisor-Grounding: strength 헤더 + expose
     (C) route.ts 캐시 적중 경로 — X-Advisor-Grounding 미부착(신호 날조 금지)
     (D) AdvisorChat — 헤더 디코드·msg.grounding 적재·weak 게이트 렌더
     (E) 칩 a11y — ⚠ aria-hidden·"관련도 낮음" 의미 라벨·sources 블록 내부
     (F) CSS .advisor-grounding-weak 정의(danger 토큰)
     (G) 무회귀 — strength 가 system 프롬프트(buildAdvisorSystem) 인자로 보존·
         STRONG_GROUNDING_SCORE/WEAK_GROUNDING_NOTE 불변·src-chip/sources 보존

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-advisor-grounding-signal.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  groundingStrength,
  STRONG_GROUNDING_SCORE,
  WEAK_GROUNDING_NOTE,
} from "../src/lib/advisor/system.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => readFileSync(path.join(root, ...p), "utf8");
const route = read("src", "app", "api", "advisor", "route.ts");
const chat = read("src", "components", "advisor", "AdvisorChat.tsx");
const css = read("src", "app", "globals.css");

console.log("\n[A] groundingStrength 경계 — 헤더 값(strength)의 출처");
{
  ok(STRONG_GROUNDING_SCORE === 6, "강·약 경계 점수 = 6(불변)");
  ok(groundingStrength(6) === "strong", "6점 = strong");
  ok(groundingStrength(7) === "strong", "7점 = strong");
  ok(groundingStrength(5) === "weak", "5점 = weak(겨우 임계만 넘긴 tangential)");
  ok(groundingStrength(3) === "weak", "3점 = weak(단발 태그 매칭)");
  ok(groundingStrength(0) === "weak", "0점 = weak(회수 0건 — 단, 칩은 sources 시에만)");
  // 정체성 매칭이면 점수 미만이어도 strong → "관련도 낮음" 칩 미노출(정의 질문 구제).
  ok(groundingStrength(5, true) === "strong", "5점+identity → strong(칩 미노출·핵심 정의 질문)");
  ok(groundingStrength(5, false) === "weak", "5점+identity=false → weak(종전 동일·오탐 차단)");
}

console.log("\n[B] route.ts 라이브 경로 — X-Advisor-Grounding 헤더 노출");
{
  // strength 는 종전부터 groundingStrength 로 계산됨 — 그 값을 헤더로 내보내는지.
  ok(/const\s+strength\s*=\s*groundingStrength\(/.test(route), "strength = groundingStrength(...) 계산(기존)");
  ok(/["']X-Advisor-Grounding["']\s*:\s*strength\b/.test(route), "라이브 응답 헤더 X-Advisor-Grounding: strength");
  ok(/Access-Control-Expose-Headers["']\s*:\s*["'][^"']*X-Advisor-Grounding/.test(route), "Expose-Headers 에 X-Advisor-Grounding 동반(클라이언트 읽기 가능)");
}

console.log("\n[C] route.ts 캐시 적중 경로 — X-Advisor-Grounding 미부착(신호 날조 금지)");
{
  // 캐시 적중 응답 블록(X-Advisor-Cache: "hit")엔 grounding 헤더가 없어야 한다.
  const hitIdx = route.indexOf('"X-Advisor-Cache": "hit"');
  ok(hitIdx >= 0, "캐시 적중 응답 블록 존재(X-Advisor-Cache: hit)");
  // 적중 블록 주변(앞뒤 400자) 범위에 grounding 헤더가 없음을 확인.
  const around = route.slice(Math.max(0, hitIdx - 400), hitIdx + 400);
  ok(!/X-Advisor-Grounding/.test(around), "캐시 적중 응답에 X-Advisor-Grounding 미부착");
  // 헤더는 라우트 전체에서 라이브 경로 1곳에서만 등장(strength 키 + expose 문자열 = 2회).
  const occ = (route.match(/X-Advisor-Grounding/g) || []).length;
  ok(occ === 2, "X-Advisor-Grounding 총 2회(헤더 키 + expose 목록, 라이브 경로 한정)");
}

console.log("\n[D] AdvisorChat — 헤더 디코드·msg.grounding 적재·weak 게이트");
{
  ok(/grounding\?\:\s*["']weak["']/.test(chat), "Msg.grounding?: \"weak\" 타입(약함만 표식)");
  ok(/res\.headers\.get\(["']X-Advisor-Grounding["']\)\s*===\s*["']weak["']/.test(chat), "헤더 디코드 — \"weak\" 일 때만 표식");
  // 스트리밍 setMsgs 에 grounding 동반 적재(sources 와 같은 경로).
  ok(/content:\s*acc,\s*sources:\s*srcs,\s*grounding\b/.test(chat), "스트리밍 msg 에 grounding 적재");
  ok(/m\.grounding\s*===\s*["']weak["']\s*&&/.test(chat), "렌더 게이트 = grounding === \"weak\"");
}

console.log("\n[E] 칩 a11y — ⚠ aria-hidden·의미 라벨·sources 블록 내부");
{
  ok(/advisor-grounding-weak/.test(chat), "칩 className=advisor-grounding-weak");
  ok(/<span aria-hidden="true">⚠ <\/span>관련도 낮음/.test(chat), "선두 ⚠ aria-hidden + 의미 라벨 \"관련도 낮음\"");
  ok(/title="[^"]*약하게 매칭된 참고자료[^"]*"/.test(chat), "title 상세 설명(약한 매칭 안내)");
  // weak 칩은 반드시 sources 패널(sources.length>0 게이트) 내부 — 회수 0건엔 안 뜬다.
  const srcIdx = chat.indexOf('className="advisor-sources"');
  const weakIdx = chat.indexOf('m.grounding === "weak"');
  const closeIdx = chat.indexOf("</div>", srcIdx);
  ok(srcIdx >= 0 && weakIdx > srcIdx, "weak 칩이 advisor-sources 블록 시작 뒤에 위치");
  ok(weakIdx > 0 && weakIdx < closeIdx, "weak 칩이 advisor-sources </div> 닫힘 전(블록 내부)");
  // 낭독 중복 방지 — 칩은 role/aria-live 미부착(정적 표시, 본문 텍스트가 낭독 전담).
  const chipBlock = chat.slice(weakIdx, weakIdx + 320);
  ok(!/role=|aria-live=/.test(chipBlock), "칩에 role/aria-live 미부착(정적 표시·이중 낭독 0)");
}

console.log("\n[F] CSS .advisor-grounding-weak 정의(danger 토큰)");
{
  const m = css.match(/\.advisor-grounding-weak\s*\{[^}]*\}/);
  ok(!!m, ".advisor-grounding-weak 규칙 정의");
  ok(!!m && /var\(--c-danger\)/.test(m[0]), "color/border = danger 토큰(주의 톤)");
  ok(!!m && /var\(--c-danger-soft\)/.test(m[0]), "background = danger-soft(좌측 게이트 동일 색계)");
}

console.log("\n[G] 무회귀 — strength 가 system 프롬프트 인자로 보존·기존 배선 불변");
{
  // strength 는 헤더로도 쓰이고 동시에 LLM 프롬프트(buildAdvisorSystem 3번째 인자)로도 쓰여야 한다.
  ok(/buildAdvisorSystem\(ADVISOR_PERSONA,\s*contextText,\s*strength\)/.test(route), "strength 가 buildAdvisorSystem 인자로 보존(프롬프트 가드 무회귀)");
  ok(WEAK_GROUNDING_NOTE.includes("약한 grounding"), "WEAK_GROUNDING_NOTE 불변(LLM 측 주의 지침)");
  ok(/className=\{"src-chip "\s*\+\s*s\.kind\}/.test(chat), "기존 src-chip 렌더 보존");
  ok(/📚 <\/span>참고한 자료/.test(chat), "참고자료 라벨 보존");
  ok(/X-Advisor-Sources/.test(chat) && /decodeSources/.test(chat), "기존 sources 헤더 디코드 보존");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
if (fail > 0) process.exit(1);
