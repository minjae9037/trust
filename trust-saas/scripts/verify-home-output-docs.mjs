/* ============================================================
   회귀 가드 — 홈 랜딩(/) "생성되는 서류" 산출물 제시 밴드

   배경: 종전 랜딩(page.tsx)은 PILLAR 1(서류 자동화) 카드에서 "담보신탁·공동사업
   협약 등 표준 서류"라고만 안내해, 처음 온 실무자가 "입력하면 실제로 무엇을 받는지"
   를 알 수 없었다(첫 사용 가치 제안 공백). 1차 출시 범위인 담보신탁 신규의 산출
   N종(COLLATERAL_OUTPUT_DOCS)을 엔진 단일 출처에서 그대로 읽어 이름으로 제시한다.

   변경:
     ① src/app/page.tsx — COLLATERAL_OUTPUT_DOCS import + PILLAR 그리드 아래
        "생성되는 서류" <section>(aria-labelledby) 신설. 개수는 .length 파생,
        목록은 상수를 map 으로 그대로 렌더(이름·번호). 서버 컴포넌트 유지.

   핵심 불변식:
     - ★표시 전용 — 조문·엔진·검증(validate)·산출물(docx) 생성 로직 무접촉.
       엔진에서 읽는 것은 산출 서류 목록 상수(COLLATERAL_OUTPUT_DOCS)뿐 —
       validate/docx 생성기 import 없음(라벨만 읽는 단일 출처 참조).
     - 개수·목록은 상수 파생(드리프트 0) — 서류가 추가/변경되면 랜딩 자동 반영.
       하드코딩 "7종" 같은 고정 숫자 문구를 본문에 박지 않는다.
     - 밴드 라벨은 h2(접근명은 aria-labelledby 가 가리키는 가시 텍스트가 전달).
     - 번호 글리프는 장식(aria-hidden) — 의미는 서류명이 전달.
     - 새 CSS 0 — 기존 토큰(c-paper·c-line·r-lg·c-brown·c-ink·c-blue-deep 등)
       + 인라인 style 만.
     - page.tsx 는 서버 컴포넌트 유지(RSC 경계 보존)·PILLAR 1·2 카드 보존.

   단언:
     (A) page.tsx 배선 — COLLATERAL_OUTPUT_DOCS import·<section aria-labelledby>·
         라벨 h2(id)·개수 .length 파생·목록 map(name)·번호 aria-hidden
     (B) 단일 출처/무드리프트 — 본문에 고정 "N종" 하드코딩 없음(개수는 .length)·
         산출 서류 상수가 실제 7종 정의를 유지(엔진 SSOT 계약)
     (C) 무접촉 — page.tsx 에 validate/docx 생성기 import 없음·서버 컴포넌트 유지·
         globals 새 클래스 0·PILLAR 1·2 보존

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-home-output-docs.mjs
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
const page = read("src", "app", "page.tsx");
const schema = read("src", "lib", "engine", "schema.ts");
const globals = read("src", "app", "globals.css");

console.log("\n[A] page.tsx 배선 — 산출 서류 밴드(엔진 단일 출처·라벨 region·개수 파생·번호 장식)");
{
  ok(/import \{ COLLATERAL_OUTPUT_DOCS \} from "@\/lib\/engine\/schema";/.test(page),
     "COLLATERAL_OUTPUT_DOCS import(엔진 단일 출처에서 산출 서류 목록 읽음)");
  ok(/<section\s+aria-labelledby="home-output-docs-heading"/.test(page),
     "<section aria-labelledby=\"home-output-docs-heading\">(밴드 접근명 region)");
  ok(/<h2\s+id="home-output-docs-heading"/.test(page),
     "라벨 h2(id=home-output-docs-heading) — section 접근명 제공");
  ok(/\{COLLATERAL_OUTPUT_DOCS\.length\}종/.test(page),
     "개수는 .length 파생(\"{COLLATERAL_OUTPUT_DOCS.length}종\") — 고정 숫자 미하드코딩");
  ok(/COLLATERAL_OUTPUT_DOCS\.map\(\(d, i\) =>/.test(page),
     "목록은 COLLATERAL_OUTPUT_DOCS.map 으로 렌더(상수 그대로)");
  ok(/<span>\{d\.name\}<\/span>/.test(page),
     "각 항목이 서류명(d.name) 표시");
  ok(/key=\{d\.id\}/.test(page),
     "리스트 key=d.id(상수 식별자)");
  // 번호 글리프는 장식 — 의미는 서류명이 전달하므로 aria-hidden. 번호 span 직전에
  // aria-hidden 이 와야 한다(번호→aria-hidden, 이름→가시 텍스트 분리 컨벤션).
  const numAt = page.indexOf('{String(i + 1).padStart(2, "0")}');
  const hiddenBeforeNum = page.lastIndexOf('aria-hidden="true"', numAt);
  ok(numAt >= 0 && hiddenBeforeNum >= 0 && numAt - hiddenBeforeNum < 220,
     "번호 글리프(padStart)는 aria-hidden(장식 — 의미는 서류명이 전달)");
}

console.log("\n[B] 단일 출처/무드리프트 — 고정 숫자 미하드코딩·엔진 SSOT 7종 계약");
{
  // 본문 가시 카피에 "7종"·"7개" 같은 고정 숫자를 박으면 서류가 늘거나 줄 때 랜딩이
  // 말없이 어긋난다(드리프트). 개수는 반드시 .length 파생이어야 한다.
  ok(!/[^.\w]7\s*종/.test(page) && !/[^.\w]7\s*개\s*서류/.test(page),
     "본문에 고정 \"7종/7개\" 하드코딩 없음(개수는 상수 .length 파생)");
  ok(/export const COLLATERAL_OUTPUT_DOCS: OutputDoc\[\] = \[/.test(schema),
     "엔진 SSOT — COLLATERAL_OUTPUT_DOCS 정의 유지(랜딩이 읽는 단일 출처)");
  // 산출 서류 정의가 7종(담보신탁 신규)이라는 현재 계약 — 항목 수 회귀 감지.
  const docMatches = schema.slice(schema.indexOf("COLLATERAL_OUTPUT_DOCS"))
    .match(/\{ id: "[a-zA-Z]+", name: "/g) || [];
  ok(docMatches.length === 7,
     `COLLATERAL_OUTPUT_DOCS 7종 정의(현재 계약) — 실제 ${docMatches.length}종`);
}

console.log("\n[C] 무접촉 — page.tsx 검증/산출물 생성기 무관·서버 컴포넌트·새 CSS 0·PILLAR 보존");
{
  ok(!/from "@\/lib\/engine\/validate"/.test(page) && !/from "@\/lib\/engine\/docx"/.test(page),
     "page.tsx 에 검증(validate)/산출물(docx) 생성기 import 없음(밴드는 라벨만 읽음·표시 전용)");
  ok(!/^"use client";/.test(page),
     "page.tsx 는 서버 컴포넌트 유지(RSC 경계 보존 — island 만 클라이언트)");
  ok(!/\.home-output-docs\b/.test(globals),
     "globals 에 밴드 전용 클래스 미추가 — 기존 토큰 + 인라인 style 만(새 CSS 0)");
  ok(/eyebrow="PILLAR 1"/.test(page) && /eyebrow="PILLAR 2"/.test(page),
     "홈 PILLAR 1(서류 자동화)·PILLAR 2(상담) 카드 보존(회귀 0)");
  ok(/<HomeResumeGroup \/>/.test(page),
     "재방문 재개 진입점(HomeResumeGroup) 보존(직전 iteration 회귀 0)");
}

console.log(`\n${fail === 0 ? "OK" : "FAIL"} — ${pass} PASS / ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
