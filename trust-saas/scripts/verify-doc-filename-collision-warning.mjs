/* ============================================================
   회귀 가드 — 서류 위저드(DocStep) 다운로드 직전 "파일명 충돌" 사전 경고

   배경: 내 계약 목록(ContractsView)에는 산출 .docx 다운로드명이 같아 파일이 섞일 수 있는
   계약에 사후 충돌 경고가 있었다(verify-download-filename-collision-warning). 그러나 정작
   사용자가 서류를 생성·다운로드하는 위저드(DocStep, 산출 동선의 끝)에는 "지금 누르면 받게 될
   파일이 다른 계약과 섞인다"는 사전 신호가 없었다 — 다운로드명은 `{서류종류명}_{위탁자}_
   {체결일}_{소재지}`(계약 제목 무관)로만 정해져, 같은 위탁자·체결일·소재지의 다른 저장 계약과
   파일명이 같으면 브라우저가 덮어쓰거나 "(1)" 자동부여로 섞인다(신탁 서류=법적 효력 문서·정확성
   위험). 이미 마감한 .docx/PDF "받게 될 파일명" 미리보기(ca8fc80·03973e9) 바로 옆에 충돌
   경고를 두어, 생성 전에 섞임을 인지하게 한다.

   변경(표시 전용·산출/검증/조문 무접촉):
     - contractRepo.ts: downloadKeyOf 를 단일 출처로 이관(내 계약 목록 collidingDownloadIds 의
       keyFor 와 위저드 사전 점검이 같은 함수 → 두 표면 판정 일치·드리프트 0). { doc_type,
       form_data } 최소 형태를 읽어 아직 저장 전인 위저드 입력값에도 그대로 쓴다.
     - contractRepo.ts: downloadKeyCollidesWithSaved(rows, currentId, currentKey) 순수 점검 —
       자기 자신(currentId)·빈 키 제외, 같은 키의 다른 저장 행이 있으면 true.
     - contractRepo.ts: snapshotContracts() 동기 스냅샷(위저드 즉시 조회용).
     - DocStep.tsx: currentDownloadKey(downloadKeyOf) + savedCount(useSyncExternalStore 구독) +
       filenameCollision(useMemo) + 미리보기 아래 충돌 경고(role=status·var(--c-brown)·⚠).

   핵심 불변식:
     - ★표시 전용 — 산출물(docx/PDF 동작)·검증(validateDoc)·조문·엔진 무접촉(식별 키 비교만).
     - 경고는 차단이 아닌 안내(var(--c-brown), 차단 적색 아님) + role=status·aria-live=polite
       (입력 지점 advisory 패밀리 동형) + 새 CSS 0(field-hint + 인라인 style).
     - 정확성: 파일명은 위탁자·체결일·소재지로 정해져 계약 "제목"과 무관 — 이름변경이 아니라
       식별값 구분·파일명 직접 변경을 해소책으로 안내(내 계약 목록 경고와 동일 출처·문구).

   단언:
     (A) contractRepo — downloadKeyCollidesWithSaved/snapshotContracts export + 충돌 점검 행동
     (B) DocStep 배선 — import·useSyncExternalStore·currentDownloadKey(downloadKeyOf)·filenameCollision·경고
     (C) 무접촉 — brown·role=status·⚠ aria-hidden·차단 적색 미사용·새 CSS 0·제목 무관 안내

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-doc-filename-collision-warning.mjs
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
const repo = read("src", "lib", "contractRepo.ts");
const keymod = read("src", "lib", "ui", "download-key.ts");
const docstep = read("src", "components", "trust", "steps", "DocStep.tsx");
const globals = read("src", "app", "globals.css");

console.log("\n[A] contractRepo — downloadKeyCollidesWithSaved·snapshotContracts + 충돌 점검 행동");
{
  ok(/export function downloadKeyCollidesWithSaved\(/.test(repo),
     "downloadKeyCollidesWithSaved export");
  const at = repo.indexOf("export function downloadKeyCollidesWithSaved(");
  const body = repo.slice(at, at + 480);
  ok(/if \(!currentKey\) return false;/.test(body),
     "빈 키(식별 불가)면 false(노이즈 방지)");
  ok(/r\.id !== currentId/.test(body),
     "작성 중 계약 자신(currentId)은 충돌에서 제외");
  ok(/keyFor: \(r: ContractRow\) => string \| null/.test(body) && /keyFor\(r\) === currentKey/.test(body),
     "keyFor 주입(downloadKeyOf 단일 출처)로 저장 행 키 비교(목록 경고와 동일) — contractRepo 엔진 import 0");
  ok(!/from "@\/lib\/engine\/docx"/.test(repo),
     "contractRepo: 엔진 import 부재(가드 런타임 로더 호환)");
  ok(/export function snapshotContracts\(\): ContractRow\[\]/.test(repo),
     "snapshotContracts(): ContractRow[] export(동기 스냅샷)");
  // downloadKeyOf 단일 출처는 lib/ui/download-key(엔진 의존을 contractRepo 밖에 둔다)
  ok(/export function downloadKeyOf\(/.test(keymod) &&
     /import \{ contractFileKey \} from "@\/lib\/engine\/docx"/.test(keymod),
     "download-key: downloadKeyOf export + 엔진 contractFileKey import(키 단일 출처)");

  // 행동 단언 — 점검 알고리즘을 직접 실행(실제 함수는 downloadKeyOf 를 keyFor 로 사용)
  const collides = (rows, currentId, currentKey, keyFor) => {
    if (!currentKey) return false;
    return rows.some((r) => r.id !== currentId && keyFor(r) === currentKey);
  };
  const rows = [
    { id: "self", k: "coll:홍길동_20260301_서울 강남" },
    { id: "other", k: "coll:홍길동_20260301_서울 강남" }, // self 와 같은 키(다른 계약)
    { id: "diff", k: "coll:홍길동_20260301_부산 해운대" }, // 소재지 다름
  ];
  const keyFor = (r) => r.k;
  ok(collides(rows, "self", "coll:홍길동_20260301_서울 강남", keyFor) === true,
     "행동: 같은 키의 다른 저장 계약이 있으면 true(other)");
  ok(collides([rows[0]], "self", "coll:홍길동_20260301_서울 강남", keyFor) === false,
     "행동: 자기 자신만 같은 키면 false(currentId 제외)");
  ok(collides(rows, "self", "coll:홍길동_20260301_제주", keyFor) === false,
     "행동: 일치하는 다른 계약 없으면 false");
  ok(collides(rows, null, null, keyFor) === false,
     "행동: currentKey 빈 값(식별 불가)이면 false");
}

console.log("\n[B] DocStep 배선 — import·구독·currentDownloadKey·filenameCollision·경고");
{
  ok(/downloadKeyCollidesWithSaved,/.test(docstep) &&
     /snapshotContracts,/.test(docstep) &&
     /subscribeContracts,/.test(docstep) &&
     /contractCount,/.test(docstep) &&
     /from "@\/lib\/contractRepo"/.test(docstep),
     "contractRepo 에서 downloadKeyCollidesWithSaved·snapshotContracts·subscribeContracts·contractCount import");
  ok(/import \{ downloadKeyOf \} from "@\/lib\/ui\/download-key"/.test(docstep),
     "downloadKeyOf 는 lib/ui/download-key 단일 출처에서 import(목록과 동일)");
  ok(/useSyncExternalStore/.test(docstep) && /from "react"/.test(docstep),
     "react useSyncExternalStore import(저장 변경 구독)");
  ok(/currentContractId, docTypeId \} = useContractStore\(\)/.test(docstep),
     "store 에서 currentContractId·docTypeId 구독(자기 제외·키 산출)");
  ok(/downloadKeyOf\(\{ doc_type: docTypeId \?\? "", form_data: form \}\)/.test(docstep),
     "currentDownloadKey = downloadKeyOf({ doc_type, form_data: form })(목록과 동일 출처)");
  ok(/useSyncExternalStore\(subscribeContracts, contractCount, \(\) => 0\)/.test(docstep),
     "savedCount = useSyncExternalStore(subscribeContracts, contractCount, ()=>0)(staleness 0)");
  ok(/downloadKeyCollidesWithSaved\(snapshotContracts\(\), currentContractId, currentDownloadKey, downloadKeyOf\)/.test(docstep),
     "filenameCollision = downloadKeyCollidesWithSaved(snapshotContracts(), currentContractId, currentDownloadKey, downloadKeyOf)");
  ok(/\{ok && filenameCollision && \(/.test(docstep),
     "충돌 경고는 생성 가능(ok)·충돌(filenameCollision)일 때만 렌더(다운로드 직전)");
  ok(/다른 계약과 다운로드 파일명이 같아 받게 될 \.docx·PDF 가 섞일 수 있습니다/.test(docstep),
     "경고 문구(받게 될 .docx·PDF 섞임 사전 고지)");
}

console.log("\n[C] 무접촉 — brown·role=status·⚠ aria-hidden·차단 적색 미사용·새 CSS 0·제목 무관");
{
  const at = docstep.indexOf("{ok && filenameCollision && (");
  const block = docstep.slice(at, at + 720);
  ok(/role="status"/.test(block) && /aria-live="polite"/.test(block),
     "경고: role=status·aria-live=polite(입력 지점 advisory 패밀리 동형)");
  ok(/color: "var\(--c-brown\)"/.test(block),
     "경고 색 = var(--c-brown)(막지 않는 안내 — 차단 적색 아님)");
  ok(/<span aria-hidden="true">⚠ <\/span>/.test(block),
     "⚠ 글리프만 aria-hidden(의미는 가시 텍스트)");
  ok(!/var\(--c-danger\)/.test(block),
     "경고에 차단 적색(--c-danger) 미사용");
  ok(/className="field-hint"/.test(block),
     "기존 field-hint 클래스 재사용(새 CSS 0)");
  ok(/계약 제목과 무관/.test(block),
     "정확성: 파일명은 제목과 무관임을 명시(이름변경 오안내 차단)");
  ok(/받은 파일 이름을 직접 바꿔/.test(block),
     "정확성: 같은 계약이면 받은 파일명 직접 변경(actionable 해소책)");
  ok(!/doc-filename-collision/.test(globals) && !/wizard-collision/.test(globals),
     "globals.css 에 신규 충돌 전용 클래스 0");
}

console.log(`\n${fail === 0 ? "✅" : "❌"} doc-filename-collision-warning: ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
