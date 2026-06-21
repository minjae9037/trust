/* ============================================================
   회귀 가드 — 계약 이름 변경(renameContract)

   배경: 저장된 계약의 제목은 저장 시 자동 생성되거나 복제 시 "(사본)"이 붙는데,
   목록에서 이를 의미 있는 딜명으로 바꿀 수단이 없었다(삭제·실행취소·복제·백업/복원은
   있으나 rename 부재). 실무에선 같은 위탁자·여러 사본을 제목으로 구분하므로(검색·정렬·
   카드 식별의 핵심) 카드에서 바로 이름을 고칠 수 있어야 한다.

   핵심 불변식(데이터 안전 — "제목만 변경"):
     - 이름 변경은 그 행의 title 만 바꾸고 form_data·doc_type·status·created_at 은 보존한다.
     - updated_at 만 갱신된다(편집 시각 — saveContract 와 동일하게 모든 수정은 시각을 올림).
     - 입력 배열·행을 변형하지 않는다(순수·불변) → 다른 행은 그대로.
     - 제목은 정규화된다(앞뒤 공백 제거, 비면 "제목 없음" = 저장 기본값과 동일).
     - 존재하지 않는 id 는 내용 변화 없음(no-op).

   단언:
     (A) normalizeTitle — 공백 트림·빈/공백 → "제목 없음"·정상 통과
     (B) renameRow — 제목 교체(정규화)·updated_at 갱신·title 외 필드 보존
     (C) 불변성 — 입력 배열/행 무변형, 다른 행 무영향, id 미존재 no-op
     (D) ContractsView 배선(정적) — renameContract import·인라인 편집 상태·
         Enter 저장/Esc 취소·stopPropagation(열기와 분리)·이름변경 버튼·autoFocus

   순수 헬퍼(normalizeTitle/renameRow)를 contractRepo.ts 에서 직접 import.
   (localStorage 의존부 renameContract 는 브라우저 한정 — Playwright 가시 검증으로 보완)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-contracts-rename.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { normalizeTitle, renameRow } from "../src/lib/contractRepo.ts";

const __dir = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(__dir, "..", p), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const rowOf = (id, title, extra = {}) => ({
  id,
  doc_type: "collateral",
  category: "new",
  status: "completed",
  title,
  form_data: { trustors: [{ name: "주식회사 갑" }], properties: [{ address: "판교" }] },
  created_at: "2026-06-01T00:00:00.000Z",
  updated_at: "2026-06-10T00:00:00.000Z",
  ...extra,
});

console.log("\n[A] normalizeTitle — 트림·빈/공백 → '제목 없음'·정상 통과");
{
  ok(normalizeTitle("판교 PF 담보신탁") === "판교 PF 담보신탁", "정상 제목 그대로");
  ok(normalizeTitle("  여백 있는 제목  ") === "여백 있는 제목", "앞뒤 공백 제거");
  ok(normalizeTitle("") === "제목 없음", "빈 문자열 → '제목 없음'");
  ok(normalizeTitle("    ") === "제목 없음", "공백만 → '제목 없음'");
  // @ts-expect-error 런타임 견고성: null/undefined 도 안전(빈으로 처리)
  ok(normalizeTitle(null) === "제목 없음", "null → '제목 없음'(무크래시)");
  // @ts-expect-error
  ok(normalizeTitle(undefined) === "제목 없음", "undefined → '제목 없음'(무크래시)");
}

console.log("\n[B] renameRow — 제목 교체(정규화)·updated_at 갱신·나머지 보존");
{
  const rows = [rowOf("a", "원래 제목"), rowOf("b", "다른 계약", { id: "b" })];
  const now = "2026-06-22T12:00:00.000Z";
  const out = renameRow(rows, "a", "  새 딜명  ", now);
  const a = out.find((r) => r.id === "a");
  ok(a.title === "새 딜명", "대상 행 제목이 정규화되어 교체됨(공백 트림)");
  ok(a.updated_at === now, "updated_at 이 주입 시각으로 갱신됨");
  ok(a.created_at === "2026-06-01T00:00:00.000Z", "created_at 보존");
  ok(a.status === "completed", "status 보존(제목만 변경)");
  ok(a.doc_type === "collateral", "doc_type 보존");
  ok(JSON.stringify(a.form_data) === JSON.stringify(rows[0].form_data), "form_data 보존(입력값 무변형)");
  // 빈 제목으로 바꾸면 "제목 없음"
  const out2 = renameRow(rows, "a", "   ", now);
  ok(out2.find((r) => r.id === "a").title === "제목 없음", "빈/공백 제목 → '제목 없음'");
}

console.log("\n[C] 불변성 — 입력 무변형·다른 행 무영향·id 미존재 no-op");
{
  const rows = [rowOf("a", "원래 제목"), rowOf("b", "다른 계약", { id: "b" })];
  const before = JSON.stringify(rows);
  const out = renameRow(rows, "a", "새 이름", "2026-06-22T12:00:00.000Z");
  ok(JSON.stringify(rows) === before, "입력 배열·행 무변형(순수)");
  const b = out.find((r) => r.id === "b");
  ok(b.title === "다른 계약" && b.updated_at === "2026-06-10T00:00:00.000Z", "다른 행은 제목·시각 무영향");
  // 존재하지 않는 id → 내용 변화 없음
  const noop = renameRow(rows, "zzz", "안 바뀜", "2026-06-22T12:00:00.000Z");
  ok(JSON.stringify(noop) === before, "id 미존재 → 내용 변화 없음(no-op)");
  ok(noop.length === rows.length, "행 수 불변(추가/삭제 없음)");
}

console.log("\n[D] ContractsView 배선(정적) — import·인라인 편집·Enter/Esc·stopPropagation·버튼");
{
  const view = src("src/components/trust/ContractsView.tsx");
  ok(/import\s*{[^}]*\brenameContract\b/s.test(view), "renameContract 를 contractRepo 에서 import");
  ok(/setEditId\(/.test(view) && /editId\s*===\s*r\.id/.test(view), "행별 인라인 편집 상태(editId)로 분기");
  ok(/function\s+startRename/.test(view) && /function\s+commitRename/.test(view) && /function\s+cancelRename/.test(view), "startRename/commitRename/cancelRename 정의");
  ok(/renameContract\(\s*editId\s*,\s*editVal\s*\)/.test(view), "commitRename 이 renameContract(editId, editVal) 호출");
  ok(/e\.key\s*===\s*"Enter"[\s\S]*?commitRename\(\)/.test(view), "Enter 키 → commitRename(저장)");
  ok(/e\.key\s*===\s*"Escape"[\s\S]*?cancelRename\(\)/.test(view), "Escape 키 → cancelRename(취소)");
  ok(/contract-rename[\s\S]*?onClick=\{\(e\)\s*=>\s*e\.stopPropagation\(\)\}/.test(view), "편집 영역 onClick stopPropagation(카드 열기와 분리)");
  ok(/autoFocus/.test(view), "편집 진입 시 입력 autoFocus");
  ok(/이름변경/.test(view), "카드 액션에 '이름변경' 버튼");
  ok(/onClick=\{\(\)\s*=>\s*startRename\(r\)\}/.test(view), "이름변경 버튼 → startRename(r)");
  ok(/disabled=\{batch\?\.busy\s*\|\|\s*editId\s*===\s*r\.id\}/.test(view), "생성 중·편집 중 이름변경 버튼 disabled");
  // commitRename 후 목록 재로딩(반영 확인)
  ok(/commitRename[\s\S]*?await\s+load\(\)/.test(view), "commitRename 후 load() 로 목록 갱신");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
