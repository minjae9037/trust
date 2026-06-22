/* ============================================================
   회귀 가드 — 상담(advisor·Pillar 2) 약한 grounding 신뢰도 신호

   배경(가드레일 공백): RAG-lite 리트리버는 KNOWLEDGE 를 score≥3(질의 토큰
   1개가 태그에 단발 매칭=tangential), back-data 를 score≥6 으로 admit 한다.
   종전 buildAdvisorSystem 은 회수 결과가 1건이라도 있으면 — 최고점수가 겨우
   임계만 넘긴 3점이든 강하게 매칭된 15점이든 — 똑같이 GROUNDING_PREFIX("근거로
   활용") 만 주입했다. 그래서 약한 grounding(한 토큰만 스친 빈약한 자료)에도
   강한 매칭과 동일한 신뢰 프레이밍이 걸려 LLM 이 과의존할 수 있었다
   (CLAUDE.md 운영원칙 #1 사실 기반·추정 금지 / #3 가드레일, 17:17 회수 0건
   범위주의 마감의 다음스텝 = "저점수 약한 grounding 신뢰도 신호").

   수정: 회수 최고점수 → groundingStrength()(strong/weak) 순수 분기.
   강(≥STRONG_GROUNDING_SCORE)=종전대로 GROUNDING_PREFIX 만, 약=그 뒤에
   WEAK_GROUNDING_NOTE(관련성 먼저 판단·약하면 일반 원칙으로·자료 밖 고유
   수치/조항/절차 날조 금지)를 덧댄다. route.ts 는 retrieved[0].score 로 강도를
   계산해 buildAdvisorSystem 에 넘긴다. ★답을 막지 않음 — 신뢰도 신호만 보강.

   단언:
     (A) groundingStrength — 임계 미만→weak·임계 이상→strong·경계값(6)=strong
     (B) 약한 grounding 블록 = GROUNDING_PREFIX + WEAK_GROUNDING_NOTE + contextText
     (C) 강한 grounding 블록 = GROUNDING_PREFIX + contextText(WEAK note 미혼입·종전 동일)
     (D) 회수 0건(빈 contextText)은 strength 무관하게 OUT_OF_SCOPE_NOTE(강·약 모두)
     (E) WEAK_GROUNDING_NOTE 내용 불변식 — 관련성 판단·날조 금지·답 안 막음
     (F) route.ts 가 groundingStrength(retrieved[0]?.score) 로 강도 산출·전달
     (G) 후방호환 — strength 인자 미지정(2-arg) 호출 = strong(WEAK note 미주입)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-advisor-grounding-confidence.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  buildAdvisorSystem,
  groundingStrength,
  GROUNDING_PREFIX,
  WEAK_GROUNDING_NOTE,
  OUT_OF_SCOPE_NOTE,
  STRONG_GROUNDING_SCORE,
} from "../src/lib/advisor/system.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => readFileSync(path.join(root, ...p), "utf8");

const PERSONA = "당신은 한국 대체투자 전문 어드바이저입니다.";
const CTX = "[참고자료 1] 담보신탁: 위탁자가 부동산을 신탁하고 우선수익권을 발급…";

console.log("\n[A] groundingStrength — 임계 경계 분기");
{
  ok(STRONG_GROUNDING_SCORE === 6, "강·약 경계 점수 = 6(임계 3의 두 번째 corroborating 신호)");
  ok(groundingStrength(3) === "weak", "3점(겨우 임계만 넘김) → weak");
  ok(groundingStrength(5) === "weak", "5점(임계 미만) → weak");
  ok(groundingStrength(STRONG_GROUNDING_SCORE) === "strong", "경계값 6점 → strong");
  ok(groundingStrength(15) === "strong", "15점(강한 매칭) → strong");
  ok(groundingStrength(0) === "weak", "0점 → weak");
}

console.log("\n[B] 약한 grounding 블록 = GROUNDING_PREFIX + WEAK_GROUNDING_NOTE + contextText");
{
  const b = buildAdvisorSystem(PERSONA, CTX, "weak");
  ok(b.length === 2, "블록 2개(페르소나 + 참고자료)");
  ok(b[1].text === GROUNDING_PREFIX + WEAK_GROUNDING_NOTE + CTX, "둘째 블록 = 활용지침 + 약한 주의 + 회수 본문");
  ok(b[1].text.includes(WEAK_GROUNDING_NOTE), "약한 grounding 주의 주입");
  ok(b[1].text.includes("담보신탁: 위탁자"), "회수 본문 보존");
  // 활용지침(prefix)이 약한 주의보다 먼저 온다.
  ok(b[1].text.indexOf(GROUNDING_PREFIX) < b[1].text.indexOf(WEAK_GROUNDING_NOTE), "prefix → weak note 순서");
}

console.log("\n[C] 강한 grounding 블록 = GROUNDING_PREFIX + contextText(WEAK note 미혼입)");
{
  const b = buildAdvisorSystem(PERSONA, CTX, "strong");
  ok(b[1].text === GROUNDING_PREFIX + CTX, "둘째 블록 = 활용지침 + 회수 본문(종전과 동일)");
  ok(!b[1].text.includes(WEAK_GROUNDING_NOTE), "강한 grounding 블록에 약한 주의 미혼입");
}

console.log("\n[D] 회수 0건(빈 contextText) → strength 무관하게 OUT_OF_SCOPE_NOTE");
{
  const w = buildAdvisorSystem(PERSONA, "", "weak");
  const s = buildAdvisorSystem(PERSONA, "", "strong");
  ok(w[1].text === OUT_OF_SCOPE_NOTE, "weak + 빈 contextText → 범위 주의(grounding 주의 아님)");
  ok(s[1].text === OUT_OF_SCOPE_NOTE, "strong + 빈 contextText → 범위 주의");
  ok(!w[1].text.includes(WEAK_GROUNDING_NOTE), "범위주의 블록에 약한 grounding 주의 미혼입");
}

console.log("\n[E] WEAK_GROUNDING_NOTE 내용 불변식");
{
  ok(/관련/.test(WEAK_GROUNDING_NOTE) && /판단|관련도가 낮/.test(WEAK_GROUNDING_NOTE), "관련성 먼저 판단 지시");
  ok(/약한 grounding/.test(WEAK_GROUNDING_NOTE), "약한 grounding 사실 명시");
  ok(/지어내지|날조|단정/.test(WEAK_GROUNDING_NOTE), "자료 밖 수치·조항 날조 금지");
  ok(/일반 (실무 )?원칙/.test(WEAK_GROUNDING_NOTE), "약하면 일반 원칙으로 답 허용(답 안 막음)");
  ok(WEAK_GROUNDING_NOTE.endsWith("\n\n"), "참고자료 본문과 분리되는 개행 종결");
}

console.log("\n[F] route.ts 가 회수 최고점수로 강도 산출·전달");
{
  const route = read("src", "app", "api", "advisor", "route.ts");
  ok(/import\s*\{[^}]*groundingStrength[^}]*\}\s*from\s*["']@\/lib\/advisor\/system["']/.test(route), "groundingStrength import");
  ok(/groundingStrength\(\s*retrieved\[0\]\?\.score\s*\?\?\s*0\s*\)/.test(route), "retrieved[0]?.score 로 강도 산출(회수 0건이면 0)");
  ok(/buildAdvisorSystem\(ADVISOR_PERSONA,\s*contextText,\s*strength\)/.test(route), "buildAdvisorSystem 에 strength 전달");
}

console.log("\n[G] 후방호환 — strength 미지정(2-arg) 호출 = strong");
{
  const def = buildAdvisorSystem(PERSONA, CTX);
  const strong = buildAdvisorSystem(PERSONA, CTX, "strong");
  ok(def[1].text === strong[1].text, "인자 미지정 = strong 과 동일(종전 동작 보존)");
  ok(!def[1].text.includes(WEAK_GROUNDING_NOTE), "기본 호출에 약한 주의 미주입");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
if (fail > 0) process.exit(1);
