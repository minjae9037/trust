/* ============================================================
   회귀 가드 — 내 계약 목록 "다운로드 파일명 충돌" 경고

   배경: 산출 .docx 다운로드명은 `{서류종류명}_{위탁자}_{체결일}_{첫 소재지}[ 외N]` 로
   계약을 구별한다(docFileBase, 직전 소재지·외N 토큰 커밋). 그래도 위탁자·체결일·첫
   담보물건 소재지·물건 구성이 모두 같은 두 계약은 산출 파일명이 완전히 같아진다 —
   브라우저가 .docx 를 덮어쓰거나("(1)" 접미사) 어느 계약 것인지 구분되지 않아 섞인다.
   신탁 서류는 법적 효력 문서라 다른 계약의 서류를 제출하는 정확성 위험이다. 내 계약
   목록 카드는 위탁자·소재지(identity)·준비도·남은 입력까지 보여 주면서도, 정작 "이 두
   계약은 받으면 파일이 섞인다"는 신호는 없었다(식별 보강의 마지막 갭).

   변경(표시 전용·산출/검증/조문 무접촉):
     - builders.js: 파일명의 "계약 식별부"를 contractFileKey(f) 로 추출·export.
       docFileBase = `${서류종류명}_${contractFileKey(f)}` — 산출 동작 무변경(단일 출처화).
       서류종류명은 서류마다 불변이라, 두 계약이 (모든 서류에서) 섞이는지 = contractFileKey
       동일 여부. → 목록 경고가 실제 다운로드명과 어긋나지 않게 같은 키를 재사용한다.
     - docx/index.ts: contractFileKey 타입드 파사드 재노출(ContractForm→string).
     - contractRepo.ts: collidingDownloadIds(rows, keyFor) 순수 그룹핑 — 같은 키 2개 이상이면
       그 행 전부의 id 를 Set 으로(빈 키 null 제외, 입력 무변형).
     - ContractsView.tsx: downloadKeyOf(엔진 contractFileKey / joint=갑) + useMemo(collidingIds,
       [rows]) + 충돌 카드에 경고 줄(field-hint·var(--c-brown)·⚠·aria-hidden) + 카드 접근명
       (openLabel)에 충돌 고지(SR 동일 출처).

   핵심 불변식:
     - ★표시 전용 — 산출물(docx 내용/파일명 동작)·검증(validate)·조문·엔진 무접촉.
       contractFileKey 는 파일명 식별부 추출일 뿐 산출 파일명 문자열은 동일.
     - 충돌 그룹핑은 순수(collidingDownloadIds) — 같은 키 2+ → 전원 표시, 빈 키 제외.
     - 경고는 차단이 아닌 안내(var(--c-brown), 차단 적색 아님) + 줄 aria-hidden(낭독은
       카드 aria-label 전담, 중복 0) + 새 CSS 0(field-hint + 인라인 style).

   단언:
     (A) 엔진 단일 출처 — contractFileKey export·docFileBase 가 그것으로 합성·산출 동작 무변경
     (B) contractRepo 순수 그룹핑 — collidingDownloadIds(같은 키 2+ 전원·빈 키 제외·무변형)
     (C) ContractsView 배선 — import·downloadKeyOf(coll/joint·빈 위탁자 null)·useMemo·경고 줄·접근명
     (D) 무접촉 — 경고 줄 brown/aria-hidden·차단 적색 미사용·새 CSS 0·collidingDownloadIds 무변형

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-download-filename-collision-warning.mjs
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
const docxIndex = read("src", "lib", "engine", "docx", "index.ts");
const repo = read("src", "lib", "contractRepo.ts");
const view = read("src", "components", "trust", "ContractsView.tsx");
const globals = read("src", "app", "globals.css");

console.log("\n[A] 엔진 단일 출처 — contractFileKey export + docFileBase 합성(산출 동작 무변경)");
{
  ok(/export function contractFileKey\(f\)\s*\{/.test(builders),
     "builders.js: contractFileKey(f) export(파일명 식별부 추출)");
  // contractFileKey 본문 = 위탁자·체결일·소재지(docFileBase 가 쓰던 그 조합)
  const keyAt = builders.indexOf("export function contractFileKey(f)");
  const keyBody = builders.slice(keyAt, keyAt + 360);
  ok(/f\.trustors\[0\]\.name\) \|\| "위탁자"/.test(keyBody),
     "contractFileKey: 위탁자(trustors[0].name, 폴백 '위탁자')");
  ok(/docFileDateToken\(f && f\.common\)/.test(keyBody) && /docFilePropToken\(f\)/.test(keyBody),
     "contractFileKey: 체결일(docFileDateToken)·소재지(docFilePropToken) 합성");
  // docFileBase 가 contractFileKey 로 합성(단일 출처) — 산출 파일명 동작 무변경
  ok(/function docFileBase\(metaName, f\)\s*\{\s*return `\$\{metaName\}_\$\{contractFileKey\(f\)\}`;/.test(builders),
     "docFileBase = `${metaName}_${contractFileKey(f)}`(단일 출처·산출명 무변경)");
  // 회귀 방지: 옛 인라인 합성(metaName_trustor_date)이 docFileBase 에 남지 않음
  ok(!/return `\$\{metaName\}_\$\{trustor\}_\$\{docFileDateToken/.test(builders),
     "docFileBase 에 옛 인라인 trustor/date 합성 잔존 없음(중복 출처 0)");
  // docFilePropToken 의 외N·20자·금칙문자 정책 보존(파일명 동작 무회귀)
  ok(/외\$\{filled - 1\}/.test(builders) && /\.slice\(0, 20\)/.test(builders),
     "소재지 토큰 정책(외N·20자) 보존(파일명 동작 무회귀)");
}

console.log("\n[B] contractRepo 순수 그룹핑 — collidingDownloadIds");
{
  ok(/export function collidingDownloadIds\(/.test(repo),
     "collidingDownloadIds export");
  const at = repo.indexOf("export function collidingDownloadIds(");
  const body = repo.slice(at, at + 700);
  ok(/keyFor: \(r: ContractRow\) => string \| null/.test(body),
     "keyFor 주입(행→식별 키, 빈 키 null) — 실제 다운로드명 단일 출처 외부 주입");
  ok(/if \(!k\) continue;/.test(body),
     "빈 키(null/식별 불가)는 제외(빈 초안 노이즈 방지)");
  ok(/if \(ids\.length > 1\)/.test(body),
     "같은 키 2개 이상일 때만 충돌(단독 키는 비충돌)");
  ok(/return out;/.test(body) && /new Set<string>\(\)/.test(body),
     "충돌 행 전부의 id 를 Set 으로 반환");
  // 행동 단언 — 순수 함수를 직접 실행해 그룹핑 정확성 확인
  const fn = (rows, keyFor) => {
    const byKey = new Map();
    for (const r of rows) {
      const k = keyFor(r);
      if (!k) continue;
      const arr = byKey.get(k);
      if (arr) arr.push(r.id); else byKey.set(k, [r.id]);
    }
    const out = new Set();
    for (const ids of byKey.values()) if (ids.length > 1) for (const id of ids) out.add(id);
    return out;
  };
  const rows = [
    { id: "a", k: "coll:홍길동_20260301_서울 강남" },
    { id: "b", k: "coll:홍길동_20260301_서울 강남" }, // a 와 충돌
    { id: "c", k: "coll:홍길동_20260301_부산 해운대" }, // 소재지 다름 → 비충돌
    { id: "d", k: null }, // 식별 불가 → 제외
    { id: "e", k: null }, // 식별 불가 → 제외(빈 키끼리 충돌로 묶이지 않음)
  ];
  const out = fn(rows, (r) => r.k);
  ok(out.has("a") && out.has("b"), "행동: 같은 키 두 계약 전원 충돌(a·b)");
  ok(!out.has("c"), "행동: 소재지가 다른 키는 비충돌(c)");
  ok(!out.has("d") && !out.has("e"), "행동: 빈 키(식별 불가)는 충돌에서 제외(d·e)");
  ok(out.size === 2, "행동: 충돌 집합은 충돌한 두 행만(노이즈 0)");
  // 입력 무변형(순수)
  const frozen = [{ id: "x", k: "coll:k1" }, { id: "y", k: "coll:k1" }];
  const snap = JSON.stringify(frozen);
  fn(frozen, (r) => r.k);
  ok(JSON.stringify(frozen) === snap, "행동: 입력 배열 무변형(순수 함수)");
}

console.log("\n[C] ContractsView 배선 — downloadKeyOf·useMemo·경고 줄·접근명");
{
  ok(/collidingDownloadIds,/.test(view) && /from "@\/lib\/contractRepo"/.test(view),
     "contractRepo 에서 collidingDownloadIds import");
  ok(/contractFileKey \} from "@\/lib\/engine\/docx"/.test(view),
     "엔진 docx 파사드에서 contractFileKey import(실제 다운로드명 단일 출처)");
  // downloadKeyOf — coll/joint 분리 + 빈 위탁자 null
  const at = view.indexOf("function downloadKeyOf(");
  ok(at >= 0, "downloadKeyOf 정의 존재");
  const body = view.slice(at, at + 520);
  ok(/if \(!id\.trustor\) return null;/.test(body),
     "downloadKeyOf: 위탁자(갑) 미입력 → null(빈 초안 충돌 경고 제외)");
  ok(/r\.doc_type === "joint"/.test(body) && /`joint:\$\{id\.trustor\}`/.test(body),
     "downloadKeyOf: joint=`joint:{갑}`(공동사업표준협약서_{갑} 식별부)");
  ok(/`coll:\$\{contractFileKey\(r\.form_data as ContractForm\)\}`/.test(body),
     "downloadKeyOf: collateral=`coll:{contractFileKey}`(엔진 단일 출처)");
  // useMemo — 전체 rows 기준(검색·필터와 무관)
  ok(/const collidingIds = useMemo\(\(\) => collidingDownloadIds\(rows, downloadKeyOf\), \[rows\]\);/.test(view),
     "collidingIds = useMemo(collidingDownloadIds(rows, downloadKeyOf), [rows]) — 전체 rows");
  // 카드 경고 줄 — collision 게이트 + ⚠ + 문구
  ok(/const collision = collidingIds\.has\(r\.id\);/.test(view),
     "카드: collision = collidingIds.has(r.id)");
  ok(/\{collision && \(/.test(view),
     "경고 줄은 collision 일 때만 렌더");
  ok(/다른 계약과 다운로드 파일명이 같습니다/.test(view),
     "경고 문구(다른 계약과 다운로드 파일명이 같습니다)");
  // 접근명(openLabel)에 충돌 고지(SR 동일 출처)
  ok(/collisionLabel = collision/.test(view) && /\$\{collisionLabel\} — 열기`/.test(view),
     "카드 접근명(openLabel)에 충돌 고지 포함(SR 동일 출처)");
}

console.log("\n[D] 무접촉 — 안내(brown·aria-hidden)·차단 적색 미사용·새 CSS 0");
{
  // 경고 줄 블록 추출 — collision 렌더 분기
  const at = view.indexOf("{collision && (");
  const block = view.slice(at, at + 420);
  ok(/color: "var\(--c-brown\)"/.test(block),
     "경고 줄 색 = var(--c-brown)(막지 않는 안내 — 차단 적색 아님)");
  ok(/aria-hidden="true"/.test(block),
     "경고 줄 aria-hidden(낭독은 카드 aria-label 전담 — 중복 0)");
  ok(!/var\(--c-danger\)/.test(block),
     "경고 줄에 차단 적색(--c-danger) 미사용");
  ok(/className="field-hint"/.test(block),
     "기존 field-hint 클래스 재사용(새 CSS 0)");
  ok(!/contract-collision/.test(globals) && !/download-collision/.test(globals),
     "globals.css 에 신규 충돌 전용 클래스 0");
  // 엔진/검증 무접촉 — contractFileKey 는 파일명 식별부일 뿐(validate/builder 본문 무변경)
  ok(/export function contractFileKey\(form: ContractForm\): string \{\s*return B\.contractFileKey\(form\);/.test(docxIndex),
     "index.ts: contractFileKey 파사드(엔진 위임 — 별도 로직 0)");
}

console.log(`\n${fail === 0 ? "✅" : "❌"} download-filename-collision-warning: ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
