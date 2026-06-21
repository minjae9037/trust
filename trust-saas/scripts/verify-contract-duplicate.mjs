/* ============================================================
   회귀 가드 — 계약 복제(duplicateContract)

   배경: 신탁 계약은 동일 위탁자·유사 구조를 반복 작성하는 경우가 많다. 내 계약 목록에
   "복제" 버튼을 추가해 기존 계약을 입력값 그대로 사본으로 만들어 작성을 가속한다.

   핵심 불변식(데이터 안전):
     - 사본은 원본과 **참조가 분리**된다(form_data 깊은 복사) → 사본 편집이 원본을 오염시키지 않음.
     - 사본 제목은 "(사본)" 접미사이며, 중첩되지 않고(사본의 사본도 "(사본 2)"), 제목 충돌 시 번호로 유니크.
     - 사본 상태는 항상 "draft"(작성중) — 새 작성건.
     - 원본 행은 복제로 변하지 않는다(읽기 전용).

   단언:
     (A) nextCopyTitle 기본/번호/중첩 방지/빈 제목
     (B) makeDuplicateRow: 새 id·draft·시각 주입·종류/카테고리 보존
     (C) 깊은 복사: 사본 form_data 변경이 원본에 전파되지 않음(참조 분리)
     (D) 원본 불변: makeDuplicateRow 가 src 를 변형하지 않음
     (E) 복제 직후 자동 열기 — 반환 id 로 목록에서 사본을 정확히 찾아 바로 연다(openable)

   순수 헬퍼(nextCopyTitle/makeDuplicateRow/isValidRow)를 contractRepo.ts 에서 직접 import.
   (localStorage 의존부 duplicateContract 는 브라우저 한정 — Playwright 가시 검증으로 보완)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-contract-duplicate.mjs
   ============================================================ */
import { nextCopyTitle, makeDuplicateRow, isValidRow } from "../src/lib/contractRepo.ts";
import { blankContractForm } from "../src/lib/engine/model.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const rowOf = (title, form, extra = {}) => ({
  id: "src-1",
  doc_type: "collateral",
  category: "new",
  status: "completed",
  title,
  form_data: form,
  created_at: "2026-06-01T00:00:00.000Z",
  updated_at: "2026-06-10T00:00:00.000Z",
  ...extra,
});

console.log("\n[A] nextCopyTitle — 기본·번호·중첩 방지·빈 제목");
{
  ok(nextCopyTitle("판교 담보신탁", []) === "판교 담보신탁 (사본)", "기본 → '(사본)'");
  ok(
    nextCopyTitle("판교 담보신탁", ["판교 담보신탁 (사본)"]) === "판교 담보신탁 (사본 2)",
    "충돌 시 번호 → '(사본 2)'",
  );
  ok(
    nextCopyTitle("판교 담보신탁", ["판교 담보신탁 (사본)", "판교 담보신탁 (사본 2)"]) ===
      "판교 담보신탁 (사본 3)",
    "연속 충돌 → '(사본 3)'",
  );
  // 사본을 다시 복제해도 "(사본) (사본)" 중첩이 생기지 않는다(루트로 복원 후 번호).
  ok(
    nextCopyTitle("판교 담보신탁 (사본)", ["판교 담보신탁 (사본)"]) === "판교 담보신탁 (사본 2)",
    "사본의 사본 → 중첩 없이 '(사본 2)'",
  );
  ok(nextCopyTitle("판교 담보신탁 (사본 3)", []) === "판교 담보신탁 (사본)", "'(사본 N)' 접미사도 벗겨짐");
  ok(nextCopyTitle("", []) === "제목 없음 (사본)", "빈 제목 → '제목 없음 (사본)'");
  ok(nextCopyTitle("   ", []) === "제목 없음 (사본)", "공백 제목 → '제목 없음 (사본)'");
}

