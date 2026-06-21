/* ============================================================
   회귀 가드 — 내 계약 목록의 상태 필터(전체/작성중/완료) + 정렬(최근/제목/위탁자/준비도)

   배경: 검색·준비도 칩(verify-contracts-readiness)에 이어 계약이 쌓일 때의 탐색성을
   위해 상태 세그먼트 토글과 정렬 셀렉트를 추가했다. ContractsView.tsx 의
   counts / visible(필터+정렬) 파이프라인과 동일 로직을 재현해 단언한다.
   ※ 조문·엔진 무접촉 — localStorage 행을 필터·정렬해 보여줄 뿐.

     (A) counts: all = draft + completed (status!=="completed"는 전부 작성중)
     (B) 상태 필터: completed/draft 가 정확히 분리되고 all 은 전부
     (C) 검색 + 상태 필터 동시 적용(교집합)
     (D) 정렬 recent: updated_at 내림차순
     (E) 정렬 title: 제목 가나다(ko) 오름차순
     (F) 정렬 readiness: 생성 가능 서류 수 내림차순, 산출정의 없는 종류(null)는 맨 뒤
     (G) 필터·정렬 직교성: 정렬이 필터 결과 건수를 바꾸지 않음
     (H) 정렬 trustor: 위탁자명 가나다(ko) 오름차순, 위탁자명 빈 행은 맨 뒤(동명·빈값 안정 정렬)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-contracts-sort-filter.mjs
   ============================================================ */
import { blankContractForm } from "../src/lib/engine/model.ts";
import { validateDoc } from "../src/lib/engine/validate.ts";
import { COLLATERAL_OUTPUT_DOCS, DOCUMENT_TYPES } from "../src/lib/engine/schema.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

