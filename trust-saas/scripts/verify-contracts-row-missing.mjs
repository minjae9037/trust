/* ============================================================
   회귀 가드 — 내 계약 목록 카드의 "남은 필수 입력" 요약(rowMissing)

   배경(검증 흐름 UX, 비-산출물): 계약 목록(ContractsView)의 카드는 준비도 칩으로
   "서류 N/7 생성 가능"(몇 종)만 보여 줬다. 정작 *무엇이* 남았는지는 계약을 열어
   각 서류 검증박스를 일일이 뒤져야 알 수 있었다(칩 title 도 "열기 → 각 서류에서 확인").
   Wizard 헤더에는 7종에 걸친 누락 입력을 중복 없이 모은 "남은 필수 입력" 체크리스트가
   이미 있었으나(missingList), 저장된 계약 목록에는 그 목록 패리티가 없었다. 본 가드는
   카드에 그 요약을 더한 rowMissing 의 불변식을 잠근다.

   핵심 불변식(정확성 가드레일):
     - 남은 필수 입력 = validateDoc(검증 게이트)이 보고한 누락 항목과 동일 출처
       (별도 판정 로직 없음 — 7종 산출 서류의 missing 을 label 기준 중복 제거해 합집합).
     - rowMissing 이 비면(빈 배열) ⟺ readyDocIds 가 7종 전부(allReady) — 칩과 모순 0.
     - 담보신탁(collateral) 외·손상 저장본은 빈 배열(요약 미표시·SR 고지 없음·크래시 방지).

   단언:
     (A) 빈 계약 → 공통 누락 라벨(위탁자·우선수익자) 포함 · 라벨 중복 제거(같은 라벨 1회)
     (B) 공통필수 입력(위탁자·우선수익자·대출금액·물건) → 남은 입력 = 정확히 2건
         {신탁부동산 가격, 신탁재산 원본가액}(= 미준비 2종 appform·valReport 의 고유 누락)
     (C) 전체 충족 → 남은 입력 0건 · 칩 정합(rowMissing 빈 ⟺ ready 7/7)
     (D) 담보신탁 외(joint/fund)·손상 저장본 → [](요약 미표시·크래시 방지)
     (E) 배선(ContractsView.tsx) — type Missing import · rowMissing 정의(collateral 한정·
         label dedup) · rowJointMissing 정의(joint 한정·validateJoint.missing) · missingLabels
         단일 출처(collateral ∪ joint) · openLabel SR 고지(missingLabel) · 요약 줄(aria-hidden·
         ⚠·앞 4건 slice·외 N건) · readyDocIds/일괄생성/검수 미리보기(회귀) 보존
     (F) joint 패리티 — 공동사업협약 카드도 '무엇이' 남았는지: rowJointMissing 이
         validateJoint(form).missing 와 단일 출처(라벨·순서 일치)·완전 입력→0건·손상 격리

   ※ 그간 collateral 카드만 '무엇이' 남았는지(rowMissing) 보여 주고 joint 카드는 "필수 입력
     누락" 칩만 있어 무엇을 채울지 열어야 알 수 있었다(목록 패리티 갭) — 본 가드가 양쪽을 잠근다.

   ContractsView.tsx 의 rowMissing() 와 동일 로직 재현(컴포넌트 내부 함수라 import 불가
   — 기존 contracts 가드와 동일 재현 패턴).

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-contracts-row-missing.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { blankContractForm, blankJointForm } from "../src/lib/engine/model.ts";
import { validateDoc, validateJoint } from "../src/lib/engine/validate.ts";
import { COLLATERAL_OUTPUT_DOCS } from "../src/lib/engine/schema.ts";

const __dir = dirname(fileURLToPath(import.meta.url));
const src = (rel) => readFileSync(join(__dir, "..", rel), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

// ContractsView.tsx 의 rowMissing(row) 재현 — 7종 산출 서류의 validateDoc.missing 을
// label 기준 중복 제거해 합친다(collateral 한정·손상 격리).
function rowMissing(row) {
  if (row.doc_type !== "collateral") return [];
  const form = row.form_data;
  try {
    const seen = new Set();
    const list = [];
    for (const d of COLLATERAL_OUTPUT_DOCS) {
      const { missing } = validateDoc(form, d.id);
      for (const mi of missing) {
        if (seen.has(mi.label)) continue;
        seen.add(mi.label);
        list.push(mi);
      }
    }
    return list;
  } catch {
    return [];
  }
}
// ContractsView.tsx 의 rowJointMissing(row) 재현 — joint 의 validateJoint.missing 을
// 그대로 쓴다(별도 판정 로직 없음). joint 의 missing 은 이미 라벨 단위 유일이라 중복
// 제거 불필요. joint 외·손상 저장본은 빈 배열(요약 미표시·크래시 방지).
function rowJointMissing(row) {
  if (row.doc_type !== "joint") return [];
  const form = row.form_data;
  if (!form || typeof form !== "object") return [];
  try {
    return validateJoint(form).missing;
  } catch {
    return [];
  }
}
// readyDocIds 재현(칩 정합 교차검증용) — 검수/일괄생성 가드와 동일.
function readyDocIds(row) {
  if (row.doc_type !== "collateral") return null;
  try {
    return COLLATERAL_OUTPUT_DOCS.filter((d) => validateDoc(row.form_data, d.id).ok).map((d) => d.id);
  } catch {
    return null;
  }
}
const rowOf = (form, doc_type = "collateral") => ({ doc_type, form_data: form });

const commonFilled = () => {
  const form = blankContractForm();
  form.trustors[0].name = "주식회사 갑";
  form.priorities[0].name = "을은행";
  form.priorities[0].loanAmount = "5000000000";
  form.properties[0].address = "서울특별시 강남구 테헤란로 1";
  return form;
};
const fullFilled = () => {
  const form = commonFilled();
  form.docContents.appform.valuationPrice = "10000000000";
  form.docContents.valReport.principalValue = "10000000000";
  return form;
};

console.log("\n[A] 빈 계약 — 공통 누락 라벨 포함 · 라벨 중복 제거");
{
  const m = rowMissing(rowOf(blankContractForm()));
  const labels = m.map((x) => x.label);
  ok(labels.includes("위탁자 (성명/상호)"), "빈 계약 → '위탁자 (성명/상호)' 누락 포함");
  ok(labels.includes("우선수익자 (성명/상호)"), "빈 계약 → '우선수익자 (성명/상호)' 누락 포함");
  ok(m.length > 0, `빈 계약 → 남은 입력 ${m.length}건(>0)`);
  // 공통 누락(위탁자 등)은 7종 모두의 missing 에 반복 등장 — 합집합에서 1회만.
  ok(new Set(labels).size === labels.length, "라벨 중복 제거(같은 라벨 1회만 — 7종 반복 등장 무관)");
  // Missing 항목 형태(label·where·stepIdx) 보존 — Wizard missingList 와 동형.
  ok(m.every((x) => typeof x.label === "string" && typeof x.stepIdx === "number"), "각 항목 label·stepIdx 형태 보존");
}

console.log("\n[B] 공통필수 입력 → 남은 입력 = {신탁부동산 가격, 신탁재산 원본가액} 정확히 2건");
{
  const m = rowMissing(rowOf(commonFilled()));
  const labels = m.map((x) => x.label);
  ok(m.length === 2, `공통필수 → 남은 입력 2건 (실제 ${m.length}: ${labels.join(" / ")})`);
  ok(labels.includes("신탁부동산 가격"), "남은 입력에 appform 고유 '신탁부동산 가격'");
  ok(labels.includes("신탁재산 원본가액"), "남은 입력에 valReport 고유 '신탁재산 원본가액'");
  // 공통 항목(위탁자·우선수익자·대출금액·물건)은 채웠으므로 더는 남지 않음.
  ok(!labels.includes("위탁자 (성명/상호)"), "채운 공통 항목(위탁자)은 남은 입력에서 제외");
  ok(!labels.includes("우선수익자 대출금액"), "채운 공통 항목(대출금액)은 남은 입력에서 제외");
  // 칩 정합: 미준비 2종(appform·valReport) ⟺ 그 2종 고유 누락만 남음.
  const ready = readyDocIds(rowOf(commonFilled()));
  ok(ready.length === 5, `칩 정합 — 준비 5/7(미준비 2종) (실제 ${ready.length})`);
}

console.log("\n[C] 전체 충족 → 남은 입력 0건 · 칩 정합(rowMissing 빈 ⟺ ready 7/7)");
{
  const m = rowMissing(rowOf(fullFilled()));
  ok(m.length === 0, `전체 충족 → 남은 입력 0건 (실제 ${m.length})`);
  const ready = readyDocIds(rowOf(fullFilled()));
  ok(ready.length === COLLATERAL_OUTPUT_DOCS.length, `전체 충족 → 준비 ${ready.length}/${COLLATERAL_OUTPUT_DOCS.length}`);
  // 불변식: 남은 입력이 빔 ⟺ 7종 전부 준비(allReady) — 칩과 모순 0.
  ok((m.length === 0) === (ready.length === COLLATERAL_OUTPUT_DOCS.length), "불변식: rowMissing 빈 ⟺ ready 전부");
}

console.log("\n[D] 담보신탁 외·손상 저장본 → [](요약 미표시·크래시 방지)");
{
  ok(rowMissing(rowOf(blankContractForm(), "joint")).length === 0, "joint → [](미표시)");
  ok(rowMissing(rowOf(blankContractForm(), "fund")).length === 0, "fund → [](미표시)");
  ok(rowMissing({ doc_type: "collateral", form_data: {} }).length === 0, "빈 객체 form_data → [](크래시 방지)");
  ok(rowMissing({ doc_type: "collateral", form_data: null }).length === 0, "null form_data → [](크래시 방지)");
}

console.log("\n[E] 배선(ContractsView.tsx) — rowMissing 정의 · 요약 줄 · SR 고지 · 회귀");
{
  const cv = src("src/components/trust/ContractsView.tsx");
  ok(/import\s*\{[^}]*\btype Missing\b[^}]*\}\s*from\s*"@\/lib\/engine\/validate"/.test(cv),
    "type Missing import(@/lib/engine/validate)");
  // 단일 출처: rowMissing 은 collateralMissingUnion(위저드 헤더 missingList 와 동일 헬퍼)을
  // 호출한다 — 그간 인라인 재현하던 dedup-합집합 로직을 한 곳으로 단일화(화면 간 drift 차단).
  ok(/import\s*\{[^}]*\bcollateralMissingUnion\b[^}]*\}\s*from\s*"@\/lib\/ui\/contract-missing"/.test(cv),
    "collateralMissingUnion import(@/lib/ui/contract-missing — 단일 출처)");

  const m = cv.match(/function rowMissing\(row: ContractRow\): Missing\[\]\s*\{[\s\S]*?\n\}/);
  ok(!!m, "rowMissing 함수 추출");
  const body = m ? m[0] : "";
  ok(/if \(row\.doc_type !== "collateral"\) return \[\];/.test(body), "rowMissing: collateral 외 → [](요약 미표시)");
  ok(/return collateralMissingUnion\(form\);/.test(body), "rowMissing: collateralMissingUnion 위임(7종 dedup-합집합 단일 출처)");
  ok(/catch \{\s*return \[\];\s*\}/.test(body), "rowMissing: 손상 저장본 try/catch 격리");

  // 남은 입력 라벨 = 담보신탁(rowMissing) 미완분 + 공동사업협약(rowJointMissing) 미준비분의
  // 단일 출처. 한 행은 collateral 또는 joint 라 상호배타 — 준비 안 된 쪽 라벨만 채워진다.
  ok(/const missingLabels: string\[\] =\s*\n\s*readiness && !allReady\s*\n\s*\? rowMissing\(r\)\.map\(\(mi\) => mi\.label\)\s*\n\s*: jointReady === false\s*\n\s*\? rowJointMissing\(r\)\s*\n\s*: \[\];/.test(cv),
    "카드: missingLabels = collateral 미완(rowMissing.label) ∪ joint 미준비(rowJointMissing) 단일 출처");
  // SR 고지: 카드 aria-label(openLabel)에 남은 입력 포함(요약 줄 aria-hidden 의 짝).
  ok(/남은 필수 입력 \$\{missingLabels\.length\}건: \$\{missingLabels\.join\(", "\)\}/.test(cv),
    "openLabel: 남은 필수 입력 N건 + 라벨 목록 SR 고지(missingLabel)");
  ok(/const openLabel = `\$\{r\.title\}, \$\{statusLabel\}\$\{readyLabel\}\$\{missingLabel\} — 열기`;/.test(cv),
    "openLabel: missingLabel 합성(접근명에 포함)");
  // 시각 요약 줄: aria-hidden(중복 낭독 0)·⚠·앞 4건 slice·외 N건.
  ok(/\{missingLabels\.length > 0 && \(/.test(cv), "요약 줄: missingLabels 있을 때만 렌더");
  ok(/aria-hidden="true"[\s\S]{0,80}⚠ 남은 필수 입력:/.test(cv), "요약 줄: aria-hidden + ⚠ 남은 필수 입력 머리말");
  ok(/missingLabels\.slice\(0, 4\)\.join\(" · "\)/.test(cv), "요약 줄: 앞 4건만 표시(slice)");
  ok(/missingLabels\.length > 4 \? ` 외 \$\{missingLabels\.length - 4\}건` : ""/.test(cv), "요약 줄: 4건 초과 시 '외 N건'");

  // 회귀: 준비도/일괄생성/검수 미리보기 보존
  ok(/function readyDocIds\(row: ContractRow\): DocId\[\] \| null/.test(cv), "회귀: readyDocIds 보존(단일 출처)");
  ok(/async function generateRowDocs\(row: ContractRow\)/.test(cv), "회귀: 일괄 생성 generateRowDocs 보존");
  ok(/function previewRowDocs\(row: ContractRow\)/.test(cv), "회귀: 검수 미리보기 previewRowDocs 보존");
  ok(/className=\{"ready-chip " \+ \(allReady \? "ok" : "warn"\)\}/.test(cv), "회귀: 준비도 칩(N/7) 보존");
  // 배선: rowJointMissing 정의(joint 한정·validateJoint.missing·손상 격리) + missingLabels 분기.
  const jm = cv.match(/function rowJointMissing\(row: ContractRow\): string\[\]\s*\{[\s\S]*?\n\}/);
  ok(!!jm, "rowJointMissing 함수 추출");
  const jbody = jm ? jm[0] : "";
  ok(/if \(row\.doc_type !== "joint"\) return \[\];/.test(jbody), "rowJointMissing: joint 외 → [](요약 미표시)");
  ok(/if \(!form \|\| typeof form !== "object"\) return \[\];/.test(jbody), "rowJointMissing: null/비객체(손상 저장본) → [](validateJoint 관대 처리 보완)");
  ok(/validateJoint\(form\)\.missing/.test(jbody), "rowJointMissing: validateJoint.missing 재사용(별도 판정 로직 없음)");
  ok(/catch \{\s*return \[\];\s*\}/.test(jbody), "rowJointMissing: 손상 저장본 try/catch 격리");
}

console.log("\n[F] joint 패리티 — 공동사업협약 카드도 '무엇이' 남았는지(validateJoint.missing)");
{
  // 빈 joint → 핵심 누락 라벨(갑 상호·사업명 등) 그대로 노출(collateral rowMissing 패리티).
  const jm = rowJointMissing(rowOf(blankJointForm(), "joint"));
  ok(jm.length > 0, `빈 joint → 남은 입력 ${jm.length}건(>0)`);
  ok(jm.includes("갑(시행사) 상호"), "빈 joint → '갑(시행사) 상호' 누락 포함");
  ok(jm.includes("사업명"), "빈 joint → '사업명' 누락 포함");
  // validateJoint.missing 과 동일 출처(별도 판정 로직 없음) — 라벨·순서까지 일치.
  ok(JSON.stringify(jm) === JSON.stringify(validateJoint(blankJointForm()).missing),
    "rowJointMissing = validateJoint(form).missing 단일 출처(라벨·순서 일치)");
  // 완전 입력 joint → 0건(collateral fullFilled 의 joint 짝).
  const full = blankJointForm();
  full.gap.name = "주식회사 갑시행사";
  full.gap.repDir = "김대표";
  full.gap.address = "서울특별시 강남구 테헤란로 1";
  full.project.name = "○○ 공동주택 신축사업";
  full.project.site = "서울특별시 강남구 역삼동 1-1";
  full.project.scaleUse = "공동주택 300세대";
  full.project.agreementYear = "2026";
  full.project.agreementMonth = "6";
  full.project.agreementDay = "25";
  ok(rowJointMissing(rowOf(full, "joint")).length === 0, "완전 입력 joint → 남은 입력 0건");
  // joint 외·손상 저장본 → [](요약 미표시·크래시 방지).
  ok(rowJointMissing(rowOf(blankContractForm(), "collateral")).length === 0, "collateral → [](joint 헬퍼 대상 아님)");
  ok(rowJointMissing({ doc_type: "joint", form_data: null }).length === 0, "null form_data → [](크래시 방지)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
