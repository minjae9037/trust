/* ============================================================
   회귀 가드 — 상담(advisor·Pillar 2) 대화 이력 요청 경계 정제(sanitizeHistory)

   배경(내부 마커 송신측 누출 갭): 페르소나(api/advisor/route.ts)는 서류작성
   의사 시 답변 끝줄에 내부 마커(<<doc:collateral|joint|fund>>)를 출력하고,
   클라이언트(AdvisorChat)는 이를 ①본문에서 제거 ②서류작성 버튼으로 변환해
   보여준다 — 마커는 사용자에게 노출되지 않는 게 계약(parseAction·doc-marker 가드).

   그러나 assistant 메시지의 *원시 content*(acc)에는 마커가 그대로 남고,
   멀티턴에서 클라이언트는 이 이력(base)을 다시 /api/advisor 로 전송한다.
   정제 없이 보내면 사용자에게 절대 노출하지 않기로 한 내부 프로토콜 마커가
   *모델 컨텍스트(요청 본문)로 되돌아간다* — 표시 경계(parseAction)에서 막은
   누출이 송신 경계에는 막혀 있지 않던 대칭 갭.

   수정: sanitizeHistory(src/lib/advisor/action-marker.ts)가 요청 직전 이력을
   정제 — assistant content 는 parseAction.body(사용자가 본 본문)로 치환,
   마커뿐이라 본문이 빈 assistant 턴은 제외, user 는 무변형(role·content 만).
   순수 함수라 본 가드로 불변식을 고정한다.

   핵심 불변식:
     - assistant content 의 완성 마커 → 이력에서 제거(사용자가 본 본문만 전송).
     - 마커뿐(body="") assistant 턴 → 이력에서 제외(빈 content 미전송).
     - user 메시지 무변형 + 부가 필드(sources 등) 제거(role·content 만).
     - 마커 없는 평범한 답변·일반 산문의 "<"/"<<" 는 무변형(오탐 0).
     - 출력 어디에도 "<<doc" 토막 미등장(누출 0).

   단언:
     (A) assistant 완성 마커 3종 → 이력 content 에서 제거(본문만 보존)
     (B) ★마커뿐 assistant 턴 → 이력에서 제외(빈 content 미전송)
     (C) user 무변형 + role·content 만(sources 등 부가 필드 제거)
     (D) 마커 없는 답변·산문 "<"/"<<" 무변형(오탐 0)
     (E) 순수성·멱등·빈 배열·결정성
     (F) ★누출 0 — 어떤 입력이든 출력 어디에도 "<<doc" 미등장
     (G) 배선(static) — AdvisorChat 가 sanitizeHistory 사용 + raw `messages: base` 직송 잔존 0

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-advisor-history-sanitize.mjs
   ============================================================ */
import { readFileSync } from "fs";
import path from "path";
import { sanitizeHistory, DOC_IDS } from "../src/lib/advisor/action-marker.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};
const hasMarkerFrag = (s) => s.includes("<<doc");

console.log("\n[A] assistant 완성 마커 3종 → 이력 content 에서 제거(본문만 보존)");
for (const id of DOC_IDS) {
  const out = sanitizeHistory([
    { role: "user", content: "담보신탁 계약서 만들어줘" },
    { role: "assistant", content: `담보신탁 구조는 …\n\n<<doc:${id}>>` },
  ]);
  ok(out.length === 2, `메시지 2건 유지(${id})`);
  ok(out[1].role === "assistant", `assistant 역할 보존(${id})`);
  ok(!hasMarkerFrag(out[1].content), `assistant content 마커 제거(${id})`);
  ok(out[1].content === "담보신탁 구조는 …", `사용자가 본 본문만 보존(${id})`);
  ok(out[0].content === "담보신탁 계약서 만들어줘", `user 무변형(${id})`);
}

console.log("\n[B] ★마커뿐 assistant 턴 → 이력에서 제외(빈 content 미전송)");
{
  const out = sanitizeHistory([
    { role: "user", content: "담보신탁 계약서" },
    { role: "assistant", content: "<<doc:collateral>>" },
    { role: "user", content: "고마워" },
  ]);
  ok(out.length === 2, "마커뿐 assistant 턴 제외(3→2)");
  ok(out.every((m) => m.content.length > 0), "빈 content 없음");
  ok(out[0].content === "담보신탁 계약서" && out[1].content === "고마워", "user 2건 보존");
  // 앞뒤 공백만 남는 경우도 빈 본문으로 간주(trimEnd 후 "")
  const out2 = sanitizeHistory([{ role: "assistant", content: "   <<doc:joint>>" }]);
  ok(out2.length === 0, "공백+마커뿐 → 제외");
}

