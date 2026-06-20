/* ============================================================
   개발팀 QA 하네스 — 엔진 end-to-end 검증 (브라우저 없이 Node)
   샘플 입력 1세트 → previewHTML + .docx(Buffer) 생성 확인
   builders.js 는 window/document/Blob/URL 에 의존 → 최소 폴리필
   ============================================================ */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", ".e2e-out");
mkdirSync(OUT, { recursive: true });

// 캡처된 docx 바이트를 파일명별로 보관
const captured = {};
let pendingName = null;

// ---- 브라우저 글로벌 폴리필 ----
class FakeBlob {
  constructor(parts) {
    // parts[0] 은 docx Packer.toBlob 의 결과(Blob) 또는 Buffer
    this._parts = parts;
  }
  async arrayBuffer() {
    const p = this._parts[0];
    if (p && typeof p.arrayBuffer === "function") return await p.arrayBuffer();
    if (Buffer.isBuffer(p)) return p.buffer;
    return p;
  }
}
globalThis.Blob = globalThis.Blob || FakeBlob;
globalThis.alert = (m) => { throw new Error("ALERT(엔진 내부 에러): " + m); };
globalThis.URL = globalThis.URL || {};
globalThis.URL.createObjectURL = () => "blob:fake";
globalThis.URL.revokeObjectURL = () => {};
globalThis.window = {
  navigator: {},
  URL: globalThis.URL,
};
globalThis.document = {
  body: { appendChild() {}, removeChild() {} },
  createElement() {
    // a.download 세팅 시 파일명 캡처, a.click() 시 blob 저장
    const a = {};
    Object.defineProperty(a, "download", {
      set(v) { pendingName = v; },
      get() { return pendingName; },
    });
    a.click = () => { /* blob 은 별도 후킹으로 저장 */ };
    return a;
  },
};

// Packer.toBlob 결과를 직접 잡기 위해 docx 를 후킹
const docx = await import("docx");
const origToBlob = docx.Packer.toBlob.bind(docx.Packer);
docx.Packer.toBlob = async (doc) => {
  const buf = await docx.Packer.toBuffer(doc);
  // 다음 다운로드에서 이 buffer 를 파일명에 매핑
  captured.__lastBuffer = buf;
  // FakeBlob 호환: arrayBuffer() 제공
  return { async arrayBuffer() { return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength); }, _buf: buf };
};

// builders 가 import 하는 docx 인스턴스와 동일하도록: 동적 import 전에 후킹 완료됨
const B = await import("../src/lib/engine/docx/builders.js");
const { blankContractForm, blankJointForm } = await import("../src/lib/engine/model.ts").catch(async () => {
  // .ts 직접 import 불가 시 동일 함수 인라인 폴백 불필요 — tsx 없이 .ts import 불가하므로 JS 측만 사용
  return {};
});