console.log("\n[B] makeDuplicateRow — 새 id·draft·시각·메타 보존");
{
  const src = rowOf("판교 담보신탁", blankContractForm());
  const now = "2026-06-21T11:00:00.000Z";
  const dup = makeDuplicateRow(src, [src.title], "new-2", now);
  ok(dup.id === "new-2", "주입한 새 id 사용");
  ok(dup.id !== src.id, "원본과 다른 id");
  ok(dup.status === "draft", "사본 상태=draft(작성중)");
  ok(dup.title === "판교 담보신탁 (사본)", "제목='(사본)'");
  ok(dup.created_at === now && dup.updated_at === now, "created/updated_at = 주입 시각");
  ok(dup.doc_type === src.doc_type && dup.category === src.category, "종류·카테고리 보존");
}

console.log("\n[C] 깊은 복사 — 사본 편집이 원본에 전파되지 않음(참조 분리)");
{
  const form = blankContractForm();
  form.trustors[0].name = "주식회사 갑";
  const src = rowOf("원본", form);
  const dup = makeDuplicateRow(src, [], "new-3", "2026-06-21T11:00:00.000Z");
  ok(dup.form_data !== src.form_data, "form_data 최상위 참조 분리");
  ok(dup.form_data.trustors !== src.form_data.trustors, "중첩 배열도 참조 분리");
  // 사본 깊은 곳을 수정해도 원본은 그대로여야 한다.
  dup.form_data.trustors[0].name = "주식회사 을";
  ok(src.form_data.trustors[0].name === "주식회사 갑", "사본 수정이 원본 미오염");
  ok(dup.form_data.trustors[0].name === "주식회사 을", "사본은 정상 반영");
}

console.log("\n[D] 원본 불변 — makeDuplicateRow 가 src 를 변형하지 않음");
{
  const src = rowOf("원본", blankContractForm());
  const before = JSON.stringify(src);
  makeDuplicateRow(src, [src.title], "new-4", "2026-06-21T11:00:00.000Z");
  ok(JSON.stringify(src) === before, "src 행 무변형(읽기 전용)");
}

console.log("\n[E] 복제 직후 자동 열기 — 반환 id 로 사본을 정확히 찾아 바로 연다");
{
  // duplicateContract 의 동작을 순수 헬퍼로 재현: 새 id 를 주입해 사본을 만들고
  // 목록 맨 앞에 추가(rows.unshift) → ContractsView.onDuplicate 는 이 반환 id 로
  // listContracts() 결과에서 사본을 찾아 onOpen(copy) 로 바로 연다.
  const form = blankContractForm();
  form.trustors[0].name = "주식회사 갑";
  const src = rowOf("판교 담보신탁", form, { id: "src-1" });
  const others = [src, rowOf("역삼 담보신탁", blankContractForm(), { id: "src-2", title: "역삼 담보신탁" })];
  const newId = "dup-xyz"; // 실제로는 uuid() — 여기선 결정적 값으로 고정
  const dup = makeDuplicateRow(src, others.map((r) => r.title), newId, "2026-06-21T11:00:00.000Z");
  const fresh = [dup, ...others]; // unshift 후의 listContracts() 결과

  const found = fresh.find((r) => r.id === newId);
  ok(found === dup, "반환 id 로 목록에서 사본을 정확히 찾음(자동 열기 대상)");
  ok(found && found.id !== src.id, "찾은 행은 원본이 아닌 사본");
  ok(!!found && isValidRow(found), "찾은 사본은 열 수 있는(openable) 유효 행");
  ok(found.doc_type === src.doc_type, "사본 doc_type 보존 → openContract 가 같은 위저드로 로드");
  ok(found.status === "draft", "사본은 작성중(draft) — 바로 편집");
  // 새 id 가 기존 어떤 행과도 충돌하지 않아 find 가 사본만 가리킨다(중복 매칭 없음).
  ok(fresh.filter((r) => r.id === newId).length === 1, "반환 id 는 목록에서 유일(중복 매칭 없음)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
