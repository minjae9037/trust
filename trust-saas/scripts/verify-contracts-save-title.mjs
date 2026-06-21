/* ============================================================
   회귀 가드 — saveContract 제목 정규화(normalizeTitle 재사용·트림 일관성)

   배경: 저장된 계약 제목은 카드 식별·검색·정렬의 핵심이다. 이름변경(renameContract→
   renameRow)은 normalizeTitle 로 제목을 정규화(앞뒤 공백 제거·빈/공백 → "제목 없음")
   하는데, saveContract 는 종전 `input.title || "제목 없음"` 으로 **트림 없이** 저장했다.
   "   "(공백만)은 truthy 라 그대로 통과 → 목록에 **빈 제목 카드**가 저장됐고, 같은 제목을
   rename 으로 바꾸면 "제목 없음" 이 되어 두 경로의 결과가 갈렸다(데이터 일관성 갭).
   이제 saveContract 도 normalizeTitle 을 재사용해 저장·이름변경의 트림 처리를 일치시킨다.

   핵심 불변식(데이터 일관성):
     - 저장 제목은 앞뒤 공백이 제거된다(신규·갱신 양쪽).
     - 공백만/빈 제목은 "제목 없음" 으로 저장된다(빈 제목 카드 방지).
     - 정상 제목은 그대로 저장된다(회귀 없음).
     - 저장·이름변경이 같은 normalizeTitle 단일 출처를 쓴다(결과 일치).

   단언:
     (A) 신규 저장: 앞뒤 공백 제거·공백만/빈 → "제목 없음"·정상 그대로
     (B) 기존 갱신(같은 id): 동일하게 정규화
     (C) 저장↔이름변경 결과 일치(같은 입력 → 같은 정규화 제목)
     (D) 소스 무회귀: saveContract 가 normalizeTitle 사용·맨몸 `input.title || "제목 없음"` 잔존 0

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-contracts-save-title.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  saveContract,
  renameRow,
  normalizeTitle,
  listContracts,
  getContract,
} from "../src/lib/contractRepo.ts";
import { blankContractForm } from "../src/lib/engine/model.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

/* --- 테스트용 localStorage 모킹 --- */
function installStore() {
  const map = new Map();
  globalThis.window = {};
  globalThis.localStorage = {
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(k, String(v)); },
    removeItem(k) { map.delete(k); },
    clear() { map.clear(); },
  };
}

console.log("\n[A] 신규 저장 — 제목 정규화(트림·공백만/빈 → '제목 없음'·정상 그대로)");
{
  installStore();
  const id1 = await saveContract({ id: undefined, docType: "collateral", category: "new", title: "  판교 PF 담보신탁  ", formData: blankContractForm() });
  const r1 = await getContract(id1);
  ok(r1 && r1.title === "판교 PF 담보신탁", "앞뒤 공백 제거되어 저장");

  const id2 = await saveContract({ id: undefined, docType: "collateral", category: "new", title: "   ", formData: blankContractForm() });
  const r2 = await getContract(id2);
  ok(r2 && r2.title === "제목 없음", "공백만 제목 → '제목 없음'(빈 제목 카드 방지)");

  const id3 = await saveContract({ id: undefined, docType: "collateral", category: "new", title: "", formData: blankContractForm() });
  const r3 = await getContract(id3);
  ok(r3 && r3.title === "제목 없음", "빈 제목 → '제목 없음'");

  const id4 = await saveContract({ id: undefined, docType: "collateral", category: "new", title: "역삼 담보신탁", formData: blankContractForm() });
  const r4 = await getContract(id4);
  ok(r4 && r4.title === "역삼 담보신탁", "정상 제목 그대로(회귀 없음)");
}

console.log("\n[B] 기존 갱신(같은 id) — 동일하게 정규화");
{
  installStore();
  const id = await saveContract({ id: undefined, docType: "collateral", category: "new", title: "초기 제목", formData: blankContractForm() });
  // 같은 id 로 공백 포함 제목 갱신
  await saveContract({ id, docType: "collateral", category: "new", title: "  갱신된 제목  ", formData: blankContractForm() });
  const r = await getContract(id);
  ok(r && r.title === "갱신된 제목", "갱신 경로도 앞뒤 공백 제거");
  const rows = await listContracts();
  ok(rows.length === 1, "같은 id 갱신은 행을 늘리지 않음(무회귀)");

  // 같은 id 로 공백만 제목 갱신 → "제목 없음"
  await saveContract({ id, docType: "collateral", category: "new", title: "  ", formData: blankContractForm() });
  const r2 = await getContract(id);
  ok(r2 && r2.title === "제목 없음", "갱신 시 공백만 → '제목 없음'");
}

console.log("\n[C] 저장 ↔ 이름변경 결과 일치(같은 normalizeTitle 단일 출처)");
{
  installStore();
  const cases = ["  판교  ", "   ", "", "정상 제목", "\t탭여백\n"];
  for (const t of cases) {
    const id = await saveContract({ id: undefined, docType: "collateral", category: "new", title: t, formData: blankContractForm() });
    const saved = await getContract(id);
    // 같은 입력으로 renameRow 가 내는 제목과 저장 제목이 일치해야 한다
    const renamed = renameRow([{ id, doc_type: "collateral", category: "new", status: "draft", title: "기존", form_data: blankContractForm(), updated_at: "t", created_at: "t" }], id, t, "now")[0].title;
    ok(saved && saved.title === renamed, `저장==이름변경 정규화 일치: ${JSON.stringify(t)} → ${JSON.stringify(renamed)}`);
    ok(saved && saved.title === normalizeTitle(t), `저장 제목 == normalizeTitle(${JSON.stringify(t)})`);
  }
}

console.log("\n[D] 소스 무회귀 — saveContract 가 normalizeTitle 사용·맨몸 폴백 잔존 0");
{
  const __dir = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(__dir, "..", "src", "lib", "contractRepo.ts"), "utf8");
  // saveContract 본문 추출(다음 export 직전까지)
  const startIdx = src.indexOf("export async function saveContract");
  ok(startIdx >= 0, "saveContract 정의 존재");
  const after = src.slice(startIdx);
  const nextExport = after.indexOf("\nexport ", 1);
  const body = nextExport > 0 ? after.slice(0, nextExport) : after;
  const usesNormalize = (body.match(/title:\s*normalizeTitle\(input\.title\)/g) || []).length;
  ok(usesNormalize === 2, "saveContract 신규·갱신 두 경로 모두 normalizeTitle(input.title) 사용(2곳)");
  ok(!/title:\s*input\.title\s*\|\|\s*"제목 없음"/.test(body), "맨몸 `input.title || \"제목 없음\"` 잔존 0(트림 누락 회귀 차단)");
  // normalizeTitle 정의는 그대로(트림·빈 → "제목 없음")
  ok(/return \(raw \|\| ""\)\.trim\(\) \|\| "제목 없음";/.test(src), "normalizeTitle 정의 보존(트림·빈 → 제목 없음)");
}

// 전역 정리(다른 가드 오염 방지)
delete globalThis.window;
delete globalThis.localStorage;

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
