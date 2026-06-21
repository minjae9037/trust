/* ============================================================
   회귀 가드 — 개인 당사자 생년월일(YYMMDD) 실재 날짜 유효성 게이트

   배경(정확성 갭): 개인 당사자의 식별번호 칸은 산출물에 "생년월일"로 렌더된다(builders.js:
   type==="개인"→"생년월일", corpReg=corpRegFront-corpRegBack, 앞 6자리=YYMMDD). 검증 게이트
   (validateDoc)는 — 금액 5종·체결일·비율·사업자등록번호·법인등록번호·등기 고유번호까지 게이트화한
   뒤에도 — 개인 생년월일은 전혀 검사하지 않아, "991332"·"000000" 같은 실재하지 않는 날짜가 법적
   서류에 그대로 박힐 수 있었다(법인=법인등록번호 체크섬과 대칭되는 마지막 식별번호 정합성 갭).
     · PartyCard 입력은 숫자만 허용하지만 "달력 유효성"은 검사하지 않는다.
     · import·구버전 저장본·AI 머지로도 잘못된 날짜가 들어올 수 있다.

   ★정확성 가드레일 — 추정 체크섬 금지:
     주민등록번호 체크섬은 2020.10 이후 임의 부여로 폐지돼 공개 검증식이 존재하지 않는다. 따라서
     등기 고유번호(isValidRegNo)와 동일하게 체크섬을 임의로 만들지 않고(유효한 실제 번호 오탐 방지),
     앞 6자리의 "달력 유효성(YYMMDD)"만 검사한다 — 계약 체결일과 동일한 daysInMonth/isRealDate
     단일 출처 재사용(추정 형식 아닌 달력 규칙). 윤년 2월 29일은 세기(뒤 7자리 첫 자리=국가 표준
     세기·성별 코드: 1·2·5·6→1900s, 3·4·7·8→2000s, 9·0→1800s)로 정확히 판정하되, 뒤 7자리가
     없으면 윤년 가능 연도(2000)로 처리해 정상 입력을 오탐하지 않는다.

   ★영향 점검 — 무회귀:
     생년월일은 게이트가 한 번도 요구한 적 없는 "선택 입력"이다 → **빈 값은 차단하지 않는다**.
     "입력됐으나 앞 6자리가 실재하는 날짜가 아닌" 경우만 차단(금액·번호 패턴과 동일 논리).
     ⚠️ 법인 당사자는 이 칸이 법인등록번호이므로(checkCorpReg 담당) 개인(type==="개인")일 때만 검사한다.

   본 가드(조문·엔진·생성/DOCX 로직 무접촉 — 입력 완결성만):
     (A) isValidBirthDate 단일 출처 — 달력 유효성(유효/무효/자릿수/대시) + 세기 미입력 시 윤년 가능
     (B) 핵심 갭: 채웠지만 실재하지 않는 날짜(또는 부분 입력) → ok=false + '생년월일' 안내
     (C) 무회귀: 빈 값·유효한 생년월일은 통과(오탐 없음)
     (D) 다수 당사자 — 1-based 번호 식별·각각 누적
     (E) 점프 타깃 = 위탁자 STEP 01 / 우선수익자 STEP 02·where 제목 파생
     (F) 필수 공통 검사 — 전 7종 서류 차단(다른 정합성 게이트와 동일 일관성)
     (G) 채무자·수익자 — sameAsTrustor 면 미검사, 별도 입력일 때만 검사
     (H) ★법인(type) — 법인 당사자의 corpReg 칸(법인등록번호)은 생년월일 비대상(오탐 없음)
     (I) 회귀 — 다른 게이트(가격)와 독립 누적·무영향
     (J) ★세기 코드 해석 — 윤년 2월 29일을 세기(뒤 7자리 첫 자리)로 정확 판정·미입력 시 윤년 가능

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-birthdate-validity.mjs
   ============================================================ */
import { blankContractForm, blankParty } from "../src/lib/engine/model.ts";
import { validateDoc } from "../src/lib/engine/validate.ts";
import { isValidBirthDate } from "../src/lib/engine/calc.ts";
import { STEPS } from "../src/lib/engine/schema.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const ALL_DOCS = ["appform", "contract", "poa", "valReport", "boardMin", "cdd", "ubo"];

