/* ============================================================
   회귀 가드 — DocStep 입력 라벨↔컨트롤 접근성 계약

   배경(접근성 결함, 비-산출물): DocStep.tsx 의 7종 서류 입력 surface 는
   각 필드를 `<div className="field-label">{f.label}</div>` + 이름 없는
   `<input/select/textarea>` 로 렌더해 ①라벨↔컨트롤 연결(htmlFor/id) 부재로
   라벨 클릭 시 포커스 안 됨 ②스크린리더가 컨트롤 접근명을 못 얻음
   (특히 placeholder 없는 textarea 는 접근명이 아예 없음) 의 결함이 있었다.
   같은 위저드의 stepper(14:34)·탭·pill 은 이미 a11y 정비됐는데 주 데이터
   입력면만 남아 있었다(B2B 법률서류 SaaS = 웹접근성 요구).

   수정: text/amount/select/textarea 의 field-label 을 <label htmlFor={id}>
   로 바꾸고 컨트롤에 동일 id 부여(서류·필드별 고유 `doc-${docId}-${key}`).
   radio 는 단일 htmlFor 가 부적합하므로 그룹 라벨에 id + 옵션 컨테이너에
   role="radiogroup" aria-labelledby 로 연결(개별 옵션은 기존 감싼 <label>
   로 이름 유지). toggle 은 이미 컨트롤을 <label> 로 감싸 접근명 보유.

   본 가드는 그 접근성 계약을 정적으로 단언해 div-라벨 회귀를 막는다.
     (A) text/amount/select/textarea field-label = <label className="field-label" htmlFor=…>
     (B) 각 컨트롤(input/select/textarea)에 id={fid} 부여 + fid 단일 출처 패턴
     (C) field-label 을 가진 무연결 <div> 잔존 0 (radio 그룹 라벨 제외)
     (D) radio 그룹 = role="radiogroup" + aria-labelledby (그룹 라벨 id 연결)
     (E) toggle 은 컨트롤을 감싼 <label className="inline-check"> 로 접근명 보유

   실행:
     cd trust-saas
     node scripts/verify-docstep-label-a11y.mjs
   ============================================================ */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(
  join(root, "src/components/trust/steps/DocStep.tsx"),
  "utf8",
);

let pass = 0;
let fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log("  PASS  " + label); }
  else { fail++; console.log("  FAIL  " + label); }
};

console.log("=== DocStep 라벨↔컨트롤 접근성 검증 ===\n");

// ── (B) fid 단일 출처 패턴 ──
ok(
  /const\s+fid\s*=\s*`doc-\$\{docId\}-\$\{f\.key\}`/.test(src),
  "(B1) fid 단일 출처 = `doc-${docId}-${f.key}` (서류·필드별 고유 id)",
);
// 컨트롤 3종 + 그룹 라벨에 id={fid} / htmlFor={fid} 사용
ok(
  (src.match(/htmlFor=\{fid\}/g) || []).length >= 3,
  "(B2) <label htmlFor={fid}> ≥3곳(text/amount·select·textarea)",
);
ok(
  (src.match(/id=\{fid\}/g) || []).length >= 4,
  "(B3) id={fid} ≥4곳(input·select·textarea·radio 그룹 라벨)",
);

// ── (A) 각 컨트롤이 라벨과 연결 ──
// textarea: <label … htmlFor={fid}> … <textarea id={fid}
ok(
  /htmlFor=\{fid\}[^]*?<textarea\s+id=\{fid\}/.test(src),
  "(A1) textarea: <label htmlFor={fid}> + <textarea id={fid}>",
);
ok(
  /htmlFor=\{fid\}[^]*?<select\s+id=\{fid\}/.test(src),
  "(A2) select: <label htmlFor={fid}> + <select id={fid}>",
);
ok(
  /htmlFor=\{fid\}[^]*?<input\s+id=\{fid\}/.test(src),
  "(A3) text/amount: <label htmlFor={fid}> + <input id={fid}>",
);

// ── (C) field-label 을 가진 무연결 <div> 잔존 0 (radio 그룹 라벨만 허용) ──
const divFieldLabels = src.match(/<div className="field-label"[^>]*>/g) || [];
// radio 그룹 라벨만 id 를 가진 div 로 허용 — 그 외 div field-label 은 0 이어야 함
const nonGroupDivLabels = divFieldLabels.filter((d) => !/id=\{fid\}/.test(d));
ok(
  nonGroupDivLabels.length === 0,
  `(C) field-label 가진 무연결 <div> 잔존 0 (실제 ${nonGroupDivLabels.length})`,
);
ok(
  divFieldLabels.length === 1 && /id=\{fid\}/.test(divFieldLabels[0]),
  "(C2) 남은 div.field-label 은 radio 그룹 라벨(id={fid}) 1곳뿐",
);

// ── (D) radio 그룹 = role=radiogroup + aria-labelledby ──
ok(
  /role="radiogroup"\s+aria-labelledby=\{fid\}/.test(src),
  "(D) radio: role=radiogroup + aria-labelledby={fid} (그룹 라벨 연결)",
);

// ── (E) toggle 은 컨트롤을 감싼 <label className="inline-check"> 로 접근명 ──
ok(
  /<label className="inline-check">\s*<input type="checkbox"/.test(src),
  "(E) toggle: <label className=inline-check> 가 checkbox 를 감쌈(접근명 보유)",
);

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
