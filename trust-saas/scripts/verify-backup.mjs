/* ============================================================
   회귀 가드 — 계약 백업(내보내기)·복원(가져오기)

   배경: 로컬 우선(localStorage) 구조라 계약 데이터가 한 브라우저에 갇혀 있다.
   캐시 삭제·기기 변경 시 전부 유실되고, 동료와 주고받을 수단도 없다. JSON 백업
   파일로 내보내고 다시 가져와 이 유실 위험을 막는다(dirty 가드와 동일 "유실 방지" 계열).

   핵심 불변식(데이터 안전):
     - 가져오기는 **비파괴** — 기존 계약을 절대 덮어쓰거나 지우지 않는다(새 id만 추가).
     - 이미 있는 id는 건너뛴다 → 같은 백업 재가져오기 시 중복 0(복원 멱등성).
     - 파일 내부 중복 id·손상 행은 격리(한 번만/아예 추가 안 함) → 목록 오염 방지.
     - 백업 형식 불일치(JSON 아님·format 키 없음)는 throw → 이질 파일 차단.

   단언:
     (A) makeBackup: format/version/count/contracts·시각 주입
     (B) parseBackup: 정상 라운드트립 / 잘못된 JSON·형식 throw
     (C) isValidRow: 정상 통과 / null·키 누락·타입 불일치 거부
     (D) mergeImported: 비파괴(기존 보존)·새 id 추가·id 충돌 건너뜀·내부중복/손상 격리·건수 합 일치
     (E) 라운드트립 + 멱등성: 내보내기→파싱→빈 저장소 병합=전체 복원, 재병합=0 추가

   순수 헬퍼를 contractRepo.ts 에서 직접 import.
   (localStorage 의존부 export/importContracts 는 브라우저 한정 — Playwright 가시 검증으로 보완)

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-backup.mjs
   ============================================================ */
import {
  makeBackup,
  parseBackup,
  isValidRow,
  mergeImported,
  BACKUP_FORMAT,
  BACKUP_VERSION,
} from "../src/lib/contractRepo.ts";
import { blankContractForm } from "../src/lib/engine/model.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const rowOf = (id, title, extra = {}) => ({
  id,
  doc_type: "collateral",
  category: "new",
  status: "completed",
  title,
  form_data: blankContractForm(),
  created_at: "2026-06-01T00:00:00.000Z",
  updated_at: "2026-06-10T00:00:00.000Z",
  ...extra,
});

console.log("\n[A] makeBackup — 형식·버전·건수·시각");
{
  const rows = [rowOf("a", "갑"), rowOf("b", "을")];
  const now = "2026-06-21T11:30:00.000Z";
  const b = makeBackup(rows, now);
  ok(b.format === BACKUP_FORMAT, "format = trustform.contracts");
  ok(b.version === BACKUP_VERSION, "version 주입");
  ok(b.exported_at === now, "exported_at = 주입 시각");
  ok(b.count === 2 && b.contracts.length === 2, "count·contracts 길이 일치");
}

console.log("\n[B] parseBackup — 정상 라운드트립 / 잘못된 입력 throw");
{
  const text = JSON.stringify(makeBackup([rowOf("a", "갑")], "2026-06-21T00:00:00.000Z"));
  const b = parseBackup(text);
  ok(b.contracts.length === 1 && b.contracts[0].id === "a", "정상 텍스트 파싱");

  let threw = false;
  try { parseBackup("{not json"); } catch { threw = true; }
  ok(threw, "잘못된 JSON → throw");

  threw = false;
  try { parseBackup(JSON.stringify({ format: "other", contracts: [] })); } catch { threw = true; }
  ok(threw, "format 불일치 → throw");

  threw = false;
  try { parseBackup(JSON.stringify({ format: BACKUP_FORMAT })); } catch { threw = true; }
  ok(threw, "contracts 배열 없음 → throw");
}

console.log("\n[C] isValidRow — 정상 통과 / 손상 거부");
{
  ok(isValidRow(rowOf("a", "갑")) === true, "정상 행 통과");
  ok(isValidRow(null) === false, "null 거부");
  ok(isValidRow({ id: "", doc_type: "x", title: "t", form_data: {} }) === false, "빈 id 거부");
  ok(isValidRow({ id: "a", title: "t", form_data: {} }) === false, "doc_type 누락 거부");
  ok(isValidRow({ id: "a", doc_type: "x", title: "t" }) === false, "form_data 누락 거부");
  ok(isValidRow({ id: 1, doc_type: "x", title: "t", form_data: {} }) === false, "id 타입 불일치 거부");
}

console.log("\n[D] mergeImported — 비파괴·새 id 추가·충돌 건너뜀·내부중복/손상 격리");
{
  const existing = [rowOf("a", "갑"), rowOf("b", "을")];
  const beforeExisting = JSON.stringify(existing);

  // 새 id 2건 + 기존 id 1건(a) → a 건너뜀, c·d 추가
  const r1 = mergeImported(existing, [rowOf("c", "병"), rowOf("a", "갑(다른편집)"), rowOf("d", "정")]);
  ok(r1.added === 2 && r1.skipped === 1, "새 2건 추가·기존 id 1건 건너뜀");
  ok(r1.merged.length === 4, "병합 결과 = 기존 2 + 신규 2");
  ok(r1.merged.some((x) => x.id === "a") && r1.merged.some((x) => x.id === "b"), "기존 계약 모두 보존");
  ok(JSON.stringify(existing) === beforeExisting, "기존 배열 무변형(비파괴)");
  // 충돌 id는 로컬 원본이 유지되어야 한다(가져온 편집본이 덮어쓰지 않음).
  const keptA = r1.merged.find((x) => x.id === "a");
  ok(keptA.title === "갑", "id 충돌 시 로컬 원본 보존(덮어쓰기 없음)");

  // 파일 내부 중복 id → 한 번만 추가
  const r2 = mergeImported([], [rowOf("z", "1"), rowOf("z", "2")]);
  ok(r2.added === 1 && r2.skipped === 1, "내부 중복 id 한 번만 추가");

  // 손상 행 격리
  const r3 = mergeImported([], [rowOf("ok", "정상"), null, { id: "x" }, { foo: 1 }]);
  ok(r3.added === 1 && r3.skipped === 3, "손상/이질 행 격리(정상 1건만 추가)");

  // 건수 합 = 입력 길이(불변식)
  ok(r1.added + r1.skipped === 3 && r3.added + r3.skipped === 4, "added+skipped = 입력 길이");
}

console.log("\n[E] 라운드트립 + 멱등성 — 내보내기→파싱→복원, 재가져오기 0 추가");
{
  const source = [rowOf("a", "갑"), rowOf("b", "을"), rowOf("c", "병")];
  const text = JSON.stringify(makeBackup(source, "2026-06-21T12:00:00.000Z"));
  const parsed = parseBackup(text);

  // 빈 저장소(캐시 삭제·새 기기)로 복원 → 전체 복원
  const restore = mergeImported([], parsed.contracts);
  ok(restore.added === 3 && restore.merged.length === 3, "빈 저장소 복원 = 전체 3건");

  // 같은 백업 재가져오기 → 멱등(추가 0·중복 0)
  const again = mergeImported(restore.merged, parsed.contracts);
  ok(again.added === 0 && again.skipped === 3, "재가져오기 멱등(0 추가·전부 건너뜀)");
  ok(again.merged.length === 3, "중복 없이 3건 유지");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
