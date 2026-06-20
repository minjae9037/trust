/* ================================================================
   PII 토큰화 — Claude 전송 경계 보호 (프라이버시 하이브리드)
   클라이언트에서 전송 직전 고민감 식별자를 토큰으로 치환하고,
   매핑은 클라이언트에만 보관. 응답·패치에서 역치환.
   ================================================================ */

export interface PiiMap {
  [token: string]: string;
}

/** 토큰화 대상 패턴 (고민감 식별자) */
const PII_PATTERNS: { label: string; re: RegExp }[] = [
  { label: "법인등록번호", re: /\b\d{6}-\d{7}\b/g },
  { label: "사업자등록번호", re: /\b\d{3}-\d{2}-\d{5}\b/g },
  { label: "주민등록번호", re: /\b\d{6}-[1-4]\d{6}\b/g },
  { label: "등기고유번호", re: /\b\d{4}-\d{4}-\d{6}\b/g },
];

/**
 * 텍스트의 PII 를 토큰으로 치환. 기존 map 에 누적(같은 값=같은 토큰).
 * 반환된 text 를 Claude 로 전송, map 은 클라이언트 보관.
 */
export function tokenizePII(text: string, map: PiiMap = {}): { text: string; map: PiiMap } {
  // 값→토큰 역인덱스 (동일 값 재사용)
  const valueToToken: Record<string, string> = {};
  for (const [tok, val] of Object.entries(map)) valueToToken[val] = tok;
  let counter = Object.keys(map).length;

  let out = text;
  for (const { label, re } of PII_PATTERNS) {
    out = out.replace(re, (match) => {
      if (valueToToken[match]) return valueToToken[match];
      const token = `[${label}_${++counter}]`;
      map[token] = match;
      valueToToken[match] = token;
      return token;
    });
  }
  return { text: out, map };
}

/** 토큰을 원래 값으로 복원 (응답 표시·패치 머지 직전) */
export function restorePII(text: string, map: PiiMap): string {
  let out = text;
  for (const [token, val] of Object.entries(map)) {
    out = out.split(token).join(val);
  }
  return out;
}

/** 객체(폼 패치) 내 모든 문자열의 토큰을 복원 */
export function restorePIIDeep<T>(obj: T, map: PiiMap): T {
  if (typeof obj === "string") return restorePII(obj, map) as unknown as T;
  if (Array.isArray(obj)) return obj.map((v) => restorePIIDeep(v, map)) as unknown as T;
  if (obj && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = restorePIIDeep(v, map);
    return out as T;
  }
  return obj;
}

/* ----------------------------------------------------------------
   결정론 식별자 추출 — 토큰화로 Claude 가 못 보는 값을 클라이언트가
   직접 폼에 채울 수 있도록 원문에서 직접 파싱.
   ---------------------------------------------------------------- */
export interface ExtractedIds {
  corpReg?: { front: string; back: string };
  bizNo?: { p1: string; p2: string; p3: string };
  regNo?: string; // 부동산 등기 고유번호
}

export function extractIdentifiers(rawText: string): ExtractedIds {
  const out: ExtractedIds = {};
  const corp = rawText.match(/\b(\d{6})-(\d{7})\b/);
  if (corp) out.corpReg = { front: corp[1], back: corp[2] };
  const biz = rawText.match(/\b(\d{3})-(\d{2})-(\d{5})\b/);
  if (biz) out.bizNo = { p1: biz[1], p2: biz[2], p3: biz[3] };
  const reg = rawText.match(/\b(\d{4}-\d{4}-\d{6})\b/);
  if (reg) out.regNo = reg[1];
  return out;
}
