/* ============================================================
   회귀 가드 — 별첨2 가.우선수익자 표 식별번호 라벨 ↔ 산출물 정합성

   배경(산출물 정합성 갭, 정확성 — 누락된 마지막 식별번호 라벨):
     빌더(builders.js)는 당사자 식별번호 칸을 type 에 따라 분기 렌더한다
     — `type==="개인" ? "생년월일" : "법인등록번호"`. 계약서 본문·appform 관계사
     표·별첨2 **나.수익자·다.채무자** 표는 이미 이 분기로 통일됐고
     (verify-appform-party-id-label·verify-party-id-label), 입력 UI(PartyCard)도
     partyIdLabel 로 동일 분기한다. 그런데 **별첨2 가.우선수익자 표만** 그 스윕에서
     누락돼 식별번호 라벨을 type 무관 항상 "법인등록번호"로 하드코딩했다
     (DOCX buildAnnex2Children·HTML renderPrioritiesTable 의 fields 배열).
     PartyCard 는 우선수익자에도 개인/법인 토글을 제공하므로(StepParties
     showLoanFields), **개인 우선수익자의 생년월일 값이 "법인등록번호"라는 이름
     아래 박히는** 산출물 내부 불일치가 남아 있었다 — 같은 별첨2 안에서 나/다
     수익자·채무자는 "생년월일"인데 가.우선수익자만 "법인등록번호"로 라벨됨.

   수정(조문·엔진·검증 게이트·데이터 모델 무접촉 — 라벨 분기만):
     ① getAnnex2Data priorities 매핑에 `type`(mapBD 와 동일하게 `p.type || "법인"`)을
        실어 가.우선수익자 표가 type 을 알 수 있게 한다.
     ② DOCX buildAnnex2Children·HTML renderPrioritiesTable fields 배열 식별번호
        라벨을 나.수익자/다.채무자와 **동일한 분기**(개인 ? 생년월일 : 법인등록번호)로
        통일한다. 새 조문/형식을 만들지 않고 이미 출시된 별첨2 나/다 분기를 미러링한다.

   ★영향 점검 — 무회귀:
     라벨 키 문자열만 type 분기 → 값(corpReg)·표 구조·다른 행(성명·소재지·피담보
     채권·채무자·금액)·검증 게이트·조문 전부 무변경. 기본 type 은 "법인"이므로
     기존 법인 우선수익자(=금융기관, 대다수) 산출물은 byte 무변경(개인일 때만 라벨이
     생년월일). 우선수익자 전원 법인인 verify-multiparty 도 무영향.

   본 가드의 단언:
     (A) DOCX 가.우선수익자 fields 식별번호 라벨이 type 분기(하드코딩 제거)
     (B) HTML 가.우선수익자 fields 식별번호 라벨이 type 분기(하드코딩 제거)
     (C) getAnnex2Data priorities 가 type 을 실어 보냄(라벨 분기의 데이터 출처)
     (D) 동적 — 실제 렌더된 계약서 HTML:
         · 전원 법인(기본) ⇒ 별첨2 에 "생년월일" 부재(법인 우선수익자 무회귀)
         · 우선수익자만 개인 전환(위탁자=법인 유지) ⇒ 별첨2 에 "생년월일" 표출
           (나/다 는 sameAsTrustor 로 위탁자=법인을 미러 → '생년월일'의 유일 출처가
            가.우선수익자 표임이 보장돼, 분기가 우선수익자 표에 실제 적용됨을 증명)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-annex2-priority-id-label.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { blankContractForm } from "../src/lib/engine/model.ts";

const B = await import("../src/lib/engine/docx/builders.js");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const builders = readFileSync(join(root, "src/lib/engine/docx/builders.js"), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

console.log("\n[A] DOCX 가.우선수익자 fields 식별번호 라벨 = type 분기(하드코딩 제거)");
// 신규: [p.type === "개인" ? "생년월일" : "법인등록번호", p.corpReg],
ok(/\[\s*p\.type\s*===\s*"개인"\s*\?\s*"생년월일"\s*:\s*"법인등록번호"\s*,\s*p\.corpReg\s*\]/.test(builders),
  "가.우선수익자 fields 식별번호 항목이 type 분기(개인=생년월일)");
ok(!/\[\s*"법인등록번호"\s*,\s*p\.corpReg\s*\]/.test(builders),
  '하드코딩 ["법인등록번호", p.corpReg] 잔존 없음(개인도 법인등록번호로 박히던 회귀 차단)');

console.log("\n[B] DOCX·HTML 두 빌더 모두 분기 적용(별첨2 가.우선수익자 = 2곳)");
const branchInFields = (builders.match(/\[\s*p\.type\s*===\s*"개인"\s*\?\s*"생년월일"\s*:\s*"법인등록번호"\s*,\s*p\.corpReg\s*\]/g) || []).length;
ok(branchInFields === 2, `fields 배열 식별번호 분기 ${branchInFields}곳 (DOCX buildAnnex2Children + HTML renderPrioritiesTable)`);

console.log("\n[C] getAnnex2Data priorities 가 type 을 실어 보냄(라벨 분기의 데이터 출처)");
ok(/rank:\s*priorityRankLabel[\s\S]{0,200}?type:\s*p\.type\s*\|\|\s*"법인"/.test(builders),
  "priorities 매핑에 type: p.type || \"법인\" 동반(mapBD 와 동일 정책)");

console.log("\n[CP] 별첨 1~3 미리보기 패널(renderAnnexPreviewHTML) 가.우선수익자 식별번호 라벨 = type 분기");
// renderAnnexPreviewHTML(=previewAnnexHTML) 의 가.우선수익자(h2p) 표 식별번호 행. 16:55 스윕은
// DOCX buildAnnex2Children·HTML renderPrioritiesTable 만 고쳐 이 미리보기 패널은 누락돼 있었다
// (같은 패널의 나/다 bdTable 은 이미 분기 → 패널 내부 불일치). 나/다와 동일 분기로 미러링.
ok(/<td style="\$\{keyTd\}">\$\{p\.type === "개인" \? "생년월일" : "법인등록번호"\}<\/td><td style="\$\{cellTd\}">\$\{p\.corpReg/.test(builders),
  "미리보기 패널 가.우선수익자 식별번호 행이 type 분기(개인=생년월일)");
ok(!/<td style="\$\{keyTd\}">법인등록번호<\/td><td style="\$\{cellTd\}">\$\{p\.corpReg/.test(builders),
  '미리보기 패널 하드코딩 "법인등록번호"<td> 잔존 없음(가.우선수익자 개인도 법인등록번호로 박히던 회귀 차단)');
// 패널의 나/다 bdTable 분기(x.type)는 무회귀로 보존돼야 한다(같은 패널 내 정합).
ok(/\$\{x\.type === "개인" \? "생년월일" : "법인등록번호"\}/.test(builders),
  "나/다 수익자·채무자 bdTable type 분기 보존(패널 내부 정합 무회귀)");

console.log("\n[D] 동적 — 실제 렌더된 계약서 HTML(전원 법인 ⇒ 부재 / 우선수익자 개인 ⇒ 표출)");
// 기본 폼 = 전원 법인 → 계약서 HTML 별첨2 에 "생년월일" 부재
const formCorp = blankContractForm();
const htmlCorp = B.previewDocHTML(formCorp, "contract");
ok(typeof htmlCorp === "string" && htmlCorp.length > 200, `계약서 HTML 렌더(len=${htmlCorp.length})`);
ok(!htmlCorp.includes("생년월일"),
  "전원 법인(기본) ⇒ 계약서 HTML 에 '생년월일' 부재(법인 우선수익자 산출물 무회귀)");

// 우선수익자[0]만 개인으로 전환(위탁자=법인 유지·채무자/수익자 sameAsTrustor 기본 → 나/다 = 위탁자 법인).
// 이때 '생년월일'이 등장하면 그 유일 출처는 가.우선수익자 표(분기가 우선수익자 표에 실제 적용됨을 증명).
const formPerson = blankContractForm();
formPerson.priorities[0].type = "개인";
formPerson.priorities[0].name = "홍길동";
formPerson.priorities[0].corpRegFront = "900101";
formPerson.priorities[0].corpRegBack = "1234567";
formPerson.priorities[0].loanAmount = "1000000000";
const htmlPerson = B.previewDocHTML(formPerson, "contract");
ok(htmlPerson.includes("생년월일"),
  "개인 우선수익자 ⇒ 계약서 HTML 별첨2 가.우선수익자 식별번호 라벨이 '생년월일'로 전환(실제 산출물 증명)");
// 위탁자(법인)는 여전히 법인등록번호 라벨 — 회귀 없음
ok(htmlPerson.includes("법인등록번호"),
  "혼재(위탁자 법인) ⇒ '법인등록번호' 라벨도 공존(법인 당사자 무회귀)");

console.log("\n[DP] 동적 — 별첨 1~3 미리보기 패널(previewAnnexHTML) 가.우선수익자 라벨 분기");
// 우선수익자 전원 법인(기본) ⇒ 가.우선수익자 표에 '생년월일' 부재(나/다 = sameAsTrustor 로 위탁자
// 법인 미러라 패널 전체에 '생년월일' 없음). 우선수익자[0]만 개인 ⇒ 가.우선수익자 표에 '생년월일' 표출.
const annexCorp = B.previewAnnexHTML(blankContractForm());
ok(typeof annexCorp === "string" && annexCorp.includes("우선수익자"),
  `미리보기 패널 렌더(len=${annexCorp.length})`);
ok(!annexCorp.includes("생년월일"),
  "전원 법인(기본) ⇒ 미리보기 패널에 '생년월일' 부재(법인 우선수익자 무회귀)");
const annexPerson = B.previewAnnexHTML(formPerson);
ok(annexPerson.includes("생년월일"),
  "개인 우선수익자 ⇒ 미리보기 패널 가.우선수익자 식별번호 라벨이 '생년월일'로 전환(실제 렌더 증명)");
ok(annexPerson.includes("법인등록번호"),
  "혼재(나/다 = 위탁자 법인) ⇒ 미리보기 패널에 '법인등록번호' 라벨도 공존(법인 무회귀)");

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
