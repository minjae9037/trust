/* ============================================================
   회귀 가드 — 계약 삭제 실행취소(restoreRow / restoreContract)

   배경: 앱은 로컬 우선(localStorage)이라 계약 삭제는 영구적이다. dirty 가드(세션 내)·
   백업(세션 간)으로 유실은 막았으나, **실수 삭제는 복구 수단이 전무**했다. 내 계약 목록에서
   삭제 후 일정 시간(7s) "실행취소"를 제공해 방금 삭제한 행을 그대로 되돌린다(유실 방지의 마지막 안전망).

   핵심 불변식(데이터 안전):
     - 복원은 삭제됐던 행을 **그대로**(id·시각·form_data 무변형) 되돌린다.
     - 같은 id가 이미 있으면 변경하지 않는다(멱등 — 중복 복원·덮어쓰기 방지).
     - 복원은 입력(existing 배열·row)을 변형하지 않는다(순수 함수).
     - 삭제→복원 왕복은 원래 계약을 손실 없이 회복한다(건수·내용 동일).

   단언:
     (A) restoreRow: 삭제된 행을 맨 앞에 복원(id 존재)
     (B) 멱등: 같은 id 존재 시 변경 없음(중복 미생성)
     (C) 무변형: 복원된 행이 id·form_data·시각·상태·제목을 그대로 보존
     (D) 삭제→복원 왕복: 건수 회복 + 내용 동일(깊은 비교)
     (E) 순수성: existing 배열·row 입력 무변형

   순수 헬퍼 restoreRow 를 contractRepo.ts 에서 직접 import.
   (localStorage 의존부 restoreContract 는 브라우저 한정 — Playwright 가시 검증으로 보완)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-contract-undo-delete.mjs
   ============================================================ */
import { restoreRow, enqueueUndo, dequeueUndo } from "../src/lib/contractRepo.ts";
import { blankContractForm } from "../src/lib/engine/model.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const rowOf = (id, title, form = blankContractForm(), extra = {}) => ({
  id,
  doc_type: "collateral",
  category: "new",
  status: "completed",
  title,
  form_data: form,
  created_at: "2026-06-01T00:00:00.000Z",
  updated_at: "2026-06-10T00:00:00.000Z",
  ...extra,
});

console.log("\n[A] restoreRow — 삭제된 행을 맨 앞에 복원");
{
  const existing = [rowOf("b", "역삼 담보신탁"), rowOf("c", "분당 담보신탁")];
  const deleted = rowOf("a", "판교 담보신탁");
  const out = restoreRow(existing, deleted);
  ok(out.length === 3, "복원 후 건수 +1");
  ok(out.some((r) => r.id === "a"), "삭제됐던 id 가 다시 존재");
  ok(out[0].id === "a", "맨 앞에 복원");
}

console.log("\n[B] 멱등 — 같은 id 가 이미 있으면 변경 없음(중복 미생성)");
{
  const existing = [rowOf("a", "판교 담보신탁"), rowOf("b", "역삼 담보신탁")];
  const out = restoreRow(existing, rowOf("a", "판교 담보신탁"));
  ok(out === existing, "이미 있는 id → 동일 배열 그대로 반환(no-op)");
  ok(out.filter((r) => r.id === "a").length === 1, "id 'a' 중복 생성 안 됨");
}

console.log("\n[C] 무변형 — 복원된 행이 모든 필드를 그대로 보존");
{
  const form = blankContractForm();
  form.trustors[0].name = "주식회사 갑";
  const deleted = rowOf("a", "판교 담보신탁", form, {
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-06-15T09:30:00.000Z",
    status: "completed",
  });
  const out = restoreRow([rowOf("b", "역삼")], deleted);
  const r = out.find((x) => x.id === "a");
  ok(r === deleted, "복원된 행은 삭제됐던 행 그대로(동일 참조·무변형)");
  ok(r.title === "판교 담보신탁" && r.status === "completed", "제목·상태 보존");
  ok(r.created_at === "2026-05-01T00:00:00.000Z" && r.updated_at === "2026-06-15T09:30:00.000Z", "시각 보존");
  ok(r.form_data.trustors[0].name === "주식회사 갑", "form_data 보존");
}

