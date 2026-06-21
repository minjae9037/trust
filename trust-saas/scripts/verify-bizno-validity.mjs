/* ============================================================
   회귀 가드 — 사업자등록번호(bizNo) 유효성 게이트(체크섬 차단)

   배경(정확성 갭): 신청서 관계사 표(builders.js partyTable)·별첨에는 각 당사자(위탁자·우선수익자
   등)의 사업자등록번호가 그대로 박힌다(kvRow "사업자등록번호" = bizP1-bizP2-bizP3). 그러나
   검증 게이트(validateDoc)는 사업자등록번호를 전혀 검사하지 않아, 오타로 체크섬이 깨진 번호가
   법적 서류에 그대로 들어갈 수 있었다(금액 5종·체결일·비율을 게이트화한 뒤 남은 정형 입력 결함).
     · PartyCard 입력은 숫자만 허용하지만 "자릿수 완결·체크섬"은 검사하지 않는다.
     · import·구버전 저장본·AI 머지로도 잘못된 번호가 들어올 수 있다.

   ★영향 점검 — 무회귀:
     사업자등록번호는 게이트가 한 번도 요구한 적 없는 "선택 입력"이다(법인등록번호만 기재하는
     계약도 정상). 따라서 **빈 값은 차단하지 않는다**(미입력 = 무효 아님). "입력됐으나(숫자 하나
     라도) 유효한 10자리 체크섬이 아닌" 경우만 차단한다 → 빈 사업자번호로 생성되던 기존 계약은
     무회귀, 잘못된 번호(애초에 "올바른" 적 없는 데이터)만 새로 차단(금액 패턴과 동일 논리).
     검증식은 국세청 표준 체크섬(추정 형식 아님 — 날짜의 윤년 규칙과 동일 성격).

   본 가드(조문·엔진·생성/DOCX 로직 무접촉 — 입력 완결성만):
     (A) isValidBizNo 단일 출처 — 국세청 표준 체크섬(유효/무효/자릿수/대시 처리)
     (B) 핵심 갭: 채웠지만 무효(체크섬 오류·부분 입력) → ok=false + '사업자등록번호' 안내
     (C) 무회귀: 빈 값·유효한 번호는 통과(오탐 없음)
     (D) 다수 당사자 — 어느 당사자가 무효인지 1-based 번호로 식별·각각 누적
     (E) 점프 타깃 = 위탁자 STEP 01 / 우선수익자 STEP 02·where 제목 파생
     (F) 필수 공통 검사 — 전 7종 서류 차단(다른 정합성 게이트와 동일 일관성)
     (G) 채무자·수익자: sameAsTrustor 면 미검사(중복 방지), 별도 입력(다름)일 때만 검사
     (H) 회귀: 다른 게이트(가격 등)와 독립 누적·무영향

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-bizno-validity.mjs
   ============================================================ */
import { blankContractForm, blankParty } from "../src/lib/engine/model.ts";
import { validateDoc } from "../src/lib/engine/validate.ts";
import { isValidBizNo } from "../src/lib/engine/calc.ts";
import { STEPS } from "../src/lib/engine/schema.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const ALL_DOCS = ["appform", "contract", "poa", "valReport", "boardMin", "cdd", "ubo"];
// 유효 사업자등록번호(국세청 체크섬 통과): 124-81-00998(실재 형식·체크섬 8 일치)
const VALID = ["124", "81", "00998"];
const INVALID = ["124", "81", "00999"]; // 체크섬만 깨진 동일 프리픽스

// 공통 필수(당사자·물건·체결일·금액·기간·비율)를 모두 유효하게 채운 양식 → bizNo 단일 변인 격리.
function baseFilled() {
  const form = blankContractForm();
  form.trustors[0].name = "주식회사 갑";
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
  return form; // 사업자등록번호는 비어 있음(선택 입력)
}
const setBiz = (p, [a, b, c]) => { p.bizP1 = a; p.bizP2 = b; p.bizP3 = c; };
const labelsOf = (form, docId) => validateDoc(form, docId).missing.map((m) => m.label);
const hasBizMiss = (form, docId) => labelsOf(form, docId).some((l) => l.includes("사업자등록번호"));

