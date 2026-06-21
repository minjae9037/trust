/* ============================================================
   회귀 가드 — 법인등록번호(corpRegNo) 유효성 게이트(체크섬 차단)

   배경(정확성 갭): 계약서 본문·신청서 관계사 표(builders.js)·별첨에는 각 "법인" 당사자(위탁자·
   우선수익자 등)의 법인등록번호가 그대로 박힌다(corpRegFront-corpRegBack). 그러나 검증 게이트
   (validateDoc)는 — 금액 5종·체결일·비율·사업자등록번호까지 게이트화한 뒤에도 — 법인등록번호를
   전혀 검사하지 않아, 오타로 체크섬이 깨진 번호(또는 부분 입력)가 법적 서류에 그대로 들어갈 수
   있었다("정형 식별번호" 정합성 결함 유형의 마지막 입력).
     · PartyCard 입력은 숫자만 허용하지만 "자릿수 완결·체크섬"은 검사하지 않는다.
     · import·구버전 저장본·AI 머지로도 잘못된 번호가 들어올 수 있다.

   ★영향 점검 — 무회귀:
     법인등록번호는 게이트가 한 번도 요구한 적 없는 "선택 입력"이다(사업자등록번호만 기재하는
     계약도 정상). 따라서 **빈 값은 차단하지 않는다**. "입력됐으나 유효한 13자리 체크섬이 아닌"
     경우만 차단한다(사업자번호·금액 패턴과 동일 논리 — 잘못된 번호는 애초에 "올바른" 적 없는 데이터).
     검증식은 대한민국 표준 체크섬(추정 형식 아님 — 앱 내 실재 상수 110111-7125720 으로 검증).
     ⚠️ 개인 당사자는 이 칸이 "생년월일"로 렌더되므로(builders.js: type==="개인"→"생년월일")
        법인(type==="법인")일 때만 검사한다 — 개인 생년월일에 13자리 체크섬을 적용해 오탐하지 않는다.

   본 가드(조문·엔진·생성/DOCX 로직 무접촉 — 입력 완결성만):
     (A) isValidCorpRegNo 단일 출처 — 표준 체크섬(유효/무효/자릿수/대시 처리)
     (B) 핵심 갭: 채웠지만 무효(체크섬 오류·부분 입력) → ok=false + '법인등록번호' 안내
     (C) 무회귀: 빈 값·유효한 번호는 통과(오탐 없음)
     (D) 다수 당사자 — 어느 당사자가 무효인지 1-based 번호로 식별·각각 누적
     (E) 점프 타깃 = 위탁자 STEP 01 / 우선수익자 STEP 02·where 제목 파생
     (F) 필수 공통 검사 — 전 7종 서류 차단(다른 정합성 게이트와 동일 일관성)
     (G) 채무자·수익자: sameAsTrustor 면 미검사(중복 방지), 별도 입력(다름)일 때만 검사
     (H) ★개인(type) — 개인 당사자의 corpReg 칸(생년월일)은 체크섬 비대상(오탐 없음) — 사업자번호와의 핵심 차이
     (I) 회귀: 다른 게이트(사업자번호·가격)와 독립 누적·무영향

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-corpreg-validity.mjs
   ============================================================ */
import { blankContractForm, blankParty } from "../src/lib/engine/model.ts";
import { validateDoc } from "../src/lib/engine/validate.ts";
import { isValidCorpRegNo } from "../src/lib/engine/calc.ts";
import { STEPS } from "../src/lib/engine/schema.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const ALL_DOCS = ["appform", "contract", "poa", "valReport", "boardMin", "cdd", "ubo"];
// 유효 법인등록번호(표준 체크섬 통과): 110111-7125720 (앱 내 실재 상수, 검증값 0 일치)
const VALID = ["110111", "7125720"];
const INVALID = ["110111", "7125721"]; // 마지막 자리만 깨진 동일 프리픽스

// 공통 필수(당사자·물건·체결일·금액·기간·비율)를 모두 유효하게 채운 양식 → corpReg 단일 변인 격리.
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
  return form; // 법인등록번호는 비어 있음(선택 입력), 기본 type="법인"
}
const setCorp = (p, [front, back]) => { p.corpRegFront = front; p.corpRegBack = back; };
const labelsOf = (form, docId) => validateDoc(form, docId).missing.map((m) => m.label);
const hasCorpMiss = (form, docId) => labelsOf(form, docId).some((l) => l.includes("법인등록번호"));

