/* ============================================================
   회귀 가드 — 신청서(appform) 관계사 표·날인 "대표자(대표이사/사내이사)" ↔ 개인 당사자 정합성

   배경(산출물 정합성 갭, 정확성 — 개인 당사자 산출물 정합 family):
     입력 UI(PartyCard)는 대표이사·사내이사를 "이사회 직위(법인 전용 개념)"로 보고
     개인 당사자(type==="개인")에겐 그 입력란을 숨기는 결정(PartyCard.tsx isCorp)을
     내렸다 — 단, 법인↔개인 전환 시 데이터 보존을 위해 모델 값
     (representativeDirector/insideDirector)은 비우지 않는 비파괴 방식이다.
     그런데 신청서(appform, 조사분석서) 빌더의 `repTextOf(p)` 는 type 무관 항상
     representativeDirector/insideDirector 를 문자열로 반환했다. repTextOf 는
       · 표2(위탁자+채무자) "대표자" 행 cell (DOCX 1573/1588, HTML 1769)
       · 날인 표 "상호명 및 대표자명" cell 의 "대표자 …" 줄 (DOCX 1704, HTML 1816)
     두 곳에 쓰이므로, 법인 시절 입력했다가 개인으로 전환한 stale 이사 값이 개인
     당사자의 신청서 산출물에 그대로 누수됐다(개인은 구조적으로 대표이사가 없음).
     17:55 가 generic 5종 partyTable 의 동형 stale 누수를 마감했고, 본 건은 그
     "개인 당사자 산출물 정합" family 의 appform 인스턴스(마지막 repTextOf 누수 경로).

   수정(조문·엔진·검증 게이트·데이터 모델·표 구조·라벨·값 무접촉 — 누수 데이터만 차단):
     DOCX·HTML 두 repTextOf 정의 첫머리에 `p.type === "개인" ? ""` 분기를 추가
     (PartyCard 의 isCorp 결정을 산출물에 전파). ★폼 구조는 무변경 — "대표자" 행 라벨·
     "상호명 및 대표자명" 헤더·"대표자 " 접두 모두 그대로 보존(조사분석서 verbatim
     양식 구조 무접촉). 개인 당사자의 대표자 값만 빈 문자열로 정리한다.

   ★영향 점검 — 무회귀:
     기본 type 은 "법인"이므로 기존 법인 당사자(대다수) 산출물은 byte 무변경
     (repTextOf 동일 분기). 신규(fresh) 개인은 director 값이 애초에 없어 이미 "" 였으므로
     무변경 — 본 수정은 오직 법인→개인 전환 stale 누수 케이스만 정리한다. DOCX↔HTML
     평행(두 정의 동일 분기)으로 미리보기↔다운로드 정합 유지.

   본 가드의 단언(생성/DOCX/HTML 로직·값·표 구조·라벨 무접촉 — repTextOf 정합성만):
     (A) 정적 — repTextOf 두 정의 모두 `p.type === "개인" ? ""` 게이트로 시작(정확히 2곳)
     (B) 정적 — 게이트 없는(type 무관 항상 director 반환) repTextOf 정의 잔존 0(회귀 차단)
     (C) 정적 — 무회귀: 표2 "대표자" 행·날인 "상호명 및 대표자명" 헤더·"대표자 " 접두·
                 repTextOf 사용처(표2 2곳·날인 + HTML 평행)·식별번호 라벨 type 분기 보존
     (D) 정적 — PartyCard 와 동일 isCorp 정책 정합(개인 = 이사회 직위 미노출)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-appform-rep-individual.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { blankContractForm } from "../src/lib/engine/model.ts";
const B = await import("../src/lib/engine/docx/builders.js");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const builders = readFileSync(join(root, "src/lib/engine/docx/builders.js"), "utf8");
const partyCard = readFileSync(join(root, "src/components/trust/steps/PartyCard.tsx"), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

console.log("\n[A] 정적 — repTextOf 두 정의 모두 `p.type === \"개인\" ? \"\"` 게이트로 시작");
// const repTextOf = (p) => p.type === "개인" ? ""
//                      : p.representativeDirector ? "대표이사 " + …
const gated = /const repTextOf = \(p\) => p\.type === "개인" \? ""\s*:\s*p\.representativeDirector \? "대표이사 " \+ p\.representativeDirector\s*:\s*p\.insideDirector \? "사내이사 " \+ p\.insideDirector : "";/g;
const gatedCount = (builders.match(gated) || []).length;
ok(gatedCount === 2, `게이트된 repTextOf 정의 정확히 2곳(DOCX appform + HTML appform) — 실제 ${gatedCount}`);

console.log("\n[B] 정적 — 게이트 없는 repTextOf 정의 잔존 0(회귀 차단)");
// repTextOf 정의가 모두 type 게이트를 먼저 거치는지: 정의 직후 곧장 representativeDirector 로
// 시작하는(게이트 없는) 형태가 남아 있으면 회귀.
const ungated = /const repTextOf = \(p\) => p\.representativeDirector \?/g;
const ungatedCount = (builders.match(ungated) || []).length;
ok(ungatedCount === 0, `게이트 없는 repTextOf 정의(type 무관 항상 director 반환) 잔존 0 — 실제 ${ungatedCount}`);
// repTextOf 정의 자체는 여전히 2개여야 한다(삭제·중복 아님)
const defCount = (builders.match(/const repTextOf = \(p\) =>/g) || []).length;
ok(defCount === 2, `repTextOf 정의 총 2개 유지(DOCX+HTML) — 실제 ${defCount}`);

console.log("\n[C] 정적 — 무회귀: 폼 구조·라벨·사용처·식별번호 분기 보존");
// 표2 "대표자" 행 라벨(verbatim 양식 구조) 보존 — DOCX cell + HTML td
ok(/cell\(\{ text: "대표자", bold: true/.test(builders), 'DOCX 표2 "대표자" 라벨 행 보존');
ok(/<td class="key center">대표자<\/td>/.test(builders), 'HTML 표2 "대표자" 라벨 셀 보존');
// 날인 표 헤더 "상호명 및 대표자명" + "대표자 " 접두 보존(구조 무변경)
ok(/상호명 및 대표자명/.test(builders), '날인 표 "상호명 및 대표자명" 헤더 보존');
ok(/"대표자 " \+ repTextOf\(party\)/.test(builders), 'DOCX 날인 "대표자 " + repTextOf(party) 줄 보존');
ok(/대표자 \$\{escHTML\(repTextOf\(party\)\)\}/.test(builders), 'HTML 날인 "대표자 ${repTextOf(party)}" 줄 보존');
// repTextOf 사용처 — 표2 2곳(위탁자·채무자) + 날인(DOCX 1곳·HTML table 1곳·HTML 날인 1곳)
const useCount = (builders.match(/repTextOf\(/g) || []).length;
// 호출부 5곳: DOCX 표2×2(위탁자·채무자)·DOCX 날인·HTML 표·HTML 날인
ok(useCount === 5, `repTextOf 호출 총 5곳(DOCX 표2×2·DOCX날인·HTML표·HTML날인) — 실제 ${useCount}`);
// 식별번호 라벨 type 분기(개인=생년월일) 무회귀 — appform 표2 DOCX + HTML
ok((builders.match(/text: p\.type === "개인" \? "생년월일" : "법인등록번호"/g) || []).length >= 2,
  "appform DOCX 표2 식별번호 라벨 type 분기 보존(위탁자·채무자)");
ok(/p\.type === "개인" \? "생년월일" : "법인등록번호"/.test(builders),
  "appform HTML 식별번호 라벨 type 분기 보존");

console.log("\n[D] 정적 — PartyCard isCorp 정책 정합(개인 = 이사회 직위 미노출)");
ok(/const isCorp = party\.type !== "개인"/.test(partyCard),
  'PartyCard: isCorp = party.type !== "개인" 정의(산출물 repTextOf 게이트와 동일 기준)');
ok(/\{isCorp && \([\s\S]*?대표이사[\s\S]*?사내이사[\s\S]*?\)\}/.test(partyCard),
  "PartyCard: 대표이사·사내이사 입력이 isCorp 일 때만 노출(개인 숨김) — 산출물 게이트와 정합");

console.log("\n[E] 동적 — 평행 HTML appform: 개인 위탁자 ⇒ 이사 값 누수 0 / 법인 ⇒ 표출");
// 법인 위탁자 + 대표이사 입력 ⇒ "대표이사 …" 표출(무회귀)
const formCorp = blankContractForm();
formCorp.trustors[0].representativeDirector = "김대표";
const htmlCorp = B.previewDocHTML(formCorp, "appform");
ok(typeof htmlCorp === "string" && htmlCorp.length > 200, `appform HTML 렌더(len=${htmlCorp.length})`);
ok(htmlCorp.includes("대표이사 김대표"),
  "법인 위탁자 + 대표이사 입력 ⇒ appform HTML 에 '대표이사 김대표' 표출(무회귀)");
// ★법인 시절 입력했다가 개인으로 전환한 stale 이사 값 — 개인이면 누수 0
const formPerson = blankContractForm();
formPerson.trustors[0].type = "개인";
formPerson.trustors[0].representativeDirector = "김대표"; // 전환 전 stale 값(비파괴 모델)
formPerson.trustors[0].insideDirector = "이사내";
const htmlPerson = B.previewDocHTML(formPerson, "appform");
ok(!htmlPerson.includes("대표이사 김대표"),
  "개인 위탁자 ⇒ stale '대표이사 김대표' 누수 0(repTextOf type 게이트)");
ok(!htmlPerson.includes("사내이사 이사내"),
  "개인 위탁자 ⇒ stale '사내이사 이사내' 누수 0");
// ★폼 구조(verbatim) 보존 — 개인이어도 "대표자" 라벨 행은 그대로 존재
ok(htmlPerson.includes("대표자"),
  "개인 위탁자여도 '대표자' 행 라벨 보존(조사분석서 양식 구조 무변경)");

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
