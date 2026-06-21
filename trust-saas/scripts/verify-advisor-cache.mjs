/* ============================================================
   회귀 가드 — 상담(advisor·Pillar 2) 시맨틱 Q&A 캐시(무 API 즉답)

   배경(비용·지연 vs 정확성): 같은·유사 질문이 다시 오면 저장된 답을 그대로
   내보내 LLM 호출을 생략하는 "답변 캐시"(cache.ts 순수 매칭 + cache-store.ts
   I/O + route.ts 통합). "잘못된 캐시답은 API 호출보다 나쁘다"가 원칙이라
   recall 보다 **precision** 우선 — 두 신호를 결합한다.
     1) 문자 바이그램 Dice(threshold) — 한국어 조사/어미·어순 변형 흡수.
     2) 핵심어 토큰 교집합 하한(minTerms) — 도메인 명사가 N개 미만 겹치면
        미적중(짧은/일반 질의의 우연 매칭 차단).

   본 가드가 고정하는 불변식:
     (B) 정확 일치 → 적중(score=1).
     (C) ★조사/어미 강건성 — "담보신탁과 근저당의 차이가" ↔ "담보신탁이랑 근저당
         차이점은" 가 같은 어근으로 적중(sameStem 이 조사·어미 흡수).
     (D) ★정밀도 게이트 — 핵심어가 2개 미만 겹치면 미적중(다른 신탁상품·짧은
         질의가 우연 매칭되지 않음). "구조" 한 단어만 겹치는 다른 토지신탁 종류는
         적중 금지.
     (E) threshold 게이팅 — score 가 임계 미만이면 미적중·반환 score≥임계.
     (F) best-of — 게이트 통과 후보 중 최고 점수 1건(배열 순서 무관).
     (H) ★route 무동작/멀티턴 안전 배선 — 멀티턴(후속 질문)은 캐시 미사용
         (isFreshSingleTurn 게이트), 긴급 차단 env(ADVISOR_CACHE_OFF),
         임계 env(ADVISOR_CACHE_THRESHOLD), 적립은 fresh single-turn 에만,
         X-Advisor-Cache 헤더.
     (I) ★cache-store graceful degradation — Supabase env 없으면 무동작(빈 FAQ
         시드 → []), 너무 짧은 답·오류([오류]) 답은 적립 안 함(나쁜 답 재사용 방지).

   ※ 현재 _advisor-faq.json 시드는 빈 배열 + Supabase 보류 → 런타임 캐시는
      inert(advisor 거동 종전과 동일). 본 가드는 시드/DB 가 채워졌을 때의
      매칭 정밀도와 무동작 안전성을 사전 고정한다.

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-advisor-cache.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { bigrams, terms, toCandidate, findCacheHit } from "../src/lib/advisor/cache.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// 후보 코퍼스(실 FAQ 시드 질문 형태) → 매칭용 후보 구조로 사전계산.
const RAW = [
  { id: "c1", q: "담보신탁이 뭐야?", answer: "담보신탁은 …", sources: [{ topic: "담보신탁", kind: "개념" }] },
  { id: "c2", q: "담보신탁과 근저당의 차이가 뭔가요?", answer: "담보신탁과 근저당은 …" },
  { id: "c3", q: "관리형토지신탁은 어떤 구조인가요?", answer: "관리형토지신탁은 …" },
];
const CANDS = RAW.map(toCandidate);

console.log("\n[A] 토큰화·바이그램 기본(불용어 제거·정규화)");
{
  const t1 = terms("담보신탁과 근저당의 차이가 뭔가요?");
  ok(t1.has("담보신탁과") && t1.has("근저당의") && t1.has("차이가"), "핵심어 토큰 추출(조사 포함 명사 run)");
  ok(!t1.has("뭔가요"), "불용어(뭔가요) 제거");
  const b1 = bigrams("담보신탁");
  ok(b1.has("담보") && b1.has("보신") && b1.has("신탁") && b1.size === 3, "문자 바이그램 집합");
  ok(bigrams("").size === 0 && terms("").size === 0, "빈 입력 → 빈 집합(무크래시)");
}

console.log("\n[B] 정확 일치 → 적중(score=1)");
{
  const hit = findCacheHit("담보신탁이 뭐야?", CANDS);
  ok(!!hit && hit.entry.id === "c1", "동일 질의 → c1 적중");
  ok(!!hit && hit.score >= 0.999, "동일 질의 score=1(완전 일치)");
  ok(!!hit && Array.isArray(hit.entry.sources) && hit.entry.sources[0].topic === "담보신탁",
    "★sources 그대로 전달(응답 칩 보존)");
}

console.log("\n[C] ★조사/어미 강건성 — 같은 어근은 변형돼도 적중");
{
  // "담보신탁과 근저당의 차이가" ↔ "담보신탁이랑 근저당 차이점은"
  const hit = findCacheHit("담보신탁이랑 근저당 차이점은?", CANDS);
  ok(!!hit && hit.entry.id === "c2", "조사/어미 변형 질의 → c2 적중(sameStem 흡수)");
  ok(!!hit && hit.score >= 0.4, "바이그램 Dice 가 임계(0.4) 이상");
}

console.log("\n[D] ★정밀도 게이트 — 핵심어 2개 미만 겹치면 미적중");
{
  // 다른 신탁상품(분양관리신탁)은 '신탁' 의미는 겹쳐도 토큰이 안 겹쳐 미적중
  ok(findCacheHit("분양관리신탁은 언제 쓰나요?", CANDS) === null,
    "다른 신탁상품 질의 → 우연 매칭 0(담보/관리형 미적중)");
  // 같은 주제(관리형토지신탁 구조) → 적중(recall 보존)
  const onTopic = findCacheHit("관리형토지신탁 구조", CANDS);
  ok(!!onTopic && onTopic.entry.id === "c3", "같은 주제(관리형토지신탁 구조) → c3 적중(recall)");
  // 다른 토지신탁 종류 + '구조' 한 단어만 겹침 → 미적중(precision)
  ok(findCacheHit("차입형토지신탁 구조", [CANDS[2]]) === null,
    "★'구조' 한 단어만 겹치는 다른 토지신탁 종류 → 미적중(precision)");
  // 핵심어 1개뿐인 짧은 질의 → 안전상 캐시 미사용
  ok(terms("뭐야?").size < 2 && findCacheHit("뭐야?", CANDS) === null,
    "핵심어 <2 짧은 질의 → null(minTerms 안전)");
  ok(findCacheHit("", CANDS) === null, "빈 질의 → null");
}

console.log("\n[E] threshold 게이팅 — 임계 미만 미적중·반환 score≥임계");
{
  const base = "담보신탁이랑 근저당 차이점은?";
  ok(findCacheHit(base, CANDS, { threshold: 0.4 }) !== null, "임계 0.4 → 적중");
  ok(findCacheHit(base, CANDS, { threshold: 0.95 }) === null,
    "★동일 질의·동일 게이트 통과지만 임계 0.95 → 미적중(임계가 컷)");
  const hit = findCacheHit(base, CANDS, { threshold: 0.4 });
  ok(!!hit && hit.score >= 0.4, "반환된 적중의 score 는 사용 임계 이상");
}

console.log("\n[F] best-of — 게이트 통과 후보 중 최고 점수 1건(배열 순서 무관)");
{
  const ca = toCandidate({ id: "ca", q: "담보신탁과 근저당의 차이", answer: "…" });
  const cb = toCandidate({ id: "cb", q: "담보신탁과 근저당의 차이가 뭔가요", answer: "…" });
  // 더 짧고 가까운 ca 가 더 높은 Dice → 배열에 cb 를 먼저 둬도 ca 선택.
  const hit = findCacheHit("담보신탁과 근저당 차이점", [cb, ca]);
  ok(!!hit && hit.entry.id === "ca", "최고 점수 후보 선택(배열 첫 항목 cb 가 아님)");
  ok(findCacheHit("담보신탁이 뭐야?", []) === null, "빈 후보 → null");
}

console.log("\n[G] ★정밀도 회귀 — 2자 일반어근('신탁')의 합성어 내 접미 박힘 오적중 차단");
{
  // 실 FAQ 에서 관측된 오적중: "담보신탁이 무엇인가요?" 가 "신탁 과세특례란 무엇인가요?"
  // 에 적중(담보신탁이⊃신탁 + 꼬리말 무엇인가요 공유)하던 버그. 정밀도 우선 → 미적중.
  const realFaq = [
    toCandidate({ id: "g-collateral", q: "담보신탁이 뭐야?", answer: "담보신탁은 …" }),
    toCandidate({ id: "g-tax", q: "신탁 과세특례란 무엇인가요?", answer: "신탁 과세특례는 …" }),
    toCandidate({ id: "g-mgmt", q: "관리형토지신탁은 어떤 구조인가요?", answer: "관리형토지신탁은 …" }),
  ];
  const wrong = findCacheHit("담보신탁이 무엇인가요?", realFaq);
  ok(!wrong || wrong.entry.id !== "g-tax",
    "★'담보신탁이 무엇인가요?' → '신탁 과세특례'(g-tax) 오적중 안 함");
  ok(wrong === null,
    "★모호한 질의는 캐시 미적중(null) → 실 LLM 으로 안전 폴백(잘못된 답 미제공)");

  // 2자 일반어근 접미 박힘은 어근 불인정(담보신탁이 ⊅ 신탁) — 다른 토큰 1개론 미적중
  const suffixBuried = [toCandidate({ id: "s", q: "신탁 기본개념", answer: "…" })];
  ok(findCacheHit("담보신탁이 기본개념", suffixBuried) === null,
    "2자 어근 접미 박힘('신탁'⊂'담보신탁이')은 어근 불인정 → 미적중");

  // ≥3자 접미 포함은 보존(토지신탁 ⊂ 차입형토지신탁) — 의도된 어근 매칭 유지
  const hyperonym = [toCandidate({ id: "h", q: "토지신탁 기본구조", answer: "…" })];
  const hHit = findCacheHit("차입형토지신탁 기본구조", hyperonym);
  ok(!!hHit && hHit.entry.id === "h", "★3자+ 접미 포함(토지신탁⊂차입형토지신탁) 어근 매칭 보존(recall)");

  // 2자 접두 일치는 보존(구조 ↔ 구조인가요) — 머리부터 같은 어근은 인정
  const prefixSame = [toCandidate({ id: "p", q: "관리형토지신탁 구조인가요", answer: "…" })];
  const pHit = findCacheHit("관리형토지신탁 구조", prefixSame);
  ok(!!pHit && pHit.entry.id === "p", "2자 접두 일치('구조'↔'구조인가요') 어근 매칭 보존(recall)");
}

console.log("\n[H] ★route 무동작/멀티턴 안전 배선");
{
  const route = readFileSync(path.join(root, "src", "app", "api", "advisor", "route.ts"), "utf8");
  ok(/import \{ findCacheHit \} from "@\/lib\/advisor\/cache"/.test(route), "findCacheHit import");
  ok(/import \{ loadCacheCandidates, saveCacheEntry \} from "@\/lib\/advisor\/cache-store"/.test(route),
    "loadCacheCandidates·saveCacheEntry import");
  ok(/const isFreshSingleTurn = messages\.length === 1 && messages\[0\]\.role === "user"/.test(route),
    "★멀티턴 차단 게이트(fresh single-turn 정의)");
  ok(/if \(!CACHE_OFF && lastUser && isFreshSingleTurn\) \{/.test(route),
    "★캐시 조회는 !CACHE_OFF && fresh single-turn 일 때만(멀티턴 미사용)");
  ok(/findCacheHit\(lastUser\.content, candidates, \{ threshold: CACHE_THRESHOLD \}\)/.test(route),
    "조회에 운영 임계(CACHE_THRESHOLD) 적용");
  ok(/process\.env\.ADVISOR_CACHE_OFF === "1"/.test(route), "긴급 차단 env(ADVISOR_CACHE_OFF)");
  ok(/Number\(process\.env\.ADVISOR_CACHE_THRESHOLD\) \|\| 0\.4/.test(route),
    "임계 env(ADVISOR_CACHE_THRESHOLD, 기본 0.4)");
  // 적립도 fresh single-turn 에만(멀티턴 답을 캐시에 넣지 않음)
  ok(/if \(lastUser && isFreshSingleTurn\) \{\s*\n\s*void saveCacheEntry\(/.test(route),
    "★적립은 fresh single-turn 에만(멀티턴 답 미적립)");
  ok(/"X-Advisor-Cache": "hit"/.test(route) && /"X-Advisor-Cache": "miss"/.test(route),
    "X-Advisor-Cache 헤더(hit/miss 관측 가능)");
}

console.log("\n[I] ★cache-store graceful degradation(env 없으면 무동작·나쁜 답 미적립)");
{
  const store = readFileSync(path.join(root, "src", "lib", "advisor", "cache-store.ts"), "utf8");
  ok(/process\.env\.NEXT_PUBLIC_SUPABASE_URL && process\.env\.SUPABASE_SECRET_KEY/.test(store),
    "hasSupabase() env 게이트");
  ok(/if \(!hasSupabase\(\)\) return \[\];/.test(store), "★DB 적재는 Supabase env 있을 때만(없으면 [])");
  ok(/if \(!hasSupabase\(\)\) return;/.test(store), "★적립은 Supabase env 있을 때만(없으면 무동작)");
  ok(/if \(!existsSync\(p\)\) return \[\];/.test(store), "FAQ 시드 파일 없으면 [](무크래시)");
  ok(/if \(!q \|\| a\.length < 40\) return;/.test(store), "★너무 짧은 답(<40자) 미적립");
  ok(/if \(a\.includes\("\[오류\]"\)\) return;/.test(store), "★오류([오류]) 답 미적립(나쁜 답 재사용 방지)");
  ok(/return db\.length \? \[\.\.\.faq, \.\.\.db\] : faq;/.test(store), "후보 = FAQ 시드 + (있으면) DB 누적");
  // 모든 실패 경로가 throw 하지 않음(상담 흐름 우선) — catch 로 감쌈
  ok((store.match(/catch \{/g) || []).length >= 3, "I/O 경로 try/catch 격리(어떤 실패도 상담 미차단)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
process.exit(fail === 0 ? 0 : 1);