// model.ts 를 직접 못 읽을 수 있으니 최소 샘플 폼을 인라인 구성
function sampleParty(over = {}) {
  return {
    type: "법인", name: "샘플시행㈜", corpRegFront: "110111", corpRegBack: "1234567",
    bizP1: "123", bizP2: "45", bizP3: "67890",
    representativeDirector: "홍길동", insideDirector: "", address: "서울시 강남구 테헤란로 1",
    contact: "02-000-0000", loanAmount: "", claimDebtor: "", securedClaim: "",
    _inputMethod: "manual", ...over,
  };
}
function sampleContractForm() {
  return {
    trustors: [sampleParty()],
    debtorSameAsTrustor: true,
    debtors: [sampleParty()],
    beneficiarySameAsTrustor: true,
    beneficiaries: [sampleParty()],
    priorities: [sampleParty({ name: "○○신용협동조합", loanAmount: "5000000000", claimDebtor: "샘플시행㈜", securedClaim: "여신거래약정" })],
    properties: [{ address: "서울시 강남구 역삼동 123-4", category: "대", area: "1000.5", regNo: "1146-2020-000123" }],
    common: {
      year: 2026, month: 6, day: 20,
      trustFee: "10000000", priorityLimit: "6000000000", priorityRatio: 120,
      trustFeeRate: "0.1", trustPeriod: "담보신탁 등기일로부터 우선수익자 채권 변제시까지",
    },
    docContents: {
      appform: { researchReport: "omit", valuationMethod: "감정평가금액", valuationPrice: "7000000000", leaseStatus: "해당사항 없음", priorityChangeNote: "", extraNotes: "" },
      contract: { majorityCriteria: "twothird", agentBank: "○○신용협동조합", includeArt21: true, builderName: "truster", notes: "" },
      poa: { notes: "" },
      valReport: { principalValue: "7000000000", valuationDate: "2026-06-01", valuationMethod: "appraisal", notes: "" },
      boardMin: { meetingType: "extraordinary", meetingDate: "2026-06-10", agenda: "담보신탁 결의", resolution: "unanimous", notes: "" },
      cdd: { txPurpose: "부동산 담보 신탁", fundSource: "자기자본", pep: "no", notes: "" },
      ubo: { uboName: "홍길동", uboShare: "100", sameAsTrustor: "yes", notes: "" },
    },
  };
}
function sampleJointForm() {
  return {
    gap: { name: "샘플시행㈜", repDir: "홍길동", address: "서울시 강남구", corpRegFront: "110111", corpRegBack: "1234567", _inputMethod: "manual" },
    project: { name: "역삼 공동주택 신축사업", site: "서울시 강남구 역삼동 123-4", scaleUse: "공동주택 100세대", agreementYear: "2026", agreementMonth: "6", agreementDay: "20" },
    representative: "developer",
  };
}

const results = [];
function record(label, fn) {
  return Promise.resolve().then(fn).then((info) => {
    results.push({ label, ok: true, info });
  }).catch((e) => {
    results.push({ label, ok: false, err: (e && e.stack) || String(e) });
  });
}

const form = sampleContractForm();
const joint = sampleJointForm();

const DOC_IDS = ["appform", "contract", "poa", "valReport", "boardMin", "cdd", "ubo"];

// 1) 미리보기 HTML
await record("preview:body", () => { const h = B.previewBodyHTML(form); if (!h || h.length < 50) throw new Error("빈 HTML"); return `len=${h.length}`; });
await record("preview:annex", () => { const h = B.previewAnnexHTML(form); if (!h || h.length < 50) throw new Error("빈 HTML"); return `len=${h.length}`; });
await record("preview:annex4", () => { const h = B.previewAnnex4HTML(form); if (!h || h.length < 50) throw new Error("빈 HTML"); return `len=${h.length}`; });

// 2) 담보신탁 7종 DOCX
for (const id of DOC_IDS) {
  await record(`docx:collateral:${id}`, async () => {
    captured.__lastBuffer = null;
    await B.generateCollateralDoc(form, id);
    const buf = captured.__lastBuffer;
    if (!buf || buf.length < 500) throw new Error("DOCX buffer 없음/너무작음");
    const name = (pendingName || `collateral_${id}.docx`).replace(/[\\/:*?"<>|]/g, "_");
    writeFileSync(path.join(OUT, name), buf);
    return `${buf.length} bytes -> ${name}`;
  });
}

// 3) 공동사업표준협약서 DOCX
await record("docx:joint", async () => {
  captured.__lastBuffer = null;
  await B.generateJointDoc(joint);
  const buf = captured.__lastBuffer;
  if (!buf || buf.length < 500) throw new Error("DOCX buffer 없음/너무작음");
  const name = (pendingName || "joint.docx").replace(/[\\/:*?"<>|]/g, "_");
  writeFileSync(path.join(OUT, name), buf);
  return `${buf.length} bytes -> ${name}`;
});

// 결과 출력
let pass = 0, fail = 0;
for (const r of results) {
  if (r.ok) { pass++; console.log(`PASS  ${r.label}  ${r.info || ""}`); }
  else { fail++; console.log(`FAIL  ${r.label}\n${r.err}\n`); }
}
console.log(`\n=== TOTAL ${pass} PASS / ${fail} FAIL ===`);
process.exit(fail ? 1 : 0);
