/* ============================================================
   회귀 가드 — 상담(advisor·Pillar 2) 멀티턴 후속 질문 검색 맥락 보강(buildRetrievalQuery)

   배경(실측 결함): 종전 라우트는 retrieve(lastUser.content, …) 로 **마지막 사용자 발화
   한 줄만** 검색했다. 그래서 "그럼 절차는?" "그건 왜 그런가요?" 처럼 그 자체엔 도메인
   키워드가 없고 직전 맥락에 의존하는 후속 질문은 토큰이 매칭되지 않아 회수 0건 → 컨텍스트
   미주입 → LLM 이 근거 없이 답했다(gap-report 2026-06-22 josa 마감 후 남은 최다 미적중
   유형 = 맥락 의존 후속질문, worklog 16:57 다음스텝). buildRetrievalQuery 가 직전 사용자
   발화(최근 N턴)를 현재 질의에 합쳐 그 맥락을 검색에 싣도록 고쳤다(user 턴만·최근 창만·
   현재 발화 보존 — 가산만·후방호환).

   본 가드는 ① buildRetrievalQuery 의 순수 동작(user 턴만·최근 창·단발 무변경)과
   ② 그 질의로 retrieve() 를 실제 KNOWLEDGE 코퍼스에 호출(behavioral)했을 때 맥락 의존
   후속 질문이 직전 주제 청크를 회수함을 고정한다.

   ※ retriever 는 추후 임베딩으로 교체될 함수다(retrieve.ts 주석). 교체 시 절대 점수가
     달라질 수 있으나, "맥락 합친 후속 질문이 직전 주제 청크를 회수한다"는 *의미* 단언은
     보존 대상이다.

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-advisor-context-query.mjs
   ============================================================ */
import { retrieve, buildRetrievalQuery } from "../src/lib/advisor/retrieve.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};
const idsOf = (q, k = 4) => retrieve(q, k).map((r) => r.chunk.id);
const U = (content) => ({ role: "user", content });
const A = (content) => ({ role: "assistant", content });

console.log("\n[A] 맥락 의존 후속 질문 — 단발 0건이나 맥락 합치면 직전 주제 회수");
{
  // "그건 왜 그런가요?" : 도메인 토큰 0개 → 단발 retrieve 0건(맥락 없으면 회수 불가).
  ok(retrieve("그건 왜 그런가요?", 4).length === 0,
    "단발 '그건 왜 그런가요?' → 회수 0건(맥락 의존 후속질문의 단발 한계)");
  // 직전 턴이 담보신탁을 확립 → 합친 질의가 trust-collateral 회수(컨텍스트 주입 복원).
  const conv = [U("담보신탁이 무엇인가요?"), A("담보신탁은 …"), U("그건 왜 그런가요?")];
  ok(idsOf(buildRetrievalQuery(conv)).includes("trust-collateral"),
    "맥락 '담보신탁이…? + 그건 왜…?' → trust-collateral 회수(후속질문 컨텍스트 복원)");
}

console.log("\n[B] 후속 절차 질문 — 직전 주제가 회수 질의에 반영");
{
  // 단발 "그럼 절차는?" 는 절차 청크만 잡고 직전 주제(담보신탁)는 못 잡는다.
  ok(!idsOf("그럼 절차는?").includes("trust-collateral"),
    "단발 '그럼 절차는?' → trust-collateral 미회수(직전 주제 소실)");
  // 맥락을 합치면 직전 주제(담보신탁)가 회수 질의에 실려 trust-collateral 도 회수.
  const conv = [U("담보신탁이 무엇인가요?"), A("…"), U("그럼 절차는?")];
  ok(idsOf(buildRetrievalQuery(conv)).includes("trust-collateral"),
    "맥락 '담보신탁이…? + 그럼 절차는?' → trust-collateral 회수(직전 주제 반영)");
}

console.log("\n[C] buildRetrievalQuery 순수 동작 — user 턴만·현재 포함·단발 무변경");
{
  // 단발(첫 턴) → 그 발화만 = 종전 retrieve(lastUser.content) 와 동일(동작 보존).
  ok(buildRetrievalQuery([U("담보신탁이 무엇인가요?")]) === "담보신탁이 무엇인가요?",
    "단발 → 그 발화만 반환(종전 동작 무변경)");
  // assistant 턴 본문(도메인 키워드 포함)은 질의에 섞이지 않는다(노이즈 차단).
  const q = buildRetrievalQuery([U("그건 왜?"), A("관리형토지신탁 차입형토지신탁 분양관리신탁")]);
  ok(!q.includes("관리형토지신탁"),
    "assistant 답변 본문은 검색 질의에서 제외(user 턴만)");
  // 현재(마지막) 사용자 발화는 항상 포함.
  ok(buildRetrievalQuery([U("담보신탁"), A("…"), U("우선수익권 한도")]).includes("우선수익권 한도"),
    "현재 사용자 발화는 항상 질의에 포함");
  // user 발화가 없으면 "".
  ok(buildRetrievalQuery([A("안내")]) === "", "user 발화 없음 → 빈 질의");
  ok(buildRetrievalQuery([]) === "", "빈 messages → 빈 질의");
}

console.log("\n[D] 최근 창 제한 — 오래된 주제는 회수 질의에서 제외(주제 전환 드리프트 차단)");
{
  // user 턴 4개, 기본 창 3 → 가장 오래된 첫 턴(다른 주제)은 창 밖.
  const conv = [U("리츠 구조"), U("우선수익권"), U("관리형토지신탁"), U("그럼 차이는?")];
  const q = buildRetrievalQuery(conv); // 기본 windowUserTurns=3
  ok(!q.includes("리츠"), "기본 창(3) → 가장 오래된 user 턴('리츠') 제외(드리프트 차단)");
  ok(q.includes("관리형토지신탁") && q.includes("그럼 차이는?"),
    "기본 창(3) → 최근 3개 user 턴 포함");
  // 창 인자 명시 — 최근 2턴만.
  ok(buildRetrievalQuery(conv, 2) === "관리형토지신탁 그럼 차이는?",
    "windowUserTurns=2 → 최근 2개 user 턴만 결합");
  // 창 0/음수 방어 → 최소 1턴(현재 발화) 보존.
  ok(buildRetrievalQuery(conv, 0) === "그럼 차이는?",
    "windowUserTurns=0 방어 → 최소 현재 발화 1턴 보존");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
