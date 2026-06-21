/* ============================================================
   회귀 가드 — 상담(advisor·Pillar 2) 근거 출처 식별성 차단(가드레일)

   배경(가드레일 누출 갭): 상담 페르소나(api/advisor/route.ts)는 LLM
   답변에서 참고자료의 출처명·회사명·사업장명을 드러내지 않도록 명시
   지시한다(CLAUDE.md 운영원칙 3). 그러나 근거 출처를 클라이언트 UI
   ("📚 참고한 자료" 칩)로 전달하는 X-Advisor-Sources 헤더 경로는 LLM 을
   *우회*하므로, back-data(내부 수집 자료) 청크의 topic(=원본 문서 제목/
   파일명 — 실측 인덱스에 "○○ 실무가이드북" 같은 문서명, 내부규정·개별
   딜 문서명이 들어갈 수 있음)을 그대로 내보내면 페르소나가 막는 바로
   그 출처 식별 정보가 칩으로 누출된다.

   수정: 전송 경계(서버)에서 back-data 출처를 일반 라벨("내부 참고자료")로
   치환(src/lib/advisor/sources.ts: buildSources/publicSourceLabel).
   core(기본 KNOWLEDGE) 청크의 topic 은 일반 개념어라 식별 위험 없이
   유용하므로 그대로 노출. (PII 토큰화가 Claude 전송 경계에서 식별번호를
   막는 것과 동일 패턴 — 여기선 클라이언트 응답 경계의 출처 식별성.)

   본 가드는 buildSources()/publicSourceLabel() 를 실제 호출해(behavioral)
   누출 차단 불변식을 고정한다.

   핵심 불변식:
     - back-data 청크의 원본 문서명은 출력 어디에도 등장하지 않는다(누출 0).
     - core 청크의 개념 topic 은 보존된다(유용성).
     - 여러 다른 back-data 문서는 단일 "내부 참고자료" 칩으로 합쳐진다
       (개수·식별성까지 비노출).
     - kind(backdata/core)는 보존(칩 스타일링용 category — 식별 아님).

   단언:
     (A) publicSourceLabel — core 는 topic 그대로
     (B) publicSourceLabel — back-data 는 BACKDATA_LABEL(원본 문서명 비노출)
     (C) buildSources — core 개념어 그대로 전달·kind=core
     (D) buildSources — 서로 다른 back-data 문서 다수 → 단일 칩(dedup)
     (E) ★누출 0 — 출력 직렬화 어디에도 back-data 원본 문서명 미등장
     (F) kind 보존 — backdata/core category 유지(식별 아님)
     (G) dedup 순서/첫등장 보존 + core 끼리 dedup 기존 동작
     (H) isBackdata — id 접두사 bd- 만 true
     (I) 빈 입력 → []

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-advisor-sources.mjs
   ============================================================ */
import {
  buildSources,
  publicSourceLabel,
  isBackdata,
  BACKDATA_LABEL,
} from "../src/lib/advisor/sources.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

/** 청크 헬퍼 */
const chunk = (id, topic) => ({ id, topic, tags: [], text: "본문" });
/** Retrieved 헬퍼 */
const R = (id, topic, score = 5) => ({ chunk: chunk(id, topic), score });

// 실측 인덱스에서 가져온 형태의 back-data 원본 문서명(노출되면 안 되는 식별 문자열)
const BD_DOC_A = "2020 건설공사 실무가이드북(최종)";
const BD_DOC_B = "○○신탁 내부 여신규정 v3";
const BD_DOC_C = "판교 개발사업 PF 약정서";

console.log("\n[A] publicSourceLabel — core 는 topic 그대로");
{
  ok(publicSourceLabel(chunk("trust-collateral", "담보신탁")) === "담보신탁", "core topic 보존");
  ok(publicSourceLabel(chunk("pf-stages", "PF 단계 구조")) === "PF 단계 구조", "core 개념어 보존");
}

