/* ============================================================
   회귀 가드 — 복수 당사자(위탁자·우선수익자 등) "전원 표기" 불변식

   배경(대표님 inbox P0, 2026-06-20 C2 결과 §3 / today-plan 추적):
     "우선수익자 복수(2인) 본문 표/날인 전원 표기 검증 — 개발 산출→사업 대조."
   담보신탁계약서는 위탁자·우선수익자·수익자·채무자가 각각 복수일 수 있고, 신탁본문
   제1조 정의상 우선수익자·피담보채권·채무자는 "별첨2에 적힌 자/것"으로 특정된다.
   따라서 복수 입력 시 (a) 별첨2 표에 그 당사자 전원이, (b) 계약서 말미 날인(서명)란에
   위탁자 전원이 각각 빠짐없이 출력되어야 한다. 한 명이라도 누락되면(예: 첫 당사자만
   렌더) 산출물이 법적으로 불완전해진다(정확성 최우선).

   현재 이 불변식은 5개 렌더 경로가 모두 "배열 전체 순회"로 충족하고 있으나, 이를
   단일 명령으로 잠그는 전용 가드가 없었다 — 단일 출처화/리팩터링 과정에서 어느 한
   경로가 조용히 [0](첫 당사자만)로 회귀해도 잡히지 않는다. 본 가드는 다섯 경로 전부가
   배열을 전수 순회(forEach/map)함을 verbatim 단언하고, "첫 당사자만 집어내는"
   퇴화 패턴(.slice(0,1)/find/[0] 단일 픽)이 끼어들지 않음을 음성 단언한다.

   ★이 가드는 회귀 테스트 도구일 뿐 — 조문·엔진·검증(validate)·산출물(docx/HTML)
   소스 무접촉. 어떤 앱 코드도 수정하지 않는다.

   다섯 렌더 경로(모두 builders.js):
     [B] DOCX 산출:  buildSignatureChildren(날인 위탁자 전원) · buildAnnex2Children(별첨2 전원)
     [C] 인쇄/검수 HTML:  renderSignature(날인 전원) · renderPrioritiesTable(별첨2 우선수익자 전원)
     [D] 라이브 2분할 미리보기:  renderAnnexPreviewHTML(별첨2 우선수익자 전원)
     [A] 공통 데이터 추출:  getAnnex2Data(우선수익자·수익자·채무자 전원 → 구조화)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-multiparty-allparties-render.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const __dir = dirname(fileURLToPath(import.meta.url));
const read = (...p) => readFileSync(join(__dir, "..", ...p), "utf8");
const builders = read("src", "lib", "engine", "docx", "builders.js");

// 함수/블록 본문 슬라이스 헬퍼 (시작 마커 ~ 다음 마커 직전)
const slice = (from, to) => {
  const a = builders.indexOf(from);
  if (a < 0) return "";
  const b = to ? builders.indexOf(to, a + from.length) : builders.length;
  return builders.slice(a, b < 0 ? builders.length : b);
};

const getData = slice("function getAnnex2Data()", "function getAnnex3Data()");
const docSig = slice("function buildSignatureChildren()", "function fmtAmountKRW(");
const docA2 = slice("function buildAnnex2Children()", "function buildAnnex3Children()");
const livePrev = slice("function renderAnnexPreviewHTML()", "function docFileDateToken(");
// 인쇄/검수 HTML 의 renderSignature/renderPrioritiesTable 는 담보신탁 풀-문서 빌더 안의
// 첫 번째 정의(joint 풀-문서 빌더에도 동명 함수가 있어 첫 출현만 스코프).
const printSig = slice("const renderSignature = () => {", "const signatureHTML = renderSignature();");
const printPri = slice("const renderPrioritiesTable = () => {", "const renderPersonTable = (");

console.log("\n[A] 공통 데이터 추출 — getAnnex2Data 가 우선수익자·수익자·채무자 전원을 순회");
{
  ok(/const priorities = f\.priorities\.map\(\(p, i\) =>/.test(getData),
     "우선수익자: f.priorities.map((p,i)=>…) — 전수 순회(첫 1인만 X)");
  ok(/rank: priorityRankLabel\(i, f\.priorities\.length\)/.test(getData),
     "각 우선수익자에 인덱스/총수 기반 순위 부여 — 전원 각자 순위(복수 2인+ 구분)");
  ok(/const mapBD = arr => arr\.map\(x =>/.test(getData),
     "수익자·채무자: mapBD = arr.map(x=>…) — 배열 전수 순회 헬퍼");
  ok(/const beneficiaries = mapBD\(/.test(getData) && /const debtors = mapBD\(/.test(getData),
     "수익자·채무자 모두 mapBD(전수) 경유 — 전원 구조화");
  ok(/return \{ priorities, beneficiaries, debtors \};/.test(getData),
     "추출 결과 = {priorities, beneficiaries, debtors} 전원 컬렉션 반환");
  // 음성: 데이터 추출이 첫 당사자만 집어내지 않음
  ok(!/f\.priorities\[0\]/.test(getData) && !/f\.priorities\.find\(/.test(getData) && !/f\.priorities\.slice\(0, ?1\)/.test(getData),
     "음성: f.priorities[0]·find·slice(0,1) 단일 픽 없음(전원 표기 불변식)");
}

console.log("\n[B] DOCX 산출 경로 — 날인 위탁자 전원 + 별첨2 당사자 전원");
{
  // 날인(서명)란: 위탁자 전수 순회 + 각자 (인) 날인줄
  ok(/f\.trustors\.forEach\(t => \{/.test(docSig),
     "buildSignatureChildren: f.trustors.forEach(t=>…) — 위탁자 전원 날인 반복");
  ok(/\(인\)/.test(docSig),
     "날인 반복 본문에 (인) 날인줄 — 위탁자마다 날인란 생성");
  ok(/위탁자/.test(docSig) && /수탁자/.test(docSig),
     "날인란에 위탁자·수탁자 역할 라벨 동시 표기");
  ok(!/f\.trustors\[0\]/.test(docSig) && !/f\.trustors\.find\(/.test(docSig) && !/f\.trustors\.slice\(0, ?1\)/.test(docSig),
     "음성(날인): f.trustors[0]·find·slice(0,1) 단일 위탁자 픽 없음");
  // 별첨2: 우선수익자·수익자·채무자 전수 순회
  ok(/data\.priorities\.forEach\(p => \{/.test(docA2),
     "buildAnnex2Children: data.priorities.forEach(p=>…) — 별첨2 가.우선수익자 전원");
  ok(/data\.beneficiaries\.forEach\(b =>/.test(docA2) && /data\.debtors\.forEach\(d =>/.test(docA2),
     "buildAnnex2Children: 수익자·채무자 forEach — 별첨2 나·다 전원");
  ok(/if \(!data\.priorities\.length\)/.test(docA2),
     "별첨2 우선수익자 빈 배열 가드(미입력 fallback) 존재 — 순회 안전");
  ok(!/data\.priorities\[0\]/.test(docA2) && !/data\.priorities\.find\(/.test(docA2),
     "음성(별첨2): data.priorities[0]·find 단일 픽 없음");
}

console.log("\n[C] 인쇄/검수 HTML 경로 — 날인 전원 + 별첨2 우선수익자 전원");
{
  ok(printSig.length > 0 && /f\.trustors\.map\(t => \{/.test(printSig),
     "renderSignature(인쇄): f.trustors.map(t=>…) — 위탁자 전원 날인 HTML");
  ok(/\(인\)/.test(printSig),
     "인쇄 날인 HTML 에 (인) 날인줄 — 위탁자마다 날인란");
  ok(!/f\.trustors\[0\]/.test(printSig) && !/f\.trustors\.find\(/.test(printSig),
     "음성(인쇄 날인): f.trustors[0]·find 단일 픽 없음");
  ok(printPri.length > 0 && /a2\.priorities\.forEach\(p => \{/.test(printPri),
     "renderPrioritiesTable(인쇄): a2.priorities.forEach(p=>…) — 별첨2 우선수익자 전원");
  ok(/if \(!a2\.priorities\.length\)/.test(printPri),
     "인쇄 별첨2 우선수익자 빈 배열 가드(미입력 fallback) 존재");
  ok(!/a2\.priorities\[0\]/.test(printPri) && !/a2\.priorities\.find\(/.test(printPri),
     "음성(인쇄 별첨2): a2.priorities[0]·find 단일 픽 없음");
}

console.log("\n[D] 라이브 2분할 미리보기 경로 — 별첨2 우선수익자 전원");
{
  ok(/a2\.priorities\.map\(p =>/.test(livePrev),
     "renderAnnexPreviewHTML: a2.priorities.map(p=>…) — 라이브 별첨2 우선수익자 전원");
  ok(/const bdTable = \(arr, emptyMsg\) =>/.test(livePrev) && /arr\.map\(x =>/.test(livePrev),
     "라이브 별첨2 수익자·채무자 bdTable(arr.map) — 전원 표기");
  ok(/if \(!a2\.priorities\.length\)/.test(livePrev),
     "라이브 별첨2 우선수익자 빈 배열 가드(미입력 fallback) 존재");
  ok(!/a2\.priorities\[0\]/.test(livePrev) && !/a2\.priorities\.find\(/.test(livePrev),
     "음성(라이브 별첨2): a2.priorities[0]·find 단일 픽 없음");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