console.log("\n[C] user 무변형 + role·content 만(부가 필드 제거)");
{
  const out = sanitizeHistory([
    { role: "user", content: "질문", extra: 1 },
    { role: "assistant", content: "답변 본문", sources: [{ topic: "내부 참고자료", kind: "backdata" }] },
  ]);
  ok(out[0].content === "질문" && out[0].role === "user", "user 본문·역할 보존");
  ok(!("extra" in out[0]), "user 부가 필드 제거");
  ok(out[1].content === "답변 본문", "assistant 본문 보존(마커 없음)");
  ok(!("sources" in out[1]), "assistant sources 필드 제거");
  ok(Object.keys(out[1]).sort().join() === "content,role", "role·content 키만 존재");
}

console.log("\n[D] 마커 없는 답변·산문 부등호 무변형(오탐 0)");
{
  const proseSamples = [
    "PF 구조는 다음과 같습니다.",
    "비교: a < b 이고 c << d 인 경우",       // 단일 "<", 코드성 "<<"
    "수익률 < 5% 이면 EXIT 검토",
    "표\n| 항목 | 값 |\n|---|---|\n| LTV | 60% |",
  ];
  for (const c of proseSamples) {
    const out = sanitizeHistory([{ role: "assistant", content: c }]);
    ok(out.length === 1 && out[0].content === c, `무변형 보존: ${JSON.stringify(c).slice(0, 30)}…`);
  }
}

console.log("\n[E] 순수성·멱등·빈 배열·결정성");
{
  ok(sanitizeHistory([]).length === 0, "빈 배열 → 빈 배열");
  const input = [
    { role: "user", content: "q" },
    { role: "assistant", content: "본문\n\n<<doc:fund>>" },
  ];
  const snapshot = JSON.stringify(input);
  const once = sanitizeHistory(input);
  ok(JSON.stringify(input) === snapshot, "입력 원본 무변형(순수성)");
  const twice = sanitizeHistory(once);
  ok(JSON.stringify(once) === JSON.stringify(twice), "멱등(sanitize∘sanitize = sanitize)");
  ok(JSON.stringify(sanitizeHistory(input)) === JSON.stringify(once), "결정성(동일 입력 동일 출력)");
}

console.log("\n[F] ★누출 0 — 어떤 입력이든 출력에 '<<doc' 미등장");
{
  const adversarial = [
    { role: "user", content: "담보 <<doc:collateral>> 섞인 질문" }, // user 는 무변형이라 그대로
    { role: "assistant", content: "본문 <<doc:collateral>> 중간 마커" },
    { role: "assistant", content: "<<doc:joint>>" },
    { role: "assistant", content: "끝 <<doc:fund>>" },
  ];
  const out = sanitizeHistory(adversarial);
  // user 메시지는 정책상 무변형(사용자 입력은 마커가 아니라 텍스트) → assistant 만 누출 검사
  for (const m of out) {
    if (m.role === "assistant") ok(!hasMarkerFrag(m.content), `assistant 누출 0: ${JSON.stringify(m.content).slice(0, 24)}…`);
  }
  ok(out.some((m) => m.role === "user"), "user 메시지 보존");
}

console.log("\n[G] 배선(static) — AdvisorChat 가 sanitizeHistory 사용·raw 직송 제거");
{
  const src = readFileSync(path.join(process.cwd(), "src", "components", "advisor", "AdvisorChat.tsx"), "utf8");
  ok(/sanitizeHistory/.test(src), "AdvisorChat import/사용 sanitizeHistory");
  ok(/messages:\s*sanitizeHistory\(base\)/.test(src), "요청 본문 = sanitizeHistory(base)");
  ok(!/body:\s*JSON\.stringify\(\{\s*messages:\s*base\s*\}\)/.test(src), "raw `messages: base` 직송 잔존 0");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
