/* ============================================================
   회귀 가드 — 내 계약 목록에서 "준비된 N종 검수용 미리보기"(통합 검수 창)

   배경(완성도 UX·정확성, 비-산출물): 계약 목록(ContractsView)은 카드에서 바로
   "⬇ 서류 N종 생성"(목록 일괄 생성, verify-contracts-batch)을 제공해 열지 않고도
   준비된 서류를 내려받게 했다. 그런데 위저드 헤더에 새로 생긴 "🔍 준비된 N종 검수용
   미리보기"(내려받기 전 정독, 읽기 전용 통합 창 — verify-multi-doc-preview-window)는
   목록에는 없어, 저장된 계약의 서류를 검수하려면 매번 계약을 열어야 했다. 본 가드는
   목록 카드에 그 검수 짝("🔍 검수 미리보기")을 더한 previewRowDocs 의 불변식을 잠근다.

   핵심 불변식(정확성 가드레일):
     - 검수 미리보기 대상 = 일괄 생성 대상 = 검증 게이트 통과 서류와 **정확히 일치**
       (단일 출처 readyDocIds) → 누락 서류는 검수 창에도 안 들어간다.
     - 제외(부분집합) 고지 = 출력서류 전체 − 준비된 N종 = 입력 미완 서류 이름들과
       정확히 일치(검수자가 준비된 N종을 전체 세트로 오인하지 않게).

   단언:
     (A) 준비/제외 분할 — 빈 0/7 · 공통필수 5/2(appform·valReport 제외) · 전체 7/0
     (B) 단일 출처 불변식 — ready ∩ excluded = ∅ · ready ∪ excluded = 출력서류 전체
     (C) 통합 창 셸 — 준비된 서류 = doc 섹션 N개 · 제외 있으면 notice(개수·이름 verbatim)
         · 제외 0이면 notice 미표출 · 셸 script 0(읽기 전용 불변식)
     (D) 실제 previewDocHTML — 준비된 각 서류 html 비어있지 않음(창이 "empty" 로 안 닫힘)
     (E) 배선(ContractsView.tsx) — previewDocHTML·openMultiDocPreviewWindow import,
         previewRowDocs 가 ready 집합 map·excluded 수집·window.open(_blank) 주입·
         busy 가드·차단 안내, 버튼 onClick=previewRowDocs·readiness.ready>0 조건·
         🔍 글리프 aria-hidden, 일괄 생성(generateRowDocs) 보존(회귀)
     (F) 담보신탁 외(joint/fund)·손상 저장본 → null(검수 버튼 미노출·크래시 방지)

   ContractsView.tsx 의 readyDocIds()/previewRowDocs() 와 동일 로직 재현
   (컴포넌트 내부 함수라 import 불가 — 기존 contracts 가드와 동일 재현 패턴).

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-contracts-row-preview.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { blankContractForm } from "../src/lib/engine/model.ts";
import { validateDoc } from "../src/lib/engine/validate.ts";
import { COLLATERAL_OUTPUT_DOCS } from "../src/lib/engine/schema.ts";
import { buildMultiDocShell } from "../src/lib/ui/preview-window.ts";
import { previewDocHTML } from "../src/lib/engine/docx/index.ts";

const __dir = dirname(fileURLToPath(import.meta.url));
const src = (rel) => readFileSync(join(__dir, "..", rel), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

// ContractsView.tsx 의 readyDocIds(row) 재현 + previewRowDocs 의 ready/excluded 분할.
function readyDocIds(row) {
  if (row.doc_type !== "collateral") return null;
  try {
    return COLLATERAL_OUTPUT_DOCS.filter((d) => validateDoc(row.form_data, d.id).ok).map((d) => d.id);
  } catch {
    return null;
  }
}
function split(row) {
  const ids = readyDocIds(row);
  if (ids === null) return null;
  const readySet = new Set(ids);
  const excluded = COLLATERAL_OUTPUT_DOCS.filter((d) => !readySet.has(d.id)).map((d) => d.name);
  return { ids, excluded };
}
const rowOf = (form, doc_type = "collateral") => ({ doc_type, form_data: form });

const commonFilled = () => {
  const form = blankContractForm();
  form.trustors[0].name = "주식회사 갑";
  form.priorities[0].name = "을은행";
  form.priorities[0].loanAmount = "5000000000";
  form.properties[0].address = "서울특별시 강남구 테헤란로 1";
  return form;
};
const fullFilled = () => {
  const form = commonFilled();
  form.docContents.appform.valuationPrice = "10000000000";
  form.docContents.valReport.principalValue = "10000000000";
  return form;
};

console.log("\n[A] 준비/제외 분할 — 빈 0/7 · 공통필수 5/2 · 전체 7/0");
{
  const empty = split(rowOf(blankContractForm()));
  ok(empty.ids.length === 0 && empty.excluded.length === COLLATERAL_OUTPUT_DOCS.length,
    `빈 → 준비 0 / 제외 ${empty.excluded.length} (전체)`);

  const common = split(rowOf(commonFilled()));
  ok(common.ids.length === 5, `공통필수 → 준비 5종 (실제 ${common.ids.length})`);
  ok(common.excluded.length === 2, `공통필수 → 제외 2종 (실제 ${common.excluded.length})`);
  ok(common.excluded.includes("담보신탁 신청 및 우선수익권증서 발급의뢰서"),
    "공통필수 제외에 appform 이름(가격 미입력)");
  ok(common.excluded.includes("신탁재산 원본가액 신고서"),
    "공통필수 제외에 valReport 이름(원본가액 미입력)");

  const full = split(rowOf(fullFilled()));
  ok(full.ids.length === 7 && full.excluded.length === 0, `전체 → 준비 7종 / 제외 0종`);
}

console.log("\n[B] 단일 출처 불변식 — ready∩excluded=∅ · ready∪excluded=출력서류 전체");
{
  for (const [name, form] of [["공통필수", commonFilled()], ["전체충족", fullFilled()]]) {
    const { ids, excluded } = split(rowOf(form));
    const readyNames = ids.map((id) => COLLATERAL_OUTPUT_DOCS.find((d) => d.id === id).name);
    const inter = readyNames.filter((n) => excluded.includes(n));
    ok(inter.length === 0, `[${name}] 준비∩제외 = ∅(교집합 없음)`);
    const union = new Set([...readyNames, ...excluded]);
    ok(union.size === COLLATERAL_OUTPUT_DOCS.length, `[${name}] 준비∪제외 = 출력서류 ${COLLATERAL_OUTPUT_DOCS.length}종 전체`);
    // 대상 전부 검증 통과 · 비대상(제외) 전부 미통과(누락 서류 미검수).
    ok(ids.every((id) => validateDoc(form, id).ok === true), `[${name}] 준비 전부 ok=true`);
  }
}

console.log("\n[C] 통합 창 셸 — doc 섹션 N개 · 제외 고지 · script 0");
{
  const form = commonFilled();
  const { ids, excluded } = split(rowOf(form));
  const docs = ids.map((id) => ({
    name: COLLATERAL_OUTPUT_DOCS.find((d) => d.id === id).name,
    html: previewDocHTML(form, id),
  }));
  const shell = buildMultiDocShell(docs, { excluded });
  const sectionCount = (shell.match(/class="doc"/g) || []).length;
  ok(sectionCount === 5, `준비 5종 = doc 섹션 5개 (실제 ${sectionCount})`);
  ok(/class="notice"/.test(shell), "제외 2종 → 부분집합 고지(notice) 표출");
  ok(/입력 미완 2종/.test(shell), "고지 문구에 제외 개수(2종)");
  ok(shell.includes("신탁재산 원본가액 신고서"), "고지에 제외 서류 이름 verbatim(원본가액 신고서)");
  ok(!/<script/i.test(shell), "셸 script 0(읽기 전용 불변식)");

  // 전체 충족(제외 0) → notice 미표출(군더더기 0).
  const ffForm = fullFilled();
  const ff = split(rowOf(ffForm));
  const ffDocs = ff.ids.map((id) => ({ name: COLLATERAL_OUTPUT_DOCS.find((d) => d.id === id).name, html: previewDocHTML(ffForm, id) }));
  const ffShell = buildMultiDocShell(ffDocs, { excluded: ff.excluded });
  ok(!/class="notice"/.test(ffShell), "제외 0종 → notice 미표출(전부 준비)");
  ok((ffShell.match(/class="doc"/g) || []).length === 7, "전체 충족 → doc 섹션 7개");
}

console.log("\n[D] 실제 previewDocHTML — 준비된 서류 html 비어있지 않음(창이 empty 로 안 닫힘)");
{
  const form = commonFilled();
  const { ids } = split(rowOf(form));
  const allNonEmpty = ids.every((id) => {
    const html = previewDocHTML(form, id);
    return typeof html === "string" && html.trim().length > 0;
  });
  ok(allNonEmpty, "준비된 5종 미리보기 html 전부 비어있지 않음");
}

console.log("\n[E] 배선(ContractsView.tsx) — previewRowDocs · 버튼 · 일괄 생성 보존");
{
  const cv = src("src/components/trust/ContractsView.tsx");
  ok(/import\s*\{[^}]*previewDocHTML[^}]*\}\s*from\s*"@\/lib\/engine\/docx"/.test(cv),
    "previewDocHTML import(@/lib/engine/docx)");
  ok(/import\s*\{\s*openMultiDocPreviewWindow\s*\}\s*from\s*"@\/lib\/ui\/preview-window"/.test(cv),
    "openMultiDocPreviewWindow import(@/lib/ui/preview-window)");

  const m = cv.match(/function previewRowDocs\(row: ContractRow\)\s*\{[\s\S]*?\n  \}/);
  ok(!!m, "previewRowDocs 함수 추출");
  const body = m ? m[0] : "";
  ok(/if \(batch\?\.busy\) return;/.test(body), "previewRowDocs: 진행 중 일괄 생성 가드(busy)");
  ok(/const ids = readyDocIds\(row\);/.test(body), "previewRowDocs: 대상=readyDocIds(일괄 생성과 단일 출처)");
  ok(/previewDocHTML\(form,\s*id\)/.test(body), "previewRowDocs: 저장된 form 으로 각 서류 미리보기 생성");
  ok(/COLLATERAL_OUTPUT_DOCS\.filter\(\(d\) => !readySet\.has\(d\.id\)\)\.map\(\(d\) => d\.name\)/.test(body),
    "previewRowDocs: 제외 서류 이름 수집(부분집합 고지)");
  ok(/openMultiDocPreviewWindow\(/.test(body) && /\{\s*excluded\s*\}/.test(body),
    "previewRowDocs: 통합 창에 docs + {excluded} 전달");
  ok(/window\.open\(""\s*,\s*"_blank"/.test(body), "previewRowDocs: window.open(_blank) 주입");
  ok(/r === "blocked"[\s\S]*?팝업 차단/.test(body), "previewRowDocs: 차단 시 친화적 안내(성공 오인 방지)");

  // 버튼 배선
  ok(/onClick=\{\(\) => previewRowDocs\(r\)\}/.test(cv), "검수 미리보기 버튼 onClick=previewRowDocs(r)");
  ok(/aria-hidden="true">🔍 <\/span>검수 미리보기/.test(cv), "버튼 🔍 글리프 aria-hidden + 라벨 텍스트");
  // 버튼은 일괄 생성 버튼과 동일한 readiness.ready>0 조건으로만 렌더(준비 0이면 미노출).
  ok((cv.match(/readiness && readiness\.ready > 0 &&/g) || []).length >= 2,
    "검수 미리보기 = 일괄 생성과 동일 readiness.ready>0 조건(준비 0이면 미노출)");

  // 회귀: 일괄 생성(generateRowDocs)·busy 가드 보존
  ok(/async function generateRowDocs\(row: ContractRow\)/.test(cv), "회귀: 일괄 생성 generateRowDocs 보존");
  ok(/disabled=\{batch\?\.busy\}/.test(cv), "회귀: 행 액션 batch.busy 비활성 보존");
}

console.log("\n[F] 담보신탁 외·손상 저장본 → null(검수 버튼 미노출·크래시 방지)");
{
  ok(readyDocIds(rowOf(blankContractForm(), "joint")) === null, "joint → null");
  ok(readyDocIds(rowOf(blankContractForm(), "fund")) === null, "fund → null");
  ok(readyDocIds({ doc_type: "collateral", form_data: {} }) === null, "빈 객체 form_data → null");
  ok(readyDocIds({ doc_type: "collateral", form_data: null }) === null, "null form_data → null");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
