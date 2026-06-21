/* ============================================================
   회귀 가드 — 계약 대화(chat·Pillar 1) "반영 항목" 요약
   (summarizePatch, src/lib/chat/formSchema.ts)

   배경(완성도 UX·정확성 가드레일·비-산출물):
   계약 대화에서 Claude 가 update_form 도구로 채운 값은 ChatPanel(L78)에서
   mergeFormPatch(patch) 로 **법적 서류 폼에 조용히 반영**된다(기존엔 무엇이
   채워졌는지 사용자에게 아무 피드백 없음). summarizePatch 는 그 patch 를
   사람이 읽는 "반영 항목" 라벨 목록으로 요약해 채팅에 "✓ … 반영됨" 으로 표시,
   AI 의 폼 변경을 검수·신뢰 가능하게 한다(표시 전용). 핵심 불변식:
     - **값 미노출**: 식별번호·금액·소재지 등 원본 값은 라벨에 절대 등장하지 않는다
       (항목명 + 인원/건수만). AI 가 채운 항목 가시화가 새 누출 경로가 되지 않음.
     - 빈 배열·빈 객체·미해당 키는 제외(채워진 것만 사실대로).
     - common 의 year/month/day 는 "계약일" 하나로 dedup.
     - patch 는 normalizePatchIds(toolInputToPatch(...)) 출력(ChatPanel L77)과 동형.
   현 코드 정상 — 본 가드로 불변식 고정(테스트 전용, 조문·엔진·산출물 무접촉).

   단언:
     (A) 당사자 배열(위탁자/채무자/수익자/우선수익자) → "라벨 N명"·빈 배열 제외
     (B) 신탁부동산 배열 → "신탁부동산 N건"·빈 배열 제외
     (C) 동일여부 토글(boolean true/false) → "채무자 지정"/"수익자 지정"
     (D) common 하위 라벨·★year/month/day → "계약일" 1개 dedup
     (E) docContents.contract(특약옵션) → 비어있지 않을 때만 "특약옵션"
     (F) 엣지 — 빈/null/비객체/common 배열·빈 객체 → 안전([] 또는 제외)·무크래시
     (G) ★종합 — 실 파이프라인(toolInputToPatch→normalizePatchIds) patch 요약에
         PII 원본 값(법인번호·사업자번호·소재지·금액·이름) 일절 미등장(누출 0)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-chat-patch-summary.mjs
   ============================================================ */
import { summarizePatch, toolInputToPatch, normalizePatchIds } from "../src/lib/chat/formSchema.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

console.log("\n[A] 당사자 배열 → '라벨 N명'·빈 배열 제외");
{
  const r = summarizePatch({
    trustors: [{ name: "갑" }, { name: "을" }],
    debtors: [{ name: "병" }],
    beneficiaries: [],
    priorities: [{ name: "○○은행" }],
  });
  ok(r.includes("위탁자 2명"), "위탁자 2명");
  ok(r.includes("채무자 1명"), "채무자 1명");
  ok(r.includes("우선수익자 1명"), "우선수익자 1명");
  ok(!r.some((s) => s.startsWith("수익자")), "빈 beneficiaries 배열 제외");
  // 우선수익자 라벨이 수익자 startsWith 에 안 걸리도록 별도 확인
  ok(r.filter((s) => s === "수익자 0명").length === 0, "수익자 0명 미표기");
}

console.log("\n[B] 신탁부동산 → 'N건'·빈 배열 제외");
{
  ok(summarizePatch({ properties: [{ address: "서울" }, { address: "부산" }] }).includes("신탁부동산 2건"), "신탁부동산 2건");
  ok(summarizePatch({ properties: [] }).length === 0, "빈 properties 제외(빈 결과)");
}

console.log("\n[C] 동일여부 토글(boolean) → 지정 라벨");
{
  ok(summarizePatch({ debtorSameAsTrustor: true }).includes("채무자 지정"), "debtorSameAsTrustor=true → 채무자 지정");
  ok(summarizePatch({ debtorSameAsTrustor: false }).includes("채무자 지정"), "debtorSameAsTrustor=false 도 변경 사실 → 채무자 지정");
  ok(summarizePatch({ beneficiarySameAsTrustor: true }).includes("수익자 지정"), "beneficiarySameAsTrustor → 수익자 지정");
  ok(summarizePatch({}).length === 0, "토글 없으면 미표기");
}

