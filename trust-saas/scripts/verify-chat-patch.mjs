/* ============================================================
   회귀 가드 — 계약 대화(chat·Pillar 1) 패치 적용 파이프라인
   (toolInputToPatch · normalizePatchIds, src/lib/chat/formSchema.ts)

   배경(AI→법적 폼 다리, 가드 0종이던 핵심 변환 경계):
   계약 대화에서 Claude 가 update_form 도구로 채운 값은 ChatPanel(L76-78)에서
       restorePIIDeep(data.patch, piiMap)
     → toolInputToPatch(restored)        // contractOptions → docContents.contract
     → normalizePatchIds(...)            // corpRegNo/bizNo 전체 → 저장 필드 분리
     → mergeFormPatch(patch)             // deepMerge + recalc
   순으로 적용된다. 두 순수 함수는 **AI 가 제안한 값이 법적 서류 폼에 도달하는
   유일한 변환 지점**인데 회귀 가드가 전무했다. 여기가 깨지면 (a)별첨4 특약 4요소
   (contractOptions)가 docContents.contract 로 라우팅되지 못해 **조용히 유실**되고,
   (b)법인등록번호·사업자등록번호가 저장 필드(corpRegFront/Back, bizP1/2/3)로
   분리되지 못해 빌더·검증 게이트가 읽는 형태와 어긋난다. 현 코드는 정상 —
   본 가드로 그 불변식을 고정한다(테스트 전용, 조문·엔진·산출물 무접촉).

   핵심 불변식:
     - toolInputToPatch: contractOptions 존재 시 → docContents.contract 로 이동
       (값 무변형·참조 보존)·contractOptions 키 제거. 없으면 무변형 통과.
       원본 input 최상위 무변형(얕은 복사라 input.contractOptions 잔존).
     - normalizePatchIds: 4역할(trustors/debtors/beneficiaries/priorities) 배열의
       각 당사자에서 corpRegNo(string) → corpRegFront/corpRegBack + 키 제거,
       bizNo(string) → bizP1/bizP2/bizP3 + 키 제거(대시 유무 무관).
       파싱 불가·비문자열·미해당 역할(properties)·비배열 값은 현 동작 보존.
     - ★통합: normalizePatchIds(toolInputToPatch(x)) 가 ChatPanel L77 과 동일 결과.

   단언:
     (A) toolInputToPatch — contractOptions → docContents.contract·키 제거·값 참조 보존
     (B) toolInputToPatch — contractOptions 없으면 무변형(다른 키 전부 통과)
     (C) toolInputToPatch — 원본 input 최상위 무변형(input.contractOptions 잔존)
     (D) normalizePatchIds — corpRegNo(대시 유/무) → front/back 분리·키 제거
     (E) normalizePatchIds — bizNo(대시 유/무) → p1/p2/p3 분리·키 제거
     (F) normalizePatchIds — 기타 당사자 필드 보존·미해당 역할/비배열/다중 당사자
     (G) normalizePatchIds — 파싱 불가·비문자열 → 현 동작 보존(키 처리·미설정)
     (H) ★통합 파이프라인 — toolInputToPatch→normalizePatchIds end-to-end(L77 미러)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-chat-patch.mjs
   ============================================================ */
import { toolInputToPatch, normalizePatchIds } from "../src/lib/chat/formSchema.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

console.log("\n[A] toolInputToPatch — contractOptions → docContents.contract·키 제거·값 참조 보존");
{
  const opts = { majorityCriteria: "twothird", agentBank: "○○은행", includeArt21: true, builderName: "truster" };
  const patch = toolInputToPatch({ contractOptions: opts, trustors: [{ name: "ABC개발" }] });
  ok(!("contractOptions" in patch), "contractOptions 키 제거");
  ok(patch.docContents && typeof patch.docContents === "object", "docContents 생성");
  ok(patch.docContents.contract === opts, "★docContents.contract = contractOptions 값(참조 보존·무변형)");
  ok(patch.docContents.contract.majorityCriteria === "twothird" && patch.docContents.contract.agentBank === "○○은행", "특약 4요소 값 보존");
  ok(Array.isArray(patch.trustors) && patch.trustors[0].name === "ABC개발", "동반 키(trustors) 함께 통과");
}

console.log("\n[B] toolInputToPatch — contractOptions 없으면 무변형(다른 키 전부 통과)");
{
  const input = {
    trustors: [{ name: "갑" }],
    debtorSameAsTrustor: true,
    properties: [{ address: "서울", regNo: "1101-2002-300456" }],
    common: { year: 2026, month: 6, priorityRatio: 120 },
  };
  const patch = toolInputToPatch(input);
  ok(!("docContents" in patch), "contractOptions 없으면 docContents 미생성");
  ok(patch.debtorSameAsTrustor === true, "boolean 키 통과");
  ok(patch.common.priorityRatio === 120 && patch.common.year === 2026, "common 객체 통과");
  ok(patch.properties[0].regNo === "1101-2002-300456", "properties 통과");
  // 얕은 복사라 최상위는 새 객체(같은 내용)
  ok(patch !== input, "반환 patch 는 새 객체(얕은 복사)");
}