console.log("\n[A] isValidBizNo 단일 출처 — 국세청 표준 체크섬");
{
  ok(isValidBizNo("1248100998") === true, "1248100998 → 유효(체크섬 통과)");
  ok(isValidBizNo("124-81-00998") === true, "대시 포함 124-81-00998 → 유효(숫자만 추출)");
  ok(isValidBizNo("1248100999") === false, "1248100999 → 무효(체크섬 불일치)");
  ok(isValidBizNo("124810099") === false, "9자리 → 무효(자릿수)");
  ok(isValidBizNo("12481009980") === false, "11자리 → 무효(자릿수)");
  ok(isValidBizNo("") === false && isValidBizNo(null) === false && isValidBizNo(undefined) === false,
    "빈 값·null·undefined → 무효(게이트가 빈 값을 별도 제외)");
  ok(isValidBizNo("abcdefghij") === false, "비숫자 → 무효");
}

console.log("\n[B] 핵심 갭 — 채웠지만 무효(체크섬 오류·부분 입력)는 차단");
{
  // 체크섬만 깨진 완전한 10자리
  const f1 = baseFilled();
  setBiz(f1.trustors[0], INVALID);
  ok(validateDoc(f1, "contract").ok === false, "위탁자 사업자번호 체크섬 오류 → ok=false(생성 차단)");
  ok(hasBizMiss(f1, "contract"), "체크섬 오류 → '사업자등록번호' 안내");
  // 부분 입력(앞 3자리만) — 법적 서류에 "124--" 형태로 박히는 불완전 번호도 차단
  const f2 = baseFilled();
  setBiz(f2.trustors[0], ["124", "", ""]);
  ok(validateDoc(f2, "contract").ok === false, "위탁자 사업자번호 부분 입력(124--) → ok=false");
  ok(hasBizMiss(f2, "contract"), "부분 입력 → '사업자등록번호' 안내");
}

console.log("\n[C] 무회귀 — 빈 값·유효한 번호는 통과(오탐 없음)");
{
  const base = baseFilled();
  ok(base.trustors[0].bizP1 === "" && base.trustors[0].bizP2 === "" && base.trustors[0].bizP3 === "",
    "blankContractForm 위탁자 사업자번호 빈 값(무회귀 전제)");
  ok(validateDoc(base, "contract").ok === true, "사업자번호 빈 값 → ok=true(선택 입력 무회귀 기준선)");
  ok(!hasBizMiss(base, "contract"), "빈 값 → 사업자번호 오탐 없음");
  // 유효한 번호 입력 → 통과
  const fOk = baseFilled();
  setBiz(fOk.trustors[0], VALID);
  setBiz(fOk.priorities[0], VALID);
  ok(validateDoc(fOk, "contract").ok === true, "위탁자·우선수익자 유효 사업자번호 → ok=true");
  ok(!hasBizMiss(fOk, "contract"), "유효 번호 → 오탐 없음");
}

console.log("\n[D] 다수 당사자 — 1-based 번호로 식별·각각 누적");
{
  const f = baseFilled();
  f.trustors.push(blankParty()); // 위탁자 2
  f.trustors[1].name = "주식회사 병";
  setBiz(f.trustors[1], INVALID); // 위탁자 2 만 무효
  const labels = labelsOf(f, "contract");
  ok(labels.some((l) => l === "위탁자 2 사업자등록번호 (유효하지 않은 번호)"),
    "위탁자 2 무효 → '위탁자 2 사업자등록번호' 식별");
  ok(!labels.some((l) => l === "위탁자 1 사업자등록번호 (유효하지 않은 번호)"),
    "위탁자 1(빈 값) → 안내 없음(독립)");
  // 위탁자·우선수익자 동시 무효 → 각각 누적
  const f2 = baseFilled();
  setBiz(f2.trustors[0], INVALID);
  setBiz(f2.priorities[0], INVALID);
  const l2 = labelsOf(f2, "contract");
  ok(l2.some((l) => l.startsWith("위탁자 1 사업자등록번호")) && l2.some((l) => l.startsWith("우선수익자 1 사업자등록번호")),
    "위탁자·우선수익자 동시 무효 → 각각 안내 누적");
}

