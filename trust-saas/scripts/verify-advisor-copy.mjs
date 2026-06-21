/* ============================================================
   회귀 가드 — 상담 답변 "복사" 버튼 (사용자 동선·비-산출물)

   배경(UX 갭, 비-산출물): 상담(Pillar 2) 답변은 표·체크리스트·구조 비교 등
   실무자가 자신의 문서·메일로 옮겨 쓰고 싶은 구조화 텍스트인데, 답변 카드에
   복사 수단이 전혀 없어 사용자가 드래그 선택해야 했다(B2B 전문 도구 표준 동선
   부재). AdvisorChat 답변 푸터에 "복사" 버튼을 추가해 클립보드로 복사한다.

   ★서식 보존(2026-06-22): 평문 마크다운(`| a | b |`)만 복사하면 Word·메일·Notion 에
   붙일 때 비교 표가 파이프 문자 그대로 깨진다 — 이 기능의 본래 목적(실무 문서로
   옮겨 쓰기)에 정면 배치. 렌더된 마크다운 DOM 의 innerHTML 을 text/html 로,
   마커 제거 본문(body)을 text/plain 으로 ClipboardItem 에 함께 담아, 서식 있는
   표/리스트/헤딩 그대로 붙고 평문 폴백도 보존한다. 리치 클립보드 미지원/거부 시
   navigator.clipboard.writeText(body) 로 폴백(graceful degradation).

   핵심 불변식:
     - text/plain(및 폴백) 복사 대상 = parseAction 으로 내부 액션 마커(<<doc:…>>)가
       제거된 `body`. 원시 `m.content`(마커 포함 가능)는 복사하지 않는다(마커 비노출 계약).
     - text/html = 렌더된 .md 노드 innerHTML(mdRefs[i]) — 서식 보존(표/리스트/헤딩).
     - 복사 버튼은 답변이 완성됐을 때만 노출(body && !busy) — 스트리밍 중 미노출.
     - 리치/평문 클립보드 미지원/거부는 조용히 무시(전송·답변 경로 무영향).
     - 표시 전용 — 조문·엔진·산출물·검색·로깅·페르소나 무접촉.

   단언:
     (A) copyAnswer 존재 + clipboard.write/writeText 사용 + 실패 try/catch(폴백)
     (B) ★복사 대상 = body(마커 제거본). copyAnswer(i, body) 배선 + m.content 복사 잔존 0
     (C) copy-btn 렌더 + 답변 완성 게이트(body && !busy) + copied 상태 토글
     (D) 접근성 — copy-btn aria-label/title "답변 복사"
     (E) globals.css .copy-btn 정의 + hover + :focus-visible
     (F) 무회귀 — 기존 피드백·출처 칩·액션 버튼 경로 보존
     (G) ★서식 보존 — mdRefs 캡처(.md ref) + ClipboardItem text/html(innerHTML)+text/plain(body)
         + 미지원 가드(typeof ClipboardItem) + writeText(body) 폴백

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-advisor-copy.mjs
   ============================================================ */
import { readFileSync } from "fs";
import path from "path";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};
const read = (rel) => readFileSync(path.join(process.cwd(), rel), "utf8");

const chat = read("src/components/advisor/AdvisorChat.tsx");
const css = read("src/app/globals.css");

