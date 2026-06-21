/* ============================================================
   회귀 가드 — 계약 대화(chat·Pillar 1) PII 토큰화·복원 라운드트립
   (tokenizePII / restorePII / restorePIIDeep / extractIdentifiers,
    src/lib/privacy/tokenize.ts)

   배경(사용자 raw 입력 → Claude 전송의 유일한 PII 토큰화 경계, 가드 0종):
   ChatPanel(L43)은 매 전송 직전 사용자가 대화창에 친 raw 텍스트를
   `tokenizePII(raw, piiMap.current)` 로 토큰화해 /api/chat(무인증 공개 POST)으로
   보낸다(L58 폼 컨텍스트는 summarizeForm 이 별도 마스킹 — chat-summary 가드가 고정).
   매핑(token→원본)은 piiMap.current(useRef)로 **클라이언트에만** 남고,
   응답(L69 restorePII)·패치(L76 restorePIIDeep)에서 역치환된다.
   즉 이 4개 순수 함수가 곧 "사용자 입력측 PII 경계"이자 "대화 표시·폼 반영의
   복원 다리"인데 회귀 가드가 전무했다(요약 측 summarizeForm·패치 측
   toolInputToPatch·요청 측 parseChatBody·오류 측 friendlyErrorMessage 는 모두
   가드화됨 — 이 토큰화/복원 라운드트립만 미커버).
   여기가 깨지면 ①토큰화 누락 시 평문 식별번호가 Claude 로 전송(CLAUDE.md 원칙 3
   가드레일 위반), ②복원 누락/오류 시 화면·폼에 `[법인등록번호_1]` 같은 토큰이
   그대로 남아 법적 서류 데이터를 오염시킨다.
   현 코드는 정상 — 불변식 고정만(tokenize.ts 무변경·앱 소스·조문·엔진·산출물 무접촉).

   현 동작(의도된 정책 — 본 가드로 고정):
     · 토큰화 대상 4종(고민감 식별자): 법인등록번호(\d{6}-\d{7})·
       사업자등록번호(\d{3}-\d{2}-\d{5})·주민등록번호(\d{6}-[1-4]\d{6})·
       등기고유번호(\d{4}-\d{4}-\d{6}).
     · ★패턴 적용은 배열 순서대로 — 법인등록번호 패턴(\d{6}-\d{7})이 먼저 돌아
       주민등록번호 형태(\d{6}-[1-4]\d{6}, 이 역시 6-7자리)도 법인등록번호로
       라벨링된다. 라벨은 표시용일 뿐 — 어느 라벨이든 **토큰화(마스킹)는 동일하게
       일어나 원본 숫자는 전송문에 남지 않는다**(보안 불변식은 라벨 무관 유지).
     · 토큰 번호(counter)는 기존 map 크기에서 시작, **동일 값=동일 토큰** 재사용
       (한 대화 내 누적). 토큰 형식 `[라벨_N]`.
     · restorePII/restorePIIDeep 는 토큰을 원본으로 정확히 역치환(라운드트립 항등),
       비문자열(숫자·불리언·null)·중첩 구조 보존.
     · extractIdentifiers 는 토큰화로 Claude 가 못 보는 식별자를 클라이언트가 직접
       폼에 채우도록 raw 에서 결정론적으로 추출(corpReg·bizNo·regNo).
   ※ "토큰화 누락"·"복원 미적용"·"식별번호 평문 전송"이 회귀로 들어오는 것을 차단.

   단언:
     (A) tokenizePII 기본 — 4종 각각 토큰화·map 기록·원본 미등장·토큰 형식
     (B) ★라운드트립 항등 — restorePII(tokenizePII(t).text, map) === t (4종+혼합)
     (C) 동일 값=동일 토큰·누적 — 같은 값 재사용·기존 map counter 연속·교차 호출
     (D) ★전송문 누출 0 — 토큰화 텍스트에 원본 식별번호 숫자 미등장(다수 PII 한 문장)
     (E) restorePIIDeep — 중첩 객체·배열 문자열 복원·비문자열/구조 보존·라운드트립
     (F) extractIdentifiers — corpReg·bizNo·regNo 추출·부재 시 미설정·텍스트 내 추출
     (G) 현 동작(엣지) — 주민번호형→법인등록번호 라벨(순서 의존)이나 마스킹은 유지·
         매치 없으면 무변형·빈 문자열·복원 무토큰 무변형
     (H) ★ChatPanel 경계 종합 — 전송(토큰화)→응답 복원→패치 복원 end-to-end
         (전송문 누출 0 + 화면/폼에 잔여 토큰 0)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-chat-tokenize.mjs
   ============================================================ */
