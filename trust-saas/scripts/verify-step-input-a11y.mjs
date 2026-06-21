/* ============================================================
   회귀 가드 — STEP 입력 컴포넌트 라벨↔컨트롤 접근성 계약
   (StepBasic · StepProperty · PartyCard)

   배경(접근성 결함, 비-산출물): 14:50 에 DocStep(7종 서류 generic 입력면)의
   라벨↔컨트롤 a11y(htmlFor/id) 가 정비됐으나, 담보신탁 1차 범위의 **STEP 입력
   컴포넌트**(계약 기본정보 StepBasic · 신탁부동산 StepProperty · 당사자 PartyCard)는
   여전히 각 필드를 `<div className="field-label">…</div>` + 이름 없는 컨트롤로
   렌더해 ①라벨 클릭 포커스 불가 ②스크린리더 접근명 부재의 결함이 남아 있었다
   (B2B 법률서류 SaaS = 웹접근성 요구). DocStep 과 동일한 저위험 패턴으로 정비.

   수정 패턴(DocStep 과 동형):
     · 단일 컨트롤: <div className="field-label"> → <label … htmlFor={id}> + 컨트롤 id
     · 복합(년·월·일 / 식별번호 앞·뒤 / 사업자번호 3칸): 단일 htmlFor 부적합 →
       그룹 라벨 div 에 id + 컨트롤 묶음에 role="group" aria-labelledby,
       각 컨트롤엔 개별 aria-label(스크린리더 접근명)

   ★범위: 산출물(DOCX/PDF)·조문·엔진·검증 게이트·데이터 모델 전부 무접촉
     — 입력 마크업의 라벨 시맨틱만 div→label + id/aria 부여. StepConditions(섹션
     헤딩형 field-label·Section 컴포넌트)·StepLoanCalc(표 입력)·JointForm(공동사업,
     1차 범위 외)은 별도 후속.

   실행:
     cd trust-saas
     node scripts/verify-step-input-a11y.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");
const basic = read("src/components/trust/steps/StepBasic.tsx");
const prop = read("src/components/trust/steps/StepProperty.tsx");
const party = read("src/components/trust/steps/PartyCard.tsx");

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

console.log("=== STEP 입력 컴포넌트 라벨↔컨트롤 접근성 검증 ===\n");

// ──────────────────────────────────────────────
// StepBasic
// ──────────────────────────────────────────────
console.log("[StepBasic]");
// (A) 단일 컨트롤 4종: <label htmlFor="basic-X"> + 컨트롤 id="basic-X"
for (const k of ["priorityLimit", "trustFee", "trustFeeRate", "trustPeriod"]) {
  ok(
    new RegExp(`<label className="field-label" htmlFor="basic-${k}"`).test(basic) &&
      new RegExp(`id="basic-${k}"`).test(basic),
    `(A) StepBasic ${k}: <label htmlFor="basic-${k}"> + 컨트롤 id`,
  );
}
// (B) 체결일자 복합: 그룹 라벨 id + role=group aria-labelledby + 년·월·일 aria-label
ok(
  /<div className="field-label" id="basic-contractDate">/.test(basic),
  "(B1) StepBasic 체결일자 그룹 라벨 div id=basic-contractDate",
);
ok(
  /role="group" aria-labelledby="basic-contractDate"/.test(basic),
  "(B2) StepBasic 체결일자 select 묶음 role=group + aria-labelledby",
);
ok(
  /aria-label="년"/.test(basic) && /aria-label="월"/.test(basic) && /aria-label="일"/.test(basic),
  "(B3) StepBasic 년·월·일 select 개별 aria-label",
);
// (C) 무연결 div.field-label 잔존 0 (그룹 라벨은 id 보유라 제외)
ok(
  orphanDivLabels(basic).length === 0,
  `(C) StepBasic 무연결 <div className="field-label"> 잔존 0 (실제 ${orphanDivLabels(basic).length})`,
);

// ──────────────────────────────────────────────
// StepProperty (속성 카드 idx i 별 고유 id)
// ──────────────────────────────────────────────
console.log("\n[StepProperty]");
for (const k of ["address", "category", "area", "regNo"]) {
  ok(
    new RegExp("htmlFor=\\{`prop-\\$\\{i\\}-" + k + "`\\}").test(prop) &&
      new RegExp("id=\\{`prop-\\$\\{i\\}-" + k + "`\\}").test(prop),
    `(A) StepProperty ${k}: <label htmlFor={\`prop-\${i}-${k}\`}> + 컨트롤 id`,
  );
}
ok(
  orphanDivLabels(prop).length === 0,
  `(C) StepProperty 무연결 <div className="field-label"> 잔존 0 (실제 ${orphanDivLabels(prop).length})`,
);

// ──────────────────────────────────────────────
// PartyCard (role·idx 별 고유 id)
// ──────────────────────────────────────────────
console.log("\n[PartyCard]");
// (A0) fid 단일 출처 패턴
ok(
  /const fid = \(key: string\) => `party-\$\{role\}-\$\{idx\}-\$\{key\}`/.test(party),
  "(A0) PartyCard fid 단일 출처 = `party-${role}-${idx}-${key}`",
);
// (A) 단일 컨트롤: <label htmlFor={fid("X")}> + 컨트롤 id={fid("X")}
for (const k of ["type", "name", "repDir", "insDir", "address", "contact", "loanAmount", "claimDebtor", "securedClaim"]) {
  ok(
    new RegExp(`htmlFor=\\{fid\\("${k}"\\)\\}`).test(party) &&
      new RegExp(`id=\\{fid\\("${k}"\\)\\}`).test(party),
    `(A) PartyCard ${k}: <label htmlFor={fid("${k}")}> + 컨트롤 id`,
  );
}
// (B) 복합 식별번호(regid)·사업자번호(biz): 그룹 라벨 div id + role=group aria-labelledby
for (const g of ["regid", "biz"]) {
  ok(
    new RegExp(`<div className="field-label" id=\\{fid\\("${g}"\\)\\}`).test(party) &&
      new RegExp(`role="group" aria-labelledby=\\{fid\\("${g}"\\)\\}`).test(party),
    `(B) PartyCard ${g} 복합: 그룹 라벨 id + role=group aria-labelledby`,
  );
}
// (B2) 복합 하위 input 개별 aria-label (식별번호 앞/뒤 + 사업자번호 3칸)
ok(
  /aria-label=\{`\$\{partyIdLabel\(party\.type\)\} 앞자리`\}/.test(party) &&
    /aria-label=\{`\$\{partyIdLabel\(party\.type\)\} 뒷자리`\}/.test(party),
  "(B2) PartyCard 식별번호 앞/뒤 input aria-label (type 분기 동적)",
);
ok(
  /aria-label="사업자등록번호 앞 3자리"/.test(party) &&
    /aria-label="사업자등록번호 가운데 2자리"/.test(party) &&
    /aria-label="사업자등록번호 뒤 5자리"/.test(party),
  "(B3) PartyCard 사업자등록번호 3칸 개별 aria-label",
);
// (C) 무연결 div.field-label 잔존 0 — 복합 그룹 라벨 2개(regid·biz)는 id 보유라 제외
ok(
  orphanDivLabels(party).length === 0,
  `(C) PartyCard 무연결 <div className="field-label"> 잔존 0 (실제 ${orphanDivLabels(party).length})`,
);
// (C2) 남은 div.field-label 은 복합 그룹 라벨 2곳(id 보유)뿐
const partyDivLabels = party.match(/<div className="field-label"[^>]*>/g) || [];
ok(
  partyDivLabels.length === 2 && partyDivLabels.every((d) => /id=\{fid\(/.test(d)),
  `(C2) PartyCard 남은 div.field-label 은 복합 그룹 라벨 2곳(id) 뿐 (실제 ${partyDivLabels.length})`,
);

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
