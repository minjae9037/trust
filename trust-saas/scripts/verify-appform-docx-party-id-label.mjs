/* ============================================================
   회귀 가드 — 신청서(appform) **DOCX** 5표 구조 위탁자/채무자 식별번호 라벨 ↔ 산출물 정합성

   배경(산출물 정합성 갭, 정확성):
     빌더(builders.js)는 당사자 식별번호 칸을 type 에 따라 분기 렌더한다
     — `type==="개인" ? "생년월일" : "법인등록번호"`. 계약서 본문·별첨2·신청서
     **HTML** 관계사 표(partyRowsHTML width:25% 셀, line 1765)는 이미 이 분기로
     통일됐고 partyIdLabel 단일 출처도 동일하다(verify-appform-party-id-label).
     그런데 **신청서 DOCX 5표 구조의 표2(위탁자+채무자)** 식별번호 셀만 그 스윕에서
     누락돼 type 무관 항상 "법인등록번호"로 하드코딩돼 있었다(builders.js 1568·1583).
     → 개인 위탁자/채무자로 신청서(조사분석서) **DOCX 를 다운로드**하면 그들의
     생년월일(YYMMDD)이 "법인등록번호"라는 이름 아래 박히는, **화면 HTML 미리보기
     (생년월일)와 다운로드 DOCX(법인등록번호)가 어긋나는** 산출물 내부 불일치
     (앞서 별첨2·생성 서류 5종에서 마감한 것과 동형 결함의 DOCX appform 인스턴스).

   수정(조문·엔진·검증 게이트·데이터 모델·표 구조·값 무접촉 — 라벨 키 분기만):
     DOCX appform 표2 위탁자/채무자 식별번호 cell 라벨을 계약서 본문·HTML appform 과
     **동일한 분기**(개인 ? 생년월일 : 법인등록번호)로 통일(builders.js 1568·1583).
     새 조문/형식을 만들지 않고 이미 출시된 분기를 미러링(단일 결정).

   ★범위 — 표3(우선수익권 내역)의 "법인등록번호"는 **공유 컬럼 헤더**(순위·상호명·
     법인등록번호·우선수익한도금액)로, 혼합 type 가능한 다행 표의 단일 헤더라
     per-party 분기가 구조상 불가(고정 컬럼 헤더 = verbatim 양식). → 의도적 보존.

   ★영향 점검 — 무회귀:
     라벨 키 문자열만 type 분기 → 값(corpRegOf)·표 구조·다른 셀(법인명·대표자·주소)·
     검증 게이트·조문 전부 무변경. 기본 type 은 "법인" 이므로 기존 법인 당사자
     산출물은 byte 무변경(개인일 때만 라벨이 생년월일).

   ★검증 경계(정직성): DOCX 빌더는 docx 라이브러리 클래스(TableCell/Table 등)를
     전역으로 기대하는 브라우저 전용 구조라 node 헤드리스에서 동적 렌더 불가 →
     17:55 generic 요약 표 이사 행 가드(verify-generic-doc-director-rows)와 동일하게
     builders.js 실소스에 대한 **정적 구조 단언**으로 마감 + 평행 HTML 경로는
     export 렌더 함수로 동적 무회귀 실증([E]).

   본 가드의 단언:
     (A) DOCX appform 표2 위탁자/채무자 식별번호 셀이 type 분기(정확히 2곳)
     (B) 하드코딩 per-party "법인등록번호" 셀 잔존 0 — 동일 리터럴은 표3 컬럼 헤더 1개만
     (C) 일관성 앵커 — HTML appform 분기·partyIdLabel 단일 출처·본문 분기 보유
     (D) ★표3 우선수익권 내역 컬럼 헤더 "법인등록번호" 의도적 보존(과잉 수정 차단)
     (E) 동적 — 평행 HTML appform 무회귀(개인 위탁자 ⇒ 생년월일 / 전원 법인 ⇒ 부재)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-appform-docx-party-id-label.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { blankContractForm } from "../src/lib/engine/model.ts";
import { partyIdLabel } from "../src/lib/engine/calc.ts";

const B = await import("../src/lib/engine/docx/builders.js");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const builders = readFileSync(join(root, "src/lib/engine/docx/builders.js"), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

console.log("\n[A] DOCX appform 표2 위탁자/채무자 식별번호 셀 = type 분기");
const branchedCell = /cell\(\{ text: p\.type === "개인" \? "생년월일" : "법인등록번호", bold: true, center: true, widthDxa: 1701 \}\)/g;
const branchedCount = (builders.match(branchedCell) || []).length;
ok(branchedCount === 2,
  `분기된 식별번호 cell 정확히 2곳(위탁자·채무자) — 실제 ${branchedCount}`);

console.log("\n[B] 하드코딩 per-party '법인등록번호' 셀 잔존 0(표3 컬럼 헤더 1개만 남음)");
const literalCell = /cell\(\{ text: "법인등록번호", bold: true, center: true, widthDxa: 1701 \}\)/g;
const literalCount = (builders.match(literalCell) || []).length;
ok(literalCount === 1,
  `하드코딩 "법인등록번호" cell 리터럴 정확히 1곳(표3 컬럼 헤더만) — 실제 ${literalCount}(위탁자·채무자 행 라벨 제거 확인)`);

console.log("\n[C] 일관성 앵커 — HTML appform 분기 + partyIdLabel 단일 출처 + 본문 분기");
ok(/width:25%;">\$\{p\.type\s*===\s*"개인"\s*\?\s*"생년월일"\s*:\s*"법인등록번호"\}<\/td>/.test(builders),
  "HTML appform partyRowsHTML 식별번호 셀 type 분기 보존(평행 경로 미러링 대상)");
ok(partyIdLabel("개인") === "생년월일" && partyIdLabel("법인") === "법인등록번호",
  "partyIdLabel 단일 출처(개인=생년월일·법인=법인등록번호)와 DOCX appform 라벨 분기 일치");
const branchAll = /"개인"\s*\?\s*"생년월일"\s*:\s*"법인등록번호"/g;
const branchAllCount = (builders.match(branchAll) || []).length;
ok(branchAllCount >= 6, `(개인 ? 생년월일 : 법인등록번호) 분기 ${branchAllCount}곳 — 본문·별첨·appform 통일(미러링 대상 실재)`);

console.log("\n[D] ★표3 우선수익권 내역 컬럼 헤더 '법인등록번호' 의도적 보존(과잉 수정 차단)");
// 표3 헤더 행: 순위·상호명·법인등록번호·우선수익한도금액 — 공유 컬럼 헤더(혼합 type 다행)라 per-party 분기 불가
ok(/cell\(\{ text: "상호명", bold: true, center: true, widthDxa: 4536 \}\)/.test(builders)
   && /cell\(\{ text: "우선수익한도금액", bold: true, center: true, widthDxa: 2835 \}\)/.test(builders),
  "표3(우선수익권 내역) 컬럼 헤더 행 보존(법인등록번호=공유 헤더, 분기 대상 아님)");

console.log("\n[E] 동적 — 평행 HTML appform 무회귀(개인 위탁자 ⇒ 생년월일 / 전원 법인 ⇒ 부재)");
const formCorp = blankContractForm();
const htmlCorp = B.previewDocHTML(formCorp, "appform");
ok(typeof htmlCorp === "string" && htmlCorp.length > 200, `appform HTML 렌더(len=${htmlCorp.length})`);
ok(!htmlCorp.includes("생년월일"),
  "전원 법인(기본) ⇒ appform HTML 에 '생년월일' 부재(법인 당사자 산출물 무회귀)");
ok(htmlCorp.includes("법인등록번호"),
  "전원 법인 ⇒ 식별번호 라벨 '법인등록번호' 표출");
const formPerson = blankContractForm();
formPerson.trustors[0].type = "개인";
formPerson.trustors[0].corpRegFront = "900101";
formPerson.trustors[0].corpRegBack = "1234567";
const htmlPerson = B.previewDocHTML(formPerson, "appform");
ok(htmlPerson.includes("생년월일"),
  "개인 위탁자 ⇒ appform HTML 식별번호 라벨이 '생년월일'로 전환(평행 경로 정합)");

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
