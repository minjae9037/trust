/* ================================================================
   back-data RAG 인덱스 로더 (서버 전용)
   scripts/build-backdata-index.mjs 가 만든 _backdata-index.json 을 1회 로드·캐시.
   파일이 없으면(미빌드/정적배포) 빈 배열 → 상담은 기본 KNOWLEDGE 만으로 동작.
   ⚠️ 이 인덱스는 .gitignore(공개 금지). 클라이언트로 import 금지(fs 사용).
   ================================================================ */
import { readFileSync, existsSync } from "fs";
import path from "path";
import type { KnowledgeChunk } from "./knowledge";

let cache: KnowledgeChunk[] | null = null;

export function loadBackdataChunks(): KnowledgeChunk[] {
  if (cache) return cache;
  try {
    const p = path.join(process.cwd(), "src", "lib", "advisor", "_backdata-index.json");
    if (!existsSync(p)) {
      cache = [];
      return cache;
    }
    const raw = readFileSync(p, "utf8");
    const arr = JSON.parse(raw) as KnowledgeChunk[];
    cache = Array.isArray(arr) ? arr : [];
  } catch {
    cache = [];
  }
  return cache;
}
