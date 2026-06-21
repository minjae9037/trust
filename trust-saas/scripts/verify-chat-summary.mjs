/* ============================================================
   회귀 가드 — 계약 대화(chat·Pillar 1) 폼 요약 PII 마스킹
   (summarizeForm, src/lib/chat/formSchema.ts)

   배경(폼 컨텍스트 → Claude 전송의 유일한 PII 마스킹 경계, 가드 0종):
   ChatPanel(L58)은 매 대화 요청마다 `formSummary: summarizeForm(form)` 을
   /api/chat 으로 보낸다. 여기서 `form` 은 contractStore 의 **실데이터**(법인등록번호
   앞/뒤·사업자번호·신탁부동산 소재지·신탁보수 원본 값이 모두 들어있음)다.
   사용자가 대화창에 직접 친 raw 텍스트는 tokenizePII 로 토큰화 후 보내지만,
   폼 컨텍스트는 그 경로를 타지 않으므로 **summarizeForm 이 곧 폼측 PII 경계**다.
   이 함수가 식별번호·소재지·보수액 원본 값을 요약에 흘리면 무인증 공개
   엔드포인트(/api/chat)를 통해 Claude 로 평문 식별정보가 전송된다(CLAUDE.md 원칙 3).

   현 동작(의도된 마스킹 정책 — 본 가드로 고정):
     · 마스킹(숨김): 법인등록번호(corpRegFront/Back) → "입력됨/미입력",
       사업자등록번호(bizP1/2/3) → 요약에 아예 미포함,
       신탁부동산 소재지(property.address)·등기번호(regNo) → 건수만(원본 미포함),
       신탁보수(trustFee) → "입력됨/미입력".
     · 표시(의도적 비마스킹 — 대화 진행에 필요): 당사자 name(법인명/성명)·대표이사·
       우선수익자 대출금액(toLocaleString)·우선수익한도(자동 산정)·계약일·비율.
   ※ 정책 변경(예: 식별번호 노출)이 "개선"으로 잘못 들어오는 회귀를 차단한다.
   현 코드는 정상 — 불변식 고정만(formSchema.ts 무변경·앱 소스·조문·엔진·산출물 무접촉).

   단언:
     (A) 빈 폼 — 무크래시·기본 구조(위탁자1·채무자=위탁자동일·우선수익자1·부동산0건)
     (B) ★법인등록번호 마스킹 — corpRegFront 채움→"입력됨"/빔→"미입력",
         원본 앞6·뒤7자리 숫자 요약 미등장
     (C) ★신탁부동산 소재지·등기번호 비노출 — 건수만, address·regNo 문자열 미등장
     (D) ★신탁보수 마스킹 — 값 채움→"입력됨"/빔→"미입력", 원본 금액 미등장
     (E) ★사업자등록번호(bizP1/2/3) 전면 비노출 — 채워도 요약에 미등장
     (F) 구조·카운트 — 위탁자/우선수익자 N명·채무자/수익자 별도 분기·부동산 건수
         (address 있는 것만)·대출금액 toLocaleString·우선수익한도 표시
     (G) 당사자 name·대표이사 표시(의도된 비마스킹 — 현 동작 보존)
     (H) ★종합 누출 스캔 — 실 PII 가득 채운 폼 요약에 식별번호·소재지·regNo·보수
         원본 값 전부 미등장(단일 종합 단언)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-chat-summary.mjs
   ============================================================ */
import { blankContractForm, blankParty, blankProperty } from "../src/lib/engine/model.ts";
import { summarizeForm } from "../src/lib/chat/formSchema.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

console.log("\n[A] 빈 폼 — 무크래시·기본 구조");
{
  const s = summarizeForm(blankContractForm());
  ok(typeof s === "string" && s.length > 0, "문자열 반환(무크래시)");
  ok(s.includes("■ 위탁자 1명"), "위탁자 1명");
  ok(s.includes("(이름 미입력)"), "빈 당사자 이름 → (이름 미입력)");
  ok(s.includes("■ 채무자: 위탁자와 동일"), "채무자 위탁자와 동일(기본)");
  ok(s.includes("■ 수익자: 위탁자와 동일"), "수익자 위탁자와 동일(기본)");
  ok(s.includes("■ 우선수익자 1명"), "우선수익자 1명");
  ok(s.includes("■ 신탁부동산 0건"), "빈 소재지 → 0건");
  ok(s.includes("신탁보수 미입력"), "빈 신탁보수 → 미입력");
  ok(s.includes("법인등록번호:미입력"), "빈 법인등록번호 → 미입력");
}

