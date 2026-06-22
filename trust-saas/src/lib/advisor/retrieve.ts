/* ================================================================
   RAG-lite 리트리버 — 어휘(키워드) 기반 상위 N 청크 검색
   추후 임베딩 벡터검색으로 이 함수만 교체.
   ================================================================ */
import { KNOWLEDGE, type KnowledgeChunk } from "./knowledge";
import { isBackdata, BACKDATA_LABEL } from "./sources";

/** 한글/영문/숫자 토큰 추출 (2자 이상) */
function tokenize(s: string): string[] {
  const matches = s.toLowerCase().match(/[가-힣]{2,}|[a-z0-9]{2,}/g) || [];
  return Array.from(new Set(matches));
}

/**
 * 한글 조사(josa) 제거 stem — 질의 토큰은 명사 뒤에 조사가 붙어("담보신탁이 / 우선수익권이 /
 * 관리형토지신탁의") 큐레이션된 태그·본문 표제("담보신탁")보다 길어진다. 종전 매칭은
 * tagBlob.includes(token)·textBlob.indexOf(token) 이라 "토큰이 태그보다 짧을 때"만 잡고
 * "토큰이 더 긴"(조사 흡착) 이 방향을 놓쳐, 코퍼스 전체가 담보신탁인데도 "담보신탁이
 * 무엇인가요?" 같은 핵심 정의 질문이 점수 0으로 미적중(컨텍스트 미주입)했다(gap-report
 * 2026-06-22: 미적중 최다 질문). 토큰 끝의 조사를 떼어 stem 을 매칭에 *함께* 쓴다.
 *
 * ⚠️ 보수적 설계(오탐 최소화):
 *   ① stem 이 2자 미만이면 버린다("차이"→"차"·"용도"→"용" 차단 — 단음절 stem 의 광범위
 *      오매칭 방지).
 *   ② 일반 명사 어미와 충돌하는 모호한 단음절 조사(라/나/야/랑 등)는 제외하고, 충돌 위험이
 *      낮은 조사만 처리한다.
 *   ③ 매칭은 raw 토큰 OR stem 으로 *가산만* 한다 — stem 은 기존 매칭을 절대 제거하지 않고
 *      재현율만 보탠다(후방호환). 조사는 긴 것부터 검사해 "으로"가 "로"보다, "에서"가
 *      "에"보다 먼저 떨어지게 한다.
 */
const JOSA = [
  "으로서", "으로", "에서", "에게", "한테", "까지", "부터", "이라", "라는", "라고",
  "은", "는", "이", "가", "을", "를", "과", "와", "의", "에", "도", "만", "로",
];
function josaStem(token: string): string | null {
  for (const j of JOSA) {
    if (token.length > j.length && token.endsWith(j)) {
      const stem = token.slice(0, token.length - j.length);
      if (stem.length >= 2) return stem;
    }
  }
  return null;
}

export interface Retrieved {
  chunk: KnowledgeChunk;
  score: number;
}

/**
 * 멀티턴 후속 질문의 검색 질의 보강 — 대화 맥락을 회수에 반영.
 *
 * 종전 라우트는 `retrieve(lastUser.content, …)` 로 **마지막 사용자 발화 한 줄만** 검색했다.
 * 그래서 "그럼 절차는?" "그건 왜 그래?" 처럼 그 자체엔 도메인 키워드가 없고 직전 맥락에
 * 의존하는 후속 질문은 토큰이 매칭되지 않아 회수 0건 → 컨텍스트 미주입 → LLM 이 근거 없이
 * 답했다(gap-report 2026-06-22 josa 마감 후 남은 최다 미적중 유형 = 맥락 의존 후속질문).
 *
 * 직전 사용자 발화(최근 N턴)를 현재 질의에 합쳐 그 맥락을 검색에 싣는다. tokenize 가 Set 으로
 * 중복을 제거하므로 같은 키워드가 중복 가산되지 않고, 현재 발화 토큰은 그대로 보존된다(가산만·
 * 후방호환). 직전 턴의 "담보신탁이 무엇인가요?" 키워드가 "그럼 절차는?" 질의의 회수를 끌어준다.
 *
 * ⚠️ 보수적 설계:
 *   ① **user 턴만** 합친다 — assistant 답변 본문(장황한 마크다운·표)은 무관 태그까지 끌어와
 *      노이즈가 크다. 사용자 발화가 가장 깨끗한 주제 신호.
 *   ② **최근 창(windowUserTurns)만** — 대화가 길어 주제가 바뀌어도 오래된 발화가 회수를
 *      오염시키지 않게 직전 몇 턴으로 제한(주제 전환 드리프트 차단). 현재 발화는 항상 포함.
 *   ③ 단발(첫 턴)이면 그 발화만 반환 = 종전 동작 무변경.
 */
