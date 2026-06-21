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

export interface Retrieved {
  chunk: KnowledgeChunk;
  score: number;
}

/**
 * 질의와 가장 관련 높은 청크 topK 반환.
 * 태그 매칭 가중(3) + 본문 등장(1). 부분문자열(한글 합성어) 매칭 포함.
 */
export function retrieve(query: string, topK = 3, extra: KnowledgeChunk[] = []): Retrieved[] {
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return [];

  const corpus = extra.length ? [...KNOWLEDGE, ...extra] : KNOWLEDGE;
  const scored: Retrieved[] = corpus.map((chunk) => {
    const tagBlob = chunk.tags.join(" ").toLowerCase();
    const textBlob = (chunk.topic + " " + chunk.text).toLowerCase();
    let score = 0;
    for (const t of qTokens) {
      if (tagBlob.includes(t)) score += 3;
      // 본문 등장 횟수(최대 3회까지만 가산)
      let idx = textBlob.indexOf(t);
      let hits = 0;
      while (idx >= 0 && hits < 3) {
        score += 1;
        hits++;
        idx = textBlob.indexOf(t, idx + t.length);
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