import {
  tokenizePII,
  restorePII,
  restorePIIDeep,
  extractIdentifiers,
} from "../src/lib/privacy/tokenize.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

// 토큰 형식 `[라벨_N]` 검사기
const TOKEN_RE = /\[(법인등록번호|사업자등록번호|주민등록번호|등기고유번호)_\d+\]/;

console.log("\n[A] tokenizePII 기본 — 4종 토큰화·map 기록·원본 미등장");
{
  // 법인등록번호
  const r = tokenizePII("법인 110111-7125720 입니다");
  ok(!r.text.includes("110111-7125720"), "법인등록번호 원본 미등장");
  ok(TOKEN_RE.test(r.text), "토큰 형식 [라벨_N] 치환");
  ok(Object.values(r.map).includes("110111-7125720"), "map 에 원본 값 기록");
  ok(Object.keys(r.map).every((k) => TOKEN_RE.test(k)), "map 키는 모두 토큰 형식");

  // 사업자등록번호
  const b = tokenizePII("사업자 124-81-00998");
  ok(!b.text.includes("124-81-00998") && b.text.includes("[사업자등록번호_"), "사업자등록번호 토큰화");

  // 등기고유번호
  const g = tokenizePII("등기 1101-2002-300456");
  ok(!g.text.includes("1101-2002-300456") && g.text.includes("[등기고유번호_"), "등기고유번호 토큰화");

  // 토큰 번호는 기존 map 크기에서 시작(빈 map → _1)
  const first = Object.keys(tokenizePII("x 110111-7125720").map)[0];
  ok(first === "[법인등록번호_1]", "빈 map → 첫 토큰 _1");
}

console.log("\n[B] ★라운드트립 항등 — restorePII(tokenize(t)) === t");
{
  const cases = [
    "법인 110111-7125720 끝",
    "사업자 124-81-00998 끝",
    "주민 901201-1234567 끝",            // ※ 법인등록번호 패턴에 먼저 매칭(순서 의존)
    "등기 1101-2002-300456 끝",
    "법인 110111-7125720 / 사업 124-81-00998 / 등기 1101-2002-300456 혼합",
    "PII 없는 순수 텍스트 1234 5678",     // 무토큰도 항등
  ];
  for (const t of cases) {
    const { text, map } = tokenizePII(t);
    ok(restorePII(text, map) === t, "라운드트립 항등: " + t.slice(0, 18) + "…");
  }
  // 같은 값 다회 등장 → 같은 토큰 1개로 치환되어도 복원은 모두 원복
  const dup = "갑 110111-7125720, 을도 110111-7125720";
  const rt = tokenizePII(dup);
  ok(Object.keys(rt.map).length === 1, "동일 값 2회 → map 토큰 1개");
  ok(restorePII(rt.text, rt.map) === dup, "동일 값 다회 등장도 라운드트립 항등");
}

console.log("\n[C] 동일 값=동일 토큰·누적(기존 map counter 연속·교차 호출)");
{
  const map = {};
  const a = tokenizePII("값 110111-7125720", map);
  const tokA = Object.keys(a.map)[0];
  const b = tokenizePII("또 110111-7125720 그리고 124-81-00998", a.map);
  ok(b.text.includes(tokA), "★기존 값 → 동일 토큰 재사용(같은 토큰 등장)");
  ok(Object.keys(b.map).length === 2, "신규 값만 추가(누적 토큰 2개)");
  // counter 는 map 크기에서 이어짐 → 두 번째 신규는 _2
  ok(b.map["[사업자등록번호_2]"] === "124-81-00998", "★counter 연속(_2) — map 크기 기반");
  ok(restorePII(b.text, b.map) === "또 110111-7125720 그리고 124-81-00998", "누적 map 으로 복원 항등");
  // tokenizePII 는 전달한 map 을 in-place 누적(반환 map === 인자 map)
  ok(b.map === a.map && a.map === map, "전달 map in-place 누적(동일 참조)");
}