console.log("\n[E] 점프 타깃 — 위탁자 STEP 01 / 우선수익자 STEP 02");
{
  const partiesStep = STEPS.find((s) => s.key === "parties"); // STEP 01
  const priorityStep = STEPS.find((s) => s.key === "priority"); // STEP 02
  const ft = baseFilled(); setBiz(ft.trustors[0], INVALID);
  const mt = validateDoc(ft, "contract").missing.find((x) => x.label.startsWith("위탁자 1 사업자등록번호"));
  ok(!!mt && mt.stepIdx === partiesStep.idx, "위탁자 점프 타깃 = STEP 01(parties)");
  ok(!!mt && mt.where.includes(partiesStep.title), "위탁자 안내 where = STEP 01 제목 파생");
  const fp = baseFilled(); setBiz(fp.priorities[0], INVALID);
  const mp = validateDoc(fp, "contract").missing.find((x) => x.label.startsWith("우선수익자 1 사업자등록번호"));
  ok(!!mp && mp.stepIdx === priorityStep.idx, "우선수익자 점프 타깃 = STEP 02(priority)");
}

console.log("\n[F] 필수 공통 검사 — 전 7종 서류 차단(정합성 게이트 일관성)");
{
  const f = baseFilled(); setBiz(f.trustors[0], INVALID);
  for (const docId of ALL_DOCS) {
    ok(validateDoc(f, docId).ok === false, `무효 사업자번호 → ${docId} 차단(공통)`);
    ok(hasBizMiss(f, docId), `무효 사업자번호 → ${docId} 안내`);
  }
}

console.log("\n[G] 채무자·수익자 — sameAsTrustor 면 미검사, 별도 입력일 때만 검사");
{
  // 기본 sameAsTrustor=true: debtors/beneficiaries 배열에 무효를 넣어도 검사 안 함(중복 방지)
  const fSame = baseFilled();
  setBiz(fSame.debtors[0], INVALID);
  setBiz(fSame.beneficiaries[0], INVALID);
  ok(fSame.debtorSameAsTrustor === true && fSame.beneficiarySameAsTrustor === true, "기본 sameAsTrustor=true");
  ok(validateDoc(fSame, "contract").ok === true, "sameAsTrustor 시 채무자·수익자 무효 미검사 → ok=true(무회귀)");
  // 별도 입력(다름)이면 그 배열 자체를 검사
  const fDiff = baseFilled();
  fDiff.debtorSameAsTrustor = false;
  fDiff.debtors[0].name = "채무자 정";
  setBiz(fDiff.debtors[0], INVALID);
  ok(validateDoc(fDiff, "contract").ok === false, "채무자 별도 입력+무효 → ok=false(차단)");
  ok(labelsOf(fDiff, "contract").some((l) => l.startsWith("채무자 1 사업자등록번호")), "채무자 1 사업자번호 안내");
}

console.log("\n[H] 회귀 — 다른 게이트와 독립 누적·무영향");
{
  // 유효(빈 값) 사업자번호면 7종 전부 ok (다른 게이트 무회귀)
  const fGood = baseFilled();
  for (const docId of ALL_DOCS) ok(validateDoc(fGood, docId).ok === true, `사업자번호 무관 → ${docId} ok=true`);
  // 사업자번호·가격 동시 무효 → 두 안내 독립 누적
  const fBoth = baseFilled();
  setBiz(fBoth.trustors[0], INVALID);
  fBoth.docContents.appform.valuationPrice = "-1";
  ok(hasBizMiss(fBoth, "appform"), "사업자번호·가격 동시 무효 → 사업자번호 안내 존재(appform)");
  ok(labelsOf(fBoth, "appform").some((l) => l.includes("신탁부동산 가격") && l.includes("유효하지 않은 금액")),
    "사업자번호·가격 동시 무효 → 가격 안내도 존재(독립)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
