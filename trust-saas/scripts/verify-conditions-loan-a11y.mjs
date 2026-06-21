/* ============================================================
   회귀 가드 — StepConditions · StepLoanCalc 라벨↔컨트롤 접근성 계약

   배경(접근성 결함, 비-산출물): 15:08 에 담보신탁 1차 범위 주 입력 STEP 3종
   (StepBasic · StepProperty · PartyCard)의 라벨↔컨트롤 a11y 가 정비됐으나,
   같은 위저드의 ①StepConditions(계약 조건·특약, 재사용 Section 컴포넌트의
   헤딩형 field-label·라벨 없는 collateralType/majorityCriteria/builderName/
   licenseType select·담보보수 라디오) ②StepLoanCalc(우선수익한도 비율 label
   미연결·표 내 행별 대출금액 input 접근명 부재)는 미정비로 남아 있었다
   (B2B 법률서류 SaaS = 웹접근성 요구). DocStep·STEP 3종과 동일 저위험 패턴으로 정비.
   JointForm(공동사업)은 1차 범위 외로 본 가드 제외.

   수정 패턴(기존 a11y thread 와 동형):
     · 단일 라벨 컨트롤: <div className="field-label"> → <label htmlFor={id}> + 컨트롤 id
     · Section 헤딩이 유일 컨트롤을 라벨링: Section 에 id 부여(헤딩 div id) +
       그 컨트롤에 aria-labelledby={id}
     · 라디오 묶음: 라벨 div id + 컨테이너 role="radiogroup" aria-labelledby
     · 표 내 반복 입력(행별): 단일 라벨 부적합 → input 에 aria-label(행 식별 포함)

   ★범위: 산출물(DOCX/PDF)·조문·엔진·검증 게이트·데이터 모델 전부 무접촉
     — 입력 마크업의 라벨 시맨틱만 추가. 조문 자동반영 분기(majorityCriteria·
     agentBank·includeArt21·builderName)·프로파일 기록 키 값/onChange 전부 무변경.

   실행:
     cd trust-saas
     node scripts/verify-conditions-loan-a11y.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");
const cond = read("src/components/trust/steps/StepConditions.tsx");
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

console.log("=== StepConditions · StepLoanCalc 라벨↔컨트롤 접근성 검증 ===\n");

// ──────────────────────────────────────────────
// StepLoanCalc
// ──────────────────────────────────────────────
console.log("[StepLoanCalc]");
// (A) 우선수익한도 비율: <label htmlFor="loan-priorityRatio"> + input id
ok(
  /<label htmlFor="loan-priorityRatio"/.test(loan) && /id="loan-priorityRatio"/.test(loan),
  '(A) StepLoanCalc 우선수익한도 비율: <label htmlFor="loan-priorityRatio"> + input id',
);
// (B) 표 행별 대출금액 input aria-label(행 식별 포함 — 이름 없으면 NO 로 폴백)
ok(
  /aria-label=\{`\$\{p\.name \|\| `우선수익자 \$\{i \+ 1\}`\} 대출금액`\}/.test(loan),
  "(B) StepLoanCalc 표 행별 대출금액 input aria-label(회사명 또는 '우선수익자 N')",
);

// ──────────────────────────────────────────────
// StepConditions
// ──────────────────────────────────────────────
console.log("\n[StepConditions]");
// (C) Section 컴포넌트가 id 를 받아 헤딩 div 에 부여(필수 prop)
ok(
  /function Section\(\{ id, title, hint, badge, children \}: \{\s*id: string;/.test(cond),
  "(C0) Section 컴포넌트 id 필수 prop",
);
ok(
  /<div className="field-label" id=\{id\}/.test(cond),
  "(C1) Section 헤딩 div 에 id={id} 부여",
);
// (C2) 8개 Section 전부 id 명시(헤딩 라벨링 가능)
const sectionIds = [
  "cond-collateralType",
  "cond-priorityStruct",
  "cond-majorityCriteria",
  "cond-agentBank",
  "cond-art21",
  "cond-disposal",
  "cond-fee",
  "cond-collateralOrder",
];
for (const sid of sectionIds) {
  ok(new RegExp(`<Section id="${sid}"`).test(cond), `(C2) <Section id="${sid}"> 명시`);
}

// (D) 헤딩이 유일 컨트롤을 라벨링하는 select: aria-labelledby = Section id
ok(
  /<select className="select" aria-labelledby="cond-collateralType"/.test(cond),
  "(D1) collateralType select aria-labelledby=cond-collateralType",
);
ok(
  /<select className="select" aria-labelledby="cond-majorityCriteria"/.test(cond),
  "(D2) majorityCriteria select aria-labelledby=cond-majorityCriteria",
);

// (E) 인허가 하위 단일 라벨 select: <label htmlFor> + 컨트롤 id
ok(
  /<label className="field-label" htmlFor="cond-builderName">/.test(cond) &&
    /<select id="cond-builderName"/.test(cond),
  "(E1) 건축주 명의: <label htmlFor=cond-builderName> + select id",
);
ok(
  /<label className="field-label" htmlFor="cond-licenseType">/.test(cond) &&
    /<select id="cond-licenseType"/.test(cond),
  "(E2) 인허가 유형: <label htmlFor=cond-licenseType> + select id",
);

// (F) 대리금융기관 회사명 input aria-label
ok(
  /aria-label="대리금융기관 회사명"/.test(cond),
  "(F) 대리금융기관 회사명 input aria-label",
);

// (G) 라디오 묶음: 라벨 id + role=radiogroup aria-labelledby
ok(
  /<div className="field-label" id="cond-feePayer">/.test(cond) &&
    /role="radiogroup" aria-labelledby="cond-feePayer"/.test(cond),
  "(G1) 담보보수 납부 주체: 라벨 div id + role=radiogroup aria-labelledby",
);
ok(
  /role="radiogroup" aria-labelledby="cond-collateralOrder"/.test(cond),
  "(G2) 담보 차수: role=radiogroup aria-labelledby=cond-collateralOrder(Section 헤딩)",
);

// (H) 무연결 div.field-label 잔존 0 — 헤딩(id={id})·feePayer(id) 외 전부 label 화
ok(
  orphanDivLabels(cond).length === 0,
  `(H) StepConditions 무연결 <div className="field-label"> 잔존 0 (실제 ${orphanDivLabels(cond).length})`,
);

// (I) 무회귀 — 조문 자동반영 분기 키 onChange 가 그대로 보존(데이터 경로 무변경)
ok(
  /set\(\{ collateralType: e\.target\.value/.test(cond) &&
    /set\(\{ majorityCriteria: e\.target\.value/.test(cond) &&
    /set\(\{ builderName: e\.target\.value/.test(cond) &&
    /set\(\{ licenseType: e\.target\.value/.test(cond),
  "(I) 무회귀: collateralType·majorityCriteria·builderName·licenseType onChange 경로 보존",
);

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