console.log("\n[D] ★전송문 누출 0 — 다수 PII 한 문장 토큰화 후 원본 숫자 전무");
{
  const raw =
    "위탁자 법인 110111-7125720, 사업자 124-81-00998, 채무자 주민 901201-1234567, 부동산 등기 1101-2002-300456";
  const { text } = tokenizePII(raw);
  const leakTokens = ["110111-7125720", "124-81-00998", "901201-1234567", "1101-2002-300456"];
  const leaked = leakTokens.filter((t) => text.includes(t));
  ok(leaked.length === 0, "★4종 식별번호 원본 전송문 누출 0 (누출=" + JSON.stringify(leaked) + ")");
  // 토큰만 남음(원본 숫자열 4개가 모두 토큰으로 대체)
  const tokenCount = (text.match(/\[[^\]]+_\d+\]/g) || []).length;
  ok(tokenCount === 4, "원본 4종 → 토큰 4개 치환");
}

console.log("\n[E] restorePIIDeep — 중첩 객체·배열 복원·비문자열/구조 보존");
{
  const map = {};
  tokenizePII("110111-7125720", map);          // [법인등록번호_1]
  tokenizePII("124-81-00998", map);             // [사업자등록번호_2]
  const T1 = "[법인등록번호_1]";
  const T2 = "[사업자등록번호_2]";

  const patch = {
    common: { corpRegFull: "토큰 " + T1 + " 끝", note: "변경 없음" },
    list: [T2, 5, true, null, "중첩 " + T1],
    count: 3,
    flag: false,
  };
  const out = restorePIIDeep(patch, map);
  ok(out.common.corpRegFull === "토큰 110111-7125720 끝", "중첩 객체 문자열 토큰 복원");
  ok(out.common.note === "변경 없음", "토큰 없는 문자열 무변형");
  ok(out.list[0] === "124-81-00998", "배열 내 토큰 복원");
  ok(out.list[1] === 5 && out.list[2] === true && out.list[3] === null, "★비문자열(숫자·불리언·null) 보존");
  ok(out.list[4] === "중첩 110111-7125720", "배열 내 임베드 토큰 복원");
  ok(out.count === 3 && out.flag === false, "최상위 비문자열 보존");
  ok(Array.isArray(out.list) && out.list.length === 5, "배열 구조·길이 보존");
  // 라운드트립: 토큰화된 깊은 객체를 복원하면 원본과 동치
  ok(restorePIIDeep(T1, map) === "110111-7125720", "스칼라 문자열 복원");
  ok(restorePIIDeep(42, map) === 42, "스칼라 비문자열 그대로 반환");
}

console.log("\n[F] extractIdentifiers — 결정론적 식별자 추출");
{
  const e = extractIdentifiers("법인 110111-7125720, 사업 124-81-00998, 등기 1101-2002-300456");
  ok(e.corpReg && e.corpReg.front === "110111" && e.corpReg.back === "7125720", "corpReg front/back 분리 추출");
  ok(e.bizNo && e.bizNo.p1 === "124" && e.bizNo.p2 === "81" && e.bizNo.p3 === "00998", "bizNo p1/p2/p3 분리 추출");
  ok(e.regNo === "1101-2002-300456", "regNo 추출");

  const none = extractIdentifiers("아무 식별번호도 없는 문장");
  ok(none.corpReg === undefined && none.bizNo === undefined && none.regNo === undefined, "부재 시 전부 미설정");

  // 텍스트 한가운데서도 추출(문장 내 임베드)
  const mid = extractIdentifiers("…우리 회사 사업자번호는 124-81-00998 이고요…");
  ok(mid.bizNo && mid.bizNo.p3 === "00998", "문장 중간 임베드 식별자 추출");
  // 부분 입력은 미추출(자릿수 미달)
  const partial = extractIdentifiers("사업 12-3 등기 1101-2002");
  ok(partial.bizNo === undefined && partial.regNo === undefined, "부분/자릿수 미달 입력은 미추출");
}

