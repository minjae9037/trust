/* ============================================================
   회귀 가드 — 서류별 실시간 미리보기 WYSIWYG(previewDocHTML)

   배경/버그: DocStep 우측 "실시간 미리보기"가 docId 와 무관하게 항상
   메인 계약서 본문(previewBodyHTML)만 렌더했다. 7종 서류 중 6종(appform·
   poa·valReport·boardMin·cdd·ubo)은 "미리보기 ≠ 실제 생성물"이었다.

   수정: previewDocHTML(form, docId) 가 PDF 빌더의 완성 HTML
   (buildContractFullHTML/buildAppformFullHTML/buildGenericDocFullHTML)을
   그대로 쓰되 자동 인쇄 <script> 만 제거 → iframe srcdoc 로 격리 렌더.
   결과: 미리보기가 실제 생성물(PDF/DOCX)과 동일(WYSIWYG).

   본 가드의 단언:
     (A) 7종 모두 비어있지 않은 HTML 반환 + 각 서류 고유 제목 포함(WYSIWYG 신원)
     (B) 자동 인쇄 스크립트 제거 — <script>/window.print() 잔존 없음(미리보기 오발동 방지)
     (C) 서류별로 미리보기가 실제로 다름 — 과거 버그(모든 docId 동일 본문) 재발 차단
     (D) 충실도 — previewDocHTML == 완성 빌더 HTML에서 <script>만 제거한 것과 동일

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-doc-preview.mjs
   ============================================================ */
import { blankContractForm } from "../src/lib/engine/model.ts";
import { COLLATERAL_OUTPUT_DOCS } from "../src/lib/engine/schema.ts";

const B = await import("../src/lib/engine/docx/builders.js");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

// 최소 입력 폼(제목·스크립트·구별 검증엔 빈 양식으로 충분 — 제목은 정적)
const form = blankContractForm();

// 서류별 고유 제목 마커 (HTML 본문에 반드시 등장해야 WYSIWYG 신원 성립)
//  ※ appform 은 meta.name("…우선수익권…")과 양식 표제("…수익권증서…")가 달라 표제로 검증
const TITLE_MARKER = {
  contract: "부동산담보신탁계약서",
  appform: "담보신탁 신청 및 수익권증서 발급의뢰서",
};
const markerFor = (d) => TITLE_MARKER[d.id] ?? d.name;

console.log("\n[A] 7종 모두 비어있지 않은 HTML + 고유 제목 포함");
const htmls = {};
for (const d of COLLATERAL_OUTPUT_DOCS) {
  const html = B.previewDocHTML(form, d.id);
  htmls[d.id] = html;
  ok(typeof html === "string" && html.length > 200, `${d.id}: 비어있지 않은 HTML (len=${html.length})`);
  ok(html.includes(markerFor(d)), `${d.id}: 고유 제목 "${markerFor(d)}" 포함`);
}

console.log("\n[B] 자동 인쇄 스크립트 제거 (미리보기 오발동 방지)");
for (const d of COLLATERAL_OUTPUT_DOCS) {
  const html = htmls[d.id];
  ok(!/<script/i.test(html), `${d.id}: <script> 잔존 없음`);
  ok(!/window\.print/i.test(html), `${d.id}: window.print() 잔존 없음`);
}

console.log("\n[C] 서류별로 미리보기가 실제로 다름 (과거 버그: 모든 docId 동일 본문)");
{
  const ids = COLLATERAL_OUTPUT_DOCS.map((d) => d.id);
  const uniq = new Set(ids.map((id) => htmls[id]));
  ok(uniq.size === ids.length, `7종 미리보기 전부 상이 (고유 ${uniq.size}/${ids.length})`);
  // 핵심 회귀: appform 미리보기에는 계약서 표제가, contract 미리보기에는 신청서 표제가 없음
  ok(!htmls.appform.includes("부동산담보신탁계약서"), "appform 미리보기 ≠ 계약서 본문");
  ok(htmls.contract.includes("부동산담보신탁계약서"), "contract 미리보기 = 계약서 본문");
}

console.log("\n[D] 충실도 — 완성 빌더 HTML에서 <script>만 제거한 것과 동일(WYSIWYG)");
{
  const strip = (h) => String(h).replace(/<script\b[\s\S]*?<\/script>/gi, "");
  ok(htmls.contract === strip(B.buildContractHTML(form)), "contract: 빌더 HTML(−script)과 동일");
  ok(htmls.appform === strip(B.buildAppformHTML(form)), "appform: 빌더 HTML(−script)과 동일");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
