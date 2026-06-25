/* ============================================================
   회귀 가드 — 산출 파일명 단일 출처(.docx 다운로드명 ↔ PDF 인쇄 제목)

   배경: .docx 다운로드명은 `{서류종류}_{위탁자}_{체결일}.docx` 로 계약마다
   구별됐는데, PDF 인쇄창의 <title>(= "PDF로 저장" 시 브라우저가 제안하는
   파일명)은 서류종류명만 담아(예: "담보신탁계약서 (PDF)") **모든 고객·모든
   계약의 PDF 가 같은 이름으로 저장돼 섞일 수 있었다**. 또 appform PDF 제목은
   "...수익권증서..."로 schema 정본명("...우선수익권증서...")·.docx 명과도
   어긋나 있었다. builders.js 의 docFileBase/pdfDocTitle 단일 출처로 통일.

   핵심 불변식:
     PDF 인쇄 제목 === .docx 파일명(확장자 제외) + " (PDF)"
     → 두 산출 경로의 파일명이 절대 어긋나지 않는다(위탁자·체결일 포함).

   단언:
     (A) contract .docx 명 = `{meta.name}_{위탁자}_{YYYYMMDD}.docx`
     (B) contract PDF 제목 = `{meta.name}_{위탁자}_{YYYYMMDD} (PDF)` (= 파리티)
     (C) appform .docx/PDF 가 schema 정본명("우선수익권") 사용·서로 파리티
     (D) generic 서류(ubo) .docx/PDF 가 위탁자·날짜 포함·파리티
     (E) joint .docx 명 = `공동사업표준협약서_{갑}.docx`, PDF 제목 = 동 base+" (PDF)"
     (F) 폴백: 일(日) 미정 → 날짜 토큰 YYYYMM, 위탁자명 공백 → "위탁자"
     (G) 회귀: PDF 제목에 종류명만 담던 옛 문구("담보신탁계약서 (PDF)" 등) 미출현
     (H) 물건 식별 토큰: 같은 위탁자·같은 날 서로 다른 담보물건 → 파일명 구별,
         소재지 금칙문자 안전화·길이 제한, 소재지 공백이면 토큰 없음(무회귀)
     (I) 복수 물건 "외N" 토큰: 첫 소재지가 같아도 물건 수가 다르면 파일명 구별
         (단일물건 vs 같은물건+추가물건), 빈 물건 행은 외N 부풀리지 않음,
         단일 물건이면 종전과 byte-identical(무회귀)·외N 포함 시에도 PDF 파리티

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-doc-filename-parity.mjs
   ============================================================ */
import { blankContractForm, blankJointForm } from "../src/lib/engine/model.ts";
import { COLLATERAL_OUTPUT_DOCS } from "../src/lib/engine/schema.ts";

/* ---- 브라우저 글로벌 폴리필 (verify-multiparty.mjs 와 동일 방식) ---- */
let pendingName = null;       // a[download] 로 잡힌 .docx 파일명
let lastWrittenHTML = "";     // window.open → document.write 로 잡힌 PDF HTML
globalThis.alert = (m) => { throw new Error("ALERT(엔진 내부 에러): " + m); };
globalThis.URL = globalThis.URL || {};
globalThis.URL.createObjectURL = () => "blob:fake";
globalThis.URL.revokeObjectURL = () => {};
globalThis.setTimeout = globalThis.setTimeout || ((fn) => { try { fn(); } catch {} return 0; });
const fakeDoc = {
  body: { appendChild() {}, removeChild() {} },
  createElement() {
    const a = {};
    Object.defineProperty(a, "download", { set(v) { pendingName = v; }, get() { return pendingName; } });
    a.click = () => {};
    return a;
  },
};
globalThis.document = fakeDoc;
globalThis.window = {
  navigator: {}, // msSaveOrOpenBlob 미정의 → 표준 a[download] 경로 사용
  URL: globalThis.URL,
  // PDF 인쇄창 — document.write 로 받은 HTML 을 캡처. setTimeout/window.print 은 무해 폴리필.
  open() {
    lastWrittenHTML = "";
    return {
      document: {
        open() {},
        write(html) { lastWrittenHTML += html; },
        close() {},
      },
      focus() {},
      print() {},
      addEventListener() {},
    };
  },
};

