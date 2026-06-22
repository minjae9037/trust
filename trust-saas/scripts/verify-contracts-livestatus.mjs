/* ============================================================
   회귀 가드 — 내 계약 목록 전이 상태(일괄 생성 진행·백업 결과) SR 영속 라이브 영역
   (a11y·WCAG 4.1.3 Status Messages, 비-산출물·표시/접근성 경계만)

   배경/문제: ContractsView 의 목록-바로-일괄생성(generateRowDocs)은 진행 메시지를
   순차 갱신한다 — "서류 생성 중… (0/N)" → "(1/N) …" → "✓ 준비된 N종 … 생성 완료".
   그러나 종전엔 이 메시지를 담은 <span role="status" aria-live="polite"> 가
   `{batch?.id === r.id && batch.msg && (…)}` 로 **메시지가 생길 때 비로소 마운트**됐다.
   라이브 영역은 콘텐츠 변경 '전'에 DOM 에 존재해야 보조기술이 안정적으로 낭독하는데,
   이 패턴은 라이브 영역이 첫 메시지와 '동시에' 생성돼 **첫 진행 메시지("0/N")가
   미고지**되는 결함이었다(advisor `.advisor-live`·StepProperty OCR 영속 영역에서
   이미 마감한 동일 anti-pattern 의 마지막 잔여 — 백업 결과 메시지 backupMsg 도 동형).

   해결: 목록 상단(page-header 뒤)에 **항상 렌더되는 단일 SR 영속 라이브 영역**을 두고
   (className="sr-only" role="status" aria-live="polite" aria-atomic="true"),
   활성 전이 상태(batch 우선, 없으면 backup)를 splitStatusGlyph 로 장식 글리프(✓ 등)를
   떼고 본문만 고지한다(liveStatus 단일 출처). 카드 옆 진행 표시 span·백업 바 span 은
   **시각 표시 전용**으로 남기되 role=status/aria-live 를 제거해 중복 낭독을 없앤다.

   핵심 불변식:
     (A) splitStatusGlyph 순수 거동 — 진행/완료/백업 문구에서 글리프만 분리(낭독 본문 보존).
     (B) liveStatus 단일 출처 — batch.msg 우선·없으면 backupMsg·둘 다 없으면 ""(글리프 제외).
     (C) ★영속 라이브 영역 — sr-only·role=status·aria-live=polite·aria-atomic 컨테이너가
         {liveStatus} 를 렌더하고 조건부 게이트 '밖'(항상 DOM)에 있다(첫 메시지부터 고지).
     (D) ★중복 낭독 0 — 카드 batch.msg span·백업 backupMsg span 은 시각 전용(role=status/
         aria-live 미부착)이며 여전히 StatusGlyphText 경유(시각 글리프 보존).
     (E) 무회귀 — 진행/완료/백업 성공 문구 verbatim·삭제 실행취소 바 role=status 보존·
         새 CSS 0(.sr-only 재사용)·생성/백업 로직 무접촉.

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-contracts-livestatus.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { splitStatusGlyph } from "../src/lib/ui/status-glyph.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const cv = readFileSync(path.join(root, "src", "components", "trust", "ContractsView.tsx"), "utf8");

console.log("\n[A] splitStatusGlyph — 전이 문구에서 글리프 분리(낭독 본문 보존)");
{
  const prog = splitStatusGlyph("서류 생성 중… (1/3) 신탁원부");
  ok(prog.glyph === "" && prog.text === "서류 생성 중… (1/3) 신탁원부", "진행 문구(글리프 없음) 본문 그대로");
  const done = splitStatusGlyph("✓ 준비된 3종 Word(.docx) 생성 완료 — 다운로드를 확인하세요.");
  ok(done.glyph === "✓" && done.text === "준비된 3종 Word(.docx) 생성 완료 — 다운로드를 확인하세요.",
    "완료 문구 ✓ 분리 — 낭독 본문엔 글리프 제외");
  const bk = splitStatusGlyph("✓ 5건을 백업 파일로 내보냈습니다 — 다운로드를 확인하세요.");
  ok(bk.glyph === "✓" && bk.text === "5건을 백업 파일로 내보냈습니다 — 다운로드를 확인하세요.",
    "백업 문구 ✓ 분리");
  const errm = splitStatusGlyph("오류: 네트워크 연결을 확인해 주세요.");
  ok(errm.glyph === "" && errm.text === "오류: 네트워크 연결을 확인해 주세요.", "오류 문구 무분리(원문 보존)");
}

console.log("\n[B] liveStatus 단일 출처 — batch.msg 우선·backupMsg 차선·글리프 제외");
{
  const idx = cv.indexOf("const liveStatus =");
  ok(idx >= 0, "liveStatus 파생 상수 존재");
  const seg = idx >= 0 ? cv.slice(idx, idx + 200) : "";
  ok(/batch\?\.msg/.test(seg) && seg.indexOf("batch?.msg") < seg.indexOf("backupMsg"),
    "batch.msg 가 backupMsg 보다 우선(삼항 앞)");
  ok(/splitStatusGlyph\(batch\.msg\)\.text/.test(seg), "batch.msg 는 splitStatusGlyph(...).text 로 글리프 제외");
  ok(/splitStatusGlyph\(backupMsg\)\.text/.test(seg), "backupMsg 는 splitStatusGlyph(...).text 로 글리프 제외");
  ok(/:\s*"";/.test(seg) || /:\s*"";?\s*$/m.test(seg) || seg.includes(': "";'), "둘 다 없으면 빈 문자열");
}

console.log("\n[C] ★영속 라이브 영역 — sr-only·role=status·aria-live·aria-atomic·{liveStatus}·게이트 밖");
{
  // 영속 영역 여는 태그 격리
  const m = cv.match(/<div className="sr-only" role="status" aria-live="polite" aria-atomic="true">\s*\n?\s*\{liveStatus\}\s*\n?\s*<\/div>/);
  ok(!!m, "sr-only role=status aria-live=polite aria-atomic 컨테이너가 {liveStatus} 를 렌더");
  // 게이트 밖(항상 렌더): 영속 영역 바로 앞이 `&& (` 같은 조건부가 아님
  const regionIdx = cv.indexOf('<div className="sr-only" role="status"');
  ok(regionIdx > 0, "영속 영역 위치 확인");
  const before = regionIdx > 0 ? cv.slice(Math.max(0, regionIdx - 60), regionIdx) : "";
  ok(!/&&\s*\(\s*$/.test(before.trimEnd() + "") && !before.trimEnd().endsWith("&& ("),
    "영속 영역 컨테이너가 조건부(&& ()로 게이트되지 않음(항상 DOM)");
  // page-header 뒤(목록 본문 앞)에 위치 — loading/err 와 무관하게 항상 렌더되도록 page 최상단
  ok(cv.indexOf("page-header") < regionIdx, "영속 영역이 page-header 뒤(상단)에 배치");
  // {liveStatus} 가 조건부 없이 렌더(빈 영역도 영속) — `{liveStatus &&` 형태 아님
  ok(!/\{liveStatus && /.test(cv), "{liveStatus} 가 조건부 게이트 없이 렌더(빈 라이브 영역도 영속)");
}

console.log("\n[D] ★중복 낭독 0 — 카드 batch.msg·백업 backupMsg 시각 span 은 role=status/aria-live 미부착");
{
  // 카드 batch 진행 표시 span 구간 격리
  const bIdx = cv.indexOf("batch?.id === r.id && batch.msg && (");
  const bSeg = bIdx >= 0 ? cv.slice(bIdx, cv.indexOf("</span>", bIdx) + 7) : "";
  ok(bIdx >= 0, "카드 batch 진행 표시 span 존재");
  ok(/<StatusGlyphText msg=\{batch\.msg\} \/>/.test(bSeg), "카드 batch span 이 StatusGlyphText 경유(시각 글리프 보존)");
  ok(!/role="status"/.test(bSeg) && !/aria-live/.test(bSeg),
    "★카드 batch span 에 role=status/aria-live 미부착(낭독은 영속 영역 전담)");
  // 백업 결과 span 구간 격리
  const kIdx = cv.indexOf("{backupMsg && (");
  const kSeg = kIdx >= 0 ? cv.slice(kIdx, cv.indexOf("</span>", kIdx) + 7) : "";
  ok(kIdx >= 0, "백업 결과 span 존재");
  ok(/<StatusGlyphText msg=\{backupMsg\} \/>/.test(kSeg), "백업 span 이 StatusGlyphText 경유");
  ok(!/role="status"/.test(kSeg) && !/aria-live/.test(kSeg),
    "★백업 span 에 role=status/aria-live 미부착(낭독은 영속 영역 전담)");
  // 영속 sr-only 라이브 영역은 정확히 2곳(과다 영역 회귀 감지) — 전이 상태(liveStatus)와
  // 검색·필터 결과 건수(searchAnnounce)는 목적이 달라 분리된 별도 영역이다(서로 섞이면 일괄
  // 생성/백업 메시지와 검색 고지가 한 영역에서 덮어써짐). 각자 단일 출처를 렌더하므로 우발적
  // 3번째 영역(과다 proliferation)은 여전히 이 단언이 잡는다(verify-contracts-search-announce 와 상보).
  const liveRegions = cv.match(/<div className="sr-only" role="status"/g) || [];
  ok(liveRegions.length === 2, `sr-only 영속 라이브 영역 정확히 2곳(전이+검색, 실제 ${liveRegions.length})`);
  ok(/\{liveStatus\}/.test(cv) && /\{searchAnnounce\}/.test(cv),
    "두 영역이 각각 {liveStatus}(전이)·{searchAnnounce}(검색 결과) 단일 출처 렌더(목적 분리)");
}

console.log("\n[E] 무회귀 — 진행/완료/백업 문구 verbatim·실행취소 바 role=status·새 CSS 0·로직 무접촉");
{
  ok(/서류 생성 중… \(\$\{i \+ 1\}\/\$\{ids\.length\}\)/.test(cv), "일괄 진행 문구(N/총) verbatim 보존");
  ok(/✓ 준비된 \$\{ids\.length\}종 Word\(\.docx\) 생성 완료 — 다운로드를 확인하세요\./.test(cv),
    "일괄 완료 문구 verbatim 보존");
  ok(/✓ \$\{backup\.count\}건을 백업 파일로 내보냈습니다/.test(cv), "백업 성공 문구 verbatim 보존");
  // 삭제 실행취소 바는 별개 이산(discrete) 고지 — 자체 role=status·aria-live 유지
  ok(/className="contracts-undo" role="status" aria-live="polite"/.test(cv), "삭제 실행취소 바 role=status·aria-live 보존");
  // 새 CSS 0 — 영속 영역은 기존 .sr-only 재사용(신규 클래스 없음)
  ok(/className="sr-only"/.test(cv), "영속 영역은 기존 .sr-only 재사용(새 CSS 0)");
  // 생성/백업 로직 무접촉
  ok(/await generateCollateralDoc\(form, ids\[i\]\)/.test(cv), "generateCollateralDoc 일괄 호출 보존");
  ok(/setBatch\(\{ id: row\.id, msg: "오류: "/.test(cv), "일괄 생성 오류 경로 보존");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
process.exit(fail === 0 ? 0 : 1);