console.log("\n[G] 현 동작(엣지) — 순서 의존·무변형·복원 무토큰");
{
  // 주민등록번호 형태가 법인등록번호 패턴에 먼저 매칭(배열 순서)되나 마스킹은 유지
  const rrn = tokenizePII("주민 901201-1234567");
  ok(rrn.text.includes("[법인등록번호_"), "★주민번호형 → 법인등록번호 라벨(패턴 순서 의존)");
  ok(!rrn.text.includes("901201-1234567"), "★라벨과 무관하게 원본 주민번호 마스킹 유지(보안 불변식)");
  ok(restorePII(rrn.text, rrn.map) === "주민 901201-1234567", "라벨 무관 복원 항등");

  // 매치 없으면 무변형·빈 map
  const nm = tokenizePII("순수 텍스트 1234 abc");
  ok(nm.text === "순수 텍스트 1234 abc" && Object.keys(nm.map).length === 0, "매치 없음 → 무변형·빈 map");

  // 빈 문자열
  const empty = tokenizePII("");
  ok(empty.text === "" && Object.keys(empty.map).length === 0, "빈 문자열 → 무크래시·빈 결과");

  // restorePII: 매핑에 없는/빈 map → 무변형
  ok(restorePII("토큰 없는 텍스트", {}) === "토큰 없는 텍스트", "빈 map 복원 → 무변형");
  ok(restorePII("[법인등록번호_9] 미매핑", {}) === "[법인등록번호_9] 미매핑", "미매핑 토큰 → 무변형(복원 대상 아님)");
}

console.log("\n[H] ★ChatPanel 경계 종합 — 전송→응답→패치 복원 end-to-end");
{
  // ChatPanel.send 미러: piiMap 누적 + 토큰화 전송 + 응답/패치 복원
  const piiMap = {};
  const raw = "위탁자 ABC개발, 법인등록번호 110111-7125720, 우선수익자 국민은행 사업자 124-81-00998";
  const { text: sent } = tokenizePII(raw, piiMap);
  // (1) 전송문 누출 0
  ok(!sent.includes("110111-7125720") && !sent.includes("124-81-00998"), "★전송문 평문 식별번호 누출 0");
  // (2) Claude 응답(토큰 포함)의 화면 복원 — restorePII
  const replyTokenized = "네, 법인등록번호 [법인등록번호_1] 와 사업자 [사업자등록번호_2] 확인했습니다.";
  const replyDisplay = restorePII(replyTokenized, piiMap);
  ok(replyDisplay.includes("110111-7125720") && replyDisplay.includes("124-81-00998"), "응답 화면 복원(원본 표시)");
  ok(!TOKEN_RE.test(replyDisplay), "★화면 응답에 잔여 토큰 0");
  // (3) Claude 패치(토큰 포함)의 폼 반영 직전 복원 — restorePIIDeep
  const patchTokenized = {
    trustors: [{ name: "ABC개발", corpRegFull: "[법인등록번호_1]" }],
    priorities: [{ name: "국민은행", bizNoFull: "[사업자등록번호_2]" }],
  };
  const restored = restorePIIDeep(patchTokenized, piiMap);
  ok(restored.trustors[0].corpRegFull === "110111-7125720", "패치 위탁자 식별번호 복원");
  ok(restored.priorities[0].bizNoFull === "124-81-00998", "패치 우선수익자 식별번호 복원");
  const flat = JSON.stringify(restored);
  ok(!TOKEN_RE.test(flat), "★복원 패치에 잔여 토큰 0(폼 오염 방지)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
if (fail > 0) process.exit(1);
