/* ================================================================
   상담(advisor·Pillar 2) 시스템 프롬프트 조립 — grounding 유무에 따른 분기

   RAG-lite 라우트(api/advisor/route.ts)는 질문으로 지식코퍼스를 검색해
   회수된 참고자료(grounding)를 시스템 프롬프트에 주입한다. 종전 라우트는
   회수가 **0건(grounding 없음)** 이면 참고자료 블록을 아예 빼고 페르소나만
   넘겨 LLM 이 **일반 학습지식만으로** 답하게 두었다 — 신탁·부동산금융·
   대체투자 실무 코퍼스 **밖**의 질문(gap-report 의 "베트남 부동산 외국인
   취득" 같은 👎 미적중)에도 단정적 수치·법조항·절차를 지어낼 수 있는
   가드레일 공백(CLAUDE.md 운영원칙 #1 사실 기반·추정 금지 / #3 가드레일).

   본 모듈은 시스템 블록 조립을 순수 함수로 분리해, 회수 0건일 때 **범위
   주의 지침(OUT_OF_SCOPE_NOTE)** 을 주입한다 — 답을 막지 않되(일반 원칙으로
   분명하면 간결히 답하도록 허용) 코퍼스 밖 주제는 그 사실을 먼저 밝히고
   전문가 확인을 권고하며 고유 수치·조항을 지어내지 않게 한다. 페르소나·
   grounding 활용 지침 문구·캐시 제어는 종전과 동일(표시·전송 경계 무변경).
   ================================================================ */
import type Anthropic from "@anthropic-ai/sdk";

/** 검색된 참고자료(grounding)가 있을 때 그 앞에 붙이는 활용 지침(종전 인라인 문구). */
export const GROUNDING_PREFIX =
  "다음은 내부 지식베이스에서 검색된 참고자료입니다. 관련 있으면 근거로 활용하되, " +
  "질문과 무관하면 무시하세요. 자료에 없는 수치는 단정하지 말고 확인이 필요하다고 하세요. " +
  "자료에 특정 회사·기관·사업장 이름이 있어도 답변에 노출하지 말고 일반 실무지식으로 재구성하세요.\n\n";

/** 강한 grounding 으로 보는 회수 최고점수 하한.
 *  retrieve() 는 KNOWLEDGE 를 score≥3(질의 토큰 1개가 태그에 단발 매칭=tangential),
 *  back-data 를 score≥6 으로 admit 한다. 즉 최고점수가 3~5 인 회수는 "겨우 임계만
 *  넘긴" 약한 grounding(한 토큰만 스친 경우 등)이라, GROUNDING_PREFIX 의 "근거로 활용"
 *  프레이밍을 강한 매칭과 똑같이 주면 LLM 이 빈약한 자료에 과의존할 수 있다. 두 번째
 *  corroborating 신호(추가 태그 매칭 또는 태그+본문)가 붙는 6점을 강·약 경계로 둔다. */
export const STRONG_GROUNDING_SCORE = 6;

/** 회수는 됐으나 최고점수가 약할 때(약한 grounding) 참고자료 앞에 덧대는 주의 지침.
 *  ★답을 막지 않는다 — 자료가 부분적으로만 관련되거나 주제가 어긋났을 수 있으니
 *  관련성을 먼저 판단하게 하고, 관련이 약하면 일반 원칙으로 답하되 근거 불확실을
 *  밝히고 자료에 없는 고유 수치·조항·절차를 지어내지 않게 한다. */
export const WEAK_GROUNDING_NOTE =
  "※ 아래 참고자료는 질문과의 관련도가 낮게 검색되었습니다(약한 grounding). 부분적으로만 " +
  "관련되거나 주제가 어긋났을 수 있으니, 먼저 질문에 직접 답하는 내용인지 판단하세요. 관련이 " +
  "약하면 일반 실무 원칙으로 답하되 근거가 불확실함을 밝히고, 참고자료에 없는 수치·법조항·" +
  "절차·고유 조건은 지어내지 마세요.\n\n";

/** 회수 최고점수 → grounding 강도. 강(strong)=GROUNDING_PREFIX 만, 약(weak)=주의 지침 덧댐.
 *  ⚠️ 순수 함수 — 임계 정책만 결정(주입 문구·조립은 buildAdvisorSystem 담당). */
export function groundingStrength(topScore: number): "strong" | "weak" {
  return topScore >= STRONG_GROUNDING_SCORE ? "strong" : "weak";
}

/** 지식코퍼스 회수 0건(grounding 없음)일 때 주입하는 범위 주의 지침.
 *  ★답을 막지 않는다 — 일반 실무 원칙으로 분명하면 간결히 답하도록 허용하되,
 *  코퍼스 밖 주제는 그 사실을 먼저 밝히고 단정적 수치·법조항·절차를 지어내지
 *  않으며 전문가(법률·세무·현지) 확인을 권고하도록 가드레일을 건다. */
export const OUT_OF_SCOPE_NOTE =
  "이번 질문은 내부 지식베이스(신탁·부동산금융·자산유동화·딜 구조화·관련 법규/세무)에서 " +
  "관련 참고자료가 검색되지 않았습니다. 핵심 전문 영역 밖의 주제일 수 있으니 다음을 지켜 답하세요:\n" +
  "- 일반적으로 분명한 실무 원칙으로 답할 수 있으면 간결히 답하되, 근거가 불확실하면 그 사실을 " +
  "먼저 밝히고 가정을 명시합니다.\n" +
  "- 전문 영역(부동산신탁·PF·자본시장·세무) 밖의 주제(예: 해외 부동산 제도 등)면 단정적인 " +
  "수치·법조항·절차를 지어내지 말고, 일반론 수준으로만 안내한 뒤 전문가(법률·세무·현지) 확인을 권고합니다.\n" +
  "- 특정 딜·회사의 고유 수치나 조건은 추정하지 않습니다.";

/**
 * 페르소나 + (grounding 유무·강도 분기) 참고자료/범위주의 블록으로 시스템 프롬프트를 조립한다.
 * - 첫 블록 = 페르소나(ephemeral 캐시 — 재호출 간 프롬프트 캐시 적중).
 * - contextText 있음 + strong → GROUNDING_PREFIX + 참고자료 블록(종전 동작).
 * - contextText 있음 + weak  → GROUNDING_PREFIX + WEAK_GROUNDING_NOTE + 참고자료(약한 grounding 주의).
 * - contextText 없음(회수 0건) → OUT_OF_SCOPE_NOTE 블록(범위 주의 가드레일·strength 무관).
 * ⚠️ 순수 함수 — 네트워크·검색·로깅 무접촉. 회수/강도/페르소나 정책 자체는 호출측이 결정.
 *   strength 기본값 "strong" — 인자 미지정 호출은 종전 동작 보존(후방호환).
 */
export function buildAdvisorSystem(
  persona: string,
  contextText: string,
  strength: "strong" | "weak" = "strong"
): Anthropic.TextBlockParam[] {
  const blocks: Anthropic.TextBlockParam[] = [
    { type: "text", text: persona, cache_control: { type: "ephemeral" } },
  ];
  if (contextText) {
    const prefix =
      strength === "weak" ? GROUNDING_PREFIX + WEAK_GROUNDING_NOTE : GROUNDING_PREFIX;
    blocks.push({ type: "text", text: prefix + contextText });
  } else {
    blocks.push({ type: "text", text: OUT_OF_SCOPE_NOTE });
  }
  return blocks;
}
