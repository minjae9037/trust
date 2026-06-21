/* ============================================================
   회귀 가드 — 상담(advisor·Pillar 2) RAG-lite 리트리버 핵심 로직

   배경(회귀 커버리지 갭): 계약(Pillar 1)은 회귀 가드 40여 종이나, 두 번째
   제품 축인 상담(advisor)의 RAG 핵심 로직 `retrieve.ts` 는 직전까지 가드
   0종이었다(로그 PII 치환 가드가 첫 도입). retrieve() 는 상담 답변 품질을
   좌우하는 컨텍스트 주입의 관문인데, 채점(태그 가중·본문 가중·등장 cap)·
   임계(기본 3 / bd- 6)·qna 부스트(1.25)·topK·토큰화(2자·dedup) 등 미묘한
   상수가 가드 없이 방치돼, 향후 "임베딩 벡터검색으로 retriever 교체"(파일
   주석의 명시 계획) 시 동작 변화를 잡아낼 수단이 없었다.

   본 가드는 retrieve()/formatContext() 를 실제 호출해(behavioral) 그 채점·
   임계·정렬·토큰화 불변식을 고정한다. KNOWLEDGE 코퍼스에 절대 등장하지 않는
   합성 토큰(zorpaa·zbeta)과 extra 청크를 주입해, 기본 코퍼스 청크는 0점으로
   걸러지고 합성 청크의 점수만 정확히 관측한다(격리).

   ※ retriever 는 의도적으로 임베딩으로 교체될 함수다. 교체 시 이 가드가
     적색이 되면 — 점수 절대값이 달라지는 건 예상되므로 — "상대 순위·임계
     의미(노이즈 bd- 더 높은 바)·qna 우선·topK·빈질의 0건" 같은 *계약*이
     유지되는지를 기준으로 재작성한다(절대 점수 단언 [A]~[C]는 vocab 채점
     전용, 교체 시 의미 단언 [D]~[I]를 보존).

   핵심 불변식:
     - 태그 매칭 = 토큰당 +3, 본문 등장 = 토큰당 최대 +3(등장 cap 3).
     - 기본 임계 3 / back-data(bd-) 임계 6(노이즈 차단 더 높은 바).
     - 사용자 Q&A(qna-) 청크는 동일 관련도면 우선(점수 ×1.25).
     - 결과는 점수 내림차순·topK 개로 제한.
     - 토큰은 2자 이상·중복 제거. 토큰 0개면 빈 배열.
     - extra 는 KNOWLEDGE 에 *추가*(교체 아님)되어 함께 검색된다.

   단언:
     (A) 태그 가중(3) — 토큰당 +3, 복수 토큰 합산
     (B) 본문 등장 cap — 동일 토큰 5회여도 +3(과대평가 차단)
     (C) 기본 임계 3 — 1·2점 청크 탈락, 정확히 3점 통과(경계)
     (D) bd- 임계 6 — 3점 bd- 탈락(동점 비-bd 는 통과=더 높은 바 증명)
     (E) qna- 부스트 1.25 — 동일 raw 점수에서 qna- 가 상위
     (F) 정렬 내림차순 + topK 제한
     (G) 빈/무토큰 질의 → []
     (H) 토큰 2자·중복 제거(dedup)
     (I) extra 는 KNOWLEDGE 에 추가되어 함께 검색(교체 아님)
     (J) formatContext — 빈 입력 "" / 비빈 입력 [참고자료 N] 포맷

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-advisor-retrieve.mjs
   ============================================================ */
import { retrieve, formatContext } from "../src/lib/advisor/retrieve.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

/** 합성 청크 — KNOWLEDGE 에 없는 토큰만 사용(격리). topic 은 채점에 섞이지
 *  않도록 중립 한글, tags/text 만 의도된 토큰을 담는다. */
const C = (id, tags, text) => ({ id, topic: "테스트청크", tags, text });

// 질의 토큰 = [zorpaa, zbeta] (둘 다 KNOWLEDGE 미등장)
const Q = "zorpaa zbeta";

// 채점 관측용 청크 세트
const chunks = [
  C("t-tagboth", ["zorpaa", "zbeta"], "관련 본문 없음"),          // 태그 2토큰 → 6
  C("t-tagone", ["zorpaa"], "관련 본문 없음"),                     // 태그 1토큰 → 3
  C("t-body1", ["xnone"], "zorpaa 한번 등장"),                     // 본문 1회 → 1 (탈락)
  C("t-body2", ["xnone"], "zorpaa zorpaa 두번"),                   // 본문 2회 → 2 (탈락)
  C("t-body3", ["xnone"], "zorpaa zorpaa zorpaa 세번"),            // 본문 3회 → 3 (통과·경계)
  C("t-body5", ["xnone"], "zorpaa zorpaa zorpaa zorpaa zorpaa"),   // 본문 5회 → 3 (cap)
  C("bd-low", ["zorpaa"], "관련 본문 없음"),                       // bd-, 3점 → 탈락(임계 6)
  C("bd-high", ["zorpaa", "zbeta"], "관련 본문 없음"),             // bd-, 6점 → 통과
  C("qna-x", ["zorpaa", "zbeta"], "관련 본문 없음"),               // qna-, raw 6 × 1.25 = 7.5
];

const big = retrieve(Q, 50, chunks);
const scoreOf = (id) => {
  const hit = big.find((r) => r.chunk.id === id);
  return hit ? hit.score : null; // null = 임계 미달로 탈락
};