/* docx Packer.toBlob 후킹 → 실제 docx 직렬화 없이 가짜 Blob 반환(파일명만 검증) */
const docx = await import("docx");
docx.Packer.toBlob = async () => ({ size: 0, type: "" });
globalThis.Blob = globalThis.Blob || class { constructor() { this.size = 0; } };

const B = await import("../src/lib/engine/docx/builders.js");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const titleOf = (html) => {
  const m = /<title>([\s\S]*?)<\/title>/.exec(html);
  return m ? m[1] : "(제목 없음)";
};
const metaName = (id) => COLLATERAL_OUTPUT_DOCS.find((d) => d.id === id).name;

/* 결정적 폼: 위탁자 "여주개발 주식회사" · 체결일 2026-03-01 → 토큰 20260301 */
function formFixture() {
  const f = blankContractForm();
  f.trustors[0].name = "여주개발 주식회사";
  f.common.year = 2026;
  f.common.month = 3;
  f.common.day = 1;
  // appform·valReport 완성도와 무관 — 파일명/제목은 위탁자·날짜만 사용한다.
  return f;
}
const TRUSTOR = "여주개발 주식회사";
const TOKEN = "20260301";

async function docxNameOf(form, docId) {
  pendingName = null;
  await B.generateCollateralDoc(form, docId);
  return pendingName;
}
function pdfTitleOf(form, docId) {
  lastWrittenHTML = "";
  const opened = B.generateCollateralPDF(form, docId);
  if (!opened) throw new Error("PDF 창 미개시");
  return titleOf(lastWrittenHTML);
}

console.log("\n[A][B] contract — .docx 명 ↔ PDF 제목 파리티");
{
  const f = formFixture();
  const expectBase = `${metaName("contract")}_${TRUSTOR}_${TOKEN}`;
  const dn = await docxNameOf(f, "contract");
  const pt = pdfTitleOf(f, "contract");
  ok(dn === `${expectBase}.docx`, `contract .docx 명 = ${expectBase}.docx (실제 ${dn})`);
  ok(pt === `${expectBase} (PDF)`, `contract PDF 제목 = ${expectBase} (PDF) (실제 ${pt})`);
  ok(pt === dn.replace(/\.docx$/, "") + " (PDF)", "contract 파리티(제목 = 파일명베이스 + (PDF))");
}

console.log("\n[C] appform — schema 정본명(우선수익권) 사용·파리티");
{
  const f = formFixture();
  const expectBase = `${metaName("appform")}_${TRUSTOR}_${TOKEN}`;
  const dn = await docxNameOf(f, "appform");
  const pt = pdfTitleOf(f, "appform");
  ok(metaName("appform").includes("우선수익권"), "schema appform 명에 '우선수익권' 포함(정본)");
  ok(dn === `${expectBase}.docx`, `appform .docx 명 = 정본 base (실제 ${dn})`);
  ok(pt === `${expectBase} (PDF)`, `appform PDF 제목 = 정본 base + (PDF) (실제 ${pt})`);
  ok(!pt.includes("및 수익권증서"), "PDF 제목이 옛 비정본 '및 수익권증서' 미사용");
}

console.log("\n[D] generic 서류(ubo) — 위탁자·날짜 포함·파리티");
{
  const f = formFixture();
  const expectBase = `${metaName("ubo")}_${TRUSTOR}_${TOKEN}`;
  const dn = await docxNameOf(f, "ubo");
  const pt = pdfTitleOf(f, "ubo");
  ok(dn === `${expectBase}.docx`, `ubo .docx 명 = base (실제 ${dn})`);
  ok(pt === `${expectBase} (PDF)`, `ubo PDF 제목 = base + (PDF) (실제 ${pt})`);
  ok(pt.includes(TRUSTOR) && pt.includes(TOKEN), "ubo PDF 제목에 위탁자·체결일 포함");
}

console.log("\n[E] joint — .docx 명 ↔ PDF 제목 파리티(갑 회사명)");
{
  const jf = blankJointForm();
  jf.gap.name = "한빛개발 주식회사";
  pendingName = null;
  await B.generateJointDoc(jf);
  const dn = pendingName;
  lastWrittenHTML = "";
  const opened = B.generateJointPDFDoc(jf);
  const pt = titleOf(lastWrittenHTML);
  ok(dn === "공동사업표준협약서_한빛개발 주식회사.docx", `joint .docx 명 (실제 ${dn})`);
  ok(opened === true, "joint PDF 창 개시");
  ok(pt === "공동사업표준협약서_한빛개발 주식회사 (PDF)", `joint PDF 제목 (실제 ${pt})`);
  ok(pt === dn.replace(/\.docx$/, "") + " (PDF)", "joint 파리티(제목 = 파일명베이스 + (PDF))");
}