console.log("\n[C] toolInputToPatch — 원본 input 최상위 무변형");
{
  const opts = { majorityCriteria: "half" };
  const input = { contractOptions: opts, trustors: [{ name: "갑" }] };
  toolInputToPatch(input);
  ok("contractOptions" in input, "원본 input.contractOptions 잔존(원본 미변형)");
  ok(input.contractOptions === opts, "원본 contractOptions 값 무변형");
}

console.log("\n[D] normalizePatchIds — corpRegNo(대시 유/무) → corpRegFront/corpRegBack·키 제거");
{
  // 대시 있음
  let p = normalizePatchIds({ trustors: [{ name: "ABC개발", type: "법인", corpRegNo: "110111-7125720" }] });
  let t = p.trustors[0];
  ok(t.corpRegFront === "110111" && t.corpRegBack === "7125720", "대시 corpRegNo 분리(110111 / 7125720)");
  ok(!("corpRegNo" in t), "corpRegNo 키 제거");
  ok(t.name === "ABC개발" && t.type === "법인", "기타 필드(name·type) 보존");
  // 대시 없음(13자리 연속)
  p = normalizePatchIds({ priorities: [{ name: "○○은행", corpRegNo: "1101117125720" }] });
  t = p.priorities[0];
  ok(t.corpRegFront === "110111" && t.corpRegBack === "7125720", "무대시 corpRegNo 분리");
  ok(!("corpRegNo" in t), "무대시도 corpRegNo 키 제거");
  // 주변 텍스트 포함(restorePIIDeep 후 잔여 라벨 등) → 숫자만 추출
  p = normalizePatchIds({ debtors: [{ corpRegNo: "법인등록번호 110111-7125720 입니다" }] });
  ok(p.debtors[0].corpRegFront === "110111" && p.debtors[0].corpRegBack === "7125720", "텍스트 내 corpRegNo 숫자 추출");
}

console.log("\n[E] normalizePatchIds — bizNo(대시 유/무) → bizP1/bizP2/bizP3·키 제거");
{
  let p = normalizePatchIds({ trustors: [{ name: "갑상사", bizNo: "124-81-00998" }] });
  let t = p.trustors[0];
  ok(t.bizP1 === "124" && t.bizP2 === "81" && t.bizP3 === "00998", "대시 bizNo 분리(124/81/00998)");
  ok(!("bizNo" in t), "bizNo 키 제거");
  ok(t.name === "갑상사", "기타 필드(name) 보존");
  // 무대시 10자리
  p = normalizePatchIds({ beneficiaries: [{ bizNo: "1248100998" }] });
  ok(p.beneficiaries[0].bizP1 === "124" && p.beneficiaries[0].bizP2 === "81" && p.beneficiaries[0].bizP3 === "00998", "무대시 bizNo 분리");
  // corpRegNo + bizNo 동시(개인사업자 보유 법인 등)
  p = normalizePatchIds({ trustors: [{ corpRegNo: "110111-7125720", bizNo: "124-81-00998" }] });
  t = p.trustors[0];
  ok(t.corpRegFront === "110111" && t.bizP1 === "124" && !("corpRegNo" in t) && !("bizNo" in t), "corpRegNo+bizNo 동시 분리·둘 다 키 제거");
}

console.log("\n[F] normalizePatchIds — 기타 필드 보존·미해당 역할·비배열·다중 당사자");
{
  // properties 는 roles 에 없음 → 무접촉(regNo 는 부동산 등기번호라 분리 대상 아님)
  let p = normalizePatchIds({ properties: [{ address: "서울", regNo: "1101-2002-300456" }] });
  ok(p.properties[0].regNo === "1101-2002-300456" && !("bizP1" in p.properties[0]), "properties 무접촉(부동산 regNo 분리 안 함)");
  // 비배열 role 값 → continue(무크래시·무변형)
  p = normalizePatchIds({ trustors: "x", debtors: undefined, beneficiaries: null });
  ok(p.trustors === "x", "비배열 trustors(문자열) 무변형·무크래시");
  ok(p.debtors === undefined && p.beneficiaries === null, "undefined·null role 무크래시");
  // 식별번호 없는 당사자 → 그대로 보존
  p = normalizePatchIds({ priorities: [{ name: "신한은행", loanAmount: "5000000000", securedClaim: "여신거래" }] });
  ok(p.priorities[0].name === "신한은행" && p.priorities[0].loanAmount === "5000000000" && p.priorities[0].securedClaim === "여신거래", "식별번호 없는 당사자 전 필드 보존");
  // 다중 당사자 각자 독립 정규화
  p = normalizePatchIds({ priorities: [
    { name: "국민은행", bizNo: "124-81-00998" },
    { name: "신한은행", corpRegNo: "110111-7125720" },
  ] });
  ok(p.priorities[0].bizP1 === "124" && !("corpRegFront" in p.priorities[0]), "당사자1 bizNo 만 분리");
  ok(p.priorities[1].corpRegFront === "110111" && !("bizP1" in p.priorities[1]), "당사자2 corpRegNo 만 분리");
}

