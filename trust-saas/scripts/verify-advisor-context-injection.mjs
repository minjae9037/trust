/* ============================================================
   회귀 가드 — 상담(advisor·Pillar 2) 컨텍스트 주입 경계 출처 식별성 차단

   배경(가드레일 누출 갭·심층방어): 상담 페르소나(api/advisor/route.ts)는
   LLM 답변에서 참고자료의 출처명·회사명·사업장명 비노출을 명시 지시한다
   (CLAUDE.md 운영원칙 3). 헤더/칩 경로(X-Advisor-Sources)는 sources.ts
   buildSources 가 back-data 원본 문서명을 일반 라벨로 치환해 막았으나,
   formatContext() 가 만드는 LLM 컨텍스트 주입 텍스트는 bd-(내부 수집 자료)
   청크의 topic(=원본 문서 제목/파일명 — 특정사 내부규정·개별 딜 문서명
   자리)을 그대로 프롬프트에 실어, 페르소나의 비노출 지시에만 의존하는
   잔여 누출 벡터로 남아 있었다.

   수정: formatContext 가 헤더 경계와 동일 단일 출처(isBackdata/
   BACKDATA_LABEL, sources.ts)를 재사용해 bd- 청크 라벨을 일반화한다.
   청크 본문(실제 지식)은 그대로 주입(RAG 품질 무손상), core 개념 topic 보존.

   본 가드는 formatContext() 를 실제 호출해(behavioral) 다음 불변식을 고정한다:
     (A) core 청크 — topic 보존(유용성)
     (B) back-data 청크 — 원본 문서명 미등장 + BACKDATA_LABEL 치환
     (C) ★누출 0 — 혼합 목록 직렬화 어디에도 bd- 원본 문서명 미등장
     (D) 청크 본문(text)은 bd·core 모두 주입 보존(지식 무손상)
     (E) 머리표·순서·빈입력 포맷 불변(기존 [J] 계약 유지)
     (F) BACKDATA_LABEL 단일 출처 = sources.ts (라벨 drift 정적 차단)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-advisor-context-injection.mjs
   ============================================================ */
import { formatContext } from "../src/lib/advisor/retrieve.ts";
import { BACKDATA_LABEL, isBackdata } from "../src/lib/advisor/sources.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

/** Retrieved 헬퍼 — formatContext 는 chunk.{id,topic,text} 만 사용. */
const R = (id, topic, text) => ({ chunk: { id, topic, tags: [], text }, score: 9 });

// 원본 문서명 자리(누출되면 안 되는 식별 문자열) — KNOWLEDGE 미등장 합성.
const SECRET_DOC = "○○건설 2021 PF 딜 검토서(대외비)";
const SECRET_DOC2 = "△△신탁 내부 여신규정 v3";

console.log("[A] core 청크 — 개념 topic 보존");
{
  const ctx = formatContext([R("trust-x", "담보신탁 구조", "담보신탁 본문 텍스트")]);
  ok(ctx.includes("담보신탁 구조"), "core topic 그대로 주입");
  ok(ctx.includes("담보신탁 본문 텍스트"), "core 본문 주입");
}

console.log("\n[B] back-data 청크 — 원본 문서명 비노출 + 일반 라벨 치환");
{
  const ctx = formatContext([R("bd-001", SECRET_DOC, "내부 자료 본문 핵심내용")]);
  ok(!ctx.includes(SECRET_DOC), "★bd 원본 문서명 미등장(누출 0)");
  ok(ctx.includes(BACKDATA_LABEL), "BACKDATA_LABEL 로 치환");
  ok(ctx.includes("내부 자료 본문 핵심내용"), "bd 본문(지식)은 주입 보존");
}

console.log("\n[C] ★누출 0 — 혼합 목록 직렬화에 bd 원본 문서명 토막조차 미등장");
{
  const items = [
    R("bd-001", SECRET_DOC, "딜 본문 A"),
    R("trust-y", "PF 단계 구조", "PF 본문 B"),
    R("bd-002", SECRET_DOC2, "여신 본문 C"),
  ];
  const ctx = formatContext(items);
  // 원본 문서명의 식별 토막(괄호 앞 회사명 등)도 미등장
  for (const frag of [SECRET_DOC, SECRET_DOC2, "○○건설", "대외비", "△△신탁", "여신규정"]) {
    ok(!ctx.includes(frag), `누출 0 — '${frag}' 미등장`);
  }
  ok(ctx.includes("PF 단계 구조"), "혼합 중 core topic 은 보존");
  ok((ctx.match(new RegExp(BACKDATA_LABEL, "g")) || []).length === 2, "bd 2건 모두 일반 라벨");
}

console.log("\n[D] 청크 본문(text) — bd·core 모두 주입 보존(지식 무손상)");
{
  const ctx = formatContext([
    R("bd-003", SECRET_DOC, "bd 지식 본문 X"),
    R("core-z", "개념", "core 지식 본문 Y"),
  ]);
  ok(ctx.includes("bd 지식 본문 X") && ctx.includes("core 지식 본문 Y"),
    "라벨만 일반화·본문은 양쪽 보존");
}

console.log("\n[E] 머리표·순서·빈입력 포맷 불변(기존 [J] 계약)");
{
  ok(formatContext([]) === "", "빈 입력 → 빈 문자열");
  const ctx = formatContext([
    R("bd-004", SECRET_DOC, "첫째 본문"),
    R("core-w", "둘째 개념", "둘째 본문"),
  ]);
  ok(ctx.startsWith("[참고자료 1]"), "머리표 '[참고자료 1]' 유지");
  ok(ctx.includes("[참고자료 2]"), "다건 → 순번 증가");
  // 순서 보존: 첫째(bd)가 둘째(core)보다 앞
  ok(ctx.indexOf("첫째 본문") < ctx.indexOf("둘째 본문"), "검색 순서 보존");
}

console.log("\n[F] 단일 출처 정합 — BACKDATA_LABEL/isBackdata = sources.ts");
{
  ok(typeof BACKDATA_LABEL === "string" && BACKDATA_LABEL.length > 0, "BACKDATA_LABEL 비빈 문자열");
  ok(isBackdata({ id: "bd-x", topic: "t", tags: [], text: "" }) === true, "isBackdata bd- → true");
  ok(isBackdata({ id: "trust-x", topic: "t", tags: [], text: "" }) === false, "isBackdata core → false");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
