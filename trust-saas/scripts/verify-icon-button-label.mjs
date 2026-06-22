/* ============================================================
   회귀 가드 — 글리프(✕)-only 아이콘 버튼 접근명 일관화

   배경(a11y·WCAG 4.1.2 Name·Role·Value / 1.3.1, 비-산출물·표시 경계만):
   위저드에는 텍스트 없이 글리프 "✕" 만 담은 아이콘 버튼이 세 곳 있었다 —
   ① ChatPanel 어시스턴트 닫기 ② PartyCard 당사자 삭제 ③ StepProperty 부동산 삭제.
   그 중 ChatPanel·StepProperty 는 aria-label·title 이 전무해 버튼의 접근명이
   글리프 "✕"(곱셈 기호) 콘텐츠로만 계산돼 스크린리더에 행동이 미고지됐고
   (SR 이 "✕" 를 "multiplication"/무의미로 낭독), PartyCard 는 title="삭제" 만
   있어 ① title 단독은 접근명으로 불안정 ② 어느 당사자인지 불명 ③ 글리프가
   aria-hidden 처리 안 됨. ★같은 PartyCard 의 ▲▼ 순서변경 버튼은 이미
   aria-label + title + <span aria-hidden="true">글리프</span> 패턴으로 동등화돼
   있었는데(grep), 삭제·닫기 ✕ 버튼만 그 패리티가 빠진 마지막 글리프-only 갭.

   해결: 세 ✕ 버튼 모두 행동을 서술하는 aria-label + title(마우스 툴팁) 부여 +
   글리프를 <span aria-hidden="true">✕</span> 로 감싸 장식 처리(시각 무변경).
   삭제 버튼은 어느 항목인지 인덱스를 접근명에 포함(PartyCard=`${label} N 삭제`,
   StepProperty=`부동산 N 삭제`).

   핵심 불변식:
     (A) ChatPanel 닫기 = type=button·aria-label·title·글리프 aria-hidden.
     (B) PartyCard 삭제 = aria-label(당사자 인덱스 포함)·title·글리프 aria-hidden.
     (C) StepProperty 삭제 = aria-label(부동산 인덱스 포함)·title·글리프 aria-hidden.
     (D) 무회귀 — onClose/removeParty/removeProperty 배선 보존, 맨몸 "✕" 텍스트
         노드(aria-hidden 미적용) 잔존 0, ▲▼ 순서변경 동형 패턴 유지.

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-icon-button-label.mjs
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
const rd = (...p) => readFileSync(path.join(root, ...p), "utf8");
const chat = rd("src", "components", "trust", "ChatPanel.tsx");
const party = rd("src", "components", "trust", "steps", "PartyCard.tsx");
const prop = rd("src", "components", "trust", "steps", "StepProperty.tsx");

// 닫기/삭제 버튼 블록을 onClose/onClick 마커로 격리한다.
const seg = (src, marker, span = 320) => {
  const i = src.indexOf(marker);
  return i >= 0 ? src.slice(i - 160, i + span) : "";
};

console.log("\n[A] ChatPanel 닫기 — aria-label·title·글리프 aria-hidden");
{
  const s = seg(chat, "onClick={onClose}");
  ok(s.length > 0, "닫기 버튼 블록 존재");
  ok(/aria-label="AI 어시스턴트 닫기"/.test(s), "aria-label(행동 = 어시스턴트 닫기)");
  ok(/title="닫기"/.test(s), 'title="닫기"(마우스 툴팁)');
  ok(/<span aria-hidden="true">✕<\/span>/.test(s), "글리프 ✕ 가 aria-hidden span(장식)");
  ok(/type="button"/.test(s), "type=button(form submit 오발동 방지)");
}

console.log("\n[B] PartyCard 삭제 — aria-label(인덱스)·title·글리프 aria-hidden");
{
  const s = seg(party, "removeParty(role, idx)");
  ok(s.length > 0, "삭제 버튼 블록 존재");
  ok(/aria-label=\{`\$\{label\} \$\{idx \+ 1\} 삭제`\}/.test(s), "aria-label 에 당사자 라벨·인덱스 포함");
  ok(/title="삭제"/.test(s), 'title="삭제" 보존');
  ok(/<span aria-hidden="true">✕<\/span>/.test(s), "글리프 ✕ 가 aria-hidden span(장식)");
}

console.log("\n[C] StepProperty 삭제 — aria-label(인덱스)·title·글리프 aria-hidden");
{
  const s = seg(prop, "removeProperty(i)");
  ok(s.length > 0, "삭제 버튼 블록 존재");
  ok(/aria-label=\{`부동산 \$\{i \+ 1\} 삭제`\}/.test(s), "aria-label 에 부동산 인덱스 포함");
  ok(/title="삭제"/.test(s), 'title="삭제" 부여');
  ok(/<span aria-hidden="true">✕<\/span>/.test(s), "글리프 ✕ 가 aria-hidden span(장식)");
  ok(/type="button"/.test(s), "type=button");
}

console.log("\n[D] 무회귀 — 배선 보존·맨몸 ✕ 잔존 0·▲▼ 동형 패턴 유지");
{
  ok(/onClick=\{onClose\}/.test(chat), "ChatPanel onClose 배선 보존");
  ok(/onClick=\{\(\) => removeParty\(role, idx\)\}/.test(party), "PartyCard removeParty 배선 보존");
  ok(/onClick=\{\(\) => removeProperty\(i\)\}/.test(prop), "StepProperty removeProperty 배선 보존");
  // 파일 내 모든 ✕ 글리프는 반드시 aria-hidden span 안에 있어야 한다 = 맨몸 텍스트 노드 0.
  // (전체 ✕ 개수 === aria-hidden span 으로 감싼 ✕ 개수)
  const cnt = (src, re) => (src.match(re) || []).length;
  const allHidden = (src) => cnt(src, /✕/g) === cnt(src, /aria-hidden="true">✕<\/span>/g);
  ok(allHidden(chat), "ChatPanel ✕ 전부 aria-hidden span(맨몸 0)");
  ok(allHidden(party), "PartyCard ✕ 전부 aria-hidden span(맨몸 0)");
  ok(allHidden(prop), "StepProperty ✕ 전부 aria-hidden span(맨몸 0)");
  // PartyCard ▲▼ 순서변경 버튼은 같은 패턴(aria-label + 글리프 aria-hidden)을 이미 갖춤 — 패리티 기준.
  ok(/<span aria-hidden="true">▲<\/span>/.test(party), "PartyCard ▲ 동형 패턴 유지(패리티 기준)");
  ok(/<span aria-hidden="true">▼<\/span>/.test(party), "PartyCard ▼ 동형 패턴 유지(패리티 기준)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
process.exit(fail === 0 ? 0 : 1);
