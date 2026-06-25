/* ============================================================
   회귀 가드 — 생성 확인 신선도(genFreshness)

   배경(정확성 UX 갭): DocStep 의 "✓ Word 생성 완료" 확인 메시지는 생성
   버튼을 누른 그 시점 입력에 대한 것이다. 그런데 기존 구현은 생성 후
   사용자가 입력을 고쳐도(예: 금액 오타 정정) 확인이 그대로 남아, 이미
   내려받은 구버전이 최신인 것처럼 오해할 수 있었다(법적 효력 문서를
   잘못된 버전으로 제출하는 위험 — 운영원칙 2 정확성 최우선).
   → genFreshness(현재 스냅샷, 생성 시점 스냅샷)로 none/fresh/stale 판정,
     stale 이면 확인을 "다시 생성하세요"로 전환한다. 값 기반(JSON.stringify)
     비교라 참조 동일성에 기대지 않고 결정적·테스트 가능.

   본 가드(조문·엔진·검증·생성 로직 무접촉 — UI 상태 판정만):
     (A) 기본: snapshot null→none / 동일→fresh / 상이→stale
     (B) 빈 문자열 snapshot 은 null 과 구별(=생성됨)
     (C) form 직렬화 시나리오: 생성 직후 fresh → 한 글자 수정 시 stale
     (D) 서로 다른 계약(다른 당사자)은 stale
     (E) 결정성·순수성: 같은 입력 반복 호출 동일 결과·예외 없음
     (F) 배선: DocStep 단건 + Wizard 헤더 일괄 생성 신선도 신호 단일 출처
     (G) 배선: 공동사업표준협약서(JointForm) 신선도 신호(DocStep 패리티)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-generate-freshness.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { blankContractForm } from "../src/lib/engine/model.ts";
import { genFreshness } from "../src/lib/engine/genStatus.ts";

const __dir = dirname(fileURLToPath(import.meta.url));
const src = (rel) => readFileSync(join(__dir, "..", rel), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const snap = (form) => JSON.stringify(form);

console.log("\n[A] 기본 판정 — none / fresh / stale");
{
  ok(genFreshness("anything", null) === "none", "snapshot null → none(미생성)");
  ok(genFreshness("X", "X") === "fresh", "동일 스냅샷 → fresh");
  ok(genFreshness("X", "Y") === "stale", "상이 스냅샷 → stale");
  ok(genFreshness("", null) === "none", "현재 빈 문자열 + snapshot null → none");
}

console.log("\n[B] 빈 문자열 snapshot 은 null 과 구별(생성됨 상태)");
{
  // 빈 스냅샷이라도 null 이 아니면 '생성됨' — 현재와 같으면 fresh, 다르면 stale.
  ok(genFreshness("", "") === "fresh", "빈 현재 = 빈 snapshot → fresh(생성됨·무변경)");
  ok(genFreshness("x", "") === "stale", "현재 채움 vs 빈 snapshot → stale");
}

console.log("\n[C] form 직렬화 — 생성 직후 fresh, 첫 편집에 stale");
{
  const form = blankContractForm();
  form.trustors[0].name = "주식회사 갑";
  form.priorities[0].name = "을은행";
  form.docContents.appform.valuationPrice = "10000000000";
  const generated = snap(form); // 생성 시점 스냅샷

  ok(genFreshness(snap(form), generated) === "fresh", "생성 직후 입력 무변경 → fresh");

  // 금액 오타 정정(0 하나 추가) — 한 필드만 바뀌어도 stale 로 전환되어야 함
  form.docContents.appform.valuationPrice = "100000000000";
  ok(genFreshness(snap(form), generated) === "stale", "금액 1필드 수정 → stale(다시 생성 안내)");

  // 되돌리면 다시 fresh(값 기반이라 참조가 달라도 동일 값이면 fresh)
  form.docContents.appform.valuationPrice = "10000000000";
  ok(genFreshness(snap(form), generated) === "fresh", "원복 시 다시 fresh(값 기반 비교)");

  // 당사자명 수정도 stale
  form.trustors[0].name = "주식회사 을";
  ok(genFreshness(snap(form), generated) === "stale", "당사자명 수정 → stale");
}

console.log("\n[D] 서로 다른 계약은 stale");
{
  const a = blankContractForm();
  a.trustors[0].name = "갑";
  const b = blankContractForm();
  b.trustors[0].name = "병";
  ok(genFreshness(snap(b), snap(a)) === "stale", "다른 당사자 계약 → stale");
  ok(genFreshness(snap(a), snap(a)) === "fresh", "동일 계약 → fresh");
}

console.log("\n[E] 결정성·순수성 — 반복 호출 동일·예외 없음");
{
  const s = snap(blankContractForm());
  ok(genFreshness(s, s) === genFreshness(s, s), "같은 입력 반복 호출 동일 결과");
  let threw = false;
  try {
    genFreshness("", null);
    genFreshness("a", "b");
    genFreshness(s, s);
  } catch {
    threw = true;
  }
  ok(!threw, "어떤 입력에도 예외 없음(순수 판정)");
  // null 만 none — 나머지는 항상 fresh|stale 둘 중 하나
  ok(["fresh", "stale"].includes(genFreshness("a", "a")), "비-null snapshot 은 fresh|stale 만 반환");
}

console.log("\n[F] 배선 — DocStep 단건 + Wizard 헤더 일괄 생성 신선도 신호 단일 출처");
{
  const docStep = src("src/components/trust/steps/DocStep.tsx");
  const wizard = src("src/components/trust/Wizard.tsx");

  // 두 소비처 모두 동일 판정 함수(genFreshness)를 단일 출처로 import 한다.
  ok(/genFreshness/.test(docStep) && /from ["']@\/lib\/engine\/genStatus["']/.test(docStep),
    "DocStep: genStatus.genFreshness import");
  ok(/genFreshness/.test(wizard) && /from ["']@\/lib\/engine\/genStatus["']/.test(wizard),
    "Wizard: genStatus.genFreshness import");

  // 생성 성공 시 생성 시점 스냅샷을 기록(= 이후 편집을 stale 로 판정할 기준선).
  ok(/setGenSnap\(formSnap\)/.test(docStep), "DocStep: 생성 성공 시 genSnap=formSnap 기록");
  ok(/setBatchSnap\(formSnap\)/.test(wizard), "Wizard: 일괄 생성 성공 시 batchSnap=formSnap 기록");

  // 값 기반 스냅샷(JSON.stringify(form)) — 참조 동일성에 기대지 않음.
  ok(/JSON\.stringify\(form\)/.test(wizard), "Wizard: formSnap=JSON.stringify(form) 값 기반 스냅샷");

  // stale 일 때 재생성 안내로 전환(완료 메시지보다 우선 렌더).
  ok(/freshness === "stale"/.test(docStep) && /다시 생성하세요/.test(docStep),
    "DocStep: stale → '다시 생성하세요' 전환");
  ok(/batchFreshness === "stale"/.test(wizard) && /다시 일괄 생성하세요/.test(wizard),
    "Wizard: stale → '다시 일괄 생성하세요' 전환");

  // 입력 변경 시 직전 완료/오류 메시지를 비워 stale 안내가 드러나도록 한다.
  // (formSnap 변경 effect 가 batchMsg 를 비운다 — 통합 검수 previewMsg 등 형제
  //  clear 가 같은 effect 에 추가돼도 batchMsg 비움 의도는 유지됨.)
  ok(/useEffect\(\(\) => \{[\s\S]*?setBatchMsg\(""\);[\s\S]*?\}, \[formSnap\]\)/.test(wizard),
    "Wizard: 입력(formSnap) 변경 시 batchMsg 비움 effect");

  // stale 안내는 위험(danger) 색으로 표시.
  ok(/--c-danger/.test(wizard) && /--c-danger/.test(docStep),
    "양쪽: stale 안내 danger 색");
}

console.log("\n[G] 배선 — 공동사업표준협약서(JointForm) 신선도 신호 (DocStep 패리티)");
{
  const joint = src("src/components/trust/JointForm.tsx");

  // joint 도 동일 판정 함수(genFreshness)를 단일 출처로 import.
  ok(/genFreshness/.test(joint) && /from ["']@\/lib\/engine\/genStatus["']/.test(joint),
    "JointForm: genStatus.genFreshness import");

  // 값 기반 스냅샷(JSON.stringify(jointForm)) — 참조 동일성에 기대지 않음.
  ok(/JSON\.stringify\(jointForm\)/.test(joint),
    "JointForm: formSnap=JSON.stringify(jointForm) 값 기반 스냅샷");

  // Word/PDF 생성 성공 시 생성 시점 스냅샷 기록(= 이후 편집을 stale 로 판정할 기준선).
  ok((joint.match(/setGenSnap\(formSnap\)/g) || []).length >= 2,
    "JointForm: Word·PDF 생성 성공 시 genSnap=formSnap 기록(2개 경로)");

  // PDF 팝업 차단(else) 분기에서는 genSnap 미기록(거짓 신선도 방지) — opened 가드 안에서만 기록.
  ok(/if \(opened\) \{[\s\S]*?setGenSnap\(formSnap\);[\s\S]*?\} else \{/.test(joint),
    "JointForm: PDF 는 opened===true 분기에서만 genSnap 기록(차단 시 거짓 fresh 방지)");

  // stale 일 때 재생성 안내로 전환(완료 메시지보다 우선 렌더).
  ok(/freshness === "stale"/.test(joint) && /다시 생성하세요/.test(joint),
    "JointForm: stale → '다시 생성하세요' 전환");

  // 입력 변경 시 직전 완료/오류 메시지를 비워 stale 안내가 드러나도록 한다.
  ok(/useEffect\(\(\) => \{\s*setMsg\(""\);\s*\}, \[formSnap\]\)/.test(joint),
    "JointForm: 입력(formSnap) 변경 시 msg 비움 effect");

  // stale 안내는 위험(danger) 색으로 표시(DocStep·Wizard 와 동일).
  ok(/--c-danger/.test(joint), "JointForm: stale 안내 danger 색");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
