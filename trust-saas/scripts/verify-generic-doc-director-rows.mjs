/* ============================================================
   회귀 가드 — 생성 서류(generic DOCX) 관계사 요약 표 대표이사·사내이사 행 ↔ 개인 당사자 정합성

   배경(산출물 정합성 갭, 정확성 — 개인 당사자 산출물 정합 family):
     입력 UI(PartyCard)는 대표이사·사내이사를 "이사회 직위(법인 전용 개념)"로 보고
     개인 당사자에겐 그 입력란을 숨기는 결정(PartyCard.tsx isCorp)을 내렸다 — 단,
     법인↔개인 전환 시 데이터 보존을 위해 모델 값은 비우지 않는 비파괴 방식이다.
     그런데 생성 서류(generic) DOCX 빌더의 관계사 요약 표(`partyTable`,
     generateDoc → poa·valReport·boardMin·cdd·ubo 5종에 적용)는 type 무관 항상
     "대표이사"·"사내이사" 두 행을 박았다. 그 결과 개인 당사자(위탁자·채무자·수익자·
     우선수익자 4역할 모두 partyGroup 적용)의 요약 표에 ① 존재하지 않는 개념인
     이사회 직위 행이 빈칸으로 박히고 ② 법인 시절 입력했다가 개인으로 전환한 stale
     이사 값이 그대로 누수되는 산출물 불일치가 남아 있었다.

   수정(조문·엔진·검증 게이트·데이터 모델·표 구조·값 무접촉 — 행 노출 분기만):
     partyTable 의 대표이사·사내이사 두 kvRow 를 `p.type !== "개인"` 일 때만 포함하도록
     조건부 spread 로 감싼다(PartyCard 의 isCorp 결정을 산출물에 전파). 개인이면 두 행
     생략, 법인이면 기존과 동일. 다른 행(구분·법인명/성명·식별번호·사업자등록번호·
     주소·연락처)·값 전부 무변경.

   ★영향 점검 — 무회귀:
     기본 type 은 "법인"이므로 기존 법인 당사자(대다수) 산출물은 byte 무변경(행 동일).
     개인 당사자일 때만 두 행이 생략된다. 본 출력은 verbatim 정본이 아니라 "입력값
     검증용 임시 출력물"(builders.js 명시)이며, 계약서 본문 서명란(verbatim) 의 개인
     정합은 본 가드 범위 밖(사업팀 판단). 또 contract·appform 은 generateDoc 에서
     children 배열을 통째로 교체하므로 partyTable 미사용 = 본 변경 비적용(5종 한정).

   본 가드의 단언(생성/DOCX 로직·값·표 구조 무접촉 — 행 노출 정합성만):
     (A) 정적 — partyTable 의 대표이사·사내이사 kvRow 가 `p.type !== "개인"` 조건부 spread 안에
     (B) 정적 — 무조건(top-level) `kvRow("대표이사", …)`·`kvRow("사내이사", …)` 잔존 0(회귀 차단)
     (C) 정적 — 무회귀: 다른 행(구분·법인명/성명·식별번호 분기·사업자등록번호·주소·연락처)·
                 partyGroup 4역할 적용 보존
     (D) 정적 — PartyCard 와 동일 isCorp 정책 정합(개인 = 이사회 직위 미노출)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-generic-doc-director-rows.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const builders = readFileSync(join(root, "src/lib/engine/docx/builders.js"), "utf8");
const partyCard = readFileSync(join(root, "src/components/trust/steps/PartyCard.tsx"), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

// partyTable 정의 블록만 잘라 검사(다른 빌더의 동명 패턴과 혼동 방지)
const ptStart = builders.indexOf("const partyTable = (p) => new Table({");
ok(ptStart >= 0, "partyTable 정의 발견");
const ptEnd = builders.indexOf("// 관계사 그룹", ptStart);
const partyTableBlock = ptStart >= 0 ? builders.slice(ptStart, ptEnd > ptStart ? ptEnd : ptStart + 1200) : "";

console.log("\n[A] 정적 — 대표이사·사내이사 행이 p.type !== \"개인\" 조건부 안에");
// ...(p.type !== "개인" ? [ kvRow("대표이사", …), kvRow("사내이사", …) ] : [])
const condSpread = /\.\.\.\(p\.type !== "개인" \? \[[\s\S]*?kvRow\("대표이사",[\s\S]*?kvRow\("사내이사",[\s\S]*?\] : \[\]\)/;
ok(condSpread.test(partyTableBlock),
  "대표이사·사내이사 kvRow 가 `...(p.type !== \"개인\" ? [...] : [])` 조건부 spread 안에 위치");

console.log("\n[B] 정적 — 무조건 대표이사·사내이사 kvRow 잔존 0(회귀 차단)");
// 조건부 spread 를 제거한 뒤에도 남는 director kvRow 가 있으면 = 무조건 행(회귀)
const withoutCond = partyTableBlock.replace(condSpread, "");
ok(!/kvRow\("대표이사",/.test(withoutCond),
  '조건부 밖 `kvRow("대표이사", …)` 잔존 없음(type 무관 항상 박히던 회귀 차단)');
ok(!/kvRow\("사내이사",/.test(withoutCond),
  '조건부 밖 `kvRow("사내이사", …)` 잔존 없음');

console.log("\n[C] 정적 — 무회귀: 다른 행·표 구조·partyGroup 4역할 적용 보존");
ok(/kvRow\("구분", p\.type \|\| ""\)/.test(partyTableBlock), "행: 구분 보존");
ok(/kvRow\("법인명\/성명", p\.name \|\| ""\)/.test(partyTableBlock), "행: 법인명/성명 보존");
ok(/kvRow\(p\.type === "개인" \? "생년월일" : "법인등록번호"/.test(partyTableBlock),
  "행: 식별번호 라벨 type 분기 보존(개인=생년월일)");
ok(/kvRow\("사업자등록번호",/.test(partyTableBlock), "행: 사업자등록번호 보존(개인사업자도 보유 → 항상 노출)");
ok(/kvRow\("주소", p\.address \|\| ""\)/.test(partyTableBlock), "행: 주소 보존");
ok(/kvRow\("연락처", p\.contact \|\| ""\)/.test(partyTableBlock), "행: 연락처 보존");
// partyGroup 이 4역할(위탁자·채무자·수익자·우선수익자) 전부에 partyTable 적용
ok((builders.match(/\.\.\.partyGroup\(/g) || []).length === 4,
  "partyGroup 4역할(위탁자·채무자·수익자·우선수익자) 적용 보존");
ok(/out\.push\(partyTable\(p\)\)/.test(builders), "partyGroup 이 partyTable 사용 보존");

console.log("\n[D] 정적 — PartyCard isCorp 정책 정합(개인 = 이사회 직위 미노출)");
// PartyCard 가 동일 개념으로 개인에게 대표이사·사내이사 입력을 숨김 → 산출물도 동일 정책
ok(/const isCorp = party\.type !== "개인"/.test(partyCard),
  "PartyCard: isCorp = party.type !== \"개인\" 정의(산출물 분기와 동일 기준)");
ok(/\{isCorp && \([\s\S]*?대표이사[\s\S]*?사내이사[\s\S]*?\)\}/.test(partyCard),
  "PartyCard: 대표이사·사내이사 입력이 isCorp 일 때만 노출(개인 숨김) — 산출물 행 분기와 정합");

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
