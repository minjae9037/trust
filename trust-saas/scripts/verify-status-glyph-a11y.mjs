/* ============================================================
   회귀 가드 — 동적 상태 메시지(role=status) 글리프 aria-hidden 일관화

   배경(a11y·WCAG 1.3.1, 비-산출물·표시 전용): 위저드 stepper·pill(cabf4d9)·
   ContractsView 카드 칩·헤더 doc-progress 요약(359a2a8)의 정적 ✓/⚠ 글리프는
   이미 `<span aria-hidden="true">` 장식 처리됐다. 그러나 **동적 상태 메시지**
   (런타임 문자열이 role="status"·aria-live="polite" 라이브 영역에 들어가는 경우)는
   여전히 글리프가 문자열 맨 앞에 박혀 있어, 라이브 영역 갱신 시 SR 이 의미 텍스트
   앞에 모호한 "check mark"/"black circle" 을 매 성공 고지마다 먼저 낭독하던 잔여 갭:
     · Wizard 일괄 생성 결과    `✓ 준비된 N종 … 생성 완료` + stale `● 입력이 변경…`
     · ContractsView 백업/가져오기/일괄·협약서 생성 결과 `✓ …` + 삭제 실행취소 `🗑 …`
     · TrustApp 저장 표시        `✓ 저장됨` / `● 저장되지 않은 변경`

   해결: 동적 문자열은 순수 함수 `splitStatusGlyph`(lib/ui/status-glyph)로 맨 앞
   장식 글리프를 분리해 `<span aria-hidden="true">{glyph} </span>{text}` 로 렌더하고,
   정적 리터럴 글리프는 직접 aria-hidden span 으로 감싼다. 시각 표시는 글리프+공백
   재구성으로 완전 동일(CSS 신규 0)·의미는 본문이 전달(별도 .sr-only 불요).

   핵심 불변식:
     (A) 순수 함수 splitStatusGlyph: 알려진 글리프 분리·공백 1개 흡수·미지정 선두
         문자 무분리·입력 무변형·STATUS_GLYPHS 집합.
     (B) Wizard: batchMsg 를 splitStatusGlyph 로 분리해 글리프 aria-hidden 렌더·
         stale ● 리터럴 aria-hidden·맨몸 `{batchMsg}` 직접 렌더 잔존 0.
     (C) ContractsView: StatusGlyphText 헬퍼(글리프 aria-hidden span)·backupMsg·
         batch.msg 가 헬퍼 경유·삭제 실행취소 🗑 aria-hidden·맨몸 직접 렌더 잔존 0.
     (D) TrustApp: 저장됨 ✓·미저장 ● 리터럴 글리프 aria-hidden + 가시 텍스트 보존.
     (E) 무회귀: role="status"·aria-live="polite" 보존·성공 문구 verbatim 보존·
         오류 경로(글리프 없음) 무변경.

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-status-glyph-a11y.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { splitStatusGlyph, STATUS_GLYPHS } from "../src/lib/ui/status-glyph.ts";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const rd = (...p) => readFileSync(path.join(root, ...p), "utf8");
const wiz = rd("src", "components", "trust", "Wizard.tsx");
const cv = rd("src", "components", "trust", "ContractsView.tsx");
const app = rd("src", "components", "trust", "TrustApp.tsx");

console.log("\n[A] 순수 함수 splitStatusGlyph — 분리·무분리·무변형");
{
  const a = splitStatusGlyph("✓ 준비된 3종 Word(.docx) 생성 완료 — 다운로드를 확인하세요.");
  ok(a.glyph === "✓" && a.text === "준비된 3종 Word(.docx) 생성 완료 — 다운로드를 확인하세요.",
    "✓ 선두 — 글리프 분리·공백 1개 흡수");
  const b = splitStatusGlyph("● 입력이 변경되었습니다");
  ok(b.glyph === "●" && b.text === "입력이 변경되었습니다", "● 선두 분리");
  const c = splitStatusGlyph("🗑 계약 삭제됨");
  ok(c.glyph === "🗑" && c.text === "계약 삭제됨", "🗑 선두 분리(서로게이트 페어 안전)");
  const d = splitStatusGlyph("서류 생성 중… (1/3) 신탁원부");
  ok(d.glyph === "" && d.text === "서류 생성 중… (1/3) 신탁원부", "진행 메시지(글리프 없음) 무분리");
  const e = splitStatusGlyph("오류: 네트워크 연결을 확인해 주세요.");
  ok(e.glyph === "" && e.text === "오류: 네트워크 연결을 확인해 주세요.", "오류 메시지 무분리(원문 보존)");
  const f = splitStatusGlyph("✓저장됨");
  ok(f.glyph === "✓" && f.text === "저장됨", "글리프 직후 공백 없으면 공백 흡수 없이 분리");
  const g = splitStatusGlyph("✓  넓은공백");
  ok(g.glyph === "✓" && g.text === " 넓은공백", "공백은 정확히 1개만 흡수(나머지 보존)");
  ok(splitStatusGlyph("").glyph === "" && splitStatusGlyph("").text === "", "빈 문자열 안전");
  ok(Array.isArray(STATUS_GLYPHS) && STATUS_GLYPHS.includes("✓") && STATUS_GLYPHS.includes("●") &&
     STATUS_GLYPHS.includes("⚠") && STATUS_GLYPHS.includes("🗑"), "STATUS_GLYPHS 집합(✓·●·⚠·🗑)");
  // 입력 무변형(순수 함수)
  const src = "✓ 원본";
  splitStatusGlyph(src);
  ok(src === "✓ 원본", "입력 문자열 무변형");
}

console.log("\n[B] Wizard — batchMsg 글리프 분리 렌더 + stale ● aria-hidden");
{
  ok(/import \{ splitStatusGlyph \} from "@\/lib\/ui\/status-glyph"/.test(wiz),
    "splitStatusGlyph import");
  // batchMsg 렌더 블록 격리
  const idx = wiz.indexOf('batchMsg && (');
  const seg = idx >= 0 ? wiz.slice(idx, idx + 600) : "";
  ok(idx >= 0, "batchMsg 렌더 블록 존재");
  ok(/const \{ glyph, text \} = splitStatusGlyph\(batchMsg\)/.test(seg),
    "batchMsg 를 splitStatusGlyph 로 분리");
  ok(/\{glyph && <span aria-hidden="true">\{glyph\} <\/span>\}/.test(seg),
    "분리된 글리프를 aria-hidden span 으로 렌더");
  ok(/\{text\}/.test(seg), "본문 텍스트 그대로 렌더(낭독 대상)");
  // stale 메시지 리터럴 ● aria-hidden
  ok(/<span aria-hidden="true">● <\/span>입력이 변경되었습니다 — 다시 일괄 생성하세요/.test(wiz),
    "stale 메시지 ● 글리프 aria-hidden + 가시 텍스트");
  // 맨몸 직접 렌더(옛 형태) 잔존 0
  ok(!/role="status" aria-live="polite">\s*\{batchMsg\}\s*<\/div>/.test(wiz),
    "옛 맨몸 {batchMsg} 직접 렌더 잔존 0");
  ok(!/●\s*입력이 변경되었습니다/.test(wiz.replace(/aria-hidden="true">● <\/span>/g, "")),
    "옛 맨몸 ● 입력이 변경 잔존 0");
  // 라이브 영역 속성 보존
  ok(/className="doc-progress-msg"\s*\n?\s*role="status"\s*\n?\s*aria-live="polite"/.test(wiz),
    "doc-progress-msg role=status·aria-live=polite 보존");
}

console.log("\n[C] ContractsView — StatusGlyphText 헬퍼 + backupMsg·batch.msg 경유 + 🗑");
{
  ok(/import \{ splitStatusGlyph \} from "@\/lib\/ui\/status-glyph"/.test(cv),
    "splitStatusGlyph import");
  // 헬퍼 컴포넌트 정의
  const hi = cv.indexOf("function StatusGlyphText");
  const hseg = hi >= 0 ? cv.slice(hi, hi + 320) : "";
  ok(hi >= 0, "StatusGlyphText 헬퍼 컴포넌트 정의 존재");
  ok(/const \{ glyph, text \} = splitStatusGlyph\(msg\)/.test(hseg), "헬퍼가 splitStatusGlyph 사용");
  ok(/\{glyph && <span aria-hidden="true">\{glyph\} <\/span>\}/.test(hseg), "헬퍼가 글리프 aria-hidden span 렌더");
  // 두 시각 표시 span 이 헬퍼 경유(낭독은 상단 영속 라이브 영역 liveStatus 가 전담 →
  //  시각 span 의 role=status/aria-live 는 제거됨, verify-contracts-livestatus 가 별도 단언)
  ok(/<StatusGlyphText msg=\{backupMsg\} \/>/.test(cv), "backupMsg 가 StatusGlyphText 경유(시각 span)");
  ok(/<StatusGlyphText msg=\{batch\.msg\} \/>/.test(cv), "batch.msg 가 StatusGlyphText 경유(시각 span)");
  // 삭제 실행취소 🗑 aria-hidden
  ok(/<span aria-hidden="true">🗑 <\/span>\s*<strong>\{u\.title\}<\/strong> 삭제됨/.test(cv),
    "삭제 실행취소 🗑 글리프 aria-hidden + 제목/삭제됨 보존");
  // 맨몸 직접 렌더(옛 형태) 잔존 0
  ok(!/aria-live="polite">\s*\{backupMsg\}\s*<\/span>/.test(cv), "옛 맨몸 {backupMsg} 직접 렌더 잔존 0");
  ok(!/>\s*\{batch\.msg\}\s*<\/span>/.test(cv), "옛 맨몸 {batch.msg} 직접 렌더 잔존 0");
  ok(!/<span>\s*🗑 <strong>/.test(cv), "옛 맨몸 🗑 <strong> 잔존 0");
}

console.log("\n[D] TrustApp — 저장 표시 ✓/● 글리프 aria-hidden + 가시 텍스트");
{
  ok(/<span aria-hidden="true">● <\/span>저장되지 않은 변경/.test(app),
    "미저장 ● 글리프 aria-hidden + '저장되지 않은 변경' 보존");
  ok(/<span aria-hidden="true">✓ <\/span>저장됨/.test(app),
    "저장됨 ✓ 글리프 aria-hidden + '저장됨' 보존");
  ok(!/>\s*● 저장되지 않은 변경/.test(app), "옛 맨몸 ● 저장되지 않은 변경 잔존 0");
  ok(!/>\s*✓ 저장됨/.test(app), "옛 맨몸 ✓ 저장됨 잔존 0");
}

console.log("\n[E] 무회귀 — 성공 문구 verbatim·오류 경로·배선 보존");
{
  ok(/✓ 준비된 \$\{ready\.length\}종 Word\(\.docx\) 생성 완료 — 다운로드를 확인하세요\./.test(wiz),
    "Wizard 일괄 생성 성공 문구 verbatim 보존(setBatchMsg)");
  ok(/setBatchMsg\("오류: " \+/.test(wiz), "Wizard 오류 경로(글리프 없음) 보존");
  ok(/✓ \$\{backup\.count\}건을 백업 파일로 내보냈습니다/.test(cv),
    "ContractsView 백업 성공 문구 verbatim 보존");
  ok(/role="status" aria-live="polite"/.test(cv), "ContractsView 라이브 영역 속성 보존");
  ok(/msg && msg\.startsWith\("오류"\)/.test(app), "TrustApp 오류 표시 경로 보존");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
process.exit(fail === 0 ? 0 : 1);
