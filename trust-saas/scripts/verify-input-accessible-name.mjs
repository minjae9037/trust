/* ============================================================
   회귀 가드 — placeholder-only 텍스트 컨트롤 접근명(aria-label) 부여

   배경(a11y·WCAG 4.1.2 Name·Role·Value / 3.3.2 Labels or Instructions / 1.3.1,
   비-산출물·표시 경계만): 위저드·앱 셸·상담 화면의 텍스트 입력 컨트롤 4곳이
   가시 라벨(<label htmlFor>)도, aria-label/aria-labelledby 도 없이 **placeholder
   만으로** 안내됐다 —
     ① ContractsView 「계약 검색」 input (placeholder "🔍 제목·위탁자·서류로 검색")
     ② AdvisorChat 「질문 입력」 textarea (placeholder "대체투자 실무 질문…")
     ③ ChatPanel 「AI 어시스턴트」 textarea (placeholder 동적)
     ④ TrustApp 「계약 제목」 저장 바 input (placeholder "계약 제목 (예: …)")
   ★placeholder 는 접근명 대체 수단이 아니다 — 입력을 시작하면 사라지고, 보조기술이
   placeholder 를 접근명으로 노출하는 동작이 일관되지 않는다(SR 가 빈 컨트롤로 낭독).
   같은 도구 모음·입력 행의 형제 컨트롤(정렬 select=aria-label "정렬", 상태 필터
   group=aria-label "상태 필터", 생성 중지 button=aria-label)은 이미 접근명을 가졌고
   이 4곳만 빠진 마지막 placeholder-only 갭.

   해결: 네 컨트롤에 행동/대상을 서술하는 aria-label 부여(placeholder·value·onChange·
   시각 전부 보존 = 시각 무변경, 접근명만 보강). 글리프-only 버튼 접근명
   (verify-icon-button-label) 과 같은 4.1.2 보강 계열.

   핵심 불변식:
     (A) ContractsView 검색 input = aria-label + placeholder/value/onChange 보존.
     (B) AdvisorChat 질문 textarea = aria-label + placeholder/배선 보존.
     (C) ChatPanel 질문 textarea = aria-label + 동적 placeholder/배선 보존.
     (D) TrustApp 제목 input = aria-label + placeholder/배선 보존.
     (E) 무회귀 — 이미 라벨된 컨트롤(DocStep htmlFor·StepLoanCalc/StepConditions/
         PartyCard aria-label)은 그대로 유지(이 갭의 대상 아님).

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-input-accessible-name.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const rd = (...p) => readFileSync(path.join(root, ...p), "utf8");
const contracts = rd("src", "components", "trust", "ContractsView.tsx");
const advisor = rd("src", "components", "advisor", "AdvisorChat.tsx");
const chat = rd("src", "components", "trust", "ChatPanel.tsx");
const app = rd("src", "components", "trust", "TrustApp.tsx");

// 컨트롤 블록을 placeholder/aria-label 마커로 격리한다.
const seg = (src, marker, back = 220, span = 220) => {
  const i = src.indexOf(marker);
  return i >= 0 ? src.slice(Math.max(0, i - back), i + span) : "";
};

console.log("\n[A] ContractsView 계약 검색 input — aria-label + placeholder 보존");
{
  const s = seg(contracts, 'placeholder="🔍 제목·위탁자·서류로 검색"');
  ok(s.length > 0, "검색 input 블록 존재");
  ok(/aria-label="계약 검색 \(제목·위탁자·서류\)"/.test(s), "aria-label(계약 검색) 부여");
  ok(/className="input"/.test(s), "className=input 보존");
  ok(/value=\{q\}/.test(s), "value={q} 배선 보존");
  ok(/onChange=\{\(e\) => setQ\(e\.target\.value\)\}/.test(s), "onChange setQ 배선 보존");
  ok(/placeholder="🔍 제목·위탁자·서류로 검색"/.test(s), "placeholder 보존(시각 무변경)");
}

console.log("\n[B] AdvisorChat 질문 textarea — aria-label + placeholder 보존");
{
  const s = seg(advisor, 'placeholder="대체투자 실무 질문을 입력하세요');
  ok(s.length > 0, "질문 textarea 블록 존재");
  ok(/aria-label="대체투자 실무 질문 입력"/.test(s), "aria-label(질문 입력) 부여");
  ok(/<textarea/.test(s), "textarea 컨트롤");
  ok(/value=\{input\}/.test(s), "value={input} 배선 보존");
  ok(/placeholder="대체투자 실무 질문을 입력하세요/.test(s), "placeholder 보존(시각 무변경)");
}

console.log("\n[C] ChatPanel 질문 textarea — aria-label + 동적 placeholder 보존");
{
  const s = seg(chat, 'aria-label="AI 어시스턴트 질문 입력"', 80, 480);
  ok(s.length > 0, "질문 textarea 블록 존재(aria-label 마커)");
  ok(/<textarea/.test(s), "textarea 컨트롤");
  ok(/className="input"/.test(s), "className=input 보존");
  ok(/value=\{input\}/.test(s), "value={input} 배선 보존");
  // 동적 placeholder(isJoint ? … : …) 가 그대로 존재 = 시각 무변경.
  ok(/placeholder=\{/.test(chat) && /isJoint/.test(chat), "동적 placeholder 보존(시각 무변경)");
}

console.log("\n[D] TrustApp 계약 제목 input — aria-label + placeholder 보존");
{
  const s = seg(app, 'placeholder="계약 제목 (예: 여주 홍문 담보신탁)"');
  ok(s.length > 0, "제목 input 블록 존재");
  ok(/aria-label="계약 제목"/.test(s), "aria-label(계약 제목) 부여");
  ok(/value=\{title\}/.test(s), "value={title} 배선 보존");
  ok(/onChange=\{\(e\) => setTitle\(e\.target\.value\)\}/.test(s), "onChange setTitle 배선 보존");
  ok(/placeholder="계약 제목 \(예: 여주 홍문 담보신탁\)"/.test(s), "placeholder 보존(시각 무변경)");
}

console.log("\n[E] 무회귀 — 이미 라벨된 컨트롤(이 갭 대상 아님)은 라벨 유지");
{
  const docstep = rd("src", "components", "trust", "steps", "DocStep.tsx");
  const loancalc = rd("src", "components", "trust", "steps", "StepLoanCalc.tsx");
  const cond = rd("src", "components", "trust", "steps", "StepConditions.tsx");
  const party = rd("src", "components", "trust", "steps", "PartyCard.tsx");
  ok(/<label className="field-label" htmlFor=\{fid\}>\{f\.label\}<\/label>/.test(docstep), "DocStep textarea/select/input = label htmlFor 유지");
  ok(/aria-label=\{`\$\{p\.name \|\| `우선수익자 \$\{i \+ 1\}`\} 대출금액`\}/.test(loancalc), "StepLoanCalc 대출금액 aria-label 유지");
  ok(/aria-label="대리금융기관 회사명"/.test(cond), "StepConditions 대리금융기관 aria-label 유지");
  ok(/aria-label=\{`\$\{partyIdLabel\(party\.type\)\} 앞자리`\}/.test(party), "PartyCard 등록번호 앞자리 aria-label 유지");
  // 정렬 select·상태 필터 group(이미 접근명)도 보존 = 검색 input 만 보강된 것 확인.
  ok(/aria-label="정렬"/.test(contracts), "정렬 select aria-label 보존(형제 패리티)");
  ok(/aria-label="상태 필터"/.test(contracts), "상태 필터 group aria-label 보존(형제 패리티)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
process.exit(fail === 0 ? 0 : 1);