// 공통 필수(당사자·물건·체결일·금액·기간·비율)를 모두 유효하게 채운 양식 → 생년월일 단일 변인 격리.
function baseFilled() {
  const form = blankContractForm();
  form.trustors[0].name = "갑";
  form.priorities[0].name = "을은행";
  form.priorities[0].loanAmount = "5000000000";
  form.properties[0].address = "서울특별시 강남구 테헤란로 1";
  form.common.year = 2026;
  form.common.month = 6;
  form.common.day = 21;
  form.common.trustFee = "30000000";
  form.common.priorityRatio = 120;
  form.docContents.appform.valuationPrice = "10000000000";
  form.docContents.valReport.principalValue = "8000000000";
  return form; // 모든 당사자 type 기본 "법인", corpReg 빈 값(선택 입력)
}
// 개인으로 전환 + 생년월일(앞 6자리) 설정. back 은 세기 코드 검사용(선택).
const setBirth = (p, front, back = "") => { p.type = "개인"; p.corpRegFront = front; p.corpRegBack = back; };
const labelsOf = (form, docId) => validateDoc(form, docId).missing.map((m) => m.label);
const hasBirthMiss = (form, docId) => labelsOf(form, docId).some((l) => l.includes("생년월일"));

console.log("\n[A] isValidBirthDate 단일 출처 — 달력 유효성(YYMMDD)");
{
  ok(isValidBirthDate("900101", "1234567") === true, "900101 + 1900s코드 → 1990-01-01 유효");
  ok(isValidBirthDate("900101") === true, "900101 (뒤자리 없음) → 윤년 가능 연도로 유효");
  ok(isValidBirthDate("90-01-01") === true, "대시 포함 90-01-01 → 유효(숫자만 추출)");
  ok(isValidBirthDate("991332") === false, "991332 → 무효(월 13)");
  ok(isValidBirthDate("990230") === false, "990230 → 무효(2월 30일)");
  ok(isValidBirthDate("900100") === false, "900100 → 무효(일 00)");
  ok(isValidBirthDate("900132") === false, "900132 → 무효(1월 32일)");
  ok(isValidBirthDate("9001") === false, "9001 (4자리) → 무효(자릿수)");
  ok(isValidBirthDate("9001011") === false, "9001011 (7자리) → 무효(자릿수)");
  ok(isValidBirthDate("") === false && isValidBirthDate(null) === false && isValidBirthDate(undefined) === false,
    "빈 값·null·undefined → 무효(게이트가 빈 값을 별도 제외)");
  ok(isValidBirthDate("abcdef") === false, "비숫자 → 무효");
}

console.log("\n[B] 핵심 갭 — 채웠지만 실재하지 않는 날짜(또는 부분 입력)는 차단");
{
  const f1 = baseFilled();
  setBirth(f1.trustors[0], "991332"); // 월 13 = 실재하지 않는 날짜
  ok(validateDoc(f1, "contract").ok === false, "개인 위탁자 생년월일 991332 → ok=false(생성 차단)");
  ok(hasBirthMiss(f1, "contract"), "실재하지 않는 날짜 → '생년월일' 안내");
  // 부분 입력(앞 6자리 미완) — 법적 서류에 불완전 생년월일이 박히는 것도 차단(bizNo·corpReg 패턴 동일)
  const f2 = baseFilled();
  setBirth(f2.trustors[0], "9001");
  ok(validateDoc(f2, "contract").ok === false, "개인 위탁자 생년월일 부분 입력(9001) → ok=false");
  ok(hasBirthMiss(f2, "contract"), "부분 입력 → '생년월일' 안내");
}

