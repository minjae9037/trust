/* ================================================================
   상담 근거 출처 — 클라이언트 응답 경계의 출처 식별성 차단(가드레일)

   ⚠️ 페르소나(api/advisor/route.ts)는 LLM 답변에서 참고자료의 출처명·
      회사명·사업장명을 드러내지 않도록 명시 지시한다(운영원칙 3 가드레일).
      그러나 근거 출처를 클라이언트 UI("📚 참고한 자료" 칩)로 전달하는
      X-Advisor-Sources 헤더 경로는 LLM 을 *우회*하므로, back-data(내부
      수집 자료) 청크의 topic(=원본 문서 제목/파일명, 예: "○○ 실무가이드북",
      특정사 내부규정·개별 딜 문서명)을 그대로 내보내면 페르소나가 막는
      바로 그 출처 식별 정보가 칩으로 누출된다.

      → 전송 경계(서버)에서 back-data 출처는 일반 라벨로 치환한다.
         (PII 토큰화가 Claude 전송 경계에서 식별번호를 막는 것과 동일
          패턴 — 여기선 클라이언트 응답 경계의 출처 식별성.)

      core(기본 KNOWLEDGE) 청크의 topic 은 일반 개념어(담보신탁·PF 단계
      구조 등)라 사용자에게 유용하고 식별 위험이 없으므로 그대로 노출한다.
      검색(retrieve) 채점 경로는 무변경. LLM 컨텍스트 주입(formatContext)도
      이 단일 출처(isBackdata/BACKDATA_LABEL)를 재사용해 bd- 라벨을 일반화한다
      (페르소나 비노출 지시에만 의존하던 프롬프트 경계 잔여 누출 벡터 심층방어).
   ================================================================ */
import type { KnowledgeChunk } from "./knowledge";
import type { Retrieved } from "./retrieve";

export type SourceKind = "backdata" | "core";
export interface PublicSource {
  topic: string;
  kind: SourceKind;
}

/** back-data(내부 수집 자료) 청크 여부 — 인덱스 id 접두사 bd-. */
export function isBackdata(chunk: KnowledgeChunk): boolean {
  return chunk.id.startsWith("bd-");
}

/** 내부 자료 칩에 노출할 일반 라벨(원본 문서명 비노출). */
export const BACKDATA_LABEL = "내부 참고자료";

/**
 * 클라이언트로 내보낼 안전 출처 라벨.
 * - back-data: 원본 문서 제목 대신 일반 라벨(식별 차단)
 * - core: 개념 topic 그대로(식별 위험 없음·사용자에게 유용)
 */
export function publicSourceLabel(chunk: KnowledgeChunk): string {
  return isBackdata(chunk) ? BACKDATA_LABEL : chunk.topic;
}

/**
 * 검색 결과 → 클라이언트 응답 헤더(X-Advisor-Sources)용 출처 목록.
 * 안전 라벨 기준으로 중복 제거 → 여러 내부 문서는 단일 "내부 참고자료"
 * 칩으로 합쳐져 개수·식별성까지 노출되지 않는다. 순서는 검색 점수 순
 * (첫 등장 보존). core 끼리의 dedup 동작은 기존(raw topic 기준)과 동일.
 */
export function buildSources(retrieved: Retrieved[]): PublicSource[] {
  const seen = new Set<string>();
  const out: PublicSource[] = [];
  for (const r of retrieved) {
    const topic = publicSourceLabel(r.chunk);
    if (seen.has(topic)) continue;
    seen.add(topic);
    out.push({ topic, kind: isBackdata(r.chunk) ? "backdata" : "core" });
  }
  return out;
}
