/* ============================================================
   회귀 가드 — 신청서(appform) 관계사 표 식별번호 라벨 ↔ 산출물 정합성

   배경(산출물 정합성 갭, 정확성):
     빌더(builders.js)는 계약서 본문/별첨의 당사자 식별번호 칸을 type 에 따라
     분기 렌더한다 — `type==="개인" ? "생년월일" : "법인등록번호"`(962·976·1075·2095).
     입력 UI(PartyCard) 역시 partyIdLabel 로 동일 분기한다(verify-party-id-label).
     그런데 **신청서(appform) 관계사 표만** 식별번호 라벨을 type 무관 항상
     "법인등록번호"로 하드코딩해(DOCX partyTable·HTML partyRowsHTML), **개인
     당사자의 생년월일 값이 "법인등록번호"라는 이름 아래 박히는** 산출물 내부
     불일치가 있었다(같은 개인 위탁자가 계약서엔 "생년월일", 신청서엔 "법인등록번호"
     로 라벨됨 — 법적 서류 도구에서 혼동·오기 유발).

   수정(조문·엔진·검증 게이트·데이터 모델 무접촉 — 라벨 분기만):
     appform DOCX partyTable(line 1174)·HTML partyRowsHTML(line 1753) 식별번호
     라벨을 계약서 본문과 **동일한 분기**(개인 ? 생년월일 : 법인등록번호)로 통일.
     새 조문/형식을 만들지 않고 이미 출시된 계약서 본문 분기를 미러링한다(단일 결정).

   ★영향 점검 — 무회귀:
     라벨 키 문자열만 type 분기 → 값(corpRegFront-Back)·표 구조·다른 행(사업자
     등록번호·대표이사·주소)·검증 게이트·조문 전부 무변경. 기본 type 은 "법인"
     이므로 기존 법인 당사자 산출물은 byte 무변경(개인일 때만 라벨이 생년월일).

   본 가드의 단언:
     (A) DOCX appform partyTable 식별번호 라벨이 type 분기(하드코딩 제거)
     (B) HTML appform partyRowsHTML 식별번호 라벨이 type 분기(하드코딩 제거)
     (C) 일관성 앵커 — 계약서 본문이 동일 분기를 보유(미러링 대상 실재)
         + partyIdLabel 단일 출처 라벨과 일치
     (D) 동적 — 실제 렌더된 appform HTML: 개인 위탁자 ⇒ "생년월일" 표출,
         전원 법인(기본) ⇒ "생년월일" 부재(개인일 때만 라벨이 바뀜을 산출물로 증명)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-appform-party-id-label.mjs
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

const branch = /"개인"\s*\?\s*"생년월일"\s*:\s*"법인등록번호"/g;

console.log("\n[A] DOCX appform partyTable 식별번호 라벨 = type 분기(하드코딩 제거)");
// 신규: kvRow(p.type === "개인" ? "생년월일" : "법인등록번호", [p.corpRegFront ...])
ok(/kvRow\(\s*p\.type\s*===\s*"개인"\s*\?\s*"생년월일"\s*:\s*"법인등록번호"\s*,\s*\[p\.corpRegFront/.test(builders),
  "partyTable 식별번호 행이 type 분기(개인=생년월일)");
ok(!/kvRow\(\s*"법인등록번호"\s*,\s*\[p\.corpRegFront/.test(builders),
  '하드코딩 kvRow("법인등록번호", [p.corpRegFront…) 잔존 없음(개인도 법인등록번호로 박히던 회귀 차단)');

console.log("\n[B] HTML appform partyRowsHTML 식별번호 라벨 = type 분기(하드코딩 제거)");
// 신규: <td class="key center" style="width:25%;">${p.type === "개인" ? "생년월일" : "법인등록번호"}</td>
ok(/width:25%;">\$\{p\.type\s*===\s*"개인"\s*\?\s*"생년월일"\s*:\s*"법인등록번호"\}<\/td>/.test(builders),
  "partyRowsHTML 식별번호 셀이 type 분기(개인=생년월일)");
ok(!/width:25%;">법인등록번호<\/td>/.test(builders),
  '하드코딩 style="width:25%;">법인등록번호</td> 잔존 없음(개인도 법인등록번호로 박히던 회귀 차단)');

console.log("\n[C] 일관성 앵커 — 계약서 본문 동일 분기 보유 + partyIdLabel 단일 출처 일치");
const branchCount = (builders.match(branch) || []).length;
// 계약서 본문 4곳(962·976·1075·2095) + appform DOCX 1 + appform HTML 1 = 최소 6
ok(branchCount >= 6, `(개인 ? 생년월일 : 법인등록번호) 분기 ${branchCount}곳 — 계약서 본문 + appform DOCX/HTML 통일`);
ok(partyIdLabel("개인") === "생년월일" && partyIdLabel("법인") === "법인등록번호",
  "partyIdLabel 단일 출처(개인=생년월일·법인=법인등록번호)와 appform 라벨 분기 일치");

console.log("\n[D] 동적 — 실제 렌더된 appform HTML 라벨 (개인 ⇒ 생년월일 / 전원 법인 ⇒ 부재)");
// 기본 폼 = 전원 법인 → appform HTML 에 "생년월일" 부재(appform HTML 내 생년월일은 본 분기로만 등장)
const formCorp = blankContractForm();
const htmlCorp = B.previewDocHTML(formCorp, "appform");
ok(typeof htmlCorp === "string" && htmlCorp.length > 200, `appform HTML 렌더(len=${htmlCorp.length})`);
ok(!htmlCorp.includes("생년월일"),
  "전원 법인(기본) ⇒ appform HTML 에 '생년월일' 부재(법인 당사자 산출물 무회귀)");
ok(htmlCorp.includes("법인등록번호"),
  "전원 법인 ⇒ 식별번호 라벨 '법인등록번호' 표출");

// 위탁자를 개인으로 전환 → appform HTML(위탁자 관계사 표)에 "생년월일" 표출
const formPerson = blankContractForm();
formPerson.trustors[0].type = "개인";
formPerson.trustors[0].corpRegFront = "900101";
formPerson.trustors[0].corpRegBack = "1234567";
const htmlPerson = B.previewDocHTML(formPerson, "appform");
ok(htmlPerson.includes("생년월일"),
  "개인 위탁자 ⇒ appform HTML 식별번호 라벨이 '생년월일'로 전환(실제 산출물 증명)");

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
