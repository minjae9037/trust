/* ============================================================
   회귀 가드 — 상담(advisor·Pillar 2) 서류작성 액션 마커 파싱

   배경(내부 프로토콜 노출 갭): 페르소나(api/advisor/route.ts)는 사용자가
   실제 서류 작성을 원할 때 LLM 답변 *맨 끝줄*에 내부 마커
   (<<doc:collateral|joint|fund>>) 하나만 출력하도록 지시한다. 클라이언트
   (AdvisorChat)는 이 마커를 본문에서 제거하고 서류작성 버튼(docId)으로
   바꿔 보여준다 — 마커 자체는 사용자에게 노출되지 않는 게 계약.

   그러나 마커는 답변 끝에 오고 응답은 토큰 단위 스트리밍이라, 닫는 ">>"
   도착 전 본문 끝에 부분 마커(<<doc:, <<doc:collat …)가 잠시 남는다.
   완성 마커만 제거하던 기존 parseAction 은 이 부분 마커를 마크다운 본문에
   그대로 렌더해 내부 프로토콜 문자열이 사용자에게 깜빡이던 갭.

   수정: parseAction(src/lib/advisor/action-marker.ts)이 ①완성 마커 →
   docId 추출·본문 제거 ②본문 끝 *진행 중(부분)* 마커 조각도 제거.
   순수 함수라 본 가드로 불변식을 고정한다.

   핵심 불변식:
     - 완성 마커 → docId 추출 + 본문에서 제거(마커 비노출).
     - 스트리밍 중 부분 마커(<<doc: ~ <<doc:collateral>) → 본문에서 제거.
     - 일반 산문에 흔한 단일 "<" / 마커 아닌 "<<"(코드 `a << b`)는 보존(오탐 0).
     - 마커 없는 평범한 답변은 무변형(docId=null).

   단언:
     (A) 완성 마커 3종 → 정확한 docId + 본문에서 제거
     (B) ★스트리밍 부분 마커 전 단계 → 본문에 잔존 0(docId 아직 null)
     (C) 마커 없는 답변 → 무변형·docId null
     (D) 오탐 0 — 단일 "<", 마커 아닌 "<<", 부등호 산문 보존
     (E) 본문 중간 마커·앞뒤 공백·복수 마커 처리
     (F) DOC_LABEL — 모든 DOC_ID 라벨 존재·단일 출처

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-advisor-doc-marker.mjs
   ============================================================ */
import {
  parseAction,
  DOC_IDS,
  DOC_LABEL,
} from "../src/lib/advisor/action-marker.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

console.log("\n[A] 완성 마커 3종 → docId 추출 + 본문 제거");
for (const id of DOC_IDS) {
  const r = parseAction(`담보신탁 구조는 …\n\n<<doc:${id}>>`);
  ok(r.docId === id, `docId=${id}`);
  ok(!r.body.includes("<<doc:"), `본문에 마커 제거(${id})`);
  ok(r.body === "담보신탁 구조는 …", `본문 trim 보존(${id})`);
}

console.log("\n[B] ★스트리밍 부분 마커 — 본문에 잔존 0(아직 docId null)");
{
  // collateral 마커가 토큰 단위로 완성되는 과정의 중간 상태(단독 "<<" 제외:
  // 마커 시작과 리터럴 "<<" 가 모호해 의도적으로 보존 — [D] 에서 별도 검증).
  const partials = [
    "<<d",
    "<<do",
    "<<doc",
    "<<doc:",
    "<<doc:c",
    "<<doc:colla",
    "<<doc:collateral",
    "<<doc:collateral>",
  ];
  for (const p of partials) {
    const r = parseAction(`답변 본문입니다.\n${p}`);
    ok(!r.body.includes("<<"), `부분 마커 "${p}" 제거 → 본문 "<<" 0`);
    ok(!r.body.includes("doc:"), `부분 마커 "${p}" → "doc:" 잔존 0`);
    ok(r.docId === null, `부분 마커 "${p}" → docId 아직 null`);
    ok(r.body === "답변 본문입니다.", `부분 마커 "${p}" 제거 후 본문 보존`);
  }
  // joint·fund 부분 마커도 동일하게 제거
  ok(!parseAction("x\n<<doc:joi").body.includes("<<"), "joint 부분 마커 제거");
  ok(!parseAction("x\n<<doc:fun").body.includes("<<"), "fund 부분 마커 제거");
}

console.log("\n[C] 마커 없는 답변 → 무변형·docId null");
{
  const text = "담보신탁과 관리형토지신탁의 차이는 다음과 같습니다.\n\n1. 구조\n2. 리스크";
  const r = parseAction(text);
  ok(r.body === text, "본문 무변형");
  ok(r.docId === null, "docId null");
}

console.log("\n[D] ★오탐 0 — 단일 '<' / 마커 아닌 '<<' / 부등호 산문 보존");
{
  // 단일 '<' 은 lastIndexOf('<<') 미매칭 → 보존
  ok(parseAction("우선수익한도 < 대출원금").body === "우선수익한도 < 대출원금", "단일 '<' 보존");
  // 마커가 아닌 '<<' 로 끝나는(혹은 뒤따르는) 산문 — 마커 접두사가 아니므로 보존
  ok(parseAction("코드: a << b").body === "코드: a << b", "마커 아닌 '<< b' 보존");
  ok(parseAction("연산자 <<").body === "연산자 <<", "마커 아닌 단독 '<<' 보존");
  // 마커처럼 시작했다 다른 글자로 갈라지는 경우 — 접두사 불일치 → 보존
  ok(parseAction("x <<doc:zzz").body === "x <<doc:zzz", "마커 접두사 이탈 '<<doc:zzz' 보존");
}

console.log("\n[E] 본문 중간 마커·앞뒤 공백·복수 마커 처리");
{
  // 페르소나는 끝줄을 지시하지만, 본문 중간에 와도 완성 마커는 제거(g 플래그)
  const r1 = parseAction("앞 <<doc:joint>> 뒤");
  ok(r1.docId === "joint" && !r1.body.includes("<<doc:"), "중간 완성 마커 제거+docId");
  // 복수 완성 마커 — 첫 매칭 docId, 전부 제거
  const r2 = parseAction("a <<doc:collateral>> b <<doc:fund>>");
  ok(r2.docId === "collateral", "복수 마커 → 첫 docId");
  ok(!r2.body.includes("<<doc:"), "복수 마커 전부 제거");
  // 빈 문자열·공백
  ok(parseAction("").body === "" && parseAction("").docId === null, "빈 입력 안전");
}

console.log("\n[F] DOC_LABEL — 모든 DOC_ID 라벨 존재(단일 출처)");
{
  ok(DOC_IDS.length === 3, "DOC_IDS 3종");
  ok(DOC_IDS.every((id) => typeof DOC_LABEL[id] === "string" && DOC_LABEL[id].length > 0), "모든 id 라벨 존재");
  ok(DOC_LABEL.collateral === "담보신탁", "collateral 라벨");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
if (fail > 0) process.exit(1);