console.log("\n[C] 무회귀 — 빈 값·유효한 생년월일은 통과(오탐 없음)");
{
  const base = baseFilled();
  ok(base.trustors[0].corpRegFront === "" && base.trustors[0].type === "법인",
    "blankContractForm 위탁자 생년월일 빈 값·기본 법인(무회귀 전제)");
  ok(validateDoc(base, "contract").ok === true, "기본(법인·빈 값) → ok=true(무회귀 기준선)");
  ok(!hasBirthMiss(base, "contract"), "기본 → 생년월일 오탐 없음");
  // 개인 + 빈 생년월일 → 통과(선택 입력)
  const fEmpty = baseFilled();
  fEmpty.trustors[0].type = "개인"; // 생년월일 칸 비움
  ok(validateDoc(fEmpty, "contract").ok === true, "개인 위탁자 + 빈 생년월일 → ok=true(선택 입력 무회귀)");
  ok(!hasBirthMiss(fEmpty, "contract"), "개인 빈 값 → 생년월일 오탐 없음");
  // 유효한 생년월일 입력 → 통과
  const fOk = baseFilled();
  setBirth(fOk.trustors[0], "900101", "1234567");
  setBirth(fOk.priorities[0], "850315", "2345678");
  ok(validateDoc(fOk, "contract").ok === true, "개인 위탁자·우선수익자 유효 생년월일 → ok=true");
  ok(!hasBirthMiss(fOk, "contract"), "유효 생년월일 → 오탐 없음");
}

console.log("\n[D] 다수 당사자 — 1-based 번호로 식별·각각 누적");
{
  const f = baseFilled();
  f.trustors.push(blankParty()); // 위탁자 2
  f.trustors[1].name = "정";
  setBirth(f.trustors[1], "991332"); // 위탁자 2 만 무효(개인)
  const labels = labelsOf(f, "contract");
  ok(labels.some((l) => l === "위탁자 2 생년월일 (실재하지 않는 날짜)"),
    "위탁자 2 무효 → '위탁자 2 생년월일' 식별");
  ok(!labels.some((l) => l === "위탁자 1 생년월일 (실재하지 않는 날짜)"),
    "위탁자 1(법인·빈 값) → 안내 없음(독립)");
  // 위탁자·우선수익자 동시 무효 → 각각 누적
  const f2 = baseFilled();
  setBirth(f2.trustors[0], "991332");
  setBirth(f2.priorities[0], "000231"); // 2월 31일 무효
  const l2 = labelsOf(f2, "contract");
  ok(l2.some((l) => l.startsWith("위탁자 1 생년월일")) && l2.some((l) => l.startsWith("우선수익자 1 생년월일")),
    "위탁자·우선수익자 동시 무효 → 각각 안내 누적");
}

console.log("\n[E] 점프 타깃 — 위탁자 STEP 01 / 우선수익자 STEP 02");
{
  const partiesStep = STEPS.find((s) => s.key === "parties"); // STEP 01
  const priorityStep = STEPS.find((s) => s.key === "priority"); // STEP 02
  const ft = baseFilled(); setBirth(ft.trustors[0], "991332");
  const mt = validateDoc(ft, "contract").missing.find((x) => x.label.startsWith("위탁자 1 생년월일"));
  ok(!!mt && mt.stepIdx === partiesStep.idx, "위탁자 점프 타깃 = STEP 01(parties)");
  ok(!!mt && mt.where.includes(partiesStep.title), "위탁자 안내 where = STEP 01 제목 파생");
  const fp = baseFilled(); setBirth(fp.priorities[0], "991332");
  const mp = validateDoc(fp, "contract").missing.find((x) => x.label.startsWith("우선수익자 1 생년월일"));
  ok(!!mp && mp.stepIdx === priorityStep.idx, "우선수익자 점프 타깃 = STEP 02(priority)");
}

console.log("\n[F] 필수 공통 검사 — 전 7종 서류 차단(정합성 게이트 일관성)");
{
  const f = baseFilled(); setBirth(f.trustors[0], "991332");
  for (const docId of ALL_DOCS) {
    ok(validateDoc(f, docId).ok === false, `무효 생년월일 → ${docId} 차단(공통)`);
    ok(hasBirthMiss(f, docId), `무효 생년월일 → ${docId} 안내`);
  }
}

console.log("\n[G] 채무자·수익자 — sameAsTrustor 면 미검사, 별도 입력일 때만 검사");
{
  const fSame = baseFilled();
  setBirth(fSame.debtors[0], "991332");
  setBirth(fSame.beneficiaries[0], "991332");
  ok(fSame.debtorSameAsTrustor === true && fSame.beneficiarySameAsTrustor === true, "기본 sameAsTrustor=true");
  ok(validateDoc(fSame, "contract").ok === true, "sameAsTrustor 시 채무자·수익자 무효 미검사 → ok=true(무회귀)");
  const fDiff = baseFilled();
  fDiff.debtorSameAsTrustor = false;
  fDiff.debtors[0].name = "채무자 무";
  setBirth(fDiff.debtors[0], "991332");
  ok(validateDoc(fDiff, "contract").ok === false, "채무자 별도 입력+무효 생년월일 → ok=false(차단)");
  ok(labelsOf(fDiff, "contract").some((l) => l.startsWith("채무자 1 생년월일")), "채무자 1 생년월일 안내");
}

