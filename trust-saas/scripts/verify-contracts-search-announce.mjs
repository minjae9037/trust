/* ============================================================
   회귀 가드 — 내 계약 목록: 검색·필터 결과 건수 SR 라이브 고지(WCAG 4.1.3)

   배경: ContractsView 툴바 우측 카운트("N / M건")와 빈 결과 <p>("조건에 맞는
   계약이 없습니다")는 검색어/필터에 따라 즉시 갱신되지만 **라이브 영역이 아니라**
   SR 사용자는 필터링 결과(몇 건 남았는지·0건인지)를 전혀 듣지 못했다(WCAG 4.1.3
   상태 메시지). 필터 활성 시 결과 건수를 polite 라이브 영역으로 고지하되, 키 입력
   마다 낭독되지 않도록 디바운스하고, 필터 해제·로딩·오류·초기 진입엔 침묵한다.

   핵심 불변식:
     - 표시 전용 — 검색/정렬 로직·검색 haystack·조문·엔진·검증 게이트 무접촉.
     - 필터 비활성/로딩/오류 → 고지 비움(초기 진입·해제 시 낭독 없음).
     - 키 입력마다 낭독 금지 → setTimeout 디바운스(visible 변화 후 settled 값만).
     - 시각 카운트 span·빈 결과 <p> 는 라이브 책임 없음(중복 낭독 0) — 별도 sr-only
       polite 영역이 낭독 전담. 전이 상태(liveStatus) 영역과 분리.

   단언:
     (A) 상태/디바운스 effect — searchAnnounce state·setTimeout·deps 배선
     (B) 메시지 로직 — "검색 결과 N건"(>0) / "조건에 맞는 계약이 없습니다"(0)
     (C) 침묵 가드 — loading/err/!filtersActive → setSearchAnnounce("")
     (D) 라이브 영역 — sr-only role=status aria-live=polite aria-atomic + {searchAnnounce}
     (E) 무회귀 — filtersActive 정의·전이 liveStatus 영역·시각 카운트 span·빈 결과 <p> 보존
     (F) 무접촉 — 검색 haystack·정렬 키·validate/builders/engine 미변경

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-contracts-search-announce.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");
const view = readFileSync(join(root, "src/components/trust/ContractsView.tsx"), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

console.log("\n[A] 상태/디바운스 effect — searchAnnounce state·setTimeout·deps");
{
  ok(/const\s*\[\s*searchAnnounce\s*,\s*setSearchAnnounce\s*\]\s*=\s*useState\(\s*""\s*\)/.test(view),
    "searchAnnounce state(초기 빈 문자열)");
  ok(/window\.setTimeout\(/.test(view) && /clearTimeout\(t\)/.test(view),
    "setTimeout 디바운스 + cleanup(clearTimeout)");
  ok(/,\s*350\s*\)/.test(view), "디바운스 지연 350ms(키 입력마다 낭독 방지)");
  // deps 배열에 filtersActive·visible.length·loading·err 가 모두 포함되어야
  // 카운트 변화/필터 토글 시 재고지된다(누락 시 stale 고지).
  const dep = view.slice(view.indexOf("setSearchAnnounce"));
  ok(/\[\s*filtersActive\s*,\s*visible\.length\s*,\s*loading\s*,\s*err\s*\]/.test(dep),
    "effect deps = [filtersActive, visible.length, loading, err]");
}

console.log("\n[B] 메시지 로직 — 결과 N건 / 빈 결과");
{
  ok(view.includes("`검색 결과 ${visible.length}건`"), '결과 있을 때 "검색 결과 N건"(visible.length 출처)');
  ok(view.includes('"조건에 맞는 계약이 없습니다"'), '결과 0건 → "조건에 맞는 계약이 없습니다"(빈 결과 <p> 와 동일 문구)');
  // 삼항: visible.length > 0 분기
  ok(/visible\.length\s*>\s*0\s*\?\s*`검색 결과/.test(view), "visible.length>0 분기로 0건/N건 구분");
}

console.log("\n[C] 침묵 가드 — loading/err/!filtersActive → 고지 비움");
{
  ok(/if\s*\(\s*loading\s*\|\|\s*err\s*\|\|\s*!\s*filtersActive\s*\)/.test(view),
    "loading || err || !filtersActive 조기 반환 가드");
  ok(/setSearchAnnounce\(\s*""\s*\)/.test(view), '가드 진입 시 setSearchAnnounce("") — 이전 고지 비움(낭독 없음)');
}

console.log("\n[D] 라이브 영역 — 별도 sr-only polite + {searchAnnounce}");
{
  // sr-only role=status aria-live=polite aria-atomic 영역이 searchAnnounce 를 낭독
  ok(/\{searchAnnounce\}/.test(view), "{searchAnnounce} 를 렌더하는 라이브 영역 존재");
  // searchAnnounce 영역의 컨테이너가 sr-only + role=status + aria-live=polite + aria-atomic 인지
  const idx = view.indexOf("{searchAnnounce}");
  const before = view.slice(Math.max(0, idx - 400), idx);
  const region = before.slice(before.lastIndexOf("<div"));
  ok(/className="sr-only"/.test(region), "라이브 영역 className=sr-only(시각 비표시)");
  ok(/role="status"/.test(region), "role=status");
  ok(/aria-live="polite"/.test(region), "aria-live=polite");
  ok(/aria-atomic="true"/.test(region), "aria-atomic=true(전체 메시지 낭독)");
  // 전이 상태(liveStatus)와 분리된 별도 영역 — 두 라이브 영역 공존
  ok(view.includes("{liveStatus}") && view.includes("{searchAnnounce}"),
    "전이 liveStatus 영역과 분리 공존(검색 고지가 일괄생성/백업과 미혼합)");
}

console.log("\n[E] 무회귀 — 정의·기존 영역·시각 표시 보존");
{
  ok(/const filtersActive = status !== "all" \|\| q\.trim\(\)\.length > 0;/.test(view),
    "filtersActive 정의 보존(고지 활성 조건 단일 출처)");
  ok(view.includes('{liveStatus}'), "전이 상태 라이브 영역(liveStatus) 보존");
  // 시각 카운트 span — 여전히 표시되고 라이브 책임 없음(중복 낭독 방지)
  ok(view.includes("`${visible.length} / ${rows.length}건`") && view.includes("`총 ${rows.length}건`"),
    "툴바 시각 카운트 span 보존(N/M건·총 N건)");
  ok(view.includes("조건에 맞는 계약이 없습니다 — 검색어나 상태 필터를 바꿔 보세요."),
    "빈 결과 시각 안내 <p> 보존");
  // 시각 카운트 span 에는 role 미부여(이중 낭독 방지) — count span 라인에 role 없음
  const countLine = view.slice(view.indexOf('style={{ marginLeft: "auto" }}') - 60, view.indexOf('style={{ marginLeft: "auto" }}') + 120);
  ok(!/role=/.test(countLine), "시각 카운트 span 에 role 미부여(이중 낭독 0)");
}

console.log("\n[F] 무접촉 — 검색 haystack·정렬 키·검증 게이트 미변경");
{
  ok(view.includes("`${r.title} ${docName} ${trustor} ${property}`"), "검색 haystack 보존(검색 로직 무접촉)");
  ok(view.includes('validateDoc(form, d.id).ok') && view.includes("validateJoint("),
    "검증 게이트(validateDoc/validateJoint) 호출 보존(무접촉)");
  ok(view.includes("a.title.localeCompare(b.title") && view.includes("score(b) - score(a)"),
    "정렬 키(제목·준비도) 보존(무접촉)");
  // 본 가드 변경은 ContractsView 단일 파일(표시 경계) — globals.css·engine 무변경 전제
  ok(!/import .*engine\/docx-internal/.test(view), "엔진 내부 import 미도입(표시 경계만)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
