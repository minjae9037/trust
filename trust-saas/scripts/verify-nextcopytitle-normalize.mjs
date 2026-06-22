/* ============================================================
   회귀 가드 — nextCopyTitle 의 트림·빈 폴백을 normalizeTitle 단일 출처로 정합

   배경: 계약 제목은 카드 식별·검색·정렬의 핵심이라 저장(saveContract)·이름변경
   (renameRow)은 normalizeTitle(앞뒤 공백 제거·빈/공백 → "제목 없음") 단일 출처를
   쓴다. 그런데 복제 제목 생성기 nextCopyTitle 만 사본 접미사를 벗긴 뒤 **인라인**
   `.trim() || "제목 없음"` 으로 같은 처리를 **복제**하고 있어, 정규화 규칙이 바뀌면
   세 경로(저장·이름변경·복제)가 갈릴 수 있는 정합 갭이 있었다. nextCopyTitle 의 루트
   트림·빈 폴백을 normalizeTitle 로 위임해 단일 출처로 통일한다.

   핵심 불변식(정합·무회귀):
     - 사본 접미사를 벗긴 루트의 트림·빈 → "제목 없음" 은 normalizeTitle 과 동일하다.
     - 기존 nextCopyTitle 의 모든 출력은 그대로다(behavior-preserving 리팩터).
     - 인라인 `.trim() || "제목 없음"` 중복이 제거되고 normalizeTitle 을 호출한다.

   단언:
     (A) 루트 정규화 정합 — strip 후 트림·빈 폴백이 normalizeTitle(strip) 과 일치(다양한 입력)
     (B) behavior-preserving — 기존 duplicate 가드 케이스 출력 무변(기본·번호·중첩·접미사·빈/공백)
     (C) 소스 무회귀 — nextCopyTitle 이 normalizeTitle 사용·인라인 `.trim() || "제목 없음"` 잔존 0

   순수 헬퍼(nextCopyTitle/normalizeTitle)를 contractRepo.ts 에서 직접 import.

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-nextcopytitle-normalize.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { nextCopyTitle, normalizeTitle } from "../src/lib/contractRepo.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

// nextCopyTitle 이 내부에서 쓰는 것과 동일한 사본 접미사 strip(가드 독립 재현).
const stripCopy = (s) => (s || "").replace(/\s*\(사본(?: \d+)?\)\s*$/, "");
// strip 된 루트만 추출(충돌 없으면 "<root> (사본)" 이므로 " (사본)" 접미사를 한 번 제거).
const rootOf = (base) => nextCopyTitle(base, []).replace(/ \(사본\)$/, "");

console.log("\n[A] 루트 정규화 정합 — strip 후 트림·빈 폴백 == normalizeTitle(strip)");
{
  const cases = [
    "판교 PF 담보신탁",
    "  앞뒤 공백  ",
    "",
    "   ",
    "\t탭\n",
    "역삼 담보신탁 (사본)",
    "역삼 담보신탁 (사본 3)",
    "  공백+사본  (사본 2)",
    "(사본)",
    "   (사본)   ",
  ];
  for (const t of cases) {
    const expected = normalizeTitle(stripCopy(t));
    ok(rootOf(t) === expected, `루트 정합: ${JSON.stringify(t)} → ${JSON.stringify(expected)}`);
  }
}

console.log("\n[B] behavior-preserving — 기존 duplicate 가드 케이스 출력 무변");
{
  ok(nextCopyTitle("판교 담보신탁", []) === "판교 담보신탁 (사본)", "기본 → '(사본)'");
  ok(nextCopyTitle("판교 담보신탁", ["판교 담보신탁 (사본)"]) === "판교 담보신탁 (사본 2)", "충돌 → '(사본 2)'");
  ok(
    nextCopyTitle("판교 담보신탁", ["판교 담보신탁 (사본)", "판교 담보신탁 (사본 2)"]) === "판교 담보신탁 (사본 3)",
    "연속 충돌 → '(사본 3)'",
  );
  ok(nextCopyTitle("판교 담보신탁 (사본)", ["판교 담보신탁 (사본)"]) === "판교 담보신탁 (사본 2)", "사본의 사본 → 중첩 없이 '(사본 2)'");
  ok(nextCopyTitle("판교 담보신탁 (사본 3)", []) === "판교 담보신탁 (사본)", "'(사본 N)' 접미사도 벗겨짐");
  ok(nextCopyTitle("", []) === "제목 없음 (사본)", "빈 제목 → '제목 없음 (사본)'");
  ok(nextCopyTitle("   ", []) === "제목 없음 (사본)", "공백 제목 → '제목 없음 (사본)'");
}

console.log("\n[C] 소스 무회귀 — nextCopyTitle 이 normalizeTitle 사용·인라인 폴백 잔존 0");
{
  const __dir = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(__dir, "..", "src", "lib", "contractRepo.ts"), "utf8");
  const startIdx = src.indexOf("export function nextCopyTitle");
  ok(startIdx >= 0, "nextCopyTitle 정의 존재");
  const after = src.slice(startIdx);
  const nextExport = after.indexOf("\nexport ", 1);
  const body = nextExport > 0 ? after.slice(0, nextExport) : after;
  ok(/normalizeTitle\(/.test(body), "nextCopyTitle 본문이 normalizeTitle 호출(단일 출처 위임)");
  ok(!/\.trim\(\)\s*\|\|\s*"제목 없음"/.test(body), "인라인 `.trim() || \"제목 없음\"` 잔존 0(중복 제거)");
  // normalizeTitle 정의 자체는 보존(트림·빈 → "제목 없음").
  ok(/return \(raw \|\| ""\)\.trim\(\) \|\| "제목 없음";/.test(src), "normalizeTitle 정의 보존(트림·빈 → 제목 없음)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
