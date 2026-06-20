/* ============================================================
   P0 검증 하네스 — 우선수익자 복수(2인)·위탁자 복수(2인)
   "본문 표 / 날인 전원 표기" 검증 (개발 산출 → 사업 대조용)

   시나리오: 위탁자 2 + 우선수익자 2 (인허가 위탁자명의·3분의2)
   검증 대상:
     1) 미리보기/계약서 HTML  — 별첨2 우선수익자 표(1·2순위), 서명란 위탁자 전원
     2) 신청서(appform) HTML   — 우선수익권 내역표·날인 페이지 전원
     3) 계약서 DOCX (실제 바이트) — word/document.xml 에 전원 표기
     4) 신청서 DOCX (실제 바이트) — 날인 페이지 전원

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-multiparty.mjs
   ============================================================ */
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ---- 브라우저 글로벌 폴리필 (e2e-engine-test.mjs 와 동일 방식) ---- */
let pendingName = null;
const captured = {};
globalThis.alert = (m) => { throw new Error("ALERT(엔진 내부 에러): " + m); };
globalThis.URL = globalThis.URL || {};
globalThis.URL.createObjectURL = () => "blob:fake";
globalThis.URL.revokeObjectURL = () => {};
globalThis.window = { navigator: {}, URL: globalThis.URL };
globalThis.document = {
  body: { appendChild() {}, removeChild() {} },
  createElement() {
    const a = {};
    Object.defineProperty(a, "download", { set(v) { pendingName = v; }, get() { return pendingName; } });
    a.click = () => {};
    return a;
  },
};

/* docx Packer.toBlob 후킹 → 생성된 docx Buffer 캡처 */
const docx = await import("docx");
docx.Packer.toBlob = async (doc) => {
  const buf = await docx.Packer.toBuffer(doc);
  captured.__lastBuffer = buf;
  return { async arrayBuffer() { return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength); }, _buf: buf };
};

const JSZip = (await import("jszip")).default;
const B = await import("../src/lib/engine/docx/builders.js");