// ── ContractsView.tsx 로직 재현 ──────────────────────────────
const isCompleted = (r) => r.status === "completed";
function docReadiness(row) {
  if (row.doc_type !== "collateral") return null;
  try {
    const total = COLLATERAL_OUTPUT_DOCS.length;
    const ready = COLLATERAL_OUTPUT_DOCS.filter((d) => validateDoc(row.form_data, d.id).ok).length;
    return { ready, total };
  } catch {
    return null;
  }
}
function computeCounts(rows) {
  return {
    all: rows.length,
    completed: rows.filter(isCompleted).length,
    draft: rows.filter((r) => !isCompleted(r)).length,
  };
}
// contractRepo.contractIdentity 재현(카드/검색/정렬 단일 출처) — doc_type별 위탁자·물건 추출.
function contractIdentity(r) {
  const fd = r.form_data;
  try {
    if (r.doc_type === "joint") {
      return { trustor: (fd?.gap?.name ?? "").trim(), property: (fd?.project?.site ?? "").trim() };
    }
    return {
      trustor: (fd?.trustors?.[0]?.name ?? "").trim(),
      property: (fd?.properties?.[0]?.address ?? "").trim(),
    };
  } catch {
    return { trustor: "", property: "" };
  }
}
function computeVisible(rows, { q = "", status = "all", sort = "recent" } = {}) {
  const needle = q.trim().toLowerCase();
  const out = rows.filter((r) => {
    if (status === "completed" && !isCompleted(r)) return false;
    if (status === "draft" && isCompleted(r)) return false;
    if (needle) {
      const docName = DOCUMENT_TYPES.find((d) => d.id === r.doc_type)?.name || r.doc_type;
      const { trustor, property } = contractIdentity(r);
      const hay = `${r.title} ${docName} ${trustor} ${property}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
  const sorted = [...out];
  if (sort === "title") {
    sorted.sort((a, b) => a.title.localeCompare(b.title, "ko"));
  } else if (sort === "trustor") {
    const name = (r) => contractIdentity(r).trustor;
    sorted.sort((a, b) => {
      const na = name(a);
      const nb = name(b);
      if (!na && !nb) return a.updated_at < b.updated_at ? 1 : -1;
      if (!na) return 1;
      if (!nb) return -1;
      return na.localeCompare(nb, "ko") || (a.updated_at < b.updated_at ? 1 : -1);
    });
  } else if (sort === "readiness") {
    const score = (r) => docReadiness(r)?.ready ?? -1;
    sorted.sort((a, b) => score(b) - score(a) || (a.updated_at < b.updated_at ? 1 : -1));
  } else {
    sorted.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
  }
  return sorted;
}

// ── 시드: 준비도·상태·제목·시각이 서로 다른 4건 ──────────────
function fullForm() {
  const f = blankContractForm();
  f.trustors[0].name = "주식회사 갑";
  f.priorities[0].name = "을은행";
  f.priorities[0].loanAmount = "5000000000";
  f.properties[0].address = "서울특별시 강남구 테헤란로 1";
  f.docContents.appform.valuationPrice = "10000000000";
  f.docContents.valReport.principalValue = "10000000000";
  return f; // 7/7
}
function partialForm() {
  const f = blankContractForm();
  f.trustors[0].name = "주식회사 갑";
  f.priorities[0].name = "을은행";
  f.priorities[0].loanAmount = "5000000000";
  f.properties[0].address = "서울특별시 강남구 테헤란로 1";
  return f; // 5/7
}
// 위탁자명을 정렬 검증용으로 구분(id1=병, id2=갑, id3·id4=빈값) — fullForm/partialForm 기본명 덮어씀.
const f1 = fullForm();    f1.trustors[0].name = "병물산";
const f2 = partialForm(); f2.trustors[0].name = "갑상사";
const rows = [
  { id: "1", doc_type: "collateral", status: "completed", title: "나 계약", form_data: f1, updated_at: "2026-06-21T10:00:00Z" }, // 7/7, 위탁자 병물산
  { id: "2", doc_type: "collateral", status: "draft",     title: "가 계약", form_data: f2, updated_at: "2026-06-21T12:00:00Z" }, // 5/7 (최신), 위탁자 갑상사
  { id: "3", doc_type: "collateral", status: "draft",     title: "다 계약", form_data: blankContractForm(), updated_at: "2026-06-21T08:00:00Z" }, // 0/7, 위탁자 빈값
  { id: "4", doc_type: "joint",      status: "completed", title: "라 협약", form_data: blankContractForm(), updated_at: "2026-06-21T09:00:00Z" }, // null, 위탁자 빈값
];

console.log("\n[A] counts: all = draft + completed");
{
  const c = computeCounts(rows);
  ok(c.all === 4, `all=4 (실제 ${c.all})`);
  ok(c.completed === 2, `completed=2 (실제 ${c.completed})`); // id1, id4
  ok(c.draft === 2, `draft=2 (실제 ${c.draft})`);             // id2, id3
  ok(c.draft + c.completed === c.all, "draft + completed === all (파티션 완전성)");
}

console.log("\n[B] 상태 필터 분리");
{
  const ids = (s) => computeVisible(rows, { status: s }).map((r) => r.id).sort();
  ok(JSON.stringify(ids("all")) === JSON.stringify(["1", "2", "3", "4"]), "all → 4건 전부");
  ok(JSON.stringify(ids("completed")) === JSON.stringify(["1", "4"]), "completed → id1·id4만");
  ok(JSON.stringify(ids("draft")) === JSON.stringify(["2", "3"]), "draft → id2·id3만");
}

console.log("\n[C] 검색 + 상태 필터 교집합");
{
  const v = computeVisible(rows, { q: "계약", status: "draft" });
  ok(v.length === 2, `"계약" + 작성중 → 2건 (실제 ${v.length})`); // 가·다 (나는 completed)
  ok(v.every((r) => r.title.includes("계약") && !isCompleted(r)), "전부 제목 '계약' & 작성중");
  const v2 = computeVisible(rows, { q: "협약", status: "completed" });
  ok(v2.length === 1 && v2[0].id === "4", "'협약' + 완료 → id4 단건");
}

console.log("\n[D] 정렬 recent → updated_at 내림차순");
{
  const order = computeVisible(rows, { sort: "recent" }).map((r) => r.id);
  ok(JSON.stringify(order) === JSON.stringify(["2", "1", "4", "3"]), `recent 순서 ${order.join(">")} (기대 2>1>4>3)`);
}

console.log("\n[E] 정렬 title → 가나다(ko) 오름차순");
{
  const order = computeVisible(rows, { sort: "title" }).map((r) => r.title[0]);
  ok(JSON.stringify(order) === JSON.stringify(["가", "나", "다", "라"]), `title 순서 ${order.join("")} (기대 가나다라)`);
}

console.log("\n[F] 정렬 readiness → 생성 가능 수 내림차순, null(joint) 맨 뒤");
{
  const order = computeVisible(rows, { sort: "readiness" }).map((r) => r.id);
  // id1=7/7, id2=5/7, id3=0/7, id4=null(-1) → 1 > 2 > 3 > 4
  ok(JSON.stringify(order) === JSON.stringify(["1", "2", "3", "4"]), `readiness 순서 ${order.join(">")} (기대 1>2>3>4)`);
  ok(order[order.length - 1] === "4", "산출정의 없는 joint(null)는 맨 뒤");
}

console.log("\n[G] 필터·정렬 직교성 — 정렬이 건수를 바꾸지 않음");
{
  const base = computeVisible(rows, { status: "draft", sort: "recent" }).length;
  for (const sort of ["recent", "title", "trustor", "readiness"]) {
    const n = computeVisible(rows, { status: "draft", sort }).length;
    ok(n === base, `draft + ${sort} → ${n}건(필터 건수 불변)`);
  }
}

console.log("\n[H] 정렬 trustor → 위탁자명 가나다(ko) 오름차순, 빈 위탁자는 맨 뒤");
{
  const order = computeVisible(rows, { sort: "trustor" }).map((r) => r.id);
  // id2=갑상사, id1=병물산, id3·id4=빈값(맨 뒤, 빈값끼리 recent: id4 09:00 > id3 08:00)
  ok(JSON.stringify(order) === JSON.stringify(["2", "1", "4", "3"]), `trustor 순서 ${order.join(">")} (기대 2>1>4>3)`);
  ok(order.slice(2).every((id) => contractIdentity(rows.find((r) => r.id === id)).trustor === ""), "빈 위탁자 행(id3·id4)은 맨 뒤");
  // 위탁자명으로 검색도 함께 동작(검색 haystack에 위탁자 포함) — 정렬과 동일 출처 확인.
  const found = computeVisible(rows, { q: "갑상사" }).map((r) => r.id);
  ok(JSON.stringify(found) === JSON.stringify(["2"]), "위탁자명 '갑상사' 검색 → id2 단건");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
