/* ================================================================
   상담 시맨틱 캐시 — 저장/적재 계층(서버 전용 I/O)

   2단 구성:
   (1) 정적 FAQ 시드  _advisor-faq.json  — scripts/build-advisor-faq.mjs 가
       자주 묻는 신탁 질문에 대해 사전 생성(1회 API)해 번들. 무인프라·무API
       즉답의 1차 캐시. 파일이 없으면 빈 배열(런타임 캐시만으로 동작).
   (2) Supabase advisor_cache  — 캐시 미스로 새로 생성한 답을 적립. env(서비스
       키)가 있을 때만 동작하며, 없거나 오류면 조용히 정적 FAQ 로 폴백.
       (Vercel 서버리스 FS 는 휘발성이라 누적 캐시는 DB 에 둬야 함.)

   ⚠️ admin(서비스 키) 클라이언트로 RLS 우회 — 서버 신뢰 경로 전용.
   ⚠️ 어떤 실패도 throw 하지 않는다(상담 흐름 우선). 캐시는 "있으면 이득".
   ================================================================ */
import { readFileSync, existsSync } from "fs";
import path from "path";
import { createAdminClient } from "../supabase/admin";
import { toCandidate, type CacheCandidate, type CachedQA } from "./cache";

/* ---------- (1) 정적 FAQ 시드 ---------- */

function readFaqSeed(): CachedQA[] {
  try {
    const p = path.join(process.cwd(), "src", "lib", "advisor", "_advisor-faq.json");
    if (!existsSync(p)) return [];
    const arr = JSON.parse(readFileSync(p, "utf8")) as unknown;
    return Array.isArray(arr) ? (arr as CachedQA[]) : [];
  } catch {
    return [];
  }
}

let faqCache: CacheCandidate[] | null = null;
function faqEntries(): CacheCandidate[] {
  if (faqCache) return faqCache;
  faqCache = readFaqSeed()
    .filter((e) => e && typeof e.q === "string" && typeof e.answer === "string")
    .map((e, i) => toCandidate({ ...e, id: e.id || `faq-${i}` }));
  return faqCache;
}

/* ---------- (2) Supabase 런타임 캐시 ---------- */

function hasSupabase(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

// 인프로세스 단기 캐시(웜 인스턴스에서 매 요청 DB 왕복 방지). 60초 TTL.
let dbCache: { at: number; entries: CacheCandidate[] } | null = null;
const DB_TTL_MS = 60_000;
const DB_LIMIT = 2000;

async function dbEntries(): Promise<CacheCandidate[]> {
  if (!hasSupabase()) return [];
  const now = Date.now();
  if (dbCache && now - dbCache.at < DB_TTL_MS) return dbCache.entries;
  try {
    const sb = createAdminClient();
    const { data, error } = await sb
      .from("advisor_cache")
      .select("id,q,answer,sources")
      .order("created_at", { ascending: false })
      .limit(DB_LIMIT);
    if (error || !Array.isArray(data)) return dbCache?.entries ?? [];
    const entries: CacheCandidate[] = data
      .filter((r) => r && typeof r.q === "string" && typeof r.answer === "string")
      .map((r) =>
        toCandidate({
          id: String(r.id),
          q: r.q as string,
          answer: r.answer as string,
          sources: Array.isArray(r.sources) ? r.sources : undefined,
        })
      );
    dbCache = { at: now, entries };
    return entries;
  } catch {
    return dbCache?.entries ?? [];
  }
}

/* ---------- 공개 API ---------- */

/** 매칭 후보 = 정적 FAQ + (있으면) DB 누적 캐시. */
export async function loadCacheCandidates(): Promise<CacheCandidate[]> {
  const db = await dbEntries();
  const faq = faqEntries();
  return db.length ? [...faq, ...db] : faq;
}

/**
 * 새 Q&A 를 DB 캐시에 적립(미스→생성 후). env 없으면 무동작.
 * 오류 응답·너무 짧은 답은 적립하지 않는다(나쁜 답 재사용 방지).
 */
export async function saveCacheEntry(
  q: string,
  answer: string,
  sources: { topic: string; kind: string }[]
): Promise<void> {
  if (!hasSupabase()) return;
  const a = (answer || "").trim();
  if (!q || a.length < 40) return;
  if (a.includes("[오류]")) return;
  try {
    const sb = createAdminClient();
    await sb.from("advisor_cache").insert({
      q: q.slice(0, 1000),
      answer: a,
      sources: sources ?? [],
    });
    // 새 항목이 다음 요청부터 매칭되도록 인프로세스 캐시 무효화.
    dbCache = null;
  } catch {
    /* 적립 실패는 상담을 막지 않는다 */
  }
}
