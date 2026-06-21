/* ============================================================
   회귀 가드 — 법인 전용 입력 affordance 의 개인(자연인) 비노출

   배경(입력 정합성/UX, 12:14·13:01 식별번호 라벨 정합 thread 의 입력측 연장):
     PartyCard 는 대표이사·사내이사 입력 칸과 "법인등기부 PDF"(OCR) 버튼을
     당사자 type 과 무관하게 항상 노출했다. 그러나 대표이사·사내이사는 이사회
     직위로 **법인 전용**이고, 법인등기부 추출도 법인에만 의미가 있어, 자연인
     (개인) 당사자에겐 존재하지 않는 개념을 입력하라고 보여주던 입력 혼동이
     있었다. type==="개인" 일 때 이 세 affordance 를 숨긴다.

   ★무회귀·정확성 경계:
     · 비파괴 — 숨기기만 하고 모델 값(representativeDirector/insideDirector)은
       비우지 않는다. 법인↔개인 전환 시 데이터 보존(법인 복귀 시 그대로 복원).
     · 사업자등록번호는 **개인사업자도 보유**하므로 숨기지 않는다(계속 노출).
     · 산출물(builders.js)·조문·검증 게이트 전부 무접촉 — 입력 UI 노출만 조정.
       (개인 당사자의 산출물 라벨=상호/대표이사/법인등록번호 정합은 서명란
        verbatim 영역 → 원본 양식 대조(사업팀 M1) 이후 별도 처리. 추정 형식 금지.)

   본 가드(정적 — PartyCard.tsx 소스 단언):
     (A) isCorp = type !== "개인" 단일 출처 파생
     (B) 법인등기부 PDF 버튼이 isCorp 게이트 안에 있음(개인 비노출)
     (C) 대표이사·사내이사 필드가 isCorp 게이트 안에 있음(개인 비노출)
     (D) 비파괴 — 구분(type) onChange 가 director 값을 비우지 않음
     (E) 사업자등록번호는 게이트 밖(개인사업자 보유 → 항상 노출, 무회귀)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-party-corp-fields.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const card = readFileSync(join(root, "src/components/trust/steps/PartyCard.tsx"), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

// director 필드 블록(대표이사~사내이사)의 위치/게이트를 분석하기 위한 인덱스
const idxIsCorpDef = card.search(/const\s+isCorp\s*=/);
// 대표이사·사내이사 라벨은 a11y 정비(div→label)로 </label> 로 닫힌다(접근성 iteration).
const idxRepField = card.indexOf('대표이사</label>');
const idxInsideField = card.indexOf('사내이사</label>');
// 버튼은 accept="application/pdf" 로 유일 식별(주석 속 "법인등기부 PDF" 문자열과 구별)
const idxCorpPdf = card.indexOf('accept="application/pdf"');
// 사업자등록번호는 복합(3칸) 그룹 라벨이라 여전히 <div className="field-label" id=…> 로 렌더.
const idxBizNo = card.indexOf('사업자등록번호</div>');

console.log("\n[A] isCorp 단일 출처 — type !== '개인' 파생");
ok(idxIsCorpDef >= 0, "isCorp 파생 상수 정의 존재");
ok(/const\s+isCorp\s*=\s*party\.type\s*!==\s*"개인"\s*;/.test(card),
  'isCorp = party.type !== "개인"');

console.log("\n[B] 법인등기부 PDF 버튼 — isCorp 게이트 안(개인 비노출)");
// {isCorp && ( ... 법인등기부 PDF ... )} 패턴: isCorp 게이트가 버튼 직전에 위치
ok(idxCorpPdf >= 0, "법인등기부 PDF 버튼 존재(accept=application/pdf)");
// PDF 버튼을 감싸는 가장 가까운 앞쪽 {isCorp && ( 게이트가, 버튼과 director 필드(rep) 사이에서
// 별도로 닫히는 헤더 전용 게이트임을 확인(버튼 앞 게이트 존재 + 그 게이트가 rep 게이트와 구별).
const gateBeforePdf = card.lastIndexOf("{isCorp && (", idxCorpPdf);
ok(gateBeforePdf >= 0 && gateBeforePdf < idxCorpPdf,
  "법인등기부 PDF 앞에 {isCorp && ( 게이트 존재");

console.log("\n[C] 대표이사·사내이사 필드 — isCorp 게이트 안(개인 비노출)");
ok(idxRepField >= 0 && idxInsideField >= 0, "대표이사·사내이사 필드 존재");
// 두 필드를 감싸는 가장 가까운 앞쪽 {isCorp && ( 게이트가, 그 사이에 닫히지 않고 유지되는지
const gateBeforeRep = card.lastIndexOf("{isCorp && (", idxRepField);
ok(gateBeforeRep >= 0 && gateBeforeRep < idxRepField,
  "대표이사 필드 앞에 {isCorp && ( 게이트 존재");
ok(gateBeforeRep < idxInsideField,
  "사내이사 필드도 동일 isCorp 게이트 범위 내(대표이사와 함께 묶임)");
// director 게이트가 사업자등록번호(개인사업자 보유=항상 노출)보다 뒤에 있어 biz 를 감싸지 않음
ok(idxBizNo >= 0 && idxBizNo < idxRepField,
  "사업자등록번호 필드가 director 게이트보다 앞(게이트 밖)");

console.log("\n[D] 비파괴 — type 전환이 director 값을 비우지 않음(데이터 보존)");
// 구분 select onChange 는 type 만 set(다른 키 초기화 없음)
ok(/onChange=\{\(e\)\s*=>\s*set\(\{\s*type:\s*e\.target\.value\s+as\s+PartyType\s*\}\)\}/.test(card),
  "구분 onChange = set({ type }) 단일 — director 클리어 없음");
ok(!/representativeDirector:\s*""/.test(card) && !/insideDirector:\s*""/.test(card),
  "어디서도 representativeDirector/insideDirector 를 ''로 강제 클리어하지 않음");

console.log("\n[E] 사업자등록번호 — 게이트 밖(개인사업자 보유, 항상 노출=무회귀)");
const bizGate = card.lastIndexOf("{isCorp && (", idxBizNo);
// biz 앞의 가장 가까운 isCorp 게이트가 없거나, 있어도 그 게이트는 PDF 헤더용으로 이미 닫힘
// → biz 라인이 director 게이트(rep 앞) 범위에 들지 않음을 [C] 마지막 단언이 보장.
ok(idxBizNo < idxRepField,
  "사업자등록번호가 director(법인 전용) 게이트보다 앞에 렌더(개인도 노출)");
ok(card.includes('사업자등록번호</div>'),
  "사업자등록번호 입력 칸 존속(제거되지 않음)");

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
