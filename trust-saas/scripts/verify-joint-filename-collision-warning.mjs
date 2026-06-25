/* ============================================================
   회귀 가드 — 공동사업표준협약서 위저드(JointForm) 다운로드 직전 "파일명 충돌" 사전 경고

   배경: 담보신탁 위저드(DocStep, 4b7c513)에는 다운로드 직전 "파일명 충돌" 사전 경고가
   있었으나, 공동사업표준협약서 위저드(JointForm)에는 없었다 — 같은 갑(시행사) 상호의 다른
   저장 계약은 다운로드명이 `공동사업표준협약서_{갑}.docx`(협약 제목 무관)로 같아, 브라우저가
   덮어쓰거나 "(1)" 자동부여로 산출 .docx/PDF 가 섞일 수 있다(신탁 서류=법적 효력 문서·정확성
   위험). 이미 마감한 .docx/PDF "받게 될 파일명" 미리보기(0427cd1·03973e9) 바로 옆에 DocStep
   과 동형의 충돌 경고를 두어, 생성 전에 섞임을 인지하게 한다(드리프트 0).

   변경(표시 전용·산출/검증/조문 무접촉):
     - JointForm.tsx: contractRepo(downloadKeyCollidesWithSaved·snapshotContracts·
       subscribeContracts·contractCount) + downloadKeyOf(lib/ui/download-key) import.
     - currentDownloadKey = downloadKeyOf({ doc_type: "joint", form_data: jointForm }) —
       내 계약 목록·DocStep 과 동일 단일 출처(joint 는 `joint:{gap.name}` 키).
     - savedCount(useSyncExternalStore 구독) + filenameCollision(useMemo,
       downloadKeyCollidesWithSaved) + 미리보기 아래 충돌 경고(role=status·var(--c-brown)·⚠).

   핵심 불변식:
     - ★표시 전용 — 산출물(docx/PDF 동작)·검증(validateJoint)·조문·엔진 무접촉(식별 키 비교만).
     - 경고는 차단이 아닌 안내(var(--c-brown), 차단 적색 아님) + role=status·aria-live=polite
       (입력 지점 advisory 패밀리 동형) + 새 CSS 0(field-hint + 인라인 style).
     - 정확성: 파일명은 갑(시행사) 상호로 정해져 협약 "제목"과 무관 — 받은 파일명 직접 변경을
       해소책으로 안내(내 계약 목록·DocStep 경고와 동일 출처).
     - 작성 중 계약 자신(currentContractId) 제외 + 저장 변경 구독(staleness 0).

   단언:
     (A) JointForm import — contractRepo 4종·downloadKeyOf·useSyncExternalStore·currentContractId
     (B) JointForm 배선 — currentDownloadKey(doc_type:"joint")·savedCount·filenameCollision·경고 게이트
     (C) 무접촉 — brown·role=status·⚠ aria-hidden·차단 적색 미사용·새 CSS 0·제목 무관 안내
     (D) 단일 출처 공존 — DocStep 충돌 경고·joint 파일명 미리보기(.docx/PDF) 보존
     (E) 충돌 경고 → 식별값(갑 상호) 1-클릭 점프 — focusFieldById·validate-jump 재사용(DocStep 20:01 joint 짝)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-joint-filename-collision-warning.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const __dir = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(join(__dir, "..", ...p), "utf8");
const joint = read("src", "components", "trust", "JointForm.tsx");
const docstep = read("src", "components", "trust", "steps", "DocStep.tsx");
const globals = read("src", "app", "globals.css");

console.log("\n[A] JointForm import — contractRepo 4종·downloadKeyOf·useSyncExternalStore·currentContractId");
{
  ok(/downloadKeyCollidesWithSaved,/.test(joint) &&
     /snapshotContracts,/.test(joint) &&
     /subscribeContracts,/.test(joint) &&
     /contractCount,/.test(joint) &&
     /from "@\/lib\/contractRepo"/.test(joint),
     "contractRepo 에서 downloadKeyCollidesWithSaved·snapshotContracts·subscribeContracts·contractCount import");
  ok(/import \{ downloadKeyOf \} from "@\/lib\/ui\/download-key"/.test(joint),
     "downloadKeyOf 는 lib/ui/download-key 단일 출처에서 import(목록·DocStep 과 동일)");
  ok(/useSyncExternalStore/.test(joint) && /from "react"/.test(joint),
     "react useSyncExternalStore import(저장 변경 구독)");
  ok(/currentContractId \} = useContractStore\(\)/.test(joint),
     "store 에서 currentContractId 구독(작성 중 계약 자기 제외)");
}

console.log("\n[B] JointForm 배선 — currentDownloadKey(doc_type:joint)·savedCount·filenameCollision·경고 게이트");
{
  ok(/downloadKeyOf\(\{ doc_type: "joint", form_data: jointForm \}\)/.test(joint),
     'currentDownloadKey = downloadKeyOf({ doc_type: "joint", form_data: jointForm })(joint 키 = joint:{gap.name})');
  ok(/useSyncExternalStore\(subscribeContracts, contractCount, \(\) => 0\)/.test(joint),
     "savedCount = useSyncExternalStore(subscribeContracts, contractCount, ()=>0)(staleness 0)");
  ok(/downloadKeyCollidesWithSaved\(snapshotContracts\(\), currentContractId, currentDownloadKey, downloadKeyOf\)/.test(joint),
     "filenameCollision = downloadKeyCollidesWithSaved(snapshotContracts(), currentContractId, currentDownloadKey, downloadKeyOf)");
  ok(/\{ok && filenameCollision && \(/.test(joint),
     "충돌 경고는 생성 가능(ok)·충돌(filenameCollision)일 때만 렌더(다운로드 직전)");
  ok(/다른 계약과 다운로드 파일명이 같아 받게 될 \.docx·PDF 가 섞일 수 있습니다/.test(joint),
     "경고 문구(받게 될 .docx·PDF 섞임 사전 고지)");
}

console.log("\n[C] 무접촉 — brown·role=status·⚠ aria-hidden·차단 적색 미사용·새 CSS 0·제목 무관");
{
  const at = joint.indexOf("{ok && filenameCollision && (");
  const block = joint.slice(at, at + 720);
  ok(/role="status"/.test(block) && /aria-live="polite"/.test(block),
     "경고: role=status·aria-live=polite(입력 지점 advisory 패밀리 동형)");
  ok(/color: "var\(--c-brown\)"/.test(block),
     "경고 색 = var(--c-brown)(막지 않는 안내 — 차단 적색 아님)");
  ok(/<span aria-hidden="true">⚠ <\/span>/.test(block),
     "⚠ 글리프만 aria-hidden(의미는 가시 텍스트)");
  ok(!/var\(--c-danger\)/.test(block),
     "경고에 차단 적색(--c-danger) 미사용");
  ok(/className="field-hint"/.test(block),
     "기존 field-hint 클래스 재사용(새 CSS 0)");
  ok(/협약 제목과 무관/.test(block),
     "정확성: 파일명은 협약 제목과 무관임을 명시(이름변경 오안내 차단)");
  ok(/받은 파일 이름을 직접 바꿔/.test(block),
     "정확성: 같은 계약이면 받은 파일명 직접 변경(actionable 해소책)");
  ok(!/joint-filename-collision/.test(globals) && !/wizard-collision/.test(globals),
     "globals.css 에 신규 충돌 전용 클래스 0");
}

console.log("\n[D] 단일 출처 공존 — DocStep 충돌 경고·joint 파일명 미리보기 보존");
{
  ok(/\{ok && filenameCollision && \(/.test(docstep),
     "DocStep(담보신탁) 충돌 경고 보존(joint 추가가 깨지 않음)");
  ok(/\{ok && docxFileName && \(/.test(joint),
     "joint .docx 받게 될 파일명 미리보기 보존(0427cd1)");
  ok(/\{ok && pdfFileName && \(/.test(joint),
     "joint PDF 받게 될 파일명 미리보기 보존(03973e9)");
}

console.log("\n[E] 충돌 경고 → 식별값(갑 상호) 1-클릭 점프 — focusFieldById·validate-jump 재사용");
{
  // 공유 동선 헬퍼(누락 점프 focusMissing 과 충돌 점프가 공유) — 모션 감축 존중·死점프 0.
  ok(/function focusFieldById\(id: string\)/.test(joint),
     "focusFieldById(id) 공유 헬퍼 존재(누락 점프·충돌 점프 단일 동선)");
  ok(/getElementById\(id\)/.test(joint) && /scrollIntoView/.test(joint) &&
     /\.focus\(\{ preventScroll: true \}\)/.test(joint),
     "focusFieldById: getElementById→scrollIntoView→focus(preventScroll)(DOM 부재면 무동작=死점프 0)");
  ok(/prefers-reduced-motion: reduce/.test(joint),
     "모션 감축(prefers-reduced-motion) 존중(WCAG 2.3.3)");
  ok(/function focusMissing\(label: string\)/.test(joint) &&
     /focusFieldById\(id\)/.test(joint),
     "focusMissing 도 focusFieldById 재사용(검증 게이트 누락 점프 보존)");

  // 충돌 경고 블록 안에 식별값 점프 ul/button — 갑 상호(joint-gapName) 단일 대상.
  const at = joint.indexOf("{ok && filenameCollision && (");
  const block = joint.slice(at, at + 1400);
  ok(/<ul className="validate-list"/.test(block),
     "충돌 경고 아래 validate-list 재사용(새 CSS 0)");
  ok(/className="validate-jump"/.test(block) &&
     /onClick=\{\(\) => focusFieldById\("joint-gapName"\)\}/.test(block),
     'validate-jump 버튼 onClick=focusFieldById("joint-gapName")(joint 키 식별값=갑 상호)');
  ok(/갑\(시행사\) 상호 확인하러 가기/.test(block),
     "점프 버튼 라벨 = 갑(시행사) 상호 확인하러 가기");
  ok(/<span className="validate-where">/.test(block),
     "validate-where 보조 라벨 재사용(검증 게이트 누락 점프와 동형)");
  // joint-gapName 은 실제 갑 상호 입력 id — 死점프가 아님을 단언.
  ok(/id="joint-gapName"/.test(joint) && /상호/.test(joint),
     "점프 대상 id=joint-gapName 가 실제 갑 상호 입력에 존재(死점프 0)");
}

console.log(`\n${fail === 0 ? "✅" : "❌"} joint-filename-collision-warning: ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
