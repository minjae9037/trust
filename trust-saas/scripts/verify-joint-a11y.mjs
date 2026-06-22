/* ============================================================
   회귀 가드 — JointForm 라벨↔컨트롤 접근성 + 메시지성 live region 일관성

   배경(접근성 결함, 비-산출물): 담보신탁 1차 범위 입력 전면(네비 3종 +
   DocStep + STEP 입력 5종)의 라벨↔컨트롤 a11y 는 15:08·15:24·15:42 에
   마감됐으나, ①JointForm(공동사업표준협약서)은 1차 범위 외로 미정비라
   각 필드가 <div className="field-label"> + 이름 없는 컨트롤이었고
   ②메시지성 live region 표기가 불일치(amount-echo·loan-hangul 은
   aria-live 만, JointForm 생성 메시지는 둘 다 부재)했다.
   backlog "a11y 후속(잔여)" 항목을 동형 패턴으로 마감.

   수정 패턴(기존 a11y thread 와 동형):
     · 단일 라벨 컨트롤: <div className="field-label"> → <label htmlFor={id}> + 컨트롤 id
     · 복합 입력(법인등록번호 앞/뒤): 그룹 라벨 div id + role="group"
       aria-labelledby + 각 input 개별 aria-label
     · 메시지성 live region: role="status" + aria-live="polite" 동반 표기 통일

   ★범위: 산출물(DOCX/PDF)·조문·엔진·검증 게이트·데이터 모델 전부 무접촉
     — 입력 마크업의 라벨 시맨틱·live region 표기만 추가. setGap/setProject/
     updateJoint onChange 경로 전부 무변경.

   실행:
     cd trust-saas
     node scripts/verify-joint-a11y.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");
const joint = read("src/components/trust/JointForm.tsx");
const docStep = read("src/components/trust/steps/DocStep.tsx");
const loan = read("src/components/trust/steps/StepLoanCalc.tsx");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

// field-label 을 가진 <div> 중 id 가 없는 것(=무연결 라벨) 추출
const orphanDivLabels = (src) =>
  (src.match(/<div className="field-label"(?:\s+style=\{[^}]*\})?\s*>/g) || []).filter(
    (d) => !/id=/.test(d),
  );

console.log("=== JointForm 라벨↔컨트롤 접근성 + live region 일관성 검증 ===\n");

// ──────────────────────────────────────────────
// (A) JointForm 단일 라벨 컨트롤: <label htmlFor> + 컨트롤 id 페어
// ──────────────────────────────────────────────
console.log("[JointForm 단일 라벨↔컨트롤]");
const singleFields = [
  "joint-gapName",
  "joint-gapRepDir",
  "joint-gapAddress",
  "joint-representative",
  "joint-projectName",
  "joint-projectSite",
  "joint-projectScaleUse",
  "joint-agreementYear",
  "joint-agreementMonth",
  "joint-agreementDay",
];
for (const id of singleFields) {
  ok(
    new RegExp(`<label className="field-label" htmlFor="${id}">`).test(joint) &&
      new RegExp(`id="${id}"`).test(joint),
    `(A) <label htmlFor="${id}"> + 컨트롤 id 페어`,
  );
}

// ──────────────────────────────────────────────
// (B) 법인등록번호 복합 입력: 그룹 라벨 id + role=group aria-labelledby + 개별 aria-label
// ──────────────────────────────────────────────
console.log("\n[JointForm 복합 입력(법인등록번호)]");
ok(
  /<div className="field-label" id="joint-gapCorpReg">/.test(joint),
  "(B1) 법인등록번호 그룹 라벨 div id=joint-gapCorpReg",
);
ok(
  /role="group" aria-labelledby="joint-gapCorpReg"/.test(joint),
  "(B2) 법인등록번호 컨테이너 role=group aria-labelledby",
);
ok(
  /aria-label="법인등록번호 앞자리"/.test(joint) && /aria-label="법인등록번호 뒷자리"/.test(joint),
  "(B3) 앞/뒤 input 개별 aria-label",
);

// ──────────────────────────────────────────────
// (C) 무연결 div.field-label 잔존 0 — 복합 그룹 라벨(id) 외 전부 label 화
// ──────────────────────────────────────────────
console.log("\n[JointForm 무연결 라벨 잔존]");
ok(
  orphanDivLabels(joint).length === 0,
  `(C) JointForm 무연결 <div className="field-label"> 잔존 0 (실제 ${orphanDivLabels(joint).length})`,
);

// ──────────────────────────────────────────────
// (D) 메시지성 live region: role="status" + aria-live="polite" 일관 표기
// ──────────────────────────────────────────────
console.log("\n[메시지성 live region 일관성]");
// JointForm 생성 메시지 — 낭독 책임이 상단 SR 영속 라이브 영역(genLiveStatus)으로 이전됐다
// (verify-joint-livestatus 가 영속 영역 자체를 단언). 여기선 ①영속 영역이 role=status+aria-live
// 를 갖고 ②하단 stale/msg 시각 span 은 role=status/aria-live 미부착(중복 낭독 0)임을 확인한다.
ok(
  /<div className="sr-only" role="status" aria-live="polite" aria-atomic="true">\s*\{genLiveStatus\}/.test(joint),
  "(D1a) JointForm SR 영속 라이브 영역(genLiveStatus): role=status + aria-live=polite + aria-atomic",
);
ok(
  /freshness === "stale" \? \(\s*<span className="field-hint" style=/.test(joint) &&
    /msg && <span className="field-hint" style=\{\{ color: "var\(--c-blue-deep\)" \}\}><StatusGlyphText/.test(joint),
  "(D1b) JointForm stale/msg 시각 span 은 role=status/aria-live 미부착(낭독은 영속 영역 전담)",
);
// DocStep amount-echo
ok(
  /<div className="amount-echo" role="status" aria-live="polite">/.test(docStep),
  "(D2) DocStep amount-echo: role=status + aria-live=polite",
);
// StepLoanCalc loan-hangul (대출금액 행 — 조건부 렌더)
ok(
  /<div className="loan-hangul" role="status" aria-live="polite">/.test(loan),
  "(D3) StepLoanCalc loan-hangul: role=status + aria-live=polite",
);
// ★일관성 불변식: aria-live 를 가진 메시지성 요소는 role="status" 도 동반(고아 aria-live 0)
//   — amount-echo·loan-hangul·JointForm msg 가 aria-live 만 갖고 role 누락이던 회귀 차단.
const loneAriaLive = (src, cls) => {
  const re = new RegExp(`className="${cls}"[^>]*aria-live="polite"`);
  const m = src.match(re);
  return m ? /role="status"/.test(m[0]) : true; // 해당 요소 없으면 통과
};
ok(
  loneAriaLive(docStep, "amount-echo") && loneAriaLive(loan, "loan-hangul"),
  "(D4) ★고아 aria-live 0 — amount-echo·loan-hangul 가 aria-live 만 갖던 회귀 차단",
);

// ──────────────────────────────────────────────
// (E) 무회귀 — onChange/데이터 경로 보존(시맨틱만 추가)
// ──────────────────────────────────────────────
console.log("\n[무회귀: 데이터 경로 보존]");
ok(
  /setGap\(\{ name: e\.target\.value \}\)/.test(joint) &&
    /setProject\(\{ name: e\.target\.value \}\)/.test(joint) &&
    /updateJoint\(\{ representative:/.test(joint),
  "(E) setGap·setProject·updateJoint onChange 경로 보존",
);

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
