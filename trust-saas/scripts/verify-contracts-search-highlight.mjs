/* ============================================================
   회귀 가드 — 내 계약 목록: 검색어 일치 강조(highlightSegments)

   배경: ContractsView 검색은 제목·서류명·위탁자·물건 소재지 haystack 부분일치로
   카드를 거르지만(verify-contracts-search), 일치한 카드를 보여줄 뿐 **어디가
   일치했는지**는 표시하지 않았다. highlightSegments 로 일치 구간을 시각 강조
   세그먼트로 쪼개 카드 제목·식별줄·서류명에서 .search-hl span 으로 감싼다.

   핵심 불변식:
     - 정규식 미사용(indexOf) → 검색어 특수문자를 리터럴로 다룬다(오매칭·주입 0).
     - 대소문자 무시(검색 게이트와 동일 정규화) · 원문 대소문자는 보존(표시용).
     - 빈/공백 검색어 → 전체 단일 비매칭 세그먼트(강조 없음·동작 무변경·후방호환).
     - 순수 함수·입력 무변형(검색/정렬 키·조문·엔진·검증 무관·표시 경계만).

   단언:
     (A) 기본 매칭 — 앞/일치/뒤 세그먼트 분리·원문 대소문자 보존
     (B) 대소문자 무시 매칭(검색 게이트 정규화 일치)
     (C) 다중 등장 — 각각 매칭 세그먼트 + 사이 비매칭 보존
     (D) 정규식 특수문자 리터럴 처리(오매칭 0)
     (E) 빈/공백 검색어·미일치·빈 텍스트 경계(동작 무변경·크래시 0)
     (F) 무손실 — 세그먼트 text 를 이으면 원문과 정확히 동일(글자 유실/중복 0)
     (G) 배선 — ContractsView 가 highlightSegments/Highlight/.search-hl 을 세 곳
         (제목·식별줄·서류명)에 적용 + 검색 상태(q) 전달
     (H) CSS — .search-hl 토큰 재사용(신규 색 0)·box-decoration-break

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-contracts-search-highlight.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { highlightSegments } from "../src/lib/ui/highlight.ts";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};
const join2 = (segs) => segs.map((s) => s.text).join("");

console.log("\n[A] 기본 매칭 — 앞/일치/뒤 분리 + 원문 대소문자 보존");
{
  const segs = highlightSegments("한국투자부동산", "한국투자");
  ok(segs.length === 2, `세그먼트 2개 (실제 ${segs.length})`);
  ok(segs[0].text === "한국투자" && segs[0].match === true, "선두=일치 세그먼트");
  ok(segs[1].text === "부동산" && segs[1].match === false, "후미=비매칭 세그먼트");
  const mid = highlightSegments("2026 1차 담보신탁", "1차");
  ok(mid.some((s) => s.match && s.text === "1차"), "중간 일치 세그먼트 존재");
  ok(mid[0].match === false && mid[0].text === "2026 ", "일치 앞 비매칭 보존");
}

console.log("\n[B] 대소문자 무시 매칭(검색 게이트 정규화)");
{
  const segs = highlightSegments("TrustForm Deal", "deal");
  const hit = segs.find((s) => s.match);
  ok(!!hit, "소문자 검색어가 대문자 텍스트에 매칭");
  ok(hit && hit.text === "Deal", `원문 대소문자 보존 (실제 "${hit && hit.text}")`);
  const trimmed = highlightSegments("역삼동 123", "  역삼  ");
  ok(trimmed.some((s) => s.match && s.text === "역삼"), "검색어 앞뒤 공백 trim 후 매칭");
}

console.log("\n[C] 다중 등장 — 각각 매칭 + 사이 비매칭 보존");
{
  const segs = highlightSegments("담보 담보 담보", "담보");
  const matches = segs.filter((s) => s.match);
  ok(matches.length === 3, `매칭 3회 (실제 ${matches.length})`);
  ok(matches.every((s) => s.text === "담보"), "각 매칭 세그먼트 텍스트 일치");
  ok(segs.filter((s) => !s.match).every((s) => s.text === " "), "사이 비매칭=공백 보존");
}

console.log("\n[D] 정규식 특수문자 리터럴 처리(오매칭 0)");
{
  // "." 은 정규식이면 임의 1글자 → indexOf 기반이면 점 자체만 매칭
  const dot = highlightSegments("AB CD", ".");
  ok(dot.length === 1 && dot[0].match === false, '"." 은 임의문자 아님 → 미매칭(정규식 미사용)');
  const paren = highlightSegments("계약서(사본)", "(사본)");
  ok(paren.some((s) => s.match && s.text === "(사본)"), "괄호 포함 검색어 리터럴 매칭");
  // 정규식이면 "(사본)" 은 캡처그룹 파싱 시도 → 리터럴이라 안전
}

console.log("\n[E] 경계 — 빈/공백 검색어·미일치·빈 텍스트(동작 무변경·크래시 0)");
{
  const empty = highlightSegments("제목", "");
  ok(empty.length === 1 && empty[0].match === false && empty[0].text === "제목", "빈 검색어 → 전체 비매칭 단일 세그먼트");
  const ws = highlightSegments("제목", "   ");
  ok(ws.length === 1 && ws[0].match === false, "공백만 검색어 → 전체 비매칭");
  const none = highlightSegments("제목", "없는키워드");
  ok(none.length === 1 && none[0].match === false, "미일치 → 전체 비매칭(강조 0)");
  ok(highlightSegments("", "x").length === 0, "빈 텍스트 → 세그먼트 0");
  ok(JSON.stringify(highlightSegments(null, "x")) === "[]", "비문자 텍스트 → [] (크래시 0)");
  ok(highlightSegments("제목", null).length === 1, "null 검색어 → 전체 비매칭(크래시 0)");
}

console.log("\n[F] 무손실 — 세그먼트를 이으면 원문과 정확히 동일");
{
  const samples = [
    ["한국투자부동산 1차 담보", "담보"],
    ["TrustForm Deal Deal", "deal"],
    ["서울 강남 역삼동 123-4", "역삼"],
    ["계약서(사본)(사본)", "(사본)"],
  ];
  let lossless = true;
  for (const [t, q] of samples) {
    if (join2(highlightSegments(t, q)) !== t) lossless = false;
  }
  ok(lossless, "모든 표본에서 세그먼트 연결 = 원문(글자 유실/중복 0)");
}

console.log("\n[G] 배선 — ContractsView 가 세 곳에 Highlight 적용 + 검색어(q) 전달");
{
  const view = readFileSync(join(root, "src/components/trust/ContractsView.tsx"), "utf8");
  ok(/import\s*\{\s*highlightSegments\s*\}\s*from\s*["']@\/lib\/ui\/highlight["']/.test(view), "highlightSegments import");
  ok(/function Highlight\(/.test(view), "Highlight 렌더 컴포넌트 정의");
  ok(view.includes('className="search-hl"'), "일치 세그먼트에 .search-hl span");
  ok(/<Highlight text=\{r\.title\} query=\{q\}/.test(view), "제목에 Highlight 적용");
  ok(/<Highlight text=\{identityLine\} query=\{q\}/.test(view), "식별줄(위탁자·물건)에 Highlight 적용");
  ok(/<Highlight text=\{docName\} query=\{q\}/.test(view), "서류명에 Highlight 적용");
  // 무회귀: 검색 haystack(제목·서류명·위탁자·물건)·정렬 키 보존
  ok(view.includes("`${r.title} ${docName} ${trustor} ${property}`"), "검색 haystack 보존(회귀無)");
}

console.log("\n[H] CSS — .search-hl 토큰 재사용(신규 색 0)·box-decoration-break");
{
  const css = readFileSync(join(root, "src/app/globals.css"), "utf8");
  const block = css.slice(css.indexOf(".search-hl"), css.indexOf(".search-hl") + 220);
  ok(css.includes(".search-hl"), ".search-hl 규칙 존재");
  ok(/background:\s*var\(--c-brown-pastel\)/.test(block), "배경=기존 토큰 var(--c-brown-pastel)");
  ok(/color:\s*var\(--c-ink\)/.test(block), "글자색=기존 토큰 var(--c-ink)");
  ok(/box-decoration-break:\s*clone/.test(block), "box-decoration-break: clone(줄바꿈 모서리)");
  // 신규 hex 색 미도입(토큰만 사용)
  ok(!/#[0-9a-fA-F]{3,6}/.test(block), "신규 hex 색 0(토큰 재사용)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