console.log("\n[B] publicSourceLabel — back-data 는 일반 라벨(원본 문서명 비노출)");
{
  ok(publicSourceLabel(chunk("bd-1-0", BD_DOC_A)) === BACKDATA_LABEL, "bd 문서명 → 일반 라벨");
  ok(publicSourceLabel(chunk("bd-7-3", BD_DOC_B)) !== BD_DOC_B, "bd 원본 문서명 미반환");
  ok(BACKDATA_LABEL === "내부 참고자료", "일반 라벨 = '내부 참고자료'");
}

console.log("\n[C] buildSources — core 개념어 그대로 전달");
{
  const out = buildSources([R("trust-collateral", "담보신탁"), R("pf-stages", "PF 단계 구조")]);
  ok(out.length === 2, "core 2종 → 2칩");
  ok(out[0].topic === "담보신탁" && out[0].kind === "core", "1번째 core topic·kind");
  ok(out[1].topic === "PF 단계 구조" && out[1].kind === "core", "2번째 core topic·kind");
}

console.log("\n[D] buildSources — 서로 다른 back-data 문서 다수 → 단일 칩(개수·식별성 비노출)");
{
  const out = buildSources([
    R("bd-1-0", BD_DOC_A),
    R("bd-7-3", BD_DOC_B),
    R("bd-9-2", BD_DOC_C),
  ]);
  ok(out.length === 1, "서로 다른 bd 문서 3건 → 칩 1개(dedup)");
  ok(out[0].topic === BACKDATA_LABEL, "단일 칩 = '내부 참고자료'");
  ok(out[0].kind === "backdata", "kind=backdata 보존");
}

console.log("\n[E] ★누출 0 — 출력 직렬화 어디에도 back-data 원본 문서명 미등장");
{
  const out = buildSources([
    R("trust-collateral", "담보신탁"),
    R("bd-1-0", BD_DOC_A),
    R("bd-7-3", BD_DOC_B),
    R("bd-9-2", BD_DOC_C),
  ]);
  const blob = JSON.stringify(out);
  ok(!blob.includes(BD_DOC_A), "원본 문서명 A 미노출");
  ok(!blob.includes(BD_DOC_B), "원본 문서명 B 미노출");
  ok(!blob.includes(BD_DOC_C), "원본 문서명 C 미노출");
  ok(!blob.includes("건설공사") && !blob.includes("여신규정") && !blob.includes("판교"), "문서명 토막조차 미노출");
  ok(blob.includes("담보신탁"), "core 개념어는 정상 노출(유용성 유지)");
}

console.log("\n[F] kind 보존 — backdata/core category 유지(식별 아님)");
{
  const out = buildSources([R("trust-collateral", "담보신탁"), R("bd-1-0", BD_DOC_A)]);
  const kinds = out.map((s) => s.kind).sort();
  ok(kinds.join(",") === "backdata,core", "두 category 모두 존재(스타일링용)");
}

console.log("\n[G] dedup 순서/첫등장 보존 + core 끼리 dedup 기존 동작");
{
  // 첫 등장: core(담보신탁) → backdata → core(중복 담보신탁, 탈락)
  const out = buildSources([
    R("trust-collateral", "담보신탁", 9),
    R("bd-1-0", BD_DOC_A, 8),
    R("qna-x", "담보신탁", 7), // 동일 core topic 재등장 → dedup
  ]);
  ok(out.length === 2, "core 중복 1건 제거 → 2칩");
  ok(out[0].topic === "담보신탁" && out[1].topic === BACKDATA_LABEL, "첫 등장 순서(점수순) 보존");
}

console.log("\n[H] isBackdata — id 접두사 bd- 만 true");
{
  ok(isBackdata(chunk("bd-1-0", "x")) === true, "bd- → true");
  ok(isBackdata(chunk("trust-collateral", "x")) === false, "core id → false");
  ok(isBackdata(chunk("qna-3", "x")) === false, "qna- id → false");
}

console.log("\n[I] 빈 입력 → []");
{
  const out = buildSources([]);
  ok(Array.isArray(out) && out.length === 0, "[] 입력 → [] 출력");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
if (fail > 0) process.exit(1);
