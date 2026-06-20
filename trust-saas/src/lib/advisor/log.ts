/* ================================================================
   상담 Q&A 로깅 (서버 전용) — 자가고도화 루프의 [수집] 단계
   질문·검색 적중여부·피드백을 월별 JSONL 로 적재. 분석은 scripts/advisor-improve.mjs.
   ⚠️ 사용자 질문이 담기므로 로그 파일은 .gitignore(advisor-logs/). Vercel 서버리스는
      FS가 휘발성이라 영구 보관은 로컬/별도 스토리지에서. 실패는 조용히 무시(상담 흐름 우선).
   ================================================================ */
import { promises as fs } from "fs";
import path from "path";

export interface QaLogEntry {
  ts: string;
  type: "query" | "feedback";
  q?: string; // 질문(앞부분만)
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

/** 질문 1건 적재 (질문은 길이 제한해 저장) */
export function logQuery(
  q: string,
  hit: boolean,
  topScore: number,
  topicIds: string[]
): Promise<void> {
  return appendLog({ type: "query", q: q.slice(0, 300), hit, topScore, topicIds });
}

export function logFeedback(q: string, rating: "up" | "down", note?: string): Promise<void> {
  return appendLog({ type: "feedback", q: q.slice(0, 300), rating, note: note?.slice(0, 500) });
}
