/* ============================================================
   회귀 가드 — 공동사업표준협약서(joint) 검증 게이트 누락 항목 → 입력 필드 점프

   배경: 담보신탁 DocStep 은 검증 게이트 누락 항목이 .validate-jump 버튼이라
   클릭하면 해당 입력 단계로 점프(verify-validate-jump)하는데, JointForm 의 누락
   안내는 정적 <strong> 텍스트라 "어디를 채워야 하나"를 알려주되 이동 수단이 없던
   갭. JointForm 은 단일 스크롤 폼이라 스텝이 없으므로 "누락 라벨 → 해당 입력 필드
   DOM id 로 스크롤·포커스"가 동형(validate.ts jointFieldIdForMissing 단일 출처).

   핵심 불변식(이 가드가 강제):
     validateJoint 가 emit 할 수 있는 모든 누락 라벨은 jointFieldIdForMissing 으로
     non-null id 에 매핑되고, 그 id 는 JointForm.tsx 에 id="..." 로 실재한다.
     → 누락 안내의 어떤 항목을 클릭해도 항상 실제 입력 필드로 데려간다(死점프 0).

   실행:
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-joint-validate-jump.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { blankJointForm } from "../src/lib/engine/model.ts";
import { validateJoint, jointFieldIdForMissing } from "../src/lib/engine/validate.ts";

const __dir = dirname(fileURLToPath(import.meta.url));
const src = (rel) => readFileSync(join(__dir, "..", rel), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

// validateJoint 가 실제로 push 하는 라벨을 다양한 결함 폼에서 수집(동적 접미사 포함).
function filled() {
  const f = blankJointForm();
  f.gap.name = "주식회사 갑개발";
  f.gap.repDir = "홍길동";
  f.gap.address = "서울특별시 강남구 테헤란로 1";
  f.project.name = "○○지구 공동주택 개발사업";
  f.project.site = "서울특별시 강남구 ○○동 1-1";
  f.project.scaleUse = "아파트 300세대";
  f.project.agreementYear = "2026";
  f.project.agreementMonth = "3";
  f.project.agreementDay = "1";
  return f;
}
// 모든 라벨 변종을 망라: 빈 폼(누락 계열) + 무효 법인등록번호 + 실재하지 않는 날짜.
function allEmittableLabels() {
  const labels = new Set();
  for (const l of validateJoint(blankJointForm()).missing) labels.add(l);
  // 무효 법인등록번호(체크섬 실패) → "(유효하지 않은 번호)" 접미사 라벨
  {
    const f = filled();
    f.gap.corpRegFront = "110111";
    f.gap.corpRegBack = "0123459"; // 무효 체크섬
    for (const l of validateJoint(f).missing) labels.add(l);
  }
  // 실재하지 않는 날짜 → "(실재하지 않는 날짜)" 접미사 라벨
  {
    const f = filled();
    f.project.agreementMonth = "2";
    f.project.agreementDay = "31";
    for (const l of validateJoint(f).missing) labels.add(l);
  }
  return [...labels];
}

const form = src("src/components/trust/JointForm.tsx");
const val = src("src/lib/engine/validate.ts");
// JointForm 에 실재하는 id="..." 집합(매핑 대상이 死id 가 아님을 보장).
const presentIds = new Set([...form.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));

console.log("\n[A] 핵심 불변식 — emit 가능한 모든 누락 라벨이 실재 입력 id 로 매핑");
{
  const labels = allEmittableLabels();
  ok(labels.length >= 7, `수집된 누락 라벨 ${labels.length}종(≥7)`);
  for (const label of labels) {
    const id = jointFieldIdForMissing(label);
    ok(typeof id === "string" && id.length > 0, `매핑 non-null: "${label}" → ${id}`);
    ok(id != null && presentIds.has(id), `id 실재(JointForm): "${label}" → #${id}`);
  }
}

console.log("\n[B] 라벨별 정확 매핑(접두사 — 동적 접미사 무시)");
{
  ok(jointFieldIdForMissing("갑(시행사) 상호") === "joint-gapName", "갑 상호 → joint-gapName");
  ok(jointFieldIdForMissing("갑(시행사) 대표이사") === "joint-gapRepDir", "갑 대표이사 → joint-gapRepDir");
  ok(jointFieldIdForMissing("갑(시행사) 주소") === "joint-gapAddress", "갑 주소 → joint-gapAddress");
  ok(jointFieldIdForMissing("갑(시행사) 법인등록번호 (유효하지 않은 번호)") === "joint-gapCorpRegFront",
    "갑 법인등록번호(접미사) → joint-gapCorpRegFront");
  ok(jointFieldIdForMissing("사업명") === "joint-projectName", "사업명 → joint-projectName");
  ok(jointFieldIdForMissing("사업부지") === "joint-projectSite", "사업부지 → joint-projectSite");
  ok(jointFieldIdForMissing("사업규모 및 용도") === "joint-projectScaleUse", "사업규모 및 용도 → joint-projectScaleUse");
  ok(jointFieldIdForMissing("협약일 (연·월·일)") === "joint-agreementYear", "협약일(누락) → joint-agreementYear");
  ok(jointFieldIdForMissing("협약일 (실재하지 않는 날짜)") === "joint-agreementYear", "협약일(무효 날짜) → joint-agreementYear");
}

console.log("\n[C] 미상 라벨·방어 — null 반환(무동작), 무크래시");
{
  ok(jointFieldIdForMissing("존재하지 않는 라벨") === null, "미상 라벨 → null");
  ok(jointFieldIdForMissing("") === null, "빈 문자열 → null");
  let crashed = false;
  let r1, r2;
  try { r1 = jointFieldIdForMissing(null); r2 = jointFieldIdForMissing(undefined); } catch { crashed = true; }
  ok(!crashed, "null/undefined 입력에도 throw 없음");
  ok(r1 === null && r2 === null, "null/undefined → null");
}

console.log("\n[D] 배선 — JointForm 누락 항목이 점프 버튼 + focusMissing");
{
  ok(/jointFieldIdForMissing/.test(form), "JointForm: jointFieldIdForMissing import 사용");
  ok(/function focusMissing\(/.test(form), "JointForm: focusMissing 핸들러 정의");
  ok(/getElementById\(/.test(form), "JointForm: getElementById 로 필드 조회");
  ok(/scrollIntoView\(/.test(form), "JointForm: scrollIntoView 로 스크롤");
  ok(/\.focus\(/.test(form), "JointForm: focus() 로 포커스");
  // 누락 항목이 정적 <strong> 단독이 아니라 클릭 가능한 .validate-jump 버튼
  ok(/className="validate-jump"/.test(form), "JointForm: .validate-jump 버튼 렌더");
  ok(/onClick=\{\(\) => focusMissing\(label\)\}/.test(form), "JointForm: 버튼 onClick → focusMissing(label)");
  ok(/id="joint-gapCorpRegFront"/.test(form), "JointForm: 법인등록번호 앞칸에 점프 대상 id 부여");
}

console.log("\n[E] 무회귀 — validateJoint 계약(string[]) 무변경, 매핑은 별도 export");
{
  ok(/export function validateJoint\(/.test(val), "validate.ts: validateJoint export 유지");
  ok(/missing:\s*string\[\]/.test(val), "validate.ts: validateJoint 반환 missing:string[] 유지");
  ok(/export function jointFieldIdForMissing\(/.test(val), "validate.ts: jointFieldIdForMissing export 신설");
  // 매핑은 순수(부수효과 없음) — DOM 접근은 컴포넌트(focusMissing) 책임
  ok(!/document|window/.test(val.split("jointFieldIdForMissing")[1] || ""), "jointFieldIdForMissing: DOM 무접근(순수)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
