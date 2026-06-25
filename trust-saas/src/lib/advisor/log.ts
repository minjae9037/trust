/* ================================================================
   상담 Q&A 로깅 (서버 전용) — 자가고도화 루프의 [수집] 단계
   질문·검색 적중여부·피드백을 월별 JSONL 로 적재. 분석은 scripts/advisor-improve.mjs.
   ⚠️ 사용자 질문이 담기므로 로그 파일은 .gitignore(advisor-logs/). Vercel 서버리스는
      FS가 휘발성이라 영구 보관은 로컬/별도 스토리지에서. 실패는 조용히 무시(상담 흐름 우선).
   ⚠️ PII 가드(CLAUDE.md 가드레일): 저장 직전 고민감 식별자(주민·사업자·법인·등기번호)를
      tokenizePII(계약 측과 동일 단일 출처)로 1방향 치환한다. 분석에 필요한 주변 텍스트
      (RAG 적중/공백 후보 판별용)는 보존되고, 식별번호만 토큰으로 남아 디스크에 평문 PII 가
      남지 않는다. 상담 답변·외부 전송 경로는 무변경(로그 저장 경로에만 적용).
   ================================================================ */
import { promises as fs } from "fs";
import path from "path";
import { tokenizePII } from "../privacy/tokenize";

/**
 * 로그 저장 전 PII 1방향 치환. 복원 맵은 버린다(분석 로그는 식별 불요).
 * tokenizePII 가 매칭하는 패턴만 토큰화되고 나머지 텍스트는 그대로 보존.
 */
export function redactForLog(s: string): string {
  return tokenizePII(s).text;
}

export interface QaLogEntry {
  ts: string;
  type: "query" | "feedback";
  q?: string; // 질문(앞부분만)
  /**
   * 실제 회수 질의 — 라우트가 retrieve() 에 넘긴 질의(멀티턴이면 buildRetrievalQuery 가
   * 직전 사용자 발화를 합친 맥락 질의). 단발(첫 턴)이면 q 와 같아 **미기록**(로그 군더더기 0).
   * ★자가고도화 [분석] 재채점 정직성: gap-report 가 단발 q 만으로 재채점하면 맥락 의존
   *   후속질문("그럼 절차는?")이 회수 0건으로 거짓 공백 집계됐다(라우트는 맥락을 합쳐 실제로는
   *   grounding 됨). rquery 를 남겨 분석이 라우트와 동일 질의로 재채점하도록 한다.
   */
  rquery?: string;
  hit?: boolean; // RAG 적중(근거 청크 1개 이상)
  topScore?: number; // 최상위 청크 점수(신뢰도) — 낮으면 약한 적중=공백 후보
  topicIds?: string[]; // 검색된 청크 id
  rating?: "up" | "down"; // 피드백
  note?: string; // 피드백 메모
}

function logDir(): string {
  return path.join(process.cwd(), "advisor-logs");
}
function monthFile(d: Date): string {
  const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return path.join(logDir(), `qa-${ym}.jsonl`);
}

export async function appendLog(entry: Omit<QaLogEntry, "ts">): Promise<void> {
  try {
    const now = new Date();
    await fs.mkdir(logDir(), { recursive: true });
    const line = JSON.stringify({ ts: now.toISOString(), ...entry }) + "\n";
    await fs.appendFile(monthFile(now), line, "utf8");
  } catch {
    /* 로깅 실패는 상담을 막지 않는다 */
  }
}

/**
 * 질문 1건 적재 (PII 치환 후 길이 제한해 저장).
 * @param retrievalQuery 라우트가 실제 retrieve() 에 넘긴 질의(buildRetrievalQuery 산출).
 *   단발이면 q 와 같아 미기록 — 멀티턴 맥락 질의일 때만 rquery 로 보존(분석 재채점 라우트 패리티).
 */
export function logQuery(
  q: string,
  hit: boolean,
  topScore: number,
  topicIds: string[],
  retrievalQuery?: string
): Promise<void> {
  const redQ = redactForLog(q).slice(0, 300);
  // rquery 는 q 보다 길 수 있어(여러 턴 결합) cap 을 넓게 두되 PII 치환·길이 제한은 동일 규약.
  // 단발(맥락 미결합)이면 redacted 값이 q 와 같아 미기록 — 로그를 부풀리지 않는다.
  const redR =
    retrievalQuery !== undefined ? redactForLog(retrievalQuery).slice(0, 600) : undefined;
  const rquery = redR !== undefined && redR !== redQ ? redR : undefined;
  return appendLog({ type: "query", q: redQ, rquery, hit, topScore, topicIds });
}

export function logFeedback(q: string, rating: "up" | "down", note?: string): Promise<void> {
  return appendLog({
    type: "feedback",
    q: redactForLog(q).slice(0, 300),
    rating,
    note: note ? redactForLog(note).slice(0, 500) : undefined,
  });
}
