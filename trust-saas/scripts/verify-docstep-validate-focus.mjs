/* ============================================================
   회귀 가드 — 담보신탁 DocStep 검증 게이트 누락 항목 → 입력 필드 스크롤·포커스

   배경: JointForm(공동사업협약)은 검증 게이트 누락 라벨을 클릭하면 그 입력 필드로
   스크롤·포커스했지만(verify-joint-validate-jump · jointFieldIdForMissing 단일 출처),
   주력 동선인 담보신탁 DocStep 은 누락 항목 클릭 시 해당 "단계(STEP)"로만 점프하고
   그 단계 안 어느 필드를 채워야 하는지(특히 당사자 N·물건 N 처럼 반복 입력이 많은
   단계)까지 데려가지 못했다. 이 가드는 그 비대칭을 닫은 변경을 강제한다.

   핵심 불변식(이 가드가 강제):
     ① validateDoc 가 emit 하는 모든 Missing 은 비어 있지 않은 fieldId 를 갖는다
        (死점프 0 — 단계뿐 아니라 필드까지 데려갈 수 있다).
     ② 각 fieldId 는 실제 입력 컴포넌트(PartyCard/StepLoanCalc/StepProperty/StepBasic/
        StepConditions/DocStep)에 id="..." 로 실재하는 스킴이다.
     ③ DocStep 이 단계 점프 후 그 필드를 스크롤·포커스한다(getElementById·scrollIntoView·
        reduce-motion 존중·focus({preventScroll})·널가드), 누락 버튼이 fieldId 를 넘긴다.
     ④ 무회귀 — validateDoc 의 ok 판정(missing.length===0)·라벨 무변경, validate.ts 는
        DOM 무접근(순수 데이터)이다.

   실행:
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-docstep-validate-focus.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { blankContractForm } from "../src/lib/engine/model.ts";
import { validateDoc } from "../src/lib/engine/validate.ts";

const __dir = dirname(fileURLToPath(import.meta.url));
const src = (rel) => readFileSync(join(__dir, "..", rel), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const val = src("src/lib/engine/validate.ts");
const docStep = src("src/components/trust/steps/DocStep.tsx");
const partyCard = src("src/components/trust/steps/PartyCard.tsx");
const loanCalc = src("src/components/trust/steps/StepLoanCalc.tsx");
const property = src("src/components/trust/steps/StepProperty.tsx");
const basic = src("src/components/trust/steps/StepBasic.tsx");
const conditions = src("src/components/trust/steps/StepConditions.tsx");

// 누락 목록에서 라벨 접두사로 Missing 1건 찾기(동적 접미사 내성).
const find = (missing, prefix) => missing.find((m) => m.label.startsWith(prefix));

const ALL_DOCS = ["appform", "contract", "poa", "valReport", "boardMin", "cdd", "ubo"];

console.log("\n[A] validate.ts — Missing.fieldId 단일 출처(死점프 0)");
{
  ok(/fieldId\?:\s*string/.test(val), "validate.ts: Missing.fieldId?: string 신설");
  ok(/function miss\(label: string, stepIdx: number, fieldId\?: string\)/.test(val),
    "validate.ts: miss() fieldId 인자 수용");
  ok(/return \{ label, stepIdx, where:[\s\S]*?, fieldId \};/.test(val),
    "validate.ts: miss() 반환에 fieldId 포함");

  // ① 모든 서류의 빈 폼 누락 항목은 전부 비어 있지 않은 fieldId 를 갖는다.
  let total = 0;
  let withId = 0;
  for (const d of ALL_DOCS) {
    for (const m of validateDoc(blankContractForm(), d).missing) {
      total++;
      if (typeof m.fieldId === "string" && m.fieldId.trim().length > 0) withId++;
    }
  }
  ok(total > 0, `검증: 빈 폼이 누락 항목을 emit (${total}건 — 표본 확보)`);
  ok(total === withId, `死점프 0: 모든 누락(${total})이 fieldId 보유 (${withId}/${total})`);
}

console.log("\n[B] 대표 시나리오별 fieldId = 실제 DOM id 스킴");
{
  // 위탁자/우선수익자 성명(빈 폼) — party-${role}-0-name
  {
    const f = blankContractForm();
    f.common.trustPeriod = ""; // 기본값이 비어있지 않으므로 신탁기간 누락을 강제
    const m = validateDoc(f, "contract").missing;
    ok(find(m, "위탁자 (성명")?.fieldId === "party-trustors-0-name", "위탁자 성명 → party-trustors-0-name");
    ok(find(m, "우선수익자 (성명")?.fieldId === "party-priorities-0-name", "우선수익자 성명 → party-priorities-0-name");
    ok(find(m, "우선수익자 대출금액")?.fieldId === "loan-amount-0", "우선수익자 대출금액 → loan-amount-0");
    ok(find(m, "신탁 부동산")?.fieldId === "prop-0-address", "신탁 부동산 소재지 → prop-0-address");
    ok(find(m, "신탁기간")?.fieldId === "basic-trustPeriod", "신탁기간 → basic-trustPeriod");
  }
  // 채무자·수익자 별도 입력(동일 해제) — name·address fieldId
  {
    const f = blankContractForm();
    f.debtorSameAsTrustor = false;
    f.beneficiarySameAsTrustor = false;
    const m = validateDoc(f, "contract").missing;
    ok(find(m, "채무자 (성명")?.fieldId === "party-debtors-0-name", "채무자 성명 → party-debtors-0-name");
    ok(find(m, "채무자 (주소")?.fieldId === "party-debtors-0-address", "채무자 주소 → party-debtors-0-address");
    ok(find(m, "수익자 (성명")?.fieldId === "party-beneficiaries-0-name", "수익자 성명 → party-beneficiaries-0-name");
    ok(find(m, "수익자 (주소")?.fieldId === "party-beneficiaries-0-address", "수익자 주소 → party-beneficiaries-0-address");
  }
  // 사업자등록번호(체크섬 무효) — party-${role}-${i}-biz
  {
    const f = blankContractForm();
    f.trustors[0].bizP1 = "123"; f.trustors[0].bizP2 = "45"; f.trustors[0].bizP3 = "67890"; // 무효 체크섬(1234567890)
    const m = validateDoc(f, "contract").missing;
    ok(find(m, "위탁자 1 사업자등록번호")?.fieldId === "party-trustors-0-biz", "위탁자 사업자번호 → party-trustors-0-biz");
  }
  // 법인등록번호(법인·체크섬 무효) — party-${role}-${i}-regid
  {
    const f = blankContractForm();
    f.trustors[0].type = "법인";
    f.trustors[0].corpRegFront = "110111"; f.trustors[0].corpRegBack = "1234560"; // 무효 체크섬
    const m = validateDoc(f, "contract").missing;
    ok(find(m, "위탁자 1 법인등록번호")?.fieldId === "party-trustors-0-regid", "위탁자 법인등록번호 → party-trustors-0-regid");
  }
  // 생년월일(개인·실재하지 않는 날짜) — 동일 regid 칸 공유
  {
    const f = blankContractForm();
    f.trustors[0].type = "개인";
    f.trustors[0].corpRegFront = "991332"; // 13월 32일 = 실재하지 않음
    const m = validateDoc(f, "contract").missing;
    ok(find(m, "위탁자 1 생년월일")?.fieldId === "party-trustors-0-regid", "위탁자 생년월일 → party-trustors-0-regid");
  }
  // 물건 면적·등기번호(채웠지만 무효) — prop-${i}-area / prop-${i}-regNo
  {
    const f = blankContractForm();
    f.properties[0].area = "-50";     // 음수 면적
    f.properties[0].regNo = "12345";  // 14자리 아님
    const m = validateDoc(f, "contract").missing;
    ok(find(m, "부동산 1 면적")?.fieldId === "prop-0-area", "부동산 면적 → prop-0-area");
    ok(find(m, "부동산 1 등기 고유번호")?.fieldId === "prop-0-regNo", "부동산 등기번호 → prop-0-regNo");
  }
  // 우선수익한도 비율(범위 밖) — loan-priorityRatio
  {
    const f = blankContractForm();
    f.common.priorityRatio = 200; // 100~150 범위 밖
    const m = validateDoc(f, "contract").missing;
    ok(find(m, "우선수익한도 비율")?.fieldId === "loan-priorityRatio", "우선수익한도 비율 → loan-priorityRatio");
  }
  // 신탁보수(채웠지만 무효) — basic-trustFee
  {
    const f = blankContractForm();
    f.common.trustFee = "-100"; // 음수
    const m = validateDoc(f, "contract").missing;
    ok(find(m, "신탁보수")?.fieldId === "basic-trustFee", "신탁보수 → basic-trustFee");
  }
  // 문서별 금액 — doc-appform-valuationPrice / doc-valReport-principalValue
  {
    ok(find(validateDoc(blankContractForm(), "appform").missing, "신탁부동산 가격")?.fieldId === "doc-appform-valuationPrice",
      "신탁부동산 가격 → doc-appform-valuationPrice");
    ok(find(validateDoc(blankContractForm(), "valReport").missing, "신탁재산 원본가액")?.fieldId === "doc-valReport-principalValue",
      "신탁재산 원본가액 → doc-valReport-principalValue");
  }
  // 대리금융기관(지정 ON·회사명 빈칸) — cond-agentBank-name
  {
    const f = blankContractForm();
    f.docContents.contract.agentBankEnabled = true;
    f.docContents.contract.agentBank = "";
    const m = validateDoc(f, "contract").missing;
    ok(find(m, "대리금융기관 회사명")?.fieldId === "cond-agentBank-name", "대리금융기관 회사명 → cond-agentBank-name");
  }
}

console.log("\n[C] fieldId 가 가리키는 DOM id 가 입력 컴포넌트에 실재");
{
  // PartyCard: party-${role}-${idx}-${key} 단일 스킴 + name/address/biz/regid id
  ok(/const fid = \(key: string\) => `party-\$\{role\}-\$\{idx\}-\$\{key\}`/.test(partyCard),
    "PartyCard: fid = `party-${role}-${idx}-${key}` 스킴");
  ok(/id=\{fid\("name"\)\}/.test(partyCard), "PartyCard: name 입력 id");
  ok(/id=\{fid\("address"\)\}/.test(partyCard), "PartyCard: address 입력 id");
  ok(/id=\{fid\("biz"\)\}/.test(partyCard), "PartyCard: biz 그룹 라벨 id");
  ok(/id=\{fid\("regid"\)\}/.test(partyCard), "PartyCard: regid(법인등록/생년월일) 그룹 라벨 id");
  // StepLoanCalc: loan-amount-${i}(이번 신설) + loan-priorityRatio
  ok(/id=\{`loan-amount-\$\{i\}`\}/.test(loanCalc), "StepLoanCalc: 대출금액 입력 id=`loan-amount-${i}`(신설)");
  ok(/id="loan-priorityRatio"/.test(loanCalc), "StepLoanCalc: 비율 입력 id=loan-priorityRatio");
  // StepProperty: prop-${i}-address/area/regNo
  ok(/id=\{`prop-\$\{i\}-address`\}/.test(property), "StepProperty: 소재지 입력 id");
  ok(/id=\{`prop-\$\{i\}-area`\}/.test(property), "StepProperty: 면적 입력 id");
  ok(/id=\{`prop-\$\{i\}-regNo`\}/.test(property), "StepProperty: 등기번호 입력 id");
  // StepBasic: contractDate(라벨)/trustFee/trustPeriod
  ok(/id="basic-contractDate"/.test(basic), "StepBasic: 체결일 그룹 라벨 id");
  ok(/id="basic-trustFee"/.test(basic), "StepBasic: 신탁보수 입력 id");
  ok(/id="basic-trustPeriod"/.test(basic), "StepBasic: 신탁기간 입력 id");
  // StepConditions: cond-agentBank-name(이번 신설)
  ok(/id="cond-agentBank-name"/.test(conditions), "StepConditions: 대리금융기관 회사명 입력 id(신설)");
  // DocStep: 문서 필드 id 스킴 doc-${docId}-${f.key}
  ok(/const fid = `doc-\$\{docId\}-\$\{f\.key\}`/.test(docStep), "DocStep: 문서 필드 id=`doc-${docId}-${f.key}` 스킴");
}

console.log("\n[D] DocStep 배선 — 단계 점프 + 필드 포커스 예약(Wizard 핸드오프)");
{
  // 실제 포커스는 Wizard 가 단일 권한으로 수행(제목 포커스 레이스 제거) — DocStep 은 예약만.
  ok(/import \{ requestFieldFocus, consumeFieldFocus \} from "@\/lib\/ui\/wizard-focus"/.test(docStep),
    "DocStep: requestFieldFocus·consumeFieldFocus import(wizard-focus 핸드오프)");
  ok(/function goToStep\(idx: number, fieldId\?: string\)/.test(docStep), "DocStep: goToStep(idx, fieldId?) 수용");
  ok(/if \(fieldId\) requestFieldFocus\(fieldId\);/.test(docStep),
    "DocStep: 점프 직전 requestFieldFocus(fieldId) 예약(전환 후 Wizard 가 소비)");
  // 같은 단계 누락 항목(예: Doc 01 의 신탁부동산 가격) — step 미변경이라 effect 미발화 → 직접 소비
  ok(/if \(s\.idx === step\) \{[\s\S]*?consumeFieldFocus\(\);[\s\S]*?return;/.test(docStep),
    "DocStep: 같은 단계 점프는 직접 consumeFieldFocus(effect 미발화 보완)");
  ok(/onClick=\{\(\) => goToStep\(m\.stepIdx, m\.fieldId\)\}/.test(docStep), "DocStep: 누락 버튼 onClick → goToStep(stepIdx, fieldId)");
  // setTimeout 직접 포커스(레이스 유발)는 제거됐다 — 예약→Wizard 소비 단일 경로만.
  ok(!/setTimeout\(\(\) => focusValidateField/.test(docStep), "DocStep: setTimeout 직접 포커스 제거(레이스 0)");
  // 점프 버튼 자체(.validate-jump)·게이트 박스 보존
  ok(/className="validate-jump"/.test(docStep), "DocStep: .validate-jump 버튼 보존");
  ok(/role="alert"/.test(docStep), "DocStep: validate-box role=alert 보존");
}

console.log("\n[D2] wizard-focus.ts — 포커스 핸드오프 단일 권한(레이스 제거)");
{
  const wf = src("src/lib/ui/wizard-focus.ts");
  const wiz = src("src/components/trust/Wizard.tsx");
  ok(/export function requestFieldFocus\(id: string\)/.test(wf), "wizard-focus: requestFieldFocus(id) export");
  ok(/export function consumeFieldFocus\(\): boolean/.test(wf), "wizard-focus: consumeFieldFocus(): boolean export");
  ok(/pendingFieldId = null;/.test(wf), "wizard-focus: 1회성 소비(읽으면 비움)");
  ok(/document\.getElementById\(id\)/.test(wf), "wizard-focus: getElementById 로 필드 조회");
  ok(/if \(!el\) return false;/.test(wf), "wizard-focus: 매칭 실패(死점프) → false(제목 포커스 폴백)");
  ok(/prefers-reduced-motion: reduce/.test(wf), "wizard-focus: reduce-motion 존중");
  ok(/scrollIntoView\(\{ behavior: reduceMotion \? "auto" : "smooth", block: "center" \}\)/.test(wf),
    "wizard-focus: scrollIntoView(center)");
  ok(/\.focus\(\{ preventScroll: true \}\)/.test(wf), "wizard-focus: focus({preventScroll})");
  ok(/HTMLInputElement \|\| el instanceof HTMLSelectElement \|\| el instanceof HTMLTextAreaElement/.test(wf),
    "wizard-focus: 폼 컨트롤이면 직접 포커스");
  ok(/el\.parentElement\?\.querySelector<HTMLElement>\("input, select, textarea"\)/.test(wf),
    "wizard-focus: 그룹 라벨이면 인접 입력 포커스");
  // Wizard 가 제목 포커스 전에 소비 — 예약 있으면 필드 우선(제목 양보)
  ok(/import \{ consumeFieldFocus, requestFieldFocus \} from "@\/lib\/ui\/wizard-focus"/.test(wiz),
    "Wizard: consumeFieldFocus·requestFieldFocus import");
  ok(/if \(consumeFieldFocus\(\)\) return;\s*[\r\n]+\s*headingRef\.current\?\.focus\(\)/.test(wiz),
    "Wizard: step effect 가 제목 포커스 전에 필드 예약 소비(필드 우선)");
  // "남은 필수 입력" 요약 점프도 동일 핸드오프(단계+필드) — DocStep 검증 박스와 일관
  ok(/function goStep\(idx: number, fieldId\?: string\)/.test(wiz), "Wizard: goStep(idx, fieldId?) 수용");
  ok(/if \(fieldId\) requestFieldFocus\(fieldId\);/.test(wiz), "Wizard: goStep 이 fieldId 예약");
  ok(/if \(idx === step\) \{[\s\S]*?consumeFieldFocus\(\);[\s\S]*?return;/.test(wiz),
    "Wizard: 같은 단계 점프는 직접 consumeFieldFocus");
  ok(/onClick=\{\(\) => goStep\(mi\.stepIdx, mi\.fieldId\)\}/.test(wiz),
    "Wizard: 요약 누락 항목 onClick → goStep(stepIdx, fieldId)");
}

console.log("\n[E] 무회귀 — ok 판정·라벨 무변경, validate.ts DOM 무접근");
{
  // ok = missing.length===0 판정 유지
  ok(/return \{ ok: missing\.length === 0, missing \}/.test(val), "validate.ts: validateDoc ok=missing.length===0 유지");
  // 빈 폼은 생성 불가(ok=false), 필수 채운 폼은 생성 가능(ok=true) — 판정 회귀 없음
  ok(validateDoc(blankContractForm(), "contract").ok === false, "무회귀: 빈 폼 contract = ok false(차단)");
  {
    const f = blankContractForm();
    f.trustors[0].name = "주식회사 갑";
    f.priorities[0].name = "한국투자증권 주식회사";
    f.priorities[0].loanAmount = "1000000000";
    f.properties[0].address = "서울특별시 강남구 테헤란로 1";
    f.common.year = 2026; f.common.month = 3; f.common.day = 1;
    f.common.trustPeriod = "신탁계약일 ~ 신탁 종료일";
    const r = validateDoc(f, "contract");
    ok(r.ok === true, `무회귀: 필수 채운 폼 contract = ok true(생성 가능) ${r.ok ? "" : "[남은:" + r.missing.map((x) => x.label).join("/") + "]"}`);
  }
  // validate.ts 는 순수 데이터 — DOM(document/window) 무접근
  ok(!/\bdocument\b/.test(val) && !/\bwindow\b/.test(val), "validate.ts: DOM(document/window) 무접근(순수)");
  // 빌더/조문 모듈 import 무혼입(검증 게이트는 입력 완결성만 — 주석의 "builders.js"
  // 언급이 아니라 실제 import 문만 검사).
  ok(!/from\s+"[^"]*(builders|disposalBody|annex)/i.test(val), "validate.ts: 빌더/조문 모듈 import 무혼입");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
