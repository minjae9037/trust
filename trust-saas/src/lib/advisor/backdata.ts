/* ================================================================
   back-data RAG 인덱스 로더 (서버 전용)
   scripts/build-backdata-index.mjs 가 만든 _backdata-index.json 을 1회 로드·캐시.
   파일이 없으면(미빌드/정적배포) 빈 배열 → 상담은 기본 KNOWLEDGE 만으로 동작.
   ⚠️ 이 인덱스는 .gitignore(공개 금지). 클라이언트로 import 금지(fs 사용).
   ================================================================ */
import { readFileSync, existsSync } from "fs";
import path from "path";
import type { KnowledgeChunk } from "./knowledge";

/**
 * 인덱스 원문(JSON 문자열) → 청크 배열 파싱(순수 함수·단일 출처).
 * 파일 부재(null)·빈 문자열·깨진 JSON(부분 쓰기·디스크 오류)·비배열(JSON
 * 객체/문자열/숫자/null)은 모두 빈 배열로 흡수해 **절대 throw 하지 않는다**.
 * loadBackdataChunks 가 매 상담 요청 경로(retrieve)에서 호출되므로, 깨진
 * 인덱스가 advisor API 전체를 500 으로 떨어뜨리지 않게 하는 견고성 경계.
 * (원본 동작 보존: 유효 배열은 형태 검증 없이 그대로 통과 — 빌드 산출물 신뢰.)
 */
export function parseBackdataIndex(raw: string | null): KnowledgeChunk[] {
  if (raw == null) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? (arr as KnowledgeChunk[]) : [];
  } catch {
    return [];
  }
}

/** 인덱스 파일 원문 안전 읽기(부재·읽기 실패 시 null). */
function readBackdataRaw(): string | null {
  try {
    const p = path.join(process.cwd(), "src", "lib", "advisor", "_backdata-index.json");
    return existsSync(p) ? readFileSync(p, "utf8") : null;
  } catch {
    return null;
  }
}

let cache: KnowledgeChunk[] | null = null;

export function loadBackdataChunks(): KnowledgeChunk[] {
  if (cache) return cache;
  cache = parseBackdataIndex(readBackdataRaw());
  return cache;
}