console.log("\n[A] isValidCorpRegNo 단일 출처 — 표준 체크섬");
{
  ok(isValidCorpRegNo("1101117125720") === true, "1101117125720 → 유효(체크섬 통과·실재 상수)");
  ok(isValidCorpRegNo("110111-7125720") === true, "대시 포함 110111-7125720 → 유효(숫자만 추출)");
  ok(isValidCorpRegNo("1101117125721") === false, "1101117125721 → 무효(체크섬 불일치)");
  ok(isValidCorpRegNo("110111712572") === false, "12자리 → 무효(자릿수)");
  ok(isValidCorpRegNo("11011171257200") === false, "14자리 → 무효(자릿수)");
  ok(isValidCorpRegNo("") === false && isValidCorpRegNo(null) === false && isValidCorpRegNo(undefined) === false,
    "빈 값·null·undefined → 무효(게이트가 빈 값을 별도 제외)");
  ok(isValidCorpRegNo("abcdefghijklm") === false, "비숫자 → 무효");
}

console.log("\n[B] 핵심 갭 — 채웠지만 무효(체크섬 오류·부분 입력)는 차단");
{
  // 체크섬만 깨진 완전한 13자리
  const f1 = baseFilled();
  setCorp(f1.trustors[0], INVALID);
  ok(validateDoc(f1, "contract").ok === false, "위탁자 법인등록번호 체크섬 오류 → ok=false(생성 차단)");
  ok(hasCorpMiss(f1, "contract"), "체크섬 오류 → '법인등록번호' 안내");
  // 부분 입력(앞 6자리만) — 법적 서류에 "110111-" 형태로 박히는 불완전 번호도 차단
  const f2 = baseFilled();
  setCorp(f2.trustors[0], ["110111", ""]);
  ok(validateDoc(f2, "contract").ok === false, "위탁자 법인등록번호 부분 입력(110111-) → ok=false");
  ok(hasCorpMiss(f2, "contract"), "부분 입력 → '법인등록번호' 안내");
}

console.log("\n[C] 무회귀 — 빈 값·유효한 번호는 통과(오탐 없음)");
{
  const base = baseFilled();
  ok(base.trustors[0].corpRegFront === "" && base.trustors[0].corpRegBack === "",
    "blankContractForm 위탁자 법인등록번호 빈 값(무회귀 전제)");
  ok(validateDoc(base, "contract").ok === true, "법인등록번호 빈 값 → ok=true(선택 입력 무회귀 기준선)");
  ok(!hasCorpMiss(base, "contract"), "빈 값 → 법인등록번호 오탐 없음");
  // 유효한 번호 입력 → 통과
  const fOk = baseFilled();
  setCorp(fOk.trustors[0], VALID);
  setCorp(fOk.priorities[0], VALID);
  ok(validateDoc(fOk, "contract").ok === true, "위탁자·우선수익자 유효 법인등록번호 → ok=true");
  ok(!hasCorpMiss(fOk, "contract"), "유효 번호 → 오탐 없음");
}

console.log("\n[D] 다수 당사자 — 1-based 번호로 식별·각각 누적");
{
  const f = baseFilled();
  f.trustors.push(blankParty()); // 위탁자 2 (type="법인")
  f.trustors[1].name = "주식회사 병";
  setCorp(f.trustors[1], INVALID); // 위탁자 2 만 무효
  const labels = labelsOf(f, "contract");
  ok(labels.some((l) => l === "위탁자 2 법인등록번호 (유효하지 않은 번호)"),
    "위탁자 2 무효 → '위탁자 2 법인등록번호' 식별");
  ok(!labels.some((l) => l === "위탁자 1 법인등록번호 (유효하지 않은 번호)"),
    "위탁자 1(빈 값) → 안내 없음(독립)");
  // 위탁자·우선수익자 동시 무효 → 각각 누적
  const f2 = baseFilled();
  setCorp(f2.trustors[0], INVALID);
  setCorp(f2.priorities[0], INVALID);
  const l2 = labelsOf(f2, "contract");
  ok(l2.some((l) => l.startsWith("위탁자 1 법인등록번호")) && l2.some((l) => l.startsWith("우선수익자 1 법인등록번호")),
    "위탁자·우선수익자 동시 무효 → 각각 안내 누적");
}

console.log("\n[E] 점프 타깃 — 위탁자 STEP 01 / 우선수익자 STEP 02");
{
  const partiesStep = STEPS.find((s) => s.key === "parties"); // STEP 01
  const priorityStep = STEPS.find((s) => s.key === "priority"); // STEP 02
  const ft = baseFilled(); setCorp(ft.trustors[0], INVALID);
  const mt = validateDoc(ft, "contract").missing.find((x) => x.label.startsWith("위탁자 1 법인등록번호"));
  ok(!!mt && mt.stepIdx === partiesStep.idx, "위탁자 점프 타깃 = STEP 01(parties)");
  ok(!!mt && mt.where.includes(partiesStep.title), "위탁자 안내 where = STEP 01 제목 파생");
  const fp = baseFilled(); setCorp(fp.priorities[0], INVALID);
  const mp = validateDoc(fp, "contract").missing.find((x) => x.label.startsWith("우선수익자 1 법인등록번호"));
  ok(!!mp && mp.stepIdx === priorityStep.idx, "우선수익자 점프 타깃 = STEP 02(priority)");
}

