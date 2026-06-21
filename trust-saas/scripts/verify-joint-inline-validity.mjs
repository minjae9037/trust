/* ============================================================
   회귀 가드 — 공동사업표준협약서(joint) 인라인 검증 피드백

   배경(접근성·UX 패리티, 비-산출물): 담보신탁 PartyCard 는 13자리 법인등록번호
   체크섬이 깨지면 그 필드 옆에 인라인 오류(aria-invalid + aria-describedby +
   role="alert")를 즉시 표시한다(verify-inline-error-a11y). 그러나 공동사업
   표준협약서(JointForm)는 ① 갑(시행사) 법인등록번호가 무효여도, ② 협약일을
   실재하지 않는 날짜(2월 31일 등)로 타이핑해도 — 하단 .validate-box 게이트에만
   모아 보일 뿐 **그 입력 옆에서 즉시 짚어 주는 인라인 피드백이 전무**했다.
   특히 협약일은 담보신탁(유효일만 노출하는 드롭다운)과 달리 자유 텍스트라
   실재하지 않는 날짜를 사용자가 직접 칠 수 있어 인라인 안내의 가치가 크다.
   → JointForm 에 gapCorpInvalid·agreementDateInvalid 인라인 안내 추가
     (담보신탁 PartyCard/StepBasic 패리티, 게이트 validateJoint 와 동일 단일 출처).

   본 가드(빌더·조문·생성 로직·검증 게이트 판정 무접촉 — 표시/접근성만):
     (A) 단일 출처 — JointForm 이 게이트와 같은 isValidCorpRegNo·isRealDate 사용
     (B) 인라인 플래그 정의 — gapCorpInvalid(13자리+체크섬)·agreementDateInvalid
         (3칸 채움 + isRealDate), 부분 입력엔 미표시(나그 방지)
     (C) 법인등록번호 — 앞/뒤 input 2칸 aria-invalid + aria-describedby, 오류 div
         id="joint-gapCorpReg-err" role="alert"
     (D) 협약일 — 연·월·일 input 3칸 aria-invalid + aria-describedby, 오류 div
         id="joint-agreement-err" role="alert"
     (E) 고아 참조 0 — describedby 가 가리키는 id 가 동명 오류 div 로 실재
     (F) ★게이트 정합 — 인라인이 무효로 보는 입력은 게이트(validateJoint)도 반드시
         차단(인라인 오류인데 생성은 허용되는 모순 0). 인라인이 안 켜는 부분 입력도
         게이트는 별도 차단(인라인은 완전 입력만, 게이트는 부분까지).

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-joint-inline-validity.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { blankJointForm } from "../src/lib/engine/model.ts";
import { validateJoint } from "../src/lib/engine/validate.ts";
import { isValidCorpRegNo, isRealDate } from "../src/lib/engine/calc.ts";

const __dir = dirname(fileURLToPath(import.meta.url));
const src = (rel) => readFileSync(join(__dir, "..", rel), "utf8");
const form = src("src/components/trust/JointForm.tsx");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

console.log("=== 공동사업표준협약서(joint) 인라인 검증 피드백 ===\n");

console.log("[A] 단일 출처 — 게이트와 같은 isValidCorpRegNo·isRealDate import");
ok(/import\s*\{[^}]*\bisValidCorpRegNo\b[^}]*\bisRealDate\b[^}]*\}\s*from\s*["']@\/lib\/engine\/calc["']/.test(form)
  || (/isValidCorpRegNo/.test(form) && /isRealDate/.test(form) && /from\s*["']@\/lib\/engine\/calc["']/.test(form)),
  "JointForm: isValidCorpRegNo·isRealDate 를 calc 에서 import");

console.log("\n[B] 인라인 플래그 정의 — 완전 입력 + 무효일 때만(부분 입력 미표시)");
ok(/const gapCorpDigits\s*=/.test(form) && /\.replace\(\/\\D\/g, ""\)/.test(form),
  "gapCorpDigits = 앞/뒤 숫자만 결합");
ok(/const gapCorpInvalid\s*=\s*gapCorpDigits\.length === 13 && !isValidCorpRegNo\(gapCorpDigits\)/.test(form),
  "gapCorpInvalid = 13자리 + 체크섬 무효(부분 입력 미표시)");
ok(/const agreementDateInvalid\s*=/.test(form) && /!isRealDate\(Number\(agY\), Number\(agM\), Number\(agD\)\)/.test(form),
  "agreementDateInvalid = isRealDate(Number 변환) 무효");
ok(/agY !== "" && agM !== "" && agD !== ""/.test(form),
  "agreementDateInvalid: 연·월·일 3칸 모두 채워졌을 때만(부분 입력 미표시)");

console.log("\n[C] 법인등록번호 — 인라인 a11y 연결");
ok((form.match(/aria-invalid=\{gapCorpInvalid \|\| undefined\}/g) || []).length === 2,
  `법인등록번호 앞/뒤 input 2칸 aria-invalid={gapCorpInvalid} (실제 ${(form.match(/aria-invalid=\{gapCorpInvalid \|\| undefined\}/g) || []).length})`);
ok((form.match(/aria-describedby=\{gapCorpInvalid \? "joint-gapCorpReg-err" : undefined\}/g) || []).length === 2,
  `법인등록번호 앞/뒤 input 2칸 aria-describedby (실제 ${(form.match(/aria-describedby=\{gapCorpInvalid \? "joint-gapCorpReg-err" : undefined\}/g) || []).length})`);
ok(/\{gapCorpInvalid && \(/.test(form),
  "법인등록번호 오류 div 는 gapCorpInvalid 일 때만 렌더");
ok(/<div id="joint-gapCorpReg-err" className="field-hint" role="alert"/.test(form),
  "법인등록번호 오류 div id=joint-gapCorpReg-err + role=alert");

console.log("\n[D] 협약일 — 인라인 a11y 연결");
ok((form.match(/aria-invalid=\{agreementDateInvalid \|\| undefined\}/g) || []).length === 3,
  `협약일 연·월·일 input 3칸 aria-invalid={agreementDateInvalid} (실제 ${(form.match(/aria-invalid=\{agreementDateInvalid \|\| undefined\}/g) || []).length})`);
ok((form.match(/aria-describedby=\{agreementDateInvalid \? "joint-agreement-err" : undefined\}/g) || []).length === 3,
  `협약일 연·월·일 input 3칸 aria-describedby (실제 ${(form.match(/aria-describedby=\{agreementDateInvalid \? "joint-agreement-err" : undefined\}/g) || []).length})`);
ok(/\{agreementDateInvalid && \(/.test(form),
  "협약일 오류 div 는 agreementDateInvalid 일 때만 렌더");
ok(/<div id="joint-agreement-err" className="field-hint" role="alert"/.test(form),
  "협약일 오류 div id=joint-agreement-err + role=alert");

console.log("\n[E] 고아 참조 0 — describedby 가 가리키는 id 가 동명 오류 div 로 실재");
{
  const ids = [...form.matchAll(/aria-describedby=\{[^}]*\? "([^"]+)"/g)].map((m) => m[1]);
  const uniq = [...new Set(ids)];
  ok(uniq.length === 2 && uniq.every((id) => new RegExp(`<div id="${id}"`).test(form)),
    `describedby 참조 id 전부 동명 오류 div 로 실재=고아 0 (${uniq.join(",")})`);
}

console.log("\n[F] ★게이트 정합 — 인라인 무효 ⟹ 게이트(validateJoint)도 차단");
{
  // 필수를 모두 채운 유효 폼에서 한 가지만 무효로 만들어, 인라인 판정과 게이트 차단이
  // 함께 움직이는지(모순=인라인 오류인데 생성 허용이 0) 확인한다.
  const filled = () => {
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
  };
  const digits = (fr, bk) => [fr, bk].map((x) => x ?? "").join("").replace(/\D/g, "");

  // (F1) 무효 13자리 법인등록번호 — 인라인 ON 이면 게이트도 차단
  {
    const f = filled();
    f.gap.corpRegFront = "110111";
    f.gap.corpRegBack = "0123459"; // 체크섬 무효
    const d = digits(f.gap.corpRegFront, f.gap.corpRegBack);
    const inline = d.length === 13 && !isValidCorpRegNo(d);
    const gate = validateJoint(f);
    ok(inline === true && gate.ok === false && gate.missing.some((m) => m.includes("법인등록번호")),
      "무효 법인등록번호: 인라인 ON ⟹ 게이트 차단(+라벨)");
  }
  // (F2) 유효 13자리 — 인라인 OFF, 게이트 통과(오탐 0)
  {
    const f = filled();
    f.gap.corpRegFront = "110111";
    f.gap.corpRegBack = "0123458"; // 체크섬 유효
    const d = digits(f.gap.corpRegFront, f.gap.corpRegBack);
    const inline = d.length === 13 && !isValidCorpRegNo(d);
    ok(inline === false && validateJoint(f).ok === true, "유효 법인등록번호: 인라인 OFF + 게이트 통과");
  }
  // (F3) 부분 입력(13자리 미만) — 인라인 OFF(나그 방지)이나 게이트는 별도 차단
  {
    const f = filled();
    f.gap.corpRegFront = "110111";
    f.gap.corpRegBack = "012"; // 9자리
    const d = digits(f.gap.corpRegFront, f.gap.corpRegBack);
    const inline = d.length === 13 && !isValidCorpRegNo(d);
    const gate = validateJoint(f);
    ok(inline === false && gate.ok === false && gate.missing.some((m) => m.includes("법인등록번호")),
      "부분 입력 법인등록번호: 인라인 OFF 이나 게이트는 차단");
  }
  // (F4) 실재하지 않는 협약일(2월 31일) — 인라인 ON 이면 게이트도 차단
  {
    const f = filled();
    f.project.agreementMonth = "2";
    f.project.agreementDay = "31";
    const inline = !isRealDate(Number("2026"), Number("2"), Number("31"));
    const gate = validateJoint(f);
    ok(inline === true && gate.ok === false && gate.missing.some((m) => m.includes("실재하지 않는 날짜")),
      "협약일 2/31: 인라인 ON ⟹ 게이트 차단(실재하지 않는 날짜)");
  }
  // (F5) 유효 협약일 — 인라인 OFF + 게이트 통과(윤년 2/29 오탐 0)
  {
    const f = filled();
    f.project.agreementYear = "2028";
    f.project.agreementMonth = "2";
    f.project.agreementDay = "29";
    const inline = !isRealDate(2028, 2, 29);
    ok(inline === false && validateJoint(f).ok === true, "협약일 2028-2-29(윤년): 인라인 OFF + 게이트 통과");
  }
  // (F6) 부분 입력 협약일(일 빈 값) — 인라인 OFF(나그 방지)이나 게이트는 차단
  {
    const f = filled();
    f.project.agreementDay = "";
    const inline = "2026" !== "" && "3" !== "" && "" !== "" && !isRealDate(2026, 3, NaN);
    const gate = validateJoint(f);
    ok(inline === false && gate.ok === false && gate.missing.some((m) => m.includes("협약일")),
      "협약일 일 빈 값: 인라인 OFF 이나 게이트는 차단");
  }
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
