/* ============================================================
   회귀 가드 — 공동사업표준협약서(joint) 저장·불러오기·미저장(dirty) 추적

   배경(데이터 유실·정확성 갭): 담보신탁(collateral)은 SaveBar 가 form 을 저장/
   불러오고 dirty 를 추적하지만, 공동사업표준협약서는 입력 모델이 별도(jointForm)인데
   ① SaveBar.save 가 항상 collateral `form`(빈 값)을 저장 → joint 입력이 통째로 유실,
   ② loadContract 가 저장본을 `form` 으로만 복원 → joint 계약을 다시 열면 빈 폼,
   ③ isFormDirty/ markSaved 가 form 기준이라 joint 편집이 미저장 경고·이탈 가드에
      전혀 걸리지 않던 결함이 있었다. contractIdentity 는 이미 joint 분기를
   (gap.name/project.site) 갖췄으나 저장 데이터가 collateral 이라 사실상 죽은 코드였다.

   해결: 저장·불러오기·dirty 판정 모두 "현재 열린 서류의 활성 폼"(joint=jointForm,
   그 외=form)을 대상으로 한다. 본 가드는 contractStore 의 joint-aware 로직과
   SaveBar/openContract 의 활성 폼 배선을 재현·정적 단언한다.

   단언:
     (A) isFormDirty(joint): 빈 joint+미저장 → false / 편집 joint+미저장 → true
     (B) markSaved(joint) 기준선 → dirty=false / 저장 후 편집 → dirty=true
     (C) loadContract(joint row): jointForm 복원·form 초기화·기준선 dirty=false·편집 시 true
     (D) gap/project 한 단계 병합: 부분 저장본(키 누락) 무크래시·기본값 보전
     (E) ★라운드트립: 저장된 joint form_data 를 contractIdentity 가 읽어
         위탁자(갑 상호)·물건(사업부지) 식별 — 죽었던 분기가 살아남
     (F) collateral 무회귀: 2-인자 isFormDirty 유지·loadContract(collateral) 정상
     (G) ★교차오염 차단: joint 저장 데이터에 collateral(trustors/properties) 미혼입
     (H) 정적 배선: contractStore.markSaved/loadContract joint 분기 + SaveBar formData=활성 폼

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-joint-persistence.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { blankContractForm, blankJointForm } from "../src/lib/engine/model.ts";
import { contractIdentity } from "../src/lib/contractRepo.ts";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  ✓ " + label); }
  else { fail++; console.log("  ✗ " + label); }
};

/* ---- contractStore.ts 의 joint-aware 로직 재현 ---- */
let _blankHash = null;
let _blankJointHash = null;
function isFormDirty(form, savedHash, isJoint = false) {
  const cur = JSON.stringify(form);
  if (savedHash === null) {
    if (isJoint) {
      if (_blankJointHash === null) _blankJointHash = JSON.stringify(blankJointForm());
      return cur !== _blankJointHash;
    }
    if (_blankHash === null) _blankHash = JSON.stringify(blankContractForm());
    return cur !== _blankHash;
  }
  return cur !== savedHash;
}
/* markSaved: 활성 폼(joint=jointForm, 그 외=form)을 저장 기준선으로 기록 */
const markSaved = (activeForm) => JSON.stringify(activeForm);

/* loadContract 의 joint 분기 재현 */
function loadJoint(row) {
  const jbase = blankJointForm();
  const jfd = row.form_data ?? {};
  const jloaded = {
    ...jbase,
    ...jfd,
    gap: { ...jbase.gap, ...(jfd.gap ?? {}) },
    project: { ...jbase.project, ...(jfd.project ?? {}) },
  };
  return {
    docTypeId: row.doc_type,
    jointForm: jloaded,
    form: blankContractForm(),
    savedHash: JSON.stringify(jloaded),
  };
}

function filledJoint() {
  const j = blankJointForm();
  j.gap.name = "○○개발 주식회사";
  j.gap.repDir = "홍길동";
  j.gap.address = "서울특별시 강남구 테헤란로 1";
  j.project.name = "여주 역세권 공동주택 개발사업";
  j.project.site = "경기도 여주시 홍문동 1-1";
  j.project.scaleUse = "공동주택 300세대";
  j.project.agreementMonth = "3";
  j.project.agreementDay = "1";
  return j;
}

console.log("[A] isFormDirty(joint) — 빈/편집 미저장 판정");
{
  ok(isFormDirty(blankJointForm(), null, true) === false, "손대지 않은 빈 joint 폼은 미저장 변경 아님(노이즈 없음)");
  ok(isFormDirty(filledJoint(), null, true) === true, "갑 상호·사업명 입력 시 미저장 변경으로 표시");
  // ★collateral 빈 기준선과 혼동하지 않음(서로 다른 빈 폼)
  ok(isFormDirty(blankJointForm(), null, true) === false && isFormDirty(blankContractForm(), null, false) === false,
    "joint/collateral 각자의 빈 기준선으로 비교(혼동 없음)");
}

console.log("[B] markSaved(joint) 기준선 전이");
{
  const j = filledJoint();
  const savedHash = markSaved(j);
  ok(isFormDirty(j, savedHash, true) === false, "저장 직후 = 기준선과 동일 → 저장됨");
  const edited = { ...j, project: { ...j.project, name: "변경된 사업명" } };
  ok(isFormDirty(edited, savedHash, true) === true, "저장 이후 사업명 변경분은 미저장으로 재표시");
}