console.log("\n[F] 폴백 — 일(日) 미정→YYYYMM, 위탁자명 공백→'위탁자'");
{
  const f = formFixture();
  f.common.day = ""; // 일 미정
  const dnMonth = await docxNameOf(f, "contract");
  ok(dnMonth === `${metaName("contract")}_${TRUSTOR}_202603.docx`, `일 미정 → YYYYMM 토큰 (실제 ${dnMonth})`);

  const f2 = formFixture();
  f2.trustors[0].name = ""; // 위탁자명 공백
  const dnNoName = await docxNameOf(f2, "contract");
  ok(dnNoName === `${metaName("contract")}_위탁자_${TOKEN}.docx`, `위탁자명 공백 → '위탁자' 폴백 (실제 ${dnNoName})`);
  const ptNoName = pdfTitleOf(f2, "contract");
  ok(ptNoName === `${metaName("contract")}_위탁자_${TOKEN} (PDF)`, "위탁자 폴백 시에도 PDF 제목 파리티");
}

console.log("\n[G] 회귀 — 종류명만 담던 옛 PDF 제목 미출현(계약별 구별 보장)");
{
  const f = formFixture();
  const ptContract = pdfTitleOf(f, "contract");
  const ptAppform = pdfTitleOf(f, "appform");
  const ptUbo = pdfTitleOf(f, "ubo");
  ok(ptContract !== "담보신탁계약서 (PDF)", "contract 제목이 종류명-단독 아님");
  ok(ptAppform !== "담보신탁 신청 및 수익권증서 발급의뢰서", "appform 제목이 옛 비정본-단독 아님");
  ok(ptUbo !== `${metaName("ubo")} (PDF)`, "ubo 제목이 종류명-단독 아님");
}

