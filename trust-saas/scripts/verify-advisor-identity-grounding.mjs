/* ============================================================
   회귀 가드 — 상담(advisor·Pillar 2) 정체성 매칭 → strong grounding

   배경(오분류 갭): RAG-lite 리트리버의 어휘 점수만으로는 "담보신탁이 무엇인가요?"
   같은 핵심 정의 질문이 도메인어 한 개라 topScore≈5(태그 1매칭 +3, 본문 +2)로
   STRONG_GROUNDING_SCORE(6) 미만이 된다. 종전엔 이를 '약한 grounding'으로 분류해 —
   제품 1차 범위인 담보신탁의 *정확한* 청크(trust-collateral)를 회수했음에도 —
   ① LLM 엔 "주제가 어긋났을 수 있음"(WEAK_GROUNDING_NOTE) 주의가 붙고
   ② 사용자에겐 "⚠ 관련도 낮음" 칩이 떴다(gap-report 2026-06-22: 미적중/약적중 최다
   질문 = "담보신탁이 무엇인가요?" 8회). 핵심 도메인 정의 질문에 자기 코어 개념을
   "관련도 낮음"으로 표시하는 것은 제품 신뢰를 정확히 가장 중요한 질문에서 깎았다.

   수정(점수 무변경·grounding 강도 판정만):
     - retrieve.ts: Retrieved.identity — 질의가 청크 topic 의 *고유 복합 도메인어*
       (4자 이상 토큰, 조사 제거 후 정확 일치)를 포함하는지. ★score 는 절대 안 바꾼다
       (가산만의 채점 계약·기존 retrieve 가드 전부 보존). 4자 이상 게이트로 일반 단어
       (신탁2·구조2·단계2·세제2·pf2)는 제외(오탐 차단).
     - system.ts: groundingStrength(topScore, identity=false) — identity 면 점수 미만
       이어도 strong. 후방호환(2-arg 미만 호출 = 종전 점수 단독).
     - route.ts: groundingStrength(retrieved[0]?.score ?? 0, retrieved[0]?.identity ?? false).

   단언:
     (A) retrieve 가 identity 필드를 노출(불리언)
     (B) "담보신탁이 무엇인가요?" → trust-collateral·identity=true·점수<임계인데 strong
     (C) josa-stem 경유 — raw 토큰("담보신탁이")≠topic("담보신탁"), stem 으로만 정체성 성립
     (D) 다른 핵심 정의 질문(우선수익권·관리형토지신탁)도 identity=true
     (E) 오탐 차단 — 일반 단어 '신탁'(2자)·'구조'(2자) 정확 입력은 identity=false
     (F) 부분 일치 차단 — '담보'(2자)만으로는 '담보신탁' 정체성 미성립(정확 토큰만)
     (G) 점수 무변경 회귀 — 격리 합성 청크 채점이 종전과 동일(태그 6·본문 cap 3)
     (H) 후방호환 — groundingStrength(5)(1-arg)=weak·groundingStrength(5,true)=strong
     (I) route.ts 배선 — retrieved[0].identity 를 groundingStrength 2번째 인자로 전달
     (J) 멀티턴 — 직전 정의 질문 맥락이 후속 질문("그럼 절차는?")의 identity 를 끌어줌

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-advisor-identity-grounding.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { retrieve, buildRetrievalQuery } from "../src/lib/advisor/retrieve.ts";
import { groundingStrength, STRONG_GROUNDING_SCORE } from "../src/lib/advisor/system.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => readFileSync(path.join(root, ...p), "utf8");

const top = (q) => retrieve(q, 3)[0] ?? null;

console.log("\n[A] retrieve 가 identity 필드를 노출");
{
  const t = top("담보신탁이 무엇인가요?");
  ok(t !== null && typeof t.identity === "boolean", "Retrieved.identity 가 불리언으로 존재");
}

console.log("\n[B] 핵심 정의 질문 — 점수<임계인데 정체성으로 strong");
{
  const t = top("담보신탁이 무엇인가요?");
  ok(t.chunk.id === "trust-collateral", "1위 = trust-collateral(담보신탁 정확 청크)");
  ok(t.score < STRONG_GROUNDING_SCORE, `점수(${t.score})는 임계(${STRONG_GROUNDING_SCORE}) 미만 — 어휘만으론 weak`);
  ok(t.identity === true, "identity=true(질의가 canonical '담보신탁' 정확 포함)");
  ok(groundingStrength(t.score, t.identity) === "strong", "end-to-end → strong(관련도 낮음 칩 미노출)");
}

console.log("\n[C] josa-stem 경유 정체성 — raw≠topic, stem 으로만 성립");
{
  // "담보신탁이"(raw) 는 topic "담보신탁" 과 다르다 — 조사 '이' 제거 stem 으로만 정확 일치.
  const t = top("담보신탁이 무엇인가요?");
  ok(t.identity === true, "조사 흡착('담보신탁이') 도 stem 으로 정체성 성립");
  // 조사 없는 정확 입력도 당연히 성립.
  ok(top("담보신탁 설명해줘").identity === true, "조사 없는 '담보신탁' 정확 입력도 identity=true");
}

console.log("\n[D] 다른 핵심 정의 질문도 정체성 매칭");
{
  ok(top("우선수익권이 무엇인가요?").identity === true, "'우선수익권'(5자) → identity=true");
  ok(top("관리형토지신탁의 책임준공 알려줘").identity === true, "'관리형토지신탁'(7자) → identity=true");
}

console.log("\n[E] 오탐 차단 — 일반 단어(2자) 정확 입력은 identity=false");
{
  // '신탁'(2자)·'구조'(2자) 는 4자 미만이라 정체성 토큰에서 제외 → 일반어로 특정 복합
  // 청크를 strong 으로 끌어올리지 않는다(점수로 strong 이 되는 것과 무관·identity 만 false).
  const sin = top("신탁이 뭐야?");
  ok(sin === null || sin.identity === false, "'신탁'(2자) 정확 입력 → identity=false");
  const gu = top("구조가 궁금해");
  ok(gu === null || gu.identity === false, "'구조'(2자) 정확 입력 → identity=false");
}

console.log("\n[F] 부분 일치 차단 — '담보'(2자)만으로는 '담보신탁' 정체성 미성립");
{
  // '담보'(2자)는 정체성 토큰 길이 게이트(4자) 미만이자 topic 토큰('담보신탁')과 정확
  // 일치도 아니다 → identity 는 정확 토큰 매칭만(부분문자열 가산은 score 에만 반영).
  const t = top("담보 절차가 어떻게 돼?");
  ok(t === null || t.identity === false, "'담보' 부분어로는 담보신탁 정체성 미성립(정확 토큰만)");
}

console.log("\n[G] 점수 무변경 회귀 — 격리 합성 청크 채점이 종전과 동일");
{
  // identity 추가가 score 채점을 건드리지 않았음을 격리 검증(retrieve 가드 [A][B] 미러).
  const C = (id, tags, text) => ({ id, topic: "중립토픽", tags, text });
  const chunks = [
    C("z-tagboth", ["zorpaa", "zbeta"], "본문 없음"),       // 태그 2 → 6
    C("z-body5", ["xnone"], "zorpaa zorpaa zorpaa zorpaa zorpaa"), // 본문 cap → 3
  ];
  const r = retrieve("zorpaa zbeta", 50, chunks);
  const sc = (id) => { const h = r.find((x) => x.chunk.id === id); return h ? h.score : null; };
  ok(sc("z-tagboth") === 6, "태그 2토큰 = 6(채점 불변)");
  ok(sc("z-body5") === 3, "본문 5회 = 3(cap 불변)");
  // 합성 청크 topic '중립토픽'(4자)은 질의 토큰과 무관 → identity 미발화.
  ok(r.every((x) => x.identity === false), "합성 청크 전부 identity=false(질의 무관 topic)");
}

console.log("\n[H] 후방호환 — groundingStrength 1-arg / 2-arg");
{
  ok(groundingStrength(5) === "weak", "1-arg groundingStrength(5) = weak(종전 동일)");
  ok(groundingStrength(6) === "strong", "1-arg groundingStrength(6) = strong(경계 불변)");
  ok(groundingStrength(5, true) === "strong", "2-arg identity=true → strong");
  ok(groundingStrength(5, false) === "weak", "2-arg identity=false → 종전 동일");
}

console.log("\n[I] route.ts 배선 — identity 를 groundingStrength 2번째 인자로 전달");
{
  const route = read("src", "app", "api", "advisor", "route.ts");
  ok(/groundingStrength\(\s*retrieved\[0\]\?\.score\s*\?\?\s*0,\s*retrieved\[0\]\?\.identity\s*\?\?\s*false\s*\)/.test(route),
    "groundingStrength(retrieved[0]?.score ?? 0, retrieved[0]?.identity ?? false)");
}

console.log("\n[J] 멀티턴 — 직전 정의 질문 맥락이 후속 질문 identity 를 끌어줌");
{
  // buildRetrievalQuery 가 직전 user 발화를 합치므로, 그 자체엔 도메인어 없는 후속 질문
  // ("그럼 절차는?")도 직전 "담보신탁이 무엇인가요?" 맥락으로 정체성이 성립한다.
  const q = buildRetrievalQuery([
    { role: "user", content: "담보신탁이 무엇인가요?" },
    { role: "assistant", content: "담보신탁은 ..." },
    { role: "user", content: "그럼 절차는?" },
  ]);
  const t = retrieve(q, 3)[0];
  ok(t && t.identity === true, "맥락 결합 질의 → 담보신탁 identity=true(후속 질문도 strong)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
if (fail > 0) process.exit(1);