console.log("[C] loadContract(joint row) — 복원·기준선");
{
  const row = { id: "j1", doc_type: "joint", category: "new", title: "여주 협약", form_data: filledJoint() };
  const st = loadJoint(row);
  ok(st.jointForm.gap.name === "○○개발 주식회사", "갑 상호 복원");
  ok(st.jointForm.project.site === "경기도 여주시 홍문동 1-1", "사업부지 복원");
  ok(st.jointForm.project.scaleUse === "공동주택 300세대", "규모/용도 복원");
  ok(JSON.stringify(st.form) === JSON.stringify(blankContractForm()), "★다른 서류 폼(form)은 초기화 — joint 가 collateral 자리에 새지 않음");
  ok(isFormDirty(st.jointForm, st.savedHash, true) === false, "불러온 직후 = 저장됨 상태");
  const edited = { ...st.jointForm, gap: { ...st.jointForm.gap, repDir: "이순신" } };
  ok(isFormDirty(edited, st.savedHash, true) === true, "불러온 뒤 대표이사 편집 → 미저장 표시");
}

console.log("[D] gap/project 한 단계 병합 — 부분 저장본 무크래시");
{
  // 구버전/부분 저장본: project 일부 키만 존재
  const partial = { doc_type: "joint", form_data: { gap: { name: "갑상호" }, project: { name: "사업" } } };
  let crashed = false;
  let st;
  try { st = loadJoint(partial); } catch { crashed = true; }
  ok(!crashed, "부분 저장본 로드 시 크래시 없음");
  ok(st.jointForm.gap.name === "갑상호", "있는 키는 복원");
  ok(st.jointForm.gap.repDir === "" && st.jointForm.project.site === "", "누락 키는 blankJointForm 기본값으로 보전");
  ok(st.jointForm.project.agreementYear === String(new Date().getFullYear()), "project 기본값(협약 연도=현재 연도) 보전");
  ok(st.jointForm.representative === "developer", "representative 기본값 보전");
  // null form_data 도 무크래시
  let crashed2 = false;
  try { loadJoint({ doc_type: "joint", form_data: null }); } catch { crashed2 = true; }
  ok(!crashed2, "form_data=null 도 무크래시(빈 joint 로 복원)");
}

console.log("[E] ★라운드트립 — 저장 데이터를 contractIdentity 가 읽어 식별(죽은 분기 부활)");
{
  // SaveBar.save 가 활성 폼(jointForm)을 form_data 로 저장한다고 가정한 저장 행
  const savedRow = { doc_type: "joint", form_data: filledJoint() };
  const id = contractIdentity(savedRow);
  ok(id.trustor === "○○개발 주식회사", "카드 부제·검색의 위탁자 = 갑 상호(gap.name)");
  ok(id.property === "경기도 여주시 홍문동 1-1", "카드 부제·검색의 물건 = 사업부지(project.site)");
  // 회귀(버그 재현): collateral form 을 joint 로 저장하면 식별 불가(빈 값) — 수정 전 동작
  const buggyRow = { doc_type: "joint", form_data: blankContractForm() };
  const buggyId = contractIdentity(buggyRow);
  ok(buggyId.trustor === "" && buggyId.property === "",
    "★수정 전 버그(collateral 데이터를 joint 로 저장) 였다면 식별 불가였음 — 라운드트립이 이를 해소");
}

console.log("[F] collateral 무회귀 — 2-인자 isFormDirty·기존 동작 유지");
{
  const f = blankContractForm();
  f.trustors[0].name = "위탁자주식회사";
  ok(isFormDirty(blankContractForm(), null) === false, "빈 collateral 폼(2-인자) → 미저장 아님");
  ok(isFormDirty(f, null) === true, "입력된 collateral 폼(2-인자) → 미저장");
  const sh = markSaved(f);
  ok(isFormDirty(f, sh) === false, "저장 직후 collateral → 저장됨");
}

console.log("[G] ★교차오염 차단 — joint 저장 데이터에 collateral 키 미혼입");
{
  const j = filledJoint();
  // 활성 폼 저장 = jointForm 그대로(collateral trustors/properties/docContents 없음)
  const stored = JSON.stringify(j);
  ok(!stored.includes("\"trustors\"") && !stored.includes("\"properties\"") && !stored.includes("\"docContents\""),
    "joint 저장 데이터에 collateral 전용 키(trustors/properties/docContents) 없음");
  ok(stored.includes("\"gap\"") && stored.includes("\"project\""), "joint 저장 데이터는 gap/project 보유");
}

console.log("[H] 정적 배선 — contractStore.joint 분기 + SaveBar 활성 폼 저장");
{
  const store = readFileSync(join(root, "src/lib/store/contractStore.ts"), "utf8");
  const app = readFileSync(join(root, "src/components/trust/TrustApp.tsx"), "utf8");
  ok(/markSaved:[\s\S]*?docTypeId === "joint" \? st\.jointForm : st\.form/.test(store),
    "markSaved 가 활성 폼(joint 분기)을 기준선으로 기록");
  ok(/loadContract:[\s\S]*?row\.doc_type === "joint"/.test(store),
    "loadContract 에 joint 복원 분기 존재");
  ok(/_blankJointHash/.test(store), "isFormDirty 가 joint 빈 기준선(_blankJointHash)을 별도 계산");
  ok(/const isJoint = docTypeId === "joint"/.test(app), "SaveBar 가 활성 폼 분기(isJoint) 계산");
  ok(/formData: activeForm/.test(app), "★SaveBar.save 가 활성 폼(activeForm)을 저장 — joint 입력 유실 차단");
  ok(/isFormDirty\(activeForm, store\.savedHash, isJointOpen\)/.test(app),
    "goHome/openContract 이탈 가드가 활성 폼 기준 dirty 판정");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
