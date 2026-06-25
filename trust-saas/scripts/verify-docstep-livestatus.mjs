/* ============================================================
   회귀 가드 — 담보신탁 서류 생성 단계(DocStep) 생성 상태 SR 영속 라이브 영역
   (a11y·WCAG 4.1.3 Status Messages, 비-산출물·표시/접근성 경계만)

   배경/문제: DocStep(담보신탁계약서 등 7종 서류의 ★주력 생성 동선)의 생성 상태(msg)는
   "Word 파일 생성 중…" → "✓ Word(.docx) 생성 완료 — 다운로드를 확인하세요." 처럼 순차
   갱신되고, 입력이 바뀌면 freshness="stale" 안내로 전환된다. 그러나 종전엔 이 메시지를
   담은 <span role="status" aria-live="polite"> 가 `{freshness==="stale" ? … : (msg && …)}`
   로 **메시지가 생길 때 비로소 마운트**됐다. 라이브 영역은 콘텐츠 변경 '전'에 DOM 에
   존재해야 보조기술이 안정적으로 낭독하는데, 이 패턴은 라이브 영역이 첫 메시지와 '동시에'
   생성돼 **첫 메시지("Word 파일 생성 중…")가 미고지**됐다. 또한 선두 장식 글리프(●/✓)가
   라이브 영역 본문에 박혀 매 상태마다 "black circle"/"check mark"가 먼저 낭독됐다.
   (ContractsView 전이 상태·StepProperty OCR·advisor .advisor-live·JointFork[14:55]
   영속 영역에서 이미 마감한 동일 anti-pattern 의 ★주력 계약 생성 동선 잔여 — 누락분.)

   해결: doc-split 최상단(조건부 게이트 밖)에 **항상 렌더되는 단일 SR 영속 라이브 영역**을
   두고(className="sr-only" role="status" aria-live="polite" aria-atomic="true"), 생성
   상태(stale 이면 변경 안내, 아니면 msg)를 splitStatusGlyph 로 장식 글리프(✓/●)를 떼고
   본문만 고지한다(genLiveStatus 단일 출처·JointForm 패리티). 하단 버튼 행의 stale/msg
   시각 span 은 **시각 표시 전용**으로 남기되 role=status/aria-live 를 제거해 중복 낭독을
   없앤다(글리프는 StatusGlyphText 로 aria-hidden — 시각 보존).

   핵심 불변식:
     (A) splitStatusGlyph 순수 거동 — DocStep 생성 문구에서 글리프만 분리(낭독 본문 보존).
     (B) genLiveStatus 단일 출처 — stale→변경 안내·아니면 msg·둘 다 없으면 ""(글리프 제외).
     (C) ★영속 라이브 영역 — sr-only·role=status·aria-live=polite·aria-atomic 컨테이너가
         {genLiveStatus} 를 렌더하고 조건부 게이트 '밖'(항상 DOM)·doc-split 최상단에 있다.
     (D) ★중복 낭독 0 — stale/msg 시각 span 은 role=status/aria-live 미부착·StatusGlyphText 경유.
     (E) 무회귀 — 생성 문구 verbatim·STALE_MSG 단일 출처·새 CSS 0(.sr-only 재사용)·생성/검증 무접촉.

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-docstep-livestatus.mjs
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
const ds = readFileSync(path.join(root, "src", "components", "trust", "steps", "DocStep.tsx"), "utf8");

console.log("\n[A] splitStatusGlyph — DocStep 생성 문구에서 글리프 분리(낭독 본문 보존)");
{
  const prog = splitStatusGlyph("Word 파일 생성 중…");
  ok(prog.glyph === "" && prog.text === "Word 파일 생성 중…", "진행 문구(글리프 없음) 본문 그대로");
  const done = splitStatusGlyph("✓ Word(.docx) 생성 완료 — 다운로드를 확인하세요.");
  ok(done.glyph === "✓" && done.text === "Word(.docx) 생성 완료 — 다운로드를 확인하세요.",
    "완료 문구 ✓ 분리 — 낭독 본문엔 글리프 제외");
  const stale = splitStatusGlyph("● 입력이 변경되었습니다 — 다시 생성하세요");
  ok(stale.glyph === "●" && stale.text === "입력이 변경되었습니다 — 다시 생성하세요", "stale 문구 ● 분리");
  const errm = splitStatusGlyph("오류: 네트워크 연결을 확인해 주세요.");
  ok(errm.glyph === "" && errm.text === "오류: 네트워크 연결을 확인해 주세요.", "오류 문구 무분리(원문 보존)");
}

console.log("\n[B] genLiveStatus 단일 출처 — stale 우선·아니면 msg·글리프 제외");
{
  const idx = ds.indexOf("const genLiveStatus =");
  ok(idx >= 0, "genLiveStatus 파생 상수 존재");
  const seg = idx >= 0 ? ds.slice(idx, idx + 240) : "";
  ok(/freshness === "stale"/.test(seg) && seg.indexOf('freshness === "stale"') < seg.indexOf(": msg"),
    "stale 이 msg 보다 우선(삼항 앞)");
  ok(/splitStatusGlyph\(STALE_MSG\)\.text/.test(seg), "stale 은 splitStatusGlyph(STALE_MSG).text 로 글리프 제외");
  ok(/splitStatusGlyph\(msg\)\.text/.test(seg), "msg 는 splitStatusGlyph(msg).text 로 글리프 제외");
  ok(/:\s*"";/.test(seg), "둘 다 없으면 빈 문자열");
  ok(/const STALE_MSG = "● 입력이 변경되었습니다 — 다시 생성하세요";/.test(ds), "STALE_MSG 모듈 상수 단일 출처");
  ok(/import \{ splitStatusGlyph \} from "@\/lib\/ui\/status-glyph";/.test(ds), "splitStatusGlyph import");
}

console.log("\n[C] ★영속 라이브 영역 — sr-only·role=status·aria-live·aria-atomic·{genLiveStatus}·게이트 밖·doc-split 최상단");
{
  const m = ds.match(/<div className="sr-only" role="status" aria-live="polite" aria-atomic="true">\s*\n?\s*\{genLiveStatus\}\s*\n?\s*<\/div>/);
  ok(!!m, "sr-only role=status aria-live=polite aria-atomic 컨테이너가 {genLiveStatus} 를 렌더");
  const regionIdx = ds.indexOf('<div className="sr-only" role="status"');
  ok(regionIdx > 0, "영속 영역 위치 확인");
  const before = regionIdx > 0 ? ds.slice(Math.max(0, regionIdx - 80), regionIdx) : "";
  ok(!before.trimEnd().endsWith("&& ("), "영속 영역이 조건부(&& ()로 게이트되지 않음(항상 DOM)");
  // doc-split 루트 직후(좌측 입력 컬럼보다 앞)에 배치 = 항상 렌더
  // (루트 className 은 미리보기 접기 토글로 조건부 — previewOpen ? "doc-split" : "doc-split …"
  //  로 바뀌었으므로 className 시작 부분으로 앵커링. 의도=SR 영역이 루트 직후·입력 컬럼 앞.)
  const splitIdx = ds.search(/<div className=\{previewOpen \? "doc-split"/);
  const inputColIdx = ds.indexOf('<div className="doc-split-input">');
  ok(splitIdx >= 0 && splitIdx < regionIdx && regionIdx < inputColIdx,
    "영속 영역이 doc-split 루트 직후·좌측 입력 컬럼 앞(항상 DOM)");
  ok(!/\{genLiveStatus && /.test(ds), "{genLiveStatus} 가 조건부 게이트 없이 렌더(빈 라이브 영역도 영속)");
  ok((ds.match(/<div className="sr-only" role="status"/g) || []).length === 1, "sr-only 영속 라이브 영역 정확히 1곳");
}

console.log("\n[D] ★중복 낭독 0 — stale/msg 시각 span 은 role=status/aria-live 미부착·StatusGlyphText 경유");
{
  const sIdx = ds.indexOf('freshness === "stale" ? (');
  const sSeg = sIdx >= 0 ? ds.slice(sIdx, sIdx + 400) : "";
  ok(sIdx >= 0, "하단 stale/msg 시각 span 분기 존재");
  ok(/freshness === "stale" \? \(\s*<span className="field-hint" style=/.test(sSeg),
    "stale 시각 span 이 role=status 없이 style 만(시각 전용)");
  ok(/<StatusGlyphText msg=\{STALE_MSG\} \/>/.test(sSeg), "stale 시각 span 이 StatusGlyphText 경유(글리프 보존)");
  ok(/msg && \(\s*<span className="field-hint" style=\{\{ color: "var\(--c-blue-deep\)" \}\}>\s*<StatusGlyphText msg=\{msg\} \/>/.test(sSeg),
    "msg 시각 span 이 role=status 없이 StatusGlyphText 경유");
  ok(!/role="status"/.test(sSeg) && !/aria-live/.test(sSeg),
    "★하단 stale/msg 시각 span 구간에 role=status/aria-live 미부착(낭독은 영속 영역 전담)");
  ok(/function StatusGlyphText\(\{ msg \}: \{ msg: string \}\)/.test(ds), "StatusGlyphText 헬퍼 정의");
  ok(/\{glyph && <span aria-hidden="true">\{glyph\} <\/span>\}/.test(ds), "StatusGlyphText 가 글리프를 aria-hidden 처리");
}

console.log("\n[E] 무회귀 — 생성 문구 verbatim·새 CSS 0·생성/검증/미리보기 로직 무접촉");
{
  ok(ds.includes('setMsg("Word 파일 생성 중…");'), "Word 진행 문구 verbatim 보존");
  ok(ds.includes('setMsg("✓ Word(.docx) 생성 완료 — 다운로드를 확인하세요.");'), "Word 완료 문구 verbatim 보존");
  ok(/className="sr-only"/.test(ds), "영속 영역은 기존 .sr-only 재사용(새 CSS 0)");
  ok(/await generateCollateralDoc\(form, docId\)/.test(ds), "generateCollateralDoc 호출 보존(생성 로직 무접촉)");
  ok(/generateCollateralPDF\(form, docId\)/.test(ds), "generateCollateralPDF 호출 보존");
  ok(/validateDoc\(form, docId\)/.test(ds), "validateDoc 게이트 보존(검증 무접촉)");
  ok(/previewDocHTML\(/.test(ds), "previewDocHTML 미리보기 보존");
  // stale 전환 문구는 generate-freshness 가드가 별도 단언(여기선 STALE_MSG 에 포함됨을 교차 확인)
  ok(/다시 생성하세요/.test(ds), "stale '다시 생성하세요' 문구 보존(generate-freshness 패리티)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
process.exit(fail === 0 ? 0 : 1);