export function buildRetrievalQuery(
  messages: { role: string; content: string }[],
  windowUserTurns = 3,
): string {
  const userContents = messages
    .filter((m) => m.role === "user" && typeof m.content === "string")
    .map((m) => m.content);
  if (userContents.length === 0) return "";
  const window = windowUserTurns > 0 ? windowUserTurns : 1;
  return userContents.slice(-window).join(" ");
}

/**
 * 질의와 가장 관련 높은 청크 topK 반환.
 * 태그 매칭 가중(3) + 본문 등장(1). 부분문자열(한글 합성어) 매칭 포함.
 */
export function retrieve(query: string, topK = 3, extra: KnowledgeChunk[] = []): Retrieved[] {
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return [];
  // 각 질의 토큰의 조사 제거 stem(없으면 null)을 미리 계산 — 청크마다 재계산하지 않는다.
  const qStems = qTokens.map((t) => josaStem(t));

  const corpus = extra.length ? [...KNOWLEDGE, ...extra] : KNOWLEDGE;
  const scored: Retrieved[] = corpus.map((chunk) => {
    const tagBlob = chunk.tags.join(" ").toLowerCase();
    const textBlob = (chunk.topic + " " + chunk.text).toLowerCase();
    let score = 0;
    for (let i = 0; i < qTokens.length; i++) {
      const t = qTokens[i];
      const stem = qStems[i];
      // 태그 매칭(+3, 토큰당 1회): raw 토큰이 태그의 부분(기존) OR 조사 제거 stem 이
      // 태그의 부분(신규 — "담보신탁이"→"담보신탁"). OR 라 stem 은 기존 매칭을 못 지운다.
      if (tagBlob.includes(t) || (stem !== null && tagBlob.includes(stem))) score += 3;
      // 본문 등장(최대 3회 가산 — raw 토큰과 stem 이 카운터를 공유해 cap 의미 보존).
      // 조사 흡착으로 본문엔 stem 형태로만 등장하는 경우까지 센다(raw 우선·중복 가산은 cap 으로 제한).
      const terms = stem !== null && stem !== t ? [t, stem] : [t];
      let hits = 0;
      for (const term of terms) {
        let idx = textBlob.indexOf(term);
        while (idx >= 0 && hits < 3) {
          score += 1;
          hits++;
          idx = textBlob.indexOf(term, idx + term.length);
        }
      }
    }
    // 사용자가 직접 올린 Q&A 근거(qna-)는 동일 관련도면 우선 반영되도록 소폭 가중.
    if (chunk.id.startsWith("qna-")) score *= 1.25;
    return { chunk, score };
  });

  // 임계: 기본 KNOWLEDGE 는 3, back-data(bd-)는 노이즈 차단 위해 더 높게(6).
  return scored
    .filter((s) => s.score >= (s.chunk.id.startsWith("bd-") ? 6 : 3))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * 검색 결과를 컨텍스트 주입용 텍스트로 포맷.
 *
 * ★컨텍스트 주입 경계(가드레일·심층방어): back-data(내부 수집 자료) 청크의
 *   topic 은 원본 문서 제목/파일명(특정사 내부규정·개별 딜 문서명 자리)이라,
 *   LLM 프롬프트에 그대로 주입하면 페르소나의 "출처명 비노출" 지시에만 의존하는
 *   잔여 누출 벡터가 된다(헤더/칩의 buildSources 일반화와 동일 위험을 프롬프트
 *   경계가 남겨두던 갭). → 헤더 경계와 동일 단일 출처(isBackdata/BACKDATA_LABEL)로
 *   bd- 청크 라벨을 일반화한다. 청크 본문(실제 지식)은 그대로 주입해 RAG 품질
 *   무손상이며, core 개념 topic 은 식별 위험이 없어 보존한다.
 */
export function formatContext(items: Retrieved[]): string {
  if (items.length === 0) return "";
  return items
    .map((it, i) => {
      const label = isBackdata(it.chunk) ? BACKDATA_LABEL : it.chunk.topic;
      return `[참고자료 ${i + 1}] (${label})\n${it.chunk.text}`;
    })
    .join("\n\n");
}
