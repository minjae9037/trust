/* ============================================================
   회귀 가드 — 공동사업표준협약서(joint) 검증 게이트

   배경(정확성 가드레일, 비-산출물): 담보신탁 DocStep 은 필수 입력(당사자·물건·
   금액·체결일)이 누락되면 Word/PDF 생성을 차단(validateDoc)하지만, 공동사업
   표준협약서(JointForm)는 검증 게이트가 전무해 **갑(시행사) 상호·대표이사·주소,
   사업명·사업부지·규모/용도, 협약일이 모두 비어 있어도 협약서가 생성**됐다 —
   빈 칸이 그대로 박힌 법적 효력 문서가 만들어지는 정확성 결함(inbox C2 "검증
   게이트: 필수 항목 누락 시 생성 차단 + 누락 안내" 의 joint 미적용 갭).
   → validateJoint(jointForm) 신설(담보신탁 validateDoc 과 동형) + JointForm 가
     !ok 시 생성 버튼 비활성 + 누락 안내 박스(.validate-box) 렌더.

   본 가드(빌더·조문·생성 로직 무접촉 — joint 입력 완결성/유효성만):
     (A) 빈 폼(blankJointForm) → ok=false + 핵심 누락 라벨 전부 포함
     (B) 필수 전부 채움 → ok=true (생성 허용)
     (C) 개별 누락 — 각 필수 필드를 비우면 그 라벨만 추가로 등장
     (D) 협약일 — 누락 / 실재하지 않는 날짜(2월 31일) 차단·유효 날짜 통과
     (E) 갑 법인등록번호 — 빈 값 통과(선택=무회귀)·무효 체크섬 차단·유효 통과
     (F) 방어 — null/빈 객체 무크래시
     (G) 배선 — JointForm 가 validateJoint 사용·!ok disabled·validate-box 렌더·
         onDocx/onPdf 방어 가드, validate.ts 가 validateJoint export

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-joint-validate.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { blankJointForm } from "../src/lib/engine/model.ts";
import { validateJoint } from "../src/lib/engine/validate.ts";

const __dir = dirname(fileURLToPath(import.meta.url));
const src = (rel) => readFileSync(join(__dir, "..", rel), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

// 모든 필수를 채운 유효 폼(케이스별로 한 필드씩 비워 검사).
function filled() {
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
}
const has = (r, frag) => r.missing.some((m) => m.includes(frag));

console.log("\n[A] 빈 폼 — ok=false + 핵심 누락 라벨 전부");
{
  const r = validateJoint(blankJointForm());
  ok(r.ok === false, "blankJointForm → ok=false");
  ok(has(r, "갑(시행사) 상호"), "누락: 갑 상호");
  ok(has(r, "갑(시행사) 대표이사"), "누락: 갑 대표이사");
  ok(has(r, "갑(시행사) 주소"), "누락: 갑 주소");
  ok(has(r, "사업명"), "누락: 사업명");
  ok(has(r, "사업부지"), "누락: 사업부지");
  ok(has(r, "사업규모 및 용도"), "누락: 사업규모 및 용도");
  ok(has(r, "협약일"), "누락: 협약일(빈 월·일)");
  // 빈 폼의 법인등록번호는 비어 있으므로(선택) 누락에 등장하지 않아야 한다.
  ok(!has(r, "법인등록번호"), "빈 법인등록번호는 차단하지 않음(선택)");
}

console.log("\n[B] 필수 전부 채움 — ok=true");
{
  const r = validateJoint(filled());
  ok(r.ok === true, "filled → ok=true");
  ok(r.missing.length === 0, "missing 0건");
}

console.log("\n[C] 개별 누락 — 각 필드 비우면 해당 라벨 등장");
{
  const blankOne = (mut, frag) => {
    const f = filled();
    mut(f);
    const r = validateJoint(f);
    ok(r.ok === false && has(r, frag), `${frag} 비움 → ok=false + 라벨`);
  };
  blankOne((f) => (f.gap.name = ""), "갑(시행사) 상호");
  blankOne((f) => (f.gap.repDir = "  "), "갑(시행사) 대표이사"); // 공백만 = 미입력
  blankOne((f) => (f.gap.address = ""), "갑(시행사) 주소");
  blankOne((f) => (f.project.name = ""), "사업명");
  blankOne((f) => (f.project.site = ""), "사업부지");
  blankOne((f) => (f.project.scaleUse = ""), "사업규모 및 용도");
  // 한 필드만 비워도 나머지는 통과 = 라벨 1개만 추가(전체 누락 0이 아님)
  const f = filled();
  f.project.name = "";
  ok(validateJoint(f).missing.length === 1, "사업명만 비움 → 누락 정확히 1건");
}

console.log("\n[D] 협약일 — 누락 / 실재하지 않는 날짜 차단 / 유효 통과");
{
  const withDate = (y, mo, d) => {
    const f = filled();
    f.project.agreementYear = y;
    f.project.agreementMonth = mo;
    f.project.agreementDay = d;
    return validateJoint(f);
  };
  ok(has(withDate("2026", "", "1"), "협약일 (연·월·일)"), "월 빈 값 → 누락 안내");
  ok(has(withDate("2026", "3", ""), "협약일 (연·월·일)"), "일 빈 값 → 누락 안내");
  ok(has(withDate("2026", "2", "31"), "실재하지 않는 날짜"), "2월 31일 → 실재하지 않는 날짜");
  ok(has(withDate("2026", "4", "31"), "실재하지 않는 날짜"), "4월 31일 → 실재하지 않는 날짜");
  ok(has(withDate("2026", "13", "1"), "실재하지 않는 날짜"), "13월 → 실재하지 않는 날짜");
  ok(withDate("2026", "3", "1").ok === true, "2026-3-1 유효 → ok=true");
  ok(withDate("2028", "2", "29").ok === true, "2028-2-29(윤년) 유효 → ok=true");
  ok(!has(withDate("2026", "2", "28"), "실재하지 않는 날짜"), "2026-2-28 유효 → 오탐 없음");
}

console.log("\n[E] 갑 법인등록번호 — 빈 값 통과 / 무효 차단 / 유효 통과");
{
  // 체크섬 유효 13자리(가중치 1,2,1,2…; check=(10-sum%10)%10). 110111-0123458 = 유효.
  const valid = "1101110123458";
  const front = valid.slice(0, 6); // 110111
  const back = valid.slice(6); // 0123458
  const withCorp = (fr, bk) => {
    const f = filled();
    f.gap.corpRegFront = fr;
    f.gap.corpRegBack = bk;
    return validateJoint(f);
  };
  ok(withCorp("", "").ok === true, "빈 법인등록번호 → 통과(선택)");
  ok(withCorp(front, back).ok === true, "유효 체크섬 → 통과");
  ok(!has(withCorp(front, back), "법인등록번호"), "유효 시 누락 라벨 없음");
  ok(has(withCorp(front, "0123459"), "법인등록번호 (유효하지 않은 번호)"), "무효 체크섬 → 차단");
  ok(has(withCorp("110111", "012"), "법인등록번호 (유효하지 않은 번호)"), "13자리 미만(부분 입력) → 차단");
}

console.log("\n[F] 방어 — null/빈 객체 무크래시");
{
  let crashed = false;
  let r1, r2, r3;
  try {
    r1 = validateJoint(null);
    r2 = validateJoint({});
    r3 = validateJoint({ gap: null, project: null });
  } catch {
    crashed = true;
  }
  ok(!crashed, "null/빈 객체 입력에도 throw 없음");
  ok(r1 && r1.ok === false, "null → ok=false (누락 안내)");
  ok(r2 && r2.ok === false, "{} → ok=false");
  ok(r3 && r3.ok === false, "{gap:null,project:null} → ok=false");
}

console.log("\n[G] 배선 — JointForm + validate.ts 정적 단언");
{
  const form = src("src/components/trust/JointForm.tsx");
  const val = src("src/lib/engine/validate.ts");
  ok(/import\s*\{[^}]*\bvalidateJoint\b[^}]*\}\s*from\s*["']@\/lib\/engine\/validate["']/.test(form), "JointForm: validateJoint import");
  ok(/validateJoint\(jointForm\)/.test(form), "JointForm: validateJoint(jointForm) 호출");
  ok(/disabled=\{busy \|\| !ok\}/.test(form), "JointForm: 생성 버튼 disabled={busy || !ok}");
  ok((form.match(/disabled=\{busy \|\| !ok\}/g) || []).length >= 2, "JointForm: Word·PDF 버튼 둘 다 게이트");
  ok(/className="validate-box"/.test(form), "JointForm: .validate-box 누락 안내 렌더");
  ok(/\{!ok &&/.test(form), "JointForm: !ok 일 때만 안내 박스 노출");
  ok((form.match(/if \(!ok\) return;/g) || []).length >= 2, "JointForm: onDocx/onPdf 방어 가드(!ok return)");
  ok(/export function validateJoint\(/.test(val), "validate.ts: validateJoint export");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
