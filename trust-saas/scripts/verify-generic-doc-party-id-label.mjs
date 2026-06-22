/* ============================================================
   회귀 가드 — 생성 서류(generic) 위탁자 식별번호 라벨 ↔ 산출물 정합성

   배경(산출물 정합성 갭, 정확성 — 식별번호 라벨 family 의 마지막 누락 인스턴스):
     빌더(builders.js)는 당사자 식별번호 칸을 type 에 따라 분기 렌더한다
     — `type==="개인" ? "생년월일" : "법인등록번호"`. 계약서 본문·appform 관계사
     표·별첨2 나/다·가.우선수익자·별첨 미리보기 패널은 모두 이 분기로 통일됐고
     입력 UI(PartyCard)도 partyIdLabel 로 동일 분기한다. 그런데 **생성 서류 PDF/
     미리보기 빌더 `buildGenericDocFullHTML`**(=previewDocHTML 의 contract·appform 외
     5종: poa·valReport·boardMin·cdd·ubo) 의 위탁자 요약 행만 그 스윕에서 누락돼
     식별번호 라벨을 type 무관 항상 "법인등록번호" 로 하드코딩했다(builders.js).
     PartyCard 는 위탁자에도 개인/법인 토글을 제공하므로, **개인 위탁자의 생년월일
     값이 "법인등록번호" 라는 이름 아래 박히는** 산출물 내부 불일치가 남아 있었다 —
     같은 값이 계약서 본문·별첨에는 "생년월일" 로 박히는데 이 5종 서류 PDF/미리보기
     에서만 "법인등록번호" 로 라벨됨. ★이로 인해 식별번호 family 의 "하드코딩
     법인등록번호 잔여 0" 선언이 이 렌더 경로에 한해 사실이 아니었다.

   수정(조문·엔진·검증 게이트·데이터 모델·표 구조 무접촉 — 라벨 키만):
     buildGenericDocFullHTML 위탁자 요약 행 식별번호 라벨을 다른 빌더와 동일한 분기
     (개인 ? 생년월일 : 법인등록번호)로 통일한다. 값(corpReg)·주소·표 구조 무변경.

   ★영향 점검 — 무회귀:
     라벨 키 문자열만 type 분기 → 값·구조·다른 행 전부 무변경. 기본 type 은 "법인"
     이므로 기존 법인 위탁자(대다수) 산출물은 byte 무변경(개인일 때만 라벨이 생년월일).
     이 빌더는 verbatim 정본이 아니라 "입력값 검증용 임시 출력물"(builders.js 명시)
     이며, 계약서 본문 서명란(verbatim) 의 개인 정합은 본 가드 범위 밖(사업팀 판단).

   본 가드의 단언(조문·엔진·생성/DOCX 로직 무접촉 — 라벨 정합성만):
     (A) 정적 — buildGenericDocFullHTML 위탁자 행 식별번호 라벨이 type 분기
     (B) 정적 — 하드코딩 `법인등록번호: ${escHTML(corpReg)}` 잔존 0(회귀 재발 차단)
     (D) 동적 — 실제 렌더된 5종 서류 미리보기 HTML(=PDF 동일):
         · 법인 위탁자(기본) ⇒ "법인등록번호" 라벨, "생년월일" 부재(무회귀)
         · 위탁자 개인 전환 ⇒ "생년월일" 라벨로 전환(실제 산출물 증명)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-generic-doc-party-id-label.mjs
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

console.log("\n[A] 정적 — buildGenericDocFullHTML 위탁자 식별번호 라벨 = type 분기");
// 신규: ${t.type === "개인" ? "생년월일" : "법인등록번호"}: ${escHTML(corpReg)}
ok(/\$\{t\.type === "개인" \? "생년월일" : "법인등록번호"\}: \$\{escHTML\(corpReg\)\}/.test(builders),
  "위탁자 요약 행 식별번호 라벨이 type 분기(개인=생년월일)");

console.log("\n[B] 정적 — 하드코딩 '법인등록번호: ${escHTML(corpReg)}' 잔존 0(회귀 차단)");
ok(!/법인등록번호: \$\{escHTML\(corpReg\)\}/.test(builders),
  '하드코딩 "법인등록번호: ${escHTML(corpReg)}" 잔존 없음(개인도 법인등록번호로 박히던 회귀 차단)');

console.log("\n[D] 동적 — 5종 서류 미리보기 HTML(법인 기본 ⇒ 법인등록번호 / 개인 전환 ⇒ 생년월일)");
// previewDocHTML(form, docId) 의 contract·appform 외 docId 는 buildGenericDocFullHTML 을 반환
// (DocStep iframe 미리보기와 generateDocPDF 가 공유하는 동일 HTML). 위탁자 요약은 docId 무관 동일
// 렌더이므로 대표로 cdd(고객거래확인서)로 검증한다.
const GENERIC_DOC = "cdd";
const formCorp = blankContractForm();
formCorp.trustors[0].name = "갑개발 주식회사";
formCorp.trustors[0].corpRegFront = "110111";
formCorp.trustors[0].corpRegBack = "1234567";
const htmlCorp = B.previewDocHTML(formCorp, GENERIC_DOC);
ok(typeof htmlCorp === "string" && htmlCorp.length > 200, `${GENERIC_DOC} 미리보기 HTML 렌더(len=${htmlCorp.length})`);
ok(htmlCorp.includes("법인등록번호:"),
  "법인 위탁자(기본) ⇒ '법인등록번호:' 라벨 표출(법인 무회귀)");
ok(!htmlCorp.includes("생년월일:"),
  "법인 위탁자(기본) ⇒ '생년월일:' 부재(법인 위탁자 산출물 무회귀)");

const formPerson = blankContractForm();
formPerson.trustors[0].type = "개인";
formPerson.trustors[0].name = "홍길동";
formPerson.trustors[0].corpRegFront = "900101";
formPerson.trustors[0].corpRegBack = "1234567";
const htmlPerson = B.previewDocHTML(formPerson, GENERIC_DOC);
ok(htmlPerson.includes("생년월일:"),
  "개인 위탁자 ⇒ 식별번호 라벨이 '생년월일:'로 전환(실제 산출물 증명)");
ok(!htmlPerson.includes("법인등록번호:"),
  "개인 위탁자(단독) ⇒ '법인등록번호:' 부재(라벨이 실제로 분기 적용됨)");

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
