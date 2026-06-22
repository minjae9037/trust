/* ============================================================
   회귀 가드 — 상담(advisor·Pillar 2) 대화 턴 발화자 라벨(스크린리더)

   배경(a11y·WCAG 1.3.1 Info and Relationships, 비-산출물·표시 전용):
   AdvisorChat 의 대화 턴은 사용자/AI 를 ① 정렬(user=우측·assistant=좌측)
   ② 배경색(user=blue-pastel)으로만 구분한다 — 순수 시각 신호다. 스크린리더
   사용자가 대화 이력을 위/아래로 탐색하면 각 버블이 "질문"인지 "답변"인지
   알 수 없었다(발화자 정보가 표현(presentation)에만 있고 의미 구조에 없음).
   해결: 화면에 보이지 않는 `.sr-only` 라벨("내 질문 N."/"상담 답변 N.")을 각 턴
   첫머리에 넣어 발화자를 SR 에 고지한다(시각 UI 무변경). ★N=대화 라운드 번호
   (Math.floor(i/2)+1, 질문·답변 한 쌍이 같은 번호) — 긴 이력에서 라벨이 전부
   똑같으면 SR 사용자가 "몇 번째 턴인지" 위치를 못 잡으므로 번호로 위치를 설명한다
   (WCAG 2.4.6 Headings and Labels). 번호는 표현(presentation) 아닌 라벨 텍스트.

   ★스트리밍 과다 낭독과 무관: 이 라벨은 정적 텍스트이고 라이브 영역(aria-live)이
   아니다 — 토큰마다 재낭독되지 않는다(스트리밍 상태 고지는 별도 `.advisor-live`,
   verify-advisor-livestatus 가 담당). 따라서 메시지 컨테이너에 role="log"/aria-live
   를 걸지 않는다(걸면 본문이 과다 낭독됨 — 직전 iteration 이 회피한 결함).

   핵심 불변식:
     (A) `.sr-only` 시각적 숨김 유틸 CSS 존재(clip·position absolute·1px).
     (B) 사용자 턴(.advisor-msg.user)이 .sr-only "내 질문" 라벨을 가짐.
     (C) 정상 답변 턴(.advisor-msg.assistant, .md 렌더)이 .sr-only "상담 답변"
         라벨을 .md 렌더 '앞'에 가짐.
     (D) 오류 답변 턴(role="alert")도 .sr-only "상담 답변" 라벨을 가짐(턴 식별 일관).
     (E) 라벨이 .sr-only(시각 숨김)라 화면 표시 무변경(가시 텍스트로 새지 않음).
     (F) ★과다 낭독 회피 — 메시지 컨테이너(.advisor-msgs)에 role="log" 미부착
         (aria-live 함의로 스트리밍 본문 과다 낭독 방지) + aria-busy 기존 배선 보존.
     (G) 무회귀 — user/assistant 클래스·role="alert"·스트리밍 .advisor-live 보존.

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-advisor-turnlabels.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const chat = readFileSync(path.join(root, "src", "components", "advisor", "AdvisorChat.tsx"), "utf8");
const css = readFileSync(path.join(root, "src", "app", "globals.css"), "utf8");

const USER_LABEL = "내 질문 {turn}.";
const ASSISTANT_LABEL = "상담 답변 {turn}.";

// 렌더의 세 턴 블록을 마커로 격리해 위치 기반 단언에 사용.
const userIdx = chat.indexOf('className="advisor-msg user"');
const userSeg = userIdx >= 0 ? chat.slice(userIdx, userIdx + 320) : "";
const errIdx = chat.indexOf('className="advisor-msg assistant" role="alert"');
const errSeg = errIdx >= 0 ? chat.slice(errIdx, errIdx + 320) : "";
const normIdx = chat.indexOf('className="advisor-msg assistant">');
const normSeg = normIdx >= 0 ? chat.slice(normIdx, normIdx + 320) : "";

console.log("\n[A] .sr-only 시각적 숨김 유틸 CSS");
{
  const m = css.match(/\.sr-only\s*\{([^}]*)\}/);
  ok(!!m, ".sr-only 정의 존재");
  const decl = m ? m[1] : "";
  ok(/clip:\s*rect\(/.test(decl), ".sr-only clip: rect(...)(시각적 클립)");
  ok(/overflow:\s*hidden/.test(decl), ".sr-only overflow: hidden");
  ok(/position:\s*absolute/.test(decl), ".sr-only position: absolute(레이아웃 무영향)");
  ok(/width:\s*1px/.test(decl), ".sr-only width: 1px");
}

console.log("\n[B] 사용자 턴 발화자 라벨(라운드 번호 포함)");
{
  ok(userIdx >= 0, ".advisor-msg.user 턴 블록 존재");
  ok(/<span className="sr-only">내 질문 \{turn\}\. <\/span>/.test(userSeg), "user 턴이 .sr-only \"내 질문 {turn}.\" 라벨을 가짐");
  // 라벨이 {m.content}(가시 본문) '앞'에 위치 → SR 이 발화자 먼저 읽음
  const labelAt = userSeg.indexOf(USER_LABEL);
  const contentAt = userSeg.indexOf("{m.content}");
  ok(labelAt >= 0 && contentAt > labelAt, "라벨이 사용자 본문({m.content}) 앞에 위치");
}

console.log("\n[C] 정상 답변 턴 발화자 라벨 (.md 렌더 앞)");
{
  ok(normIdx >= 0, ".advisor-msg.assistant 정상 턴 블록 존재");
  ok(/<span className="sr-only">상담 답변 \{turn\}\. <\/span>/.test(normSeg), "정상 답변 턴이 .sr-only \"상담 답변 {turn}.\" 라벨을 가짐");
  const labelAt = normSeg.indexOf(ASSISTANT_LABEL);
  const mdAt = normSeg.indexOf('className="md"');
  ok(labelAt >= 0 && mdAt > labelAt, "라벨이 답변 본문(.md) 앞에 위치");
}

console.log("\n[D] 오류 답변 턴도 발화자 라벨(턴 식별 일관)");
{
  ok(errIdx >= 0, "오류 답변 턴(role=alert) 블록 존재");
  ok(/<span className="sr-only">상담 답변 \{turn\}\. <\/span>/.test(errSeg), "오류 턴이 .sr-only \"상담 답변 {turn}.\" 라벨을 가짐");
  ok(/role="alert"/.test(errSeg), "오류 턴 role=\"alert\" 보존(실제 오류 즉시 낭독)");
}

console.log("\n[E] 라벨은 .sr-only/aria-label(시각 숨김) — 화면 표시 무변경");
{
  // 발화자 문구가 .sr-only 스팬 안에서만 등장(가시 텍스트로 새지 않음).
  const userLabelSpans = (chat.match(/<span className="sr-only">내 질문 \{turn\}\. <\/span>/g) || []).length;
  ok(userLabelSpans === 1, "\"내 질문 {turn}.\" 라벨은 .sr-only 스팬 1회만(가시 노출 0)");
  const asstLabelSpans = (chat.match(/<span className="sr-only">상담 답변 \{turn\}\. <\/span>/g) || []).length;
  ok(asstLabelSpans === 2, "\"상담 답변 {turn}.\" 라벨은 .sr-only 스팬 2회(정상·오류 턴)만");
  // 발화자 문구가 .sr-only 스팬·aria-label(둘 다 시각 비노출)·주석(비-렌더) 밖
  // 가시 텍스트로 새지 않는지: 비노출/비렌더 경로를 제거한 뒤 "내 질문" 잔존 0.
  const stripped = chat
    .replace(/\/\*[\s\S]*?\*\//g, "")       // 블록 주석(/* … */ · JSX 주석 포함)
    .replace(/\/\/[^\n]*/g, "")             // 라인 주석(// …)
    .replace(/<span className="sr-only">[^<]*<\/span>/g, "")
    .replace(/aria-label=\{`[^`]*`\}/g, "");
  ok(!stripped.includes("내 질문"), "\"내 질문\" 이 .sr-only/aria-label/주석 밖 가시 텍스트로 새지 않음");
}

console.log("\n[H] ★라운드 번호 출처 — Math.floor(i/2)+1(질문·답변 한 쌍이 같은 번호)");
{
  ok(/const turn = Math\.floor\(i \/ 2\) \+ 1;/.test(chat),
    "turn = Math.floor(i / 2) + 1 파생(msgs user→assistant 교대 전제)");
  // 세 턴 라벨이 모두 동일한 {turn} 변수를 참조(라벨/탐색 이름 번호 일관)
  ok(/aria-label=\{`내 질문 \$\{turn\}`\}/.test(chat), "user article aria-label 에 ${turn} 번호 포함");
  ok((chat.match(/aria-label=\{`상담 답변 \$\{turn\}`\}/g) || []).length === 2,
    "정상·오류 답변 article aria-label 에 ${turn} 번호 포함(2회)");
}

console.log("\n[F] ★과다 낭독 회피 — 컨테이너 role=log/aria-live 미부착");
{
  const idx = chat.indexOf('className="advisor-msgs"');
  ok(idx >= 0, ".advisor-msgs 컨테이너 존재");
  const seg = idx >= 0 ? chat.slice(idx, idx + 140) : "";
  ok(!/role="log"/.test(seg), ".advisor-msgs 에 role=\"log\" 미부착(스트리밍 본문 과다 낭독 방지)");
  ok(!/aria-live=/.test(seg), ".advisor-msgs 에 aria-live 미부착(라이브 영역은 .advisor-live 전담)");
  ok(/aria-busy=\{busy\}/.test(seg), ".advisor-msgs aria-busy={busy} 기존 배선 보존");
}

console.log("\n[G] 무회귀 — 기존 턴 구조·라이브 영역 보존");
{
  ok(/className="advisor-msg user"/.test(chat), "user 턴 클래스 보존");
  ok(/className="advisor-msg assistant"/.test(chat), "assistant 턴 클래스 보존");
  ok(/className="advisor-live"/.test(chat), "스트리밍 상태 라이브 영역(.advisor-live) 보존");
  ok(/role="status" aria-live="polite"/.test(chat), "라이브 영역 role=status·aria-live=polite 보존");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
process.exit(fail === 0 ? 0 : 1);