console.log("\n[A] copyAnswer — 클립보드 복사 + 실패 무시");
{
  ok(/async\s+function\s+copyAnswer\s*\(/.test(chat), "copyAnswer 함수 존재");
  ok(/navigator\.clipboard\.writeText\(/.test(chat), "navigator.clipboard.writeText 사용(평문 폴백)");
  // copyAnswer 본문에 try/catch (클립보드 미지원·권한 거부 안전)
  const body = chat.slice(chat.indexOf("function copyAnswer"));
  ok(/try\s*\{[\s\S]*writeText[\s\S]*\}\s*catch/.test(body), "writeText 를 try/catch 로 감쌈(미지원 안전)");
}

console.log("\n[B] ★복사 대상 = body(액션 마커 제거본), 원시 content 복사 잔존 0");
{
  ok(/copyAnswer\(i,\s*body\)/.test(chat), "copyAnswer(i, body) 배선(마커 제거본 복사)");
  // 마커 포함 가능한 원시 m.content 를 복사하지 않음
  ok(!/copyAnswer\([^)]*m\.content/.test(chat), "copyAnswer 에 m.content(원시) 직접 전달 잔존 0");
  ok(!/clipboard\.writeText\(\s*m\.content/.test(chat), "writeText 에 m.content 직접 전달 잔존 0");
  // body 는 parseAction 결과(마커 제거) — 동선 존재 확인
  ok(/parseAction\(m\.content\)/.test(chat), "body 는 parseAction(m.content) 결과(마커 제거)");
}

console.log("\n[C] copy-btn 렌더 + 완성 게이트 + copied 토글");
{
  ok(/className="copy-btn"/.test(chat), "copy-btn 버튼 렌더");
  ok(/onClick=\{\(\)\s*=>\s*copyAnswer\(i,\s*body\)\}/.test(chat), "copy-btn onClick → copyAnswer(i, body)");
  ok(/const\s+\[copied,\s*setCopied\]\s*=\s*useState/.test(chat), "copied 상태 존재");
  ok(/copied\s*===\s*i\s*\?\s*"[^"]*복사됨[^"]*"\s*:\s*"[^"]*복사"/.test(chat), "copied===i 시 '복사됨', 아니면 '복사' 라벨 토글");
  // 복사 버튼은 답변 완성(body && !busy) 피드백 블록 안에 위치 → 스트리밍 중 미노출
  ok(/body\s*&&\s*!busy\s*&&\s*\(/.test(chat), "답변 완성 게이트(body && !busy) 존재");
  const fbStart = chat.indexOf('className="advisor-feedback"');
  const copyAt = chat.indexOf('className="copy-btn"');
  ok(fbStart > 0 && copyAt > fbStart, "copy-btn 은 피드백 블록(완성 게이트) 내부에 위치");
}

console.log("\n[D] 접근성 — copy-btn 접근명");
{
  const seg = chat.slice(chat.indexOf('className="copy-btn"'), chat.indexOf('className="copy-btn"') + 260);
  ok(/aria-label="답변 복사"/.test(seg), "copy-btn aria-label='답변 복사'");
  ok(/title="답변 복사"/.test(seg), "copy-btn title='답변 복사'");
}

console.log("\n[E] globals.css .copy-btn 스타일");
{
  ok(/\.copy-btn\s*\{[^}]*\}/.test(css), ".copy-btn 정의 존재");
  ok(/\.copy-btn:hover\s*\{/.test(css), ".copy-btn:hover 정의");
  ok(/\.copy-btn:focus-visible\s*\{/.test(css), ".copy-btn:focus-visible 아웃라인(키보드 접근)");
  ok(/\.copy-btn\s*\{[^}]*margin-left:\s*auto/.test(css), ".copy-btn 우측 정렬(margin-left:auto)");
}

console.log("\n[F] 무회귀 — 기존 피드백·출처·액션 경로 보존");
{
  ok(/sendFeedback\(i,\s*"up"\)/.test(chat) && /sendFeedback\(i,\s*"down"\)/.test(chat), "피드백 👍/👎 경로 보존");
  ok(/className="advisor-sources"/.test(chat), "출처 칩(advisor-sources) 경로 보존");
  ok(/className="doc-action-btn"/.test(chat), "서류 작성 액션 버튼 경로 보존");
  ok(/X-Advisor-Sources/.test(chat), "출처 헤더 디코드 경로 보존");
}

console.log("\n[G] ★서식 보존 — 렌더 HTML(text/html) + 평문(text/plain) ClipboardItem + 폴백");
{
  // 답변별 .md DOM 노드 캡처 — text/html 출처
  ok(/const\s+mdRefs\s*=\s*useRef<Map<number,\s*HTMLDivElement>>\(/.test(chat), "mdRefs(인덱스→.md 노드) ref 존재");
  ok(/mdRefs\.current\.set\(i,\s*el\)/.test(chat) && /mdRefs\.current\.delete\(i\)/.test(chat), ".md div ref 콜백으로 노드 캡처/정리");
  ok(/mdRefs\.current\.get\(i\)\?\.innerHTML/.test(chat), "text/html 출처 = 렌더된 .md innerHTML");
  // ClipboardItem 으로 text/html + text/plain 동시 복사
  ok(/new\s+ClipboardItem\(\{/.test(chat), "ClipboardItem 사용(리치 복사)");
  ok(/"text\/html":\s*new\s+Blob\(\[html\]/.test(chat), "text/html 파트 = 렌더 HTML(서식 보존: 표/리스트/헤딩)");
  ok(/"text\/plain":\s*new\s+Blob\(\[body\]/.test(chat), "text/plain 파트 = body(마커 제거 평문)");
  ok(/navigator\.clipboard\.write\(\[/.test(chat), "navigator.clipboard.write([...]) 리치 경로");
  // 미지원 가드 + 평문 폴백
  ok(/typeof\s+ClipboardItem\s*!==\s*"undefined"/.test(chat), "ClipboardItem 미지원 가드(graceful degradation)");
  ok(/navigator\.clipboard\.writeText\(body\)/.test(chat), "리치 미지원/실패 시 writeText(body) 평문 폴백");
  // text/html 에 원시 m.content(마커) 가 새지 않음 — html 은 렌더 노드에서만 옴
  ok(!/new\s+Blob\(\[\s*m\.content/.test(chat), "ClipboardItem 에 원시 m.content 직접 주입 잔존 0");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
if (fail > 0) process.exit(1);