console.log("\n[D] 삭제→복원 왕복 — 건수 회복 + 내용 동일");
{
  const all = [rowOf("a", "판교 담보신탁"), rowOf("b", "역삼 담보신탁"), rowOf("c", "분당 담보신탁")];
  const target = all.find((r) => r.id === "b");
  const snapshot = JSON.stringify(target);
  // 삭제(ContractsView onDelete = deleteContract 후 load): filter 로 제거
  const afterDelete = all.filter((r) => r.id !== "b");
  ok(afterDelete.length === 2 && !afterDelete.some((r) => r.id === "b"), "삭제 후 대상 부재");
  // 실행취소: 보관해둔 행을 복원
  const afterUndo = restoreRow(afterDelete, target);
  ok(afterUndo.length === 3, "복원 후 원래 건수 회복");
  const restored = afterUndo.find((r) => r.id === "b");
  ok(JSON.stringify(restored) === snapshot, "복원된 계약 내용이 삭제 전과 완전 동일(무손실)");
}

console.log("\n[E] 순수성 — existing 배열·row 입력 무변형");
{
  const existing = [rowOf("a", "판교"), rowOf("b", "역삼")];
  const existingBefore = JSON.stringify(existing);
  const existingLen = existing.length;
  const deleted = rowOf("c", "분당");
  const deletedBefore = JSON.stringify(deleted);
  const out = restoreRow(existing, deleted);
  ok(existing.length === existingLen && JSON.stringify(existing) === existingBefore, "existing 배열 무변형(새 배열 반환)");
  ok(JSON.stringify(deleted) === deletedBefore, "row 입력 무변형");
  ok(out !== existing, "복원 시 새 배열 반환(원본 불공유)");
}

// ── 삭제 실행취소 큐 — 연속 삭제 시 각 삭제가 독립된 실행취소 항목을 갖는지(영구 유실 방지).
//    단일 슬롯 회귀(다음 삭제가 직전 실행취소를 덮어써 먼저 지운 계약이 영구 유실)를 막는다.
console.log("\n[F] enqueueUndo — 연속 삭제가 각각 독립된 실행취소 항목을 보존(덮어쓰기 유실 0)");
{
  // ★핵심 시나리오: A 삭제 후 7초 안에 B 삭제 → 단일 슬롯이면 A 가 사라지던 버그.
  let q = [];
  q = enqueueUndo(q, rowOf("a", "판교 담보신탁"));
  q = enqueueUndo(q, rowOf("b", "역삼 담보신탁"));
  ok(q.length === 2, "연속 삭제 2건이 모두 큐에 남음(먼저 지운 계약 유실 없음)");
  ok(q.some((r) => r.id === "a") && q.some((r) => r.id === "b"), "A·B 둘 다 실행취소 가능");
  ok(q[0].id === "b", "최근 삭제가 맨 앞(LIFO 표시)");

  // 멱등 — 같은 id 재삽입은 중복을 만들지 않고 맨 앞으로 갱신.
  const dup = enqueueUndo(q, rowOf("a", "판교 담보신탁 (갱신)"));
  ok(dup.filter((r) => r.id === "a").length === 1, "같은 id 중복 미생성");
  ok(dup[0].id === "a" && dup.length === 2, "재삽입 시 맨 앞 갱신·건수 불변");

  // 순수성 — 입력 큐 무변형.
  const before = JSON.stringify(q);
  enqueueUndo(q, rowOf("c", "분당 담보신탁"));
  ok(JSON.stringify(q) === before, "enqueueUndo 는 입력 큐를 변형하지 않음(새 배열)");
}

console.log("\n[G] dequeueUndo — 실행취소·만료 시 해당 항목만 제거(다른 대기 항목 보존)");
{
  const q = [rowOf("b", "역삼"), rowOf("a", "판교"), rowOf("c", "분당")];
  const after = dequeueUndo(q, "a");
  ok(after.length === 2 && !after.some((r) => r.id === "a"), "대상 id 만 제거");
  ok(after.some((r) => r.id === "b") && after.some((r) => r.id === "c"), "나머지 대기 항목 보존");
  // 없는 id → no-op(건수 유지), 입력 무변형.
  const before = JSON.stringify(q);
  const noop = dequeueUndo(q, "zzz");
  ok(noop.length === 3, "없는 id 제거는 no-op");
  ok(JSON.stringify(q) === before && noop !== q, "dequeueUndo 는 입력 큐 무변형(새 배열 반환)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