console.log("\n[H] 물건 식별 토큰 — 같은 위탁자·같은 날 서로 다른 담보물건 → 파일명 구별");
{
  // 같은 위탁자·같은 체결일, 소재지만 다른 두 계약 → base 가 달라져야 섞이지 않는다.
  const f1 = formFixture();
  f1.properties[0].address = "서울특별시 강남구 테헤란로 152";
  const f2 = formFixture();
  f2.properties[0].address = "부산광역시 해운대구 센텀로 99";

  const dn1 = await docxNameOf(f1, "contract");
  const dn2 = await docxNameOf(f2, "contract");
  ok(dn1 !== dn2, `소재지 다르면 .docx 명 구별 (실제 ${dn1} / ${dn2})`);
  ok(dn1 === `${metaName("contract")}_${TRUSTOR}_${TOKEN}_서울특별시 강남구 테헤란로 152.docx`,
    `소재지 토큰이 base 끝에 붙음 (실제 ${dn1})`);

  // 파리티: 토큰이 붙어도 PDF 제목 = 파일명베이스 + " (PDF)"
  const pt1 = pdfTitleOf(f1, "contract");
  ok(pt1 === dn1.replace(/\.docx$/, "") + " (PDF)", "물건 토큰 포함 시에도 PDF 제목 파리티");

  // 모든 서류 종류에 일관 적용(같은 계약물건 → 같은 토큰)
  const dnUbo1 = await docxNameOf(f1, "ubo");
  ok(dnUbo1.includes("_서울특별시 강남구 테헤란로 152"), `ubo 서류도 동일 물건 토큰 적용 (실제 ${dnUbo1})`);

  // 금칙문자(경로 구분자 등) 안전화 — 파일명에 \ / : * ? " < > | 미출현
  const fBad = formFixture();
  fBad.properties[0].address = 'A/B:C*D?"E<F>G|H';
  const dnBad = await docxNameOf(fBad, "contract");
  ok(!/[\\/:*?"<>|]/.test(dnBad.replace(/\.docx$/, "")), `금칙문자 안전화(\\/:*?"<>| 제거) (실제 ${dnBad})`);

  // 긴 소재지 길이 제한(토큰 20자 이내)
  const fLong = formFixture();
  fLong.properties[0].address = "가나다라마바사아자차카타파하가나다라마바사아자차카타파하"; // 26자
  const dnLong = await docxNameOf(fLong, "contract");
  const tokLong = dnLong.replace(/\.docx$/, "").split("_").pop();
  ok(tokLong.length <= 20, `긴 소재지 토큰 20자 이내 제한 (실제 ${tokLong.length}자: ${tokLong})`);

  // 무회귀: 소재지 공백이면 토큰 없이 종전 base 그대로(_날짜 로 끝)
  const fEmpty = formFixture();
  fEmpty.properties[0].address = "   "; // 공백뿐
  const dnEmpty = await docxNameOf(fEmpty, "contract");
  ok(dnEmpty === `${metaName("contract")}_${TRUSTOR}_${TOKEN}.docx`,
    `소재지 공백 → 종전 base 그대로(무회귀) (실제 ${dnEmpty})`);
}

console.log("\n[I] 복수 물건 '외N' 토큰 — 첫 소재지 같아도 물건 수 다르면 구별");
{
  const ADDR = "서울특별시 강남구 테헤란로 152";
  const ADDR_TOK = "서울특별시 강남구 테헤란로 152"; // ≤20자라 slice 영향 없음

  // 단일 물건(종전 동작) vs 같은 첫 물건 + 추가 물건 1건
  const fSingle = formFixture();
  fSingle.properties[0].address = ADDR;
  const f2props = formFixture();
  f2props.properties[0].address = ADDR;
  f2props.properties.push({ address: "부산광역시 해운대구 센텀로 99", category: "", area: "", regNo: "" });

  const dnSingle = await docxNameOf(fSingle, "contract");
  const dnMulti = await docxNameOf(f2props, "contract");

  // 단일 물건 = 종전 base(외N 없음) → 무회귀 byte-identical
  ok(dnSingle === `${metaName("contract")}_${TRUSTOR}_${TOKEN}_${ADDR_TOK}.docx`,
    `단일 물건은 외N 없이 종전 토큰(무회귀) (실제 ${dnSingle})`);
  // 복수 물건 = 첫 소재지 + " 외1" → 같은 첫 물건이라도 단일물건과 구별
  ok(dnMulti === `${metaName("contract")}_${TRUSTOR}_${TOKEN}_${ADDR_TOK} 외1.docx`,
    `복수 물건은 '외1' 토큰 부착 (실제 ${dnMulti})`);
  ok(dnSingle !== dnMulti, `첫 소재지가 같아도 물건 수 다르면 .docx 명 구별 (실제 ${dnSingle} / ${dnMulti})`);

  // 외N 포함 시에도 PDF 인쇄 제목 파리티(제목 = 파일명베이스 + " (PDF)")
  const ptMulti = pdfTitleOf(f2props, "contract");
  ok(ptMulti === dnMulti.replace(/\.docx$/, "") + " (PDF)", "외N 토큰 포함 시에도 PDF 제목 파리티");

  // 빈 물건 행(소재지 공백)은 외N 을 부풀리지 않는다(채워진 물건만 카운트)
  const fBlankRow = formFixture();
  fBlankRow.properties[0].address = ADDR;
  fBlankRow.properties.push({ address: "   ", category: "", area: "", regNo: "" });
  const dnBlankRow = await docxNameOf(fBlankRow, "contract");
  ok(dnBlankRow === dnSingle, `빈 물건 행은 외N 미부착(채워진 물건만 카운트) (실제 ${dnBlankRow})`);

  // 추가 물건 2건이면 "외2"
  const f3props = formFixture();
  f3props.properties[0].address = ADDR;
  f3props.properties.push({ address: "대구광역시 수성구 동대구로 1", category: "", area: "", regNo: "" });
  f3props.properties.push({ address: "인천광역시 연수구 송도과학로 9", category: "", area: "", regNo: "" });
  const dn3 = await docxNameOf(f3props, "contract");
  ok(dn3.endsWith(` 외2.docx`), `추가 물건 2건 → '외2' (실제 ${dn3})`);

  // 모든 서류 종류에 일관 적용(ubo 서류도 동일 외N 토큰)
  const dnUboMulti = await docxNameOf(f2props, "ubo");
  ok(dnUboMulti.includes(`${ADDR_TOK} 외1`), `ubo 서류도 동일 외N 토큰 적용 (실제 ${dnUboMulti})`);
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