console.log("\n[G] normalizePatchIds — 파싱 불가·비문자열 → 현 동작 보존");
{
  // 파싱 불가 corpRegNo(자릿수 부족) → 키는 제거하되 front/back 미설정(저장소 미인식 필드 잔류 방지)
  let p = normalizePatchIds({ trustors: [{ name: "갑", corpRegNo: "abc-123" }] });
  let t = p.trustors[0];
  ok(!("corpRegNo" in t), "파싱 불가 corpRegNo 키 제거(잔류 방지)");
  ok(!("corpRegFront" in t) && !("corpRegBack" in t), "파싱 불가 시 분할 필드 미설정");
  // 파싱 불가 bizNo(부분 입력) → 동일
  p = normalizePatchIds({ trustors: [{ bizNo: "124-81" }] });
  ok(!("bizNo" in p.trustors[0]) && !("bizP1" in p.trustors[0]), "부분 bizNo 키 제거·분할 미설정");
  // 비문자열 corpRegNo(number) → typeof 가드로 무접촉(키 유지)
  p = normalizePatchIds({ trustors: [{ corpRegNo: 1101117125720 }] });
  ok(p.trustors[0].corpRegNo === 1101117125720, "비문자열 corpRegNo 무접촉(키 유지)");
  // 빈 객체 당사자 → 무크래시·무변형
  p = normalizePatchIds({ trustors: [{}] });
  ok(typeof p.trustors[0] === "object" && Object.keys(p.trustors[0]).length === 0, "빈 당사자 객체 무크래시");
}

console.log("\n[H] ★통합 파이프라인 — toolInputToPatch → normalizePatchIds (ChatPanel L77 미러)");
{
  // 실제 update_form 도구 입력 형태(restorePIIDeep 후 전체 값) → 두 변환 연쇄
  const restored = {
    trustors: [{ name: "ABC개발 주식회사", type: "법인", corpRegNo: "110111-7125720", representativeDirector: "홍길동" }],
    priorities: [{ name: "국민은행", bizNo: "124-81-00998", loanAmount: "12000000000" }],
    properties: [{ address: "서울시 강남구", regNo: "1101-2002-300456" }],
    common: { year: 2026, month: 6, day: "", priorityRatio: 120 },
    contractOptions: { majorityCriteria: "twothird", agentBank: "국민은행", includeArt21: true, builderName: "truster" },
  };
  const patch = normalizePatchIds(toolInputToPatch(restored));
  // contractOptions 라우팅
  ok(!("contractOptions" in patch) && patch.docContents.contract.majorityCriteria === "twothird", "특약옵션 → docContents.contract 라우팅");
  // 위탁자 법인등록번호 분리 + 기타 필드 보존
  ok(patch.trustors[0].corpRegFront === "110111" && patch.trustors[0].corpRegBack === "7125720" && !("corpRegNo" in patch.trustors[0]), "위탁자 corpRegNo 분리");
  ok(patch.trustors[0].name === "ABC개발 주식회사" && patch.trustors[0].representativeDirector === "홍길동", "위탁자 name·대표이사 보존");
  // 우선수익자 사업자번호 분리 + 대출금액 보존
  ok(patch.priorities[0].bizP1 === "124" && patch.priorities[0].bizP2 === "81" && patch.priorities[0].bizP3 === "00998", "우선수익자 bizNo 분리");
  ok(patch.priorities[0].loanAmount === "12000000000" && !("bizNo" in patch.priorities[0]), "우선수익자 대출금액 보존·bizNo 제거");
  // 부동산·common 무접촉 통과
  ok(patch.properties[0].regNo === "1101-2002-300456" && patch.properties[0].address === "서울시 강남구", "부동산(regNo 미분리) 통과");
  ok(patch.common.year === 2026 && patch.common.priorityRatio === 120 && patch.common.day === "", "common 통과(day 빈 문자열 보존)");
  // 최종 patch 에 store 미인식 잔여 키(corpRegNo·bizNo·contractOptions) 0
  const hasLeftover = JSON.stringify(patch).includes("corpRegNo") || JSON.stringify(patch).includes("\"bizNo\"") || JSON.stringify(patch).includes("contractOptions");
  ok(!hasLeftover, "★최종 patch 에 store 미인식 잔여 키(corpRegNo·bizNo·contractOptions) 0");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
if (fail > 0) process.exit(1);
