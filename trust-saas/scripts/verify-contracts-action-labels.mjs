/* ============================================================
   회귀 가드 — 내 계약 목록 카드 액션 버튼 접근명에 계약 제목 부여

   배경(a11y·WCAG 2.4.4 Link/Button Purpose / 4.1.2 Name·Role·Value,
   비-산출물·표시 경계만): ContractsView 의 각 계약 카드는 우측에 동일한
   일반 텍스트 액션 버튼을 반복 렌더한다 — 열기·이름변경·복제·삭제·서류 N종
   생성·협약서 생성. 카드 본문 div 는 이미 role=button + aria-label(openLabel)
   로 동등화돼 있으나(`680b3aa` 패턴), 우측 액션 버튼들은 텍스트("삭제" 등)만
   접근명으로 가져 ★스크린리더가 버튼 목록(rotor)을 훑으면 "열기·복제·삭제·
   열기·복제·삭제…" 가 어느 계약 것인지 구별되지 않았다. 특히 "삭제"는 어느
   계약을 영구 유실시키는지 불명이라 위험(7초 실행취소가 있어도 잘못 누름 자체가
   비용). 삭제 실행취소 바의 "실행취소" 버튼도 연속 삭제 시 여러 개가 동일
   텍스트라 같은 갭(바 본문엔 제목이 있으나 버튼 접근명엔 없음).

   해결: 카드 액션 버튼 6종 + 실행취소 버튼에 계약 제목을 포함한 aria-label
   부여(가시 텍스트·title·onClick 배선 전부 보존 = 시각 무변경, 접근명만 보강).
   PartyCard 삭제 버튼이 `${label} ${idx+1} 삭제` 로 인덱스를 접근명에 넣는
   것과 동형(`ca7f4ef`) — 여기선 항목 식별자가 계약 제목(r.title / u.title).

   핵심 불변식:
     (A) 카드 액션 버튼 6종 모두 aria-label 에 `${r.title}` 포함.
     (B) 실행취소 버튼 aria-label 에 `${u.title}` 포함.
     (C) 무회귀 — 가시 텍스트(열기/이름변경/복제/삭제/실행취소)·title·onClick
         배선 보존, 카드 본문 div 의 기존 aria-label(openLabel) 유지.

   실행:
     cd trust-saas
     node --experimental-strip-types --loader ./scripts/ts-ext-loader.mjs scripts/verify-contracts-action-labels.mjs
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
const src = rd("src", "components", "trust", "ContractsView.tsx");

// 버튼 블록을 onClick 마커로 격리한다(앞뒤로 넉넉히 떠서 같은 버튼의 aria-label 포착).
const seg = (marker, before = 160, after = 220) => {
  const i = src.indexOf(marker);
  return i >= 0 ? src.slice(i - before, i + after) : "";
};

console.log("\n[A] 카드 액션 버튼 6종 — aria-label 에 계약 제목(${r.title}) 포함");
{
  const docs = seg("onClick={() => generateRowDocs(r)}");
  ok(docs.length > 0, "서류 N종 생성 버튼 블록 존재");
  ok(/aria-label=\{`\$\{r\.title\} — 준비된 서류 \$\{readiness\.ready\}종 생성`\}/.test(docs),
    "서류 생성 aria-label = 제목 + 준비 종수");

  const joint = seg("onClick={() => generateRowJoint(r)}");
  ok(joint.length > 0, "협약서 생성 버튼 블록 존재");
  ok(/aria-label=\{`\$\{r\.title\} 협약서 생성`\}/.test(joint), "협약서 생성 aria-label = 제목");

  // "열기" 버튼은 onClick={() => onOpen(r)} 가 카드 본문 div 와 버튼 두 곳이라
  // 버튼 쪽(가시 텍스트 "열기" 직전)을 텍스트로 특정한다.
  const openBtn = (() => {
    const i = src.indexOf("\n                    열기");
    return i >= 0 ? src.slice(i - 220, i + 10) : "";
  })();
  ok(openBtn.length > 0, "열기 버튼 블록 존재");
  ok(/aria-label=\{`\$\{r\.title\} 열기`\}/.test(openBtn), "열기 aria-label = 제목");

  const rename = seg("onClick={() => startRename(r)}");
  ok(rename.length > 0, "이름변경 버튼 블록 존재");
  ok(/aria-label=\{`\$\{r\.title\} 이름변경`\}/.test(rename), "이름변경 aria-label = 제목");

  const dup = seg("onClick={() => onDuplicate(r.id)}");
  ok(dup.length > 0, "복제 버튼 블록 존재");
  ok(/aria-label=\{`\$\{r\.title\} 복제`\}/.test(dup), "복제 aria-label = 제목");

  const del = seg("onClick={() => onDelete(r)}");
  ok(del.length > 0, "삭제 버튼 블록 존재");
  ok(/aria-label=\{`\$\{r\.title\} 삭제`\}/.test(del), "삭제 aria-label = 제목(어느 계약 삭제인지 명시)");
}

console.log("\n[B] 삭제 실행취소 버튼 — aria-label 에 계약 제목(${u.title}) 포함");
{
  const undo = seg("onClick={() => onUndoDelete(u)}");
  ok(undo.length > 0, "실행취소 버튼 블록 존재");
  ok(/aria-label=\{`\$\{u\.title\} 삭제 실행취소`\}/.test(undo), "실행취소 aria-label = 제목");
}

console.log("\n[C] 무회귀 — 가시 텍스트·title·onClick 배선·카드 본문 aria-label 보존");
{
  // 가시 텍스트 라벨 보존(접근명만 보강, 표시 무변경).
  ok(/>\s*열기\s*</.test(src), "가시 텍스트 '열기' 보존");
  ok(/>\s*이름변경\s*</.test(src), "가시 텍스트 '이름변경' 보존");
  ok(/>\s*복제\s*</.test(src), "가시 텍스트 '복제' 보존");
  ok(/>\s*삭제\s*</.test(src), "가시 텍스트 '삭제' 보존");
  ok(/>\s*실행취소\s*</.test(src), "가시 텍스트 '실행취소' 보존");
  // 기존 title(마우스 툴팁) 보존.
  ok(/title="이 계약의 이름\(제목\)을 바꿉니다"/.test(src), "이름변경 title 보존");
  ok(/title="이 계약을 입력값 그대로 사본으로 복제/.test(src), "복제 title 보존");
  // onClick 배선 보존.
  ok(/onClick=\{\(\) => onDelete\(r\)\}/.test(src), "삭제 onClick 배선 보존");
  ok(/onClick=\{\(\) => onUndoDelete\(u\)\}/.test(src), "실행취소 onClick 배선 보존");
  ok(/onClick=\{\(\) => onDuplicate\(r\.id\)\}/.test(src), "복제 onClick 배선 보존");
  // 카드 본문 div 의 기존 aria-label(openLabel) 유지 — 본 변경과 독립.
  ok(/"aria-label": openLabel/.test(src), "카드 본문 div aria-label(openLabel) 유지");
  ok(/const openLabel = `\$\{r\.title\}, \$\{statusLabel\}\$\{readyLabel\} — 열기`/.test(src),
    "openLabel 정의 보존(카드 본문 접근명)");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL  (단언 ${pass + fail}개)`);
process.exit(fail === 0 ? 0 : 1);