/* ---- DOCX → 평문 추출 (word/document.xml 의 텍스트만) ---- */
async function docxText(buf) {
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file("word/document.xml").async("string");
  // <w:t> 런 텍스트만 이어붙이고 태그 제거
  return xml.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

/* ---- 2위탁자 + 2우선수익자 샘플 폼 ---- */
function party(over = {}) {
  return {
    type: "법인", name: "", corpRegFront: "110111", corpRegBack: "0000000",
    bizP1: "123", bizP2: "45", bizP3: "67890",
    representativeDirector: "", insideDirector: "", address: "",
    contact: "02-000-0000", loanAmount: "", claimDebtor: "", securedClaim: "",
    _inputMethod: "manual", ...over,
  };
}
const TRUSTOR_A = "가나다개발주식회사";
const TRUSTOR_B = "라마바건설주식회사";
const PRIOR_1 = "첫번째새마을금고";
const PRIOR_2 = "두번째신용협동조합";

function form2x2() {
  return {
    trustors: [
      party({ name: TRUSTOR_A, corpRegBack: "1111111", representativeDirector: "김위탁", address: "서울시 강남구 가길 1" }),
      party({ name: TRUSTOR_B, corpRegBack: "2222222", representativeDirector: "이위탁", address: "서울시 서초구 나길 2" }),
    ],
    debtorSameAsTrustor: true,
    debtors: [party({ name: TRUSTOR_A })],
    beneficiarySameAsTrustor: true,
    beneficiaries: [party({ name: TRUSTOR_A })],
    priorities: [
      party({ name: PRIOR_1, corpRegBack: "3333333", representativeDirector: "박선순", address: "서울시 중구 다길 3",
              loanAmount: "5000000000", claimDebtor: TRUSTOR_A, securedClaim: "여신거래약정(제1순위)" }),
      party({ name: PRIOR_2, corpRegBack: "4444444", representativeDirector: "최후순", address: "서울시 종로구 라길 4",
              loanAmount: "3000000000", claimDebtor: TRUSTOR_A, securedClaim: "여신거래약정(제2순위)" }),
    ],
    properties: [{ address: "서울시 강남구 역삼동 123-4", category: "대", area: "1000.5", regNo: "1146-2020-000123" }],
    common: {
      year: 2026, month: 6, day: 20,
      trustFee: "10000000", priorityLimit: "", priorityRatio: 120,
      trustFeeRate: "0.1", trustPeriod: "담보신탁 등기일로부터 우선수익자 채권 변제시까지",
    },
    docContents: {
      appform: { researchReport: "omit", valuationMethod: "감정평가금액", valuationPrice: "7000000000", leaseStatus: "해당사항 없음", priorityChangeNote: "", extraNotes: "" },
      contract: { majorityCriteria: "twothird", agentBank: PRIOR_1, includeArt21: true, builderName: "truster", notes: "" },
      poa: { notes: "" }, valReport: { notes: "" }, boardMin: { notes: "" }, cdd: { notes: "" }, ubo: { notes: "" },
    },
  };
}

/* ---- 검증 ---- */
const results = [];
function check(label, cond, detail = "") {
  results.push({ label, ok: !!cond, detail });
}
// limit = loan * 120%
const AMT_1 = "6,000,000,000"; // 5e9 * 1.2
const AMT_2 = "3,600,000,000"; // 3e9 * 1.2

const form = form2x2();

// 1) 계약서 HTML — 별첨2 표 + 서명란
const contractHTML = B.buildContractHTML(form);
check("HTML 계약서: 우선수익자1 표기", contractHTML.includes(PRIOR_1));
check("HTML 계약서: 우선수익자2 표기", contractHTML.includes(PRIOR_2));
check("HTML 계약서: 1순위 라벨", contractHTML.includes("1순위"));
check("HTML 계약서: 2순위 라벨", contractHTML.includes("2순위"));
check("HTML 계약서: 위탁자1 서명란", contractHTML.includes(TRUSTOR_A));
check("HTML 계약서: 위탁자2 서명란", contractHTML.includes(TRUSTOR_B));
check("HTML 계약서: 우선수익권금액1", contractHTML.includes(AMT_1));
check("HTML 계약서: 우선수익권금액2", contractHTML.includes(AMT_2));

// 2) 신청서 HTML — 우선수익권 내역 + 날인 전원
const appformHTML = B.buildAppformHTML(form);
check("HTML 신청서: 우선수익자1", appformHTML.includes(PRIOR_1));
check("HTML 신청서: 우선수익자2", appformHTML.includes(PRIOR_2));
check("HTML 신청서: 제1순위 날인", appformHTML.includes("제1순위"));
check("HTML 신청서: 제2순위 날인", appformHTML.includes("제2순위"));
check("HTML 신청서: 위탁자1 날인", appformHTML.includes(TRUSTOR_A));
check("HTML 신청서: 위탁자2 날인", appformHTML.includes(TRUSTOR_B));

// 3) 계약서 DOCX (실제 바이트)
captured.__lastBuffer = null;
await B.generateCollateralDoc(form, "contract");
const contractDocx = await docxText(captured.__lastBuffer);
check("DOCX 계약서: 우선수익자1", contractDocx.includes(PRIOR_1));
check("DOCX 계약서: 우선수익자2", contractDocx.includes(PRIOR_2));
check("DOCX 계약서: 위탁자1", contractDocx.includes(TRUSTOR_A));
check("DOCX 계약서: 위탁자2", contractDocx.includes(TRUSTOR_B));
check("DOCX 계약서: 1순위 라벨", contractDocx.includes("1순위"));
check("DOCX 계약서: 2순위 라벨", contractDocx.includes("2순위"));

// 4) 신청서 DOCX (실제 바이트) — 날인 페이지 전원
captured.__lastBuffer = null;
await B.generateCollateralDoc(form, "appform");
const appformDocx = await docxText(captured.__lastBuffer);
check("DOCX 신청서: 우선수익자1", appformDocx.includes(PRIOR_1));
check("DOCX 신청서: 우선수익자2", appformDocx.includes(PRIOR_2));
check("DOCX 신청서: 위탁자1", appformDocx.includes(TRUSTOR_A));
check("DOCX 신청서: 위탁자2", appformDocx.includes(TRUSTOR_B));
check("DOCX 신청서: 제1순위 날인", appformDocx.includes("제1순위"));
check("DOCX 신청서: 제2순위 날인", appformDocx.includes("제2순위"));

/* ---- 출력 ---- */
let pass = 0, fail = 0;
for (const r of results) {
  if (r.ok) { pass++; console.log(`PASS  ${r.label}`); }
  else { fail++; console.log(`FAIL  ${r.label}  ${r.detail}`); }
}
console.log(`\n=== 우선수익자 복수 표기 검증: ${pass} PASS / ${fail} FAIL ===`);
process.exit(fail ? 1 : 0);