console.log("\n[F] 필수 공통 검사 — 전 7종 서류 차단(정합성 게이트 일관성)");
{
  const f = baseFilled(); setCorp(f.trustors[0], INVALID);
  for (const docId of ALL_DOCS) {
    ok(validateDoc(f, docId).ok === false, `무효 법인등록번호 → ${docId} 차단(공통)`);
    ok(hasCorpMiss(f, docId), `무효 법인등록번호 → ${docId} 안내`);
  }
}

console.log("\n[G] 채무자·수익자 — sameAsTrustor 면 미검사, 별도 입력일 때만 검사");
{
  // 기본 sameAsTrustor=true: debtors/beneficiaries 배열에 무효를 넣어도 검사 안 함(중복 방지)
  const fSame = baseFilled();
  setCorp(fSame.debtors[0], INVALID);
  setCorp(fSame.beneficiaries[0], INVALID);
  ok(fSame.debtorSameAsTrustor === true && fSame.beneficiarySameAsTrustor === true, "기본 sameAsTrustor=true");
  ok(validateDoc(fSame, "contract").ok === true, "sameAsTrustor 시 채무자·수익자 무효 미검사 → ok=true(무회귀)");
  // 별도 입력(다름)이면 그 배열 자체를 검사
  const fDiff = baseFilled();
  fDiff.debtorSameAsTrustor = false;
  fDiff.debtors[0].name = "채무자 정";
  setCorp(fDiff.debtors[0], INVALID);
  ok(validateDoc(fDiff, "contract").ok === false, "채무자 별도 입력+무효 → ok=false(차단)");
  ok(labelsOf(fDiff, "contract").some((l) => l.startsWith("채무자 1 법인등록번호")), "채무자 1 법인등록번호 안내");
}

console.log("\n[H] ★개인(type) — 개인 당사자의 corpReg 칸(생년월일)은 체크섬 비대상(사업자번호와의 핵심 차이)");
{
  // 개인은 builders.js 에서 이 칸이 "생년월일"로 렌더된다 → 13자리 법인등록번호 체크섬 비적용.
  // INVALID(법인 기준 체크섬 깨진 13자리)를 넣어도 개인이면 차단하지 않는다(오탐 방지).
  const fIndiv = baseFilled();
  fIndiv.trustors[0].type = "개인";
  setCorp(fIndiv.trustors[0], INVALID);
  ok(validateDoc(fIndiv, "contract").ok === true, "개인 위탁자 corpReg(생년월일)에 무효 13자리 → ok=true(비대상)");
  ok(!hasCorpMiss(fIndiv, "contract"), "개인 → 법인등록번호 오탐 없음");
  // 6자리 생년월일(YYMMDD)도 부분/무효로 오인하지 않음
  const fBirth = baseFilled();
  fBirth.priorities[0].type = "개인";
  setCorp(fBirth.priorities[0], ["900101", ""]);
  ok(validateDoc(fBirth, "contract").ok === true, "개인 우선수익자 생년월일 6자리 → ok=true(부분입력 오인 없음)");
  // 같은 폼에 법인 위탁자가 무효면 그건 차단(개인 스킵이 법인 검사를 누락시키지 않음)
  const fMix = baseFilled();
  fMix.trustors[0].type = "법인"; setCorp(fMix.trustors[0], INVALID);
  fMix.priorities[0].type = "개인"; setCorp(fMix.priorities[0], INVALID);
  ok(validateDoc(fMix, "contract").ok === false, "법인 위탁자 무효 + 개인 우선수익자 → 법인만 차단(ok=false)");
  const lMix = labelsOf(fMix, "contract");
  ok(lMix.some((l) => l.startsWith("위탁자 1 법인등록번호")), "법인 위탁자 안내 존재");
  ok(!lMix.some((l) => l.startsWith("우선수익자 1 법인등록번호")), "개인 우선수익자 안내 없음(비대상)");
}

console.log("\n[I] 회귀 — 다른 게이트(사업자번호·가격)와 독립 누적·무영향");
{
  // 유효(빈 값) 법인등록번호면 7종 전부 ok (다른 게이트 무회귀)
  const fGood = baseFilled();
  for (const docId of ALL_DOCS) ok(validateDoc(fGood, docId).ok === true, `법인등록번호 무관 → ${docId} ok=true`);
  // 법인등록번호·가격 동시 무효 → 두 안내 독립 누적
  const fBoth = baseFilled();
  setCorp(fBoth.trustors[0], INVALID);
  fBoth.docContents.appform.valuationPrice = "-1";
  ok(hasCorpMiss(fBoth, "appform"), "법인등록번호·가격 동시 무효 → 법인등록번호 안내 존재(appform)");
  ok(labelsOf(fBoth, "appform").some((l) => l.includes("신탁부동산 가격") && l.includes("유효하지 않은 금액")),
    "법인등록번호·가격 동시 무효 → 가격 안내도 존재(독립)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