console.log("\n[B] ★법인등록번호 마스킹 — 원본 숫자 미등장");
{
  const f = blankContractForm();
  f.trustors = [{ ...blankParty(), name: "ABC개발", type: "법인", corpRegFront: "110111", corpRegBack: "7125720" }];
  const s = summarizeForm(f);
  ok(s.includes("법인등록번호:입력됨"), "corpRegFront 채움 → 입력됨");
  ok(!s.includes("110111"), "★원본 앞6자리(110111) 미등장");
  ok(!s.includes("7125720"), "★원본 뒤7자리(7125720) 미등장");
  // corpRegFront 비우면 미입력(corpRegBack 만 있어도 corpRegFront 기준 판정)
  const f2 = blankContractForm();
  f2.trustors = [{ ...blankParty(), name: "갑", corpRegFront: "", corpRegBack: "7125720" }];
  const s2 = summarizeForm(f2);
  ok(s2.includes("법인등록번호:미입력"), "corpRegFront 빔 → 미입력(corpRegFront 기준)");
  ok(!s2.includes("7125720"), "★corpRegBack 만 있어도 원본 미등장");
}

console.log("\n[C] ★신탁부동산 소재지·등기번호 비노출 — 건수만");
{
  const f = blankContractForm();
  f.properties = [
    { ...blankProperty(), address: "서울특별시 강남구 테헤란로 123", regNo: "1101-2002-300456" },
    { ...blankProperty(), address: "부산광역시 해운대구 우동" },
    { ...blankProperty(), address: "" }, // 빈 소재지는 카운트 제외
  ];
  const s = summarizeForm(f);
  ok(s.includes("■ 신탁부동산 2건"), "address 있는 2건만 카운트(빈 소재지 제외)");
  ok(!s.includes("강남구") && !s.includes("테헤란로"), "★소재지1 문자열 미등장");
  ok(!s.includes("해운대구") && !s.includes("부산"), "★소재지2 문자열 미등장");
  ok(!s.includes("1101-2002-300456") && !s.includes("300456"), "★등기 고유번호 미등장");
}

console.log("\n[D] ★신탁보수 마스킹 — 원본 금액 미등장");
{
  const f = blankContractForm();
  f.common.trustFee = "55000000";
  const s = summarizeForm(f);
  ok(s.includes("신탁보수 입력됨"), "trustFee 채움 → 입력됨");
  ok(!s.includes("55000000") && !s.includes("55,000,000"), "★원본 보수액(raw·콤마) 미등장");
  // 빈 값
  const f2 = blankContractForm();
  f2.common.trustFee = "";
  ok(summarizeForm(f2).includes("신탁보수 미입력"), "빈 trustFee → 미입력");
}

console.log("\n[E] ★사업자등록번호(bizP1/2/3) 전면 비노출");
{
  const f = blankContractForm();
  f.trustors = [{ ...blankParty(), name: "갑상사", bizP1: "124", bizP2: "81", bizP3: "00998" }];
  f.priorities = [{ ...blankParty(), name: "국민은행", bizP1: "211", bizP2: "86", bizP3: "12345" }];
  const s = summarizeForm(f);
  ok(!s.includes("00998") && !s.includes("124-81") && !s.includes("12481"), "★위탁자 사업자번호 미등장");
  ok(!s.includes("12345") && !s.includes("211-86"), "★우선수익자 사업자번호 미등장");
  // 사업자번호만 채운 당사자도 정상 렌더(이름은 보임)
  ok(s.includes("갑상사") && s.includes("국민은행"), "당사자 자체는 정상 렌더(이름 표시)");
}