console.log("\n[A] 태그 가중(3) — 토큰당 +3, 복수 토큰 합산");
{
  ok(scoreOf("t-tagboth") === 6, "태그 2토큰 매칭 → 3+3 = 6");
  ok(scoreOf("t-tagone") === 3, "태그 1토큰 매칭 → 3");
}

console.log("\n[B] 본문 등장 cap — 동일 토큰 다회여도 최대 +3");
{
  ok(scoreOf("t-body3") === 3, "본문 3회 → 3");
  ok(scoreOf("t-body5") === 3, "본문 5회여도 → 3 (cap 3·과대평가 차단)");
}

console.log("\n[C] 기본 임계 3 — 경계 통과/탈락");
{
  ok(scoreOf("t-body1") === null, "1점 청크 탈락(임계 미달)");
  ok(scoreOf("t-body2") === null, "2점 청크 탈락(임계 미달)");
  ok(scoreOf("t-body3") === 3, "정확히 3점 통과(경계 포함)");
}

console.log("\n[D] bd- 임계 6 — 동점 비-bd 는 통과(더 높은 바 증명)");
{
  ok(scoreOf("bd-low") === null, "bd- 3점 탈락(기본 3은 넘지만 bd- 임계 6 미달)");
  ok(scoreOf("bd-high") === 6, "bd- 6점 통과");
  ok(scoreOf("t-tagone") === 3, "동일 3점이라도 비-bd 는 통과(bd-만 더 높은 바)");
}

console.log("\n[E] qna- 부스트 1.25 — 동일 raw 점수에서 우선");
{
  ok(scoreOf("qna-x") === 7.5, "qna- raw 6 × 1.25 = 7.5");
  ok(scoreOf("qna-x") > scoreOf("t-tagboth"), "동일 raw(6)에서 qna- 가 t-tagboth 보다 상위 점수");
  ok(big[0].chunk.id === "qna-x", "정렬 결과 최상위 = qna- (관련도 동률 시 사용자 Q&A 우선)");
}

console.log("\n[F] 정렬 내림차순 + topK 제한");
{
  const top2 = retrieve(Q, 2, chunks);
  ok(top2.length === 2, "topK=2 → 정확히 2건");
  ok(top2[0].score >= top2[1].score, "점수 내림차순 정렬");
  ok(big.every((r, i) => i === 0 || big[i - 1].score >= r.score), "전체 결과 단조 내림차순");
  // topK 기본값 3
  const def = retrieve(Q, undefined, chunks);
  ok(def.length === 3, "topK 기본값 = 3");
}

console.log("\n[G] 빈/무토큰 질의 → []");
{
  ok(retrieve("", 5, chunks).length === 0, "빈 문자열 → []");
  ok(retrieve("   ", 5, chunks).length === 0, "공백만 → []");
  ok(retrieve("a 1 z", 5, chunks).length === 0, "단일 문자(2자 미만)만 → [] (토큰 0개)");
}

console.log("\n[H] 토큰 2자 이상 + 중복 제거(dedup)");
{
  // 동일 토큰 3회 반복해도 dedup 되어 1회로 채점 → 태그 1토큰 = 3 (9 아님)
  const dup = retrieve("zorpaa zorpaa zorpaa", 5, [C("t-dup", ["zorpaa"], "본문 없음")]);
  const s = dup.find((r) => r.chunk.id === "t-dup");
  ok(s && s.score === 3, "질의 토큰 중복 제거 → 태그 3점(9점 아님)");
  // 2자 미만은 토큰화에서 제외되어 매칭에 기여하지 않음
  const short = retrieve("z", 5, [C("t-short", ["z"], "z")]);
  ok(short.length === 0, "1자 토큰은 매칭 기여 0 → 결과 없음");
}

console.log("\n[I] extra 는 KNOWLEDGE 에 추가되어 함께 검색(교체 아님)");
{
  // extra 없이도 기본 KNOWLEDGE 코퍼스가 검색된다
  const base = retrieve("담보신탁", 5);
  ok(base.some((r) => r.chunk.id === "trust-collateral"),
    "extra 없이 KNOWLEDGE 검색 — '담보신탁' → trust-collateral");
  // extra 를 넘기면 KNOWLEDGE + extra 가 함께 검색된다(extra 가 base 를 대체하지 않음)
  const both = retrieve("담보신탁 zorpaa zbeta", 50, [C("bd-extra-tag", ["zorpaa", "zbeta"], "본문 없음")]);
  ok(both.some((r) => r.chunk.id === "trust-collateral"), "extra 동반 시에도 KNOWLEDGE 청크 검색됨");
  ok(both.some((r) => r.chunk.id === "bd-extra-tag"), "extra 청크도 동시에 검색됨(추가·합집합)");
}

console.log("\n[J] formatContext — 빈 입력 / 비빈 입력 포맷");
{
  ok(formatContext([]) === "", "빈 결과 → 빈 문자열(컨텍스트 미주입)");
  const items = retrieve("담보신탁", 1);
  const ctx = formatContext(items);
  ok(ctx.startsWith("[참고자료 1]"), "비빈 결과 → '[참고자료 1]' 머리표");
  ok(ctx.includes(items[0].chunk.topic) && ctx.includes(items[0].chunk.text.slice(0, 20)),
    "주입 텍스트에 topic·본문 포함");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
