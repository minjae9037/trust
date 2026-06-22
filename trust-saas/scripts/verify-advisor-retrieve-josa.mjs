/* ============================================================
   회귀 가드 — 상담(advisor·Pillar 2) RAG-lite 리트리버 한글 조사(josa) 흡착 대응

   배경(실측 결함): gap-report(2026-06-22) 미적중 최다 질문이 "담보신탁이 무엇인가요?"
   (8회)·"우선수익권이 무엇인가요?"·"관리형토지신탁의 …" 였다. 코퍼스 전체가 담보신탁
   지식인데도 score 0(미적중)인 이유 = 질의 토큰이 명사 뒤에 조사가 붙어("담보신탁이")
   큐레이션 태그("담보신탁")보다 길어, 종전 매칭 tagBlob.includes(token) 이 "토큰이 태그보다
   짧을 때"만 잡고 이 방향(토큰이 더 김)을 놓쳤기 때문이다. retrieve() 가 토큰 끝 조사를 떼어
   stem 을 매칭에 함께 쓰도록 고쳤다(가산만 — raw 토큰 OR stem, 기존 매칭 무손상).

   본 가드는 retrieve() 를 실제 KNOWLEDGE 코퍼스로 호출(behavioral)해, ① 조사가 붙은 핵심
   정의 질문이 정확한 청크를 회수하고 ② 조사 stem 이 raw 토큰 매칭을 *제거하지 않으며*(후방
   호환) ③ stem 이 2자 미만으로 과도 분해되지 않음(오탐 차단)을 고정한다.

   ※ retriever 는 추후 임베딩으로 교체될 함수다(retrieve.ts 주석). 교체 시 절대 점수가
     달라질 수 있으나, "조사 붙은 정의 질문이 해당 청크를 회수한다"는 *의미* 단언([A][B][E])은
     보존 대상이다.

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-advisor-retrieve-josa.mjs
   ============================================================ */
import { retrieve } from "../src/lib/advisor/retrieve.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};
const idsOf = (q, k = 5) => retrieve(q, k).map((r) => r.chunk.id);
const topScore = (q) => { const r = retrieve(q, 1); return r.length ? r[0].score : 0; };

console.log("\n[A] 조사 붙은 핵심 정의 질문 — 정확한 청크 회수(종전 미적중 → 적중)");
{
  // "담보신탁이 무엇인가요?" : 토큰 [담보신탁이, 무엇인가요] → 종전 score 0(미적중).
  // stem "담보신탁" 으로 trust-collateral(tag "담보신탁") 회수.
  ok(idsOf("담보신탁이 무엇인가요?").includes("trust-collateral"),
    "'담보신탁이 무엇인가요?' → trust-collateral 회수");
  ok(topScore("담보신탁이 무엇인가요?") >= 3, "'담보신탁이 …' topScore ≥ 임계 3(회수 보장)");

  // "우선수익권이 무엇인가요?" : stem "우선수익권" → priority-beneficiary / trust-collateral.
  const pb = idsOf("우선수익권이 무엇인가요?");
  ok(pb.includes("priority-beneficiary") || pb.includes("trust-collateral"),
    "'우선수익권이 무엇인가요?' → 우선수익권 청크 회수");

  // "관리형토지신탁의 …" : stem "관리형토지신탁" → trust-mgmt.
  ok(idsOf("관리형토지신탁의 핵심 차이").includes("trust-mgmt"),
    "'관리형토지신탁의 핵심 차이' → trust-mgmt 회수");
}

console.log("\n[B] 복합 비교 질문 — 다수 관련 청크 동시 회수(조사 stem 다토큰)");
{
  // gap-report 미적중: "담보신탁과 관리형토지신탁의 핵심 차이와 우선수익권 구조를 비교해줘"
  const ids = idsOf("담보신탁과 관리형토지신탁의 핵심 차이와 우선수익권 구조를 비교해줘", 5);
  ok(ids.includes("trust-collateral"), "비교 질문 → 담보신탁 청크 회수(조사 '과')");
  ok(ids.includes("trust-mgmt"), "비교 질문 → 관리형토지신탁 청크 회수(조사 '의')");
}

console.log("\n[C] 후방호환 — 조사 없는 질의는 기존과 동일하게 회수");
{
  // 조사 없는 raw 토큰: stem=null → 기존 경로 그대로(verify-advisor-retrieve [I] 와 동일 기대).
  ok(idsOf("담보신탁").includes("trust-collateral"), "조사 없는 '담보신탁' → trust-collateral(무회귀)");
  ok(idsOf("관리형토지신탁").includes("trust-mgmt"), "조사 없는 '관리형토지신탁' → trust-mgmt(무회귀)");
  ok(idsOf("경매절차").includes("auction-procedure-timeline"), "조사 없는 '경매절차' → 경매 청크(무회귀)");
}

console.log("\n[D] stem 이 raw 매칭을 제거하지 않음(OR 가산) — 조사처럼 끝나는 합성어 보존");
{
  // "공시지가" 는 끝이 '가'(조사 후보)지만 그 자체가 태그의 부분("공시지가기준법").
  // stem "공시지" 로 분해돼도 raw "공시지가" OR 매칭이 살아 회수돼야 한다(제거 0).
  ok(idsOf("공시지가").includes("land-appraisal-public-price-method"),
    "'공시지가'(끝 '가') → raw 매칭 보존(stem 분해가 제거 안 함)");
}

console.log("\n[E] 과도 분해 차단 — 2자 미만 stem 으로 광범위 오탐을 만들지 않음");
{
  // "차이"(끝 '이') → stem "차"(1자)는 버려져 stem 매칭 없음. raw "차이" 도 어느 태그/본문에도
  // 없으므로(KNOWLEDGE 미등장) 회수 0 — 단음절 stem 으로 무관 청크를 끌어오지 않음을 증명.
  ok(retrieve("차이", 5).length === 0, "'차이' 단독 → stem '차'(1자) 폐기·무관 회수 0");
  // 빈/무토큰 안전(상위 가드와 중복이나 josa 경로 진입 시 회귀 차단).
  ok(retrieve("", 5).length === 0, "빈 질의 → []");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
