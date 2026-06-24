/* ============================================================
   회귀 가드 — 우선수익자 대출금액 입력했는데 피담보채권 채무자·문구(별첨2) 미입력 입력 지점 교차검증 advisory

   배경: 우선수익자(PartyCard showLoanFields)에 대출금액(loanAmount)을 입력하면 그 우선수익자는
   별첨2 가.우선수익자 표에 기재되는 활성 당사자다. 신탁본문 제1조 정의상 "피담보채권"="별첨2에
   적힌 것"·"채무자"="별첨2에 적힌 자"로, 이 둘은 신탁이 담보하는 채권을 특정하는 법적 핵심 항목이다.
   그러나 피담보채권 채무자(claimDebtor)·피담보채권 문구(securedClaim)는 게이트(validateDoc)가
   검사하지 않아(loanAmount>0 만 검사), 대출금액만 채우고 두 칸을 비워 두면 별첨2 가.우선수익자 표의
   채무자·피담보채권 칸이 빈칸으로 출력된다(builders.js HTML 별첨2 muted 플레이스홀더·DOCX 빈 셀).
   DocStep uboDistinctNameMissing(다름인데 성명 빈칸) 완결성 advisory 와 동형의 보완 갈래로, 거기는
   ubo 성명 빈칸을, 여기는 우선수익자 별첨2 채무자·피담보채권 빈칸을 되짚는다. 세 기존 입력
   (loanAmount·claimDebtor·securedClaim) 파생일 뿐 차단·조문·산출물 무관(막지 않는 되짚음).

   핵심 불변식:
     - ★표시 전용 — 게이트(validate)·빌더(builders.js)·조문 무접촉(차단 아님).
       claimDebtorMissing·securedClaimMissing 은 기존 입력 파생일 뿐 어느 산출물·게이트에도 영향 0.
       새 상태/모델/엔진 무접촉.
     - 조건 = loanActive(=isPositiveAmount(loanAmount)) && (claimDebtor/securedClaim 비어 있음/공백).
       ★false-positive 방지: 대출금액이 양수일 때만(미입력·무효 loanInvalid 행은 미표출), 해당 칸이
       한 글자라도 있으면 미표출(작성 완료로 간주). showLoanFields(우선수익자) 한정 렌더.
     - role=status·aria-live=polite(동적 출현 SR 고지) + 선두 ⚠ 글리프 aria-hidden
       (장식 글리프 접근명 오염 0 — 기존 컨벤션).
     - 기존 클래스(field-hint) 재사용 + 인라인 style 만 — 새 CSS 0.
     - 색 = var(--c-brown) 토큰(차단 적색 var(--c-danger) 아님 — 검토 신호).

   단언:
     (A) PartyCard 배선 — 조건·문구·role=status·aria-hidden 글리프·field-hint·brown
     (B) 단일 출처/모델 계약 — Party.loanAmount/claimDebtor/securedClaim + isPositiveAmount
     (C) 무회귀 — loanInvalid 인라인·loan-hangul readback·claimDebtor/securedClaim 입력·advisory 패밀리 보존
     (D) 무접촉 — validate/builders 에 advisory 문구 미혼입·globals 새 클래스 0·차단 적색 미사용

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-priority-securedclaim-missing-advisory.mjs
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
const card = read("src", "components", "trust", "steps", "PartyCard.tsx");
const model = read("src", "lib", "engine", "model.ts");
const validate = read("src", "lib", "engine", "validate.ts");
const builders = read("src", "lib", "engine", "docx", "builders.js");
const globals = read("src", "app", "globals.css");

console.log("\n[A] PartyCard 배선 — 조건·문구·role=status·aria-hidden 글리프·field-hint·brown");
{
  ok(/const loanActive = isPositiveAmount\(party\.loanAmount\);/.test(card),
     "loanActive = isPositiveAmount(party.loanAmount)(활성 우선수익자 단일 출처)");
  ok(/const claimDebtorMissing = loanActive && String\(party\.claimDebtor \?\? ""\)\.trim\(\)\.length === 0;/.test(card),
     "claimDebtorMissing = loanActive && 채무자 빈칸/공백(★대출금액 양수일 때만 — false-positive 방지)");
  ok(/const securedClaimMissing = loanActive && String\(party\.securedClaim \?\? ""\)\.trim\(\)\.length === 0;/.test(card),
     "securedClaimMissing = loanActive && 피담보채권 문구 빈칸/공백");
  // advisory 본문 — 빈칸 사실 + 별첨2 출력 영향 + 입력 권유(차단 아님)
  ok(/대출금액을 입력한 우선수익자인데 피담보채권 채무자가 비어 있습니다 — 별첨2 가\.우선수익자 표의 채무자 칸이 빈칸으로 출력됩니다\./.test(card),
     "채무자 advisory 본문 = 대출금액 있는데 채무자 빈칸 → 별첨2 채무자 칸 빈칸 되짚음");
  ok(/대출금액을 입력한 우선수익자인데 피담보채권 문구가 비어 있습니다 — 별첨2 가\.우선수익자 표의 피담보채권 칸이 빈칸으로 출력됩니다\./.test(card),
     "피담보채권 문구 advisory 본문 = 대출금액 있는데 문구 빈칸 → 별첨2 피담보채권 칸 빈칸 되짚음");
  ok(/이 우선수익자의 피담보채권에 관한 채무자를 입력하세요\./.test(card)
     && /신탁이 담보하는 채권을 특정해 입력하세요\./.test(card),
     "막지 않고(차단 아님) 두 칸 각각 입력 권유(사용자 선택 보존)");
  const advC = card.slice(card.indexOf("{claimDebtorMissing && ("));
  ok(/role="status" aria-live="polite"/.test(advC.slice(0, 700))
     && /<span aria-hidden="true">⚠ <\/span>/.test(advC.slice(0, 700)),
     "채무자 advisory role=status·aria-live=polite + 선두 ⚠ 글리프 aria-hidden(접근명 오염 0)");
  const advS = card.slice(card.indexOf("{securedClaimMissing && ("));
  ok(/role="status" aria-live="polite"/.test(advS.slice(0, 700))
     && /<span aria-hidden="true">⚠ <\/span>/.test(advS.slice(0, 700)),
     "피담보채권 advisory role=status·aria-live=polite + 선두 ⚠ 글리프 aria-hidden(접근명 오염 0)");
  ok(/\{claimDebtorMissing && \(\s*<div className="field-hint" role="status" aria-live="polite"/.test(card)
     && /\{securedClaimMissing && \(\s*<div className="field-hint" role="status" aria-live="polite"/.test(card),
     "field-hint 기존 클래스 재사용(두 advisory 모두 — 새 클래스 0)");
  ok(advC.slice(0, 700).includes("var(--c-brown)") && advS.slice(0, 700).includes("var(--c-brown)"),
     "advisory 색 = var(--c-brown) 토큰(차단 적색 아님·기존 advisory 와 동형)");
  ok(!advC.slice(0, 700).includes("var(--c-danger)") && !advS.slice(0, 700).includes("var(--c-danger)"),
     "advisory 는 차단 적색(var(--c-danger)) 미사용 — 검토 신호일 뿐 차단 아님");
}

console.log("\n[B] 단일 출처/모델 계약 — Party.loanAmount/claimDebtor/securedClaim + isPositiveAmount");
{
  ok(/loanAmount: string;/.test(model), "model Party 에 loanAmount 필드 존재(파생 입력 계약 보존)");
  ok(/claimDebtor: string;/.test(model), "model Party 에 claimDebtor 필드 존재(별첨2 채무자 계약 보존)");
  ok(/securedClaim: string;/.test(model), "model Party 에 securedClaim 필드 존재(별첨2 피담보채권 계약 보존)");
  ok(/import \{[^}]*\bisPositiveAmount\b[^}]*\} from "@\/lib\/engine\/calc"/.test(card),
     "calc 에서 isPositiveAmount import(loanInvalid 게이트와 같은 단일 출처 — 판정 불일치 0)");
  // 우선수익자 전용 렌더 스코프 — showLoanFields 블록 안에서만 두 advisory 가 표출
  ok(/showLoanFields && \(/.test(card) && card.indexOf("{claimDebtorMissing && (") > card.indexOf("showLoanFields && ("),
     "claimDebtorMissing advisory 는 showLoanFields(우선수익자 전용) 블록 안에서 렌더");
}

console.log("\n[C] 무회귀 — loanInvalid 인라인·loan-hangul readback·claimDebtor/securedClaim 입력·advisory 패밀리 보존");
{
  ok(/유효하지 않은 금액입니다 — 이 값으로는 서류를 생성할 수 없습니다\./.test(card),
     "대출금액 무효 인라인 오류(loanInvalid) 보존");
  ok(/\{parseAmount\(party\.loanAmount\) > 0 && \(\s*<div className="loan-hangul"/.test(card),
     "대출금액 한글 금액 readback 보존");
  ok(/htmlFor=\{fid\("claimDebtor"\)\}/.test(card) && /set\(\{ claimDebtor: e\.target\.value \}\)/.test(card),
     "피담보채권 채무자 입력 필드·배선 보존");
  ok(/htmlFor=\{fid\("securedClaim"\)\}/.test(card) && /set\(\{ securedClaim: e\.target\.value \}\)/.test(card),
     "피담보채권 문구 입력 필드·배선 보존");
  ok(/const birthReadback =/.test(card) && /const bizInvalid =/.test(card),
     "기타 PartyCard 인라인 확인(birthReadback·bizInvalid) 패밀리 공존");
}

console.log("\n[D] 무접촉 — validate/builders 에 advisory 문구 미혼입·globals 새 클래스 0·차단 적색 미사용");
{
  ok(!/별첨2 가\.우선수익자 표의 채무자 칸이 빈칸으로 출력됩니다|별첨2 가\.우선수익자 표의 피담보채권 칸이 빈칸으로 출력됩니다/.test(validate),
     "validate.ts(게이트)에 advisory 문구 미혼입 — 차단/검증 대상 아님(표시 전용)");
  ok(!/별첨2 가\.우선수익자 표의 채무자 칸이 빈칸으로 출력됩니다|별첨2 가\.우선수익자 표의 피담보채권 칸이 빈칸으로 출력됩니다/.test(builders),
     "builders.js(산출물)에 advisory 문구 미혼입 — 조문·표 미변경(표시 전용)");
  ok(!/priority-?securedclaim|claimDebtorMissing|securedClaimMissing/.test(globals),
     "globals.css 에 advisory 전용 새 클래스 0(field-hint 재사용)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