console.log("\n[H] ★법인(type) — 법인 당사자의 corpReg 칸(법인등록번호)은 생년월일 비대상");
{
  // 법인은 이 칸이 법인등록번호 → 생년월일 검사 대상이 아니다(checkBirth 스킵). 무효 날짜처럼 보이는
  // 값(991332)을 넣어도 '생년월일' 안내는 나오지 않는다(법인은 checkCorpReg 가 별도 담당).
  const f = baseFilled();
  f.trustors[0].type = "법인";
  f.trustors[0].corpRegFront = "991332"; // 날짜로는 무효이나 법인 칸 → 생년월일 비대상
  ok(!hasBirthMiss(f, "contract"), "법인 위탁자 991332 → 생년월일 오탐 없음(비대상)");
  // 개인 무효 + 법인 유효 혼합 → 개인만 생년월일 차단(법인 스킵이 개인 검사를 누락시키지 않음)
  const fMix = baseFilled();
  fMix.trustors[0].type = "법인"; // 법인 위탁자(빈 값 = 유효)
  setBirth(fMix.priorities[0], "991332"); // 개인 우선수익자 무효
  ok(validateDoc(fMix, "contract").ok === false, "법인 위탁자(유효) + 개인 우선수익자(무효) → 차단(ok=false)");
  const lMix = labelsOf(fMix, "contract");
  ok(lMix.some((l) => l.startsWith("우선수익자 1 생년월일")), "개인 우선수익자 생년월일 안내 존재");
  ok(!lMix.some((l) => l.startsWith("위탁자 1 생년월일")), "법인 위탁자 생년월일 안내 없음(비대상)");
}

console.log("\n[I] 회귀 — 다른 게이트(가격)와 독립 누적·무영향");
{
  const fGood = baseFilled();
  for (const docId of ALL_DOCS) ok(validateDoc(fGood, docId).ok === true, `생년월일 무관(법인 기본) → ${docId} ok=true`);
  const fBoth = baseFilled();
  setBirth(fBoth.trustors[0], "991332");
  fBoth.docContents.appform.valuationPrice = "-1";
  ok(hasBirthMiss(fBoth, "appform"), "생년월일·가격 동시 무효 → 생년월일 안내 존재(appform)");
  ok(labelsOf(fBoth, "appform").some((l) => l.includes("신탁부동산 가격") && l.includes("유효하지 않은 금액")),
    "생년월일·가격 동시 무효 → 가격 안내도 존재(독립)");
}

console.log("\n[J] ★세기 코드 해석 — 윤년 2월 29일을 세기(뒤 7자리 첫 자리)로 정확 판정");
{
  // 000229: 세기 코드에 따라 윤년 여부가 갈린다.
  ok(isValidBirthDate("000229", "3000000") === true, "000229 + 3(2000s) → 2000-02-29 유효(윤년)");
  ok(isValidBirthDate("000229", "1000000") === false, "000229 + 1(1900s) → 1900-02-29 무효(평년)");
  ok(isValidBirthDate("000229") === true, "000229 (뒤자리 없음) → 윤년 가능(2000)으로 유효(오탐 방지)");
  ok(isValidBirthDate("000229", "9000000") === false, "000229 + 9(1800s) → 1800-02-29 무효(평년, 100의 배수)");
  // 게이트 레벨: 1900s 코드 + 0229 → 차단, 2000s 코드 + 0229 → 통과
  const f1900 = baseFilled(); setBirth(f1900.trustors[0], "000229", "1000000");
  ok(validateDoc(f1900, "contract").ok === false, "개인 위탁자 000229+1900s코드 → ok=false(평년 2/29 차단)");
  const f2000 = baseFilled(); setBirth(f2000.trustors[0], "000229", "3000000");
  ok(validateDoc(f2000, "contract").ok === true, "개인 위탁자 000229+2000s코드 → ok=true(윤년 2/29 통과)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
