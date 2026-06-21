/* ================================================================
   상담(Pillar 2) 시맨틱 Q&A 캐시 — 매칭 로직(순수 함수·무 I/O)

   목적: 같은·유사 질문이 다시 오면 저장된 답변을 그대로 내보내 LLM API
   호출을 생략(비용·지연 절감). "학습"이 아니라 "답변 캐시 적립" 방식.

   매칭은 무API 어휘 방식 — 두 신호를 결합한다.
   1) 문자 바이그램 Dice: 한국어 조사 변형(담보신탁'과' ↔ 담보신탁'이랑'),
      어미 변형(차이'가' ↔ 차이'점'), 어순 변화에 강건. 형태소 분석 불요.
   2) 핵심어 토큰 교집합 하한: 도메인 명사가 최소 N개 겹쳐야 적중 인정 →
      바이그램만으로 생기는 우연 매칭(짧은 일반 질문 등)을 차단.
   잘못된 캐시답은 API 호출보다 나쁘므로 recall 보다 precision 우선.
   추후 임베딩 벡터검색으로 이 파일만 교체 가능.
   ================================================================ */

/** 핵심어 교집합 계산용 일반 기능어(조사형은 토큰에 거의 안 잡혀 최소만). */
const STOP = new Set([
  "그리고", "그러나", "하지만", "무엇", "어떻게", "어떤", "어디", "언제", "누가",
  "대해", "대하여", "관련", "경우", "있나요", "하나요", "되나요",
  "해주세요", "알려주세요", "주세요", "뭔가요", "뭐죠", "이란", "라는",
  "그게", "이거", "저거", "그거", "정도", "관해", "관하여", "설명", "정리",
]);

export interface CachedQA {
  id: string;
  q: string;
  answer: string;
  /** 응답 칩에 쓰는 일반화된 출처(buildSources 산출과 동형). */
  sources?: { topic: string; kind: string }[];
}

/** 매칭에 쓰는 표현(바이그램·핵심어)을 미리 계산해 둔 후보(로드 시 1회). */
export interface CacheCandidate extends CachedQA {
  bigrams: Set<string>;
  terms: Set<string>;
}

export interface CacheHit {
  entry: CacheCandidate;
  score: number;
}

/** 한글/영숫자만 남기고 공백·기호 제거(소문자). 바이그램 산출용. */
function normalize(s: string): string {
  return (s || "").toLowerCase().match(/[가-힣a-z0-9]+/g)?.join("") ?? "";
}

/** 문자 바이그램 집합(1글자면 그 글자 자체). */
export function bigrams(s: string): Set<string> {
  const n = normalize(s);
  if (n.length <= 1) return new Set(n ? [n] : []);
  const out = new Set<string>();
  for (let i = 0; i < n.length - 1; i++) out.add(n.slice(i, i + 2));
  return out;
}

/** 핵심어 토큰(한글 2자+·영숫자 2자+)에서 불용어 제거. */
export function terms(s: string): Set<string> {
  const m = (s || "").toLowerCase().match(/[가-힣]{2,}|[a-z0-9]{2,}/g) || [];
  return new Set(m.filter((t) => !STOP.has(t)));
}

/** Dice 계수(0~1): 2·교집합 / (|a|+|b|). */
function dice(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  for (const x of small) if (big.has(x)) inter++;
  return (2 * inter) / (a.size + b.size);
}

/** 공통 접두 길이. */
function commonPrefix(x: string, y: string): number {
  const n = Math.min(x.length, y.length);
  let i = 0;
  while (i < n && x[i] === y[i]) i++;
  return i;
}

/**
 * 두 핵심어가 같은 어근인지(조사·어미 변형 흡수).
 *  - 완전일치
 *  - 한쪽이 다른 쪽을 포함(근저당 ↔ 근저당권, 토지신탁 ↔ 차입형토지신탁) — 단 포함되는
 *    쪽 토큰이 3자 이상일 때만. 2자 일반어근("신탁"·"수익"·"구조" 등)은 거의 모든
 *    도메인 합성어("담보신탁이"·"수익권")의 부분문자열이라, 그대로 인정하면 질문
 *    꼬리말(…무엇인가요) 한 개만 더 겹쳐도 전혀 다른 상품/주제가 오적중한다
 *    (예: "담보신탁이 무엇인가요?" ↔ "신탁 과세특례란 무엇인가요?"). 정밀도 우선.
 *  - 공통 접두가 짧은 쪽 길이-1 이상(담보신탁이랑 ↔ 담보신탁과, 차이점 ↔ 차이가)
 *    → 양쪽 모두 조사가 붙어 substring 이 깨지는 한국어 케이스를 잡는다. 2자 접두
 *    일치("구조" ↔ "구조인가요")는 어근이 머리부터 같으므로 그대로 인정(접미 박힘과 구분).
 */
function sameStem(x: string, y: string): boolean {
  if (x.length < 2 || y.length < 2) return false;
  if (x === y) return true;
  const shorter = x.length <= y.length ? x : y;
  const longer = x.length <= y.length ? y : x;
  // 포함은 "포함되는 토큰이 3자 이상"일 때만(2자 일반어근의 합성어 내 우연 박힘 차단).
  if (longer.includes(shorter) && shorter.length >= 3) return true;
  // 공통 접두(조사·어미 변형 흡수) — 머리부터 같은 어근만(접미 박힘 무관).
  const cp = commonPrefix(x, y);
  return cp >= 2 && cp >= Math.min(x.length, y.length) - 1;
}

/** 핵심어 교집합 수(조사/어미 흡수, 그리디 1:1). */
function termOverlap(a: Set<string>, b: Set<string>): number {
  const bb = [...b];
  const used = new Array(bb.length).fill(false);
  let c = 0;
  for (const x of a) {
    for (let i = 0; i < bb.length; i++) {
      if (used[i]) continue;
      if (sameStem(x, bb[i])) {
        used[i] = true;
        c++;
        break;
      }
    }
  }
  return c;
}

/** 질의 문자열로 후보 구조 생성(테스트·로드 공용). */
export function toCandidate(e: CachedQA): CacheCandidate {
  return { ...e, bigrams: bigrams(e.q), terms: terms(e.q) };
}

export interface FindOpts {
  /** 바이그램 Dice 적중 임계(기본 0.4). 핵심어 2개 게이트가 정밀도를 담당. */
  threshold?: number;
  /** 핵심어 교집합 하한(기본 2) — 명사가 2개 미만 겹치면 미적중. */
  minTerms?: number;
}

/**
 * 질의에 가장 잘 맞는 캐시 후보 1건 반환(조건 미달이면 null).
 * 핵심어가 2개 미만인 너무 짧은 질의는 안전상 캐시 미사용.
 */
export function findCacheHit(
  query: string,
  entries: CacheCandidate[],
  opts: FindOpts = {}
): CacheHit | null {
  const threshold = opts.threshold ?? 0.4;
  const minTerms = opts.minTerms ?? 2;
  const qb = bigrams(query);
  const qt = terms(query);
  if (qt.size < minTerms) return null;

  let best: CacheHit | null = null;
  for (const e of entries) {
    if (termOverlap(qt, e.terms) < minTerms) continue;
    const score = dice(qb, e.bigrams);
    if (score >= threshold && (!best || score > best.score)) {
      best = { entry: e, score };
    }
  }
  return best;
}