console.log("\n[F] 구조·카운트·금액 표시(의도된 표시)");
{
  const f = blankContractForm();
  f.trustors = [blankParty(), blankParty()];
  f.debtorSameAsTrustor = false;
  f.debtors = [blankParty(), blankParty(), blankParty()];
  f.beneficiarySameAsTrustor = false;
  f.beneficiaries = [blankParty()];
  f.priorities = [
    { ...blankParty(), name: "국민은행", loanAmount: "12000000000" },
    { ...blankParty(), name: "신한은행", loanAmount: "5000000000" },
  ];
  f.common.priorityLimit = "14400000000";
  const s = summarizeForm(f);
  ok(s.includes("■ 위탁자 2명"), "위탁자 2명 카운트");
  ok(s.includes("■ 채무자: 3명 별도"), "채무자 별도 → N명 별도");
  ok(s.includes("■ 수익자: 1명 별도"), "수익자 별도 → N명 별도");
  ok(s.includes("■ 우선수익자 2명"), "우선수익자 2명 카운트");
  ok(s.includes("대출금액:12,000,000,000원"), "대출금액 toLocaleString(의도된 표시)");
  ok(s.includes("우선수익한도 14,400,000,000원(자동)"), "우선수익한도 표시(의도된 표시)");
}

console.log("\n[G] 당사자 name·대표이사 표시(의도된 비마스킹 — 현 동작 보존)");
{
  const f = blankContractForm();
  f.trustors = [{ ...blankParty(), name: "ABC개발 주식회사", representativeDirector: "홍길동" }];
  const s = summarizeForm(f);
  ok(s.includes("ABC개발 주식회사"), "법인명(name) 표시 — 대화 진행용 의도적 노출");
  ok(s.includes("대표이사:홍길동"), "대표이사 표시 — 의도적 노출");
  // 대표이사 빈 값 → 미입력
  const f2 = blankContractForm();
  f2.trustors = [{ ...blankParty(), name: "갑", representativeDirector: "" }];
  ok(summarizeForm(f2).includes("대표이사:미입력"), "빈 대표이사 → 미입력");
}

console.log("\n[H] ★종합 누출 스캔 — 실 PII 가득 폼 요약에 원본 식별정보 전부 미등장");
{
  const f = blankContractForm();
  f.trustors = [{
    ...blankParty(), name: "ABC개발 주식회사", type: "법인",
    corpRegFront: "110111", corpRegBack: "7125720",
    bizP1: "124", bizP2: "81", bizP3: "00998", representativeDirector: "홍길동",
  }];
  f.debtorSameAsTrustor = false;
  f.debtors = [{ ...blankParty(), name: "채무법인", corpRegFront: "220222", corpRegBack: "3334445", bizP1: "555", bizP2: "66", bizP3: "77788" }];
  f.priorities = [{ ...blankParty(), name: "국민은행", bizP1: "211", bizP2: "86", bizP3: "12345", loanAmount: "12000000000" }];
  f.properties = [{ ...blankProperty(), address: "서울특별시 강남구 테헤란로 123", regNo: "1101-2002-300456", category: "대", area: "330.5" }];
  f.common.trustFee = "55000000";
  const s = summarizeForm(f);
  // 원본 식별정보 토막들 — 단 하나라도 등장하면 누출
  const leakTokens = [
    "110111", "7125720", "220222", "3334445",        // 법인등록번호
    "00998", "77788", "12345", "124-81", "12481",     // 사업자등록번호
    "테헤란로", "강남구", "1101-2002-300456", "300456", // 소재지·등기번호
    "55000000", "55,000,000",                          // 신탁보수
  ];
  const leaked = leakTokens.filter((t) => s.includes(t));
  ok(leaked.length === 0, "★식별번호·소재지·등기번호·보수 원본 값 누출 0 (누출=" + JSON.stringify(leaked) + ")");
  // 마스킹 라벨·의도된 표시는 정상
  ok(s.includes("법인등록번호:입력됨") && s.includes("신탁보수 입력됨"), "마스킹 라벨 정상(입력됨)");
  ok(s.includes("ABC개발 주식회사") && s.includes("대출금액:12,000,000,000원"), "의도된 표시(이름·대출금액) 정상");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
if (fail > 0) process.exit(1);
