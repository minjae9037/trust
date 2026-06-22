/* ============================================================
   검색어 강조(highlight) — 목록 검색 결과의 일치 부분 시각 강조 단일 출처.

   배경(탐색성·표시 전용): ContractsView 검색은 제목·서류명·위탁자명·물건
   소재지를 합친 haystack 부분일치로 카드를 거른다(contractIdentity 단일 출처).
   그러나 일치한 카드를 보여줄 뿐 **어디가 일치했는지**는 표시하지 않아, 계약이
   쌓일수록(동명 위탁자·유사 제목·"(사본)" 다수) 검색어가 카드의 어느 필드에
   걸렸는지 눈으로 다시 훑어야 했다(상대 시각 표기·검색 보강과 같은 탐색성 계열의
   잔여 갭). 일치 부분을 시각 강조해 한눈에 짚게 한다.

   설계(보수적·안전):
     ① **정규식 미사용** — indexOf 기반으로 쪼개 검색어의 특수문자((), [], . 등)를
        리터럴로 다룬다(정규식 주입·오매칭 0).
     ② **대소문자 무시** — 검색 게이트와 동일 정규화(q.trim().toLowerCase()).
     ③ **빈/공백 검색어 → 단일 비매칭 세그먼트**(강조 없음·렌더 동작 무변경·후방호환).
     ④ 순수 함수·입력 무변형 — 검색/정렬 키·조문·엔진·검증 게이트 무관(표시 경계만).

   ※ 표시 전용: 강조는 시각 span(.search-hl) 으로만 입혀, SR 낭독 의미는 바꾸지
      않는다(카드 aria-label·가시 텍스트 그대로). 코드베이스의 "표시 전용·낭독
      중복 0" 컨벤션과 동일.
   ============================================================ */

export interface HighlightSegment {
  text: string;
  /** true = 검색어와 일치한 구간(시각 강조 대상). */
  match: boolean;
}

/**
 * `text` 안에서 `query`(공백 정리·소문자)와 일치하는 모든 구간을 강조 세그먼트로
 * 쪼갠다. 원문 대소문자는 보존하고(표시용), 매칭은 소문자 사본으로 한다.
 *
 * - 빈 `text` → `[]`(렌더 0).
 * - 빈/공백 `query` → `[{ text, match: false }]`(전체 비매칭 = 강조 없음).
 * - 다중 등장은 각각 매칭 세그먼트로 분리하고 그 사이/앞뒤 비매칭을 보존한다.
 */
export function highlightSegments(text: string, query: string): HighlightSegment[] {
  if (typeof text !== "string" || text.length === 0) return [];
  const needle = (typeof query === "string" ? query : "").trim().toLowerCase();
  if (needle.length === 0) return [{ text, match: false }];

  const hay = text.toLowerCase();
  const out: HighlightSegment[] = [];
  let from = 0;
  let idx = hay.indexOf(needle, from);
  while (idx >= 0) {
    if (idx > from) out.push({ text: text.slice(from, idx), match: false });
    out.push({ text: text.slice(idx, idx + needle.length), match: true });
    from = idx + needle.length;
    idx = hay.indexOf(needle, from);
  }
  if (from < text.length) out.push({ text: text.slice(from), match: false });
  return out;
}