console.log("\n[D] common 하위 라벨 + ★계약일 dedup");
{
  const r = summarizePatch({ common: { year: 2026, month: 6, day: 21, trustFee: "500000", priorityRatio: 120, trustPeriod: "5년" } });
  ok(r.filter((s) => s === "계약일").length === 1, "★year/month/day → 계약일 1개로 dedup");
  ok(r.includes("신탁보수"), "신탁보수");
  ok(r.includes("우선수익한도 비율"), "우선수익한도 비율");
  ok(r.includes("신탁기간"), "신탁기간");
  ok(summarizePatch({ common: { priorityLimit: "12000000000" } }).includes("우선수익한도"), "priorityLimit → 우선수익한도");
  ok(summarizePatch({ common: { unknownKey: 1 } }).length === 0, "미해당 common 키 무시");
  // 값(금액·연도) 미노출
  ok(!r.some((s) => /500000|2026|120/.test(s)), "★common 라벨에 값(보수·연도·비율) 미노출");
}

console.log("\n[E] docContents.contract(특약옵션) — 비어있지 않을 때만");
{
  ok(summarizePatch({ docContents: { contract: { majorityCriteria: "twothird" } } }).includes("특약옵션"), "특약옵션(내용 있음)");
  ok(summarizePatch({ docContents: { contract: {} } }).length === 0, "빈 contract 객체 제외");
  ok(summarizePatch({ docContents: {} }).length === 0, "contract 키 부재 제외");
}

console.log("\n[F] 엣지 — 안전·무크래시");
{
  ok(summarizePatch({}).length === 0, "빈 patch → []");
  ok(summarizePatch(null).length === 0, "null → []");
  ok(summarizePatch(undefined).length === 0, "undefined → []");
  ok(summarizePatch("x").length === 0, "비객체(string) → []");
  ok(summarizePatch({ common: [1, 2] }).length === 0, "common 이 배열 → 무시(무크래시)");
  ok(summarizePatch({ trustors: "notarray" }).length === 0, "trustors 비배열 → 무시");
  ok(Array.isArray(summarizePatch({ trustors: [{ name: "갑" }] })), "항상 배열 반환");
}

console.log("\n[G] ★종합 — 실 파이프라인 patch 요약에 PII 원본 값 누출 0");
{
  // ChatPanel L77 미러: restorePIIDeep 이후의 raw 값으로 toolInputToPatch→normalizePatchIds
  const restored = {
    trustors: [{ name: "ABC개발 주식회사", corpRegNo: "110111-7125720", representativeDirector: "홍길동" }],
    priorities: [{ name: "○○은행", bizNo: "124-81-00998", loanAmount: "12000000000" }],
    properties: [{ address: "서울시 강남구 테헤란로 1", regNo: "1101-2002-300456" }],
    common: { year: 2026, month: 6, day: 21, trustFee: "5000000", priorityRatio: 120 },
    contractOptions: { majorityCriteria: "twothird", agentBank: "○○은행", includeArt21: true, builderName: "truster" },
  };
  const patch = normalizePatchIds(toolInputToPatch(restored));
  const r = summarizePatch(patch);
  ok(r.includes("위탁자 1명") && r.includes("우선수익자 1명") && r.includes("신탁부동산 1건"), "당사자·부동산 항목 요약");
  ok(r.includes("계약일") && r.includes("신탁보수") && r.includes("우선수익한도 비율") && r.includes("특약옵션"), "조건·특약옵션 항목 요약");
  // ★누출 스캔: 요약 문자열 전체에 PII 원본 토막이 단 하나도 없어야 함
  const blob = r.join(" | ");
  const leaks = ["110111", "7125720", "124-81-00998", "ABC개발", "○○은행", "테헤란로", "300456", "12000000000", "5000000", "홍길동", "twothird"];
  const leaked = leaks.filter((s) => blob.includes(s));
  ok(leaked.length === 0, "★요약에 PII/값 원본 미등장(누출 0) — 누출=" + JSON.stringify(leaked));
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
if (fail > 0) process.exit(1);
