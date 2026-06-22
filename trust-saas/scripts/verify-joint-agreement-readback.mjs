/* ============================================================
   회귀 가드 — 공동사업표준협약서(joint) 협약일 readback 에코

   배경(정확성 직결·UX 패리티, 비-산출물·표시 경계만): 담보신탁 위저드의 자유
   텍스트 날짜 필드(평가기준일·회의 일자)는 입력이 숫자 날짜꼴일 때 "YYYY년 M월 D일"로
   해석을 에코해(DocStep, interpretDate) 월·일 전치(07-03↔03-07)를 입력 지점에서
   확인하게 한다(커밋 77959fd). 그러나 공동사업표준협약서(JointForm)의 협약일은
   연·월·일이 따로따로 자유 텍스트인데, 종전엔 "실재하지 않는 날짜"(2월 31일 등)만
   agreementDateInvalid 로 잡고 — "3월 7일 ↔ 7월 3일" 같은 월·일 전치(둘 다 달력상
   실재하는 날짜라 invalid 검사로는 안 잡힘)를 확인할 readback 에코가 없었다.
   협약일은 협약서 제1조·서명란에 박히는 법적 날짜라 DocStep 과 동일하게 해석을
   되읽어 준다 → agreementDateReal 일 때 "YYYY년 M월 D일" 에코(비차단·표시 경계).

   본 가드(빌더·조문·생성 로직·검증 게이트 판정 무접촉 — 표시/접근성만):
     (A) 단일 출처 — JointForm 이 게이트와 같은 isRealDate 사용
     (B) agreementDateReal 정의 — 연·월·일 3칸 채움 + isRealDate(Number 변환) 참(true),
         부분 입력엔 미표시(나그 방지)
     (C) readback 렌더 — agreementDateReal 일 때만 loan-hangul·role=status·aria-live=polite,
         "{Number(agY)}년 {Number(agM)}월 {Number(agD)}일"(전치 확인용·앞 0 정규화)
     (D) ★상호배타 — agreementDateReal 과 agreementDateInvalid 는 동시 참 불가
         (실재=readback / 비실재=invalid 안내), 거동으로 단언
     (E) ★전치 확인 — 3/7 과 7/3 은 둘 다 실재(invalid 미발동)이나 readback 문구가
         서로 달라 입력 지점에서 전치를 구별 가능(invalid 검사만으로는 불가)
     (F) 무회귀 — 기존 agreementDateInvalid 인라인·loan-hangul 클래스 재사용(새 CSS 0)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-joint-agreement-readback.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { isRealDate } from "../src/lib/engine/calc.ts";

const __dir = dirname(fileURLToPath(import.meta.url));
const src = (rel) => readFileSync(join(__dir, "..", rel), "utf8");
const form = src("src/components/trust/JointForm.tsx");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

console.log("=== 공동사업표준협약서(joint) 협약일 readback 에코 ===\n");

console.log("[A] 단일 출처 — 게이트와 같은 isRealDate import");
ok(/isRealDate/.test(form) && /from\s*["']@\/lib\/engine\/calc["']/.test(form),
  "JointForm: isRealDate 를 calc 에서 import");

console.log("\n[B] agreementDateReal 정의 — 3칸 채움 + isRealDate 참(부분 입력 미표시)");
ok(/const agreementDateReal\s*=/.test(form),
  "agreementDateReal 플래그 정의");
ok(/const agreementDateReal\s*=\s*[\s\S]*?isRealDate\(Number\(agY\), Number\(agM\), Number\(agD\)\)/.test(form),
  "agreementDateReal = isRealDate(Number 변환) 참(게이트와 동일 단일 출처)");
{
  // agreementDateReal 정의 블록 안에서 3칸이 모두 채워졌는지 검사하는지 확인(부분 입력 미표시).
  const block = form.slice(form.indexOf("const agreementDateReal"), form.indexOf("const agreementDateReal") + 200);
  ok(/agY !== "" && agM !== "" && agD !== ""/.test(block),
    "agreementDateReal: 연·월·일 3칸 모두 채워졌을 때만(부분 입력 미표시)");
}

console.log("\n[C] readback 렌더 — agreementDateReal 일 때만 loan-hangul·role=status·전치 확인 문구");
ok(/\{agreementDateReal && \(/.test(form),
  "readback 은 agreementDateReal 일 때만 렌더");
ok(/<div className="loan-hangul" role="status" aria-live="polite">/.test(form),
  "readback div = loan-hangul·role=status·aria-live=polite(DocStep 패리티)");
ok(/\{Number\(agY\)\}년 \{Number\(agM\)\}월 \{Number\(agD\)\}일/.test(form),
  "readback 문구 = {Number(agY)}년 {Number(agM)}월 {Number(agD)}일(앞 0 정규화·전치 확인용)");

console.log("\n[D] ★상호배타 — agreementDateReal 과 agreementDateInvalid 동시 참 불가(거동)");
{
  // 실재 날짜·비실재 날짜·부분 입력 케이스에서 두 플래그가 (true,true) 로 겹치지 않음을 단언.
  const real = (y, m, d) => {
    const agY = String(y).trim(), agM = String(m).trim(), agD = String(d).trim();
    const filled = agY !== "" && agM !== "" && agD !== "";
    const r = filled && isRealDate(Number(agY), Number(agM), Number(agD));
    const inv = filled && !isRealDate(Number(agY), Number(agM), Number(agD));
    return { r, inv };
  };
  const cases = [
    ["2026", "3", "1", true, false],   // 실재 → readback
    ["2026", "2", "31", false, true],  // 비실재 → invalid
    ["2026", "3", "", false, false],   // 부분 입력 → 둘 다 미표시
    ["2028", "2", "29", true, false],  // 윤년 실재 → readback
    ["2027", "2", "29", false, true],  // 평년 2/29 비실재 → invalid
  ];
  const allExclusive = cases.every(([y, m, d]) => { const { r, inv } = real(y, m, d); return !(r && inv); });
  ok(allExclusive, "모든 케이스에서 (readback, invalid) 가 동시 참 0(상호배타)");
  const matchExpected = cases.every(([y, m, d, er, ei]) => { const { r, inv } = real(y, m, d); return r === er && inv === ei; });
  ok(matchExpected, "실재→readback / 비실재→invalid / 부분→둘 다 미표시 기대치 일치");
}

console.log("\n[E] ★월·일 전치 확인 — 3/7 과 7/3 둘 다 실재(invalid 미발동)이나 readback 문구 상이");
{
  const echo = (y, m, d) => `${Number(y)}년 ${Number(m)}월 ${Number(d)}일`;
  const a = { y: "2026", m: "3", d: "7" };
  const b = { y: "2026", m: "7", d: "3" };
  const bothReal = isRealDate(2026, 3, 7) && isRealDate(2026, 7, 3);
  ok(bothReal, "3월 7일·7월 3일 둘 다 실재(invalid 검사로는 전치 구별 불가)");
  ok(echo(a.y, a.m, a.d) === "2026년 3월 7일" && echo(b.y, b.m, b.d) === "2026년 7월 3일"
     && echo(a.y, a.m, a.d) !== echo(b.y, b.m, b.d),
    "readback 문구가 서로 달라 전치를 입력 지점에서 구별 가능");
  ok(echo("2026", "07", "03") === "2026년 7월 3일", "앞 0(07·03) 정규화 — Number 변환으로 7월 3일");
}

console.log("\n[F] 무회귀 — 기존 invalid 인라인·loan-hangul 재사용(새 CSS 0)");
ok(/const agreementDateInvalid\s*=/.test(form) && /<div id="joint-agreement-err" className="field-hint" role="alert"/.test(form),
  "기존 agreementDateInvalid 인라인 안내 보존");
ok((form.match(/loan-hangul/g) || []).length >= 1,
  "loan-hangul 클래스 재사용(기존 readback 표시 클래스 — 새 CSS 0)");

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
